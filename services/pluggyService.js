const { PluggyClient } = require('pluggy-sdk');
const ethers = require('ethers');
const config = require('../config');

class PluggyBankService {
    constructor() {
        const hasPluggyCreds = !!(config.pluggy.clientId && config.pluggy.clientSecret);
        this.pluggy = hasPluggyCreds
            ? new PluggyClient({
                clientId: config.pluggy.clientId,
                clientSecret: config.pluggy.clientSecret,
                sandbox: config.env !== 'production'
              })
            : null;

        // Build chain providers/wallets; token-specific oracle is discovered from the token itself
        this.BankOracleABI = require('../artifacts/contracts/BankOracle.sol/BankOracle.json').abi;
        this.BankBackedTokenABI = require('../artifacts/contracts/BankBackedToken.sol/BankBackedToken.json').abi;
        const isHexPriv = (k) => typeof k === 'string' && /^0x[0-9a-fA-F]{64}$/.test(k);
        const mkProvider = (rpc) => (rpc && isHexPriv(config.oracleUpdateKey) ? new ethers.JsonRpcProvider(rpc) : null);
        const mkWallet = (prov) => (prov && isHexPriv(config.oracleUpdateKey) ? new ethers.Wallet(config.oracleUpdateKey, prov) : null);
        this.providers = {
            celo: mkProvider(config.rpcEndpoint),
            celoSepolia: mkProvider(config.rpcEndpointSepolia)
        };
        this.wallets = {
            celo: mkWallet(this.providers.celo),
            celoSepolia: mkWallet(this.providers.celoSepolia)
        };

        // user PIX key to wallet linkage: key `${token}:${pixKey}` => wallet
        this.pixLinks = new Map();
        // last processed timestamp per item/account
        this.lastTxAt = new Map();

        this.connections = new Map();
    }

    async createConnection(tokenAddress, network = 'celo') {
        if (!tokenAddress || typeof tokenAddress !== 'string' || !tokenAddress.startsWith('0x')) {
            throw new Error('Invalid token address provided');
        }

        if (!this.pluggy) {
            throw new Error('Pluggy not configured');
        }

        if (!config.baseUrl) {
            throw new Error('BASE_URL environment variable is required');
        }

        if (!this.wallets[network]) {
            throw new Error(`Network not configured: ${network}`);
        }

        try {
            const connectSession = await this.pluggy.connect.create({
                redirectUri: `${config.baseUrl}/callback/pluggy`
            });

            this.connections.set(tokenAddress, {
                status: 'pending',
                connectToken: connectSession.connectToken,
                connectUrl: connectSession.connectUrl,
                expiresAt: connectSession.expiresAt,
                network
            });

            return {
                connectUrl: connectSession.connectUrl,
                expiresAt: connectSession.expiresAt
            };
        } catch (error) {
            console.error('Error creating Pluggy connection:', error.message);
            throw new Error('Failed to create bank connection');
        }
    }

    async handleWebhook(event) {
        if (!this.pluggy) {
            throw new Error('Pluggy not configured');
        }
        if (!event || !event.type) {
            throw new Error('Invalid webhook event: missing type');
        }

        // Webhook signature verification handled by Pluggy SDK (if configured)
        switch (event.type) {
            case 'CONNECTION_SUCCESS':
                if (!event.itemId) {
                    throw new Error('Invalid CONNECTION_SUCCESS event: missing itemId');
                }
                await this.onConnectionSuccess(event.itemId);
                // Kick mint processing for any token bound to this item
                {
                  const tokenAddress = Array.from(this.connections.keys()).find((key) => {
                    const c = this.connections.get(key);
                    return c?.itemId === event.itemId;
                  });
                  if (tokenAddress) await this.processIncomingMints(tokenAddress);
                }
                break;
            case 'ACCOUNTS_UPDATED':
                if (!event.itemId) {
                    throw new Error('Invalid ACCOUNTS_UPDATED event: missing itemId');
                }
                await this.updateBalances(event.itemId);
                {
                  const tokenAddress = Array.from(this.connections.keys()).find((key) => this.connections.get(key)?.itemId === event.itemId);
                  if (tokenAddress) await this.processIncomingMints(tokenAddress);
                }
                break;
            default:
                console.log(`Unhandled webhook event type: ${event.type}`);
        }
    }

    async onConnectionSuccess(itemId) {
        if (!itemId || typeof itemId !== 'string') {
            throw new Error('Invalid itemId provided');
        }

        try {
            // Get account details from Pluggy
            const accounts = await this.pluggy.accounts.get(itemId);
            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts found for the connected item');
            }

            const primaryAccount = accounts[0]; // Use first account
            if (!primaryAccount.id || !primaryAccount.balance || typeof primaryAccount.balance !== 'number') {
                throw new Error('Invalid account data received from Pluggy');
            }

            // Find the pending connection by itemId recorded earlier (fallback to connectToken match)
            const tokenAddress = Array.from(this.connections.keys()).find((key) => {
                const c = this.connections.get(key);
                return c.itemId === itemId || c.connectToken === itemId;
            });

            if (!tokenAddress) {
                console.error(`No token address found for itemId: ${itemId}`);
                return;
            }

            this.connections.set(tokenAddress, {
                ...this.connections.get(tokenAddress),
                status: 'connected',
                accountId: primaryAccount.id,
                itemId
            });

            // Link account to token in oracle on the selected network
            const net = this.connections.get(tokenAddress).network || 'celo';
            const wallet = this.wallets[net];
            const token = new ethers.Contract(tokenAddress, this.BankBackedTokenABI, wallet);
            const oracleAddr = await token.bankOracle();
            const oracle = new ethers.Contract(oracleAddr, this.BankOracleABI, wallet);
            const linkTx = await oracle.linkAccount(tokenAddress, primaryAccount.id);
            await linkTx.wait();

            // Update initial balance
            const balanceCentavos = Math.floor(primaryAccount.balance * 100);
            if (balanceCentavos < 0) {
                throw new Error('Invalid balance: cannot be negative');
            }

            const updateTx = await oracle.updateBalance(tokenAddress, primaryAccount.id, balanceCentavos);
            await updateTx.wait();

            console.log(`Successfully connected account ${primaryAccount.id} to token ${tokenAddress}`);
        } catch (error) {
            console.error('Error in onConnectionSuccess:', error.message);
            throw error;
        }
    }

    async updateBalances(itemId) {
        if (!itemId || typeof itemId !== 'string') {
            throw new Error('Invalid itemId provided');
        }

        try {
            // Get updated account details from Pluggy
            const accounts = await this.pluggy.accounts.get(itemId);
            if (!accounts || accounts.length === 0) {
                console.warn(`No accounts found for itemId: ${itemId}`);
                return;
            }

            const tokenAddress = Array.from(this.connections.keys()).find((key) => this.connections.get(key).itemId === itemId);

            if (!tokenAddress) {
                console.error(`No token address found for itemId: ${itemId}`);
                return;
            }

            const connection = this.connections.get(tokenAddress);
            if (!connection || connection.status !== 'connected') {
                console.warn(`Connection not active for token: ${tokenAddress}`);
                return;
            }

            // Update balances for all accounts
            for (const account of accounts) {
                if (account.id === connection.accountId) {
                    if (!account.balance || typeof account.balance !== 'number') {
                        console.error(`Invalid balance data for account ${account.id}`);
                        continue;
                    }

                    const balanceCentavos = Math.floor(account.balance * 100);
                    if (balanceCentavos < 0) {
                        console.error(`Invalid balance for account ${account.id}: cannot be negative`);
                        continue;
                    }

                    const net = this.connections.get(tokenAddress).network || 'celo';
                    const wallet = this.wallets[net];
                    const token = new ethers.Contract(tokenAddress, this.BankBackedTokenABI, wallet);
                    const oracleAddr = await token.bankOracle();
                    const oracle = new ethers.Contract(oracleAddr, this.BankOracleABI, wallet);
                    const updateTx = await oracle.updateBalance(tokenAddress, account.id, balanceCentavos);
                    await updateTx.wait();
                    console.log(`Updated balance for account ${account.id}: ${account.balance} BRL`);
                    break;
                }
            }
        } catch (error) {
            console.error('Error updating balances:', error.message);
            throw error;
        }
    }

    // Link a user's PIX key to their wallet for a given token (used to mint on inbound deposits)
    linkPixKey(tokenAddress, pixKey, wallet) {
        if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) throw new Error('Invalid token address');
        if (!pixKey || typeof pixKey !== 'string') throw new Error('Invalid pixKey');
        if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) throw new Error('Invalid wallet');
        const key = `${tokenAddress.toLowerCase()}:${pixKey}`;
        this.pixLinks.set(key, wallet);
        return true;
    }

    // Process inbound deposits and mint tokens to registered wallets
    async processIncomingMints(tokenAddress) {
        const connection = this.connections.get(tokenAddress);
        if (!connection || connection.status !== 'connected') return;
        const { itemId, accountId, network } = connection;
        const wallet = this.wallets[network || 'celo'];
        if (!wallet) return;

        // fetch recent transactions via Pluggy
        const sinceKey = `${itemId}:${accountId}`;
        const since = this.lastTxAt.get(sinceKey) || new Date(Date.now() - 5 * 60 * 1000).toISOString();
        let txs = [];
        try {
            if (this.pluggy && this.pluggy.transactions && typeof this.pluggy.transactions.get === 'function') {
                txs = await this.pluggy.transactions.get(itemId, accountId, { from: since });
            } else if (this.pluggy && typeof this.pluggy.fetchTransactions === 'function') {
                txs = await this.pluggy.fetchTransactions(itemId, accountId, { from: new Date(since) });
            }
        } catch (e) {
            console.error('Fetching transactions failed:', e.message);
            return;
        }

        const token = new ethers.Contract(tokenAddress, this.BankBackedTokenABI, wallet);
        const decimals = await token.decimals();
        const admin = (await token.mintAdmin?.()) || (await token.masterMinter?.());
        const ourAddr = (await token.signer.getAddress?.()) || this.wallets[network || 'celo']?.address;
        if (admin && ourAddr && admin.toLowerCase() !== ourAddr.toLowerCase()) {
            console.error('Mint wallet is not the token admin/minter; skipping auto-mint');
            return;
        }

        for (const t of txs || []) {
            const desc = String(t.description || t.memo || t.counterparty || '').trim();
            const pixKey = desc; // simplistic: assume description contains sender's PIX key
            const key = `${tokenAddress.toLowerCase()}:${pixKey}`;
            const toWallet = this.pixLinks.get(key);
            if (!toWallet) continue;

            const amountBRL = Number(t.amount || 0);
            if (amountBRL <= 0) continue;
            const amountUnits = ethers.parseUnits(amountBRL.toString(), decimals);

            try {
                // Ensure oracle balance is fresh and backing enforced by token's modifier
                // Requires backend wallet (admin) to be configured as minter with sufficient allowance
                // Step 1: Mint to admin wallet (prefer infinite backed path)
                let minted = false;
                try {
                    if (typeof token.adminMintBacked === 'function') {
                        const tx1 = await token.adminMintBacked(admin, amountUnits);
                        await tx1.wait();
                        minted = true;
                    }
                } catch (_) {}
                if (!minted) {
                    const tx1 = await token.mint(admin, amountUnits);
                    await tx1.wait();
                }
                // Step 2: Transfer to user's wallet
                const transferTx = await token.transfer(toWallet, amountUnits);
                await transferTx.wait();
                this.lastTxAt.set(sinceKey, new Date().toISOString());
                console.log(`Minted ${amountBRL} to admin and sent to ${toWallet} for token ${tokenAddress}`);
            } catch (e) {
                console.error('Mint attempt failed:', e.message);
            }
        }
    }

    // Redemption: user transfers tokens to backend wallet (minter). Then call this to pay PIX and burn.
    async redeem(tokenAddress, pixKey, amount, network = 'celo') {
        const wallet = this.wallets[network];
        if (!wallet) throw new Error('Network not configured');
        if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) throw new Error('Invalid token address');
        if (!pixKey) throw new Error('pixKey required');
        if (!amount || Number(amount) <= 0) throw new Error('amount must be > 0');

        const token = new ethers.Contract(tokenAddress, this.BankBackedTokenABI, wallet);
        const decimals = await token.decimals();
        const amountUnits = ethers.parseUnits(String(amount), decimals);

        // Ensure backend wallet holds the tokens (user should have transferred for redemption)
        const bal = await token.balanceOf(wallet.address);
        if (bal < amountUnits) {
            throw new Error('Redemption account has insufficient tokens. Transfer tokens first.');
        }

        // Send PIX payout
        if (typeof this.pluggy.initiatePayment === 'function') {
            await this.pluggy.initiatePayment({
                accountId: this.connections.get(tokenAddress)?.accountId,
                recipient: pixKey,
                amount: Number(amount),
            });
        }

        // Burn tokens from backend wallet (must be a minter)
        const burnTx = await token.burn(amountUnits);
        await burnTx.wait();
        return true;
    }

    startBalanceUpdates() {
        if (!this.pluggy) return; // nothing to schedule
        setInterval(async () => {
            for (const [tokenAddress, connection] of this.connections) {
                if (connection.status === 'connected') {
                    await this.updateBalances(connection.itemId);
                    await this.processIncomingMints(tokenAddress);
                }
            }
        }, 300000); // 5 minutes
    }

    isHealthy() {
        return !!this.pluggy; // oracleContract may be intentionally unset until deployment
    }
}

module.exports = PluggyBankService;
