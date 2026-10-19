import { createPublicClient, defineChain, fallback, http } from "viem";

export const ROBINHOOD_MAINNET_CHAIN_ID = 4_663;
export const ROBINHOOD_MAINNET_PRIMARY_RPC_URL = "https://rpc.mainnet.chain.robinhood.com";
export const ROBINHOOD_MAINNET_FALLBACK_RPC_URL = "https://api.blockvectra.com/v1/robinhood_mainnet/public";

export const MAINNET_RPC_PROBE = {
  contractAddress: "0x0329f0c47a7e2d390b0593fe3f3348b4c467158c",
  transactionHash: "0x117900470f19628ee4ba64394eae95ab5cd958fe4cfa6924f1b3dc4e33c9ef3a",
};

const MAX_READ_BATCH_SIZE = 2;

const PAUSED_SELECTOR = "0x5c975abb";
const PROBE_FROM = "0x0000000000000000000000000000000000000001";
const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_ATTEMPTS = 2;
const isRetryableHttpStatus = (status) => status === 408 || status === 425 || status === 429 || status >= 500;

function normalizeEndpoint(label, value, headers) {
  if (!value?.trim()) return undefined;
  let parsed;
  try { parsed = new URL(value.trim()); }
  catch { throw new Error(`${label} Mainnet RPC endpoint is not a valid URL.`); }
  if (!(["http:", "https:"].includes(parsed.protocol))) {
    throw new Error(`${label} Mainnet RPC endpoint must use HTTP or HTTPS.`);
  }
  return { label, url: parsed.toString(), ...(headers ? { headers } : {}) };
}

export function getMainnetRpcCandidates({
  primaryUrl = process.env.RH_MAINNET_RPC_URL || ROBINHOOD_MAINNET_PRIMARY_RPC_URL,
  fallbackUrl,
  fallbackApiKey = process.env.RH_MAINNET_RPC_FALLBACK_API_KEY || process.env.BLOCKVECTRA_API_KEY,
} = {}) {
  const configuredFallback = fallbackUrl || (fallbackApiKey
    ? "https://api.blockvectra.com/v1/robinhood_mainnet"
    : ROBINHOOD_MAINNET_FALLBACK_RPC_URL);
  let parsedFallback;
  try { parsedFallback = new URL(configuredFallback); }
  catch { throw new Error("fallback Mainnet RPC endpoint is not a valid URL."); }
  const useBlockvectraKey = Boolean(fallbackApiKey) && parsedFallback.hostname === "api.blockvectra.com" &&
    parsedFallback.pathname.startsWith("/v1/robinhood_mainnet");
  if (useBlockvectraKey && parsedFallback.pathname.endsWith("/public")) {
    parsedFallback.pathname = parsedFallback.pathname.slice(0, -"/public".length);
  }
  const candidates = [
    normalizeEndpoint("primary", primaryUrl),
    normalizeEndpoint("fallback", parsedFallback.toString(), useBlockvectraKey ? { "x-api-key": fallbackApiKey } : undefined),
  ].filter(Boolean);
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = candidate.url.replace(/\/$/, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Send a bounded, read-only JSON-RPC batch to one already-selected Mainnet endpoint. */
export async function requestMainnetRpcReadBatch(endpoint, requests, {
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  retryDelayMs = 350,
} = {}) {
  if (!endpoint || !Array.isArray(requests) || requests.length < 1 || requests.length > MAX_READ_BATCH_SIZE) {
    throw new Error(`Mainnet RPC read batches must contain 1–${MAX_READ_BATCH_SIZE} requests.`);
  }
  if (typeof fetchImpl !== "function") throw new Error("HTTP fetch is unavailable in this runtime.");
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3) throw new Error("Mainnet RPC batch retries must be bounded to 1–3 attempts.");
  const ids = new Set();
  for (const request of requests) {
    if (request?.jsonrpc !== "2.0" || request.method !== "eth_getLogs" ||
      !(typeof request.id === "string" || typeof request.id === "number") || ids.has(request.id)) {
      throw new Error("Mainnet RPC batches accept unique, read-only eth_getLogs requests only.");
    }
    ids.add(request.id);
  }
  let parsed;
  try { parsed = new URL(endpoint.url); }
  catch { throw new Error("Mainnet RPC batch endpoint is invalid."); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash) {
    throw new Error("Mainnet RPC batch endpoint must use HTTPS without embedded credentials or fragments.");
  }
  const apiKey = endpoint.headers?.["x-api-key"];
  const isBlockvectraFallback = endpoint.label === "fallback" &&
    parsed.hostname.toLowerCase() === "api.blockvectra.com" &&
    (parsed.pathname === "/v1/robinhood_mainnet" || parsed.pathname.startsWith("/v1/robinhood_mainnet/"));
  if (apiKey && !isBlockvectraFallback) throw new Error("Authenticated headers are restricted to the BlockVectra Mainnet fallback.");

  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetchImpl(endpoint.url, {
        method: "POST",
        headers: { "content-type": "application/json", ...(apiKey ? { "x-api-key": apiKey } : {}) },
        body: JSON.stringify(requests),
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
      if (!response.ok) {
        const error = Object.assign(new Error(`Mainnet RPC batch returned HTTP ${response.status}.`), { httpStatus: response.status });
        if (attempt + 1 < maxAttempts && isRetryableHttpStatus(response.status)) {
          if (retryDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          continue;
        }
        throw error;
      }
      const body = await response.json();
      if (!Array.isArray(body) || body.length !== requests.length) throw new Error("Mainnet RPC returned an invalid batch response.");
      const responses = new Map();
      for (const item of body) {
        if (!item || item.jsonrpc !== "2.0" || !ids.has(item.id) || responses.has(item.id) ||
          (!Object.hasOwn(item, "result") && !Object.hasOwn(item, "error"))) {
          throw new Error("Mainnet RPC batch response did not match its request IDs.");
        }
        responses.set(item.id, item);
      }
      const limited = [...responses.values()].find((item) => item.error?.code === -32005);
      if (limited) {
        const error = Object.assign(new Error("Mainnet RPC batch was rate limited."), { rpcCode: -32005 });
        if (attempt + 1 < maxAttempts) {
          if (retryDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          continue;
        }
        throw error;
      }
      return requests.map(({ id }) => responses.get(id));
    } catch (error) {
      lastError = error;
      const status = error?.httpStatus;
      const permanentHttpError = Number.isInteger(status) && status >= 400 && status < 500 && status !== 408 && status !== 425 && status !== 429;
      if (permanentHttpError || attempt + 1 >= maxAttempts) break;
      if (retryDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Mainnet RPC batch request failed.");
}

function rpcFailureKind(error) {
  if (error?.rpcCode === -32601) return "does not support a required RPC method";
  if (error?.rpcCode === -32005 || error?.httpStatus === 429) return "is rate limited";
  if (error?.httpStatus && error.httpStatus >= 400 && error.httpStatus < 500) return "rejected a required RPC request";
  if (error?.httpStatus) return "returned an HTTP error";
  if (/timeout|timed out|abort/i.test(String(error?.message ?? error))) return "timed out";
  if (/fetch|network|socket|reset|econn|connection/i.test(String(error?.message ?? error))) return "had a transport error";
  return "returned an invalid RPC response";
}

function getErrorChain(error) {
  const chain = [];
  const seen = new Set();
  let current = error;
  while (current && typeof current === "object" && !seen.has(current) && chain.length < 12) {
    seen.add(current);
    chain.push(current);
    current = current.cause ?? current.error;
  }
  return chain;
}

function errorChainText(error) {
  return getErrorChain(error).flatMap((item) => [item.shortMessage, item.message, item.details]
    .filter((value) => typeof value === "string" && value.length > 0)).join(" | ");
}

export function formatMainnetRpcError(error, candidates = getMainnetRpcCandidates()) {
  const details = getErrorChain(error).map((item) => {
    const code = item.rpcCode ?? (typeof item.code === "number" ? item.code : undefined);
    const httpStatus = item.httpStatus ?? item.status;
    const message = item.details ?? item.message ?? item.shortMessage ?? item.name ?? "RPC request failed";
    const prefix = [item.name, code !== undefined ? `RPC ${code}` : undefined,
      Number.isInteger(httpStatus) ? `HTTP ${httpStatus}` : undefined].filter(Boolean).join(" ");
    return `${prefix ? `${prefix}: ` : ""}${String(message).split("\n", 1)[0]}`;
  });
  return redactMainnetRpcUrls([...new Set(details)].join(" <- ") || "RPC request failed.", candidates);
}

async function requestRpc(candidate, method, params, { fetchImpl, timeoutMs, maxAttempts, retryDelayMs }) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchImpl(candidate.url, {
        method: "POST",
        headers: { "content-type": "application/json", ...candidate.headers },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        const error = new Error("HTTP response");
        error.httpStatus = response.status;
        throw error;
      }
      const body = await response.json();
      if (body?.error) {
        const error = new Error("JSON-RPC error");
        error.rpcCode = body.error.code;
        throw error;
      }
      if (!Object.hasOwn(body ?? {}, "result")) throw new Error("Malformed JSON-RPC result");
      return body.result;
    } catch (error) {
      lastError = error;
      const permanent = error?.rpcCode === -32601 ||
        (error?.httpStatus >= 400 && error?.httpStatus < 500 && error?.httpStatus !== 429) ||
        (error?.rpcCode && error.rpcCode !== -32005);
      if (permanent || attempt === maxAttempts) break;
      if (retryDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
  const error = new Error(`${method} ${rpcFailureKind(lastError)} after ${maxAttempts} bounded attempt${maxAttempts === 1 ? "" : "s"}.`);
  error.cause = lastError;
  throw error;
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

async function probeEndpoint(candidate, options) {
  const lastRequestAt = { value: 0 };
  const request = async (method, params) => {
    const delay = Math.max(0, options.minimumRequestIntervalMs - (Date.now() - lastRequestAt.value));
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    lastRequestAt.value = Date.now();
    return requestRpc(candidate, method, params, options);
  };
  const chainId = await request("eth_chainId", []);
  requireCondition(Number(BigInt(chainId)) === ROBINHOOD_MAINNET_CHAIN_ID,
    `${candidate.label} endpoint returned the wrong chain; expected Robinhood Mainnet chain 4663.`);

  const latestBlock = await request("eth_blockNumber", []);
  requireCondition(typeof latestBlock === "string" && /^0x[0-9a-f]+$/i.test(latestBlock), `${candidate.label} endpoint returned an invalid chain head.`);
  const head = BigInt(latestBlock);
  const fromBlock = head > 64n ? head - 64n : 0n;
  const logFilter = {
    address: MAINNET_RPC_PROBE.contractAddress,
    fromBlock: `0x${fromBlock.toString(16)}`,
    toBlock: latestBlock,
  };
  const code = await request("eth_getCode", [MAINNET_RPC_PROBE.contractAddress, "latest"]);
  const readResult = await request("eth_call", [{ to: MAINNET_RPC_PROBE.contractAddress, data: PAUSED_SELECTOR }, "latest"]);
  const estimatedGas = await request("eth_estimateGas", [{ from: PROBE_FROM, to: MAINNET_RPC_PROBE.contractAddress, data: PAUSED_SELECTOR }]);
  requireCondition(typeof code === "string" && /^0x[0-9a-f]+$/i.test(code) && code !== "0x", `${candidate.label} endpoint returned no probe-contract bytecode.`);
  requireCondition(typeof readResult === "string" && /^0x[0-9a-f]{64,}$/i.test(readResult), `${candidate.label} endpoint failed the read-call probe.`);
  requireCondition(typeof estimatedGas === "string" && /^0x[0-9a-f]+$/i.test(estimatedGas) && BigInt(estimatedGas) > 0n,
    `${candidate.label} endpoint failed the read-only simulation probe.`);
  const capabilities = { read: true, simulation: true, logs: false, receipt: false };
  let logs;
  try { logs = await request("eth_getLogs", [logFilter]); capabilities.logs = Array.isArray(logs); } catch { /* surfaced below for required capabilities */ }
  let receipt, transaction;
  try {
    receipt = await request("eth_getTransactionReceipt", [MAINNET_RPC_PROBE.transactionHash]);
    transaction = await request("eth_getTransactionByHash", [MAINNET_RPC_PROBE.transactionHash]);
  } catch { /* surfaced below for required capabilities */ }
  const receiptMatches = receipt && receipt.transactionHash?.toLowerCase() === MAINNET_RPC_PROBE.transactionHash.toLowerCase()
    && receipt.status === "0x1" && receipt.contractAddress?.toLowerCase() === MAINNET_RPC_PROBE.contractAddress.toLowerCase()
    && /^0x[0-9a-f]+$/i.test(receipt.blockNumber ?? "") && /^0x[0-9a-f]{64}$/i.test(receipt.blockHash ?? "");
  const transactionMatches = transaction && transaction.hash?.toLowerCase() === MAINNET_RPC_PROBE.transactionHash.toLowerCase()
    && (transaction.chainId == null || Number(BigInt(transaction.chainId)) === ROBINHOOD_MAINNET_CHAIN_ID)
    && receiptMatches && transaction.blockHash?.toLowerCase() === receipt.blockHash.toLowerCase();
  if (receiptMatches && transactionMatches) {
    const block = await request("eth_getBlockByHash", [receipt.blockHash, false]);
    capabilities.receipt = block?.hash?.toLowerCase() === receipt.blockHash.toLowerCase();
  }
  const missing = options.requiredCapabilities.filter((capability) => !capabilities[capability]);
  requireCondition(missing.length === 0, `${candidate.label} endpoint is missing required capability${missing.length === 1 ? "" : "ies"}: ${missing.join(", ")}.`);
  return {
    ...candidate,
    chainId: ROBINHOOD_MAINNET_CHAIN_ID,
    latestBlock: head,
    capabilities,
  };
}

export async function resolveUsableMainnetRpcEndpoints(candidates = getMainnetRpcCandidates(), {
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  retryDelayMs = 200,
  minimumRequestIntervalMs = 500,
  requiredCapabilities = ["read", "simulation", "logs", "receipt"],
} = {}) {
  requireCondition(Array.isArray(candidates) && candidates.length > 0, "Configure a Robinhood Mainnet primary or fallback RPC endpoint.");
  requireCondition(typeof fetchImpl === "function", "HTTP fetch is unavailable in this runtime.");
  requireCondition(Number.isInteger(maxAttempts) && maxAttempts >= 1 && maxAttempts <= 3, "RPC retries must be bounded to 1–3 attempts.");
  requireCondition(requiredCapabilities.every((capability) => ["read", "simulation", "logs", "receipt"].includes(capability)), "Unknown Mainnet RPC capability requested.");

  const usable = [];
  const failures = [];
  for (const candidate of candidates) {
    try {
      usable.push(await probeEndpoint(candidate, { fetchImpl, timeoutMs, maxAttempts, retryDelayMs, minimumRequestIntervalMs, requiredCapabilities }));
    } catch (error) {
      failures.push(`${candidate.label}: ${error instanceof Error ? error.message : "RPC capability check failed"}`);
    }
  }
  if (usable.length === 0) {
    throw new Error(`No Robinhood Mainnet RPC passed chain 4663 and required capabilities (${requiredCapabilities.join(", ")}). ${failures.join("; ")}`);
  }
  return usable;
}

/** Probe endpoints first, then expose only those that passed every required Mainnet capability check. */
export function createMainnetHttpTransport(endpoint, {
  timeoutMs = DEFAULT_TIMEOUT_MS,
  minimumRequestIntervalMs,
  fetchFn,
} = {}) {
  const host = new URL(endpoint.url).hostname;
  const intervalMs = minimumRequestIntervalMs ?? (host === "api.blockvectra.com" ? 350 : 0);
  const base = http(endpoint.url, {
    timeout: timeoutMs,
    retryCount: 0,
    fetchFn,
    fetchOptions: endpoint.headers ? { headers: endpoint.headers } : undefined,
  });
  let queue = Promise.resolve();
  let nextRequestAt = 0;
  return (config) => {
    const transport = base(config);
    return {
      ...transport,
      request: (args) => {
        const pending = queue.then(async () => {
          const delay = Math.max(0, nextRequestAt - Date.now());
          if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
          nextRequestAt = Date.now() + intervalMs;
          const isBroadcast = args.method === "eth_sendRawTransaction" || args.method === "eth_sendTransaction";
          for (let attempt = 0; attempt < (isBroadcast ? 1 : 2); attempt += 1) {
            try {
              return await transport.request(args);
            } catch (error) {
              const detail = errorChainText(error);
              const retryable = /429|rate.?limit|too many requests|defined limit|socket.*closed|connection reset|econnreset|fetch failed|network error|timed? ?out|timeout/i.test(detail) ||
                getErrorChain(error).some((item) => item.rpcCode === -32005 || item.code === -32005 || item.httpStatus === 429 || item.status === 429);
              if (isBroadcast) {
                const stopped = new Error("Broadcast request outcome is uncertain; inspect its transaction hash and chain state before any retry.");
                stopped.stopFailover = true;
                throw stopped;
              }
              if (attempt === 0 && retryable) {
                await new Promise((resolve) => setTimeout(resolve, 500));
                nextRequestAt = Date.now();
                continue;
              }
              throw new Error(`${args.method} failed: ${String(detail || "RPC request failed").split("\n", 1)[0]}`, { cause: error });
            }
          }
        });
        queue = pending.then(() => undefined, () => undefined);
        return pending;
      },
    };
  };
}

export async function createVerifiedMainnetClient({
  primaryUrl,
  fallbackUrl,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  requiredCapabilities = ["read", "simulation", "logs", "receipt"],
  fallbackApiKey,
} = {}) {
  const candidates = getMainnetRpcCandidates({ primaryUrl, fallbackUrl, fallbackApiKey });
  const endpoints = await resolveUsableMainnetRpcEndpoints(candidates, { timeoutMs, maxAttempts, requiredCapabilities });
  const chain = defineChain({
    id: ROBINHOOD_MAINNET_CHAIN_ID,
    name: "Robinhood Chain Mainnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: endpoints.map(({ url }) => url) } },
  });
  const client = createPublicClient({
    chain,
    transport: fallback(
      endpoints.map((endpoint) => createMainnetHttpTransport(endpoint, { timeoutMs })),
      // Only this read client uses bounded retries. Signed writes are submitted by
      // separate single-endpoint `cast` processes and are never retried here.
      {
        rank: false,
        retryCount: 0,
        retryDelay: 0,
        shouldThrow: (error) => error?.stopFailover === true,
      },
    ),
  });
  return { client, chain, endpoints, selected: endpoints[0] };
}

export function redactMainnetRpcUrls(message, candidates = getMainnetRpcCandidates()) {
  let safe = String(message ?? "RPC request failed.");
  for (const candidate of candidates) safe = safe.replaceAll(candidate.url, `<${candidate.label} Mainnet RPC>`);
  const credentials = [
    process.env.RH_MAINNET_RPC_FALLBACK_API_KEY,
    process.env.BLOCKVECTRA_API_KEY,
    ...candidates.map(({ headers }) => headers?.["x-api-key"]),
  ].filter(Boolean);
  for (const secret of credentials) safe = safe.replaceAll(secret, "<redacted RPC credential>");
  safe = safe.replace(/https?:\/\/[^\s"'<>]+/gi, "<RPC endpoint>");
  return safe;
}
