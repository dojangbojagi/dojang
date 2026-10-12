"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import type { ProtocolChainId } from "@/hooks/use-wallet-network";
import { supportedProtocolChains } from "@/lib/config/network-registry";

export function WalletControl({ expectedChainId }: { expectedChainId?: ProtocolChainId }) {
  const wallet = useWalletNetwork(expectedChainId);
  const requiredChain = supportedProtocolChains.find((chain) => chain.id === wallet.expectedChainId);
  const activeChain = supportedProtocolChains.find((chain) => chain.id === wallet.chainId);
  const networkDescription = wallet.state === "wrong-network"
    ? `Connected to ${activeChain?.name ?? "unsupported network"}${wallet.chainId === undefined ? "" : ` (chain ${wallet.chainId})`}; required ${requiredChain?.name ?? "configured network"} (chain ${wallet.expectedChainId}).`
    : undefined;
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

        return (
          <button
            className="btn btn--secondary btn--sm btn--wallet"
            type="button"
            data-wallet={state}
            onClick={openWallet}
            disabled={!mounted || (state === "wrong-network" && wallet.isSwitching)}
            aria-label={accessibleLabel}
            title={wallet.switchError ?? networkDescription ?? label}
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
