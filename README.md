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

## 📋 API Endpoints

### Token Management
- `POST /api/tokens/create` - Create new community token
- `GET /api/tokens/:address` - Get token information
- `POST /api/tokens/:address/mint` - Mint tokens (requires backing)

### Bank Integration
- `POST /api/bank/connect/:tokenAddress` - Initiate bank connection
- `POST /api/webhooks/pluggy` - Handle Pluggy webhooks

### WhatsApp Integration
- `POST /api/whatsapp/send` - Send community notifications

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

### Application
```bash
# Build for production
npm run build

# Start production server
npm run start
```

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