import { describe, expect, test } from "bun:test";
import { scoreLendingEvidence } from "../scripts/robinhood-dao-phase2.mjs";

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
