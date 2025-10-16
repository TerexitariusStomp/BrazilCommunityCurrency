const ethers = require('ethers');
const fs = require('fs');
const path = require('path');
const config = require('../config');

class TokenDeployer {
  constructor() {
    this.config = config;
    this.factoryAbi = require('../artifacts/contracts/TokenFactory.sol/TokenFactory.json').abi;
  }

  buildContext(network) {
    const useMainnet = !network || network === 'celo';
    const rpc = useMainnet ? this.config.rpcEndpoint : this.config.rpcEndpointSepolia;
    const factoryAddr = useMainnet ? this.config.factoryAddress : this.config.factoryAddressSepolia;
    if (!this.config.enableOnchainDeploy || !rpc || !this.config.privateKey || !factoryAddr) {
      return { mode: 'mock' };
    }
    const provider = new ethers.JsonRpcProvider(rpc);
    const wallet = new ethers.Wallet(this.config.privateKey, provider);
    const factory = new ethers.Contract(factoryAddr, this.factoryAbi, wallet);
    return { mode: 'onchain', provider, wallet, factory };
  }

  async deployToken(name, symbol, masterMinter, pauser, blacklister, owner, network) {
    const ctx = this.buildContext(network);
    if (ctx.mode !== 'onchain') {
      // Safe mock response to avoid breaking flows in non-chain envs
      const proxy = `0x${cryptoRandomHex(40)}`;
      const implementation = `0x${cryptoRandomHex(40)}`;
      return {
        proxy,
        implementation,
        txHash: `0x${cryptoRandomHex(64)}`,
        gasUsed: '21000'
      };
    }

    // On-chain deployment via TokenFactory
    const tx = await ctx.factory.deployToken(
      name,
      symbol,
      masterMinter,
      pauser,
      blacklister,
      owner
    );
    const receipt = await tx.wait();

    let proxy, implementation;
    // ethers v6: receipt.logs structured, use iface to parse
    const iface = ctx.factory.interface;
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed && parsed.name === 'TokenDeployed') {
          proxy = parsed.args.token;
          implementation = parsed.args.proxy;
          break;
        }
      } catch (_) { /* ignore non-matching logs */ }
    }
    if (!proxy || !implementation) {
      throw new Error('TokenDeployed event not found in receipt');
    }
    return {
      proxy,
      implementation,
      txHash: receipt.hash,
      gasUsed: receipt.gasUsed?.toString?.() || '0'
    };
  }
}

function cryptoRandomHex(len) {
  // Node 18+: use crypto for better randomness
  try {
    const { randomBytes } = require('crypto');
    return randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len);
  } catch {
    return Math.random().toString(16).slice(2).padEnd(len, '0').slice(0, len);
  }
}

module.exports = TokenDeployer;
