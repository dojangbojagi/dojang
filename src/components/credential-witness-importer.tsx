"use client";

import { useState } from "react";
import { useDemoWitness } from "@/components/witness-context";
import { useDemoCredential } from "@/hooks/use-demo-credential";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { parseDemoCredentialWitness } from "@/lib/credential/witness";
import { explainProtocolError } from "@/lib/protocol/errors";
import { StateChip } from "@/components/protocol-state";

export function CredentialWitnessImporter() {
  const wallet = useWalletNetwork();
  const credential = useDemoCredential();
  const { witness, setWitness } = useDemoWitness();
  const [message, setMessage] = useState("");

  async function importFile(file?: File) {
    if (!file) return;
    setMessage("");
    try {
      const candidate = parseDemoCredentialWitness(JSON.parse(await file.text()));
      if (!wallet.address || candidate.wallet.toLowerCase() !== wallet.address.toLowerCase()) {
        throw new Error("This witness is not bound to the connected wallet.");
      }
      if (!credential.record) throw new Error("No active on-chain demo credential is available for this wallet.");
      if (credential.state !== "active") throw new Error("The current demo credential is not active.");
      if (candidate.commitment.toLowerCase() !== credential.record.commitment.toLowerCase()) {
        throw new Error("The witness commitment does not match the on-chain demo credential.");
      }
      if (candidate.policyId !== 1 || BigInt(candidate.expiresAt) !== credential.record.expiresAt) {
        throw new Error("The witness policy or expiry does not match the on-chain record.");
      }
      setWitness(candidate);
      setMessage("Witness metadata matches the current demo record. The circuit checks the private value and salt when you generate a proof.");
    } catch (error) {
      setWitness(null);
      setMessage(explainProtocolError(error));
    }
  }

  return (
    <section className="panel panel--ticks protocol-panel" aria-labelledby="witness-heading">
      <div className="protocol-panel__head">
        <h2 id="witness-heading">Private credential witness</h2>
        <StateChip state={credential.state} />
      </div>
      <p className="protocol-copy">Import the issuer-delivered JSON for this wallet. The file is read into this browser session and is not uploaded or persisted.</p>
      <p className="callout callout--demo">Project demo credentials are separate from official Dojang. The importer checks wallet, policy, expiry and commitment metadata; Noir checks the private value and salt during proof generation.</p>
      <div className="protocol-kv kv">
        <div className="kv__row"><dt>Credential</dt><dd>{credential.record ? `Version ${credential.record.version.toString()}` : credential.state === "unconfigured" ? "Registry not configured" : "No record available"}</dd></div>
        <div className="kv__row"><dt>Witness in memory</dt><dd>{witness ? "Loaded for this session" : "None"}</dd></div>
      </div>
      <label className="protocol-field" htmlFor="witness-file"><span>Credential witness JSON</span>
        <input id="witness-file" type="file" accept="application/json,.json" onChange={(event) => void importFile(event.currentTarget.files?.[0])} />
      </label>
      <ul className="protocol-list" aria-label="What happens to the witness">
        <li>Read in this browser only: no server receives it.</li>
        <li>Held in memory for this session; it is not saved anywhere.</li>
        <li>Gone when you clear it or refresh the page.</li>
      </ul>
      {witness && <p className="small muted" role="status">Witness loaded for wallet <span className="addr">{witness.wallet}</span>.</p>}
      {message && <p className="callout callout--demo" role="status" aria-live="polite">{message}</p>}
      <div className="protocol-actions">
        <button className="btn btn--secondary" type="button" onClick={() => { setWitness(null); setMessage("Witness cleared from memory."); }} disabled={!witness}>Clear witness</button>
      </div>
    </section>
  );
}
