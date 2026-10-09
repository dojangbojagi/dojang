"use client";

import { useState } from "react";
import { useDemoWitness } from "@/components/witness-context";
import { useDemoCredential } from "@/hooks/use-demo-credential";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { parseDemoCredentialWitness } from "@/lib/credential/witness";
import { explainProtocolError } from "@/lib/protocol/errors";

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
    <section className="panel" aria-labelledby="witness-heading">
      <div className="panel-heading">
        <h2 id="witness-heading">Project demo credential</h2>
        <span className="status-chip status-chip--demo">Separate from official Dojang</span>
      </div>
      <p>Import the issuer-delivered witness JSON. The file is read into memory for this browser session and is not uploaded or persisted.</p>
      <p className="muted">The importer checks wallet, policy, expiry and commitment metadata against the configured on-chain registry. The Noir circuit checks the private value and salt during proof generation.</p>
      <label className="file-input-label" htmlFor="witness-file">Credential witness JSON</label>
      <input id="witness-file" type="file" accept="application/json,.json" onChange={(event) => void importFile(event.currentTarget.files?.[0])} />
      {witness && <p role="status">Witness loaded in memory for {witness.wallet}.</p>}
      {message && <p role="status">{message}</p>}
      <button className="button button--quiet" type="button" onClick={() => { setWitness(null); setMessage("Witness cleared from memory."); }} disabled={!witness}>
        Clear witness
      </button>
    </section>
  );
}
