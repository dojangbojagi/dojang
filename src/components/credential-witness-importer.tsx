"use client";

import { useState } from "react";
import { useDemoWitness } from "@/components/witness-context";
import { useDemoCredential } from "@/hooks/use-demo-credential";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { isCredentialWitnessForChain, MAX_CREDENTIAL_JSON_BYTES, parseCredentialWitnessJson, summarizeCredentialWitness } from "@/lib/credential/witness";
import { explainProtocolError } from "@/lib/protocol/errors";
import { StateChip } from "@/components/protocol-state";
import { GIWA_CHAIN_ID } from "@/lib/config/chain";

export function CredentialWitnessImporter() {
  const wallet = useWalletNetwork(GIWA_CHAIN_ID);
  const credential = useDemoCredential();
  const { witness, setWitness } = useDemoWitness();
  const [message, setMessage] = useState("");
  const witnessSummary = witness ? summarizeCredentialWitness(witness, "GIWA Sepolia", Boolean(wallet.address && witness.wallet.toLowerCase() === wallet.address.toLowerCase())) : undefined;

  async function importFile(file?: File) {
    if (!file) return;
    setMessage("");
    try {
      if (file.size > MAX_CREDENTIAL_JSON_BYTES) throw new Error("Credential file exceeds the 256 KB import limit.");
      const candidate = parseCredentialWitnessJson(await file.text());
      if (!isCredentialWitnessForChain(candidate, GIWA_CHAIN_ID, "giwa-demo-credential-v1")) {
        throw new Error("This credential is for a different network or project flow. The official GIWA Sepolia credential page accepts only its GIWA-bound witness.");
      }
      if (!wallet.address || candidate.wallet.toLowerCase() !== wallet.address.toLowerCase()) {
        throw new Error("This witness is not bound to the connected wallet.");
      }
      if (!credential.record) throw new Error("No GYEVO project credential is recorded for this wallet.");
      if (credential.state !== "active") throw new Error("The current GYEVO credential is not active.");
      if (candidate.commitment.toLowerCase() !== credential.record.commitment.toLowerCase()) {
        throw new Error("The witness commitment does not match the on-chain GYEVO credential.");
      }
      if (candidate.policyId !== 1 || BigInt(candidate.expiresAt) !== credential.record.expiresAt) {
        throw new Error("The witness policy or expiry does not match the on-chain record.");
      }
      setWitness(candidate);
      setMessage("Witness metadata matches the current GYEVO record. The private value and salt stay hidden; Noir checks them only when you generate a proof.");
    } catch (error) {
      setWitness(null);
      setMessage(explainProtocolError(error));
    }
  }

  return (
    <section className="panel panel--ticks protocol-panel" aria-labelledby="witness-heading">
      <div className="protocol-panel__head">
        <h2 id="witness-heading">Import Private Credential</h2>
        <StateChip state={credential.state} />
      </div>
      <p className="protocol-copy">Import the issuer-delivered JSON for this wallet. The file is read into this browser session and is not uploaded or persisted.</p>
      <p className="callout callout--demo">GYEVO project credentials are separate from official Dojang. This file is checked in your browser against the wallet, policy, expiry and on-chain commitment; Noir checks the private value and salt only during proof generation.</p>
      <div className="protocol-kv kv">
        <div className="kv__row"><dt>Credential</dt><dd>{credential.record ? `Version ${credential.record.version.toString()}` : credential.state === "unconfigured" ? "Registry not configured" : "No record available"}</dd></div>
        <div className="kv__row"><dt>Private credential</dt><dd>{witness ? "Loaded in this browser session" : "Not imported"}</dd></div>
      </div>
      <label className="protocol-field" htmlFor="witness-file"><span>Private credential file</span>
        <input id="witness-file" type="file" accept="application/json,.json" onChange={(event) => void importFile(event.currentTarget.files?.[0])} />
      </label>
      <ul className="protocol-list" aria-label="What happens to the witness">
        <li>Read in this browser only: no server receives it.</li>
        <li>Held in memory for this session; it is not saved anywhere.</li>
        <li>Gone when you clear it or refresh the page.</li>
      </ul>
      {witnessSummary && <p className="small muted" role="status">Policy {witnessSummary.policyId} · {witnessSummary.networkName} · {new Date(witnessSummary.expiresAt * 1_000).toLocaleString()} · {witnessSummary.walletAssociation === "matches-connected-wallet" ? "matches connected wallet" : "wallet changed; re-import to check"}. Private fields are hidden.</p>}
      {message && <p className="callout callout--demo" role="status" aria-live="polite">{message}</p>}
      <div className="protocol-actions">
        <button className="btn btn--secondary" type="button" onClick={() => { setWitness(null); setMessage("Witness cleared from memory."); }} disabled={!witness}>Clear witness</button>
      </div>
    </section>
  );
}
