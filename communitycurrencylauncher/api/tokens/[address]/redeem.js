const { pluggyService, parseBody } = require('../../_lib/services');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { address } = req.query || {};
    const { pixKey, amount, network } = await parseBody(req);
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) return res.status(400).json({ error: 'Invalid token address' });
    if (!pixKey || !amount) return res.status(400).json({ error: 'pixKey and amount are required' });
    await pluggyService.redeem(address, pixKey, amount, network || 'celo');
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

