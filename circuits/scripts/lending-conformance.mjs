import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";
import {
  computeEligibilityCommitment,
  DEMO_COMMITMENT_DOMAIN_TAG,
} from "../../src/lib/zk/commitment.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const crsPath = path.resolve(root, "circuits/cache/bb-crs");
const circuit = JSON.parse(await readFile(path.resolve(root, "public/circuits/private_eligibility.json"), "utf8"));
const subject = "0x1111111111111111111111111111111111111111";
const privateValue = 1_250n;
const salt = 12_345n;
const threshold = 1_000n;
const credentialExpiry = 4_102_444_800n;
const policyId = 2n;
const policyVersion = 1n;
const credentialVersion = 1n;
const chainId = 91_342n;

// Forge links generated HonkVerifier's two internal source libraries while compiling tests,
// so its linked test bytecode differs from the unresolved artifact. The test separately checks
// the linked verifier address and checks the pool's deterministic address after all dependencies
// are deployed; that pool check binds the generated proof to the actual fixture.
const registryAddress = "0x69ED2b86bA0FB926Aa8dD8B7D0277aA8B9d89397";
const generatedVerifierAddress = "0x9A18EFD530298F3e4C60a7AfbA1E584A519ADADE";
const adapterAddress = "0xC72f05E8AE9D8EeeC952B4bB43cCC3998aAdCC9F";
const lendingAssetAddress = "0x4C573bab957c7F051E4fF7705Ff891DC90F8ceBE";
const collateralAssetAddress = "0x1F673D5983801b6Ef96b91E4F4fde0A733f51c85";
const lendingPoolAddress = "0xa20E4d72e2A2F8e5456272d2D1f7a5aB425137ED";
process.stdout.write(JSON.stringify({
  deterministicAddresses: {
    registry: registryAddress,
    generatedVerifier: generatedVerifierAddress,
    adapter: adapterAddress,
    lendingAsset: lendingAssetAddress,
    collateralAsset: collateralAssetAddress,
    lendingPool: lendingPoolAddress,
  },
}, null, 2) + "\n");

const commitment = await computeEligibilityCommitment({
  subject,
  privateValue: privateValue.toString(),
  salt: `0x${salt.toString(16).padStart(64, "0")}`,
  policyId,
  policyVersion,
  threshold,
  credentialVersion,
  expiresAt: credentialExpiry,
  chainId,
  vault: lendingPoolAddress,
});
const publicContext = {
  subject: BigInt(subject).toString(),
  commitment: BigInt(commitment).toString(),
  policy_id: policyId.toString(),
  policy_version: policyVersion.toString(),
  threshold: threshold.toString(),
  credential_version: credentialVersion.toString(),
  expires_at: credentialExpiry.toString(),
  chain_id: chainId.toString(),
  vault_address: BigInt(lendingPoolAddress).toString(),
};
const expectedPublicInputs = [
  BigInt(subject),
  BigInt(commitment),
  policyId,
  policyVersion,
  threshold,
  credentialVersion,
  credentialExpiry,
  chainId,
  BigInt(lendingPoolAddress),
];
const noirInputs = {
  ...publicContext,
  private_value: privateValue.toString(),
  salt: salt.toString(),
};

const api = await Barretenberg.new({ threads: 1, crsPath });
try {
  const noir = new Noir(circuit);
  const backend = new UltraHonkBackend(circuit.bytecode, api);
  const { witness } = await noir.execute(noirInputs);
  const proof = await backend.generateProof(witness, { verifierTarget: "evm" });
  assert.equal(await backend.verifyProof(proof, { verifierTarget: "evm" }), true, "lending proof failed local verification");

  const actualPublicInputs = proof.publicInputs.map((input) => BigInt(input));
  assert.deepEqual(actualPublicInputs, expectedPublicInputs, "lending proof context or public-input order mismatch");

  const underThresholdCommitment = await computeUncheckedCommitment(api, {
    subject,
    privateValue: 999n,
    salt,
    policyId,
    policyVersion,
    threshold,
    credentialVersion,
    expiresAt: credentialExpiry,
    chainId,
    vault: lendingPoolAddress,
  });
  await assert.rejects(noir.execute({
    ...noirInputs,
    commitment: BigInt(underThresholdCommitment).toString(),
    private_value: "999",
  }), "under-threshold lending witness unexpectedly executed");

  const outputDirectory = path.resolve(root, "circuits/testdata");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(path.join(outputDirectory, "lending-proof.hex"), Buffer.from(proof.proof).toString("hex"));
  await writeFile(
    path.join(outputDirectory, "lending-public-inputs.json"),
    JSON.stringify(proof.publicInputs, null, 2),
  );

  process.stdout.write(JSON.stringify({
    result: "lending proof locally verified; under-threshold witness rejected",
    publicInputCount: proof.publicInputs.length,
    lendingPoolAddress,
    registryAddress,
    commitment,
    proofBytes: proof.proof.length,
  }, null, 2) + "\n");
} finally {
  await api.destroy();
}

async function computeUncheckedCommitment(api, input) {
  const fields = [
    DEMO_COMMITMENT_DOMAIN_TAG,
    input.privateValue,
    input.salt,
    BigInt(input.subject),
    input.policyId,
    input.policyVersion,
    input.threshold,
    input.credentialVersion,
    input.expiresAt,
    input.chainId,
    BigInt(input.vault),
  ];
  const { hash } = await api.pedersenHash({
    inputs: fields.map((value) => {
      const bytes = value.toString(16).padStart(64, "0");
      return Uint8Array.from(bytes.match(/.{2}/g), (byte) => Number.parseInt(byte, 16));
    }),
    hashIndex: 0,
  });
  return `0x${Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
