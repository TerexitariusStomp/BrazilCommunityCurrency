const { pluggyService, parseBody } = require('../_lib/services');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { tokenAddress, pixKey, wallet, network } = await parseBody(req);
    if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress) || !wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet) || !pixKey) {
      return res.status(400).json({ error: 'tokenAddress, wallet, and pixKey are required' });
    }
    pluggyService.linkPixKey(tokenAddress, pixKey, wallet);
    // In serverless, we cannot rely on timers; kick processing inline (best-effort)
    try { await pluggyService.processIncomingMints(tokenAddress); } catch (_) {}
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

