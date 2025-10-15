const express = require('express');
const cors = require('cors');
const path = require('path');
const WhatsAppService = require('./services/whatsappService');
const PluggyBankService = require('./services/pluggyService');
const TokenDeployer = require('./services/tokenDeployer');
const config = require('./config');

const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin }));
app.use(express.json({ limit: config.bodyLimit }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

const whatsappService = new WhatsAppService();
const pluggyService = new PluggyBankService();
const tokenDeployer = new TokenDeployer();

const isAddress = (addr) => typeof addr === 'string' && /^0x[a-fA-F0-9]{40}$/.test(addr);
const requireFields = (obj, fields) => {
  for (const f of fields) {
    if (obj[f] === undefined || obj[f] === null || obj[f] === '') {
      return `Missing field: ${f}`;
    }
  }
  return null;
};

app.post('/api/deploy-token', async (req, res) => {
  try {
    const { name, symbol, masterMinter, pauser, blacklister, owner } = req.body || {};
    const missing = requireFields({ name, symbol, masterMinter, pauser, blacklister, owner }, ['name', 'symbol', 'masterMinter', 'pauser', 'blacklister', 'owner']);
    if (missing) return res.status(400).json({ error: missing });
    for (const a of [masterMinter, pauser, blacklister, owner]) {
      if (!isAddress(a)) return res.status(400).json({ error: 'Invalid address provided' });
    }
    const result = await tokenDeployer.deployToken(name, symbol, masterMinter, pauser, blacklister, owner);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// removed background queue; handled synchronously

app.post('/api/connect-bank/:tokenAddress', async (req, res) => {
    try {
        const { tokenAddress } = req.params;
        if (!isAddress(tokenAddress)) return res.status(400).json({ error: 'Invalid token address' });
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
        const { sessionId, phoneNumber, text } = req.body || {};
        const missing = requireFields({ sessionId, phoneNumber, text }, ['sessionId', 'phoneNumber', 'text']);
        if (missing) return res.status(400).json({ error: missing });
        const response = await whatsappService.handleWhatsApp(sessionId, phoneNumber, text);
        res.json(JSON.parse(response));
    } catch (error) {
        res.status(500).json({
            sessionEnd: true,
            message: 'Erro no sistema'
        });
    }
});

// Pluggy webhook endpoint
app.post('/api/webhooks/pluggy', async (req, res) => {
  try {
    if (!req.body) return res.status(400).json({ error: 'Missing body' });
    await pluggyService.handleWebhook(req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
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
                    <p>PostgreSQL: <span style="color: green;">Configured</span></p>
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

try { pluggyService.startBalanceUpdates(); } catch (_) {}

// Basic error handler
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal error' });
});

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});
