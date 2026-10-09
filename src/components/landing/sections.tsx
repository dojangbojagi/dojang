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
