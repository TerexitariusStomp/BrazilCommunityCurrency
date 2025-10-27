const { whatsappService, parseBody } = require('../_lib/services');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { phoneNumber, token } = await parseBody(req);
    const wallet = await whatsappService.verifyAuthToken(phoneNumber, token);
    return res.status(200).json({ success: true, userId: wallet.userId, address: wallet.address });
  } catch (error) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

