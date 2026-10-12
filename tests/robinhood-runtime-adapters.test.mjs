import { describe, expect, test } from "bun:test";
import { inspectRobinhoodContracts, readRobinhoodTransactionEvidence, scanRobinhoodProjectEvents } from "../src/lib/protocol/robinhood-chain-evidence.ts";
import { robinhoodContracts } from "../src/lib/config/contracts.ts";
import { requiredNativeGasBalance, repayAllowanceHeadroom } from "../src/lib/lending/v2-transaction-safety.ts";

const hash = `0x${"12".repeat(32)}`;
const address = "0x000000000000000000000000000000000000abcd";

describe("Robinhood runtime evidence and transaction safety", () => {
  test("rejects GIWA RPC before bytecode, receipt, or event reads", async () => {
    let reads = 0;
    const client = {
      getChainId: async () => 91_342,
      getBytecode: async () => { reads += 1; return "0x6000"; },
      getTransactionReceipt: async () => { reads += 1; throw new Error("should not read receipt"); },
    };
    await expect(inspectRobinhoodContracts(client)).rejects.toThrow("requires chain 46630");
    await expect(readRobinhoodTransactionEvidence(client, hash)).rejects.toThrow("requires chain 46630");
    await expect(scanRobinhoodProjectEvents(client, { fromBlock: 0n, toBlock: 0n })).rejects.toThrow("requires chain 46630");
    expect(reads).toBe(0);
  });

  test("returns a genuine chain-46630 receipt and Robinhood explorer URL", async () => {
    const client = {
      getChainId: async () => 46_630,
      getTransactionReceipt: async () => ({
        blockNumber: 123n,
        status: "success",
        gasUsed: 45_000n,
        effectiveGasPrice: 2n,
        logs: [],
      }),
      getTransaction: async () => ({ from: address, to: null }),
    };
    const evidence = await readRobinhoodTransactionEvidence(client, hash);
    expect(evidence.chainId).toBe(46_630);
    expect(evidence.transactionHash).toBe(hash);
    expect(evidence.status).toBe("success");
    expect(evidence.blockNumber).toBe(123n);
    expect(evidence.gasUsed).toBe(45_000n);
    expect(evidence.to).toBeNull();
    expect(evidence.projectEvents).toEqual([]);
    expect(evidence.explorerUrl).toBe(`https://explorer.testnet.chain.robinhood.com/tx/${hash}`);
  });

  test("does not classify a GIWA contract address as a Robinhood project event", async () => {
    const giwaAddress = "0x000000000000000000000000000000000000d00d";
    const client = {
      getChainId: async () => 46_630,
      getTransactionReceipt: async () => ({
        blockNumber: 50n,
        status: "success",
        gasUsed: 1n,
        effectiveGasPrice: 1n,
        logs: [{ address: giwaAddress, blockNumber: 50n, transactionHash: hash, logIndex: 0, topics: [], data: "0x" }],
      }),
      getTransaction: async () => ({ from: address, to: giwaAddress }),
    };
    const evidence = await readRobinhoodTransactionEvidence(client, hash);
    expect(evidence.projectEvents).toEqual([]);
    expect(Object.values(robinhoodContracts).filter(Boolean).map((item) => item.toLowerCase())).not.toContain(giwaAddress);
  });

  test("bounds event scans to the latest block and propagates RPC failures", async () => {
    let logReads = 0;
    const client = {
      getChainId: async () => 46_630,
      getBlockNumber: async () => 100n,
      getLogs: async () => { logReads += 1; return []; },
    };
    await expect(scanRobinhoodProjectEvents(client, { fromBlock: 0n, toBlock: 101n })).rejects.toThrow("ahead of the latest Robinhood block");
    expect(logReads).toBe(0);

    const rpcFailure = { ...client, getBlockNumber: async () => { throw new Error("RPC rate limited"); } };
    await expect(scanRobinhoodProjectEvents(rpcFailure, { fromBlock: 0n, toBlock: 1n })).rejects.toThrow("RPC rate limited");
  });

  test("checks token repayment headroom and native transaction gas headroom", () => {
    expect(repayAllowanceHeadroom(1_000_000n, 2_000n)).toBeGreaterThan(1n);
    expect(requiredNativeGasBalance(100_000n, 2_000n)).toBe(240_000_000n);
    expect(() => requiredNativeGasBalance(0n, 2_000n)).toThrow("positive");
  });
});
