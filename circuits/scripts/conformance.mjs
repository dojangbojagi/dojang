import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";
import { computeEligibilityCommitment } from "../../src/lib/zk/commitment.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const crsPath = path.resolve(root, "circuits/cache/bb-crs");
const circuit = JSON.parse(await readFile(path.resolve(root, "public/circuits/private_eligibility.json"), "utf8"));
const domainTag = BigInt("0x1f474957415f505249564154455f454c49474942494c4954595f5631");
const subject = BigInt("0x1111111111111111111111111111111111111111");
const vaultAddress = BigInt("0x2222222222222222222222222222222222222222");
const privateValue = BigInt(1_250);
const salt = BigInt(12_345);
const threshold = BigInt(1_000);
const expiry = BigInt(4_102_444_800); // fixed synthetic test context, 2100-01-01

function fieldToBytes(value) {
  const hex = value.toString(16).padStart(64, "0");
  return Uint8Array.from(hex.match(/.{2}/g), (byte) => Number.parseInt(byte, 16));
}

function bytesToField(value) {
  return BigInt(`0x${Buffer.from(value).toString("hex")}`);
}

const publicContext = {
  subject: subject.toString(),
  policy_id: "1",
  policy_version: "1",
  threshold: threshold.toString(),
  credential_version: "1",
  expires_at: expiry.toString(),
  chain_id: "91342",
  vault_address: vaultAddress.toString(),
};

const api = await Barretenberg.new({ threads: 1, crsPath });
try {
  const commitmentResult = await api.pedersenHash({
    inputs: [
      domainTag,
      privateValue,
      salt,
      subject,
      BigInt(1),
      BigInt(1),
      threshold,
      BigInt(1),
      expiry,
      BigInt(91342),
      vaultAddress,
    ].map(fieldToBytes),
    hashIndex: 0,
  });
  const commitment = bytesToField(commitmentResult.hash);
  const issuerCommitment = await computeEligibilityCommitment({
    subject: `0x${subject.toString(16).padStart(40, "0")}`,
    privateValue: privateValue.toString(),
    salt: `0x${salt.toString(16).padStart(64, "0")}`,
    policyId: 1n,
    policyVersion: 1n,
    threshold,
    credentialVersion: 1n,
    expiresAt: expiry,
    chainId: 91342n,
    vault: `0x${vaultAddress.toString(16).padStart(40, "0")}`,
  });
  assert.equal(issuerCommitment, `0x${commitment.toString(16).padStart(64, "0")}`, "issuer commitment helper does not match Noir commitment");
  const noir = new Noir(circuit);
  const backend = new UltraHonkBackend(circuit.bytecode, api);
  const validInputs = {
    ...publicContext,
    commitment: commitment.toString(),
    private_value: privateValue.toString(),
    salt: salt.toString(),
  };
  const { witness } = await noir.execute(validInputs);
  const proof = await backend.generateProof(witness, { verifierTarget: "evm" });
  assert.equal(await backend.verifyProof(proof, { verifierTarget: "evm" }), true, "valid proof failed local verification");

  const testDataDir = path.resolve(root, "circuits/testdata");
  await mkdir(testDataDir, { recursive: true });
  await writeFile(path.join(testDataDir, "eligibility-proof.hex"), Buffer.from(proof.proof).toString("hex"));
  await writeFile(path.join(testDataDir, "eligibility-public-inputs.json"), JSON.stringify(proof.publicInputs, null, 2));

  await assert.rejects(
    noir.execute({ ...validInputs, private_value: "999" }),
    "under-threshold witness unexpectedly executed",
  );
  await assert.rejects(
    noir.execute({ ...validInputs, commitment: (commitment + BigInt(1)).toString() }),
    "mismatched commitment unexpectedly executed",
  );
  await assert.rejects(
    noir.execute({ ...validInputs, subject: (subject + BigInt(1)).toString() }),
    "wrong-wallet witness unexpectedly executed",
  );

  process.stdout.write(JSON.stringify({
    result: "valid proof verified; under-threshold, mismatched-commitment, and wrong-wallet witnesses rejected",
    publicInputCount: proof.publicInputs.length,
    publicInputs: proof.publicInputs,
    proofBytes: proof.proof.length,
    commitment: `0x${commitment.toString(16).padStart(64, "0")}`,
  }, null, 2) + "\n");
} finally {
  await api.destroy();
}
