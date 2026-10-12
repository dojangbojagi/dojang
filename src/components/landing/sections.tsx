import Link from "next/link";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/config/robinhood-testnet";
import { Arrow } from "./arrow";

/* Story sections between the hero and the curtain footer (01, the idea, is the sticky scene in idea-scene.tsx).
   Copy follows the prototype (docs/01-home.html): no invented numbers, no
   claims the protocol does not make. White always means public / on-chain,
   burgundy always means private / on your device. */

function Eyebrow({ n, children, ac }: { n: string; children: string; ac?: "blue" | "orange" }) {
  return (
    <p className="lp-eyebrow" data-lp-reveal style={{ ["--ac" as string]: ac === "blue" ? "var(--lp-public)" : "var(--lp-wine)" }}>
      <i aria-hidden="true" />
      {n} — {children}
    </p>
  );
}

/* ----------------------------------------------------------------- 02 */
const STEPS = [
  {
    name: "Trusted state",
    lane: "private",
    where: "On your device",
    text: "A trusted issuer vouches for a fact about your wallet. You receive the private details and they stay with you.",
    pub: ["Your wallet address"],
    priv: ["The value and a random salt", "Known to you and the issuer only"],
  },
  {
    name: "Attestation",
    lane: "public",
    where: "On-chain",
    text: "The issuer registers a sealed fingerprint of the fact, called a commitment. The value itself is never published.",
    pub: ["The commitment", "The wallet it is bound to", "Expiry and revocation status"],
    priv: ["The value", "The salt"],
  },
  {
    name: "Private proof",
    lane: "private",
    where: "On your device",
    text: "Your device proves that the sealed fact meets the policy and matches the on-chain commitment, without sending the value anywhere.",
    pub: ["The policy and its threshold", "The proof itself"],
    priv: ["The value", "The salt"],
  },
  {
    name: "Verified execution",
    lane: "public",
    where: "On-chain",
    text: "A contract checks the sender, the commitment, the policy and the proof in one transaction, then unlocks the action: a governance vote, or a loan in the Lending V2 market.",
    pub: ["The proof and public inputs", "Your wallet address", "The access result and transaction"],
    priv: ["The value stays unpublished"],
  },
] as const;

export function PathSection() {
  return (
    <section className="lp-sec" id="how" aria-labelledby="how-title">
      <div className="lp-wrap">
        <Eyebrow n="02">How it works</Eyebrow>
        <h2 className="lp-h2" id="how-title" data-lp-reveal style={{ ["--i" as string]: 1 }}>
          From a trusted fact to a <em className="o">verified</em> action.
        </h2>
        <p className="lp-lead" data-lp-reveal style={{ ["--i" as string]: 2 }}>
          Four steps. The path crosses the privacy boundary three times, and the value never does.
        </p>
        <p className="lp-legend" data-lp-reveal style={{ ["--i" as string]: 3 }}>
          <span className="pv"><i aria-hidden="true" />Private: stays on your device</span>
          <span className="pb"><i aria-hidden="true" />Public: on the selected testnet</span>
        </p>

        <ol className="lp-path" data-lp-rail>
          {STEPS.map((s, i) => (
            <li className="lp-step" data-lane={s.lane} key={s.name} data-spot data-lp-reveal style={{ ["--i" as string]: i + 1 }}>
              <span className="lp-step__node" aria-hidden="true">{`0${i + 1}`}</span>
              <p className="lp-step__where">{s.where}</p>
              <h3>{s.name}</h3>
              <p>{s.text}</p>
              <div className="lp-lists">
                <div>
                  <h4>Public</h4>
                  <ul>{s.pub.map((t) => <li key={t}>{t}</li>)}</ul>
                </div>
                <div className="priv">
                  <h4>Private</h4>
                  <ul>{s.priv.map((t) => <li key={t}>{t}</li>)}</ul>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- 03 */
/* The trust layer: what DOJANG and BOJAGI are, and how they relate. One composition, not two cards: the
   credential (public, white) and the proof (private, burgundy) are two panes, one in front of the other, and
   below them the two access paths that both start from the same project credential registry.
   Facts only, from the deployed Robinhood Testnet protocol: policy 4 gates DAO governance; policy 3 and a
   real zero-knowledge proof gate Lending V2. These are project-issued credentials, not official GIWA,
   Dojang or Upbit credentials, and the section says so. */
export function TrustLayerSection() {
  return (
    <section className="lp-sec lp-trust" id="trust" aria-labelledby="trust-title">
      <div className="lp-wrap">
        <Eyebrow n="03" ac="blue">The trust layer</Eyebrow>
        <h2 className="lp-h2" id="trust-title" data-lp-reveal style={{ ["--i" as string]: 1 }}>
          Trust is <em>verified.</em> Privacy is <em className="o">preserved.</em>
        </h2>
        <p className="lp-lead" data-lp-reveal style={{ ["--i" as string]: 2 }}>
          DOJANG establishes project-defined eligibility. BOJAGI proves that eligibility without exposing the private value.
        </p>

        <div className="lp-trust__stage">
          <article className="lp-layer lp-layer--public" data-lp-reveal="left" data-spot style={{ ["--i" as string]: 1 }}>
            <div className="lp-cred" aria-hidden="true">
              <div className="lp-cred__top"><i /><span>Credential</span><b>Policy 4</b></div>
              <div className="lp-cred__row"><span>Wallet</span><u /></div>
              <div className="lp-cred__row"><span>Commitment</span><u /></div>
              <div className="lp-cred__row"><span>Status</span><em>Active</em></div>
              <span className="lp-cred__seal">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.2 4.2L19 7" /></svg>
              </span>
            </div>
            <p className="lp-layer__tag">Credential layer · public</p>
            <h3>DOJANG</h3>
            <p className="lp-layer__text">A project credential layer that establishes eligibility for on-chain participation.</p>
            <ul className="lp-layer__facts">
              <li>Issued by the project and bound to one wallet</li>
              <li>Policy, expiry and revocation are recorded on-chain</li>
            </ul>
            <Link className="lp-layer__link" href="/dojang">Explore DOJANG <Arrow /></Link>
          </article>

          <article className="lp-layer lp-layer--private" data-lp-reveal="right" data-spot style={{ ["--i" as string]: 2 }}>
            <div className="lp-proof" aria-hidden="true">
              <div className="lp-proof__top"><span>Private proof</span><b>Policy 3</b></div>
              <div className="lp-proof__row"><span>Value</span><i className="lp-veil" /></div>
              <div className="lp-proof__row"><span>Salt</span><i className="lp-veil" /></div>
              <div className="lp-proof__row"><span>Proof</span><em>Valid</em></div>
            </div>
            <p className="lp-layer__tag">Proof layer · private</p>
            <h3>BOJAGI</h3>
            <p className="lp-layer__text">A zero-knowledge proof layer that confirms eligibility without exposing the underlying private value.</p>
            <ul className="lp-layer__facts">
              <li>The proof is generated in your browser</li>
              <li>The value and its salt never leave your device</li>
            </ul>
            <Link className="lp-layer__link" href="/bojagi">Explore BOJAGI <Arrow /></Link>
          </article>
        </div>

        <div className="lp-flow" data-lp-rail>
          <p className="lp-flow__cap" data-lp-reveal>
            <span>Two access paths</span>
            <span>One project credential registry · Robinhood Testnet · chain {ROBINHOOD_TESTNET_CHAIN_ID}</span>
          </p>
          <div className="lp-flow__body">
            <div className="lp-flow__root" data-lp-reveal style={{ ["--i" as string]: 1 }}>
              <span className="lp-flow__k">Origin</span>
              <strong>DOJANG credential</strong>
              <small>Project-issued, bound to your wallet</small>
            </div>
            <ol className="lp-flow__routes">
              <li className="lp-route" data-kind="public" style={{ ["--r" as string]: 0 }}>
                <span className="lp-route__policy">Policy 4</span>
                <span className="lp-route__wire" aria-hidden="true" />
                <span className="lp-route__node" data-lp-reveal style={{ ["--i" as string]: 2 }}>
                  <b>DAO governance</b>
                  <small>The credential is checked on-chain. Votes are public.</small>
                  <code>RobinhoodGovernancePhase1</code>
                </span>
              </li>
              <li className="lp-route" data-kind="private" style={{ ["--r" as string]: 1 }}>
                <span className="lp-route__policy">Policy 3</span>
                <span className="lp-route__wire" aria-hidden="true" />
                <span className="lp-route__node lp-route__node--proof" data-lp-reveal style={{ ["--i" as string]: 3 }}>
                  <b>BOJAGI private proof</b>
                  <small>Zero-knowledge, built in your browser. The value stays private.</small>
                </span>
                <span className="lp-route__wire lp-route__wire--b" aria-hidden="true" />
                <span className="lp-route__node" data-lp-reveal style={{ ["--i" as string]: 4 }}>
                  <b>Lending V2</b>
                  <small>The pool verifies the proof inside the transaction.</small>
                  <code>LendingPoolV2 · HonkVerifier</code>
                </span>
              </li>
            </ol>
          </div>
        </div>

        <p className="lp-trust__note" data-lp-reveal style={{ ["--i" as string]: 1 }}>
          GYEVO credentials are issued by this project, not by GIWA, Dojang or Upbit. They are a separate,
          project-owned credential layer on Robinhood Testnet: a test environment with test tokens.
        </p>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- 04 */
/* The roadmap states what exists and what does not, from the project's own status notes
   (docs/LENDING_MVP_ARCHITECTURE.md, docs/FRONTEND_INTEGRATION_HANDOFF.md): no dates, no invented numbers,
   and nothing is called deployed until its address and receipt exist. */
const PHASES = [
  {
    n: "01",
    name: "Foundation",
    status: "done",
    chip: "Verified locally",
    items: [
      "Read-only check of official Dojang Verified Address attestations",
      "Verified DAO governance: official Dojang membership and public votes, tested locally",
      "A demo credential registry holding issuer-signed commitments",
      "A Noir circuit, proofs made in the browser and a generated Solidity verifier",
    ],
  },
  {
    n: "02",
    name: "Lending demo",
    status: "done",
    chip: "Verified locally",
    items: [
      "One proof-gated market with two controlled test tokens",
      "Supply, collateral, borrow, repay and withdraw, accounted on-chain",
      "A 50% loan-to-value cap, a fixed 1:1 price and zero interest",
      "A full interface, run end to end on a local chain",
    ],
  },
  {
    n: "03",
    name: "GIWA Sepolia deployment",
    status: "next",
    chip: "Next · not deployed",
    items: [
      "Deploy and verify the registry, verifier, tokens and pool",
      "Grant the issuer role and run every flow on the public testnet",
      "Publish the real addresses and transaction receipts on the Contracts page",
    ],
  },
  {
    n: "04",
    name: "Beyond the demo",
    status: "later",
    chip: "Not started",
    items: [
      "An independent audit before any production claim",
      "A price oracle, interest, liquidation and bad-debt handling for lending",
      "Native Bojagi private transfer, which this project does not claim today",
    ],
  },
] as const;

export function RoadmapSection() {
  return (
    <section className="lp-sec lp-road" id="roadmap" aria-labelledby="road-title">
      <div className="lp-wrap">
        <Eyebrow n="04" ac="blue">Roadmap</Eyebrow>
        <h2 className="lp-h2" id="road-title" data-lp-reveal style={{ ["--i" as string]: 1 }}>
          Robinhood contracts deployed. <em className="o">GIWA</em> deployment remains pending.
        </h2>
        <p className="lp-lead" data-lp-reveal style={{ ["--i" as string]: 2 }}>
          The Robinhood Testnet contracts are deployed on chain {ROBINHOOD_TESTNET_CHAIN_ID}. A GIWA Sepolia deployment remains separate and is not claimed here.
        </p>

        {/* the route: solid where the work is done, dotted where it is not. Decorative; the list below says the same in words. */}
        <div className="lp-road__map" data-lp-rail aria-hidden="true">
          <svg className="lp-road__svg lp-road__svg--todo" viewBox="0 0 1000 120" preserveAspectRatio="none" focusable="false">
            <path d="M375 28 C500 28 500 92 625 92 C750 92 750 28 875 28 L1000 28" />
          </svg>
          <svg className="lp-road__svg lp-road__svg--done" viewBox="0 0 1000 120" preserveAspectRatio="none" focusable="false">
            <path d="M0 92 L125 92 C250 92 250 28 375 28" />
          </svg>
          {PHASES.map((ph, i) => (
            <span className="lp-road__node" data-status={ph.status} key={ph.n} style={{ ["--x" as string]: 12.5 + i * 25, ["--y" as string]: i % 2 ? 23.3 : 76.7 }}>
              {ph.status === "done" ? "✓" : ph.n}
            </span>
          ))}
        </div>

        <ol className="lp-road__list">
          {PHASES.map((ph, i) => (
            <li className="lp-phase" data-status={ph.status} key={ph.n} data-spot data-lp-reveal style={{ ["--i" as string]: i + 1 }}>
              <p className="lp-phase__top">
                <span className="lp-phase__n">Phase {ph.n}</span>
                <span className="lp-chip" data-tone={ph.status === "done" ? "valid" : ph.status === "next" ? "warn" : "neutral"}><i aria-hidden="true" />{ph.chip}</span>
              </p>
              <h3>{ph.name}</h3>
              <ul>{ph.items.map((t) => <li key={t}>{t}</li>)}</ul>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- facts */
export function FactsSection({ contracts }: { contracts: string }) {
  return (
    <section className="lp-sec lp-facts" aria-labelledby="facts-title">
      <div className="lp-wrap">
        <p className="lp-eyebrow lp-facts__title" id="facts-title" data-lp-reveal>
          <i aria-hidden="true" />
          What is live today
        </p>
        <dl className="lp-facts__grid" data-lp-reveal>
          <div className="lp-fact" data-spot><dt>Demo network</dt><dd>Robinhood Chain Testnet</dd></div>
          <div className="lp-fact" data-spot><dt>Chain ID</dt><dd className="mono">{ROBINHOOD_TESTNET_CHAIN_ID}</dd></div>
          <div className="lp-fact" data-spot><dt>GIWA project contracts</dt><dd>{contracts}</dd></div>
          <div className="lp-fact" data-spot><dt>Audit</dt><dd>None</dd></div>
          <div className="lp-fact" data-spot><dt>Funds held</dt><dd>None</dd></div>
        </dl>
      </div>
    </section>
  );
}
