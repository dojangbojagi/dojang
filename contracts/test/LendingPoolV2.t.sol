// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ControlledTestOracle} from "../src/ControlledTestOracle.sol";
import {ControlledTestToken} from "../src/ControlledTestToken.sol";
import {DemoCredentialRegistry} from "../src/DemoCredentialRegistry.sol";
import {LendingPoolV2} from "../src/LendingPoolV2.sol";
import {IControlledDemoAsset} from "../src/interfaces/IControlledDemoAsset.sol";
import {MockEligibilityVerifierV2} from "./mocks/MockEligibilityVerifierV2.sol";
import {IPriceOracle} from "../src/interfaces/IPriceOracle.sol";

interface VmLendingV2 {
    function chainId(uint256 newChainId) external;
    function getCode(string calldata artifactPath) external view returns (bytes memory creationCode);
    function warp(uint256 timestamp) external;
    function prank(address sender) external;
    function expectRevert(bytes4 selector) external;
    function expectRevert(bytes calldata revertData) external;
}

contract MutableTestPriceOracle is IPriceOracle {
    struct Price {
        uint256 priceWad;
        uint64 updatedAt;
        bool available;
    }
    mapping(address asset => Price price) private prices;

    function configure(address asset, uint256 priceWad_, uint64 updatedAt_, bool available_) external {
        prices[asset] = Price(priceWad_, updatedAt_, available_);
    }

    function getPrice(address asset) external view returns (uint256, uint64) {
        Price memory price = prices[asset];
        require(price.available, "oracle unavailable");
        return (price.priceWad, price.updatedAt);
    }
}

contract ReentrantControlledDemoToken is ControlledTestToken {
    address private callbackTarget;
    bytes private callbackData;
    bool private attempted;
    bool public callbackBlocked;

    constructor(address admin) ControlledTestToken("Reentrant Test Collateral", "rCOL", 18, 10 ** 27, admin) {}

    function configureCallback(address target, bytes calldata data) external {
        callbackTarget = target;
        callbackData = data;
        attempted = false;
        callbackBlocked = false;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (callbackTarget != address(0) && !attempted) {
            attempted = true;
            (bool success,) = callbackTarget.call(callbackData);
            callbackBlocked = !success;
        }
        return super.transferFrom(from, to, amount);
    }
}

contract LendingPoolV2Test {
    VmLendingV2 private constant vm = VmLendingV2(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant LOAN_UNIT = 10 ** 6;
    uint256 private constant COLLATERAL_UNIT = 10 ** 18;
    uint64 private constant EXPIRY = 4_102_444_800;
    address private constant ISSUER = address(0x1A55);
    address private constant SUPPLIER = address(0xA11CE);
    address private constant BORROWER = address(0xB0B);
    address private constant LIQUIDATOR = address(0x11A0);
    address private constant OUTSIDER = address(0xBAD);

    DemoCredentialRegistry private registry;
    MockEligibilityVerifierV2 private verifier;
    ControlledTestOracle private oracle;
    ControlledTestToken private loan;
    ControlledTestToken private collateral;
    LendingPoolV2 private pool;
    bytes private validProof = hex"42";

    function setUp() public {
        vm.chainId(91_342);
        registry = new DemoCredentialRegistry();
        registry.grantRole(registry.ISSUER_ROLE(), ISSUER);
        verifier = new MockEligibilityVerifierV2();
        oracle = new ControlledTestOracle(address(this));
        loan = new ControlledTestToken("GIWA Demo Lending Dollar", "gUSD", 6, 10 ** 15, address(this));
        collateral = new ControlledTestToken("GIWA Demo Collateral", "gCOL", 18, 10 ** 27, address(this));
        pool = new LendingPoolV2(registry, verifier, oracle, address(this));

        oracle.setPriceBounds(address(loan), 0.9e18, 1.1e18);
        oracle.setPriceBounds(address(collateral), 0.5e18, 4e18);
        oracle.setPrice(address(loan), 1e18);
        oracle.setPrice(address(collateral), 2e18);
        pool.configureReserve(address(loan), _loanConfig());
        pool.configureReserve(address(collateral), _collateralConfig());

        loan.mint(SUPPLIER, 100_000 * LOAN_UNIT);
        loan.mint(BORROWER, 10_000 * LOAN_UNIT);
        loan.mint(LIQUIDATOR, 100_000 * LOAN_UNIT);
        collateral.mint(BORROWER, 10_000 * COLLATERAL_UNIT);
        vm.prank(SUPPLIER);
        loan.approve(address(pool), type(uint256).max);
        vm.prank(BORROWER);
        loan.approve(address(pool), type(uint256).max);
        vm.prank(BORROWER);
        collateral.approve(address(pool), type(uint256).max);
        vm.prank(LIQUIDATOR);
        loan.approve(address(pool), type(uint256).max);
    }

    function testSupplyAndWithdrawalAccountForLiquidityAndCaps() public {
        (bytes memory proof, uint256[9] memory inputs) = _issueEligibility(SUPPLIER);
        vm.prank(SUPPLIER);
        pool.supply(address(loan), 10_000 * LOAN_UNIT, proof, inputs);
        require(pool.availableLiquidity(address(loan)) == 10_000 * LOAN_UNIT, "liquidity mismatch");
        require(pool.getSupplyBalance(SUPPLIER, address(loan)) == 10_000 * LOAN_UNIT, "supplier shares mismatch");

        vm.prank(SUPPLIER);
        pool.withdrawSupply(address(loan), 2_500 * LOAN_UNIT);
        require(pool.getSupplyBalance(SUPPLIER, address(loan)) == 7_500 * LOAN_UNIT, "partial withdraw mismatch");

        LendingPoolV2.ReserveConfig memory config = pool.getReserveConfig(address(loan));
        config.supplyCap = 10_000 * LOAN_UNIT;
        pool.configureReserve(address(loan), config);
        vm.prank(SUPPLIER);
        vm.expectRevert(
            abi.encodeWithSelector(
                LendingPoolV2.SupplyCapExceeded.selector,
                address(loan),
                15_001 * LOAN_UNIT,
                10_000 * LOAN_UNIT
            )
        );
        pool.supply(address(loan), 7_501 * LOAN_UNIT, proof, inputs);
    }

    function testSupplyRequiresProjectCredentialAndValidProof() public {
        uint256[9] memory missingInputs = _inputsFor(SUPPLIER, bytes32(uint256(1)), 1);
        vm.prank(SUPPLIER);
        vm.expectRevert(abi.encodeWithSelector(LendingPoolV2.MissingCredential.selector, SUPPLIER));
        pool.supply(address(loan), LOAN_UNIT, validProof, missingInputs);

        (bytes memory proof, uint256[9] memory inputs) = _issueEligibility(SUPPLIER);
        proof = hex"00";
        vm.prank(SUPPLIER);
        vm.expectRevert(LendingPoolV2.InvalidProof.selector);
        pool.supply(address(loan), LOAN_UNIT, proof, inputs);
    }

    function testDecimalNormalizationAndBorrowCapacity() public {
        _supply(SUPPLIER, 10_000 * LOAN_UNIT);
        _depositAndEnableCollateral(BORROWER, 1_000 * COLLATERAL_UNIT);
        LendingPoolV2.AccountData memory account = pool.getAccountData(BORROWER);
        require(account.collateralValueWad == 2_000e18, "collateral decimals/value mismatch");
        require(account.ltvCapacityWad == 1_000e18, "LTV capacity mismatch");
        require(pool.getMaxBorrowable(BORROWER, address(loan)) == 1_000 * LOAN_UNIT, "max borrow mismatch");
    }

    function testBorrowWithinLimitAndRejectsOverLimit() public {
        _supply(SUPPLIER, 10_000 * LOAN_UNIT);
        _depositAndEnableCollateral(BORROWER, 1_000 * COLLATERAL_UNIT);
        (bytes memory proof, uint256[9] memory inputs) = _issueEligibility(BORROWER);
        vm.prank(BORROWER);
        pool.borrow(address(loan), 900 * LOAN_UNIT, proof, inputs);
        require(pool.getDebtBalance(BORROWER, address(loan)) == 900 * LOAN_UNIT, "debt not recorded");

        vm.prank(BORROWER);
        vm.expectRevert(
            abi.encodeWithSelector(
                LendingPoolV2.UnsafePosition.selector,
                1_298_701_298_701_298_701_298_701_298,
                1_001e18,
                1_000e18
            )
        );
        pool.borrow(address(loan), 101 * LOAN_UNIT, proof, inputs);
    }

    function testBorrowCapIsEnforced() public {
        _supply(SUPPLIER, 10_000 * LOAN_UNIT);
        _depositAndEnableCollateral(BORROWER, 1_000 * COLLATERAL_UNIT);
        LendingPoolV2.ReserveConfig memory config = pool.getReserveConfig(address(loan));
        config.borrowCap = 500 * LOAN_UNIT;
        pool.configureReserve(address(loan), config);
        (bytes memory proof, uint256[9] memory inputs) = _issueEligibility(BORROWER);
        vm.prank(BORROWER);
        vm.expectRevert(
            abi.encodeWithSelector(
                LendingPoolV2.BorrowCapExceeded.selector,
                address(loan),
                501 * LOAN_UNIT,
                500 * LOAN_UNIT
            )
        );
        pool.borrow(address(loan), 501 * LOAN_UNIT, proof, inputs);
    }

    function testInterestAccruesToDebtAndSupplierIndex() public {
        _supply(BORROWER, 10_000 * LOAN_UNIT);
        _depositAndEnableCollateral(BORROWER, 1_000 * COLLATERAL_UNIT);
        (bytes memory proof, uint256[9] memory inputs) = _issueEligibility(BORROWER);
        vm.prank(BORROWER);
        pool.borrow(address(loan), 800 * LOAN_UNIT, proof, inputs);

        uint256 debtBefore = pool.getDebtBalance(BORROWER, address(loan));
        uint256 supplierBefore = pool.getSupplyBalance(BORROWER, address(loan));
        vm.warp(block.timestamp + 365 days);
        uint256 debtAfter = pool.getDebtBalance(BORROWER, address(loan));
        uint256 supplierAfter = pool.getSupplyBalance(BORROWER, address(loan));
        require(debtAfter > debtBefore, "debt interest did not accrue");
        require(supplierAfter > supplierBefore, "supplier interest did not accrue");

        LendingPoolV2.ReserveData memory beforeClose = pool.getReserveData(address(loan));
        require(beforeClose.currentBorrowRateBps > 200, "utilization curve did not change rate");
        vm.prank(BORROWER);
        pool.withdrawSupply(address(loan), 20 * LOAN_UNIT);
        vm.prank(BORROWER);
        pool.repay(address(loan), type(uint256).max);
        LendingPoolV2.ReserveData memory data = pool.getReserveData(address(loan));
        require(data.accruedProtocolFees > 0, "reserve factor was not accrued");
    }

    function testReserveRatesAreReportedBeforeAnyTimeAccrues() public {
        _supply(SUPPLIER, 10_000 * LOAN_UNIT);
        _depositAndEnableCollateral(BORROWER, 1_000 * COLLATERAL_UNIT);
        (bytes memory proof, uint256[9] memory inputs) = _issueEligibility(BORROWER);
        vm.prank(BORROWER);
        pool.borrow(address(loan), 500 * LOAN_UNIT, proof, inputs);

        LendingPoolV2.ReserveData memory data = pool.getReserveData(address(loan));
        require(data.currentBorrowRateBps == 225, "current borrow rate was reported as zero/stale");
        require(data.currentSupplyRateBps > 0, "current supplier rate was reported as zero");
    }

    function testPartialRepaymentReducesDebtByTheSettledAmount() public {
        _supply(SUPPLIER, 10_000 * LOAN_UNIT);
        _depositAndEnableCollateral(BORROWER, 1_000 * COLLATERAL_UNIT);
        (bytes memory proof, uint256[9] memory inputs) = _issueEligibility(BORROWER);
        vm.prank(BORROWER);
        pool.borrow(address(loan), 500 * LOAN_UNIT, proof, inputs);

        vm.prank(BORROWER);
        uint256 firstPayment = pool.repay(address(loan), 125 * LOAN_UNIT);
        require(firstPayment == 125 * LOAN_UNIT, "partial repayment amount mismatch");
        require(pool.getDebtBalance(BORROWER, address(loan)) == 375 * LOAN_UNIT, "partial repayment debt mismatch");

        vm.prank(BORROWER);
        uint256 secondPayment = pool.repay(address(loan), 100 * LOAN_UNIT);
        require(secondPayment == 100 * LOAN_UNIT, "second partial repayment mismatch");
        require(pool.getDebtBalance(BORROWER, address(loan)) == 275 * LOAN_UNIT, "second repayment debt mismatch");
    }

    function testOracleRejectsOutOfBoundsAndStalePrices() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                ControlledTestOracle.PriceOutsideBounds.selector,
                0,
                0.5e18,
                4e18
            )
        );
        oracle.setPrice(address(collateral), 0);

        _supply(SUPPLIER, 10_000 * LOAN_UNIT);
        _depositAndEnableCollateral(BORROWER, 1_000 * COLLATERAL_UNIT);
        (bytes memory proof, uint256[9] memory inputs) = _issueEligibility(BORROWER);
        vm.warp(block.timestamp + 3_601);
        vm.prank(BORROWER);
        vm.expectRevert(
            abi.encodeWithSelector(
                LendingPoolV2.StaleOraclePrice.selector,
                address(loan),
                uint64(1),
                uint64(3_600)
            )
        );
        pool.borrow(address(loan), LOAN_UNIT, proof, inputs);
    }

    function testMissingZeroFutureAndStaleOracleValuesFailClosed() public {
        uint64 initialTimestamp = 5_000;
        vm.warp(initialTimestamp);
        MutableTestPriceOracle faultyOracle = new MutableTestPriceOracle();
        LendingPoolV2 faultyPool = new LendingPoolV2(registry, verifier, faultyOracle, address(this));
        faultyPool.configureReserve(address(loan), _loanConfig());
        faultyPool.configureReserve(address(collateral), _collateralConfig());

        faultyOracle.configure(address(collateral), 2e18, initialTimestamp, true);
        vm.prank(BORROWER);
        collateral.approve(address(faultyPool), COLLATERAL_UNIT);
        vm.prank(BORROWER);
        faultyPool.depositCollateral(address(collateral), COLLATERAL_UNIT);
        bytes32 commitment = keccak256("faulty-oracle-test-credential");
        uint256 targetPolicy = faultyPool.POLICY_ID();
        vm.prank(ISSUER);
        registry.recordCredential(BORROWER, targetPolicy, commitment, EXPIRY, 1);
        uint256[9] memory publicInputs = [
            uint256(uint160(BORROWER)),
            uint256(commitment),
            faultyPool.POLICY_ID(),
            faultyPool.POLICY_VERSION(),
            faultyPool.ELIGIBILITY_THRESHOLD(),
            uint256(1),
            uint256(EXPIRY),
            block.chainid,
            uint256(uint160(address(faultyPool)))
        ];
        vm.prank(BORROWER);
        faultyPool.setCollateralEnabled(address(collateral), true, validProof, publicInputs);

        vm.expectRevert(abi.encodeWithSelector(LendingPoolV2.OracleUnavailable.selector, address(loan)));
        faultyPool.getMaxBorrowable(BORROWER, address(loan));

        faultyOracle.configure(address(loan), 0, initialTimestamp, true);
        vm.expectRevert(abi.encodeWithSelector(LendingPoolV2.InvalidOraclePrice.selector, address(loan)));
        faultyPool.getMaxBorrowable(BORROWER, address(loan));

        uint64 futureTimestamp = initialTimestamp + 1;
        faultyOracle.configure(address(loan), 1e18, futureTimestamp, true);
        vm.expectRevert(
            abi.encodeWithSelector(LendingPoolV2.FutureOraclePrice.selector, address(loan), futureTimestamp)
        );
        faultyPool.getMaxBorrowable(BORROWER, address(loan));

        uint64 laterTimestamp = 10_000;
        vm.warp(laterTimestamp);
        faultyOracle.configure(address(collateral), 2e18, uint64(block.timestamp), true);
        faultyOracle.configure(address(loan), 1e18, uint64(block.timestamp - 3_601), true);
        vm.expectRevert(
            abi.encodeWithSelector(
                LendingPoolV2.StaleOraclePrice.selector,
                address(loan),
                uint64(block.timestamp - 3_601),
                uint64(3_600)
            )
        );
        faultyPool.getMaxBorrowable(BORROWER, address(loan));
    }

    function testHealthyPositionsCannotBeLiquidated() public {
        _supply(SUPPLIER, 10_000 * LOAN_UNIT);
        _depositAndEnableCollateral(BORROWER, 1_000 * COLLATERAL_UNIT);
        (bytes memory proof, uint256[9] memory inputs) = _issueEligibility(BORROWER);
        vm.prank(BORROWER);
        pool.borrow(address(loan), 500 * LOAN_UNIT, proof, inputs);
        vm.prank(LIQUIDATOR);
        vm.expectRevert(
            abi.encodeWithSelector(
                LendingPoolV2.PositionHealthy.selector,
                2_600_000_000_000_000_000_000_000_000
            )
        );
        pool.liquidate(BORROWER, address(loan), address(collateral), 100 * LOAN_UNIT);
    }

    function testPriceDropAllowsBoundedLiquidationAndUpdatesBothSides() public {
        _supply(SUPPLIER, 10_000 * LOAN_UNIT);
        _depositAndEnableCollateral(BORROWER, 1_000 * COLLATERAL_UNIT);
        (bytes memory proof, uint256[9] memory inputs) = _issueEligibility(BORROWER);
        vm.prank(BORROWER);
        pool.borrow(address(loan), 900 * LOAN_UNIT, proof, inputs);
        oracle.setPrice(address(collateral), 1.2e18);

        LendingPoolV2.AccountData memory unhealthy = pool.getAccountData(BORROWER);
        require(unhealthy.healthFactorWad < 1e27, "price move did not make position unhealthy");
        vm.prank(LIQUIDATOR);
        vm.expectRevert(
            abi.encodeWithSelector(
                LendingPoolV2.LiquidationCloseFactorExceeded.selector,
                451 * LOAN_UNIT,
                450 * LOAN_UNIT
            )
        );
        pool.liquidate(BORROWER, address(loan), address(collateral), 451 * LOAN_UNIT);

        vm.prank(LIQUIDATOR);
        pool.liquidate(BORROWER, address(loan), address(collateral), 450 * LOAN_UNIT);
        require(pool.getDebtBalance(BORROWER, address(loan)) == 450 * LOAN_UNIT, "liquidation debt mismatch");
        require(pool.getCollateralBalance(BORROWER, address(collateral)) < 1_000 * COLLATERAL_UNIT, "collateral not seized");
        require(collateral.balanceOf(LIQUIDATOR) > 0, "liquidator received no collateral");
    }

    function testRepayAndCollateralRecoveryIgnoreExpiredCredentialAndStaleOracle() public {
        _supply(BORROWER, 10_000 * LOAN_UNIT);
        _depositAndEnableCollateral(BORROWER, 1_000 * COLLATERAL_UNIT);
        (bytes memory proof, uint256[9] memory inputs) = _issueEligibility(BORROWER);
        vm.prank(BORROWER);
        pool.borrow(address(loan), 500 * LOAN_UNIT, proof, inputs);
        vm.warp(EXPIRY + 1);

        uint256 debt = pool.getDebtBalance(BORROWER, address(loan));
        loan.mint(BORROWER, debt);
        vm.prank(BORROWER);
        pool.repay(address(loan), type(uint256).max);
        require(pool.getDebtBalance(BORROWER, address(loan)) == 0, "full repayment failed");

        uint256[9] memory unusedInputs = _inputsFor(BORROWER, bytes32(0), 0);
        vm.prank(BORROWER);
        pool.setCollateralEnabled(address(collateral), false, bytes(""), unusedInputs);
        vm.prank(BORROWER);
        pool.withdrawCollateral(address(collateral), 1_000 * COLLATERAL_UNIT);
        require(pool.getCollateralBalance(BORROWER, address(collateral)) == 0, "collateral remained locked");
    }

    function testPausedRiskStillAllowsRepaymentAndSafeWithdrawals() public {
        _supply(BORROWER, 2_000 * LOAN_UNIT);
        _depositAndEnableCollateral(BORROWER, 1_000 * COLLATERAL_UNIT);
        (bytes memory proof, uint256[9] memory inputs) = _issueEligibility(BORROWER);
        vm.prank(BORROWER);
        pool.borrow(address(loan), 300 * LOAN_UNIT, proof, inputs);
        pool.pauseRisk();

        vm.prank(SUPPLIER);
        vm.expectRevert(bytes4(keccak256("EnforcedPause()")));
        pool.supply(address(loan), LOAN_UNIT, proof, inputs);
        uint256 debt = pool.getDebtBalance(BORROWER, address(loan));
        loan.mint(BORROWER, debt);
        vm.prank(BORROWER);
        pool.repay(address(loan), type(uint256).max);
        vm.prank(BORROWER);
        pool.withdrawCollateral(address(collateral), 1_000 * COLLATERAL_UNIT);
        uint256 remainingSupply = pool.getSupplyBalance(BORROWER, address(loan));
        vm.prank(BORROWER);
        pool.withdrawSupply(address(loan), remainingSupply);
        require(pool.getDebtBalance(BORROWER, address(loan)) == 0, "pause blocked repayment");
    }

    function testUnauthorizedRiskConfigurationIsRejected() public {
        LendingPoolV2.ReserveConfig memory config = pool.getReserveConfig(address(loan));
        bytes32 riskAdminRole = pool.RISK_ADMIN_ROLE();
        vm.prank(OUTSIDER);
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("AccessControlUnauthorizedAccount(address,bytes32)")),
                OUTSIDER,
                riskAdminRole
            )
        );
        pool.configureReserve(address(loan), config);
    }

    function testDeploymentArtifactLookupAndConstructorEncoding() public {
        bytes memory bytecode = bytes.concat(
            vm.getCode("ControlledTestToken.sol:ControlledTestToken"),
            abi.encode("Artifact Test", "ATST", uint8(6), 1_000_000, address(this))
        );
        address deployed;
        assembly ("memory-safe") {
            deployed := create(0, add(bytecode, 0x20), mload(bytecode))
        }
        require(deployed != address(0), "artifact CREATE failed");
        require(ControlledTestToken(deployed).decimals() == 6, "constructor args were not encoded");
        require(ControlledTestToken(deployed).mintCap() == 1_000_000, "mint cap mismatch");
    }

    function testCredentialAndProofAreBoundToV2PoolAndPolicy() public {
        (bytes memory proof, uint256[9] memory inputs) = _issueEligibility(SUPPLIER);
        inputs[2] = 2;
        vm.prank(SUPPLIER);
        vm.expectRevert(LendingPoolV2.WrongPolicy.selector);
        pool.supply(address(loan), LOAN_UNIT, proof, inputs);

        inputs[2] = pool.POLICY_ID();
        inputs[8] = uint256(uint160(address(this)));
        vm.prank(SUPPLIER);
        vm.expectRevert(LendingPoolV2.WrongLendingPool.selector);
        pool.supply(address(loan), LOAN_UNIT, proof, inputs);
    }

    function testReentrantCollateralTokenCannotReenterPool() public {
        ReentrantControlledDemoToken reentrant = new ReentrantControlledDemoToken(address(this));
        oracle.setPriceBounds(address(reentrant), 0.5e18, 4e18);
        oracle.setPrice(address(reentrant), 2e18);
        pool.configureReserve(address(reentrant), _collateralConfig());
        reentrant.mint(BORROWER, 10 * COLLATERAL_UNIT);
        vm.prank(BORROWER);
        reentrant.approve(address(pool), type(uint256).max);
        reentrant.configureCallback(
            address(pool), abi.encodeCall(pool.depositCollateral, (address(reentrant), COLLATERAL_UNIT))
        );

        vm.prank(BORROWER);
        pool.depositCollateral(address(reentrant), COLLATERAL_UNIT);
        require(reentrant.callbackBlocked(), "nested pool action was not blocked");
        require(
            pool.getCollateralBalance(BORROWER, address(reentrant)) == COLLATERAL_UNIT,
            "reentry changed collateral accounting"
        );
    }

    function _supply(address supplier, uint256 amount) private {
        (bytes memory proof, uint256[9] memory inputs) = _issueEligibility(supplier);
        vm.prank(supplier);
        pool.supply(address(loan), amount, proof, inputs);
    }

    function _depositAndEnableCollateral(address user, uint256 amount) private {
        vm.prank(user);
        pool.depositCollateral(address(collateral), amount);
        (bytes memory proof, uint256[9] memory inputs) = _issueEligibility(user);
        vm.prank(user);
        pool.setCollateralEnabled(address(collateral), true, proof, inputs);
    }

    function _issueEligibility(address user)
        private
        returns (bytes memory proof, uint256[9] memory inputs)
    {
        DemoCredentialRegistry.Credential memory previous = registry.getCredential(user, pool.POLICY_ID());
        uint64 version = previous.wallet == address(0) ? 1 : previous.version + 1;
        bytes32 commitment = keccak256(abi.encode(user, address(pool), block.timestamp));
        uint256 policyId = pool.POLICY_ID();
        vm.prank(ISSUER);
        registry.recordCredential(user, policyId, commitment, EXPIRY, version);
        proof = validProof;
        inputs = _inputsFor(user, commitment, version);
    }

    function _inputsFor(address user, bytes32 commitment, uint64 version)
        private
        view
        returns (uint256[9] memory inputs)
    {
        inputs[0] = uint256(uint160(user));
        inputs[1] = uint256(commitment);
        inputs[2] = pool.POLICY_ID();
        inputs[3] = pool.POLICY_VERSION();
        inputs[4] = pool.ELIGIBILITY_THRESHOLD();
        inputs[5] = version;
        inputs[6] = EXPIRY;
        inputs[7] = block.chainid;
        inputs[8] = uint256(uint160(address(pool)));
    }

    function _loanConfig() private pure returns (LendingPoolV2.ReserveConfig memory) {
        return LendingPoolV2.ReserveConfig({
            supplyCap: 100_000 * LOAN_UNIT,
            borrowCap: 50_000 * LOAN_UNIT,
            collateralCap: 0,
            minBorrowAmount: 100_000,
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

    function _collateralConfig() private pure returns (LendingPoolV2.ReserveConfig memory) {
        return LendingPoolV2.ReserveConfig({
            supplyCap: 0,
            borrowCap: 0,
            collateralCap: 100_000 * COLLATERAL_UNIT,
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
