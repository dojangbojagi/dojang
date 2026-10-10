"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useBalance } from "wagmi";
import { BorrowView } from "@/components/lending/borrow-view";
import { explainLendingFailure } from "@/components/lending/errors";
import { LimitationsNotice, MarketOverview, PositionPanel, TransactionPanel, type EvidenceEntry } from "@/components/lending/lending-panels";
import { SupplyView } from "@/components/lending/supply-view";
import type { ActionRunner } from "@/components/lending/types";
import { WalletNetworkCard } from "@/components/wallet-network-card";
import { useLendingCredential } from "@/hooks/use-lending-credential";
import { useLendingEligibilityProof } from "@/hooks/use-lending-eligibility-proof";
import { useLendingMarket } from "@/hooks/use-lending-market";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { GIWA_CHAIN_ID } from "@/lib/config/chain";
import type { DemoCredentialWitness } from "@/lib/credential/witness";

type Tab = "supply" | "borrow";
const TABS: readonly { id: Tab; label: string; note: string }[] = [
  { id: "supply", label: "Supply", note: "Lend and withdraw" },
  { id: "borrow", label: "Borrow", note: "Prove, deposit, borrow, repay" },
];

/**
 * The lending page. Every number and every state comes from the existing lending hooks and the contract
 * behind them; this component only arranges them, gates the buttons and reports what happened.
 */
export function LendingWorkspace() {
  const wallet = useWalletNetwork();
  const market = useLendingMarket();
  const credential = useLendingCredential();
  const [witness, setWitness] = useState<DemoCredentialWitness | null>(null);
  const proof = useLendingEligibilityProof(witness ?? undefined);
  const gas = useBalance({
    address: wallet.address,
    chainId: GIWA_CHAIN_ID,
    query: { enabled: Boolean(wallet.address && wallet.isGiwaSepolia) },
  });

  const [tab, setTab] = useState<Tab>("supply");
  const [action, setAction] = useState("");
  const [banner, setBanner] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [evidence, setEvidence] = useState<EvidenceEntry[]>([]);
  const seen = useRef(new Set<string>());
  const lastAction = useRef("");

  /* a witness belongs to one wallet: drop it when the connected account changes */
  useEffect(() => {
    if (witness && wallet.address?.toLowerCase() !== witness.wallet.toLowerCase()) setWitness(null);
  }, [wallet.address, witness]);

  /* the session list of confirmed transactions, built only from the hook's own confirmed lifecycle */
  const tx = market.transaction;
  useEffect(() => {
    if (tx.state !== "confirmed" || !tx.hash || seen.current.has(tx.hash)) return;
    seen.current.add(tx.hash);
    const entry: EvidenceEntry = { label: lastAction.current || "Transaction", hash: tx.hash, explorerUrl: tx.explorerUrl };
    setEvidence((current) => [entry, ...current]);
  }, [tx.state, tx.hash, tx.explorerUrl]);

  const gasBalance = gas.data?.value;
  const noGas = gasBalance === 0n;

  let block: string | null = null;
  if (market.state === "unconfigured") block = "The lending pool is not configured.";
  else if (market.state === "disconnected") block = "Connect a wallet first.";
  else if (market.state === "wrong-network") block = "Switch to GIWA Sepolia first.";
  else if (market.state === "checking") block = "Reading the market and your wallet…";
  else if (market.state === "read-error") block = "The market could not be read. Refresh and try again.";
  else if (market.isSubmitting) block = "A transaction is already in progress.";
  else if (noGas) block = "This wallet has no GIWA Sepolia ETH to pay the network fee.";

  const runner: ActionRunner = {
    busy: market.isSubmitting,
    block,
    run: async (label, fn, success) => {
      lastAction.current = label;
      setAction(label);
      setBanner(null);
      try {
        await fn();
        setBanner({ tone: "ok", text: success });
        await market.refetch();
        return true;
      } catch (error) {
        setBanner({ tone: "error", text: explainLendingFailure(error) });
        return false;
      }
    },
  };

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const next: Tab = event.key === "Home" ? "supply" : event.key === "End" ? "borrow" : tab === "supply" ? "borrow" : "supply";
    setTab(next);
    document.getElementById(`lend-tab-${next}`)?.focus();
  }

  return (
    <div className="lend">
      <LimitationsNotice />
      <WalletNetworkCard />
      <div className="lend-layout">
        <div className="lend-main">
          <MarketOverview market={market} />

          <div className="lend-tabs" role="tablist" aria-label="Lending experiences">
            {TABS.map(({ id, label, note }) => (
              <button
                key={id}
                id={`lend-tab-${id}`}
                type="button"
                role="tab"
                className="lend-tab"
                aria-selected={tab === id}
                aria-controls={`lend-panel-${id}`}
                tabIndex={tab === id ? 0 : -1}
                onClick={() => setTab(id)}
                onKeyDown={onTabKey}
              >
                <span>{label}</span>
                <small>{note}</small>
              </button>
            ))}
          </div>

          <div className="lend-banner-slot" aria-live="polite">
            {banner && <p className={`callout ${banner.tone === "ok" ? "callout--demo" : "callout--caution"} lend-banner`} role={banner.tone === "error" ? "alert" : "status"}>{banner.text}</p>}
          </div>

          <div role="tabpanel" id="lend-panel-supply" aria-labelledby="lend-tab-supply" hidden={tab !== "supply"}>
            <SupplyView market={market} runner={runner} />
          </div>
          <div role="tabpanel" id="lend-panel-borrow" aria-labelledby="lend-tab-borrow" hidden={tab !== "borrow"}>
            <BorrowView market={market} runner={runner} credential={credential} proof={proof} witness={witness} onWitness={setWitness} />
          </div>
        </div>

        <aside className="lend-side" aria-label="Position and transactions">
          <PositionPanel market={market} gasBalance={gasBalance} />
          <TransactionPanel market={market} action={action} evidence={evidence} />
          <div className="protocol-actions">
            <button className="btn btn--secondary btn--sm" type="button" onClick={() => void market.refetch()} disabled={market.state === "unconfigured" || !wallet.address}>Refresh market</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
