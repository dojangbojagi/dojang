import type { useLendingMarketV2 } from "@/hooks/use-lending-market-v2";
import type { useLendingV2EligibilityProof } from "@/hooks/use-lending-v2-eligibility-proof";
import type { LendingV2MarketSnapshot, LendingV2Position, LendingV2ReserveSnapshot } from "@/lib/lending/v2-service";

export type V2Market = ReturnType<typeof useLendingMarketV2>;
export type V2Proof = ReturnType<typeof useLendingV2EligibilityProof>;
export type V2Snapshot = LendingV2MarketSnapshot;
export type V2Reserve = LendingV2ReserveSnapshot;
export type V2Position = LendingV2Position;

export type V2Tab = "markets" | "supply" | "borrow" | "position";

/** The reserve a person's position in `asset` is stored under (the service keys positions by lower-case address). */
export function positionOf(snapshot: V2Snapshot | undefined, reserve: V2Reserve): V2Position | undefined {
  return reserve.position ?? snapshot?.position?.byAsset[reserve.asset.toLowerCase()];
}
