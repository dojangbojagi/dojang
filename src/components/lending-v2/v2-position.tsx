"use client";

import { maxUint256, type Address } from "viem";
import { formatAmount, minBigint } from "@/components/lending/format";
import type { ActionRunner } from "@/components/lending/types";
import { AssetPicker } from "@/components/lending-v2/v2-asset-picker";
import { formatBps, formatHealthFactor, formatWad, dateTimeText } from "@/components/lending-v2/v2-format";
import { Chip, Meter, Metric, Unavailable } from "@/components/lending-v2/v2-parts";
import { ReviewedAction } from "@/components/lending-v2/reviewed-action";
import { classifyPosition, repayAllowanceHeadroom } from "@/components/lending-v2/v2-risk";
import { positionOf, type V2Market } from "@/components/lending-v2/v2-types";

/** Your position: what the pool reports for this wallet, and the safe-exit actions that never need a credential. */
export function PositionView({ market, runner, asset, onAsset }: {
  market: V2Market;
  runner: ActionRunner;
  asset: Address | undefined;
  onAsset: (asset: Address) => void;
}) {
  const snapshot = market.snapshot;
  const walletPosition = snapshot?.position;

  if (!snapshot) {
    return (
      <section className="panel panel--ticks protocol-panel" aria-labelledby="lendv2-position-heading">
        <div className="protocol-panel__head"><h2 id="lendv2-position-heading">Your position</h2></div>
        <Unavailable title={market.state === "checking" ? "Reading your position…" : "Your position is unavailable"}>
          <p>Supplied assets, collateral, debt, health factor and borrowing power appear once a Lending V2 pool can be read and a wallet is connected. Nothing is estimated while it is unavailable.</p>
        </Unavailable>
      </section>
    );
  }
  if (!walletPosition) {
    return (
      <section className="panel panel--ticks protocol-panel" aria-labelledby="lendv2-position-heading">
        <div className="protocol-panel__head"><h2 id="lendv2-position-heading">Your position</h2></div>
        <Unavailable title="Connect a wallet to see your position">
          <p>The pool is readable, but a position belongs to a wallet. Connect one on Robinhood Chain Testnet to see what you supplied, deposited and owe.</p>
        </Unavailable>
      </section>
    );
  }

  const risk = classifyPosition(walletPosition);
  const account = walletPosition.account;
  const rows = snapshot.reserves.map((reserve) => ({ reserve, position: positionOf(snapshot, reserve) }));
  const holds = (row: (typeof rows)[number]) =>
    Boolean(row.position && (row.position.supplied > 0n || row.position.collateral > 0n || row.position.debt > 0n));
  const selected = rows.find((row) => row.reserve.asset.toLowerCase() === asset?.toLowerCase()) ?? rows.find(holds) ?? rows[0];
  const reserve = selected?.reserve;
  const position = selected?.position;
  const borrowingPower = account && account.ltvCapacityWad > account.debtValueWad ? account.ltvCapacityWad - account.debtValueWad : 0n;
  const anyDebt = rows.some((row) => (row.position?.debt ?? 0n) > 0n);
  const bandTone = risk.band === "liquidatable" ? "invalid" : risk.band === "above-limit" ? "warn" : risk.band === "unavailable" ? "neutral" : "valid";

  return (
    <section className="lendv2-position" aria-labelledby="lendv2-position-heading">
      <div className="panel panel--ticks protocol-panel">
        <div className="protocol-panel__head">
          <h2 id="lendv2-position-heading">Your position</h2>
          <Chip tone={bandTone}>{risk.label}</Chip>
        </div>
        <p className="small">{risk.detail}</p>
        <dl className="lendv2-metrics">
          <Metric label="Total collateral value (enabled)">{account ? `${formatWad(account.collateralValueWad)} units` : "Unavailable"}</Metric>
          <Metric label="Total debt value">{account ? `${formatWad(account.debtValueWad)} units` : "Unavailable"}</Metric>
          <Metric label="Borrowing power left">{account ? `${formatWad(borrowingPower)} units` : "Unavailable"}</Metric>
          <Metric label="Current LTV">{account ? (account.debtValueWad === 0n ? "No debt" : formatBps(account.currentLtvBps)) : "Unavailable"}</Metric>
          <Metric label="Health factor" note="Below 1.0 the position can be liquidated.">{account ? formatHealthFactor(account.healthFactorWad) : "Unavailable"}</Metric>
          <Metric label="Liquidation value" note="Collateral weighted by each reserve's liquidation threshold.">{account ? `${formatWad(account.liquidationValueWad)} units` : "Unavailable"}</Metric>
          <Metric label="Borrowing limit used">
            {risk.limitUsageBps !== undefined ? formatBps(risk.limitUsageBps) : account && account.debtValueWad === 0n ? "No debt" : "Unavailable"}
            {risk.limitUsageBps !== undefined && <Meter bps={risk.limitUsageBps > 10_000n ? 10_000n : risk.limitUsageBps} label="Borrowing limit used" tone={risk.band === "within-limit" ? undefined : "warn"} />}
          </Metric>
          <Metric label="Collateral value buffer (estimate)" note="How far collateral value could fall, at liquidation weights, before health factor reaches 1.0.">
            {risk.bufferBps !== undefined ? formatBps(risk.bufferBps) : "Not applicable"}
          </Metric>
        </dl>
        <p className="xsmall muted">
          Read at block {snapshot.blockNumber.toString()} · {dateTimeText(snapshot.blockTimestamp)}. Accrued interest is not exposed as a separate number by the pool&apos;s views;
          the debt and supplied amounts below already include interest accrued to that block.
        </p>
        <div className="protocol-actions">
          <button className="btn btn--secondary btn--sm" type="button" onClick={() => void market.refetch()}>Refresh position</button>
        </div>
      </div>

      <div className="panel panel--ticks protocol-panel">
        <div className="protocol-panel__head"><h2>Holdings by asset</h2></div>
        <div className="lendv2-table-wrap" role="region" aria-label="Holdings by asset" tabIndex={0}>
          <table className="lendv2-table">
            <thead>
              <tr><th scope="col">Asset</th><th scope="col">Supplied</th><th scope="col">Collateral</th><th scope="col">Debt</th><th scope="col">In wallet</th></tr>
            </thead>
            <tbody>
              {rows.map(({ reserve: item, position: pos }) => (
                <tr key={item.asset}>
                  <th scope="row">{item.symbol}</th>
                  <td>{pos ? formatAmount(pos.supplied, item.decimals) : "—"}</td>
                  <td>
                    {pos ? formatAmount(pos.collateral, item.decimals) : "—"}
                    {pos && pos.collateral > 0n && <span className="lendv2-tag">{pos.isCollateralEnabled ? "enabled" : "not enabled"}</span>}
                  </td>
                  <td data-strong={pos && pos.debt > 0n ? "true" : undefined}>{pos ? formatAmount(pos.debt, item.decimals) : "—"}</td>
                  <td>{pos ? formatAmount(pos.walletBalance, item.decimals) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {reserve && (
        <div className="panel panel--ticks protocol-panel">
          <div className="protocol-panel__head"><h2>Manage {reserve.symbol}</h2></div>
          <AssetPicker legend="Asset to manage" reserves={snapshot.reserves} value={reserve.asset} onChange={onAsset} />
          <p className="small muted">
            Repaying and withdrawing never need a current credential or a proof, so these exits stay open if a credential expires or the issuer is offline.
            The pool still enforces its own health and liquidity checks on every withdrawal.
          </p>
          <div className="lend-actions">
            <ReviewedAction
              key={`repay-${reserve.asset}`}
              title="Repay debt"
              fieldLabel="Amount to repay"
              asset={{ symbol: reserve.symbol, decimals: reserve.decimals }}
              verb="Repay"
              fullVerb="Repay in full"
              submitLabel="Confirm repayment"
              successMessage="Repayment confirmed by the receipt, the pool event and the contract readback."
              approveSuccessMessage="Approval confirmed. You can confirm the repayment now."
              balance={position?.walletBalance}
              allowance={position?.allowance}
              max={position ? minBigint(position.debt, position.walletBalance) : undefined}
              maxMeansFull={Boolean(position && position.walletBalance >= position.debt)}
              hint={position ? `You owe ${formatAmount(position.debt, reserve.decimals)} ${reserve.symbol}, including interest accrued to the block read. Max repays the whole debt, including interest that accrues while the transaction confirms.` : undefined}
              precondition={!position ? "Connect a wallet on Robinhood Chain Testnet to repay." : position.debt === 0n ? `You have no ${reserve.symbol} debt.` : null}
              checkAmount={(amount) => position && amount > position.debt ? `This is more than your debt (${formatAmount(position.debt, reserve.decimals)} ${reserve.symbol}).` : null}
              requiredAllowance={(amount, flags) => position && flags.max ? position.debt + repayAllowanceHeadroom(position.debt, reserve.data.currentBorrowRateBps) : amount}
              approveAmount={(amount, flags) => position && flags.max ? position.debt + repayAllowanceHeadroom(position.debt, reserve.data.currentBorrowRateBps) : amount}
              onApprove={(amount) => market.approveToken(reserve.asset, amount)}
              onSubmit={(amount, flags) => market.repay(reserve.asset, flags.max ? maxUint256 : amount)}
              review={(amount, flags) => (
                <dl className="kv protocol-kv">
                  <div className="kv__row"><dt>{flags.max ? "You repay in full" : "You repay"}</dt><dd>{formatAmount(amount, reserve.decimals)} {reserve.symbol}{flags.max ? " and any interest accrued until it confirms" : ""}</dd></div>
                  <div className="kv__row"><dt>Debt after</dt><dd>{position ? (flags.max ? `0 ${reserve.symbol}` : `${formatAmount(position.debt > amount ? position.debt - amount : 0n, reserve.decimals)} ${reserve.symbol}`) : "—"}</dd></div>
                  {flags.max && position && (
                    <div className="kv__row"><dt>Approval requested</dt><dd>{formatAmount(position.debt + repayAllowanceHeadroom(position.debt, reserve.data.currentBorrowRateBps), reserve.decimals)} {reserve.symbol} <span className="muted">(covers interest while it confirms; the pool takes only the real debt)</span></dd></div>
                  )}
                  {flags.max && position && position.walletBalance < position.debt + repayAllowanceHeadroom(position.debt, reserve.data.currentBorrowRateBps) && (
                    <div className="kv__row"><dt>Wallet margin</dt><dd>Your balance is close to the debt. If interest accrues past it before confirmation, the transfer will be refused and nothing changes.</dd></div>
                  )}
                  <div className="kv__row"><dt>Needs a proof or credential</dt><dd>No. Repaying is always open.</dd></div>
                </dl>
              )}
              runner={runner}
            />
            <ReviewedAction
              key={`withdraw-supply-${reserve.asset}`}
              title="Withdraw supply"
              fieldLabel="Amount to withdraw"
              asset={{ symbol: reserve.symbol, decimals: reserve.decimals }}
              verb="Withdraw"
              submitLabel="Confirm withdrawal"
              successMessage="Withdrawal confirmed by the receipt, the pool event and the contract readback."
              max={position ? minBigint(position.supplied, reserve.data.availableLiquidity) : undefined}
              hint={position ? `You supplied ${formatAmount(position.supplied, reserve.decimals)} ${reserve.symbol}; ${formatAmount(reserve.data.availableLiquidity, reserve.decimals)} is not lent out.` : undefined}
              precondition={!position ? "Connect a wallet on Robinhood Chain Testnet to withdraw." : position.supplied === 0n ? `You have no supplied ${reserve.symbol}.` : null}
              checkAmount={(amount) =>
                position && amount > position.supplied
                  ? `This is more than your supplied position (${formatAmount(position.supplied, reserve.decimals)} ${reserve.symbol}).`
                  : amount > reserve.data.availableLiquidity
                    ? `Only ${formatAmount(reserve.data.availableLiquidity, reserve.decimals)} ${reserve.symbol} is not lent out right now.`
                    : null}
              onSubmit={(amount) => market.withdrawSupply(reserve.asset, amount)}
              runner={runner}
              tone="secondary"
            />
            <ReviewedAction
              key={`withdraw-collateral-${reserve.asset}`}
              title="Withdraw collateral"
              fieldLabel="Collateral to withdraw"
              asset={{ symbol: reserve.symbol, decimals: reserve.decimals }}
              verb="Withdraw collateral"
              submitLabel="Confirm collateral withdrawal"
              successMessage="Collateral withdrawal confirmed by the receipt, the pool event and the contract readback."
              max={position && !anyDebt ? position.collateral : undefined}
              hint={!anyDebt
                ? "No debt: all of your deposited collateral can come out."
                : "While you owe debt, only collateral beyond what the loan needs can come out. The pool checks every withdrawal and rejects an unsafe one. Repay to release more."}
              precondition={!position ? "Connect a wallet on Robinhood Chain Testnet to withdraw." : position.collateral === 0n ? `You have no deposited ${reserve.symbol} collateral.` : null}
              checkAmount={(amount) => position && amount > position.collateral ? `This is more than your deposited collateral (${formatAmount(position.collateral, reserve.decimals)} ${reserve.symbol}).` : null}
              onSubmit={(amount) => market.withdrawCollateral(reserve.asset, amount)}
              runner={runner}
              tone="secondary"
            />
            <div className="lend-action lendv2-action">
              <h3 className="lend-action__title">Collateral use</h3>
              <p className="small muted">
                {position?.isCollateralEnabled
                  ? `${reserve.symbol} currently counts toward your borrowing capacity. Turning it off removes that capacity and is refused if it would leave the position unsafe.`
                  : `${reserve.symbol} is not counted toward your borrowing capacity. Enabling it needs a proof; do that in the Borrow tab.`}
              </p>
              <div className="protocol-actions lend-action__buttons">
                <button
                  className="btn btn--secondary"
                  type="button"
                  disabled={Boolean(runner.block) || runner.busy || !position?.isCollateralEnabled || snapshot.riskPaused}
                  onClick={() => void runner.run(`Disable ${reserve.symbol} as collateral`, () => market.disableCollateral(reserve.asset), "Collateral use turned off, confirmed by the receipt, the pool event and the contract readback.")}
                >
                  {runner.busy ? "Transaction in progress…" : `Disable ${reserve.symbol} as collateral`}
                </button>
              </div>
              <p className="lend-reason" role="status">
                {runner.block ?? (snapshot.riskPaused ? "Risk-increasing actions are paused; the pool also pauses changing collateral use." : !position?.isCollateralEnabled ? "This asset is not enabled as collateral." : null)}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
