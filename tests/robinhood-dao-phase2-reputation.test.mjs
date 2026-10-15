import { describe, expect, test } from "bun:test";
import { assertObservedRangeBeforeBlock, scoreLendingEvidence } from "../scripts/robinhood-dao-phase2.mjs";

const empty = {
  supplyActions: 0,
  collateralActions: 0,
  borrowActions: 0,
  repaymentActions: 0,
  fullRepayments: 0,
  liquidations: 0,
};

describe("DAO Phase 2 Lending V2 reputation model", () => {
  test("does not reward repeated volume", () => {
    expect(scoreLendingEvidence({ ...empty, supplyActions: 1 })).toBe(1);
    expect(scoreLendingEvidence({ ...empty, supplyActions: 500 })).toBe(1);
  });

  test("rewards borrowing plus a complete repayment", () => {
    expect(scoreLendingEvidence({ ...empty, borrowActions: 1, repaymentActions: 1, fullRepayments: 1 })).toBe(4);
  });

  test("applies a bounded liquidation penalty", () => {
    expect(scoreLendingEvidence({ ...empty, borrowActions: 1, fullRepayments: 1, liquidations: 1 })).toBe(2);
    expect(scoreLendingEvidence({ ...empty, liquidations: 1 })).toBe(0);
  });
});

describe("DAO Phase 2 reputation evidence block context", () => {
  test("accepts genuine Wallet A and Wallet B L2 evidence ranges below the L2 head", () => {
    const l2BlockNumber = 136_014_631n;
    expect(() => assertObservedRangeBeforeBlock(133_689_989n, 135_967_848n, l2BlockNumber)).not.toThrow();
    expect(() => assertObservedRangeBeforeBlock(133_689_989n, 135_970_183n, l2BlockNumber)).not.toThrow();
  });

  test("enforces the deployed contract's strict observedToBlock < L2 block number rule", () => {
    expect(() => assertObservedRangeBeforeBlock(100n, 99n, 101n)).toThrow("must not exceed");
    expect(() => assertObservedRangeBeforeBlock(100n, 101n, 101n)).toThrow("pinned L2 simulation block");
    expect(() => assertObservedRangeBeforeBlock(100n, 100n, 101n)).not.toThrow();
  });
});
