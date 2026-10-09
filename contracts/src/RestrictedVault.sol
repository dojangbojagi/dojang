// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {DemoCredentialRegistry} from "./DemoCredentialRegistry.sol";
import {IEligibilityVerifier} from "./interfaces/IEligibilityVerifier.sol";

/// @notice Proof-gated access flag. It does not custody funds or accept deposits.
contract RestrictedVault {
    uint256 public constant POLICY_ID = 1;
    uint256 public constant POLICY_VERSION = 1;
    uint256 public constant threshold = 1_000;

    DemoCredentialRegistry public immutable registry;
    IEligibilityVerifier public immutable verifier;
    mapping(address wallet => bool granted) public hasAccess;

    error ZeroAddress();
    error UnsupportedChain();
    error AlreadyGranted();
    error MissingCredential();
    error CredentialRevoked();
    error CredentialExpired();
    error WrongSubject();
    error WrongCommitment();
    error WrongPolicy();
    error WrongPolicyVersion();
    error WrongThreshold();
    error WrongCredentialVersion();
    error WrongExpiry();
    error WrongChain();
    error WrongVault();
    error InvalidProof();

    event VaultAccessGranted(
        address indexed wallet,
        uint256 indexed policyId,
        uint64 credentialVersion,
        bytes32 commitment
    );

    constructor(DemoCredentialRegistry registry_, IEligibilityVerifier verifier_) {
        if (block.chainid != 91342) revert UnsupportedChain();
        if (address(registry_) == address(0) || address(verifier_) == address(0)) revert ZeroAddress();
        registry = registry_;
        verifier = verifier_;
    }

    /// @dev Public inputs are [wallet, commitment, policyId, policyVersion, threshold,
    /// credentialVersion, expiresAt, chainId, vaultAddress]. This exact order must match the circuit.
    function enterVault(bytes calldata proof, uint256[9] calldata publicInputs) external {
        if (hasAccess[msg.sender]) revert AlreadyGranted();

        DemoCredentialRegistry.Credential memory credential = registry.getCredential(msg.sender, POLICY_ID);
        if (credential.issuer == address(0)) revert MissingCredential();
        if (credential.revoked) revert CredentialRevoked();
        if (credential.expiresAt <= block.timestamp) revert CredentialExpired();

        if (publicInputs[0] != uint256(uint160(msg.sender))) revert WrongSubject();
        if (publicInputs[1] != uint256(credential.commitment)) revert WrongCommitment();
        if (publicInputs[2] != POLICY_ID) revert WrongPolicy();
        if (publicInputs[3] != POLICY_VERSION) revert WrongPolicyVersion();
        if (publicInputs[4] != threshold) revert WrongThreshold();
        if (publicInputs[5] != credential.version) revert WrongCredentialVersion();
        if (publicInputs[6] != credential.expiresAt) revert WrongExpiry();
        if (publicInputs[7] != block.chainid) revert WrongChain();
        if (publicInputs[8] != uint256(uint160(address(this)))) revert WrongVault();

        if (!verifier.verifyProof(proof, publicInputs)) revert InvalidProof();

        hasAccess[msg.sender] = true;
        emit VaultAccessGranted(msg.sender, POLICY_ID, credential.version, credential.commitment);
    }
}
