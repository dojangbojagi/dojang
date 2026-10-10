"use client";

import { useEffect, useRef, useState } from "react";
import { GlyphSolid, type ShapeId } from "./glyph-solid";
import { scrollToY } from "./smooth-scroll";

/* 01 · The idea. The same fact, seen three ways by a verifier.

   On big screens this is a sticky scene: the section is a tall runway, the content is
   pinned, and scrolling moves one card through its three states. Everywhere else (phones,
   short windows, reduced motion) the three states are plain rows, from the same copy.

   It comes in behind the hero. On the pinned layout the scene is already in its final place while the
   hero's camera finishes pushing in, and it grows from small to full size (and fades in) over the last
   ZIN screens of that push: --zk, scrubbed by scroll position, so it reverses too. Everywhere else the
   blocks marked .lp-ie fade in and rise (64px) as they travel up from the bottom of the screen. */

const RISE = 64; /* px; keep in sync with .lp-ie in landing.css */
const ZIN = 0.62; /* screens of scroll the scene takes to grow in; keep in sync with --lp-zin in landing.css */
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const STATES = [
  { name: "A public attestation", note: "Easy to trust, impossible to keep private.", tone: "warn", chip: "Trusted, but exposed" },
  { name: "A private note", note: "Private, but no one else can rely on it.", tone: "neutral", chip: "Private, but unverifiable" },
  { name: "A sealed credential with a proof", note: "The chain learns the answer and nothing else.", tone: "valid", chip: "Trusted and private" },
] as const;

const CAPTION = "What a verifier sees about the same fact. An illustration, not real data.";
const IDEA_SHAPES: readonly ShapeId[] = ["sphere", "cube", "seal"];
const SOLID_LABEL = [
  "A sphere of readable characters with a few orange ones among them: the private value, exposed.",
  "A closed cube of sealed grey cells: the value is hidden, but nothing can check it.",
  "An orange core that stays sealed, inside a blue ring: the public proof the chain can check.",
] as const;
const PIN_QUERY = "(min-width: 1024px) and (min-height: 680px)"; /* keep in sync with landing.css */
const BANDS = [0.33, 0.66];
const HYSTERESIS = 0.025;

export function IdeaScene() {
  const runRef = useRef<HTMLElement>(null);
  const [state, setState] = useState(0);
  const [live, setLive] = useState(true);

  useEffect(() => {
    const run = runRef.current;
    if (!run) return;
    const pinned = window.matchMedia(PIN_QUERY);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const items = Array.from(run.querySelectorAll<HTMLElement>(".lp-ie"));
    const lastK = items.map(() => -1);
    const lift = items.map(() => 0); /* the translate each block has now, so its layout position can be read without it */
    let raf = 0;
    let lastP = -1;

    /* Each block's progress comes from where it is on screen: 0 while it is below the fold, 1 once
       it has climbed to 55% of the screen height. Reads first, writes after, so layout runs once. */
    const scrub = () => {
      if (reduced) return;
      const vh = window.innerHeight;
      const r = run.getBoundingClientRect();
      if (r.bottom < -vh * 0.5 || r.top > vh * 2.2) return;
      const tops = items.map((el, i) => el.getBoundingClientRect().top - lift[i]);
      for (let i = 0; i < items.length; i++) {
        const k = clamp01((vh * 0.985 - tops[i]) / (vh * 0.43));
        if (Math.abs(k - lastK[i]) < 0.004) continue;
        lastK[i] = k;
        lift[i] = (1 - k) * RISE;
        items[i].style.setProperty("--k", k.toFixed(3));
      }
    };

    let lastZ = -1;
    let liveNow = true;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      const r = run.getBoundingClientRect();
      if (!pinned.matches) {
        scrub();
        run.style.setProperty("--ip", "0");
        if (lastZ !== 1) { lastZ = 1; run.style.setProperty("--zk", "1"); }
        if (!liveNow) { liveNow = true; setLive(true); }
        return;
      }
      /* pinned: the scene sits in its final place from the moment the run reaches the top, and grows in over ZIN screens */
      const zin = reduced ? 0 : vh * ZIN;
      const z = zin > 0 ? clamp01(-r.top / zin) : 1;
      const zk = z;
      if (Math.abs(zk - lastZ) > 0.002 || (zk === 1) !== (lastZ === 1)) {
        lastZ = zk;
        run.style.setProperty("--zk", zk.toFixed(3));
      }
      const interactive = z > 0.92;
      if (interactive !== liveNow) { liveNow = interactive; setLive(interactive); }

      const travel = r.height - vh - zin;
      const p = travel > 0 ? Math.min(1, Math.max(0, (-r.top - zin) / travel)) : 0;
      if (Math.abs(p - lastP) > 0.002) {
        lastP = p;
        run.style.setProperty("--ip", p.toFixed(3));
      }
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
    const zin = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : window.innerHeight * ZIN;
    const travel = run.offsetHeight - window.innerHeight - zin;
    const centre = i === 0 ? 0.12 : i === 1 ? 0.5 : 0.88;
    const top = run.getBoundingClientRect().top + window.scrollY + zin + travel * centre;
    scrollToY(top);
  };

  return (
    <section className="lp-idea-run" id="idea" ref={runRef} aria-labelledby="idea-title">
      <div className="lp-idea-pin">
        <div className="lp-wrap lp-idea" data-live={live ? "1" : "0"} inert={!live}>
          <div className="lp-idea__copy">
            <p className="lp-eyebrow lp-ie" style={{ ["--ac" as string]: "var(--lp-blue)" }}>
              <i aria-hidden="true" />
              01 — The idea
            </p>
            <h2 className="lp-h2 lp-ie" id="idea-title">
              Verifiable facts should not require <em>public</em> data.
            </h2>
            <p className="lp-lead lp-ie">
              Most on-chain checks work by publishing the fact itself. That makes the fact easy to trust and impossible to keep private. Private data has the opposite problem: no one else can rely on it.
            </p>
            <p className="lp-body lp-ie">
              This protocol pairs the two. A trusted issuer seals a fact in an <strong>attestation</strong>. You then prove that the sealed fact meets a rule, without showing the fact. The rule is enforced by a smart contract, so anyone can inspect that it was applied.
            </p>

            {/* sticky mode only: where you are in the scene */}
            <ol className="lp-idea__steps lp-ie" aria-label="Three views of the same fact">
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

          <div className="lp-idea__stage lp-ie">
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
                <GlyphSolid className="lp-solid" shape={IDEA_SHAPES[state]} label={SOLID_LABEL[state]} />
                <div className="lp-vrule" aria-hidden={state !== 2}>
                  <span>the rule is met, and the value stays hidden</span>
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
                <GlyphSolid className="lp-solid lp-solid--row" shape="sphere" animated={false} label={SOLID_LABEL[0]} />
                <span className="lp-chip" data-tone="warn"><i aria-hidden="true" />Trusted, but exposed</span>
              </div>
              <div className="lp-lrow">
                <h3>A private note</h3>
                <GlyphSolid className="lp-solid lp-solid--row" shape="cube" animated={false} label={SOLID_LABEL[1]} />
                <span className="lp-chip" data-tone="neutral"><i aria-hidden="true" />Private, but unverifiable</span>
              </div>
              <div className="lp-lrow lp-lrow--proof">
                <h3>A sealed credential with a proof</h3>
                <GlyphSolid className="lp-solid lp-solid--row" shape="seal" animated={false} label={SOLID_LABEL[2]} />
                <div className="lp-lrow__view"><u>the rule is met, and the value stays hidden</u><span className="lp-yes">yes</span></div>
                <span className="lp-chip" data-tone="valid"><i aria-hidden="true" />Trusted and private</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
