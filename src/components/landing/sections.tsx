import Link from "next/link";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/config/robinhood-testnet";
import { ROBINHOOD_MAINNET_CHAIN_ID } from "@/lib/config/robinhood-mainnet-demo";
import { appEnv } from "@/lib/config/env";
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
    name: "Project credential",
    lane: "private",
    where: "Issued to you",
    text: "An authorized issuer records a credential for a GYEVO policy. Policy 3 also needs a matching private witness; Policy 4 does not. These are separate from official GIWA Dojang credentials.",
    pub: ["Your wallet address"],
    priv: ["The value and a random salt", "Known to you and the issuer only"],
  },
  {
    name: "Credential record",
    lane: "public",
    where: "On-chain",
    text: "The project registry binds your wallet to a policy and sealed commitment. Policy 4 is for DAO governance; Policy 3 is for Lending.",
    pub: ["The commitment", "The wallet it is bound to", "Expiry and revocation status"],
    priv: ["The value", "The salt"],
  },
  {
    name: "BOJAGI proof",
    lane: "private",
    where: "In your browser",
    text: "For Policy 3 Lending, BOJAGI uses the matching witness to prove eligibility without revealing its private value. DAO governance needs no proof.",
    pub: ["The policy and its threshold", "The proof itself"],
    priv: ["The value", "The salt"],
  },
  {
    name: "Choose a path",
    lane: "public",
    where: "On-chain",
    text: "Policy 4 opens public proposal and voting actions. Policy 3 plus a proof opens eligible Lending actions; repayment and safe withdrawals do not need a proof.",
    pub: ["DAO proposals and votes", "Lending transactions and amounts", "The proof and public inputs"],
    priv: ["The eligibility value and salt stay unpublished"],
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
          DOJANG project credentials lead to two clear paths: Policy 4 → DAO, or Policy 3 → BOJAGI → Lending.
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
  { name: "Deposit", note: "Post rCOL2 as collateral", proof: false },
  { name: "Enable collateral", note: "Count deposited rCOL2 toward borrowing", proof: true },
  { name: "Borrow", note: "Draw rUSD2 against it", proof: true },
  { name: "Repay & withdraw", note: "Return debt and take back safe assets", proof: false },
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
            <Link className="lp-btn lp-btn--ghost" href="/contracts#verified-history">Explore Verified History</Link>
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
          <p className="lp-lend__foot"><span>Policy 3</span>Supply, collateral activation and borrowing need a private proof.</p>
        </figure>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- 05 */
/* The five phases cover protocol development and deployment. Production controls remain future work. */
type PhaseStatus = "done" | "live" | "wip" | "future";
const STATUS_LABEL: Record<PhaseStatus, string> = {
  done: "Completed",
  live: "Live on Testnet",
  wip: "In Progress",
  future: "Future Development",
};

const PHASES: readonly { n: string; name: string; status: PhaseStatus; items: readonly string[] }[] = [
  {
    n: "01",
    name: "Protocol foundation",
    status: "done",
    items: [
      "Project credential registry: commitments, policies, expiry and revocation",
      "A Noir eligibility circuit, proofs made in the browser and a generated Solidity verifier",
      "DAO governance and Lending V2 contracts, tested locally with genuine proofs",
    ],
  },
  {
    n: "02",
    name: "Robinhood Testnet deployment",
    status: "done",
    items: [
      "Ten project contracts deployed and read back from chain 46630",
      "Synthetic test prices set and controlled test tokens minted",
      "Policy 3 Lending and Policy 4 DAO credentials issued by the authorized project issuer",
    ],
  },
  {
    n: "03",
    name: "Live Testnet activity",
    status: "done",
    items: [
      "Live contract addresses and status are read from Robinhood Testnet",
      "The app separates Policy 4 governance from Policy 3 private Lending proofs",
      "Confirmed Testnet activity is explorable without a connected wallet",
    ],
  },
  {
    n: "04",
    name: "Public testnet journeys",
    status: "done",
    items: [
      "DAO Proposal 1 received two For votes, was finalized and executed at 3,600 seconds",
      "Two test wallets completed proof-gated Lending actions; the loan was repaid and assets withdrawn",
      "All ten deployed project contracts have source verified on Robinhood Testnet Blockscout",
    ],
  },
  appEnv.mainnetVisible ? {
    n: "05",
    name: "Robinhood Mainnet deployment",
    status: "done",
    items: [
      "Ten protocol contracts deployed on Robinhood Mainnet (chain 4663), with runtime bytecode confirmed at all ten addresses.",
      "Ten successful contract creation receipts recorded in the Foundry chain 4663 broadcast artifact",
      "Mainnet DAO and Lending are paused; Lending assets are synthetic and have no redemption value.",
    ],
  } : {
    n: "05",
    name: "Public production readiness",
    status: "future",
    items: [
      "Independent security review and production controls remain pending.",
      "Production-grade oracle infrastructure is not active.",
      "Public real-asset activation remains future work.",
    ],
  },
];

/* the route through the five nodes */
const NODE_X = (i: number) => 100 + i * 200; /* 100 ... 900 of a 1000 wide drawing */
const NODE_Y = (i: number) => (i % 2 ? 28 : 92);
const route = (from: number, to: number) => {
  let d = `M${NODE_X(from)} ${NODE_Y(from)}`;
  for (let i = from; i < to; i++) d += ` C${NODE_X(i) + 100} ${NODE_Y(i)} ${NODE_X(i + 1) - 100} ${NODE_Y(i + 1)} ${NODE_X(i + 1)} ${NODE_Y(i + 1)}`;
  return d;
};
const LAST_LIVE = PHASES.reduce((last, p, i) => (p.status === "done" || p.status === "live" ? i : last), 0);

export function RoadmapSection() {
  return (
    <section className="lp-sec lp-road" id="roadmap" aria-labelledby="road-title">
      <div className="lp-wrap">
        <Eyebrow n="05" ac="blue">Roadmap</Eyebrow>
        <h2 className="lp-h2" id="road-title" data-lp-reveal style={{ ["--i" as string]: 1 }}>
          {appEnv.mainnetVisible ? "Deployed on Robinhood Mainnet. " : "Live on Robinhood Testnet. "}<em className="o">Production</em> still ahead.
        </h2>
        <p className="lp-lead" data-lp-reveal style={{ ["--i" as string]: 2 }}>
          {appEnv.mainnetVisible
            ? <>GYEVO has ten deployed contracts on Robinhood Mainnet (chain {ROBINHOOD_MAINNET_CHAIN_ID}). DAO and Lending remain paused and use synthetic test assets. Interactive user journeys run on Robinhood Testnet (chain {ROBINHOOD_TESTNET_CHAIN_ID}); public production readiness remains pending.</>
            : <>GYEVO&apos;s interactive DAO and Lending journeys run on Robinhood Testnet (chain {ROBINHOOD_TESTNET_CHAIN_ID}) with synthetic test assets. Public production readiness remains pending.</>}
        </p>

        {/* the route: solid where the work is done or live, dotted where it is not. Decorative; the list below says the same in words. */}
        <div className="lp-road__map" data-lp-rail aria-hidden="true">
          <svg className="lp-road__svg lp-road__svg--todo" viewBox="0 0 1000 120" preserveAspectRatio="none" focusable="false">
            <path d={LAST_LIVE < PHASES.length - 1 ? `${route(LAST_LIVE, PHASES.length - 1)} L1000 ${NODE_Y(PHASES.length - 1)}` : ""} />
          </svg>
          <svg className="lp-road__svg lp-road__svg--done" viewBox="0 0 1000 120" preserveAspectRatio="none" focusable="false">
            <path d={`M0 ${NODE_Y(0)} L${NODE_X(0)} ${NODE_Y(0)} ${route(0, LAST_LIVE).replace(/^M[^C]*/, "")}`} />
          </svg>
          {PHASES.map((ph, i) => (
            <span className="lp-road__node" data-status={ph.status} key={ph.n} style={{ ["--x" as string]: NODE_X(i) / 10, ["--y" as string]: (NODE_Y(i) / 120) * 100 }}>
              {ph.status === "done" ? "✓" : ph.n}
            </span>
          ))}
        </div>

        <ol className="lp-road__list">
          {PHASES.map((ph, i) => (
            <li className="lp-phase" data-status={ph.status} key={ph.n} data-spot data-lp-reveal style={{ ["--i" as string]: i + 1 }}>
              <p className="lp-phase__top">
                <span className="lp-phase__n">Phase {ph.n}</span>
                <span className="lp-chip" data-tone={ph.status}><i aria-hidden="true" />{STATUS_LABEL[ph.status]}</span>
              </p>
              <h3>{ph.name}</h3>
              <ul>{ph.items.map((t) => <li key={t}>{t}</li>)}</ul>
            </li>
          ))}
        </ol>
        <p className="lp-lead">Public Production Readiness — Pending: independent security audits, production-grade oracle infrastructure, and public real-asset activation remain future development.</p>
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
          {appEnv.mainnetVisible
            ? <>
                <div className="lp-fact" data-spot><dt>Primary deployment</dt><dd className="mono">Robinhood Mainnet · {ROBINHOOD_MAINNET_CHAIN_ID}</dd></div>
                <div className="lp-fact" data-spot><dt>Mainnet contracts</dt><dd>10 deployed · 10 runtime bytecodes</dd></div>
              </>
            : <>
                <div className="lp-fact" data-spot><dt>Project status</dt><dd>Testnet deployment</dd></div>
                <div className="lp-fact" data-spot><dt>Contract evidence</dt><dd>Testnet receipts and source checks</dd></div>
              </>}
          <div className="lp-fact" data-spot><dt>Interactive environment</dt><dd>Robinhood Testnet · {ROBINHOOD_TESTNET_CHAIN_ID}</dd></div>
          <div className="lp-fact" data-spot><dt>Audit</dt><dd>None</dd></div>
          <div className="lp-fact" data-spot><dt>Funds held</dt><dd>None</dd></div>
        </dl>
      </div>
    </section>
  );
}
