// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {DemoCredentialRegistry} from "../src/DemoCredentialRegistry.sol";
import {ControlledTestOracle} from "../src/ControlledTestOracle.sol";
import {IEligibilityVerifier} from "../src/interfaces/IEligibilityVerifier.sol";
import {LendingPoolV2} from "../src/LendingPoolV2.sol";
import {RobinhoodDemoCredentialRegistry} from "../src/RobinhoodDemoCredentialRegistry.sol";
import {MockEligibilityVerifierV2} from "./mocks/MockEligibilityVerifierV2.sol";

interface RobinhoodTestVm {
    function chainId(uint256 newChainId) external;
    function expectRevert(bytes4 selector) external;
}

contract RobinhoodTestnetCompatibilityTest {
    RobinhoodTestVm private constant vm =
        RobinhoodTestVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function testRegistryAndLendingV2DeployOnRobinhoodTestnet() external {
        vm.chainId(46_630);
        RobinhoodDemoCredentialRegistry robinhoodRegistry = new RobinhoodDemoCredentialRegistry();
        MockEligibilityVerifierV2 verifier = new MockEligibilityVerifierV2();
        ControlledTestOracle oracle = new ControlledTestOracle(address(this));
        LendingPoolV2 pool = new LendingPoolV2(
            DemoCredentialRegistry(address(robinhoodRegistry)), verifier, oracle, address(this)
        );

        require(address(pool.credentialRegistry()) == address(robinhoodRegistry), "registry mismatch");
        require(address(pool.eligibilityVerifier()) == address(verifier), "verifier mismatch");
        require(address(pool.priceOracle()) == address(oracle), "oracle mismatch");
    }

    function testCredentialIssuerCanIssueProjectCredentialOnRobinhoodTestnet() external {
        vm.chainId(46_630);
        RobinhoodDemoCredentialRegistry registry = new RobinhoodDemoCredentialRegistry();
        bytes32 issuerRole = registry.ISSUER_ROLE();
        registry.grantRole(issuerRole, address(this));

        uint64 expiry = uint64(block.timestamp + 1 days);
        uint64 version = registry.recordCredential(
            address(0xBEEF), 3, bytes32(uint256(1)), expiry, 1
        );
        RobinhoodDemoCredentialRegistry.Credential memory credential =
            registry.getCredential(address(0xBEEF), 3);
        require(version == 1 && credential.version == 1, "credential version mismatch");
        require(credential.issuer == address(this), "issuer mismatch");
        require(credential.commitment == bytes32(uint256(1)), "commitment mismatch");
    }

    function testDemoContractsRejectMainnetAndUnlistedChains() external {
        vm.chainId(4_663);
        vm.expectRevert(DemoCredentialRegistry.UnsupportedChain.selector);
        new DemoCredentialRegistry();
    }

    function testGiwaRegistryIsNotDeployableOnRobinhood() external {
        vm.chainId(46_630);
        vm.expectRevert(DemoCredentialRegistry.UnsupportedChain.selector);
        new DemoCredentialRegistry();
    }

    function testRobinhoodRegistryIsNotDeployableOnGiwa() external {
        vm.chainId(91_342);
        vm.expectRevert(RobinhoodDemoCredentialRegistry.UnsupportedChain.selector);
        new RobinhoodDemoCredentialRegistry();
    }

    function testLendingV2RejectsUnlistedChain() external {
        vm.chainId(46_630);
        RobinhoodDemoCredentialRegistry registry = new RobinhoodDemoCredentialRegistry();
        MockEligibilityVerifierV2 verifier = new MockEligibilityVerifierV2();
        ControlledTestOracle oracle = new ControlledTestOracle(address(this));
        vm.chainId(1);
        vm.expectRevert(LendingPoolV2.UnsupportedChain.selector);
        new LendingPoolV2(
            DemoCredentialRegistry(address(registry)),
            IEligibilityVerifier(address(verifier)),
            oracle,
            address(this)
        );
    }
}
