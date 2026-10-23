"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useReadContract } from "wagmi";
import { isAddress } from "viem";
import { formatAmount, shortAddress } from "@/components/lending/format";
import { Chip, type Tone } from "@/components/lending-v2/v2-parts";
import { dateTimeText } from "@/components/lending-v2/v2-format";
import type { V2Market, V2Proof } from "@/components/lending-v2/v2-types";
import { WitnessUpload } from "@/components/lending-v2/v2-witness-upload";
import { TransactionSummary } from "@/components/protocol-state";
import { useLendingV2CredentialIssuance } from "@/hooks/use-lending-v2-credential-issuance";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/config/robinhood-testnet";
import { ROBINHOOD_MAINNET_CHAIN_ID } from "@/lib/config/robinhood-mainnet-demo";
import { credentialIssuerRoleAbi } from "@/lib/contracts/abis";
import { credentialDownloadFilename, isCredentialWitnessForChain, parseCredentialWitnessJson, summarizeCredentialWitness, type DemoCredentialWitness } from "@/lib/credential/witness";
import { LENDING_V2_ELIGIBILITY_THRESHOLD, LENDING_V2_POLICY_ID } from "@/lib/lending/v2-config";
import { mapLendingV2Error } from "@/lib/lending/v2-errors";
import { explainProtocolError } from "@/lib/protocol/errors";

const PROOF_COPY: Record<V2Proof["state"], { tone: Tone; label: string; text: string }> = {
  unconfigured: { tone: "warn", label: "Not available", text: "Lending V2 is not configured, so there is no policy-3 registry to check against." },
  disconnected: { tone: "neutral", label: "Wallet needed", text: "Connect a wallet to check its GYEVO Project Credential." },
  "wrong-network": { tone: "warn", label: "Switch network", text: "This action requires Robinhood Chain Testnet (chain 46630). Switch networks to continue." },
  checking: { tone: "pending", label: "Checking", text: "Reading the policy-3 credential from the registry…" },
  unavailable: { tone: "warn", label: "Not available", text: "The configured address is not a compatible Lending V2 deployment." },
  "read-error": { tone: "invalid", label: "Unable to check", text: "The credential could not be read. This does not mean the wallet has none; try again in a moment." },
  "credential-required": { tone: "neutral", label: "Credential not found", text: "No active GYEVO Policy 3 Project Credential is registered for this wallet. The authorized project issuer must issue one and provide its matching private witness." },
  "credential-expired": { tone: "warn", label: "Expired", text: "The credential has expired. New supply, collateral activation and borrowing are blocked. Repaying and withdrawing stay available." },
  "credential-revoked": { tone: "invalid", label: "Revoked", text: "The project issuer revoked this credential. New supply, collateral activation and borrowing are blocked. Repaying and withdrawing stay available." },
  "credential-not-yet-valid": { tone: "warn", label: "Not yet valid", text: "The credential's start time has not been reached." },
  "issuer-untrusted": { tone: "warn", label: "Issuer not authorized", text: "The credential's issuer no longer holds the registry issuer role, so the pool would reject it." },
  "verifier-unavailable": { tone: "warn", label: "Verifier unavailable", text: "The proof passed locally, but the deployed verifier could not be reached. It is not marked ready." },
  "witness-required": { tone: "demo", label: "Action required", text: "A credential is on record. Import the private witness your issuer delivered so a proof can be built in this browser." },
  "witness-mismatch": { tone: "invalid", label: "Witness mismatch", text: "The imported witness does not match the active credential for this wallet." },
  "ready-to-prove": { tone: "demo", label: "Ready to prove", text: "Ready. The proof is built in this browser and can take a while; the private value never leaves this device." },
  generating: { tone: "pending", label: "Verifying", text: "Generating the proof in your browser and checking it with the deployed verifier. Keep this tab open." },
  "proof-ready": { tone: "valid", label: "Proof ready", text: "The proof passed local verification and the deployed Robinhood Lending verifier adapter. No transaction has been submitted." },
  invalid: { tone: "invalid", label: "Proof failed", text: "The witness, credential or proof does not satisfy the V2 policy." },
};

function IssuerTools({ market, onIssued }: { market: V2Market; onIssued: (witness: DemoCredentialWitness) => void }) {
  const wallet = useWalletNetwork(market.chainId);
  const issuance = useLendingV2CredentialIssuance(market.chainId);
  const [recipient, setRecipient] = useState("");
  const [privateValue, setPrivateValue] = useState("");
  const [expiresAt, setExpiresAt] = useState(() => {
    const date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => setRecipient(wallet.address ?? ""), [wallet.address]);
  const validValue = /^(0|[1-9][0-9]*)$/.test(privateValue) && BigInt(privateValue || "0") >= LENDING_V2_ELIGIBILITY_THRESHOLD;
  const expiresMs = Date.parse(expiresAt);
  const validExpiry = Number.isFinite(expiresMs) && Math.floor(expiresMs / 1000) > Math.floor(Date.now() / 1000);
  const canIssue = Boolean(wallet.address && wallet.isOnExpectedNetwork && market.readAvailable && isAddress(recipient) && validValue && validExpiry && !issuance.isSubmitting);

  async function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (!wallet.address || !canIssue) return;
    try {
      const witness = await issuance.issueCredential({ wallet: recipient as `0x${string}`, privateValue, expiresAt: BigInt(Math.floor(expiresMs / 1000)) });
      if (recipient.toLowerCase() === wallet.address.toLowerCase()) {
        onIssued(witness);
        setMessage("The credential is confirmed. Its matching witness remains in this browser session.");
      } else {
        const blob = new Blob([JSON.stringify(witness, null, 2) + "\n"], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = credentialDownloadFilename(Number(LENDING_V2_POLICY_ID));
        anchor.click();
        URL.revokeObjectURL(url);
        setMessage("The on-chain credential is confirmed. A private witness file was downloaded for secure delivery to the recipient; treat that file as a secret.");
      }
      setPrivateValue("");
    } catch (cause) {
      setError(cause instanceof Error && "code" in cause ? explainProtocolError(cause) : mapLendingV2Error(cause).message);
    }
  }

  return (
    <details className="lend-issuer">
      <summary className="protocol-inline-link">Project issuer tools: issue a Policy 3 credential</summary>
      <div className="lend-issuer__body">
        <p className="small muted">
          Shown only because this wallet holds the project registry&apos;s issuer role. It issues a policy {LENDING_V2_POLICY_ID.toString()} <strong>GYEVO Project Credential</strong>,
          bound to the selected {market.networkName} Lending V2 pool. It is a project-issued credential, not official GIWA, Dojang or Upbit verification. The registry stores a commitment only; the private value and salt stay in this browser.
        </p>
        <form className="protocol-form" onSubmit={(event) => void issue(event)}>
          <div className="protocol-form__grid">
            <label className="protocol-field" htmlFor="lendv2-recipient"><span>Recipient wallet</span>
              <input id="lendv2-recipient" type="text" autoComplete="off" spellCheck={false} value={recipient} onChange={(event) => setRecipient(event.currentTarget.value.trim())} />
            </label>
            <label className="protocol-field" htmlFor="lendv2-private-value"><span>Private eligibility value</span>
              <input id="lendv2-private-value" type="password" inputMode="numeric" autoComplete="off" value={privateValue} onChange={(event) => setPrivateValue(event.currentTarget.value)} />
            </label>
            <label className="protocol-field" htmlFor="lendv2-expiry"><span>Credential expiry</span>
              <input id="lendv2-expiry" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.currentTarget.value)} />
            </label>
          </div>
          <p className="xsmall muted">At least {LENDING_V2_ELIGIBILITY_THRESHOLD.toString()} test units. This is not a currency amount and is never sent to the registry.</p>
          <div className="protocol-actions">
            <button className="btn btn--secondary" type="submit" disabled={!canIssue}>{issuance.isSubmitting ? "Issuing credential…" : "Issue to recipient"}</button>
          </div>
        </form>
        <TransactionSummary lifecycle={issuance.transaction} />
        {error && <p className="callout callout--caution protocol-notice" role="alert">{error}</p>}
        {message && <p className="callout callout--demo protocol-notice" role="status" aria-live="polite">{message}</p>}
      </div>
    </details>
  );
}

/**
 * Eligibility, kept honest: Robinhood Lending uses a project-issued Policy 3 credential, not official GIWA Dojang.
 * A proof is "verified locally" until the pool verifies it again inside a transaction.
 */
export function EligibilityCard({ market, proof, witness, onWitness }: {
  market: V2Market;
  proof: V2Proof;
  witness: DemoCredentialWitness | null;
  onWitness: (witness: DemoCredentialWitness | null) => void;
}) {
  const wallet = useWalletNetwork(market.chainId);
  const [importMessage, setImportMessage] = useState("");
  const [importFailed, setImportFailed] = useState(false); /* presentation only: the picker shows the last attempt */
  const [witnessFile, setWitnessFile] = useState("");
  const [importing, setImporting] = useState(false);
  const [proofMessage, setProofMessage] = useState("");
  const registry = market.snapshot?.credentialRegistry;
  const role = useReadContract({
    address: registry,
    chainId: market.chainId,
    abi: credentialIssuerRoleAbi,
    functionName: "ISSUER_ROLE",
    query: { enabled: Boolean(registry && wallet.address), retry: 1 },
  });
  const isIssuer = useReadContract({
    address: registry,
    chainId: market.chainId,
    abi: credentialIssuerRoleAbi,
    functionName: "hasRole",
    args: role.data && wallet.address ? [role.data, wallet.address] : undefined,
    query: { enabled: Boolean(registry && wallet.address && role.data), retry: 1 },
  });

  useEffect(() => {
    setWitnessFile("");
    setImportMessage("");
    setImportFailed(false);
    setImporting(false);
  }, [wallet.address]);

  const copy = proof.state === "wrong-network"
    ? { ...PROOF_COPY[proof.state], text: `This action requires ${market.networkName} (chain ${market.chainId}). Switch networks to continue.` }
    : PROOF_COPY[proof.state];
  const record = proof.credential;
  const witnessSummary = witness ? summarizeCredentialWitness(witness, market.networkName, Boolean(wallet.address && witness.wallet.toLowerCase() === wallet.address.toLowerCase())) : undefined;
  const canProve = (proof.state === "ready-to-prove" || proof.state === "proof-ready") && !market.isSubmitting;
  const proofBytes = proof.proof ? (proof.proof.proof.length - 2) / 2 : 0;

  async function importWitness(file?: File) {
    if (!file) return;
    setImportMessage("");
    setImportFailed(false);
    setWitnessFile(file.name);
    setImporting(true);
    try {
      const candidate = parseCredentialWitnessJson(await file.text());
      if (!isCredentialWitnessForChain(candidate, market.chainId, "robinhood-demo-credential-v1")) {
        throw new Error(`This credential file is not for ${market.networkName} (chain ${market.chainId}).`);
      }
      if (!wallet.address || candidate.wallet.toLowerCase() !== wallet.address.toLowerCase()) throw new Error("This witness is not bound to the connected wallet.");
      if (candidate.policyId !== Number(LENDING_V2_POLICY_ID)) {
        throw new Error(`This witness belongs to policy ${candidate.policyId}. Lending V2 uses policy ${LENDING_V2_POLICY_ID.toString()}; a V1 (policy 2) witness cannot authorize V2.`);
      }
      if (!record) throw new Error("There is no active policy-3 credential on record for this wallet to match.");
      if (candidate.commitment.toLowerCase() !== record.commitment.toLowerCase()) throw new Error("The witness commitment does not match the credential on record.");
      if (BigInt(candidate.expiresAt) !== record.expiresAt) throw new Error("The witness expiry does not match the credential on record.");
      onWitness(candidate);
      setImportMessage("The witness metadata matches the credential on record. The circuit checks the private value and salt when the proof is generated.");
    } catch (cause) {
      onWitness(null);
      setImportFailed(true);
      setImportMessage(cause instanceof SyntaxError ? "That file is not valid JSON." : cause instanceof Error && !("code" in cause) ? cause.message : explainProtocolError(cause));
    } finally {
      setImporting(false);
    }
  }

  async function generate() {
    setProofMessage("");
    try {
      await proof.generateProof();
      setProofMessage("Proof generated, verified locally, and accepted by the deployed Robinhood Lending verifier adapter. This was a read-only check; no transaction was submitted.");
    } catch (cause) {
      setProofMessage(explainProtocolError(cause));
    }
  }

  return (
    <section className="panel panel--ticks protocol-panel lendv2-eligibility" id="lendv2-eligibility" aria-labelledby="lendv2-eligibility-heading">
      <div className="protocol-panel__head">
        <h2 id="lendv2-eligibility-heading">Eligibility</h2>
        <Chip tone={copy.tone}>{copy.label}</Chip>
      </div>
      <p className={`callout ${copy.tone === "invalid" || copy.tone === "warn" ? "callout--caution" : "callout--demo"}`} role="status" aria-live="polite">
        {proof.state === "invalid" && proof.error ? proof.error : copy.text}
      </p>

      <dl className="kv protocol-kv">
        <div className="kv__row">
          <dt>Lending V2 authorization</dt>
          <dd>GYEVO Project Credential, Policy {LENDING_V2_POLICY_ID.toString()}. It is project-issued; official GIWA Dojang credentials do not authorize this pool.</dd>
        </div>
        <div className="kv__row"><dt>Policy and threshold</dt><dd>Policy {LENDING_V2_POLICY_ID.toString()} · private value of at least {formatAmount(LENDING_V2_ELIGIBILITY_THRESHOLD, 0)} test units</dd></div>
        {record ? (
          <>
            <div className="kv__row"><dt>Credential</dt><dd>{proof.credentialLabel} · version {record.version.toString()}</dd></div>
            <div className="kv__row"><dt>Issuer</dt><dd className="addr">{shortAddress(record.issuer)} <span className="muted">(project issuer)</span></dd></div>
            <div className="kv__row"><dt>Issued</dt><dd>{dateTimeText(record.issuedAt)}</dd></div>
            <div className="kv__row"><dt>Expires</dt><dd>{dateTimeText(record.expiresAt)}</dd></div>
          </>
        ) : null}
        <div className="kv__row">
          <dt>Local proof check</dt>
          <dd>{proof.verificationStatus === "locally-verified" || proof.verificationStatus === "checking-deployed-verifier" || proof.verificationStatus === "deployed-verifier-accepted" || proof.verificationStatus === "deployed-verifier-rejected" || proof.verificationStatus === "deployed-verifier-unavailable" ? "Verified in this browser" : proof.state === "generating" ? "Generating…" : "Not generated"}</dd>
        </div>
        <div className="kv__row">
          <dt>Deployed verifier check</dt>
          <dd>{proof.verificationStatus === "deployed-verifier-accepted" ? "Accepted by Robinhood Lending verifier" : proof.verificationStatus === "deployed-verifier-rejected" ? "Rejected by Robinhood Lending verifier" : proof.verificationStatus === "deployed-verifier-unavailable" ? "No response; not accepted" : proof.verificationStatus === "checking-deployed-verifier" ? "Checking…" : "Not checked"}</dd>
        </div>
        {proof.proof && (
          <>
            <div className="kv__row"><dt>Proof</dt><dd>{proofBytes.toLocaleString("en-US")} bytes · {proof.proof.publicInputs.length} public inputs</dd></div>
            <div className="kv__row"><dt>Bound to</dt><dd className="addr">Lending V2 pool {shortAddress(proof.proof.publicContext.vault)}</dd></div>
            <div className="kv__row"><dt>Created</dt><dd>{new Date(proof.proof.createdAt).toLocaleString()}</dd></div>
          </>
        )}
      </dl>

      <p className="xsmall muted">
        A locally verified proof is not an on-chain verification. The pool verifies the proof again inside each supply, collateral activation and borrow transaction;
        the contract is the final authority. Repaying, withdrawing and liquidation never need a current credential.
      </p>
      <p className="xsmall muted">Generate an eligibility proof to show the lending rule is met without revealing the private test value. This requires an active Policy 3 project credential and its matching witness. <Link className="protocol-inline-link" href="/dojang">Check project credential status</Link>.</p>

      {(proof.state === "credential-required" || proof.state === "witness-required" || proof.state === "witness-mismatch") && (
        <details className="lendv2-privacy">
          <summary className="protocol-inline-link">How to get a matching Policy 3 credential and witness</summary>
          <div className="lendv2-privacy__body">
            <p><strong>1. Connect the recipient wallet.</strong> Check the address shown above and use {market.networkName}, chain {market.chainId}. The credential and witness are bound to that exact address and the deployed Lending V2 pool.</p>
            <p><strong>2. Request a Policy 3 GYEVO Project Credential.</strong> Give that address to a GYEVO project issuer. A regular wallet cannot issue its own credential. The issuer&apos;s hidden local input is test eligibility data (at least 1,000 units), not an official Dojang balance, KYC result, or exchange asset.</p>
            <p><strong>3. Receive the matching JSON privately.</strong> The issuer creates the witness locally, simulates the registry call, and issues only the public commitment after the required owner authorization. Ask the issuer to deliver the resulting `.json` file directly to the recipient; do not post it in a public channel or upload it to a third-party site.</p>
            <p><strong>4. Import it here and generate the proof.</strong> This page checks the wallet, policy, commitment, and expiry before using the witness in the browser. The proof is locally verified first; the contract verifies it again when a protected action is submitted. The witness stays in browser memory for this session and is cleared when removed or when the tab closes.</p>
            {market.chainId === ROBINHOOD_TESTNET_CHAIN_ID && <p>For a Testnet project operator, the guarded preparation command is <code>bun run robinhood:bootstrap prepare-lending &lt;recipient-wallet&gt; &lt;expiry-days&gt; ~/.local/share/gyevo-witnesses/&lt;recipient&gt;-policy3.json</code>. It writes a mode-0600 witness and runs a no-broadcast issuance simulation. The follow-up <code>issue-lending &lt;witness-file&gt;</code> simulates by default; a public issuance needs separate owner authorization.</p>}
            {market.chainId === ROBINHOOD_MAINNET_CHAIN_ID && <p><strong>Mainnet is separate.</strong> Use only the Mainnet authorized issuer and the dedicated guarded Mainnet operator workflow. Never reuse Testnet witnesses, credentials, or evidence.</p>}
            <p><strong>DAO Policy 4 is separate.</strong> It needs an issuer-backed project credential but no ZK witness. Neither project policy is an official GIWA Dojang credential.</p>
          </div>
        </details>
      )}

      <WitnessUpload
        disabled={!record || proof.state === "generating" || importing}
        disabledReason={!record ? "A policy-3 credential has to be on record for this wallet before a witness can be imported." : "Wait for the proof to finish."}
        fileName={witnessFile}
        status={importing ? "loading" : witness ? "loaded" : importFailed ? "invalid" : "idle"}
        message={importMessage || (importing ? "Reading and checking witness metadata in this browser…" : "")}
        loadedFor={witnessSummary?.walletAssociation === "matches-connected-wallet" ? "connected wallet" : undefined}
        onFile={(file) => void importWitness(file)}
        onRejected={(file, reason) => { onWitness(null); setWitnessFile(file.name); setImportFailed(true); setImportMessage(reason); }}
        onRemove={() => { onWitness(null); setImportFailed(false); setWitnessFile(""); setImportMessage("Witness cleared from memory."); }}
      />

      {witnessSummary && <p className="xsmall muted" role="status">Policy {witnessSummary.policyId} · {witnessSummary.networkName} (chain {witnessSummary.chainId ?? market.chainId}) · expires {new Date(witnessSummary.expiresAt * 1_000).toLocaleString()} · {witnessSummary.walletAssociation === "matches-connected-wallet" ? "wallet association confirmed" : "wallet changed; re-import to check"}. Private fields are hidden.</p>}

      <div className="protocol-actions">
        <button className="btn btn--primary" type="button" onClick={() => void generate()} disabled={!canProve}>
          {proof.state === "generating" ? "Generating proof…" : proof.state === "proof-ready" ? "Generate a New Eligibility Proof" : "Generate Eligibility Proof"}
        </button>
        <button className="btn btn--secondary" type="button" onClick={() => { onWitness(null); setImportFailed(false); setWitnessFile(""); setImportMessage("Witness cleared from memory."); }} disabled={!witness}>Clear witness</button>
        <button className="btn btn--secondary" type="button" onClick={() => void proof.refetchCredential()} disabled={!record && proof.state !== "credential-required"}>Check Credential Again</button>
      </div>
      <p className="xsmall muted">Checking again refreshes this wallet&apos;s credential status from the blockchain. It does not issue or renew a credential.</p>
      {proofMessage && proof.state !== "invalid" && <p className="small" role="status" aria-live="polite">{proofMessage}</p>}

      <details className="lendv2-privacy">
        <summary className="protocol-inline-link">What stays private?</summary>
        <div className="lendv2-privacy__body">
          <p><strong>Private:</strong> the eligibility value and its salt, which never leave this browser.</p>
          <p><strong>Public:</strong> your wallet address, the credential commitment, policy and threshold, credential version and expiry, the chain, the V2 pool address and the proof itself.</p>
          <p><strong>Not private:</strong> every supply, borrow, repayment, collateral and debt amount, and the fact that an eligibility-gated action happened. This is private eligibility data, not private lending.</p>
        </div>
      </details>

      {isIssuer.data === true ? (
        <IssuerTools market={market} onIssued={(issued) => { onWitness(issued); setImportFailed(false); setWitnessFile(""); setImportMessage("The new credential and its witness are ready."); void proof.refetchCredential(); }} />
      ) : (
        <p className="xsmall muted">GYEVO Project Credentials are issued only by wallets that hold the project registry&apos;s issuer role. Ordinary wallets receive a private witness file from the project issuer.</p>
      )}
    </section>
  );
}
