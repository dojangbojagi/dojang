"use client";

import { useState, type FormEvent } from "react";
import { useDemoWitness } from "@/components/witness-context";
import { StateChip, TransactionSummary } from "@/components/protocol-state";
import { useDemoCredential } from "@/hooks/use-demo-credential";
import { useDemoCredentialIssuance } from "@/hooks/use-demo-credential-issuance";
import { useDemoCredentialRevocation } from "@/hooks/use-demo-credential-revocation";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { projectContracts } from "@/lib/config/contracts";
import { explainProtocolError } from "@/lib/protocol/errors";

function defaultExpiry() {
  const date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function DemoCredentialTools() {
  const wallet = useWalletNetwork();
  const credential = useDemoCredential();
  const issuance = useDemoCredentialIssuance();
  const revocation = useDemoCredentialRevocation();
  const { setWitness } = useDemoWitness();
  const [privateValue, setPrivateValue] = useState("1250");
  const [expiresAt, setExpiresAt] = useState(defaultExpiry);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const validValue = /^(0|[1-9][0-9]*)$/.test(privateValue) && BigInt(privateValue || "0") >= 1_000n;
  const expiresMs = Date.parse(expiresAt);
  const validExpiry = Number.isFinite(expiresMs) && Math.floor(expiresMs / 1000) > Math.floor(Date.now() / 1000);
  const canIssue = Boolean(wallet.address && wallet.isGiwaSepolia && projectContracts.credentialRegistry && projectContracts.restrictedVault &&
    validValue && validExpiry && !issuance.isSubmitting);

  async function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (!wallet.address || !validValue || !validExpiry) return;
    try {
      const witness = await issuance.issueCredential({
        wallet: wallet.address,
        privateValue,
        expiresAt: BigInt(Math.floor(expiresMs / 1000)),
      });
      setWitness(witness);
      await credential.refetch();
      setPrivateValue("");
      setMessage("Credential commitment confirmed. Its private witness is held in this browser session and was not displayed or exported.");
    } catch (cause) {
      setError(explainProtocolError(cause));
    }
  }

  async function revoke() {
    setMessage("");
    setError("");
    try {
      await revocation.revokeCredential();
      setMessage("The registry readback confirms the credential is revoked.");
    } catch (cause) {
      setError(explainProtocolError(cause));
    }
  }

  const transaction = issuance.transaction.state !== "idle" ? issuance.transaction : revocation.transaction;
  const submitting = issuance.isSubmitting || revocation.isSubmitting;
  const configured = Boolean(projectContracts.credentialRegistry && projectContracts.restrictedVault);

  return (
    <section className="panel panel--ticks protocol-panel" aria-labelledby="demo-onboarding-heading">
      <div className="protocol-panel__head">
        <h2 id="demo-onboarding-heading">Project demo issuer</h2>
        <StateChip state={credential.state} />
      </div>
      <p className="protocol-copy">The connected wallet issues only to itself in this browser. The registry stores a commitment; the private value and salt remain in memory for this session.</p>
      <div className="callout callout--demo"><p><strong>Separate from official Dojang.</strong> Issuance requires the configured registry and vault, a GIWA Sepolia wallet, and an authorized issuer role. Only the contract enforces that role.</p></div>

      <dl className="kv protocol-kv">
        <div className="kv__row"><dt>Connected wallet</dt><dd className="addr">{wallet.address ?? "Connect an issuer wallet"}</dd></div>
        <div className="kv__row"><dt>Registry</dt><dd>{projectContracts.credentialRegistry ? <span className="addr">Configured</span> : "Not configured"}</dd></div>
        <div className="kv__row"><dt>Vault binding</dt><dd>{projectContracts.restrictedVault ? <span className="addr">Configured</span> : "Not configured"}</dd></div>
      </dl>

      <form className="protocol-form" onSubmit={(event) => void issue(event)}>
        <div className="protocol-form__grid">
          <label className="protocol-field" htmlFor="demo-private-value"><span>Private test value</span>
            <input id="demo-private-value" name="privateValue" type="password" inputMode="numeric" autoComplete="off" pattern="(0|[1-9][0-9]*)" value={privateValue} onChange={(event) => setPrivateValue(event.currentTarget.value)} aria-describedby="demo-value-help" />
          </label>
          <label className="protocol-field" htmlFor="demo-expiry"><span>Credential expiry</span>
            <input id="demo-expiry" name="expiresAt" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.currentTarget.value)} />
          </label>
        </div>
        <p id="demo-value-help" className="xsmall muted">At least 1,000 project demo test units. This is not a currency amount. The value is never included in the registry call.</p>
        <div className="protocol-actions">
          <button className="btn btn--primary" type="submit" disabled={!canIssue}>
            {issuance.isSubmitting ? "Issuing credential…" : "Issue to connected wallet"}
          </button>
          {wallet.state === "wrong-network" && <span className="small" role="status">Switch to GIWA Sepolia to issue.</span>}
          {!configured && <span className="small muted">Configure the project registry and vault first.</span>}
        </div>
      </form>

      {credential.record && (
        <div className="protocol-kv kv">
          <div className="kv__row"><dt>Issuer</dt><dd className="addr">{credential.record.issuer}</dd></div>
          <div className="kv__row"><dt>Commitment</dt><dd className="addr">{credential.record.commitment}</dd></div>
          <div className="kv__row"><dt>Version</dt><dd>{credential.record.version.toString()}</dd></div>
          <div className="kv__row"><dt>Expires</dt><dd>{new Date(Number(credential.record.expiresAt) * 1000).toLocaleString()}</dd></div>
        </div>
      )}

      {credential.record && !credential.record.revoked && (
        <details className="protocol-revoke">
          <summary className="protocol-inline-link">Revoke this demo credential</summary>
          <p className="small muted">The credential issuer or registry admin can revoke it. The contract checks authorization; revocation is confirmed only after receipt and registry readback.</p>
          <button className="btn btn--secondary" type="button" onClick={() => void revoke()} disabled={!wallet.isGiwaSepolia || submitting || revocation.state !== "active"}>
            {revocation.isSubmitting ? "Revoking…" : "Revoke credential"}
          </button>
        </details>
      )}

      <TransactionSummary lifecycle={transaction} />
      {error && <p className="callout callout--caution protocol-notice" role="alert">{error}</p>}
      {message && <p className="callout callout--demo protocol-notice" role="status" aria-live="polite">{message}</p>}
    </section>
  );
}
