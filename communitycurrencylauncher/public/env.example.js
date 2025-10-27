// Copy this file to public/env.js for static deployments and set values.
// These globals are read by the UI before it configures axios.

// Base URL of your backend API (the Express server in this repo)
// Example: 'https://api.your-domain.com'
window.API_BASE = '';

// WalletConnect Project ID used for Rainbow/mobile connection
// Get one from: https://cloud.walletconnect.com/
window.WC_PROJECT_ID = '';

// Xellar Wallets (optional)
// Set your Xellar App ID to enable Xellar Kit for account setup and connection
// window.XELLAR_APP_ID was removed (Xellar integration reverted)

// On-chain deployment (frontend-signed) factory addresses
// Set these if you want the connected wallet to sign and pay gas when deploying.
// Leave blank to use the server-side deploy instead.
window.CELO_FACTORY_ADDRESS = '';
window.CELO_SEPOLIA_FACTORY_ADDRESS = '';

// Bank Oracle contract (used to show collateral/backing per token)
// Set to the deployed BankOracle address so the UI can read backing balances.
window.ORACLE_ADDRESS = '';

// Privy Embedded Wallets (optional)
// Set your Privy App ID to enable login + automatic embedded wallet creation
