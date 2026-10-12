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

/* ----------------------------------------------------------------- 04 */
/* The trust layer itself (DOJANG, BOJAGI, DAO) is the pinned story in feature-story.tsx. Lending follows it as
   an ordinary section: what the market does on Robinhood Testnet and which actions need a proof. Facts only:
   supply, collateral, borrow, repay and withdraw exist; supply, collateral activation and borrow need a
   policy-3 project credential and a genuine proof; repay and safe withdrawal do not. Prices are synthetic and
   the tokens are test tokens; this is a credential-gated lending demonstration, not an exchange. */
const ACTIONS = [
  { name: "Supply", note: "Lend rUSD2 to the pool", proof: true },
  { name: "Collateral", note: "Post rCOL2 as collateral", proof: true },
  { name: "Borrow", note: "Draw rUSD2 against it", proof: true },
  { name: "Repay", note: "Return what was borrowed", proof: false },
  { name: "Withdraw", note: "Take back what is safe", proof: false },
] as const;

export function LendingSection() {
  return (
    <section className="lp-sec lp-lend" id="lending" aria-labelledby="lending-title">
      <div className="lp-wrap lp-lend__wrap">
        <div className="lp-lend__copy">
          <Eyebrow n="04" ac="blue">Lending</Eyebrow>
          <h2 className="lp-h2" id="lending-title" data-lp-reveal style={{ ["--i" as string]: 1 }}>
            Borrow with a <em className="o">proof,</em> not a disclosure.
          </h2>
          <p className="lp-lead" data-lp-reveal style={{ ["--i" as string]: 2 }}>
            Lending V2 supports supply, collateral, borrow, repay and withdraw on Robinhood Testnet. The protected actions require a
            valid project-issued policy-3 credential and a genuine zero-knowledge proof, checked again by the contract.
          </p>
          <p className="lp-lend__fine" data-lp-reveal style={{ ["--i" as string]: 3 }}>
            Test tokens and synthetic test prices. A credential-gated demonstration of lending, not an exchange: there is no spot or
            derivatives trading. Credentials are issued by this project, not by GIWA, Dojang or Upbit.
          </p>
          <div className="lp-lend__cta" data-lp-reveal style={{ ["--i" as string]: 4 }}>
            <Link className="lp-btn lp-btn--primary" href="/lending">Open Lending <Arrow /></Link>
            <Link className="lp-btn lp-btn--ghost" href="/app">Launch App</Link>
          </div>
        </div>

        <figure className="lp-lend__board" data-lp-reveal="right" style={{ ["--i" as string]: 2 }}>
          <figcaption className="lp-lend__cap">
            <span>Lending V2</span>
            <span>Robinhood Testnet · {ROBINHOOD_TESTNET_CHAIN_ID}</span>
          </figcaption>
          <ol className="lp-lend__acts">
            {ACTIONS.map((a, i) => (
              <li key={a.name} data-proof={a.proof ? "true" : "false"}>
                <span className="lp-lend__idx" aria-hidden="true">{`0${i + 1}`}</span>
                <span className="lp-lend__act"><b>{a.name}</b><small>{a.note}</small></span>
                <span className="lp-lend__gate">
                  {a.proof ? (
                    <><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></svg>Proof required</>
                  ) : "No proof needed"}
                </span>
              </li>
            ))}
          </ol>
          <p className="lp-lend__foot"><span>Policy 3</span>Three of five actions are gated by a private proof.</p>
        </figure>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- 05 */
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
      "DAO governance gated by a project-issued policy-4 credential, with public votes",
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
    name: "Robinhood Testnet deployment",
    status: "done",
    chip: "Deployed · chain 46630",
    items: [
      "Project-issued credential registry, HonkVerifier and verifier adapter",
      "RobinhoodGovernancePhase1 for DAO participation (policy 4)",
      "LendingPoolV2 with controlled demo tokens and a test oracle (policy 3 with a real proof)",
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
        <Eyebrow n="05" ac="blue">Roadmap</Eyebrow>
        <h2 className="lp-h2" id="road-title" data-lp-reveal style={{ ["--i" as string]: 1 }}>
          Robinhood contracts deployed. <em className="o">GIWA</em> deployment remains pending.
        </h2>
        <p className="lp-lead" data-lp-reveal style={{ ["--i" as string]: 2 }}>
          The Robinhood Testnet contracts are deployed on chain {ROBINHOOD_TESTNET_CHAIN_ID}. A GIWA Sepolia deployment remains separate and is not claimed here.
        </p>

        {/* the route: solid where the work is done, dotted where it is not. Decorative; the list below says the same in words. */}
        <div className="lp-road__map" data-lp-rail aria-hidden="true">
          <svg className="lp-road__svg lp-road__svg--todo" viewBox="0 0 1000 120" preserveAspectRatio="none" focusable="false">
            <path d="M625 92 C750 92 750 28 875 28 L1000 28" />
          </svg>
          <svg className="lp-road__svg lp-road__svg--done" viewBox="0 0 1000 120" preserveAspectRatio="none" focusable="false">
            <path d="M0 92 L125 92 C250 92 250 28 375 28 C500 28 500 92 625 92" />
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
                <span className="lp-chip" data-tone={ph.status === "done" ? "valid" : "neutral"}><i aria-hidden="true" />{ph.chip}</span>
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
export function FactsSection() {
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
          <div className="lp-fact" data-spot><dt>Project contracts</dt><dd>Deployed on Robinhood Testnet</dd></div>
          <div className="lp-fact" data-spot><dt>Audit</dt><dd>None</dd></div>
          <div className="lp-fact" data-spot><dt>Funds held</dt><dd>None</dd></div>
        </dl>
      </div>
    </section>
  );
}
