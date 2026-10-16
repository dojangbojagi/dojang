"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { connectorsForWallets, RainbowKitProvider, darkTheme, type Wallet, type WalletList } from "@rainbow-me/rainbowkit";
import { walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http, WagmiProvider, injected } from "wagmi";
import type { CreateConnectorFn } from "wagmi";
import { supportedProtocolChains } from "@/lib/config/network-registry";
import { appEnv } from "@/lib/config/env";
import { robinhoodMainnetDemoChain } from "@/lib/config/robinhood-mainnet-demo";
import { giwaSepolia } from "@/lib/config/chain";
import { robinhoodTestnet } from "@/lib/config/robinhood-testnet";
import { DemoWitnessProvider } from "@/components/witness-context";
import { hasExplicitEvmWalletProvider, type ExplicitEvmWallet } from "@/lib/wallet/provider-detection";

type InjectedTarget = ExplicitEvmWallet;

/** Use wagmi's provider targeting so a different extension owning window.ethereum cannot hijack this wallet choice. */
function targetInjectedWallet(target: InjectedTarget, rdns: string | string[], iconAccent: string, downloadUrl: string): Wallet {
  const name = target === "metaMask" ? "MetaMask" : "Rabby Wallet";
  const icon = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><rect width="28" height="28" rx="7" fill="#fff"/><rect x="4" y="4" width="20" height="20" rx="6" fill="${iconAccent}"/><path d="M8 10h12v2H8zm0 4h12v2H8zm0 4h8v2H8z" fill="#fff"/></svg>`,
  );
  return {
    id: target,
    name,
    rdns: Array.isArray(rdns) ? rdns[0]! : rdns,
    iconUrl: `data:image/svg+xml,${icon}`,
    iconAccent,
    iconBackground: "#fff",
    downloadUrls: { chrome: downloadUrl, browserExtension: downloadUrl },
    installed: typeof window !== "undefined" && hasExplicitEvmWalletProvider(target, (window as Window & { ethereum?: unknown }).ethereum),
    createConnector: (walletDetails) => {
      const injectedConnector = injected({ shimDisconnect: true, target });
      const connector: CreateConnectorFn = (config) => ({
        ...injectedConnector(config),
        ...walletDetails,
        rdns,
      });
      return connector;
    },
  };
}

const walletConnectId = appEnv.walletConnectProjectId;
const walletGroups: WalletList = [
  {
    groupName: "EVM wallets",
    wallets: [
      () => targetInjectedWallet(
        "metaMask",
        ["io.metamask", "io.metamask.mobile"],
        "#f6851a",
        "https://metamask.io/download/",
      ),
      () => targetInjectedWallet("rabby", "io.rabby", "#8697ff", "https://rabby.io/"),
      ...(walletConnectId ? [walletConnectWallet] : []),
    ],
  },
];

const connectors = connectorsForWallets(walletGroups, {
  appName: appEnv.appName,
  // The ID is only used by the optional WalletConnect wallet above.
  projectId: walletConnectId ?? "",
});

const wagmiConfig = createConfig({
  chains: supportedProtocolChains,
  connectors,
  // Wagmi discovers EIP-6963 wallets and exposes each announced provider as its own connector.
  multiInjectedProviderDiscovery: true,
  transports: {
    [robinhoodTestnet.id]: http(appEnv.robinhoodRpcUrl),
    [giwaSepolia.id]: http(appEnv.giwaRpcUrl),
    [robinhoodMainnetDemoChain.id]: http(appEnv.robinhoodMainnetRpcUrl),
  },
  ssr: true,
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  // Avoid silently restoring a stale, possibly incompatible injected wallet on page reload.
  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>
          <DemoWitnessProvider>{children}</DemoWitnessProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
