// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ControlledTestOracle} from "../src/ControlledTestOracle.sol";
import {ControlledTestToken} from "../src/ControlledTestToken.sol";
import {DemoCredentialRegistry} from "../src/DemoCredentialRegistry.sol";
import {IEligibilityVerifier} from "../src/interfaces/IEligibilityVerifier.sol";
import {IPriceOracle} from "../src/interfaces/IPriceOracle.sol";
import {LendingPoolV2} from "../src/LendingPoolV2.sol";
import {RobinhoodDemoCredentialRegistry} from "../src/RobinhoodDemoCredentialRegistry.sol";
import {RobinhoodGovernancePhase1} from "../src/RobinhoodGovernancePhase1.sol";
import {RobinhoodVerifierDeployment} from "./RobinhoodVerifierDeployment.sol";

interface DeployRobinhoodProtocolVm {
    function envAddress(string calldata name) external returns (address);
    function envUint(string calldata name) external returns (uint256);
    function startBroadcast(address sender) external;
    function stopBroadcast() external;
}

/// @notice Full, dependency-ordered Robinhood Testnet stack simulation.
/// @dev Only use through scripts/forge-simulate.sh; all numeric market settings are explicit env inputs.
contract DeployRobinhoodProtocolStack {
    DeployRobinhoodProtocolVm private constant vm =
        DeployRobinhoodProtocolVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 private constant ROBINHOOD_TESTNET_CHAIN_ID = 46_630;

    struct Parameters {
        uint64 votingPeriod;
        uint256 quorum;
        uint64 executionWindow;
        uint64 initialMinimumRemainingValidity;
        uint256 lendingMintCap;
        uint256 collateralMintCap;
        uint128 loanMinimumPrice;
        uint128 loanMaximumPrice;
        uint128 collateralMinimumPrice;
        uint128 collateralMaximumPrice;
        LendingPoolV2.ReserveConfig loanConfig;
        LendingPoolV2.ReserveConfig collateralConfig;
    }

    struct Addresses {
        address transcriptLibrary;
        address relationsLibrary;
        address honkVerifier;
        address verifierAdapter;
        address registry;
        address oracle;
        address lendingAsset;
        address collateralAsset;
        address lendingPool;
        address governance;
    }

    event RobinhoodProtocolCoreSimulated(
        address indexed admin,
        address indexed issuer,
        address indexed registry,
        address verifierAdapter,
        address governancePhase1
    );
    event RobinhoodVerifierLibrariesSimulated(
        address indexed transcriptLibrary,
        address indexed relationsLibrary,
        address indexed honkVerifier
    );
    event RobinhoodLendingMarketSimulated(
        address indexed oracle,
        address indexed lendingAsset,
        address indexed collateralAsset,
        address lendingPoolV2
    );

    function run() external {
        require(block.chainid == ROBINHOOD_TESTNET_CHAIN_ID, "wrong chain: expected Robinhood Testnet 46630");
        address admin = vm.envAddress("RH_TESTNET_ADMIN_ADDRESS");
        address issuer = vm.envAddress("RH_TESTNET_ISSUER_ADDRESS");
        require(admin != address(0) && issuer != address(0), "admin and issuer addresses are required");
        require(admin != issuer, "use a separate project credential issuer account");

        Parameters memory parameters = _loadParameters();
        vm.startBroadcast(admin);

        RobinhoodVerifierDeployment.Addresses memory verifier = RobinhoodVerifierDeployment.deploy();
        Addresses memory deployed = _deployProtocol(admin, issuer, parameters, verifier.verifierAdapter);
        deployed.transcriptLibrary = verifier.transcriptLibrary;
        deployed.relationsLibrary = verifier.relationsLibrary;
        deployed.honkVerifier = verifier.honkVerifier;
        deployed.verifierAdapter = verifier.verifierAdapter;

        vm.stopBroadcast();
        emit RobinhoodVerifierLibrariesSimulated(
            deployed.transcriptLibrary, deployed.relationsLibrary, deployed.honkVerifier
        );
        emit RobinhoodProtocolCoreSimulated(admin, issuer, deployed.registry, deployed.verifierAdapter, deployed.governance);
        emit RobinhoodLendingMarketSimulated(
            deployed.oracle, deployed.lendingAsset, deployed.collateralAsset, deployed.lendingPool
        );
    }

    function _deployProtocol(address admin, address issuer, Parameters memory p, address adapter)
        private
        returns (Addresses memory deployed)
    {
        RobinhoodDemoCredentialRegistry registry = new RobinhoodDemoCredentialRegistry();
        registry.grantRole(registry.ISSUER_ROLE(), issuer);
        deployed.registry = address(registry);
        deployed.oracle = address(new ControlledTestOracle(admin));
        deployed.lendingAsset = address(new ControlledTestToken(
            "Robinhood Demo Lending Dollar V2", "rUSD2", 6, p.lendingMintCap, admin
        ));
        deployed.collateralAsset = address(new ControlledTestToken(
            "Robinhood Demo Collateral V2", "rCOL2", 18, p.collateralMintCap, admin
        ));
        deployed.lendingPool = address(new LendingPoolV2(
            DemoCredentialRegistry(deployed.registry),
            IEligibilityVerifier(adapter),
            IPriceOracle(deployed.oracle),
            admin
        ));
        deployed.governance = address(new RobinhoodGovernancePhase1(
            registry,
            admin,
            p.votingPeriod,
            p.quorum,
            p.executionWindow,
            p.initialMinimumRemainingValidity
        ));

        ControlledTestOracle(deployed.oracle).setPriceBounds(
            deployed.lendingAsset, p.loanMinimumPrice, p.loanMaximumPrice
        );
        ControlledTestOracle(deployed.oracle).setPriceBounds(
            deployed.collateralAsset, p.collateralMinimumPrice, p.collateralMaximumPrice
        );
        LendingPoolV2(deployed.lendingPool).configureReserve(deployed.lendingAsset, p.loanConfig);
        LendingPoolV2(deployed.lendingPool).configureReserve(deployed.collateralAsset, p.collateralConfig);
    }

    function _loadParameters() private returns (Parameters memory p) {
        p.votingPeriod = _uint64("RH_TESTNET_GOVERNANCE_VOTING_PERIOD");
        p.quorum = vm.envUint("RH_TESTNET_GOVERNANCE_QUORUM");
        p.executionWindow = _uint64("RH_TESTNET_GOVERNANCE_EXECUTION_WINDOW");
        p.initialMinimumRemainingValidity = _uint64("RH_TESTNET_GOVERNANCE_INITIAL_MIN_VALIDITY");
        p.lendingMintCap = vm.envUint("RH_TESTNET_LENDING_TOKEN_MINT_CAP");
        p.collateralMintCap = vm.envUint("RH_TESTNET_COLLATERAL_TOKEN_MINT_CAP");
        require(p.lendingMintCap > 0 && p.collateralMintCap > 0, "test-token mint caps must be nonzero");

        p.loanConfig = _reserveConfig(false, true);
        p.collateralConfig = _reserveConfig(true, false);
        p.loanMinimumPrice = _uint128("RH_TESTNET_LENDING_PRICE_MIN_WAD");
        p.loanMaximumPrice = _uint128("RH_TESTNET_LENDING_PRICE_MAX_WAD");
        p.collateralMinimumPrice = _uint128("RH_TESTNET_COLLATERAL_PRICE_MIN_WAD");
        p.collateralMaximumPrice = _uint128("RH_TESTNET_COLLATERAL_PRICE_MAX_WAD");
        require(p.loanMinimumPrice > 0 && p.loanMaximumPrice >= p.loanMinimumPrice, "invalid lending price bounds");
        require(
            p.collateralMinimumPrice > 0 && p.collateralMaximumPrice >= p.collateralMinimumPrice,
            "invalid collateral price bounds"
        );
    }

    function _reserveConfig(bool collateral, bool lending) private returns (LendingPoolV2.ReserveConfig memory) {
        return LendingPoolV2.ReserveConfig({
            supplyCap: collateral ? 0 : vm.envUint("RH_TESTNET_LENDING_SUPPLY_CAP"),
            borrowCap: collateral ? 0 : vm.envUint("RH_TESTNET_LENDING_BORROW_CAP"),
            collateralCap: collateral ? vm.envUint("RH_TESTNET_COLLATERAL_CAP") : 0,
            minBorrowAmount: collateral ? 0 : vm.envUint("RH_TESTNET_MIN_BORROW_AMOUNT"),
            maxOracleAge: _uint64("RH_TESTNET_MAX_ORACLE_AGE"),
            maxLtvBps: _uint16("RH_TESTNET_MAX_LTV_BPS"),
            liquidationThresholdBps: _uint16("RH_TESTNET_LIQUIDATION_THRESHOLD_BPS"),
            liquidationBonusBps: _uint16("RH_TESTNET_LIQUIDATION_BONUS_BPS"),
            closeFactorBps: _uint16("RH_TESTNET_CLOSE_FACTOR_BPS"),
            reserveFactorBps: _uint16("RH_TESTNET_RESERVE_FACTOR_BPS"),
            optimalUtilizationBps: _uint16("RH_TESTNET_OPTIMAL_UTILIZATION_BPS"),
            baseBorrowRateBps: _uint16("RH_TESTNET_BASE_BORROW_RATE_BPS"),
            slope1Bps: _uint16("RH_TESTNET_SLOPE1_BPS"),
            slope2Bps: _uint16("RH_TESTNET_SLOPE2_BPS"),
            active: true,
            supplyEnabled: lending,
            borrowEnabled: lending,
            collateralEnabled: collateral
        });
    }

    function _uint64(string memory name) private returns (uint64 value) {
        uint256 raw = vm.envUint(name);
        require(raw <= type(uint64).max, string.concat(name, " exceeds uint64"));
        value = uint64(raw);
    }

    function _uint16(string memory name) private returns (uint16 value) {
        uint256 raw = vm.envUint(name);
        require(raw <= type(uint16).max, string.concat(name, " exceeds uint16"));
        value = uint16(raw);
    }

    function _uint128(string memory name) private returns (uint128 value) {
        uint256 raw = vm.envUint(name);
        require(raw <= type(uint128).max, string.concat(name, " exceeds uint128"));
        value = uint128(raw);
    }
}
