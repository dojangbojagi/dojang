"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useConfig, useSwitchChain } from "wagmi";
import { getAccount, watchAccount } from "wagmi/actions";
import { GIWA_CHAIN_ID } from "@/lib/config/chain";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/config/robinhood-testnet";
import { ROBINHOOD_MAINNET_CHAIN_ID } from "@/lib/config/robinhood-mainnet-demo";
import { supportedProtocolChains } from "@/lib/config/network-registry";
import { isWalletChainVerified } from "@/lib/wallet/provider-detection";
import type { WalletState } from "@/lib/protocol/types";

export type ProtocolChainId = typeof GIWA_CHAIN_ID | typeof ROBINHOOD_TESTNET_CHAIN_ID | typeof ROBINHOOD_MAINNET_CHAIN_ID;

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

function waitForWagmiChain(config: ReturnType<typeof useConfig>, connectorUid: string, chainId: number) {
  const readAccount = () => {
    const current = getAccount(config);
    return { isConnected: current.isConnected, chainId: current.chainId, connectorUid: current.connector?.uid };
  };
  const initial = readAccount();
  if (initial.isConnected && initial.connectorUid === connectorUid && initial.chainId === chainId) {
    return Promise.resolve(initial);
  }

  return new Promise<typeof initial>((resolve) => {
    let stopWatching: (() => void) | undefined;
    let settled = false;
    const finish = (value = readAccount()) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      stopWatching?.();
      resolve(value);
    };
    const timeout = setTimeout(() => finish(), 8_000);
    stopWatching = watchAccount(config, {
      onChange(current) {
        if (current.isConnected && current.connector?.uid === connectorUid && current.chainId === chainId) {
          finish({ isConnected: current.isConnected, chainId: current.chainId, connectorUid: current.connector.uid });
        }
      },
    });
    if (settled) stopWatching();
  });
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
  const unsupportedChain = codes.includes(4902) || codes.includes(4901) || codes.includes(4200) || codes.includes(-32601)
    || detail.includes("unknown chain") || detail.includes("chain not added") || detail.includes("not supported")
    || detail.includes("switch chain not supported") || detail.includes("method not found");
  if (connectorName?.toLowerCase().includes("phantom") && unsupportedChain) {
    const target = supportedProtocolChains.find((chain) => chain.id === chainId);
    return `${connectorName} reported that ${target?.name ?? `chain ${chainId}`} is unsupported. Choose a compatible EVM wallet such as MetaMask or Rabby from the wallet selector, then retry.`;
  }
  if (codes.includes(4902) || detail.includes("unknown chain") || detail.includes("chain not added")) {
    const target = supportedProtocolChains.find((chain) => chain.id === chainId);
    return `The selected wallet could not add ${target?.name ?? `chain ${chainId}`}. Add that network in the wallet, then retry.`;
  }
  if (codes.includes(4901)) {
    return `${connectorName ?? "The selected wallet"} could not connect to chain ${chainId}. Select the chain manually in the wallet or choose another EVM wallet.`;
  }
  if (detail.includes("switchchainnotsupported") || detail.includes("switch chain not supported") || detail.includes("does not support switching") || detail.includes("method not found") || codes.some((code) => code === 4200 || code === -32601)) {
    return `${connectorName ?? "This wallet"} cannot switch networks from the app. Select chain ${chainId} in the wallet, or disconnect and choose another EVM wallet that supports this chain.`;
  }
  if (detail.includes("selected wallet connector changed")) {
    return "The connected wallet changed during the request. Reconnect the intended wallet and retry.";
  }
  const accountDesync = detail.match(/wagmi account remained on chain ([\d\w]+) while provider reports chain ([\d\w]+)/);
  if (accountDesync) {
    return `${connectorName ?? "The selected wallet"} reports chain ${accountDesync[2]}, but the app account still reports chain ${accountDesync[1]}. Reconnect this wallet or choose another provider; app actions remain disabled until both agree.`;
  }
  const remainedOnChain = detail.match(/wallet stayed on chain (\d+)/);
  if (remainedOnChain) {
    return `${connectorName ?? "The selected wallet"} remained on chain ${remainedOnChain[1]}; this app requires chain ${chainId}. Choose another EVM wallet and confirm it supports this chain.`;
  }
  return `Could not switch ${connectorName ? `${connectorName} ` : "the wallet "}to chain ${chainId}. Check the wallet request and retry.`;
}

export function useWalletNetwork(expectedChainId: ProtocolChainId = ROBINHOOD_TESTNET_CHAIN_ID) {
  const account = useAccount();
  const config = useConfig();
  const switchChain = useSwitchChain();
  const [switchError, setSwitchError] = useState<string>();
  const [switchDiagnostics, setSwitchDiagnostics] = useState<WalletNetworkDiagnostics>();
  const [providerChainRead, setProviderChainRead] = useState<{
    connectorUid?: string;
    chainId?: number;
    pending: boolean;
    errorName?: string;
  }>({ pending: false });

  useEffect(() => {
    const connector = account.connector;
    if (!account.isConnected || !connector) {
      setProviderChainRead({ pending: false });
      return;
    }

    let current = true;
    setProviderChainRead({ connectorUid: connector.uid, pending: true });
    void connector.getChainId().then((chainId) => {
      if (current) setProviderChainRead({ connectorUid: connector.uid, chainId, pending: false });
    }).catch((error: unknown) => {
      if (current) setProviderChainRead({
        connectorUid: connector.uid,
        pending: false,
        errorName: getErrorMetadata(error).errorName ?? "ProviderReadError",
      });
    });
    return () => { current = false; };
  }, [account.chainId, account.connector, account.isConnected]);

  const providerReadMatchesConnector = providerChainRead.connectorUid === account.connector?.uid;
  const providerChainId = providerReadMatchesConnector ? providerChainRead.chainId : undefined;
  const providerChainPending = account.isConnected && (!providerReadMatchesConnector || providerChainRead.pending);
  const state: WalletState = !account.isConnected
    ? account.status === "connecting" || account.status === "reconnecting"
      ? "connecting"
      : "disconnected"
    : providerChainPending
      ? "connecting"
      : isWalletChainVerified({ connected: account.isConnected, accountChainId: account.chainId, providerChainId, expectedChainId })
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
      const providerChainId = await connector.getChainId();
      setProviderChainRead({ connectorUid: connector.uid, chainId: providerChainId, pending: false });
      setSwitchDiagnostics({ ...base, providerChainId });
    } catch (error) {
      const metadata = getErrorMetadata(error);
      setProviderChainRead({ connectorUid: connector.uid, pending: false, errorName: metadata.errorName ?? "ProviderReadError" });
      setSwitchDiagnostics({ ...base, providerReadErrorName: metadata.errorName });
    }
  }, [account.chainId, account.connector, account.isConnected, expectedChainId]);

  const switchTo = useCallback(async (chainId: ProtocolChainId): Promise<boolean> => {
    setSwitchError(undefined);
    const target = supportedProtocolChains.find((chain) => chain.id === chainId);
    const connector = account.connector;
    if (!target) {
      setSwitchError(`Chain ${chainId} is not configured in this application.`);
      return false;
    }
    if (!account.isConnected || !connector) {
      setSwitchError(`Connect an EVM wallet before switching to ${target.name} (chain ${chainId}).`);
      return false;
    }
    const selectedAccount = getAccount(config);
    if (!selectedAccount.isConnected || selectedAccount.connector?.uid !== connector.uid) {
      setSwitchError("The selected wallet changed before the network request began. Reconnect and retry.");
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
      const activeAccount = getAccount(config);
      if (!activeAccount.isConnected || activeAccount.connector?.uid !== connector.uid) {
        throw new Error("Selected wallet connector changed during switch.");
      }
      const activeChainId = await connector.getChainId();
      if (activeChainId !== chainId) {
        throw new Error(`Wallet stayed on chain ${activeChainId} after the switch request.`);
      }
      const accountReadback = await waitForWagmiChain(config, connector.uid, chainId);
      if (!accountReadback.isConnected || accountReadback.connectorUid !== connector.uid || accountReadback.chainId !== chainId) {
        throw new Error(`Wagmi account remained on chain ${accountReadback.chainId ?? "unknown"} while provider reports chain ${activeChainId ?? "unknown"}.`);
      }
      setSwitchDiagnostics({
        connectorName: connector.name,
        accountChainId: accountReadback.chainId,
        providerChainId: activeChainId,
        requiredChainId: chainId,
      });
      setProviderChainRead({ connectorUid: connector.uid, chainId: activeChainId, pending: false });
      return true;
    } catch (error) {
      setSwitchError(describeSwitchError(error, chainId, connector.name));
      let providerChainId: number | undefined;
      let providerReadErrorName: string | undefined;
      try {
        providerChainId = await connector.getChainId();
        setProviderChainRead({ connectorUid: connector.uid, chainId: providerChainId, pending: false });
      } catch (readError) {
        providerReadErrorName = getErrorMetadata(readError).errorName;
        setProviderChainRead({ connectorUid: connector.uid, pending: false, errorName: providerReadErrorName ?? "ProviderReadError" });
      }
      const activeWagmiAccount = getAccount(config);
      const diagnostics = {
        connectorName: connector.name,
        accountChainId: activeWagmiAccount.chainId,
        providerChainId,
        providerReadErrorName,
        ...getErrorMetadata(error),
        requiredChainId: chainId,
      } satisfies WalletNetworkDiagnostics;
      setSwitchDiagnostics(diagnostics);
      if (process.env.NODE_ENV === "production") {
        // Safe diagnostic fields only: never log the account address, raw error, or witness data.
        console.warn("[GYEVO wallet switch diagnostics]", {
          connectorName: diagnostics.connectorName,
          wagmiChainId: diagnostics.accountChainId,
          providerChainId: diagnostics.providerChainId,
          requiredChainId: diagnostics.requiredChainId,
          errorName: diagnostics.errorName,
          errorCode: diagnostics.errorCode,
          providerReadErrorName: diagnostics.providerReadErrorName,
        });
      }
      return false;
    }
  }, [account.connector, account.isConnected, config, switchChain.isPending, switchChain.switchChainAsync]);

  return {
    ...account,
    state,
    expectedChainId,
    providerChainId,
    providerChainPending,
    providerChainReadError: providerReadMatchesConnector ? providerChainRead.errorName : undefined,
    isOnExpectedNetwork: !providerChainPending && isWalletChainVerified({
      connected: account.isConnected,
      accountChainId: account.chainId,
      providerChainId,
      expectedChainId,
    }),
    isGiwaSepolia: account.isConnected && account.chainId === GIWA_CHAIN_ID,
    isRobinhoodTestnet: account.isConnected && account.chainId === ROBINHOOD_TESTNET_CHAIN_ID,
    isRobinhoodMainnet: account.isConnected && account.chainId === ROBINHOOD_MAINNET_CHAIN_ID,
    switchToExpectedNetwork: () => switchTo(expectedChainId),
    switchToGiwaSepolia: () => switchTo(GIWA_CHAIN_ID),
    switchToRobinhoodTestnet: () => switchTo(ROBINHOOD_TESTNET_CHAIN_ID),
    switchToRobinhoodMainnet: () => switchTo(ROBINHOOD_MAINNET_CHAIN_ID),
    isSwitching: switchChain.isPending,
    switchError,
    switchDiagnostics,
    refreshNetworkDiagnostics,
  };
}
