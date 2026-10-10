"use client";

import { useEffect, useRef } from "react";

/* The idea scene's picture: one object made of the same hex characters as the hero's clouds, turning
   in 3D and reshaping itself as the story moves on. It replaces the made-up numbers.

     0  A public attestation          a sphere of readable characters. Everything is visible, including a few
                                      orange ones: the private value, exposed.
     1  A private note                a closed cube of grey sealed cells: private, but nothing can check it.
     2  A sealed credential + proof   an orange core, still sealed, inside a blue ring: the ring is the public
                                      proof. The chain checks the ring; the core is never shown.

   Colour keeps the page's meaning: blue = public / on-chain, orange = private / on your device.

   Cost, because this page must stay light: about 500 sprites copied from a pre-rendered sheet (no text is laid
   out per frame), at most ~30 frames a second, and only while the canvas is on screen and the tab is visible.
   It turns with the scroll position (the scene's --ip) and drifts slowly in between. The static variant used
   in the stacked layout draws once. Decorative: the label describes the state in words. */

export type SolidState = 0 | 1 | 2;

const GLYPHS = "0123456789ABCDEF";
const NG = GLYPHS.length;
const COUNT = 486; /* 6 faces x 81 */
const CORE = 216; /* 6 faces x 36: the sealed core of state 2; the other 270 points are the ring */
const PALETTE: readonly (readonly [number, number, number])[] = [
  [228, 236, 255], /* 0 public, white */
  [112, 168, 255], /* 1 public, blue */
  [255, 122, 61], /* 2 private, orange */
  [154, 164, 184], /* 3 sealed, grey (drawn as a small closed cell, not as a character) */
];
const SEALED = 3;
const MORPH_MS = 1500;
const FRAME_MS = 33;
const CAMERA = 5; /* distance for the perspective; larger = flatter */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/* ---- the three shapes, as unit-ish model coordinates ---- */
function cubePoint(face: number, a: number, b: number, h: number, out: Float32Array, o: number) {
  const u = a * h;
  const v = b * h;
  switch (face) {
    case 0: out[o] = h; out[o + 1] = u; out[o + 2] = v; break;
    case 1: out[o] = -h; out[o + 1] = u; out[o + 2] = v; break;
    case 2: out[o] = u; out[o + 1] = h; out[o + 2] = v; break;
    case 3: out[o] = u; out[o + 1] = -h; out[o + 2] = v; break;
    case 4: out[o] = u; out[o + 1] = v; out[o + 2] = h; break;
    default: out[o] = u; out[o + 1] = v; out[o + 2] = -h;
  }
}

function sphereShape(): Float32Array {
  const p = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const y = 1 - ((i + 0.5) * 2) / COUNT;
    const r = Math.sqrt(1 - y * y);
    const th = i * 2.399963229728653; /* golden angle */
    p[i * 3] = Math.cos(th) * r;
    p[i * 3 + 1] = y;
    p[i * 3 + 2] = Math.sin(th) * r;
  }
  return p;
}

function cubeShape(): Float32Array {
  const p = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const j = (i / 6) | 0;
    cubePoint(i % 6, (j % 9) / 4 - 1, ((j / 9) | 0) / 4 - 1, 0.72, p, i * 3);
  }
  return p;
}

function coreShape(): Float32Array {
  const p = new Float32Array(CORE * 3);
  for (let i = 0; i < CORE; i++) {
    const j = (i / 6) | 0;
    cubePoint(i % 6, (j % 6) / 2.5 - 1, ((j / 6) | 0) / 2.5 - 1, 0.36, p, i * 3);
  }
  return p;
}

/* the ring's points move over time (it orbits the core), so they are computed per frame */
const TILT = 0.2;
const TILT_C = Math.cos(TILT);
const TILT_S = Math.sin(TILT);
function ringPoint(k: number, spin: number, out: Float32Array, o: number) {
  const s = k % 3;
  const idx = (k / 3) | 0;
  const th = (idx / 90) * Math.PI * 2 + s * 0.5 + spin;
  const r = 1 + (s - 1) * 0.06;
  const x = Math.cos(th) * r;
  const y = (s - 1) * 0.05;
  out[o] = x * TILT_C - y * TILT_S;
  out[o + 1] = x * TILT_S + y * TILT_C;
  out[o + 2] = Math.sin(th) * r;
}

/* which colour each point has in each state */
function paletteFor(state: SolidState, i: number): number {
  if (state === 0) return i % 9 === 0 ? 2 : rnd(i * 3) > 0.55 ? 0 : 1;
  if (state === 1) return SEALED;
  return i < CORE ? 2 : rnd(i * 5) > 0.78 ? 0 : 1;
}

interface Props {
  state: SolidState;
  /** Turn with the scroll and drift. Off for the stacked layout: one still frame. */
  animated?: boolean;
  label: string;
  className?: string;
}

export function GlyphSolid({ state, animated = true, label, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<SolidState>(state);
  const setStateRef = useRef<((s: SolidState) => void) | null>(null);
  stateRef.current = state;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const live = animated && !reduce;
    const run = canvas.closest<HTMLElement>(".lp-idea-run");

    const P0 = sphereShape();
    const P1 = cubeShape();
    const P2 = coreShape();
    const PAL = [0, 1, 2].map((s) => Uint8Array.from({ length: COUNT }, (_, i) => paletteFor(s as SolidState, i)));
    const GLYPH = Uint8Array.from({ length: COUNT }, (_, i) => (i * 7 + 3) % NG);
    const DELAY = Float32Array.from({ length: COUNT }, (_, i) => rnd(i + 0.5) * 0.38);
    const JIT = Float32Array.from({ length: COUNT * 3 }, (_, n) => (rnd(n * 1.7 + 9) - 0.5) * 1.1);

    const cur = new Float32Array(COUNT * 3); /* where each point is now, model space */
    const from = new Float32Array(COUNT * 3);
    const fromPal = new Uint8Array(COUNT);
    const tgt = new Float32Array(3);
    const sx = new Float32Array(COUNT);
    const sy = new Float32Array(COUNT);
    const sz = new Float32Array(COUNT);
    const sc = new Float32Array(COUNT);
    const order = new Uint16Array(COUNT).map((_, i) => i);

    let to: SolidState = stateRef.current;
    let curPal = PAL[to];
    let mStart = -1;
    let morphing = false;
    let dpr = 1;
    let cs = 20; /* atlas cell, device px */
    let atlas: HTMLCanvasElement | null = null;
    let fontFamily = "ui-monospace, monospace";
    let inView = false;
    let raf = 0;
    let lastFrame = 0;
    const t0 = performance.now();

    const targetOf = (s: SolidState, i: number, t: number, out: Float32Array) => {
      if (s === 0) { out[0] = P0[i * 3]; out[1] = P0[i * 3 + 1]; out[2] = P0[i * 3 + 2]; return; }
      if (s === 1) { out[0] = P1[i * 3]; out[1] = P1[i * 3 + 1]; out[2] = P1[i * 3 + 2]; return; }
      if (i < CORE) { out[0] = P2[i * 3]; out[1] = P2[i * 3 + 1]; out[2] = P2[i * 3 + 2]; return; }
      ringPoint(i - CORE, live ? t * 0.7 : 0.6, out, 0);
    };

    function readFont() {
      const probe = document.createElement("span");
      probe.style.cssText = "position:absolute;visibility:hidden;font-family:var(--lp-font-mono)";
      canvas!.parentElement?.appendChild(probe);
      const fam = getComputedStyle(probe).fontFamily;
      probe.remove();
      if (fam) fontFamily = fam;
    }

    /* every character in every colour, drawn once; the sealed colour is a small closed cell instead */
    function buildAtlas() {
      cs = Math.max(12, Math.round(20 * dpr));
      atlas = document.createElement("canvas");
      atlas.width = cs * NG;
      atlas.height = cs * PALETTE.length;
      const a = atlas.getContext("2d");
      if (!a) return;
      a.textAlign = "center";
      a.textBaseline = "middle";
      a.font = `500 ${Math.round(cs * 0.68)}px ${fontFamily}`;
      for (let c = 0; c < PALETTE.length; c++) {
        const [r, g, b] = PALETTE[c];
        a.fillStyle = `rgb(${r},${g},${b})`;
        for (let k = 0; k < NG; k++) {
          if (c === SEALED) {
            const m = cs * 0.3;
            a.fillRect(k * cs + m, c * cs + m, cs - 2 * m, cs - 2 * m);
          } else {
            a.fillText(GLYPHS[k], k * cs + cs / 2, c * cs + cs / 2 + dpr * 0.5);
          }
        }
      }
    }

    function size() {
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;
      if (!w || !h) return false;
      const d = Math.min(window.devicePixelRatio || 1, 2);
      const pw = Math.round(w * d);
      const ph = Math.round(h * d);
      if (canvas!.width !== pw || canvas!.height !== ph || d !== dpr || !atlas) {
        dpr = d;
        canvas!.width = pw;
        canvas!.height = ph;
        buildAtlas();
      }
      return true;
    }

    function draw(now: number) {
      if (!atlas || !canvas || !ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const t = (now - t0) / 1000;
      const prog = live && run ? parseFloat(run.style.getPropertyValue("--ip")) || 0 : 0;
      const m = morphing ? clamp01((now - mStart) / MORPH_MS) : 1;
      if (morphing && m >= 1) morphing = false;

      const yaw = live ? t * 0.28 + prog * 3.2 : 0.7 + to * 0.55;
      const pitch = live ? 0.5 + Math.sin(t * 0.35) * 0.06 : 0.5;
      const cy = Math.cos(yaw), sy_ = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const minDim = Math.min(w, h);
      const R = minDim * 0.33;
      const cxp = w / 2;
      const cyp = h / 2;
      const sizeK = Math.min(1.15, Math.max(0.55, minDim / dpr / 300));
      const base = 16 * dpr * sizeK;

      for (let i = 0; i < COUNT; i++) {
        targetOf(to, i, t, tgt);
        let x = tgt[0], y = tgt[1], z = tgt[2];
        if (m < 1) {
          const lp = clamp01((m - DELAY[i]) / 0.62);
          const e = lp < 0.5 ? 4 * lp * lp * lp : 1 - Math.pow(-2 * lp + 2, 3) / 2;
          const arc = Math.sin(Math.PI * e);
          x = from[i * 3] + (x - from[i * 3]) * e + JIT[i * 3] * arc;
          y = from[i * 3 + 1] + (y - from[i * 3 + 1]) * e + JIT[i * 3 + 1] * arc;
          z = from[i * 3 + 2] + (z - from[i * 3 + 2]) * e + JIT[i * 3 + 2] * arc;
          sc[i] = e < 0.5 ? fromPal[i] : curPal[i];
        } else {
          sc[i] = curPal[i];
        }
        cur[i * 3] = x; cur[i * 3 + 1] = y; cur[i * 3 + 2] = z;
        const x1 = x * cy + z * sy_;
        const z1 = -x * sy_ + z * cy;
        const y1 = y * cp - z1 * sp;
        const z2 = y * sp + z1 * cp;
        const s = CAMERA / (CAMERA - z2);
        sx[i] = cxp + x1 * s * R;
        sy[i] = cyp + y1 * s * R;
        sz[i] = z2;
      }

      order.sort((a, b) => sz[a] - sz[b]); /* far to near */
      for (let n = 0; n < COUNT; n++) {
        const i = order[n];
        const dz = clamp01((sz[i] + 1.3) / 2.6);
        const s = CAMERA / (CAMERA - sz[i]);
        const dw = base * s * (0.62 + 0.5 * dz);
        ctx.globalAlpha = 0.2 + 0.8 * Math.pow(dz, 1.25);
        ctx.drawImage(atlas, GLYPH[i] * cs, sc[i] * cs, cs, cs, sx[i] - dw / 2, sy[i] - dw / 2, dw, dw);
      }
      ctx.globalAlpha = 1;
    }

    const canRun = () => live && inView && !document.hidden;
    const frame = (now: number) => {
      raf = 0;
      if (!canRun()) return;
      if (now - lastFrame >= FRAME_MS) {
        lastFrame = now;
        draw(now);
      }
      raf = requestAnimationFrame(frame);
    };
    const kick = () => {
      if (live) {
        if (!raf && canRun()) raf = requestAnimationFrame(frame);
      } else if (inView && size()) {
        draw(performance.now());
      }
    };

    /* a new state: the points leave where they are now and settle into the new shape */
    const setState = (next: SolidState) => {
      if (next === to) return;
      from.set(cur);
      fromPal.set(curPal);
      to = next;
      curPal = PAL[next];
      if (live) {
        mStart = performance.now();
        morphing = true;
      } else {
        morphing = false;
      }
      kick();
    };
    setStateRef.current = setState;

    /* start in the current state, fully formed */
    for (let i = 0; i < COUNT; i++) {
      targetOf(to, i, 0, tgt);
      cur[i * 3] = tgt[0]; cur[i * 3 + 1] = tgt[1]; cur[i * 3 + 2] = tgt[2];
    }
    from.set(cur);
    fromPal.set(curPal);

    const io = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (inView) {
          size();
          kick();
        }
      },
      { rootMargin: "80px 0px" },
    );
    io.observe(canvas);
    const ro = new ResizeObserver(() => {
      if (size() && !live && inView) draw(performance.now());
    });
    ro.observe(canvas);
    const onVis = () => kick();
    document.addEventListener("visibilitychange", onVis);

    readFont();
    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      atlas = null; /* rebuild with the loaded font */
      if (size()) kick();
    };
    if (document.fonts?.ready) void document.fonts.ready.then(start);
    else start();

    return () => {
      cancelled = true;
      setStateRef.current = null;
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [animated]);

  useEffect(() => {
    setStateRef.current?.(state);
  }, [state]);

  return <canvas ref={canvasRef} className={className} role="img" aria-label={label} />;
}
