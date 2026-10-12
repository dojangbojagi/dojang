"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { GIWA_CHAIN_ID } from "@/lib/config/chain";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/config/robinhood-testnet";
import { supportedProtocolChains } from "@/lib/config/network-registry";
import type { WalletState } from "@/lib/protocol/types";

export type ProtocolChainId = typeof GIWA_CHAIN_ID | typeof ROBINHOOD_TESTNET_CHAIN_ID;

function describeSwitchError(error: unknown, chainId: number): string {
  const parts: string[] = [];
  const codes: number[] = [];
  const visited = new Set<unknown>();
  const pending: unknown[] = [error];
  while (pending.length > 0) {
    const current = pending.shift();
    if (!current || typeof current !== "object" || visited.has(current)) continue;
    visited.add(current);
    const item = current as { code?: unknown; name?: unknown; message?: unknown; shortMessage?: unknown; cause?: unknown; data?: { originalError?: unknown } };
    if (typeof item.code === "number") codes.push(item.code);
    if (typeof item.message === "string") parts.push(item.message);
    if (typeof item.shortMessage === "string") parts.push(item.shortMessage);
    if (typeof item.name === "string") parts.push(item.name);
    pending.push(item.cause, item.data?.originalError);
  }
  const detail = parts.join(" ").toLowerCase();
  if (codes.includes(-32002) || detail.includes("request already pending")) {
    return "Your wallet already has a request waiting. Complete or dismiss it, then retry.";
  }
  if (detail.includes("failed to fetch") || detail.includes("network error") || detail.includes("timed out") || detail.includes("timeout") || detail.includes("http request failed")) {
    return `Could not reach the network RPC while switching to chain ${chainId}. Check your connection or the wallet's network RPC, then retry.`;
  }
  if (codes.includes(4001) || detail.includes("user rejected") || detail.includes("user denied")) {
    return "Network switching was rejected in your wallet. You are still connected to the current network.";
  }
  if (codes.includes(4902) || detail.includes("unknown chain") || detail.includes("chain not added")) {
    return `Your wallet does not have chain ${chainId} configured. Add the Robinhood Testnet network in the wallet and retry.`;
  }
  if (detail.includes("switchchainnotsupported") || detail.includes("switch chain not supported") || detail.includes("does not support switching")) {
    return `This wallet cannot switch networks from the app. Select chain ${chainId} in the wallet, then refresh.`;
  }
  return `Could not switch the wallet to chain ${chainId}. Check the wallet request and retry.`;
}

export function useWalletNetwork(expectedChainId: ProtocolChainId = ROBINHOOD_TESTNET_CHAIN_ID) {
  const account = useAccount();
  const switchChain = useSwitchChain();
  const [switchError, setSwitchError] = useState<string>();
  const state: WalletState = !account.isConnected
    ? account.status === "connecting" || account.status === "reconnecting"
      ? "connecting"
      : "disconnected"
    : account.chainId === expectedChainId
      ? "connected"
      : "wrong-network";

  useEffect(() => {
    if (!account.isConnected || account.chainId === expectedChainId) setSwitchError(undefined);
  }, [account.chainId, account.isConnected, expectedChainId]);

  const switchTo = useCallback(async (chainId: ProtocolChainId): Promise<boolean> => {
    setSwitchError(undefined);
    const target = supportedProtocolChains.find((chain) => chain.id === chainId);
    if (!target) {
      setSwitchError(`Chain ${chainId} is not configured in this application.`);
      return false;
    }
    try {
      await switchChain.switchChainAsync({
        chainId,
        addEthereumChainParameter: {
          chainName: target.name,
          nativeCurrency: target.nativeCurrency,
          rpcUrls: [...target.rpcUrls.default.http],
          blockExplorerUrls: target.blockExplorers?.default?.url
            ? [target.blockExplorers.default.url]
            : undefined,
        },
      });
      const activeChainId = await account.connector?.getChainId();
      if (activeChainId !== undefined && activeChainId !== chainId) {
        throw new Error(`Wallet stayed on chain ${activeChainId} after the switch request.`);
      }
      return true;
    } catch (error) {
      setSwitchError(describeSwitchError(error, chainId));
      return false;
    }
  }, [account.connector, switchChain.switchChainAsync]);

  return {
    ...account,
    state,
    expectedChainId,
    isOnExpectedNetwork: account.isConnected && account.chainId === expectedChainId,
    isGiwaSepolia: account.isConnected && account.chainId === GIWA_CHAIN_ID,
    isRobinhoodTestnet: account.isConnected && account.chainId === ROBINHOOD_TESTNET_CHAIN_ID,
    switchToExpectedNetwork: () => switchTo(expectedChainId),
    switchToGiwaSepolia: () => switchTo(GIWA_CHAIN_ID),
    switchToRobinhoodTestnet: () => switchTo(ROBINHOOD_TESTNET_CHAIN_ID),
    isSwitching: switchChain.isPending,
    switchError,
  };
}
