"use client";

import { useState, type FormEvent } from "react";
import { decodeEventLog, isHash, type Abi, type Hash, type Hex } from "viem";
import { usePublicClient } from "wagmi";
import { GIWA_CHAIN_ID } from "@/lib/config/chain";
import { projectContracts } from "@/lib/config/contracts";
import {
  protocolEventAbi,
  readProjectProtocolLogs,
  readProjectTransactionEvidence,
  type ProjectEventLog,
  type ProjectTransactionEvidence,
} from "@/lib/protocol/chain-evidence";
import { explainLookupFailure } from "@/components/dao/errors";

const MAX_RANGE = 100_000n;

function eventName(log: ProjectEventLog): string {
  const abi = protocolEventAbi(log.contract);
  if (!abi || log.topics.length === 0) return "Unrecognised event";
  try {
    return decodeEventLog({ abi: abi as Abi, data: log.data, topics: log.topics as [Hex, ...Hex[]] }).eventName ?? "Unrecognised event";
  } catch {
    return "Unrecognised event";
  }
}

function EventList({ events }: { events: readonly ProjectEventLog[] }) {
  if (events.length === 0) return <p className="protocol-empty">No event from a configured project contract.</p>;
  return (
    <ul className="evidence-events">
      {events.map((log, index) => (
        <li key={`${log.transactionHash}-${log.logIndex}-${index}`}>
          <b>{eventName(log)}</b>
          <span className="small muted">{log.contract} · block {log.blockNumber?.toString() ?? "?"} · log {log.logIndex ?? "?"}</span>
          {log.explorerUrl && <a href={log.explorerUrl} target="_blank" rel="noopener noreferrer">Transaction<span className="visually-hidden"> (opens in a new tab)</span></a>}
        </li>
      ))}
    </ul>
  );
}

/**
 * Looks things up on GIWA Sepolia on request: one transaction receipt, or the events of the configured project
 * contracts in a bounded block range. Nothing is shown unless the chain returned it, and failures are shown as
 * failures, never as an empty result.
 */
export function ChainEvidenceLookup() {
  const client = usePublicClient({ chainId: GIWA_CHAIN_ID });
  const anyConfigured = Object.values(projectContracts).some(Boolean);

  const [hash, setHash] = useState("");
  const [tx, setTx] = useState<ProjectTransactionEvidence | undefined>();
  const [txState, setTxState] = useState<"idle" | "reading" | "error">("idle");
  const [txError, setTxError] = useState("");

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [logs, setLogs] = useState<readonly ProjectEventLog[] | undefined>();
  const [logState, setLogState] = useState<"idle" | "reading" | "error">("idle");
  const [logError, setLogError] = useState("");

  const hashOk = isHash(hash.trim());
  const fromN = /^\d+$/.test(from) ? BigInt(from) : undefined;
  const toN = /^\d+$/.test(to) ? BigInt(to) : undefined;
  const rangeError =
    from === "" && to === "" ? null
    : fromN === undefined || toN === undefined ? "Enter both block numbers as whole numbers."
    : toN < fromN ? "The last block must not be before the first."
    : toN - fromN > MAX_RANGE ? "At most 100,000 blocks per scan."
    : null;

  async function readTx(event: FormEvent) {
    event.preventDefault();
    if (!client || !hashOk) return;
    setTxState("reading"); setTx(undefined); setTxError("");
    try {
      setTx(await readProjectTransactionEvidence(client, hash.trim() as Hash));
      setTxState("idle");
    } catch (error) {
      setTxError(explainLookupFailure(error));
      setTxState("error");
    }
  }

  async function readLogs(event: FormEvent) {
    event.preventDefault();
    if (!client || fromN === undefined || toN === undefined || rangeError) return;
    setLogState("reading"); setLogs(undefined); setLogError("");
    try {
      setLogs(await readProjectProtocolLogs(client, { fromBlock: fromN, toBlock: toN }));
      setLogState("idle");
    } catch (error) {
      setLogError(explainLookupFailure(error));
      setLogState("error");
    }
  }

  return (
    <section className="panel" aria-labelledby="lookup-heading">
      <h2 id="lookup-heading">Look up chain evidence</h2>
      <p className="muted">
        Read a receipt, or the events of the configured project contracts, straight from GIWA Sepolia. Only real chain data is shown.
        Nothing is returned for a transaction that is not a GIWA Sepolia transaction, and a local test chain is not accepted as one.
      </p>
      {!anyConfigured && <p className="notice">No project contract address is configured, so there is nothing to match events against. A receipt can still be read.</p>}

      <form className="protocol-form" onSubmit={(event) => void readTx(event)} noValidate>
        <label className="protocol-field" htmlFor="evidence-hash"><span>Transaction hash</span>
          <input id="evidence-hash" value={hash} onChange={(event) => setHash(event.currentTarget.value)} placeholder="0x…" autoComplete="off" spellCheck={false} />
        </label>
        <div className="protocol-actions">
          <button className="btn btn--secondary btn--sm" type="submit" disabled={!client || !hashOk || txState === "reading"}>{txState === "reading" ? "Reading…" : "Read receipt"}</button>
          {hash.trim() !== "" && !hashOk && <span className="xsmall muted">A transaction hash is 0x followed by 64 hex characters.</span>}
        </div>
      </form>
      {txState === "error" && <p className="callout callout--caution" role="alert">{txError}</p>}
      {tx && (
        <div aria-live="polite">
          <dl className="kv protocol-kv">
            <div className="kv__row"><dt>Result</dt><dd>{tx.status === "success" ? "Succeeded" : "Reverted"}</dd></div>
            <div className="kv__row"><dt>Block</dt><dd>{tx.blockNumber.toString()}</dd></div>
            <div className="kv__row"><dt>From</dt><dd className="addr">{tx.from}</dd></div>
            <div className="kv__row"><dt>To</dt><dd className="addr">{tx.to ?? "Contract creation"}</dd></div>
            <div className="kv__row"><dt>Gas used</dt><dd>{tx.gasUsed.toString()}</dd></div>
            <div className="kv__row"><dt>Explorer</dt><dd><a href={tx.explorerUrl} target="_blank" rel="noopener noreferrer">Open the transaction<span className="visually-hidden"> (opens in a new tab)</span></a></dd></div>
          </dl>
          <h3 className="evidence-subhead">Events from project contracts in this transaction</h3>
          <EventList events={tx.projectEvents} />
        </div>
      )}

      <form className="protocol-form" onSubmit={(event) => void readLogs(event)} noValidate>
        <div className="protocol-form__grid">
          <label className="protocol-field" htmlFor="evidence-from"><span>First block</span>
            <input id="evidence-from" inputMode="numeric" value={from} onChange={(event) => setFrom(event.currentTarget.value)} autoComplete="off" />
          </label>
          <label className="protocol-field" htmlFor="evidence-to"><span>Last block</span>
            <input id="evidence-to" inputMode="numeric" value={to} onChange={(event) => setTo(event.currentTarget.value)} autoComplete="off" />
          </label>
        </div>
        <div className="protocol-actions">
          <button className="btn btn--secondary btn--sm" type="submit" disabled={!client || !anyConfigured || fromN === undefined || toN === undefined || Boolean(rangeError) || logState === "reading"}>{logState === "reading" ? "Scanning…" : "Scan project events"}</button>
          <span className="xsmall muted">{rangeError ?? "Up to 100,000 blocks per scan; a deployment block is the best place to start."}</span>
        </div>
      </form>
      {logState === "error" && <p className="callout callout--caution" role="alert">{logError}</p>}
      {logs && <div aria-live="polite"><h3 className="evidence-subhead">{logs.length} {logs.length === 1 ? "event" : "events"} from project contracts</h3><EventList events={logs} /></div>}
    </section>
  );
}
