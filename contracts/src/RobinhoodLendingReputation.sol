// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/// @notice Issuer-backed, privacy-preserving reputation commitments derived from Lending V2 evidence.
/// @dev Scores and wallet event histories remain off-chain. Each claim pins the canonical Lending V2
///      contract, an inspected block interval, and a digest of the reproducible evidence document.
contract RobinhoodLendingReputation is AccessControl, Pausable {
    uint256 public constant ROBINHOOD_TESTNET_CHAIN_ID = 46_630;
    uint64 public constant MODEL_VERSION = 1;
    bytes32 public constant REPUTATION_ISSUER_ROLE = keccak256("REPUTATION_ISSUER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant SCORE_MODEL_HASH =
        keccak256("GYEVO_LENDING_REPUTATION_V1:participation=1,borrow=1,full-repayment=2,liquidation=-2");

    struct Claim {
        address wallet;
        bytes32 commitment;
        address issuer;
        uint64 issuedAt;
        uint64 expiresAt;
        uint64 credentialVersion;
        uint64 modelVersion;
        uint256 observedFromBlock;
        uint256 observedToBlock;
        bytes32 evidenceHash;
        bool revoked;
    }

    address public immutable lendingPool;
    mapping(address wallet => Claim claim) private claims;

    error UnsupportedChain();
    error ZeroAddress();
    error MissingCode(address target);
    error InvalidClaim();
    error InvalidBlockRange();
    error UnexpectedClaimVersion(uint64 expected, uint64 actual);
    error ClaimMissing();
    error ClaimAlreadyRevoked();
    error NotClaimIssuer();

    event ReputationClaimRecorded(
        address indexed wallet,
        uint64 indexed credentialVersion,
        bytes32 indexed commitment,
        address issuer,
        uint64 expiresAt,
        uint256 observedFromBlock,
        uint256 observedToBlock,
        bytes32 evidenceHash,
        bytes32 scoreModelHash
    );
    event ReputationClaimRevoked(address indexed wallet, uint64 indexed credentialVersion, address indexed actor);

    constructor(address lendingPool_, address admin_, address issuer_, address pauseAuthority_) {
        if (block.chainid != ROBINHOOD_TESTNET_CHAIN_ID) revert UnsupportedChain();
        if (
            lendingPool_ == address(0) || admin_ == address(0) || issuer_ == address(0) || pauseAuthority_ == address(0)
        ) {
            revert ZeroAddress();
        }
        if (lendingPool_.code.length == 0) revert MissingCode(lendingPool_);
        lendingPool = lendingPool_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(REPUTATION_ISSUER_ROLE, issuer_);
        _grantRole(PAUSER_ROLE, pauseAuthority_);
        _pause();
    }

    function recordClaim(
        address wallet,
        bytes32 commitment,
        uint64 expiresAt,
        uint64 credentialVersion,
        uint256 observedFromBlock,
        uint256 observedToBlock,
        bytes32 evidenceHash
    ) external onlyRole(REPUTATION_ISSUER_ROLE) whenNotPaused {
        if (
            wallet == address(0) || commitment == bytes32(0) || evidenceHash == bytes32(0)
                || expiresAt <= block.timestamp || credentialVersion == 0
        ) revert InvalidClaim();
        if (observedFromBlock > observedToBlock || observedToBlock >= block.number) revert InvalidBlockRange();
        uint64 expectedVersion = claims[wallet].credentialVersion + 1;
        if (credentialVersion != expectedVersion) {
            revert UnexpectedClaimVersion(expectedVersion, credentialVersion);
        }

        claims[wallet] = Claim({
            wallet: wallet,
            commitment: commitment,
            issuer: msg.sender,
            issuedAt: SafeCast.toUint64(block.timestamp),
            expiresAt: expiresAt,
            credentialVersion: credentialVersion,
            modelVersion: MODEL_VERSION,
            observedFromBlock: observedFromBlock,
            observedToBlock: observedToBlock,
            evidenceHash: evidenceHash,
            revoked: false
        });
        emit ReputationClaimRecorded(
            wallet,
            credentialVersion,
            commitment,
            msg.sender,
            expiresAt,
            observedFromBlock,
            observedToBlock,
            evidenceHash,
            SCORE_MODEL_HASH
        );
    }

    function revokeClaim(address wallet) external {
        Claim storage claim = claims[wallet];
        if (claim.issuer == address(0)) revert ClaimMissing();
        if (claim.revoked) revert ClaimAlreadyRevoked();
        if (msg.sender != claim.issuer && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert NotClaimIssuer();
        claim.revoked = true;
        emit ReputationClaimRevoked(wallet, claim.credentialVersion, msg.sender);
    }

    function getClaim(address wallet) external view returns (Claim memory) {
        return claims[wallet];
    }

    function isActiveClaim(address wallet) external view returns (bool) {
        Claim storage claim = claims[wallet];
        return claim.wallet == wallet && claim.commitment != bytes32(0) && claim.issuer != address(0)
            && hasRole(REPUTATION_ISSUER_ROLE, claim.issuer) && !claim.revoked && claim.issuedAt <= block.timestamp
            && claim.expiresAt > block.timestamp;
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
