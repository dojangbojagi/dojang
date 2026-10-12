"use client";

import { useEffect, useState, type FormEvent } from "react";
import { isHash, type Hash } from "viem";
import { usePublicClient } from "wagmi";
import {
  inspectRobinhoodContracts,
  readRobinhoodTransactionEvidence,
  scanRobinhoodProjectEvents,
  type RobinhoodCodeEvidence,
  type RobinhoodEventEvidence,
  type RobinhoodTransactionEvidence,
} from "@/lib/protocol/robinhood-chain-evidence";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/config/robinhood-testnet";

const CONTRACT_LABELS: Record<RobinhoodCodeEvidence["name"], string> = {
  zkTranscriptLib: "ZKTranscriptLib",
  relationsLib: "RelationsLib",
  honkVerifier: "HonkVerifier",
  credentialRegistry: "RobinhoodDemoCredentialRegistry",
  verifierAdapter: "EligibilityVerifierAdapter",
  lendingV2Oracle: "ControlledTestOracle",
  lendingV2Asset: "rUSD2 test token",
  lendingV2Collateral: "rCOL2 test token",
  lendingV2Pool: "LendingPoolV2",
  governance: "RobinhoodGovernancePhase1",
};

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "The Robinhood RPC request failed.";
}

function EventList({ events }: { events: readonly RobinhoodEventEvidence[] }) {
  if (!events.length) return <p className="protocol-empty">No matching event was returned for configured Robinhood project contracts.</p>;
  return (
    <ul className="evidence-events">
      {events.map((event, index) => (
        <li key={`${event.transactionHash}-${event.logIndex}-${index}`}>
          <b>{event.eventName ?? "Unrecognised event"}</b>
          <span className="small muted">{CONTRACT_LABELS[event.contract]} · {event.address} · block {event.blockNumber?.toString() ?? "?"} · log {event.logIndex ?? "?"}</span>
          {event.explorerUrl && <a href={event.explorerUrl} target="_blank" rel="noopener noreferrer">Transaction<span className="visually-hidden"> (opens in a new tab)</span></a>}
        </li>
      ))}
    </ul>
  );
}

export function RobinhoodEvidenceLookup() {
  const client = usePublicClient({ chainId: ROBINHOOD_TESTNET_CHAIN_ID });
  const [codeState, setCodeState] = useState<"idle" | "reading" | "ready" | "error">("idle");
  const [code, setCode] = useState<readonly RobinhoodCodeEvidence[]>([]);
  const [codeError, setCodeError] = useState("");
  const [hash, setHash] = useState("");
  const [transaction, setTransaction] = useState<RobinhoodTransactionEvidence>();
  const [txState, setTxState] = useState<"idle" | "reading" | "error">("idle");
  const [txError, setTxError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [events, setEvents] = useState<readonly RobinhoodEventEvidence[]>();
  const [eventState, setEventState] = useState<"idle" | "reading" | "error">("idle");
  const [eventError, setEventError] = useState("");

  const validHash = isHash(hash.trim());
  const fromBlock = /^\d+$/.test(from) ? BigInt(from) : undefined;
  const toBlock = /^\d+$/.test(to) ? BigInt(to) : undefined;
  const rangeError = from === "" && to === "" ? undefined
    : fromBlock === undefined || toBlock === undefined ? "Enter both block numbers as whole numbers."
    : toBlock < fromBlock ? "The last block must not be before the first."
    : toBlock - fromBlock + 1n > 100_000n ? "At most 100,000 blocks may be scanned per request."
    : undefined;

  async function inspectCode() {
    if (!client) return;
    setCodeState("reading");
    setCodeError("");
    setCode([]);
    try {
      setCode(await inspectRobinhoodContracts(client));
      setCodeState("ready");
    } catch (error) {
      setCodeError(describeError(error));
      setCodeState("error");
    }
  }

  async function readReceipt(event: FormEvent) {
    event.preventDefault();
    if (!client || !validHash) return;
    setTxState("reading"); setTransaction(undefined); setTxError("");
    try {
      setTransaction(await readRobinhoodTransactionEvidence(client, hash.trim() as Hash));
      setTxState("idle");
    } catch (error) {
      setTxError(describeError(error)); setTxState("error");
    }
  }

  async function scanEvents(event: FormEvent) {
    event.preventDefault();
    if (!client || fromBlock === undefined || toBlock === undefined || rangeError) return;
    setEventState("reading"); setEvents(undefined); setEventError("");
    try {
      setEvents(await scanRobinhoodProjectEvents(client, { fromBlock, toBlock }));
      setEventState("idle");
    } catch (error) {
      setEventError(describeError(error)); setEventState("error");
    }
  }

  useEffect(() => {
    if (!client) return;
    let current = true;
    setCodeState("reading");
    setCodeError("");
    void inspectRobinhoodContracts(client).then((result) => {
      if (!current) return;
      setCode(result);
      setCodeState("ready");
    }).catch((error: unknown) => {
      if (!current) return;
      setCodeError(describeError(error));
      setCodeState("error");
    });
    return () => { current = false; };
  }, [client]);

  return (
    <section className="panel" aria-labelledby="robinhood-evidence-heading">
      <h2 id="robinhood-evidence-heading">Robinhood Testnet evidence</h2>
      <p className="muted">Every lookup is made against chain {ROBINHOOD_TESTNET_CHAIN_ID}. Receipts are authentic Robinhood RPC results; project events are matched only to the project's own contract addresses. Local Anvil transactions are not accepted as testnet evidence.</p>

      <div className="protocol-actions">
        <button className="btn btn--secondary btn--sm" type="button" onClick={() => void inspectCode()} disabled={!client || codeState === "reading"}>
          {codeState === "reading" ? "Checking code…" : "Check contract code"}
        </button>
      </div>
      {codeState === "error" && <p className="callout callout--caution" role="alert">{codeError}</p>}
      {codeState === "ready" && (
        <dl className="contract-list" aria-label="Robinhood configured contract code checks">
          {code.map((item) => (
            <div className="contract-row" key={item.name}>
              <dt><strong>{CONTRACT_LABELS[item.name]}</strong>{item.address && <span className="xsmall muted">{item.address}</span>}</dt>
              <dd>
                <span className="status" data-state={item.state === "code-present" && item.sourceVerification === "verified" ? "valid" : item.state === "no-code" ? "invalid" : "warn"}>
                  <i className="status__dot" aria-hidden="true" />
                  {item.state === "code-present"
                    ? `Code present · Blockscout source ${item.sourceVerification}`
                    : item.state === "no-code" ? "No runtime bytecode at configured address" : "Not configured"}
                </span>
                {item.runtimeCodeHash && <span className="xsmall muted">Runtime code hash: <code>{item.runtimeCodeHash}</code></span>}
                {item.explorerUrl && <a href={item.explorerUrl} target="_blank" rel="noopener noreferrer">Open address explorer<span className="visually-hidden"> (opens in a new tab)</span></a>}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <form className="protocol-form" onSubmit={(event) => void readReceipt(event)} noValidate>
        <label className="protocol-field" htmlFor="robinhood-evidence-hash"><span>Robinhood transaction hash</span>
          <input id="robinhood-evidence-hash" value={hash} onChange={(event) => setHash(event.currentTarget.value)} placeholder="0x…" autoComplete="off" spellCheck={false} />
        </label>
        <div className="protocol-actions">
          <button className="btn btn--secondary btn--sm" type="submit" disabled={!client || !validHash || txState === "reading"}>{txState === "reading" ? "Reading…" : "Read receipt"}</button>
          {hash.trim() && !validHash && <span className="xsmall muted">A transaction hash is 0x followed by 64 hexadecimal characters.</span>}
        </div>
      </form>
      {txState === "error" && <p className="callout callout--caution" role="alert">{txError}</p>}
      {transaction && (
        <div aria-live="polite">
          <dl className="kv protocol-kv">
            <div className="kv__row"><dt>Receipt status</dt><dd>{transaction.status === "success" ? "Succeeded" : "Reverted"}</dd></div>
            <div className="kv__row"><dt>Chain</dt><dd>{transaction.chainId}</dd></div>
            <div className="kv__row"><dt>Block</dt><dd>{transaction.blockNumber.toString()}</dd></div>
            <div className="kv__row"><dt>From</dt><dd className="addr">{transaction.from}</dd></div>
            <div className="kv__row"><dt>To</dt><dd className="addr">{transaction.to ?? "Contract creation"}</dd></div>
            <div className="kv__row"><dt>Gas used</dt><dd>{transaction.gasUsed.toString()}</dd></div>
            <div className="kv__row"><dt>Explorer</dt><dd><a href={transaction.explorerUrl} target="_blank" rel="noopener noreferrer">Open transaction<span className="visually-hidden"> (opens in a new tab)</span></a></dd></div>
          </dl>
          <h3 className="evidence-subhead">Events from GYEVO contracts</h3>
          <EventList events={transaction.projectEvents} />
        </div>
      )}

      <form className="protocol-form" onSubmit={(event) => void scanEvents(event)} noValidate>
        <div className="protocol-form__grid">
          <label className="protocol-field" htmlFor="robinhood-evidence-from"><span>First block</span><input id="robinhood-evidence-from" inputMode="numeric" value={from} onChange={(event) => setFrom(event.currentTarget.value)} /></label>
          <label className="protocol-field" htmlFor="robinhood-evidence-to"><span>Last block</span><input id="robinhood-evidence-to" inputMode="numeric" value={to} onChange={(event) => setTo(event.currentTarget.value)} /></label>
        </div>
        <div className="protocol-actions">
          <button className="btn btn--secondary btn--sm" type="submit" disabled={!client || fromBlock === undefined || toBlock === undefined || Boolean(rangeError) || eventState === "reading"}>{eventState === "reading" ? "Scanning…" : "Scan project events"}</button>
          <span className="xsmall muted">{rangeError ?? "Up to 100,000 blocks per scan. Future block ranges are rejected."}</span>
        </div>
      </form>
      {eventState === "error" && <p className="callout callout--caution" role="alert">{eventError}</p>}
      {events && <div aria-live="polite"><h3 className="evidence-subhead">{events.length} {events.length === 1 ? "event" : "events"} from project contracts</h3><EventList events={events} /></div>}
      {!client && <p className="callout callout--caution" role="status">The Robinhood Testnet RPC client is unavailable.</p>}
    </section>
  );
}
