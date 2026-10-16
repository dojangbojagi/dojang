"use client";

import Link from "next/link";
import { shortAddress } from "@/components/lending/format";
import { Chip, type Tone } from "@/components/lending-v2/v2-parts";
import type { V2Market } from "@/components/lending-v2/v2-types";
import { ROBINHOOD_MAINNET_CHAIN_ID } from "@/lib/config/robinhood-mainnet-demo";
import type { LendingV2ChainId } from "@/lib/lending/v2-network";

/** What this market is, and is not. Always visible, never softened. */
export function V2LimitationsNotice({ configured, chainId, riskPaused }: { configured: boolean; chainId: LendingV2ChainId; riskPaused?: boolean }) {
  const isMainnet = chainId === ROBINHOOD_MAINNET_CHAIN_ID;
  return (
    <aside className="callout callout--caution lend-limits" aria-labelledby="lendv2-limits-heading">
      <div>
        <h2 id="lendv2-limits-heading" className="lend-limits__title">{isMainnet ? "Robinhood Mainnet controlled demonstration" : "Testnet demonstration of Lending V2"}</h2>
        <ul className="lend-limits__list">
          <li><strong>Synthetic assets only.</strong> These capped project tokens have no redemption value and are not real assets or a financial product.</li>
          <li><strong>A controlled synthetic oracle.</strong> Prices are set by the project within bounds; they are not market prices.</li>
          <li><strong>Variable rates, simple interest.</strong> Interest accrues linearly, not compounded, and changes with utilization.</li>
          <li><strong>Project-issued credential.</strong> Eligibility uses a policy-3 GYEVO credential, not an official GIWA, Dojang or Upbit credential.</li>
          <li><strong>Private eligibility only.</strong> Wallets, amounts, positions and actions are public on-chain.</li>
          {isMainnet && riskPaused && <li><strong>Currently paused.</strong> New supply and borrowing actions are unavailable while the Mainnet pool is paused.</li>}
          {!isMainnet && (configured
            ? <li><strong>Check the address.</strong> A configured pool address is not an audit. Verify the pool and its tokens on the explorer before using it.</li>
            : <li><strong>Not yet deployed.</strong> Controls stay off until a real Lending V2 pool is configured for Robinhood Chain Testnet.</li>)}
          {isMainnet && <li><strong>Controlled access.</strong> Risk-taking pool actions are limited on-chain to the configured demo participants and remain subject to the deployed pause and risk rules. This is not public production lending.</li>}
        </ul>
        {configured && <p className="small"><Link className="protocol-inline-link" href="/contracts#verified-history">Explore confirmed contract activity</Link></p>}
      </div>
    </aside>
  );
}

const STATE_COPY: Record<V2Market["state"], { tone: Tone; label: string; text: string }> = {
  unconfigured: {
    tone: "warn",
    label: "Not deployed",
    text: "Lending V2 is not available here: no pool address is configured, so every V2 control is off and no balance, rate, price or position is shown. Nothing is simulated.",
  },
  disconnected: { tone: "neutral", label: "Wallet needed", text: "Connect a wallet to use the market and see your position. Market data below is read without a wallet." },
  "wrong-network": { tone: "warn", label: "Switch network", text: "This action requires Robinhood Chain Testnet (chain 46630). Switch networks to continue." },
  checking: { tone: "pending", label: "Checking", text: "Reading the Lending V2 pool and your wallet from Robinhood Chain Testnet…" },
  unavailable: { tone: "warn", label: "Unavailable", text: "The configured address is not a compatible Lending V2 deployment (missing code, mismatched policy, registry, verifier or oracle). Controls stay off." },
  "read-error": { tone: "invalid", label: "Read failed", text: "A pool or wallet read failed. This is not an empty position. Refresh to try again; nothing is shown in its place." },
  ready: { tone: "valid", label: "Market ready", text: "" },
};

export function marketStateCopy(state: V2Market["state"], chainId: LendingV2ChainId) {
  if (state === "wrong-network") return { ...STATE_COPY[state], text: `This action requires Robinhood Chain ${chainId === ROBINHOOD_MAINNET_CHAIN_ID ? "Mainnet" : "Testnet"} (chain ${chainId}). Switch networks to continue.` };
  if (state === "checking") return { ...STATE_COPY[state], text: `Reading the Lending V2 pool and your wallet from Robinhood Chain ${chainId === ROBINHOOD_MAINNET_CHAIN_ID ? "Mainnet" : "Testnet"}…` };
  return STATE_COPY[state];
}

/** Network, wallet, pool and market state in one line of facts. */
export function ContextBar({ market, walletAddress, eligibility }: {
  market: V2Market;
  walletAddress?: string;
  eligibility: { tone: Tone; label: string };
}) {
  const copy = marketStateCopy(market.state, market.chainId);
  const pool = market.poolAddress;
  return (
    <section className="lendv2-context" aria-label="Lending V2 status">
      <ul>
        <li><span>Network</span><Chip tone="demo">Robinhood Chain {market.chainId === ROBINHOOD_MAINNET_CHAIN_ID ? "Mainnet" : "Testnet"} · {market.chainId}</Chip></li>
        <li><span>Wallet</span><strong className="addr">{walletAddress ? shortAddress(walletAddress) : "Not connected"}</strong></li>
        <li>
          <span>V2 pool</span>
          {pool
            ? <a className="addr" href={`${market.explorerUrl}/address/${pool}`} target="_blank" rel="noopener noreferrer">{shortAddress(pool)}<span className="visually-hidden"> (opens in a new tab)</span></a>
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
