"use client";

import { WalletControl } from "@/components/wallet-control";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import type { ProtocolChainId } from "@/hooks/use-wallet-network";
import { GIWA_CHAIN_ID } from "@/lib/config/chain";
import { ROBINHOOD_TESTNET_CHAIN_ID, ROBINHOOD_TESTNET_PUBLIC_RPC_URL } from "@/lib/config/robinhood-testnet";
import { supportedProtocolChains } from "@/lib/config/network-registry";
import { StateChip } from "@/components/protocol-state";

export function WalletNetworkCard({ expectedChainId = ROBINHOOD_TESTNET_CHAIN_ID }: { expectedChainId?: ProtocolChainId }) {
  const wallet = useWalletNetwork(expectedChainId);
  const expectedChain = supportedProtocolChains.find((chain) => chain.id === expectedChainId);
  const manualRpcUrl = expectedChainId === ROBINHOOD_TESTNET_CHAIN_ID
    ? ROBINHOOD_TESTNET_PUBLIC_RPC_URL
    : "Use the RPC configured for this network; its URL is hidden here for safety.";
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
        <div className="kv__row"><dt>Wallet provider</dt><dd>{wallet.connector?.name ?? "Not connected"}</dd></div>
        <div className="kv__row"><dt>Connected network</dt><dd>{activeName}{wallet.chainId !== undefined ? ` · chain ${wallet.chainId}` : ""}</dd></div>
        <div className="kv__row"><dt>Expected network</dt><dd>{expectedName} · chain {expectedChainId}</dd></div>
      </dl>
      <div className="protocol-actions">
        <WalletControl expectedChainId={expectedChainId} showRecoveryAction />
        {wallet.state === "wrong-network" && (
          <button className="btn btn--primary" type="button" onClick={() => void wallet.switchToExpectedNetwork()} disabled={wallet.isSwitching}>
            {wallet.isSwitching ? "Switching…" : `Switch to ${expectedName}`}
          </button>
        )}
      </div>
      {wallet.switchError && <p className="callout callout--caution protocol-notice" role="alert">{wallet.switchError}</p>}
      {wallet.state === "wrong-network" && <p className="callout callout--caution protocol-notice" role="status">Change networks before generating a proof or submitting a transaction.</p>}
      {wallet.state === "wrong-network" && expectedChain && (
        <details className="protocol-notice">
          <summary>Manual network setup</summary>
          <p>If the wallet cannot add the required chain automatically, add this network in the wallet and retry.</p>
          <dl className="kv protocol-kv">
            <div className="kv__row"><dt>Network name</dt><dd>{expectedChain.name}</dd></div>
            <div className="kv__row"><dt>Chain ID</dt><dd>{expectedChain.id}</dd></div>
            <div className="kv__row"><dt>RPC URL</dt><dd>{manualRpcUrl}</dd></div>
            <div className="kv__row"><dt>Native currency</dt><dd>{expectedChain.nativeCurrency.name} ({expectedChain.nativeCurrency.symbol}, {expectedChain.nativeCurrency.decimals} decimals)</dd></div>
            {expectedChain.blockExplorers?.default?.url && <div className="kv__row"><dt>Block explorer</dt><dd>{expectedChain.blockExplorers.default.url}</dd></div>}
          </dl>
        </details>
      )}
      {process.env.NODE_ENV !== "production" && wallet.isConnected && (
        <details className="protocol-notice">
          <summary>Developer wallet diagnostics</summary>
          <p>Read-only provider diagnostics. No wallet transaction is requested.</p>
          <dl className="kv protocol-kv">
            <div className="kv__row"><dt>Wagmi account chain</dt><dd>{wallet.switchDiagnostics?.accountChainId ?? wallet.chainId ?? "Unavailable"}</dd></div>
            <div className="kv__row"><dt>Required chain</dt><dd>{wallet.switchDiagnostics?.requiredChainId ?? expectedChainId}</dd></div>
            {wallet.switchDiagnostics?.providerChainId !== undefined && <div className="kv__row"><dt>Provider chain readback</dt><dd>{wallet.switchDiagnostics.providerChainId}</dd></div>}
            {wallet.switchDiagnostics?.errorName && <div className="kv__row"><dt>Last switch error type</dt><dd>{wallet.switchDiagnostics.errorName}</dd></div>}
            {wallet.switchDiagnostics?.errorCode !== undefined && <div className="kv__row"><dt>Last switch error code</dt><dd>{wallet.switchDiagnostics.errorCode}</dd></div>}
            {wallet.switchDiagnostics?.providerReadErrorName && <div className="kv__row"><dt>Provider read error type</dt><dd>{wallet.switchDiagnostics.providerReadErrorName}</dd></div>}
          </dl>
          <button className="btn btn--secondary btn--sm" type="button" onClick={() => void wallet.refreshNetworkDiagnostics()}>
            Read wallet network again
          </button>
        </details>
      )}
    </section>
  );
}
