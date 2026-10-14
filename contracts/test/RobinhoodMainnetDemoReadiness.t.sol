// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ControlledTestOracle} from "../src/ControlledTestOracle.sol";
import {IEligibilityVerifier} from "../src/interfaces/IEligibilityVerifier.sol";
import {IPriceOracle} from "../src/interfaces/IPriceOracle.sol";
import {MockEligibilityVerifierV2} from "./mocks/MockEligibilityVerifierV2.sol";
import {RobinhoodMainnetDemoCredentialRegistry} from "../src/robinhood-mainnet/RobinhoodMainnetDemoCredentialRegistry.sol";
import {RobinhoodMainnetDemoGovernancePhase1} from "../src/robinhood-mainnet/RobinhoodMainnetDemoGovernancePhase1.sol";
import {RobinhoodMainnetDemoLendingPool} from "../src/robinhood-mainnet/RobinhoodMainnetDemoLendingPool.sol";
import {RobinhoodMainnetDemoOracle} from "../src/robinhood-mainnet/RobinhoodMainnetDemoOracle.sol";
import {RobinhoodMainnetDemoToken} from "../src/robinhood-mainnet/RobinhoodMainnetDemoToken.sol";

interface MainnetDemoVm {
    function chainId(uint256 newChainId) external;
    function expectRevert() external;
    function expectRevert(bytes4 selector) external;
    function expectRevert(bytes calldata revertData) external;
    function prank(address sender) external;
}

contract RobinhoodMainnetDemoReadinessTest {
    MainnetDemoVm private constant vm = MainnetDemoVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant ADMIN = address(0xA11CE);
    address private constant ISSUER = address(0x1550);
    address private constant ORACLE_UPDATER = address(0x0A11);
    address private constant RISK_ADMIN = address(0xB055);
    address private constant PAUSE_AUTHORITY = address(0xFEE1);
    address private constant MINTER = address(0xBEEF);
    address private constant PARTICIPANT = address(0xCAFE);

    function testMainnetDemoContractsBindTo4663AndKeepDistinctRoles() external {
        vm.chainId(4_663);
        RobinhoodMainnetDemoCredentialRegistry registry =
            new RobinhoodMainnetDemoCredentialRegistry(ADMIN, ISSUER);
        RobinhoodMainnetDemoToken loan = new RobinhoodMainnetDemoToken(
            "Demo Loan", "dUSD", 6, 1_000_000e6, ADMIN, MINTER
        );
        RobinhoodMainnetDemoToken collateral = new RobinhoodMainnetDemoToken(
            "Demo Collateral", "dCOL", 18, 1_000_000e18, ADMIN, MINTER
        );
        RobinhoodMainnetDemoOracle oracle = new RobinhoodMainnetDemoOracle(
            ADMIN, ORACLE_UPDATER, address(loan), 1e18, 2e18, address(collateral), 1e18, 4e18
        );
        address[] memory participants = new address[](1);
        participants[0] = PARTICIPANT;
        RobinhoodMainnetDemoLendingPool pool = new RobinhoodMainnetDemoLendingPool(
            registry,
            new MockEligibilityVerifierV2(),
            oracle,
            ADMIN,
            RISK_ADMIN,
            PAUSE_AUTHORITY,
            address(loan),
            address(collateral),
            participants,
            _loanConfig(),
            _collateralConfig()
        );
        RobinhoodMainnetDemoGovernancePhase1 governance = new RobinhoodMainnetDemoGovernancePhase1(
            registry, ADMIN, PAUSE_AUTHORITY, 3_600, 2, 1 days, 0
        );

        require(pool.POLICY_ID() == 3, "policy mismatch");
        require(pool.paused(), "pool must start paused");
        require(pool.reserveCount() == 2, "reserve initialization mismatch");
        require(pool.isDemoParticipant(PARTICIPANT), "participant missing");
        require(pool.demoOnly() && registry.demoOnly() && governance.demoOnly() && oracle.demoOnly() && loan.demoOnly(), "demo-only marker missing");
        require(registry.hasRole(registry.ISSUER_ROLE(), ISSUER), "issuer role missing");
        require(oracle.hasRole(oracle.PRICE_UPDATER_ROLE(), ORACLE_UPDATER), "oracle role missing");
        require(loan.hasRole(loan.MINTER_ROLE(), MINTER), "minter role missing");
        require(governance.credentialRegistry() == registry, "governance registry mismatch");
        (,, uint128 loanPrice, uint64 loanUpdatedAt) = oracle.getPriceBounds(address(loan));
        require(oracle.priceConfigured(address(loan)) && loanPrice == 0 && loanUpdatedAt == 0, "oracle price must remain unset");
    }

    function testDeploymentChainGuardsRejectRobinhoodTestnet() external {
        vm.chainId(46_630);
        vm.expectRevert(RobinhoodMainnetDemoCredentialRegistry.UnsupportedChain.selector);
        new RobinhoodMainnetDemoCredentialRegistry(ADMIN, ISSUER);
        vm.expectRevert(RobinhoodMainnetDemoToken.UnsupportedChain.selector);
        new RobinhoodMainnetDemoToken("Demo", "D", 18, 1 ether, ADMIN, MINTER);
        vm.expectRevert(RobinhoodMainnetDemoOracle.UnsupportedChain.selector);
        new RobinhoodMainnetDemoOracle(ADMIN, ORACLE_UPDATER, address(1), 1, 1, address(2), 1, 2);
    }

    function testMainnetPoolRejectsRobinhoodTestnetChain() external {
        vm.chainId(46_630);
        address[] memory participants = new address[](1);
        vm.expectRevert(RobinhoodMainnetDemoLendingPool.UnsupportedChain.selector);
        new RobinhoodMainnetDemoLendingPool(
            RobinhoodMainnetDemoCredentialRegistry(address(1)),
            IEligibilityVerifier(address(2)),
            IPriceOracle(address(3)),
            ADMIN,
            RISK_ADMIN,
            PAUSE_AUTHORITY,
            address(4),
            address(5),
            participants,
            _loanConfig(),
            _collateralConfig()
        );
    }

    function testPoolStartsPausedAndOnlyPauseAuthorityCanUnpause() external {
        vm.chainId(4_663);
        (RobinhoodMainnetDemoLendingPool pool,,) = _deployPool();
        vm.expectRevert(bytes4(keccak256("EnforcedPause()")));
        pool.supply(address(0x1001), 1, hex"42", _proofInputs(address(pool), 0));
        vm.prank(address(0xD00D));
        vm.expectRevert();
        pool.unpauseRisk();
        vm.prank(PAUSE_AUTHORITY);
        pool.unpauseRisk();
        require(!pool.paused(), "pause authority failed to unpause");
    }

    function testSafeCollateralDeactivationRemainsAvailableWhilePaused() external {
        vm.chainId(4_663);
        (RobinhoodMainnetDemoLendingPool pool,,) = _deployPool();
        pool.setCollateralEnabled(address(pool.demoCollateralAsset()), false, "", _proofInputs(address(pool), 4_663));
    }

    function testReserveAdminCannotWhitelistAnUnregisteredAsset() external {
        vm.chainId(4_663);
        (RobinhoodMainnetDemoLendingPool pool,,) = _deployPool();
        RobinhoodMainnetDemoToken unlistedControlledToken = new RobinhoodMainnetDemoToken(
            "Unlisted Demo", "uDEMO", 18, 1_000_000e18, ADMIN, MINTER
        );
        vm.prank(RISK_ADMIN);
        vm.expectRevert(abi.encodeWithSelector(RobinhoodMainnetDemoLendingPool.InvalidDemoAsset.selector, address(unlistedControlledToken)));
        pool.configureReserve(address(unlistedControlledToken), _loanConfig());
    }

    function testOnlyConfiguredParticipantsCanEnterAndCollateralize() external {
        vm.chainId(4_663);
        (RobinhoodMainnetDemoLendingPool pool, RobinhoodMainnetDemoToken loan, RobinhoodMainnetDemoToken collateral) = _deployPool();
        vm.prank(PAUSE_AUTHORITY);
        pool.unpauseRisk();
        vm.prank(address(0xD00D));
        vm.expectRevert(abi.encodeWithSelector(RobinhoodMainnetDemoLendingPool.NotDemoParticipant.selector, address(0xD00D)));
        pool.supply(address(loan), 1, hex"42", _proofInputs(address(pool), 4_663));
        vm.prank(address(0xD00D));
        vm.expectRevert(abi.encodeWithSelector(RobinhoodMainnetDemoLendingPool.NotDemoParticipant.selector, address(0xD00D)));
        pool.depositCollateral(address(collateral), 1);
    }

    function testMainnetDemoGovernanceRejectsTestnetChain() external {
        vm.chainId(4_663);
        RobinhoodMainnetDemoCredentialRegistry registry =
            new RobinhoodMainnetDemoCredentialRegistry(ADMIN, ISSUER);
        new RobinhoodMainnetDemoGovernancePhase1(registry, ADMIN, PAUSE_AUTHORITY, 3_600, 2, 1 days, 0);
        vm.chainId(46_630);
        vm.expectRevert(RobinhoodMainnetDemoGovernancePhase1.UnsupportedChain.selector);
        new RobinhoodMainnetDemoGovernancePhase1(registry, ADMIN, PAUSE_AUTHORITY, 3_600, 2, 1 days, 0);
    }

    function _deployPool()
        private
        returns (RobinhoodMainnetDemoLendingPool pool, RobinhoodMainnetDemoToken loan, RobinhoodMainnetDemoToken collateral)
    {
        RobinhoodMainnetDemoCredentialRegistry registry = new RobinhoodMainnetDemoCredentialRegistry(ADMIN, ISSUER);
        loan = new RobinhoodMainnetDemoToken("Demo Loan", "dUSD", 6, 1_000_000e6, ADMIN, MINTER);
        collateral = new RobinhoodMainnetDemoToken("Demo Collateral", "dCOL", 18, 1_000_000e18, ADMIN, MINTER);
        RobinhoodMainnetDemoOracle oracle = new RobinhoodMainnetDemoOracle(
            ADMIN, ORACLE_UPDATER, address(loan), 1e18, 2e18, address(collateral), 1e18, 4e18
        );
        address[] memory participants = new address[](1);
        participants[0] = PARTICIPANT;
        pool = new RobinhoodMainnetDemoLendingPool(
            registry,
            new MockEligibilityVerifierV2(),
            oracle,
            ADMIN,
            RISK_ADMIN,
            PAUSE_AUTHORITY,
            address(loan),
            address(collateral),
            participants,
            _loanConfig(),
            _collateralConfig()
        );
    }

    function _proofInputs(address pool, uint256 chainId) private pure returns (uint256[9] memory inputs) {
        inputs[0] = uint256(uint160(PARTICIPANT));
        inputs[2] = 3;
        inputs[3] = 1;
        inputs[4] = 1_000;
        inputs[7] = chainId;
        inputs[8] = uint256(uint160(pool));
    }

    function _loanConfig() private pure returns (RobinhoodMainnetDemoLendingPool.ReserveConfig memory) {
        return RobinhoodMainnetDemoLendingPool.ReserveConfig({
            supplyCap: 1_000_000e6, borrowCap: 500_000e6, collateralCap: 0, minBorrowAmount: 1e6,
            maxOracleAge: 3_600, maxLtvBps: 5_000, liquidationThresholdBps: 6_500,
            liquidationBonusBps: 500, closeFactorBps: 5_000, reserveFactorBps: 1_000,
            optimalUtilizationBps: 8_000, baseBorrowRateBps: 200, slope1Bps: 400, slope2Bps: 6_000,
            active: true, supplyEnabled: true, borrowEnabled: true, collateralEnabled: false
        });
    }

    function _collateralConfig() private pure returns (RobinhoodMainnetDemoLendingPool.ReserveConfig memory) {
        return RobinhoodMainnetDemoLendingPool.ReserveConfig({
            supplyCap: 0, borrowCap: 0, collateralCap: 1_000_000e18, minBorrowAmount: 0,
            maxOracleAge: 3_600, maxLtvBps: 5_000, liquidationThresholdBps: 6_500,
            liquidationBonusBps: 500, closeFactorBps: 5_000, reserveFactorBps: 1_000,
            optimalUtilizationBps: 8_000, baseBorrowRateBps: 200, slope1Bps: 400, slope2Bps: 6_000,
            active: true, supplyEnabled: false, borrowEnabled: false, collateralEnabled: true
        });
    }
}
