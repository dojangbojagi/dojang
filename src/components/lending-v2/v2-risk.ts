import { LENDING_V2_RAY } from "@/lib/lending/v2-config";
export { repayAllowanceHeadroom } from "@/lib/lending/v2-transaction-safety";
import type { LendingV2AccountData, LendingV2MarketSnapshot } from "@/lib/lending/v2-service";

/* Presentation-only reading of what the pool already reported, and clearly labelled previews.
   Nothing here decides whether an action is allowed: the pool and its simulation do that. The bands are the
   protocol's own boundaries (borrowing capacity, health factor 1.0), not thresholds invented in the interface. */

export type PositionBand = "no-debt" | "within-limit" | "above-limit" | "liquidatable" | "unavailable";

export interface PositionRisk {
  band: PositionBand;
  label: string;
  detail: string;
  /** Debt value as a share of the borrowing capacity the pool reported, in bps (can exceed 10 000 when above the limit). */
  limitUsageBps?: bigint;
  /** How far the collateral (at liquidation-threshold weights) could fall in value before health factor reaches 1.0, in bps. */
  bufferBps?: bigint;
}

type PositionSnapshot = NonNullable<LendingV2MarketSnapshot["position"]>;

export function classifyPosition(position: PositionSnapshot | undefined): PositionRisk {
  if (!position) {
    return { band: "unavailable", label: "Not available", detail: "Connect a wallet to read this position." };
  }
  const account = position.account;
  if (position.riskMetricsState === "blocked-by-oracle" || !account) {
    return {
      band: "unavailable",
      label: "Blocked by the oracle",
      detail: "A price this position depends on is not fresh, so the pool cannot report risk metrics. Nothing is estimated in its place.",
    };
  }
  if (account.debtValueWad === 0n) {
    return { band: "no-debt", label: "No debt", detail: "There is no outstanding debt, so nothing can be liquidated." };
  }
  const limitUsageBps = account.ltvCapacityWad > 0n ? (account.debtValueWad * 10_000n) / account.ltvCapacityWad : undefined;
  const bufferBps = account.liquidationValueWad > account.debtValueWad
    ? ((account.liquidationValueWad - account.debtValueWad) * 10_000n) / account.liquidationValueWad
    : 0n;
  if (position.liquidationEligible) {
    return {
      band: "liquidatable",
      label: "Liquidatable",
      detail: "The health factor is below 1.0. Anyone may repay part of this debt and seize collateral at the reserve's bonus.",
      limitUsageBps,
      bufferBps,
    };
  }
  if (account.debtValueWad > account.ltvCapacityWad) {
    return {
      band: "above-limit",
      label: "Above the borrowing limit",
      detail: "Debt is above the maximum loan-to-value capacity but the health factor is still above 1.0. New borrowing and risky withdrawals are blocked; repay or add collateral.",
      limitUsageBps,
      bufferBps,
    };
  }
  return {
    band: "within-limit",
    label: "Within the borrowing limit",
    detail: "Debt is inside the borrowing capacity the pool reported for the collateral you enabled.",
    limitUsageBps,
    bufferBps,
  };
}

export interface BorrowPreview {
  /** Debt value after the borrow, in WAD. */
  debtValueWad: bigint;
  /** Health factor after the borrow, RAY. Undefined when the position would have no liquidation value to compare. */
  healthFactorRay: bigint | undefined;
  limitUsageBps: bigint | undefined;
  withinLimit: boolean;
}

/**
 * An ESTIMATE shown before signing, built only from values the pool already returned: the account's liquidation
 * value and debt value, the asset's oracle price and decimals. It uses the same definitions the pool documents
 * (value = amount * price / 10^decimals, rounded up for debt; health factor = liquidation value / debt, RAY).
 * It is not a confirmed outcome: the transaction is simulated by the contract before it is offered for signature.
 */
export function previewBorrow(input: {
  account: LendingV2AccountData;
  priceWad: bigint;
  decimals: number;
  amount: bigint;
}): BorrowPreview {
  const unit = 10n ** BigInt(input.decimals);
  const addedValue = (input.amount * input.priceWad + unit - 1n) / unit;
  const debtValueWad = input.account.debtValueWad + addedValue;
  const healthFactorRay = debtValueWad > 0n ? (input.account.liquidationValueWad * LENDING_V2_RAY) / debtValueWad : undefined;
  const limitUsageBps = input.account.ltvCapacityWad > 0n ? (debtValueWad * 10_000n) / input.account.ltvCapacityWad : undefined;
  return { debtValueWad, healthFactorRay, limitUsageBps, withinLimit: debtValueWad <= input.account.ltvCapacityWad };
}

/**
 * Debt grows every second a repayment is waiting. To repay in full, the pool must be allowed to take slightly more
 * than the debt that was displayed. This is only the size of the ALLOWANCE (the pool takes the real debt, never
 * more): the current borrow rate applied for a short window, plus one unit for rounding.
 */
