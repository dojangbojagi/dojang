"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import type { ProtocolChainId } from "@/hooks/use-wallet-network";

export function WalletControl({ expectedChainId }: { expectedChainId?: ProtocolChainId }) {
  const wallet = useWalletNetwork(expectedChainId);
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
        const openWallet = () => {
          if (state === "disconnected" || state === "connecting") openConnectModal();
          else if (state === "wrong-network") void wallet.switchToExpectedNetwork();
          else openAccountModal();
        };

        return (
          <button
            className="btn btn--secondary btn--sm btn--wallet"
            type="button"
            data-wallet={state}
            onClick={openWallet}
            disabled={!mounted}
            aria-label={label}
            title={wallet.switchError ?? label}
          >
            <span className="btn__dot" aria-hidden="true" />
            <span className="wl-full">{label}</span>
            <span className="wl-short" aria-hidden="true">{state === "connected" ? account?.displayName : state === "wrong-network" ? wallet.isSwitching ? "Switching" : wallet.switchError ? "Retry" : "Switch" : "Connect"}</span>
            {wallet.switchError && <span className="visually-hidden" role="alert">{wallet.switchError}</span>}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
