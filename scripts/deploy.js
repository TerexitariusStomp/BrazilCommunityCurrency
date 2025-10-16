const hre = require("hardhat");
const fs = require("fs");
require('dotenv').config();

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with:", deployer.address);

    // Deploy FiatTokenV2-based Factory (no constructor args)
    const TokenFactory = await hre.ethers.getContractFactory("TokenFactory");
    const factory = await TokenFactory.deploy();
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log("TokenFactory deployed to:", factoryAddress);

    // Save addresses
    const addresses = {
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
