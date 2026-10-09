"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useWalletNetwork } from "@/hooks/use-wallet-network";

export function WalletNetworkCard() {
  const wallet = useWalletNetwork();
  return (
    <section className="panel" aria-labelledby="wallet-status-heading">
      <div className="panel-heading">
        <h2 id="wallet-status-heading">Wallet and network</h2>
        <span className={`status-chip status-chip--${wallet.state}`}>{wallet.state.replaceAll("-", " ")}</span>
      </div>
      <p>{wallet.address ? `Connected wallet: ${wallet.address}` : "Connect an EVM wallet to use wallet-bound features."}</p>
      <div className="actions">
        <ConnectButton showBalance={false} chainStatus="full" accountStatus="address" />
        {wallet.state === "wrong-network" && (
          <button className="button" onClick={() => void wallet.switchToGiwaSepolia()} disabled={wallet.isSwitching}>
            {wallet.isSwitching ? "Switching…" : "Switch to GIWA Sepolia"}
          </button>
        )}
      </div>
    </section>
  );
}
