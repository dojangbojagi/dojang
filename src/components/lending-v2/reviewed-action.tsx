"use client";

import { useState, type ReactNode } from "react";
import { AmountField } from "@/components/lending/amount-field";
import { formatAmount, parseAmount, toInputText } from "@/components/lending/format";
import type { ActionRunner } from "@/components/lending/types";

interface ReviewedActionProps {
  title: string;
  fieldLabel: string;
  asset: { symbol: string; decimals: number };
  /** The action as a verb phrase for the activity log: "Supply" gives "Supply 10 gUSD2". */
  verb: string;
  /** The final button, for example "Confirm supply". */
  submitLabel: string;
  successMessage: string;
  onSubmit: (amount: bigint) => Promise<void>;
  /** Fills the field. Leave undefined when no amount is safe to offer. */
  max?: bigint;
  hint?: string;
  /** The wallet balance the amount must not exceed, when tokens leave the wallet. */
  balance?: bigint;
  /** Present when the action pulls tokens through an allowance: the current allowance to the pool. */
  allowance?: bigint;
  onApprove?: (amount: bigint) => Promise<void>;
  /**
   * The allowance a typed amount needs, and therefore the exact amount to approve. Defaults to the typed amount.
   * Never unlimited. Used where the pool may take slightly more than was displayed (repaying a debt in full).
   */
  requiredAllowance?: (amount: bigint) => bigint;
  approveSuccessMessage?: string;
  /** An extra reason the amount cannot be used, decided from contract-provided limits. */
  checkAmount?: (amount: bigint) => string | null;
  /** A reason the action cannot start at all yet. */
  precondition?: string | null;
  /** The review shown once the amount is valid, before anything is sent to the wallet. */
  review?: (amount: bigint) => ReactNode;
  runner: ActionRunner;
  tone?: "primary" | "secondary";
  /** Passed to the activity log wording when the amount equals this value (for example "Repay in full"). */
  fullLabel?: { amount: bigint; verb: string };
}

/**
 * One amount, an explicit review, and then the wallet. Approvals are always for an exact amount and are a separate
 * wallet transaction. Every limit shown here is passed in from a contract read; the contract has the last word.
 */
export function ReviewedAction(props: ReviewedActionProps) {
  const {
    title, fieldLabel, asset, verb, submitLabel, successMessage, onSubmit, max, hint, balance, allowance, onApprove,
    requiredAllowance, approveSuccessMessage, checkAmount, precondition, review, runner, tone = "primary", fullLabel,
  } = props;
  const [text, setText] = useState("");
  const parsed = parseAmount(text, asset.decimals);
  const amount = parsed.value;
  const shown = amount === null ? "" : `${formatAmount(amount, asset.decimals)} ${asset.symbol}`;

  const allowanceNeeded = amount === null ? null : requiredAllowance ? requiredAllowance(amount) : amount;
  const needsApproval = allowance !== undefined && allowanceNeeded !== null && allowanceNeeded > allowance;
  const reason =
    runner.block ??
    precondition ??
    (parsed.error ? null : amount === null ? "Enter an amount." : null) ??
    (amount !== null && balance !== undefined && amount > balance
      ? `This is more than the ${asset.symbol} in your wallet (${formatAmount(balance, asset.decimals)}).`
      : null) ??
    (amount !== null && checkAmount ? checkAmount(amount) : null);
  const disabled = Boolean(reason) || Boolean(parsed.error) || amount === null || runner.busy;
  const stage = amount === null || reason ? "idle" : needsApproval ? "approve" : "confirm";

  async function click() {
    if (amount === null) return;
    if (needsApproval && onApprove) {
      const exact = allowanceNeeded ?? amount;
      await runner.run(
        `Approve ${formatAmount(exact, asset.decimals)} ${asset.symbol} for ${verb.toLowerCase()}`,
        () => onApprove(exact),
        approveSuccessMessage ?? "Approval confirmed. You can continue.",
      );
      return;
    }
    const label = fullLabel && amount >= fullLabel.amount ? `${fullLabel.verb} ${shown}` : `${verb} ${shown}`;
    const ok = await runner.run(label, () => onSubmit(amount), successMessage);
    if (ok) setText("");
  }

  return (
    <div className="lend-action lendv2-action">
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
      {amount !== null && !parsed.error && review && (
        <div className="lendv2-review" aria-live="polite">
          <p className="lendv2-review__title">Review before the wallet</p>
          {review(amount)}
        </div>
      )}
      <ol className="lend-flow" aria-label={`${title} steps`}>
        <li data-state={amount === null || reason ? "idle" : "done"}>Review</li>
        {allowance !== undefined && (
          <li data-state={stage === "approve" ? "current" : stage === "confirm" ? "done" : "idle"}>Approve {asset.symbol}</li>
        )}
        <li data-state={stage === "confirm" ? "current" : "idle"}>Confirm</li>
      </ol>
      <div className="protocol-actions lend-action__buttons">
        <button className={`btn btn--${tone}`} type="button" onClick={() => void click()} disabled={disabled}>
          {runner.busy ? "Transaction in progress…" : needsApproval ? `Approve ${shown}` : submitLabel}
        </button>
      </div>
      {reason && !parsed.error && <p className="lend-reason" role="status">{reason}</p>}
    </div>
  );
}
