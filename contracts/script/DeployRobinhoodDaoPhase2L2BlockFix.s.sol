// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {DeployRobinhoodDaoPhase2} from "./DeployRobinhoodDaoPhase2.s.sol";

/// @notice Replacement deployment namespace for the Nitro L2 block-number correction.
/// @dev Inherits the reviewed Phase 2 deployment sequence and role checks unchanged.
///      Its distinct script name keeps the existing Phase 2 broadcast artifact intact.
contract DeployRobinhoodDaoPhase2L2BlockFix is DeployRobinhoodDaoPhase2 {}
