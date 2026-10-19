import { expect, test } from "bun:test";

const proxyModule = await import("../src/lib/server/robinhood-mainnet-rpc-proxy.ts").catch(() => ({}));

test("Mainnet RPC proxy module exposes a handler factory", () => {
  expect(typeof proxyModule.createMainnetRpcProxyHandler).toBe("function");
});

test("Mainnet RPC proxy retries the official read and authenticates only the BlockVectra fallback", async () => {
  const seen = [];
  const secret = "unit-test-api-key-never-log";
  const handler = proxyModule.createMainnetRpcProxyHandler({
    primaryUrl: "https://rpc.mainnet.chain.robinhood.com",
    fallbackUrl: "https://api.blockvectra.com/v1/robinhood_mainnet/public",
    fallbackApiKey: secret,
    timeoutMs: 50,
    fetchImpl: async (url, init) => {
      const body = JSON.parse(init.body);
      seen.push({ host: new URL(url).hostname, headers: new Headers(init.headers), body });
      if (new URL(url).hostname === "rpc.mainnet.chain.robinhood.com") throw new TypeError("simulated transient timeout");
      const result = body.method === "eth_chainId" ? "0x1237" : "0xabc123";
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }), { status: 200 });
    },
  });
  const response = await handler(new Request("https://gyevo.example/api/robinhood-mainnet-rpc", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://gyevo.example" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 9, method: "eth_call", params: [{ to: "0x1111111111111111111111111111111111111111", data: "0x12345678" }, "latest"] }),
  }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ jsonrpc: "2.0", id: 9, result: "0xabc123" });
  expect(seen.some((item) => item.host === "rpc.mainnet.chain.robinhood.com" && item.headers.has("x-api-key"))).toBe(false);
  expect(seen.filter((item) => item.host === "api.blockvectra.com").every((item) => item.headers.get("x-api-key") === secret)).toBe(true);
  expect(JSON.stringify(seen.map(({ host, body }) => ({ host, body })))).not.toContain(secret);
});

test("Mainnet RPC proxy rejects transaction submission methods before contacting an endpoint", async () => {
  let calls = 0;
  const handler = proxyModule.createMainnetRpcProxyHandler({
    primaryUrl: "https://rpc.mainnet.chain.robinhood.com",
    fetchImpl: async () => { calls += 1; throw new Error("must not be called"); },
  });
  const response = await handler(new Request("https://gyevo.example/api/robinhood-mainnet-rpc", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: ["0x01"] }),
  }));
  expect(response.status).toBe(403);
  expect(calls).toBe(0);
});

test("Mainnet RPC proxy compares Origin with the inbound host behind a normalized reverse proxy URL", async () => {
  const handler = proxyModule.createMainnetRpcProxyHandler({
    primaryUrl: "https://rpc.mainnet.chain.robinhood.com",
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: "0x1237" }));
    },
  });
  const response = await handler(new Request("http://next-internal/api/robinhood-mainnet-rpc", {
    method: "POST",
    headers: {
      origin: "https://gyevo.example",
      host: "gyevo.example",
      "x-forwarded-proto": "https",
      "content-type": "application/json",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 6, method: "eth_chainId", params: [] }),
  }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ jsonrpc: "2.0", id: 6, result: "0x1237" });
});

test("Mainnet RPC proxy redacts provider credentials from nested RPC error data", async () => {
  const secret = "nested-error-api-key";
  const handler = proxyModule.createMainnetRpcProxyHandler({
    primaryUrl: "https://rpc.mainnet.chain.robinhood.com",
    fallbackUrl: "https://api.blockvectra.com/v1/robinhood_mainnet/public",
    fallbackApiKey: secret,
    fetchImpl: async (url, init) => {
      if (new URL(url).hostname === "rpc.mainnet.chain.robinhood.com") throw new TypeError("offline");
      const body = JSON.parse(init.body);
      if (body.method === "eth_chainId") return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: "0x1237" }));
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, error: { code: -32000, message: "revert", data: { detail: `credential=${secret}` } } }));
    },
  });
  const response = await handler(new Request("https://gyevo.example/api/robinhood-mainnet-rpc", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 4, method: "eth_call", params: [{ to: "0x1111111111111111111111111111111111111111", data: "0x12345678" }, "latest"] }),
  }));
  expect(response.status).toBe(200);
  expect(await response.text()).not.toContain(secret);
});

test("Mainnet RPC proxy does not retry permanent provider authorization failures", async () => {
  const calls = new Map();
  const handler = proxyModule.createMainnetRpcProxyHandler({
    primaryUrl: "https://rpc.mainnet.chain.robinhood.com",
    fallbackUrl: "https://api.blockvectra.com/v1/robinhood_mainnet/public",
    fallbackApiKey: "fallback-key",
    fetchImpl: async (url, init) => {
      const host = new URL(url).hostname;
      calls.set(host, (calls.get(host) ?? 0) + 1);
      if (host === "rpc.mainnet.chain.robinhood.com") return new Response("unauthorized", { status: 401 });
      const body = JSON.parse(init.body);
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: body.method === "eth_chainId" ? "0x1237" : "0xabc" }));
    },
  });
  const response = await handler(new Request("https://gyevo.example/api/robinhood-mainnet-rpc", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 5, method: "eth_call", params: [{ to: "0x1111111111111111111111111111111111111111", data: "0x12345678" }, "latest"] }),
  }));
  expect(response.status).toBe(200);
  expect(calls.get("rpc.mainnet.chain.robinhood.com")).toBe(2);
  expect(calls.get("api.blockvectra.com")).toBe(2);
});

test("Mainnet RPC proxy retries transient JSON-RPC overload errors without suppressing permanent errors", async () => {
  const callCounts = new Map();
  const handler = proxyModule.createMainnetRpcProxyHandler({
    primaryUrl: "https://rpc.mainnet.chain.robinhood.com",
    fallbackUrl: "https://api.blockvectra.com/v1/robinhood_mainnet/public",
    fallbackApiKey: "fallback-key",
    fetchImpl: async (url, init) => {
      const host = new URL(url).hostname;
      const body = JSON.parse(init.body);
      if (host === "rpc.mainnet.chain.robinhood.com") return new Response("temporary upstream failure", { status: 503 });
      if (body.method === "eth_chainId") return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: "0x1237" }));
      const count = (callCounts.get(body.method) ?? 0) + 1;
      callCounts.set(body.method, count);
      if (count === 1) return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, error: { code: -32000, message: "gateway overloaded, retry later" } }));
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: "0x1234" }));
    },
  });
  const response = await handler(new Request("https://gyevo.example/api/robinhood-mainnet-rpc", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 7, method: "eth_call", params: [{ to: "0x1111111111111111111111111111111111111111", data: "0x12345678" }, "latest"] }),
  }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ jsonrpc: "2.0", id: 7, result: "0x1234" });
  expect(callCounts.get("eth_call")).toBe(2);
});

test("Mainnet RPC proxy deduplicates chain checks and caps concurrent requests per provider", async () => {
  let active = 0;
  let peak = 0;
  let primaryCalls = 0;
  const handler = proxyModule.createMainnetRpcProxyHandler({
    primaryUrl: "https://rpc.mainnet.chain.robinhood.com",
    fallbackUrl: "https://api.blockvectra.com/v1/robinhood_mainnet/public",
    fallbackApiKey: "fallback-key",
    fetchImpl: async (url, init) => {
      if (new URL(url).hostname === "rpc.mainnet.chain.robinhood.com") {
        primaryCalls += 1;
        return new Response("offline", { status: 503 });
      }
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      const body = JSON.parse(init.body);
      active -= 1;
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: body.method === "eth_chainId" ? "0x1237" : "0x1" }));
    },
  });
  const requests = await Promise.all(Array.from({ length: 5 }, (_, index) => handler(new Request("https://gyevo.example/api/robinhood-mainnet-rpc", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: index, method: "eth_blockNumber", params: [] }),
  }))));
  expect(requests.every((response) => response.status === 200)).toBe(true);
  expect(peak).toBeLessThanOrEqual(2);
  expect(primaryCalls).toBe(2);
});

test("Mainnet RPC proxy bounds historical log ranges and rejects a wrong-chain provider", async () => {
  let calls = 0;
  const handler = proxyModule.createMainnetRpcProxyHandler({
    primaryUrl: "https://rpc.mainnet.chain.robinhood.com",
    fallbackUrl: "https://api.blockvectra.com/v1/robinhood_mainnet/public",
    fallbackApiKey: "unit-test-key",
    fetchImpl: async (_url, init) => {
      calls += 1;
      const body = JSON.parse(init.body);
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: "0x1636a" }), { status: 200 });
    },
  });
  const tooWide = await handler(new Request("https://gyevo.example/api/robinhood-mainnet-rpc", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "eth_getLogs", params: [{ fromBlock: "0x0", toBlock: "0x4e20" }] }),
  }));
  expect(tooWide.status).toBe(400);
  expect(calls).toBe(0);

  const wrongChain = await handler(new Request("https://gyevo.example/api/robinhood-mainnet-rpc", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "eth_call", params: [{ to: "0x1111111111111111111111111111111111111111", data: "0x12345678" }, "latest"] }),
  }));
  expect(wrongChain.status).toBe(503);
  expect(calls).toBeGreaterThan(0);
  expect(await wrongChain.text()).not.toContain("api.blockvectra.com");
});
