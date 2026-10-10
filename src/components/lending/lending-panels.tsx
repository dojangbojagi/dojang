"use client";

import Link from "next/link";
import { StateChip } from "@/components/protocol-state";
import { explainLendingFailure } from "@/components/lending/errors";
import { formatAmount, shortAddress } from "@/components/lending/format";
import type { LendingMarket } from "@/components/lending/types";
import type { TransactionLifecycle } from "@/lib/protocol/types";
import { GIWA_EXPLORER_URL } from "@/lib/config/chain";
import { LENDING_INTEREST_RATE_BPS, LENDING_MAX_LTV_BPS } from "@/lib/lending/config";

export interface EvidenceEntry {
  label: string;
  hash: `0x${string}`;
  explorerUrl?: string;
}

const percent = (bps: bigint) => `${Number(bps) / 100}%`;

/** What this market is not. Always visible, never softened. */
export function LimitationsNotice() {
  return (
    <aside className="callout callout--caution lend-limits" aria-labelledby="lend-limits-heading">
      <div>
        <h2 id="lend-limits-heading" className="lend-limits__title">Testnet demonstration of one market</h2>
        <ul className="lend-limits__list">
          <li><strong>Zero interest.</strong> Debt is principal only and suppliers earn nothing.</li>
          <li><strong>Fixed 1:1 demo pricing</strong> between the two controlled test tokens.</li>
          <li><strong>No liquidation mechanism</strong> and no bad-debt handling.</li>
          <li><strong>No production oracle.</strong> The price is a constant, so collateral value means nothing outside this demo.</li>
          <li><strong>Test tokens only.</strong> Not audited, not a financial product, and not for real or volatile assets.</li>
        </ul>
      </div>
    </aside>
  );
}

const MARKET_MESSAGES = {
  unconfigured: "The lending market is unavailable: no LendingPool address is configured (NEXT_PUBLIC_LENDING_POOL_CONTRACT). Nothing is simulated, so no balances, positions or transactions are shown.",
  disconnected: "Connect a wallet to see your balances and use the market.",
  "wrong-network": "Switch your wallet to GIWA Sepolia to continue.",
  "read-error": "A market or wallet read failed. This is not an empty position. Refresh to try again.",
  checking: "Reading the market and your wallet from GIWA Sepolia…",
} as const;

export function marketMessage(state: LendingMarket["state"]): string | null {
  return state === "ready" ? null : MARKET_MESSAGES[state];
}

const SHORT_MESSAGES = {
  unconfigured: "Unavailable until a LendingPool address is configured.",
  disconnected: "Connect a wallet to see this.",
  "wrong-network": "Switch to GIWA Sepolia to see this.",
  "read-error": "A read failed. Refresh to try again.",
  checking: "Reading from GIWA Sepolia…",
} as const;

/** The same state in a few words, for the narrow panels that sit next to the full message. */
export function shortMarketMessage(state: LendingMarket["state"]): string | null {
  return state === "ready" ? null : SHORT_MESSAGES[state];
}

export function MarketOverview({ market }: { market: LendingMarket }) {
  const { summary, state } = market;
  const message = marketMessage(state);
  return (
    <section className="panel panel--ticks protocol-panel" aria-labelledby="lend-market-heading">
      <div className="protocol-panel__head">
        <h2 id="lend-market-heading">The demo market</h2>
        <StateChip state={state}>{state === "ready" ? "Market ready" : undefined}</StateChip>
      </div>
      {message && <p className={`callout ${state === "read-error" || state === "unconfigured" ? "callout--caution" : "callout--demo"}`} role="status">{message}</p>}
      {summary ? (
        <dl className="kv protocol-kv">
          <div className="kv__row"><dt>Lending asset</dt><dd>{summary.lendingAsset.symbol} <span className="addr muted">{shortAddress(summary.lendingAsset.address)}</span></dd></div>
          <div className="kv__row"><dt>Collateral asset</dt><dd>{summary.collateralAsset.symbol} <span className="addr muted">{shortAddress(summary.collateralAsset.address)}</span></dd></div>
          <div className="kv__row"><dt>Demo price</dt><dd>1 {summary.collateralAsset.symbol} = 1 {summary.lendingAsset.symbol} <span className="muted">(fixed)</span></dd></div>
          <div className="kv__row"><dt>Maximum loan-to-value</dt><dd>{percent(LENDING_MAX_LTV_BPS)}</dd></div>
          <div className="kv__row"><dt>Interest</dt><dd>{percent(LENDING_INTEREST_RATE_BPS)} <span className="muted">(none accrues)</span></dd></div>
          <div className="kv__row"><dt>Total supplied</dt><dd>{formatAmount(summary.totalSupplierLiquidity, summary.lendingAsset.decimals)} {summary.lendingAsset.symbol}</dd></div>
          <div className="kv__row"><dt>Total borrowed</dt><dd>{formatAmount(summary.totalDebt, summary.lendingAsset.decimals)} {summary.lendingAsset.symbol}</dd></div>
          <div className="kv__row"><dt>Available to borrow or withdraw</dt><dd>{formatAmount(summary.availableLiquidity, summary.lendingAsset.decimals)} {summary.lendingAsset.symbol}</dd></div>
        </dl>
      ) : state !== "unconfigured" && state !== "checking" && (
        <p className="protocol-empty">Market data is not available yet. Nothing is shown in its place.</p>
      )}
      <p className="xsmall muted">Read directly from the configured LendingPool. <Link className="protocol-inline-link" href="/contracts">Contracts ↗</Link></p>
    </section>
  );
}

export function PositionPanel({ market, gasBalance }: { market: LendingMarket; gasBalance?: bigint }) {
  const { summary, position } = market;
  const lend = summary?.lendingAsset;
  const coll = summary?.collateralAsset;
  return (
    <section className="panel panel--ticks protocol-panel" aria-labelledby="lend-position-heading">
      <div className="protocol-panel__head">
        <h2 id="lend-position-heading">Your position</h2>
      </div>
      {summary && position && lend && coll ? (
        <>
          <dl className="kv protocol-kv">
            <div className="kv__row"><dt>Supplied</dt><dd>{formatAmount(position.supplierPosition, lend.decimals)} {lend.symbol}</dd></div>
            <div className="kv__row"><dt>Collateral deposited</dt><dd>{formatAmount(position.collateralBalance, coll.decimals)} {coll.symbol}</dd></div>
            <div className="kv__row"><dt>Collateral value</dt><dd>{formatAmount(position.collateralValue, lend.decimals)} {lend.symbol}</dd></div>
            <div className="kv__row"><dt>Debt</dt><dd data-strong={position.debtBalance > 0n ? "true" : undefined}>{formatAmount(position.debtBalance, lend.decimals)} {lend.symbol}</dd></div>
            <div className="kv__row"><dt>Borrowing capacity ({percent(LENDING_MAX_LTV_BPS)} LTV)</dt><dd>{formatAmount(position.borrowingCapacity, lend.decimals)} {lend.symbol}</dd></div>
            <div className="kv__row"><dt>Remaining capacity</dt><dd>{formatAmount(position.remainingBorrowCapacity, lend.decimals)} {lend.symbol}</dd></div>
          </dl>
          <h3 className="lend-subhead">In your wallet</h3>
          <dl className="kv protocol-kv">
            <div className="kv__row"><dt>{lend.symbol}</dt><dd>{formatAmount(position.lendingAssetBalance, lend.decimals)}</dd></div>
            <div className="kv__row"><dt>{coll.symbol}</dt><dd>{formatAmount(position.collateralAssetBalance, coll.decimals)}</dd></div>
            <div className="kv__row"><dt>ETH for network fees</dt><dd>{gasBalance === undefined ? "Reading…" : formatAmount(gasBalance, 18, 5)}</dd></div>
          </dl>
          {gasBalance === 0n && <p className="callout callout--caution protocol-notice" role="status">This wallet has no GIWA Sepolia ETH, so it cannot pay the network fee for any transaction.</p>}
        </>
      ) : (
        <p className="protocol-empty">{shortMarketMessage(market.state) ?? "Your position is not available yet."}</p>
      )}
    </section>
  );
}

const STEPS = ["simulating", "awaiting-signature", "submitted", "confirming", "confirmed"] as const;
const STEP_LABEL: Record<(typeof STEPS)[number], string> = {
  simulating: "Checking the transaction",
  "awaiting-signature": "Waiting for wallet confirmation",
  submitted: "Submitted",
  confirming: "Waiting for the receipt",
  confirmed: "Confirmed and read back from the contract",
};

const FAILED_LABEL = { reverted: "Reverted on-chain", rejected: "Rejected in wallet", "rpc-error": "Not completed" } as const;

export function TransactionPanel({ transaction: tx, action, evidence }: { transaction: TransactionLifecycle; action: string; evidence: EvidenceEntry[] }) {
  const order = ["idle", ...STEPS];
  const currentIndex = order.indexOf(tx.state);
  const failed = tx.state === "reverted" || tx.state === "rejected" || tx.state === "rpc-error";
  return (
    <section className="panel panel--ticks protocol-panel" aria-labelledby="lend-tx-heading">
      <div className="protocol-panel__head">
        <h2 id="lend-tx-heading">Transaction status</h2>
        <StateChip state={tx.state}>{failed ? FAILED_LABEL[tx.state as keyof typeof FAILED_LABEL] : undefined}</StateChip>
      </div>
      {tx.state === "idle" ? (
        <p className="protocol-empty">No transaction yet in this session. Each step appears here with its receipt.</p>
      ) : (
        <div aria-live="polite">
          {action && <p className="lend-action-name">{action}</p>}
          {!failed && (
            <ol className="protocol-progress" aria-label="Transaction lifecycle">
              {STEPS.map((step, index) => (
                <li key={step} data-current={tx.state === step} data-complete={currentIndex > index + 1}>{STEP_LABEL[step]}</li>
              ))}
            </ol>
          )}
          {tx.hash && (
            <p className="protocol-copy">
              {tx.explorerUrl ? (
                <a className="protocol-transaction__link mono" href={tx.explorerUrl} target="_blank" rel="noopener noreferrer">{tx.hash}<span className="visually-hidden"> (opens in a new tab)</span></a>
              ) : (
                <span className="protocol-transaction__link mono">{tx.hash}</span>
              )}
            </p>
          )}
          {tx.error && <p className="callout callout--caution protocol-notice" role="status">{explainLendingFailure(tx.error)}</p>}
        </div>
      )}
      {evidence.length > 0 && (
        <div className="lend-evidence">
          <h3 className="lend-subhead">Confirmed this session</h3>
          <ul>
            {evidence.map((entry) => (
              <li key={entry.hash}>
                <span>{entry.label}</span>
                {entry.explorerUrl ? (
                  <a className="addr" href={entry.explorerUrl} target="_blank" rel="noopener noreferrer">{shortAddress(entry.hash)}<span className="visually-hidden"> (opens in a new tab)</span></a>
                ) : (
                  <span className="addr">{shortAddress(entry.hash)}</span>
                )}
              </li>
            ))}
          </ul>
          <p className="xsmall muted">Each entry has a successful receipt and a matching contract readback. The list lives only in this browser session. <a className="protocol-inline-link" href={GIWA_EXPLORER_URL} target="_blank" rel="noopener noreferrer">Explorer ↗</a></p>
        </div>
      )}
    </section>
  );
}
