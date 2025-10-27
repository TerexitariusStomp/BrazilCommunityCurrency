const { pluggyService, parseBody } = require('../_lib/services');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const body = await parseBody(req);
    if (!body) return res.status(400).json({ error: 'Missing body' });
    await pluggyService.handleWebhook(body);
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

