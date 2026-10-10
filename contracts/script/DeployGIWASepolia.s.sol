// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ControlledTestToken} from "../src/ControlledTestToken.sol";
import {DemoCredentialRegistry} from "../src/DemoCredentialRegistry.sol";
import {EligibilityVerifierAdapter} from "../src/EligibilityVerifierAdapter.sol";
import {LendingPool} from "../src/LendingPool.sol";
import {RestrictedVault} from "../src/RestrictedVault.sol";
import {HonkVerifier} from "../src/generated/EligibilityHonkVerifier.sol";

interface DeploymentVm {
    function envAddress(string calldata name) external returns (address);
    function startBroadcast(address sender) external;
    function stopBroadcast() external;
}

/// @notice Reproducible project-contract deployment for GIWA Sepolia.
/// @dev `forge script` is simulation-only unless its CLI receives `--broadcast`.
contract DeployGIWASepolia {
    DeploymentVm private constant vm =
        DeploymentVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant GIWA_SEPOLIA_CHAIN_ID = 91_342;

    struct Deployment {
        address registry;
        address generatedVerifier;
        address verifierAdapter;
        address restrictedVault;
        address lendingAsset;
        address collateralAsset;
        address lendingPool;
        address admin;
        address issuer;
    }

    event ProtocolDeployment(
        address indexed registry,
        address indexed generatedVerifier,
        address indexed verifierAdapter,
        address restrictedVault,
        address lendingAsset,
        address collateralAsset,
        address lendingPool,
        address admin,
        address issuer
    );

    function run() external returns (Deployment memory deployment) {
        require(block.chainid == GIWA_SEPOLIA_CHAIN_ID, "wrong chain: expected GIWA Sepolia");

        address admin = vm.envAddress("GIWA_ADMIN_ADDRESS");
        address issuer = vm.envAddress("GIWA_ISSUER_ADDRESS");
        require(admin != address(0), "GIWA_ADMIN_ADDRESS is zero");
        require(issuer != address(0), "GIWA_ISSUER_ADDRESS is zero");
        require(issuer != admin, "use a distinct credential issuer account");

        vm.startBroadcast(admin);

        DemoCredentialRegistry registry = new DemoCredentialRegistry();
        HonkVerifier generatedVerifier = new HonkVerifier();
        EligibilityVerifierAdapter verifierAdapter = new EligibilityVerifierAdapter(generatedVerifier);
        RestrictedVault restrictedVault = new RestrictedVault(registry, verifierAdapter);

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
            registry,
            verifierAdapter,
            lendingAsset,
            collateralAsset
        );

        registry.grantRole(registry.ISSUER_ROLE(), issuer);

        vm.stopBroadcast();

        deployment = Deployment({
            registry: address(registry),
            generatedVerifier: address(generatedVerifier),
            verifierAdapter: address(verifierAdapter),
            restrictedVault: address(restrictedVault),
            lendingAsset: address(lendingAsset),
            collateralAsset: address(collateralAsset),
            lendingPool: address(lendingPool),
            admin: admin,
            issuer: issuer
        });
        emit ProtocolDeployment(
            deployment.registry,
            deployment.generatedVerifier,
            deployment.verifierAdapter,
            deployment.restrictedVault,
            deployment.lendingAsset,
            deployment.collateralAsset,
            deployment.lendingPool,
            deployment.admin,
            deployment.issuer
        );
    }
}
