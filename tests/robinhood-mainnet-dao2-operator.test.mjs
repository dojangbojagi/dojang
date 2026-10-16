import { describe, expect, test } from "bun:test";
import {
  assertCanonicalMainnetRange,
  assertMainnetCommitReady,
  assertMainnetRevealReady,
  isSplittableLogRangeError,
  parseVoteType,
  scoreMainnetLendingEvidence,
} from "../scripts/robinhood-mainnet-dao2-operator.mjs";

const metrics = (overrides = {}) => ({
  supplyActions: 0,
  collateralActions: 0,
  borrowActions: 0,
  repaymentActions: 0,
  fullRepayments: 0,
  liquidations: 0,
  ...overrides,
});

describe("Robinhood Mainnet DAO Phase 2 operator", () => {
  test("scores only actual Lending event categories and caps repeated volume", () => {
    expect(scoreMainnetLendingEvidence(metrics({ supplyActions: 10 }))).toBe(1);
    expect(scoreMainnetLendingEvidence(metrics({ borrowActions: 1 }))).toBe(2);
    expect(scoreMainnetLendingEvidence(metrics({ borrowActions: 1, fullRepayments: 1 }))).toBe(4);
    expect(scoreMainnetLendingEvidence(metrics({ supplyActions: 1, fullRepayments: 1 }))).toBe(3);
    expect(scoreMainnetLendingEvidence(metrics({ borrowActions: 1, fullRepayments: 1, liquidations: 1 }))).toBe(2);
  });

  test("requires canonical finalized L2 evidence below the ArbSys L2 head", () => {
    expect(() => assertCanonicalMainnetRange(100, 120, 120, 121)).not.toThrow();
    expect(() => assertCanonicalMainnetRange(100, 121, 120, 122)).toThrow("finalized block");
    expect(() => assertCanonicalMainnetRange(100, 121, 130, 121)).toThrow("ArbSys L2 head");
    expect(() => assertCanonicalMainnetRange(122, 121, 130, 131)).toThrow("start block");
  });

  test("splits only provider log-range limitations and propagates transport failures", () => {
    expect(isSplittableLogRangeError(new Error("block range exceeds limit"))).toBe(true);
    expect(isSplittableLogRangeError(new Error("connection reset by peer"))).toBe(false);
    expect(isSplittableLogRangeError(new Error("HTTP 401 unauthorized"))).toBe(false);
  });

  test("keystore ballot path enforces live commit and reveal phases and ballot integrity", () => {
    expect(parseVoteType("for")).toBe(1);
    expect(parseVoteType("AGAINST")).toBe(0);
    expect(parseVoteType("abstain")).toBe(2);
    expect(() => parseVoteType("maybe")).toThrow("Vote must be");
    expect(() => assertMainnetCommitReady({ paused: false, member: true, proposalState: 2 })).not.toThrow();
    expect(() => assertMainnetCommitReady({ paused: true, member: true, proposalState: 2 })).toThrow("paused");
    expect(() => assertMainnetCommitReady({ paused: false, member: false, proposalState: 2 })).toThrow("active proof-backed");
    expect(() => assertMainnetCommitReady({ paused: false, member: true, proposalState: 3 })).toThrow("commit period");
    const ballot = `0x${"ab".repeat(32)}`;
    const nullifier = `0x${"cd".repeat(32)}`;
    expect(() => assertMainnetRevealReady({ proposalState: 3, expectedCommitment: ballot,
      ballotCommitment: ballot, expectedNullifier: nullifier, ballotNullifier: nullifier,
      storedCommitment: ballot, revealed: false })).not.toThrow();
    expect(() => assertMainnetRevealReady({ proposalState: 2, expectedCommitment: ballot,
      ballotCommitment: ballot, expectedNullifier: nullifier, ballotNullifier: nullifier,
      storedCommitment: ballot, revealed: false })).toThrow("reveal period");
    expect(() => assertMainnetRevealReady({ proposalState: 3, expectedCommitment: `0x${"ef".repeat(32)}`,
      ballotCommitment: ballot, expectedNullifier: nullifier, ballotNullifier: nullifier,
      storedCommitment: ballot, revealed: false })).toThrow("does not match");
    expect(() => assertMainnetRevealReady({ proposalState: 3, expectedCommitment: ballot,
      ballotCommitment: ballot, expectedNullifier: nullifier, ballotNullifier: nullifier,
      storedCommitment: ballot, revealed: true })).toThrow("already been revealed");
  });
});
