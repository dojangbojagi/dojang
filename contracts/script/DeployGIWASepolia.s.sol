// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {DemoCredentialRegistry} from "../src/DemoCredentialRegistry.sol";
import {EligibilityVerifierAdapter} from "../src/EligibilityVerifierAdapter.sol";
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

    event CoreDeployment(
        address indexed registry,
        address indexed verifierAdapter,
        address indexed restrictedVault,
        address generatedVerifier,
        address admin,
        address issuer
    );

    function run() external returns (address registryAddress, address adapterAddress, address vaultAddress) {
        require(block.chainid == GIWA_SEPOLIA_CHAIN_ID, "wrong chain: expected GIWA Sepolia");

        address admin = vm.envAddress("GIWA_ADMIN_ADDRESS");
        address issuer = vm.envAddress("GIWA_ISSUER_ADDRESS");
        address generatedVerifierAddress = vm.envAddress("GIWA_HONK_VERIFIER_ADDRESS");
        require(admin != address(0), "GIWA_ADMIN_ADDRESS is zero");
        require(issuer != address(0), "GIWA_ISSUER_ADDRESS is zero");
        require(issuer != admin, "use a distinct credential issuer account");
        require(generatedVerifierAddress.code.length > 0, "GIWA_HONK_VERIFIER_ADDRESS has no code");

        vm.startBroadcast(admin);

        DemoCredentialRegistry registry = new DemoCredentialRegistry();
        EligibilityVerifierAdapter verifierAdapter = new EligibilityVerifierAdapter(
            HonkVerifier(generatedVerifierAddress)
        );
        RestrictedVault restrictedVault = new RestrictedVault(registry, verifierAdapter);
        registry.grantRole(registry.ISSUER_ROLE(), issuer);

        vm.stopBroadcast();

        registryAddress = address(registry);
        adapterAddress = address(verifierAdapter);
        vaultAddress = address(restrictedVault);
        emit CoreDeployment(
            registryAddress,
            adapterAddress,
            vaultAddress,
            generatedVerifierAddress,
            admin,
            issuer
        );
    }
}
