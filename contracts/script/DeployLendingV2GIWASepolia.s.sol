// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ControlledTestOracle} from "../src/ControlledTestOracle.sol";
import {ControlledTestToken} from "../src/ControlledTestToken.sol";
import {DemoCredentialRegistry} from "../src/DemoCredentialRegistry.sol";
import {IEligibilityVerifier} from "../src/interfaces/IEligibilityVerifier.sol";
import {IPriceOracle} from "../src/interfaces/IPriceOracle.sol";
import {LendingPoolV2} from "../src/LendingPoolV2.sol";

interface LendingV2DeploymentVm {
    function envAddress(string calldata name) external returns (address);
    function getCode(string calldata artifactPath) external view returns (bytes memory creationCode);
    function startBroadcast(address sender) external;
    function stopBroadcast() external;
}

interface LendingV2CredentialRegistryRoleCheck {
    function ISSUER_ROLE() external view returns (bytes32);
    function hasRole(bytes32 role, address account) external view returns (bool);
}

/// @notice Prepares the V2 test-token market and controlled oracle on GIWA Sepolia.
/// @dev Dry-run with scripts/forge-simulate.sh; no prices are seeded and no test credential is issued.
contract DeployLendingV2GIWASepolia {
    LendingV2DeploymentVm private constant vm =
        LendingV2DeploymentVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant GIWA_SEPOLIA_CHAIN_ID = 91_342;
    uint256 private constant GUSD = 10 ** 6;
    uint256 private constant GCOL = 10 ** 18;

    event LendingV2Deployment(
        address indexed lendingPool,
        address indexed lendingAsset,
        address indexed collateralAsset,
        address controlledTestOracle,
        address credentialRegistry,
        address eligibilityVerifier,
        address admin
    );

    function run()
        external
        returns (address lendingAssetAddress, address collateralAssetAddress, address oracleAddress, address poolAddress)
    {
        require(block.chainid == GIWA_SEPOLIA_CHAIN_ID, "wrong chain: expected GIWA Sepolia");

        address admin = vm.envAddress("GIWA_ADMIN_ADDRESS");
        address issuer = vm.envAddress("GIWA_ISSUER_ADDRESS");
        address registryAddress = vm.envAddress("GIWA_CREDENTIAL_REGISTRY_ADDRESS");
        address verifierAddress = vm.envAddress("GIWA_VERIFIER_ADAPTER_ADDRESS");
        require(admin != address(0), "GIWA_ADMIN_ADDRESS is zero");
        require(issuer != address(0), "GIWA_ISSUER_ADDRESS is zero");
        require(registryAddress.code.length > 0, "credential registry address has no code");
        require(verifierAddress.code.length > 0, "verifier adapter address has no code");
        LendingV2CredentialRegistryRoleCheck registry = LendingV2CredentialRegistryRoleCheck(registryAddress);
        require(registry.hasRole(registry.ISSUER_ROLE(), issuer), "issuer lacks registry ISSUER_ROLE");

        vm.startBroadcast(admin);

        lendingAssetAddress = _deployFromArtifact(
            "ControlledTestToken.sol:ControlledTestToken",
            abi.encode("GIWA Demo Lending Dollar V2", "gUSD2", uint8(6), 1_000_000 * GUSD, admin)
        );
        collateralAssetAddress = _deployFromArtifact(
            "ControlledTestToken.sol:ControlledTestToken",
            abi.encode("GIWA Demo Collateral V2", "gCOL2", uint8(18), 1_000_000 * GCOL, admin)
        );
        oracleAddress = _deployFromArtifact(
            "ControlledTestOracle.sol:ControlledTestOracle", abi.encode(admin)
        );
        poolAddress = _deployFromArtifact(
            "LendingPoolV2.sol:LendingPoolV2",
            abi.encode(
                DemoCredentialRegistry(registryAddress),
                IEligibilityVerifier(verifierAddress),
                IPriceOracle(oracleAddress),
                admin
            )
        );

        // Price limits are explicit test bounds, not price observations. The oracle stays unset
        // until an authorized operator submits a timestamped synthetic test price.
        ControlledTestOracle(oracleAddress).setPriceBounds(lendingAssetAddress, 0.95e18, 1.05e18);
        ControlledTestOracle(oracleAddress).setPriceBounds(collateralAssetAddress, 0.5e18, 4e18);
        LendingPoolV2(poolAddress).configureReserve(lendingAssetAddress, _lendingReserveConfig());
        LendingPoolV2(poolAddress).configureReserve(collateralAssetAddress, _collateralReserveConfig());

        vm.stopBroadcast();

        emit LendingV2Deployment(
            poolAddress,
            lendingAssetAddress,
            collateralAssetAddress,
            oracleAddress,
            registryAddress,
            verifierAddress,
            admin
        );
    }

    function _deployFromArtifact(string memory artifactPath, bytes memory constructorArgs)
        private
        returns (address deployed)
    {
        bytes memory creationCode = bytes.concat(vm.getCode(artifactPath), constructorArgs);
        assembly ("memory-safe") {
            deployed := create(0, add(creationCode, 0x20), mload(creationCode))
        }
        require(deployed != address(0), "artifact deployment failed");
    }

    function _lendingReserveConfig() private pure returns (LendingPoolV2.ReserveConfig memory) {
        return LendingPoolV2.ReserveConfig({
            supplyCap: 100_000 * GUSD,
            borrowCap: 50_000 * GUSD,
            collateralCap: 0,
            minBorrowAmount: 1 * GUSD,
            maxOracleAge: 3_600,
            maxLtvBps: 5_000,
            liquidationThresholdBps: 6_500,
            liquidationBonusBps: 500,
            closeFactorBps: 5_000,
            reserveFactorBps: 1_000,
            optimalUtilizationBps: 8_000,
            baseBorrowRateBps: 200,
            slope1Bps: 400,
            slope2Bps: 6_000,
            active: true,
            supplyEnabled: true,
            borrowEnabled: true,
            collateralEnabled: false
        });
    }

    function _collateralReserveConfig() private pure returns (LendingPoolV2.ReserveConfig memory) {
        return LendingPoolV2.ReserveConfig({
            supplyCap: 0,
            borrowCap: 0,
            collateralCap: 100_000 * GCOL,
            minBorrowAmount: 0,
            maxOracleAge: 3_600,
            maxLtvBps: 5_000,
            liquidationThresholdBps: 6_500,
            liquidationBonusBps: 500,
            closeFactorBps: 5_000,
            reserveFactorBps: 1_000,
            optimalUtilizationBps: 8_000,
            baseBorrowRateBps: 200,
            slope1Bps: 400,
            slope2Bps: 6_000,
            active: true,
            supplyEnabled: false,
            borrowEnabled: false,
            collateralEnabled: true
        });
    }
}
