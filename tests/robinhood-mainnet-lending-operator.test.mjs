import { describe, expect, test } from "bun:test";
import {
  assertDistinctParticipants,
  assertExactDemoParticipants,
  classifyDemoParticipantMigration,
  assertFreshSyntheticPrice,
  assertMainnetActivationPrerequisites,
  assertPriceWithinBounds,
  assertWriteAuthorization,
  artifactReceiptFrom,
  assertCanonicalDeploymentEvidence,
  assertCanonicalOperatorWrite,
  assertSafeDemoReserveConfig,
  credentialIsActive,
  isSplittableRangeError,
  normalizePriceBounds,
  normalizeReserveConfig,
} from "../scripts/robinhood-mainnet-lending-operator.mjs";

const A = "0x1111111111111111111111111111111111111111";
const B = "0x2222222222222222222222222222222222222222";
const C = "0x3333333333333333333333333333333333333333";
const HASH = `0x${"ab".repeat(32)}`;
const BLOCK_HASH = `0x${"cd".repeat(32)}`;
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
  test("resolves a successful CREATE receipt by configured address when Foundry omits the contract name", () => {
    const result = artifactReceiptFrom({
      chain: "4663",
      transactions: [{ transactionType: "CREATE", contractName: null, contractAddress: A, hash: HASH, transaction: { chainId: 4663, from: B, input: "0x1234" } }],
      receipts: [{ transactionHash: HASH, contractAddress: A, status: "0x1", blockNumber: "0x2a" }],
    }, "HonkVerifier", A);
    expect(result).toMatchObject({ name: "HonkVerifier", hash: HASH, block: 42n, address: A, artifactSender: B, artifactInput: "0x1234" });
  });

  test("requires artifact receipt hash, success status, address, and chain to agree", () => {
    const valid = {
      chain: 4663,
      transactions: [{ transactionType: "CREATE", contractName: "DifferentArtifactAlias", contractAddress: A, transactionHash: HASH }],
      receipts: [{ hash: HASH, contractAddress: A, status: 1, blockNumber: 42 }],
    };
    expect(() => artifactReceiptFrom(valid, "HonkVerifier", A)).not.toThrow();
    expect(() => artifactReceiptFrom({ ...valid, chain: 91342 }, "HonkVerifier", A)).toThrow("not chain 4663");
    expect(() => artifactReceiptFrom({ ...valid, receipts: [{ ...valid.receipts[0], status: "0x0" }] }, "HonkVerifier", A)).toThrow("did not succeed");
    expect(() => artifactReceiptFrom({ ...valid, receipts: [{ ...valid.receipts[0], contractAddress: B }] }, "HonkVerifier", A)).toThrow("receipt address");
  });

  test("validates canonical RPC sender even when deployment artifact sender is absent", () => {
    const item = { name: "HonkVerifier", hash: HASH, block: 42n, address: A, artifactSender: null, artifactInput: null };
    const receipt = { status: "success", transactionHash: HASH, contractAddress: A, blockNumber: 42n, blockHash: BLOCK_HASH };
    const transaction = { hash: HASH, chainId: 4663, to: null, from: B, input: "0x1234" };
    const block = { hash: BLOCK_HASH };
    expect(() => assertCanonicalDeploymentEvidence({ item, receipt, transaction, block, deployer: B })).not.toThrow();
    expect(() => assertCanonicalDeploymentEvidence({ item, receipt, transaction: { ...transaction, from: A }, block, deployer: B })).toThrow("canonical RPC sender does not match");
  });

  test("checks every canonical admin write against its chain, sender, target, and calldata", () => {
    const submitted = {
      hash: HASH, actor: A, target: B, data: "0x1234",
      receipt: { status: "success", transactionHash: HASH },
      transaction: { hash: HASH, chainId: 4663, from: A, to: B, input: "0x1234" },
    };
    expect(() => assertCanonicalOperatorWrite(submitted)).not.toThrow();
    expect(() => assertCanonicalOperatorWrite({ ...submitted, transaction: { ...submitted.transaction, from: B } })).toThrow("sender differs");
    expect(() => assertCanonicalOperatorWrite({ ...submitted, transaction: { ...submitted.transaction, chainId: 91342 } })).toThrow("not on Robinhood Mainnet");
    expect(() => assertCanonicalOperatorWrite({ ...submitted, transaction: { ...submitted.transaction, to: A } })).toThrow("target differs");
    expect(() => assertCanonicalOperatorWrite({ ...submitted, transaction: { ...submitted.transaction, input: "0xabcd" } })).toThrow("calldata differs");
    expect(() => assertCanonicalOperatorWrite({ ...submitted, receipt: { ...submitted.receipt, status: "reverted" } })).toThrow("receipt failed");
  });

  test("normalizes viem tuple arrays and named tuple objects before status arithmetic", () => {
    expect(normalizePriceBounds([950n, 1_050n, 1_000n, 900n])).toEqual({
      minimumPriceWad: 950n, maximumPriceWad: 1_050n, priceWad: 1_000n, updatedAt: 900n,
    });
    expect(normalizePriceBounds({ minimumPriceWad: 950, maximumPriceWad: 1_050, priceWad: 1_000, updatedAt: 900 })).toEqual({
      minimumPriceWad: 950n, maximumPriceWad: 1_050n, priceWad: 1_000n, updatedAt: 900n,
    });
    const config = [100n, 80n, 70n, 1n, 3_600n, 5_000n, 6_500n, 500n, 5_000n, 1_000n, 8_000n, 200n, 400n, 6_000n, true, true, true, false];
    const normalized = normalizeReserveConfig(config);
    expect(normalized).toMatchObject({ maxOracleAge: 3_600n, active: true, supplyEnabled: true, borrowEnabled: true, collateralEnabled: false });
    expect(() => assertSafeDemoReserveConfig(normalized, "loan")).not.toThrow();
    expect(() => assertSafeDemoReserveConfig({ ...normalized, maxLtvBps: 6_500n }, "loan")).toThrow("below a valid liquidation threshold");
    expect(() => normalizePriceBounds([])).toThrow("missing minimumPriceWad");
  });

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

  test("accepts only the bounded old-A -> Wallet B only -> new-A migration history", () => {
    const migration = { previousParticipantA: A, participantA: C, participantB: B };
    expect(classifyDemoParticipantMigration([A, B], migration)).toBe("awaiting-revocation");
    expect(classifyDemoParticipantMigration([B], migration)).toBe("awaiting-grant");
    expect(classifyDemoParticipantMigration([C, B], migration)).toBe("complete");
    expect(() => classifyDemoParticipantMigration([A, B, C], migration)).toThrow("outside the explicitly allowed");
    expect(() => classifyDemoParticipantMigration([A, C], migration)).toThrow("outside the explicitly allowed");
    expect(() => classifyDemoParticipantMigration([A, B], { ...migration, previousParticipantA: C })).toThrow("Previous and replacement Wallet A must differ");
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
