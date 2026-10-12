"use client";

import Link from "next/link";
import { shortAddress } from "@/components/lending/format";
import { Chip, type Tone } from "@/components/lending-v2/v2-parts";
import type { V2Market } from "@/components/lending-v2/v2-types";
import { ROBINHOOD_TESTNET_CHAIN_ID, ROBINHOOD_TESTNET_EXPLORER_URL } from "@/lib/config/robinhood-testnet";
import { robinhoodContracts } from "@/lib/config/contracts";

/** What this market is, and is not. Always visible, never softened. */
export function V2LimitationsNotice({ configured }: { configured: boolean }) {
  return (
    <aside className="callout callout--caution lend-limits" aria-labelledby="lendv2-limits-heading">
      <div>
        <h2 id="lendv2-limits-heading" className="lend-limits__title">Testnet demonstration of Lending V2</h2>
        <ul className="lend-limits__list">
          <li><strong>Test tokens only.</strong> Not audited, not a financial product, no real assets.</li>
          <li><strong>A controlled test oracle.</strong> Prices are set by the project within bounds; they are not market prices.</li>
          <li><strong>Variable rates, simple interest.</strong> Interest accrues linearly, not compounded, and changes with utilization.</li>
          <li><strong>Project Test Credential.</strong> Eligibility uses a project-issued policy-3 credential, not an official GIWA, Dojang or Upbit credential.</li>
          <li><strong>Private eligibility only.</strong> Wallets, amounts, positions and actions are public on-chain.</li>
          {configured
            ? <li><strong>Check the address.</strong> A configured pool address is not an audit. Verify the pool and its tokens on the explorer before using it.</li>
            : <li><strong>Not yet deployed.</strong> Controls stay off until a real Lending V2 pool is configured for Robinhood Chain Testnet.</li>}
        </ul>
      </div>
    </aside>
  );
}

const STATE_COPY: Record<V2Market["state"], { tone: Tone; label: string; text: string }> = {
  unconfigured: {
    tone: "warn",
    label: "Not deployed",
    text: "Lending V2 is not live on Robinhood Chain Testnet yet. No pool address is configured (NEXT_PUBLIC_ROBINHOOD_LENDING_V2_POOL_CONTRACT), so every V2 control is off and no balance, rate, price or position is shown. Nothing is simulated.",
  },
  disconnected: { tone: "neutral", label: "Wallet needed", text: "Connect a wallet to use the market and see your position. Market data below is read without a wallet." },
  "wrong-network": { tone: "warn", label: "Wrong network", text: "Switch your wallet to Robinhood Chain Testnet to continue. Transactions are disabled until you do." },
  checking: { tone: "pending", label: "Checking", text: "Reading the Lending V2 pool and your wallet from Robinhood Chain Testnet…" },
  unavailable: { tone: "warn", label: "Unavailable", text: "The configured address is not a compatible Lending V2 deployment (missing code, mismatched policy, registry, verifier or oracle). Controls stay off." },
  "read-error": { tone: "invalid", label: "Read failed", text: "A pool or wallet read failed. This is not an empty position. Refresh to try again; nothing is shown in its place." },
  ready: { tone: "valid", label: "Market ready", text: "" },
};

export function marketStateCopy(state: V2Market["state"]) {
  return STATE_COPY[state];
}

/** Network, wallet, pool and market state in one line of facts. */
export function ContextBar({ market, walletAddress, eligibility }: {
  market: V2Market;
  walletAddress?: string;
  eligibility: { tone: Tone; label: string };
}) {
  const copy = STATE_COPY[market.state];
  const pool = robinhoodContracts.lendingV2Pool;
  return (
    <section className="lendv2-context" aria-label="Lending V2 status">
      <ul>
        <li><span>Network</span><Chip tone="demo">Robinhood Chain Testnet · {ROBINHOOD_TESTNET_CHAIN_ID}</Chip></li>
        <li><span>Wallet</span><strong className="addr">{walletAddress ? shortAddress(walletAddress) : "Not connected"}</strong></li>
        <li>
          <span>V2 pool</span>
          {pool
            ? <a className="addr" href={`${ROBINHOOD_TESTNET_EXPLORER_URL}/address/${pool}`} target="_blank" rel="noopener noreferrer">{shortAddress(pool)}<span className="visually-hidden"> (opens in a new tab)</span></a>
            : <strong>Not configured</strong>}
        </li>
        <li><span>Market</span><Chip tone={copy.tone}>{copy.label}</Chip></li>
        <li><span>Eligibility</span><Chip tone={eligibility.tone}>{eligibility.label}</Chip></li>
        <li className="lendv2-context__links">
          <Link className="protocol-inline-link" href="/dojang">Dojang ↗</Link>
          <Link className="protocol-inline-link" href="/docs">Docs ↗</Link>
          <Link className="protocol-inline-link" href="/contracts">Contracts ↗</Link>
        </li>
      </ul>
    </section>
  );
}
