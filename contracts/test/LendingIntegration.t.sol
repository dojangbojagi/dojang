// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ControlledTestToken} from "../src/ControlledTestToken.sol";
import {DemoCredentialRegistry} from "../src/DemoCredentialRegistry.sol";
import {EligibilityVerifierAdapter} from "../src/EligibilityVerifierAdapter.sol";
import {LendingPool} from "../src/LendingPool.sol";
import {HonkVerifier} from "../src/generated/EligibilityHonkVerifier.sol";

interface VmLending {
    function etch(address account, bytes calldata code) external;
    function chainId(uint256 newChainId) external;
    function warp(uint256 timestamp) external;
    function prank(address sender) external;
    function expectRevert(bytes4 selector) external;
    function expectRevert(bytes calldata revertData) external;
    function readFile(string calldata path) external view returns (string memory);
    function parseBytes(string calldata value) external pure returns (bytes memory);
    function parseJsonBytes32(string calldata json, string calldata key) external pure returns (bytes32);
}

/// @dev Test-only CREATE2 factory lets the real proof fixture target a deterministic pool address.
contract Create2TestDeployer {
    error Create2DeploymentFailed(bytes32 salt);
    error TestCallFailed();

    function deploy(bytes32 salt, bytes calldata initCode) external returns (address deployed) {
        bytes memory code = initCode;
        assembly ("memory-safe") {
            deployed := create2(0, add(code, 0x20), mload(code), salt)
        }
        if (deployed == address(0)) revert Create2DeploymentFailed(salt);
    }

    function execute(address target, bytes calldata data) external returns (bytes memory result) {
        (bool success, bytes memory returnData) = target.call(data);
        if (!success) {
            assembly ("memory-safe") {
                revert(add(returnData, 0x20), mload(returnData))
            }
        }
        return returnData;
    }
}

/// @dev Test-only token that attempts one nested pool call during transferFrom.
contract ReentrantTestToken is ControlledTestToken {
    address private reentryTarget;
    bytes private reentryData;
    bool public reentryBlocked;

    constructor(address admin_)
        ControlledTestToken("Reentrant Demo Collateral", "rCOL", 18, 10 ** 27, admin_)
    {}

    function configureReentry(address target, bytes calldata data) external onlyRole(DEFAULT_ADMIN_ROLE) {
        reentryTarget = target;
        reentryData = data;
        reentryBlocked = false;
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        address target = reentryTarget;
        if (target != address(0)) {
            reentryTarget = address(0);
            (bool success,) = target.call(reentryData);
            reentryBlocked = !success;
        }
        return super.transferFrom(from, to, value);
    }
}

contract LendingIntegrationTest {
    VmLending private constant vm = VmLending(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant CREATE2_FACTORY = address(0xC0DE);
    address private constant TOKEN_ADMIN = address(0xA11CE);
    address private constant ISSUER = address(0x1001);
    address private constant SUPPLIER = address(0x4004);
    address private constant OTHER = address(0x3003);
    uint256 private constant LOAN_UNIT = 1e6;
    uint256 private constant COLLATERAL_UNIT = 1e18;
    uint256 private constant LENDING_POLICY_ID = 2;
    uint256 private constant SUPPLY_AMOUNT = 10_000 * LOAN_UNIT;
    uint256 private constant COLLATERAL_AMOUNT = 1_000 * COLLATERAL_UNIT;
    uint64 private constant EXPIRY = 4_102_444_800;

    bytes32 private constant REGISTRY_SALT = keccak256("GIWA_LENDING_TEST_REGISTRY_V1");
    bytes32 private constant VERIFIER_SALT = keccak256("GIWA_LENDING_TEST_VERIFIER_V1");
    bytes32 private constant ADAPTER_SALT = keccak256("GIWA_LENDING_TEST_ADAPTER_V1");
    bytes32 private constant LENDING_ASSET_SALT = keccak256("GIWA_LENDING_TEST_LOAN_ASSET_V1");
    bytes32 private constant COLLATERAL_ASSET_SALT = keccak256("GIWA_LENDING_TEST_COLLATERAL_ASSET_V1");
    bytes32 private constant POOL_SALT = keccak256("GIWA_LENDING_TEST_POOL_V1");

    DemoCredentialRegistry private registry;
    EligibilityVerifierAdapter private verifier;
    ControlledTestToken private lendingAsset;
    ControlledTestToken private collateralAsset;
    LendingPool private pool;
    address private borrower;
    uint256[9] private proofInputs;
    bytes private validProof;

    error ProofTargetMismatch(address fixtureTarget, address deployedPool);
    error FixtureAddressMismatch(bytes32 component, address expected, address actual);

    function setUp() public {
        vm.chainId(91_342);
        vm.warp(1_800_000_000);
        vm.etch(CREATE2_FACTORY, type(Create2TestDeployer).runtimeCode);

        registry = DemoCredentialRegistry(_deploy(REGISTRY_SALT, type(DemoCredentialRegistry).creationCode));
        HonkVerifier honkVerifier = HonkVerifier(_deploy(VERIFIER_SALT, type(HonkVerifier).creationCode));
        if (address(honkVerifier) != 0x9A18EFD530298F3e4C60a7AfbA1E584A519ADADE) {
            revert FixtureAddressMismatch(keccak256("verifier"), 0x9A18EFD530298F3e4C60a7AfbA1E584A519ADADE, address(honkVerifier));
        }
        verifier = EligibilityVerifierAdapter(
            _deploy(ADAPTER_SALT, abi.encodePacked(type(EligibilityVerifierAdapter).creationCode, abi.encode(honkVerifier)))
        );
        lendingAsset = ControlledTestToken(
            _deploy(
                LENDING_ASSET_SALT,
                abi.encodePacked(
                    type(ControlledTestToken).creationCode,
                    abi.encode("GIWA Demo Lending Dollar", "gUSD", uint8(6), uint256(10 ** 15), TOKEN_ADMIN)
                )
            )
        );
        collateralAsset = ControlledTestToken(
            _deploy(
                COLLATERAL_ASSET_SALT,
                abi.encodePacked(
                    type(ControlledTestToken).creationCode,
                    abi.encode("GIWA Demo Collateral", "gCOL", uint8(18), uint256(10 ** 27), TOKEN_ADMIN)
                )
            )
        );
        pool = LendingPool(
            _deploy(
                POOL_SALT,
                abi.encodePacked(
                    type(LendingPool).creationCode,
                    abi.encode(registry, verifier, lendingAsset, collateralAsset)
                )
            )
        );

        proofInputs = _proofInputs();
        borrower = address(uint160(proofInputs[0]));
        if (proofInputs[8] != uint256(uint160(address(pool)))) {
            revert ProofTargetMismatch(address(uint160(proofInputs[8])), address(pool));
        }
        require(proofInputs[6] == EXPIRY, "proof fixture expiry mismatch");
        validProof = _proof();

        Create2TestDeployer(CREATE2_FACTORY).execute(
            address(registry), abi.encodeCall(registry.grantRole, (registry.ISSUER_ROLE(), ISSUER))
        );
        vm.prank(ISSUER);
        registry.recordCredential(
            borrower, LENDING_POLICY_ID, bytes32(proofInputs[1]), EXPIRY, uint64(1)
        );

        vm.prank(TOKEN_ADMIN);
        lendingAsset.mint(SUPPLIER, SUPPLY_AMOUNT);
        vm.prank(TOKEN_ADMIN);
        collateralAsset.mint(borrower, COLLATERAL_AMOUNT);
        _approveFor(borrower, address(pool));
        _approveFor(SUPPLIER, address(pool));
    }

    function testGenuineProofCompletesBorrowRepayAndWithdrawLifecycle() public {
        _preparePosition(borrower);

        require(pool.availableLiquidity() == SUPPLY_AMOUNT, "supplier liquidity not tracked");
        require(pool.collateralValue(borrower) == 1_000 * LOAN_UNIT, "decimal conversion incorrect");
        require(pool.borrowingCapacity(borrower) == 500 * LOAN_UNIT, "50 percent LTV not enforced");

        vm.prank(borrower);
        pool.borrow(300 * LOAN_UNIT, validProof, proofInputs);
        vm.prank(borrower);
        pool.borrow(200 * LOAN_UNIT, validProof, proofInputs);
        require(pool.debtBalance(borrower) == 500 * LOAN_UNIT, "borrowed debt not tracked");
        require(pool.remainingBorrowCapacity(borrower) == 0, "capacity remains after reaching LTV");
        require(lendingAsset.balanceOf(borrower) == 500 * LOAN_UNIT, "loan tokens not transferred");

        vm.prank(borrower);
        vm.expectRevert(abi.encodeWithSelector(
            LendingPool.BorrowingCapacityExceeded.selector,
            500 * LOAN_UNIT + 1,
            500 * LOAN_UNIT
        ));
        pool.borrow(1, validProof, proofInputs);

        vm.prank(borrower);
        pool.repay(200 * LOAN_UNIT);
        require(pool.debtBalance(borrower) == 300 * LOAN_UNIT, "partial repayment not recorded");
        require(pool.remainingBorrowCapacity(borrower) == 200 * LOAN_UNIT, "capacity did not restore after repayment");

        vm.prank(borrower);
        pool.withdrawCollateral(400 * COLLATERAL_UNIT);
        require(pool.borrowingCapacity(borrower) == 300 * LOAN_UNIT, "collateral withdrawal capacity incorrect");

        vm.prank(borrower);
        vm.expectRevert(abi.encodeWithSelector(
            LendingPool.UnsafeCollateralWithdrawal.selector,
            300 * LOAN_UNIT - 1,
            300 * LOAN_UNIT
        ));
        pool.withdrawCollateral(1);

        vm.prank(borrower);
        pool.repay(300 * LOAN_UNIT);
        vm.prank(borrower);
        pool.withdrawCollateral(600 * COLLATERAL_UNIT);
        require(pool.collateralBalance(borrower) == 0, "repaid collateral remains locked");

        vm.prank(SUPPLIER);
        pool.withdrawSupply(SUPPLY_AMOUNT);
        require(pool.supplierBalance(SUPPLIER) == 0, "supplier principal not withdrawn");
        require(pool.availableLiquidity() == 0, "available liquidity should be zero after full withdrawal");
        require(lendingAsset.balanceOf(SUPPLIER) == SUPPLY_AMOUNT, "supplier did not recover principal");
        require(lendingAsset.balanceOf(borrower) == 0, "borrower debt repayment accounting incorrect");
        require(pool.totalDebt() == 0, "total debt not cleared");
    }

    function testSupplierCannotWithdrawLiquidityCurrentlyBorrowed() public {
        _preparePosition(borrower);
        vm.prank(borrower);
        pool.borrow(500 * LOAN_UNIT, validProof, proofInputs);

        vm.prank(SUPPLIER);
        vm.expectRevert(LendingPool.InsufficientLiquidity.selector);
        pool.withdrawSupply(SUPPLY_AMOUNT);
        require(pool.supplierBalance(SUPPLIER) == SUPPLY_AMOUNT, "failed withdrawal changed supplier position");
    }

    function testInsufficientLiquidityBlocksBorrow() public {
        _depositCollateral(borrower);
        vm.prank(borrower);
        vm.expectRevert(LendingPool.InsufficientLiquidity.selector);
        pool.borrow(1, validProof, proofInputs);
        require(pool.debtBalance(borrower) == 0, "failed borrow created debt");
    }

    function testMissingCollateralBlocksBorrow() public {
        _supplyLiquidity();
        vm.prank(borrower);
        vm.expectRevert(LendingPool.InsufficientCollateral.selector);
        pool.borrow(1, validProof, proofInputs);
    }

    function testMissingCredentialBlocksBorrowEvenWithCollateral() public {
        _supplyLiquidity();
        vm.prank(TOKEN_ADMIN);
        collateralAsset.mint(OTHER, COLLATERAL_AMOUNT);
        _approveFor(OTHER, address(pool));
        _depositCollateral(OTHER);

        vm.prank(OTHER);
        vm.expectRevert(LendingPool.MissingCredential.selector);
        pool.borrow(1, validProof, proofInputs);
    }

    function testBorrowerCannotWithdrawAnotherWalletsCollateral() public {
        _depositCollateral(borrower);
        vm.prank(OTHER);
        vm.expectRevert(LendingPool.InsufficientCollateral.selector);
        pool.withdrawCollateral(1);
        require(pool.collateralBalance(borrower) == COLLATERAL_AMOUNT, "another wallet withdrew collateral");
    }

    function testRepaymentCannotExceedOutstandingDebt() public {
        _preparePosition(borrower);
        vm.prank(borrower);
        pool.borrow(100 * LOAN_UNIT, validProof, proofInputs);

        vm.prank(borrower);
        vm.expectRevert(abi.encodeWithSelector(
            LendingPool.RepayExceedsDebt.selector,
            100 * LOAN_UNIT + 1,
            100 * LOAN_UNIT
        ));
        pool.repay(100 * LOAN_UNIT + 1);
        require(pool.debtBalance(borrower) == 100 * LOAN_UNIT, "invalid repayment changed debt");
    }

    function testExcessiveBorrowingIsRejected() public {
        _preparePosition(borrower);
        vm.prank(borrower);
        vm.expectRevert(abi.encodeWithSelector(
            LendingPool.BorrowingCapacityExceeded.selector,
            500 * LOAN_UNIT + 1,
            500 * LOAN_UNIT
        ));
        pool.borrow(500 * LOAN_UNIT + 1, validProof, proofInputs);
        require(pool.debtBalance(borrower) == 0, "over-capacity borrow created debt");
    }

    function testChangedProofIsRejectedByGeneratedVerifier() public {
        _preparePosition(borrower);
        bytes memory changedProof = validProof;
        changedProof[0] = bytes1(uint8(changedProof[0]) ^ 1);

        vm.prank(borrower);
        vm.expectRevert(LendingPool.InvalidProof.selector);
        pool.borrow(1, changedProof, proofInputs);
        require(pool.debtBalance(borrower) == 0, "invalid proof created debt");
    }

    function testProofCannotBeReplayedByAnotherWallet() public {
        _supplyLiquidity();
        _recordCredential(OTHER, bytes32(proofInputs[1]), EXPIRY);
        vm.prank(TOKEN_ADMIN);
        collateralAsset.mint(OTHER, COLLATERAL_AMOUNT);
        _approveFor(OTHER, address(pool));
        _depositCollateral(OTHER);

        vm.prank(OTHER);
        vm.expectRevert(LendingPool.WrongSubject.selector);
        pool.borrow(1, validProof, proofInputs);
    }

    function testProofCannotBeReplayedAcrossLendingPools() public {
        LendingPool otherPool = _deployOtherPool();
        vm.prank(TOKEN_ADMIN);
        lendingAsset.mint(SUPPLIER, SUPPLY_AMOUNT);
        vm.prank(SUPPLIER);
        pool.supply(SUPPLY_AMOUNT);
        vm.prank(SUPPLIER);
        lendingAsset.approve(address(otherPool), SUPPLY_AMOUNT);
        vm.prank(SUPPLIER);
        otherPool.supply(SUPPLY_AMOUNT);

        _approveFor(borrower, address(otherPool));
        vm.prank(borrower);
        otherPool.depositCollateral(COLLATERAL_AMOUNT);

        vm.prank(borrower);
        vm.expectRevert(LendingPool.WrongLendingPool.selector);
        otherPool.borrow(1, validProof, proofInputs);
    }

    function testRevokedCredentialBlocksPreviouslyGeneratedProof() public {
        _preparePosition(borrower);
        vm.prank(ISSUER);
        registry.revokeCredential(borrower, LENDING_POLICY_ID);

        vm.prank(borrower);
        vm.expectRevert(LendingPool.CredentialRevoked.selector);
        pool.borrow(1, validProof, proofInputs);
    }

    function testRemovedIssuerRoleBlocksExistingCredential() public {
        _preparePosition(borrower);
        Create2TestDeployer(CREATE2_FACTORY).execute(
            address(registry), abi.encodeCall(registry.revokeRole, (registry.ISSUER_ROLE(), ISSUER))
        );

        vm.prank(borrower);
        vm.expectRevert(LendingPool.IssuerNotAuthorized.selector);
        pool.borrow(1, validProof, proofInputs);
    }

    function testExpiredCredentialBlocksPreviouslyGeneratedProof() public {
        _preparePosition(borrower);
        vm.warp(uint256(EXPIRY) + 1);

        vm.prank(borrower);
        vm.expectRevert(LendingPool.CredentialExpired.selector);
        pool.borrow(1, validProof, proofInputs);
    }

    function testWrongChainBindingIsRejected() public {
        _preparePosition(borrower);
        vm.chainId(1);

        vm.prank(borrower);
        vm.expectRevert(LendingPool.WrongChain.selector);
        pool.borrow(1, validProof, proofInputs);
    }

    function testWrongPolicyIsRejected() public {
        _preparePosition(borrower);
        uint256[9] memory changedInputs = proofInputs;
        changedInputs[2] = 1;

        vm.prank(borrower);
        vm.expectRevert(LendingPool.WrongPolicy.selector);
        pool.borrow(1, validProof, changedInputs);
    }

    function testWrongLendingPoolBindingIsRejected() public {
        _preparePosition(borrower);
        uint256[9] memory changedInputs = proofInputs;
        changedInputs[8] = uint256(uint160(address(this)));

        vm.prank(borrower);
        vm.expectRevert(LendingPool.WrongLendingPool.selector);
        pool.borrow(1, validProof, changedInputs);
    }

    function testZeroAmountOperationsAreRejected() public {
        vm.prank(SUPPLIER);
        vm.expectRevert(LendingPool.ZeroAmount.selector);
        pool.supply(0);

        vm.prank(borrower);
        vm.expectRevert(LendingPool.ZeroAmount.selector);
        pool.depositCollateral(0);
    }

    function testDecimalNormalizationForDifferentTokenDecimals() public {
        ControlledTestToken loan18 = new ControlledTestToken("Loan 18", "L18", 18, 10 ** 27, address(this));
        ControlledTestToken collateral6 = new ControlledTestToken("Collateral 6", "C6", 6, 10 ** 15, address(this));
        LendingPool reverseDecimalsPool = new LendingPool(registry, verifier, loan18, collateral6);
        require(
            reverseDecimalsPool.borrowingCapacityForCollateral(1_000 * 10 ** 6) == 500 * 10 ** 18,
            "6-to-18 decimal conversion incorrect"
        );

        ControlledTestToken loan0 = new ControlledTestToken("Loan 0", "L0", 0, 10 ** 6, address(this));
        ControlledTestToken collateral0 = new ControlledTestToken("Collateral 0", "C0", 0, 10 ** 6, address(this));
        LendingPool zeroDecimalsPool = new LendingPool(registry, verifier, loan0, collateral0);
        require(zeroDecimalsPool.borrowingCapacityForCollateral(2) == 1, "zero-decimal conversion incorrect");
    }

    function testReentrantCollateralTokenCannotEnterPoolTwice() public {
        ControlledTestToken loan = new ControlledTestToken("Loan", "LOAN", 6, 10 ** 15, address(this));
        ReentrantTestToken collateral = new ReentrantTestToken(address(this));
        LendingPool reentrancyPool = new LendingPool(registry, verifier, loan, collateral);
        collateral.mint(borrower, 2 * COLLATERAL_UNIT);
        vm.prank(borrower);
        collateral.approve(address(reentrancyPool), 2 * COLLATERAL_UNIT);
        collateral.configureReentry(
            address(reentrancyPool), abi.encodeCall(reentrancyPool.depositCollateral, (COLLATERAL_UNIT))
        );

        vm.prank(borrower);
        reentrancyPool.depositCollateral(COLLATERAL_UNIT);
        require(collateral.reentryBlocked(), "nested pool call was not blocked");
        require(reentrancyPool.collateralBalance(borrower) == COLLATERAL_UNIT, "reentry changed collateral accounting");
    }

    function _preparePosition(address account) private {
        _supplyLiquidity();
        _depositCollateral(account);
    }

    function _supplyLiquidity() private {
        vm.prank(SUPPLIER);
        pool.supply(SUPPLY_AMOUNT);
    }

    function _depositCollateral(address account) private {
        vm.prank(account);
        pool.depositCollateral(COLLATERAL_AMOUNT);
    }

    function _approveFor(address account, address spender) private {
        vm.prank(account);
        lendingAsset.approve(spender, type(uint256).max);
        vm.prank(account);
        collateralAsset.approve(spender, type(uint256).max);
    }

    function _recordCredential(address wallet, bytes32 commitment, uint64 expiresAt) private {
        vm.prank(ISSUER);
        registry.recordCredential(wallet, LENDING_POLICY_ID, commitment, expiresAt, uint64(1));
    }

    function _deployOtherPool() private returns (LendingPool) {
        return LendingPool(
            _deploy(
                keccak256("GIWA_LENDING_TEST_POOL_TWO_V1"),
                abi.encodePacked(
                    type(LendingPool).creationCode,
                    abi.encode(registry, verifier, lendingAsset, collateralAsset)
                )
            )
        );
    }

    function _deploy(bytes32 salt, bytes memory initCode) private returns (address) {
        return Create2TestDeployer(CREATE2_FACTORY).deploy(salt, initCode);
    }

    function _proofInputs() private view returns (uint256[9] memory inputs) {
        string memory json = vm.readFile("../circuits/testdata/lending-public-inputs.json");
        for (uint256 i; i < inputs.length; i++) {
            inputs[i] = uint256(vm.parseJsonBytes32(json, string.concat("$[", _uintString(i), "]")));
        }
    }

    function _proof() private view returns (bytes memory) {
        string memory encoded = vm.readFile("../circuits/testdata/lending-proof.hex");
        return vm.parseBytes(string.concat("0x", encoded));
    }

    function _uintString(uint256 value) private pure returns (string memory) {
        if (value == 0) return "0";
        uint256 length;
        uint256 copy = value;
        while (copy != 0) {
            length++;
            copy /= 10;
        }
        bytes memory buffer = new bytes(length);
        while (value != 0) {
            length--;
            buffer[length] = bytes1(uint8(48 + value % 10));
            value /= 10;
        }
        return string(buffer);
    }
}
