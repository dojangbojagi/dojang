import type { useDaoGovernance } from "@/hooks/use-dao-governance";

export type Governance = ReturnType<typeof useDaoGovernance>;

/** Shared by the three write panels: one gate for the whole page and one place that reports the outcome. */
export interface GovRunner {
  /** Runs one governance write, reports the outcome in the banner and returns whether it was confirmed. */
  run: (label: string, action: () => Promise<unknown>, success: string) => Promise<boolean>;
  busy: boolean;
  /** Why no write can start at all right now (not configured, no code, no wallet, wrong network, reading, busy), or null. */
  block: string | null;
  /** Why this wallet cannot create proposals or vote: it is not an official Dojang-verified member, or that is still being read. */
  memberBlock: string | null;
}
