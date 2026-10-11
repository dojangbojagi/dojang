// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

import {IPriceOracle} from "./interfaces/IPriceOracle.sol";

/// @notice Admin-controlled price source for controlled test-token demonstrations only.
/// @dev No prices are seeded by the constructor or deployment script. This is not a market oracle.
contract ControlledTestOracle is AccessControl, IPriceOracle {
    bytes32 public constant PRICE_UPDATER_ROLE = keccak256("PRICE_UPDATER_ROLE");

    struct PriceBounds {
        uint128 minimumPriceWad;
        uint128 maximumPriceWad;
        uint128 priceWad;
        uint64 updatedAt;
        bool configured;
    }

    mapping(address asset => PriceBounds bounds) private prices;

    error ZeroAddress();
    error InvalidPriceBounds();
    error PriceOutsideBounds(uint256 priceWad, uint256 minimumPriceWad, uint256 maximumPriceWad);
    error PriceUnavailable(address asset);

    event PriceBoundsUpdated(address indexed asset, uint256 minimumPriceWad, uint256 maximumPriceWad);
    event TestPriceUpdated(address indexed asset, uint256 priceWad, uint64 updatedAt, address indexed updater);

    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PRICE_UPDATER_ROLE, admin);
    }

    function setPriceBounds(address asset, uint128 minimumPriceWad, uint128 maximumPriceWad)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (asset == address(0)) revert ZeroAddress();
        if (minimumPriceWad == 0 || maximumPriceWad < minimumPriceWad) revert InvalidPriceBounds();

        PriceBounds storage price = prices[asset];
        if (price.configured && price.priceWad != 0) {
            if (price.priceWad < minimumPriceWad || price.priceWad > maximumPriceWad) {
                revert PriceOutsideBounds(price.priceWad, minimumPriceWad, maximumPriceWad);
            }
        }
        price.minimumPriceWad = minimumPriceWad;
        price.maximumPriceWad = maximumPriceWad;
        price.configured = true;
        emit PriceBoundsUpdated(asset, minimumPriceWad, maximumPriceWad);
    }

    function setPrice(address asset, uint128 priceWad) external onlyRole(PRICE_UPDATER_ROLE) {
        PriceBounds storage price = prices[asset];
        if (!price.configured) revert PriceUnavailable(asset);
        if (priceWad < price.minimumPriceWad || priceWad > price.maximumPriceWad) {
            revert PriceOutsideBounds(priceWad, price.minimumPriceWad, price.maximumPriceWad);
        }

        uint64 updatedAt = uint64(block.timestamp);
        price.priceWad = priceWad;
        price.updatedAt = updatedAt;
        emit TestPriceUpdated(asset, priceWad, updatedAt, msg.sender);
    }

    function getPrice(address asset) external view returns (uint256 priceWad, uint64 updatedAt) {
        PriceBounds storage price = prices[asset];
        if (!price.configured || price.priceWad == 0 || price.updatedAt == 0) revert PriceUnavailable(asset);
        return (price.priceWad, price.updatedAt);
    }

    function getPriceBounds(address asset)
        external
        view
        returns (uint128 minimumPriceWad, uint128 maximumPriceWad, uint128 priceWad, uint64 updatedAt)
    {
        PriceBounds storage price = prices[asset];
        return (price.minimumPriceWad, price.maximumPriceWad, price.priceWad, price.updatedAt);
    }
}
