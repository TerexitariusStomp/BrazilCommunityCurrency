const EventEmitter = require('events');
const { Pool } = require('pg');
const { ethers } = require('ethers');
const config = require('../config');
const twilioWhatsApp = require('./twilioWhatsApp');
let PrivyClient = null; try { ({ PrivyClient } = require('@privy-io/server-auth')); } catch (_) {}

class WhatsAppService extends EventEmitter {
    constructor() {
        super();
        this.db = config.databaseUrl ? new Pool({ connectionString: config.databaseUrl }) : null;
        // Optional on-chain context for sending tokens via WhatsApp
        this.defaultToken = process.env.DEFAULT_TOKEN_ADDRESS || null;
        try {
            this.tokenAbi = require('../artifacts/contracts/BankBackedToken.sol/BankBackedToken.json').abi;
        } catch (_) {
            this.tokenAbi = null;
        }
        this.provider = config.rpcEndpoint ? new ethers.JsonRpcProvider(config.rpcEndpoint) : null;
        // Operator signer for server-initiated transferFrom (env-only; never persisted)
        try {
            const pk = config.privateKey;
            this.operator = (this.provider && typeof pk === 'string' && /^0x[0-9a-fA-F]{64}$/.test(pk))
              ? new ethers.Wallet(pk, this.provider)
              : null;
        } catch (_) {
            this.operator = null;
        }
        // No private key storage: do not persist or derive secrets server-side.
        // Any signing keys must be provided via process.env and never written to DB.
        // Initialize Privy server client (for user + wallet lifecycle, no keys handled here)
        this.privy = (PrivyClient && config.privy && config.privy.appId && config.privy.appSecret)
          ? new PrivyClient(config.privy.appId, config.privy.appSecret)
          : null;
    }

    buildLink(path, params = {}) {
        const base = config.baseUrl || '';
        const qs = new URLSearchParams(params).toString();
        const sep = base.includes('?') ? '&' : '?';
        return `${base.replace(/\/$/, '')}/${path}${qs ? sep + qs : ''}`;
    }

    // Derive a counterfactual wallet address from a phone number.
    // If SMART_WALLET_FACTORY and SMART_WALLET_INIT_CODE_HASH are set, use CREATE2 formula.
    // Otherwise, fall back to a keccak-derived 20-byte address for receiving ERC-20 tokens pre-deploy.
    deriveCounterfactualAddress(phoneE164) {
        const phone = this.normalizePhoneNumber(phoneE164);
        try {
            const factory = process.env.SMART_WALLET_FACTORY;
            const initCodeHash = process.env.SMART_WALLET_INIT_CODE_HASH; // keccak256(init_code)
            if (factory && /^0x[a-fA-F0-9]{40}$/.test(factory) && initCodeHash && /^0x[a-fA-F0-9]{64}$/.test(initCodeHash)) {
                const salt = ethers.keccak256(ethers.toUtf8Bytes(phone));
                const packed = ethers.concat([
                    '0xff',
                    factory,
                    salt,
                    initCodeHash
                ].map((v) => typeof v === 'string' ? v : v));
                const addr = '0x' + ethers.keccak256(packed).slice(-40);
                return ethers.getAddress(addr);
            }
        } catch (_) {}
        const h = ethers.keccak256(ethers.toUtf8Bytes(`phone:${phone}`));
        return ethers.getAddress('0x' + h.slice(-40));
    }

    // Removed encrypt/decrypt and any wallet_secrets persistence to avoid handling sensitive key material.

    async handleWhatsApp(sessionId, phoneNumber, text) {
        phoneNumber = this.normalizePhoneNumber(phoneNumber);

        if (!this.db) throw new Error('Database not configured');

        let sessionRow = await this.db.query(
            'SELECT state FROM whatsapp_sessions WHERE session_id = $1 LIMIT 1',
            [sessionId]
        );
        let session;
        if (sessionRow.rows.length === 0) {
            session = {
                state: 'MENU',
                phoneNumber,
                createdAt: Date.now()
            };
        } else {
            try {
                session = sessionRow.rows[0].state || {};
            } catch (_) {
                session = { state: 'MENU', phoneNumber };
            }
        }

        // Do not expose web3 details in WhatsApp; no direct 0x address handling here.

        let response;
        switch (session.state) {
            case 'MENU':
                response = this.showMainMenu();
                session.state = 'AWAITING_INPUT';
                break;

            case 'AWAITING_INPUT':
                response = await this.processMenuInput(text, session);
                break;

            case 'AWAITING_AMOUNT':
                response = await this.processAmountInput(text, session);
                break;

            case 'AWAITING_RECIPIENT':
                response = await this.processRecipientInput(text, session);
                break;

            case 'AWAITING_TOKEN':
                session.tokenAddress = (text || '').trim();
                session.state = 'MENU';
                response = `Token definido como ${session.tokenAddress}`;
                break;

            default:
                response = 'Erro: Estado inválido. Digite *123# para voltar ao menu.';
                session.state = 'MENU';
        }

        await this.db.query(
            `INSERT INTO whatsapp_sessions (session_id, phone_number, state)
             VALUES ($1, $2, $3)
             ON CONFLICT (session_id) DO UPDATE SET phone_number = EXCLUDED.phone_number, state = EXCLUDED.state, updated_at = NOW()`,
            [sessionId, phoneNumber, session]
        );

        return this.formatResponse('CONTINUE', response);
    }

    showMainMenu() {
        return `Bem-vindo ao Token Comunitário!
1. Ver saldo
2. Enviar tokens (WhatsApp)
3. Ver últimas transações
4. Cadastrar
5. Definir token (0x...)
Digite o número da opção desejada`;
    }

    async processMenuInput(input, session) {
        switch (input.trim()) {
            case '1':
                return await this.checkBalance(session.phoneNumber, session.tokenAddress || this.defaultToken);

            case '2':
                // Ensure sender has an associated account; if not, guide via link
                {
                  const w = await this.getWalletByPhone(session.phoneNumber);
                  if (!w || !w.address) {
                    session.state = 'AWAITING_INPUT';
                    const link = this.buildLink('setup', { phone: session.phoneNumber });
                    return `Para enviar, primeiro conclua a configuração da sua conta: ${link}`;
                  }
                }
                session.state = 'AWAITING_RECIPIENT';
                return 'Digite o número de telefone do destinatário (ex: +5511987654321)';

            case '3':
                return await this.getRecentHistory(session.phoneNumber);

            case '4':
                const privyResponse = await this.initiatePrivyAuth(session.phoneNumber);
                session.state = 'AWAITING_AUTH';
                session.authToken = privyResponse.authToken;
                return `Por favor, verifique seu WhatsApp para confirmar o login.`;

            case '5':
                session.state = 'AWAITING_TOKEN';
                return 'Envie o endereço do token (0x...) para usar nas operações.';

            default:
                return 'Opção inválida. Digite 1, 2, 3 ou 4.';
        }
    }

    async processRecipientInput(input, session) {
        session.recipient = this.normalizePhoneNumber(input);
        session.state = 'AWAITING_AMOUNT';
        // Invite recipient to set up account if missing
        const recWallet = await this.getWalletByPhone(session.recipient);
        if (!recWallet || !recWallet.address) {
            try {
                if (twilioWhatsApp.isConfigured()) {
                    const link = this.buildLink('setup', { phone: session.recipient });
                    await twilioWhatsApp.sendWhatsApp(session.recipient, `Você foi convidado(a) a receber. Conclua a configuração da sua conta: ${link}`);
                }
            } catch (_) {}
        }
        return 'Digite o valor a enviar (ex: 10) ou "10 SYMBOL" para escolher o token';
    }

    async processAmountInput(input, session) {
        let amount = parseFloat(input);
        let tokenAddress = session.tokenAddress || this.defaultToken;
        if (isNaN(amount) || amount <= 0) {
            const parts = String(input || '').trim().split(/\s+/);
            if (parts.length >= 2) {
                const a = parseFloat(parts[0]);
                if (!isNaN(a) && a > 0) {
                    amount = a;
                    const symbol = parts[1];
                    const addr = await this.findTokenBySymbol(symbol);
                    if (!addr) return `Token ${symbol} não encontrado.`;
                    tokenAddress = addr;
                }
            }
            if (isNaN(amount) || amount <= 0) {
                return 'Valor inválido. Envie no formato "10" ou "10 SYMBOL"';
            }
        }

        try {
            // Switch to user-signed flow: generate a link to a signing page.
            const link = this.buildLink('confirm-send.html', {
                from: session.phoneNumber,
                to: session.recipient,
                amount,
                token: tokenAddress
            });
            session.state = 'MENU';
            return `Para enviar, assine a transação com sua carteira: ${link}`;
        } catch (error) {
            // Fall back to user-signed link on any error.
            const link = this.buildLink('confirm-send.html', {
                from: session.phoneNumber,
                to: session.recipient,
                amount,
                token: tokenAddress
            });
            return `Não foi possível concluir automaticamente. Toque para assinar e concluir: ${link}`;
        }
    }

    async initiatePrivyAuth(phoneNumber) {
        // Simulate Privy phone authentication via WhatsApp
        // In production, integrate with Privy's phone auth API
        const authToken = `auth_${Math.random().toString(36).slice(2)}`;
        // Insert new token record with 5-min expiry
        await this.db.query(
            `INSERT INTO auth_tokens (phone_number, token, expires_at)
             VALUES ($1, $2, NOW() + INTERVAL '5 minutes')`,
            [phoneNumber, authToken]
        );

        // Always send via Twilio WhatsApp (required)
        const body = `Verifique sua identidade: https://auth.yourdomain.com/verify?token=${authToken}`;
        if (!twilioWhatsApp.isConfigured()) {
            throw new Error('Twilio WhatsApp not configured');
        }
        await twilioWhatsApp.sendWhatsApp(phoneNumber, body);

        return { authToken };
    }

    async verifyAuthToken(phoneNumber, token) {
        if (!this.db) throw new Error('Database not configured');
        const row = await this.db.query(
            `SELECT id, expires_at, used_at
             FROM auth_tokens
             WHERE phone_number = $1 AND token = $2
             ORDER BY created_at DESC
             LIMIT 1`,
            [phoneNumber, token]
        );
        const rec = row.rows[0];
        if (!rec) throw new Error('Invalid auth token');
        if (rec.used_at) throw new Error('Auth token already used');
        const nowOk = await this.db.query('SELECT NOW() < $1 AS valid', [rec.expires_at]);
        if (!nowOk.rows[0]?.valid) throw new Error('Auth token expired');
        const wallet = await this.registerUser(phoneNumber);
        // Mark token as used for audit trail
        await this.db.query(
            `UPDATE auth_tokens SET used_at = NOW() WHERE id = $1`,
            [rec.id]
        );
        return wallet;
    }

    formatResponse(type, message) {
        return JSON.stringify({
            sessionEnd: type === 'END',
            message
        });
    }

    normalizePhoneNumber(phone) {
        phone = phone.replace(/\D/g, '');
        if (phone.length === 10 || phone.length === 11) {
            phone = '55' + phone;
        }
        if (!phone.startsWith('+')) {
            phone = '+' + phone;
        }
        return phone;
    }

    async registerUser(phoneNumber) {
        // Ensure Privy user + embedded wallet exists (no keys handled or stored here)
        if (this.privy) {
            try {
                const list = await this.privy.getUsers({ phoneNumbers: [phoneNumber] });
                let user = list?.[0] || null;
                if (!user) {
                    user = await this.privy.importUser({ linkedAccounts: [{ type: 'phone', address: phoneNumber }], createEmbeddedWallet: true });
                }
                try { await this.privy.createWallets({ userId: user.id, createEthereumWallet: true, numberOfEthereumWalletsToCreate: 1 }); } catch (_) {}
                const refreshed = await this.privy.getUser({ id: user.id }).catch(() => user);
                const evm = (refreshed?.wallets || []).find(w => w.chainType === 'ethereum');
                if (evm && this.db) {
                    const userId = `user_${phoneNumber}`;
                    await this.db.query('INSERT INTO users (privy_user_id, phone_number) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, phoneNumber]);
                    const r = await this.db.query('SELECT id FROM wallets WHERE phone = $1 LIMIT 1', [phoneNumber]);
                    if (r.rows.length) {
                        await this.db.query('UPDATE wallets SET address = $1 WHERE phone = $2', [evm.address, phoneNumber]);
                    } else {
                        await this.db.query('INSERT INTO wallets (user_id, address, auth_method, auth_value, phone) VALUES ($1, $2, $3, $4, $5)', [userId, evm.address, 'phone', phoneNumber, phoneNumber]);
                    }
                }
            } catch (_) { /* ignore errors; fallback to DB-only user row */ }
        }
        // Self-custodial: create user record; wallet is linked when user sends 0x address
        const wallet = {
            userId: `user_${phoneNumber}`,
            address: null
        };

        if (!this.db) throw new Error('Database not configured');
        await this.db.query(
            'INSERT INTO users (privy_user_id, phone_number) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [wallet.userId, phoneNumber]
        );

        // No wallet row yet; will be created/updated by setWalletForPhone()

        return wallet;
    }

    async setWalletForPhone(phoneNumber, address) {
        if (!this.db) throw new Error('Database not configured');
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) throw new Error('Endereço inválido');
        const userId = `user_${phoneNumber}`;
        await this.db.query('INSERT INTO users (privy_user_id, phone_number) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, phoneNumber]);
        const r = await this.db.query('SELECT id FROM wallets WHERE phone = $1 LIMIT 1', [phoneNumber]);
        if (r.rows.length) {
            await this.db.query('UPDATE wallets SET address = $1 WHERE phone = $2', [address, phoneNumber]);
        } else {
            await this.db.query('INSERT INTO wallets (user_id, address, auth_method, auth_value, phone) VALUES ($1, $2, $3, $4, $5)', [userId, address, 'phone', phoneNumber, phoneNumber]);
        }
        return true;
    }

    async sendMoney(fromPhone, toPhone, amount, tokenAddress) {
        const fromWallet = await this.getWalletByPhone(fromPhone);
        const toWallet = await this.getWalletByPhone(toPhone);

        if (!fromWallet) throw new Error('Remetente não cadastrado');

        if (!tokenAddress || !this.tokenAbi || !this.provider || !this.operator) {
            // Chain context unavailable; simulate success for UX flow
            return { txHash: `0x${Math.random().toString(16).slice(2, 66)}` };
        }

        const token = new ethers.Contract(tokenAddress, this.tokenAbi, this.operator);
        const decimals = await token.decimals();
        const amt = ethers.parseUnits(String(amount), decimals);
        // Determine recipient: linked wallet or counterfactual address derived from phone number
        const target = (toWallet && toWallet.address) ? toWallet.address : this.deriveCounterfactualAddress(toPhone);
        // Require balance and allowance now
        const bal = await token.balanceOf(fromWallet.address);
        if (bal < amt) throw new Error('Saldo insuficiente do token');
        const allowance = await token.allowance(fromWallet.address, this.operator.address);
        if (allowance < amt) throw new Error('Permissão insuficiente');
        const tx = await token.transferFrom(fromWallet.address, target, amt);
        const receipt = await tx.wait();
        return { txHash: receipt?.hash || tx?.hash || '0x' };
    }

    async checkBalance(phoneNumber, tokenAddress) {
        const wallet = await this.getWalletByPhone(phoneNumber);
        if (!wallet) {
            const link = this.buildLink('setup', { phone: phoneNumber });
            return `Conta não configurada. Toque para configurar: ${link}`;
        }

        if (tokenAddress && this.provider && this.tokenAbi) {
            try {
                const token = new ethers.Contract(tokenAddress, this.tokenAbi, this.provider);
                const decimals = await token.decimals();
                const bal = await token.balanceOf(wallet.address);
                const fmt = Number(ethers.formatUnits(bal, decimals)).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                return `Saldo: ${fmt}`;
            } catch (_) { /* ignore and fallback */ }
        }
        return `Saldo indisponível. Configure sua conta ou selecione um token no menu.`;
    }

  async getRecentHistory(phoneNumber) {
        const wallet = await this.getWalletByPhone(phoneNumber);
        if (!wallet) {
            return 'Você não está cadastrado.';
  }

  async processPendingForPhone(phoneNumber) {
    if (!this.db || !this.provider || !this.tokenAbi || !this.operator) return 0;
    const res = await this.db.query('SELECT * FROM pending_transfers WHERE recipient_phone = $1 AND status = $2 ORDER BY id ASC', [phoneNumber, 'PENDING']);
    if (res.rows.length === 0) return 0;
    const toWallet = await this.getWalletByPhone(phoneNumber);
    if (!toWallet || !toWallet.address) return 0;
    let processed = 0;
    for (const row of res.rows) {
      try {
        const token = new ethers.Contract(row.token_address, this.tokenAbi, this.operator);
        // Attempt transferFrom from the sender's wallet now that recipient has linked
        const tx = await token.transferFrom(row.sender_address, toWallet.address, row.amount.toString());
        const receipt = await tx.wait();
        await this.db.query('UPDATE pending_transfers SET status=$1, processed_at=NOW(), tx_hash=$2 WHERE id=$3', ['COMPLETED', receipt?.hash || tx?.hash || null, row.id]);
        processed++;
      } catch (e) {
        // Leave as PENDING so it can be retried after allowance/balance are sufficient
      }
    }
    return processed;
  }

        return 'Sem transações recentes';
    }

    async findTokenBySymbol(symbol) {
        if (!this.db) return null;
        const row = await this.db.query('SELECT address FROM deployed_tokens WHERE UPPER(symbol) = UPPER($1) AND active = TRUE LIMIT 1', [symbol]);
        return row.rows[0]?.address || null;
    }

    async getWalletByPhone(phoneNumber) {
        if (!this.db) return null;
        const result = await this.db.query(
            'SELECT * FROM wallets WHERE phone = $1 LIMIT 1',
            [phoneNumber]
        );
        return result.rows[0];
    }

    isHealthy() {
        return !!this.db;
    }
}

module.exports = WhatsAppService;
