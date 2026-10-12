export const REPAY_ALLOWANCE_WINDOW_SECONDS = 900n;
const BPS = 10_000n;
const SECONDS_PER_YEAR = 31_536_000n;
export const TRANSACTION_GAS_HEADROOM_BPS = 12_000n;

/** Exact allowance margin for a short confirmation window; the pool still pulls only the debt owed. */
export function repayAllowanceHeadroom(debt: bigint, borrowRateBps: bigint): bigint {
  const accrued = (debt * borrowRateBps * REPAY_ALLOWANCE_WINDOW_SECONDS + (BPS * SECONDS_PER_YEAR) - 1n) /
    (BPS * SECONDS_PER_YEAR);
  return accrued + 1n;
}

/** Minimum native balance using a conservative 20% margin over the current estimate and max fee. */
export function requiredNativeGasBalance(estimatedGas: bigint, maxFeePerGas: bigint): bigint {
  if (estimatedGas <= 0n || maxFeePerGas <= 0n) throw new RangeError("Gas and fee estimates must be positive.");
  return (estimatedGas * maxFeePerGas * TRANSACTION_GAS_HEADROOM_BPS + BPS - 1n) / BPS;
}
