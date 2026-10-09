import Link from "next/link";
import { GIWA_CHAIN_ID } from "@/lib/config/chain";
import { Arrow } from "./arrow";

/* Story sections between the hero and the curtain footer.
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

/* ----------------------------------------------------------------- 01 */
export function IdeaSection() {
  return (
    <section className="lp-sec" id="idea" aria-labelledby="idea-title">
      <div className="lp-wrap lp-idea">
        <div>
          <Eyebrow n="01" ac="blue">The idea</Eyebrow>
          <h2 className="lp-h2" id="idea-title" data-lp-reveal style={{ ["--i" as string]: 1 }}>
            Verifiable facts should not require <em>public</em> data.
          </h2>
          <p className="lp-lead" data-lp-reveal style={{ ["--i" as string]: 2 }}>
            Most on-chain checks work by publishing the fact itself. That makes the fact easy to trust and impossible to keep private. Private data has the opposite problem: no one else can rely on it.
          </p>
          <p className="lp-body" data-lp-reveal style={{ ["--i" as string]: 3 }}>
            This protocol pairs the two. A trusted issuer seals a fact in an <strong>attestation</strong>. You then prove that the sealed fact meets a rule, without showing the fact. The rule is enforced by a smart contract, so anyone can inspect that it was applied.
          </p>
        </div>

        <div className="lp-ledger" data-lp-reveal style={{ ["--i" as string]: 2 }}>
          <p className="lp-ledger__cap">What a verifier sees about the same fact. Illustrative values, not real data.</p>

          <div className="lp-lrow">
            <h3>A public attestation</h3>
            <div className="lp-lrow__view"><u>balance</u><b>1,250</b></div>
            <span className="lp-chip" data-tone="warn"><i aria-hidden="true" />Trusted, but exposed</span>
          </div>

          <div className="lp-lrow">
            <h3>A private note</h3>
            <div className="lp-lrow__view"><u>balance</u><span className="lp-veil" role="img" aria-label="Hidden value" /></div>
            <span className="lp-chip" data-tone="neutral"><i aria-hidden="true" />Private, but unverifiable</span>
          </div>

          <div className="lp-lrow lp-lrow--proof">
            <h3>A sealed credential with a proof</h3>
            <div className="lp-lrow__view">
              <u>balance</u><span className="lp-veil" role="img" aria-label="Hidden value" />
              <u>meets minimum of 1,000</u><span className="lp-yes">yes</span>
            </div>
            <span className="lp-chip" data-tone="valid"><i aria-hidden="true" />Trusted and private</span>
          </div>
        </div>
      </div>
    </section>
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

        <ol className="lp-path">
          {STEPS.map((s, i) => (
            <li className="lp-step" data-lane={s.lane} key={s.name} data-lp-reveal style={{ ["--i" as string]: i + 1 }}>
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
            <li className="lp-route" key={href} data-lp-reveal style={{ ["--i" as string]: Math.min(i, 3) }}>
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
          <div className="lp-fact"><dt>Network</dt><dd>GIWA Sepolia</dd></div>
          <div className="lp-fact"><dt>Chain ID</dt><dd className="mono">{GIWA_CHAIN_ID}</dd></div>
          <div className="lp-fact"><dt>Project contracts</dt><dd>{contracts}</dd></div>
          <div className="lp-fact"><dt>Audit</dt><dd>None</dd></div>
          <div className="lp-fact"><dt>Funds held</dt><dd>None</dd></div>
        </dl>
      </div>
    </section>
  );
}
