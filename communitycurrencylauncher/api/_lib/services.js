const url = require('url');

const config = require('../../config');
const WhatsAppService = require('../../services/whatsappService');
const PluggyBankService = require('../../services/pluggyService');
const TokenDeployer = require('../../services/tokenDeployer');

// Singletons reused across invocations when the function instance is warm
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

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;

  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  const buffers = [];
  for await (const chunk of req) buffers.push(chunk);
  const raw = Buffer.concat(buffers).toString('utf8');
  if (!raw) return {};

  if (contentType.includes('application/json')) {
    try { return JSON.parse(raw); } catch (_) { return {}; }
  }
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const { URLSearchParams } = require('url');
    const params = new URLSearchParams(raw);
    const out = {};
    for (const [k, v] of params.entries()) out[k] = v;
    return out;
  }
  return { raw };
}

function absoluteUrl(req) {
  const protocol = (req.headers['x-forwarded-proto'] || '').toString().split(',')[0] || 'https';
  const host = req.headers.host;
  return `${protocol}://${host}${req.url}`;
}

module.exports = {
  config,
  whatsappService,
  pluggyService,
  tokenDeployer,
  isAddress,
  requireFields,
  parseBody,
  absoluteUrl,
};

