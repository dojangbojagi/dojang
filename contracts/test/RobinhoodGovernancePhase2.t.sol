// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {RobinhoodDemoCredentialRegistry} from "../src/RobinhoodDemoCredentialRegistry.sol";
import {RobinhoodGovernancePhase2} from "../src/RobinhoodGovernancePhase2.sol";
import {RobinhoodLendingReputation} from "../src/RobinhoodLendingReputation.sol";
import {MockEligibilityVerifierV2} from "./mocks/MockEligibilityVerifierV2.sol";

interface VmRobinhoodGovernancePhase2 {
    function chainId(uint256 newChainId) external;
    function warp(uint256 timestamp) external;
    function roll(uint256 blockNumber) external;
    function etch(address target, bytes calldata code) external;
    function store(address target, bytes32 slot, bytes32 value) external;
    function prank(address sender) external;
    function expectRevert(bytes4 selector) external;
    function expectRevert(bytes calldata revertData) external;
}

contract LendingPoolCodeFixture {}

contract MockArbSys {
    uint256 public arbBlockNumber;
}

contract RobinhoodGovernancePhase2Test {
    VmRobinhoodGovernancePhase2 private constant vm =
        VmRobinhoodGovernancePhase2(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant START_TIME = 1_800_000_000;
    uint64 private constant COMMIT_PERIOD = 1 hours;
    uint64 private constant REVEAL_PERIOD = 1 hours;
    uint64 private constant EXECUTION_WINDOW = 7 days;
    uint256 private constant QUORUM = 2;
    uint256 private constant MINIMUM_REPUTATION = 3;
    address private constant ARB_SYS = address(100);
    address private constant MEMBER_ONE = address(0x1001);
    address private constant MEMBER_TWO = address(0x1002);
    address private constant L2_EVIDENCE_WALLET_A = address(0xA001);
    address private constant L2_EVIDENCE_WALLET_B = address(0xA002);
    address private constant UNVERIFIED = address(0x2001);

    RobinhoodDemoCredentialRegistry private credentialRegistry;
    RobinhoodLendingReputation private reputationRegistry;
    MockEligibilityVerifierV2 private verifier;
    RobinhoodGovernancePhase2 private governance;

    function setUp() public {
        vm.chainId(46_630);
        vm.warp(START_TIME);
        vm.roll(11_922_330);
        MockArbSys arbSys = new MockArbSys();
        vm.etch(ARB_SYS, address(arbSys).code);
        vm.store(ARB_SYS, bytes32(0), bytes32(uint256(1_000)));
        credentialRegistry = new RobinhoodDemoCredentialRegistry();
        credentialRegistry.grantRole(credentialRegistry.ISSUER_ROLE(), address(this));
        verifier = new MockEligibilityVerifierV2();
        reputationRegistry = new RobinhoodLendingReputation(
            address(new LendingPoolCodeFixture()), address(this), address(this), address(this)
        );
        reputationRegistry.unpause();
        governance = new RobinhoodGovernancePhase2(
            credentialRegistry,
            reputationRegistry,
            verifier,
            address(this),
            address(this),
            COMMIT_PERIOD,
            REVEAL_PERIOD,
            EXECUTION_WINDOW,
            QUORUM,
            MINIMUM_REPUTATION
        );
        governance.unpause();
        _issueMembership(MEMBER_ONE, bytes32(uint256(0x1111)));
        _issueMembership(MEMBER_TWO, bytes32(uint256(0x2222)));
        _register(MEMBER_ONE);
        _register(MEMBER_TWO);
    }

    function testRecordClaimAcceptsAuthenticL2RangesAboveL1OriginHeight() public {
        uint256 l1OriginBlock = 11_922_330;
        uint256 l2BlockNumber = 136_014_631;
        vm.roll(l1OriginBlock);
        vm.store(ARB_SYS, bytes32(0), bytes32(l2BlockNumber));
        require(block.number == l1OriginBlock, "fixture L1 height mismatch");
        require(MockArbSys(ARB_SYS).arbBlockNumber() == l2BlockNumber, "fixture L2 height mismatch");

        uint64 expiresAt = uint64(START_TIME + 10 days);
        reputationRegistry.recordClaim(
            L2_EVIDENCE_WALLET_A,
            bytes32(uint256(0xA1)),
            expiresAt,
            1,
            133_689_989,
            135_967_848,
            keccak256("wallet-a-l2-evidence")
        );
        reputationRegistry.recordClaim(
            L2_EVIDENCE_WALLET_B,
            bytes32(uint256(0xB1)),
            expiresAt,
            1,
            133_689_989,
            135_970_183,
            keccak256("wallet-b-l2-evidence")
        );

        RobinhoodLendingReputation.Claim memory claimA = reputationRegistry.getClaim(L2_EVIDENCE_WALLET_A);
        RobinhoodLendingReputation.Claim memory claimB = reputationRegistry.getClaim(L2_EVIDENCE_WALLET_B);
        require(claimA.observedFromBlock == 133_689_989 && claimA.observedToBlock == 135_967_848, "Wallet A L2 range changed");
        require(claimB.observedFromBlock == 133_689_989 && claimB.observedToBlock == 135_970_183, "Wallet B L2 range changed");
    }

    function testRecordClaimRequiresObservedToBlockBelowArbSysL2Height() public {
        uint256 l2BlockNumber = 136_014_631;
        vm.store(ARB_SYS, bytes32(0), bytes32(l2BlockNumber));
        vm.expectRevert(RobinhoodLendingReputation.InvalidBlockRange.selector);
        reputationRegistry.recordClaim(
            L2_EVIDENCE_WALLET_A,
            bytes32(uint256(0xA2)),
            uint64(START_TIME + 10 days),
            1,
            133_689_989,
            l2BlockNumber,
            keccak256("evidence-at-current-l2-height")
        );
    }

    function testPrivateReputationMembershipAndCommitRevealLifecycle() public {
        require(governance.isActiveMember(MEMBER_ONE), "proof-backed member not active");
        vm.prank(MEMBER_ONE);
        uint256 proposalId = governance.createProposal("ipfs://phase-2-policy", 4);
        RobinhoodGovernancePhase2.Proposal memory proposal = governance.getProposal(proposalId);
        vm.warp(proposal.startAt);

        bytes32 saltOne = bytes32(uint256(0xA1));
        bytes32 saltTwo = bytes32(uint256(0xA2));
        bytes32 sealedOne =
            governance.ballotCommitment(proposalId, MEMBER_ONE, RobinhoodGovernancePhase2.VoteType.For, saltOne);
        bytes32 sealedTwo =
            governance.ballotCommitment(proposalId, MEMBER_TWO, RobinhoodGovernancePhase2.VoteType.For, saltTwo);
        vm.prank(MEMBER_ONE);
        bytes32 nullifierOne = governance.commitVote(proposalId, sealedOne);
        vm.prank(MEMBER_TWO);
        governance.commitVote(proposalId, sealedTwo);

        (uint256 forVotes, uint256 againstVotes, uint256 abstainVotes, uint256 committedVotes) =
            governance.proposalVoteCounts(proposalId);
        require(forVotes == 0 && againstVotes == 0 && abstainVotes == 0, "choice leaked into tally before reveal");
        require(committedVotes == 2, "commit total mismatch");
        require(nullifierOne == governance.voteNullifier(proposalId, MEMBER_ONE), "nullifier not proposal scoped");

        vm.prank(MEMBER_ONE);
        vm.expectRevert(RobinhoodGovernancePhase2.DuplicateVote.selector);
        governance.commitVote(proposalId, sealedOne);

        vm.warp(proposal.commitDeadline);
        vm.prank(MEMBER_ONE);
        governance.revealVote(proposalId, RobinhoodGovernancePhase2.VoteType.For, saltOne);
        vm.prank(MEMBER_TWO);
        governance.revealVote(proposalId, RobinhoodGovernancePhase2.VoteType.For, saltTwo);

        vm.warp(proposal.revealDeadline);
        governance.finalizeProposal(proposalId);
        require(
            governance.proposalState(proposalId) == RobinhoodGovernancePhase2.ProposalState.Succeeded, "not succeeded"
        );
        governance.executeProposal(proposalId);
        require(governance.minimumReputation() == 4, "governed reputation threshold not applied");
        require(
            governance.proposalState(proposalId) == RobinhoodGovernancePhase2.ProposalState.Executed, "not executed"
        );
        require(!governance.isActiveMember(MEMBER_ONE), "old-threshold proof remained active");
        _issueNextMembership(MEMBER_ONE, bytes32(uint256(0x1112)));
        _register(MEMBER_ONE);
        require(governance.isActiveMember(MEMBER_ONE), "member could not re-prove at governed threshold");
    }

    function testWrongRevealAndCrossProposalReplayAreRejected() public {
        vm.prank(MEMBER_ONE);
        uint256 proposalOne = governance.createProposal("ipfs://one", 4);
        vm.prank(MEMBER_ONE);
        uint256 proposalTwo = governance.createProposal("ipfs://two", 4);
        RobinhoodGovernancePhase2.Proposal memory first = governance.getProposal(proposalOne);
        vm.warp(first.startAt);
        bytes32 salt = bytes32(uint256(0xB1));
        bytes32 commitment =
            governance.ballotCommitment(proposalOne, MEMBER_ONE, RobinhoodGovernancePhase2.VoteType.For, salt);
        vm.prank(MEMBER_ONE);
        governance.commitVote(proposalOne, commitment);
        require(
            governance.voteNullifier(proposalOne, MEMBER_ONE) != governance.voteNullifier(proposalTwo, MEMBER_ONE),
            "nullifier reused across proposals"
        );
        vm.warp(first.commitDeadline);
        vm.prank(MEMBER_ONE);
        vm.expectRevert(RobinhoodGovernancePhase2.InvalidBallotReveal.selector);
        governance.revealVote(proposalOne, RobinhoodGovernancePhase2.VoteType.Against, salt);
    }

    function testCredentialRevocationAndClaimRevocationFailClosed() public {
        credentialRegistry.revokeCredential(MEMBER_ONE, 5);
        require(!governance.isActiveMember(MEMBER_ONE), "revoked credential remained active");
        vm.prank(MEMBER_ONE);
        vm.expectRevert(abi.encodeWithSelector(RobinhoodGovernancePhase2.NotActiveMember.selector, MEMBER_ONE));
        governance.createProposal("ipfs://revoked", 3);

        reputationRegistry.revokeClaim(MEMBER_TWO);
        require(!governance.isActiveMember(MEMBER_TWO), "revoked reputation remained active");
    }

    function testInvalidProofAndMismatchedReputationAreRejected() public {
        _issueMembership(UNVERIFIED, bytes32(uint256(0x3333)));
        uint256[9] memory inputs = _proofInputs(UNVERIFIED);
        vm.prank(UNVERIFIED);
        vm.expectRevert(RobinhoodGovernancePhase2.InvalidProof.selector);
        governance.registerMembership(hex"00", inputs);

        address mismatch = address(0x3001);
        bytes32 credentialCommitment = bytes32(uint256(0x4444));
        bytes32 claimCommitment = bytes32(uint256(0x5555));
        credentialRegistry.recordCredential(mismatch, 5, credentialCommitment, uint64(START_TIME + 10 days), 1);
        reputationRegistry.recordClaim(
            mismatch, claimCommitment, uint64(START_TIME + 10 days), 1, 900, 999, keccak256("mismatch")
        );
        uint256[9] memory mismatchInputs = _proofInputs(mismatch);
        mismatchInputs[1] = uint256(credentialCommitment);
        vm.prank(mismatch);
        vm.expectRevert(RobinhoodGovernancePhase2.ReputationMismatch.selector);
        governance.registerMembership(hex"42", mismatchInputs);
    }

    function testPauseBlocksRiskIncreasingActionsButNotRevealOrFinalize() public {
        vm.prank(MEMBER_ONE);
        uint256 proposalId = governance.createProposal("ipfs://pause", 3);
        RobinhoodGovernancePhase2.Proposal memory proposal = governance.getProposal(proposalId);
        vm.warp(proposal.startAt);
        bytes32 salt = bytes32(uint256(0xC1));
        bytes32 commitment =
            governance.ballotCommitment(proposalId, MEMBER_ONE, RobinhoodGovernancePhase2.VoteType.For, salt);
        vm.prank(MEMBER_ONE);
        governance.commitVote(proposalId, commitment);
        governance.pause();
        vm.warp(proposal.commitDeadline);
        vm.prank(MEMBER_ONE);
        governance.revealVote(proposalId, RobinhoodGovernancePhase2.VoteType.For, salt);
        vm.warp(proposal.revealDeadline);
        governance.finalizeProposal(proposalId);
    }

    function testWrongChainDeploymentIsRejected() public {
        vm.chainId(1);
        vm.expectRevert(RobinhoodGovernancePhase2.UnsupportedChain.selector);
        new RobinhoodGovernancePhase2(
            credentialRegistry,
            reputationRegistry,
            verifier,
            address(this),
            address(this),
            COMMIT_PERIOD,
            REVEAL_PERIOD,
            EXECUTION_WINDOW,
            QUORUM,
            MINIMUM_REPUTATION
        );
    }

    function _issueMembership(address wallet, bytes32 commitment) private {
        uint64 expiresAt = uint64(START_TIME + 10 days);
        credentialRegistry.recordCredential(wallet, 5, commitment, expiresAt, 1);
        reputationRegistry.recordClaim(wallet, commitment, expiresAt, 1, 900, 999, keccak256(abi.encode(wallet)));
    }

    function _register(address wallet) private {
        uint256[9] memory inputs = _proofInputs(wallet);
        vm.prank(wallet);
        governance.registerMembership(hex"42", inputs);
    }

    function _issueNextMembership(address wallet, bytes32 commitment) private {
        uint64 expiresAt = uint64(START_TIME + 10 days);
        RobinhoodDemoCredentialRegistry.Credential memory previous = credentialRegistry.getCredential(wallet, 5);
        uint64 version = previous.version + 1;
        credentialRegistry.recordCredential(wallet, 5, commitment, expiresAt, version);
        reputationRegistry.recordClaim(
            wallet, commitment, expiresAt, version, 900, 999, keccak256(abi.encode(wallet, version))
        );
    }

    function _proofInputs(address wallet) private view returns (uint256[9] memory inputs) {
        RobinhoodDemoCredentialRegistry.Credential memory credential = credentialRegistry.getCredential(wallet, 5);
        inputs = [
            uint256(uint160(wallet)),
            uint256(credential.commitment),
            uint256(5),
            uint256(1),
            governance.minimumReputation(),
            uint256(credential.version),
            uint256(credential.expiresAt),
            uint256(46_630),
            uint256(uint160(address(governance)))
        ];
    }
}
