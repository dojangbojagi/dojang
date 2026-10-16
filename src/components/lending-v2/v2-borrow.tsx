"use client";

import type { Address } from "viem";
import { formatAmount } from "@/components/lending/format";
import type { ActionRunner } from "@/components/lending/types";
import { AssetPicker } from "@/components/lending-v2/v2-asset-picker";
import {
  ageText, formatBps, formatHealthFactor, formatWad, oracleLabel, oracleTone, reserveBlockReason,
} from "@/components/lending-v2/v2-format";
import { Chip, Meter, Metric, Unavailable } from "@/components/lending-v2/v2-parts";
import { ReviewedAction } from "@/components/lending-v2/reviewed-action";
import { classifyPosition, previewBorrow } from "@/components/lending-v2/v2-risk";
import { positionOf, type V2Market, type V2Proof } from "@/components/lending-v2/v2-types";
import { ProtocolError } from "@/lib/protocol/types";

/** Borrowing, in the order the pool requires it: collateral, then enabling it with a proof, then the borrow. */
export function BorrowView({ market, proof, runner, borrowAsset, onBorrowAsset, collateralAsset, onCollateralAsset }: {
  market: V2Market;
  proof: V2Proof;
  runner: ActionRunner;
  borrowAsset: Address | undefined;
  onBorrowAsset: (asset: Address) => void;
  collateralAsset: Address | undefined;
  onCollateralAsset: (asset: Address) => void;
}) {
  const snapshot = market.snapshot;
  const borrowables = snapshot?.reserves.filter((reserve) => reserve.data.config.borrowEnabled) ?? [];
  const collaterals = snapshot?.reserves.filter((reserve) => reserve.data.config.collateralEnabled) ?? [];
  const debtReserve = borrowables.find((reserve) => reserve.asset.toLowerCase() === borrowAsset?.toLowerCase()) ?? borrowables[0];
  const collReserve = collaterals.find((reserve) => reserve.asset.toLowerCase() === collateralAsset?.toLowerCase()) ?? collaterals[0];

  if (!snapshot || !debtReserve || !collReserve) {
    return (
      <section className="panel panel--ticks protocol-panel" aria-labelledby="lendv2-borrow-heading">
        <div className="protocol-panel__head"><h2 id="lendv2-borrow-heading">Borrow</h2></div>
        <Unavailable title={snapshot ? "No asset can be borrowed or used as collateral yet" : market.state === "checking" ? "Reading the pool…" : "Borrowing is unavailable"}>
          <p>
            {snapshot
              ? "This pool has no reserve that accepts borrowing, or none that accepts collateral. There is nothing to borrow against."
              : "Borrowing needs a readable Lending V2 pool, a fresh oracle price and collateral you deposit. Nothing is simulated while it is unavailable."}
          </p>
        </Unavailable>
      </section>
    );
  }

  const debtSymbol = debtReserve.symbol;
  const collSymbol = collReserve.symbol;
  const debtData = debtReserve.data;
  const collData = collReserve.data;
  const debtPos = positionOf(snapshot, debtReserve);
  const collPos = positionOf(snapshot, collReserve);
  const walletPosition = snapshot.position;
  const account = walletPosition?.account;
  const risk = classifyPosition(walletPosition);
  const proofValue = proof.proof;
  const maxBorrowable = debtReserve.maxBorrowable;
  const oracleAge = debtReserve.oracle.updatedAt !== undefined && debtReserve.oracle.updatedAt > 0n && debtReserve.oracle.updatedAt <= snapshot.blockTimestamp
    ? snapshot.blockTimestamp - debtReserve.oracle.updatedAt
    : undefined;

  const collateralBlocked = reserveBlockReason(collReserve, snapshot.riskPaused, "collateral");
  const borrowBlocked = reserveBlockReason(debtReserve, snapshot.riskPaused, "borrow");
  const collateralState = !collPos ? "unknown" : collPos.collateral === 0n ? "none" : collPos.isCollateralEnabled ? "enabled" : "deposited";
  const capHeadroom = debtData.config.borrowCap > debtData.totalDebtAssets ? debtData.config.borrowCap - debtData.totalDebtAssets : 0n;

  const borrowPrecondition =
    borrowBlocked ??
    (!debtPos || !walletPosition ? `Connect a wallet on ${market.networkName} to borrow.` : null) ??
    (debtReserve.oracle.state !== "fresh" ? `The ${debtSymbol} oracle price is ${oracleLabel(debtReserve.oracle.state).toLowerCase()}. Borrowing is blocked until it is fresh.` : null) ??
    (walletPosition?.riskMetricsState === "blocked-by-oracle" ? "A price your position depends on is not fresh, so the pool cannot compute your risk. Borrowing is blocked." : null) ??
    (account && account.ltvCapacityWad === 0n ? "No collateral is enabled yet. Deposit collateral, then enable it with a proof." : null) ??
    (maxBorrowable === 0n ? "There is no borrowing capacity or free liquidity for this asset right now." : null) ??
    (!proofValue ? "Borrowing needs a locally verified policy-3 proof. Generate one in the Eligibility card first." : null);

  return (
    <section className="panel panel--ticks protocol-panel lendv2-borrow" aria-labelledby="lendv2-borrow-heading">
      <div className="protocol-panel__head">
        <h2 id="lendv2-borrow-heading">Borrow {debtSymbol}</h2>
        <Chip tone={risk.band === "liquidatable" ? "invalid" : risk.band === "above-limit" ? "warn" : risk.band === "unavailable" ? "neutral" : "valid"}>{risk.label}</Chip>
      </div>
      <p className="protocol-copy">
        You borrow against collateral you deposit. A private proof shows eligibility only; it never sets an amount.
        The pool limits every loan by your collateral, its loan-to-value limit, free liquidity, the borrow cap and a fresh oracle price.
      </p>

      <h3 className="lend-subhead">Your borrowing situation</h3>
      <dl className="lendv2-metrics">
        <Metric label="Collateral value (enabled)">{account ? `${formatWad(account.collateralValueWad)} units` : walletPosition?.riskMetricsState === "blocked-by-oracle" ? "Blocked by the oracle" : "Connect a wallet"}</Metric>
        <Metric label="Borrowing capacity">{account ? `${formatWad(account.ltvCapacityWad)} units` : "Unavailable"}</Metric>
        <Metric label="Existing debt (all assets)">{account ? `${formatWad(account.debtValueWad)} units` : "Unavailable"}</Metric>
        <Metric label={`Your ${debtSymbol} debt`} note="Includes interest accrued up to the block read.">{debtPos ? `${formatAmount(debtPos.debt, debtReserve.decimals)} ${debtSymbol}` : "Connect a wallet"}</Metric>
        <Metric label={`You can borrow now (${debtSymbol})`} note="Capped by capacity, free liquidity and the borrow cap.">
          {maxBorrowable === undefined ? "Unavailable" : `${formatAmount(maxBorrowable, debtReserve.decimals)} ${debtSymbol}`}
        </Metric>
        <Metric label="Available liquidity">{formatAmount(debtData.availableLiquidity, debtReserve.decimals)} {debtSymbol}</Metric>
        <Metric label="Borrow cap room">{formatAmount(capHeadroom, debtReserve.decimals)} {debtSymbol}</Metric>
        <Metric label="Borrow rate (APR)" note="Variable. Not compounded.">{formatBps(debtData.currentBorrowRateBps)}</Metric>
        <Metric label="Maximum LTV">{formatBps(collData.config.maxLtvBps)} <span className="muted">({collSymbol} collateral)</span></Metric>
        <Metric label="Liquidation threshold">{formatBps(collData.config.liquidationThresholdBps)} <span className="muted">({collSymbol} collateral)</span></Metric>
        <Metric label="Current LTV">{account ? (account.debtValueWad === 0n ? "No debt" : formatBps(account.currentLtvBps)) : "Unavailable"}</Metric>
        <Metric label="Health factor">
          {account ? formatHealthFactor(account.healthFactorWad) : "Unavailable"}
          {risk.limitUsageBps !== undefined && <Meter bps={risk.limitUsageBps > 10_000n ? 10_000n : risk.limitUsageBps} label="Borrowing limit used" tone={risk.band === "within-limit" ? undefined : "warn"} />}
        </Metric>
        <Metric label="Oracle">
          <Chip tone={oracleTone(debtReserve.oracle.state)}>{oracleLabel(debtReserve.oracle.state)}</Chip>
          {oracleAge !== undefined && <span className="muted"> {ageText(oracleAge)} old</span>}
        </Metric>
        <Metric label="Eligibility"><Chip tone={proofValue ? "valid" : "demo"}>{proofValue ? "Proof ready" : "Proof needed"}</Chip></Metric>
      </dl>
      <p className="xsmall muted">{risk.detail}</p>

      <ol className="lend-steps">
        <li className="lend-step" data-done={collateralState === "enabled" ? "true" : undefined}>
          <header className="lend-step__head">
            <span className="lend-step__n" aria-hidden="true">{collateralState === "enabled" ? "✓" : 1}</span>
            <h3>Collateral</h3>
            <Chip tone={collateralState === "enabled" ? "valid" : collateralState === "deposited" ? "warn" : "neutral"}>
              {collateralState === "enabled" ? "Enabled as collateral" : collateralState === "deposited" ? "Deposited, not enabled" : collateralState === "none" ? "None deposited" : "Connect a wallet"}
            </Chip>
          </header>
          <div className="lend-step__body">
            <AssetPicker
              legend="Collateral asset"
              reserves={collaterals}
              value={collReserve.asset}
              onChange={onCollateralAsset}
              disabledReason={(item) => reserveBlockReason(item, snapshot.riskPaused, "collateral")}
            />
            <dl className="lendv2-metrics">
              <Metric label={`Your ${collSymbol} balance`}>{collPos ? formatAmount(collPos.walletBalance, collReserve.decimals) : "Connect a wallet"}</Metric>
              <Metric label="Approved for the pool">{collPos ? formatAmount(collPos.allowance, collReserve.decimals) : "Connect a wallet"}</Metric>
              <Metric label="Deposited collateral">{collPos ? `${formatAmount(collPos.collateral, collReserve.decimals)} ${collSymbol}` : "Connect a wallet"}</Metric>
              <Metric label="Oracle price">
                {collReserve.oracle.priceWad !== undefined && collReserve.oracle.priceWad > 0n ? `${formatWad(collReserve.oracle.priceWad)} units` : "No price"}{" "}
                <Chip tone={oracleTone(collReserve.oracle.state)}>{oracleLabel(collReserve.oracle.state)}</Chip>
              </Metric>
            </dl>
            <p className="small muted">
              Depositing collateral needs no proof. Enabling it for borrowing does, because it adds borrowing capacity. Collateral stays yours: withdraw it any time the pool&apos;s health check allows.
            </p>
            <div className="lend-actions">
              <ReviewedAction
                key={`deposit-${collReserve.asset}`}
                title="Deposit collateral"
                fieldLabel="Collateral to deposit"
                asset={{ symbol: collSymbol, decimals: collReserve.decimals }}
                verb="Deposit"
                submitLabel="Confirm deposit"
                successMessage="Collateral deposit confirmed by the receipt, the pool event and the contract readback."
                approveSuccessMessage="Approval confirmed. You can confirm the deposit now."
                balance={collPos?.walletBalance}
                allowance={collPos?.allowance}
                max={collPos?.walletBalance}
                hint="The pool needs your approval for this exact amount before it can take the tokens."
                precondition={collateralBlocked ?? (!collPos ? `Connect a wallet on ${market.networkName} to deposit.` : null)}
                onApprove={(amount) => market.approveToken(collReserve.asset, amount)}
                onSubmit={(amount) => market.depositCollateral(collReserve.asset, amount)}
                review={(amount) => (
                  <dl className="kv protocol-kv">
                    <div className="kv__row"><dt>You deposit</dt><dd>{formatAmount(amount, collReserve.decimals)} {collSymbol}</dd></div>
                    <div className="kv__row"><dt>Deposited collateral after</dt><dd>{collPos ? `${formatAmount(collPos.collateral + amount, collReserve.decimals)} ${collSymbol}` : "—"}</dd></div>
                    <div className="kv__row"><dt>Counts for borrowing</dt><dd>Only after you enable it with a proof</dd></div>
                  </dl>
                )}
                runner={runner}
              />
              <div className="lend-action lendv2-action">
                <h3 className="lend-action__title">Enable as collateral</h3>
                <p className="small muted">
                  {collateralState === "enabled"
                    ? `${collSymbol} already counts toward your borrowing capacity.`
                    : "Turns your deposited collateral into borrowing capacity. Needs a locally verified policy-3 proof; the pool verifies it again."}
                </p>
                <div className="protocol-actions lend-action__buttons">
                  <button
                    className="btn btn--primary"
                    type="button"
                    disabled={Boolean(runner.block) || runner.busy || collateralState !== "deposited" || !proofValue || Boolean(collateralBlocked) || snapshot.riskPaused}
                    onClick={() => {
                      if (!proofValue) return;
                      void runner.run(`Enable ${collSymbol} as collateral`, () => market.enableCollateral(collReserve.asset, proofValue), "Collateral enabled, confirmed by the receipt, the pool event and the contract readback.");
                    }}
                  >
                    {runner.busy ? "Transaction in progress…" : `Enable ${collSymbol} as collateral`}
                  </button>
                </div>
                <p className="lend-reason" role="status">
                  {runner.block ?? collateralBlocked ??
                    (snapshot.riskPaused ? "Risk-increasing actions are paused in this pool." : null) ??
                    (collateralState === "none" ? "Deposit collateral first." : collateralState === "enabled" ? null : !proofValue ? "Generate a policy-3 proof in the Eligibility card first." : null)}
                </p>
              </div>
            </div>
          </div>
        </li>

        <li className="lend-step">
          <header className="lend-step__head">
            <span className="lend-step__n" aria-hidden="true">2</span>
            <h3>Borrow</h3>
          </header>
          <div className="lend-step__body">
            <AssetPicker
              legend="Asset to borrow"
              reserves={borrowables}
              value={debtReserve.asset}
              onChange={onBorrowAsset}
              disabledReason={(item) => reserveBlockReason(item, snapshot.riskPaused, "borrow")}
            />
            <ReviewedAction
              key={`borrow-${debtReserve.asset}`}
              title="Borrow"
              fieldLabel="Amount to borrow"
              asset={{ symbol: debtSymbol, decimals: debtReserve.decimals }}
              verb="Borrow"
              submitLabel="Confirm borrow"
              successMessage="Borrow confirmed by the receipt, the pool event and the contract readback. The debt is recorded on-chain."
              max={maxBorrowable}
              hint={maxBorrowable === undefined ? "The maximum is unavailable until every price your position needs is fresh." : `Up to ${formatAmount(maxBorrowable, debtReserve.decimals)} ${debtSymbol} right now. Variable rate: ${formatBps(debtData.currentBorrowRateBps)} APR.`}
              precondition={borrowPrecondition}
              checkAmount={(amount) =>
                amount < debtData.config.minBorrowAmount
                  ? `The minimum borrow for ${debtSymbol} is ${formatAmount(debtData.config.minBorrowAmount, debtReserve.decimals)}.`
                  : maxBorrowable !== undefined && amount > maxBorrowable
                    ? `This is more than you can borrow now (${formatAmount(maxBorrowable, debtReserve.decimals)} ${debtSymbol}).`
                    : amount > debtData.availableLiquidity
                      ? `Only ${formatAmount(debtData.availableLiquidity, debtReserve.decimals)} ${debtSymbol} is available in the pool.`
                      : null}
              onSubmit={(amount) => {
                if (!proofValue) return Promise.reject(new ProtocolError("INVALID_PROOF", "Generate a policy-3 proof first."));
                return market.borrow(debtReserve.asset, amount, proofValue);
              }}
              review={(amount) => {
                const preview = account && debtReserve.oracle.priceWad !== undefined && debtReserve.oracle.state === "fresh"
                  ? previewBorrow({ account, priceWad: debtReserve.oracle.priceWad, decimals: debtReserve.decimals, amount })
                  : undefined;
                return (
                  <>
                    <dl className="kv protocol-kv">
                      <div className="kv__row"><dt>You borrow</dt><dd>{formatAmount(amount, debtReserve.decimals)} {debtSymbol}</dd></div>
                      <div className="kv__row"><dt>Your {debtSymbol} debt after</dt><dd>{debtPos ? `${formatAmount(debtPos.debt + amount, debtReserve.decimals)} ${debtSymbol}` : "—"} <span className="muted">(then grows with interest)</span></dd></div>
                      <div className="kv__row"><dt>Borrow rate</dt><dd>{formatBps(debtData.currentBorrowRateBps)} APR, variable</dd></div>
                      <div className="kv__row"><dt>Health factor now</dt><dd>{account ? formatHealthFactor(account.healthFactorWad) : "Unavailable"}</dd></div>
                      <div className="kv__row"><dt>Health factor after (estimate)</dt><dd>{preview ? formatHealthFactor(preview.healthFactorRay) : "Unavailable"}</dd></div>
                      <div className="kv__row"><dt>Borrowing limit used after (estimate)</dt><dd>{preview?.limitUsageBps !== undefined ? formatBps(preview.limitUsageBps) : "Unavailable"}</dd></div>
                      <div className="kv__row"><dt>Authorization</dt><dd>Policy-3 Project Test Credential proof, verified again by the pool</dd></div>
                    </dl>
                    {preview && !preview.withinLimit && (
                      <p className="callout callout--caution protocol-notice" role="alert">This would take debt above your borrowing limit. The pool will reject it.</p>
                    )}
                    {preview && preview.withinLimit && preview.limitUsageBps !== undefined && preview.limitUsageBps >= 9_000n && (
                      <p className="callout callout--caution protocol-notice" role="status">This uses {formatBps(preview.limitUsageBps)} of your borrowing limit. A small price move could make the position liquidatable.</p>
                    )}
                    <p className="xsmall muted">
                      Estimates use the prices and valuations the pool just reported. They are not outcomes: the contract simulates this transaction before your wallet opens and enforces the real limits.
                    </p>
                  </>
                );
              }}
              runner={runner}
            />
          </div>
        </li>
      </ol>
    </section>
  );
}
