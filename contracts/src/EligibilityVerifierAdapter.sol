// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IEligibilityVerifier} from "./interfaces/IEligibilityVerifier.sol";
import {HonkVerifier} from "./generated/EligibilityHonkVerifier.sol";

/// @notice Adapts the generated Honk verifier to the vault's fixed-width input interface.
contract EligibilityVerifierAdapter is IEligibilityVerifier {
    HonkVerifier public immutable honkVerifier;

    error ZeroAddress();

    constructor(HonkVerifier honkVerifier_) {
        if (address(honkVerifier_) == address(0)) revert ZeroAddress();
        honkVerifier = honkVerifier_;
    }

    function verifyProof(bytes calldata proof, uint256[9] calldata publicInputs)
        external
        view
        returns (bool)
    {
        bytes32[] memory verifierInputs = new bytes32[](9);
        for (uint256 i = 0; i < publicInputs.length; i++) {
            verifierInputs[i] = bytes32(publicInputs[i]);
        }

        try honkVerifier.verify(proof, verifierInputs) returns (bool verified) {
            return verified;
        } catch {
            return false;
        }
    }
}
