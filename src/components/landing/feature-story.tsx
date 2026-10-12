"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Arrow } from "./arrow";
import { setFeature, type FeatureId } from "./feature-state";
import { scrollToId } from "./smooth-scroll";

/* The three feature introductions as one pinned composition.

   Desktop: a tall runway holds a sticky stage; scrolling does not move the stage, it moves a single number,
   s (0 -> 2), and the scene whose index is nearest s is the one shown. Each scene has a slot of STEP of a
   screen; its anchor sits at the middle of that slot, where s is exactly its index, so a link to #bojagi
   always lands on the BOJAGI scene and never on the one before it. Between two slots the scenes cross
   over in a short window (WINDOW of a step), and nowhere else does anything move: no dead scroll.

   Phones, short windows and reduced motion: the same three scenes, stacked as ordinary blocks.

   The writer of "which feature is on screen" is this file and only this file (feature-state.ts); the bar
   reads it. The URL hash follows it, so the hash, the scene and the highlighted link are one fact. */

const WINDOW = 0.36;

type Scene = {
  id: FeatureId;
  n: string;
  name: string;
  sub: string;
  kicker: string;
  headline: string;
  text: string;
  use: string;
  chips: string[];
  href: string;
  cta: string;
};

const SCENES: Scene[] = [
  {
    id: "dojang",
    n: "01",
    name: "DOJANG",
    sub: "Credential Access",
    kicker: "Credential layer · public",
    headline: "Credentials that contracts can check.",
    text: "A project credential links one wallet to an eligibility record on-chain, with a policy, an expiry and a way to revoke it. Contracts read it before they allow an action.",
    use: "A project issues a credential to a member wallet, and any contract can confirm it before the member acts.",
    chips: ["Policy 4 · DAO access", "Policy 3 · Lending"],
    href: "/dojang",
    cta: "Open DOJANG",
  },
  {
    id: "bojagi",
    n: "02",
    name: "BOJAGI",
    sub: "Private Eligibility Proof",
    kicker: "Proof layer · private",
    headline: "Prove it. Keep the value private.",
    text: "Your browser proves that the private value behind a credential meets a rule. Only the proof goes on-chain; the value and its salt never leave your device.",
    use: "Show that you meet a lending requirement without publishing the number behind it.",
    chips: ["Policy 3 · Lending proof", "Zero-knowledge"],
    href: "/bojagi",
    cta: "Open BOJAGI",
  },
  {
    id: "dao",
    n: "03",
    name: "DAO",
    sub: "Credential-Gated Governance",
    kicker: "Governance layer · public",
    headline: "Governance for credential holders.",
    text: "Holders of an active project credential propose and vote on-chain. Each eligible wallet counts once per proposal, and every vote is public.",
    use: "Propose a change to the DAO's own credential-validity rule, then let eligible holders vote on it.",
    chips: ["Policy 4 · Voting", "Public votes"],
    href: "/dao",
    cta: "Open DAO",
  },
];

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (x: number) => x * x * (3 - 2 * x);

/* the position of the stage among the scenes, as a function of how far into the runway the page is (u = scenes scrolled) */
function sceneAt(u: number): number {
  if (u <= 1 - WINDOW / 2) return 0;
  if (u < 1 + WINDOW / 2) return smooth(clamp01((u - (1 - WINDOW / 2)) / WINDOW));
  if (u <= 2 - WINDOW / 2) return 1;
  if (u < 2 + WINDOW / 2) return 1 + smooth(clamp01((u - (2 - WINDOW / 2)) / WINDOW));
  return 2;
}

/* ---- the three instruments: a credential, a proof, a ballot. Illustrations, never live results. ---- */
function CredentialVisual() {
  return (
    <div className="fxv fxv--dojang" aria-hidden="true">
      <div className="fxv__ledger">
        <p>Credential registry</p>
        {[0, 1, 2].map((i) => (
          <span key={i}><i /><u /><em /></span>
        ))}
      </div>
      <div className="fxv__card">
        <div className="fxv__card-top"><i /><span>Project credential</span><em>Example</em></div>
        <dl>
          <div><dt>Wallet</dt><dd><u /></dd></div>
          <div><dt>Commitment</dt><dd><u /></dd></div>
          <div><dt>Policy</dt><dd className="fxv__pol"><b>4</b><small>DAO</small><b>3</b><small>Lending</small></dd></div>
          <div><dt>Issuer</dt><dd><u className="fxv__short" /></dd></div>
          <div><dt>Version</dt><dd><strong>1</strong></dd></div>
          <div><dt>Expires</dt><dd><u className="fxv__short" /></dd></div>
          <div><dt>Status</dt><dd><strong>Active · example</strong></dd></div>
        </dl>
        <span className="fxv__seal">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.2 4.2L19 7" /></svg>
        </span>
      </div>
      <p className="fxv__tag fxv__tag--a">Recorded on-chain</p>
      <p className="fxv__tag fxv__tag--b">Checked by contracts</p>
    </div>
  );
}

function ProofVisual() {
  return (
    <div className="fxv fxv--bojagi" aria-hidden="true">
      <div className="fxv__side fxv__side--device">
        <p className="fxv__label">Your device · private</p>
        <div className="fxv__witness">
          <div><span>Value</span><i className="lp-veil" /></div>
          <div><span>Salt</span><i className="lp-veil" /></div>
          <div><span>Witness</span><b>JSON · in memory</b></div>
        </div>
        <div className="fxv__circuit"><span>Circuit</span><b>≥ threshold</b></div>
        <div className="fxv__gen"><span>Proof generated here</span><u /></div>
      </div>
      <div className="fxv__bridge">
        <span className="fxv__bridge-line" />
        <span className="fxv__bridge-dot" />
        <p>Proof only</p>
      </div>
      <div className="fxv__side fxv__side--chain">
        <p className="fxv__label">On-chain · public</p>
        <div className="fxv__verifier">
          <span>Verifier contract</span>
          <strong><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.2 4.2L19 7" /></svg>Valid · example</strong>
        </div>
        <ul className="fxv__public">
          <li>Wallet</li><li>Commitment</li><li>Policy</li><li>Chain</li><li>Target contract</li><li>Proof</li>
        </ul>
      </div>
    </div>
  );
}

function BallotVisual() {
  const wallets = [1, 1, 1, 1, 0, 1, 1, 2, 0, 1, 2, 1, 0, 1, 3, 1, 1, 0, 2, 1, 1, 0, 1, 1, 3, 1, 2, 1, 0, 1];
  return (
    <div className="fxv fxv--dao" aria-hidden="true">
      <div className="fxv__proposal">
        <div className="fxv__proposal-top"><span>Proposal</span><em>Example</em></div>
        <p className="fxv__proposal-title">Set the minimum remaining credential validity</p>
        <ol className="fxv__steps">
          <li data-done="true"><i />Propose</li>
          <li data-done="true"><i />Vote</li>
          <li><i />Finalize</li>
          <li><i />Execute</li>
        </ol>
        <div className="fxv__votes">
          <span>For<u style={{ ["--w" as string]: "64%" }} /></span>
          <span>Against<u style={{ ["--w" as string]: "22%" }} /></span>
          <span>Abstain<u style={{ ["--w" as string]: "14%" }} /></span>
        </div>
      </div>
      <div className="fxv__wallets">
        <p>Eligible wallets · one vote each · votes are public</p>
        <div>
          {wallets.map((w, i) => <i key={i} data-v={w} />)}
        </div>
      </div>
    </div>
  );
}

const VISUALS: Record<FeatureId, () => React.ReactElement> = { dojang: CredentialVisual, bojagi: ProofVisual, dao: BallotVisual };

export function FeatureStory() {
  const [mode, setMode] = useState<"pinned" | "stacked">("pinned");
  const [active, setActive] = useState<FeatureId | null>(null);
  const runwayRef = useRef<HTMLDivElement>(null);
  const sceneRefs = useRef<(HTMLElement | null)[]>([]);
  const lastFeature = useRef<FeatureId | null>(null);

  /* pinned only where there is room for it and the visitor has not asked for less motion */
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px) and (min-height: 640px) and (prefers-reduced-motion: no-preference)");
    const apply = () => setMode(mq.matches ? "pinned" : "stacked");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const runway = runwayRef.current;
    if (!runway) return;
    let raf = 0;

    const publish = (feature: FeatureId | null) => {
      setFeature(feature);
      setActive(feature);
      /* the URL follows the scene; leaving the section clears it, but only if it was ours */
      if (feature) {
        if (window.location.hash !== `#${feature}`) window.history.replaceState(null, "", `#${feature}`);
      } else if (lastFeature.current && SCENES.some((s) => `#${s.id}` === window.location.hash)) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
      lastFeature.current = feature;
    };

    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      if (mode === "pinned") {
        const step = vh * 0.85;
        const u = -runway.getBoundingClientRect().top / step;
        const s = sceneAt(u);
        SCENES.forEach((scene, k) => {
          const el = sceneRefs.current[k];
          if (!el) return;
          const d = s - k;
          const v = clamp01(1.25 - Math.abs(d) * 1.8); /* whole for most of its slot, about a third at the seam */
          el.style.setProperty("--v", v.toFixed(3));
          el.style.setProperty("--d", d.toFixed(3));
          const on = v > 0.5;
          (el as HTMLElement & { inert: boolean }).inert = !on;
          el.dataset.on = on ? "true" : "false";
        });
        const inRange = u > -0.25 && u < 3.25;
        publish(inRange ? SCENES[Math.round(s)].id : null);
      } else {
        let best: FeatureId | null = null;
        let bestDist = Infinity;
        SCENES.forEach((scene, k) => {
          const el = sceneRefs.current[k];
          if (!el) return;
          const r = el.getBoundingClientRect();
          if (r.bottom < vh * 0.15 || r.top > vh * 0.85) return;
          const dist = Math.abs(r.top + r.height / 2 - vh / 2);
          if (dist < bestDist) { bestDist = dist; best = scene.id; }
        });
        publish(best);
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      setFeature(null);
    };
  }, [mode]);

  const go = (id: FeatureId) => (event: React.MouseEvent) => {
    if (scrollToId(id)) event.preventDefault();
  };

  return (
    <>
      <section className="lp-sec lp-fx-intro" id="trust" aria-labelledby="trust-title">
        <div className="lp-wrap">
          <p className="lp-eyebrow" data-lp-reveal style={{ ["--ac" as string]: "var(--lp-public)" }}>
            <i aria-hidden="true" />
            03 — The trust layer
          </p>
          <h2 className="lp-h2" id="trust-title" data-lp-reveal style={{ ["--i" as string]: 1 }}>
            Trust is <em>verified.</em> Privacy is <em className="o">preserved.</em>
          </h2>
          <p className="lp-lead" data-lp-reveal style={{ ["--i" as string]: 2 }}>
            DOJANG establishes project-defined eligibility. BOJAGI proves that eligibility without exposing the private value.
            DAO governance and Lending put both to work.
          </p>
        </div>
      </section>

      <section className="lp-fx" data-mode={mode} aria-label="DOJANG, BOJAGI and DAO">
        <div className="lp-fx__runway" ref={runwayRef}>
          <div className="lp-fx__stage">
            <div className="lp-fx__top">
              <p className="lp-fx__eyebrow"><i aria-hidden="true" />The trust layer</p>
              <p className="lp-fx__count" aria-hidden="true">
                <b>{active ? SCENES.find((s) => s.id === active)?.n : "01"}</b> / 03
              </p>
            </div>

            <div className="lp-fx__scenes">
              {SCENES.map((scene, k) => {
                const Visual = VISUALS[scene.id];
                return (
                  <article
                    key={scene.id}
                    className="lp-fx__scene"
                    data-feature={scene.id}
                    data-on={mode === "pinned" ? (k === 0 ? "true" : "false") : "true"}
                    ref={(el) => { sceneRefs.current[k] = el; }}
                    id={mode === "stacked" ? scene.id : undefined}
                    aria-labelledby={`fx-${scene.id}-name`}
                  >
                    <div className="lp-fx__copy">
                      <p className="lp-fx__kicker"><span>{scene.n}</span>{scene.kicker}</p>
                      <h3 className="lp-fx__name" id={`fx-${scene.id}-name`}>
                        {scene.name}
                        <small>{scene.sub}</small>
                      </h3>
                      <p className="lp-fx__headline">{scene.headline}</p>
                      <p className="lp-fx__text">{scene.text}</p>
                      <ul className="lp-fx__chips">
                        {scene.chips.map((chip) => <li key={chip}>{chip}</li>)}
                      </ul>
                      <p className="lp-fx__use"><b>Use case</b>{scene.use}</p>
                      <Link className="lp-fx__link" href={scene.href}>{scene.cta} <Arrow /></Link>
                    </div>
                    <div className="lp-fx__visual">
                      <Visual />
                    </div>
                  </article>
                );
              })}
            </div>

            <ol className="lp-fx__rail" aria-label="Feature introductions">
              {SCENES.map((scene) => (
                <li key={scene.id}>
                  <a href={`#${scene.id}`} data-active={active === scene.id ? "true" : "false"} onClick={go(scene.id)}>
                    <span>{scene.n}</span>{scene.name}
                  </a>
                </li>
              ))}
            </ol>
          </div>

          {mode === "pinned" ? (
            <div className="lp-fx__slots" aria-hidden="true">
              {SCENES.map((scene) => (
                <div className="lp-fx__slot" key={scene.id}><span className="lp-fx__mark" id={scene.id} /></div>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
