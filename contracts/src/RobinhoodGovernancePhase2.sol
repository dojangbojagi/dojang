// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {RobinhoodDemoCredentialRegistry} from "./RobinhoodDemoCredentialRegistry.sol";
import {RobinhoodLendingReputation} from "./RobinhoodLendingReputation.sol";
import {IEligibilityVerifier} from "./interfaces/IEligibilityVerifier.sol";

/// @notice Robinhood Testnet DAO Phase 2 with private reputation proofs and commit-reveal ballots.
/// @dev The eligibility proof hides the reputation score and salt, but exposes the member wallet.
///      Commit-reveal hides the vote only until reveal; wallet and revealed choice remain linkable.
contract RobinhoodGovernancePhase2 is AccessControl, Pausable {
    uint256 public constant ROBINHOOD_TESTNET_CHAIN_ID = 46_630;
    uint256 public constant MEMBERSHIP_POLICY_ID = 5;
    uint256 public constant MEMBERSHIP_POLICY_VERSION = 1;
    uint256 public constant MAX_CONTENT_REFERENCE_LENGTH = 512;
    uint256 public constant MAX_REPUTATION_THRESHOLD = 100;
    uint64 public constant MAX_PERIOD = 30 days;
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant BALLOT_DOMAIN = keccak256("GYEVO_DAO_PHASE2_BALLOT_V1");
    bytes32 public constant NULLIFIER_DOMAIN = keccak256("GYEVO_DAO_PHASE2_NULLIFIER_V1");

    enum VoteType {
        Against,
        For,
        Abstain
    }
    enum ProposalState {
        None,
        Pending,
        Commit,
        Reveal,
        Succeeded,
        Rejected,
        Expired,
        Executed
    }

    struct Membership {
        bytes32 commitment;
        uint64 credentialVersion;
        uint64 expiresAt;
        uint64 registeredAt;
        uint256 reputationThreshold;
    }

    struct Proposal {
        address proposer;
        string contentReference;
        uint64 createdAt;
        uint64 startAt;
        uint64 commitDeadline;
        uint64 revealDeadline;
        uint64 executionDeadline;
        uint256 proposedMinimumReputation;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        uint256 committedVotes;
        bool finalized;
        bool approved;
        bool executed;
    }

    RobinhoodDemoCredentialRegistry public immutable credentialRegistry;
    RobinhoodLendingReputation public immutable reputationRegistry;
    IEligibilityVerifier public immutable eligibilityVerifier;
    uint64 public immutable commitPeriod;
    uint64 public immutable revealPeriod;
    uint64 public immutable executionWindow;
    uint256 public immutable quorum;

    uint256 public minimumReputation;
    uint256 public nextProposalId = 1;
    mapping(address wallet => Membership membership) public memberships;
    mapping(uint256 proposalId => Proposal proposal) private proposals;
    mapping(uint256 proposalId => mapping(bytes32 nullifier => bytes32 commitment)) public ballotCommitments;
    mapping(uint256 proposalId => mapping(bytes32 nullifier => bool revealed)) public ballotRevealed;

    error UnsupportedChain();
    error ZeroAddress();
    error MissingCode(address target);
    error InvalidPeriod();
    error InvalidQuorum();
    error InvalidReputationThreshold();
    error InvalidContentReference();
    error InvalidProposal();
    error InvalidVoteType();
    error CommitNotActive();
    error RevealNotActive();
    error DuplicateVote();
    error MissingBallot();
    error InvalidBallotReveal();
    error NotActiveMember(address wallet);
    error MissingCredential(address wallet);
    error CredentialInactive(address wallet);
    error ReputationInactive(address wallet);
    error ReputationMismatch();
    error WrongProofContext();
    error InvalidProof();
    error AlreadyFinalized();
    error ProposalStillActive();
    error ProposalNotFinalized();
    error ProposalNotSucceeded();
    error UnauthorizedAction();

    event MembershipRegistered(
        address indexed wallet,
        bytes32 indexed commitment,
        uint64 indexed credentialVersion,
        uint64 expiresAt,
        uint256 reputationThreshold
    );
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        uint64 startAt,
        uint64 commitDeadline,
        uint64 revealDeadline,
        uint64 executionDeadline,
        uint256 proposedMinimumReputation,
        string contentReference
    );
    event VoteCommitted(uint256 indexed proposalId, bytes32 indexed nullifier, bytes32 ballotCommitment);
    event VoteRevealed(uint256 indexed proposalId, bytes32 indexed nullifier, VoteType voteType);
    event ProposalFinalized(
        uint256 indexed proposalId,
        bool approved,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 abstainVotes,
        uint256 committedVotes,
        uint256 quorum
    );
    event ProposalExecuted(uint256 indexed proposalId, uint256 minimumReputation);
    event MinimumReputationChanged(uint256 previousValue, uint256 newValue, uint256 indexed proposalId);

    constructor(
        RobinhoodDemoCredentialRegistry credentialRegistry_,
        RobinhoodLendingReputation reputationRegistry_,
        IEligibilityVerifier eligibilityVerifier_,
        address admin_,
        address pauseAuthority_,
        uint64 commitPeriod_,
        uint64 revealPeriod_,
        uint64 executionWindow_,
        uint256 quorum_,
        uint256 initialMinimumReputation_
    ) {
        if (block.chainid != ROBINHOOD_TESTNET_CHAIN_ID) revert UnsupportedChain();
        if (
            address(credentialRegistry_) == address(0) || address(reputationRegistry_) == address(0)
                || address(eligibilityVerifier_) == address(0) || admin_ == address(0) || pauseAuthority_ == address(0)
        ) revert ZeroAddress();
        if (address(credentialRegistry_).code.length == 0) revert MissingCode(address(credentialRegistry_));
        if (address(reputationRegistry_).code.length == 0) revert MissingCode(address(reputationRegistry_));
        if (address(eligibilityVerifier_).code.length == 0) revert MissingCode(address(eligibilityVerifier_));
        if (
            commitPeriod_ == 0 || revealPeriod_ == 0 || executionWindow_ == 0 || commitPeriod_ > MAX_PERIOD
                || revealPeriod_ > MAX_PERIOD || executionWindow_ > MAX_PERIOD
        ) revert InvalidPeriod();
        if (quorum_ == 0) revert InvalidQuorum();
        _validateReputationThreshold(initialMinimumReputation_);

        credentialRegistry = credentialRegistry_;
        reputationRegistry = reputationRegistry_;
        eligibilityVerifier = eligibilityVerifier_;
        commitPeriod = commitPeriod_;
        revealPeriod = revealPeriod_;
        executionWindow = executionWindow_;
        quorum = quorum_;
        minimumReputation = initialMinimumReputation_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(PAUSER_ROLE, pauseAuthority_);
        _pause();
    }

    function registerMembership(bytes calldata proof, uint256[9] calldata publicInputs) external whenNotPaused {
        RobinhoodDemoCredentialRegistry.Credential memory credential =
            _validateEligibility(msg.sender, proof, publicInputs);
        memberships[msg.sender] = Membership({
            commitment: credential.commitment,
            credentialVersion: credential.version,
            expiresAt: credential.expiresAt,
            registeredAt: SafeCast.toUint64(block.timestamp),
            reputationThreshold: minimumReputation
        });
        emit MembershipRegistered(
            msg.sender, credential.commitment, credential.version, credential.expiresAt, minimumReputation
        );
    }

    function createProposal(string calldata contentReference, uint256 proposedMinimumReputation)
        external
        whenNotPaused
        returns (uint256 proposalId)
    {
        _requireActiveMember(msg.sender);
        if (bytes(contentReference).length == 0 || bytes(contentReference).length > MAX_CONTENT_REFERENCE_LENGTH) {
            revert InvalidContentReference();
        }
        _validateReputationThreshold(proposedMinimumReputation);
        uint64 createdAt = SafeCast.toUint64(block.timestamp);
        uint64 startAt = createdAt + 1 minutes;
        uint64 commitDeadline = startAt + commitPeriod;
        uint64 revealDeadline = commitDeadline + revealPeriod;
        uint64 executionDeadline = revealDeadline + executionWindow;
        proposalId = nextProposalId++;
        Proposal storage proposal = proposals[proposalId];
        proposal.proposer = msg.sender;
        proposal.contentReference = contentReference;
        proposal.createdAt = createdAt;
        proposal.startAt = startAt;
        proposal.commitDeadline = commitDeadline;
        proposal.revealDeadline = revealDeadline;
        proposal.executionDeadline = executionDeadline;
        proposal.proposedMinimumReputation = proposedMinimumReputation;
        _emitProposalCreated(proposalId, proposal);
    }

    function commitVote(uint256 proposalId, bytes32 sealedBallot) external whenNotPaused returns (bytes32 nullifier) {
        Proposal storage proposal = _proposal(proposalId);
        if (block.timestamp < proposal.startAt || block.timestamp >= proposal.commitDeadline) revert CommitNotActive();
        if (sealedBallot == bytes32(0)) revert InvalidBallotReveal();
        _requireActiveMember(msg.sender);
        nullifier = voteNullifier(proposalId, msg.sender);
        if (ballotCommitments[proposalId][nullifier] != bytes32(0)) revert DuplicateVote();
        ballotCommitments[proposalId][nullifier] = sealedBallot;
        proposal.committedVotes += 1;
        emit VoteCommitted(proposalId, nullifier, sealedBallot);
    }

    /// @notice Reveal remains available while paused so a pause cannot strand an already committed ballot.
    function revealVote(uint256 proposalId, VoteType voteType, bytes32 salt) external {
        Proposal storage proposal = _proposal(proposalId);
        if (block.timestamp < proposal.commitDeadline || block.timestamp >= proposal.revealDeadline) {
            revert RevealNotActive();
        }
        if (uint8(voteType) > uint8(VoteType.Abstain)) revert InvalidVoteType();
        bytes32 nullifier = voteNullifier(proposalId, msg.sender);
        bytes32 stored = ballotCommitments[proposalId][nullifier];
        if (stored == bytes32(0)) revert MissingBallot();
        if (ballotRevealed[proposalId][nullifier]) revert DuplicateVote();
        if (stored != ballotCommitment(proposalId, msg.sender, voteType, salt)) revert InvalidBallotReveal();
        ballotRevealed[proposalId][nullifier] = true;
        if (voteType == VoteType.For) proposal.forVotes += 1;
        else if (voteType == VoteType.Against) proposal.againstVotes += 1;
        else proposal.abstainVotes += 1;
        emit VoteRevealed(proposalId, nullifier, voteType);
    }

    function finalizeProposal(uint256 proposalId) external {
        Proposal storage proposal = _proposal(proposalId);
        if (proposal.finalized) revert AlreadyFinalized();
        if (block.timestamp < proposal.revealDeadline) revert ProposalStillActive();
        proposal.finalized = true;
        proposal.approved = _quorumReached(proposal) && proposal.forVotes > proposal.againstVotes;
        emit ProposalFinalized(
            proposalId,
            proposal.approved,
            proposal.forVotes,
            proposal.againstVotes,
            proposal.abstainVotes,
            proposal.committedVotes,
            quorum
        );
    }

    function executeProposal(uint256 proposalId) external whenNotPaused {
        Proposal storage proposal = _proposal(proposalId);
        if (!proposal.finalized) revert ProposalNotFinalized();
        if (proposalState(proposalId) != ProposalState.Succeeded) revert ProposalNotSucceeded();
        proposal.executed = true;
        uint256 previous = minimumReputation;
        minimumReputation = proposal.proposedMinimumReputation;
        emit MinimumReputationChanged(previous, minimumReputation, proposalId);
        emit ProposalExecuted(proposalId, minimumReputation);
    }

    function isActiveMember(address wallet) external view returns (bool) {
        return _isActiveMember(wallet);
    }

    function voteNullifier(uint256 proposalId, address voter) public view returns (bytes32) {
        return keccak256(abi.encode(NULLIFIER_DOMAIN, address(this), block.chainid, proposalId, voter));
    }

    function ballotCommitment(uint256 proposalId, address voter, VoteType voteType, bytes32 salt)
        public
        view
        returns (bytes32)
    {
        return keccak256(abi.encode(BALLOT_DOMAIN, address(this), block.chainid, proposalId, voter, voteType, salt));
    }

    function proposalState(uint256 proposalId) public view returns (ProposalState) {
        Proposal storage proposal = proposals[proposalId];
        if (proposal.proposer == address(0)) revert InvalidProposal();
        if (proposal.executed) return ProposalState.Executed;
        if (block.timestamp < proposal.startAt) return ProposalState.Pending;
        if (block.timestamp < proposal.commitDeadline) return ProposalState.Commit;
        if (block.timestamp < proposal.revealDeadline) return ProposalState.Reveal;
        bool approved = proposal.finalized
            ? proposal.approved
            : (_quorumReached(proposal) && proposal.forVotes > proposal.againstVotes);
        if (!approved) return ProposalState.Rejected;
        if (block.timestamp > proposal.executionDeadline) return ProposalState.Expired;
        return ProposalState.Succeeded;
    }

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        return _proposal(proposalId);
    }

    function proposalVoteCounts(uint256 proposalId)
        external
        view
        returns (uint256 forVotes, uint256 againstVotes, uint256 abstainVotes, uint256 committedVotes)
    {
        Proposal storage proposal = _proposal(proposalId);
        return (proposal.forVotes, proposal.againstVotes, proposal.abstainVotes, proposal.committedVotes);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function _validateEligibility(address wallet, bytes calldata proof, uint256[9] calldata publicInputs)
        private
        view
        returns (RobinhoodDemoCredentialRegistry.Credential memory credential)
    {
        if (proof.length == 0) revert InvalidProof();
        credential = credentialRegistry.getCredential(wallet, MEMBERSHIP_POLICY_ID);
        if (credential.wallet != wallet || credential.issuer == address(0)) revert MissingCredential(wallet);
        if (
            credential.revoked || credential.issuedAt > block.timestamp || credential.expiresAt <= block.timestamp
                || !credentialRegistry.hasRole(credentialRegistry.ISSUER_ROLE(), credential.issuer)
        ) revert CredentialInactive(wallet);
        RobinhoodLendingReputation.Claim memory claim = reputationRegistry.getClaim(wallet);
        if (
            claim.wallet != wallet || claim.revoked || claim.issuedAt > block.timestamp
                || claim.expiresAt <= block.timestamp
                || !reputationRegistry.hasRole(reputationRegistry.REPUTATION_ISSUER_ROLE(), claim.issuer)
        ) revert ReputationInactive(wallet);
        if (
            claim.commitment != credential.commitment || claim.expiresAt != credential.expiresAt
                || claim.credentialVersion != credential.version
        ) revert ReputationMismatch();
        if (
            publicInputs[0] != uint256(uint160(wallet)) || publicInputs[1] != uint256(credential.commitment)
                || publicInputs[2] != MEMBERSHIP_POLICY_ID || publicInputs[3] != MEMBERSHIP_POLICY_VERSION
                || publicInputs[4] != minimumReputation || publicInputs[5] != credential.version
                || publicInputs[6] != credential.expiresAt || publicInputs[7] != block.chainid
                || publicInputs[8] != uint256(uint160(address(this)))
        ) revert WrongProofContext();
        if (!eligibilityVerifier.verifyProof(proof, publicInputs)) revert InvalidProof();
    }

    function _requireActiveMember(address wallet) private view {
        if (!_isActiveMember(wallet)) revert NotActiveMember(wallet);
    }

    function _isActiveMember(address wallet) private view returns (bool) {
        Membership storage member = memberships[wallet];
        if (
            member.commitment == bytes32(0) || member.expiresAt <= block.timestamp
                || member.reputationThreshold != minimumReputation
        ) return false;
        RobinhoodDemoCredentialRegistry.Credential memory credential =
            credentialRegistry.getCredential(wallet, MEMBERSHIP_POLICY_ID);
        if (
            credential.wallet != wallet || credential.revoked || credential.issuedAt > block.timestamp
                || credential.expiresAt <= block.timestamp || credential.expiresAt != member.expiresAt
                || credential.version != member.credentialVersion || credential.commitment != member.commitment
                || !credentialRegistry.hasRole(credentialRegistry.ISSUER_ROLE(), credential.issuer)
        ) return false;
        RobinhoodLendingReputation.Claim memory claim = reputationRegistry.getClaim(wallet);
        return claim.wallet == wallet && !claim.revoked && claim.issuedAt <= block.timestamp
            && claim.expiresAt > block.timestamp && claim.expiresAt == member.expiresAt
            && claim.credentialVersion == member.credentialVersion && claim.commitment == member.commitment
            && reputationRegistry.hasRole(reputationRegistry.REPUTATION_ISSUER_ROLE(), claim.issuer);
    }

    function _proposal(uint256 proposalId) private view returns (Proposal storage proposal) {
        proposal = proposals[proposalId];
        if (proposal.proposer == address(0)) revert InvalidProposal();
    }

    function _emitProposalCreated(uint256 proposalId, Proposal storage proposal) private {
        emit ProposalCreated(
            proposalId,
            proposal.proposer,
            proposal.startAt,
            proposal.commitDeadline,
            proposal.revealDeadline,
            proposal.executionDeadline,
            proposal.proposedMinimumReputation,
            proposal.contentReference
        );
    }

    function _quorumReached(Proposal storage proposal) private view returns (bool) {
        return proposal.forVotes + proposal.againstVotes + proposal.abstainVotes >= quorum;
    }

    function _validateReputationThreshold(uint256 value) private pure {
        if (value == 0 || value > MAX_REPUTATION_THRESHOLD) revert InvalidReputationThreshold();
    }
}
