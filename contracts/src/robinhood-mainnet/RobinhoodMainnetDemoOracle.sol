// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IPriceOracle} from "../interfaces/IPriceOracle.sol";

/// @notice Admin-bounded synthetic pricing for controlled Robinhood Mainnet demos only.
/// @dev Not a market oracle. Constructor configures bounds and deliberately seeds no prices.
contract RobinhoodMainnetDemoOracle is AccessControl, IPriceOracle {
    uint256 public constant ROBINHOOD_MAINNET_CHAIN_ID = 4_663;
    bytes32 public constant PRICE_UPDATER_ROLE = keccak256("PRICE_UPDATER_ROLE");

    struct PriceBounds {
        uint128 minimumPriceWad;
        uint128 maximumPriceWad;
        uint128 priceWad;
        uint64 updatedAt;
        bool configured;
    }

    mapping(address asset => PriceBounds bounds) private prices;

    error UnsupportedChain();
    error InvalidRoleAddress();
    error InvalidPriceBounds();
    error PriceOutsideBounds(uint256 priceWad, uint256 minimumPriceWad, uint256 maximumPriceWad);
    error PriceUnavailable(address asset);

    event PriceBoundsUpdated(address indexed asset, uint256 minimumPriceWad, uint256 maximumPriceWad);
    event TestPriceUpdated(address indexed asset, uint256 priceWad, uint64 updatedAt, address indexed updater);

    constructor(
        address admin,
        address updater,
        address loanAsset,
        uint128 loanMinimum,
        uint128 loanMaximum,
        address collateralAsset,
        uint128 collateralMinimum,
        uint128 collateralMaximum
    ) {
        if (block.chainid != ROBINHOOD_MAINNET_CHAIN_ID) revert UnsupportedChain();
        if (
            admin == address(0) || updater == address(0) || admin == updater
                || loanAsset == address(0) || collateralAsset == address(0) || loanAsset == collateralAsset
        ) revert InvalidRoleAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PRICE_UPDATER_ROLE, updater);
        _setPriceBounds(loanAsset, loanMinimum, loanMaximum);
        _setPriceBounds(collateralAsset, collateralMinimum, collateralMaximum);
    }

    function demoOnly() external pure returns (bool) { return true; }

    function setPriceBounds(address asset, uint128 minimumPriceWad, uint128 maximumPriceWad)
        external onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _setPriceBounds(asset, minimumPriceWad, maximumPriceWad);
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

    function priceConfigured(address asset) external view returns (bool) { return prices[asset].configured; }

    function getPriceBounds(address asset)
        external view returns (uint128 minimumPriceWad, uint128 maximumPriceWad, uint128 priceWad, uint64 updatedAt)
    {
        PriceBounds storage price = prices[asset];
        return (price.minimumPriceWad, price.maximumPriceWad, price.priceWad, price.updatedAt);
    }

    function _setPriceBounds(address asset, uint128 minimumPriceWad, uint128 maximumPriceWad) private {
        if (asset == address(0) || minimumPriceWad == 0 || maximumPriceWad < minimumPriceWad) {
            revert InvalidPriceBounds();
        }
        PriceBounds storage price = prices[asset];
        if (price.priceWad != 0 && (price.priceWad < minimumPriceWad || price.priceWad > maximumPriceWad)) {
            revert PriceOutsideBounds(price.priceWad, minimumPriceWad, maximumPriceWad);
        }
        price.minimumPriceWad = minimumPriceWad;
        price.maximumPriceWad = maximumPriceWad;
        price.configured = true;
        emit PriceBoundsUpdated(asset, minimumPriceWad, maximumPriceWad);
    }
}
