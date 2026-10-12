import { describe, expect, test } from "bun:test";
import { robinhoodTestnet } from "../src/lib/config/robinhood-testnet.ts";
import {
  isRobinhoodLendingV2ProofForContext,
  robinhoodLendingV2ProofContextForCredential,
  robinhoodLendingV2QueryKey,
} from "../src/lib/lending/v2-network.ts";

const wallet = "0x000000000000000000000000000000000000beef";
const pool = "0x0000000000000000000000000000000000001234";
const commitment = `0x${"ab".repeat(32)}`;

describe("Robinhood Testnet configuration", () => {
  test("uses only testnet chain metadata and its own explorer", () => {
    expect(robinhoodTestnet.id).toBe(46_630);
    expect(robinhoodTestnet.nativeCurrency.symbol).toBe("ETH");
    expect(robinhoodTestnet.rpcUrls.default.http[0]).toBe("https://rpc.testnet.chain.robinhood.com");
    expect(robinhoodTestnet.blockExplorers.default.url).toBe("https://explorer.testnet.chain.robinhood.com");
  });

  test("builds a proof context bound to chain, user, policy, and pool", () => {
    const record = {
      wallet,
      commitment,
      issuer: "0x000000000000000000000000000000000000cafe",
      issuedAt: 100n,
      expiresAt: 10_000n,
      version: 2n,
      revoked: false,
    };
    const context = robinhoodLendingV2ProofContextForCredential({ subject: wallet, record, lendingPool: pool });
    const proof = {
      proof: "0x1234",
      publicInputs: [
        BigInt(wallet), BigInt(commitment), 3n, 1n, 1_000n, 2n, 10_000n, 46_630n, BigInt(pool),
      ],
      publicContext: context,
      createdAt: 1,
      localVerification: "verified",
    };

    expect(context.chainId).toBe(46_630n);
    expect(isRobinhoodLendingV2ProofForContext(proof, context)).toBe(true);
    expect(isRobinhoodLendingV2ProofForContext(proof, { ...context, subject: "0x000000000000000000000000000000000000babe" })).toBe(false);
    expect(isRobinhoodLendingV2ProofForContext(proof, { ...context, chainId: 91_342n })).toBe(false);
    expect(isRobinhoodLendingV2ProofForContext(proof, { ...context, vault: "0x0000000000000000000000000000000000004321" })).toBe(false);
  });

  test("namespaces query caches by the Robinhood chain id", () => {
    expect(robinhoodLendingV2QueryKey(pool, wallet)).toEqual([
      "lending-v2-market", "46630", pool, wallet,
    ]);
  });
});
