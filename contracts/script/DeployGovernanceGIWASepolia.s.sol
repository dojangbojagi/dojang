// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {GovernedDojangAccess} from "../src/GovernedDojangAccess.sol";
import {GIWASepoliaDojang} from "../src/config/GIWASepoliaDojang.sol";
import {
    IDojangAttesterBook,
    IDojangScroll,
    IEASDojang
} from "../src/interfaces/IDojangVerification.sol";

interface GovernanceDeploymentVm {
    function envAddress(string calldata name) external returns (address);
    function envUint(string calldata name) external returns (uint256);
    function startBroadcast(address sender) external;
    function stopBroadcast() external;
}

/// @notice Deploys governance against official GIWA Sepolia Dojang and EAS contracts.
/// @dev Simulates by default. The script does not accept demo verifier/credential addresses.
contract DeployGovernanceGIWASepolia {
    GovernanceDeploymentVm private constant vm =
        GovernanceDeploymentVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant GIWA_SEPOLIA_CHAIN_ID = 91_342;
    uint64 private constant MIN_DEPLOYMENT_VOTING_PERIOD = 1 hours;

    event GovernanceDeployment(address indexed governance, address indexed deployer);

    function run() external returns (address governanceAddress) {
        require(block.chainid == GIWA_SEPOLIA_CHAIN_ID, "wrong chain: expected GIWA Sepolia");
        require(GIWASepoliaDojang.SCROLL.code.length > 0, "official DojangScroll has no code");
        require(GIWASepoliaDojang.ATTESTER_BOOK.code.length > 0, "official attester book has no code");
        require(GIWASepoliaDojang.EAS.code.length > 0, "official EAS has no code");

        address deployer = vm.envAddress("GIWA_ADMIN_ADDRESS");
        uint64 votingPeriod = uint64(vm.envUint("GIWA_GOVERNANCE_VOTING_PERIOD"));
        uint256 quorum = vm.envUint("GIWA_GOVERNANCE_QUORUM");
        uint64 executionWindow = uint64(vm.envUint("GIWA_GOVERNANCE_EXECUTION_WINDOW"));
        uint64 initialMinimumRemainingValidity = uint64(vm.envUint("GIWA_GOVERNANCE_INITIAL_MIN_VALIDITY"));
        require(deployer != address(0), "GIWA_ADMIN_ADDRESS is zero");
        require(votingPeriod >= MIN_DEPLOYMENT_VOTING_PERIOD, "deployment voting period must be at least one hour");

        vm.startBroadcast(deployer);
        GovernedDojangAccess governance = new GovernedDojangAccess(
            IDojangScroll(GIWASepoliaDojang.SCROLL),
            IDojangAttesterBook(GIWASepoliaDojang.ATTESTER_BOOK),
            IEASDojang(GIWASepoliaDojang.EAS),
            GIWASepoliaDojang.UPBIT_KOREA_ATTESTER_ID,
            GIWASepoliaDojang.VERIFIED_ADDRESS_SCHEMA_UID,
            votingPeriod,
            quorum,
            executionWindow,
            initialMinimumRemainingValidity
        );
        vm.stopBroadcast();

        governanceAddress = address(governance);
        emit GovernanceDeployment(governanceAddress, deployer);
    }
}
