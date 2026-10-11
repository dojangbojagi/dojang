// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IEligibilityVerifier} from "../../src/interfaces/IEligibilityVerifier.sol";

/// @dev Unit-test seam only. The V2 Anvil journey uses the generated Honk verifier.
contract MockEligibilityVerifierV2 is IEligibilityVerifier {
    function verifyProof(bytes calldata proof, uint256[9] calldata) external pure returns (bool) {
        return proof.length == 1 && proof[0] == 0x42;
    }
}
