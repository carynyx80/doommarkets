// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title DoomToken
/// @notice Plain fixed-supply ERC20 deployed by DoomLaunchpad. Entire supply is minted to the launchpad.
contract DoomToken is ERC20 {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether;

    address public immutable launchpad;

    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {
        launchpad = msg.sender;
        _mint(msg.sender, TOTAL_SUPPLY);
    }
}
