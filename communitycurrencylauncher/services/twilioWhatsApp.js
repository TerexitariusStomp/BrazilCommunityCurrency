const twilio = require('twilio');
const config = require('../config');

function isConfigured() {
  return !!(
    config.twilio &&
    config.twilio.accountSid &&
    config.twilio.authToken &&
    config.twilio.phoneNumber
  );
}

async function sendWhatsApp(toE164, body) {
  if (!isConfigured()) throw new Error('Twilio WhatsApp not configured');
  const client = twilio(config.twilio.accountSid, config.twilio.authToken);
  const from = `whatsapp:${config.twilio.phoneNumber}`;
  const to = `whatsapp:${toE164.replace(/\s+/g, '')}`;
  return client.messages.create({ from, to, body });
}

module.exports = { sendWhatsApp, isConfigured };

