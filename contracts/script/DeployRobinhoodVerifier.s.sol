// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {RobinhoodVerifierDeployment} from "./RobinhoodVerifierDeployment.sol";

interface DeployRobinhoodVerifierVm {
    function envAddress(string calldata name) external returns (address);
    function startBroadcast(address sender) external;
    function stopBroadcast() external;
}

/// @notice Simulates deployment of the linked Robinhood-specific ZK verifier stack.
/// @dev Use scripts/forge-simulate.sh. It refuses broadcast and signer flags.
contract DeployRobinhoodVerifier {
    DeployRobinhoodVerifierVm private constant vm =
        DeployRobinhoodVerifierVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 private constant ROBINHOOD_TESTNET_CHAIN_ID = 46_630;

    event RobinhoodVerifierStackSimulated(
        address indexed transcriptLibrary,
        address indexed relationsLibrary,
        address indexed honkVerifier,
        address verifierAdapter,
        address admin
    );

    function run() external {
        require(block.chainid == ROBINHOOD_TESTNET_CHAIN_ID, "wrong chain: expected Robinhood Testnet 46630");
        address admin = vm.envAddress("RH_TESTNET_ADMIN_ADDRESS");
        require(admin != address(0), "RH_TESTNET_ADMIN_ADDRESS is zero");

        vm.startBroadcast(admin);
        RobinhoodVerifierDeployment.Addresses memory deployed = RobinhoodVerifierDeployment.deploy();
        vm.stopBroadcast();

        emit RobinhoodVerifierStackSimulated(
            deployed.transcriptLibrary,
            deployed.relationsLibrary,
            deployed.honkVerifier,
            deployed.verifierAdapter,
            admin
        );
    }
}
