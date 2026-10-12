"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { GIWA_CHAIN_ID } from "@/lib/config/chain";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/config/robinhood-testnet";
import { supportedProtocolChains } from "@/lib/config/network-registry";
import type { WalletState } from "@/lib/protocol/types";

export type ProtocolChainId = typeof GIWA_CHAIN_ID | typeof ROBINHOOD_TESTNET_CHAIN_ID;

export interface WalletNetworkDiagnostics {
  connectorName?: string;
  accountChainId?: number;
  providerChainId?: number;
  providerReadErrorName?: string;
  errorName?: string;
  errorCode?: number;
  requiredChainId: number;
}

function getErrorMetadata(error: unknown): Pick<WalletNetworkDiagnostics, "errorName" | "errorCode"> {
  const visited = new Set<unknown>();
  const pending: unknown[] = [error];
  let errorName: string | undefined;
  let errorCode: number | undefined;
  while (pending.length > 0) {
    const current = pending.shift();
    if (!current || typeof current !== "object" || visited.has(current)) continue;
    visited.add(current);
    const item = current as { code?: unknown; name?: unknown; cause?: unknown; data?: { originalError?: unknown } };
    if (errorCode === undefined && typeof item.code === "number") errorCode = item.code;
    if (errorName === undefined && typeof item.name === "string") errorName = item.name;
    pending.push(item.cause, item.data?.originalError);
  }
  return { errorName, errorCode };
}

function describeSwitchError(error: unknown, chainId: number, connectorName?: string): string {
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
  if (codes.includes(4900) || detail.includes("disconnected") || detail.includes("not connected") || detail.includes("wallet is locked")) {
    return "The selected wallet is disconnected or locked. Reconnect and unlock it, then retry.";
  }
  if (detail.includes("failed to fetch") || detail.includes("network error") || detail.includes("timed out") || detail.includes("timeout") || detail.includes("http request failed")) {
    return `Could not reach the network RPC while switching to chain ${chainId}. Check your connection or the wallet's network RPC, then retry.`;
  }
  if (codes.includes(4001) || detail.includes("user rejected") || detail.includes("user denied")) {
    return "Network switching was rejected in your wallet. You are still connected to the current network.";
  }
  if (codes.includes(4902) || detail.includes("unknown chain") || detail.includes("chain not added")) {
    return `The selected wallet could not add chain ${chainId}. Add Robinhood Testnet in that wallet, then retry.`;
  }
  if (codes.includes(4901)) {
    return `${connectorName ?? "The selected wallet"} could not connect to chain ${chainId}. Select the chain manually in the wallet or choose another EVM wallet.`;
  }
  if (detail.includes("switchchainnotsupported") || detail.includes("switch chain not supported") || detail.includes("does not support switching") || detail.includes("method not found") || codes.some((code) => code === 4200 || code === -32601)) {
    return `${connectorName ?? "This wallet"} cannot switch networks from the app. Select chain ${chainId} in the wallet, or disconnect and choose another EVM wallet that supports this chain.`;
  }
  const remainedOnChain = detail.match(/wallet stayed on chain (\d+)/);
  if (remainedOnChain) {
    return `${connectorName ?? "The selected wallet"} remained on chain ${remainedOnChain[1]}; this app requires chain ${chainId}. Choose another EVM wallet and confirm it supports this chain.`;
  }
  return `Could not switch ${connectorName ? `${connectorName} ` : "the wallet "}to chain ${chainId}. Check the wallet request and retry.`;
}

export function useWalletNetwork(expectedChainId: ProtocolChainId = ROBINHOOD_TESTNET_CHAIN_ID) {
  const account = useAccount();
  const switchChain = useSwitchChain();
  const [switchError, setSwitchError] = useState<string>();
  const [switchDiagnostics, setSwitchDiagnostics] = useState<WalletNetworkDiagnostics>();
  const state: WalletState = !account.isConnected
    ? account.status === "connecting" || account.status === "reconnecting"
      ? "connecting"
      : "disconnected"
    : account.chainId === expectedChainId
      ? "connected"
      : "wrong-network";

  useEffect(() => {
    if (!account.isConnected || account.chainId === expectedChainId) {
      setSwitchError(undefined);
      setSwitchDiagnostics(undefined);
    }
  }, [account.chainId, account.isConnected, expectedChainId]);

  const refreshNetworkDiagnostics = useCallback(async (): Promise<void> => {
    const connector = account.connector;
    const base = {
      connectorName: connector?.name,
      accountChainId: account.chainId,
      requiredChainId: expectedChainId,
    };
    if (!account.isConnected || !connector) {
      setSwitchDiagnostics(base);
      return;
    }
    try {
      setSwitchDiagnostics({ ...base, providerChainId: await connector.getChainId() });
    } catch (error) {
      const metadata = getErrorMetadata(error);
      setSwitchDiagnostics({ ...base, providerReadErrorName: metadata.errorName });
    }
  }, [account.chainId, account.connector, account.isConnected, expectedChainId]);

  const switchTo = useCallback(async (chainId: ProtocolChainId): Promise<boolean> => {
    setSwitchError(undefined);
    const target = supportedProtocolChains.find((chain) => chain.id === chainId);
    if (!target) {
      setSwitchError(`Chain ${chainId} is not configured in this application.`);
      return false;
    }
    if (!account.isConnected || !account.connector) {
      setSwitchError(`Connect an EVM wallet before switching to ${target.name} (chain ${chainId}).`);
      return false;
    }
    if (switchChain.isPending) {
      setSwitchError("A network switch request is already pending in your wallet. Complete or dismiss it before retrying.");
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
      setSwitchDiagnostics({
        connectorName: account.connector.name,
        accountChainId: account.chainId,
        providerChainId: activeChainId,
        requiredChainId: chainId,
      });
      return true;
    } catch (error) {
      setSwitchError(describeSwitchError(error, chainId, account.connector.name));
      let providerChainId: number | undefined;
      let providerReadErrorName: string | undefined;
      try {
        providerChainId = await account.connector.getChainId();
      } catch (readError) {
        providerReadErrorName = getErrorMetadata(readError).errorName;
      }
      setSwitchDiagnostics({
        connectorName: account.connector.name,
        accountChainId: account.chainId,
        providerChainId,
        providerReadErrorName,
        ...getErrorMetadata(error),
        requiredChainId: chainId,
      });
      return false;
    }
  }, [account.connector, account.isConnected, switchChain.isPending, switchChain.switchChainAsync]);

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
    switchDiagnostics,
    refreshNetworkDiagnostics,
  };
}
