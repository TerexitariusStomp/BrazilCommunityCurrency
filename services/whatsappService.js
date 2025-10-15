const axios = require('axios');
const EventEmitter = require('events');
const Redis = require('ioredis');
const { Pool } = require('pg');

class WhatsAppService extends EventEmitter {
    constructor() {
        super();
        this.redis = new Redis(process.env.REDIS_URL);
        this.db = new Pool({ connectionString: process.env.DATABASE_URL });
        this.sessions = new Map();
    }

    async handleWhatsApp(sessionId, phoneNumber, text) {
        phoneNumber = this.normalizePhoneNumber(phoneNumber);

        let session = await this.redis.get(`session:${sessionId}`);
        if (!session) {
            session = {
                state: 'MENU',
                phoneNumber,
                createdAt: Date.now()
            };
            await this.redis.set(`session:${sessionId}`, JSON.stringify(session), 'EX', 3600);
        } else {
            session = JSON.parse(session);
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

        await this.redis.set(`session:${sessionId}`, JSON.stringify(session), 'EX', 3600);

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
        await this.redis.set(`auth:${phoneNumber}`, authToken, 'EX', 300);

        // Send WhatsApp message with verification link
        await axios.post(
            `${process.env.WHATSAPP_API_URL}/messages`,
            {
                to: phoneNumber,
                type: 'text',
                text: {
                    body: `Verifique sua identidade: https://auth.yourdomain.com/verify?token=${authToken}`
                }
            },
            {
                headers: { 'Authorization': `Bearer ${process.env.WHATSAPP_API_KEY}` }
            }
        );

        return { authToken };
    }

    async verifyAuthToken(phoneNumber, token) {
        const storedToken = await this.redis.get(`auth:${phoneNumber}`);
        if (storedToken !== token) {
            throw new Error('Invalid auth token');
        }

        // Create or get wallet
        const wallet = await this.registerUser(phoneNumber);

        // Clean up
        await this.redis.del(`auth:${phoneNumber}`);

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
        const result = await this.db.query(
            'SELECT * FROM wallets WHERE phone = $1 LIMIT 1',
            [phoneNumber]
        );
        return result.rows[0];
    }

    isHealthy() {
        return !!this.redis && !!this.db;
    }
}

module.exports = WhatsAppService;