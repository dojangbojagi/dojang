// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Returns a price in quote-currency WAD per whole token and its update time.
interface IPriceOracle {
    function getPrice(address asset) external view returns (uint256 priceWad, uint64 updatedAt);
}
