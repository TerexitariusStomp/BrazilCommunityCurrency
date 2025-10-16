# Brazil Community Currency System

A production-ready blockchain-based community currency system that integrates with Brazilian banking infrastructure via Pluggy API. This system enables communities to create and manage their own digital currencies backed by real bank accounts.

## 🌟 Features

- **Bank-Backed Tokens**: Digital currencies fully backed by real Brazilian bank accounts
- **Pluggy Integration**: Secure connection to Brazilian banking systems
- **Smart Contracts**: Solidity-based token contracts on blockchain
- **Real-time Balance Updates**: Automatic synchronization with bank balances
- **WhatsApp Integration**: Community communication and notifications
- **Web Interface**: React-based token launcher and management
- **Production Ready**: Comprehensive error handling and validation

## 🏗️ Architecture

### Smart Contracts
- **BankOracle**: Manages bank account balances and token backing
- **BankBackedToken**: ERC-20 compliant tokens backed by bank deposits
- **TokenFactory**: Creates and deploys new community tokens
- **FiatTokenV2**: Integration with Circle's USDC stablecoin

### Backend Services
- **Pluggy Service**: Handles bank API integration and webhooks
- **Token Deployer**: Automates smart contract deployment
- **WhatsApp Service**: Community notifications and interactions
- **Express Server**: REST API and webhook handling

### Frontend
- **Token Launcher**: Web interface for creating new community currencies
- **React Components**: Modern, responsive user interface

#### Safe Multisig & Rainbow
- The header includes a wallet connector that supports Rainbow/mobile via WalletConnect and browser wallets.
- If the app runs inside a Safe App, it auto-detects the Safe via Safe Apps SDK and prefills the deploy roles with the Safe address. It also shows threshold/owners when available.
- The Deploy form includes a Multisig Setup area to add signer addresses (owners) and a threshold. It encourages at least a 2-of-3 configuration.
- When not inside a Safe, connect your multisig (Safe) or paste your Safe address into Owner/Minter/Pauser/Blacklister so your multisig controls the token.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Hardhat
- GitHub CLI (gh)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/TerexitariusStomp/BrazilCommunityCurrency.git
   cd BrazilCommunityCurrency
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your production values
   ```

4. **Compile contracts**
   ```bash
   npm run compile
   ```

5. **Run tests**
   ```bash
   npm test
   ```

6. **Deploy contracts**
   ```bash
   npm run deploy
   ```

7. **Start the application**
   ```bash
   npm start
   ```

## 🔧 Configuration

### Environment Variables

```env
# Production Environment
NODE_ENV=production
BASE_URL=https://your-production-domain.com

# Pluggy API Configuration
PLUGGY_CLIENT_ID=your_production_pluggy_client_id
PLUGGY_CLIENT_SECRET=your_production_pluggy_client_secret
PLUGGY_WEBHOOK_SECRET=your_production_webhook_secret

# Blockchain Configuration
RPC_ENDPOINT=https://rpc.ankr.com/celo
PRIVATE_KEY=your_production_private_key
ORACLE_UPDATE_KEY=your_production_oracle_update_key

# Deployed Contract Addresses
ORACLE_ADDRESS=your_deployed_oracle_address
FACTORY_ADDRESS=your_deployed_factory_address

# WhatsApp Configuration
WHATSAPP_API_URL=https://api.whatsapp.com/v1
WHATSAPP_API_KEY=your_production_whatsapp_api_key

# Database Configuration
DATABASE_URL=postgresql://user:password@your-production-db:5432/community_token
REDIS_URL=redis://your-production-redis:6379

# Server Configuration
PORT=3000
```

### Wallet Connection (Rainbow / Multisig)

- The web UI header includes a wallet connect control to help users connect via Rainbow (mobile) using WalletConnect or via a browser wallet.
- To enable Rainbow/mobile connection, set a WalletConnect project id in the browser before loading the page:
  - Open the browser console and run: `window.WC_PROJECT_ID = 'your_walletconnect_project_id'` then refresh.
  - Click “Connect Rainbow / Mobile” to pair with Rainbow or any WalletConnect-compatible wallet.
- Important: Deployments should be controlled by your multisig (e.g., Safe). If you connect an EOA by mistake, paste your multisig address into the Owner/Master Minter/Pauser/Blacklister fields so the multisig retains control.
- The UI auto-fills these roles with the connected address and shows a small “Multisig/Contract” badge when the connected account looks like a contract (such as a Safe).

## 📋 API Endpoints

### Token Management
- `POST /api/tokens/create` - Create new community token
- `GET /api/tokens/:address` - Get token information
- `POST /api/tokens/:address/mint` - Mint tokens (requires backing)

### Bank Integration
- `POST /api/bank/connect/:tokenAddress` - Initiate bank connection
- `POST /api/webhooks/pluggy` - Handle Pluggy webhooks

### WhatsApp Integration
- `POST /twilio/whatsapp` - Twilio WhatsApp webhook (use this with Twilio)

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test file
npx hardhat test test/BankBackedToken.test.js

# Run tests with coverage
npx hardhat coverage
```

## 🚢 Deployment

### Smart Contracts
```bash
# Deploy to Celo testnet
npx hardhat run scripts/deploy.js --network celo

# Deploy to mainnet
npx hardhat run scripts/deploy.js --network celo-mainnet
```

### Application (API + Frontend via Express)
```bash
# Build for production
npm run build

# Start production server
npm run start
```

### Frontend-only (Static Hosting)

You can deploy just the `public/` frontend to any static host (Netlify, Vercel static, GitHub Pages, S3, etc.). The UI calls the API configured via a global `window.API_BASE`.

1) Configure frontend env for static hosting

```bash
cp public/env.example.js public/env.js
# Edit public/env.js and set:
#   window.API_BASE = 'https://your-api.domain';
#   window.WC_PROJECT_ID = 'your_walletconnect_project_id';
```

2) Deploy the `public/` folder using your provider’s instructions, or use Docker + NGINX:

```bash
# Build static image
docker build -f Dockerfile.frontend -t community-frontend .

# Run locally on :8080
docker run --rm -p 8080:80 \
  -v "$PWD/public/env.js:/usr/share/nginx/html/env.js:ro" \
  community-frontend
```

## GitHub Pages

- This repo is configured to deploy the frontend in `public/` to GitHub Pages via a workflow at `.github/workflows/pages.yml`.
- On push to `main` or `master`, the workflow publishes `public/` as a static site. GitHub Pages should be set to “GitHub Actions” as the source.
- Before publishing, set your API endpoint and WalletConnect project id in `public/env.js` (see `public/env.example.js`). If `window.API_BASE` is left blank, the app will default to same-origin, which is typically not where your API runs when hosted on Pages.
- If you use a custom domain, add your `CNAME` file to `public/` so it is included in the deployed site.

## System Architecture

### Five-Layer Design

- Reserve Bank Account — Brazilian bank holding BRL reserves
- Pluggy SDK — Fetches real-time balance via Open Finance API
- Custom Oracle — Node.js service that reads Pluggy and writes to blockchain
- Smart Contract — Stores reserve balance, mints/burns tokens
- User Interface — PIX deposits, redemptions, reserve dashboard

```
Reserve Bank → Pluggy API → Custom Oracle → Blockchain Contract
```

### Minting Flow: BRL → Stablecoin

#### Step 1: User Deposits BRL via PIX

- User sends PIX to reserve account with wallet in memo: `MINT-0x1234...`
- PIX settles instantly (Brazil's real-time payment system)

#### Step 2: Pluggy Detects Deposit

```javascript
const accounts = await pluggy.fetchAccounts(itemId);
const balance = accounts[0].balance; // Updated BRL balance
```

- Pluggy webhook fires on new transaction
- Backend fetches updated balance using `fetchAccounts()`
- Extracts wallet address from transaction memo

#### Step 3: Oracle Updates Reserve On-Chain

```javascript
const balanceWei = ethers.parseEther(balanceBRL.toString());
await contract.updateReserveBalance(balanceWei);
```

- Oracle reads new balance from Pluggy
- Converts to Wei (18 decimals)
- Submits signed transaction to smart contract
- Contract stores updated `reserveBalance` state variable

#### Step 4: Automated Minting

```text
function mint(address to, uint256 amount) external {
    require(reserveBalance >= totalSupply() + amount);
    _mint(to, amount);
}
```

- Backend calls `mint()` with user's address and amount
- Contract verifies: reserves ≥ supply + new tokens
- Mints tokens to user's wallet

### Burning Flow: Stablecoin → BRL

#### Step 1: User Requests Redemption

```text
function requestRedemption(uint256 amount, string pixKey) {
    _transfer(msg.sender, address(this), amount); // Lock tokens
    redemptions[id] = RedemptionRequest({...});
}
```

- User calls `requestRedemption()` with amount and PIX key
- Tokens transferred to contract (locked, not burned yet)

#### Step 2: Backend Processes Request

- Oracle monitors `RedemptionRequested` events
- Validates redemption is legitimate

#### Step 3: PIX Payment Sent

```javascript
// Via Pluggy Payment Initiation API
await pluggy.initiatePayment({
    accountId: reserveAccountId,
    recipient: pixKey,
    amount: redemptionAmount
});
```

- Oracle uses Pluggy Payment Initiation to send BRL
- User receives funds instantly via PIX

#### Step 4: Token Burning

```text
function processRedemption(uint256 requestId) external {
    _burn(address(this), redemptions[requestId].amount);
}
```

- After PIX confirmation, oracle calls `processRedemption()`
- Tokens permanently destroyed
- Oracle updates reserve balance on-chain

### Key Code Components

#### Custom Oracle Service (Node.js + ethers.js)

```javascript
class BRLStablecoinOracle {
  async updateReserveBalance() {
    // 1. Fetch from Pluggy
    const balance = await this.pluggy.getBalance();
    
    // 2. Submit to blockchain
    const tx = await this.contract.updateReserveBalance(
      ethers.parseEther(balance.toString())
    );
    await tx.wait();
  }
  
  start(intervalSeconds = 60) {
    setInterval(() => this.updateReserveBalance(), intervalSeconds * 1000);
    setInterval(() => this.processMintRequests(), 30 * 1000);
    setInterval(() => this.processRedemptions(), 30 * 1000);
  }
}
```

#### Smart Contract (Solidity)

```text
contract BRLStablecoin is ERC20, AccessControl {
    uint256 public reserveBalance;
    uint256 public lastReserveUpdate;
    
    function updateReserveBalance(uint256 newBalance) 
        external onlyRole(ORACLE_ROLE) 
    {
        reserveBalance = newBalance;
        lastReserveUpdate = block.timestamp;
    }
    
    function checkCollateralization(uint256 additionalSupply) 
        public view returns (bool) 
    {
        require(block.timestamp - lastReserveUpdate <= 1 hours);
        return reserveBalance >= totalSupply() + additionalSupply;
    }
}
```

#### Pluggy Integration

```javascript
import { PluggyClient } from 'pluggy-sdk';

const pluggy = new PluggyClient({
  clientId: process.env.PLUGGY_CLIENT_ID,
  clientSecret: process.env.PLUGGY_CLIENT_SECRET
});

// Fetch balance
const accounts = await pluggy.fetchAccounts(itemId);
const balance = accounts[0].balance; // BRL amount

// Monitor deposits
const txs = await pluggy.fetchTransactions(itemId, accountId, {
  from: new Date(Date.now() - 5 * 60 * 1000)
});
```

### Advantages of Custom Oracle vs Chainlink


## Twilio for WhatsApp

Use Twilio’s WhatsApp channel to drive the existing WhatsApp conversational flow.

- Configure env: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` (E.164, e.g., +14155552671)
- Point your Twilio WhatsApp sandbox/number webhook to `POST https://<your-domain>/twilio/whatsapp`
- Inbound messages are processed by the WhatsApp menu engine and replied via TwiML.
- Outbound messages (e.g., auth link) use Twilio.

For Netlify/Vercel:
- Publish directory: `public`
- Add/serve `public/env.js` with the correct `window.API_BASE` pointing at your Express API.


## 🔒 Security

- **Bank Integration**: Secure Pluggy API integration with webhook verification
- **Smart Contracts**: OpenZeppelin battle-tested contracts
- **Input Validation**: Comprehensive validation on all inputs
- **Error Handling**: Graceful error handling and logging
- **Environment Security**: Sensitive data in environment variables

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Pluggy**: Brazilian banking API integration
- **OpenZeppelin**: Secure smart contract libraries
- **Hardhat**: Ethereum development environment
- **Circle**: USDC stablecoin integration

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Contact the development team

---

**Built with ❤️ for Brazilian communities**
