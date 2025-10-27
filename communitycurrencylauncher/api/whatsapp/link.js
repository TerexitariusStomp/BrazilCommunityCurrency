const { whatsappService, parseBody } = require('../_lib/services');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { phone, address } = await parseBody(req);
    if (!phone || !address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ error: 'Provide phone and a valid wallet address' });
    }
    await whatsappService.setWalletForPhone(phone, address);
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

