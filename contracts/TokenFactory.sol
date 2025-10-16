pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./FiatTokenV2.sol";
import "./BankBackedToken.sol";
import "./BankOracle.sol";

contract TokenFactory {
    struct TokenDeployment {
        address tokenAddress;
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
        string symbol,
        address oracle,
        string currency,
        uint8 decimals
    );

    function deployToken(
        string memory name,
        string memory symbol,
        address masterMinter,
        address pauser,
        address blacklister,
        address owner
    ) external returns (address tokenProxy, address implementation) {
        // Parameters for Circle-style token: default to BRL 6 decimals to align with centavos
        string memory currency = "BRL";
        uint8 decimals_ = 6;

        // Deploy a dedicated oracle for this token and transfer ownership to the provided owner
        BankOracle oracle = new BankOracle();
        oracle.transferOwnership(owner);

        // Deploy the bank-backed FiatTokenV2 wrapper that consults the per-token oracle
        BankBackedToken token = new BankBackedToken(
            name,
            symbol,
            currency,
            decimals_,
            masterMinter,
            pauser,
            blacklister,
            owner,
            address(oracle)
        );

        deployments.push(TokenDeployment({
            tokenAddress: address(token),
            name: name,
            symbol: symbol,
            deployer: msg.sender,
            deployedAt: block.timestamp
        }));

        emit TokenDeployed(address(token), address(token), msg.sender, name, symbol, address(oracle), currency, decimals_);

        return (address(token), address(token));
    }
}
