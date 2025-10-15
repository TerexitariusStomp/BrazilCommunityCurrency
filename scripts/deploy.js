const hre = require("hardhat");
const fs = require("fs");
require('dotenv').config();

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with:", deployer.address);

    // Deploy Bank Oracle
    const BankOracle = await hre.ethers.getContractFactory("BankOracle");
    const oracle = await BankOracle.deploy();
    await oracle.waitForDeployment();
    const oracleAddress = await oracle.getAddress();
    console.log("BankOracle deployed to:", oracleAddress);

    // Deploy Token Template
    const BankBackedToken = await hre.ethers.getContractFactory("BankBackedToken");
    const template = await BankBackedToken.deploy(
        "Template Token",
        "TPL",
        "BRL",
        2,
        deployer.address,
        deployer.address,
        deployer.address,
        deployer.address,
        "0x0000000000000000000000000000000000000000" // placeholder oracle address
    );
    await template.waitForDeployment();
    const templateAddress = await template.getAddress();
    console.log("Token template deployed to:", templateAddress);

    // Deploy Factory
    const TokenFactory = await hre.ethers.getContractFactory("TokenFactory");
    const factory = await TokenFactory.deploy(
        await template.getAddress(),
        await oracle.getAddress(),
        deployer.address
    );
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log("TokenFactory deployed to:", factoryAddress);

    // Authorize updater if provided
    const updater = process.env.ORACLE_UPDATER_ADDRESS;
    if (updater && updater.startsWith('0x') && updater.length === 42) {
        const tx = await oracle.authorizeUpdater(updater, true);
        await tx.wait();
        console.log("Authorized oracle updater:", updater);
    }

    // Save addresses
    const addresses = {
        oracle: oracleAddress,
        template: templateAddress,
        factory: factoryAddress,
        deployedAt: new Date().toISOString()
    };

    try {
        // backup existing
        if (fs.existsSync('./deployments/contracts.json')) {
            fs.copyFileSync('./deployments/contracts.json', './deployments/contracts.json.bak');
        }
    } catch (_) {}

    fs.writeFileSync('./deployments/contracts.json', JSON.stringify(addresses, null, 2));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
