"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { GIWA_CHAIN_ID } from "@/lib/config/chain";
import { Arrow } from "./arrow";
import { GlyphField } from "./glyph-field";

/* Phase 1 is the claim on white, with the sealed square sitting in the gap.
   Scrolling opens that square until it fills the screen; phase 2, the hero, was
   inside it all along. The cover is a tall runway with a sticky stage; scroll
   progress becomes --p (0..1) and the four clip insets of the opening, all
   written on the stage, and every animated value in landing.css reads them. */

const STACK = ["GIWA Sepolia", "Dojang", "EAS", "Noir", "Barretenberg", "UltraHonk", "Solidity"];

/* "Prove more. Reveal less." -> ["Prove more.", "Reveal less."] */
function splitTagline(tagline: string): [string, string] {
  const m = tagline.trim().match(/^(.+?[.!?])\s+(.+)$/);
  return m ? [m[1], m[2]] : [tagline.trim(), ""];
}

const ANIMATED_SHARE = 0.8; /* the opening completes at 80% of the runway; the rest is a short hold */
const NAV_H = 76;

const motionQuery = () => window.matchMedia("(prefers-reduced-motion: reduce)");

function ease(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

type Props = {
  tagline: string;
  contractsLabel: string;
};

export function CoverReveal({ tagline, contractsLabel }: Props) {
  const coverRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLSpanElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const [wordA, wordB] = splitTagline(tagline);

  useEffect(() => {
    const cover = coverRef.current;
    const stage = stageRef.current;
    const slot = slotRef.current;
    const box = boxRef.current;
    const hero = heroRef.current;
    if (!cover || !stage || !slot || !box || !hero) return;
    const root = cover.closest<HTMLElement>(".lp");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let geo = { sw: 0, sh: 0, x: 0, y: 0, w: 0, h: 0 };
    let raf = 0;
    let last = -1;
    let heroOn: boolean | null = null;

    const setPhase = (dark: boolean) => {
      const next = dark ? "dark" : "light";
      if (root && root.dataset.phase !== next) root.dataset.phase = next;
    };
    const setHero = (on: boolean) => {
      if (heroOn === on) return;
      heroOn = on;
      (hero as HTMLElement & { inert: boolean }).inert = !on; /* hero links stay out of the tab order until visible */
    };

    /* offsetLeft/offsetTop are layout values, so the transforms on the
       neighbouring words can never skew the measurement */
    const measure = () => {
      geo = {
        sw: stage.clientWidth,
        sh: stage.clientHeight,
        x: slot.offsetLeft,
        y: slot.offsetTop,
        w: slot.offsetWidth,
        h: slot.offsetHeight,
      };
      last = -1;
    };

    const paint = () => {
      raf = 0;

      if (motion.matches) {
        /* stacked layout: the nav turns dark once the hero reaches it */
        setHero(true);
        setPhase(box.getBoundingClientRect().top <= NAV_H * 0.6);
        return;
      }

      if (!geo.sw || !geo.sh) measure();
      if (!geo.sh) return;

      const r = cover.getBoundingClientRect();
      const run = (r.height - geo.sh) * ANIMATED_SHARE;
      const raw = run > 0 ? -r.top / run : 1;
      const p = raw < 0 ? 0 : raw > 1 ? 1 : raw;
      if (Math.abs(p - last) < 0.0006) return;
      last = p;

      const e = ease(p);
      const k = 1 - e;
      const l = geo.x * k;
      const t = geo.y * k;
      const ri = (geo.sw - geo.x - geo.w) * k;
      const b = (geo.sh - geo.y - geo.h) * k;
      const s = stage.style;
      s.setProperty("--p", p.toFixed(4));
      s.setProperty("--ct", `${t.toFixed(1)}px`);
      s.setProperty("--cr", `${ri.toFixed(1)}px`);
      s.setProperty("--cb", `${b.toFixed(1)}px`);
      s.setProperty("--cl", `${l.toFixed(1)}px`);
      s.setProperty("--crad", `${(geo.w * 0.09 * k).toFixed(2)}px`);
      s.setProperty("--bx", `${l.toFixed(1)}px`);
      s.setProperty("--by", `${t.toFixed(1)}px`);
      s.setProperty("--bw", `${(geo.sw - l - ri).toFixed(1)}px`);
      s.setProperty("--bh", `${(geo.sh - t - b).toFixed(1)}px`);
      s.setProperty("--ox", `${(geo.x + geo.w / 2).toFixed(1)}px`);
      s.setProperty("--oy", `${(geo.y + geo.h / 2).toFixed(1)}px`);

      setHero(p > 0.55);
      setPhase(t < NAV_H * 0.8 && b < 96);
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const remeasure = () => {
      measure();
      schedule();
    };

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", remeasure);
    const ro = new ResizeObserver(remeasure);
    ro.observe(stage);
    motion.addEventListener("change", remeasure);
    /* fonts change the width of the words, and so where the square sits */
    document.fonts?.ready.then(remeasure, () => {});
    measure();
    paint();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", remeasure);
      ro.disconnect();
      motion.removeEventListener("change", remeasure);
    };
  }, []);

  return (
    <section className="lp-cover" ref={coverRef} aria-label="Introduction">
      <div className="lp-stage" ref={stageRef}>
        {/* ---- Phase 1: the claim ---- */}
        <div className="lp-p1">
          <h1 className="lp-words" id="lp-title">
            <span className="lp-word lp-word--a">{wordA}</span>
            <span className="lp-slot" ref={slotRef} aria-hidden="true" />
            {wordB ? <span className="lp-word lp-word--b">{wordB}</span> : null}
          </h1>
          <p className="lp-sub">
            Verify trusted state, prove eligibility privately, then unlock an <span style={{ whiteSpace: "nowrap" }}>on-chain</span> action.
            A testnet demonstration on GIWA Sepolia.
          </p>
          <p className="lp-hint" aria-hidden="true">
            <span>Scroll to open</span>
            <i />
          </p>
        </div>

        {/* ---- The opening, and phase 2 inside it ---- */}
        <div className="lp-box" ref={boxRef} data-lp-box>
          <GlyphField />
          <div className="lp-glow" aria-hidden="true" />

          <div className="lp-hero" ref={heroRef} inert>
            <h2 className="lp-h">
              <span className="lp-h__l1">Verify the <b className="lp-h__public">fact</b></span>
              <span className="lp-h__l2">Prove it <b className="lp-h__private">privately</b></span>
              <span className="lp-h__l3">Unlock <b className="lp-h__public">on-chain</b></span>
            </h2>
            <p className="lp-lede">
              The exact value stays on your device. Only a proof that it met the rule is checked <span style={{ whiteSpace: "nowrap" }}>on-chain</span>.
            </p>
            <div className="lp-actions">
              <Link className="lp-btn lp-btn--primary" href="/dojang">
                Try the demo
                <Arrow />
              </Link>
              <a
                className="lp-btn lp-btn--ghost"
                href="#how"
                onClick={(e) => {
                  /* a long way down: glide there unless the visitor prefers reduced motion */
                  const target = document.getElementById("how");
                  if (!target) return;
                  e.preventDefault();
                  target.scrollIntoView({ behavior: motionQuery().matches ? "auto" : "smooth", block: "start" });
                }}
              >
                How it works
              </a>
            </div>
            <p className="lp-status">
              <i aria-hidden="true" />
              <span>Testnet demonstration</span>
              <span>GIWA Sepolia · {GIWA_CHAIN_ID}</span>
              <span>Not audited</span>
              <span>No funds held</span>
              <span>Contracts: {contractsLabel}</span>
            </p>
          </div>

          <p className="lp-pointer-hint" aria-hidden="true">Move the pointer · seal the data</p>
          <div className="lp-veil-cover" aria-hidden="true" />
        </div>
        <div className="lp-outline" aria-hidden="true" />

        {/* ---- Always present, light then dark ---- */}
        <div className="lp-marq">
          <span className="lp-marq__label">Built on</span>
          <div className="lp-marq__view">
            <div className="lp-marq__track" aria-hidden="true">
              <ul className="lp-marq__group">
                {STACK.map((n) => <li className="lp-marq__item" key={n}>{n}</li>)}
              </ul>
              <ul className="lp-marq__group">
                {STACK.map((n) => <li className="lp-marq__item" key={n}>{n}</li>)}
              </ul>
            </div>
          </div>
          <p className="lp-sr">Built on {STACK.join(", ")}.</p>
        </div>
      </div>
    </section>
  );
}
