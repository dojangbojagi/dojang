"use client";

import { useState } from "react";
import { isAddress, type Address } from "viem";
import { formatAmount, minBigint, shortAddress } from "@/components/lending/format";
import type { ActionRunner } from "@/components/lending/types";
import { AssetPicker } from "@/components/lending-v2/v2-asset-picker";
import { formatBps, formatHealthFactor, formatWad } from "@/components/lending-v2/v2-format";
import { Chip, Metric } from "@/components/lending-v2/v2-parts";
import { ReviewedAction } from "@/components/lending-v2/reviewed-action";
import { classifyPosition } from "@/components/lending-v2/v2-risk";
import { positionOf, type V2Market, type V2Snapshot } from "@/components/lending-v2/v2-types";
import { explainProtocolError } from "@/lib/protocol/errors";
import { mapLendingV2Error } from "@/lib/lending/v2-errors";

type Inspected = { wallet: Address; position: NonNullable<V2Snapshot["position"]> };

/**
 * Inspect any borrower and, only when the pool itself reports the position as liquidatable, repay part of its debt
 * for collateral at the reserve's bonus. Eligibility comes from the pool's own health factor; this form never
 * decides it and never lets a position be marked unhealthy by hand.
 */
export function LiquidationPanel({ market, runner }: { market: V2Market; runner: ActionRunner }) {
  const snapshot = market.snapshot;
  const [borrower, setBorrower] = useState("");
  const [inspected, setInspected] = useState<Inspected | null>(null);
  const [message, setMessage] = useState("");
  const [looking, setLooking] = useState(false);
  const [debtAsset, setDebtAsset] = useState<Address>();
  const [collateralAsset, setCollateralAsset] = useState<Address>();

  if (!snapshot) return null;

  const valid = isAddress(borrower.trim());

  async function inspect(wallet: Address) {
    setLooking(true);
    setMessage("");
    try {
      const position = await market.inspectPosition(wallet);
      if (!position) {
        setInspected(null);
        setMessage("The pool returned no position for that wallet.");
      } else {
        setInspected({ wallet, position });
      }
    } catch (cause) {
      setInspected(null);
      setMessage(cause instanceof Error && "code" in cause ? explainProtocolError(cause) : mapLendingV2Error(cause).message);
    } finally {
      setLooking(false);
    }
  }

  const risk = inspected ? classifyPosition(inspected.position) : undefined;
  const debtReserves = inspected ? snapshot.reserves.filter((reserve) => (inspected.position.byAsset[reserve.asset.toLowerCase()]?.debt ?? 0n) > 0n) : [];
  const collateralReserves = inspected
    ? snapshot.reserves.filter((reserve) => {
        const pos = inspected.position.byAsset[reserve.asset.toLowerCase()];
        return Boolean(pos && pos.collateral > 0n && pos.isCollateralEnabled);
      })
    : [];
  const debtReserve = debtReserves.find((reserve) => reserve.asset.toLowerCase() === debtAsset?.toLowerCase()) ?? debtReserves[0];
  const collReserve = collateralReserves.find((reserve) => reserve.asset.toLowerCase() === collateralAsset?.toLowerCase()) ?? collateralReserves[0];
  const borrowerDebt = debtReserve && inspected ? inspected.position.byAsset[debtReserve.asset.toLowerCase()]?.debt ?? 0n : 0n;
  const closeLimit = debtReserve ? (borrowerDebt * BigInt(debtReserve.data.config.closeFactorBps) + 9_999n) / 10_000n : 0n;
  const mine = debtReserve ? positionOf(snapshot, debtReserve) : undefined;
  const own = inspected && market.snapshot?.position?.wallet.toLowerCase() === inspected.wallet.toLowerCase();

  return (
    <details className="panel panel--ticks lendv2-liquidation">
      <summary className="protocol-inline-link">Liquidation (testnet): inspect a position and liquidate it if the pool says it is unhealthy</summary>
      <div className="lendv2-liquidation__body">
        <p className="callout callout--caution protocol-notice">
          <strong>Risk.</strong> Liquidating repays someone else&apos;s debt with your tokens and pays you collateral at the reserve&apos;s bonus. The oracle is a controlled test oracle whose price the project sets,
          so a position can become liquidatable because of a fixture change, not a market. These are test tokens with no value, and the action is irreversible once confirmed.
        </p>
        <form className="protocol-form" onSubmit={(event) => { event.preventDefault(); if (valid) void inspect(borrower.trim() as Address); }}>
          <label className="protocol-field" htmlFor="lendv2-borrower"><span>Borrower wallet address</span>
            <input id="lendv2-borrower" type="text" inputMode="text" autoComplete="off" spellCheck={false} placeholder="0x…" value={borrower} onChange={(event) => setBorrower(event.currentTarget.value)} aria-invalid={borrower !== "" && !valid ? true : undefined} />
          </label>
          {borrower !== "" && !valid && <p className="lend-field__error" role="alert">Enter a full 0x wallet address.</p>}
          <div className="protocol-actions">
            <button className="btn btn--secondary" type="submit" disabled={!valid || looking || !market.readAvailable}>{looking ? "Reading position…" : "Inspect position"}</button>
          </div>
        </form>
        {message && <p className="callout callout--caution protocol-notice" role="status">{message}</p>}

        {inspected && risk && (
          <div className="lendv2-liquidation__result" aria-live="polite">
            <div className="protocol-panel__head">
              <h3 className="lend-subhead">Position of {shortAddress(inspected.wallet)}</h3>
              <Chip tone={risk.band === "liquidatable" ? "invalid" : risk.band === "unavailable" ? "neutral" : "valid"}>{risk.label}</Chip>
            </div>
            <dl className="lendv2-metrics">
              <Metric label="Health factor">{inspected.position.account ? formatHealthFactor(inspected.position.account.healthFactorWad) : "Unavailable"}</Metric>
              <Metric label="Debt value">{inspected.position.account ? `${formatWad(inspected.position.account.debtValueWad)} units` : "Unavailable"}</Metric>
              <Metric label="Liquidation value">{inspected.position.account ? `${formatWad(inspected.position.account.liquidationValueWad)} units` : "Unavailable"}</Metric>
              <Metric label="Liquidatable now">{inspected.position.liquidationEligible === undefined ? "Unavailable" : inspected.position.liquidationEligible ? "Yes" : "No"}</Metric>
            </dl>
            <p className="xsmall muted">{risk.detail}</p>

            {own && <p className="callout callout--demo protocol-notice" role="status">This is the connected wallet. Repay your own debt in Your Position instead.</p>}

            {inspected.position.liquidationEligible === true && debtReserve && collReserve ? (
              <>
                <div className="lendv2-liquidation__pickers">
                  <AssetPicker legend="Debt asset to repay" reserves={debtReserves} value={debtReserve.asset} onChange={setDebtAsset} />
                  <AssetPicker legend="Collateral asset to receive" reserves={collateralReserves} value={collReserve.asset} onChange={setCollateralAsset} />
                </div>
                <dl className="lendv2-metrics">
                  <Metric label={`Borrower's ${debtReserve.symbol} debt`}>{formatAmount(borrowerDebt, debtReserve.decimals)} {debtReserve.symbol}</Metric>
                  <Metric label="Close-factor limit" note="From the reserve configuration; the pool enforces it.">{formatBps(debtReserve.data.config.closeFactorBps)} · up to {formatAmount(closeLimit, debtReserve.decimals)} {debtReserve.symbol}</Metric>
                  <Metric label="Liquidation bonus">{formatBps(collReserve.data.config.liquidationBonusBps)} <span className="muted">({collReserve.symbol})</span></Metric>
                </dl>
                <ReviewedAction
                  key={`liquidate-${inspected.wallet}-${debtReserve.asset}-${collReserve.asset}`}
                  title="Liquidate"
                  fieldLabel="Debt amount to repay"
                  asset={{ symbol: debtReserve.symbol, decimals: debtReserve.decimals }}
                  verb="Liquidate"
                  submitLabel="Confirm liquidation"
                  successMessage="Liquidation confirmed by the receipt, the pool event and the contract readback."
                  approveSuccessMessage="Approval confirmed. You can confirm the liquidation now."
                  balance={mine?.walletBalance}
                  allowance={mine?.allowance}
                  max={mine ? minBigint(closeLimit, mine.walletBalance) : undefined}
                  precondition={own ? "Liquidating your own position is not offered here." : !mine ? "Connect a wallet on Robinhood Chain Testnet to liquidate." : null}
                  checkAmount={(amount) => amount > closeLimit ? `The close factor limits one liquidation to ${formatAmount(closeLimit, debtReserve.decimals)} ${debtReserve.symbol}.` : null}
                  onApprove={(amount) => market.approveToken(debtReserve.asset, amount)}
                  onSubmit={async (amount) => {
                    await market.liquidate(inspected.wallet, debtReserve.asset, collReserve.asset, amount);
                    await inspect(inspected.wallet);
                  }}
                  review={(amount) => (
                    <dl className="kv protocol-kv">
                      <div className="kv__row"><dt>You repay</dt><dd>{formatAmount(amount, debtReserve.decimals)} {debtReserve.symbol} <span className="muted">(from your wallet)</span></dd></div>
                      <div className="kv__row"><dt>You receive</dt><dd>{collReserve.symbol} collateral at a {formatBps(collReserve.data.config.liquidationBonusBps)} bonus <span className="muted">(amount set by the pool at execution)</span></dd></div>
                      <div className="kv__row"><dt>Needs a proof or credential</dt><dd>No. Liquidation is permissionless.</dd></div>
                    </dl>
                  )}
                  runner={runner}
                  tone="secondary"
                />
              </>
            ) : inspected.position.liquidationEligible === false ? (
              <p className="small muted">This position is not liquidatable, so there is nothing to liquidate. The pool would reject the action.</p>
            ) : (
              <p className="small muted">Liquidation eligibility could not be determined from the pool, so no liquidation is offered.</p>
            )}
          </div>
        )}
      </div>
    </details>
  );
}
