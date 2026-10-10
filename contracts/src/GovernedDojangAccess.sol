// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {
    IDojangAttesterBook,
    IDojangScroll,
    IEASDojang
} from "./interfaces/IDojangVerification.sol";

/// @notice Dojang-gated governance for one bounded, protocol-owned access policy.
/// @dev This contract has no treasury, token voting, proxy, owner, or arbitrary-call facility.
contract GovernedDojangAccess {
    uint256 public constant GIWA_SEPOLIA_CHAIN_ID = 91_342;
    uint64 public constant MAX_VOTING_PERIOD = 30 days;
    uint64 public constant MAX_EXECUTION_WINDOW = 90 days;
    uint64 public constant MAX_MINIMUM_REMAINING_VALIDITY = 365 days;
    uint256 public constant MAX_CONTENT_REFERENCE_LENGTH = 512;

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

    IDojangScroll public immutable dojangScroll;
    IDojangAttesterBook public immutable attesterBook;
    IEASDojang public immutable eas;
    bytes32 public immutable dojangAttesterId;
    bytes32 public immutable verifiedAddressSchemaUid;
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
    error UnconfiguredDojang();
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
    error DojangReadFailed();
    error InvalidDojangAttestation();
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
        IDojangScroll dojangScroll_,
        IDojangAttesterBook attesterBook_,
        IEASDojang eas_,
        bytes32 dojangAttesterId_,
        bytes32 verifiedAddressSchemaUid_,
        uint64 votingPeriod_,
        uint256 quorum_,
        uint64 executionWindow_,
        uint64 initialMinimumRemainingValidity_
    ) {
        if (block.chainid != GIWA_SEPOLIA_CHAIN_ID) revert UnsupportedChain();
        if (
            address(dojangScroll_) == address(0) || address(attesterBook_) == address(0)
                || address(eas_) == address(0)
        ) revert ZeroAddress();
        if (
            address(dojangScroll_).code.length == 0 || address(attesterBook_).code.length == 0
                || address(eas_).code.length == 0 || dojangAttesterId_ == bytes32(0)
                || verifiedAddressSchemaUid_ == bytes32(0)
        ) revert UnconfiguredDojang();
        if (votingPeriod_ == 0 || votingPeriod_ > MAX_VOTING_PERIOD) revert InvalidVotingPeriod();
        if (quorum_ == 0) revert InvalidQuorum();
        if (executionWindow_ == 0 || executionWindow_ > MAX_EXECUTION_WINDOW) {
            revert InvalidExecutionWindow();
        }
        if (initialMinimumRemainingValidity_ > MAX_MINIMUM_REMAINING_VALIDITY) {
            revert InvalidMinimumRemainingValidity();
        }

        dojangScroll = dojangScroll_;
        attesterBook = attesterBook_;
        eas = eas_;
        dojangAttesterId = dojangAttesterId_;
        verifiedAddressSchemaUid = verifiedAddressSchemaUid_;
        votingPeriod = votingPeriod_;
        quorum = quorum_;
        executionWindow = executionWindow_;
        minimumRemainingValidity = initialMinimumRemainingValidity_;
    }

    /// @notice Read-only membership check against the configured Dojang attester and EAS record.
    function isVerifiedMember(address wallet) external view returns (bool) {
        return _isVerifiedDojangAddress(wallet);
    }

    /// @notice Creates a proposal for the only supported action: update this access policy.
    /// @dev Membership is checked when proposing and checked again for every vote.
    function createProposal(string calldata contentReference, uint64 newMinimumRemainingValidity)
        external
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

    /// @notice Records one wallet's current Dojang-verified vote on a proposal.
    function castVote(uint256 proposalId, VoteType voteType) external {
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

    /// @notice Stores the outcome after the voting deadline. Anyone may finalize.
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

    /// @notice Executes only the encoded minimum-credential-validity update.
    function executeProposal(uint256 proposalId) external {
        Proposal storage proposal = _proposal(proposalId);
        if (!proposal.finalized) revert ProposalNotFinalized();
        if (proposalState(proposalId) != ProposalState.Succeeded) revert ProposalNotSucceeded();

        proposal.executed = true;
        (bool success,) = address(this).call(
            abi.encodeCall(
                this.applyGovernanceAction,
                (proposalId, proposal.proposedMinimumRemainingValidity)
            )
        );
        if (!success) revert UnauthorizedAction();

        emit ProposalExecuted(proposalId, minimumRemainingValidity);
    }

    /// @dev This is the single allowlisted action selector and can only be called by this contract.
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

    /// @notice Example protected protocol operation that consumes the governed Dojang policy.
    function performProtectedAction() external {
        _requireVerifiedMember(msg.sender);
        IEASDojang.Attestation memory attestation = _verifiedAttestation(msg.sender);
        uint64 requiredValidity = minimumRemainingValidity;
        if (
            attestation.expirationTime != 0
                && uint256(attestation.expirationTime) - block.timestamp < requiredValidity
        ) {
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

    function _requireVerifiedMember(address wallet) private view {
        if (!_isVerifiedDojangAddress(wallet)) revert NotVerifiedMember(wallet);
    }

    function _isVerifiedDojangAddress(address wallet) private view returns (bool) {
        if (wallet == address(0)) return false;

        bool verified;
        try dojangScroll.isVerified(wallet, dojangAttesterId) returns (bool result) {
            verified = result;
        } catch {
            revert DojangReadFailed();
        }
        if (!verified) return false;

        bytes32 uid;
        try dojangScroll.getVerifiedAddressAttestationUid(wallet, dojangAttesterId) returns (bytes32 result) {
            uid = result;
        } catch {
            revert DojangReadFailed();
        }
        if (uid == bytes32(0)) return false;

        IEASDojang.Attestation memory attestation = _readAttestation(uid);
        if (!_matchesOfficialAttestation(wallet, uid, attestation)) revert InvalidDojangAttestation();

        bool valid;
        try eas.isAttestationValid(uid) returns (bool result) {
            valid = result;
        } catch {
            revert DojangReadFailed();
        }
        if (!valid || attestation.revocationTime != 0) return false;
        if (attestation.time > block.timestamp) return false;
        if (attestation.expirationTime != 0 && attestation.expirationTime <= block.timestamp) return false;
        if (!_verifiedAddressData(attestation.data)) revert InvalidDojangAttestation();
        return true;
    }

    function _verifiedAttestation(address wallet) private view returns (IEASDojang.Attestation memory attestation) {
        bytes32 uid;
        try dojangScroll.getVerifiedAddressAttestationUid(wallet, dojangAttesterId) returns (bytes32 result) {
            uid = result;
        } catch {
            revert DojangReadFailed();
        }
        attestation = _readAttestation(uid);
    }

    function _readAttestation(bytes32 uid) private view returns (IEASDojang.Attestation memory attestation) {
        try eas.getAttestation(uid) returns (IEASDojang.Attestation memory result) {
            attestation = result;
        } catch {
            revert DojangReadFailed();
        }
    }

    function _matchesOfficialAttestation(address wallet, bytes32 uid, IEASDojang.Attestation memory attestation)
        private
        view
        returns (bool)
    {
        if (
            attestation.uid != uid || attestation.schema != verifiedAddressSchemaUid
                || attestation.recipient != wallet
        ) return false;

        address trustedAttester;
        try attesterBook.getAttester(dojangAttesterId) returns (address result) {
            trustedAttester = result;
        } catch {
            revert DojangReadFailed();
        }
        return trustedAttester != address(0) && attestation.attester == trustedAttester;
    }

    function _verifiedAddressData(bytes memory data) private pure returns (bool) {
        if (data.length != 32) return false;
        uint256 encodedValue;
        assembly ("memory-safe") {
            encodedValue := mload(add(data, 0x20))
        }
        return encodedValue == 1;
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
