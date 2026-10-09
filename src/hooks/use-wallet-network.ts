"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { GIWA_CHAIN_ID } from "@/lib/config/chain";
import type { WalletState } from "@/lib/protocol/types";

export function useWalletNetwork() {
  const account = useAccount();
  const switchChain = useSwitchChain();
  const state: WalletState = !account.isConnected
    ? account.status === "connecting" || account.status === "reconnecting"
      ? "connecting"
      : "disconnected"
    : account.chainId === GIWA_CHAIN_ID
      ? "connected"
      : "wrong-network";

  return {
    ...account,
    state,
    isGiwaSepolia: account.isConnected && account.chainId === GIWA_CHAIN_ID,
    switchToGiwaSepolia: () => switchChain.switchChainAsync({ chainId: GIWA_CHAIN_ID }),
    isSwitching: switchChain.isPending,
  };
}
