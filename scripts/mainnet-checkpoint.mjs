import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getAddress, isAddress } from "viem";

export const MAINNET_CHECKPOINT_PATH = path.join(
  os.homedir(),
  ".local/share/gyevo-mainnet/confirmed-transactions.jsonl",
);

/** Persist only public transaction metadata after canonical receipt and post-state checks pass. */
export function appendConfirmedMainnetCheckpoint(input, filePath = MAINNET_CHECKPOINT_PATH) {
  assert.equal(Number(input.chainId), 4663, "Checkpoint must be for Robinhood Mainnet chain 4663.");
  assert.ok(typeof input.workflow === "string" && input.workflow.length <= 48, "Checkpoint workflow is invalid.");
  assert.ok(typeof input.operation === "string" && input.operation.length <= 64, "Checkpoint operation is invalid.");
  assert.ok(isAddress(input.actor) && isAddress(input.target), "Checkpoint actor or target address is invalid.");
  assert.match(input.transactionHash ?? "", /^0x[0-9a-fA-F]{64}$/, "Checkpoint transaction hash is invalid.");
  assert.ok(BigInt(input.blockNumber) > 0n, "Checkpoint block number must be positive.");
  assert.equal(input.postStateConfirmed, true, "Checkpoint requires a successful post-state readback.");

  const record = {
    version: 1,
    network: "robinhood-mainnet",
    chainId: 4663,
    workflow: input.workflow,
    operation: input.operation,
    actor: getAddress(input.actor),
    target: getAddress(input.target),
    transactionHash: input.transactionHash.toLowerCase(),
    blockNumber: BigInt(input.blockNumber).toString(),
    receiptStatus: "success",
    postStateConfirmed: true,
    explorerUrl: `https://robinhoodchain.blockscout.com/tx/${input.transactionHash}`,
    confirmedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const fd = fs.openSync(filePath, "a", 0o600);
  try {
    fs.fchmodSync(fd, 0o600);
    fs.writeSync(fd, `${JSON.stringify(record)}\n`);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  return record;
}
