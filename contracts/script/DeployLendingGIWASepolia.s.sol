// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ControlledTestToken} from "../src/ControlledTestToken.sol";
import {DemoCredentialRegistry} from "../src/DemoCredentialRegistry.sol";
import {EligibilityVerifierAdapter} from "../src/EligibilityVerifierAdapter.sol";
import {LendingPool} from "../src/LendingPool.sol";

interface LendingDeploymentVm {
    function envAddress(string calldata name) external returns (address);
    function startBroadcast(address sender) external;
    function stopBroadcast() external;
}

/// @notice Deploys the capped demo assets and their proof-gated lending market.
/// @dev Simulates by default; only `forge script --broadcast` publishes transactions.
contract DeployLendingGIWASepolia {
    LendingDeploymentVm private constant vm =
        LendingDeploymentVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant GIWA_SEPOLIA_CHAIN_ID = 91_342;

    event LendingDeployment(
        address indexed lendingPool,
        address indexed lendingAsset,
        address indexed collateralAsset,
        address registry,
        address verifierAdapter,
        address admin
    );

    function run() external returns (address lendingAssetAddress, address collateralAssetAddress, address poolAddress) {
        require(block.chainid == GIWA_SEPOLIA_CHAIN_ID, "wrong chain: expected GIWA Sepolia");

        address admin = vm.envAddress("GIWA_ADMIN_ADDRESS");
        address registryAddress = vm.envAddress("GIWA_CREDENTIAL_REGISTRY_ADDRESS");
        address verifierAddress = vm.envAddress("GIWA_VERIFIER_ADAPTER_ADDRESS");
        require(admin != address(0), "GIWA_ADMIN_ADDRESS is zero");
        require(registryAddress.code.length > 0, "registry address has no code");
        require(verifierAddress.code.length > 0, "verifier adapter address has no code");

        vm.startBroadcast(admin);

        ControlledTestToken lendingAsset = new ControlledTestToken(
            "GIWA Demo Lending Dollar",
            "gUSD",
            6,
            10 ** 15,
            admin
        );
        ControlledTestToken collateralAsset = new ControlledTestToken(
            "GIWA Demo Collateral",
            "gCOL",
            18,
            10 ** 27,
            admin
        );
        LendingPool lendingPool = new LendingPool(
            DemoCredentialRegistry(registryAddress),
            EligibilityVerifierAdapter(verifierAddress),
            lendingAsset,
            collateralAsset
        );

        vm.stopBroadcast();

        lendingAssetAddress = address(lendingAsset);
        collateralAssetAddress = address(collateralAsset);
        poolAddress = address(lendingPool);
        emit LendingDeployment(
            poolAddress,
            lendingAssetAddress,
            collateralAssetAddress,
            registryAddress,
            verifierAddress,
            admin
        );
    }
}
