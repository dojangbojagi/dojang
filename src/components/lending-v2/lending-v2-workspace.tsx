"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Address } from "viem";
import { useBalance } from "wagmi";
import { TransactionPanel, type EvidenceEntry } from "@/components/lending/lending-panels";
import type { ActionRunner } from "@/components/lending/types";
import { formatAmount } from "@/components/lending/format";
import { BorrowView } from "@/components/lending-v2/v2-borrow";
import { EligibilityCard } from "@/components/lending-v2/v2-eligibility";
import { LiquidationPanel } from "@/components/lending-v2/v2-liquidation";
import { MarketsView } from "@/components/lending-v2/v2-markets";
import { Chip, type Tone } from "@/components/lending-v2/v2-parts";
import { PositionView } from "@/components/lending-v2/v2-position";
import { ContextBar, V2LimitationsNotice, marketStateCopy } from "@/components/lending-v2/v2-status";
import { SupplyView } from "@/components/lending-v2/v2-supply";
import type { V2Tab } from "@/components/lending-v2/v2-types";
import { WalletNetworkCard } from "@/components/wallet-network-card";
import { useLendingMarketV2 } from "@/hooks/use-lending-market-v2";
import { useLendingV2EligibilityProof } from "@/hooks/use-lending-v2-eligibility-proof";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { GIWA_CHAIN_ID } from "@/lib/config/chain";
import type { DemoCredentialWitness } from "@/lib/credential/witness";
import { mapLendingV2Error } from "@/lib/lending/v2-errors";
import { ProtocolError } from "@/lib/protocol/types";

const TABS: readonly { id: V2Tab; label: string; note: string }[] = [
  { id: "markets", label: "Markets", note: "Assets, rates, risk" },
  { id: "supply", label: "Supply", note: "Lend and withdraw" },
  { id: "borrow", label: "Borrow", note: "Collateral, then borrow" },
  { id: "position", label: "Your position", note: "Health, repay, exit" },
];

const ELIGIBILITY_TONE: Record<string, { tone: Tone; label: string }> = {
  "proof-ready": { tone: "valid", label: "Proof ready" },
  "ready-to-prove": { tone: "demo", label: "Ready to prove" },
  generating: { tone: "pending", label: "Verifying" },
  "witness-required": { tone: "demo", label: "Action required" },
  "witness-mismatch": { tone: "invalid", label: "Witness mismatch" },
  "credential-required": { tone: "neutral", label: "Credential not found" },
  "credential-expired": { tone: "warn", label: "Expired" },
  "credential-revoked": { tone: "invalid", label: "Revoked" },
  "credential-not-yet-valid": { tone: "warn", label: "Not yet valid" },
  "issuer-untrusted": { tone: "warn", label: "Issuer not authorized" },
  checking: { tone: "pending", label: "Checking" },
  "read-error": { tone: "invalid", label: "Unable to check" },
  invalid: { tone: "invalid", label: "Proof failed" },
  disconnected: { tone: "neutral", label: "Wallet needed" },
  "wrong-network": { tone: "warn", label: "Wrong network" },
  unconfigured: { tone: "neutral", label: "Not available" },
  unavailable: { tone: "neutral", label: "Not available" },
};

function explain(error: unknown): string {
  if (error instanceof ProtocolError) return error.message;
  return mapLendingV2Error(error).message;
}

/**
 * The Lending V2 page. Every number and every state comes from useLendingMarketV2, useLendingV2EligibilityProof and
 * the contract behind them; this component arranges them, gates the buttons and reports what happened. It holds no
 * lending rules and never reports a transaction as done before the hook has confirmed it.
 */
export function LendingV2Workspace() {
  const wallet = useWalletNetwork();
  const market = useLendingMarketV2();
  const [witness, setWitness] = useState<DemoCredentialWitness | null>(null);
  const proof = useLendingV2EligibilityProof(witness ?? undefined);
  const gas = useBalance({
    address: wallet.address,
    chainId: GIWA_CHAIN_ID,
    query: { enabled: Boolean(wallet.address && wallet.isGiwaSepolia) },
  });

  const [tab, setTab] = useState<V2Tab>("markets");
  const [supplyAsset, setSupplyAsset] = useState<Address>();
  const [borrowAsset, setBorrowAsset] = useState<Address>();
  const [collateralAsset, setCollateralAsset] = useState<Address>();
  const [manageAsset, setManageAsset] = useState<Address>();
  const [action, setAction] = useState("");
  const [banner, setBanner] = useState<{ tone: "ok" | "error"; text: string; category?: string } | null>(null);
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
  if (market.state === "unconfigured") block = "Lending V2 is not configured, so no transaction can be prepared.";
  else if (market.state === "disconnected") block = "Connect a wallet first.";
  else if (market.state === "wrong-network") block = "Switch to GIWA Sepolia first.";
  else if (market.state === "checking") block = "Reading the V2 pool and your wallet…";
  else if (market.state === "unavailable") block = "The configured address is not a compatible Lending V2 deployment.";
  else if (market.state === "read-error") block = "The V2 market could not be read. Refresh and try again.";
  else if (market.isSubmitting) block = "A transaction is already in progress.";
  else if (noGas) block = "This wallet has no GIWA Sepolia ETH to pay the network fee.";
  else if (!market.writesAvailable) block = "Transactions are not available right now.";

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
        await proof.refetchCredential();
        return true;
      } catch (error) {
        setBanner({ tone: "error", text: explain(error) });
        return false;
      }
    },
  };

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const index = TABS.findIndex((item) => item.id === tab);
    const nextIndex =
      event.key === "Home" ? 0
      : event.key === "End" ? TABS.length - 1
      : event.key === "ArrowRight" ? (index + 1) % TABS.length
      : (index - 1 + TABS.length) % TABS.length;
    const next = TABS[nextIndex].id;
    setTab(next);
    document.getElementById(`lendv2-tab-${next}`)?.focus();
  }

  function open(target: "supply" | "borrow", asset: Address) {
    if (target === "supply") setSupplyAsset(asset);
    else setBorrowAsset(asset);
    setTab(target);
    document.getElementById("lendv2-tabs")?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  const copy = marketStateCopy(market.state);
  const eligibility = ELIGIBILITY_TONE[proof.state] ?? { tone: "neutral" as Tone, label: "Unknown" };
  const failure = market.failure;

  return (
    <div className="lend lendv2">
      <V2LimitationsNotice configured={market.state !== "unconfigured"} />
      <WalletNetworkCard />
      <ContextBar market={market} walletAddress={wallet.address} eligibility={eligibility} />

      <div className="lend-layout">
        <div className="lend-main">
          {market.state !== "ready" && (
            <p className={`callout ${copy.tone === "valid" || copy.tone === "neutral" || copy.tone === "pending" ? "callout--demo" : "callout--caution"}`} role="status">
              <span><strong>{copy.label}.</strong> {copy.text}</span>
            </p>
          )}
          {market.snapshot && market.state === "read-error" && (
            <p className="callout callout--caution" role="status">The values below are from the last successful read, at block {market.snapshot.blockNumber.toString()}.</p>
          )}

          <EligibilityCard market={market} proof={proof} witness={witness} onWitness={setWitness} />

          <div className="lend-tabs lendv2-tabs" id="lendv2-tabs" role="tablist" aria-label="Lending V2 areas">
            {TABS.map(({ id, label, note }) => (
              <button
                key={id}
                id={`lendv2-tab-${id}`}
                type="button"
                role="tab"
                className="lend-tab"
                aria-selected={tab === id}
                aria-controls={`lendv2-panel-${id}`}
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
            {banner && (
              <p className={`callout ${banner.tone === "ok" ? "callout--demo" : "callout--caution"} lend-banner`} role={banner.tone === "error" ? "alert" : "status"}>
                <span>
                  {banner.text}
                  {banner.tone === "error" && failure ? <span className="lendv2-failure"> · Category: {failure.category}</span> : null}
                </span>
              </p>
            )}
          </div>

          <div role="tabpanel" id="lendv2-panel-markets" aria-labelledby="lendv2-tab-markets" hidden={tab !== "markets"}>
            <MarketsView market={market} onOpen={open} />
          </div>
          <div role="tabpanel" id="lendv2-panel-supply" aria-labelledby="lendv2-tab-supply" hidden={tab !== "supply"}>
            <SupplyView market={market} proof={proof} runner={runner} asset={supplyAsset} onAsset={setSupplyAsset} />
          </div>
          <div role="tabpanel" id="lendv2-panel-borrow" aria-labelledby="lendv2-tab-borrow" hidden={tab !== "borrow"}>
            <BorrowView
              market={market}
              proof={proof}
              runner={runner}
              borrowAsset={borrowAsset}
              onBorrowAsset={setBorrowAsset}
              collateralAsset={collateralAsset}
              onCollateralAsset={setCollateralAsset}
            />
          </div>
          <div role="tabpanel" id="lendv2-panel-position" aria-labelledby="lendv2-tab-position" hidden={tab !== "position"}>
            <PositionView market={market} runner={runner} asset={manageAsset} onAsset={setManageAsset} />
            <LiquidationPanel market={market} runner={runner} />
          </div>
        </div>

        <aside className="lend-side" aria-label="Transactions and status">
          <TransactionPanel transaction={market.transaction} action={action} evidence={evidence} />
          <section className="panel panel--ticks protocol-panel" aria-labelledby="lendv2-side-heading">
            <div className="protocol-panel__head">
              <h2 id="lendv2-side-heading">Network fee</h2>
              <Chip tone={gasBalance === undefined ? "neutral" : noGas ? "warn" : "valid"}>{gasBalance === undefined ? "Not read" : noGas ? "No ETH" : "ETH available"}</Chip>
            </div>
            <p className="small muted">
              {gasBalance === undefined ? "Connect a wallet on GIWA Sepolia to read its ETH balance." : `${formatAmount(gasBalance, 18, 5)} ETH for network fees.`}
            </p>
            <p className="xsmall muted">
              Activity here lists only transactions confirmed in this browser session. A protocol-wide event history is not exposed by the V2 hooks yet, so none is shown.
            </p>
            <div className="protocol-actions">
              <button className="btn btn--secondary btn--sm" type="button" onClick={() => void market.refetch()} disabled={market.state === "unconfigured" || market.state === "unavailable"}>Refresh market</button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
