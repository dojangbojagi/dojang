/* The cipher sculpture: the bridge between the white claim and the dark hero.

   The full stop after "more" is a sealed block. Scrolling cuts it into a row of plates that fan out
   from it, fold along a vertical ridge and turn on their own axes in a wave, left to right, like a
   ribbon of folded plates being unfolded, and settle as flat strips of the screen. The hero is the
   window through the plates:
   the clip-path is the union of their projected faces, so the dark scene is revealed by the structure
   itself turning, never by a circle or a rectangle growing.

   It is a pure function of the opening's progress (--e), drawn only when the scroll moves, so it has
   no loop of its own, allocates nothing per frame beyond a few small arrays, and runs in reverse.
   Plain canvas 2D with a hand-rolled perspective, like the glyph forms; no library. */

type Rgb = readonly [number, number, number];
type Vec = readonly [number, number, number];

const INK: Rgb = [10, 7, 8]; /* the dot's own black */
const BURGUNDY: Rgb = [109, 0, 26];
const WINE: Rgb = [184, 26, 52];

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const norm = (v: Vec): Vec => {
  const m = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / m, v[1] / m, v[2] / m];
};

const KEY = norm([-0.45, -0.75, 0.55]); /* from above and the left */
const RIM = norm([0.9, -0.2, 0.3]); /* a thin cool-white edge on the right-hand faces */

/* A slab is a box. Corners are (±1, ±1, ±1) of its half sizes; y points down the screen, z toward the viewer. */
const FACES: { n: Vec; c: readonly Vec[] }[] = [
  { n: [0, 0, 1], c: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] }, /* front */
  { n: [0, 0, -1], c: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] }, /* back */
  { n: [1, 0, 0], c: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] }, /* right */
  { n: [-1, 0, 0], c: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] }, /* left */
  { n: [0, -1, 0], c: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] }, /* top */
  { n: [0, 1, 0], c: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] }, /* bottom */
];

type Blade = { u: number; delay: number; lift: number; fly: number };

/* Neighbouring slabs differ smoothly, so the whole reads as one folded ribbon, not as loose boxes. */
function makeBlades(n: number): Blade[] {
  return Array.from({ length: n }, (_, i) => ({
    u: (i + 0.5) / n - 0.5,
    delay: i / (n - 1),
    lift: Math.sin(i * 0.95 + 0.6) * 0.05,
    fly: 0.78 + 0.22 * Math.cos(i * 0.8 + rnd(7) * 2),
  }));
}

export type CipherRect = { x: number; y: number; w: number; h: number };

/* The faces carry the same fine triangulated mesh and node dots as the globe behind them (globe-sculpture.ts),
   so the slabs read as the same material as the network, not as foreign blocks laid over it. */
const CELL = 44; /* px between mesh lines on a face */
const MAX_NODES = 120; /* a face with more lattice points than this is drawn without node dots */
function drawMesh(ctx: CanvasRenderingContext2D, p: number[], key: number) {
  const lu = Math.hypot(p[2] - p[0], p[3] - p[1]);
  const lv = Math.hypot(p[6] - p[0], p[7] - p[1]);
  const du = Math.max(1, Math.min(8, Math.round(lu / CELL)));
  const dv = Math.max(1, Math.min(24, Math.round(lv / CELL)));
  /* bilinear point on the quad: p0 -> p1 is u, p0 -> p3 is v */
  const at = (u: number, v: number, o: number) => {
    const tx = p[0] + (p[2] - p[0]) * u;
    const ty = p[1] + (p[3] - p[1]) * u;
    const bx = p[6] + (p[4] - p[6]) * u;
    const by = p[7] + (p[5] - p[7]) * u;
    return o === 0 ? tx + (bx - tx) * v : ty + (by - ty) * v;
  };
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = `rgba(255,255,255,${(0.05 + key * 0.17).toFixed(3)})`;
  ctx.beginPath();
  for (let i = 1; i < du; i++) {
    ctx.moveTo(at(i / du, 0, 0), at(i / du, 0, 1));
    ctx.lineTo(at(i / du, 1, 0), at(i / du, 1, 1));
  }
  for (let j = 1; j < dv; j++) {
    ctx.moveTo(at(0, j / dv, 0), at(0, j / dv, 1));
    ctx.lineTo(at(1, j / dv, 0), at(1, j / dv, 1));
  }
  if (du * dv <= 70) {
    for (let i = 0; i < du; i++) {
      for (let j = 0; j < dv; j++) {
        const flip = (i + j) & 1;
        const u0 = (i + flip) / du;
        const u1 = (i + 1 - flip) / du;
        ctx.moveTo(at(u0, j / dv, 0), at(u0, j / dv, 1));
        ctx.lineTo(at(u1, (j + 1) / dv, 0), at(u1, (j + 1) / dv, 1));
      }
    }
  }
  ctx.stroke();
  if ((du + 1) * (dv + 1) <= MAX_NODES) {
    ctx.fillStyle = `rgba(255,255,255,${(0.16 + key * 0.3).toFixed(3)})`;
    ctx.beginPath();
    for (let i = 0; i <= du; i++) {
      for (let j = 0; j <= dv; j++) ctx.rect(at(i / du, j / dv, 0) - 0.9, at(i / du, j / dv, 1) - 0.9, 1.8, 1.8);
    }
    ctx.fill();
  }
}

export function createCipherSculpture(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  let W = 0;
  let H = 0;
  let dpr = 1;
  let dirty = false; /* something is on the canvas */
  let n = 0;
  let blades: Blade[] = [];

  const resize = (sw: number, sh: number) => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = sw;
    H = sh;
    canvas.width = Math.max(1, Math.round(sw * dpr));
    canvas.height = Math.max(1, Math.round(sh * dpr));
    dirty = false;
    const want = sw < 700 ? 7 : 9;
    if (want !== n) {
      n = want;
      blades = makeBlades(n);
    }
  };

  const clear = () => {
    if (!ctx || !dirty) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dirty = false;
  };

  /* Draws the sculpture for opening progress e (0..1). Returns the clip-path for the hero window,
     or null while the opening is still the plain dot (e = 0) or already the whole screen (e = 1). */
  const draw = (e: number, slot: CipherRect): string | null => {
    if (!ctx || !W || !H || !blades.length) return null;
    const v = Math.pow(clamp01(e), 0.62); /* e is slow to start; the sculpture should answer the first scroll */
    if (v < 0.0008 || v > 0.9995) {
      clear();
      return null;
    }

    const D = Math.max(W, H) * 0.95;
    const S = Math.min(slot.w, slot.h);
    const cx0 = slot.x + slot.w / 2 - W / 2;
    const cy0 = slot.y + slot.h / 2 - H / 2;
    const pitch = 0.34 * Math.sin(Math.PI * clamp01(v / 0.86)); /* look down on it while it is in the air, flat at both ends */
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    dirty = true;
    ctx.lineJoin = "round";

    type Face = { pts: number[]; depth: number; top: Rgb; edge: string; area: number; key: number };
    const drawList: { z: number; alpha: number; faces: Face[] }[] = [];
    const windowPieces: string[] = [];

    const lit = smooth(0, 0.25, v); /* at rest the block is the dot's own black; the light arrives with the motion */

    for (let bi = 0; bi < n; bi++) {
      const b = blades[bi];
      const s = clamp01((v - 0.3 * b.delay) / 0.7);
      const g = s * s * (3 - 2 * s);
      const arc = Math.sin(Math.PI * g);

      const w = lerp(S / n, (W / n) * 1.1, g);
      const h = lerp(S, H * 1.22, g) * (1 + arc * 0.3 * Math.sin(bi * 1.3 + 0.4));
      const t = lerp(S, (W / n) * 0.5, g) + arc * W * 0.012;
      const X = lerp(cx0 + b.u * S, b.u * W, g);
      const Y = lerp(cy0, 0, g) + arc * b.lift * H;
      const Z = arc * D * 0.24 * b.fly;
      const yaw = -arc * 1.05;
      const fold = arc * 0.62; /* the plate is two halves hinged on a ridge that points at the viewer */
      const roll = arc * 0.2 * Math.sin(bi * 0.9 + 1); /* and leans, so the row is a sprung ribbon, not upright bars */
      const cr = Math.cos(roll);
      const sr = Math.sin(roll);
      const hy = h / 2;
      const hz = t / 2;
      const hw = w / 4;
      const alpha = 1 - smooth(0.72, 0.97, s); /* a plate that has arrived becomes the window; it fades while the next is still in the air */

      let zSum = 0;
      let count = 0;
      const faces: Face[] = [];
      for (let half = -1; half <= 1; half += 2) {
        const ang = yaw + half * fold;
        const cy = Math.cos(ang);
        const sy = Math.sin(ang);
        for (const f of FACES) {
          /* the face, transformed: turn on the ridge, move into place, pitch the whole scene */
          const pts: number[] = [];
          let cX = 0;
          let cY = 0;
          let cZ = 0;
          for (const c of f.c) {
            const lx = (c[0] + half) * hw;
            const ly = c[1] * hy;
            const lz = c[2] * hz;
            const xa = lx * cy + lz * sy;
            const z0 = -lx * sy + lz * cy + Z;
            const x = xa * cr - ly * sr + X;
            const y0 = xa * sr + ly * cr + Y;
            const y = y0 * cp + z0 * sp;
            const z = -y0 * sp + z0 * cp;
            cX += x;
            cY += y;
            cZ += z;
            const k = D / (D - z);
            pts.push(W / 2 + x * k, H / 2 + y * k);
          }
          cX /= 4;
          cY /= 4;
          cZ /= 4;
          /* outward normal after the same turns */
          const nxa = f.n[0] * cy + f.n[2] * sy;
          const nz0 = -f.n[0] * sy + f.n[2] * cy;
          const nx0 = nxa * cr - f.n[1] * sr;
          const ny0 = nxa * sr + f.n[1] * cr;
          const nxw = nx0;
          const nyw = ny0 * cp + nz0 * sp;
          const nzw = -ny0 * sp + nz0 * cp;
          /* seen from the camera at (0, 0, D)? */
          if (nxw * (0 - cX) + nyw * (0 - cY) + nzw * (D - cZ) <= 0) continue;

          zSum += cZ;
          count++;
          /* orient consistently so the union in the clip never cancels itself */
          let area = 0;
          for (let i = 0; i < 4; i++) {
            const j = (i + 1) % 4;
            area += pts[i * 2] * pts[j * 2 + 1] - pts[j * 2] * pts[i * 2 + 1];
          }
          if (area < 0) {
            const r = [pts[6], pts[7], pts[4], pts[5], pts[2], pts[3], pts[0], pts[1]];
            for (let i = 0; i < 8; i++) pts[i] = r[i];
          }
          const key = Math.max(0, nxw * KEY[0] + nyw * KEY[1] + nzw * KEY[2]);
          const rim = Math.max(0, nxw * RIM[0] + nyw * RIM[1] + nzw * RIM[2]);
          const burg = smooth(0.12, 0.72, key) * lit;
          const wine = smooth(0.6, 1, key) * 0.8 * lit + rim * 0.45 * lit;
          const r = INK[0] + (BURGUNDY[0] - INK[0]) * burg + (WINE[0] - BURGUNDY[0]) * wine;
          const gg = INK[1] + (BURGUNDY[1] - INK[1]) * burg + (WINE[1] - BURGUNDY[1]) * wine;
          const bb = INK[2] + (BURGUNDY[2] - INK[2]) * burg + (WINE[2] - BURGUNDY[2]) * wine;
          faces.push({
            pts,
            depth: cZ,
            area: Math.abs(area) / 2,
            top: [r, gg, bb],
            key,
            edge: `rgba(255,255,255,${(0.14 + key * 0.38).toFixed(3)})`,
          });
        }
      }

      for (const f of faces) {
        const p = f.pts;
        windowPieces.push(
          `M${p[0].toFixed(1)} ${p[1].toFixed(1)}L${p[2].toFixed(1)} ${p[3].toFixed(1)}L${p[4].toFixed(1)} ${p[5].toFixed(1)}L${p[6].toFixed(1)} ${p[7].toFixed(1)}Z`,
        );
      }
      if (alpha > 0.01 && count) drawList.push({ z: zSum / count, alpha, faces });
    }

    /* far slabs first */
    drawList.sort((a, b) => a.z - b.z);
    for (const item of drawList) {
      ctx.globalAlpha = item.alpha;
      item.faces.sort((a, b) => a.depth - b.depth);
      for (const f of item.faces) {
        const p = f.pts;
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        ctx.lineTo(p[2], p[3]);
        ctx.lineTo(p[4], p[5]);
        ctx.lineTo(p[6], p[7]);
        ctx.closePath();
        /* volume: each face is lit from the top and falls off toward its foot */
        const y0 = Math.min(p[1], p[3], p[5], p[7]);
        const y1 = Math.max(p[1], p[3], p[5], p[7]);
        const grad = ctx.createLinearGradient(0, y0, 0, y1 + 1);
        grad.addColorStop(0, `rgb(${f.top[0].toFixed(0)},${f.top[1].toFixed(0)},${f.top[2].toFixed(0)})`);
        grad.addColorStop(1, `rgb(${(f.top[0] * 0.5 + 4).toFixed(0)},${(f.top[1] * 0.5 + 3).toFixed(0)},${(f.top[2] * 0.5 + 4).toFixed(0)})`);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = f.edge;
        ctx.lineWidth = 0.9;
        ctx.stroke();
        drawMesh(ctx, p, f.key);
      }
    }
    ctx.globalAlpha = 1;

    return windowPieces.length ? `path("${windowPieces.join("")}")` : null;
  };

  return { resize, draw, clear };
}
