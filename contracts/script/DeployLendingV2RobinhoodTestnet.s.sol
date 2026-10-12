// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ControlledTestOracle} from "../src/ControlledTestOracle.sol";
import {ControlledTestToken} from "../src/ControlledTestToken.sol";
import {DemoCredentialRegistry} from "../src/DemoCredentialRegistry.sol";
import {EligibilityVerifierAdapter} from "../src/EligibilityVerifierAdapter.sol";
import {HonkVerifier} from "../src/generated/EligibilityHonkVerifier.sol";
import {IEligibilityVerifier} from "../src/interfaces/IEligibilityVerifier.sol";
import {IPriceOracle} from "../src/interfaces/IPriceOracle.sol";
import {LendingPoolV2} from "../src/LendingPoolV2.sol";
import {RobinhoodDemoCredentialRegistry} from "../src/RobinhoodDemoCredentialRegistry.sol";

interface RobinhoodDeploymentVm {
    function envAddress(string calldata name) external returns (address);
    function startBroadcast(address sender) external;
    function stopBroadcast() external;
}

/// @notice Prepares the project-issued credential and Lending V2 demo stack on Robinhood Testnet.
/// @dev Run through scripts/forge-simulate.sh for a no-broadcast simulation.
contract DeployLendingV2RobinhoodTestnet {
    RobinhoodDeploymentVm private constant vm =
        RobinhoodDeploymentVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant ROBINHOOD_TESTNET_CHAIN_ID = 46_630;
    uint256 private constant GUSD = 10 ** 6;
    uint256 private constant GCOL = 10 ** 18;

    event RobinhoodLendingV2CoreDeployment(
        address indexed lendingPool,
        address indexed credentialRegistry,
        address indexed verifierAdapter,
        address honkVerifier
    );
    event RobinhoodLendingV2MarketDeployment(
        address indexed lendingAsset,
        address indexed collateralAsset,
        address controlledTestOracle,
        address admin,
        address issuer
    );

    function run()
        external
        returns (
            address registryAddress,
            address adapterAddress,
            address lendingAssetAddress,
            address collateralAssetAddress,
            address oracleAddress,
            address poolAddress
        )
    {
        require(block.chainid == ROBINHOOD_TESTNET_CHAIN_ID, "wrong chain: expected Robinhood Testnet 46630");

        address admin = vm.envAddress("RH_TESTNET_ADMIN_ADDRESS");
        address issuer = vm.envAddress("RH_TESTNET_ISSUER_ADDRESS");
        address generatedVerifierAddress = vm.envAddress("RH_TESTNET_HONK_VERIFIER_ADDRESS");
        require(admin != address(0), "RH_TESTNET_ADMIN_ADDRESS is zero");
        require(issuer != address(0), "RH_TESTNET_ISSUER_ADDRESS is zero");
        require(issuer != admin, "use a separate project credential issuer account");
        require(generatedVerifierAddress.code.length > 0, "Robinhood Honk verifier has no deployed code");

        vm.startBroadcast(admin);

        RobinhoodDemoCredentialRegistry registry = new RobinhoodDemoCredentialRegistry();
        EligibilityVerifierAdapter adapter =
            new EligibilityVerifierAdapter(HonkVerifier(generatedVerifierAddress));
        ControlledTestOracle oracle = new ControlledTestOracle(admin);
        ControlledTestToken lendingAsset =
            new ControlledTestToken("Robinhood Demo Lending Dollar V2", "rUSD2", 6, 1_000_000 * GUSD, admin);
        ControlledTestToken collateralAsset =
            new ControlledTestToken("Robinhood Demo Collateral V2", "rCOL2", 18, 1_000_000 * GCOL, admin);
        LendingPoolV2 pool = new LendingPoolV2(
            DemoCredentialRegistry(address(registry)),
            IEligibilityVerifier(address(adapter)),
            IPriceOracle(address(oracle)),
            admin
        );

        registry.grantRole(registry.ISSUER_ROLE(), issuer);
        oracle.setPriceBounds(address(lendingAsset), 0.95e18, 1.05e18);
        oracle.setPriceBounds(address(collateralAsset), 0.5e18, 4e18);
        pool.configureReserve(address(lendingAsset), _lendingReserveConfig());
        pool.configureReserve(address(collateralAsset), _collateralReserveConfig());

        vm.stopBroadcast();

        registryAddress = address(registry);
        adapterAddress = address(adapter);
        lendingAssetAddress = address(lendingAsset);
        collateralAssetAddress = address(collateralAsset);
        oracleAddress = address(oracle);
        poolAddress = address(pool);
        emit RobinhoodLendingV2CoreDeployment(poolAddress, registryAddress, adapterAddress, generatedVerifierAddress);
        emit RobinhoodLendingV2MarketDeployment(lendingAssetAddress, collateralAssetAddress, oracleAddress, admin, issuer);
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
