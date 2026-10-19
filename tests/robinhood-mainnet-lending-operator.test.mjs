import { describe, expect, test } from "bun:test";
import { keccak256 } from "viem";
import { robinhoodMainnetDemoContracts } from "../src/lib/config/robinhood-mainnet-demo.ts";
import * as lendingOperator from "../scripts/robinhood-mainnet-lending-operator.mjs";
import { spawnMainnetCast, buildMainnetCastEnvironment } from "../scripts/robinhood-mainnet-cast.mjs";
import {
  assertDistinctParticipants,
  assertExactDemoParticipants,
  classifyDemoParticipantMigration,
  assertFreshSyntheticPrice,
  assertMainnetActivationPrerequisites,
  assertPriceWithinBounds,
  assertNoPendingSignerTransaction,
  assertWriteAuthorization,
  buildDemoParticipantRoleLogFilter,
  buildParticipantRoleLogBatch,
  decodeDemoParticipantRoleLog,
  artifactReceiptFrom,
  assertCanonicalDeploymentEvidence,
  assertCanonicalOperatorWrite,
  assertSafeDemoReserveConfig,
  credentialIsActive,
  getMainnetLogBlockLimit,
  isSplittableRangeError,
  normalizePriceBounds,
  normalizeReserveConfig,
  shouldSkipOraclePriceWrite,
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
  test("reconstructs participant role history from one OR-filtered log request per bounded range", () => {
    const role = `0x${"aa".repeat(32)}`;
    const accountTopic = (address) => `0x${address.slice(2).toLowerCase().padStart(64, "0")}`;
    const grant = keccak256(new TextEncoder().encode("RoleGranted(bytes32,address,address)"));
    const revoke = keccak256(new TextEncoder().encode("RoleRevoked(bytes32,address,address)"));
    const filter = buildDemoParticipantRoleLogFilter(role, 100n, 199n);

    expect(filter).toMatchObject({
      address: robinhoodMainnetDemoContracts.lendingPool,
      fromBlock: "0x64",
      toBlock: "0xc7",
      topics: [[grant, revoke], role],
    });
    expect(decodeDemoParticipantRoleLog({
      data: "0x",
      topics: [grant, role, accountTopic(A), accountTopic(C)],
      blockNumber: "0x65",
      logIndex: "0x2",
    })).toEqual({ eventName: "RoleGranted", args: { account: A.toLowerCase() }, blockNumber: 101n, logIndex: 2n });
    expect(decodeDemoParticipantRoleLog({
      data: "0x",
      topics: [revoke, role, accountTopic(B), accountTopic(C)],
      blockNumber: "0x66",
      logIndex: "0x3",
    })).toEqual({ eventName: "RoleRevoked", args: { account: B.toLowerCase() }, blockNumber: 102n, logIndex: 3n });
  });

  test("passes the BlockVectra API key only as an authenticated cast child header", () => {
    const secret = "unit-test-api-key-do-not-print";
    const endpoint = "https://api.blockvectra.com/v1/robinhood_mainnet";
    let invocation;
    const child = { child: true };
    const returned = spawnMainnetCast(["rpc", "eth_chainId", "--rpc-url", endpoint], endpoint, {
      rpcLabel: "fallback",
      sourceEnv: {
        PATH: "/usr/bin",
        RH_MAINNET_RPC_FALLBACK_API_KEY: secret,
        ETH_RPC_HEADERS: "x-api-key: inherited-wrong-key",
      },
      spawnImpl: (...args) => { invocation = args; return child; },
    });

    expect(returned).toBe(child);
    expect(invocation[0]).toBe("cast");
    expect(invocation[1]).not.toContain(secret);
    expect(invocation[2].env.ETH_RPC_HEADERS).toBe(`x-api-key: ${secret}`);
    expect(invocation[2].env.RH_MAINNET_RPC_FALLBACK_API_KEY).toBeUndefined();
    expect(invocation[2].env.ETH_RPC_HEADERS).not.toContain("inherited-wrong-key");
    expect(JSON.stringify(invocation[1])).not.toContain(secret);
  });

  test("never sends fallback credentials or inherited RPC headers to the official endpoint", () => {
    const env = buildMainnetCastEnvironment("https://rpc.mainnet.chain.robinhood.com", {
      PATH: "/usr/bin",
      RH_MAINNET_RPC_FALLBACK_API_KEY: "unit-test-secret",
      BLOCKVECTRA_API_KEY: "another-unit-test-secret",
      ETH_RPC_HEADERS: "x-api-key: inherited-secret",
    });

    expect(env.ETH_RPC_HEADERS).toBeUndefined();
    expect(env.RH_MAINNET_RPC_FALLBACK_API_KEY).toBeUndefined();
    expect(env.BLOCKVECTRA_API_KEY).toBeUndefined();
  });

  test("fails closed if a BlockVectra endpoint is selected without its API key", () => {
    expect(() => buildMainnetCastEnvironment(
      "https://api.blockvectra.com/v1/robinhood_mainnet/public",
      { PATH: "/usr/bin" },
      "fallback",
    )).toThrow("authenticated BlockVectra RPC was selected without its configured API key");
  });

  test("does not send a fallback key when BlockVectra is configured as the primary endpoint", () => {
    const env = buildMainnetCastEnvironment("https://api.blockvectra.com/v1/robinhood_mainnet", {
      PATH: "/usr/bin",
      RH_MAINNET_RPC_FALLBACK_API_KEY: "unit-test-secret",
    }, "primary");
    expect(env.ETH_RPC_HEADERS).toBeUndefined();
  });

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
    const transaction = { hash: HASH, chainId: 4663, to: null, from: B, input: "0x1234", blockHash: BLOCK_HASH };
    const block = { hash: BLOCK_HASH, number: 42n };
    expect(() => assertCanonicalDeploymentEvidence({ item, receipt, transaction, block, deployer: B })).not.toThrow();
    expect(() => assertCanonicalDeploymentEvidence({ item, receipt, transaction: { ...transaction, from: A }, block, deployer: B })).toThrow("canonical RPC sender does not match");
    expect(() => assertCanonicalDeploymentEvidence({ item, receipt, transaction, block: { ...block, number: 41n }, deployer: B })).toThrow("different block height");
    expect(() => assertCanonicalDeploymentEvidence({ item, receipt, transaction: { ...transaction, blockHash: HASH }, block, deployer: B })).toThrow("blocks differ");
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

  test("skips an unchanged synthetic oracle value only while its on-chain timestamp is fresh", () => {
    const fresh = { currentPrice: 1_000n, updatedAt: 990n, requestedPrice: 1_000n, now: 1_000n, maxAge: 10n };
    expect(shouldSkipOraclePriceWrite(fresh)).toBe(true);
    expect(shouldSkipOraclePriceWrite({ ...fresh, updatedAt: 989n })).toBe(false);
    expect(shouldSkipOraclePriceWrite({ ...fresh, updatedAt: 1_001n })).toBe(false);
    expect(shouldSkipOraclePriceWrite({ ...fresh, requestedPrice: 1_001n })).toBe(false);
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
    expect(() => assertNoPendingSignerTransaction(7n, 7n)).not.toThrow();
    expect(() => assertNoPendingSignerTransaction(7n, 8n)).toThrow("inspect its hash and on-chain state");
    expect(isSplittableRangeError(new Error("block range too wide"))).toBe(true);
    expect(isSplittableRangeError(new Error("authentication failed"))).toBe(false);
  });

  test("recognizes a provider log-range limit through viem's wrapped RPC error causes", () => {
    const wrapped = new Error("An unknown RPC error occurred.", {
      cause: new Error("eth_getLogs failed", {
        cause: Object.assign(new Error("block range too large: max 1000 blocks"), { code: -32602 }),
      }),
    });
    expect(isSplittableRangeError(wrapped)).toBe(true);
  });

  test("bounds historical log queries to the provider's 1000-block inclusive limit", () => {
    expect(typeof lendingOperator.getBoundedLogRanges).toBe("function");
    expect([...lendingOperator.getBoundedLogRanges(100n, 2_199n)]).toEqual([
      [100n, 1_099n],
      [1_100n, 2_099n],
      [2_100n, 2_199n],
    ]);
    expect(getMainnetLogBlockLimit("https://api.blockvectra.com/v1/robinhood_mainnet")).toBe(1_000n);
    expect([...lendingOperator.getBoundedLogRanges(100n, 20_100n, getMainnetLogBlockLimit("https://rpc.mainnet.chain.robinhood.com"))]).toEqual([
      [100n, 20_099n],
      [20_100n, 20_100n],
    ]);
  });

  test("batches complete fallback role-history scans in bounded read-only log requests", () => {
    const role = `0x${"aa".repeat(32)}`;
    const requests = buildParticipantRoleLogBatch(role, [[100n, 1_099n], [1_100n, 2_099n]], 20);
    expect(requests).toHaveLength(2);
    expect(requests.map(({ id }) => id)).toEqual(["participant-role-20", "participant-role-21"]);
    expect(requests.every(({ method, params }) => method === "eth_getLogs" && params[0].topics[1] === role)).toBe(true);
    expect(requests.every(({ params }) => BigInt(params[0].toBlock) - BigInt(params[0].fromBlock) + 1n <= 1_000n)).toBe(true);
    expect(() => buildParticipantRoleLogBatch(role, Array.from({ length: 3 }, (_, index) => [BigInt(index), BigInt(index)]))).toThrow("1–2 ranges");
  });

  test("treats revoked, missing, and expired credentials as inactive", () => {
    expect(credentialIsActive(activeCredential(A), 1_000n)).toBe(true);
    expect(credentialIsActive({ ...activeCredential(A), revoked: true }, 1_000n)).toBe(false);
    expect(credentialIsActive({ ...activeCredential(A), expiresAt: 1_000n }, 1_000n)).toBe(false);
  });
});
