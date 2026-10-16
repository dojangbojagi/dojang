import { describe, expect, test } from "bun:test";
import { parsePhase2Ballot } from "../src/lib/governance/phase2-ballot.ts";

const sample = (chainId = 4_663) => ({
  format: "gyevo-dao-phase2-ballot-v1",
  chainId,
  governance: "0x0000000000000000000000000000000000000001",
  voter: "0x0000000000000000000000000000000000000002",
  proposalId: "7",
  voteType: 1,
  salt: `0x${"11".repeat(32)}`,
  commitment: `0x${"22".repeat(32)}`,
  nullifier: `0x${"33".repeat(32)}`,
});

describe("DAO Phase 2 reveal file validation", () => {
  test("accepts a well-formed Mainnet ballot for its selected chain", () => {
    expect(parsePhase2Ballot(sample(), 4_663).chainId).toBe(4_663);
  });

  test("accepts a well-formed Testnet ballot for its selected chain", () => {
    expect(parsePhase2Ballot(sample(46_630), 46_630).chainId).toBe(46_630);
  });

  test("rejects cross-chain ballots and unsupported selected networks", () => {
    expect(() => parsePhase2Ballot(sample(46_630), 4_663)).toThrow("different chain");
    expect(() => parsePhase2Ballot(sample(), 91_342)).toThrow("supported only on Robinhood");
  });

  test("rejects malformed secret fields without exposing their contents", () => {
    expect(() => parsePhase2Ballot({ ...sample(), salt: "not-a-salt" }, 4_663)).toThrow("incomplete, invalid");
    expect(() => parsePhase2Ballot({ ...sample(), proposalId: "0" }, 4_663)).toThrow("incomplete, invalid");
  });
});
