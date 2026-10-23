import { z } from "zod";
import { isAddress } from "viem";
import type { Address, Hex } from "viem";

export const GYEVO_CREDENTIAL_FORMAT = "gyevo-credential-v1" as const;
export const MAX_CREDENTIAL_JSON_BYTES = 256 * 1024;

export type LegacyCredentialFormat = "giwa-demo-credential-v1" | "robinhood-demo-credential-v1";
export type CredentialFormat = typeof GYEVO_CREDENTIAL_FORMAT | LegacyCredentialFormat;

const witnessSchema = z.object({
  format: z.enum([GYEVO_CREDENTIAL_FORMAT, "giwa-demo-credential-v1", "robinhood-demo-credential-v1"]),
  chainId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  wallet: z.string().refine(isAddress, "wallet must be a valid EVM address"),
  policyId: z.number().int().positive(),
  commitment: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "commitment must be bytes32"),
  privateValue: z.string().regex(/^(0|[1-9][0-9]*)$/, "privateValue must be an unsigned decimal integer"),
  salt: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "salt must be bytes32"),
  expiresAt: z.number().int().nonnegative(),
}).superRefine((value, context) => {
  if (value.format === GYEVO_CREDENTIAL_FORMAT && value.chainId === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["chainId"], message: "GYEVO credentials must include their supported chain ID" });
  }
});

export interface DemoCredentialWitness {
  format: CredentialFormat;
  /** New GYEVO credentials carry explicit network metadata; legacy files remain importable without it. */
  chainId?: number;
  wallet: Address;
  policyId: number;
  commitment: Hex;
  privateValue: string;
  salt: Hex;
  expiresAt: number;
}

export type GyevoCredentialWitnessInput = Omit<DemoCredentialWitness, "format" | "chainId">;

/** Adds application-format metadata only; cryptographic witness fields are copied unchanged. */
export function createGyevoCredentialWitness(input: GyevoCredentialWitnessInput, chainId: number): DemoCredentialWitness {
  if (!Number.isSafeInteger(chainId) || chainId <= 0) throw new Error("Credential chain ID must be a positive safe integer.");
  return parseDemoCredentialWitness({ ...input, format: GYEVO_CREDENTIAL_FORMAT, chainId });
}

/** Keep legacy network family checks separate; a GYEVO file must match its explicit chain ID. */
export function isCredentialWitnessForChain(
  witness: DemoCredentialWitness,
  chainId: number,
  legacyFormat: LegacyCredentialFormat,
): boolean {
  if (!Number.isSafeInteger(chainId) || chainId <= 0) return false;
  if (witness.format === GYEVO_CREDENTIAL_FORMAT) return witness.chainId === chainId;
  return witness.format === legacyFormat && (witness.chainId === undefined || witness.chainId === chainId);
}

export function credentialDownloadFilename(policyId: number): string {
  if (!Number.isSafeInteger(policyId) || policyId <= 0) throw new Error("Credential policy ID must be a positive safe integer.");
  return `gyevo-policy${policyId}-credential.json`;
}

/** A display-only view of the private file. Never pass witness secrets to UI text or telemetry. */
export function summarizeCredentialWitness(
  witness: DemoCredentialWitness,
  networkName: string,
  walletMatches: boolean,
) {
  return {
    policyId: witness.policyId,
    chainId: witness.chainId,
    networkName,
    expiresAt: witness.expiresAt,
    walletAssociation: walletMatches ? "matches-connected-wallet" as const : "does-not-match-connected-wallet" as const,
  };
}

export function parseCredentialWitnessJson(json: string): DemoCredentialWitness {
  if (new TextEncoder().encode(json).byteLength > MAX_CREDENTIAL_JSON_BYTES) {
    throw new Error("Credential file exceeds the 256 KB import limit.");
  }
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new Error("Credential file must contain valid JSON.");
  }
  return parseDemoCredentialWitness(value);
}

export function parseDemoCredentialWitness(value: unknown): DemoCredentialWitness {
  const parsed = witnessSchema.parse(value);
  return {
    ...parsed,
    wallet: parsed.wallet as Address,
    commitment: parsed.commitment as Hex,
    salt: parsed.salt as Hex,
  };
}
