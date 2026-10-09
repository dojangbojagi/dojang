"use client";

import Link from "next/link";
import { useState } from "react";
import { useEligibilityProof } from "@/hooks/use-eligibility-proof";
import { DEMO_POLICY_ID, DEMO_POLICY_THRESHOLD, useDemoCredential } from "@/hooks/use-demo-credential";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { useDemoWitness } from "@/components/witness-context";
import { explainProtocolError } from "@/lib/protocol/errors";
import { StateChip } from "@/components/protocol-state";

export function ProofGenerationPanel() {
  const proof = useEligibilityProof();
  const credential = useDemoCredential();
  const wallet = useWalletNetwork();
  const { witness } = useDemoWitness();
  const [message, setMessage] = useState("");

  async function generate() {
    setMessage("");
    try {
      await proof.generateProof();
      setMessage("Proof generated and verified locally. No transaction was submitted.");
    } catch (error) {
      setMessage(explainProtocolError(error));
    }
  }

  const canGenerate = proof.state === "ready-to-prove" || proof.state === "ready-to-submit";
  return (
    <section className="panel panel--ticks protocol-panel" aria-labelledby="proof-heading">
      <div className="protocol-panel__head">
        <h2 id="proof-heading">Private eligibility proof</h2>
        <StateChip state={proof.state} />
      </div>
      <p className="protocol-copy">The circuit proves the issuer-backed commitment opens to a value at or above the policy threshold. The private value and salt remain in this browser; the proof is bound to the wallet, chain and configured vault.</p>
      <dl className="kv protocol-kv">
        <div className="kv__row"><dt>Policy</dt><dd>ID {DEMO_POLICY_ID.toString()} · at least {DEMO_POLICY_THRESHOLD.toString()} demo test units</dd></div>
        <div className="kv__row"><dt>Wallet network</dt><dd><StateChip state={wallet.state} /></dd></div>
        <div className="kv__row"><dt>Demo credential</dt><dd><StateChip state={credential.state} /></dd></div>
        <div className="kv__row"><dt>Private witness</dt><dd>{witness ? "Loaded in memory" : "Not imported"}</dd></div>
        <div className="kv__row"><dt>Witness match</dt><dd>{proof.witnessMatchesRecord ? "Matches current wallet and registry commitment" : "Not matched"}</dd></div>
        {proof.proof && <>
          <div className="kv__row"><dt>Local proof check</dt><dd><StateChip state="ready-to-submit" /></dd></div>
          <div className="kv__row"><dt>Proof size</dt><dd>{(proof.proof.proof.length - 2) / 2} bytes · {proof.proof.publicInputs.length} public inputs</dd></div>
          <div className="kv__row"><dt>Created</dt><dd>{new Date(proof.proof.createdAt).toLocaleString()}</dd></div>
        </>}
      </dl>
      <div className="callout callout--demo protocol-notice">
        <p><strong>Private:</strong> value and salt. <strong>Public:</strong> wallet, commitment, policy/version, threshold, credential version/expiry, chain, vault and proof.</p>
      </div>
      {(proof.error || wallet.state === "wrong-network") && <p className="callout callout--caution protocol-notice" role="status">{wallet.state === "wrong-network" ? "Switch to GIWA Sepolia before proving." : proof.error}</p>}
      {message && <p className="callout callout--demo protocol-notice" role="status" aria-live="polite">{message}</p>}
      {proof.state === "contract-unconfigured" && <p className="callout callout--caution protocol-notice">Proof generation is disabled until a deployed Restricted Vault address is configured. The commitment binds to that address.</p>}
      <div className="protocol-actions">
        <button className="btn btn--primary" type="button" onClick={() => void generate()} disabled={!canGenerate}>
          {proof.state === "generating" ? "Generating proof…" : proof.state === "ready-to-submit" ? "Generate a new proof" : "Generate proof"}
        </button>
        <Link className="protocol-inline-link" href="/vault">Review vault action ↗</Link>
      </div>
    </section>
  );
}
