import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";
import { computeEligibilityCommitment } from "../../src/lib/zk/commitment.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const circuit = JSON.parse(await readFile(path.join(root, "public/circuits/private_eligibility.json"), "utf8"));
const crsPath = process.env.BB_CRS_PATH || path.join(os.homedir(), ".bb-crs");
const subject = "0xBE390374Ac7304A792c50EA37AB301b659a56Df7";
const governance = "0x2222222222222222222222222222222222222222";
const score = "4";
const salt = `0x${12345n.toString(16).padStart(64, "0")}`;
const context = {
  subject,
  policyId: 5n,
  policyVersion: 1n,
  threshold: 3n,
  credentialVersion: 1n,
  expiresAt: 4_102_444_800n,
  chainId: 46_630n,
  vault: governance,
};
const commitment = await computeEligibilityCommitment({ ...context, privateValue: score, salt });

function inputs(overrides = {}) {
  return {
    subject: BigInt(context.subject).toString(),
    commitment: BigInt(commitment).toString(),
    policy_id: context.policyId.toString(),
    policy_version: context.policyVersion.toString(),
    threshold: context.threshold.toString(),
    credential_version: context.credentialVersion.toString(),
    expires_at: context.expiresAt.toString(),
    chain_id: context.chainId.toString(),
    vault_address: BigInt(context.vault).toString(),
    private_value: score,
    salt: BigInt(salt).toString(),
    ...overrides,
  };
}

const api = await Barretenberg.new({ threads: 1, crsPath });
try {
  const noir = new Noir(circuit);
  const backend = new UltraHonkBackend(circuit.bytecode, api);
  const { witness } = await noir.execute(inputs());
  const proof = await backend.generateProof(witness, { verifierTarget: "evm" });
  assert.equal(await backend.verifyProof(proof, { verifierTarget: "evm" }), true);
  assert.equal(proof.publicInputs.length, 9, "Phase 2 must retain the deployed nine-input adapter interface.");
  assert.deepEqual(
    proof.publicInputs.map(BigInt),
    [
      BigInt(subject), BigInt(commitment), 5n, 1n, 3n, 1n,
      context.expiresAt, 46_630n, BigInt(governance),
    ],
    "Phase 2 public inputs are not wallet, policy, threshold, version, chain, and DAO bound.",
  );
  await assert.rejects(noir.execute(inputs({ private_value: "2" })), "under-threshold score was accepted");
  await assert.rejects(noir.execute(inputs({ chain_id: "91342" })), "wrong-chain context was accepted");
  await assert.rejects(
    noir.execute(inputs({ vault_address: BigInt("0x3333333333333333333333333333333333333333").toString() })),
    "wrong-governance context was accepted",
  );
  console.log(JSON.stringify({
    result: "Policy 5 proof locally verified; under-threshold, wrong-chain, and wrong-DAO witnesses rejected",
    chainId: 46630,
    policyId: 5,
    threshold: 3,
    publicInputCount: proof.publicInputs.length,
    proofBytes: proof.proof.length,
  }, null, 2));
} finally {
  await api.destroy();
}
