import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrivyClient } from '@privy-io/server-auth';
import fs from 'fs';
import path from 'path';
import { createPublicClient, http, parseAbi, encodeFunctionData, defineChain } from 'viem';
import { celo, celoAlfajores } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createSmartAccountClient } from 'permissionless';
import { createPimlicoClient } from 'permissionless/clients/pimlico';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean);
const SINGLE_ADMIN = ADMIN_EMAILS[0] || null;
const CONFIG_PATH = path.join(process.cwd(), 'backend', 'onchain-config.json');

app.use(cors({ origin: true }));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }));

// Very lightweight auth middleware.
// In your real backend, verify your own session/JWT and attach user info (email, id) to req.
function auth(req, res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });
  // TODO: verify your application token and decode user info. For now we accept any token.
  req.user = { token };
  next();
}

function getPrivy() {
  const appId = process.env.PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) return null;
  return new PrivyClient(appId, appSecret);
}

function readOnchainConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return { tokenAddress: '', chain: 'celo', decimals: 18, chainId: celo.id, rpcUrl: 'https://forno.celo.org' };
  }
}

function writeOnchainConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

/**
 * Ensure an embedded wallet exists for the current user.
 * Body accepts optional identifiers to match/link an existing user in Privy:
 * { email?: string, phoneNumber?: string, externalId?: string,
 *   createSmartWallet?: boolean, createSolanaWallet?: boolean }
 */
app.post('/api/service-wallet/embedded-wallet/ensure', auth, async (req, res) => {
  try {
    const client = getPrivy();
    if (!client) {
      return res.status(501).json({
        ok: false,
        error: 'Privy not configured',
        hint: 'Set PRIVY_APP_ID and PRIVY_APP_SECRET in backend/.env',
      });
    }

    const { email, phoneNumber, externalId, createSmartWallet, createSolanaWallet } = req.body || {};
    if (!email && !phoneNumber && !externalId) {
      return res.status(400).json({
        ok: false,
        error: 'Provide at least one identifier: email, phoneNumber, or externalId',
      });
    }

    // 1) Find existing Privy user
    let user = null;
    if (email) {
      const list = await client.getUsers({ emails: [email] });
      user = list?.[0] || null;
    }
    // If not found by email, try phone. (SDK supports bulk by phones but not guaranteed here.)
    if (!user && phoneNumber) {
      const list = await client.getUsers({ phoneNumbers: [phoneNumber] });
      user = list?.[0] || null;
    }
    // If still not found and you use your own externalId mapped to Privy custom metadata, look it up here.
    // There is no direct externalId lookup API; projects often store externalId in customMetadata and search externally.

    // 2) Create user if missing and request embedded wallet creation
    if (!user) {
      const linkedAccounts = [];
      if (email) linkedAccounts.push({ type: 'email', address: email });
      if (phoneNumber) linkedAccounts.push({ type: 'phone', address: phoneNumber });
      // Import user with an embedded wallet
      user = await client.importUser({
        linkedAccounts,
        // Create an embedded EOA wallet
        createEmbeddedWallet: true,
      });
      try {
        user = await client.createWallets({
          userId: user.id,
          createEthereumWallet: true,
          numberOfEthereumWalletsToCreate: 1,
        });
      } catch (e) {
        // ignore if already has one (race)
      }
    } else {
      // 3) If user exists, try to create wallets if they don't already have one
      try {
        user = await client.createWallets({
          userId: user.id,
          createEthereumWallet: true,
          numberOfEthereumWalletsToCreate: 1,
        });
      } catch (e) {
        // If wallet already exists, Privy may throw; we treat as ensured
      }
    }

    // Respond with a minimal payload
    const evmWallets = (user?.wallets || []).filter(w => w.chainType === 'ethereum');
    const solWallets = (user?.wallets || []).filter(w => w.chainType === 'solana');
    const primary = evmWallets?.[0] || solWallets?.[0] || null;

    return res.json({
      ok: true,
      userId: user?.id,
      wallet: primary ? { address: primary.address, chainType: primary.chainType } : null,
      counts: { evm: evmWallets.length, solana: solWallets.length },
    });
  } catch (error) {
    console.error('ensureEmbeddedWallet error:', error);
    return res.status(500).json({ ok: false, error: String(error?.message || error) });
  }
});

// Get current on-chain configuration (token address / chain)
app.get('/api/onchain/config', auth, async (_req, res) => {
  return res.json({ ok: true, config: readOnchainConfig() });
});

// Update token address / chain — admin only (single admin enforced)
app.post('/api/onchain/config', auth, async (req, res) => {
  try {
    const { adminEmail, tokenAddress, chain, decimals, chainId, rpcUrl } = req.body || {};
    if (!adminEmail || (SINGLE_ADMIN ? adminEmail !== SINGLE_ADMIN : !ADMIN_EMAILS.includes(adminEmail))) {
      return res.status(403).json({ ok: false, error: 'Not authorized' });
    }
    if (!tokenAddress) {
      return res.status(400).json({ ok: false, error: 'tokenAddress is required' });
    }
    const cfg = readOnchainConfig();
    cfg.tokenAddress = tokenAddress;
    if (chain) cfg.chain = chain; // e.g., 'celo' or 'celo-sepolia'
    if (typeof decimals === 'number') cfg.decimals = decimals;
    if (typeof chainId === 'number') cfg.chainId = chainId;
    if (typeof rpcUrl === 'string' && rpcUrl.length > 0) cfg.rpcUrl = rpcUrl;
    writeOnchainConfig(cfg);
    return res.json({ ok: true, config: cfg });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Gasless ERC-20 transfer via Privy (server-initiated placeholder)
// Replaced by Pimlico paymaster flow below.
// Keeping route for backward compatibility: returns 410 Gone
app.post('/api/onchain/gasless/erc20/transfer', auth, async (_req, res) => {
  return res.status(410).json({ ok: false, error: 'Replaced by /api/onchain/pimlico/erc20/transfer' });
});

// Pimlico paymaster-backed ERC-20 transfer on CELO via AA smart account (server-owned)
// Body: { senderEmail, recipientEmail, amount }
app.post('/api/onchain/pimlico/erc20/transfer', auth, async (req, res) => {
  try {
    const cfg = readOnchainConfig();
    const { tokenAddress, decimals = 18 } = cfg;
    if (!tokenAddress) return res.status(400).json({ ok: false, error: 'Token address not configured by admin' });

    const { senderEmail, recipientEmail, amount } = req.body || {};
    if (!senderEmail || !recipientEmail || !amount) {
      return res.status(400).json({ ok: false, error: 'senderEmail, recipientEmail and amount are required' });
    }

    // Resolve on-chain recipient from Privy
    const privy = getPrivy();
    if (!privy) return res.status(501).json({ ok: false, error: 'Privy not configured' });
    const rUsers = await privy.getUsers({ emails: [recipientEmail] });
    const rUser = rUsers?.[0];
    const rWallet = (rUser?.wallets || []).find(w => w.chainType === 'ethereum');
    if (!rWallet) return res.status(400).json({ ok: false, error: 'Recipient missing EVM wallet' });

    // Build clients for Celo + Pimlico
    const apiKey = process.env.PIMLICO_API_KEY;
    const pk = process.env.PRIVATE_KEY;
    if (!apiKey || !pk) {
      return res.status(500).json({ ok: false, error: 'Missing PIMLICO_API_KEY or PRIVATE_KEY in backend/.env' });
    }
    const { chain, rpc } = (() => {
      const name = String(cfg.chain || 'celo').toLowerCase();
      if (name === 'celo') return { chain: celo, rpc: 'https://forno.celo.org' };
      if (name === 'alfajores' || name === 'celo-alfajores' || name === 'testnet') return { chain: celoAlfajores, rpc: 'https://alfajores-forno.celo-testnet.org' };
      // Support custom (e.g., Celo Sepolia) via chainId + rpcUrl
      if (cfg.chainId && cfg.rpcUrl) {
        const custom = defineChain({ id: Number(cfg.chainId), name: cfg.chain || `chain-${cfg.chainId}`,
          nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 }, rpcUrls: { default: { http: [cfg.rpcUrl] }, public: { http: [cfg.rpcUrl] } } });
        return { chain: custom, rpc: cfg.rpcUrl };
      }
      return { chain: celo, rpc: 'https://forno.celo.org' };
    })();
    const account = privateKeyToAccount(pk);
    const publicClient = createPublicClient({ chain, transport: http(rpc) });
    const pimlicoUrl = `https://api.pimlico.io/v2/${chain.id}/rpc?apikey=${apiKey}`;
    const pimlicoClient = createPimlicoClient({ chain, transport: http(pimlicoUrl) });
    const smartAccountClient = createSmartAccountClient({
      account,
      chain,
      bundlerTransport: http(pimlicoUrl),
      paymaster: pimlicoClient,
    });

    // Encode ERC-20 transfer(to, amount)
    const erc20Abi = parseAbi(['function transfer(address to, uint256 value)']);
    const to = rWallet.address;
    const scale = BigInt(10) ** BigInt(decimals);
    // amount is string (e.g., "1.0" with comma formatting already cleaned client-side); handle decimals
    const normalized = String(amount).replace(/[^\d.]/g, '');
    const [ints, fracs = ''] = normalized.split('.');
    const fracPadded = (fracs + '0'.repeat(decimals)).slice(0, decimals);
    const value = BigInt(ints || '0') * scale + BigInt(fracPadded || '0');
    const data = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [to, value] });

    // Send sponsored transaction via Pimlico
    const hash = await smartAccountClient.sendTransaction({
      to: tokenAddress,
      data,
      value: 0n,
    });

    return res.json({ ok: true, txHash: hash, chain: chain.name, token: tokenAddress, to });
  } catch (error) {
    console.error('pimlico transfer error:', error);
    return res.status(500).json({ ok: false, error: String(error?.message || error) });
  }
});

// Lookup wallets for a user by email/phone without creating
app.post('/api/service-wallet/lookup', auth, async (req, res) => {
  try {
    const client = getPrivy();
    if (!client) {
      return res.status(501).json({
        ok: false,
        error: 'Privy not configured',
        hint: 'Set PRIVY_APP_ID and PRIVY_APP_SECRET in backend/.env',
      });
    }

    const { email, phoneNumber } = req.body || {};
    if (!email && !phoneNumber) {
      return res.status(400).json({ ok: false, error: 'Provide email or phoneNumber' });
    }

    let user = null;
    if (email) {
      const list = await client.getUsers({ emails: [email] });
      user = list?.[0] || null;
    }
    if (!user && phoneNumber) {
      const list = await client.getUsers({ phoneNumbers: [phoneNumber] });
      user = list?.[0] || null;
    }

    if (!user) return res.json({ ok: true, found: false, wallets: [] });

    const wallets = (user.wallets || []).map(w => ({
      id: w.id,
      address: w.address,
      chainType: w.chainType,
      type: w.type,
    }));

    return res.json({ ok: true, found: true, userId: user.id, wallets });
  } catch (error) {
    console.error('lookup error:', error);
    return res.status(500).json({ ok: false, error: String(error?.message || error) });
  }
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
