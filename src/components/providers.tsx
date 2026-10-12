"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { createConfig, http, WagmiProvider, injected } from "wagmi";
import { walletConnect } from "wagmi/connectors";
import { supportedProtocolChains } from "@/lib/config/network-registry";
import { appEnv } from "@/lib/config/env";
import { DemoWitnessProvider } from "@/components/witness-context";

const connectors = [
  injected({ shimDisconnect: true }),
  ...(appEnv.walletConnectProjectId
    ? [walletConnect({ projectId: appEnv.walletConnectProjectId, showQrModal: false })]
    : []),
];

const wagmiConfig = createConfig({
  chains: supportedProtocolChains,
  connectors,
  transports: {
    [supportedProtocolChains[0].id]: http(appEnv.robinhoodRpcUrl),
    [supportedProtocolChains[1].id]: http(appEnv.giwaRpcUrl),
  },
  ssr: true,
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>
          <DemoWitnessProvider>{children}</DemoWitnessProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
