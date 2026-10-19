import { spawn } from "node:child_process";

const BLOCKVECTRA_HOST = "api.blockvectra.com";
const BLOCKVECTRA_PATH = "/v1/robinhood_mainnet";

function isAuthenticatedBlockvectraEndpoint(value) {
  let url;
  try { url = new URL(value); }
  catch { throw new Error("Selected Mainnet RPC endpoint is not a valid URL."); }
  if (url.username || url.password) {
    throw new Error("RPC URL credentials are not allowed; use the configured authenticated RPC header.");
  }
  return url.hostname.toLowerCase() === BLOCKVECTRA_HOST &&
    (url.pathname === BLOCKVECTRA_PATH || url.pathname.startsWith(`${BLOCKVECTRA_PATH}/`));
}

/**
 * Build the environment inherited by a Foundry cast subprocess.
 * Credentials are removed from their source variables and only become an HTTP
 * header when the selected endpoint is the authenticated BlockVectra Robinhood
 * Mainnet endpoint. In particular, inherited ETH_RPC_HEADERS never leak to the
 * official Robinhood RPC or any other provider.
 */
export function buildMainnetCastEnvironment(rpcUrl, sourceEnv = process.env, rpcLabel = "primary") {
  const env = { ...sourceEnv };
  const apiKey = sourceEnv.RH_MAINNET_RPC_FALLBACK_API_KEY || sourceEnv.BLOCKVECTRA_API_KEY;
  delete env.ETH_RPC_HEADERS;
  delete env.RH_MAINNET_RPC_FALLBACK_API_KEY;
  delete env.BLOCKVECTRA_API_KEY;

  if (rpcLabel === "fallback" && isAuthenticatedBlockvectraEndpoint(rpcUrl)) {
    if (typeof apiKey !== "string" || apiKey.trim() === "") {
      throw new Error("authenticated BlockVectra RPC was selected without its configured API key.");
    }
    env.ETH_RPC_HEADERS = `x-api-key: ${apiKey.trim()}`;
  }
  return env;
}

/** Spawn Foundry cast against the already-selected Mainnet endpoint. */
export function spawnMainnetCast(args, rpcUrl, {
  rpcLabel = "primary",
  spawnImpl = spawn,
  sourceEnv = process.env,
  stdio = ["inherit", "pipe", "inherit"],
  spawnOptions = {},
} = {}) {
  return spawnImpl("cast", args, {
    stdio,
    env: buildMainnetCastEnvironment(rpcUrl, sourceEnv, rpcLabel),
    ...spawnOptions,
  });
}
