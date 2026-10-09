"use client";

import { useEffect, useRef, useState } from "react";

/* 01 · The idea. The same fact, seen three ways by a verifier.

   On big screens this is a sticky scene: the section is a tall runway, the content is
   pinned, and scrolling moves one card through its three states. Everywhere else (phones,
   short windows, reduced motion) the three states are plain rows, from the same copy. */

const STATES = [
  { name: "A public attestation", note: "Easy to trust, impossible to keep private.", tone: "warn", chip: "Trusted, but exposed" },
  { name: "A private note", note: "Private, but no one else can rely on it.", tone: "neutral", chip: "Private, but unverifiable" },
  { name: "A sealed credential with a proof", note: "The chain learns the answer and nothing else.", tone: "valid", chip: "Trusted and private" },
] as const;

const CAPTION = "What a verifier sees about the same fact. Illustrative values, not real data.";
const PIN_QUERY = "(min-width: 1024px) and (min-height: 680px)"; /* keep in sync with landing.css */
const BANDS = [0.33, 0.66];
const HYSTERESIS = 0.025;

export function IdeaScene() {
  const runRef = useRef<HTMLElement>(null);
  const [state, setState] = useState(0);

  useEffect(() => {
    const run = runRef.current;
    if (!run) return;
    const pinned = window.matchMedia(PIN_QUERY);
    let raf = 0;

    const update = () => {
      raf = 0;
      if (!pinned.matches) {
        run.style.setProperty("--ip", "0");
        return;
      }
      const r = run.getBoundingClientRect();
      const travel = r.height - window.innerHeight;
      const p = travel > 0 ? Math.min(1, Math.max(0, -r.top / travel)) : 0;
      run.style.setProperty("--ip", p.toFixed(4));
      /* hysteresis, so the card does not flicker when the scroll rests on a boundary */
      setState((prev) => {
        let s = prev;
        while (s < 2 && p > BANDS[s] + HYSTERESIS) s++;
        while (s > 0 && p < BANDS[s - 1] - HYSTERESIS) s--;
        return s;
      });
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    pinned.addEventListener("change", schedule);
    update();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      pinned.removeEventListener("change", schedule);
    };
  }, []);

  /* a click on a step scrolls to the middle of its slice of the runway, so scroll stays the one source of truth */
  const goTo = (i: number) => {
    const run = runRef.current;
    if (!run) return;
    const travel = run.offsetHeight - window.innerHeight;
    const centre = i === 0 ? 0.12 : i === 1 ? 0.5 : 0.88;
    const top = run.getBoundingClientRect().top + window.scrollY + travel * centre;
    window.scrollTo({ top, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  return (
    <section className="lp-idea-run" id="idea" ref={runRef} aria-labelledby="idea-title">
      <div className="lp-idea-pin">
        <div className="lp-wrap lp-idea">
          <div className="lp-idea__copy">
            <p className="lp-eyebrow" data-lp-reveal style={{ ["--ac" as string]: "var(--lp-blue)" }}>
              <i aria-hidden="true" />
              01 — The idea
            </p>
            <h2 className="lp-h2" id="idea-title" data-lp-reveal style={{ ["--i" as string]: 1 }}>
              Verifiable facts should not require <em>public</em> data.
            </h2>
            <p className="lp-lead" data-lp-reveal style={{ ["--i" as string]: 2 }}>
              Most on-chain checks work by publishing the fact itself. That makes the fact easy to trust and impossible to keep private. Private data has the opposite problem: no one else can rely on it.
            </p>
            <p className="lp-body" data-lp-reveal style={{ ["--i" as string]: 3 }}>
              This protocol pairs the two. A trusted issuer seals a fact in an <strong>attestation</strong>. You then prove that the sealed fact meets a rule, without showing the fact. The rule is enforced by a smart contract, so anyone can inspect that it was applied.
            </p>

            {/* sticky mode only: where you are in the scene */}
            <ol className="lp-idea__steps" aria-label="Three views of the same fact">
              {STATES.map((s, i) => (
                <li key={s.name}>
                  <button type="button" className="lp-istep" data-on={state === i} onClick={() => goTo(i)}>
                    <span className="lp-istep__n">{`0${i + 1}`}</span>
                    <b>{s.name}</b>
                    <span className="lp-istep__note">{s.note}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>

          <div className="lp-idea__stage" data-lp-reveal="right" style={{ ["--i" as string]: 2 }}>
            {/* sticky mode: one card, three states */}
            <div className="lp-vcard" data-s={state} data-spot>
              <div className="lp-vcard__top">
                <p className="lp-vcard__cap">{CAPTION}</p>
                <span className="lp-vcard__eye"><i aria-hidden="true" />Verifier view</span>
              </div>
              <div className="lp-vcard__body" aria-live="polite">
                <div className="lp-vtitles">
                  {STATES.map((s, i) => (
                    <h3 key={s.name} data-on={state === i} data-past={state > i}>{s.name}</h3>
                  ))}
                </div>
                <div className="lp-vfield">
                  <span>balance</span>
                  <span className="lp-vval">
                    <b className="lp-vval__num">1,250</b>
                    <span className="lp-vval__veil" role="img" aria-label="Hidden value" />
                  </span>
                </div>
                <div className="lp-vrule" aria-hidden={state !== 2}>
                  <span>meets minimum of 1,000</span>
                  <span className="lp-yes">yes</span>
                </div>
                <div className="lp-vchips">
                  {STATES.map((s, i) => (
                    <span className="lp-chip" data-tone={s.tone} data-on={state === i} key={s.chip}><i aria-hidden="true" />{s.chip}</span>
                  ))}
                </div>
                <p className="lp-vcard__note">{STATES[state].note}</p>
              </div>
            </div>

            {/* everywhere else: the three states as rows */}
            <div className="lp-ledger lp-ledger--static" data-spot>
              <p className="lp-ledger__cap">{CAPTION}</p>
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
        </div>
      </div>
    </section>
  );
}
