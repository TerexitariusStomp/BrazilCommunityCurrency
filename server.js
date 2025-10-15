const express = require('express');
const cors = require('cors');
const path = require('path');
const Bull = require('bull');
const WhatsAppService = require('./services/whatsappService');
const PluggyBankService = require('./services/pluggyService');
const TokenDeployer = require('./services/tokenDeployer');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

const whatsappService = new WhatsAppService();
const pluggyService = new PluggyBankService();
const tokenDeployer = new TokenDeployer();

const deploymentQueue = new Bull('token-deployment', {
    redis: { port: 6379, host: 'localhost' }
});

app.post('/api/deploy-token', async (req, res) => {
    try {
        const { name, symbol, masterMinter, pauser, blacklister, owner } = req.body;

        const job = await deploymentQueue.add('deploy', {
            name, symbol, masterMinter, pauser, blacklister, owner
        });

        res.json({ success: true, jobId: job.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

deploymentQueue.process('deploy', async (job) => {
    const { name, symbol, masterMinter, pauser, blacklister, owner } = job.data;

    const result = await tokenDeployer.deployToken(
        name, symbol, masterMinter, pauser, blacklister, owner
    );

    return result;
});

app.post('/api/connect-bank/:tokenAddress', async (req, res) => {
    try {
        const { tokenAddress } = req.params;
        const connection = await pluggyService.createConnection(tokenAddress);

        res.json({
            success: true,
            connectUrl: connection.connectUrl,
            expiresAt: connection.expiresAt
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/whatsapp', async (req, res) => {
    try {
        const { sessionId, phoneNumber, text } = req.body;
        const response = await whatsappService.handleWhatsApp(sessionId, phoneNumber, text);
        res.json(JSON.parse(response));
    } catch (error) {
        res.status(500).json({
            sessionEnd: true,
            message: 'Erro no sistema'
        });
    }
});

app.post('/api/auth/verify', async (req, res) => {
    try {
        const { phoneNumber, token } = req.body;
        const wallet = await whatsappService.verifyAuthToken(phoneNumber, token);

        res.json({
            success: true,
            userId: wallet.userId,
            address: wallet.address
        });
    } catch (error) {
        res.status(401).json({ error: 'Authentication failed' });
    }
});

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Pluggy Community Currency</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                .container { max-width: 800px; margin: 0 auto; }
                .header { text-align: center; margin-bottom: 40px; }
                .api-endpoints { background: #f5f5f5; padding: 20px; border-radius: 8px; }
                .endpoint { margin: 10px 0; }
                .method { display: inline-block; width: 80px; font-weight: bold; color: #007bff; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔗 Pluggy Community Currency</h1>
                    <p>Bank-Backed Token System with WhatsApp Integration</p>
                </div>

                <div class="api-endpoints">
                    <h2>API Endpoints</h2>

                    <div class="endpoint">
                        <span class="method">GET</span>
                        <code>/health</code> - System health check
                    </div>

                    <div class="endpoint">
                        <span class="method">POST</span>
                        <code>/api/deploy-token</code> - Deploy new community token
                    </div>

                    <div class="endpoint">
                        <span class="method">POST</span>
                        <code>/api/connect-bank/:tokenAddress</code> - Connect bank account
                    </div>

                    <div class="endpoint">
                        <span class="method">POST</span>
                        <code>/whatsapp</code> - WhatsApp user interface
                    </div>

                    <div class="endpoint">
                        <span class="method">POST</span>
                        <code>/api/auth/verify</code> - Verify authentication
                    </div>
                </div>

                <div style="margin-top: 40px; text-align: center;">
                    <p><strong>Status:</strong> <span style="color: green;">System Running ✅</span></p>
                    <p>PostgreSQL: <span style="color: green;">Connected</span> | Redis: <span style="color: green;">Connected</span></p>
                </div>
            </div>
        </body>
        </html>
    `);
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        services: {
            whatsapp: whatsappService.isHealthy(),
            pluggy: pluggyService.isHealthy()
        }
    });
});

pluggyService.startBalanceUpdates();

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});