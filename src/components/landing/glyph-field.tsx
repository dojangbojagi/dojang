"use client";

import { useEffect, useRef } from "react";

/* The hero's background: two clouds of characters. The one above the headline is public data
   (white and blue); the one below it is private data (orange). Neither is a picture or a logo:
   each cloud is the part of a slowly moving noise field that rises above a per-cell threshold,
   so the shapes come out of the animation itself, drift, breathe and never repeat.

   Pointer: the characters under it scramble, then are sealed under a patch of patchwork cloth
   (a pixelated circle) that lifts slowly once the pointer has moved on.

   Cost, because this page must stay light:
   - one canvas, painted whole once and afterwards only the cells that changed, from a
     pre-rendered sprite sheet (no text is laid out per frame);
   - the field moves at about 9 steps a second, the pointer at the display rate while it is used;
   - it rests while the page is being scrolled, while the opening is still small, while it is off
     screen and while the tab is hidden. Decorative only: the wrapper is aria-hidden.        */

const GLYPHS = "0123456789ABCDEF";
const NG = GLYPHS.length;
const RGB: readonly (readonly [number, number, number])[] = [
  [228, 236, 255], /* 0  public: white */
  [255, 122, 61], /* 1  private: orange */
  [112, 168, 255], /* 2  public: blue */
];
const ALPHA = [0.34, 0.58, 0.82, 1] as const; /* four tone levels, darkest at the edge of a cloud */
const TICK_MS = 110;
const VEIL_W = 160; /* css px: the size of public/landing/veil.svg */
const VEIL_H = 104;

/* [centre u, centre v, radius u, radius v, drift, speed a, speed b, phase], u and v as fractions of the field */
type Lobe = readonly [number, number, number, number, number, number, number, number];
const WIDE: readonly Lobe[] = [
  /* public cloud, above the headline, its lower edge just behind the first line */
  [0.4, 0.2, 0.22, 0.13, 0.02, 0.21, 0.17, 0.0],
  [0.6, 0.215, 0.23, 0.14, 0.022, 0.16, 0.23, 2.1],
  [0.5, 0.205, 0.3, 0.1, 0.015, 0.12, 0.14, 4.0],
  /* private cloud, below the lede and the buttons */
  [0.42, 0.835, 0.21, 0.085, 0.02, 0.19, 0.15, 1.3],
  [0.6, 0.83, 0.22, 0.09, 0.02, 0.14, 0.21, 3.2],
  [0.5, 0.84, 0.29, 0.065, 0.015, 0.11, 0.18, 5.1],
];
const NARROW: readonly Lobe[] = [
  [0.34, 0.145, 0.3, 0.075, 0.02, 0.2, 0.16, 0.0],
  [0.68, 0.165, 0.3, 0.08, 0.02, 0.15, 0.22, 2.1],
  [0.5, 0.275, 0.4, 0.05, 0.015, 0.12, 0.14, 4.0],
];

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
  const cvRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const cv = cvRef.current;
    if (!wrap || !cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const host = wrap.closest<HTMLElement>("[data-lp-box]") ?? wrap;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const drift = !reduce && !fine; /* touch: the patch wanders on its own */

    /* geometry: device pixels unless the name says css */
    let dpr = 1;
    let cssW = 0;
    let cssH = 0;
    let W = 0;
    let H = 0;
    let cw = 8;
    let ch = 8;
    let cols = 0;
    let rows = 0;
    let n = 0;
    let lobes: readonly Lobe[] = WIDE;
    let radiusCss = 118;
    let fontFamily = 'ui-monospace, "SF Mono", Menlo, monospace';
    let atlas: HTMLCanvasElement | null = null;
    let veil: HTMLCanvasElement | null = null;
    let tileW = 0;
    let tileH = 0;

    /* per cell */
    let thr = new Float32Array(0); /* the field must exceed this for the cell to show */
    let gly = new Uint8Array(0);
    let col = new Uint8Array(0);
    let bias = new Int8Array(0);
    let dust = new Uint8Array(0);
    let vis = new Uint8Array(0);
    let lvl = new Uint8Array(0);
    let cov = new Float32Array(0); /* pointer coverage, 0..1 */
    let seen = new Uint32Array(0);
    let drawn = new Uint32Array(0); /* what is on the canvas now (0 = empty) */
    let inDirty = new Uint8Array(0);
    let dirty = new Uint32Array(0);
    let dcount = 0;
    let fadeV = new Float32Array(0);
    const lx = new Float32Array(8);
    const ly = new Float32Array(8);
    const active = new Set<number>();
    const ptr = { x: -9999, y: -9999, on: false, cx: 0, cy: 0 };

    let frameId = 0;
    let raf = 0;
    let timer = 0;
    let inView = true;
    let ready = false;
    let scrolling = false;
    let scrollTimer = 0;
    let lastTick = 0;
    let lastFrame = 0;
    const t0 = performance.now();

    const opened = () => host.dataset.live !== "0"; /* the opening is still too small to show the field */
    const canRun = () => ready && inView && !document.hidden && !scrolling && opened() && !reduce;

    function readFont() {
      const probe = document.createElement("span");
      probe.style.cssText = "position:absolute;visibility:hidden;font-family:var(--lp-font-mono)";
      wrap!.appendChild(probe);
      const fam = getComputedStyle(probe).fontFamily;
      probe.remove();
      if (fam) fontFamily = fam;
    }

    /* every glyph, in every colour and tone, drawn once into a sheet; cells are then copied from it */
    function buildAtlas(fontPx: number) {
      atlas = document.createElement("canvas");
      atlas.width = cw * NG;
      atlas.height = ch * 12;
      const a = atlas.getContext("2d");
      if (!a) return;
      a.font = `500 ${Math.round(fontPx * dpr)}px ${fontFamily}`;
      a.textAlign = "center";
      a.textBaseline = "middle";
      for (let c = 0; c < 3; c++) {
        for (let l = 0; l < 4; l++) {
          const [r, g, b] = RGB[c];
          a.fillStyle = `rgba(${r},${g},${b},${ALPHA[l]})`;
          for (let k = 0; k < NG; k++) a.fillText(GLYPHS[k], k * cw + cw / 2, (c * 4 + l) * ch + ch / 2 + dpr);
        }
      }
    }

    /* the patchwork tile, twice over in both directions, so a cell can be cut from it anywhere */
    function loadVeil() {
      const img = new Image();
      img.onload = () => {
        const tw = Math.round(VEIL_W * dpr);
        const th = Math.round(VEIL_H * dpr);
        const c = document.createElement("canvas");
        c.width = tw * 2;
        c.height = th * 2;
        const v = c.getContext("2d");
        if (!v) return;
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) v.drawImage(img, i * tw, j * th, tw, th);
        v.fillStyle = "rgba(6,9,18,.08)"; /* barely darker: the cloth keeps its colour */
        v.fillRect(0, 0, c.width, c.height);
        veil = c;
        tileW = tw;
        tileH = th;
        for (const i of active) {
          drawn[i] = 0xffffffff; /* sealed cells drawn flat so far: draw them again */
          mark(i);
        }
        schedule();
      };
      img.src = "/landing/veil.svg";
    }

    function mark(i: number) {
      if (inDirty[i]) return;
      inDirty[i] = 1;
      dirty[dcount++] = i;
    }

    function build() {
      const w = wrap!.offsetWidth;
      const h = wrap!.offsetHeight;
      if (w < 2 || h < 2) return;
      cssW = w;
      cssH = h;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5); /* a 2x canvas is four times the pixels for glyphs this small */
      const compact = w < 760;
      cw = Math.round((compact ? 13 : 17) * dpr);
      ch = Math.round((compact ? 18 : 23) * dpr);
      radiusCss = compact ? 74 : 100;
      W = Math.round(w * dpr);
      H = Math.round(h * dpr);
      cv!.width = W;
      cv!.height = H;
      ctx!.imageSmoothingEnabled = false;
      cols = Math.ceil(W / cw);
      rows = Math.ceil(H / ch);
      n = cols * rows;
      lobes = w >= 860 ? WIDE : NARROW;

      thr = new Float32Array(n);
      gly = new Uint8Array(n);
      col = new Uint8Array(n);
      bias = new Int8Array(n);
      dust = new Uint8Array(n);
      vis = new Uint8Array(n);
      lvl = new Uint8Array(n);
      cov = new Float32Array(n);
      seen = new Uint32Array(n);
      drawn = new Uint32Array(n);
      inDirty = new Uint8Array(n);
      dirty = new Uint32Array(n);
      dcount = 0;
      fadeV = new Float32Array(rows);
      active.clear();

      for (let r = 0; r < rows; r++) {
        const v = ((r + 0.5) * ch) / H;
        /* quiet under the navigation and over the marquee */
        fadeV[r] = smoothstep(0.03, 0.12, v) * (1 - smoothstep(0.84, 0.93, v));
      }
      for (let r = 0; r < rows; r++) {
        const upper = ((r + 0.5) * ch) / H < 0.5;
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          thr[i] = hash(c, r, 5) < 0.09 ? 9 : hash(c, r, 7) * 0.32; /* a few cells never show: holes in the cloud */
          gly[i] = (hash(c, r, 17) * NG) | 0;
          const k = hash(c, r, 23);
          col[i] = upper ? (k < 0.62 ? 0 : k < 0.92 ? 2 : 1) : k < 0.62 ? 1 : k < 0.9 ? 0 : 2;
          const b = hash(c, r, 31);
          bias[i] = b < 0.18 ? -1 : b > 0.9 ? 1 : 0;
          dust[i] = hash(c, r, 71) < 0.006 ? 1 : 0;
        }
      }
      buildAtlas(compact ? 12 : 14);
      ready = true;
      tickField((performance.now() - t0) / 1000);
      flush(performance.now());
    }

    /* The field. Each cell shows while the field is above its own threshold, so a cloud is dense in
       the middle, scattered at the edge, and its edge keeps moving as the field does. */
    function tickField(t: number) {
      const L = lobes.length;
      for (let k = 0; k < L; k++) {
        const l = lobes[k];
        lx[k] = l[0] + l[4] * Math.sin(t * l[5] + l[7]);
        ly[k] = l[1] + l[4] * 0.7 * Math.cos(t * l[6] + l[7] * 1.7);
      }
      for (let r = 0; r < rows; r++) {
        const y = ((r + 0.5) * ch) / dpr;
        const v = y / cssH;
        const fv = fadeV[r];
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          let v1 = 0;
          let l1 = 0;
          if (dust[i]) {
            v1 = fv > 0.5 ? 1 : 0;
          } else if (fv > 0.001) {
            const x = ((c + 0.5) * cw) / dpr;
            const u = x / cssW;
            let m = -1;
            for (let k = 0; k < L; k++) {
              const dx = (u - lx[k]) / lobes[k][2];
              const dy = (v - ly[k]) / lobes[k][3];
              const kk = 1 - dx * dx - dy * dy;
              if (kk > m) m = kk;
            }
            if (m > -0.5) {
              const n1 = vnoise(x / 150 + t * 0.045, y / 120 - t * 0.032, 11);
              const n2 = vnoise(x / 52 - t * 0.07, y / 44 + t * 0.05, 29);
              const f = (m + (n1 - 0.5) * 0.7 + (n2 - 0.5) * 0.3) * fv;
              if (f > thr[i]) {
                v1 = 1;
                l1 = Math.min(3, Math.max(0, Math.floor((f - thr[i]) * 4.4) + bias[i]));
              }
            }
          }
          if (v1 !== vis[i] || l1 !== lvl[i]) {
            vis[i] = v1;
            lvl[i] = l1;
            mark(i);
          }
        }
      }
    }

    /* a few cells change character each step, so the clouds are never still */
    function flicker() {
      const k = Math.max(6, (n * 0.012) | 0);
      for (let j = 0; j < k; j++) {
        const i = (Math.random() * n) | 0;
        if (!vis[i]) continue;
        gly[i] = (gly[i] + 1 + ((Math.random() * (NG - 1)) | 0)) % NG;
        mark(i);
      }
    }

    function updatePointer(dt: number) {
      frameId++;
      const kUp = 1 - Math.exp(-dt * 24);
      const kDown = 1 - Math.exp(-dt * 2.4);
      if (ptr.on) {
        const px = ptr.x * dpr;
        const py = ptr.y * dpr;
        const rc = Math.ceil((radiusCss * dpr) / cw) + 1;
        const rr = Math.ceil((radiusCss * dpr) / ch) + 1;
        const cx0 = Math.floor(px / cw);
        const cy0 = Math.floor(py / ch);
        for (let y = Math.max(0, cy0 - rr); y <= Math.min(rows - 1, cy0 + rr); y++) {
          for (let x = Math.max(0, cx0 - rc); x <= Math.min(cols - 1, cx0 + rc); x++) {
            const dx = ((x + 0.5) * cw - px) / dpr;
            const dy = ((y + 0.5) * ch - py) / dpr;
            const dd = Math.sqrt(dx * dx + dy * dy) / radiusCss;
            if (dd >= 1) continue;
            const target = 1 - dd * dd;
            const i = y * cols + x;
            const c = cov[i];
            cov[i] = c + (target - c) * (target > c ? kUp : kDown);
            seen[i] = frameId;
            active.add(i);
            mark(i);
          }
        }
      }
      for (const i of active) {
        if (seen[i] !== frameId) {
          const c = cov[i] * (1 - kDown);
          if (c < 0.02) {
            cov[i] = 0;
            active.delete(i);
          } else {
            cov[i] = c;
          }
          mark(i);
        }
      }
    }

    /* what a cell should look like right now, as one number: 0 is empty */
    function keyOf(i: number, now: number): number {
      const c = cov[i];
      if (c > 0.45) return 1 + ((2 << 14) | ((c > 0.74 ? 1 : 0) << 8)); /* sealed under cloth */
      if (c > 0.14) {
        /* the ring around the cloth: characters scrambling as they are sealed */
        const g = (hash(i, (now / 85) | 0, 9) * NG) | 0;
        const orange = hash(i, 0, 13) < 0.6 ? 1 : 0;
        return 1 + ((1 << 14) | (orange << 10) | (3 << 8) | g);
      }
      if (!vis[i]) return 0;
      return 1 + ((col[i] << 10) | (lvl[i] << 8) | gly[i]);
    }

    function paintCell(i: number, key: number) {
      const x = (i % cols) * cw;
      const y = ((i / cols) | 0) * ch;
      ctx!.clearRect(x, y, cw, ch);
      if (!key) return;
      const k = key - 1;
      if (k >> 14 === 2) {
        if (veil) {
          ctx!.globalAlpha = (k >> 8) & 1 ? 0.95 : 0.7;
          ctx!.drawImage(veil, x % tileW, y % tileH, cw, ch, x, y, cw, ch);
          ctx!.globalAlpha = 1;
        } else {
          ctx!.fillStyle = "rgba(12,18,36,.8)";
          ctx!.fillRect(x, y, cw, ch);
        }
        return;
      }
      const c = (k >> 10) & 3;
      const l = (k >> 8) & 3;
      ctx!.drawImage(atlas!, (k & 15) * cw, (c * 4 + l) * ch, cw, ch, x, y, cw, ch);
    }

    function flush(now: number) {
      if (!atlas) return;
      for (let j = 0; j < dcount; j++) {
        const i = dirty[j];
        inDirty[i] = 0;
        const key = keyOf(i, now);
        if (key !== drawn[i]) {
          drawn[i] = key;
          paintCell(i, key);
        }
      }
      dcount = 0;
    }

    function loop() {
      raf = 0;
      timer = 0;
      if (!canRun()) return;
      const now = performance.now();
      const busy = ptr.on || active.size > 0 || drift;
      const dt = busy ? Math.min(0.05, Math.max(0.001, (now - (lastFrame || now - 16)) / 1000)) : 0;
      lastFrame = busy ? now : 0;

      if (drift) {
        const tt = (now - t0) / 1000;
        ptr.on = true;
        ptr.x = cssW * (0.5 + 0.34 * Math.sin(tt * 0.31));
        ptr.y = cssH * (cssW < 860 ? 0.2 + 0.08 * Math.sin(tt * 0.19 + 1.3) : 0.5 + 0.24 * Math.sin(tt * 0.19 + 1.3));
      }
      if (now - lastTick >= TICK_MS) {
        lastTick = now;
        tickField((now - t0) / 1000);
        flicker();
      }
      if (ptr.on || active.size) {
        updatePointer(dt);
        /* the faint light behind the copy follows the same point */
        if (ptr.on && !drift) {
          host.style.setProperty("--mx", `${ptr.cx.toFixed(0)}px`);
          host.style.setProperty("--my", `${ptr.cy.toFixed(0)}px`);
        }
      }
      flush(now);
      schedule();
    }

    function schedule() {
      if (raf || timer || !canRun()) return;
      if (ptr.on || active.size) raf = requestAnimationFrame(loop);
      else timer = window.setTimeout(loop, TICK_MS);
    }

    function onMove(e: PointerEvent) {
      if (reduce || e.pointerType === "touch") return;
      const r = wrap!.getBoundingClientRect(); /* includes the zoom transform */
      if (r.width < 1 || r.height < 1) return;
      ptr.x = ((e.clientX - r.left) / r.width) * cssW;
      ptr.y = ((e.clientY - r.top) / r.height) * cssH;
      const hr = host.getBoundingClientRect();
      ptr.cx = e.clientX - hr.left;
      ptr.cy = e.clientY - hr.top;
      ptr.on = true;
      if (host.dataset.ptr !== "1") host.dataset.ptr = "1";
      if (timer) {
        window.clearTimeout(timer);
        timer = 0;
      }
      schedule();
    }
    function onLeave() {
      ptr.on = false;
      schedule();
    }

    /* Scrolling is the one moment the page cannot spare any GPU time, so the field rests until
       the scroll has been still for a moment. The twinkle pauses for it; nobody sees that. */
    function onScroll() {
      scrolling = true;
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        scrolling = false;
        schedule();
      }, 160);
    }
    function onVisibility() {
      if (!document.hidden) schedule();
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    host.addEventListener("lp-live", schedule);
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVisibility);

    const io = new IntersectionObserver((entries) => {
      inView = entries[0]?.isIntersecting ?? true;
      if (inView) schedule();
    });
    io.observe(wrap);

    let rt = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(rt);
      rt = window.setTimeout(() => {
        if (!ready) return;
        build();
        schedule();
      }, 180);
    });
    ro.observe(wrap);

    /* the sheet is made of the mono face: wait for it, then build; idle time, so first paint is not delayed */
    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      readFont();
      build();
      loadVeil();
      schedule();
    };
    const whenIdle = () => {
      readFont();
      const f = document.fonts;
      if (f && f.load) f.load(`500 13px ${fontFamily}`).then(start, start);
      else start();
    };
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) idle(whenIdle, { timeout: 600 });
    else window.setTimeout(whenIdle, 60);

    return () => {
      cancelled = true;
      ready = false;
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.clearTimeout(scrollTimer);
      window.clearTimeout(rt);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      host.removeEventListener("lp-live", schedule);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div className="lp-field" ref={wrapRef} aria-hidden="true">
      <canvas ref={cvRef} />
    </div>
  );
}
