pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TokenFactory {
    address public immutable tokenTemplate;
    address public immutable bankOracle;
    address public proxyAdmin;

    struct TokenDeployment {
        address tokenAddress;
        address proxyAddress;
        string name;
        string symbol;
        address deployer;
        uint256 deployedAt;
    }

    TokenDeployment[] public deployments;

    event TokenDeployed(
        address indexed token,
        address indexed proxy,
        address indexed deployer,
        string name,
        string symbol
    );

    constructor(address _tokenTemplate, address _bankOracle, address _proxyAdmin) {
        tokenTemplate = _tokenTemplate;
        bankOracle = _bankOracle;
        proxyAdmin = _proxyAdmin;
    }

    function deployToken(
        string memory name,
        string memory symbol,
        address masterMinter,
        address pauser,
        address blacklister,
        address owner
    ) external returns (address tokenProxy, address implementation) {
        implementation = Clones.clone(tokenTemplate);

        bytes memory proxyInitCode = abi.encodePacked(
            type(FiatTokenProxy).creationCode,
            abi.encode(implementation)
        );

        bytes32 salt = keccak256(abi.encodePacked(name, symbol, block.timestamp));

        assembly {
            tokenProxy := create2(0, add(proxyInitCode, 0x20), mload(proxyInitCode), salt)
        }

        IBankBackedToken(tokenProxy).initializeBankBacked(
            name,
            symbol,
            "BRL",
            2,
            masterMinter,
            pauser,
            blacklister,
            owner,
            bankOracle
        );

        IFiatTokenProxy(tokenProxy).changeAdmin(proxyAdmin);

        deployments.push(TokenDeployment({
            tokenAddress: implementation,
            proxyAddress: tokenProxy,
            name: name,
            symbol: symbol,
            deployer: msg.sender,
            deployedAt: block.timestamp
        }));

        emit TokenDeployed(tokenProxy, implementation, msg.sender, name, symbol);

        return (tokenProxy, implementation);
    }
}

interface IBankBackedToken {
    function initializeBankBacked(
        string memory tokenName,
        string memory tokenSymbol,
        string memory tokenCurrency,
        uint8 tokenDecimals,
        address newMasterMinter,
        address newPauser,
        address newBlacklister,
        address newOwner,
        address _bankOracle
    ) external;
}

interface IFiatTokenProxy {
    function changeAdmin(address newAdmin) external;
}

contract FiatTokenProxy {
    address public implementation;
    address public admin;

    constructor(address _implementation) {
        implementation = _implementation;
        admin = msg.sender;
    }

    function changeAdmin(address newAdmin) external {
        require(msg.sender == admin, "Only admin can change admin");
        admin = newAdmin;
    }

    fallback() external payable {
        address impl = implementation;
        assembly {
            let ptr := mload(0x40)
            calldatacopy(ptr, 0, calldatasize())
            let result := delegatecall(gas(), impl, ptr, calldatasize(), 0, 0)
            let size := returndatasize()
            returndatacopy(ptr, 0, size)

            switch result
            case 0 { revert(ptr, size) }
            default { return(ptr, size) }
        }
    }

    receive() external payable {}
}