"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useWalletNetwork } from "@/hooks/use-wallet-network";

export function WalletControl() {
  const wallet = useWalletNetwork();
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted && Boolean(account) && Boolean(chain);
        const state = !mounted || wallet.state === "connecting"
          ? "connecting"
          : !ready
            ? "disconnected"
            : chain?.unsupported || wallet.state === "wrong-network"
              ? "wrong-network"
              : "connected";
        const label = state === "connecting" ? "Connecting…"
          : state === "disconnected" ? "Connect Wallet"
            : state === "wrong-network" ? "Wrong Network"
              : account?.displayName ?? "Connected";
        const openWallet = () => {
          if (state === "disconnected" || state === "connecting") openConnectModal();
          else if (state === "wrong-network") openChainModal();
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
          >
            <span className="btn__dot" aria-hidden="true" />
            <span className="wl-full">{label}</span>
            <span className="wl-short" aria-hidden="true">{state === "connected" ? account?.displayName : state === "wrong-network" ? "Switch" : "Connect"}</span>
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
