# Caiana (CANA) Stablecoin

A custom stablecoin implementation deployed on Celo mainnet, built using Circle's stablecoin-evm framework.

## Overview

Caiana (CANA) is an ERC-20 compatible stablecoin backed by fiat reserves, featuring advanced security mechanisms including pausability, upgradability, and blacklist functionality.

## Transparency & Open Data

- Issuance policy: The amount of Caiana (CANA) minted corresponds to BRL reserves held in a bank account and is evidenced publicly.
- Public statement evidencing BRL reserves supporting Caiana: https://celo.blockscout.com/address/0x15ffACd88539aFa123AD4707e28f6Bc3A7DBBad7?tab=txs
  - This is statements for the last 3 weeks of reals backing the Caianas.

## Contract Addresses

### Main Contracts

| Contract | Address | Description |
|----------|---------|-------------|
| **CANA Token Proxy** | `0x84782895E7bD25Fb333Ca58E6274A2055E67846E` | Main token contract proxy - handles all ERC-20 operations |
| **Master Minter** | `0x53d1E07d8B6f1D2BE79240D45Fe10306C9832931` | Controls minting permissions and manages minter allowances |
| **Implementation** | `0x7A83511a49695ddE8B8bde578662687f78067C72` | Current implementation contract containing token logic |

### Token Details

- **Name**: Caiana
- **Symbol**: CANA
- **Decimals**: 6
- **Currency**: USD
- **Network**: Celo Mainnet (Chain ID: 42220)

## Administration

### Admin Address
**Administrator**: `0x3f22066B8D708934Ef948D71c5E4e23a99567EfD`

The admin address has full control over:
- **Proxy Administration**: Can upgrade the implementation contract
- **Master Minter Ownership**: Controls who can mint new tokens
- **Token Ownership**: Manages token settings, pausing, and blacklisting

## Features

### ERC-20 Compatible
- Standard ERC-20 interface with `transfer`, `transferFrom`, `approve`, `allowance`
- Enhanced with `increaseAllowance` and `decreaseAllowance` functions

### Security Features
- **Pausable**: Contract can be frozen in emergencies
- **Blacklist**: Malicious addresses can be blocked from transfers
- **Upgradable**: Implementation can be upgraded via proxy pattern
- **Access Control**: Role-based permissions (owner, pauser, blacklister, master minter)

### Advanced Functionality
- **Permit**: Gasless approvals using EIP-2612
- **Transfer with Authorization**: Authorized transfers with time limits
- **Receive with Authorization**: Authorized receives with front-running protection

## Usage

### Basic ERC-20 Operations

```javascript
// Transfer tokens
await canaToken.transfer(recipient, amount);

// Approve spender
await canaToken.approve(spender, amount);

// Transfer from approved amount
await canaToken.transferFrom(sender, recipient, amount);
```

### Minting (Admin Only)

```javascript
// Configure minter (admin only)
await masterMinter.configureMinter(minterAddress, allowance);

// Mint tokens (minter only)
await canaToken.mint(recipient, amount);
```

### Emergency Controls (Admin Only)

```javascript
// Pause/unpause contract
await canaToken.pause();
await canaToken.unpause();

// Blacklist/unblacklist addresses
await canaToken.blacklist(address);
await canaToken.unBlacklist(address);
```

## Deployment

The contracts were deployed using Foundry on Celo mainnet with the following configuration:

- **Framework**: Circle's stablecoin-evm v2.2
- **Solidity Version**: 0.6.12
- **Deployment Tool**: Foundry
- **Network**: Celo Mainnet

## Security

This implementation inherits security features from Circle's battle-tested stablecoin framework:

- **Audited Code**: Based on Circle's production USDC implementation
- **Proxy Pattern**: Secure upgradability without affecting token holdings
- **Multi-sig Ready**: Designed for multi-signature wallet administration
- **Emergency Pause**: Circuit breaker functionality for critical situations

## Development

### Prerequisites
- Node.js 20.9.0
- Yarn 1.22.19
- Foundry

### Setup
```bash
yarn install
forge build
```

### Testing
```bash
forge test
```

### Deployment Scripts
Located in `scripts/` directory:
- `deploy-fiat-token.s.sol` - Main deployment script
- `change-admin.s.sol` - Admin transfer script
- `mint-cana.s.sol` - Token minting script
- `transfer-cana.s.sol` - Token transfer script

## License

Licensed under Apache License 2.0 (same as Circle's stablecoin-evm repository).

## Disclaimer

This is a custom stablecoin implementation. Users should conduct their own due diligence and understand the risks associated with using any cryptocurrency or stablecoin.
