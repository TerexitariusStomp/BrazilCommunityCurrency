const hre = require("hardhat");
const fs = require("fs");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with:", deployer.address);

    // Deploy Bank Oracle
    const BankOracle = await hre.ethers.getContractFactory("BankOracle");
    const oracle = await BankOracle.deploy();
    await oracle.waitForDeployment();
    console.log("BankOracle deployed to:", await oracle.getAddress());

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
    console.log("Token template deployed to:", await template.getAddress());

    // Deploy Factory
    const TokenFactory = await hre.ethers.getContractFactory("TokenFactory");
    const factory = await TokenFactory.deploy(
        await template.getAddress(),
        await oracle.getAddress(),
        deployer.address
    );
    await factory.waitForDeployment();
    console.log("TokenFactory deployed to:", await factory.getAddress());

    // Save addresses
    const addresses = {
        oracle: await oracle.getAddress(),
        template: await template.getAddress(),
        factory: await factory.getAddress(),
        deployedAt: new Date().toISOString()
    };

    fs.writeFileSync(
        './deployments/contracts.json',
        JSON.stringify(addresses, null, 2)
    );
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });