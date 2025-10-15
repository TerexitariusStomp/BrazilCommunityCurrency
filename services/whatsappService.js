const axios = require('axios');
const EventEmitter = require('events');
const { Pool } = require('pg');
const config = require('../config');

class WhatsAppService extends EventEmitter {
    constructor() {
        super();
        this.db = config.databaseUrl ? new Pool({ connectionString: config.databaseUrl }) : null;
    }

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
2. Enviar dinheiro
3. Ver últimas transações
4. Cadastrar
Digite o número da opção desejada`;
    }

    async processMenuInput(input, session) {
        switch (input.trim()) {
            case '1':
                return await this.checkBalance(session.phoneNumber);

            case '2':
                session.state = 'AWAITING_RECIPIENT';
                return 'Digite o número de telefone do destinatário (ex: +5511987654321)';

            case '3':
                return await this.getRecentHistory(session.phoneNumber);

            case '4':
                const privyResponse = await this.initiatePrivyAuth(session.phoneNumber);
                session.state = 'AWAITING_AUTH';
                session.authToken = privyResponse.authToken;
                return `Por favor, verifique seu WhatsApp para confirmar o login.`;

            default:
                return 'Opção inválida. Digite 1, 2, 3 ou 4.';
        }
    }

    async processRecipientInput(input, session) {
        session.recipient = this.normalizePhoneNumber(input);
        session.state = 'AWAITING_AMOUNT';
        return 'Digite o valor a enviar (ex: 10.50 para R$10,50)';
    }

    async processAmountInput(input, session) {
        const amount = parseFloat(input);
        if (isNaN(amount) || amount <= 0) {
            return 'Valor inválido. Digite um valor válido (ex: 10.50)';
        }

        try {
            const tx = await this.sendMoney(session.phoneNumber, session.recipient, amount);
            session.state = 'MENU';
            return `Transferência enviada! Hash: ${tx.txHash}\nDigite *123# para voltar ao menu.`;
        } catch (error) {
            return `Erro: ${error.message}\nDigite *123# para voltar ao menu.`;
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

        // Send WhatsApp message with verification link
        if (!config.whatsapp.apiUrl || !config.whatsapp.apiKey) {
            throw new Error('WhatsApp API not configured');
        }
        await axios.post(
            `${config.whatsapp.apiUrl}/messages`,
            {
                to: phoneNumber,
                type: 'text',
                text: {
                    body: `Verifique sua identidade: https://auth.yourdomain.com/verify?token=${authToken}`
                }
            },
            {
                headers: { 'Authorization': `Bearer ${config.whatsapp.apiKey}` }
            }
        );

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
        // In production, integrate with Privy for wallet creation
        const wallet = {
            userId: `user_${phoneNumber}`,
            address: `0x${Math.random().toString(16).slice(2, 42)}`
        };

        if (!this.db) throw new Error('Database not configured');
        await this.db.query(
            'INSERT INTO users (privy_user_id, phone_number) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [wallet.userId, phoneNumber]
        );

        await this.db.query(
            'INSERT INTO wallets (user_id, address, auth_method, auth_value, phone) VALUES ($1, $2, $3, $4, $5)',
            [wallet.userId, wallet.address, 'phone', phoneNumber, phoneNumber]
        );

        return wallet;
    }

    async sendMoney(fromPhone, toPhone, amount) {
        const fromWallet = await this.getWalletByPhone(fromPhone);
        const toWallet = await this.getWalletByPhone(toPhone);

        if (!fromWallet) throw new Error('Remetente não cadastrado');
        if (!toWallet) throw new Error('Destinatário não cadastrado');

        // Simulate transaction (replace with actual blockchain call)
        return {
            txHash: `0x${Math.random().toString(16).slice(2, 66)}`,
            from: fromWallet.address,
            to: toWallet.address,
            amount: Math.floor(amount * 100)
        };
    }

    async checkBalance(phoneNumber) {
        const wallet = await this.getWalletByPhone(phoneNumber);
        if (!wallet) {
            return 'Você não está cadastrado. Digite 4 para cadastrar.';
        }

        // Simulate balance check
        return `Saldo: R$ 100.00\nCarteira: ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
    }

    async getRecentHistory(phoneNumber) {
        const wallet = await this.getWalletByPhone(phoneNumber);
        if (!wallet) {
            return 'Você não está cadastrado.';
        }

        return 'Sem transações recentes';
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
