import { expect, test } from "bun:test";
import { hashKey, QueryClient } from "@tanstack/react-query";
import {
  lendingV2CredentialQueryKey,
  lendingV2MarketQueryKey,
  lendingV2ProofContextForCredential,
  isLendingV2ProofForContext,
} from "../src/lib/lending/v2-config.ts";
import { effectiveLendingV2MaxBorrowable, lendingV2OracleState } from "../src/lib/lending/v2-service.ts";
import { mapLendingV2Error } from "../src/lib/lending/v2-errors.ts";

const pool = "0x0000000000000000000000000000000000001234";
const wallet = "0x0000000000000000000000000000000000005678";
const registry = "0x0000000000000000000000000000000000009abc";
const record = {
  wallet,
  commitment: `0x${"11".repeat(32)}`,
  issuer: "0x000000000000000000000000000000000000abcd",
  issuedAt: 1_800_000_000n,
  expiresAt: 1_900_000_000n,
  version: 4n,
  revoked: false,
};

test("V2 proof context is policy 3, pool-bound, and rejects proofs without real local verification", () => {
  const context = lendingV2ProofContextForCredential({ subject: wallet, record, lendingPool: pool });
  expect(context.policyId).toBe(3n);
  expect(context.policyVersion).toBe(1n);
  expect(context.threshold).toBe(1_000n);
  expect(context.chainId).toBe(91_342n);
  const proof = {
    proof: "0x1234",
    publicInputs: [
      BigInt(context.subject), BigInt(context.commitment), context.policyId, context.policyVersion,
      context.threshold, context.credentialVersion, context.expiresAt, context.chainId, BigInt(context.vault),
    ],
    publicContext: context,
    createdAt: Date.now(),
    localVerification: "not-run",
  };

  expect(isLendingV2ProofForContext(proof, context)).toBe(false);
  expect(isLendingV2ProofForContext({ ...proof, publicInputs: [...proof.publicInputs.slice(0, 2), 2n, ...proof.publicInputs.slice(3)] }, context)).toBe(false);
  const wrongPoolContext = { ...context, vault: "0x0000000000000000000000000000000000004321" };
  expect(isLendingV2ProofForContext(proof, wrongPoolContext)).toBe(false);
});

test("V2 query keys remain serializable and invalidate by pool without losing bigint cache data", async () => {
  const keys = [
    lendingV2MarketQueryKey(pool, wallet),
    lendingV2MarketQueryKey(pool, "0x0000000000000000000000000000000000007777"),
    lendingV2CredentialQueryKey(registry, wallet),
  ];
  expect(() => keys.map(hashKey)).not.toThrow();
  expect(new Set(keys.map(hashKey)).size).toBe(keys.length);
  expect(keys.flat().every((part) => typeof part !== "bigint")).toBe(true);

  const queryClient = new QueryClient();
  queryClient.setQueryData(keys[0], { debt: 123n });
  queryClient.setQueryData(keys[1], { debt: 456n });
  expect(queryClient.getQueryData(keys[0])).toEqual({ debt: 123n });
  await queryClient.invalidateQueries({ queryKey: ["lending-v2-market", "91342", pool.toLowerCase()] });
  const marketQueries = queryClient.getQueryCache().findAll({ queryKey: ["lending-v2-market", "91342", pool.toLowerCase()] });
  expect(marketQueries).toHaveLength(2);
  expect(marketQueries.every((query) => query.state.isInvalidated)).toBe(true);
  queryClient.clear();
});

test("V2 oracle freshness and effective borrowing bounds reflect on-chain inputs", () => {
  expect(lendingV2OracleState({ priceWad: 0n, updatedAt: 0n, maxAge: 3_600n, now: 100_000n })).toBe("missing");
  expect(lendingV2OracleState({ priceWad: 1n, updatedAt: 95_000n, maxAge: 3_600n, now: 100_000n })).toBe("stale");
  expect(lendingV2OracleState({ priceWad: 1n, updatedAt: 100_001n, maxAge: 3_600n, now: 100_000n })).toBe("future");
  expect(lendingV2OracleState({ priceWad: 1n, updatedAt: 98_000n, maxAge: 3_600n, now: 100_000n })).toBe("fresh");
  expect(effectiveLendingV2MaxBorrowable({
    ltvCapacity: 10_000n,
    availableLiquidity: 8_000n,
    borrowCap: 20_000n,
    totalDebt: 15_000n,
    borrowEnabled: true,
  })).toBe(5_000n);
  expect(effectiveLendingV2MaxBorrowable({
    ltvCapacity: 10_000n,
    availableLiquidity: 8_000n,
    borrowCap: 20_000n,
    totalDebt: 15_000n,
    borrowEnabled: false,
  })).toBe(0n);
});

test("V2 protocol error mapping keeps oracle, eligibility, cap, and wallet failures distinct", () => {
  expect(mapLendingV2Error(new Error("StaleOraclePrice(0xasset, 10, 5)")).category).toBe("oracle");
  expect(mapLendingV2Error(new Error("WrongLendingPool()")).category).toBe("eligibility");
  expect(mapLendingV2Error(new Error("BorrowCapExceeded(1, 2)")).category).toBe("cap");
  expect(mapLendingV2Error(new Error("InsufficientLiquidity(1, 2)")).category).toBe("liquidity");
  expect(mapLendingV2Error(new Error("User rejected the request")).category).toBe("wallet");
  expect(mapLendingV2Error(new Error("UnsupportedChain()")).message).toContain("46630");
});
