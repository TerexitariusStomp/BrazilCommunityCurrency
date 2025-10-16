const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BankBackedToken", function () {
  let bankOracle, token, owner, minter, pauser, blacklister;

  beforeEach(async function () {
    [owner, minter, pauser, blacklister] = await ethers.getSigners();

    const BankOracle = await ethers.getContractFactory("BankOracle");
    bankOracle = await BankOracle.deploy();
    await bankOracle.waitForDeployment();

    const BankBackedToken = await ethers.getContractFactory("BankBackedToken");
    token = await BankBackedToken.deploy(
      "Test Token",
      "TEST",
      "BRL",
      2,
      minter.address,
      pauser.address,
      blacklister.address,
      owner.address,
      await bankOracle.getAddress()
    );
    await token.waitForDeployment();
  });

  it("Should deploy with correct parameters", async function () {
    expect(await token.name()).to.equal("Test Token");
    expect(await token.symbol()).to.equal("TEST");
    expect(await token.masterMinter()).to.equal(minter.address);
  });

  it("Should not mint without backing", async function () {
    // Configure minter first
    await token.connect(minter).configureMinter(minter.address, 1000);
    await expect(token.connect(minter).mint(owner.address, 100)).to.be.revertedWith("Insufficient bank backing");
  });

  it("Should mint with backing", async function () {
    // Configure minter first
    await token.connect(minter).configureMinter(minter.address, 1000);

    // Link account and set balance
    await bankOracle.connect(owner).linkAccount(await token.getAddress(), "test-account");
    await bankOracle.connect(owner).updateBalance(await token.getAddress(), "test-account", 10000);

    await token.connect(minter).mint(owner.address, 100);
    expect(await token.balanceOf(owner.address)).to.equal(100);
  });

  it("MasterMinter can adminMintBacked without allowance (with backing)", async function () {
    // No allowance configured for minter in this test; call as masterMinter directly
    await bankOracle.connect(owner).linkAccount(await token.getAddress(), "test-account");
    await bankOracle.connect(owner).updateBalance(await token.getAddress(), "test-account", 1_000_000);

    await expect(token.connect(minter).adminMintBacked(owner.address, 5000))
      .to.emit(token, 'Mint');
    expect(await token.balanceOf(owner.address)).to.equal(5000);
  });

  it("Should reject mint from non-admin even if minter", async function () {
    const [, , , , attacker] = await ethers.getSigners();
    // MasterMinter is `minter` per constructor; attacker cannot be configured due to restriction
    await expect(
      token.connect(attacker).configureMinter(attacker.address, 1000)
    ).to.be.revertedWith('FiatToken: caller is not the masterMinter');
  });
});
