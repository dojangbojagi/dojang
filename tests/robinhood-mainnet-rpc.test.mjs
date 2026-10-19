import { describe, expect, test } from "bun:test";
import { defineChain } from "viem";
import * as rpcModule from "../scripts/robinhood-mainnet-rpc.mjs";
import {
  MAINNET_RPC_PROBE,
  getMainnetRpcCandidates,
  redactMainnetRpcUrls,
  requestMainnetRpcReadBatch,
  resolveUsableMainnetRpcEndpoints,
} from "../scripts/robinhood-mainnet-rpc.mjs";

const TX = "0x117900470f19628ee4ba64394eae95ab5cd958fe4cfa6924f1b3dc4e33c9ef3a";
const CONTRACT = "0x0329f0c47a7e2d390b0593fe3f3348b4c467158c";
const BLOCK_HASH = `0x${"ab".repeat(32)}`;

function successfulRpcFetch(calls, overrides = {}) {
  return async (url, init) => {
    const request = JSON.parse(init.body);
    calls.push({ url, method: request.method, params: request.params, headers: Object.fromEntries(new Headers(init.headers).entries()) });
    if (overrides[request.method]) return overrides[request.method](request, url);
    const results = {
      eth_chainId: "0x1237",
      eth_blockNumber: "0x120100",
      eth_getCode: "0x6000",
      eth_call: `0x${"00".repeat(32)}`,
      eth_estimateGas: "0x5208",
      eth_getLogs: [],
      eth_getTransactionReceipt: {
        transactionHash: TX, status: "0x1", contractAddress: CONTRACT,
        blockNumber: "0x120000", blockHash: BLOCK_HASH,
      },
      eth_getTransactionByHash: { hash: TX, chainId: "0x1237", to: null, blockHash: BLOCK_HASH },
      eth_getBlockByHash: { number: "0x120000", hash: BLOCK_HASH },
    };
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: request.id, result: results[request.method] }), { status: 200 });
  };
}

describe("Robinhood Mainnet RPC failover preflight", () => {
  test("sends bounded role-log batches with auth only to the configured fallback and matches response IDs", async () => {
    const secret = "never-print-batch-key";
    const [fallback] = getMainnetRpcCandidates({
      primaryUrl: "https://primary.invalid",
      fallbackUrl: "https://api.blockvectra.com/v1/robinhood_mainnet/public",
      fallbackApiKey: secret,
    }).slice(1);
    const requests = [
      { jsonrpc: "2.0", id: "range-1", method: "eth_getLogs", params: [{ fromBlock: "0x1", toBlock: "0x3" }] },
      { jsonrpc: "2.0", id: "range-2", method: "eth_getLogs", params: [{ fromBlock: "0x4", toBlock: "0x6" }] },
    ];
    let captured;
    const responses = await requestMainnetRpcReadBatch(fallback, requests, {
      timeoutMs: 100,
      fetchImpl: async (url, init) => {
        captured = { url, headers: Object.fromEntries(new Headers(init.headers).entries()), body: JSON.parse(init.body) };
        return new Response(JSON.stringify([
          { jsonrpc: "2.0", id: "range-2", result: [] },
          { jsonrpc: "2.0", id: "range-1", result: [] },
        ]));
      },
    });
    expect(responses.map((item) => item.id)).toEqual(["range-1", "range-2"]);
    expect(captured.headers["x-api-key"]).toBe(secret);
    expect(captured.url).not.toContain(secret);
    expect(JSON.stringify(captured.body)).not.toContain(secret);
  });

  test("refuses authenticated batch headers on the official endpoint and rejects writes", async () => {
    const endpoint = { label: "primary", url: "https://rpc.mainnet.chain.robinhood.com", headers: { "x-api-key": "secret" } };
    const sendRaw = [{ jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: ["0x1234"] }];
    await expect(requestMainnetRpcReadBatch(endpoint, sendRaw, { fetchImpl: async () => { throw new Error("must not fetch"); } }))
      .rejects.toThrow("read-only eth_getLogs");
    await expect(requestMainnetRpcReadBatch(endpoint, [{ ...sendRaw[0], method: "eth_getLogs" }], { fetchImpl: async () => { throw new Error("must not fetch"); } }))
      .rejects.toThrow("restricted to the BlockVectra");
  });

  test("retries a read-only batch once after HTTP 429 while retaining fallback-only authentication", async () => {
    const [fallback] = getMainnetRpcCandidates({
      primaryUrl: "https://primary.invalid",
      fallbackUrl: "https://api.blockvectra.com/v1/robinhood_mainnet",
      fallbackApiKey: "batch-retry-secret",
    }).slice(1);
    let calls = 0;
    const results = await requestMainnetRpcReadBatch(fallback, [
      { jsonrpc: "2.0", id: 1, method: "eth_getLogs", params: [{ fromBlock: "0x1", toBlock: "0x2" }] },
    ], {
      retryDelayMs: 0,
      fetchImpl: async (_url, init) => {
        calls += 1;
        expect(new Headers(init.headers).get("x-api-key")).toBe("batch-retry-secret");
        if (calls === 1) return new Response("rate limited", { status: 429 });
        return new Response(JSON.stringify([{ jsonrpc: "2.0", id: 1, result: [] }]));
      },
    });
    expect(calls).toBe(2);
    expect(results[0].result).toEqual([]);
  });

  test("accepts an endpoint only after chain, contract read, simulation, bounded logs, and canonical receipt checks", async () => {
    const calls = [];
    const candidates = getMainnetRpcCandidates({ primaryUrl: "https://primary.invalid", fallbackUrl: "https://fallback.invalid" });
    const usable = await resolveUsableMainnetRpcEndpoints(candidates, { fetchImpl: successfulRpcFetch(calls), timeoutMs: 100, minimumRequestIntervalMs: 0 });

    expect(usable.map(({ label }) => label)).toEqual(["primary", "fallback"]);
    expect(usable[0].capabilities).toEqual({ read: true, simulation: true, logs: true, receipt: true });
    expect(calls.map(({ method }) => method)).toEqual(expect.arrayContaining([
      "eth_chainId", "eth_blockNumber", "eth_getCode", "eth_call", "eth_estimateGas",
      "eth_getLogs", "eth_getTransactionReceipt", "eth_getTransactionByHash", "eth_getBlockByHash",
    ]));
    const logProbe = calls.find(({ method }) => method === "eth_getLogs");
    expect(logProbe.params[0].address).toBe(MAINNET_RPC_PROBE.contractAddress);
    expect(BigInt(logProbe.params[0].toBlock) - BigInt(logProbe.params[0].fromBlock)).toBeLessThanOrEqual(64n);
  });

  test("rejects a wrong-chain RPC before probing its contract capabilities", async () => {
    const calls = [];
    const fetchImpl = successfulRpcFetch(calls, {
      eth_chainId: (request) => new Response(JSON.stringify({ jsonrpc: "2.0", id: request.id, result: "0x16" }), { status: 200 }),
    });
    await expect(resolveUsableMainnetRpcEndpoints([{ label: "primary", url: "https://wrong-chain.invalid" }], { fetchImpl, timeoutMs: 100, minimumRequestIntervalMs: 0 }))
      .rejects.toThrow("chain 4663");
    expect(calls.map(({ method }) => method)).toEqual(["eth_chainId"]);
  });

  test("fails over after bounded primary timeouts and redacts endpoint credentials from diagnostics", async () => {
    const calls = [];
    const primarySecretUrl = "https://primary.invalid/rpc?token=do-not-print";
    const fetchImpl = successfulRpcFetch(calls, {
      eth_chainId: (request, url) => url === primarySecretUrl
        ? Promise.reject(new Error(`request timeout at ${url}`))
        : new Response(JSON.stringify({ jsonrpc: "2.0", id: request.id, result: "0x1237" }), { status: 200 }),
    });
    const usable = await resolveUsableMainnetRpcEndpoints([
      { label: "primary", url: primarySecretUrl },
      { label: "fallback", url: "https://fallback.invalid" },
    ], { fetchImpl, timeoutMs: 100, maxAttempts: 2, retryDelayMs: 0, minimumRequestIntervalMs: 0 });

    expect(usable.map(({ label }) => label)).toEqual(["fallback"]);
    expect(calls.filter(({ url }) => url === primarySecretUrl).length).toBe(2);
    expect(usable[0].url).toBe("https://fallback.invalid");
    const safeError = redactMainnetRpcUrls(`failed at ${primarySecretUrl}`, [
      { label: "primary", url: primarySecretUrl },
    ]);
    expect(safeError).not.toContain("do-not-print");
    expect(safeError).toContain("<primary Mainnet RPC>");
  });

  test("rejects providers missing a required receipt or log capability", async () => {
    for (const method of ["eth_getLogs", "eth_getTransactionReceipt"]) {
      const calls = [];
      const fetchImpl = successfulRpcFetch(calls, {
        [method]: (request) => new Response(JSON.stringify({ jsonrpc: "2.0", id: request.id, error: { code: -32601, message: "method not found" } }), { status: 200 }),
      });
      await expect(resolveUsableMainnetRpcEndpoints([{ label: "primary", url: "https://limited.invalid" }], { fetchImpl, timeoutMs: 100, maxAttempts: 1, minimumRequestIntervalMs: 0 }))
        .rejects.toThrow(/No Robinhood Mainnet RPC/);
    }
  });

  test("reports a limited read/simulation provider without treating it as log-capable", async () => {
    const calls = [];
    const fetchImpl = successfulRpcFetch(calls, {
      eth_getLogs: (request) => new Response(JSON.stringify({ jsonrpc: "2.0", id: request.id, error: { code: -32601, message: "method not found" } }), { status: 200 }),
    });
    const [usable] = await resolveUsableMainnetRpcEndpoints(
      [{ label: "fallback", url: "https://limited.invalid" }],
      { fetchImpl, timeoutMs: 100, maxAttempts: 1, minimumRequestIntervalMs: 0, requiredCapabilities: ["read", "simulation", "receipt"] },
    );
    expect(usable.capabilities).toEqual({ read: true, simulation: true, logs: false, receipt: true });
    await expect(resolveUsableMainnetRpcEndpoints(
      [{ label: "fallback", url: "https://limited.invalid" }],
      { fetchImpl, timeoutMs: 100, maxAttempts: 1, minimumRequestIntervalMs: 0 },
    )).rejects.toThrow(/logs/);
  });

  test("sends a BlockVectra API key only in an auth header and redacts it from diagnostics", () => {
    const secret = "private-provider-token";
    const [fallback] = getMainnetRpcCandidates({
      primaryUrl: "https://primary.invalid",
      fallbackUrl: "https://api.blockvectra.com/v1/robinhood_mainnet/public",
      fallbackApiKey: secret,
    }).slice(1);
    expect(fallback.url).toBe("https://api.blockvectra.com/v1/robinhood_mainnet");
    expect(fallback.headers).toEqual({ "x-api-key": secret });
    expect(redactMainnetRpcUrls(`key ${secret}`, [fallback])).not.toContain(secret);
  });

  test("sends x-api-key on authenticated viem HTTP transport requests", async () => {
    expect(typeof rpcModule.createMainnetHttpTransport).toBe("function");
    const secret = "viem-auth-header-test-secret";
    const calls = [];
    const [fallback] = getMainnetRpcCandidates({
      primaryUrl: "https://primary.invalid",
      fallbackUrl: "https://api.blockvectra.com/v1/robinhood_mainnet/public",
      fallbackApiKey: secret,
    }).slice(1);
    let attempts = 0;
    const fetchFn = async (url, init) => {
      const request = JSON.parse(init.body);
      calls.push({ url, method: request.method, headers: Object.fromEntries(new Headers(init.headers).entries()) });
      attempts += 1;
      if (attempts === 1) {
        return new Response(JSON.stringify({ jsonrpc: "2.0", id: request.id, error: { code: -32005, message: "rate limit exceeded" } }), { status: 200 });
      }
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: request.id, result: "0x1237" }), { status: 200 });
    };
    const transportFactory = rpcModule.createMainnetHttpTransport(fallback, {
      fetchFn, timeoutMs: 100, minimumRequestIntervalMs: 0,
    });
    const chain = defineChain({
      id: 4663, name: "Robinhood Mainnet",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [fallback.url] } },
    });
    const transport = transportFactory({ chain, retryCount: 0, timeout: 100 });
    await transport.request({ method: "eth_chainId", params: [] });
    expect(calls).toHaveLength(2);
    expect(calls.every((call) => call.headers["x-api-key"] === secret)).toBe(true);
    expect(calls.every((call) => !call.url.includes(secret))).toBe(true);
  });

  test("retries one transient socket reset for a read-only RPC request", async () => {
    const calls = [];
    const endpoint = { label: "fallback", url: "https://fallback.invalid" };
    const fetchFn = async (_url, init) => {
      const request = JSON.parse(init.body);
      calls.push(request.method);
      if (calls.length === 1) throw new Error("socket connection was closed unexpectedly");
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: request.id, result: [] }), { status: 200 });
    };
    const chain = defineChain({
      id: 4663, name: "Robinhood Mainnet",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [endpoint.url] } },
    });
    const transport = rpcModule.createMainnetHttpTransport(endpoint, {
      fetchFn, timeoutMs: 100, minimumRequestIntervalMs: 0,
    })({ chain, retryCount: 0, timeout: 100 });

    await expect(transport.request({ method: "eth_getLogs", params: [] })).resolves.toEqual([]);
    expect(calls).toEqual(["eth_getLogs", "eth_getLogs"]);
  });

  test("never retries a broadcast after a transport error leaves its outcome uncertain", async () => {
    let calls = 0;
    const endpoint = { label: "fallback", url: "https://fallback.invalid" };
    const chain = defineChain({
      id: 4663, name: "Robinhood Mainnet",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [endpoint.url] } },
    });
    const transport = rpcModule.createMainnetHttpTransport(endpoint, {
      fetchFn: async () => { calls += 1; throw new Error("socket connection was closed unexpectedly"); },
      timeoutMs: 100, minimumRequestIntervalMs: 0,
    })({ chain, retryCount: 0, timeout: 100 });

    await expect(transport.request({ method: "eth_sendRawTransaction", params: ["0x1234"] }))
      .rejects.toThrow("outcome is uncertain");
    expect(calls).toBe(1);
  });

  test("formats the RPC cause chain with method and code while redacting URL and API key", () => {
    expect(typeof rpcModule.formatMainnetRpcError).toBe("function");
    const secret = "never-print-this-provider-key";
    const wrapped = Object.assign(new Error("An unknown RPC error occurred."), {
      cause: Object.assign(new Error("eth_getLogs failed"), {
        cause: Object.assign(new Error("block range too large: max 1000 blocks"), { code: -32602 }),
      }),
    });
    const diagnostic = rpcModule.formatMainnetRpcError(wrapped, [{
      label: "fallback", url: "https://api.blockvectra.com/v1/robinhood_mainnet?key=should-not-print",
      headers: { "x-api-key": secret },
    }]);
    expect(diagnostic).toContain("eth_getLogs");
    expect(diagnostic).toContain("-32602");
    expect(diagnostic).toContain("max 1000 blocks");
    expect(diagnostic).not.toContain(secret);
    expect(diagnostic).not.toContain("should-not-print");
  });
});
