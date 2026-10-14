// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {RobinhoodMainnetDemoCredentialRegistry} from "./RobinhoodMainnetDemoCredentialRegistry.sol";

/// @notice Explicitly demo-only Robinhood Mainnet governance using project-issued credentials.
/// @dev Policy 4 is not official Dojang verification. This is not production DAO governance.
contract RobinhoodMainnetDemoGovernancePhase1 is AccessControl, Pausable {
    uint256 public constant ROBINHOOD_MAINNET_CHAIN_ID = 4_663;
    uint256 public constant GOVERNANCE_CREDENTIAL_POLICY_ID = 4;
    uint64 public constant MAX_VOTING_PERIOD = 30 days;
    uint64 public constant MAX_EXECUTION_WINDOW = 90 days;
    uint64 public constant MAX_MINIMUM_REMAINING_VALIDITY = 365 days;
    uint256 public constant MAX_CONTENT_REFERENCE_LENGTH = 512;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    enum VoteType {
        Against,
        For,
        Abstain
    }

    enum ProposalState {
        None,
        Pending,
        Active,
        Succeeded,
        Rejected,
        Expired,
        Executed
    }

    struct Proposal {
        address proposer;
        string contentReference;
        uint64 createdAt;
        uint64 startAt;
        uint64 deadline;
        uint64 executionDeadline;
        uint64 proposedMinimumRemainingValidity;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        bool finalized;
        bool approved;
        bool executed;
    }

    RobinhoodMainnetDemoCredentialRegistry public immutable credentialRegistry;
    uint64 public immutable votingPeriod;
    uint256 public immutable quorum;
    uint64 public immutable executionWindow;

    uint64 public minimumRemainingValidity;
    uint256 public nextProposalId = 1;
    mapping(uint256 proposalId => Proposal proposal) private proposals;
    mapping(uint256 proposalId => mapping(address voter => bool voted)) public hasVoted;
    mapping(address wallet => uint256 count) public protectedActionCount;

    error UnsupportedChain();
    error ZeroAddress();
    error UnconfiguredCredentialRegistry();
    error InvalidVotingPeriod();
    error InvalidQuorum();
    error InvalidExecutionWindow();
    error InvalidMinimumRemainingValidity();
    error InvalidContentReference();
    error InvalidProposal();
    error InvalidVoteType();
    error VotingNotStarted();
    error VotingClosed();
    error AlreadyVoted();
    error NotVerifiedMember(address wallet);
    error CredentialReadFailed();
    error AlreadyFinalized();
    error ProposalStillActive();
    error ProposalNotFinalized();
    error ProposalNotSucceeded();
    error UnauthorizedAction();
    error AccessPolicyRequiresLongerCredentialValidity(uint64 requiredSeconds);

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        uint64 startAt,
        uint64 deadline,
        uint64 executionDeadline,
        uint64 proposedMinimumRemainingValidity,
        string contentReference
    );
    event VoteCast(uint256 indexed proposalId, address indexed voter, VoteType voteType);
    event ProposalFinalized(
        uint256 indexed proposalId,
        bool approved,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 abstainVotes,
        uint256 quorum
    );
    event ProposalExecuted(uint256 indexed proposalId, uint64 minimumRemainingValidity);
    event MinimumRemainingValidityChanged(uint64 previousValue, uint64 newValue, uint256 indexed proposalId);
    event ProtectedActionPerformed(address indexed wallet, uint64 minimumRemainingValidity, uint256 actionCount);

    constructor(
        RobinhoodMainnetDemoCredentialRegistry credentialRegistry_,
        address admin_,
        address pauseAuthority_,
        uint64 votingPeriod_,
        uint256 quorum_,
        uint64 executionWindow_,
        uint64 initialMinimumRemainingValidity_
    ) {
        if (block.chainid != ROBINHOOD_MAINNET_CHAIN_ID) revert UnsupportedChain();
        if (
            address(credentialRegistry_) == address(0) || admin_ == address(0)
                || pauseAuthority_ == address(0) || admin_ == pauseAuthority_
        ) revert ZeroAddress();
        if (address(credentialRegistry_).code.length == 0) revert UnconfiguredCredentialRegistry();
        if (votingPeriod_ == 0 || votingPeriod_ > MAX_VOTING_PERIOD) revert InvalidVotingPeriod();
        if (quorum_ == 0) revert InvalidQuorum();
        if (executionWindow_ == 0 || executionWindow_ > MAX_EXECUTION_WINDOW) {
            revert InvalidExecutionWindow();
        }
        if (initialMinimumRemainingValidity_ > MAX_MINIMUM_REMAINING_VALIDITY) {
            revert InvalidMinimumRemainingValidity();
        }

        credentialRegistry = credentialRegistry_;
        votingPeriod = votingPeriod_;
        quorum = quorum_;
        executionWindow = executionWindow_;
        minimumRemainingValidity = initialMinimumRemainingValidity_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(PAUSER_ROLE, pauseAuthority_);
        _pause();
    }

    function demoOnly() external pure returns (bool) { return true; }

    /// @notice True only for a currently valid policy-4 record from a current registry issuer.
    function isVerifiedMember(address wallet) external view returns (bool) {
        return _isVerifiedMember(wallet);
    }

    function createProposal(string calldata contentReference, uint64 newMinimumRemainingValidity)
        external
        whenNotPaused
        returns (uint256 proposalId)
    {
        _requireVerifiedMember(msg.sender);
        if (bytes(contentReference).length == 0 || bytes(contentReference).length > MAX_CONTENT_REFERENCE_LENGTH) {
            revert InvalidContentReference();
        }
        _validateMinimumRemainingValidity(newMinimumRemainingValidity);

        uint64 createdAt = _timestamp();
        uint64 startAt = createdAt + 1 minutes;
        uint64 deadline = startAt + votingPeriod;
        uint64 executionDeadline = deadline + executionWindow;
        proposalId = nextProposalId++;

        proposals[proposalId] = Proposal({
            proposer: msg.sender,
            contentReference: contentReference,
            createdAt: createdAt,
            startAt: startAt,
            deadline: deadline,
            executionDeadline: executionDeadline,
            proposedMinimumRemainingValidity: newMinimumRemainingValidity,
            forVotes: 0,
            againstVotes: 0,
            abstainVotes: 0,
            finalized: false,
            approved: false,
            executed: false
        });

        emit ProposalCreated(
            proposalId,
            msg.sender,
            startAt,
            deadline,
            executionDeadline,
            newMinimumRemainingValidity,
            contentReference
        );
    }

    function castVote(uint256 proposalId, VoteType voteType) external whenNotPaused {
        Proposal storage proposal = _proposal(proposalId);
        if (block.timestamp < proposal.startAt) revert VotingNotStarted();
        if (block.timestamp >= proposal.deadline) revert VotingClosed();
        if (hasVoted[proposalId][msg.sender]) revert AlreadyVoted();
        _requireVerifiedMember(msg.sender);

        if (voteType == VoteType.For) proposal.forVotes += 1;
        else if (voteType == VoteType.Against) proposal.againstVotes += 1;
        else if (voteType == VoteType.Abstain) proposal.abstainVotes += 1;
        else revert InvalidVoteType();

        hasVoted[proposalId][msg.sender] = true;
        emit VoteCast(proposalId, msg.sender, voteType);
    }

    /// @dev Finalization is permissionless and remains available while paused.
    function finalizeProposal(uint256 proposalId) external {
        Proposal storage proposal = _proposal(proposalId);
        if (proposal.finalized) revert AlreadyFinalized();
        if (block.timestamp < proposal.deadline) revert ProposalStillActive();

        proposal.finalized = true;
        proposal.approved = _quorumReached(proposal) && proposal.forVotes > proposal.againstVotes;
        emit ProposalFinalized(
            proposalId,
            proposal.approved,
            proposal.forVotes,
            proposal.againstVotes,
            proposal.abstainVotes,
            quorum
        );
    }

    function executeProposal(uint256 proposalId) external whenNotPaused {
        Proposal storage proposal = _proposal(proposalId);
        if (!proposal.finalized) revert ProposalNotFinalized();
        if (proposalState(proposalId) != ProposalState.Succeeded) revert ProposalNotSucceeded();

        proposal.executed = true;
        (bool success,) = address(this).call(
            abi.encodeCall(this.applyGovernanceAction, (proposalId, proposal.proposedMinimumRemainingValidity))
        );
        if (!success) revert UnauthorizedAction();
        emit ProposalExecuted(proposalId, minimumRemainingValidity);
    }

    /// @dev The only action selector and callable only by this contract during execution.
    function applyGovernanceAction(uint256 proposalId, uint64 newMinimumRemainingValidity) external {
        if (msg.sender != address(this)) revert UnauthorizedAction();
        Proposal storage proposal = _proposal(proposalId);
        if (!proposal.executed || proposal.proposedMinimumRemainingValidity != newMinimumRemainingValidity) {
            revert UnauthorizedAction();
        }
        _validateMinimumRemainingValidity(newMinimumRemainingValidity);
        uint64 previousValue = minimumRemainingValidity;
        minimumRemainingValidity = newMinimumRemainingValidity;
        emit MinimumRemainingValidityChanged(previousValue, newMinimumRemainingValidity, proposalId);
    }

    function performProtectedAction() external whenNotPaused {
        _requireVerifiedMember(msg.sender);
        RobinhoodMainnetDemoCredentialRegistry.Credential memory credential = _credential(msg.sender);
        uint64 requiredValidity = minimumRemainingValidity;
        if (uint256(credential.expiresAt) - block.timestamp < requiredValidity) {
            revert AccessPolicyRequiresLongerCredentialValidity(requiredValidity);
        }

        uint256 actionCount = ++protectedActionCount[msg.sender];
        emit ProtectedActionPerformed(msg.sender, requiredValidity, actionCount);
    }

    function proposalState(uint256 proposalId) public view returns (ProposalState) {
        Proposal storage proposal = proposals[proposalId];
        if (proposal.proposer == address(0)) revert InvalidProposal();
        if (proposal.executed) return ProposalState.Executed;
        if (block.timestamp < proposal.startAt) return ProposalState.Pending;
        if (block.timestamp < proposal.deadline) return ProposalState.Active;

        bool approved = proposal.finalized
            ? proposal.approved
            : (_quorumReached(proposal) && proposal.forVotes > proposal.againstVotes);
        if (!approved) return ProposalState.Rejected;
        if (block.timestamp > proposal.executionDeadline) return ProposalState.Expired;
        return ProposalState.Succeeded;
    }

    function getProposal(uint256 proposalId) external view returns (Proposal memory proposal) {
        proposal = _proposal(proposalId);
    }

    function proposalVoteCounts(uint256 proposalId)
        external
        view
        returns (uint256 forVotes, uint256 againstVotes, uint256 abstainVotes)
    {
        Proposal storage proposal = _proposal(proposalId);
        return (proposal.forVotes, proposal.againstVotes, proposal.abstainVotes);
    }

    function proposalTiming(uint256 proposalId)
        external
        view
        returns (uint64 startAt, uint64 deadline, uint64 executionDeadline)
    {
        Proposal storage proposal = _proposal(proposalId);
        return (proposal.startAt, proposal.deadline, proposal.executionDeadline);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _requireVerifiedMember(address wallet) private view {
        if (!_isVerifiedMember(wallet)) revert NotVerifiedMember(wallet);
    }

    function _isVerifiedMember(address wallet) private view returns (bool) {
        if (wallet == address(0)) return false;
        RobinhoodMainnetDemoCredentialRegistry.Credential memory credential = _credential(wallet);
        if (
            credential.wallet != wallet || credential.commitment == bytes32(0) || credential.issuer == address(0)
                || credential.version == 0 || credential.issuedAt > block.timestamp
                || credential.expiresAt <= block.timestamp || credential.revoked
        ) return false;

        try credentialRegistry.hasRole(credentialRegistry.ISSUER_ROLE(), credential.issuer) returns (bool authorized) {
            return authorized;
        } catch {
            revert CredentialReadFailed();
        }
    }

    function _credential(address wallet)
        private
        view
        returns (RobinhoodMainnetDemoCredentialRegistry.Credential memory credential)
    {
        try credentialRegistry.getCredential(wallet, GOVERNANCE_CREDENTIAL_POLICY_ID) returns (
            RobinhoodMainnetDemoCredentialRegistry.Credential memory result
        ) {
            return result;
        } catch {
            revert CredentialReadFailed();
        }
    }

    function _quorumReached(Proposal storage proposal) private view returns (bool) {
        return proposal.forVotes + proposal.againstVotes + proposal.abstainVotes >= quorum;
    }

    function _validateMinimumRemainingValidity(uint64 value) private pure {
        if (value > MAX_MINIMUM_REMAINING_VALIDITY) revert InvalidMinimumRemainingValidity();
    }

    function _proposal(uint256 proposalId) private view returns (Proposal storage proposal) {
        proposal = proposals[proposalId];
        if (proposal.proposer == address(0)) revert InvalidProposal();
    }

    function _timestamp() private view returns (uint64) {
        if (block.timestamp > type(uint64).max) revert InvalidVotingPeriod();
        return uint64(block.timestamp);
    }
}
