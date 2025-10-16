// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract FiatTokenV2 is ERC20, Ownable, Pausable {
    string private _name;
    string private _symbol;
    uint8 private _decimals;
    string private _currency;

    address public masterMinter;
    address public pauser;
    address public blacklister;
    bool public rolesInitialized;

    mapping(address => bool) public minters;
    mapping(address => uint256) public minterAllowance;
    mapping(address => bool) public blacklisted;
    bool public initialMintDone;

    event Mint(address indexed minter, address indexed to, uint256 amount);
    event Burn(address indexed burner, uint256 amount);
    event MinterConfigured(address indexed minter, uint256 minterAllowedAmount);
    event MinterRemoved(address indexed oldMinter);
    event MasterMinterChanged(address indexed newMasterMinter);
    event PauserChanged(address indexed newPauser);
    event BlacklisterChanged(address indexed newBlacklister);
    event Blacklisted(address indexed account);
    event UnBlacklisted(address indexed account);

    constructor(
        string memory tokenName,
        string memory tokenSymbol,
        string memory tokenCurrency,
        uint8 tokenDecimals
    ) ERC20(tokenName, tokenSymbol) {
        _name = tokenName;
        _symbol = tokenSymbol;
        _currency = tokenCurrency;
        _decimals = tokenDecimals;
    }

    modifier onlyMasterMinter() {
        require(msg.sender == masterMinter, "FiatToken: caller is not the masterMinter");
        _;
    }

    modifier onlyMinters() {
        require(minters[msg.sender], "FiatToken: caller is not a minter");
        _;
    }

    modifier onlyPauser() {
        require(msg.sender == pauser, "FiatToken: caller is not the pauser");
        _;
    }

    modifier onlyBlacklister() {
        require(msg.sender == blacklister, "FiatToken: caller is not the blacklister");
        _;
    }

    modifier notBlacklisted(address account) {
        require(!blacklisted[account], "FiatToken: account is blacklisted");
        _;
    }

    function name() public view override returns (string memory) {
        return _name;
    }

    function symbol() public view override returns (string memory) {
        return _symbol;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function currency() public view returns (string memory) {
        return _currency;
    }

    function mint(address _to, uint256 _amount) public virtual whenNotPaused onlyMinters notBlacklisted(_to) returns (bool) {
        require(_to != address(0), "FiatToken: mint to the zero address");
        require(_amount > 0, "FiatToken: mint amount not greater than 0");

        uint256 mintingAllowedAmount = minterAllowance[msg.sender];
        require(_amount <= mintingAllowedAmount, "FiatToken: mint amount exceeds minterAllowance");

        minterAllowance[msg.sender] = mintingAllowedAmount - _amount;
        _mint(_to, _amount);
        emit Mint(msg.sender, _to, _amount);
        return true;
    }

    function burn(uint256 _amount) public whenNotPaused onlyMinters notBlacklisted(msg.sender) {
        require(_amount > 0, "FiatToken: burn amount not greater than 0");

        _burn(msg.sender, _amount);
        emit Burn(msg.sender, _amount);
    }

    function transfer(address recipient, uint256 amount) public override whenNotPaused notBlacklisted(msg.sender) notBlacklisted(recipient) returns (bool) {
        return super.transfer(recipient, amount);
    }

    function transferFrom(address sender, address recipient, uint256 amount) public override whenNotPaused notBlacklisted(sender) notBlacklisted(recipient) returns (bool) {
        return super.transferFrom(sender, recipient, amount);
    }

    function configureMinter(address minter, uint256 minterAllowedAmount) public onlyMasterMinter returns (bool) {
        minters[minter] = true;
        minterAllowance[minter] = minterAllowedAmount;
        emit MinterConfigured(minter, minterAllowedAmount);
        return true;
    }

    function removeMinter(address minter) public onlyMasterMinter returns (bool) {
        minters[minter] = false;
        minterAllowance[minter] = 0;
        emit MinterRemoved(minter);
        return true;
    }

    function _setMasterMinter(address newMasterMinter) internal {
        masterMinter = newMasterMinter;
        emit MasterMinterChanged(newMasterMinter);
    }

    function _setPauser(address newPauser) internal {
        pauser = newPauser;
        emit PauserChanged(newPauser);
    }

    function _setBlacklister(address newBlacklister) internal {
        blacklister = newBlacklister;
        emit BlacklisterChanged(newBlacklister);
    }

    function pause() public onlyPauser {
        _pause();
    }

    function unpause() public onlyPauser {
        _unpause();
    }

    function blacklist(address account) public onlyBlacklister {
        blacklisted[account] = true;
        emit Blacklisted(account);
    }

    function unBlacklist(address account) public onlyBlacklister {
        blacklisted[account] = false;
        emit UnBlacklisted(account);
    }

    // Initialize admin roles and transfer ownership. Callable once by current owner (factory).
    function initializeRoles(
        address newMasterMinter,
        address newPauser,
        address newBlacklister,
        address newOwner
    ) external onlyOwner {
        require(!rolesInitialized, "FiatToken: roles already initialized");
        require(newOwner != address(0), "FiatToken: owner is zero");
        _setMasterMinter(newMasterMinter);
        _setPauser(newPauser);
        _setBlacklister(newBlacklister);
        rolesInitialized = true;
        _transferOwnership(newOwner);
    }

    // One-time owner-controlled mint to seed initial supply before handing over ownership.
    function ownerMintInitial(address to, uint256 amount) external onlyOwner {
        require(!initialMintDone, "FiatToken: initial mint already done");
        require(to != address(0), "FiatToken: mint to zero address");
        require(amount > 0, "FiatToken: amount must be > 0");
        initialMintDone = true;
        _mint(to, amount);
        emit Mint(msg.sender, to, amount);
    }
}
