"use client";

import { useState, type FormEvent } from "react";
import { MAX_CONTENT_BYTES, formatDuration, parseValidity, utf8Length, type ValidityUnit } from "@/components/dao/format";
import type { GovRunner, Governance } from "@/components/dao/types";

/**
 * The one governance action that exists: propose a new minimum remaining credential validity. The text is public and
 * permanent; the value is bounded by the contract to 0..365 days.
 */
export function CreateProposal({ gov, runner, onCreated }: { gov: Governance; runner: GovRunner; onCreated: (id: bigint) => void }) {
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState<ValidityUnit>("days");
  const [created, setCreated] = useState<bigint | undefined>();

  const bytes = utf8Length(reference);
  const parsed = parseValidity(amount, unit);
  const referenceError = reference.trim() === "" ? null : bytes > MAX_CONTENT_BYTES ? `Too long: ${bytes} of ${MAX_CONTENT_BYTES} bytes.` : null;
  const current = gov.snapshot?.minimumRemainingValidity;

  const reason =
    runner.block ??
    runner.memberBlock ??
    (reference.trim() === "" ? "Describe the proposal in public text." : null) ??
    referenceError ??
    (parsed.error ? parsed.error : parsed.value === null ? "Enter the new minimum remaining validity." : null);
  const disabled = Boolean(reason) || runner.busy;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || parsed.value === null) return;
    let id: bigint | undefined;
    const ok = await runner.run(
      "Create proposal",
      async () => {
        id = await gov.createProposal({ contentReference: reference.trim(), newMinimumRemainingValidity: parsed.value! });
        return id;
      },
      "Proposal created: its ID was read from the receipt and the stored proposal matches what you submitted.",
    );
    if (ok && id !== undefined) {
      setCreated(id);
      setReference("");
      setAmount("");
      onCreated(id);
    }
  }

  return (
    <section className="panel panel--ticks protocol-panel" aria-labelledby="dao-create-heading">
      <div className="protocol-panel__head"><h2 id="dao-create-heading">Create a proposal</h2></div>
      <p className="protocol-copy">
        Available action: <b>change the minimum remaining credential validity</b>, the policy the protected action reads
        {current !== undefined ? ` (now ${formatDuration(current)})` : ""}. Nothing else can be proposed.
      </p>
      <form className="protocol-form" onSubmit={(event) => void submit(event)} noValidate>
        <label className="protocol-field" htmlFor="dao-reference"><span>What and why (public text or a link)</span>
          <textarea id="dao-reference" rows={3} value={reference} onChange={(event) => setReference(event.currentTarget.value)} aria-describedby="dao-reference-help" disabled={runner.busy} />
        </label>
        <p id="dao-reference-help" className="xsmall muted" data-invalid={Boolean(referenceError)}>
          {referenceError ?? `${bytes} of ${MAX_CONTENT_BYTES} bytes.`} This is stored on-chain for everyone to read. Do not include personal or private data.
        </p>
        <div className="protocol-form__grid">
          <label className="protocol-field" htmlFor="dao-validity"><span>New minimum remaining validity</span>
            <input id="dao-validity" inputMode="numeric" autoComplete="off" value={amount} onChange={(event) => setAmount(event.currentTarget.value)} disabled={runner.busy} />
          </label>
          <label className="protocol-field" htmlFor="dao-unit"><span>Unit</span>
            <select id="dao-unit" value={unit} onChange={(event) => setUnit(event.currentTarget.value as ValidityUnit)} disabled={runner.busy}>
              <option value="days">days</option><option value="hours">hours</option><option value="minutes">minutes</option><option value="seconds">seconds</option>
            </select>
          </label>
        </div>
        <p className="xsmall muted">
          {parsed.value !== null ? `That is ${parsed.value.toString()} seconds (${formatDuration(parsed.value)}).` : "From 0 up to 365 days."}{" "}
          Voting would open one minute after the proposal is created.
        </p>
        <div className="protocol-actions">
          <button className="btn btn--primary" type="submit" disabled={disabled}>{runner.busy ? "Transaction in progress…" : "Create proposal"}</button>
          {reason && !parsed.error && !referenceError && <span className="lend-reason" role="status">{reason}</span>}
          {(parsed.error || referenceError) && <span className="lend-reason" role="status">{parsed.error ?? referenceError}</span>}
        </div>
      </form>
      {created !== undefined && <p className="callout callout--demo" role="status">Proposal #{created.toString()} is on-chain. It is selected in the list so you can follow it.</p>}
    </section>
  );
}
