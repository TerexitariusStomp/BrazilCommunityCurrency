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

        if (config.rpcEndpoint && config.oracleUpdateKey && config.oracleAddress) {
            this.provider = new ethers.JsonRpcProvider(config.rpcEndpoint);
            this.oracleWallet = new ethers.Wallet(config.oracleUpdateKey, this.provider);
            const BankOracleABI = require('../artifacts/contracts/BankOracle.sol/BankOracle.json').abi;
            this.oracleContract = new ethers.Contract(
                config.oracleAddress,
                BankOracleABI,
                this.oracleWallet
            );
        } else {
            this.provider = null;
            this.oracleWallet = null;
            this.oracleContract = null;
        }

        this.connections = new Map();
    }

    async createConnection(tokenAddress) {
        if (!tokenAddress || typeof tokenAddress !== 'string' || !tokenAddress.startsWith('0x')) {
            throw new Error('Invalid token address provided');
        }

        if (!this.pluggy) {
            throw new Error('Pluggy not configured');
        }

        if (!config.baseUrl) {
            throw new Error('BASE_URL environment variable is required');
        }

        try {
            const connectSession = await this.pluggy.connect.create({
                redirectUri: `${config.baseUrl}/callback/pluggy`
            });

            this.connections.set(tokenAddress, {
                status: 'pending',
                connectToken: connectSession.connectToken,
                connectUrl: connectSession.connectUrl,
                expiresAt: connectSession.expiresAt
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
                break;
            case 'ACCOUNTS_UPDATED':
                if (!event.itemId) {
                    throw new Error('Invalid ACCOUNTS_UPDATED event: missing itemId');
                }
                await this.updateBalances(event.itemId);
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

            const tokenAddress = Array.from(this.connections.keys()).find(
                key => this.connections.get(key).connectToken === itemId
            );

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

            // Link account to token in oracle
            if (!this.oracleContract) throw new Error('Oracle contract not configured');
            const linkTx = await this.oracleContract.linkAccount(tokenAddress, primaryAccount.id);
            await linkTx.wait();

            // Update initial balance
            const balanceCentavos = Math.floor(primaryAccount.balance * 100);
            if (balanceCentavos < 0) {
                throw new Error('Invalid balance: cannot be negative');
            }

            const updateTx = await this.oracleContract.updateBalance(
                tokenAddress,
                primaryAccount.id,
                balanceCentavos
            );
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

            const tokenAddress = Array.from(this.connections.keys()).find(
                key => this.connections.get(key).itemId === itemId
            );

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

                    if (!this.oracleContract) throw new Error('Oracle contract not configured');
                    const updateTx = await this.oracleContract.updateBalance(
                        tokenAddress,
                        account.id,
                        balanceCentavos
                    );
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

    startBalanceUpdates() {
        if (!this.pluggy) return; // nothing to schedule
        setInterval(async () => {
            for (const [tokenAddress, connection] of this.connections) {
                if (connection.status === 'connected') {
                    await this.updateBalances(connection.itemId);
                }
            }
        }, 600000); // 10 minutes
    }

    isHealthy() {
        return !!this.pluggy; // oracleContract may be intentionally unset until deployment
    }
}

module.exports = PluggyBankService;
