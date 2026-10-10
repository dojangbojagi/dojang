// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {GovernedDojangAccess} from "../src/GovernedDojangAccess.sol";
import {
    IDojangAttesterBook,
    IDojangScroll,
    IEASDojang
} from "../src/interfaces/IDojangVerification.sol";

interface VmGovernance {
    function chainId(uint256 newChainId) external;
    function warp(uint256 timestamp) external;
    function prank(address sender) external;
    function expectRevert(bytes4 selector) external;
    function expectRevert(bytes calldata revertData) external;
}

/// @dev These fixtures emulate only the documented Dojang/EAS read interface for local tests.
/// They are not production trust sources and are never used by the Sepolia deployment script.
contract DojangScrollFixture is IDojangScroll {
    mapping(address wallet => bytes32 uid) private attestationUids;
    mapping(address wallet => bool verified) private verifiedWallets;

    function setCredential(address wallet, bytes32 uid, bool verified) external {
        attestationUids[wallet] = uid;
        verifiedWallets[wallet] = verified;
    }

    function isVerified(address wallet, bytes32) external view returns (bool) {
        return verifiedWallets[wallet];
    }

    function getVerifiedAddressAttestationUid(address wallet, bytes32) external view returns (bytes32) {
        return attestationUids[wallet];
    }
}

contract DojangAttesterBookFixture is IDojangAttesterBook {
    mapping(bytes32 attesterId => address attester) private attesters;

    function setAttester(bytes32 attesterId, address attester) external {
        attesters[attesterId] = attester;
    }

    function getAttester(bytes32 attesterId) external view returns (address) {
        return attesters[attesterId];
    }
}

contract EASDojangFixture is IEASDojang {
    mapping(bytes32 uid => Attestation attestation) private attestations;

    function setVerifiedAddress(
        address wallet,
        bytes32 uid,
        bytes32 schema,
        uint64 issuedAt,
        uint64 expirationTime,
        address attester,
        bool isVerified
    ) external {
        attestations[uid] = Attestation({
            uid: uid,
            schema: schema,
            time: issuedAt,
            expirationTime: expirationTime,
            revocationTime: 0,
            refUID: bytes32(0),
            recipient: wallet,
            attester: attester,
            revocable: true,
            data: abi.encode(isVerified)
        });
    }

    function setAttestation(bytes32 uid, Attestation calldata attestation) external {
        attestations[uid] = attestation;
    }

    function getAttestation(bytes32 uid) external view returns (Attestation memory) {
        return attestations[uid];
    }

    function isAttestationValid(bytes32 uid) external view returns (bool) {
        Attestation storage attestation = attestations[uid];
        return attestation.uid == uid && attestation.revocationTime == 0
            && (attestation.expirationTime == 0 || attestation.expirationTime > block.timestamp);
    }
}

contract GovernanceTest {
    VmGovernance private constant vm = VmGovernance(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant START_TIME = 1_800_000_000;
    uint64 private constant CREDENTIAL_EXPIRY = uint64(START_TIME + 5 days);
    uint64 private constant VOTING_PERIOD = 1 hours;
    uint64 private constant EXECUTION_WINDOW = 7 days;
    uint256 private constant QUORUM = 2;
    address private constant PROPOSER = address(0x1001);
    address private constant VOTER_TWO = address(0x1002);
    address private constant UNVERIFIED = address(0x2001);
    address private constant TRUSTED_ATTESTER = address(0xA77E57E2);
    bytes32 private constant ATTESTER_ID =
        0xd99b42e778498aa3c9c1f6a012359130252780511687a35982e8e52735453034;
    bytes32 private constant VERIFIED_ADDRESS_SCHEMA_UID =
        0x072d75e18b2be4f89a13a7147240477481c4b526d5795802acba59046b426e08;

    DojangScrollFixture private dojangScroll;
    DojangAttesterBookFixture private attesterBook;
    EASDojangFixture private eas;
    GovernedDojangAccess private governance;

    function setUp() public {
        vm.chainId(91_342);
        vm.warp(START_TIME);

        dojangScroll = new DojangScrollFixture();
        attesterBook = new DojangAttesterBookFixture();
        eas = new EASDojangFixture();
        attesterBook.setAttester(ATTESTER_ID, TRUSTED_ATTESTER);

        governance = new GovernedDojangAccess(
            IDojangScroll(address(dojangScroll)),
            IDojangAttesterBook(address(attesterBook)),
            IEASDojang(address(eas)),
            ATTESTER_ID,
            VERIFIED_ADDRESS_SCHEMA_UID,
            VOTING_PERIOD,
            QUORUM,
            EXECUTION_WINDOW,
            0
        );

        _configureMember(PROPOSER, CREDENTIAL_EXPIRY);
        _configureMember(VOTER_TWO, CREDENTIAL_EXPIRY);
    }

    function testVerifiedWalletCanCreateProposal() public {
        vm.prank(PROPOSER);
        uint256 proposalId = governance.createProposal("ipfs://policy-change", 2 days);

        GovernedDojangAccess.Proposal memory proposal = governance.getProposal(proposalId);
        require(proposal.proposer == PROPOSER, "wrong proposer");
        require(
            keccak256(bytes(proposal.contentReference)) == keccak256(bytes("ipfs://policy-change")),
            "wrong reference"
        );
        require(proposal.proposedMinimumRemainingValidity == 2 days, "wrong action value");
        require(governance.proposalState(proposalId) == GovernedDojangAccess.ProposalState.Pending, "not pending");
    }

    function testUnverifiedWalletCannotCreateOrVote() public {
        vm.prank(UNVERIFIED);
        vm.expectRevert(abi.encodeWithSelector(GovernedDojangAccess.NotVerifiedMember.selector, UNVERIFIED));
        governance.createProposal("ipfs://unauthorized", 1 days);

        uint256 proposalId = _createProposal(1 days);
        (uint64 startAt,,) = governance.proposalTiming(proposalId);
        vm.warp(startAt);
        vm.prank(UNVERIFIED);
        vm.expectRevert(abi.encodeWithSelector(GovernedDojangAccess.NotVerifiedMember.selector, UNVERIFIED));
        governance.castVote(proposalId, GovernedDojangAccess.VoteType.For);
    }

    function testVotingBeforeStartIsRejected() public {
        uint256 proposalId = _createProposal(1 days);
        vm.prank(PROPOSER);
        vm.expectRevert(GovernedDojangAccess.VotingNotStarted.selector);
        governance.castVote(proposalId, GovernedDojangAccess.VoteType.For);
    }

    function testDuplicateVoteIsRejected() public {
        uint256 proposalId = _createProposal(1 days);
        uint64 startAt = _startAt(proposalId);
        vm.warp(startAt);

        vm.prank(PROPOSER);
        governance.castVote(proposalId, GovernedDojangAccess.VoteType.For);
        vm.prank(PROPOSER);
        vm.expectRevert(GovernedDojangAccess.AlreadyVoted.selector);
        governance.castVote(proposalId, GovernedDojangAccess.VoteType.Abstain);
    }

    function testDojangRevocationBetweenProposalAndVoteRemovesEligibility() public {
        uint256 proposalId = _createProposal(1 days);
        bytes32 uid = _uid(PROPOSER);
        dojangScroll.setCredential(PROPOSER, uid, false);
        vm.warp(_startAt(proposalId));

        vm.prank(PROPOSER);
        vm.expectRevert(abi.encodeWithSelector(GovernedDojangAccess.NotVerifiedMember.selector, PROPOSER));
        governance.castVote(proposalId, GovernedDojangAccess.VoteType.For);
    }

    function testEASRevocationAndExpirationRemoveEligibility() public {
        uint256 proposalId = _createProposal(1 days);
        bytes32 uid = _uid(PROPOSER);
        IEASDojang.Attestation memory attestation = eas.getAttestation(uid);
        attestation.revocationTime = uint64(block.timestamp + 1);
        eas.setAttestation(uid, attestation);
        require(!governance.isVerifiedMember(PROPOSER), "revoked credential still verified");

        vm.warp(CREDENTIAL_EXPIRY);
        require(!governance.isVerifiedMember(VOTER_TWO), "expired credential still verified");
        require(governance.proposalState(proposalId) == GovernedDojangAccess.ProposalState.Rejected, "proposal outcome changed");
    }

    function testMalformedOfficialAttestationDoesNotGrantMembership() public {
        uint256 proposalId = _createProposal(1 days);
        bytes32 uid = _uid(PROPOSER);
        IEASDojang.Attestation memory attestation = eas.getAttestation(uid);
        attestation.schema = keccak256("untrusted schema");
        eas.setAttestation(uid, attestation);
        require(!governance.isVerifiedMember(PROPOSER), "wrong schema accepted");

        vm.warp(_startAt(proposalId));
        vm.prank(PROPOSER);
        vm.expectRevert(abi.encodeWithSelector(GovernedDojangAccess.NotVerifiedMember.selector, PROPOSER));
        governance.castVote(proposalId, GovernedDojangAccess.VoteType.For);
    }

    function testInsufficientQuorumRejectsProposal() public {
        uint256 proposalId = _createProposal(1 days);
        vm.warp(_startAt(proposalId));
        vm.prank(PROPOSER);
        governance.castVote(proposalId, GovernedDojangAccess.VoteType.For);
        vm.warp(_deadline(proposalId));
        governance.finalizeProposal(proposalId);

        require(governance.proposalState(proposalId) == GovernedDojangAccess.ProposalState.Rejected, "not rejected");
        vm.expectRevert(GovernedDojangAccess.ProposalNotSucceeded.selector);
        governance.executeProposal(proposalId);
    }

    function testAgainstMajorityRejectsProposal() public {
        uint256 proposalId = _createProposal(1 days);
        vm.warp(_startAt(proposalId));
        vm.prank(PROPOSER);
        governance.castVote(proposalId, GovernedDojangAccess.VoteType.Against);
        vm.prank(VOTER_TWO);
        governance.castVote(proposalId, GovernedDojangAccess.VoteType.Abstain);
        vm.warp(_deadline(proposalId));
        governance.finalizeProposal(proposalId);

        require(governance.proposalState(proposalId) == GovernedDojangAccess.ProposalState.Rejected, "not rejected");
    }

    function testVotingAfterDeadlineIsRejected() public {
        uint256 proposalId = _createProposal(1 days);
        vm.warp(_deadline(proposalId));
        vm.prank(PROPOSER);
        vm.expectRevert(GovernedDojangAccess.VotingClosed.selector);
        governance.castVote(proposalId, GovernedDojangAccess.VoteType.For);
    }

    function testFinalizeCannotRunBeforeDeadlineOrTwice() public {
        uint256 proposalId = _createProposal(1 days);
        vm.expectRevert(GovernedDojangAccess.ProposalStillActive.selector);
        governance.finalizeProposal(proposalId);

        vm.warp(_deadline(proposalId));
        governance.finalizeProposal(proposalId);
        vm.expectRevert(GovernedDojangAccess.AlreadyFinalized.selector);
        governance.finalizeProposal(proposalId);
    }

    function testSuccessfulProposalChangesConsumedProtectedAccessPolicy() public {
        vm.prank(PROPOSER);
        governance.performProtectedAction();
        require(governance.protectedActionCount(PROPOSER) == 1, "initial protected action failed");

        uint256 proposalId = _createProposal(7 days);
        _castForVotes(proposalId);
        vm.warp(_deadline(proposalId));
        governance.finalizeProposal(proposalId);
        require(governance.proposalState(proposalId) == GovernedDojangAccess.ProposalState.Succeeded, "not succeeded");

        governance.executeProposal(proposalId);
        require(governance.minimumRemainingValidity() == 7 days, "policy was not updated");
        require(governance.proposalState(proposalId) == GovernedDojangAccess.ProposalState.Executed, "not executed");

        vm.prank(PROPOSER);
        vm.expectRevert(
            abi.encodeWithSelector(
                GovernedDojangAccess.AccessPolicyRequiresLongerCredentialValidity.selector,
                uint64(7 days)
            )
        );
        governance.performProtectedAction();
        require(governance.protectedActionCount(PROPOSER) == 1, "blocked action mutated state");
    }

    function testUnauthorizedAndIncorrectActionCallsAreRejected() public {
        vm.expectRevert(GovernedDojangAccess.UnauthorizedAction.selector);
        governance.applyGovernanceAction(1, 1 days);

        uint64 invalidValue = governance.MAX_MINIMUM_REMAINING_VALIDITY() + 1;
        vm.prank(PROPOSER);
        vm.expectRevert(GovernedDojangAccess.InvalidMinimumRemainingValidity.selector);
        governance.createProposal("ipfs://invalid-policy", invalidValue);
    }

    function testExecutionBeforeFinalizationAndRepeatedExecutionAreRejected() public {
        uint256 proposalId = _createProposal(1 days);
        _castForVotes(proposalId);
        vm.warp(_deadline(proposalId));

        vm.expectRevert(GovernedDojangAccess.ProposalNotFinalized.selector);
        governance.executeProposal(proposalId);
        governance.finalizeProposal(proposalId);
        governance.executeProposal(proposalId);
        vm.expectRevert(GovernedDojangAccess.ProposalNotSucceeded.selector);
        governance.executeProposal(proposalId);
    }

    function testSuccessfulProposalExpiresAfterExecutionWindow() public {
        uint256 proposalId = _createProposal(1 days);
        _castForVotes(proposalId);
        vm.warp(_deadline(proposalId));
        governance.finalizeProposal(proposalId);
        vm.warp(_executionDeadline(proposalId) + 1);

        require(governance.proposalState(proposalId) == GovernedDojangAccess.ProposalState.Expired, "not expired");
        vm.expectRevert(GovernedDojangAccess.ProposalNotSucceeded.selector);
        governance.executeProposal(proposalId);
    }

    function testInvalidProposalIdIsRejected() public {
        vm.expectRevert(GovernedDojangAccess.InvalidProposal.selector);
        governance.proposalState(777);
        vm.expectRevert(GovernedDojangAccess.InvalidProposal.selector);
        governance.finalizeProposal(777);
    }

    function _createProposal(uint64 value) private returns (uint256 proposalId) {
        vm.prank(PROPOSER);
        proposalId = governance.createProposal("ipfs://governed-policy", value);
    }

    function _castForVotes(uint256 proposalId) private {
        vm.warp(_startAt(proposalId));
        vm.prank(PROPOSER);
        governance.castVote(proposalId, GovernedDojangAccess.VoteType.For);
        vm.prank(VOTER_TWO);
        governance.castVote(proposalId, GovernedDojangAccess.VoteType.For);
    }

    function _startAt(uint256 proposalId) private view returns (uint64 startAt) {
        (startAt,,) = governance.proposalTiming(proposalId);
    }

    function _deadline(uint256 proposalId) private view returns (uint64 deadline) {
        (, deadline,) = governance.proposalTiming(proposalId);
    }

    function _executionDeadline(uint256 proposalId) private view returns (uint64 executionDeadline) {
        (,, executionDeadline) = governance.proposalTiming(proposalId);
    }

    function _configureMember(address wallet, uint64 expirationTime) private {
        bytes32 uid = _uid(wallet);
        dojangScroll.setCredential(wallet, uid, true);
        eas.setAttestation(
            uid,
            IEASDojang.Attestation({
                uid: uid,
                schema: VERIFIED_ADDRESS_SCHEMA_UID,
                time: uint64(START_TIME - 1 days),
                expirationTime: expirationTime,
                revocationTime: 0,
                refUID: bytes32(0),
                recipient: wallet,
                attester: TRUSTED_ATTESTER,
                revocable: true,
                data: abi.encode(true)
            })
        );
    }

    function _uid(address wallet) private pure returns (bytes32) {
        return keccak256(abi.encode(wallet));
    }
}
