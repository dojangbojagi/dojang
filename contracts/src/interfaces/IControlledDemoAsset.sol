// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/// @notice Marker required by the fixed-price GIWA demo market.
interface IControlledDemoAsset is IERC20Metadata {
    function controlledDemoAssetMarker() external pure returns (bytes4);
    function mintCap() external view returns (uint256);
}
