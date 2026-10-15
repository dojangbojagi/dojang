"use client";

import { useEffect, useMemo, useState } from "react";
import { isAddress, type Address, type Hex } from "viem";
import { useRobinhoodDaoPhase2, type Phase2Vote } from "@/hooks/use-robinhood-dao-phase2";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/config/robinhood-testnet";
import { parseDemoCredentialWitness, type DemoCredentialWitness } from "@/lib/credential/witness";
import type { Phase2BallotSecret } from "@/lib/governance/phase2-types";

function parseBallot(value: unknown): Phase2BallotSecret {
  if (!value || typeof value !== "object") throw new Error("The ballot reveal file is not a JSON object.");
  const candidate = value as Partial<Phase2BallotSecret>;
  if (
    candidate.format !== "gyevo-dao-phase2-ballot-v1" || candidate.chainId !== 46630
      || !candidate.governance || !isAddress(candidate.governance)
      || !candidate.voter || !isAddress(candidate.voter)
      || typeof candidate.proposalId !== "string" || !/^[1-9][0-9]*$/.test(candidate.proposalId)
      || ![0, 1, 2].includes(candidate.voteType as number)
      || !candidate.salt || !/^0x[0-9a-fA-F]{64}$/.test(candidate.salt)
      || !candidate.commitment || !/^0x[0-9a-fA-F]{64}$/.test(candidate.commitment)
      || !candidate.nullifier || !/^0x[0-9a-fA-F]{64}$/.test(candidate.nullifier)
  ) throw new Error("The ballot reveal file is incomplete or invalid.");
  return candidate as Phase2BallotSecret;
}

function downloadBallot(ballot: Phase2BallotSecret) {
  const blob = new Blob([`${JSON.stringify(ballot, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `gyevo-phase2-proposal-${ballot.proposalId}-reveal.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatTime(value?: bigint) {
  return value ? new Date(Number(value) * 1_000).toLocaleString() : "—";
}

export function DaoPhase2Workspace() {
  const wallet = useWalletNetwork(ROBINHOOD_TESTNET_CHAIN_ID);
  const [selectedIdText, setSelectedIdText] = useState("");
  const selectedId = useMemo(() => /^[1-9][0-9]*$/.test(selectedIdText) ? BigInt(selectedIdText) : undefined, [selectedIdText]);
  const dao = useRobinhoodDaoPhase2(selectedId);
  const [witness, setWitness] = useState<DemoCredentialWitness>();
  const [ballot, setBallot] = useState<Phase2BallotSecret>();
  const [message, setMessage] = useState("");
  const [contentReference, setContentReference] = useState("");
  const [proposedThreshold, setProposedThreshold] = useState("3");
  const [vote, setVote] = useState<Phase2Vote>("for");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!selectedIdText && dao.snapshot && dao.snapshot.nextProposalId > 1n) {
      setSelectedIdText((dao.snapshot.nextProposalId - 1n).toString());
    }
  }, [dao.snapshot, selectedIdText]);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessage(success);
      await dao.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The Phase 2 action failed without a confirmed state change.");
    } finally {
      setBusy(false);
    }
  }

  async function importWitness(file?: File) {
    if (!file) return;
    try {
      const parsed = parseDemoCredentialWitness(JSON.parse(await file.text()));
      if (parsed.format !== "robinhood-demo-credential-v1" || parsed.policyId !== 5) {
        throw new Error("Choose the Robinhood Policy 5 reputation witness issued for DAO Phase 2.");
      }
      if (!wallet.address || parsed.wallet.toLowerCase() !== wallet.address.toLowerCase()) {
        throw new Error("The witness is not bound to the connected wallet.");
      }
      setWitness(parsed);
      setMessage("Policy 5 witness loaded in browser memory. Its private score and salt have not been uploaded.");
    } catch (error) {
      setWitness(undefined);
      setMessage(error instanceof Error ? error.message : "The witness file is invalid.");
    }
  }

  async function importBallot(file?: File) {
    if (!file) return;
    try {
      const parsed = parseBallot(JSON.parse(await file.text()));
      setBallot(parsed);
      setSelectedIdText(parsed.proposalId);
      setMessage("Ballot reveal file loaded locally. Check the proposal is in its reveal window before signing.");
    } catch (error) {
      setBallot(undefined);
      setMessage(error instanceof Error ? error.message : "The ballot reveal file is invalid.");
    }
  }

  const snapshot = dao.snapshot;
  const proposal = snapshot?.proposal;
  const connectionUnavailable = dao.state !== "ready" || !wallet.address || !wallet.isRobinhoodTestnet;
  const riskIncreasingUnavailable = connectionUnavailable || Boolean(snapshot?.paused);
  const memberUnavailable = riskIncreasingUnavailable || !snapshot?.membership?.active;

  return (
    <section className="panel panel--ticks protocol-panel" aria-labelledby="dao-phase2-heading">
      <div className="protocol-panel__head">
        <div>
          <p className="eyebrow">Private Lending Council · Phase 2</p>
          <h2 id="dao-phase2-heading">Prove reputation, then commit a protected ballot.</h2>
        </div>
        <span className="chip">{dao.state === "ready" ? snapshot?.paused ? "PAUSED" : "TESTNET READY" : dao.state.toUpperCase()}</span>
      </div>
      <p className="protocol-copy">
        Policy 5 proves a private reputation score derived by an authorized issuer from canonical Lending V2 events.
        The proof reveals the wallet, credential metadata, threshold, chain, and DAO address. It does not reveal the score or salt.
      </p>
      <p className="callout callout--demo">
        Ballot privacy is temporary: the commitment hides your choice during the commit window. The reveal transaction later makes the choice public and linkable to your wallet. This is not anonymous voting.
      </p>

      {dao.state === "unconfigured" && (
        <p className="callout">Phase 2 has not been configured from confirmed deployment receipts. Phase 1 below remains available.</p>
      )}
      {dao.state === "no-code" && <p className="callout">No contract bytecode exists at one or more configured Phase 2 addresses.</p>}
      {dao.state === "dependency-mismatch" && <p className="callout">The configured Phase 2 contracts do not reference the expected credential, verifier, reputation, and Lending V2 contracts.</p>}
      {dao.state === "read-error" && <p className="callout">The Phase 2 state could not be read: {dao.error}</p>}

      <dl className="protocol-kv kv">
        <div className="kv__row"><dt>Connected wallet</dt><dd className="addr">{wallet.address ?? "Not connected"}</dd></div>
        <div className="kv__row"><dt>Policy 5 credential</dt><dd>{snapshot?.credentialActive ? `Active · version ${snapshot.credential?.version}` : "Missing or inactive"}</dd></div>
        <div className="kv__row"><dt>Lending reputation claim</dt><dd>{snapshot?.reputation?.active ? `Active · evidence ${snapshot.reputation.evidenceHash.slice(0, 10)}…` : "Missing or inactive"}</dd></div>
        <div className="kv__row"><dt>Proof-backed membership</dt><dd>{snapshot?.membership?.active ? "Active" : snapshot?.membership ? "Registration is stale" : "Not registered"}</dd></div>
        <div className="kv__row"><dt>Minimum private reputation</dt><dd>{snapshot?.minimumReputation.toString() ?? "—"}</dd></div>
        <div className="kv__row"><dt>Quorum</dt><dd>{snapshot?.quorum.toString() ?? "—"} revealed ballots</dd></div>
      </dl>

      <div className="protocol-stack">
        <h3>1. Establish membership</h3>
        <p className="small muted">Import the issuer-delivered Policy 5 witness. The browser generates a genuine Noir/Barretenberg proof and checks it against the deployed verifier before registration.</p>
        <label className="protocol-field"><span>Private Policy 5 witness</span>
          <input type="file" accept="application/json,.json" onChange={(event) => void importWitness(event.currentTarget.files?.[0])} />
        </label>
        <div className="protocol-actions">
          <button className="btn btn--secondary" type="button" disabled={busy || connectionUnavailable || !witness || !snapshot?.credentialActive || !snapshot.reputation?.active} onClick={() => void run(() => dao.generateMembershipProof(witness!), "The genuine Policy 5 proof passed local and deployed-verifier checks.")}>Generate Reputation Proof</button>
          <button className="btn btn--primary" type="button" disabled={busy || riskIncreasingUnavailable || !dao.proof || Boolean(snapshot?.membership?.active)} onClick={() => void run(() => dao.registerMembership(), "Phase 2 membership was confirmed on Robinhood Testnet.")}>Register Membership</button>
        </div>
      </div>

      <div className="protocol-stack">
        <h3>2. Create or inspect a proposal</h3>
        <label className="protocol-field"><span>Proposal content reference</span>
          <input value={contentReference} onChange={(event) => setContentReference(event.target.value)} placeholder="ipfs://… or https://…" maxLength={512} />
        </label>
        <label className="protocol-field"><span>Proposed minimum reputation</span>
          <input inputMode="numeric" value={proposedThreshold} onChange={(event) => setProposedThreshold(event.target.value)} />
        </label>
        <div className="protocol-actions">
          <button className="btn btn--primary" type="button" disabled={busy || memberUnavailable || !contentReference.trim() || !/^[1-9][0-9]*$/.test(proposedThreshold)} onClick={() => void run(async () => {
            const result = await dao.createProposal(contentReference.trim(), BigInt(proposedThreshold));
            if (result?.result) setSelectedIdText(result.result.toString());
          }, "The proposal creation receipt and state were confirmed.")}>Create Proposal</button>
        </div>
        <label className="protocol-field"><span>Proposal ID</span>
          <input inputMode="numeric" value={selectedIdText} onChange={(event) => setSelectedIdText(event.target.value)} placeholder="1" />
        </label>
        {proposal && (
          <dl className="protocol-kv kv">
            <div className="kv__row"><dt>State</dt><dd>{proposal.state}</dd></div>
            <div className="kv__row"><dt>Reference</dt><dd>{proposal.contentReference}</dd></div>
            <div className="kv__row"><dt>Commit closes</dt><dd>{formatTime(proposal.commitDeadline)}</dd></div>
            <div className="kv__row"><dt>Reveal closes</dt><dd>{formatTime(proposal.revealDeadline)}</dd></div>
            <div className="kv__row"><dt>Ballots</dt><dd>{proposal.committedVotes.toString()} committed · {proposal.forVotes.toString()} for · {proposal.againstVotes.toString()} against · {proposal.abstainVotes.toString()} abstain</dd></div>
          </dl>
        )}
      </div>

      <div className="protocol-stack">
        <h3>3. Commit, save, and reveal your ballot</h3>
        <label className="protocol-field"><span>Vote choice</span>
          <select value={vote} onChange={(event) => setVote(event.target.value as Phase2Vote)}>
            <option value="for">For</option><option value="against">Against</option><option value="abstain">Abstain</option>
          </select>
        </label>
        <div className="protocol-actions">
          <button className="btn btn--primary" type="button" disabled={busy || memberUnavailable || !selectedId || proposal?.state !== "commit" || proposal.walletCommitted} onClick={() => void run(async () => {
            const saved = await dao.commitVote(selectedId!, vote);
            if (saved) { setBallot(saved); downloadBallot(saved); }
          }, "The sealed ballot was confirmed. Keep the downloaded reveal file private until the reveal window.")}>Commit Vote</button>
          <button className="btn btn--secondary" type="button" disabled={!ballot} onClick={() => ballot && downloadBallot(ballot)}>Download Reveal File</button>
        </div>
        <label className="protocol-field"><span>Saved ballot reveal file</span>
          <input type="file" accept="application/json,.json" onChange={(event) => void importBallot(event.currentTarget.files?.[0])} />
        </label>
        <div className="protocol-actions">
          <button className="btn btn--primary" type="button" disabled={busy || connectionUnavailable || !ballot || proposal?.state !== "reveal" || proposal.walletRevealed} onClick={() => void run(() => dao.revealVote(ballot!), "The ballot reveal receipt and public tally were confirmed.")}>Reveal Vote</button>
          <button className="btn btn--secondary" type="button" disabled={busy || connectionUnavailable || !selectedId || proposal?.state === "pending" || proposal?.state === "commit" || proposal?.state === "reveal" || proposal?.finalized} onClick={() => void run(() => dao.finalizeProposal(selectedId!), "The proposal result was finalized on-chain.")}>Finalize</button>
          <button className="btn btn--secondary" type="button" disabled={busy || riskIncreasingUnavailable || !selectedId || proposal?.state !== "succeeded"} onClick={() => void run(() => dao.executeProposal(selectedId!), "The bounded reputation-threshold action was executed.")}>Execute</button>
        </div>
      </div>

      {dao.transaction.hash && <p className="small muted">Transaction: <a href={dao.transaction.explorerUrl} target="_blank" rel="noreferrer" className="addr">{dao.transaction.hash}</a> · {dao.transaction.state}</p>}
      {dao.transaction.error && <p className="callout" role="alert">{dao.transaction.error}</p>}
      {message && <p className="callout callout--demo" role="status" aria-live="polite">{message}</p>}
    </section>
  );
}
