import { maxUint256 } from "viem";
import { formatAmount } from "@/components/lending/format";
import type { LendingV2OracleState, LendingV2ReserveSnapshot } from "@/lib/lending/v2-service";

/* Presentation helpers only. Every number is produced by the pool, the oracle or the token; these functions turn
   base units, basis points, WAD and RAY values into text. No lending rule lives here. */

const ABSURD_BPS = 1_000_000_000n;

/** 5000 -> "50%", 225 -> "2.25%". Values the contract uses as "infinite" (uint256 max) read as "n/a". */
export function formatBps(value: bigint | number): string {
  const big = typeof value === "bigint" ? value : BigInt(Math.trunc(value));
  if (big >= ABSURD_BPS) return "n/a";
  const hundredths = Number(big);
  const text = (hundredths / 100).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  return `${text}%`;
}

/** 18-decimal WAD values (prices and valuations) in the oracle's test quote unit. */
export function formatWad(value: bigint, maxFraction = 4): string {
  return formatAmount(value, 18, maxFraction);
}

/** Health factor is RAY (1e27). No debt is reported by the pool as uint256 max. */
export function formatHealthFactor(healthFactorRay: bigint | undefined): string {
  if (healthFactorRay === undefined) return "Unavailable";
  if (healthFactorRay >= maxUint256 / 2n) return "No debt";
  return formatAmount(healthFactorRay, 27, 2);
}

export function oracleLabel(state: LendingV2OracleState): string {
  switch (state) {
    case "fresh": return "Fresh";
    case "stale": return "Stale";
    case "missing": return "No price set";
    case "future": return "Future timestamp";
    case "unavailable": return "Unavailable";
  }
}

export function oracleTone(state: LendingV2OracleState): "valid" | "warn" | "invalid" {
  return state === "fresh" ? "valid" : state === "stale" || state === "missing" ? "warn" : "invalid";
}

/** "3m", "2h 5m", "1d 4h": seconds measured against the block the snapshot was read at. */
export function ageText(seconds: bigint): string {
  const total = Number(seconds < 0n ? 0n : seconds);
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export function dateTimeText(seconds: bigint): string {
  return new Date(Number(seconds) * 1000).toLocaleString();
}

/** Share of a cap that is used, in basis points; null when the cap is zero (the feature is off or the cap is unset). */
export function usageBps(used: bigint, cap: bigint): bigint | null {
  if (cap === 0n) return null;
  const bps = (used * 10_000n) / cap;
  return bps > 10_000n ? 10_000n : bps;
}

export interface ReserveStatus {
  label: "Active" | "Risk actions paused" | "Inactive";
  tone: "valid" | "warn" | "invalid";
}

export function reserveStatus(reserve: LendingV2ReserveSnapshot, riskPaused: boolean): ReserveStatus {
  if (!reserve.data.config.active) return { label: "Inactive", tone: "invalid" };
  if (riskPaused) return { label: "Risk actions paused", tone: "warn" };
  return { label: "Active", tone: "valid" };
}

export function reserveCan(reserve: LendingV2ReserveSnapshot, riskPaused: boolean) {
  const { config } = reserve.data;
  const live = config.active;
  return {
    supply: live && config.supplyEnabled && !riskPaused,
    borrow: live && config.borrowEnabled && !riskPaused,
    collateral: live && config.collateralEnabled,
  };
}

/** Why a reserve cannot take the given action, in one sentence, or null when it can. */
export function reserveBlockReason(
  reserve: LendingV2ReserveSnapshot,
  riskPaused: boolean,
  action: "supply" | "borrow" | "collateral",
): string | null {
  const { config } = reserve.data;
  const symbol = reserve.symbol;
  if (!config.active) return `${symbol} is inactive in this pool.`;
  if (action === "collateral") return config.collateralEnabled ? null : `${symbol} is not accepted as collateral.`;
  if (riskPaused) return "Risk-increasing actions are paused in this pool.";
  if (action === "supply") return config.supplyEnabled ? null : `Supplying ${symbol} is disabled.`;
  return config.borrowEnabled ? null : `Borrowing ${symbol} is disabled.`;
}
