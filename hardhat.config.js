require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.19",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ]
  },
  networks: {
    hardhat: {
      chainId: 1337
    },
    // Celo Mainnet (alias: 'celo')
    celo: {
      url: process.env.RPC_ENDPOINT || "https://rpc.ankr.com/celo",
      accounts: process.env.PRIVATE_KEY && process.env.PRIVATE_KEY !== "0x..." && process.env.PRIVATE_KEY.length === 66 ? [process.env.PRIVATE_KEY] : []
    },
    // Celo Testnet (Sepolia)
    celoSepolia: {
      url: process.env.RPC_ENDPOINT_SEPOLIA || "https://forno.celo-sepolia.celo-testnet.org",
      accounts: process.env.PRIVATE_KEY && process.env.PRIVATE_KEY !== "0x..." && process.env.PRIVATE_KEY.length === 66 ? [process.env.PRIVATE_KEY] : []
    }
  },
  etherscan: {
    apiKey: {
      celo: process.env.CELO_SCAN_API_KEY || ""
    }
  }
};
