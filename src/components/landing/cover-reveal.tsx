"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { GIWA_CHAIN_ID } from "@/lib/config/chain";
import { Arrow } from "./arrow";
import { GlyphField } from "./glyph-field";

/* Phase 1 is the claim on white. The full stop after "more" is a glossy dot; scrolling
   swells it into a rounded square and then into the whole screen, and phase 2, the hero,
   was inside it all along. After a short hold the hero leaves again, line by line.

   The cover is a tall runway with a sticky stage. Scroll position becomes a handful of
   numbers written on the stage (see the header of landing.css), and every animated value
   in the stylesheet reads them. Nothing here animates by itself, so it runs in reverse. */

const STACK = ["GIWA Sepolia", "Dojang", "EAS", "Noir", "Barretenberg", "UltraHonk", "Solidity"];

/* "Prove more. Reveal less." -> ["Prove more", "Reveal less."]; the stop after "more" becomes the dot */
function splitTagline(tagline: string): [string, string] {
  const m = tagline.trim().match(/^(.+?)[.!?]\s+(.+)$/);
  return m ? [m[1], m[2]] : [tagline.trim(), ""];
}

/* The runway, as fractions: the opening grows, the hero holds, then the hero leaves. */
const OPEN = 0.56;
const HOLD = 0.16;
const NAV_H = 76;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/* How far the opening has grown. Geometric at first, so the dot visibly swells from the very
   first scroll, then eased so it lands softly on the full screen. */
function openness(p: number) {
  const R = 36;
  const geo = (Math.pow(R, p) - 1) / (R - 1);
  return 0.7 * geo + 0.3 * (p * p * (3 - 2 * p));
}

const motionQuery = () => window.matchMedia("(prefers-reduced-motion: reduce)");

/* ---------------------------------------------------------------- sparks */
/* While the opening is being scrolled, it throws off sparks from its rim. */
type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; c: string };
type Rect = { x: number; y: number; w: number; h: number };

function createSparks(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  const parts: Spark[] = [];
  const COLORS = ["#ff7a3d", "#ef5f22", "#ffb08a", "#3b86ff", "#6ba3ff"];
  let dpr = 1;
  let w = 0;
  let h = 0;
  let raf = 0;
  let last = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }

  function frame(now: number) {
    raf = 0;
    if (!ctx) return;
    const dt = Math.min(0.05, (now - (last || now - 16)) / 1000);
    last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = "round";
    const drag = Math.pow(0.9, dt * 60);
    for (let i = parts.length - 1; i >= 0; i--) {
      const s = parts[i];
      s.life -= dt;
      if (s.life <= 0) {
        parts.splice(i, 1);
        continue;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= drag;
      s.vy *= drag;
      ctx.globalAlpha = Math.pow(s.life / s.max, 1.2);
      ctx.strokeStyle = s.c;
      ctx.shadowColor = s.c;
      ctx.shadowBlur = 10;
      ctx.lineWidth = s.r;
      ctx.beginPath();
      ctx.moveTo(s.x - s.vx * 0.07, s.y - s.vy * 0.07);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
      ctx.fillStyle = s.c;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 0.75, 0, 6.283);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    if (parts.length) raf = requestAnimationFrame(frame);
    else last = 0;
  }

  return {
    resize,
    emit(rect: Rect, count: number) {
      for (let i = 0; i < count; i++) {
        /* a point on the perimeter, with its outward normal */
        let t = Math.random() * (2 * (rect.w + rect.h));
        let x = rect.x;
        let y = rect.y;
        let nx = 0;
        let ny = -1;
        if (t < rect.w) {
          x += t;
        } else if ((t -= rect.w) < rect.h) {
          x += rect.w;
          y += t;
          nx = 1;
          ny = 0;
        } else if ((t -= rect.h) < rect.w) {
          x += rect.w - t;
          y += rect.h;
          nx = 0;
          ny = 1;
        } else {
          t -= rect.w;
          y += rect.h - t;
          nx = -1;
          ny = 0;
        }
        const speed = 70 + Math.random() * 230;
        const tang = (Math.random() - 0.5) * 120;
        const max = 0.45 + Math.random() * 0.6;
        parts.push({
          x,
          y,
          vx: nx * speed - ny * tang,
          vy: ny * speed + nx * tang,
          life: max,
          max,
          r: 1.6 + Math.random() * 2.2,
          c: COLORS[(Math.random() * COLORS.length) | 0],
        });
      }
      if (parts.length > 220) parts.splice(0, parts.length - 220);
      if (!raf) raf = requestAnimationFrame(frame);
    },
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      parts.length = 0;
    },
  };
}

/* ------------------------------------------------------------- component */
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
  const sparkRef = useRef<HTMLCanvasElement>(null);
  const [wordA, wordB] = splitTagline(tagline);

  useEffect(() => {
    const cover = coverRef.current;
    const stage = stageRef.current;
    const slot = slotRef.current;
    const box = boxRef.current;
    const hero = heroRef.current;
    const sparkCanvas = sparkRef.current;
    if (!cover || !stage || !slot || !box || !hero || !sparkCanvas) return;
    const root = cover.closest<HTMLElement>(".lp");
    const motion = motionQuery();
    const sparks = createSparks(sparkCanvas);

    let geo = { sw: 0, sh: 0, x: 0, y: 0, w: 0, h: 0 };
    let raf = 0;
    let last = -1;
    let lastE = 0;
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
      sparks.resize();
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
      const run = r.height - geo.sh;
      const scrolled = -r.top;
      const p = clamp01(scrolled / (run * OPEN));
      const q = clamp01((scrolled - run * (OPEN + HOLD)) / (run * (1 - OPEN - HOLD)));
      const key = p + q * 2;
      if (Math.abs(key - last) < 0.0005) return;
      last = key;

      const e = openness(p);
      const k = 1 - e;
      const l = geo.x * k;
      const t = geo.y * k;
      const ri = (geo.sw - geo.x - geo.w) * k;
      const b = (geo.sh - geo.y - geo.h) * k;
      const bw = geo.sw - l - ri;
      const bh = geo.sh - t - b;

      /* a circle while it is a dot, a soft rounded square next, square-cornered once it fills the screen */
      const half = Math.min(bw, bh) / 2;
      const toSquare = smooth(0, 0.12, e);
      const radius = Math.min(half, (half * (1 - toSquare) + 26 * toSquare) * (1 - smooth(0.5, 1, e)));

      const s = stage.style;
      s.setProperty("--p", p.toFixed(4));
      s.setProperty("--e", e.toFixed(4));
      s.setProperty("--c", clamp01((e - 0.6) / 0.34).toFixed(4));
      s.setProperty("--q", q.toFixed(4));
      s.setProperty("--ct", `${t.toFixed(1)}px`);
      s.setProperty("--cr", `${ri.toFixed(1)}px`);
      s.setProperty("--cb", `${b.toFixed(1)}px`);
      s.setProperty("--cl", `${l.toFixed(1)}px`);
      s.setProperty("--crad", `${radius.toFixed(1)}px`);
      s.setProperty("--bx", `${l.toFixed(1)}px`);
      s.setProperty("--by", `${t.toFixed(1)}px`);
      s.setProperty("--bw", `${bw.toFixed(1)}px`);
      s.setProperty("--bh", `${bh.toFixed(1)}px`);
      s.setProperty("--ox", `${(geo.x + geo.w / 2).toFixed(1)}px`);
      s.setProperty("--oy", `${(geo.y + geo.h / 2).toFixed(1)}px`);

      setHero(e > 0.6 && q < 0.9);
      setPhase(t < NAV_H * 0.8 && b < 96);

      /* sparks leave the rim while the opening is being scrolled, in either direction */
      const moved = Math.abs(e - lastE);
      lastE = e;
      if (moved > 0.0003 && e > 0.003 && e < 0.985) {
        sparks.emit({ x: l, y: t, w: bw, h: bh }, Math.min(22, Math.ceil(moved * 900)));
      }
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
    /* fonts change the width of the words, and so where the dot sits */
    document.fonts?.ready.then(remeasure, () => {});
    measure();
    paint();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", remeasure);
      ro.disconnect();
      motion.removeEventListener("change", remeasure);
      sparks.destroy();
    };
  }, []);

  return (
    <section className="lp-cover" ref={coverRef} aria-label="Introduction">
      <div className="lp-stage" ref={stageRef}>
        {/* ---- Phase 1: the claim ---- */}
        <div className="lp-p1">
          <h1 className="lp-words" id="lp-title">
            <span className="lp-word lp-word--a">{wordA}<span className="lp-sr">.</span></span>
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
              <span className="lp-h__line lp-h__l1"><span className="lp-h__in">Verify the <b className="lp-h__public">fact</b></span></span>
              <span className="lp-h__line lp-h__l2"><span className="lp-h__in">Prove it <b className="lp-h__private">privately</b></span></span>
              <span className="lp-h__line lp-h__l3"><span className="lp-h__in">Unlock <b className="lp-h__public">on-chain</b></span></span>
            </h2>
            <div className="lp-dock" data-spot>
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
          <div className="lp-orb" aria-hidden="true" />
        </div>
        <i className="lp-ping" aria-hidden="true" />
        <div className="lp-echo lp-echo--2" aria-hidden="true" />
        <div className="lp-echo lp-echo--1" aria-hidden="true" />
        <div className="lp-outline" aria-hidden="true" />
        <canvas className="lp-sparks" ref={sparkRef} aria-hidden="true" />

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
