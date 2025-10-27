const { whatsappService, parseBody, absoluteUrl } = require('../_lib/services');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).send('Method not allowed');
    const signature = req.headers['x-twilio-signature'];
    const url = absoluteUrl(req);
    const params = await parseBody(req); // x-www-form-urlencoded expected
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!token) return res.status(500).send('Twilio not configured');
    const valid = require('twilio').validateRequest(token, signature, url, params);
    if (!valid) return res.status(403).send('Invalid request');

    const from = (params?.From || '').replace(/^whatsapp:/, '');
    const body = (params?.Body || '').trim();
    const sessionId = from;

    const replyPayload = await whatsappService.handleWhatsApp(sessionId, from, body);
    const parsed = JSON.parse(replyPayload || '{}');
    const text = parsed.message || 'OK';

    const MessagingResponse = require('twilio').twiml.MessagingResponse;
    const twiml = new MessagingResponse();
    twiml.message(text);
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(twiml.toString());
  } catch (error) {
    const MessagingResponse = require('twilio').twiml.MessagingResponse;
    const twiml = new MessagingResponse();
    twiml.message('Erro no sistema. Tente novamente.');
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(twiml.toString());
  }
};

