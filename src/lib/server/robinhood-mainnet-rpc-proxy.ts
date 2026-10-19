const CHAIN_ID = 4_663;
const CHAIN_ID_HEX = "0x1237";
const DEFAULT_PRIMARY_RPC = "https://rpc.mainnet.chain.robinhood.com";
const DEFAULT_FALLBACK_RPC = "https://api.blockvectra.com/v1/robinhood_mainnet/public";
const MAX_BODY_BYTES = 128 * 1024;
const MAX_LOG_RANGE_BLOCKS = 20_000n;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT_PER_WINDOW = 120;
const CACHE_TTL_MS = 60_000;
const PROVIDER_FAILURE_COOLDOWN_MS = 30_000;

const READ_ONLY_METHODS = new Set([
  "eth_chainId",
  "eth_blockNumber",
  "eth_call",
  "eth_getBalance",
  "eth_getCode",
  "eth_getLogs",
  "eth_getTransactionCount",
  "eth_getTransactionReceipt",
  "eth_getTransactionByHash",
  "eth_getBlockByNumber",
  "eth_getBlockByHash",
  "eth_getBlockTransactionCountByNumber",
  "eth_getBlockTransactionCountByHash",
  "eth_estimateGas",
  "eth_gasPrice",
  "eth_feeHistory",
  "eth_maxPriorityFeePerGas",
  "eth_syncing",
]);

type RpcRequest = {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: unknown[] | Record<string, unknown>;
};

type RpcEndpoint = {
  label: "primary" | "fallback";
  url: string;
  apiKey?: string;
};

type ProxyOptions = {
  primaryUrl?: string;
  fallbackUrl?: string;
  fallbackApiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  now?: () => number;
};

function asJson(status: number, id: RpcRequest["id"] | null, code: number, message: string): Response {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { status });
}

function parseHttpsEndpoint(label: string, value: string): URL {
  let url: URL;
  try { url = new URL(value); }
  catch { throw new Error(`${label} RPC URL is invalid.`); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) {
    throw new Error(`${label} RPC URL must be HTTPS and cannot contain embedded credentials or fragments.`);
  }
  return url;
}

function buildEndpoints(options: ProxyOptions): RpcEndpoint[] {
  const primary = parseHttpsEndpoint("primary", options.primaryUrl || process.env.RH_MAINNET_RPC_URL || DEFAULT_PRIMARY_RPC);
  const fallbackValue = options.fallbackUrl || process.env.RH_MAINNET_RPC_FALLBACK_URL || DEFAULT_FALLBACK_RPC;
  const fallback = parseHttpsEndpoint("fallback", fallbackValue);
  const apiKey = options.fallbackApiKey ?? process.env.RH_MAINNET_RPC_FALLBACK_API_KEY ?? process.env.BLOCKVECTRA_API_KEY;
  const isBlockvectra = fallback.hostname.toLowerCase() === "api.blockvectra.com" &&
    (fallback.pathname === "/v1/robinhood_mainnet" || fallback.pathname.startsWith("/v1/robinhood_mainnet/"));
  if (apiKey?.trim() && isBlockvectra && fallback.pathname.endsWith("/public")) {
    fallback.pathname = fallback.pathname.slice(0, -"/public".length);
  }
  const endpoints: RpcEndpoint[] = [{ label: "primary", url: primary.toString() }];
  if (fallback.toString() !== primary.toString()) {
    endpoints.push({
      label: "fallback",
      url: fallback.toString(),
      ...(apiKey?.trim() && isBlockvectra ? { apiKey: apiKey.trim() } : {}),
    });
  }
  return endpoints;
}

function validateRpcRequest(value: unknown): RpcRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("A single JSON-RPC request is required.");
  const body = value as Record<string, unknown>;
  if (body.jsonrpc !== "2.0" || typeof body.method !== "string" ||
    !(typeof body.id === "string" || typeof body.id === "number" || body.id === null)) {
    throw new Error("Malformed JSON-RPC request.");
  }
  if (!READ_ONLY_METHODS.has(body.method)) throw new Error("This endpoint accepts read-only JSON-RPC methods only.");
  if (body.params !== undefined && (!Array.isArray(body.params) && (!body.params || typeof body.params !== "object"))) {
    throw new Error("JSON-RPC params must be an array or object.");
  }
  const request = body as RpcRequest;
  if (request.method === "eth_getLogs") validateLogRange(request.params);
  return request;
}

function validateLogRange(params: RpcRequest["params"]): void {
  const filter = Array.isArray(params) ? params[0] : undefined;
  if (!filter || typeof filter !== "object" || Array.isArray(filter)) throw new Error("eth_getLogs requires a bounded filter.");
  const record = filter as Record<string, unknown>;
  if (record.blockHash !== undefined) {
    if (record.fromBlock !== undefined || record.toBlock !== undefined || !/^0x[0-9a-f]{64}$/i.test(String(record.blockHash))) {
      throw new Error("eth_getLogs blockHash filters cannot be combined with block ranges.");
    }
    return;
  }
  const from = record.fromBlock;
  const to = record.toBlock;
  if (typeof from !== "string" || typeof to !== "string" || !/^0x[0-9a-f]+$/i.test(from) || !/^0x[0-9a-f]+$/i.test(to)) {
    throw new Error("eth_getLogs requires explicit hexadecimal fromBlock and toBlock values.");
  }
  const first = BigInt(from);
  const last = BigInt(to);
  if (last < first || last - first + 1n > MAX_LOG_RANGE_BLOCKS) {
    throw new Error("eth_getLogs range exceeds the 20,000-block limit.");
  }
}

async function readBoundedBody(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) throw new Error("JSON-RPC body exceeds the request limit.");
  if (!request.body) throw new Error("JSON-RPC body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error("JSON-RPC body exceeds the request limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function isRetryableRpcError(body: Record<string, unknown>): boolean {
  const error = body.error;
  if (!error || typeof error !== "object") return false;
  const rpcError = error as Record<string, unknown>;
  const message = typeof rpcError.message === "string" ? rpcError.message : "";
  return rpcError.code === -32005 || rpcError.code === -32016 ||
    /rate.?limit|too many requests|overload|temporar(?:y|ily)|timed? ?out|try again|upstream unavailable/i.test(message);
}

async function postRpc(endpoint: RpcEndpoint, payload: unknown, fetchImpl: typeof fetch, timeoutMs: number): Promise<Record<string, unknown>> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchImpl(endpoint.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(endpoint.apiKey ? { "x-api-key": endpoint.apiKey } : {}),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
      if (!response.ok) {
        if (attempt === 0 && isRetryableStatus(response.status)) continue;
        throw Object.assign(new Error(`Provider returned HTTP ${response.status}.`), {
          retryable: isRetryableStatus(response.status),
        });
      }
      const body = await response.json() as unknown;
      if (!body || typeof body !== "object" || Array.isArray(body) || !Object.hasOwn(body, "result") && !Object.hasOwn(body, "error")) {
        if (attempt === 0) continue;
        throw new Error("Provider returned a malformed JSON-RPC response.");
      }
      if (isRetryableRpcError(body as Record<string, unknown>)) {
        const rpcError = (body as Record<string, unknown>).error as Record<string, unknown>;
        const retryError = Object.assign(new Error(typeof rpcError.message === "string" ? rpcError.message : "Transient JSON-RPC provider error."), { retryable: true });
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 150));
          continue;
        }
        throw retryError;
      }
      return body as Record<string, unknown>;
    } catch (error) {
      lastError = error;
      if (attempt === 0 && (error as { retryable?: boolean } | null)?.retryable !== false) continue;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Provider request failed.");
}

function redactProviderText(value: unknown, endpoints: RpcEndpoint[]): string {
  let message = String(value ?? "RPC provider error");
  for (const endpoint of endpoints) {
    message = message.replaceAll(endpoint.url, "[RPC provider]");
    if (endpoint.apiKey) message = message.replaceAll(endpoint.apiKey, "[redacted]");
  }
  return message.replace(/https?:\/\/[^\s"'<>]+/gi, "[RPC provider]").slice(0, 300);
}

function redactProviderValue(value: unknown, endpoints: RpcEndpoint[], depth = 0): unknown {
  if (typeof value === "string") return redactProviderText(value, endpoints);
  if (Array.isArray(value)) return value.map((item) => redactProviderValue(item, endpoints, depth + 1));
  if (!value || typeof value !== "object") return value;
  if (depth >= 8) return "[provider data omitted]";
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactProviderValue(item, endpoints, depth + 1)]));
}

export function createMainnetRpcProxyHandler(options: ProxyOptions = {}) {
  const endpoints = buildEndpoints(options);
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = Math.max(500, Math.min(options.timeoutMs ?? 6_000, 10_000));
  const now = options.now ?? Date.now;
  const chainChecks = new Map<string, number>();
  const chainCheckInFlight = new Map<string, Promise<void>>();
  const activeByEndpoint = new Map<string, number>();
  const endpointWaiters = new Map<string, Array<() => void>>();
  const providerCooldowns = new Map<string, number>();
  const requestTimes = new Map<string, number[]>();

  async function postRpcBounded(endpoint: RpcEndpoint, payload: unknown): Promise<Record<string, unknown>> {
    const waiters = endpointWaiters.get(endpoint.url) ?? [];
    if ((activeByEndpoint.get(endpoint.url) ?? 0) >= 2) {
      endpointWaiters.set(endpoint.url, waiters);
      await new Promise<void>((resolve) => waiters.push(resolve));
    }
    activeByEndpoint.set(endpoint.url, (activeByEndpoint.get(endpoint.url) ?? 0) + 1);
    try {
      return await postRpc(endpoint, payload, fetchImpl, timeoutMs);
    } finally {
      activeByEndpoint.set(endpoint.url, Math.max(0, (activeByEndpoint.get(endpoint.url) ?? 1) - 1));
      endpointWaiters.get(endpoint.url)?.shift()?.();
    }
  }

  async function ensureEndpointChain(endpoint: RpcEndpoint): Promise<void> {
    const checkedAt = chainChecks.get(endpoint.url) ?? 0;
    if (now() - checkedAt < CACHE_TTL_MS) return;
    let verification = chainCheckInFlight.get(endpoint.url);
    if (!verification) {
      verification = (async () => {
        const response = await postRpcBounded(endpoint, { jsonrpc: "2.0", id: "gyevo-mainnet-chain-check", method: "eth_chainId", params: [] });
        if (response.error || typeof response.result !== "string" || BigInt(response.result) !== BigInt(CHAIN_ID)) {
          throw new Error("Provider is not Robinhood Mainnet chain 4663.");
        }
        chainChecks.set(endpoint.url, now());
      })();
      chainCheckInFlight.set(endpoint.url, verification);
    }
    try {
      await verification;
    } finally {
      if (chainCheckInFlight.get(endpoint.url) === verification) chainCheckInFlight.delete(endpoint.url);
    }
  }

  async function sendToVerifiedEndpoint(endpoint: RpcEndpoint, request: RpcRequest): Promise<Record<string, unknown>> {
    await ensureEndpointChain(endpoint);
    if (request.method === "eth_chainId") return { jsonrpc: "2.0", id: request.id, result: CHAIN_ID_HEX };
    return postRpcBounded(endpoint, request);
  }

  return async function handleMainnetRpcProxyRequest(request: Request): Promise<Response> {
    if (request.method !== "POST") return asJson(405, null, -32600, "POST is required.");
    const origin = request.headers.get("origin");
    if (origin) {
      try {
        // Next.js and reverse proxies may normalize request.url to an internal
        // hostname. Compare Origin against the inbound host instead.
        const inboundHost = request.headers.get("host") || request.headers.get("x-forwarded-host");
        const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
        const requestUrl = new URL(request.url);
        const protocol = forwardedProtocol || requestUrl.protocol.slice(0, -1);
        if (protocol !== "http" && protocol !== "https") {
          return asJson(403, null, -32600, "Request origin could not be validated.");
        }
        const expectedOrigin = inboundHost ? new URL(`${protocol}://${inboundHost}`).origin : requestUrl.origin;
        if (new URL(origin).origin !== expectedOrigin) return asJson(403, null, -32600, "Cross-origin requests are not accepted.");
      } catch { return asJson(403, null, -32600, "Invalid request origin."); }
    }

    const clientId = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() || "unknown";
    const recent = (requestTimes.get(clientId) ?? []).filter((timestamp) => now() - timestamp < RATE_WINDOW_MS);
    if (recent.length >= RATE_LIMIT_PER_WINDOW) return asJson(429, null, -32005, "Mainnet read request limit reached; try again shortly.");
    recent.push(now());
    requestTimes.set(clientId, recent);
    if (requestTimes.size > 2_000) {
      for (const [key, timestamps] of requestTimes) if (timestamps.every((timestamp) => now() - timestamp >= RATE_WINDOW_MS)) requestTimes.delete(key);
    }

    let rpcRequest: RpcRequest;
    try {
      const contentType = request.headers.get("content-type") || "";
      if (!contentType.toLowerCase().includes("application/json")) throw new Error("Content-Type must be application/json.");
      rpcRequest = validateRpcRequest(await readBoundedBody(request));
    } catch (error) {
      const message = error instanceof SyntaxError ? "Malformed JSON-RPC body." : error instanceof Error ? error.message : "Invalid JSON-RPC request.";
      const status = message.startsWith("This endpoint accepts")
        ? 403
        : message.includes("body exceeds the request limit")
          ? 413
          : 400;
      return asJson(status, null, -32600, message);
    }

    const failures: string[] = [];
    for (const endpoint of endpoints) {
      if ((providerCooldowns.get(endpoint.url) ?? 0) > now()) continue;
      try {
        const response = await sendToVerifiedEndpoint(endpoint, rpcRequest);
        if (response.error && typeof response.error === "object") {
          const error = response.error as Record<string, unknown>;
          return Response.json({
            jsonrpc: "2.0",
            id: rpcRequest.id,
            error: {
              code: typeof error.code === "number" ? error.code : -32000,
              message: redactProviderText(error.message, endpoints),
              ...(error.data !== undefined ? { data: redactProviderValue(error.data, endpoints) } : {}),
            },
          }, { status: 200, headers: { "cache-control": "no-store" } });
        }
        if (response.jsonrpc !== "2.0" || response.id !== rpcRequest.id || !Object.hasOwn(response, "result")) {
          throw new Error("Provider response did not match the requested JSON-RPC id.");
        }
        return Response.json(response, { status: 200, headers: { "cache-control": "no-store" } });
      } catch (error) {
        failures.push(redactProviderText(error instanceof Error ? error.message : "RPC request failed", endpoints));
        providerCooldowns.set(endpoint.url, now() + PROVIDER_FAILURE_COOLDOWN_MS);
      }
    }
    const diagnostic = failures.some((message) => /chain 4663/.test(message))
      ? "No configured provider confirmed Robinhood Mainnet chain 4663."
      : "Robinhood Mainnet read providers are unavailable.";
    return asJson(503, rpcRequest.id, -32002, diagnostic);
  };
}

export { CHAIN_ID as ROBINHOOD_MAINNET_PROXY_CHAIN_ID };
