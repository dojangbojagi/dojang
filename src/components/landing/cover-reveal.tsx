"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Arrow } from "./arrow";
import { GlyphField } from "./glyph-field";
import { scrollToId } from "./smooth-scroll";

/* Phase 1 is the claim on white. The full stop after "more" is a black dot, like the one after "less";
   scrolling swells it into a rounded square and then into the whole screen, and phase 2, the hero,
   was inside it all along. After a short hold the camera pushes into the headline: it zooms in
   until the hero is gone, and the next section rises in behind it.

   The cover is a tall runway with a sticky stage. Scroll position becomes a handful of
   numbers written on the stage (see the header of landing.css), and every animated value
   in the stylesheet reads them. Nothing here animates by itself, so it runs in reverse. */

const STACK = ["GIWA Sepolia", "Dojang", "EAS", "Noir", "Barretenberg", "UltraHonk", "Solidity"];

/* "Prove more. Reveal less." -> ["Prove more", "Reveal less."]; the stop after "more" becomes the dot */
function splitTagline(tagline: string): [string, string] {
  const m = tagline.trim().match(/^(.+?)[.!?]\s+(.+)$/);
  return m ? [m[1], m[2]] : [tagline.trim(), ""];
}

/* The runway, as fractions of its length: the opening grows, the hero holds, then the camera
   pushes in. (--lp-run is 210svh on desktop: about a screen to open, a quarter of one to hold,
   and nine tenths of one to zoom.) */
const OPEN = 0.47;
const HOLD = 0.11;
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
/* While the opening is being scrolled, it throws off sparks from its rim.
   They are a small pool of plain elements animated with the Web Animations API (transform and
   opacity only), so the browser runs them off the main thread: no canvas, no frame loop, and
   nothing for the scroll to wait on. */
type Rect = { x: number; y: number; w: number; h: number };

function createSparks(layer: HTMLElement) {
  const pool = Array.from(layer.children) as HTMLElement[];
  let next = 0;
  return {
    emit(rect: Rect, count: number) {
      for (let i = 0; i < count; i++) {
        const el = pool[next++ % pool.length];
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
        const dist = 36 + Math.random() * 120;
        const side = (Math.random() - 0.5) * 70;
        const dx = nx * dist - ny * side;
        const dy = ny * dist + nx * side;
        el.getAnimations().forEach((a) => a.cancel());
        el.animate(
          [
            { transform: `translate3d(${x.toFixed(0)}px, ${y.toFixed(0)}px, 0) scale(1.5)`, opacity: 1, offset: 0 },
            { opacity: 0.9, offset: 0.55 },
            { transform: `translate3d(${(x + dx).toFixed(0)}px, ${(y + dy).toFixed(0)}px, 0) scale(0.7)`, opacity: 0, offset: 1 },
          ],
          { duration: 520 + Math.random() * 480, easing: "cubic-bezier(0.2, 0.6, 0.3, 1)" },
        );
      }
    },
    destroy() {
      pool.forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
    },
  };
}

/* ------------------------------------------------------------- component */
type Props = {
  tagline: string;
};

export function CoverReveal({ tagline }: Props) {
  const coverRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLSpanElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const sparkRef = useRef<HTMLDivElement>(null);
  const [wordA, wordB] = splitTagline(tagline);

  useEffect(() => {
    const cover = coverRef.current;
    const stage = stageRef.current;
    const slot = slotRef.current;
    const box = boxRef.current;
    const hero = heroRef.current;
    const sparkLayer = sparkRef.current;
    if (!cover || !stage || !slot || !box || !hero || !sparkLayer) return;
    const root = cover.closest<HTMLElement>(".lp");
    const motion = motionQuery();
    const sparks = createSparks(sparkLayer);

    let geo = { sw: 0, sh: 0, x: 0, y: 0, w: 0, h: 0 };
    let raf = 0;
    let last = -1;
    let lastE = 0;
    let lastSpark = 0;
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
      /* the dot never moves, so its centre is written once, not on every frame */
      stage.style.setProperty("--ox", `${(geo.x + geo.w / 2).toFixed(1)}px`);
      stage.style.setProperty("--oy", `${(geo.y + geo.h / 2).toFixed(1)}px`);
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

      /* the dot has the soft corners of the typeface's own full stop, becomes a rounded square,
         and is square-cornered once it fills the screen */
      const half = Math.min(bw, bh) / 2;
      const toSquare = smooth(0, 0.12, e);
      const dotRadius = Math.min(bw, bh) * 0.2;
      const radius = Math.min(half, (dotRadius * (1 - toSquare) + 26 * toSquare) * (1 - smooth(0.5, 1, e)));

      const s = stage.style;
      s.setProperty("--e", e.toFixed(4));
      s.setProperty("--c", clamp01((e - 0.6) / 0.34).toFixed(4));
      s.setProperty("--q", q.toFixed(4));
      s.setProperty("--clip", `inset(${t.toFixed(1)}px ${ri.toFixed(1)}px ${b.toFixed(1)}px ${l.toFixed(1)}px round ${radius.toFixed(1)}px)`);
      s.setProperty("--bx", `${l.toFixed(1)}px`);
      s.setProperty("--by", `${t.toFixed(1)}px`);
      s.setProperty("--bw", `${bw.toFixed(1)}px`);
      s.setProperty("--bh", `${bh.toFixed(1)}px`);
      s.setProperty("--crad", `${radius.toFixed(1)}px`);

      /* the glyph field only works while the hero is mostly open and not yet zoomed away */
      const live = e > 0.45 && q < 0.85 ? "1" : "0";
      if (box.dataset.live !== live) {
        box.dataset.live = live;
        box.dispatchEvent(new Event("lp-live"));
      }

      /* the buttons are gone by q = .28, so from then on nothing in the hero can be clicked or tabbed to by mistake */
      setHero(e > 0.6 && q < 0.22);
      setPhase(t < NAV_H * 0.8 && b < 96);

      /* sparks leave the rim while the opening is being scrolled, in either direction */
      const moved = Math.abs(e - lastE);
      const now = performance.now();
      if (moved > 0.002 && e > 0.003 && e < 0.985 && now - lastSpark > 55) {
        lastE = e;
        lastSpark = now;
        sparks.emit({ x: l, y: t, w: bw, h: bh }, Math.min(5, Math.ceil(moved * 110)));
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
        <div className="lp-box" ref={boxRef} data-lp-box data-live="0">
          <GlyphField />
          <div className="lp-glow" aria-hidden="true" />

          <div className="lp-hero" ref={heroRef} inert>
            {/* One left-aligned column, centred as a block. Everything in it zooms together when the camera pushes in. */}
            <div className="lp-hero__col">
              <p className="lp-badge">
                <i aria-hidden="true" />
                <span>Testnet<span className="lp-badge__more"> demonstration</span></span>
                <span>Not audited</span>
                <span>No funds held</span>
              </p>
              <h2 className="lp-h">
                <span className="lp-h__line lp-h__l1"><span className="lp-h__in">Verify the <b className="lp-h__public">fact</b></span></span>
                <span className="lp-h__line lp-h__l2"><span className="lp-h__in">Prove it <b className="lp-h__private">privately</b></span></span>
                <span className="lp-h__line lp-h__l3"><span className="lp-h__in">Unlock <b className="lp-h__public">on-chain</b></span></span>
              </h2>
              <div className="lp-cta">
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
                      /* a long way down: glide there (smooth scroll when it is on, native otherwise) */
                      if (scrollToId("how")) e.preventDefault();
                    }}
                  >
                    How it works
                  </a>
                </div>
              </div>
            </div>
          </div>

          <p className="lp-pointer-hint" aria-hidden="true">Move the pointer · seal the data</p>
          <div className="lp-veil-cover" aria-hidden="true" />
          <div className="lp-dot" aria-hidden="true" />
        </div>
        <div className="lp-outline" aria-hidden="true" />
        <div className="lp-sparks" ref={sparkRef} aria-hidden="true">
          {Array.from({ length: 48 }, (_, i) => <i key={i} />)}
        </div>

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
