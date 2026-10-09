"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { createConfig, http, WagmiProvider, injected } from "wagmi";
import { walletConnect } from "wagmi/connectors";
import { giwaSepolia } from "@/lib/config/chain";
import { appEnv } from "@/lib/config/env";
import { DemoWitnessProvider } from "@/components/witness-context";

const connectors = [
  injected({ shimDisconnect: true }),
  ...(appEnv.walletConnectProjectId
    ? [walletConnect({ projectId: appEnv.walletConnectProjectId, showQrModal: false })]
    : []),
];

const wagmiConfig = createConfig({
  chains: [giwaSepolia],
  connectors,
  transports: { [giwaSepolia.id]: http(appEnv.giwaRpcUrl) },
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
