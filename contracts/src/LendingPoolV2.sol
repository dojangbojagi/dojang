// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {DemoCredentialRegistry} from "./DemoCredentialRegistry.sol";
import {IControlledDemoAsset} from "./interfaces/IControlledDemoAsset.sol";
import {IEligibilityVerifier} from "./interfaces/IEligibilityVerifier.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
import {UtilizationRateModel} from "./UtilizationRateModel.sol";

/// @notice Multi-reserve, overcollateralized lending engine for supported testnet demo tokens.
/// @dev Eligibility credentials are project-issued. This contract is not an official Dojang integration.
contract LendingPoolV2 is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant GIWA_SEPOLIA_CHAIN_ID = 91_342;
    uint256 public constant ROBINHOOD_TESTNET_CHAIN_ID = 46_630;
    uint256 public constant POLICY_ID = 3;
    uint256 public constant POLICY_VERSION = 1;
    uint256 public constant ELIGIBILITY_THRESHOLD = 1_000;
    uint256 public constant BASIS_POINTS = 10_000;
    uint256 public constant RAY = 1e27;
    uint256 public constant YEAR = 365 days;
    uint256 public constant MAX_RESERVES = 8;
    uint256 public constant MAX_RATE_BPS = 100_000;
    bytes4 public constant CONTROLLED_DEMO_ASSET_MARKER = bytes4(keccak256("GIWA_CONTROLLED_DEMO_ASSET_V1"));

    bytes32 public constant RISK_ADMIN_ROLE = keccak256("RISK_ADMIN_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    struct ReserveConfig {
        uint256 supplyCap;
        uint256 borrowCap;
        uint256 collateralCap;
        uint256 minBorrowAmount;
        uint64 maxOracleAge;
        uint16 maxLtvBps;
        uint16 liquidationThresholdBps;
        uint16 liquidationBonusBps;
        uint16 closeFactorBps;
        uint16 reserveFactorBps;
        uint16 optimalUtilizationBps;
        uint16 baseBorrowRateBps;
        uint16 slope1Bps;
        uint16 slope2Bps;
        bool active;
        bool supplyEnabled;
        bool borrowEnabled;
        bool collateralEnabled;
    }

    struct Reserve {
        ReserveConfig config;
        uint8 decimals;
        uint40 lastAccrued;
        uint256 liquidityIndex;
        uint256 borrowIndex;
        uint256 totalSupplyShares;
        uint256 totalBorrowShares;
        uint256 totalCollateral;
        uint256 accruedProtocolFees;
        bool initialized;
    }

    struct ReserveData {
        uint8 decimals;
        uint256 liquidityIndex;
        uint256 borrowIndex;
        uint256 totalSupplyAssets;
        uint256 totalDebtAssets;
        uint256 availableLiquidity;
        uint256 utilizationBps;
        uint256 currentBorrowRateBps;
        uint256 currentSupplyRateBps;
        uint256 accruedProtocolFees;
        ReserveConfig config;
    }

    struct ReserveProjection {
        uint256 liquidityIndex;
        uint256 borrowIndex;
        uint256 totalDebt;
        uint256 borrowRateBps;
        uint256 supplierInterest;
        uint256 feeDelta;
    }

    struct AccountData {
        uint256 collateralValueWad;
        uint256 ltvCapacityWad;
        uint256 liquidationValueWad;
        uint256 debtValueWad;
        uint256 currentLtvBps;
        uint256 healthFactorWad;
    }

    DemoCredentialRegistry public immutable credentialRegistry;
    IEligibilityVerifier public immutable eligibilityVerifier;
    IPriceOracle public immutable priceOracle;

    address[] private reserveAssets;
    mapping(address asset => Reserve reserve) private reserves;
    mapping(address asset => mapping(address user => uint256 shares)) private supplyShares;
    mapping(address asset => mapping(address user => uint256 shares)) private debtShares;
    mapping(address asset => mapping(address user => uint256 amount)) private collateralBalances;
    mapping(address asset => mapping(address user => bool enabled)) public collateralEnabled;

    error UnsupportedChain();
    error ZeroAddress();
    error ZeroAmount();
    error TooManyReserves();
    error ReserveNotConfigured(address asset);
    error ReserveInactive(address asset);
    error ReserveSupplyDisabled(address asset);
    error ReserveBorrowDisabled(address asset);
    error ReserveCollateralDisabled(address asset);
    error InvalidReserveConfiguration();
    error UnsupportedTokenDecimals(uint8 decimals_);
    error InvalidDemoAsset(address asset);
    error SupplyCapExceeded(address asset, uint256 requestedTotal, uint256 cap);
    error BorrowCapExceeded(address asset, uint256 requestedTotal, uint256 cap);
    error CollateralCapExceeded(address asset, uint256 requestedTotal, uint256 cap);
    error InsufficientSupplierPosition(address asset, uint256 requested, uint256 available);
    error InsufficientLiquidity(address asset, uint256 requested, uint256 available);
    error InsufficientCollateral(address asset, uint256 requested, uint256 available);
    error BorrowBelowMinimum(address asset, uint256 requested, uint256 minimum);
    error BorrowingCapacityExceeded(uint256 requestedDebtValueWad, uint256 capacityWad);
    error UnsafePosition(uint256 healthFactorWad, uint256 debtValueWad, uint256 ltvCapacityWad);
    error NoDebt(address asset, address borrower);
    error PositionHealthy(uint256 healthFactorWad);
    error CollateralNotEnabled(address borrower, address asset);
    error LiquidationCloseFactorExceeded(uint256 requested, uint256 maximum);
    error LiquidationCollateralInsufficient(uint256 requested, uint256 available);
    error OracleUnavailable(address asset);
    error InvalidOraclePrice(address asset);
    error StaleOraclePrice(address asset, uint64 updatedAt, uint64 maxAge);
    error FutureOraclePrice(address asset, uint64 updatedAt);
    error UnsupportedTokenBehavior(address asset);
    error MissingCredential(address wallet);
    error CredentialRevoked(address wallet);
    error CredentialNotYetValid(address wallet);
    error CredentialExpired(address wallet);
    error IssuerNotAuthorized(address issuer);
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
    error ZeroShares();
    error ProtocolFeeLimitExceeded();

    event ReserveConfigured(address indexed asset, ReserveConfig config, uint8 decimals);
    event LiquiditySupplied(address indexed asset, address indexed supplier, uint256 amount, uint256 shares);
    event LiquidityWithdrawn(address indexed asset, address indexed supplier, uint256 amount, uint256 shares);
    event CollateralDeposited(address indexed asset, address indexed user, uint256 amount, uint256 balance);
    event CollateralWithdrawn(address indexed asset, address indexed user, uint256 amount, uint256 balance);
    event CollateralUseChanged(address indexed asset, address indexed user, bool enabled);
    event Borrowed(
        address indexed asset,
        address indexed borrower,
        uint256 amount,
        uint256 debtBalance,
        uint64 credentialVersion,
        bytes32 commitment
    );
    event Repaid(address indexed asset, address indexed borrower, uint256 amount, uint256 debtBalance);
    event Liquidated(
        address indexed debtAsset,
        address indexed collateralAsset,
        address indexed borrower,
        address liquidator,
        uint256 repaidAmount,
        uint256 seizedCollateral
    );
    event InterestAccrued(
        address indexed asset,
        uint256 borrowRateBps,
        uint256 supplierInterest,
        uint256 protocolFee
    );
    event ProtocolFeesWithdrawn(address indexed asset, address indexed recipient, uint256 amount);

    constructor(
        DemoCredentialRegistry credentialRegistry_,
        IEligibilityVerifier eligibilityVerifier_,
        IPriceOracle priceOracle_,
        address admin_
    ) {
        if (
            block.chainid != GIWA_SEPOLIA_CHAIN_ID && block.chainid != ROBINHOOD_TESTNET_CHAIN_ID
        ) revert UnsupportedChain();
        if (
            address(credentialRegistry_) == address(0) || address(eligibilityVerifier_) == address(0)
                || address(priceOracle_) == address(0) || admin_ == address(0)
        ) revert ZeroAddress();
        if (
            address(credentialRegistry_).code.length == 0 || address(eligibilityVerifier_).code.length == 0
                || address(priceOracle_).code.length == 0
        ) revert ZeroAddress();

        credentialRegistry = credentialRegistry_;
        eligibilityVerifier = eligibilityVerifier_;
        priceOracle = priceOracle_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(RISK_ADMIN_ROLE, admin_);
        _grantRole(PAUSER_ROLE, admin_);
    }

    function reserveCount() external view returns (uint256) {
        return reserveAssets.length;
    }

    function getReserveAssets() external view returns (address[] memory) {
        return reserveAssets;
    }

    function getReserveConfig(address asset) external view returns (ReserveConfig memory) {
        _requireReserve(asset);
        return reserves[asset].config;
    }

    function configureReserve(address asset, ReserveConfig calldata config) external onlyRole(RISK_ADMIN_ROLE) {
        if (asset == address(0) || asset.code.length == 0) revert ZeroAddress();
        Reserve storage reserve = reserves[asset];
        if (!reserve.initialized) {
            if (reserveAssets.length >= MAX_RESERVES) revert TooManyReserves();
            uint8 decimals_ = 0;
            try IERC20Metadata(asset).decimals() returns (uint8 tokenDecimals) {
                decimals_ = tokenDecimals;
            } catch {
                revert InvalidDemoAsset(asset);
            }
            if (decimals_ > 18) revert UnsupportedTokenDecimals(decimals_);
            _validateDemoAsset(asset);
            reserve.decimals = decimals_;
            reserve.liquidityIndex = RAY;
            reserve.borrowIndex = RAY;
            reserve.lastAccrued = uint40(block.timestamp);
            reserve.initialized = true;
            reserveAssets.push(asset);
        } else {
            _accrueReserve(asset);
        }

        _validateReserveConfig(config);
        reserve.config = config;
        emit ReserveConfigured(asset, config, reserve.decimals);
    }

    function pauseRisk() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpauseRisk() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /// @notice All new supply is gated by the project's test credential and V2-bound proof.
    function supply(address asset, uint256 amount, bytes calldata proof, uint256[9] calldata publicInputs)
        external
        nonReentrant
        whenNotPaused
    {
        if (amount == 0) revert ZeroAmount();
        Reserve storage reserve = _requireReserve(asset);
        if (!reserve.config.active) revert ReserveInactive(asset);
        if (!reserve.config.supplyEnabled) revert ReserveSupplyDisabled(asset);
        _validateEligibility(msg.sender, proof, publicInputs);
        _accrueReserve(asset);

        uint256 currentSupply = _supplyAssets(reserve, reserve.liquidityIndex);
        if (currentSupply + amount > reserve.config.supplyCap) {
            revert SupplyCapExceeded(asset, currentSupply + amount, reserve.config.supplyCap);
        }
        uint256 shares = Math.mulDiv(amount, RAY, reserve.liquidityIndex);
        if (shares == 0) revert ZeroShares();

        _transferFromExact(asset, msg.sender, amount);
        supplyShares[asset][msg.sender] += shares;
        reserve.totalSupplyShares += shares;
        emit LiquiditySupplied(asset, msg.sender, amount, shares);
    }

    function withdrawSupply(address asset, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        Reserve storage reserve = _requireReserve(asset);
        _accrueReserve(asset);
        uint256 userShares = supplyShares[asset][msg.sender];
        uint256 userBalance = Math.mulDiv(userShares, reserve.liquidityIndex, RAY);
        if (amount > userBalance) revert InsufficientSupplierPosition(asset, amount, userBalance);
        uint256 liquidity = _availableLiquidity(asset, reserve);
        if (amount > liquidity) revert InsufficientLiquidity(asset, amount, liquidity);

        uint256 shares = amount == userBalance
            ? userShares
            : Math.mulDiv(amount, RAY, reserve.liquidityIndex, Math.Rounding.Ceil);
        if (shares == 0 || shares > userShares) revert ZeroShares();
        supplyShares[asset][msg.sender] = userShares - shares;
        reserve.totalSupplyShares -= shares;
        _transferExact(asset, msg.sender, amount);
        emit LiquidityWithdrawn(asset, msg.sender, amount, shares);
    }

    /// @notice Collateral deposits do not require eligibility: they only reduce protocol risk.
    function depositCollateral(address asset, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        Reserve storage reserve = _requireReserve(asset);
        if (!reserve.config.active) revert ReserveInactive(asset);
        if (!reserve.config.collateralEnabled) revert ReserveCollateralDisabled(asset);
        uint256 nextTotal = reserve.totalCollateral + amount;
        if (nextTotal > reserve.config.collateralCap) {
            revert CollateralCapExceeded(asset, nextTotal, reserve.config.collateralCap);
        }

        _transferFromExact(asset, msg.sender, amount);
        reserve.totalCollateral = nextTotal;
        collateralBalances[asset][msg.sender] += amount;
        emit CollateralDeposited(asset, msg.sender, amount, collateralBalances[asset][msg.sender]);
    }

    /// @notice Enabling collateral adds borrowing capacity and therefore requires a fresh V2 proof.
    function setCollateralEnabled(
        address asset,
        bool enabled,
        bytes calldata proof,
        uint256[9] calldata publicInputs
    ) external nonReentrant whenNotPaused {
        Reserve storage reserve = _requireReserve(asset);
        if (!reserve.config.active) revert ReserveInactive(asset);
        if (enabled) {
            if (!reserve.config.collateralEnabled) revert ReserveCollateralDisabled(asset);
            if (collateralBalances[asset][msg.sender] == 0) revert InsufficientCollateral(asset, 1, 0);
            _validateEligibility(msg.sender, proof, publicInputs);
        }

        collateralEnabled[asset][msg.sender] = enabled;
        if (!enabled) _requireSafePosition(msg.sender);
        emit CollateralUseChanged(asset, msg.sender, enabled);
    }

    function withdrawCollateral(address asset, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        Reserve storage reserve = _requireReserve(asset);
        uint256 current = collateralBalances[asset][msg.sender];
        if (amount > current) revert InsufficientCollateral(asset, amount, current);

        collateralBalances[asset][msg.sender] = current - amount;
        reserve.totalCollateral -= amount;
        _requireSafePosition(msg.sender);
        _transferExact(asset, msg.sender, amount);
        emit CollateralWithdrawn(asset, msg.sender, amount, current - amount);
    }

    function borrow(address asset, uint256 amount, bytes calldata proof, uint256[9] calldata publicInputs)
        external
        nonReentrant
        whenNotPaused
    {
        if (amount == 0) revert ZeroAmount();
        Reserve storage reserve = _requireReserve(asset);
        if (!reserve.config.active) revert ReserveInactive(asset);
        if (!reserve.config.borrowEnabled) revert ReserveBorrowDisabled(asset);
        if (amount < reserve.config.minBorrowAmount) {
            revert BorrowBelowMinimum(asset, amount, reserve.config.minBorrowAmount);
        }

        _accrueAllReserves();
        uint256 liquidity = _availableLiquidity(asset, reserve);
        if (amount > liquidity) revert InsufficientLiquidity(asset, amount, liquidity);
        DemoCredentialRegistry.Credential memory credential =
            _validateEligibility(msg.sender, proof, publicInputs);

        uint256 shares = Math.mulDiv(amount, RAY, reserve.borrowIndex, Math.Rounding.Ceil);
        uint256 totalDebtAfter = Math.mulDiv(
            reserve.totalBorrowShares + shares,
            reserve.borrowIndex,
            RAY,
            Math.Rounding.Ceil
        );
        if (totalDebtAfter > reserve.config.borrowCap) {
            revert BorrowCapExceeded(asset, totalDebtAfter, reserve.config.borrowCap);
        }

        debtShares[asset][msg.sender] += shares;
        reserve.totalBorrowShares += shares;
        _requireSafePosition(msg.sender);
        _transferExact(asset, msg.sender, amount);

        uint256 debtAfter = Math.mulDiv(
            debtShares[asset][msg.sender], reserve.borrowIndex, RAY, Math.Rounding.Ceil
        );
        emit Borrowed(asset, msg.sender, amount, debtAfter, credential.version, credential.commitment);
    }

    /// @notice Repayment needs neither an oracle read nor a current eligibility credential.
    function repay(address asset, uint256 amount) external nonReentrant returns (uint256 actualAmount) {
        if (amount == 0) revert ZeroAmount();
        Reserve storage reserve = _requireReserve(asset);
        _accrueReserve(asset);
        uint256 userShares = debtShares[asset][msg.sender];
        uint256 currentDebt = Math.mulDiv(userShares, reserve.borrowIndex, RAY, Math.Rounding.Ceil);
        if (currentDebt == 0) revert NoDebt(asset, msg.sender);

        uint256 shares;
        if (amount >= currentDebt) {
            shares = userShares;
            actualAmount = currentDebt;
        } else {
            shares = Math.mulDiv(amount, RAY, reserve.borrowIndex);
            if (shares == 0) revert ZeroShares();
            uint256 remainingDebt = Math.mulDiv(
                userShares - shares, reserve.borrowIndex, RAY, Math.Rounding.Ceil
            );
            actualAmount = currentDebt - remainingDebt;
        }

        debtShares[asset][msg.sender] = userShares - shares;
        reserve.totalBorrowShares -= shares;
        _transferFromExact(asset, msg.sender, actualAmount);
        uint256 debtAfter = Math.mulDiv(
            debtShares[asset][msg.sender], reserve.borrowIndex, RAY, Math.Rounding.Ceil
        );
        emit Repaid(asset, msg.sender, actualAmount, debtAfter);
    }

    /// @notice Permissionless liquidation; borrower eligibility is intentionally irrelevant.
    function liquidate(address borrower, address debtAsset, address collateralAsset, uint256 requestedRepay)
        external
        nonReentrant
    {
        if (requestedRepay == 0) revert ZeroAmount();
        Reserve storage debtReserve = _requireReserve(debtAsset);
        Reserve storage collateralReserve = _requireReserve(collateralAsset);
        _accrueAllReserves();

        uint256 healthFactor = getAccountData(borrower).healthFactorWad;
        if (healthFactor >= RAY) revert PositionHealthy(healthFactor);
        if (!collateralEnabled[collateralAsset][borrower]) {
            revert CollateralNotEnabled(borrower, collateralAsset);
        }
        (uint256 debtSharesToBurn, uint256 actualRepay) =
            _liquidationRepayment(debtAsset, borrower, requestedRepay, debtReserve);
        uint256 collateralToSeize =
            _liquidationCollateral(debtAsset, collateralAsset, actualRepay, debtReserve, collateralReserve);
        uint256 userCollateral = collateralBalances[collateralAsset][borrower];
        if (collateralToSeize > userCollateral) {
            revert LiquidationCollateralInsufficient(collateralToSeize, userCollateral);
        }

        debtShares[debtAsset][borrower] -= debtSharesToBurn;
        debtReserve.totalBorrowShares -= debtSharesToBurn;
        collateralBalances[collateralAsset][borrower] = userCollateral - collateralToSeize;
        collateralReserve.totalCollateral -= collateralToSeize;
        _transferFromExact(debtAsset, msg.sender, actualRepay);
        _transferExact(collateralAsset, msg.sender, collateralToSeize);
        emit Liquidated(debtAsset, collateralAsset, borrower, msg.sender, actualRepay, collateralToSeize);
    }

    function _liquidationRepayment(
        address debtAsset,
        address borrower,
        uint256 requestedRepay,
        Reserve storage debtReserve
    ) private view returns (uint256 sharesToBurn, uint256 actualRepay) {
        uint256 borrowerShares = debtShares[debtAsset][borrower];
        uint256 currentDebt = Math.mulDiv(borrowerShares, debtReserve.borrowIndex, RAY, Math.Rounding.Ceil);
        if (currentDebt == 0) revert NoDebt(debtAsset, borrower);
        uint256 maxClose = Math.mulDiv(
            currentDebt,
            debtReserve.config.closeFactorBps,
            BASIS_POINTS,
            Math.Rounding.Ceil
        );
        if (requestedRepay > maxClose) revert LiquidationCloseFactorExceeded(requestedRepay, maxClose);

        sharesToBurn = Math.mulDiv(requestedRepay, RAY, debtReserve.borrowIndex);
        if (sharesToBurn == 0) revert ZeroShares();
        uint256 debtAfter = Math.mulDiv(
            borrowerShares - sharesToBurn, debtReserve.borrowIndex, RAY, Math.Rounding.Ceil
        );
        actualRepay = currentDebt - debtAfter;
    }

    function _liquidationCollateral(
        address debtAsset,
        address collateralAsset,
        uint256 actualRepay,
        Reserve storage debtReserve,
        Reserve storage collateralReserve
    ) private view returns (uint256) {
        uint256 debtPrice = _freshPrice(debtAsset, debtReserve);
        uint256 collateralPrice = _freshPrice(collateralAsset, collateralReserve);
        uint256 repaymentValue = Math.mulDiv(
            actualRepay, debtPrice, 10 ** debtReserve.decimals, Math.Rounding.Ceil
        );
        uint256 seizureValue = Math.mulDiv(
            repaymentValue,
            BASIS_POINTS + collateralReserve.config.liquidationBonusBps,
            BASIS_POINTS,
            Math.Rounding.Ceil
        );
        return _valueWadToAmount(collateralReserve, seizureValue, collateralPrice);
    }

    function withdrawProtocolFees(address asset, address recipient, uint256 amount)
        external
        nonReentrant
        onlyRole(RISK_ADMIN_ROLE)
    {
        if (recipient == address(0)) revert ZeroAddress();
        Reserve storage reserve = _requireReserve(asset);
        _accrueReserve(asset);
        if (amount > reserve.accruedProtocolFees) revert ProtocolFeeLimitExceeded();
        uint256 liquidity = _availableLiquidity(asset, reserve);
        if (amount > liquidity) revert InsufficientLiquidity(asset, amount, liquidity);
        reserve.accruedProtocolFees -= amount;
        _transferExact(asset, recipient, amount);
        emit ProtocolFeesWithdrawn(asset, recipient, amount);
    }

    function getSupplyBalance(address user, address asset) public view returns (uint256) {
        Reserve storage reserve = _requireReserve(asset);
        ReserveProjection memory projection = _projectReserve(asset, reserve);
        return Math.mulDiv(supplyShares[asset][user], projection.liquidityIndex, RAY);
    }

    function getDebtBalance(address user, address asset) public view returns (uint256) {
        Reserve storage reserve = _requireReserve(asset);
        ReserveProjection memory projection = _projectReserve(asset, reserve);
        return Math.mulDiv(debtShares[asset][user], projection.borrowIndex, RAY, Math.Rounding.Ceil);
    }

    function getCollateralBalance(address user, address asset) external view returns (uint256) {
        _requireReserve(asset);
        return collateralBalances[asset][user];
    }

    function availableLiquidity(address asset) public view returns (uint256) {
        Reserve storage reserve = _requireReserve(asset);
        return _availableLiquidity(asset, reserve);
    }

    function getReserveData(address asset) external view returns (ReserveData memory data) {
        Reserve storage reserve = _requireReserve(asset);
        ReserveProjection memory projection = _projectReserve(asset, reserve);
        uint256 liquidity = _availableLiquidity(asset, reserve);
        uint256 utilization = projection.totalDebt == 0
            ? 0
            : Math.mulDiv(projection.totalDebt, BASIS_POINTS, liquidity + projection.totalDebt);
        uint256 supplyRate = Math.mulDiv(
            Math.mulDiv(projection.borrowRateBps, utilization, BASIS_POINTS),
            BASIS_POINTS - reserve.config.reserveFactorBps,
            BASIS_POINTS
        );
        data = ReserveData({
            decimals: reserve.decimals,
            liquidityIndex: projection.liquidityIndex,
            borrowIndex: projection.borrowIndex,
            totalSupplyAssets: _supplyAssets(reserve, projection.liquidityIndex),
            totalDebtAssets: projection.totalDebt,
            availableLiquidity: liquidity,
            utilizationBps: utilization,
            currentBorrowRateBps: projection.borrowRateBps,
            currentSupplyRateBps: supplyRate,
            accruedProtocolFees: reserve.accruedProtocolFees + projection.feeDelta,
            config: reserve.config
        });
    }

    function getPosition(address user, address asset)
        external
        view
        returns (uint256 supplied, uint256 collateral, uint256 debt, bool isCollateralEnabled)
    {
        Reserve storage reserve = _requireReserve(asset);
        ReserveProjection memory projection = _projectReserve(asset, reserve);
        supplied = Math.mulDiv(supplyShares[asset][user], projection.liquidityIndex, RAY);
        collateral = collateralBalances[asset][user];
        debt = Math.mulDiv(debtShares[asset][user], projection.borrowIndex, RAY, Math.Rounding.Ceil);
        isCollateralEnabled = collateralEnabled[asset][user];
    }

    function getAccountData(address user) public view returns (AccountData memory data) {
        for (uint256 i; i < reserveAssets.length; ++i) {
            address asset = reserveAssets[i];
            Reserve storage reserve = reserves[asset];
            uint256 collateralAmount = collateralBalances[asset][user];
            if (collateralAmount != 0 && collateralEnabled[asset][user]) {
                uint256 value = _amountToValueWad(reserve, collateralAmount, _freshPrice(asset, reserve));
                data.collateralValueWad += value;
                data.ltvCapacityWad += Math.mulDiv(value, reserve.config.maxLtvBps, BASIS_POINTS);
                data.liquidationValueWad +=
                    Math.mulDiv(value, reserve.config.liquidationThresholdBps, BASIS_POINTS);
            }

            ReserveProjection memory projection = _projectReserve(asset, reserve);
            uint256 userDebt = Math.mulDiv(
                debtShares[asset][user], projection.borrowIndex, RAY, Math.Rounding.Ceil
            );
            if (userDebt != 0) {
                data.debtValueWad += Math.mulDiv(
                    userDebt, _freshPrice(asset, reserve), 10 ** reserve.decimals, Math.Rounding.Ceil
                );
            }
        }

        if (data.debtValueWad == 0) {
            data.healthFactorWad = type(uint256).max;
        } else {
            data.currentLtvBps = data.collateralValueWad == 0
                ? type(uint256).max
                : Math.mulDiv(data.debtValueWad, BASIS_POINTS, data.collateralValueWad, Math.Rounding.Ceil);
            data.healthFactorWad = Math.mulDiv(data.liquidationValueWad, RAY, data.debtValueWad);
        }
    }

    function getMaxBorrowable(address user, address asset) external view returns (uint256) {
        Reserve storage reserve = _requireReserve(asset);
        AccountData memory account = getAccountData(user);
        if (account.ltvCapacityWad <= account.debtValueWad) return 0;
        uint256 availableValue = account.ltvCapacityWad - account.debtValueWad;
        uint256 price = _freshPrice(asset, reserve);
        return Math.mulDiv(availableValue, 10 ** reserve.decimals, price);
    }

    function _requireSafePosition(address user) private view {
        bool hasDebt = false;
        for (uint256 i; i < reserveAssets.length; ++i) {
            address asset = reserveAssets[i];
            Reserve storage reserve = reserves[asset];
            ReserveProjection memory projection = _projectReserve(asset, reserve);
            if (Math.mulDiv(debtShares[asset][user], projection.borrowIndex, RAY, Math.Rounding.Ceil) != 0) {
                hasDebt = true;
                break;
            }
        }
        if (!hasDebt) return;
        AccountData memory account = getAccountData(user);
        if (account.debtValueWad != 0 && (
            account.healthFactorWad < RAY || account.debtValueWad > account.ltvCapacityWad
        )) {
            revert UnsafePosition(account.healthFactorWad, account.debtValueWad, account.ltvCapacityWad);
        }
    }

    function _validateEligibility(address borrower, bytes calldata proof, uint256[9] calldata publicInputs)
        private
        view
        returns (DemoCredentialRegistry.Credential memory credential)
    {
        if (proof.length == 0) revert InvalidProof();
        credential = credentialRegistry.getCredential(borrower, POLICY_ID);
        if (credential.wallet != borrower || credential.issuer == address(0)) revert MissingCredential(borrower);
        if (credential.revoked) revert CredentialRevoked(borrower);
        if (credential.issuedAt > block.timestamp) revert CredentialNotYetValid(borrower);
        if (credential.expiresAt <= block.timestamp) revert CredentialExpired(borrower);
        if (!credentialRegistry.hasRole(credentialRegistry.ISSUER_ROLE(), credential.issuer)) {
            revert IssuerNotAuthorized(credential.issuer);
        }

        if (publicInputs[0] != uint256(uint160(borrower))) revert WrongSubject();
        if (publicInputs[1] != uint256(credential.commitment)) revert WrongCommitment();
        if (publicInputs[2] != POLICY_ID) revert WrongPolicy();
        if (publicInputs[3] != POLICY_VERSION) revert WrongPolicyVersion();
        if (publicInputs[4] != ELIGIBILITY_THRESHOLD) revert WrongThreshold();
        if (publicInputs[5] != credential.version) revert WrongCredentialVersion();
        if (publicInputs[6] != credential.expiresAt) revert WrongExpiry();
        if (publicInputs[7] != block.chainid) revert WrongChain();
        if (publicInputs[8] != uint256(uint160(address(this)))) revert WrongLendingPool();
        if (!eligibilityVerifier.verifyProof(proof, publicInputs)) revert InvalidProof();
    }

    function _validateDemoAsset(address asset) private view {
        try IERC20Metadata(asset).decimals() returns (uint8) {
            try IControlledDemoAsset(asset).controlledDemoAssetMarker() returns (bytes4 marker) {
                if (
                    marker != CONTROLLED_DEMO_ASSET_MARKER
                        || IControlledDemoAsset(asset).mintCap() == 0
                ) revert InvalidDemoAsset(asset);
            } catch {
                revert InvalidDemoAsset(asset);
            }
        } catch {
            revert InvalidDemoAsset(asset);
        }
    }

    function _validateReserveConfig(ReserveConfig calldata config) private pure {
        if (
            config.maxLtvBps > config.liquidationThresholdBps || config.liquidationThresholdBps >= BASIS_POINTS
                || config.liquidationBonusBps > 5_000 || config.closeFactorBps == 0
                || config.closeFactorBps > BASIS_POINTS || config.reserveFactorBps > BASIS_POINTS
                || config.optimalUtilizationBps == 0 || config.optimalUtilizationBps >= BASIS_POINTS
                || uint256(config.baseBorrowRateBps) + config.slope1Bps + config.slope2Bps > MAX_RATE_BPS
                || config.maxOracleAge == 0
                || (config.supplyEnabled && config.supplyCap == 0)
                || (config.borrowEnabled && (config.borrowCap == 0 || config.minBorrowAmount == 0))
                || (config.collateralEnabled && config.collateralCap == 0)
        ) revert InvalidReserveConfiguration();
    }

    function _requireReserve(address asset) private view returns (Reserve storage reserve) {
        reserve = reserves[asset];
        if (!reserve.initialized) revert ReserveNotConfigured(asset);
    }

    function _accrueAllReserves() private {
        for (uint256 i; i < reserveAssets.length; ++i) _accrueReserve(reserveAssets[i]);
    }

    function _accrueReserve(address asset) private {
        Reserve storage reserve = reserves[asset];
        ReserveProjection memory projection = _projectReserve(asset, reserve);
        uint40 now_ = uint40(block.timestamp);
        if (now_ == reserve.lastAccrued) return;
        if (projection.supplierInterest > 0 || projection.feeDelta > 0) {
            emit InterestAccrued(
                asset,
                projection.borrowRateBps,
                projection.supplierInterest,
                projection.feeDelta
            );
        }
        reserve.liquidityIndex = projection.liquidityIndex;
        reserve.borrowIndex = projection.borrowIndex;
        reserve.accruedProtocolFees += projection.feeDelta;
        reserve.lastAccrued = now_;
    }

    function _projectReserve(address asset, Reserve storage reserve)
        private
        view
        returns (ReserveProjection memory projection)
    {
        projection.liquidityIndex = reserve.liquidityIndex;
        projection.borrowIndex = reserve.borrowIndex;
        projection.totalDebt = Math.mulDiv(
            reserve.totalBorrowShares, projection.borrowIndex, RAY, Math.Rounding.Ceil
        );
        if (!reserve.initialized) return projection;

        uint256 liquidity = _availableLiquidity(asset, reserve);
        uint256 denominator = liquidity + projection.totalDebt;
        uint256 utilization = denominator == 0
            ? 0
            : Math.mulDiv(projection.totalDebt, BASIS_POINTS, denominator);
        projection.borrowRateBps = UtilizationRateModel.borrowRateBps(
            utilization,
            reserve.config.optimalUtilizationBps,
            reserve.config.baseBorrowRateBps,
            reserve.config.slope1Bps,
            reserve.config.slope2Bps
        );
        if (block.timestamp <= reserve.lastAccrued) return projection;

        uint256 elapsed = block.timestamp - reserve.lastAccrued;
        uint256 rateRayPerSecond = Math.mulDiv(projection.borrowRateBps, RAY, BASIS_POINTS * YEAR);
        uint256 growthRay = rateRayPerSecond * elapsed;
        projection.borrowIndex += Math.mulDiv(projection.borrowIndex, growthRay, RAY);
        uint256 updatedDebt = Math.mulDiv(
            reserve.totalBorrowShares, projection.borrowIndex, RAY, Math.Rounding.Ceil
        );
        uint256 interest = updatedDebt > projection.totalDebt ? updatedDebt - projection.totalDebt : 0;
        projection.supplierInterest =
            Math.mulDiv(interest, BASIS_POINTS - reserve.config.reserveFactorBps, BASIS_POINTS);
        projection.feeDelta = interest - projection.supplierInterest;
        if (reserve.totalSupplyShares != 0 && projection.supplierInterest != 0) {
            projection.liquidityIndex +=
                Math.mulDiv(projection.supplierInterest, RAY, reserve.totalSupplyShares);
        } else {
            projection.feeDelta += projection.supplierInterest;
            projection.supplierInterest = 0;
        }
        projection.totalDebt = updatedDebt;
    }

    function _supplyAssets(Reserve storage reserve, uint256 liquidityIndex) private view returns (uint256) {
        return Math.mulDiv(reserve.totalSupplyShares, liquidityIndex, RAY);
    }

    function _availableLiquidity(address asset, Reserve storage reserve) private view returns (uint256) {
        uint256 balance = IERC20(asset).balanceOf(address(this));
        return balance > reserve.totalCollateral ? balance - reserve.totalCollateral : 0;
    }

    function _freshPrice(address asset, Reserve storage reserve) private view returns (uint256 priceWad) {
        uint64 updatedAt = 0;
        try priceOracle.getPrice(asset) returns (uint256 reportedPrice, uint64 reportedAt) {
            priceWad = reportedPrice;
            updatedAt = reportedAt;
        } catch {
            revert OracleUnavailable(asset);
        }
        if (priceWad == 0) revert InvalidOraclePrice(asset);
        if (updatedAt > block.timestamp) revert FutureOraclePrice(asset, updatedAt);
        if (block.timestamp - updatedAt > reserve.config.maxOracleAge) {
            revert StaleOraclePrice(asset, updatedAt, reserve.config.maxOracleAge);
        }
    }

    function _amountToValueWad(Reserve storage reserve, uint256 amount, uint256 priceWad)
        private
        view
        returns (uint256)
    {
        return Math.mulDiv(amount, priceWad, 10 ** reserve.decimals);
    }

    function _valueWadToAmount(Reserve storage reserve, uint256 valueWad, uint256 priceWad)
        private
        view
        returns (uint256)
    {
        return Math.mulDiv(valueWad, 10 ** reserve.decimals, priceWad, Math.Rounding.Ceil);
    }

    function _transferFromExact(address asset, address from, uint256 amount) private {
        IERC20 token = IERC20(asset);
        uint256 senderBefore = token.balanceOf(from);
        uint256 poolBefore = token.balanceOf(address(this));
        token.safeTransferFrom(from, address(this), amount);
        uint256 senderAfter = token.balanceOf(from);
        uint256 poolAfter = token.balanceOf(address(this));
        if (
            senderBefore < senderAfter || senderBefore - senderAfter != amount || poolAfter < poolBefore
                || poolAfter - poolBefore != amount
        ) revert UnsupportedTokenBehavior(asset);
    }

    function _transferExact(address asset, address recipient, uint256 amount) private {
        IERC20 token = IERC20(asset);
        uint256 poolBefore = token.balanceOf(address(this));
        uint256 recipientBefore = token.balanceOf(recipient);
        token.safeTransfer(recipient, amount);
        uint256 poolAfter = token.balanceOf(address(this));
        uint256 recipientAfter = token.balanceOf(recipient);
        if (
            poolBefore < poolAfter || poolBefore - poolAfter != amount || recipientAfter < recipientBefore
                || recipientAfter - recipientBefore != amount
        ) revert UnsupportedTokenBehavior(asset);
    }
}
