import type { Hex, Address } from "viem";

export const DEMO_COMMITMENT_DOMAIN_TAG = BigInt("0x1f474957415f505249564154455f454c49474942494c4954595f5631");
const FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const UINT64_MAX = (1n << 64n) - 1n;

function fieldBytes(value: bigint): Uint8Array {
  if (value < 0n || value >= FIELD_MODULUS) throw new Error("A commitment input is outside the circuit field.");
  const hex = value.toString(16).padStart(64, "0");
  return Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
}

export function generateFieldSalt(): Hex {
  if (!globalThis.crypto?.getRandomValues) throw new Error("A secure browser random source is unavailable.");
  let value: bigint;
  let bytes: Uint8Array;
  do {
    bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
    value = BigInt(`0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`);
  } while (value >= FIELD_MODULUS);
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function computeEligibilityCommitment(input: {
  subject: Address;
  privateValue: string;
  salt: Hex;
  policyId: bigint;
  policyVersion: bigint;
  threshold: bigint;
  credentialVersion: bigint;
  expiresAt: bigint;
  chainId: bigint;
  vault: Address;
}): Promise<Hex> {
  if (!/^(0|[1-9][0-9]*)$/.test(input.privateValue)) {
    throw new Error("The private value must be an unsigned decimal integer.");
  }
  const privateValue = BigInt(input.privateValue);
  if (privateValue > UINT64_MAX || input.threshold > UINT64_MAX || privateValue < input.threshold) {
    throw new Error("The private value must meet the policy threshold and fit in an unsigned 64-bit integer.");
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(input.salt)) throw new Error("The salt must be a 32-byte field value.");

  const fields = [
    DEMO_COMMITMENT_DOMAIN_TAG,
    privateValue,
    BigInt(input.salt),
    BigInt(input.subject),
    input.policyId,
    input.policyVersion,
    input.threshold,
    input.credentialVersion,
    input.expiresAt,
    input.chainId,
    BigInt(input.vault),
  ];
  const { Barretenberg } = await import("@aztec/bb.js");
  const api = await Barretenberg.new({ threads: 1, skipSrsInit: true });
  try {
    const result = await api.pedersenHash({ inputs: fields.map(fieldBytes), hashIndex: 0 });
    return `0x${Array.from(result.hash, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  } finally {
    await api.destroy();
  }
}
