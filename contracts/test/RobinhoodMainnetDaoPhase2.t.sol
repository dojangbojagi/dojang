// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {RobinhoodMainnetDemoCredentialRegistry} from "../src/robinhood-mainnet/RobinhoodMainnetDemoCredentialRegistry.sol";
import {RobinhoodMainnetDemoGovernancePhase2} from "../src/robinhood-mainnet/RobinhoodMainnetDemoGovernancePhase2.sol";
import {RobinhoodMainnetDemoLendingReputation} from "../src/robinhood-mainnet/RobinhoodMainnetDemoLendingReputation.sol";
import {MockEligibilityVerifierV2} from "./mocks/MockEligibilityVerifierV2.sol";

interface VmMainnetDaoPhase2 {
    function chainId(uint256 newChainId) external;
    function warp(uint256 timestamp) external;
    function roll(uint256 blockNumber) external;
    function etch(address target, bytes calldata code) external;
    function store(address target, bytes32 slot, bytes32 value) external;
    function prank(address sender) external;
    function expectRevert(bytes4 selector) external;
}

contract MainnetDaoPhase2LendingFixture {
    function demoOnly() external pure returns (bool) { return true; }
}

contract MockMainnetArbSys {
    uint256 public arbBlockNumber;
}

contract RobinhoodMainnetDaoPhase2Test {
    VmMainnetDaoPhase2 private constant vm =
        VmMainnetDaoPhase2(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant ARB_SYS = address(100);
    address private constant MEMBER = address(0xA001);
    address private constant REGISTRY_ISSUER = address(0xA002);
    uint256 private constant START_TIME = 1_800_000_000;

    RobinhoodMainnetDemoCredentialRegistry private registry;
    RobinhoodMainnetDemoLendingReputation private reputation;
    RobinhoodMainnetDemoGovernancePhase2 private governance;
    MockEligibilityVerifierV2 private verifier;
    bool private startedPaused;

    function setUp() public {
        vm.chainId(4_663);
        vm.warp(START_TIME);
        vm.roll(11_922_330);
        MockMainnetArbSys arbSys = new MockMainnetArbSys();
        vm.etch(ARB_SYS, address(arbSys).code);
        vm.store(ARB_SYS, bytes32(0), bytes32(uint256(136_014_631)));

        registry = new RobinhoodMainnetDemoCredentialRegistry(address(this), REGISTRY_ISSUER);
        verifier = new MockEligibilityVerifierV2();
        reputation = new RobinhoodMainnetDemoLendingReputation(
            address(new MainnetDaoPhase2LendingFixture()), address(this), address(this), address(this)
        );
        governance = new RobinhoodMainnetDemoGovernancePhase2(
            registry, reputation, verifier, address(this), address(this), 1 hours, 1 hours, 7 days, 2, 3
        );
        startedPaused = reputation.paused() && governance.paused();
        reputation.unpause();
        governance.unpause();
    }

    function testMainnetContractsStartPausedAndMarkDemoScope() public view {
        require(startedPaused, "Phase 2 contracts must start paused");
        require(registry.demoOnly(), "Mainnet credential registry must be demo-only");
        require(reputation.demoOnly(), "Mainnet reputation registry must be demo-only");
        require(governance.demoOnly(), "Mainnet governance must be demo-only");
        require(reputation.ROBINHOOD_MAINNET_CHAIN_ID() == 4_663, "wrong reputation chain constant");
        require(governance.ROBINHOOD_MAINNET_CHAIN_ID() == 4_663, "wrong governance chain constant");
    }

    function testReputationAcceptsL2EvidenceAboveL1OriginHeight() public {
        require(block.number == 11_922_330, "L1-origin block fixture mismatch");
        uint256 l2Head = 136_014_631;
        require(MockMainnetArbSys(ARB_SYS).arbBlockNumber() == l2Head, "L2 block fixture mismatch");
        uint64 expiresAt = uint64(START_TIME + 10 days);
        bytes32 commitment = bytes32(uint256(0xA5));

        reputation.recordClaim(
            MEMBER, commitment, expiresAt, 1, 133_689_989, 135_967_848, keccak256("mainnet-l2-evidence")
        );
        RobinhoodMainnetDemoLendingReputation.Claim memory claim = reputation.getClaim(MEMBER);
        require(claim.observedFromBlock == 133_689_989, "evidence start changed");
        require(claim.observedToBlock == 135_967_848, "evidence end changed");
        require(claim.observedToBlock > block.number, "test must distinguish L1 and L2 heights");
    }

    function testReputationRejectsCurrentL2HeadAndNotTheL1OriginHeight() public {
        uint256 l2Head = MockMainnetArbSys(ARB_SYS).arbBlockNumber();
        vm.expectRevert(RobinhoodMainnetDemoLendingReputation.InvalidBlockRange.selector);
        reputation.recordClaim(
            MEMBER,
            bytes32(uint256(0xA6)),
            uint64(START_TIME + 10 days),
            1,
            133_689_989,
            l2Head,
            keccak256("current-l2-head")
        );
    }

    function testPolicyFiveMembershipProofBindsToMainnetAndNewGovernance() public {
        bytes32 commitment = bytes32(uint256(0xB1));
        uint64 expiresAt = uint64(START_TIME + 10 days);
        vm.prank(REGISTRY_ISSUER);
        registry.recordCredential(MEMBER, 5, commitment, expiresAt, 1);
        reputation.recordClaim(
            MEMBER, commitment, expiresAt, 1, 133_689_989, 135_967_848, keccak256("member-evidence")
        );

        uint256[9] memory inputs = [
            uint256(uint160(MEMBER)),
            uint256(commitment),
            uint256(5),
            uint256(1),
            uint256(3),
            uint256(1),
            uint256(expiresAt),
            uint256(4_663),
            uint256(uint160(address(governance)))
        ];
        vm.prank(MEMBER);
        governance.registerMembership(hex"42", inputs);
        require(governance.isActiveMember(MEMBER), "Mainnet-bound Policy 5 membership was not accepted");
    }

    function testWrongChainDeploymentsAreRejected() public {
        vm.chainId(46_630);
        address lendingFixture = address(new MainnetDaoPhase2LendingFixture());
        vm.expectRevert(RobinhoodMainnetDemoLendingReputation.UnsupportedChain.selector);
        new RobinhoodMainnetDemoLendingReputation(
            lendingFixture, address(this), address(this), address(this)
        );
        vm.expectRevert(RobinhoodMainnetDemoGovernancePhase2.UnsupportedChain.selector);
        new RobinhoodMainnetDemoGovernancePhase2(
            registry, reputation, verifier, address(this), address(this), 1 hours, 1 hours, 7 days, 2, 3
        );
    }
}
