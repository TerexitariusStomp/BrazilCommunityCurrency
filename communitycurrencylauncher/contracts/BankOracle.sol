pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract BankOracle is Ownable {
    struct BankAccount {
        string pluggyAccountId;
        uint256 balanceBRL;
        uint256 lastUpdated;
        bool active;
    }

    mapping(address => BankAccount) public tokenToAccount;
    mapping(address => bool) public authorizedUpdaters;

    event BalanceUpdated(address indexed token, uint256 oldBalance, uint256 newBalance, uint256 timestamp);
    event AccountLinked(address indexed token, string pluggyAccountId);

    modifier onlyUpdater() {
        require(authorizedUpdaters[msg.sender], "Not authorized");
        _;
    }

    constructor() {
        authorizedUpdaters[msg.sender] = true;
    }

    function updateBalance(address token, string memory accountId, uint256 newBalanceBRL) external onlyUpdater {
        BankAccount storage account = tokenToAccount[token];
        require(account.active, "Account not active");

        uint256 oldBalance = account.balanceBRL;
        account.balanceBRL = newBalanceBRL;
        account.lastUpdated = block.timestamp;

        emit BalanceUpdated(token, oldBalance, newBalanceBRL, block.timestamp);
    }

    function linkAccount(address token, string memory accountId) external onlyOwner {
        tokenToAccount[token] = BankAccount({
            pluggyAccountId: accountId,
            balanceBRL: 0,
            lastUpdated: 0,
            active: true
        });
        emit AccountLinked(token, accountId);
    }

    function getBalance(address token) external view returns (uint256) {
        return tokenToAccount[token].balanceBRL;
    }

    function authorizeUpdater(address updater, bool authorized) external onlyOwner {
        authorizedUpdaters[updater] = authorized;
    }
}