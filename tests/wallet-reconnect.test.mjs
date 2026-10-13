import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createConfig, createConnector, http } from "wagmi";
import { connect, disconnect, hydrate, switchChain } from "@wagmi/core";

const robinhood = {
  id: 46630,
  name: "Robinhood Testnet",
  nativeCurrency: { name: "Test ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.chain.robinhood.com"] } },
};
const sepolia = {
  id: 11155111,
  name: "Ethereum Sepolia",
  nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.sepolia.org"] } },
};
const account = "0x0000000000000000000000000000000000000001";

function walletConnector({ id, name, chainId = sepolia.id, switchHandler, onAuthorized } = {}) {
  let providerChainId = chainId;
  const connector = createConnector((connectorConfig) => ({
    id,
    name,
    type: "injected",
    async connect() { return { accounts: [account], chainId: providerChainId }; },
    async disconnect() {},
    async getAccounts() { return [account]; },
    async getChainId() { return providerChainId; },
    async getProvider() { return {}; },
    async isAuthorized() { onAuthorized?.(); return true; },
    ...(switchHandler
      ? {
          async switchChain({ chainId: targetChainId, addEthereumChainParameter }) {
            return switchHandler({
              targetChainId,
              addEthereumChainParameter,
              setProviderChainId: (nextChainId) => { providerChainId = nextChainId; },
              emitChainChange: (nextChainId) => connectorConfig.emitter.emit("change", { chainId: nextChainId }),
            });
          },
        }
      : {}),
  }));

  return { connector, getProviderChainId: () => providerChainId };
}

function walletConfig(...connectors) {
  return createConfig({
    chains: [robinhood, sepolia],
    connectors: connectors.map((entry) => entry.connector),
    transports: { [robinhood.id]: http(), [sepolia.id]: http() },
    multiInjectedProviderDiscovery: false,
    ssr: true,
  });
}

test("provider keeps EIP-6963 discovery and explicit MetaMask/Rabby choices without auto-reconnecting", async () => {
  const source = await readFile(new URL("../src/components/providers.tsx", import.meta.url), "utf8");
  const control = await readFile(new URL("../src/components/wallet-control.tsx", import.meta.url), "utf8");

  assert.match(source, /multiInjectedProviderDiscovery:\s*true/);
  assert.match(source, /targetInjectedWallet\(\s*"metaMask"/);
  assert.match(source, /targetInjectedWallet\("rabby"/);
  assert.match(source, /<WagmiProvider config=\{wagmiConfig\} reconnectOnMount=\{false\}>/);
  assert.match(control, /showRecoveryAction && state === "wrong-network"/);
  assert.match(control, /disconnect\.disconnectAsync\(\{ connector: wallet\.connector \}\)/);
  assert.match(control, /openConnectModal\(\)/);
});

test("a persisted Phantom connection is cleared without probing or reconnecting it", async () => {
  let authorizationChecks = 0;
  let connectionAttempts = 0;
  const phantom = createConnector(() => ({
    id: "app.phantom",
    name: "Phantom",
    type: "injected",
    async connect() {
      connectionAttempts += 1;
      return { accounts: ["0x0000000000000000000000000000000000000001"], chainId: 11155111 };
    },
    async disconnect() {},
    async getAccounts() { return []; },
    async getChainId() { return 11155111; },
    async getProvider() { return {}; },
    async isAuthorized() {
      authorizationChecks += 1;
      return true;
    },
  }));
  const config = createConfig({
    chains: [robinhood, sepolia],
    connectors: [phantom],
    transports: { [robinhood.id]: http(), [sepolia.id]: http() },
    multiInjectedProviderDiscovery: false,
    ssr: true,
  });
  const connector = config.connectors[0];

  config.setState((state) => ({
    ...state,
    current: connector.uid,
    connections: new Map([[connector.uid, { accounts: [account], chainId: 11155111, connector }]]),
    status: "connected",
  }));

  const { onMount } = hydrate(config, { initialState: config.state, reconnectOnMount: false });
  await onMount();

  assert.equal(config.state.status, "disconnected");
  assert.equal(config.state.connections.size, 0);
  assert.equal(authorizationChecks, 0);
  assert.equal(connectionAttempts, 0);
});

test("a Phantom wallet with an unsupported switch can be disconnected and replaced by an explicit EVM connector", async () => {
  const phantom = walletConnector({ id: "app.phantom", name: "Phantom" });
  const rabby = walletConnector({ id: "rabby", name: "Rabby Wallet" });
  const config = walletConfig(phantom, rabby);
  const phantomInstance = config.connectors.find((connector) => connector.id === "app.phantom");
  const rabbyInstance = config.connectors.find((connector) => connector.id === "rabby");

  await connect(config, { connector: phantomInstance });
  await assert.rejects(switchChain(config, { chainId: robinhood.id }), /switchChain/i);
  await disconnect(config, { connector: phantomInstance });
  await connect(config, { connector: rabbyInstance });

  assert.equal(config.state.current, rabbyInstance.uid);
  assert.equal(config.state.connections.get(rabbyInstance.uid).chainId, sepolia.id);
});

test("a successful mocked MetaMask switch requires the provider and wagmi account to agree on 46630", async () => {
  const metaMask = walletConnector({
    id: "metaMask",
    name: "MetaMask",
    switchHandler: async ({ targetChainId, setProviderChainId, emitChainChange }) => {
      setProviderChainId(targetChainId);
      emitChainChange(targetChainId);
      return robinhood;
    },
  });
  const config = walletConfig(metaMask);
  const connector = config.connectors[0];

  await connect(config, { connector });
  await switchChain(config, {
    chainId: robinhood.id,
    addEthereumChainParameter: { chainName: robinhood.name, rpcUrls: robinhood.rpcUrls.default.http },
  });

  assert.equal(metaMask.getProviderChainId(), robinhood.id);
  assert.equal(config.state.connections.get(connector.uid).chainId, robinhood.id);
});

test("wallet rejection is surfaced and provider/wagmi disagreement remains wrong-network", async () => {
  const metaMask = walletConnector({
    id: "metaMask",
    name: "MetaMask",
    switchHandler: async ({ targetChainId, setProviderChainId }) => {
      setProviderChainId(targetChainId);
      // Deliberately do not emit a chain change: this mocks provider/wagmi desynchronization.
      return robinhood;
    },
  });
  const rabby = walletConnector({
    id: "rabby",
    name: "Rabby Wallet",
    switchHandler: async () => {
      const error = new Error("User rejected the request");
      error.code = 4001;
      throw error;
    },
  });
  const config = walletConfig(metaMask, rabby);
  const [metaMaskInstance, rabbyInstance] = config.connectors;

  await connect(config, { connector: metaMaskInstance });
  await switchChain(config, { chainId: robinhood.id });
  assert.equal(metaMask.getProviderChainId(), robinhood.id);
  assert.equal(config.state.connections.get(metaMaskInstance.uid).chainId, sepolia.id);
  assert.notEqual(config.state.connections.get(metaMaskInstance.uid).chainId, robinhood.id);

  await disconnect(config, { connector: metaMaskInstance });
  await connect(config, { connector: rabbyInstance });
  await assert.rejects(switchChain(config, { chainId: robinhood.id }), (error) => error.code === 4001);
  assert.equal(config.state.connections.get(rabbyInstance.uid).chainId, sepolia.id);
});
