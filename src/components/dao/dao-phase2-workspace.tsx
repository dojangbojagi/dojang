"use client";

import { useEffect, useMemo, useState } from "react";
import { WitnessUpload, type WitnessUploadStatus } from "@/components/lending-v2/v2-witness-upload";
import { useRobinhoodDaoPhase2, type Phase2Vote } from "@/hooks/use-robinhood-dao-phase2";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { useProtocolNetworkSelection } from "@/components/protocol-network-selection";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/config/robinhood-testnet";
import { getDaoPhase2ContractSet } from "@/lib/config/network-registry";
import { isCredentialWitnessForChain, parseCredentialWitnessJson, type DemoCredentialWitness } from "@/lib/credential/witness";
import { computeEligibilityCommitment } from "@/lib/zk/commitment";
import { parsePhase2Ballot } from "@/lib/governance/phase2-ballot";
import type { Phase2BallotSecret } from "@/lib/governance/phase2-types";

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
  const { selectedChainId } = useProtocolNetworkSelection();
  const wallet = useWalletNetwork(selectedChainId);
  const [selectedIdText, setSelectedIdText] = useState("");
  const selectedId = useMemo(() => /^[1-9][0-9]*$/.test(selectedIdText) ? BigInt(selectedIdText) : undefined, [selectedIdText]);
  const dao = useRobinhoodDaoPhase2(selectedId, selectedChainId);
  const snapshot = dao.snapshot;
  const [witness, setWitness] = useState<DemoCredentialWitness>();
  const [witnessStatus, setWitnessStatus] = useState<WitnessUploadStatus>("idle");
  const [witnessFileName, setWitnessFileName] = useState("");
  const [witnessMessage, setWitnessMessage] = useState("");
  const [ballot, setBallot] = useState<Phase2BallotSecret>();
  const [ballotStatus, setBallotStatus] = useState<WitnessUploadStatus>("idle");
  const [ballotFileName, setBallotFileName] = useState("");
  const [ballotMessage, setBallotMessage] = useState("");
  const [message, setMessage] = useState("");
  const [contentReference, setContentReference] = useState("");
  const [proposedThreshold, setProposedThreshold] = useState("3");
  const [vote, setVote] = useState<Phase2Vote>("for");
  const [busy, setBusy] = useState(false);
  const isTestnet = selectedChainId === ROBINHOOD_TESTNET_CHAIN_ID;
  const networkName = isTestnet ? "Robinhood Testnet" : "Robinhood Mainnet";

  useEffect(() => {
    setWitness(undefined);
    setWitnessStatus("idle");
    setWitnessFileName("");
    setWitnessMessage("");
    setBallot(undefined);
    setBallotStatus("idle");
    setBallotFileName("");
    setBallotMessage("");
    dao.clearProof();
  }, [dao.clearProof, selectedChainId, wallet.address, wallet.chainId]);

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
    setWitness(undefined);
    dao.clearProof();
    setWitnessStatus("loading");
    setWitnessFileName(file.name);
    setWitnessMessage("");
    try {
      if (!wallet.address) throw new Error("Connect the wallet that owns this witness before importing it.");
      if (wallet.chainId !== selectedChainId) throw new Error(`Switch to ${networkName} (chain ${selectedChainId}) before checking this witness.`);
      if (dao.state !== "ready" || !snapshot) throw new Error("The Phase 2 deployment is not ready for an on-chain witness check. Refresh the DAO state and try again.");
      if (!snapshot.credentialActive || !snapshot.credential) throw new Error("This wallet needs an active project-issued Policy 5 credential before its witness can be accepted.");
      if (!snapshot.reputation?.active) throw new Error("This wallet needs an active Lending V2 reputation claim before its witness can be accepted.");
      if (
        snapshot.reputation.commitment.toLowerCase() !== snapshot.credential.commitment.toLowerCase()
          || snapshot.reputation.credentialVersion !== snapshot.credential.version
          || snapshot.reputation.expiresAt !== snapshot.credential.expiresAt
      ) throw new Error("The active Policy 5 credential and reputation claim do not match the same commitment and version.");
      const parsed = parseCredentialWitnessJson(await file.text());
      if (!isCredentialWitnessForChain(parsed, selectedChainId, "robinhood-demo-credential-v1") || parsed.policyId !== 5) {
        throw new Error("Choose the Robinhood Policy 5 reputation witness issued for DAO Phase 2.");
      }
      if (parsed.wallet.toLowerCase() !== wallet.address.toLowerCase()) {
        throw new Error("The witness is not bound to the connected wallet.");
      }
      if (
        parsed.commitment.toLowerCase() !== snapshot.credential.commitment.toLowerCase()
          || BigInt(parsed.expiresAt) !== snapshot.credential.expiresAt
      ) throw new Error("The witness commitment or expiry does not match this wallet's active on-chain Policy 5 credential.");
      if (!dao.deployment?.governance) throw new Error("The selected Phase 2 governance address is not configured.");
      const recomputedCommitment = await computeEligibilityCommitment({
        subject: wallet.address,
        privateValue: parsed.privateValue,
        salt: parsed.salt,
        policyId: 5n,
        policyVersion: 1n,
        threshold: snapshot.minimumReputation,
        credentialVersion: snapshot.credential.version,
        expiresAt: snapshot.credential.expiresAt,
        chainId: BigInt(selectedChainId),
        vault: dao.deployment.governance,
      });
      if (
        recomputedCommitment.toLowerCase() !== parsed.commitment.toLowerCase()
          || recomputedCommitment.toLowerCase() !== snapshot.credential.commitment.toLowerCase()
      ) throw new Error("The witness score and salt do not match the active commitment for this wallet, chain, policy, version, and DAO contract.");
      setWitness(parsed);
      setWitnessStatus("loaded");
      setWitnessMessage(`Wallet, policy version, credential version, commitment, expiry, chain, and DAO address match the active ${networkName} records. Private values were checked locally and remain in browser memory.`);
    } catch (error) {
      setWitness(undefined);
      setWitnessStatus("invalid");
      setWitnessMessage(error instanceof Error ? error.message : "The witness file is invalid.");
    }
  }

  function rejectWitness(_file: File, reason: string) {
    setWitness(undefined);
    dao.clearProof();
    setWitnessStatus("invalid");
    setWitnessMessage(reason);
  }

  async function importBallot(file?: File) {
    if (!file) return;
    setBallot(undefined);
    setBallotStatus("loading");
    setBallotFileName(file.name);
    setBallotMessage("");
    try {
      if (!wallet.address) throw new Error("Connect the wallet that created this ballot before importing its reveal file.");
      if (wallet.chainId !== selectedChainId) throw new Error(`Switch to ${networkName} (chain ${selectedChainId}) before checking this ballot.`);
      if (dao.state !== "ready") throw new Error(`The ${networkName} Phase 2 contracts are not ready for a ballot check.`);
      const parsed = parsePhase2Ballot(JSON.parse(await file.text()), selectedChainId);
      const governance = getDaoPhase2ContractSet(selectedChainId)?.governance;
      if (!governance || parsed.governance.toLowerCase() !== governance.toLowerCase()) {
        throw new Error("This reveal file belongs to a different DAO contract.");
      }
      if (parsed.voter.toLowerCase() !== wallet.address.toLowerCase()) {
        throw new Error("This reveal file belongs to a different wallet.");
      }
      setBallot(parsed);
      setBallotStatus("loaded");
      setSelectedIdText(parsed.proposalId);
      setBallotMessage("Ballot file matches this wallet, chain, and DAO. Its private salt stays in browser memory. Check the on-chain reveal window before signing.");
    } catch (error) {
      setBallot(undefined);
      setBallotStatus("invalid");
      setBallotMessage(error instanceof Error ? error.message : "The ballot reveal file is invalid.");
    }
  }

  function rejectBallot(_file: File, reason: string) {
    setBallot(undefined);
    setBallotStatus("invalid");
    setBallotMessage(reason);
  }

  const proposal = snapshot?.proposal;
  const connectionUnavailable = dao.state !== "ready" || !wallet.address || wallet.chainId !== selectedChainId;
  const riskIncreasingUnavailable = connectionUnavailable || Boolean(snapshot?.paused);
  const memberUnavailable = riskIncreasingUnavailable || !snapshot?.membership?.active;
  const witnessControlDisabledReason = !wallet.address
      ? "Connect the wallet that owns the Policy 5 credential first."
      : wallet.chainId !== selectedChainId
        ? `Switch to ${networkName} (chain ${selectedChainId}) before importing and checking this witness.`
        : dao.state !== "ready"
          ? `Wait for the ${networkName} Phase 2 contract and eligibility reads to finish before importing.`
          : undefined;
  const proofPrerequisite = !wallet.address
      ? "Connect the wallet that owns the Policy 5 credential."
      : wallet.chainId !== selectedChainId
        ? `Switch to ${networkName} (chain ${selectedChainId}) to generate this proof.`
        : dao.state === "checking"
          ? "Checking the Phase 2 contracts and this wallet's on-chain records."
          : dao.state === "read-error"
            ? `The ${networkName} state read failed. Refresh the on-chain status before generating a proof.`
            : dao.state !== "ready"
              ? "The Phase 2 deployment or its dependencies are not ready. Check the deployment status above."
              : snapshot?.paused
                ? "Governance is paused. Membership actions are unavailable until an authorized admin unpauses it."
                : snapshot?.reputationPaused && !snapshot.reputation?.active
                  ? "The reputation registry is paused, so the authorized issuer cannot record a claim for this wallet yet."
                : !snapshot?.credentialActive
                  ? "This wallet needs an active project-issued Policy 5 credential. Ask the authorized issuer; the app cannot issue one."
                  : !snapshot.reputation?.active
                    ? "This wallet needs an active Lending V2 reputation claim from the authorized issuer."
                    : snapshot.reputation.commitment.toLowerCase() !== snapshot.credential?.commitment.toLowerCase()
                      || snapshot.reputation.credentialVersion !== snapshot.credential?.version
                      || snapshot.reputation.expiresAt !== snapshot.credential?.expiresAt
                      ? "The active credential and reputation claim do not match the same commitment, version, and expiry. Contact the authorized issuer."
                      : witnessStatus !== "loaded" || !witness
                        ? "Import the matching Policy 5 witness delivered by the authorized issuer. The file stays in this browser."
                        : undefined;

  return (
    <section className="panel panel--ticks protocol-panel" aria-labelledby="dao-phase2-heading">
      <div className="protocol-panel__head">
        <div>
          <p className="eyebrow">Reputation-Gated Governance · Phase 2</p>
          <h2 id="dao-phase2-heading">Prove reputation, then commit a protected ballot.</h2>
        </div>
        <span className="chip">{dao.state === "ready"
          ? isTestnet
            ? snapshot?.paused ? "GOVERNANCE PAUSED" : "TESTNET INTERACTIVE"
            : snapshot?.paused || snapshot?.reputationPaused ? `MAINNET PAUSED · GOV ${snapshot?.paused ? "PAUSED" : "ACTIVE"} / REP ${snapshot?.reputationPaused ? "PAUSED" : "ACTIVE"}` : "MAINNET CONTROLLED DEMO"
          : dao.state.toUpperCase().replaceAll("-", " ")}</span>
      </div>
      <p className="protocol-copy">
        Policy 5 proves a private reputation score derived by an authorized issuer from canonical Lending V2 events.
        The proof reveals the wallet, credential metadata, threshold, chain, and DAO address. It does not reveal the score or salt.
      </p>
      <p className="callout callout--demo">
        Ballot privacy is temporary: the commitment hides your choice during the commit window. The reveal transaction later makes the choice public and linkable to your wallet. This is not anonymous voting.
      </p>

      <div className="dao-phase2-network__meta">
        <span>App network: {networkName} · chain {selectedChainId}</span>
        <span>Wallet network: {wallet.chainId === undefined ? "Not connected or unverified" : `${wallet.chainId} · ${wallet.chainId === selectedChainId ? "matches app network" : "different from app network"}`}</span>
        {wallet.address && <span className="addr">{wallet.address}</span>}
        <button className="btn btn--secondary btn--sm" type="button" onClick={() => void dao.refresh()} disabled={dao.state === "checking" || dao.state === "deployment-pending" || dao.state === "unconfigured"}>
          Check on-chain status again
        </button>
      </div>

      {dao.state === "unconfigured" && (
        <p className="callout">Phase 2 has not been configured from confirmed deployment receipts.</p>
      )}
      {dao.state === "deployment-pending" && (
        <p className="callout">Mainnet Phase 2 addresses are not configured for this build, so this page cannot verify the deployed contracts. This does not mean they are undeployed. Add the receipt-verified Mainnet addresses; transactions remain unavailable until live code and dependencies check out.</p>
      )}
      {!isTestnet && <p className="callout callout--demo">Mainnet Phase 2 uses project-issued credentials and synthetic Lending evidence. It is not official GIWA or Upbit verification and is not public production credit infrastructure.</p>}
      {dao.state === "no-code" && <p className="callout">No contract bytecode exists at one or more configured Phase 2 addresses.</p>}
      {dao.state === "dependency-mismatch" && <p className="callout">The configured Phase 2 contracts do not reference the expected credential, verifier, reputation, and Lending V2 contracts.</p>}
      {dao.state === "read-error" && <p className="callout">The {networkName} RPC or one of the configured Phase 2 contract reads failed. Check the network configuration and try the read again.</p>}

      <details className="protocol-notice">
        <summary>Phase 2 contract configuration</summary>
        <p className="small muted">These are the build-time addresses selected for {networkName}; the page verifies code and dependencies before reporting wallet eligibility.</p>
        <dl className="kv protocol-kv">
          <div className="kv__row"><dt>Governance</dt><dd className="addr">{dao.deployment?.governance ?? "Not configured"}</dd></div>
          <div className="kv__row"><dt>Reputation registry</dt><dd className="addr">{dao.deployment?.reputationRegistry ?? "Not configured"}</dd></div>
          <div className="kv__row"><dt>Credential registry</dt><dd className="addr">{dao.deployment?.credentialRegistry ?? "Not configured"}</dd></div>
          <div className="kv__row"><dt>Proof verifier</dt><dd className="addr">{dao.deployment?.verifier ?? "Not configured"}</dd></div>
          <div className="kv__row"><dt>Lending evidence source</dt><dd className="addr">{dao.deployment?.lendingPool ?? "Not configured"}</dd></div>
        </dl>
      </details>

      <dl className="protocol-kv kv">
        <div className="kv__row"><dt>Connected wallet</dt><dd className="addr">{wallet.address ?? "Not connected"}</dd></div>
        <div className="kv__row"><dt>Policy 5 credential · {networkName}</dt><dd>{!wallet.address ? "Connect a wallet to check" : dao.state === "checking" ? "Checking on-chain status…" : dao.state !== "ready" ? "Unavailable until contract reads succeed" : snapshot?.credentialActive ? `Active · version ${snapshot.credential?.version}` : "No active Policy 5 credential found"}</dd></div>
        <div className="kv__row"><dt>Lending reputation claim · {networkName}</dt><dd>{!wallet.address ? "Connect a wallet to check" : dao.state === "checking" ? "Checking on-chain status…" : dao.state !== "ready" ? "Unavailable until contract reads succeed" : snapshot?.reputation?.active ? `Active · evidence ${snapshot.reputation.evidenceHash.slice(0, 10)}…` : "No active reputation claim found"}</dd></div>
        <div className="kv__row"><dt>Proof-backed membership · {networkName}</dt><dd>{!wallet.address ? "Connect a wallet to check" : dao.state === "checking" ? "Checking on-chain status…" : dao.state !== "ready" ? "Unavailable until contract reads succeed" : snapshot?.membership?.active ? "Active" : snapshot?.membership ? "Registration is stale" : "Not registered"}</dd></div>
        {!isTestnet && <>
          <div className="kv__row"><dt>Governance</dt><dd>{dao.state !== "ready" ? "Unavailable until contract reads succeed" : snapshot?.paused ? "Paused; proposals and ballots are disabled" : "Active"}</dd></div>
          <div className="kv__row"><dt>Reputation registry</dt><dd>{dao.state !== "ready" ? "Unavailable until contract reads succeed" : snapshot?.reputationPaused ? "Paused; claim issuance is disabled" : "Active"}</dd></div>
        </>}
        <div className="kv__row"><dt>Minimum private reputation</dt><dd>{snapshot?.minimumReputation.toString() ?? "—"}</dd></div>
        <div className="kv__row"><dt>Quorum</dt><dd>{snapshot?.quorum.toString() ?? "—"} revealed ballots</dd></div>
      </dl>

      <div className="protocol-stack">
        <h3>1. Establish membership</h3>
        <p className="small muted">Import the issuer-delivered Policy 5 witness. The browser generates a genuine Noir/Barretenberg proof and checks it against the deployed verifier before registration.</p>
        <WitnessUpload
          title="Import Policy 5 witness"
          idleTitle="Drop the Policy 5 witness JSON here"
          idleHint="or choose the matching witness delivered by the authorized issuer. It is checked locally and stays in this browser."
          loadedLabel="Witness verified"
          fileDescription="Policy 5 witness"
          disabled={Boolean(witnessControlDisabledReason) || busy || witnessStatus === "loading"}
          disabledReason={witnessControlDisabledReason}
          fileName={witnessFileName}
          status={witnessStatus}
          message={witnessMessage}
          loadedFor={witness?.wallet}
          onFile={(file) => void importWitness(file)}
          onRejected={rejectWitness}
          onRemove={() => { setWitness(undefined); setWitnessStatus("idle"); setWitnessFileName(""); setWitnessMessage(""); dao.clearProof(); }}
        />
        <div className="protocol-actions">
          <button className="btn btn--secondary" type="button" disabled={busy || Boolean(proofPrerequisite)} onClick={() => void run(() => dao.generateMembershipProof(witness!), "The genuine Policy 5 proof passed local and deployed-verifier checks.")}>Generate Reputation Proof</button>
          <button className="btn btn--primary" type="button" disabled={busy || riskIncreasingUnavailable || !dao.proof || Boolean(snapshot?.membership?.active)} onClick={() => void run(() => dao.registerMembership(), `Phase 2 membership was confirmed on ${networkName}.`)}>Register Membership</button>
        </div>
        {proofPrerequisite && <p className="small muted" role="status">{proofPrerequisite}</p>}
        {dao.proof && <p className="small muted" role="status">Proof generated for chain {dao.proof.publicContext.chainId.toString()} and the selected DAO contract. Local and deployed-verifier checks passed; no private score or salt is displayed.</p>}
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
            if (saved) {
              setBallot(saved);
              setBallotStatus("loaded");
              setBallotFileName(`gyevo-phase2-proposal-${saved.proposalId}-reveal.json`);
              setBallotMessage("Reveal file saved to your device and kept in browser memory. Keep its private salt secret until the reveal window.");
              downloadBallot(saved);
            }
          }, "The sealed ballot was confirmed. Keep the downloaded reveal file private until the reveal window.")}>Commit Vote</button>
          <button className="btn btn--secondary" type="button" disabled={!ballot} onClick={() => ballot && downloadBallot(ballot)}>Download Reveal File</button>
        </div>
        <WitnessUpload
          title="Import ballot reveal file"
          idleTitle="Drop the reveal JSON here"
          idleHint="or choose the ballot file saved after your commit transaction. Its salt stays in this browser."
          loadedLabel="Reveal file ready"
          fileDescription="ballot reveal file"
          disabled={busy || !wallet.address || wallet.chainId !== selectedChainId || dao.state !== "ready"}
          disabledReason={!wallet.address ? "Connect the wallet that created the ballot." : wallet.chainId !== selectedChainId ? `Switch to ${networkName} (chain ${selectedChainId}) first.` : `Wait for ${networkName} contract checks to finish.`}
          fileName={ballotFileName}
          status={ballotStatus}
          message={ballotMessage}
          loadedFor={ballot?.voter}
          onFile={(file) => void importBallot(file)}
          onRejected={rejectBallot}
          onRemove={() => { setBallot(undefined); setBallotStatus("idle"); setBallotFileName(""); setBallotMessage(""); }}
        />
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
