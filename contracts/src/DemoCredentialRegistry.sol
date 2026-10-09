// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/// @notice Stores issuer-authorized demo commitments, never the private value or salt.
contract DemoCredentialRegistry is AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    struct Credential {
        address wallet;
        bytes32 commitment;
        address issuer;
        uint64 issuedAt;
        uint64 expiresAt;
        uint64 version;
        bool revoked;
    }

    mapping(address wallet => mapping(uint256 policyId => Credential)) private credentials;

    error ZeroWallet();
    error UnsupportedChain();
    error InvalidPolicy();
    error ZeroCommitment();
    error InvalidExpiry();
    error CredentialMissing();
    error CredentialAlreadyRevoked();
    error NotCredentialIssuer();
    error UnexpectedCredentialVersion(uint64 expected, uint64 actual);

    event CredentialCommitted(
        address indexed wallet,
        uint256 indexed policyId,
        uint64 indexed version,
        bytes32 commitment,
        address issuer,
        uint64 expiresAt
    );
    event CredentialRevoked(address indexed wallet, uint256 indexed policyId, uint64 indexed version, address issuer);

    constructor() {
        if (block.chainid != 91342) revert UnsupportedChain();
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function recordCredential(
        address wallet,
        uint256 policyId,
        bytes32 commitment,
        uint64 expiresAt,
        uint64 expectedVersion
    ) external onlyRole(ISSUER_ROLE) returns (uint64 version) {
        if (wallet == address(0)) revert ZeroWallet();
        if (policyId == 0) revert InvalidPolicy();
        if (commitment == bytes32(0)) revert ZeroCommitment();
        if (expiresAt <= block.timestamp) revert InvalidExpiry();

        Credential storage previous = credentials[wallet][policyId];
        version = previous.version + 1;
        if (version != expectedVersion) revert UnexpectedCredentialVersion(expectedVersion, version);
        credentials[wallet][policyId] = Credential({
            wallet: wallet,
            commitment: commitment,
            issuer: msg.sender,
            issuedAt: SafeCast.toUint64(block.timestamp),
            expiresAt: expiresAt,
            version: version,
            revoked: false
        });

        emit CredentialCommitted(wallet, policyId, version, commitment, msg.sender, expiresAt);
    }

    function revokeCredential(address wallet, uint256 policyId) external {
        Credential storage credential = credentials[wallet][policyId];
        if (credential.issuer == address(0)) revert CredentialMissing();
        if (credential.revoked) revert CredentialAlreadyRevoked();
        if (msg.sender != credential.issuer && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert NotCredentialIssuer();
        }

        credential.revoked = true;
        emit CredentialRevoked(wallet, policyId, credential.version, msg.sender);
    }

    function getCredential(address wallet, uint256 policyId) external view returns (Credential memory) {
        return credentials[wallet][policyId];
    }
}
