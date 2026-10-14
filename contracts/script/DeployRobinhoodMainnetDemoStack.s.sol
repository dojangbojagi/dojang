// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {RobinhoodMainnetDemoCredentialRegistry} from "../src/robinhood-mainnet/RobinhoodMainnetDemoCredentialRegistry.sol";
import {RobinhoodMainnetDemoGovernancePhase1} from "../src/robinhood-mainnet/RobinhoodMainnetDemoGovernancePhase1.sol";
import {RobinhoodMainnetDemoLendingPool} from "../src/robinhood-mainnet/RobinhoodMainnetDemoLendingPool.sol";
import {RobinhoodMainnetDemoOracle} from "../src/robinhood-mainnet/RobinhoodMainnetDemoOracle.sol";
import {RobinhoodMainnetDemoToken} from "../src/robinhood-mainnet/RobinhoodMainnetDemoToken.sol";
import {IEligibilityVerifier} from "../src/interfaces/IEligibilityVerifier.sol";
import {RobinhoodVerifierDeployment} from "./RobinhoodVerifierDeployment.sol";

interface DeployRobinhoodMainnetDemoVm {
    function envAddress(string calldata name) external returns (address);
    function envUint(string calldata name) external returns (uint256);
    function startBroadcast(address sender) external;
    function stopBroadcast() external;
}

/// @notice Simulates/deploys a separate controlled demo stack for Robinhood Mainnet.
/// @dev Always run through scripts/forge-simulate.sh until a separately authorized deployment.
///      No prices are set, no tokens are minted, and risk-taking contracts start paused.
contract DeployRobinhoodMainnetDemoStack {
    DeployRobinhoodMainnetDemoVm private constant vm =
        DeployRobinhoodMainnetDemoVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 private constant ROBINHOOD_MAINNET_CHAIN_ID = 4_663;

    struct Roles {
        address deployer;
        address admin;
        address issuer;
        address oracleUpdater;
        address riskAdmin;
        address pauseAuthority;
        address minter;
        address participantA;
        address participantB;
    }

    struct Parameters {
        uint64 votingPeriod;
        uint256 quorum;
        uint64 executionWindow;
        uint64 initialMinimumRemainingValidity;
        uint256 loanMintCap;
        uint256 collateralMintCap;
        uint128 loanMinimumPrice;
        uint128 loanMaximumPrice;
        uint128 collateralMinimumPrice;
        uint128 collateralMaximumPrice;
        RobinhoodMainnetDemoLendingPool.ReserveConfig loanConfig;
        RobinhoodMainnetDemoLendingPool.ReserveConfig collateralConfig;
    }

    struct Deployed {
        address transcriptLibrary;
        address relationsLibrary;
        address honkVerifier;
        address verifierAdapter;
        address registry;
        address oracle;
        address loanToken;
        address collateralToken;
        address lendingPool;
        address governance;
    }

    event RobinhoodMainnetDemoStackSimulated(
        address indexed deployer,
        address indexed admin,
        address indexed registry,
        address verifierAdapter,
        address oracle,
        address loanToken,
        address collateralToken,
        address lendingPool,
        address governance,
        address transcriptLibrary,
        address relationsLibrary,
        address honkVerifier
    );

    function run() external {
        require(block.chainid == ROBINHOOD_MAINNET_CHAIN_ID, "wrong chain: expected Robinhood Mainnet 4663");
        Roles memory roles = _loadRoles();
        _validateRoleSeparation(roles);
        Parameters memory p = _loadParameters();

        vm.startBroadcast(roles.deployer);
        Deployed memory d;
        RobinhoodVerifierDeployment.Addresses memory verifier = RobinhoodVerifierDeployment.deployMainnetDemo();
        d.transcriptLibrary = verifier.transcriptLibrary;
        d.relationsLibrary = verifier.relationsLibrary;
        d.honkVerifier = verifier.honkVerifier;
        d.verifierAdapter = verifier.verifierAdapter;
        d.registry = address(new RobinhoodMainnetDemoCredentialRegistry(roles.admin, roles.issuer));

        d.loanToken = address(new RobinhoodMainnetDemoToken(
            "GYEVO Mainnet DEMO Lending Dollar", "dUSD", 6, p.loanMintCap, roles.admin, roles.minter
        ));
        d.collateralToken = address(new RobinhoodMainnetDemoToken(
            "GYEVO Mainnet DEMO Collateral", "dCOL", 18, p.collateralMintCap, roles.admin, roles.minter
        ));
        d.oracle = address(new RobinhoodMainnetDemoOracle(
            roles.admin,
            roles.oracleUpdater,
            d.loanToken,
            p.loanMinimumPrice,
            p.loanMaximumPrice,
            d.collateralToken,
            p.collateralMinimumPrice,
            p.collateralMaximumPrice
        ));
        address[] memory participants = new address[](2);
        participants[0] = roles.participantA;
        participants[1] = roles.participantB;
        d.lendingPool = address(new RobinhoodMainnetDemoLendingPool(
            RobinhoodMainnetDemoCredentialRegistry(d.registry),
            IEligibilityVerifier(d.verifierAdapter),
            RobinhoodMainnetDemoOracle(d.oracle),
            roles.admin,
            roles.riskAdmin,
            roles.pauseAuthority,
            d.loanToken,
            d.collateralToken,
            participants,
            p.loanConfig,
            p.collateralConfig
        ));
        d.governance = address(new RobinhoodMainnetDemoGovernancePhase1(
            RobinhoodMainnetDemoCredentialRegistry(d.registry),
            roles.admin,
            roles.pauseAuthority,
            p.votingPeriod,
            p.quorum,
            p.executionWindow,
            p.initialMinimumRemainingValidity
        ));
        vm.stopBroadcast();

        emit RobinhoodMainnetDemoStackSimulated(
            roles.deployer,
            roles.admin,
            d.registry,
            d.verifierAdapter,
            d.oracle,
            d.loanToken,
            d.collateralToken,
            d.lendingPool,
            d.governance,
            d.transcriptLibrary,
            d.relationsLibrary,
            d.honkVerifier
        );
    }

    function _loadRoles() private returns (Roles memory r) {
        r.deployer = vm.envAddress("RH_MAINNET_DEPLOYER_ADDRESS");
        r.admin = vm.envAddress("RH_MAINNET_ADMIN_ADDRESS");
        r.issuer = vm.envAddress("RH_MAINNET_ISSUER_ADDRESS");
        r.oracleUpdater = vm.envAddress("RH_MAINNET_ORACLE_UPDATER_ADDRESS");
        r.riskAdmin = vm.envAddress("RH_MAINNET_RISK_ADMIN_ADDRESS");
        r.pauseAuthority = vm.envAddress("RH_MAINNET_PAUSE_AUTHORITY_ADDRESS");
        r.minter = vm.envAddress("RH_MAINNET_DEMO_MINTER_ADDRESS");
        r.participantA = vm.envAddress("RH_MAINNET_DEMO_PARTICIPANT_A_ADDRESS");
        r.participantB = vm.envAddress("RH_MAINNET_DEMO_PARTICIPANT_B_ADDRESS");
    }

    function _validateRoleSeparation(Roles memory r) private pure {
        address[9] memory addresses = [
            r.deployer, r.admin, r.issuer, r.oracleUpdater, r.riskAdmin,
            r.pauseAuthority, r.minter, r.participantA, r.participantB
        ];
        for (uint256 i; i < addresses.length; ++i) {
            require(addresses[i] != address(0), "all Mainnet demo role/participant addresses are required");
            for (uint256 j; j < i; ++j) require(addresses[i] != addresses[j], "Mainnet demo roles must be distinct");
        }
    }

    function _loadParameters() private returns (Parameters memory p) {
        p.votingPeriod = _u64("RH_MAINNET_DEMO_GOVERNANCE_VOTING_PERIOD");
        p.quorum = vm.envUint("RH_MAINNET_DEMO_GOVERNANCE_QUORUM");
        p.executionWindow = _u64("RH_MAINNET_DEMO_GOVERNANCE_EXECUTION_WINDOW");
        p.initialMinimumRemainingValidity = _u64("RH_MAINNET_DEMO_GOVERNANCE_INITIAL_MIN_VALIDITY");
        p.loanMintCap = vm.envUint("RH_MAINNET_DEMO_LOAN_MINT_CAP");
        p.collateralMintCap = vm.envUint("RH_MAINNET_DEMO_COLLATERAL_MINT_CAP");
        p.loanMinimumPrice = _u128("RH_MAINNET_DEMO_LOAN_PRICE_MIN_WAD");
        p.loanMaximumPrice = _u128("RH_MAINNET_DEMO_LOAN_PRICE_MAX_WAD");
        p.collateralMinimumPrice = _u128("RH_MAINNET_DEMO_COLLATERAL_PRICE_MIN_WAD");
        p.collateralMaximumPrice = _u128("RH_MAINNET_DEMO_COLLATERAL_PRICE_MAX_WAD");
        require(p.loanMintCap > 0 && p.collateralMintCap > 0, "demo mint caps must be nonzero");
        require(p.loanMinimumPrice > 0 && p.loanMaximumPrice >= p.loanMinimumPrice, "invalid loan demo price bounds");
        require(p.collateralMinimumPrice > 0 && p.collateralMaximumPrice >= p.collateralMinimumPrice, "invalid collateral demo price bounds");
        p.loanConfig = _reserveConfig(false, true);
        p.collateralConfig = _reserveConfig(true, false);
    }

    function _reserveConfig(bool collateral, bool lending)
        private returns (RobinhoodMainnetDemoLendingPool.ReserveConfig memory)
    {
        return RobinhoodMainnetDemoLendingPool.ReserveConfig({
            supplyCap: collateral ? 0 : vm.envUint("RH_MAINNET_DEMO_LENDING_SUPPLY_CAP"),
            borrowCap: collateral ? 0 : vm.envUint("RH_MAINNET_DEMO_LENDING_BORROW_CAP"),
            collateralCap: collateral ? vm.envUint("RH_MAINNET_DEMO_COLLATERAL_CAP") : 0,
            minBorrowAmount: collateral ? 0 : vm.envUint("RH_MAINNET_DEMO_MIN_BORROW_AMOUNT"),
            maxOracleAge: _u64("RH_MAINNET_DEMO_MAX_ORACLE_AGE"),
            maxLtvBps: _u16("RH_MAINNET_DEMO_MAX_LTV_BPS"),
            liquidationThresholdBps: _u16("RH_MAINNET_DEMO_LIQUIDATION_THRESHOLD_BPS"),
            liquidationBonusBps: _u16("RH_MAINNET_DEMO_LIQUIDATION_BONUS_BPS"),
            closeFactorBps: _u16("RH_MAINNET_DEMO_CLOSE_FACTOR_BPS"),
            reserveFactorBps: _u16("RH_MAINNET_DEMO_RESERVE_FACTOR_BPS"),
            optimalUtilizationBps: _u16("RH_MAINNET_DEMO_OPTIMAL_UTILIZATION_BPS"),
            baseBorrowRateBps: _u16("RH_MAINNET_DEMO_BASE_BORROW_RATE_BPS"),
            slope1Bps: _u16("RH_MAINNET_DEMO_SLOPE1_BPS"),
            slope2Bps: _u16("RH_MAINNET_DEMO_SLOPE2_BPS"),
            active: true,
            supplyEnabled: lending,
            borrowEnabled: lending,
            collateralEnabled: collateral
        });
    }

    function _u64(string memory key) private returns (uint64) {
        uint256 value = vm.envUint(key);
        require(value <= type(uint64).max, string.concat(key, " exceeds uint64"));
        return uint64(value);
    }

    function _u16(string memory key) private returns (uint16) {
        uint256 value = vm.envUint(key);
        require(value <= type(uint16).max, string.concat(key, " exceeds uint16"));
        return uint16(value);
    }

    function _u128(string memory key) private returns (uint128) {
        uint256 value = vm.envUint(key);
        require(value <= type(uint128).max, string.concat(key, " exceeds uint128"));
        return uint128(value);
    }
}
