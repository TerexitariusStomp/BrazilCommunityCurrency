pragma solidity ^0.8.0;

import "./FiatTokenV2.sol";

contract BankBackedToken is FiatTokenV2 {
    address public bankOracle;

    constructor(
        string memory tokenName,
        string memory tokenSymbol,
        string memory tokenCurrency,
        uint8 tokenDecimals,
        address newMasterMinter,
        address newPauser,
        address newBlacklister,
        address newOwner,
        address _bankOracle
    ) FiatTokenV2(tokenName, tokenSymbol, tokenCurrency, tokenDecimals) {
        _setMasterMinter(newMasterMinter);
        _setPauser(newPauser);
        _setBlacklister(newBlacklister);
        _transferOwnership(newOwner);
        bankOracle = _bankOracle;
    }

    modifier hasBacking(uint256 amount) {
        uint256 backing = IBankOracle(bankOracle).getBalance(address(this));
        require(totalSupply() + amount <= backing, "Insufficient bank backing");
        _;
    }

    function mint(address _to, uint256 _amount)
        public
        override
        whenNotPaused
        onlyMinters
        hasBacking(_amount)
        returns (bool)
    {
        return super.mint(_to, _amount);
    }
}

interface IBankOracle {
    function getBalance(address token) external view returns (uint256);
}