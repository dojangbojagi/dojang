import { toHex, type Address, type Hex } from "viem";
import type { DemoCredentialWitness } from "@/lib/credential/witness";
import type { EligibilityProof, PublicProofInputs } from "@/lib/protocol/types";

const ARTIFACT_URL = "/circuits/private_eligibility.json";
const EVM_VERIFIER_TARGET = { verifierTarget: "evm" } as const;
type ProverProgress = (stage: string) => void;

type ProverRuntime = {
  Noir: typeof import("@noir-lang/noir_js").Noir;
  Barretenberg: typeof import("@aztec/bb.js").Barretenberg;
  UltraHonkBackend: typeof import("@aztec/bb.js").UltraHonkBackend;
};

let circuitPromise: Promise<any> | undefined;
let runtimePromise: Promise<{ circuit: any; noir: InstanceType<ProverRuntime["Noir"]> }> | undefined;
let backendPromise: Promise<{
  backend: InstanceType<ProverRuntime["UltraHonkBackend"]>;
  api: InstanceType<ProverRuntime["Barretenberg"]>;
}> | undefined;

async function loadCircuit(onProgress?: ProverProgress) {
  onProgress?.("fetching circuit artifact");
  circuitPromise ??= fetch(ARTIFACT_URL, { cache: "force-cache" }).then(async (response) => {
    if (!response.ok) throw new Error(`Circuit artifact request failed (${response.status}).`);
    return response.json();
  });
  const circuit = await circuitPromise;
  onProgress?.("circuit artifact loaded");
  return circuit;
}

async function loadRuntime(onProgress?: ProverProgress) {
  runtimePromise ??= (async () => {
    const circuit = await loadCircuit(onProgress);
    onProgress?.("loading Noir runtime");
    const noirModule = await import("@noir-lang/noir_js");
    onProgress?.("initializing Noir runtime");
    return { circuit, noir: new noirModule.Noir(circuit) };
  })();
  return runtimePromise;
}

async function loadBackend(onProgress?: ProverProgress) {
  backendPromise ??= (async () => {
    let api: InstanceType<ProverRuntime["Barretenberg"]> | undefined;
    try {
      const circuit = await loadCircuit(onProgress);
      onProgress?.("loading Barretenberg runtime");
      const bbModule = await import("@aztec/bb.js");
      // Browser CRS decompression requires G1 data in 131,072-point (4 MiB) blocks.
      // The circuit only consumes 16,384 points; the larger public CRS is a valid prefix source.
      onProgress?.("initializing Barretenberg and public SRS");
      api = await bbModule.Barretenberg.new({
        threads: 1,
        srsSize: 2 ** 17,
        logger: onProgress ? (message: string) => onProgress(`Barretenberg: ${message}`) : undefined,
      });
      onProgress?.("constructing UltraHonk backend");
      return {
        api,
        backend: new bbModule.UltraHonkBackend(circuit.bytecode, api),
      };
    } catch (error) {
      await api?.destroy();
      backendPromise = undefined;
      throw error;
    }
  })();
  return backendPromise;
}

function toCircuitInputs(witness: DemoCredentialWitness, context: PublicProofInputs) {
  if (!/^(0|[1-9][0-9]*)$/.test(witness.privateValue)) {
    throw new Error("The private value must be an unsigned decimal integer.");
  }

  return {
    subject: BigInt(context.subject).toString(),
    commitment: BigInt(context.commitment).toString(),
    policy_id: context.policyId.toString(),
    policy_version: context.policyVersion.toString(),
    threshold: context.threshold.toString(),
    credential_version: context.credentialVersion.toString(),
    expires_at: context.expiresAt.toString(),
    chain_id: context.chainId.toString(),
    vault_address: BigInt(context.vault).toString(),
    private_value: BigInt(witness.privateValue).toString(),
    salt: BigInt(witness.salt).toString(),
  };
}

function expectedPublicInputs(context: PublicProofInputs): readonly bigint[] {
  return [
    BigInt(context.subject),
    BigInt(context.commitment),
    context.policyId,
    context.policyVersion,
    context.threshold,
    context.credentialVersion,
    context.expiresAt,
    context.chainId,
    BigInt(context.vault),
  ];
}

export async function validateEligibilityWitness(
  witness: DemoCredentialWitness,
  context: PublicProofInputs,
): Promise<void> {
  const { noir } = await loadRuntime();
  await noir.execute(toCircuitInputs(witness, context));
}

export async function generateEligibilityProof(
  witness: DemoCredentialWitness,
  context: PublicProofInputs,
  onProgress?: ProverProgress,
): Promise<EligibilityProof> {
  const [{ noir }, { api, backend }] = await Promise.all([loadRuntime(onProgress), loadBackend(onProgress)]);
  return createEligibilityProof(witness, context, noir, backend, onProgress);
}

/**
 * Generate the same real circuit proof for an operator CLI. The circuit artifact
 * is supplied from the checked-in public build output so Node does not try to
 * fetch the browser-relative `/circuits/...` URL. WASM is explicit here because
 * it is the same SRS-backed prover used by the browser; @aztec/bb.js 5.2.1
 * downloads/caches the canonical CRS from its configured primary/fallback URLs.
 */
export async function generateEligibilityProofFromArtifact(
  witness: DemoCredentialWitness,
  context: PublicProofInputs,
  circuit: any,
  onProgress?: ProverProgress,
): Promise<EligibilityProof> {
  const [{ Noir }, bbModule] = await Promise.all([
    import("@noir-lang/noir_js"),
    import("@aztec/bb.js"),
  ]);
  const api = await bbModule.Barretenberg.new({
    backend: bbModule.BackendType.Wasm,
    threads: 1,
    srsSize: 2 ** 17,
    logger: onProgress ? (message: string) => onProgress(`Barretenberg: ${message}`) : undefined,
  });
  try {
    const noir = new Noir(circuit);
    const backend = new bbModule.UltraHonkBackend(circuit.bytecode, api);
    return await createEligibilityProof(witness, context, noir, backend, onProgress);
  } finally {
    await api.destroy();
  }
}

async function createEligibilityProof(
  witness: DemoCredentialWitness,
  context: PublicProofInputs,
  noir: InstanceType<ProverRuntime["Noir"]>,
  backend: InstanceType<ProverRuntime["UltraHonkBackend"]>,
  onProgress?: ProverProgress,
): Promise<EligibilityProof> {
  onProgress?.("executing Noir witness");
  const { witness: compressedWitness } = await noir.execute(toCircuitInputs(witness, context));
  onProgress?.("generating UltraHonk proof");
  const generated = await backend.generateProof(compressedWitness, EVM_VERIFIER_TARGET);

  const expected = expectedPublicInputs(context);
  if (generated.publicInputs.length !== expected.length) {
    throw new Error(`Circuit returned ${generated.publicInputs.length} public inputs; expected ${expected.length}.`);
  }
  const publicInputs = generated.publicInputs.map((input) => BigInt(input)) as [
    bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint,
  ];
  if (publicInputs.some((input, index) => input !== expected[index])) {
    throw new Error("Circuit public input order does not match the vault contract interface.");
  }

  onProgress?.("locally verifying UltraHonk proof");
  const localVerification = await backend.verifyProof(generated, EVM_VERIFIER_TARGET);
  if (!localVerification) throw new Error("The generated proof failed local Barretenberg verification.");

  return {
    proof: toHex(generated.proof),
    publicInputs,
    publicContext: context,
    createdAt: Date.now(),
    localVerification: "verified",
  };
}

export function proofContextForCredential(input: {
  subject: Address;
  commitment: Hex;
  credentialVersion: bigint;
  expiresAt: bigint;
  vault: Address;
}): PublicProofInputs {
  return {
    subject: input.subject,
    commitment: input.commitment,
    policyId: 1n,
    policyVersion: 1n,
    threshold: 1_000n,
    credentialVersion: input.credentialVersion,
    expiresAt: input.expiresAt,
    chainId: 91_342n,
    vault: input.vault,
  };
}
