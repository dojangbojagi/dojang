// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Adapter boundary for a circuit-generated verifier contract.
/// @dev A production deployment must pass the generated verifier for the documented circuit.
interface IEligibilityVerifier {
    function verifyProof(bytes calldata proof, uint256[9] calldata publicInputs) external view returns (bool);
}
