import { z } from "zod";
import { isAddress } from "viem";
import type { Address, Hex } from "viem";

const witnessSchema = z.object({
  format: z.literal("giwa-demo-credential-v1"),
  wallet: z.string().refine(isAddress, "wallet must be a valid EVM address"),
  policyId: z.number().int().positive(),
  commitment: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "commitment must be bytes32"),
  privateValue: z.string().regex(/^(0|[1-9][0-9]*)$/, "privateValue must be an unsigned decimal integer"),
  salt: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "salt must be bytes32"),
  expiresAt: z.number().int().nonnegative(),
});

export interface DemoCredentialWitness {
  format: "giwa-demo-credential-v1";
  wallet: Address;
  policyId: number;
  commitment: Hex;
  privateValue: string;
  salt: Hex;
  expiresAt: number;
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
