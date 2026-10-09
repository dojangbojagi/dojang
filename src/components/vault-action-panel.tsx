"use client";

import Link from "next/link";
import { useState } from "react";
import { useVaultAccess } from "@/hooks/use-vault-access";
import { useEligibilityProof } from "@/hooks/use-eligibility-proof";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { explainProtocolError } from "@/lib/protocol/errors";
import { StateChip, TransactionSummary } from "@/components/protocol-state";

export function VaultActionPanel() {
  const vault = useVaultAccess();
  const proof = useEligibilityProof();
  const wallet = useWalletNetwork();
  const [error, setError] = useState("");

  async function enter() {
    setError("");
    try {
      if (!proof.proof) throw new Error("Generate and locally verify a current proof on the Bojagi page first.");
      await vault.enterVault(proof.proof);
    } catch (cause) {
      setError(explainProtocolError(cause));
    }
  }

  const mayEnter = vault.state !== "unconfigured" && wallet.isGiwaSepolia && !vault.isSubmitting &&
    proof.state === "ready-to-submit" && Boolean(proof.proof);

  return (
    <section className="panel panel--ticks protocol-panel" aria-labelledby="vault-heading">
      <div className="protocol-panel__head">
        <h2 id="vault-heading">Restricted Vault access</h2>
        <StateChip state={vault.state} />
      </div>
      <div className="protocol-gate" aria-hidden="true">
        <div className="protocol-gate__beam" />
        <div className="protocol-gate__door"><span /><span /><span /></div>
        <div className="protocol-gate__lock">{vault.hasAccess ? "OPEN" : "PROOF"}</div>
      </div>
      <p className="protocol-copy">This is a non-custodial access gate. It does not accept deposits, hold funds or transfer tokens.</p>
      <dl className="kv protocol-kv">
        <div className="kv__row"><dt>Wallet network</dt><dd><StateChip state={wallet.state} /></dd></div>
        <div className="kv__row"><dt>Eligibility requirement</dt><dd>{vault.threshold === undefined ? "Not available" : `At least ${vault.threshold.toString()} project demo test units`}</dd></div>
        <div className="kv__row"><dt>Proof readiness</dt><dd><StateChip state={proof.state} /></dd></div>
        <div className="kv__row"><dt>On-chain access</dt><dd><StateChip state={vault.state === "access-granted" || vault.state === "previously-granted" ? vault.state : "locked"} /></dd></div>
      </dl>
      <ol className="protocol-progress" aria-label="Vault transaction lifecycle">
        {(["simulating", "awaiting-signature", "submitted", "confirming", "confirmed"] as const).map((step, index) => {
          const currentIndex = ["idle", "simulating", "awaiting-signature", "submitted", "confirming", "confirmed"].indexOf(vault.transaction.state);
          const stepIndex = index + 1;
          return <li key={step} data-current={vault.transaction.state === step} data-complete={currentIndex > stepIndex}>{step === "awaiting-signature" ? "Waiting for wallet confirmation" : step[0].toUpperCase() + step.slice(1)}</li>;
        })}
      </ol>
      <TransactionSummary lifecycle={vault.transaction} />
      {vault.transaction.error && <p className="callout callout--caution protocol-notice" role="status">{vault.transaction.error}</p>}
      {error && <p className="callout callout--caution protocol-notice" role="alert">{error}</p>}
      {wallet.state === "wrong-network" && <p className="callout callout--caution protocol-notice">Switch to GIWA Sepolia before submitting a proof.</p>}
      {vault.state === "unconfigured" && <p className="callout callout--caution protocol-notice">Project vault and registry addresses are not configured, so no wallet transaction can be submitted from this workspace.</p>}
      <div className="protocol-actions">
        <button className="btn btn--primary" type="button" onClick={() => void enter()} disabled={!mayEnter}>{vault.isSubmitting ? "Confirming access…" : "Enter Vault"}</button>
        <button className="btn btn--secondary" type="button" onClick={() => void vault.refetch()} disabled={!wallet.address || vault.state === "unconfigured"}>Refresh access</button>
        <Link className="protocol-inline-link" href="/bojagi">View proof status ↗</Link>
      </div>
      <p className="xsmall muted">Access is shown only after a successful transaction receipt and positive contract readback. The access flag is permanent for this wallet in the demo contract.</p>
    </section>
  );
}
