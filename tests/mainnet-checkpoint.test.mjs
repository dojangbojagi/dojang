import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { appendConfirmedMainnetCheckpoint } from "../scripts/mainnet-checkpoint.mjs";

const tempDirs = [];
afterEach(() => {
  for (const directory of tempDirs.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe("confirmed Mainnet checkpoints", () => {
  test("persists only public receipt and post-state metadata with private file permissions", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gyevo-mainnet-checkpoint-"));
    tempDirs.push(directory);
    const file = path.join(directory, "confirmed.jsonl");
    const record = appendConfirmedMainnetCheckpoint({
      chainId: 4663,
      workflow: "lending-wallet-supply",
      operation: "supply",
      actor: "0x1111111111111111111111111111111111111111",
      target: "0x2222222222222222222222222222222222222222",
      transactionHash: `0x${"ab".repeat(32)}`,
      blockNumber: 123n,
      postStateConfirmed: true,
      witness: "must-not-be-written",
      salt: "must-not-be-written",
    }, file);
    const stored = JSON.parse(fs.readFileSync(file, "utf8").trim());
    expect(stored).toEqual(record);
    expect(stored).not.toHaveProperty("witness");
    expect(stored).not.toHaveProperty("salt");
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    expect(record).toMatchObject({ network: "robinhood-mainnet", chainId: 4663, blockNumber: "123", receiptStatus: "success", postStateConfirmed: true });
  });

  test("fails closed for wrong-chain or unconfirmed records", () => {
    const base = {
      chainId: 4663, workflow: "dao-phase2", operation: "vote",
      actor: "0x1111111111111111111111111111111111111111",
      target: "0x2222222222222222222222222222222222222222",
      transactionHash: `0x${"ab".repeat(32)}`, blockNumber: 1n, postStateConfirmed: true,
    };
    expect(() => appendConfirmedMainnetCheckpoint({ ...base, chainId: 91342 }, "/tmp/unused-gyevo-checkpoint.jsonl")).toThrow("chain 4663");
    expect(() => appendConfirmedMainnetCheckpoint({ ...base, postStateConfirmed: false }, "/tmp/unused-gyevo-checkpoint.jsonl")).toThrow("post-state");
  });
});
