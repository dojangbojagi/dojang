import { toHex, type Address, type Hex } from "viem";
import type { DemoCredentialWitness } from "@/lib/credential/witness";
import type { EligibilityProof, PublicProofInputs } from "@/lib/protocol/types";

const ARTIFACT_URL = "/circuits/private_eligibility.json";
const EVM_VERIFIER_TARGET = { verifierTarget: "evm" } as const;

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

async function loadCircuit() {
  circuitPromise ??= fetch(ARTIFACT_URL, { cache: "force-cache" }).then(async (response) => {
    if (!response.ok) throw new Error(`Circuit artifact request failed (${response.status}).`);
    return response.json();
  });
  return circuitPromise;
}

async function loadRuntime() {
  runtimePromise ??= Promise.all([loadCircuit(), import("@noir-lang/noir_js")]).then(([circuit, noirModule]) => ({
    circuit,
    noir: new noirModule.Noir(circuit),
  }));
  return runtimePromise;
}

async function loadBackend() {
  backendPromise ??= (async () => {
    let api: InstanceType<ProverRuntime["Barretenberg"]> | undefined;
    try {
      const [circuit, bbModule] = await Promise.all([loadCircuit(), import("@aztec/bb.js")]);
      // The circuit has 16,384 gates. Keep the browser SRS at that size instead of
      // downloading the package's much larger general-purpose default.
      api = await bbModule.Barretenberg.new({ threads: 1, srsSize: 2 ** 14 });
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
): Promise<EligibilityProof> {
  const [{ noir }, { api, backend }] = await Promise.all([loadRuntime(), loadBackend()]);
  const { witness: compressedWitness } = await noir.execute(toCircuitInputs(witness, context));
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
