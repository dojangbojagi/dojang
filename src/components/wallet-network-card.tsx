"use client";

import { WalletControl } from "@/components/wallet-control";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import type { ProtocolChainId } from "@/hooks/use-wallet-network";
import { GIWA_CHAIN_ID } from "@/lib/config/chain";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/config/robinhood-testnet";
import { StateChip } from "@/components/protocol-state";

export function WalletNetworkCard({ expectedChainId = ROBINHOOD_TESTNET_CHAIN_ID }: { expectedChainId?: ProtocolChainId }) {
  const wallet = useWalletNetwork(expectedChainId);
  const expectedName = expectedChainId === GIWA_CHAIN_ID ? "GIWA Sepolia" : "Robinhood Chain Testnet";
  const activeName = wallet.chainId === GIWA_CHAIN_ID
    ? "GIWA Sepolia"
    : wallet.chainId === ROBINHOOD_TESTNET_CHAIN_ID
      ? "Robinhood Chain Testnet"
      : wallet.chainId === undefined
        ? "No active wallet network"
        : "Unsupported network";
  return (
    <section className="panel panel--ticks protocol-panel" aria-labelledby="wallet-status-heading">
      <div className="protocol-panel__head">
        <h2 id="wallet-status-heading">Wallet and network</h2>
        <StateChip state={wallet.state} />
      </div>
      <dl className="kv protocol-kv">
        <div className="kv__row"><dt>Wallet</dt><dd className="addr">{wallet.address ?? "Not connected"}</dd></div>
        <div className="kv__row"><dt>Connected network</dt><dd>{activeName}{wallet.chainId !== undefined ? ` · chain ${wallet.chainId}` : ""}</dd></div>
        <div className="kv__row"><dt>Expected network</dt><dd>{expectedName} · chain {expectedChainId}</dd></div>
      </dl>
      <div className="protocol-actions">
        <WalletControl expectedChainId={expectedChainId} />
        {wallet.state === "wrong-network" && (
          <button className="btn btn--primary" type="button" onClick={() => void wallet.switchToExpectedNetwork()} disabled={wallet.isSwitching}>
            {wallet.isSwitching ? "Switching…" : `Switch to ${expectedName}`}
          </button>
        )}
      </div>
      {wallet.switchError && <p className="callout callout--caution protocol-notice" role="alert">{wallet.switchError}</p>}
      {wallet.state === "wrong-network" && <p className="callout callout--caution protocol-notice" role="status">Change networks before generating a proof or submitting a transaction.</p>}
    </section>
  );
}
