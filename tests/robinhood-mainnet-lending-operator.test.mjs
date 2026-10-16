import { describe, expect, test } from "bun:test";
import {
  assertDistinctParticipants,
  assertExactDemoParticipants,
  assertFreshSyntheticPrice,
  assertMainnetActivationPrerequisites,
  assertPriceWithinBounds,
  assertWriteAuthorization,
  credentialIsActive,
  isSplittableRangeError,
} from "../scripts/robinhood-mainnet-lending-operator.mjs";

const A = "0x1111111111111111111111111111111111111111";
const B = "0x2222222222222222222222222222222222222222";
const activeCredential = (wallet) => ({ wallet, revoked: false, issuedAt: 900n, expiresAt: 2_000n });
const readyState = {
  paused: true,
  credentialA: activeCredential(A),
  credentialB: activeCredential(B),
  now: 1_000n,
  loanPrice: { price: 1_000_000_000_000_000_000n, updatedAt: 990n },
  collateralPrice: { price: 2_000_000_000_000_000_000n, updatedAt: 980n },
  loanMaxAge: 600n,
  collateralMaxAge: 600n,
  loanBalanceA: 1n,
  loanBalanceB: 1n,
  collateralBalanceA: 1n,
  collateralBalanceB: 1n,
};

describe("Robinhood Mainnet controlled Lending operator guards", () => {
  test("requires positive price values inside the on-chain bounds", () => {
    expect(() => assertPriceWithinBounds("100", "90", "110")).not.toThrow();
    expect(() => assertPriceWithinBounds("0", "90", "110")).toThrow();
    expect(() => assertPriceWithinBounds("111", "90", "110")).toThrow();
  });

  test("requires distinct participants and operator identities", () => {
    expect(() => assertDistinctParticipants([A, B])).not.toThrow();
    expect(() => assertDistinctParticipants([A, A])).toThrow("must be distinct");
  });

  test("refuses a widened on-chain participant allowlist", () => {
    expect(() => assertExactDemoParticipants([A, B], [A, B])).not.toThrow();
    expect(() => assertExactDemoParticipants([A, B, "0x3333333333333333333333333333333333333333"], [A, B])).toThrow("differ from the two configured participants");
    expect(() => assertExactDemoParticipants([A], [A, B])).toThrow();
  });

  test("accepts only seeded, nonfuture, fresh synthetic prices", () => {
    expect(() => assertFreshSyntheticPrice({ price: 1n, updatedAt: 990n, now: 1_000n, maxAge: 10n })).not.toThrow();
    expect(() => assertFreshSyntheticPrice({ price: 0n, updatedAt: 990n, now: 1_000n, maxAge: 10n })).toThrow("not seeded");
    expect(() => assertFreshSyntheticPrice({ price: 1n, updatedAt: 989n, now: 1_000n, maxAge: 10n })).toThrow("stale");
    expect(() => assertFreshSyntheticPrice({ price: 1n, updatedAt: 1_001n, now: 1_000n, maxAge: 10n })).toThrow("future");
  });

  test("only permits activation after both wallets have active credentials, fresh prices, and allocations", () => {
    expect(() => assertMainnetActivationPrerequisites(readyState)).not.toThrow();
    expect(() => assertMainnetActivationPrerequisites({ ...readyState, paused: false })).toThrow("already active");
    expect(() => assertMainnetActivationPrerequisites({ ...readyState, credentialB: { ...activeCredential(B), revoked: true } })).toThrow("active project Policy 3");
    expect(() => assertMainnetActivationPrerequisites({ ...readyState, collateralPrice: { price: 2n, updatedAt: 0n } })).toThrow("not seeded");
    expect(() => assertMainnetActivationPrerequisites({ ...readyState, loanBalanceA: 0n })).toThrow("Wallet A loan token");
  });

  test("requires exact write authorization and classifies only bounded-query range errors", () => {
    expect(() => assertWriteAuthorization({ authorization: "oracle-price" }, "oracle-price")).not.toThrow();
    expect(() => assertWriteAuthorization({ authorization: "token-mint" }, "oracle-price")).toThrow();
    expect(isSplittableRangeError(new Error("block range too wide"))).toBe(true);
    expect(isSplittableRangeError(new Error("authentication failed"))).toBe(false);
  });

  test("treats revoked, missing, and expired credentials as inactive", () => {
    expect(credentialIsActive(activeCredential(A), 1_000n)).toBe(true);
    expect(credentialIsActive({ ...activeCredential(A), revoked: true }, 1_000n)).toBe(false);
    expect(credentialIsActive({ ...activeCredential(A), expiresAt: 1_000n }, 1_000n)).toBe(false);
  });
});
