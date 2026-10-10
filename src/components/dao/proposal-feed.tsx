"use client";

import { useState } from "react";
import { PROPOSAL_LABEL, Pill } from "@/components/dao/dao-panels";
import { contentLink, formatDuration, percent, relativeTime, shortAddress, useNowSeconds } from "@/components/dao/format";
import { useDaoProposalFeed } from "@/hooks/use-dao-proposal-feed";
import type { GovernanceProposal } from "@/lib/protocol/types";

const PAGE_SIZE = 5;

/** For / Against / Abstain as one bar, with the counts as text so the bar is never the only information. */
export function VoteBar({ proposal }: { proposal: GovernanceProposal }) {
  const total = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
  return (
    <div className="dao-votes">
      <div className="dao-bar" role="img" aria-label={`${proposal.forVotes} for, ${proposal.againstVotes} against, ${proposal.abstainVotes} abstain`}>
        {total === 0n ? <span data-k="none" style={{ width: "100%" }} /> : (
          <>
            <span data-k="for" style={{ width: `${percent(proposal.forVotes, total)}%` }} />
            <span data-k="against" style={{ width: `${percent(proposal.againstVotes, total)}%` }} />
            <span data-k="abstain" style={{ width: `${percent(proposal.abstainVotes, total)}%` }} />
          </>
        )}
      </div>
      <ul className="dao-votes__counts">
        <li data-k="for"><i aria-hidden="true" />For <b>{proposal.forVotes.toString()}</b></li>
        <li data-k="against"><i aria-hidden="true" />Against <b>{proposal.againstVotes.toString()}</b></li>
        <li data-k="abstain"><i aria-hidden="true" />Abstain <b>{proposal.abstainVotes.toString()}</b></li>
      </ul>
    </div>
  );
}

/** The public text a proposer attached: a link when it is a web address, plain text otherwise. */
export function ContentReference({ text }: { text: string }) {
  const link = contentLink(text);
  return link
    ? <a className="dao-ref" href={link} target="_blank" rel="noopener noreferrer">{text}<span className="visually-hidden"> (opens in a new tab)</span></a>
    : <span className="dao-ref">{text}</span>;
}

function Card({ proposal, quorum, selected, now, onSelect }: {
  proposal: GovernanceProposal; quorum?: bigint; selected: boolean; now: number; onSelect: (p: GovernanceProposal) => void;
}) {
  const label = PROPOSAL_LABEL[proposal.state];
  const total = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
  const when = proposal.state === "pending" ? `Opens ${relativeTime(proposal.startAt, now)}`
    : proposal.state === "active" ? `Voting ends ${relativeTime(proposal.deadline, now)}`
    : proposal.state === "executed" ? "Policy changed"
    : `Voting ended ${relativeTime(proposal.deadline, now)}`;
  return (
    <li>
      <button type="button" className="dao-card" data-selected={selected} aria-pressed={selected} onClick={() => onSelect(proposal)}>
        <span className="dao-card__top">
          <b className="dao-card__id">Proposal #{proposal.id.toString()}</b>
          <Pill tone={label.tone}>{label.label}</Pill>
        </span>
        <span className="dao-card__ref">{proposal.contentReference}</span>
        <span className="dao-card__meta">
          <span>By <span className="addr">{shortAddress(proposal.proposer)}</span></span>
          <span>{when}</span>
          <span>Proposes {formatDuration(proposal.proposedMinimumRemainingValidity)} minimum validity</span>
        </span>
        <span className="dao-card__tally">
          <VoteBar proposal={proposal} />
          {quorum !== undefined && (
            <span className="small muted">{total.toString()} of {quorum.toString()} votes needed for quorum{total >= quorum ? ": reached" : ""}{proposal.walletHasVoted ? " · you voted" : ""}</span>
          )}
        </span>
      </button>
    </li>
  );
}

function FeedPage({ beforeId, first, last, selectedId, now, onSelect, onMore }: {
  beforeId?: bigint; first: boolean; last: boolean; selectedId?: bigint; now: number;
  onSelect: (p: GovernanceProposal) => void; onMore: (cursor: bigint) => void;
}) {
  const feed = useDaoProposalFeed({ beforeId, pageSize: PAGE_SIZE });

  if (first && feed.state === "unconfigured") return <p className="protocol-empty">Proposals cannot be listed: no governance contract is configured, so there is nothing to read. Nothing is simulated.</p>;
  if (first && feed.state === "no-code") return <p className="protocol-empty">The configured governance address has no contract code on GIWA Sepolia, so there are no proposals to read.</p>;
  if (feed.state === "read-error") {
    return (
      <div className="callout callout--caution" role="alert">
        <p>The proposal list could not be read from GIWA Sepolia. This is not the same as having no proposals.</p>
        <div className="protocol-actions"><button className="btn btn--secondary btn--sm" type="button" onClick={() => void feed.refetch()}>Try again</button></div>
      </div>
    );
  }
  if (feed.state === "checking") return <p className="protocol-empty" role="status">Reading proposals from the chain…</p>;
  if (first && feed.proposals.length === 0) return <p className="protocol-empty">No proposal has been created on this contract yet. Verified members can create the first one below.</p>;

  return (
    <>
      <ul className="dao-feed">
        {feed.proposals.map((proposal) => (
          <Card key={proposal.id.toString()} proposal={proposal} quorum={feed.quorum} selected={selectedId === proposal.id} now={now} onSelect={onSelect} />
        ))}
      </ul>
      {last && feed.nextCursor !== undefined && (
        <div className="protocol-actions">
          <button className="btn btn--secondary btn--sm" type="button" onClick={() => onMore(feed.nextCursor!)}>Load older proposals</button>
        </div>
      )}
    </>
  );
}

/** Real proposals read from the contract, newest first, five at a time. The list is never padded or invented. */
export function ProposalFeed({ selectedId, onSelect }: { selectedId?: bigint; onSelect: (p: GovernanceProposal) => void }) {
  const [cursors, setCursors] = useState<(bigint | undefined)[]>([undefined]);
  const now = useNowSeconds();
  return (
    <section className="panel panel--ticks protocol-panel" aria-labelledby="dao-feed-heading">
      <div className="protocol-panel__head"><h2 id="dao-feed-heading">Proposals</h2></div>
      <p className="protocol-copy">Read directly from the governance contract and refreshed every 15 seconds. Pick one to see its details and act on it.</p>
      {cursors.map((cursor, index) => (
        <FeedPage
          key={cursor?.toString() ?? "first"}
          beforeId={cursor}
          first={index === 0}
          last={index === cursors.length - 1}
          selectedId={selectedId}
          now={now}
          onSelect={onSelect}
          onMore={(next) => setCursors((current) => [...current, next])}
        />
      ))}
    </section>
  );
}
