"use client";

import { useState, type ReactNode } from "react";
import { AmountField } from "@/components/lending/amount-field";
import { formatAmount, parseAmount, toInputText } from "@/components/lending/format";
import type { ActionRunner } from "@/components/lending/types";

/** What the person did to the field, beyond the number: pressed Max (and Max means "everything" for this action). */
export interface ActionFlags {
  max: boolean;
}

interface ReviewedActionProps {
  title: string;
  fieldLabel: string;
  asset: { symbol: string; decimals: number };
  /** The action as a verb phrase for the activity log: "Supply" gives "Supply 10 gUSD2". */
  verb: string;
  /** The final button, for example "Confirm supply". */
  submitLabel: string;
  successMessage: string;
  onSubmit: (amount: bigint, flags: ActionFlags) => Promise<void>;
  /** Fills the field. Leave undefined when no amount is safe to offer. */
  max?: bigint;
  hint?: string;
  /** The wallet balance the amount must not exceed, when tokens leave the wallet. */
  balance?: bigint;
  /** Present when the action pulls tokens through an allowance: the current allowance to the pool. */
  allowance?: bigint;
  onApprove?: (amount: bigint) => Promise<void>;
  /** The allowance below which an approval is needed first. Defaults to the typed amount. */
  requiredAllowance?: (amount: bigint, flags: ActionFlags) => bigint;
  /**
   * The exact amount to approve when one is needed. Defaults to the required allowance. Never unlimited. It may be
   * a little above the threshold where the pool can take slightly more than was displayed (repaying a debt in full:
   * interest accrues while the transaction waits).
   */
  approveAmount?: (amount: bigint, flags: ActionFlags) => bigint;
  /**
   * True when pressing Max means "the whole thing" for this action (repaying every unit of debt, which keeps
   * growing while the transaction waits). Then onSubmit receives flags.max and must not rely on the typed number.
   */
  maxMeansFull?: boolean;
  approveSuccessMessage?: string;
  /** An extra reason the amount cannot be used, decided from contract-provided limits. */
  checkAmount?: (amount: bigint) => string | null;
  /** A reason the action cannot start at all yet. */
  precondition?: string | null;
  /** A reason an exact-token approval cannot start. When set, it replaces submit-only restrictions for approval. */
  approvalPrecondition?: string | null;
  /** Additional amount check for an approval, separate from the final action's limits. */
  approvalCheckAmount?: (amount: bigint) => string | null;
  /** A condition required for the final action but not for a separate exact-token approval. */
  submitPrecondition?: string | null;
  /** A clear next step shown when the final action is gated by `submitPrecondition`. */
  submitAction?: ReactNode;
  /** The review shown once the amount is valid, before anything is sent to the wallet. */
  review?: (amount: bigint, flags: ActionFlags) => ReactNode;
  runner: ActionRunner;
  tone?: "primary" | "secondary";
  /** Activity-log wording when Max was used and means everything, for example "Repay in full". */
  fullVerb?: string;
}

/**
 * One amount, an explicit review, and then the wallet. Approvals are always for an exact amount and are a separate
 * wallet transaction. Every limit shown here is passed in from a contract read; the contract has the last word.
 */
export function ReviewedAction(props: ReviewedActionProps) {
  const {
    title, fieldLabel, asset, verb, submitLabel, successMessage, onSubmit, max, hint, balance, allowance, onApprove,
    requiredAllowance, approveAmount, maxMeansFull, approveSuccessMessage, checkAmount, precondition, submitPrecondition, review, runner, tone = "primary", fullVerb,
    approvalPrecondition, approvalCheckAmount, submitAction,
  } = props;
  const [text, setText] = useState("");
  const [usedMax, setUsedMax] = useState(false);
  const parsed = parseAmount(text, asset.decimals);
  const amount = parsed.value;
  const shown = amount === null ? "" : `${formatAmount(amount, asset.decimals)} ${asset.symbol}`;

  const flags: ActionFlags = { max: usedMax && Boolean(maxMeansFull) };
  const allowanceNeeded = amount === null ? null : requiredAllowance ? requiredAllowance(amount, flags) : amount;
  const needsApproval = allowance !== undefined && allowanceNeeded !== null && allowanceNeeded > allowance;
  const toApprove = amount === null ? null : approveAmount ? approveAmount(amount, flags) : allowanceNeeded;
  const sharedReason =
    runner.block ??
    (parsed.error ? null : amount === null ? "Enter an amount." : null) ??
    (amount !== null && balance !== undefined && amount > balance
      ? `This is more than the ${asset.symbol} in your wallet (${formatAmount(balance, asset.decimals)}).`
      : null);
  const submitReason =
    precondition ??
    (amount !== null && checkAmount ? checkAmount(amount) : null) ??
    submitPrecondition ??
    null;
  const approvalReason = approvalPrecondition === undefined
    ? submitReason
    : approvalPrecondition ?? (amount !== null && approvalCheckAmount ? approvalCheckAmount(amount) : null);
  const approvalStage = needsApproval && Boolean(onApprove);
  const reason = sharedReason ?? (approvalStage ? approvalReason : needsApproval ? "Token approval is unavailable for this action." : submitReason);
  const disabled = Boolean(reason) || Boolean(parsed.error) || amount === null || runner.busy;
  const stage = amount === null || reason ? "idle" : approvalStage ? "approve" : "confirm";
  const canShowSubmitAction = !needsApproval && !sharedReason && !runner.busy && !precondition &&
    !(amount !== null && checkAmount?.(amount)) && Boolean(submitPrecondition);

  async function click() {
    if (amount === null) return;
    if (needsApproval && onApprove) {
      const exact = toApprove ?? amount;
      await runner.run(
        `Approve ${formatAmount(exact, asset.decimals)} ${asset.symbol} for ${verb.toLowerCase()}`,
        () => onApprove(exact),
        approveSuccessMessage ?? "Approval confirmed. You can continue.",
      );
      return;
    }
    const label = flags.max && fullVerb ? `${fullVerb} ${shown}` : `${verb} ${shown}`;
    const ok = await runner.run(label, () => onSubmit(amount, flags), successMessage);
    if (ok) {
      setText("");
      setUsedMax(false);
    }
  }

  return (
    <div className="lend-action lendv2-action">
      <h3 className="lend-action__title">{title}</h3>
      <AmountField
        label={fieldLabel}
        value={text}
        onChange={(value) => {
          setText(value);
          setUsedMax(false);
        }}
        symbol={asset.symbol}
        error={parsed.error}
        hint={hint}
        onMax={max !== undefined && max > 0n ? () => { setText(toInputText(max, asset.decimals)); setUsedMax(true); } : undefined}
        disabled={runner.busy}
      />
      {amount !== null && !parsed.error && review && (
        <div className="lendv2-review" aria-live="polite">
          <p className="lendv2-review__title">Review before the wallet</p>
          {review(amount, flags)}
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
          {runner.busy
            ? "Transaction in progress…"
            : needsApproval && toApprove !== null
              ? `Approve ${formatAmount(toApprove, asset.decimals)} ${asset.symbol}`
              : submitLabel}
        </button>
      </div>
      {reason && !parsed.error && <p className="lend-reason" role="status">{reason}</p>}
      {canShowSubmitAction && submitAction && amount !== null && !parsed.error && (
        <div className="lend-reason" role="group" aria-label="Next eligibility step">
          {submitAction}
        </div>
      )}
    </div>
  );
}
