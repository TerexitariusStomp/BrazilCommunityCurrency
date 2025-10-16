pragma solidity ^0.8.0;

import "./FiatTokenV2.sol";

contract BankBackedToken is FiatTokenV2 {
    address public bankOracle;
    // Single authority allowed to mint via auto-mint backend flow
    address public immutable mintAdmin;

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
        mintAdmin = newMasterMinter;
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
        returns (bool)
    {
        require(msg.sender == mintAdmin, "Only mint admin");
        return _mintWithBacking(_to, _amount);
    }

    function _mintWithBacking(address _to, uint256 _amount)
        internal
        hasBacking(_amount)
        returns (bool)
    {
        return super.mint(_to, _amount);
    }

    // MasterMinter can mint without allowance as long as reserves back it
    function adminMintBacked(address _to, uint256 _amount)
        external
        whenNotPaused
        onlyMasterMinter
        notBlacklisted(_to)
        hasBacking(_amount)
        returns (bool)
    {
        _mint(_to, _amount);
        emit Mint(msg.sender, _to, _amount);
        return true;
    }

    // Note: we deliberately avoid overriding configureMinter/removeMinter in FiatTokenV2
    // to minimize changes. The single-admin policy is enforced by requiring msg.sender
    // to equal `mintAdmin` inside mint(). Even if other minters are configured,
    // they will not be able to call mint successfully.
}

interface IBankOracle {
    function getBalance(address token) external view returns (uint256);
}
