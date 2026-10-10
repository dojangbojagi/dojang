import { expect, test } from "bun:test";
import { hashKey, QueryClient } from "@tanstack/react-query";
import React from "react";
import { renderToString } from "react-dom/server";
import { createConfig, http, WagmiProvider } from "wagmi";
import { QueryClientProvider } from "@tanstack/react-query";
import { daoGovernanceQueryKey } from "../src/lib/governance/query-key.ts";
import { readGovernanceProposalIds } from "../src/lib/governance/service.ts";
import { useDaoGovernance } from "../src/hooks/use-dao-governance.ts";
import { GIWA_CHAIN_ID, giwaSepolia } from "../src/lib/config/chain.ts";
import { projectContracts } from "../src/lib/config/contracts.ts";

const contractAddress = "0x0000000000000000000000000000000000001234";
const wallet = "0x0000000000000000000000000000000000005678";

test("useDaoGovernance mounts with undefined, valid, zero, and changing proposal IDs", () => {
  const queryClient = new QueryClient();
  const wagmiConfig = createConfig({
    chains: [giwaSepolia],
    connectors: [],
    transports: { [GIWA_CHAIN_ID]: http() },
  });

  function HookProbe({ proposalId }) {
    useDaoGovernance(proposalId);
    return React.createElement("span", null, "mounted");
  }

  for (const proposalId of [undefined, 7n, 0n, 8n]) {
    expect(() => renderToString(
      React.createElement(
        WagmiProvider,
        { config: wagmiConfig },
        React.createElement(
          QueryClientProvider,
          { client: queryClient },
          React.createElement(HookProbe, { proposalId }),
        ),
      ),
    )).not.toThrow();
  }

  const keys = queryClient.getQueryCache().getAll().map((query) => query.queryKey);
  expect(keys.map((key) => key[3])).toEqual([undefined, "7", "0", "8"]);
  expect(new Set(keys.map(hashKey)).size).toBe(4);
  queryClient.clear();
});

test("DAO governance query keys hash, cache, switch IDs, and invalidate by contract prefix", async () => {
  const keys = [
    daoGovernanceQueryKey(contractAddress, wallet, undefined),
    daoGovernanceQueryKey(contractAddress, wallet, 7n),
    daoGovernanceQueryKey(contractAddress, wallet, 0n),
    daoGovernanceQueryKey(contractAddress, wallet, 8n),
  ];

  expect(keys.map((key) => key[3])).toEqual([undefined, "7", "0", "8"]);
  const hashes = keys.map(hashKey);
  expect(new Set(hashes).size).toBe(keys.length);
  expect(() => hashKey(["dao-governance", contractAddress, wallet, 7n])).toThrow(/BigInt/);

  const queryClient = new QueryClient();
  keys.forEach((key) => queryClient.setQueryData(key, { cachedId: key[3] ?? "snapshot" }));
  keys.forEach((key) => expect(queryClient.getQueryData(key)).toBeDefined());

  await queryClient.invalidateQueries({ queryKey: ["dao-governance", contractAddress] });
  const cachedQueries = queryClient.getQueryCache().findAll({
    queryKey: ["dao-governance", contractAddress],
  });
  expect(cachedQueries).toHaveLength(keys.length);
  expect(cachedQueries.every((query) => query.state.isInvalidated)).toBe(true);
  queryClient.clear();
});

test("governance event scans clamp future ends to the current chain head", async () => {
  const requests = [];
  const client = {
    getChainId: async () => 91_342,
    getBlockNumber: async () => 105n,
    getLogs: async (request) => {
      requests.push(request);
      return [];
    },
  };

  const ids = await readGovernanceProposalIds(client, contractAddress, 100n, 200n, 10n);
  expect(ids).toEqual([]);
  expect(requests).toEqual([
    expect.objectContaining({ fromBlock: 100n, toBlock: 105n }),
  ]);

  requests.length = 0;
  expect(await readGovernanceProposalIds(client, contractAddress, 106n, 200n, 10n)).toEqual([]);
  expect(requests).toHaveLength(0);
});

test("project evidence scans cap RPC ranges at the latest block and propagate RPC errors", async () => {
  const previousRegistry = projectContracts.credentialRegistry;
  projectContracts.credentialRegistry = contractAddress;

  try {
    const { readProjectProtocolLogs } = await import("../src/lib/protocol/chain-evidence.ts");
    const requests = [];
    const client = {
      getChainId: async () => GIWA_CHAIN_ID,
      getBlockNumber: async () => 105n,
      getBytecode: async () => "0x6000",
      getLogs: async (request) => {
        requests.push(request);
        return [];
      },
    };

    expect(await readProjectProtocolLogs(client, {
      fromBlock: 100n,
      toBlock: 200n,
      blockChunkSize: 10n,
    })).toEqual([]);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ fromBlock: 100n, toBlock: 105n });

    const failingClient = {
      ...client,
      getLogs: async () => { throw new Error("RPC getLogs failed"); },
    };
    await expect(readProjectProtocolLogs(failingClient, {
      fromBlock: 100n,
      toBlock: 200n,
      blockChunkSize: 10n,
    })).rejects.toThrow("RPC getLogs failed");
  } finally {
    projectContracts.credentialRegistry = previousRegistry;
  }
});
