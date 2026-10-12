"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { GIWA_CHAIN_ID } from "@/lib/config/chain";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/config/robinhood-testnet";
import type { WalletState } from "@/lib/protocol/types";

export type ProtocolChainId = typeof GIWA_CHAIN_ID | typeof ROBINHOOD_TESTNET_CHAIN_ID;

export function useWalletNetwork(expectedChainId: ProtocolChainId = GIWA_CHAIN_ID) {
  const account = useAccount();
  const switchChain = useSwitchChain();
  const state: WalletState = !account.isConnected
    ? account.status === "connecting" || account.status === "reconnecting"
      ? "connecting"
      : "disconnected"
    : account.chainId === expectedChainId
      ? "connected"
      : "wrong-network";

  return {
    ...account,
    state,
    expectedChainId,
    isOnExpectedNetwork: account.isConnected && account.chainId === expectedChainId,
    isGiwaSepolia: account.isConnected && account.chainId === GIWA_CHAIN_ID,
    isRobinhoodTestnet: account.isConnected && account.chainId === ROBINHOOD_TESTNET_CHAIN_ID,
    switchToExpectedNetwork: () => switchChain.switchChainAsync({ chainId: expectedChainId }),
    switchToGiwaSepolia: () => switchChain.switchChainAsync({ chainId: GIWA_CHAIN_ID }),
    switchToRobinhoodTestnet: () => switchChain.switchChainAsync({ chainId: ROBINHOOD_TESTNET_CHAIN_ID }),
    isSwitching: switchChain.isPending,
  };
}
