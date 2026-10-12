// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {RobinhoodDemoCredentialRegistry} from "../src/RobinhoodDemoCredentialRegistry.sol";
import {RobinhoodGovernancePhase1} from "../src/RobinhoodGovernancePhase1.sol";

interface VmRobinhoodGovernance {
    function chainId(uint256 newChainId) external;
    function warp(uint256 timestamp) external;
    function prank(address sender) external;
    function expectRevert(bytes4 selector) external;
    function expectRevert(bytes calldata revertData) external;
}

contract RobinhoodGovernancePhase1Test {
    VmRobinhoodGovernance private constant vm =
        VmRobinhoodGovernance(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant START_TIME = 1_800_000_000;
    uint64 private constant VOTING_PERIOD = 1 hours;
    uint64 private constant EXECUTION_WINDOW = 7 days;
    uint256 private constant QUORUM = 2;
    address private constant MEMBER_ONE = address(0x1001);
    address private constant MEMBER_TWO = address(0x1002);
    address private constant UNVERIFIED = address(0x2001);

    RobinhoodDemoCredentialRegistry private registry;
    RobinhoodGovernancePhase1 private governance;

    function setUp() public {
        vm.chainId(46_630);
        vm.warp(START_TIME);
        registry = new RobinhoodDemoCredentialRegistry();
        registry.grantRole(registry.ISSUER_ROLE(), address(this));
        governance = new RobinhoodGovernancePhase1(registry, address(this), VOTING_PERIOD, QUORUM, EXECUTION_WINDOW, 0);
        _issue(MEMBER_ONE, 4, uint64(START_TIME + 10 days));
        _issue(MEMBER_TWO, 4, uint64(START_TIME + 10 days));
    }

    function testProjectCredentialCanCompleteBoundedGovernanceLifecycle() public {
        vm.prank(MEMBER_ONE);
        uint256 proposalId = governance.createProposal("ipfs://robinhood-policy", 2 days);
        (uint64 startAt, uint64 deadline,) = governance.proposalTiming(proposalId);
        require(governance.proposalState(proposalId) == RobinhoodGovernancePhase1.ProposalState.Pending, "not pending");

        vm.warp(startAt);
        vm.prank(MEMBER_ONE);
        governance.castVote(proposalId, RobinhoodGovernancePhase1.VoteType.For);
        vm.prank(MEMBER_TWO);
        governance.castVote(proposalId, RobinhoodGovernancePhase1.VoteType.For);
        (uint256 forVotes, uint256 againstVotes, uint256 abstainVotes) = governance.proposalVoteCounts(proposalId);
        require(forVotes == 2 && againstVotes == 0 && abstainVotes == 0, "vote totals mismatch");

        vm.warp(deadline);
        governance.finalizeProposal(proposalId);
        require(governance.proposalState(proposalId) == RobinhoodGovernancePhase1.ProposalState.Succeeded, "not succeeded");
        governance.executeProposal(proposalId);

        RobinhoodGovernancePhase1.Proposal memory proposal = governance.getProposal(proposalId);
        require(proposal.finalized && proposal.approved && proposal.executed, "proposal lifecycle flags mismatch");
        require(governance.minimumRemainingValidity() == 2 days, "bounded policy not applied");
        require(governance.proposalState(proposalId) == RobinhoodGovernancePhase1.ProposalState.Executed, "not executed");
    }

    function testLendingPolicyThreeDoesNotGrantGovernanceMembership() public {
        _issue(UNVERIFIED, 3, uint64(START_TIME + 10 days));
        require(!governance.isVerifiedMember(UNVERIFIED), "Lending policy granted governance membership");

        vm.prank(UNVERIFIED);
        vm.expectRevert(abi.encodeWithSelector(RobinhoodGovernancePhase1.NotVerifiedMember.selector, UNVERIFIED));
        governance.createProposal("ipfs://wrong-domain", 1 days);
    }

    function testRevokedExpiredAndUnauthorizedIssuerCredentialsAreRejected() public {
        _issue(UNVERIFIED, 4, uint64(START_TIME + 10 days));
        registry.revokeCredential(UNVERIFIED, 4);
        require(!governance.isVerifiedMember(UNVERIFIED), "revoked credential remained eligible");

        _issue(UNVERIFIED, 4, uint64(START_TIME + 1 days));
        vm.warp(START_TIME + 1 days);
        require(!governance.isVerifiedMember(UNVERIFIED), "expired credential remained eligible");

        _issue(UNVERIFIED, 4, uint64(START_TIME + 10 days));
        registry.revokeRole(registry.ISSUER_ROLE(), address(this));
        require(!governance.isVerifiedMember(UNVERIFIED), "credential from revoked issuer remained eligible");
    }

    function testDuplicateVoteAndPauseControlsAreEnforced() public {
        vm.prank(MEMBER_ONE);
        uint256 proposalId = governance.createProposal("ipfs://one-vote", 1 days);
        (uint64 startAt,,) = governance.proposalTiming(proposalId);
        vm.warp(startAt);
        vm.prank(MEMBER_ONE);
        governance.castVote(proposalId, RobinhoodGovernancePhase1.VoteType.For);
        vm.prank(MEMBER_ONE);
        vm.expectRevert(RobinhoodGovernancePhase1.AlreadyVoted.selector);
        governance.castVote(proposalId, RobinhoodGovernancePhase1.VoteType.Against);

        governance.pause();
        vm.prank(MEMBER_TWO);
        vm.expectRevert(bytes4(keccak256("EnforcedPause()")));
        governance.castVote(proposalId, RobinhoodGovernancePhase1.VoteType.For);
        governance.unpause();
    }

    function testWrongChainAndDirectGovernanceActionAreRejected() public {
        vm.chainId(1);
        vm.expectRevert(RobinhoodGovernancePhase1.UnsupportedChain.selector);
        new RobinhoodGovernancePhase1(registry, address(this), VOTING_PERIOD, QUORUM, EXECUTION_WINDOW, 0);

        vm.chainId(46_630);
        vm.expectRevert(RobinhoodGovernancePhase1.UnauthorizedAction.selector);
        governance.applyGovernanceAction(1, 1 days);
    }

    function _issue(address wallet, uint256 policyId, uint64 expiresAt) private {
        RobinhoodDemoCredentialRegistry.Credential memory previous = registry.getCredential(wallet, policyId);
        registry.recordCredential(
            wallet,
            policyId,
            keccak256(abi.encode(wallet, policyId, previous.version + 1)),
            expiresAt,
            previous.version + 1
        );
    }
}
