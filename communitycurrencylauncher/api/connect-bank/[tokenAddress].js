const { pluggyService, isAddress, parseBody } = require('../_lib/services');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { tokenAddress } = req.query || {};
    const body = await parseBody(req);
    const { network } = body || {};
    if (!isAddress(tokenAddress)) return res.status(400).json({ error: 'Invalid token address' });
    const connection = await pluggyService.createConnection(tokenAddress, network || 'celo');
    return res.status(200).json({ success: true, connectUrl: connection.connectUrl, expiresAt: connection.expiresAt });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

