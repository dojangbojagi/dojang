import type { useLendingMarket } from "@/hooks/use-lending-market";

export type LendingMarket = ReturnType<typeof useLendingMarket>;

/** Runs one wallet action through the shared transaction lifecycle and reports the outcome to the page. */
export interface ActionRunner {
  /** Runs `action`; resolves true when it completed, false when it failed (the reason is shown to the user). */
  run: (label: string, action: () => Promise<void>, success: string) => Promise<boolean>;
  /** A transaction is already in flight. */
  busy: boolean;
  /** Why no wallet action can start right now, or null. Shared by every form. */
  block: string | null;
}
