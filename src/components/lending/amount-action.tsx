"use client";

import { useState } from "react";
import { AmountField } from "@/components/lending/amount-field";
import { formatAmount, parseAmount, toInputText } from "@/components/lending/format";
import type { ActionRunner } from "@/components/lending/types";

interface AmountActionProps {
  /** Short heading, for example "Supply". */
  title: string;
  /** What the field is called, for example "Amount to supply". */
  fieldLabel: string;
  asset: { symbol: string; decimals: number };
  /** The action, as a verb phrase used in the activity log: "Supply" gives "Supply 10 gUSD". */
  verb: string;
  submitLabel: string;
  successMessage: string;
  onSubmit: (amount: bigint) => Promise<void>;
  /** Offer a Max button that fills this amount. Leave undefined when no amount is safe to offer. */
  max?: bigint;
  /** Shown under the field. */
  hint?: string;
  /** The wallet balance the amount must not exceed, when the action sends tokens from the wallet. */
  balance?: bigint;
  /** Present only when the action pulls tokens through an allowance: the current allowance to the pool. */
  allowance?: bigint;
  onApprove?: (amount: bigint) => Promise<void>;
  approveSuccessMessage?: string;
  /** An extra reason the amount cannot be used, decided by the caller from contract-provided limits. */
  checkAmount?: (amount: bigint) => string | null;
  /** A reason the action cannot start at all yet (for example "Generate a proof first"). */
  precondition?: string | null;
  runner: ActionRunner;
  tone?: "primary" | "secondary";
}

/** One amount field with its approve-then-act button. All limits are passed in from contract reads. */
export function AmountAction(props: AmountActionProps) {
  const { title, fieldLabel, asset, verb, submitLabel, successMessage, onSubmit, max, hint, balance, allowance, onApprove, approveSuccessMessage, checkAmount, precondition, runner, tone = "primary" } = props;
  const [text, setText] = useState("");
  const parsed = parseAmount(text, asset.decimals);
  const amount = parsed.value;
  const shown = amount === null ? "" : `${formatAmount(amount, asset.decimals)} ${asset.symbol}`;

  const needsApproval = allowance !== undefined && amount !== null && amount > allowance;
  const reason =
    runner.block ??
    precondition ??
    (parsed.error ? null : amount === null ? "Enter an amount." : null) ??
    (amount !== null && balance !== undefined && amount > balance ? `This is more than the ${asset.symbol} in your wallet (${formatAmount(balance, asset.decimals)}).` : null) ??
    (amount !== null && checkAmount ? checkAmount(amount) : null);
  const disabled = Boolean(reason) || Boolean(parsed.error) || amount === null || runner.busy;

  async function click() {
    if (amount === null) return;
    if (needsApproval && onApprove) {
      await runner.run(`Approve ${shown} for ${verb.toLowerCase()}`, () => onApprove(amount), approveSuccessMessage ?? "Approval confirmed. You can continue.");
      return;
    }
    const ok = await runner.run(`${verb} ${shown}`, () => onSubmit(amount), successMessage);
    if (ok) setText("");
  }

  return (
    <div className="lend-action">
      <h3 className="lend-action__title">{title}</h3>
      <AmountField
        label={fieldLabel}
        value={text}
        onChange={setText}
        symbol={asset.symbol}
        error={parsed.error}
        hint={hint}
        onMax={max !== undefined && max > 0n ? () => setText(toInputText(max, asset.decimals)) : undefined}
        disabled={runner.busy}
      />
      {allowance !== undefined && (
        <ol className="lend-flow" aria-label={`${title} steps`}>
          <li data-state={amount === null ? "idle" : needsApproval ? "current" : "done"}>Approve {asset.symbol}</li>
          <li data-state={amount === null ? "idle" : needsApproval ? "idle" : "current"}>{submitLabel}</li>
        </ol>
      )}
      <div className="protocol-actions lend-action__buttons">
        <button className={`btn btn--${tone}`} type="button" onClick={() => void click()} disabled={disabled}>
          {runner.busy ? "Transaction in progress…" : needsApproval ? `Approve ${shown}` : submitLabel}
        </button>
      </div>
      {reason && !parsed.error && <p className="lend-reason" role="status">{reason}</p>}
    </div>
  );
}
