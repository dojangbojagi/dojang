// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {DemoCredentialRegistry} from "./DemoCredentialRegistry.sol";
import {IControlledDemoAsset} from "./interfaces/IControlledDemoAsset.sol";
import {IEligibilityVerifier} from "./interfaces/IEligibilityVerifier.sol";

/// @notice One fixed-price, zero-interest, overcollateralized demo market on GIWA Sepolia.
/// @dev This market is limited to capped controlled test assets and is not production lending.
contract LendingPool is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant LENDING_POLICY_ID = 2;
    uint256 public constant LENDING_POLICY_VERSION = 1;
    uint256 public constant ELIGIBILITY_THRESHOLD = 1_000;
    uint256 public constant COLLATERAL_PRICE_WAD = 1e18;
    uint256 public constant MAX_LTV_BPS = 5_000;
    uint256 public constant INTEREST_RATE_BPS = 0;
    uint256 public constant BASIS_POINTS = 10_000;
    bytes4 public constant CONTROLLED_DEMO_ASSET_MARKER = bytes4(keccak256("GIWA_CONTROLLED_DEMO_ASSET_V1"));

    DemoCredentialRegistry public immutable registry;
    IEligibilityVerifier public immutable verifier;
    IERC20Metadata public immutable lendingAsset;
    IERC20Metadata public immutable collateralAsset;
    uint8 public immutable lendingAssetDecimals;
    uint8 public immutable collateralAssetDecimals;
    uint256 private immutable lendingAssetScale;
    uint256 private immutable collateralAssetScale;

    uint256 public totalSupplierLiquidity;
    uint256 public totalDebt;
    mapping(address supplier => uint256 amount) public supplierBalance;
    mapping(address borrower => uint256 amount) public collateralBalance;
    mapping(address borrower => uint256 amount) public debtBalance;

    error ZeroAddress();
    error UnsupportedChain();
    error InvalidMarketAsset();
    error UnsupportedTokenDecimals(uint8 decimals_);
    error ZeroAmount();
    error InsufficientSupplierPosition();
    error InsufficientLiquidity();
    error InsufficientCollateral();
    error BorrowingCapacityExceeded(uint256 requestedDebt, uint256 maxDebt);
    error RepayExceedsDebt(uint256 requestedRepayment, uint256 outstandingDebt);
    error UnsafeCollateralWithdrawal(uint256 remainingCapacity, uint256 currentDebt);
    error UnsupportedTokenBehavior();
    error MissingCredential();
    error CredentialRevoked();
    error CredentialNotYetValid();
    error CredentialExpired();
    error IssuerNotAuthorized();
    error WrongSubject();
    error WrongCommitment();
    error WrongPolicy();
    error WrongPolicyVersion();
    error WrongThreshold();
    error WrongCredentialVersion();
    error WrongExpiry();
    error WrongChain();
    error WrongLendingPool();
    error InvalidProof();

    event LiquiditySupplied(address indexed supplier, uint256 amount, uint256 supplierPosition);
    event LiquidityWithdrawn(address indexed supplier, uint256 amount, uint256 supplierPosition);
    event CollateralDeposited(address indexed borrower, uint256 amount, uint256 collateralBalance);
    event CollateralWithdrawn(address indexed borrower, uint256 amount, uint256 collateralBalance);
    event Borrowed(
        address indexed borrower,
        uint256 amount,
        uint256 outstandingDebt,
        uint64 credentialVersion,
        bytes32 commitment
    );
    event Repaid(address indexed borrower, uint256 amount, uint256 outstandingDebt);

    constructor(
        DemoCredentialRegistry registry_,
        IEligibilityVerifier verifier_,
        IERC20Metadata lendingAsset_,
        IERC20Metadata collateralAsset_
    ) {
        if (block.chainid != 91_342) revert UnsupportedChain();
        if (
            address(registry_) == address(0) || address(verifier_) == address(0)
                || address(lendingAsset_) == address(0) || address(collateralAsset_) == address(0)
        ) revert ZeroAddress();
        if (
            address(registry_).code.length == 0 || address(verifier_).code.length == 0
                || address(lendingAsset_).code.length == 0 || address(collateralAsset_).code.length == 0
                || address(lendingAsset_) == address(collateralAsset_)
        ) revert InvalidMarketAsset();

        _validateDemoAsset(IControlledDemoAsset(address(lendingAsset_)));
        _validateDemoAsset(IControlledDemoAsset(address(collateralAsset_)));

        uint8 lendingDecimals_ = lendingAsset_.decimals();
        uint8 collateralDecimals_ = collateralAsset_.decimals();
        if (lendingDecimals_ > 18) revert UnsupportedTokenDecimals(lendingDecimals_);
        if (collateralDecimals_ > 18) revert UnsupportedTokenDecimals(collateralDecimals_);

        registry = registry_;
        verifier = verifier_;
        lendingAsset = lendingAsset_;
        collateralAsset = collateralAsset_;
        lendingAssetDecimals = lendingDecimals_;
        collateralAssetDecimals = collateralDecimals_;
        lendingAssetScale = 10 ** lendingDecimals_;
        collateralAssetScale = 10 ** collateralDecimals_;
    }

    /// @notice Supply loan tokens. Supplier positions are 1:1 and accrue no interest.
    function supply(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _transferFromExact(IERC20(address(lendingAsset)), msg.sender, amount);
        supplierBalance[msg.sender] += amount;
        totalSupplierLiquidity += amount;
        emit LiquiditySupplied(msg.sender, amount, supplierBalance[msg.sender]);
    }

    /// @notice Withdraw supplier principal only from currently unborrowed liquidity.
    function withdrawSupply(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (amount > supplierBalance[msg.sender]) revert InsufficientSupplierPosition();
        if (amount > availableLiquidity()) revert InsufficientLiquidity();

        supplierBalance[msg.sender] -= amount;
        totalSupplierLiquidity -= amount;
        emit LiquidityWithdrawn(msg.sender, amount, supplierBalance[msg.sender]);
        _transferExact(IERC20(address(lendingAsset)), msg.sender, amount);
    }

    /// @notice Lock real collateral tokens in the pool's on-chain accounting.
    function depositCollateral(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _transferFromExact(IERC20(address(collateralAsset)), msg.sender, amount);
        collateralBalance[msg.sender] += amount;
        emit CollateralDeposited(msg.sender, amount, collateralBalance[msg.sender]);
    }

    /// @notice Withdraw collateral only if the remaining position still covers all debt.
    function withdrawCollateral(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        uint256 currentCollateral = collateralBalance[msg.sender];
        if (amount > currentCollateral) revert InsufficientCollateral();

        uint256 remainingCollateral = currentCollateral - amount;
        uint256 remainingCapacity = borrowingCapacityForCollateral(remainingCollateral);
        uint256 currentDebt = debtBalance[msg.sender];
        if (currentDebt > remainingCapacity) {
            revert UnsafeCollateralWithdrawal(remainingCapacity, currentDebt);
        }

        collateralBalance[msg.sender] = remainingCollateral;
        emit CollateralWithdrawn(msg.sender, amount, remainingCollateral);
        _transferExact(IERC20(address(collateralAsset)), msg.sender, amount);
    }

    /// @notice Borrow against collateral after a fresh, lending-domain-bound ZK eligibility proof.
    /// @dev Proofs authorize eligibility, not an amount. Reuse can never exceed the live LTV or pool liquidity.
    function borrow(uint256 amount, bytes calldata proof, uint256[9] calldata publicInputs)
        external
        nonReentrant
    {
        if (amount == 0) revert ZeroAmount();

        uint256 currentCollateral = collateralBalance[msg.sender];
        if (currentCollateral == 0) revert InsufficientCollateral();
        uint256 nextDebt = debtBalance[msg.sender] + amount;
        uint256 capacity = borrowingCapacity(msg.sender);
        if (nextDebt > capacity) revert BorrowingCapacityExceeded(nextDebt, capacity);
        if (amount > availableLiquidity()) revert InsufficientLiquidity();

        DemoCredentialRegistry.Credential memory credential = _validateEligibility(msg.sender, proof, publicInputs);

        debtBalance[msg.sender] = nextDebt;
        totalDebt += amount;
        emit Borrowed(msg.sender, amount, nextDebt, credential.version, credential.commitment);
        _transferExact(IERC20(address(lendingAsset)), msg.sender, amount);
    }

    /// @notice Repay some or all of the caller's outstanding principal. No interest accrues.
    function repay(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        uint256 currentDebt = debtBalance[msg.sender];
        if (amount > currentDebt) revert RepayExceedsDebt(amount, currentDebt);

        debtBalance[msg.sender] = currentDebt - amount;
        totalDebt -= amount;
        emit Repaid(msg.sender, amount, debtBalance[msg.sender]);
        _transferFromExact(IERC20(address(lendingAsset)), msg.sender, amount);
    }

    /// @notice Maximum loan-asset base units supported by a collateral amount at the fixed demo price.
    function borrowingCapacityForCollateral(uint256 collateralAmount) public view returns (uint256) {
        uint256 collateralValueWad = Math.mulDiv(collateralAmount, COLLATERAL_PRICE_WAD, collateralAssetScale);
        uint256 valueInLendingUnits = Math.mulDiv(collateralValueWad, lendingAssetScale, 1e18);
        return Math.mulDiv(valueInLendingUnits, MAX_LTV_BPS, BASIS_POINTS);
    }

    function collateralValue(address borrower) public view returns (uint256) {
        return Math.mulDiv(
            Math.mulDiv(collateralBalance[borrower], COLLATERAL_PRICE_WAD, collateralAssetScale),
            lendingAssetScale,
            1e18
        );
    }

    function borrowingCapacity(address borrower) public view returns (uint256) {
        return borrowingCapacityForCollateral(collateralBalance[borrower]);
    }

    function remainingBorrowCapacity(address borrower) external view returns (uint256) {
        uint256 capacity = borrowingCapacity(borrower);
        uint256 currentDebt = debtBalance[borrower];
        return capacity > currentDebt ? capacity - currentDebt : 0;
    }

    /// @notice Tracked unborrowed supplier principal, capped by the actual ERC20 balance.
    function availableLiquidity() public view returns (uint256) {
        if (totalDebt > totalSupplierLiquidity) return 0;
        uint256 accountingLiquidity = totalSupplierLiquidity - totalDebt;
        uint256 actualBalance = lendingAsset.balanceOf(address(this));
        return actualBalance < accountingLiquidity ? actualBalance : accountingLiquidity;
    }

    function _validateEligibility(address borrower, bytes calldata proof, uint256[9] calldata publicInputs)
        private
        view
        returns (DemoCredentialRegistry.Credential memory credential)
    {
        if (proof.length == 0) revert InvalidProof();
        credential = registry.getCredential(borrower, LENDING_POLICY_ID);
        if (credential.wallet != borrower || credential.issuer == address(0)) revert MissingCredential();
        if (credential.revoked) revert CredentialRevoked();
        if (credential.issuedAt > block.timestamp) revert CredentialNotYetValid();
        if (credential.expiresAt <= block.timestamp) revert CredentialExpired();
        if (!registry.hasRole(registry.ISSUER_ROLE(), credential.issuer)) revert IssuerNotAuthorized();

        if (publicInputs[0] != uint256(uint160(borrower))) revert WrongSubject();
        if (publicInputs[1] != uint256(credential.commitment)) revert WrongCommitment();
        if (publicInputs[2] != LENDING_POLICY_ID) revert WrongPolicy();
        if (publicInputs[3] != LENDING_POLICY_VERSION) revert WrongPolicyVersion();
        if (publicInputs[4] != ELIGIBILITY_THRESHOLD) revert WrongThreshold();
        if (publicInputs[5] != credential.version) revert WrongCredentialVersion();
        if (publicInputs[6] != credential.expiresAt) revert WrongExpiry();
        if (publicInputs[7] != block.chainid) revert WrongChain();
        if (publicInputs[8] != uint256(uint160(address(this)))) revert WrongLendingPool();

        if (!verifier.verifyProof(proof, publicInputs)) revert InvalidProof();
    }

    function _validateDemoAsset(IControlledDemoAsset asset) private view {
        try asset.controlledDemoAssetMarker() returns (bytes4 marker) {
            if (marker != CONTROLLED_DEMO_ASSET_MARKER || asset.mintCap() == 0) revert InvalidMarketAsset();
        } catch {
            revert InvalidMarketAsset();
        }
    }

    function _transferFromExact(IERC20 token, address from, uint256 amount) private {
        uint256 senderBefore = token.balanceOf(from);
        uint256 poolBefore = token.balanceOf(address(this));
        token.safeTransferFrom(from, address(this), amount);
        uint256 senderAfter = token.balanceOf(from);
        uint256 poolAfter = token.balanceOf(address(this));
        if (
            senderBefore < senderAfter || senderBefore - senderAfter != amount || poolAfter < poolBefore
                || poolAfter - poolBefore != amount
        ) revert UnsupportedTokenBehavior();
    }

    function _transferExact(IERC20 token, address recipient, uint256 amount) private {
        uint256 poolBefore = token.balanceOf(address(this));
        uint256 recipientBefore = token.balanceOf(recipient);
        token.safeTransfer(recipient, amount);
        uint256 poolAfter = token.balanceOf(address(this));
        uint256 recipientAfter = token.balanceOf(recipient);
        if (
            poolBefore < poolAfter || poolBefore - poolAfter != amount || recipientAfter < recipientBefore
                || recipientAfter - recipientBefore != amount
        ) revert UnsupportedTokenBehavior();
    }
}
