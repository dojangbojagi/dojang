"use client";

import { useEffect, useRef } from "react";

/* The hero background: a field of public characters (hex digits) gathered in
   organic clouds, and a patch of bojagi cloth that follows the pointer.

   Under the pointer the data lights up orange, scrambles, then gets sealed under
   patchwork panels, and the cloth lifts slowly once the pointer moves on. That one
   gesture is the product: the data is there, you simply do not have to show it.

   Two canvases. `base` is painted once per resize. `fx` is the only one redrawn
   per frame, and only for the cells that are alive (twinkling or under the
   pointer). Decorative, so the wrapper is aria-hidden by its parent.            */

const GLYPHS = "0123456789ABCDEF";
const BG = "#060912"; /* must equal .lp-box background so a sealed cell hides its glyph exactly */
const SOLID = ["255,255,255", "239,95,34", "59,134,255"]; /* public white, private orange, public blue */

function hash(x: number, y: number, seed: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function vnoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function GlyphField() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const base = baseRef.current;
    const fx = fxRef.current;
    if (!wrap || !base || !fx) return;
    const bctx = base.getContext("2d");
    const fctx = fx.getContext("2d");
    if (!bctx || !fctx) return;
    const host = wrap.closest<HTMLElement>("[data-lp-box]") ?? wrap;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canHover = window.matchMedia("(hover: hover)").matches;
    const autoDrift = !reduce && !canHover; /* touch: the patch wanders on its own */

    let cw = 0;
    let chh = 0;
    let dpr = 1;
    let cellW = 16;
    let cellH = 22;
    let fontPx = 13;
    let cols = 0;
    let rows = 0;
    let present = new Uint8Array(0);
    let isLive = new Uint8Array(0);
    let glyph = new Uint8Array(0);
    let color = new Uint8Array(0);
    let alpha = new Float32Array(0);
    let tint = new Uint8Array(0); /* 0 navy, 1 blue, 2 orange: patchwork blocks */
    let edge = new Uint8Array(0); /* bit 1: block seam on the left, bit 2: on top */
    let cov = new Float32Array(0);
    let seen = new Uint32Array(0);
    let live: number[] = [];
    let livePhase: number[] = [];
    const active = new Set<number>();
    const ptr = { x: -9999, y: -9999, on: false };
    let frameId = 0;
    let raf = 0;
    let inView = true;
    let ready = false;
    let lastNow = 0;
    let lastDraw = 0;
    let fontFamily = 'ui-monospace, "SF Mono", Menlo, monospace';
    const t0 = performance.now();

    function readFont() {
      const probe = document.createElement("span");
      probe.style.cssText = "position:absolute;visibility:hidden;font-family:var(--lp-font-mono)";
      wrap!.appendChild(probe);
      const fam = getComputedStyle(probe).fontFamily;
      probe.remove();
      if (fam) fontFamily = fam;
    }

    function build() {
      const w = wrap!.offsetWidth;
      const h = wrap!.offsetHeight;
      if (w < 2 || h < 2) return;
      cw = w;
      chh = h;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const compact = cw < 760;
      cellW = compact ? 13 : 16;
      cellH = Math.round(cellW * 1.38);
      fontPx = cellW - 3;
      cols = Math.ceil(cw / cellW);
      rows = Math.ceil(chh / cellH);
      for (const c of [base!, fx!]) {
        c.width = Math.round(cw * dpr);
        c.height = Math.round(chh * dpr);
      }

      const n = cols * rows;
      present = new Uint8Array(n);
      isLive = new Uint8Array(n);
      glyph = new Uint8Array(n);
      color = new Uint8Array(n);
      alpha = new Float32Array(n);
      tint = new Uint8Array(n);
      edge = new Uint8Array(n);
      cov = new Float32Array(n);
      seen = new Uint32Array(n);
      live = [];
      livePhase = [];
      active.clear();

      const wide = cw >= 860;
      /* [centre u, centre v, radius u, radius v, weight] in fractions of the hero */
      const blobs: [number, number, number, number, number][] = wide
        ? [[0.68, 0.19, 0.27, 0.12, 1], [0.3, 0.08, 0.17, 0.06, 0.7], [0.85, 0.62, 0.2, 0.17, 1], [0.97, 0.38, 0.07, 0.14, 0.7]]
        : [[0.5, 0.15, 0.6, 0.11, 1], [0.15, 0.3, 0.3, 0.06, 0.7], [0.92, 0.26, 0.2, 0.09, 0.7]];
      const quiet = wide ? { x0: -0.3, x1: 0.66, y0: 0.53, y1: 0.88, m: 0.08 } : { x0: -1, x1: 2, y0: 0.4, y1: 1, m: 0.06 };

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;

          const bt = hash((x / 3) | 0, (y / 2) | 0, 77);
          tint[i] = bt < 0.4 ? 0 : bt < 0.72 ? 1 : 2;
          edge[i] = (x % 3 === 0 ? 1 : 0) | (y % 2 === 0 ? 2 : 0);

          const px = x * cellW + cellW / 2;
          const py = y * cellH + cellH / 2;
          const u = px / cw;
          const v = py / chh;

          /* organic clouds: placed on purpose (above and below the headline, as in the
             reference), with value noise roughening their edges */
          const n1 = vnoise(px / 190, py / 150, 11);
          const n2 = vnoise(px / 70 + 7, py / 60 + 3, 29);
          let m = 0;
          for (const [bx, by, rx, ry, wt] of blobs) {
            const dx = (u - bx) / rx;
            const dy = (v - by) / ry;
            m = Math.max(m, wt * (1 - (dx * dx + dy * dy) - (n1 - 0.5) * 0.95));
          }
          let d = smoothstep(0.02, 0.5, m) * (0.62 + 0.38 * n2);

          /* quiet zones keep the small copy and the marquee readable */
          const qw =
            smoothstep(quiet.x0 - 0.05, quiet.x0 + 0.03, u) * (1 - smoothstep(quiet.x1 - 0.03, quiet.x1 + 0.08, u)) *
            smoothstep(quiet.y0 - 0.05, quiet.y0 + 0.04, v) * (1 - smoothstep(quiet.y1 - 0.04, quiet.y1 + 0.05, v));
          d *= 1 - (1 - quiet.m) * qw;
          d *= 1 - 0.92 * smoothstep(0.8, 0.93, v);
          d = Math.max(d, 0.012 * (1 - smoothstep(0.8, 0.93, v)));
          if (hash(x, y, 5) > d) continue;

          present[i] = 1;
          glyph[i] = (hash(x, y, 17) * 16) | 0;
          const rc = hash(x, y, 23);
          color[i] = rc < 0.46 ? 0 : rc < 0.78 ? 1 : 2;
          alpha[i] = 0.3 + hash(x, y, 31) * 0.55;
          if (hash(x, y, 41) < 0.1) {
            isLive[i] = 1;
            live.push(i);
            livePhase.push(hash(x, y, 53) * 6.283);
          }
        }
      }

      paintBase();
      drawFx(performance.now());
    }

    function setupText(ctx: CanvasRenderingContext2D, weight: number) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${weight} ${fontPx}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
    }

    function paintBase() {
      setupText(bctx!, 500);
      bctx!.clearRect(0, 0, cw, chh);
      for (let i = 0; i < present.length; i++) {
        if (!present[i] || isLive[i]) continue;
        const x = (i % cols) * cellW + cellW / 2;
        const y = Math.floor(i / cols) * cellH + cellH / 2 + 0.5;
        bctx!.globalAlpha = alpha[i];
        bctx!.fillStyle = `rgb(${SOLID[color[i]]})`;
        bctx!.fillText(GLYPHS[glyph[i]], x, y);
      }
      bctx!.globalAlpha = 1;
    }

    function updatePointer(dt: number) {
      const rad = cw < 760 ? 84 : 128;
      frameId++;
      const kUp = 1 - Math.exp(-dt * 22);
      const kDown = 1 - Math.exp(-dt * 2.8);

      if (ptr.on) {
        const rx = Math.ceil(rad / cellW) + 1;
        const ry = Math.ceil(rad / cellH) + 1;
        const cx0 = Math.floor(ptr.x / cellW);
        const cy0 = Math.floor(ptr.y / cellH);
        for (let y = Math.max(0, cy0 - ry); y <= Math.min(rows - 1, cy0 + ry); y++) {
          for (let x = Math.max(0, cx0 - rx); x <= Math.min(cols - 1, cx0 + rx); x++) {
            const dx = x * cellW + cellW / 2 - ptr.x;
            const dy = y * cellH + cellH / 2 - ptr.y;
            const dd = Math.sqrt(dx * dx + dy * dy) / rad;
            if (dd >= 1) continue;
            const target = 1 - dd * dd;
            const i = y * cols + x;
            const c = cov[i];
            cov[i] = c + (target - c) * (target > c ? kUp : kDown);
            seen[i] = frameId;
            active.add(i);
          }
        }
      }
      for (const i of active) {
        if (seen[i] !== frameId) {
          const c = cov[i] * (1 - kDown);
          if (c < 0.006) {
            cov[i] = 0;
            active.delete(i);
            continue;
          }
          cov[i] = c;
        }
      }
    }

    function drawFx(now: number) {
      setupText(fctx!, 500);
      fctx!.clearRect(0, 0, cw, chh);
      const t = (now - t0) / 1000;

      /* idle life: a tenth of the cells breathe and change character */
      for (let k = 0; k < live.length; k++) {
        const i = live[k];
        const pulse = reduce ? 1 : 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * (0.9 + (livePhase[k] % 1)) + livePhase[k]));
        const slot = Math.floor(t * 1.3 + livePhase[k]);
        const g = reduce ? glyph[i] : (hash(i, slot, 3) * 16) | 0;
        const x = (i % cols) * cellW + cellW / 2;
        const y = Math.floor(i / cols) * cellH + cellH / 2 + 0.5;
        fctx!.globalAlpha = alpha[i] * pulse;
        fctx!.fillStyle = `rgb(${SOLID[color[i]]})`;
        fctx!.fillText(GLYPHS[g], x, y);
      }

      /* the cloth: light up, scramble, seal */
      const scramble = Math.floor(t * 16);
      for (const i of active) {
        const c = cov[i];
        const cx = i % cols;
        const cy = Math.floor(i / cols);
        const gx = cx * cellW;
        const gy = cy * cellH;

        fctx!.globalAlpha = Math.min(1, c * 3.2);
        fctx!.fillStyle = BG;
        fctx!.fillRect(gx, gy, cellW, cellH);

        if (c < 0.62) {
          fctx!.globalAlpha = Math.min(1, 0.22 + c * 1.5);
          fctx!.fillStyle = present[i] ? "rgb(255,138,78)" : "rgb(150,190,255)";
          fctx!.fillText(GLYPHS[(hash(i, scramble, 9) * 16) | 0], gx + cellW / 2, gy + cellH / 2 + 0.5);
        }

        const s = smoothstep(0.3, 0.88, c);
        if (s > 0.01) {
          fctx!.globalAlpha = s * 0.95;
          fctx!.fillStyle = "rgb(9,14,28)";
          fctx!.fillRect(gx, gy, cellW, cellH);
          if (tint[i] === 1) {
            fctx!.globalAlpha = s * 0.36;
            fctx!.fillStyle = "rgb(59,134,255)";
            fctx!.fillRect(gx, gy, cellW, cellH);
          } else if (tint[i] === 2) {
            fctx!.globalAlpha = s * 0.32;
            fctx!.fillStyle = "rgb(239,95,34)";
            fctx!.fillRect(gx, gy, cellW, cellH);
          }
          fctx!.globalAlpha = s * 0.2;
          fctx!.fillStyle = "rgb(255,255,255)";
          if (edge[i] & 1) fctx!.fillRect(gx, gy, 1, cellH);
          if (edge[i] & 2) fctx!.fillRect(gx, gy, cellW, 1);
        }
      }
      fctx!.globalAlpha = 1;
    }

    function frame(now: number) {
      raf = 0;
      if (!ready || !inView || document.hidden) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - (lastNow || now - 16)) / 1000));
      lastNow = now;

      if (autoDrift) {
        const tt = (now - t0) / 1000;
        ptr.on = true;
        ptr.x = cw * (0.52 + 0.34 * Math.sin(tt * 0.31));
        /* on a phone the copy sits in the lower half, so the patch stays above it */
        ptr.y = chh * (cw < 860 ? 0.22 + 0.1 * Math.sin(tt * 0.19 + 1.3) : 0.5 + 0.24 * Math.sin(tt * 0.19 + 1.3));
      }

      updatePointer(dt);
      /* idle: ~15 fps is plenty for the breathing cells; pointer activity runs at full rate */
      if (active.size > 0 || ptr.on || now - lastDraw > 66) {
        drawFx(now);
        lastDraw = now;
      }
      schedule();
    }

    function schedule() {
      if (reduce || raf || !ready || !inView || document.hidden) return;
      raf = requestAnimationFrame(frame);
    }

    function onMove(e: PointerEvent) {
      if (reduce || e.pointerType === "touch") return;
      const r = wrap!.getBoundingClientRect(); /* includes the zoom transform */
      if (r.width < 1 || r.height < 1) return;
      ptr.x = ((e.clientX - r.left) / r.width) * cw;
      ptr.y = ((e.clientY - r.top) / r.height) * chh;
      ptr.on = true;
      const hr = host.getBoundingClientRect();
      host.style.setProperty("--mx", `${e.clientX - hr.left}px`);
      host.style.setProperty("--my", `${e.clientY - hr.top}px`);
      schedule();
    }
    function onLeave() {
      ptr.on = false;
      schedule();
    }

    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);

    const io = new IntersectionObserver((entries) => {
      inView = entries[0]?.isIntersecting ?? true;
      if (inView) schedule();
    });
    io.observe(wrap);

    const onVisibility = () => {
      if (!document.hidden) schedule();
    };
    document.addEventListener("visibilitychange", onVisibility);

    let rt = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(rt);
      rt = window.setTimeout(() => {
        if (!ready) return;
        build();
        schedule();
      }, 160);
    });
    ro.observe(wrap);

    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      readFont();
      ready = true;
      build();
      schedule();
    };
    /* the field is drawn with the mono face: wait for it, then draw once */
    readFont();
    const fonts = document.fonts;
    if (fonts && fonts.load) {
      fonts.load(`500 13px ${fontFamily}`).then(start, start);
    } else {
      start();
    }

    return () => {
      cancelled = true;
      ready = false;
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(rt);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div className="lp-field" ref={wrapRef} aria-hidden="true">
      <canvas ref={baseRef} />
      <canvas ref={fxRef} />
    </div>
  );
}
