import Link from "next/link";
import { GIWA_CHAIN_ID } from "@/lib/config/chain";
import { Arrow } from "./arrow";

/* Story sections between the hero and the curtain footer (01, the idea, is the sticky scene in idea-scene.tsx).
   Copy follows the prototype (docs/01-home.html): no invented numbers, no
   claims the protocol does not make. Blue always means public / on-chain,
   orange always means private / on your device. */

function Eyebrow({ n, children, ac }: { n: string; children: string; ac?: "blue" | "orange" }) {
  return (
    <p className="lp-eyebrow" data-lp-reveal style={{ ["--ac" as string]: ac === "blue" ? "var(--lp-blue)" : "var(--lp-orange)" }}>
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
    text: "The vault contract checks the sender, the commitment, the policy and the proof in one transaction, then records access.",
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
          <span className="pb"><i aria-hidden="true" />Public: on GIWA Sepolia</span>
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
const DESTINATIONS = [
  ["Dojang", "Inspect official GIWA Verified Address attestations and the separate project demo credential.", "/dojang"],
  ["Bojagi-inspired Protection", "Review the private eligibility policy and proof system readiness.", "/bojagi"],
  ["Restricted Vault", "Inspect on-chain access state and the proof-gated action.", "/vault"],
  ["Contracts", "See official GIWA references and project deployment status.", "/contracts"],
  ["Protocol Docs", "Read the trust model, data boundaries and current limitations.", "/docs"],
] as const;

export function ExploreSection() {
  return (
    <section className="lp-sec" id="explore" aria-labelledby="explore-title">
      <div className="lp-wrap">
        <Eyebrow n="03" ac="blue">Explore</Eyebrow>
        <h2 className="lp-h2" id="explore-title" data-lp-reveal style={{ ["--i" as string]: 1 }}>
          Every part, <em>open</em> to inspect.
        </h2>
        <ul className="lp-routes">
          {DESTINATIONS.map(([title, desc, href], i) => (
            <li className="lp-route" key={href} data-spot data-lp-reveal={i % 2 ? "right" : "left"} style={{ ["--i" as string]: Math.min(i, 3) }}>
              <Link href={href}>
                <span className="lp-route__idx">{`0${i + 1}`}</span>
                <span className="lp-route__title">{title}</span>
                <span className="lp-route__desc">{desc}</span>
                <span className="lp-route__arrow"><Arrow /></span>
              </Link>
            </li>
          ))}
        </ul>
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
      "A demo credential registry holding issuer-signed commitments",
      "A Noir circuit, proofs made in the browser and a generated Solidity verifier",
      "A restricted vault that records access only after a verified proof",
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
          Verified locally. <em className="o">Testnet</em> is next.
        </h2>
        <p className="lp-lead" data-lp-reveal style={{ ["--i" as string]: 2 }}>
          Where the project stands today and what each step needs before it can be claimed. Nothing here is deployed to GIWA Sepolia yet.
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
          <div className="lp-fact" data-spot><dt>Network</dt><dd>GIWA Sepolia</dd></div>
          <div className="lp-fact" data-spot><dt>Chain ID</dt><dd className="mono">{GIWA_CHAIN_ID}</dd></div>
          <div className="lp-fact" data-spot><dt>Project contracts</dt><dd>{contracts}</dd></div>
          <div className="lp-fact" data-spot><dt>Audit</dt><dd>None</dd></div>
          <div className="lp-fact" data-spot><dt>Funds held</dt><dd>None</dd></div>
        </dl>
      </div>
    </section>
  );
}
