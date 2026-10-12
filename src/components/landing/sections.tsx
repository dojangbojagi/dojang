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
    text: "A contract checks the sender, the commitment, the policy and the proof in one transaction, then unlocks the action: access in the restricted vault, or a loan in the lending demo.",
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
/* The two ways through the product, each two pages long. A starts from what GIWA already trusts (public,
   white) and ends in a decision; B starts from a private fact (burgundy) and ends in an action. The vault is a
   technical primitive, so it sits in the secondary row, not in either journey. */
const JOURNEYS = [
  {
    key: "a",
    tone: "public",
    letter: "A",
    name: "Verified governance",
    chip: "Public · verified",
    text: "Check official GIWA Dojang separately; Robinhood DAO membership uses a BOJOGAY project-issued policy-4 credential.",
    steps: [
      ["Dojang", "Inspect official GIWA Verified Address attestations and the separate BOJOGAY-issued Robinhood project credentials.", "/dojang"],
      ["DAO governance", "Use an active policy-4 project credential to propose and vote on Robinhood Testnet. Official Dojang is not used for Robinhood authorization.", "/dao"],
    ],
  },
  {
    key: "b",
    tone: "private",
    letter: "B",
    name: "Private utility",
    chip: "Private · proven",
    text: "Use an issuer-delivered policy-3 witness to prove eligibility privately, then act on Robinhood Testnet.",
    steps: [
      ["Bojagi-inspired proof", "Import the private witness for your Robinhood project credential and generate a genuine browser proof.", "/bojagi"],
      ["Lending", "Use policy 3 to supply or borrow in a controlled test market with test tokens and a synthetic oracle.", "/lending"],
    ],
  },
] as const;

const TECHNICAL = [
  ["Contracts", "Robinhood Testnet project deployments and separate official GIWA references.", "/contracts"],
  ["Docs", "The trust model, data boundaries and current limitations.", "/docs"],
  ["Vault", "The proof-gated access contract, for anyone who wants to inspect it.", "/vault"],
] as const;

export function JourneysSection() {
  return (
    <section className="lp-sec" id="journeys" aria-labelledby="journeys-title">
      <div className="lp-wrap">
        <Eyebrow n="03" ac="blue">Two journeys</Eyebrow>
        <h2 className="lp-h2" id="journeys-title" data-lp-reveal style={{ ["--i" as string]: 1 }}>
          Two ways in. Both end <em>on-chain.</em>
        </h2>
        <p className="lp-lead" data-lp-reveal style={{ ["--i" as string]: 2 }}>
          Verify first, then govern. Or prove privately, then borrow. Each journey is two pages, in order.
        </p>

        <div className="lp-jn">
          {JOURNEYS.map((j, ji) => (
            <article className="lp-jn__lane" data-tone={j.tone} key={j.key} data-lp-reveal={ji ? "right" : "left"} style={{ ["--i" as string]: 1 }}>
              <header className="lp-jn__head">
                <span className="lp-jn__letter" aria-hidden="true">{j.letter}</span>
                <div>
                  <p className="lp-jn__chip">{j.chip}</p>
                  <h3>{j.name}</h3>
                </div>
              </header>
              <p className="lp-jn__text">{j.text}</p>
              <ol className="lp-jn__steps">
                {j.steps.map(([title, desc, href], si) => (
                  <li key={href} data-spot>
                    <Link href={href}>
                      <span className="lp-jn__idx">{`${j.letter}${si + 1}`}</span>
                      <span className="lp-jn__title">{title}</span>
                      <span className="lp-jn__desc">{desc}</span>
                      <span className="lp-jn__arrow"><Arrow /></span>
                    </Link>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>

        <div className="lp-tech" data-lp-reveal style={{ ["--i" as string]: 2 }}>
          <p className="lp-tech__label">Behind both journeys</p>
          <ul>
            {TECHNICAL.map(([title, desc, href]) => (
              <li key={href}>
                <Link href={href}>
                  <span className="lp-tech__title">{title}<Arrow /></span>
                  <span className="lp-tech__desc">{desc}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
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
      "A restricted vault, the technical primitive that records access only after a verified proof",
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
      "Deploy and verify the registry, verifier, vault, tokens and pool",
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
