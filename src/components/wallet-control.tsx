"use client";

import { useEffect, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useDisconnect } from "wagmi";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import type { ProtocolChainId } from "@/hooks/use-wallet-network";
import { supportedProtocolChains } from "@/lib/config/network-registry";

export function WalletControl({ expectedChainId, showRecoveryAction = false }: { expectedChainId?: ProtocolChainId; showRecoveryAction?: boolean }) {
  const wallet = useWalletNetwork(expectedChainId);
  const disconnect = useDisconnect();
  const [selectionError, setSelectionError] = useState<string>();
  const requiredChain = supportedProtocolChains.find((chain) => chain.id === wallet.expectedChainId);
  const activeChain = supportedProtocolChains.find((chain) => chain.id === wallet.chainId);
  const networkDescription = wallet.state === "wrong-network"
    ? `Connected to ${activeChain?.name ?? "unsupported network"}${wallet.chainId === undefined ? "" : ` (chain ${wallet.chainId})`}; required ${requiredChain?.name ?? "configured network"} (chain ${wallet.expectedChainId}).`
    : undefined;

  useEffect(() => {
    setSelectionError(undefined);
  }, [wallet.address, wallet.connector?.uid]);

  return (
    <ConnectButton.Custom>
      {({ account, openAccountModal, openConnectModal, mounted }) => {
        const state = !mounted || wallet.state === "connecting"
          ? "connecting"
          : !wallet.isConnected
            ? "disconnected"
            : wallet.state === "wrong-network"
              ? "wrong-network"
              : "connected";
        const label = state === "connecting" ? "Connecting…"
          : state === "disconnected" ? "Connect Wallet"
            : state === "wrong-network" ? wallet.isSwitching ? "Switching…" : wallet.switchError ? "Switch failed" : "Wrong Network"
              : account?.displayName ?? "Connected";
        const accessibleLabel = networkDescription ? `${label}. ${networkDescription}` : label;
        const openWallet = () => {
          if (state === "disconnected" || state === "connecting") openConnectModal();
          else if (state === "wrong-network") void wallet.switchToExpectedNetwork();
          else openAccountModal();
        };
        const chooseAnotherWallet = async () => {
          if (!wallet.connector) return;
          setSelectionError(undefined);
          try {
            await disconnect.disconnectAsync({ connector: wallet.connector });
            openConnectModal();
          } catch {
            setSelectionError("Could not disconnect the selected wallet. Disconnect it in the wallet app, then choose Connect Wallet to select another provider.");
          }
        };

        return (
          <>
            <button
              className="btn btn--secondary btn--sm btn--wallet"
              type="button"
              data-wallet={state}
              onClick={openWallet}
              disabled={!mounted || (state === "wrong-network" && wallet.isSwitching)}
              aria-label={accessibleLabel}
              title={`${wallet.connector?.name ? `Wallet: ${wallet.connector.name}. ` : ""}${wallet.switchError ?? networkDescription ?? label}`}
            >
              <span className="btn__dot" aria-hidden="true" />
              <span className="wl-full">{label}</span>
              <span className="wl-short" aria-hidden="true">{state === "connected" ? account?.displayName : state === "wrong-network" ? wallet.isSwitching ? "Switching" : wallet.switchError ? "Retry" : "Switch" : "Connect"}</span>
              {wallet.switchError && <span className="visually-hidden" role="alert">{wallet.switchError}</span>}
            </button>
            {showRecoveryAction && state === "wrong-network" && wallet.connector && (
              <button
                className="btn btn--secondary btn--sm"
                type="button"
                onClick={() => void chooseAnotherWallet()}
                disabled={!mounted || disconnect.isPending || wallet.isSwitching}
                aria-label={`Disconnect ${wallet.connector.name} and choose another wallet`}
                title={`Currently connected with ${wallet.connector.name}`}
              >
                {disconnect.isPending ? "Disconnecting…" : "Choose another wallet"}
              </button>
            )}
            {selectionError && <span className="callout callout--caution protocol-notice" role="alert">{selectionError}</span>}
          </>
        );
      }}
    </ConnectButton.Custom>
  );
}
