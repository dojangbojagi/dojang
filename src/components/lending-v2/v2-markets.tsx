"use client";

import type { Address } from "viem";
import { formatAmount, shortAddress } from "@/components/lending/format";
import { Chip, Meter, Metric, Unavailable } from "@/components/lending-v2/v2-parts";
import {
  ageText, formatBps, formatWad, oracleLabel, oracleTone, reserveBlockReason, reserveStatus, usageBps,
} from "@/components/lending-v2/v2-format";
import type { V2Market, V2Reserve, V2Snapshot } from "@/components/lending-v2/v2-types";
import { ROBINHOOD_TESTNET_EXPLORER_URL } from "@/lib/config/robinhood-testnet";

function ReserveCard({ reserve, snapshot, onOpen }: {
  reserve: V2Reserve;
  snapshot: V2Snapshot;
  onOpen: (tab: "supply" | "borrow", asset: Address) => void;
}) {
  const { data, oracle, symbol, decimals } = reserve;
  const { config } = data;
  const status = reserveStatus(reserve, snapshot.riskPaused);
  const supplyReason = reserveBlockReason(reserve, snapshot.riskPaused, "supply");
  const borrowReason = reserveBlockReason(reserve, snapshot.riskPaused, "borrow");
  const supplyUse = config.supplyEnabled ? usageBps(data.totalSupplyAssets, config.supplyCap) : null;
  const borrowUse = config.borrowEnabled ? usageBps(data.totalDebtAssets, config.borrowCap) : null;
  const age = oracle.updatedAt !== undefined && oracle.updatedAt > 0n && oracle.updatedAt <= snapshot.blockTimestamp
    ? snapshot.blockTimestamp - oracle.updatedAt
    : undefined;

  return (
    <article className="panel panel--ticks lendv2-reserve" aria-labelledby={`lendv2-res-${reserve.asset}`}>
      <header className="lendv2-reserve__head">
        <div>
          <h3 id={`lendv2-res-${reserve.asset}`}>{symbol}</h3>
          <a className="addr muted" href={`${ROBINHOOD_TESTNET_EXPLORER_URL}/address/${reserve.asset}`} target="_blank" rel="noopener noreferrer">
            {shortAddress(reserve.asset)}<span className="visually-hidden"> (token on the explorer, opens in a new tab)</span>
          </a>
        </div>
        <Chip tone={status.tone}>{status.label}</Chip>
      </header>

      <ul className="lendv2-roles" aria-label={`What ${symbol} can be used for`}>
        <li data-on={config.supplyEnabled ? "true" : "false"}>Supply {config.supplyEnabled ? "on" : "off"}</li>
        <li data-on={config.borrowEnabled ? "true" : "false"}>Borrow {config.borrowEnabled ? "on" : "off"}</li>
        <li data-on={config.collateralEnabled ? "true" : "false"}>Collateral {config.collateralEnabled ? "on" : "off"}</li>
      </ul>

      <dl className="lendv2-metrics">
        <Metric label="Total supplied">{formatAmount(data.totalSupplyAssets, decimals)} {symbol}</Metric>
        <Metric label="Total borrowed">{formatAmount(data.totalDebtAssets, decimals)} {symbol}</Metric>
        <Metric label="Available liquidity">{formatAmount(data.availableLiquidity, decimals)} {symbol}</Metric>
        <Metric label="Utilization">
          {formatBps(data.utilizationBps)}
          <Meter bps={data.utilizationBps > 10_000n ? 10_000n : data.utilizationBps} label="Utilization" />
        </Metric>
        <Metric label="Supply rate (APR)" note="Variable. Not compounded.">{formatBps(data.currentSupplyRateBps)}</Metric>
        <Metric label="Borrow rate (APR)" note="Variable. Not compounded.">{formatBps(data.currentBorrowRateBps)}</Metric>
        <Metric label="Maximum LTV">{config.collateralEnabled ? formatBps(config.maxLtvBps) : "Not collateral"}</Metric>
        <Metric label="Liquidation threshold">{config.collateralEnabled ? formatBps(config.liquidationThresholdBps) : "Not collateral"}</Metric>
        <Metric label="Liquidation bonus">{config.collateralEnabled ? formatBps(config.liquidationBonusBps) : "Not collateral"}</Metric>
        <Metric label="Close factor">{config.borrowEnabled ? formatBps(config.closeFactorBps) : "Not borrowable"}</Metric>
        <Metric label="Reserve factor">{formatBps(config.reserveFactorBps)}</Metric>
        <Metric label="Minimum borrow">{config.borrowEnabled ? `${formatAmount(config.minBorrowAmount, decimals)} ${symbol}` : "Not borrowable"}</Metric>
      </dl>

      <div className="lendv2-caps">
        <p className="lendv2-caps__row">
          <span>Supply cap</span>
          <span>
            {config.supplyEnabled
              ? `${formatAmount(data.totalSupplyAssets, decimals)} of ${formatAmount(config.supplyCap, decimals)} ${symbol}`
              : "Supplying is off"}
          </span>
          <Meter bps={supplyUse} label="Supply cap used" tone={supplyUse !== null && supplyUse >= 9_000n ? "warn" : undefined} />
        </p>
        <p className="lendv2-caps__row">
          <span>Borrow cap</span>
          <span>
            {config.borrowEnabled
              ? `${formatAmount(data.totalDebtAssets, decimals)} of ${formatAmount(config.borrowCap, decimals)} ${symbol}`
              : "Borrowing is off"}
          </span>
          <Meter bps={borrowUse} label="Borrow cap used" tone={borrowUse !== null && borrowUse >= 9_000n ? "warn" : undefined} />
        </p>
        <p className="lendv2-caps__row">
          <span>Collateral cap</span>
          <span>{config.collateralEnabled ? `${formatAmount(config.collateralCap, decimals)} ${symbol} (usage is not exposed by the pool views)` : "Not accepted as collateral"}</span>
        </p>
      </div>

      <div className="lendv2-oracle">
        <p className="lendv2-oracle__row">
          <span>Oracle price</span>
          <strong>{oracle.priceWad !== undefined && oracle.priceWad > 0n ? `${formatWad(oracle.priceWad)} units / ${symbol}` : "No price"}</strong>
          <Chip tone={oracleTone(oracle.state)}>{oracleLabel(oracle.state)}</Chip>
        </p>
        <p className="xsmall muted">
          {age !== undefined
            ? `Updated ${ageText(age)} before the block read; this reserve accepts prices up to ${ageText(config.maxOracleAge)} old.`
            : `This reserve accepts prices up to ${ageText(config.maxOracleAge)} old.`}{" "}
          A controlled test oracle: the price is set by the project, it is not a market price.
        </p>
      </div>

      <div className="protocol-actions lendv2-reserve__actions">
        <button className="btn btn--secondary btn--sm" type="button" disabled={Boolean(supplyReason)} onClick={() => onOpen("supply", reserve.asset)}>Supply {symbol}</button>
        <button className="btn btn--secondary btn--sm" type="button" disabled={Boolean(borrowReason)} onClick={() => onOpen("borrow", reserve.asset)}>Borrow {symbol}</button>
      </div>
      {(supplyReason || borrowReason) && (
        <p className="xsmall muted">{[supplyReason && `Supply: ${supplyReason}`, borrowReason && `Borrow: ${borrowReason}`].filter(Boolean).join(" ")}</p>
      )}
    </article>
  );
}

/** The markets: every reserve the pool lists, with what the pool and the oracle report and nothing else. */
export function MarketsView({ market, onOpen }: { market: V2Market; onOpen: (tab: "supply" | "borrow", asset: Address) => void }) {
  const snapshot = market.snapshot;
  if (!snapshot) {
    return (
      <section className="panel panel--ticks protocol-panel" aria-labelledby="lendv2-markets-heading">
        <div className="protocol-panel__head"><h2 id="lendv2-markets-heading">Markets</h2></div>
        <Unavailable title={market.state === "checking" ? "Reading the pool…" : market.state === "unconfigured" ? "Market data will appear after the testnet contracts are deployed" : "Market data is not available"}>
          <p>Each supported asset will show its supplied liquidity, outstanding borrowing, utilization, supply and borrow rates, caps, loan-to-value limits, and the oracle price with its age. None of it is shown until it can be read from a deployed Lending V2 pool.</p>
          <p className="xsmall muted">No prices, rates, volumes or balances are displayed in its place.</p>
        </Unavailable>
      </section>
    );
  }
  const live = snapshot.reserves.filter((reserve) => reserve.data.config.active).length;
  return (
    <section aria-labelledby="lendv2-markets-heading" className="lendv2-markets">
      <div className="panel panel--ticks protocol-panel">
        <div className="protocol-panel__head">
          <h2 id="lendv2-markets-heading">Markets</h2>
          <Chip tone={snapshot.riskPaused ? "warn" : "valid"}>{snapshot.riskPaused ? "Risk-increasing actions paused" : "Pool accepting actions"}</Chip>
        </div>
        <dl className="lendv2-metrics lendv2-metrics--summary">
          <Metric label="Supported assets">{snapshot.reserves.length}</Metric>
          <Metric label="Active reserves">{live}</Metric>
          <Metric label="Read at block">{snapshot.blockNumber.toString()}</Metric>
          <Metric label="Policy">{`${snapshot.policyId.toString()} · version ${snapshot.policyVersion.toString()} · threshold ${snapshot.threshold.toString()}`}</Metric>
        </dl>
        <p className="xsmall muted">
          Read directly from the Lending V2 pool at one block. Rates are the pool&apos;s current variable annual rates; interest accrues linearly, not compounded.
        </p>
      </div>
      {snapshot.reserves.length === 0 ? (
        <Unavailable title="This pool lists no reserves yet">
          <p>The pool is deployed but no asset has been configured, so there is nothing to supply or borrow.</p>
        </Unavailable>
      ) : (
        <div className="lendv2-reserves">
          {snapshot.reserves.map((reserve) => (
            <ReserveCard key={reserve.asset} reserve={reserve} snapshot={snapshot} onOpen={onOpen} />
          ))}
        </div>
      )}
    </section>
  );
}
