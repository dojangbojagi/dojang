// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {RobinhoodDemoCredentialRegistry} from "../src/RobinhoodDemoCredentialRegistry.sol";
import {RobinhoodGovernancePhase2} from "../src/RobinhoodGovernancePhase2.sol";
import {RobinhoodLendingReputation} from "../src/RobinhoodLendingReputation.sol";
import {IEligibilityVerifier} from "../src/interfaces/IEligibilityVerifier.sol";

interface RobinhoodDaoPhase2Vm {
    function envAddress(string calldata name) external returns (address);
    function envUint(string calldata name) external returns (uint256);
    function startBroadcast(address sender) external;
    function stopBroadcast() external;
}

interface RobinhoodLendingV2Dependencies {
    function credentialRegistry() external view returns (address);
    function eligibilityVerifier() external view returns (address);
}

/// @notice Isolated DAO Phase 2 deployment over the existing confirmed Robinhood Testnet stack.
/// @dev Both deployed contracts start paused. This script never modifies Phase 1 or Lending V2.
contract DeployRobinhoodDaoPhase2 {
    RobinhoodDaoPhase2Vm private constant vm =
        RobinhoodDaoPhase2Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 private constant ROBINHOOD_TESTNET_CHAIN_ID = 46_630;

    event RobinhoodDaoPhase2Deployed(
        address indexed governance,
        address indexed reputationRegistry,
        address indexed lendingPool,
        address credentialRegistry,
        address eligibilityVerifier,
        address admin,
        address reputationIssuer,
        address pauseAuthority
    );

    function run() external returns (address reputationRegistryAddress, address governanceAddress) {
        require(block.chainid == ROBINHOOD_TESTNET_CHAIN_ID, "wrong chain: expected Robinhood Testnet 46630");
        address deployer = vm.envAddress("RH_TESTNET_PHASE2_DEPLOYER_ADDRESS");
        address admin = vm.envAddress("RH_TESTNET_PHASE2_ADMIN_ADDRESS");
        address membershipIssuer = vm.envAddress("RH_TESTNET_PHASE2_MEMBERSHIP_ISSUER_ADDRESS");
        address reputationIssuer = vm.envAddress("RH_TESTNET_PHASE2_REPUTATION_ISSUER_ADDRESS");
        address pauseAuthority = vm.envAddress("RH_TESTNET_PHASE2_PAUSE_AUTHORITY_ADDRESS");
        address registryAddress = vm.envAddress("RH_TESTNET_CREDENTIAL_REGISTRY_ADDRESS");
        address verifierAddress = vm.envAddress("RH_TESTNET_VERIFIER_ADAPTER_ADDRESS");
        address lendingPoolAddress = vm.envAddress("RH_TESTNET_LENDING_V2_POOL_ADDRESS");
        _requireDistinctRoles(deployer, admin, membershipIssuer, reputationIssuer, pauseAuthority);
        require(registryAddress.code.length > 0, "credential registry has no code");
        require(verifierAddress.code.length > 0, "verifier adapter has no code");
        require(lendingPoolAddress.code.length > 0, "Lending V2 pool has no code");

        RobinhoodDemoCredentialRegistry registry = RobinhoodDemoCredentialRegistry(registryAddress);
        require(registry.hasRole(registry.ISSUER_ROLE(), membershipIssuer), "membership issuer lacks registry role");
        require(
            RobinhoodLendingV2Dependencies(lendingPoolAddress).credentialRegistry() == registryAddress,
            "Lending V2 registry mismatch"
        );
        require(
            RobinhoodLendingV2Dependencies(lendingPoolAddress).eligibilityVerifier() == verifierAddress,
            "Lending V2 verifier mismatch"
        );

        uint64 commitPeriod = _uint64("RH_TESTNET_PHASE2_COMMIT_PERIOD");
        uint64 revealPeriod = _uint64("RH_TESTNET_PHASE2_REVEAL_PERIOD");
        uint64 executionWindow = _uint64("RH_TESTNET_PHASE2_EXECUTION_WINDOW");
        uint256 quorum = vm.envUint("RH_TESTNET_PHASE2_QUORUM");
        uint256 minimumReputation = vm.envUint("RH_TESTNET_PHASE2_MINIMUM_REPUTATION");

        vm.startBroadcast(deployer);
        RobinhoodLendingReputation reputationRegistry =
            new RobinhoodLendingReputation(lendingPoolAddress, admin, reputationIssuer, pauseAuthority);
        RobinhoodGovernancePhase2 governance = new RobinhoodGovernancePhase2(
            registry,
            reputationRegistry,
            IEligibilityVerifier(verifierAddress),
            admin,
            pauseAuthority,
            commitPeriod,
            revealPeriod,
            executionWindow,
            quorum,
            minimumReputation
        );
        vm.stopBroadcast();

        require(reputationRegistry.paused(), "reputation registry must start paused");
        require(governance.paused(), "governance must start paused");
        reputationRegistryAddress = address(reputationRegistry);
        governanceAddress = address(governance);
        emit RobinhoodDaoPhase2Deployed(
            governanceAddress,
            reputationRegistryAddress,
            lendingPoolAddress,
            registryAddress,
            verifierAddress,
            admin,
            reputationIssuer,
            pauseAuthority
        );
    }

    function _requireDistinctRoles(
        address deployer,
        address admin,
        address membershipIssuer,
        address reputationIssuer,
        address pauseAuthority
    ) private pure {
        require(
            deployer != address(0) && admin != address(0) && membershipIssuer != address(0)
                && reputationIssuer != address(0) && pauseAuthority != address(0),
            "Phase 2 roles must be nonzero"
        );
        require(
            deployer != admin && deployer != membershipIssuer && deployer != reputationIssuer
                && deployer != pauseAuthority,
            "separate deployer role"
        );
        require(admin != membershipIssuer && admin != reputationIssuer && admin != pauseAuthority, "separate admin role");
        require(
            membershipIssuer != reputationIssuer && membershipIssuer != pauseAuthority
                && reputationIssuer != pauseAuthority,
            "separate issuer roles"
        );
    }

    function _uint64(string memory name) private returns (uint64 value) {
        uint256 raw = vm.envUint(name);
        require(raw <= type(uint64).max, string.concat(name, " exceeds uint64"));
        value = uint64(raw);
    }
}
