// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {DoomLaunchpad} from "../src/DoomLaunchpad.sol";

/// @notice Deploys DoomLaunchpad. Treasury (fee receiver + initial owner) is hard-coded.
/// Usage: see README.md. Reads PRIVATE_KEY from the environment.
contract Deploy is Script {
    address public constant TREASURY = 0x0DbFef7e227701671896B9Ef498D7Ce87F4E57e0;

    function run() external returns (DoomLaunchpad launchpad) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);
        launchpad = new DoomLaunchpad(TREASURY);
        vm.stopBroadcast();

        console2.log("chainId:      ", block.chainid);
        console2.log("deployer:     ", deployer);
        console2.log("treasury:     ", TREASURY);
        console2.log("owner:        ", launchpad.owner());
        console2.log("DoomLaunchpad:", address(launchpad));
    }
}
