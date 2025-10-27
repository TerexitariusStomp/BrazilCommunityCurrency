const { tokenDeployer, isAddress, requireFields, parseBody } = require('./_lib/services');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const body = await parseBody(req);
    const { name, symbol, masterMinter, pauser, blacklister, owner, network } = body || {};
    const missing = requireFields({ name, symbol, masterMinter, pauser, blacklister, owner }, ['name', 'symbol', 'masterMinter', 'pauser', 'blacklister', 'owner']);
    if (missing) return res.status(400).json({ error: missing });
    for (const a of [masterMinter, pauser, blacklister, owner]) {
      if (!isAddress(a)) return res.status(400).json({ error: 'Invalid address provided' });
    }
    const result = await tokenDeployer.deployToken(name, symbol, masterMinter, pauser, blacklister, owner, network);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

