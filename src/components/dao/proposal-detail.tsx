"use client";

import { LifecycleStrip, PROPOSAL_LABEL, Pill } from "@/components/dao/dao-panels";
import { formatDuration, formatTimestamp, relativeTime, shortAddress, useNowSeconds } from "@/components/dao/format";
import { ContentReference, VoteBar } from "@/components/dao/proposal-feed";
import type { GovRunner, Governance } from "@/components/dao/types";
import { useDaoProposalFeed } from "@/hooks/use-dao-proposal-feed";
import type { GovernanceProposal, GovernanceVoteType } from "@/lib/protocol/types";
import type { ProtocolChainId } from "@/hooks/use-wallet-network";
import { GIWA_CHAIN_ID } from "@/lib/config/chain";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/config/robinhood-testnet";

function networkName(chainId: ProtocolChainId) {
  return chainId === ROBINHOOD_TESTNET_CHAIN_ID ? "Robinhood Testnet" : "GIWA Sepolia";
}

const VOTES: readonly { vote: GovernanceVoteType; label: string; tone: "primary" | "secondary" }[] = [
  { vote: "for", label: "Vote For", tone: "primary" },
  { vote: "against", label: "Vote Against", tone: "secondary" },
  { vote: "abstain", label: "Abstain", tone: "secondary" },
];

/** What the contract has decided so far, in words, from the proposal's own fields. */
function Outcome({ proposal, current, quorum }: { proposal: GovernanceProposal; current?: bigint; quorum?: bigint }) {
  const total = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
  const quorumMet = quorum !== undefined ? total >= quorum : undefined;
  switch (proposal.state) {
    case "pending":
      return <p className="callout callout--demo" role="status">Created. Voting has not opened yet.</p>;
    case "active":
      return <p className="callout callout--demo" role="status">Voting is open. Approval needs quorum and more For than Against; Abstain counts toward quorum only.</p>;
    case "succeeded":
      return proposal.finalized
        ? <p className="callout callout--demo" role="status">Approved and recorded. Anyone can now execute it before the execution window closes.</p>
        : <p className="callout callout--demo" role="status">Voting has closed and the proposal would pass. Anyone can finalize it to record the outcome on-chain, then execute it.</p>;
    case "rejected":
      return (
        <p className="callout callout--caution" role="status">
          Rejected{quorumMet === false ? ": quorum was not reached" : proposal.forVotes <= proposal.againstVotes ? ": For did not beat Against" : ""}. A rejected proposal cannot be executed.
          {!proposal.finalized && " Finalizing records this outcome on-chain."}
        </p>
      );
    case "expired":
      return <p className="callout callout--caution" role="status">It was approved, but the execution window closed before anyone executed it. It can no longer take effect.</p>;
    case "executed":
      return (
        <p className="callout callout--demo" role="status">
          Executed. The governance contract&apos;s minimum remaining validity is now{" "}
          <b>{current !== undefined ? formatDuration(current) : "(reading…)"}</b>, read back from the contract
          {current !== undefined && current !== proposal.proposedMinimumRemainingValidity ? "; a later proposal has changed it since." : "."}
        </p>
      );
  }
}

/**
 * One proposal is refreshed from the selected governance contract through a one-item page read.
 */
export function ProposalDetail({ gov, runner, selectedId, fallback, chainId = GIWA_CHAIN_ID }: {
  gov: Governance; runner: GovRunner; selectedId?: bigint; fallback?: GovernanceProposal; chainId?: ProtocolChainId;
}) {
  if (selectedId === undefined) {
    return (
      <section className="panel panel--ticks protocol-panel" aria-labelledby="dao-detail-heading">
        <div className="protocol-panel__head"><h2 id="dao-detail-heading">Proposal details</h2></div>
        <p className="protocol-empty">Select a proposal in the list to see its votes and timeline, and to vote, finalize or execute.</p>
        <LifecycleStrip />
      </section>
    );
  }
  return <SelectedProposal key={selectedId.toString()} gov={gov} runner={runner} selectedId={selectedId} fallback={fallback} chainId={chainId} />;
}

function SelectedProposal({ gov, runner, selectedId, fallback, chainId }: {
  gov: Governance; runner: GovRunner; selectedId: bigint; fallback?: GovernanceProposal; chainId: ProtocolChainId;
}) {
  const now = useNowSeconds(5_000);
  const one = useDaoProposalFeed({ beforeId: selectedId + 1n, pageSize: 1, chainId });
  const fresh = one.proposals[0]?.id === selectedId ? one.proposals[0] : undefined;
  const proposal = fresh ?? (fallback && fallback.id === selectedId ? fallback : undefined);
  const snap = gov.snapshot;

  if (!proposal) {
    return (
      <section className="panel panel--ticks protocol-panel" aria-labelledby="dao-detail-heading">
        <div className="protocol-panel__head"><h2 id="dao-detail-heading">Proposal #{selectedId.toString()}</h2></div>
        {one.state === "read-error"
          ? <p className="callout callout--caution" role="alert">This proposal could not be read from {networkName(chainId)}. Try again in a moment.</p>
          : <p className="protocol-empty" role="status">Reading this proposal from the chain…</p>}
        <LifecycleStrip />
      </section>
    );
  }

  const label = PROPOSAL_LABEL[proposal.state];
  const total = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
  const id = proposal.id;

  const voteReason =
    proposal.state === "pending" ? `Voting opens ${relativeTime(proposal.startAt, now)}.`
    : proposal.state !== "active" ? "Voting on this proposal is closed."
    : proposal.walletHasVoted ? "This wallet has already voted on this proposal."
    : (runner.block ?? runner.memberBlock);

  const canFinalize = !proposal.finalized && (proposal.state === "succeeded" || proposal.state === "rejected" || proposal.state === "expired");
  const finalizeReason =
    proposal.finalized || proposal.state === "executed" ? "The outcome is already recorded."
    : proposal.state === "pending" || proposal.state === "active" ? `Finalization opens after the voting deadline (${relativeTime(proposal.deadline, now)}).`
    : runner.block;

  const canExecute = proposal.finalized && proposal.state === "succeeded" && gov.snapshot?.paused !== true;
  const executeReason =
    proposal.state === "executed" ? "Already executed."
    : proposal.state === "rejected" ? "A rejected proposal cannot be executed."
    : proposal.state === "expired" ? "The execution window has closed."
    : !proposal.finalized ? "Finalize the proposal first."
    : gov.snapshot?.paused ? "The Robinhood DAO is paused; execution is unavailable until it is unpaused."
    : runner.block;

  return (
    <section className="panel panel--ticks protocol-panel" aria-labelledby="dao-detail-heading">
      <div className="protocol-panel__head">
        <h2 id="dao-detail-heading">Proposal #{id.toString()}</h2>
        <Pill tone={label.tone}>{label.label}</Pill>
      </div>

      <p className="dao-detail__ref"><ContentReference text={proposal.contentReference} /></p>

      <Outcome proposal={proposal} current={snap?.minimumRemainingValidity} quorum={snap?.quorum} />

      <h3 className="lend-subhead">The change it proposes</h3>
      <dl className="kv protocol-kv">
        <div className="kv__row"><dt>Minimum remaining validity</dt><dd data-strong="true">{formatDuration(proposal.proposedMinimumRemainingValidity)}</dd></div>
        <div className="kv__row"><dt>In force now</dt><dd>{snap ? formatDuration(snap.minimumRemainingValidity) : "Reading…"}</dd></div>
        <div className="kv__row"><dt>Proposed by</dt><dd className="addr">{shortAddress(proposal.proposer)}</dd></div>
      </dl>

      <h3 className="lend-subhead">Votes</h3>
      <VoteBar proposal={proposal} />
      <p className="small muted">
        {total.toString()} {total === 1n ? "vote" : "votes"} cast{snap ? `; quorum is ${snap.quorum.toString()}${total >= snap.quorum ? " and has been reached" : ""}` : ""}.
        {proposal.walletHasVoted ? " This wallet has voted; the contract records it." : ""} Votes are public wallet votes.
      </p>

      <h3 className="lend-subhead">Timeline</h3>
      <dl className="kv protocol-kv">
        <div className="kv__row"><dt>Created</dt><dd>{formatTimestamp(proposal.createdAt)}</dd></div>
        <div className="kv__row"><dt>Voting opens</dt><dd>{formatTimestamp(proposal.startAt)} · {relativeTime(proposal.startAt, now)}</dd></div>
        <div className="kv__row"><dt>Voting ends</dt><dd>{formatTimestamp(proposal.deadline)} · {relativeTime(proposal.deadline, now)}</dd></div>
        <div className="kv__row"><dt>Execute by</dt><dd>{formatTimestamp(proposal.executionDeadline)} · {relativeTime(proposal.executionDeadline, now)}</dd></div>
      </dl>

      <div className="dao-actions">
        <div>
          <h3 className="lend-subhead">Vote</h3>
          <div className="protocol-actions">
            {VOTES.map(({ vote, label: text, tone }) => (
              <button
                key={vote}
                className={`btn btn--${tone} btn--sm`}
                type="button"
                disabled={Boolean(voteReason) || runner.busy}
                onClick={() => void runner.run(`${text} on proposal #${id}`, () => gov.castVote(id, vote), "Vote confirmed: the contract now records that this wallet has voted, and the totals are read back from it.")}
              >
                {text}
              </button>
            ))}
          </div>
          {voteReason && <p className="lend-reason">{voteReason}</p>}
        </div>
        <div>
          <h3 className="lend-subhead">Finalize and execute</h3>
          <p className="small muted">Two separate transactions, open to any wallet once their conditions are met.</p>
          <div className="protocol-actions">
            <button
              className="btn btn--secondary btn--sm"
              type="button"
              disabled={!canFinalize || Boolean(runner.block) || runner.busy}
              onClick={() => void runner.run(`Finalize proposal #${id}`, () => gov.finalizeProposal(id), "Outcome recorded: the contract no longer treats the proposal as open.")}
            >
              Finalize
            </button>
            <button
              className="btn btn--primary btn--sm"
              type="button"
              disabled={!canExecute || Boolean(runner.block) || runner.busy}
              onClick={() => void runner.run(`Execute proposal #${id}`, () => gov.executeProposal(id), "Executed: the contract's new minimum remaining validity was read back and matches the proposal.")}
            >
              Execute
            </button>
          </div>
          {!canFinalize && finalizeReason && <p className="lend-reason">Finalize: {finalizeReason}</p>}
          {!canExecute && executeReason && <p className="lend-reason">Execute: {executeReason}</p>}
          {canFinalize && runner.block && <p className="lend-reason">{runner.block}</p>}
          {canExecute && runner.block && <p className="lend-reason">{runner.block}</p>}
        </div>
      </div>

      <LifecycleStrip state={proposal.state} />
    </section>
  );
}
