import { z } from "zod";

const optionalAddress = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const defaultedString = (fallback: string) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(1).default(fallback),
  );

const envSchema = z.object({
  NEXT_PUBLIC_APP_NAME: defaultedString("Private Verifiable State"),
  NEXT_PUBLIC_APP_DESCRIPTION: defaultedString("Prove eligibility without revealing private state."),
  NEXT_PUBLIC_APP_TAGLINE: defaultedString("Prove more. Reveal less."),
  NEXT_PUBLIC_GIWA_RPC_URL: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().url().default("https://sepolia-rpc.giwa.io"),
  ),
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().trim().optional(),
  NEXT_PUBLIC_DEMO_CREDENTIAL_REGISTRY_CONTRACT: optionalAddress,
  NEXT_PUBLIC_PROOF_VERIFIER_CONTRACT: optionalAddress,
  NEXT_PUBLIC_RESTRICTED_VAULT_CONTRACT: optionalAddress,
  NEXT_PUBLIC_LENDING_POOL_CONTRACT: optionalAddress,
});

const result = envSchema.safeParse({
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_APP_DESCRIPTION: process.env.NEXT_PUBLIC_APP_DESCRIPTION,
  NEXT_PUBLIC_APP_TAGLINE: process.env.NEXT_PUBLIC_APP_TAGLINE,
  NEXT_PUBLIC_GIWA_RPC_URL: process.env.NEXT_PUBLIC_GIWA_RPC_URL,
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  NEXT_PUBLIC_DEMO_CREDENTIAL_REGISTRY_CONTRACT:
    process.env.NEXT_PUBLIC_DEMO_CREDENTIAL_REGISTRY_CONTRACT,
  NEXT_PUBLIC_PROOF_VERIFIER_CONTRACT: process.env.NEXT_PUBLIC_PROOF_VERIFIER_CONTRACT,
  NEXT_PUBLIC_RESTRICTED_VAULT_CONTRACT: process.env.NEXT_PUBLIC_RESTRICTED_VAULT_CONTRACT,
  NEXT_PUBLIC_LENDING_POOL_CONTRACT: process.env.NEXT_PUBLIC_LENDING_POOL_CONTRACT,
});

if (!result.success) {
  throw new Error(`Invalid public environment configuration: ${result.error.message}`);
}

export const appEnv = {
  appName: result.data.NEXT_PUBLIC_APP_NAME,
  description: result.data.NEXT_PUBLIC_APP_DESCRIPTION,
  tagline: result.data.NEXT_PUBLIC_APP_TAGLINE,
  giwaRpcUrl: result.data.NEXT_PUBLIC_GIWA_RPC_URL,
  walletConnectProjectId: result.data.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || undefined,
  contracts: {
    credentialRegistry: result.data.NEXT_PUBLIC_DEMO_CREDENTIAL_REGISTRY_CONTRACT,
    proofVerifier: result.data.NEXT_PUBLIC_PROOF_VERIFIER_CONTRACT,
    restrictedVault: result.data.NEXT_PUBLIC_RESTRICTED_VAULT_CONTRACT,
    lendingPool: result.data.NEXT_PUBLIC_LENDING_POOL_CONTRACT,
  },
} as const;
