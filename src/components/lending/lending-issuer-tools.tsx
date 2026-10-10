"use client";

import { useState, type FormEvent } from "react";
import { StateChip, TransactionSummary } from "@/components/protocol-state";
import { useLendingCredential, useLendingCredentialIssuance } from "@/hooks/use-lending-credential";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { projectContracts } from "@/lib/config/contracts";
import { LENDING_ELIGIBILITY_THRESHOLD, LENDING_POLICY_ID } from "@/lib/lending/config";
import { explainProtocolError } from "@/lib/protocol/errors";
import type { DemoCredentialWitness } from "@/lib/credential/witness";

function defaultExpiry() {
  const date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

/**
 * For wallets that hold the registry's issuer role: issues the lending credential (policy 2) to the connected
 * wallet through the existing hook. Everyone else uses the witness their issuer delivered. The contract, not this
 * form, decides who may issue.
 */
export function LendingIssuerTools({ onIssued }: { onIssued: (witness: DemoCredentialWitness) => void }) {
  const wallet = useWalletNetwork();
  const credential = useLendingCredential();
  const issuance = useLendingCredentialIssuance();
  const [privateValue, setPrivateValue] = useState("1250");
  const [expiresAt, setExpiresAt] = useState(defaultExpiry);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const configured = Boolean(projectContracts.credentialRegistry && projectContracts.lendingPool);
  const validValue = /^(0|[1-9][0-9]*)$/.test(privateValue) && BigInt(privateValue || "0") >= LENDING_ELIGIBILITY_THRESHOLD;
  const expiresMs = Date.parse(expiresAt);
  const validExpiry = Number.isFinite(expiresMs) && Math.floor(expiresMs / 1000) > Math.floor(Date.now() / 1000);
  const canIssue = Boolean(wallet.address && wallet.isGiwaSepolia && configured && validValue && validExpiry && !issuance.isSubmitting);

  async function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (!wallet.address || !canIssue) return;
    try {
      const witness = await issuance.issueCredential({ wallet: wallet.address, privateValue, expiresAt: BigInt(Math.floor(expiresMs / 1000)) });
      onIssued(witness);
      await credential.refetch();
      setPrivateValue("");
      setMessage("Credential confirmed by the registry readback. Its private witness is held in this browser session only; it was not displayed or exported.");
    } catch (cause) {
      setError(explainProtocolError(cause));
    }
  }

  return (
    <details className="lend-issuer">
      <summary className="protocol-inline-link">Issuer tools: issue a lending credential to this wallet</summary>
      <div className="lend-issuer__body">
        <div className="protocol-panel__head"><h3 className="lend-subhead">Policy {LENDING_POLICY_ID.toString()} issuer</h3><StateChip state={credential.state === "active" ? "active" : credential.state === "checking" ? "checking" : "missing"}>{credential.state === "active" ? "Credential on record" : undefined}</StateChip></div>
        <p className="small muted">
          Only a wallet with the registry issuer role can do this; the contract enforces it. The commitment is bound to the LendingPool. The registry stores the commitment only; the private value and salt stay in this browser.
        </p>
        <form className="protocol-form" onSubmit={(event) => void issue(event)}>
          <div className="protocol-form__grid">
            <label className="protocol-field" htmlFor="lend-private-value"><span>Private eligibility value</span>
              <input id="lend-private-value" type="password" inputMode="numeric" autoComplete="off" value={privateValue} onChange={(event) => setPrivateValue(event.currentTarget.value)} aria-describedby="lend-value-help" />
            </label>
            <label className="protocol-field" htmlFor="lend-expiry"><span>Credential expiry</span>
              <input id="lend-expiry" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.currentTarget.value)} />
            </label>
          </div>
          <p id="lend-value-help" className="xsmall muted">At least {LENDING_ELIGIBILITY_THRESHOLD.toString()} demo test units. This is not a currency amount and is never sent to the registry.</p>
          <div className="protocol-actions">
            <button className="btn btn--secondary" type="submit" disabled={!canIssue}>{issuance.isSubmitting ? "Issuing credential…" : "Issue to connected wallet"}</button>
            {!configured && <span className="small muted">The registry and the LendingPool must both be configured.</span>}
            {configured && !wallet.address && <span className="small muted">Connect an issuer wallet.</span>}
            {configured && wallet.state === "wrong-network" && <span className="small" role="status">Switch to GIWA Sepolia to issue.</span>}
          </div>
        </form>
        <TransactionSummary lifecycle={issuance.transaction} />
        {error && <p className="callout callout--caution protocol-notice" role="alert">{error}</p>}
        {message && <p className="callout callout--demo protocol-notice" role="status" aria-live="polite">{message}</p>}
      </div>
    </details>
  );
}
