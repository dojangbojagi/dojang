"use client";

import Link from "next/link";
import { useVaultAccess } from "@/hooks/use-vault-access";
import { useEligibilityProof } from "@/hooks/use-eligibility-proof";
import { explainProtocolError } from "@/lib/protocol/errors";
import { useState } from "react";

export function VaultActionPanel() {
  const vault = useVaultAccess();
  const proof = useEligibilityProof();
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

  return (
    <section className="panel" aria-labelledby="vault-heading">
      <div className="panel-heading">
        <h2 id="vault-heading">Restricted Vault access</h2>
        <span className={`status-chip status-chip--${vault.state}`}>{vault.state.replaceAll("-", " ")}</span>
      </div>
      <p>This is a non-custodial access gate. It does not accept deposits or hold funds.</p>
      <dl className="data-list">
        <div><dt>Eligibility threshold</dt><dd>{vault.threshold === undefined ? "Not available" : `${vault.threshold.toString()} project demo test units`}</dd></div>
        <div><dt>Access state</dt><dd>{vault.hasAccess ? "Read from the configured contract" : "No confirmed access found"}</dd></div>
        <div><dt>Proof state</dt><dd>{proof.state.replaceAll("-", " ")}{proof.proof ? " · locally verified" : ""}</dd></div>
        <div><dt>Transaction</dt><dd>{vault.transaction.state.replaceAll("-", " ")}</dd></div>
        {vault.transaction.hash && <div><dt>Transaction hash</dt><dd><a href={vault.transaction.explorerUrl} target="_blank" rel="noreferrer">{vault.transaction.hash}</a></dd></div>}
      </dl>
      <p className="notice">Access changes only after the deployed vault verifies the proof, the transaction is confirmed, and the access readback succeeds. This workspace has no project deployment configured.</p>
      {error && <p role="alert">{error}</p>}
      {vault.transaction.error && <p role="alert">{vault.transaction.error}</p>}
      <div className="actions">
        <button className="button" type="button" onClick={() => void enter()} disabled={vault.state === "unconfigured" || vault.isSubmitting || proof.state !== "ready-to-submit" || !proof.proof}>
          Enter Vault
        </button>
        <button className="button button--quiet" type="button" onClick={() => void vault.refetch()}>Refresh access state</button>
        <Link href="/bojagi">View proof status</Link>
      </div>
    </section>
  );
}
