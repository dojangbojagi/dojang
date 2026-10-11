// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice Piecewise-linear annual borrow-rate model, with rates expressed in basis points.
library UtilizationRateModel {
    uint256 internal constant BASIS_POINTS = 10_000;

    function borrowRateBps(
        uint256 utilizationBps,
        uint256 optimalUtilizationBps,
        uint256 baseBorrowRateBps,
        uint256 slope1Bps,
        uint256 slope2Bps
    ) internal pure returns (uint256) {
        if (utilizationBps > BASIS_POINTS) utilizationBps = BASIS_POINTS;
        if (utilizationBps <= optimalUtilizationBps) {
            return baseBorrowRateBps
                + Math.mulDiv(slope1Bps, utilizationBps, optimalUtilizationBps);
        }

        return baseBorrowRateBps + slope1Bps
            + Math.mulDiv(
                slope2Bps,
                utilizationBps - optimalUtilizationBps,
                BASIS_POINTS - optimalUtilizationBps
            );
    }
}
