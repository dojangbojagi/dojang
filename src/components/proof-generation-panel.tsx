"use client";

import { useState } from "react";
import { useEligibilityProof } from "@/hooks/use-eligibility-proof";
import { DEMO_POLICY_THRESHOLD, useDemoCredential } from "@/hooks/use-demo-credential";
import { explainProtocolError } from "@/lib/protocol/errors";

export function ProofGenerationPanel() {
  const proof = useEligibilityProof();
  const credential = useDemoCredential();
  const [message, setMessage] = useState("");

  async function generate() {
    setMessage("");
    try {
      await proof.generateProof();
      setMessage("Proof generated.");
    } catch (error) {
      setMessage(explainProtocolError(error));
    }
  }

  return (
    <section className="panel" aria-labelledby="proof-heading">
      <div className="panel-heading">
        <h2 id="proof-heading">Private eligibility proof</h2>
        <span className={`status-chip status-chip--${proof.state}`}>{proof.state.replaceAll("-", " ")}</span>
      </div>
      <dl className="data-list">
        <div><dt>Policy</dt><dd>ID 1 · version 1 · at least {DEMO_POLICY_THRESHOLD.toString()} project demo test units</dd></div>
        <div><dt>Demo credential</dt><dd>{credential.state.replaceAll("-", " ")}</dd></div>
        <div><dt>Witness match</dt><dd>{proof.witnessMatchesRecord ? "Metadata matched" : "Not matched"}</dd></div>
        <div><dt>Proof backend</dt><dd>Noir / Barretenberg in this browser session</dd></div>
        {proof.proof && <div><dt>Local verification</dt><dd>{proof.proof.localVerification}</dd></div>}
        {proof.proof && <div><dt>Proof size</dt><dd>{(proof.proof.proof.length - 2) / 2} bytes</dd></div>}
      </dl>
      <p className="notice">Proof generation and local verification run in this browser. The witness stays in memory. On-chain verification is available only when the project contracts are deployed and configured.</p>
      {proof.error && <p role="status">{proof.error}</p>}
      {message && <p role="status">{message}</p>}
      <button className="button" type="button" onClick={() => void generate()} disabled={proof.state !== "ready-to-prove" && proof.state !== "ready-to-submit"}>
        {proof.state === "ready-to-submit" ? "Regenerate proof" : "Generate proof"}
      </button>
    </section>
  );
}
