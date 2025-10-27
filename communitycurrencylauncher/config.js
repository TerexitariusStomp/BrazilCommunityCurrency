const assertEnv = (name, opts = {}) => {
  const val = process.env[name];
  if (opts.required && (!val || val === '')) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val ?? opts.default;
};

const parseBool = (v, def = false) => {
  if (v === undefined) return def;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
};

module.exports = {
  env: assertEnv('NODE_ENV', { default: 'development' }),
  port: Number(assertEnv('PORT', { default: '3001' })),
  baseUrl: assertEnv('BASE_URL', { required: false }),

  // External services
  databaseUrl: assertEnv('DATABASE_URL', { required: false }),
  pluggy: {
    clientId: assertEnv('PLUGGY_CLIENT_ID', { required: false }),
    clientSecret: assertEnv('PLUGGY_CLIENT_SECRET', { required: false }),
    webhookSecret: assertEnv('PLUGGY_WEBHOOK_SECRET', { required: false }),
  },

  // Blockchain
  rpcEndpoint: assertEnv('RPC_ENDPOINT', { required: false }),
  rpcEndpointSepolia: assertEnv('RPC_ENDPOINT_SEPOLIA', { required: false, default: 'https://forno.celo-sepolia.celo-testnet.org' }),
  privateKey: assertEnv('PRIVATE_KEY', { required: false }),
  oracleUpdateKey: assertEnv('ORACLE_UPDATE_KEY', { required: false }),
  oracleAddress: assertEnv('ORACLE_ADDRESS', { required: false }),
  oracleAddressSepolia: assertEnv('ORACLE_ADDRESS_SEPOLIA', { required: false }),
  factoryAddress: assertEnv('FACTORY_ADDRESS', { required: false }),
  factoryAddressSepolia: assertEnv('FACTORY_ADDRESS_SEPOLIA', { required: false }),
  enableOnchainDeploy: parseBool(assertEnv('ENABLE_ONCHAIN_DEPLOY', { default: 'false' })),

  // Twilio SMS (for SMS-based UX)
  twilio: {
    accountSid: assertEnv('TWILIO_ACCOUNT_SID', { required: false }),
    authToken: assertEnv('TWILIO_AUTH_TOKEN', { required: false }),
    phoneNumber: assertEnv('TWILIO_PHONE_NUMBER', { required: false }),
  },

  // (removed SMS ODIS demo)

  // HTTP
  corsOrigin: assertEnv('CORS_ORIGIN', { default: '*' }),
  bodyLimit: assertEnv('BODY_LIMIT', { default: '100kb' }),
};
