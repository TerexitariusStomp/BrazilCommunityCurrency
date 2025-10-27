/**
 * Copyright 2024 Circle Internet Group, Inc. All rights reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

pragma solidity 0.6.12;

import "forge-std/console.sol"; // solhint-disable no-global-import, no-console
import { Script } from "forge-std/Script.sol";
import { FiatTokenProxy } from "../contracts/v1/FiatTokenProxy.sol";
import { MasterMinter } from "../contracts/minting/MasterMinter.sol";
import { FiatTokenV2_2 } from "../contracts/v2/FiatTokenV2_2.sol";

/**
 * Script to change admin of all CANA smart contracts
 */
contract ChangeAdmin is Script {
    address payable private constant FIAT_TOKEN_PROXY = 0x84782895E7bD25Fb333Ca58E6274A2055E67846E;
    address private constant MASTER_MINTER = 0x53d1E07d8B6f1D2BE79240D45Fe10306C9832931;
    address private constant CURRENT_OWNER = 0x22590061d7151F85E7e0C2b610c1E89Dc952346d;
    address private constant NEW_ADMIN = 0x3f22066B8D708934Ef948D71c5E4e23a99567EfD;

    uint256 private deployerPrivateKey;

    function setUp() public {
        deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        console.log("FIAT_TOKEN_PROXY: '%s'", FIAT_TOKEN_PROXY);
        console.log("MASTER_MINTER: '%s'", MASTER_MINTER);
        console.log("CURRENT_OWNER: '%s'", CURRENT_OWNER);
        console.log("NEW_ADMIN: '%s'", NEW_ADMIN);
    }

    function run() external {
        vm.startBroadcast(deployerPrivateKey);

        // Change proxy admin
        FiatTokenProxy proxy = FiatTokenProxy(FIAT_TOKEN_PROXY);
        console.log("Current proxy admin: '%s'", proxy.admin());
        proxy.changeAdmin(NEW_ADMIN);
        console.log("New proxy admin: '%s'", proxy.admin());

        // Change master minter ownership
        MasterMinter masterMinter = MasterMinter(MASTER_MINTER);
        console.log("Current master minter owner: '%s'", masterMinter.owner());
        masterMinter.transferOwnership(NEW_ADMIN);
        console.log("New master minter owner: '%s'", masterMinter.owner());

        // Change token ownership (pauser, blacklister, owner)
        FiatTokenV2_2 token = FiatTokenV2_2(FIAT_TOKEN_PROXY);
        console.log("Current token owner: '%s'", token.owner());
        console.log("Current token pauser: '%s'", token.pauser());
        console.log("Current token blacklister: '%s'", token.blacklister());

        // Transfer ownership to new admin
        token.transferOwnership(NEW_ADMIN);

        // Note: pauser and blacklister can only be updated by the current owner
        // Since we just transferred ownership, we need to call these from the new owner
        // This would need to be done in a separate transaction by the new admin
        console.log("Note: pauser and blacklister roles need to be updated by the new admin in separate transactions");

        console.log("New token owner: '%s'", token.owner());
        console.log("New token pauser: '%s'", token.pauser());
        console.log("New token blacklister: '%s'", token.blacklister());

        vm.stopBroadcast();
    }
}