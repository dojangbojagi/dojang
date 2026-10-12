import "./docs.css";
import Link from "next/link";
import type { Metadata } from "next";
import { PageGlyphFigure } from "@/components/page-glyph";
import { appEnv } from "@/lib/config/env";
import { ROBINHOOD_TESTNET_CHAIN_ID, ROBINHOOD_TESTNET_EXPLORER_URL } from "@/lib/config/robinhood-testnet";

/* the network's published public endpoint, not whatever provider this deployment is configured with */
const PUBLIC_RPC = "https://rpc.testnet.chain.robinhood.com";

export const metadata: Metadata = { title: `Docs · ${appEnv.appName}` };

const TOC = [
  ["overview", "Overview"],
  ["dojang", "DOJANG"],
  ["bojagi", "BOJAGI"],
  ["dao", "DAO Governance"],
  ["lending", "Lending"],
  ["start", "Get started"],
  ["network", "Robinhood Testnet"],
  ["limits", "Security and limits"],
] as const;

export default function DocsPage() {
  const name = appEnv.appName;
  return (
    <main className="page docs">
      <header className="page-head">
        <PageGlyphFigure glyph={{ shape: "book", label: "An open book of lines of characters: the written trust model and its limits.", caption: "Written down, limits included", legend: ["public"] }} />
        <p className="eyebrow">Documentation</p>
        <h1>How {name} works</h1>
        <p className="page-lead">
          {name} is an independent protocol for credential-gated participation. A project credential establishes who is eligible;
          a zero-knowledge proof lets a holder show eligibility without revealing the private value behind it.
        </p>
        <nav className="docs__toc" aria-label="On this page">
          {TOC.map(([id, label]) => <a href={`#${id}`} key={id}>{label}</a>)}
        </nav>
      </header>

      <section className="panel" id="overview" aria-labelledby="overview-h">
        <h2 id="overview-h">Overview</h2>
        <p>
          {name} has two building blocks and two applications built on them. <strong>DOJANG</strong> issues and records project credentials.
          <strong> BOJAGI</strong> turns a credential into a private proof. <strong>DAO Governance</strong> and <strong>Lending</strong> use
          those proofs and credentials to decide who may take part.
        </p>
        <p>
          It runs on Robinhood Testnet (chain ID {ROBINHOOD_TESTNET_CHAIN_ID}) as a controlled testnet demonstration with test tokens.{" "}
          {name} is not operated, verified or endorsed by GIWA, Dojang or Upbit.
        </p>
      </section>

      <section className="panel" id="dojang" aria-labelledby="dojang-h">
        <h2 id="dojang-h">DOJANG · Project Credentials</h2>
        <p>
          A project credential is a record in the {name} credential registry. It binds one wallet to a sealed commitment, a policy,
          a version and an expiry date. An authorized project issuer creates it, and it can expire or be revoked.
        </p>
        <dl className="docs__defs">
          <div><dt>Policy 4 · DAO Governance</dt><dd>Makes a wallet eligible to propose and vote.</dd></div>
          <div><dt>Policy 3 · Lending</dt><dd>Makes a wallet eligible for proof-gated Lending actions, together with a private proof.</dd></div>
        </dl>
        <p>The registry stores a commitment, never the private value itself. Project credentials are not identity verification.</p>
        <p><Link href="/dojang">Open DOJANG</Link></p>
      </section>

      <section className="panel" id="bojagi" aria-labelledby="bojagi-h">
        <h2 id="bojagi-h">BOJAGI · Private Proofs</h2>
        <p>BOJAGI proves, in your browser, that the private value behind a credential meets a rule, without revealing it.</p>
        <ol className="docs__steps">
          <li><strong>Commitment.</strong> The issuer records a commitment to your private value on-chain and delivers a private witness (the value and a random salt) to you.</li>
          <li><strong>Import.</strong> You import the witness. It is held in memory for the session and never uploaded.</li>
          <li><strong>Proof.</strong> Your browser generates a zero-knowledge proof that the witness matches the on-chain commitment and meets the threshold.</li>
          <li><strong>Verification.</strong> A verifier contract checks the proof on-chain when you take the action.</li>
        </ol>
        <p>
          <strong>Public:</strong> your wallet, the commitment, the policy, the chain, the target contract and the proof.{" "}
          <strong>Private:</strong> the value and its salt.
        </p>
        <p><Link href="/bojagi">Open BOJAGI</Link></p>
      </section>

      <section className="panel" id="dao" aria-labelledby="dao-h">
        <h2 id="dao-h">DAO Governance</h2>
        <ul className="protocol-list">
          <li><strong>Who can take part.</strong> Wallets that hold an active policy-4 project credential.</li>
          <li><strong>What members do.</strong> Create proposals and vote For, Against or Abstain. Each eligible wallet votes once, and every vote is public.</li>
          <li><strong>Lifecycle.</strong> Voting starts one minute after a proposal is created. Anyone can finalize it once voting closes, and anyone can execute a successful proposal before it expires.</li>
          <li><strong>Scope.</strong> The first phase has one bounded action: the minimum remaining credential validity the DAO itself requires. It cannot change Lending settings or move funds.</li>
        </ul>
        <p><Link href="/dao">Open DAO Governance</Link></p>
      </section>

      <section className="panel" id="lending" aria-labelledby="lending-h">
        <h2 id="lending-h">Lending</h2>
        <ul className="protocol-list">
          <li><strong>Two demo assets.</strong> rUSD2 is lent and rCOL2 is posted as collateral. Both are controlled test tokens, not real or bridged assets.</li>
          <li><strong>When a proof is needed.</strong> Supplying, enabling collateral and borrowing require a policy-3 credential and a fresh private proof, checked again by the contract. Repaying and safe withdrawals do not.</li>
          <li><strong>Prices.</strong> A controlled test oracle publishes synthetic, operator-set prices. They are not market data.</li>
          <li><strong>Rates.</strong> Rates are variable and interest is simple, not compounded.</li>
          <li><strong>What it is not.</strong> Lending V2 is a demonstration of credential-gated lending. It is not a trading platform and offers no exchange, spot or derivatives trading.</li>
        </ul>
        <p><Link href="/lending">Open Lending</Link></p>
      </section>

      <section className="panel" id="start" aria-labelledby="start-h">
        <h2 id="start-h">Get started</h2>
        <ol className="docs__steps">
          <li><strong>Launch the app</strong> and connect a wallet from the header. Nothing connects automatically.</li>
          <li><strong>Switch to Robinhood Testnet.</strong> The app prompts you when the network is wrong. You need a little test ETH for gas from the Robinhood Testnet faucet.</li>
          <li><strong>Check your credential</strong> on the DOJANG page. Credentials are issued by the project issuer; self-service issuance is not available yet.</li>
          <li><strong>Take part.</strong> With a policy-4 credential, use DAO Governance. With a policy-3 credential and its witness, use Lending.</li>
        </ol>
        <p className="docs__note">
          The contracts are deployed and the demo tokens and test prices are configured. Credential issuance for Lending and end-to-end wallet
          journeys are still being completed, so some actions may not be available yet.
        </p>
        <p className="docs__cta"><Link className="btn btn--primary" href="/app">Launch App</Link></p>
      </section>

      <section className="panel" id="network" aria-labelledby="network-h">
        <h2 id="network-h">Robinhood Testnet</h2>
        <dl className="docs__table">
          <div><dt>Network</dt><dd>Robinhood Chain Testnet</dd></div>
          <div><dt>Chain ID</dt><dd>{ROBINHOOD_TESTNET_CHAIN_ID}</dd></div>
          <div><dt>Currency</dt><dd>ETH (test, no value)</dd></div>
          <div><dt>RPC</dt><dd><code>{PUBLIC_RPC}</code> <span className="docs__muted">public, rate limited</span></dd></div>
          <div><dt>Explorer</dt><dd><a href={ROBINHOOD_TESTNET_EXPLORER_URL} target="_blank" rel="noopener noreferrer">{ROBINHOOD_TESTNET_EXPLORER_URL.replace("https://", "")}<span className="visually-hidden"> (opens in a new tab)</span></a></dd></div>
        </dl>
        <p><Link href="/contracts">Contract addresses and status</Link></p>
      </section>

      <section className="panel" id="limits" aria-labelledby="limits-h">
        <h2 id="limits-h">Security, privacy and limits</h2>
        <ul className="protocol-list">
          <li><strong>Testnet only.</strong> {name} is not audited, not a financial product and holds no real funds. Test tokens have no value.</li>
          <li><strong>What privacy covers.</strong> A proof hides the private eligibility value. Wallet addresses, transactions, amounts and votes are public, and so is the fact that a gated action happened.</li>
          <li><strong>Trusted issuer.</strong> The project issuer decides who receives a credential. A proof shows that a holder meets a rule; it does not remove trust in the issuer.</li>
          <li><strong>Not official.</strong> Project credentials are separate from official GIWA Dojang and Upbit credentials.</li>
          <li><strong>Source verification.</strong> Contract source publication on the explorer is pending; the Contracts page shows the current status.</li>
        </ul>

        <details className="docs__tech">
          <summary>Technical reference</summary>
          <dl className="docs__table">
            <div><dt>Proof system</dt><dd>A Noir circuit, proved in the browser with UltraHonk and checked by a generated Solidity verifier.</dd></div>
            <div><dt>Public inputs</dt><dd>Wallet, commitment, policy, policy version, threshold, credential version, expiry, chain ID and target contract address.</dd></div>
            <div><dt>Binding</dt><dd>A proof is bound to one wallet, one credential version, one chain and one target contract, so it cannot be reused elsewhere.</dd></div>
            <div><dt>Contracts</dt><dd>Credential registry, verifier and adapter, DAO governance, Lending pool, test oracle and two test tokens. See <Link href="/contracts">Contracts</Link>.</dd></div>
          </dl>
        </details>
      </section>
    </main>
  );
}
