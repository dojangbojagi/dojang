import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  GIWA_RPC_URL: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().url().default("https://sepolia-rpc.giwa.io"),
  ),
});

const result = serverEnvSchema.safeParse({ GIWA_RPC_URL: process.env.GIWA_RPC_URL });
if (!result.success) throw new Error(`Invalid server environment configuration: ${result.error.message}`);

/** Server-only RPC configuration. Do not import this from client components. */
export const serverEnv = { giwaRpcUrl: result.data.GIWA_RPC_URL } as const;
