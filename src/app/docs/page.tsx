import "./docs.css";
import { DocsToc } from "./docs-toc";
import Link from "next/link";
import type { Metadata } from "next";
import { PageGlyphFigure } from "@/components/page-glyph";
import { appEnv } from "@/lib/config/env";
import { ROBINHOOD_TESTNET_CHAIN_ID, ROBINHOOD_TESTNET_EXPLORER_URL } from "@/lib/config/robinhood-testnet";
import { ROBINHOOD_MAINNET_CHAIN_ID, ROBINHOOD_MAINNET_DEMO_EXPLORER_URL } from "@/lib/config/robinhood-mainnet-demo";

export const metadata: Metadata = { title: `Docs · ${appEnv.appName}` };

/* the network's published public endpoint, not whatever provider this deployment is configured with */
const PUBLIC_RPC = "https://rpc.testnet.chain.robinhood.com";
const PUBLIC_MAINNET_RPC = "https://rpc.mainnet.chain.robinhood.com";

const TOC = [
  ["overview", "Overview"],
  ["dojang", "DOJANG"],
  ["bojagi", "BOJAGI"],
  ["dao", "DAO Governance"],
  ["lending", "Lending"],
  ["start", "Get started"],
  ["network", appEnv.mainnetVisible ? "Robinhood Networks" : "Robinhood Testnet"],
  ["limits", "Security and limits"],
] as const;

export default function DocsPage() {
  const name = appEnv.appName;
  return (
    <main className="page docs">
      <header className="page-head docs__head">
        <PageGlyphFigure glyph={{ shape: "book", label: "An open book of lines of characters: the written trust model and its limits.", caption: "Written down, limits included", legend: ["public"] }} />
        <p className="eyebrow">Documentation</p>
        <h1>How {name} works</h1>
        <p className="page-lead">
          {name} is an independent protocol for credential-gated participation. A project credential establishes who is eligible;
          a zero-knowledge proof lets a holder show eligibility without revealing the private value behind it.
        </p>
        <dl className="docs__glance">
          {appEnv.mainnetVisible ? <>
            <div><dt>Mainnet deployment</dt><dd>Robinhood Mainnet · {ROBINHOOD_MAINNET_CHAIN_ID}</dd></div>
            <div><dt>Contracts</dt><dd>10 deployed · 10 runtime bytecodes</dd></div>
            <div><dt>Governance and Lending</dt><dd>Paused on Mainnet</dd></div>
            <div><dt>Interactive app</dt><dd>Robinhood Testnet · {ROBINHOOD_TESTNET_CHAIN_ID}</dd></div>
          </> : <>
            <div><dt>Interactive app</dt><dd>Robinhood Testnet · {ROBINHOOD_TESTNET_CHAIN_ID}</dd></div>
            <div><dt>Contracts</dt><dd>Testnet deployment</dd></div>
            <div><dt>Governance and Lending</dt><dd>Interactive Testnet journeys</dd></div>
            <div><dt>Production readiness</dt><dd>Pending</dd></div>
          </>}
        </dl>
      </header>

      <div className="docs__layout">
        <aside className="docs__aside" aria-label="On this page">
          <DocsToc items={TOC} />
          <p className="docs__aside-cta"><Link className="btn btn--primary btn--sm" href="/app">Launch App</Link></p>
        </aside>

        <article className="docs__article">
          <section className="docs__sec" id="overview" aria-labelledby="overview-h">
            <h2 id="overview-h"><span>01</span>Overview</h2>
            <p className="docs__lead">
              Everything starts with a GYEVO project credential, recorded by the project&apos;s DOJANG layer. It is separate from official GIWA Dojang credentials. Policy 4 leads to DAO governance; Policy 3 plus a private BOJAGI proof leads to Lending.
            </p>

            <figure className="docs__arch">
              <div className="docs__arch-grid">
                <div className="docs__arch-root">
                  <small>Origin</small>
                  <b>DOJANG</b>
                  <span>Project credential</span>
                </div>
                <div className="docs__arch-branches">
                  <div className="docs__arch-branch" data-branch="dao">
                    <span className="docs__arch-policy"><small>Policy 4</small></span>
                    <span className="docs__arch-wire" aria-hidden="true" />
                    <div className="docs__arch-node">
                      <b>DAO Governance</b>
                      <span>Propose and vote</span>
                    </div>
                    <span className="docs__arch-flag">No private proof</span>
                  </div>
                  <div className="docs__arch-branch" data-branch="lending">
                    <span className="docs__arch-policy"><small>Policy 3</small></span>
                    <span className="docs__arch-wire" aria-hidden="true" />
                    <div className="docs__arch-node" data-private="true">
                      <b>BOJAGI</b>
                      <span>Private ZK proof</span>
                    </div>
                    <span className="docs__arch-wire" aria-hidden="true" />
                    <div className="docs__arch-node">
                      <b>Lending V2</b>
                      <span>Proof-gated actions</span>
                    </div>
                  </div>
                </div>
              </div>
              <figcaption>
                <p><b>Path 1 · DAO.</b> A policy-4 credential makes a wallet eligible to propose and vote. No BOJAGI proof is involved.</p>
                <p><b>Path 2 · Lending.</b> A policy-3 credential is turned into a private zero-knowledge proof by BOJAGI, which Lending V2 verifies on-chain.</p>
              </figcaption>
            </figure>
            <p>
              {appEnv.mainnetVisible
                ? <>GYEVO is deployed on Robinhood Mainnet (chain ID {ROBINHOOD_MAINNET_CHAIN_ID}) with ten project contracts and live runtime bytecode confirmed at all ten addresses. Mainnet DAO and Lending remain paused; their assets are synthetic and have no redemption value. The interactive DAO and Lending journeys run on Robinhood Testnet (chain ID {ROBINHOOD_TESTNET_CHAIN_ID}) with test tokens. </>
                : <>The interactive DAO and Lending journeys run on Robinhood Testnet (chain ID {ROBINHOOD_TESTNET_CHAIN_ID}) with synthetic test tokens. </>}
              {name} is an independent project, not operated, verified or endorsed by Robinhood, GIWA, Dojang or Upbit.
            </p>
          </section>

          <section className="docs__sec" id="dojang" aria-labelledby="dojang-h">
            <h2 id="dojang-h"><span>02</span>DOJANG · Project Credentials</h2>
            <p>
              A project credential is a record in the {name} credential registry. It binds one wallet to a sealed commitment, a policy,
              a version and an expiry date. An authorized project issuer creates it, and it can expire or be revoked.
            </p>
            <div className="docs__policies">
              <div><b>Policy 4</b><h3>DAO Governance</h3><p>Makes a wallet eligible to propose and vote.</p></div>
              <div><b>Policy 3</b><h3>Lending</h3><p>Makes a wallet eligible for proof-gated Lending actions, together with a private proof.</p></div>
            </div>
            <p>The registry stores a commitment, never the private value itself. Project credentials are not identity verification.</p>
            <p className="docs__more"><Link href="/dojang">Open DOJANG</Link></p>
          </section>

          <section className="docs__sec" id="bojagi" aria-labelledby="bojagi-h">
            <h2 id="bojagi-h"><span>03</span>BOJAGI · Private Proofs</h2>
            <p>BOJAGI proves, in your browser, that the private value behind a credential meets a rule, without revealing it.</p>
            <ol className="docs__steps">
              <li><b>Commitment</b><p>The issuer records a commitment to your private value on-chain and delivers a private witness (the value and a random salt) to you.</p></li>
              <li><b>Import</b><p>You import the witness. It is held in memory for the session and never uploaded.</p></li>
              <li><b>Proof</b><p>Your browser generates a zero-knowledge proof that the witness matches the on-chain commitment and meets the threshold.</p></li>
              <li><b>Verification</b><p>A verifier contract checks the proof on-chain when you take the action.</p></li>
            </ol>
            <div className="docs__split">
              <div><h3>Public</h3><p>Your wallet, the commitment, the policy, the chain, the target contract and the proof.</p></div>
              <div data-private="true"><h3>Private</h3><p>The value and its salt. They never leave your device.</p></div>
            </div>
            <p className="docs__more"><Link href="/bojagi">Open BOJAGI</Link></p>
          </section>

          <section className="docs__sec" id="dao" aria-labelledby="dao-h">
            <h2 id="dao-h"><span>04</span>DAO Governance</h2>
            <dl className="docs__rows">
              <div><dt>Who can take part</dt><dd>Wallets that hold an active policy-4 project credential. The credential alone is enough: no BOJAGI proof is involved.</dd></div>
              <div><dt>What members do</dt><dd>Create proposals and vote For, Against or Abstain. Each eligible wallet votes once, and every vote is public.</dd></div>
              <div><dt>Lifecycle</dt><dd>Voting starts one minute after a proposal is created. Anyone can finalize it once voting closes, and anyone can execute a successful proposal before it expires.</dd></div>
              <div><dt>Scope</dt><dd>The first phase has one bounded action: the minimum remaining credential validity the DAO itself requires. It cannot change Lending settings or move funds.</dd></div>
            </dl>
            <p className="docs__more"><Link href="/dao">Open DAO Governance</Link></p>
          </section>

          <section className="docs__sec" id="lending" aria-labelledby="lending-h">
            <h2 id="lending-h"><span>05</span>Lending</h2>
            <dl className="docs__rows">
              <div><dt>Two demo assets</dt><dd>rUSD2 is lent and rCOL2 is posted as collateral. Both are controlled test tokens, not real or bridged assets.</dd></div>
              <div><dt>When a proof is needed</dt><dd>Supplying, enabling collateral and borrowing require a policy-3 credential and a fresh private proof, checked again by the contract. Repaying and safe withdrawals do not.</dd></div>
              <div><dt>Prices</dt><dd>A controlled test oracle publishes synthetic, operator-set prices. They are not market data.</dd></div>
              <div><dt>Rates</dt><dd>Rates are variable and interest is simple, not compounded.</dd></div>
              <div><dt>What it is not</dt><dd>Lending V2 is a demonstration of credential-gated lending. It is not a trading platform and offers no exchange, spot or derivatives trading.</dd></div>
            </dl>
            <p className="docs__more"><Link href="/lending">Open Lending</Link></p>
          </section>

          <section className="docs__sec" id="start" aria-labelledby="start-h">
            <h2 id="start-h"><span>06</span>Get started</h2>
            <ol className="docs__steps docs__steps--tall">
              <li><b>Launch the app</b><p>Connect a wallet from the header. Nothing connects automatically.</p></li>
              <li><b>Switch to Robinhood Testnet</b><p>The app prompts you when the network is wrong. You need a little test ETH for gas from the Robinhood Testnet faucet.</p></li>
              <li><b>Check your project credential</b><p>Open DOJANG. The authorized GYEVO project issuer must issue your credential. Policy 4 is for DAO governance; Policy 3 is for Lending and also needs its matching private witness.</p></li>
              <li><b>Take part</b><p>With a policy-4 credential, use DAO Governance. With a policy-3 credential and its witness, use Lending.</p></li>
            </ol>
            <p className="docs__note">
              You can explore confirmed historical Robinhood Testnet activity without a wallet, test ETH or a credential on the <Link href="/contracts#verified-history">Explore Verified Activity</Link> section. Historical transactions are not active positions.
            </p>
          </section>

          <section className="docs__sec" id="network" aria-labelledby="network-h">
            <h2 id="network-h"><span>07</span>{appEnv.mainnetVisible ? "Robinhood Networks" : "Robinhood Testnet"}</h2>
            <dl className="docs__rows docs__rows--compact">
              {appEnv.mainnetVisible && <>
                <div><dt>Mainnet deployment</dt><dd>Robinhood Chain Mainnet</dd></div>
                <div><dt>Mainnet chain ID</dt><dd>{ROBINHOOD_MAINNET_CHAIN_ID}</dd></div>
                <div><dt>Deployment evidence</dt><dd>Ten successful creation receipts and ten runtime bytecodes confirmed by live chain reads.</dd></div>
                <div><dt>DAO and Lending</dt><dd>Paused. Lending assets are synthetic demo tokens with no redemption value; this is not public production Lending.</dd></div>
                <div><dt>Mainnet RPC</dt><dd><code>{PUBLIC_MAINNET_RPC}</code> <span className="docs__muted">public endpoint</span></dd></div>
                <div><dt>Mainnet explorer</dt><dd><a href={ROBINHOOD_MAINNET_DEMO_EXPLORER_URL} target="_blank" rel="noopener noreferrer">{ROBINHOOD_MAINNET_DEMO_EXPLORER_URL.replace("https://", "")}<span className="visually-hidden"> (opens in a new tab)</span></a></dd></div>
                <div><dt>Source verification</dt><dd>Reported separately from deployed bytecode. Check the live Blockscout status for each contract in the Contracts directory.</dd></div>
              </>}
              <div><dt>Interactive environment</dt><dd>Robinhood Chain Testnet</dd></div>
              <div><dt>Testnet chain ID</dt><dd>{ROBINHOOD_TESTNET_CHAIN_ID}</dd></div>
              <div><dt>Currency</dt><dd>ETH (test, no value)</dd></div>
              <div><dt>RPC</dt><dd><code>{PUBLIC_RPC}</code> <span className="docs__muted">public, rate limited</span></dd></div>
              <div><dt>Explorer</dt><dd><a href={ROBINHOOD_TESTNET_EXPLORER_URL} target="_blank" rel="noopener noreferrer">{ROBINHOOD_TESTNET_EXPLORER_URL.replace("https://", "")}<span className="visually-hidden"> (opens in a new tab)</span></a></dd></div>
            </dl>
            <p className="docs__more"><Link href="/contracts">Contract addresses and status</Link></p>
          </section>

          <section className="docs__sec" id="limits" aria-labelledby="limits-h">
            <h2 id="limits-h"><span>08</span>Security, privacy and limits</h2>
            <dl className="docs__rows">
              <div><dt>Deployment scope</dt><dd>{appEnv.mainnetVisible ? "Mainnet has ten deployed contracts, but DAO and Lending are paused and Lending uses synthetic assets without redemption value. The interactive app runs on Testnet. " : "The interactive app runs on Robinhood Testnet with synthetic assets that have no redemption value. "}{name} has not completed independent security audits and is not public production-ready.</dd></div>
              <div><dt>What privacy covers</dt><dd>A proof hides the private eligibility value. Wallet addresses, transactions, amounts and votes are public, and so is the fact that a gated action happened.</dd></div>
              <div><dt>Trusted issuer</dt><dd>The project issuer decides who receives a credential. A proof shows that a holder meets a rule; it does not remove trust in the issuer.</dd></div>
              <div><dt>Not official</dt><dd>Project credentials are separate from official GIWA Dojang and Upbit credentials.</dd></div>
              <div><dt>Source verification</dt><dd>{appEnv.mainnetVisible ? "All ten Testnet contracts have verified source. Mainnet source status is checked independently on Blockscout and shown per contract in the Contracts directory; bytecode presence is not source verification." : "The ten Testnet contracts have verified source. Check each contract in the Contracts directory; bytecode presence alone is not source verification."}</dd></div>
            </dl>

            <details className="docs__tech">
              <summary>Technical reference</summary>
              <dl className="docs__rows docs__rows--compact">
                <div><dt>Proof system</dt><dd>A Noir circuit, proved in the browser with UltraHonk and checked by a generated Solidity verifier.</dd></div>
                <div><dt>Public inputs</dt><dd>Wallet, commitment, policy, policy version, threshold, credential version, expiry, chain ID and target contract address.</dd></div>
                <div><dt>Binding</dt><dd>A proof is bound to one wallet, one credential version, one chain and one target contract, so it cannot be reused elsewhere.</dd></div>
                <div><dt>Contracts</dt><dd>Credential registry, verifier and adapter, DAO governance, Lending pool, test oracle and two test tokens. See <Link href="/contracts">Contracts</Link>.</dd></div>
              </dl>
            </details>
          </section>
        </article>
      </div>
    </main>
  );
}
