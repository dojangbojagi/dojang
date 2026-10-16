// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {RobinhoodMainnetDemoCredentialRegistry} from "../src/robinhood-mainnet/RobinhoodMainnetDemoCredentialRegistry.sol";
import {RobinhoodMainnetDemoGovernancePhase2} from "../src/robinhood-mainnet/RobinhoodMainnetDemoGovernancePhase2.sol";
import {RobinhoodMainnetDemoLendingReputation} from "../src/robinhood-mainnet/RobinhoodMainnetDemoLendingReputation.sol";
import {IEligibilityVerifier} from "../src/interfaces/IEligibilityVerifier.sol";

interface DeployRobinhoodMainnetDaoPhase2Vm {
    function envAddress(string calldata name) external returns (address);
    function envUint(string calldata name) external returns (uint256);
    function startBroadcast(address sender) external;
    function stopBroadcast() external;
}

interface MainnetPhase2LendingDependencies {
    function credentialRegistry() external view returns (address);
    function eligibilityVerifier() external view returns (address);
    function demoOnly() external view returns (bool);
}

interface MainnetArbSys {
    function arbBlockNumber() external view returns (uint256);
}

/// @notice Isolated Mainnet Phase 2 deployment over the existing controlled-demo stack.
/// @dev Risk-taking contracts start paused. Run through forge-simulate.sh until separately authorized.
contract DeployRobinhoodMainnetDaoPhase2 {
    DeployRobinhoodMainnetDaoPhase2Vm private constant vm =
        DeployRobinhoodMainnetDaoPhase2Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 private constant ROBINHOOD_MAINNET_CHAIN_ID = 4_663;
    address private constant ARB_SYS = address(100);

    struct Config {
        address deployer;
        address admin;
        address membershipIssuer;
        address reputationIssuer;
        address pauseAuthority;
        address registry;
        address verifier;
        address lendingPool;
        uint64 commitPeriod;
        uint64 revealPeriod;
        uint64 executionWindow;
        uint256 quorum;
        uint256 minimumReputation;
    }

    event MainnetDaoPhase2Deployed(
        address indexed governance,
        address indexed reputationRegistry,
        address indexed lendingPool,
        address credentialRegistry,
        address verifier,
        address admin,
        address membershipIssuer,
        address reputationIssuer,
        address pauseAuthority
    );

    function run() external returns (address reputationAddress, address governanceAddress) {
        require(block.chainid == ROBINHOOD_MAINNET_CHAIN_ID, "wrong chain: expected Robinhood Mainnet 4663");
        uint256 l2Head = MainnetArbSys(ARB_SYS).arbBlockNumber();
        require(l2Head > 0, "ArbSys L2 block number unavailable on Mainnet");
        Config memory config = _configuration();
        _validateConfiguration(config);

        vm.startBroadcast(config.deployer);
        RobinhoodMainnetDemoLendingReputation reputation = new RobinhoodMainnetDemoLendingReputation(
            config.lendingPool, config.admin, config.reputationIssuer, config.pauseAuthority
        );
        RobinhoodMainnetDemoGovernancePhase2 governance = new RobinhoodMainnetDemoGovernancePhase2(
            RobinhoodMainnetDemoCredentialRegistry(config.registry),
            reputation,
            IEligibilityVerifier(config.verifier),
            config.admin,
            config.pauseAuthority,
            config.commitPeriod,
            config.revealPeriod,
            config.executionWindow,
            config.quorum,
            config.minimumReputation
        );
        vm.stopBroadcast();

        require(reputation.paused(), "reputation registry must start paused");
        require(governance.paused(), "governance must start paused");
        reputationAddress = address(reputation);
        governanceAddress = address(governance);
        emit MainnetDaoPhase2Deployed(
            governanceAddress,
            reputationAddress,
            config.lendingPool,
            config.registry,
            config.verifier,
            config.admin,
            config.membershipIssuer,
            config.reputationIssuer,
            config.pauseAuthority
        );
    }

    function _configuration() private returns (Config memory config) {
        config.deployer = vm.envAddress("RH_MAINNET_DEPLOYER_ADDRESS");
        config.admin = vm.envAddress("RH_MAINNET_ADMIN_ADDRESS");
        config.membershipIssuer = vm.envAddress("RH_MAINNET_ISSUER_ADDRESS");
        config.reputationIssuer = vm.envAddress("RH_MAINNET_RISK_ADMIN_ADDRESS");
        config.pauseAuthority = vm.envAddress("RH_MAINNET_PAUSE_AUTHORITY_ADDRESS");
        config.registry = vm.envAddress("RH_MAINNET_CREDENTIAL_REGISTRY_ADDRESS");
        config.verifier = vm.envAddress("RH_MAINNET_VERIFIER_ADAPTER_ADDRESS");
        config.lendingPool = vm.envAddress("RH_MAINNET_DEMO_LENDING_POOL_ADDRESS");
        config.commitPeriod = _uint64("RH_MAINNET_PHASE2_COMMIT_PERIOD");
        config.revealPeriod = _uint64("RH_MAINNET_PHASE2_REVEAL_PERIOD");
        config.executionWindow = _uint64("RH_MAINNET_PHASE2_EXECUTION_WINDOW");
        config.quorum = vm.envUint("RH_MAINNET_PHASE2_QUORUM");
        config.minimumReputation = vm.envUint("RH_MAINNET_PHASE2_MINIMUM_REPUTATION");
    }

    function _validateConfiguration(Config memory config) private view {
        _requireDistinctRoles(
            config.deployer, config.admin, config.membershipIssuer, config.reputationIssuer, config.pauseAuthority
        );
        require(config.registry.code.length > 0, "Mainnet demo credential registry has no code");
        require(config.verifier.code.length > 0, "Mainnet eligibility verifier has no code");
        require(config.lendingPool.code.length > 0, "Mainnet demo Lending pool has no code");
        require(RobinhoodMainnetDemoCredentialRegistry(config.registry).demoOnly(), "registry is not demo-only");
        require(MainnetPhase2LendingDependencies(config.lendingPool).demoOnly(), "Lending pool is not demo-only");
        RobinhoodMainnetDemoCredentialRegistry registry = RobinhoodMainnetDemoCredentialRegistry(config.registry);
        require(
            registry.hasRole(registry.ISSUER_ROLE(), config.membershipIssuer),
            "membership issuer lacks Mainnet registry role"
        );
        MainnetPhase2LendingDependencies lending = MainnetPhase2LendingDependencies(config.lendingPool);
        require(lending.credentialRegistry() == config.registry, "Mainnet Lending registry mismatch");
        require(lending.eligibilityVerifier() == config.verifier, "Mainnet Lending verifier mismatch");
        require(config.commitPeriod > 0 && config.revealPeriod > 0, "commit and reveal periods must be positive");
        require(config.executionWindow > 0, "execution window must be positive");
        require(config.quorum > 0, "quorum must be positive");
        require(config.minimumReputation <= 100, "minimum reputation exceeds Phase 2 maximum");
    }

    function _requireDistinctRoles(
        address deployer,
        address admin,
        address membershipIssuer,
        address reputationIssuer,
        address pauseAuthority
    ) private pure {
        address[5] memory roles = [deployer, admin, membershipIssuer, reputationIssuer, pauseAuthority];
        for (uint256 i; i < roles.length; ++i) {
            require(roles[i] != address(0), "all Mainnet Phase 2 role addresses are required");
            for (uint256 j; j < i; ++j) require(roles[i] != roles[j], "Mainnet Phase 2 roles must be distinct");
        }
    }

    function _uint64(string memory name) private returns (uint64 value) {
        uint256 raw = vm.envUint(name);
        require(raw <= type(uint64).max, string.concat(name, " exceeds uint64"));
        value = uint64(raw);
    }
}
