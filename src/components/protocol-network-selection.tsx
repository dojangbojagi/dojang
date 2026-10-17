"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ROBINHOOD_MAINNET_CHAIN_ID } from "@/lib/config/robinhood-mainnet-demo";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/config/robinhood-testnet";

export type RobinhoodAppChainId = typeof ROBINHOOD_MAINNET_CHAIN_ID | typeof ROBINHOOD_TESTNET_CHAIN_ID;

interface NetworkSelection {
  selectedChainId: RobinhoodAppChainId;
  selectChain: (chainId: RobinhoodAppChainId) => void;
}

const STORAGE_KEY = "gyevo:robinhood-network";
const DEFAULT_CHAIN_ID: RobinhoodAppChainId = process.env.NODE_ENV === "production"
  ? ROBINHOOD_MAINNET_CHAIN_ID
  : ROBINHOOD_TESTNET_CHAIN_ID;
const NetworkSelectionContext = createContext<NetworkSelection | undefined>(undefined);

export function ProtocolNetworkSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedChainId, setSelectedChainId] = useState<RobinhoodAppChainId>(DEFAULT_CHAIN_ID);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === String(ROBINHOOD_MAINNET_CHAIN_ID)) setSelectedChainId(ROBINHOOD_MAINNET_CHAIN_ID);
    if (stored === String(ROBINHOOD_TESTNET_CHAIN_ID)) setSelectedChainId(ROBINHOOD_TESTNET_CHAIN_ID);
  }, []);

  const selectChain = useCallback((chainId: RobinhoodAppChainId) => {
    setSelectedChainId(chainId);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(chainId));
    } catch {
      // Selection still works for this page session when browser storage is unavailable.
    }
  }, []);

  const value = useMemo(() => ({ selectedChainId, selectChain }), [selectedChainId, selectChain]);
  return <NetworkSelectionContext.Provider value={value}>{children}</NetworkSelectionContext.Provider>;
}

export function useProtocolNetworkSelection(): NetworkSelection {
  const value = useContext(NetworkSelectionContext);
  if (!value) throw new Error("useProtocolNetworkSelection must be used inside ProtocolNetworkSelectionProvider.");
  return value;
}
