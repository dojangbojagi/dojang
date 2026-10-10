"use client";

import { useEffect, useRef } from "react";

/* The hero's background: one object made of the same hex characters as the idea scene's, turning slowly
   in 3D behind the headline. It has two forms and the scroll decides which one you see:

     A  "Knot"   a woven tube of characters in ice blue and white, with a few champagne ones: verified,
                 public state (Dojang -> DAO). It is what the hero opens on.
     B  "Gyro"   three tilting rings around a lime core: the private proof and the action it unlocks
                 (Bojagi -> Lending). The knot unspools into it while the camera pushes in.

   The scroll is not touched by any of this. cover-reveal.tsx already writes how far the camera has
   pushed in (--q, 0 -> 1) on the stage; this file only reads that number, and the form is a pure function
   of it, so it runs in reverse on its own. The zoom itself (scale, fade) is the CSS on .lp-field, unchanged.

   Mouse: grab the hero and drag to turn the form (the automatic drift keeps its own clock, the hand adds
   an offset, a flick glides); without a button the form leans a little towards the pointer. Touch is left
   alone on purpose, so the page scrolls exactly as before.

   Cost, because this page must stay light: about 1300 sprites copied from a pre-rendered sheet (no text is
   laid out per frame), at most ~30 frames a second while it drifts, one frame per scroll frame while --q
   moves, and nothing at all while the hero is closed, zoomed away, off screen or the tab is hidden.
   Decorative only: the wrapper is aria-hidden. Technique: docs/GLYPH_SOLID_3D_HANDOFF.md. */

const GLYPHS = "0123456789ABCDEF";
const NG = GLYPHS.length;
const SEG = 110; /* steps along the knot */
const SIDE = 12; /* characters around its tube at each step */
const COUNT = SEG * SIDE; /* 1320, shared by both forms: the knot's points become the gyro's */
const RING_N = 330; /* characters per ring of the gyro; the last 330 are its core */
const PALETTE: readonly (readonly [number, number, number])[] = [
  [226, 240, 250], /* 0 ice white */
  [125, 211, 252], /* 1 ice blue (public) */
  [200, 255, 106], /* 2 lime (private) */
  [96, 165, 250], /* 3 cool blue */
  [214, 192, 141], /* 4 champagne, a rare accent */
];
const FRAME_MS = 40; /* ~25 frames a second while it drifts; the turn is slow, so it still looks smooth */
const Q_GONE = 0.8; /* the zoom has faded the field out completely by here (see .lp-field), so there is nothing to draw */
const CAMERA = 5; /* distance for the perspective; larger = flatter */
const Q_FROM = 0; /* the camera has not moved yet: form A, fully formed */
const Q_TO = 0.44; /* form B is complete here, while the field is still two thirds visible */
const SPREAD = 0.24; /* how far apart in time the points leave */
const TAU = Math.PI * 2;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const ease = (lp: number) => (lp < 0.5 ? 4 * lp * lp * lp : 1 - Math.pow(-2 * lp + 2, 3) / 2);

/* ---- the two forms, built once ---- */
interface Model {
  a: Float32Array; /* form A positions (static) */
  palA: Uint8Array;
  th0: Float32Array; /* form B: the angle each ring point starts at */
  rad: Float32Array; /* ... its distance from the ring's axis */
  off: Float32Array; /* ... and its offset along it (the ring is three thin strands) */
  palB: Uint8Array;
  pair: Uint16Array; /* the point of form B that point i of form A turns into */
  glyph: Uint8Array;
  delay: Float32Array;
  jit: Float32Array;
}

function buildModel(): Model {
  const a = new Float32Array(COUNT * 3);
  /* a trefoil knot, fattened into a tube. The tube's frame follows the curve (tangent, normal, binormal)
     and winds three times round it, so the characters run along it in spirals. */
  const S = 1 / 3.15;
  const R = 0.2;
  for (let k = 0; k < SEG; k++) {
    const t = (k / SEG) * TAU;
    const cx = (Math.sin(t) + 2 * Math.sin(2 * t)) * S;
    const cy = (Math.cos(t) - 2 * Math.cos(2 * t)) * S;
    const cz = -Math.sin(3 * t) * S;
    let tx = Math.cos(t) + 4 * Math.cos(2 * t);
    let ty = -Math.sin(t) + 4 * Math.sin(2 * t);
    let tz = -3 * Math.cos(3 * t);
    const tl = Math.hypot(tx, ty, tz);
    tx /= tl; ty /= tl; tz /= tl;
    let nx = -Math.sin(t) - 8 * Math.sin(2 * t);
    let ny = -Math.cos(t) + 8 * Math.cos(2 * t);
    let nz = 9 * Math.sin(3 * t);
    const d = nx * tx + ny * ty + nz * tz;
    nx -= d * tx; ny -= d * ty; nz -= d * tz;
    const nl = Math.hypot(nx, ny, nz);
    nx /= nl; ny /= nl; nz /= nl;
    const bx = ty * nz - tz * ny;
    const by = tz * nx - tx * nz;
    const bz = tx * ny - ty * nx;
    for (let j = 0; j < SIDE; j++) {
      const phi = ((j + (k & 1) * 0.5) / SIDE) * TAU + t * 3;
      const c = Math.cos(phi) * R;
      const s = Math.sin(phi) * R;
      const o = (k * SIDE + j) * 3;
      a[o] = cx + c * nx + s * bx;
      a[o + 1] = cy + c * ny + s * by;
      a[o + 2] = cz + c * nz + s * bz;
    }
  }

  /* form B: ring points are (angle, radius, offset); the core is a small sphere, kept in the same arrays */
  const th0 = new Float32Array(COUNT);
  const rad = new Float32Array(COUNT);
  const off = new Float32Array(COUNT);
  const ringR = [0.98, 0.84, 0.7];
  for (let i = 0; i < COUNT; i++) {
    if (i < RING_N * 3) {
      const g = (i / RING_N) | 0;
      const k = i % RING_N;
      const s = k % 3;
      th0[i] = ((k / 3) | 0) / (RING_N / 3) * TAU + s * 0.5 + g * 1.3;
      rad[i] = ringR[g] + (s - 1) * 0.045;
      off[i] = (s - 1) * 0.045;
    } else {
      const j = i - RING_N * 3;
      const y = 1 - ((j + 0.5) * 2) / RING_N;
      th0[i] = j * 2.399963229728653; /* golden angle */
      rad[i] = 0.3 * Math.sqrt(1 - y * y);
      off[i] = 0.3 * y;
    }
  }

  const palA = new Uint8Array(COUNT);
  const palB = new Uint8Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    palA[i] = rnd(i * 3) > 0.93 ? 4 : rnd(i * 5 + 1) > 0.5 ? 0 : 1;
    const g = (i / RING_N) | 0;
    const v = rnd(i * 7 + 2);
    palB[i] = g === 0 ? (v > 0.2 ? 1 : 0) : g === 1 ? (v > 0.9 ? 4 : v > 0.78 ? 0 : 2) : g === 2 ? (v > 0.45 ? 3 : 1) : v > 0.2 ? 2 : 0;
  }

  /* Pair the points by where they are, not by their number: both forms are sorted by azimuth around the
     vertical axis (then by height) and matched in that order, so the change flows round the form
     instead of scattering. */
  const tmp = new Float32Array(3);
  const keyOf = (x: number, y: number, z: number) => Math.floor(((Math.atan2(z, x) + Math.PI) / TAU) * 18) * 10 + clamp01((y + 1.2) / 2.4);
  const keyA = Float32Array.from({ length: COUNT }, (_, i) => keyOf(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]));
  const keyB = Float32Array.from({ length: COUNT }, (_, i) => {
    posB({ th0, rad, off }, i, 0, tmp);
    return keyOf(tmp[0], tmp[1], tmp[2]);
  });
  const byA = Array.from({ length: COUNT }, (_, i) => i).sort((p, q) => keyA[p] - keyA[q]);
  const byB = Array.from({ length: COUNT }, (_, i) => i).sort((p, q) => keyB[p] - keyB[q]);
  const pair = new Uint16Array(COUNT);
  for (let n = 0; n < COUNT; n++) pair[byA[n]] = byB[n];

  return {
    a,
    palA,
    th0,
    rad,
    off,
    palB,
    pair,
    glyph: Uint8Array.from({ length: COUNT }, (_, i) => (i * 7 + 3) % NG),
    delay: Float32Array.from({ length: COUNT }, (_, i) => rnd(i + 0.5) * SPREAD),
    jit: Float32Array.from({ length: COUNT * 3 }, (_, n) => (rnd(n * 1.7 + 9) - 0.5) * 0.4),
  };
}

/* form B at time t: three rings that tilt about different axes, and a core that turns */
const W0 = 0.42;
const W1 = -0.33;
const W2 = 0.27;
function posB(M: Pick<Model, "th0" | "rad" | "off">, i: number, t: number, out: Float32Array) {
  const th = M.th0[i];
  if (i >= RING_N * 3) {
    const x = Math.cos(th + t * 0.8) * M.rad[i];
    const z = Math.sin(th + t * 0.8) * M.rad[i];
    out[0] = x; out[1] = M.off[i]; out[2] = z;
    return;
  }
  const g = (i / RING_N) | 0;
  const a = th + t * (g === 1 ? -0.5 : 0.5);
  const lx = Math.cos(a) * M.rad[i];
  const ly = Math.sin(a) * M.rad[i];
  const lz = M.off[i];
  if (g === 0) { /* a ring in the XY plane, tipped about Y */
    const w = 0.2 + t * W0;
    const c = Math.cos(w), s = Math.sin(w);
    out[0] = lx * c + lz * s; out[1] = ly; out[2] = -lx * s + lz * c;
  } else if (g === 1) { /* a ring in the YZ plane, tipped about Z */
    const w = 1.1 + t * W1;
    const c = Math.cos(w), s = Math.sin(w);
    const wx = lz, wy = lx, wz = ly;
    out[0] = wx * c - wy * s; out[1] = wx * s + wy * c; out[2] = wz;
  } else { /* a ring in the ZX plane, tipped about X */
    const w = 2.2 + t * W2;
    const c = Math.cos(w), s = Math.sin(w);
    const wx = ly, wy = lz, wz = lx;
    out[0] = wx; out[1] = wy * c - wz * s; out[2] = wy * s + wz * c;
  }
}

export function GlyphField() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const cv = cvRef.current;
    const ctx = cv?.getContext("2d");
    if (!wrap || !cv || !ctx) return;
    const host = wrap.closest<HTMLElement>("[data-lp-box]") ?? wrap;
    const stage = host.closest<HTMLElement>(".lp-stage") ?? host;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const live = !reduce;

    const M = buildModel();
    const cur = new Float32Array(3);
    const sx = new Float32Array(COUNT);
    const sy = new Float32Array(COUNT);
    const sz = new Float32Array(COUNT);
    const sc = new Uint8Array(COUNT);
    const order = new Uint16Array(COUNT).map((_, i) => i);

    let dpr = 1;
    let cs = 20; /* atlas cell, device px */
    let atlas: HTMLCanvasElement | null = null;
    let fontFamily = "ui-monospace, monospace";
    let inView = false;
    let open = host.dataset.live === "1";
    let raf = 0;
    let lastDraw = 0;
    let lastQ = -1;
    /* Turning by hand. The automatic motion keeps its own clock and the hand adds an offset on top, so letting
       go never changes how the form drifts; it just carries on from where it was left. */
    let clock = 0;
    let autoYaw = 0;
    let userYaw = 0;
    let userPitch = 0;
    let velYaw = 0;
    let velPitch = 0;
    let dragging = false;
    let pointerId = -1;
    let lastX = 0;
    let lastY = 0;
    let lastMoveAt = 0;
    let leanX = 0;
    let leanY = 0;
    let leanTX = 0;
    let leanTY = 0;

    const readQ = () => parseFloat(stage.style.getPropertyValue("--q")) || 0;

    function readFont() {
      const probe = document.createElement("span");
      probe.style.cssText = "position:absolute;visibility:hidden;font-family:var(--lp-font-mono)";
      wrap!.appendChild(probe);
      const fam = getComputedStyle(probe).fontFamily;
      probe.remove();
      if (fam) fontFamily = fam;
    }

    /* every character in every colour, drawn once */
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
        for (let k = 0; k < NG; k++) a.fillText(GLYPHS[k], k * cs + cs / 2, c * cs + cs / 2 + dpr * 0.5);
      }
    }

    function size() {
      const w = cv!.clientWidth;
      const h = cv!.clientHeight;
      if (!w || !h) return false;
      const d = Math.min(window.devicePixelRatio || 1, 1.5);
      const pw = Math.round(w * d);
      const ph = Math.round(h * d);
      if (cv!.width !== pw || cv!.height !== ph || d !== dpr || !atlas) {
        dpr = d;
        cv!.width = pw;
        cv!.height = ph;
        buildAtlas();
      }
      return true;
    }

    function draw(now: number) {
      if (!atlas || !cv || !ctx) return;
      const w = cv.width;
      const h = cv.height;
      ctx.clearRect(0, 0, w, h);
      const dt = lastDraw ? Math.min(0.1, (now - lastDraw) / 1000) : 0;
      lastDraw = now;
      if (live && !dragging) {
        clock += dt;
        autoYaw += dt * 0.28;
      }
      if (!dragging) {
        /* after a flick the turn glides to a stop, and a tilt given by hand eases back to level */
        userYaw += velYaw * dt;
        userPitch += velPitch * dt;
        const k = Math.exp(-3 * dt);
        velYaw *= k;
        velPitch *= k;
        userPitch *= Math.exp(-0.5 * dt);
      }
      const lk = 1 - Math.exp(-4 * dt);
      leanX += (leanTX - leanX) * lk;
      leanY += (leanTY - leanY) * lk;

      const q = live ? readQ() : 0;
      lastQ = q;
      const m = live ? clamp01((q - Q_FROM) / (Q_TO - Q_FROM)) : 0;
      const t = live ? clock : 0.6;
      const yaw = 0.35 + (live ? autoYaw + q * 2.4 : 0) + userYaw + leanX * 0.45;
      const pitch = 0.42 + (live ? Math.sin(clock * 0.35) * 0.05 : 0) + userPitch + leanY * 0.25;
      const cy = Math.cos(yaw), sy_ = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const minDim = Math.min(w, h);
      /* the canvas is a square placed by CSS (see .lp-form), so the form is simply centred in it */
      const Rr = minDim * 0.32;
      const cxp = w / 2;
      const cyp = h / 2;
      const base = Math.min(22, Math.max(13, minDim / dpr / 42)) * dpr;

      for (let i = 0; i < COUNT; i++) {
        const o = i * 3;
        let x = M.a[o], y = M.a[o + 1], z = M.a[o + 2];
        let pal = M.palA[i];
        const lp = clamp01((m - M.delay[i]) / (1 - SPREAD));
        if (lp > 0) {
          const bi = M.pair[i];
          posB(M, bi, t, cur);
          if (lp >= 1) {
            x = cur[0]; y = cur[1]; z = cur[2];
            pal = M.palB[bi];
          } else {
            const e = ease(lp);
            const arc = Math.sin(Math.PI * e);
            x += (cur[0] - x) * e + M.jit[o] * arc;
            y += (cur[1] - y) * e + M.jit[o + 1] * arc;
            z += (cur[2] - z) * e + M.jit[o + 2] * arc;
            if (e >= 0.5) pal = M.palB[bi];
          }
        }
        sc[i] = pal;
        const x1 = x * cy + z * sy_;
        const z1 = -x * sy_ + z * cy;
        const y1 = y * cp - z1 * sp;
        const z2 = y * sp + z1 * cp;
        const s = CAMERA / (CAMERA - z2);
        sx[i] = cxp + x1 * s * Rr;
        sy[i] = cyp + y1 * s * Rr;
        sz[i] = z2;
      }

      /* far to near; the order hardly changes between frames, so an insertion sort is nearly free */
      for (let n = 1; n < COUNT; n++) {
        const idx = order[n];
        const z = sz[idx];
        let j = n - 1;
        while (j >= 0 && sz[order[j]] > z) {
          order[j + 1] = order[j];
          j--;
        }
        order[j + 1] = idx;
      }
      for (let n = 0; n < COUNT; n++) {
        const i = order[n];
        const dz = clamp01((sz[i] + 1.3) / 2.6);
        const s = CAMERA / (CAMERA - sz[i]);
        const dw = base * s * (0.62 + 0.5 * dz);
        ctx.globalAlpha = 0.14 + 0.62 * Math.pow(dz, 1.25);
        ctx.drawImage(atlas, M.glyph[i] * cs, sc[i] * cs, cs, cs, sx[i] - dw / 2, sy[i] - dw / 2, dw, dw);
      }
      ctx.globalAlpha = 1;
    }

    const canRun = () => live && open && inView && !document.hidden && readQ() < Q_GONE;
    const frame = (now: number) => {
      raf = 0;
      if (!canRun()) return;
      if (now - lastDraw >= FRAME_MS) draw(now);
      raf = requestAnimationFrame(frame);
    };
    const kick = () => {
      if (live) {
        if (!raf && canRun()) raf = requestAnimationFrame(frame);
      } else if (inView && size()) {
        draw(performance.now());
      }
    };

    /* While --q moves, draw right after cover-reveal has written it (a microtask after its frame callback),
       so the form is always in step with the zoom and never a frame behind. */
    const qWatch = live
      ? new MutationObserver(() => {
          if (!canRun() || !atlas) return;
          if (Math.abs(readQ() - lastQ) > 0.0004) draw(performance.now());
        })
      : null;
    qWatch?.observe(stage, { attributes: true, attributeFilter: ["style"] });

    const onLive = () => {
      open = host.dataset.live === "1";
      if (open) {
        size();
        kick();
      }
    };

    /* grab and drag to turn it: mouse only, so touch scrolling is never intercepted */
    const DRAG_RAD_PER_PX = 0.011;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0 || !canRun()) return;
      if ((e.target as Element | null)?.closest("a, button, input, select, textarea, label")) return;
      dragging = true;
      pointerId = e.pointerId;
      lastX = e.clientX;
      lastY = e.clientY;
      lastMoveAt = e.timeStamp;
      velYaw = 0;
      velPitch = 0;
      host.setPointerCapture(e.pointerId);
      host.dataset.drag = "1";
      host.dataset.grab = "1";
      kick();
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (!dragging) {
        leanTX = e.clientX / window.innerWidth - 0.5;
        leanTY = e.clientY / window.innerHeight - 0.5;
        return;
      }
      if (e.pointerId !== pointerId) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      const dts = Math.max(0.001, (e.timeStamp - lastMoveAt) / 1000);
      lastX = e.clientX;
      lastY = e.clientY;
      lastMoveAt = e.timeStamp;
      userYaw += dx * DRAG_RAD_PER_PX;
      velYaw = velYaw * 0.6 + ((dx * DRAG_RAD_PER_PX) / dts) * 0.4;
      userPitch = Math.max(-1.2, Math.min(1.2, userPitch - dy * DRAG_RAD_PER_PX));
      velPitch = velPitch * 0.6 - ((dy * DRAG_RAD_PER_PX) / dts) * 0.4;
    };
    const onUp = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== pointerId) return;
      dragging = false;
      delete host.dataset.drag;
      if (host.hasPointerCapture(e.pointerId)) host.releasePointerCapture(e.pointerId);
      if (e.timeStamp - lastMoveAt > 120) { velYaw = 0; velPitch = 0; } /* held still before letting go: no glide */
      velYaw = Math.max(-6, Math.min(6, velYaw));
      velPitch = Math.max(-6, Math.min(6, velPitch));
      kick();
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && !dragging) { leanTX = 0; leanTY = 0; }
    };
    if (live) {
      host.addEventListener("pointerdown", onDown);
      host.addEventListener("pointermove", onMove);
      host.addEventListener("pointerup", onUp);
      host.addEventListener("pointercancel", onUp);
      host.addEventListener("pointerleave", onLeave);
      host.addEventListener("lp-live", onLive);
    }

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
    io.observe(wrap);
    const ro = new ResizeObserver(() => {
      if (size() && !live && inView) draw(performance.now());
    });
    ro.observe(cv);
    const onVis = () => kick();
    document.addEventListener("visibilitychange", onVis);

    readFont();
    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      readFont();
      atlas = null; /* rebuild with the loaded font */
      if (size()) kick();
    };
    if (document.fonts?.ready) void document.fonts.ready.then(start);
    else start();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      qWatch?.disconnect();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointercancel", onUp);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("lp-live", onLive);
      delete host.dataset.drag;
    };
  }, []);

  return (
    <>
      <div className="lp-field" ref={wrapRef} aria-hidden="true">
        <canvas className="lp-form" ref={cvRef} />
      </div>
      <p className="lp-drag-hint" aria-hidden="true">Drag to turn · scroll to change</p>
    </>
  );
}
