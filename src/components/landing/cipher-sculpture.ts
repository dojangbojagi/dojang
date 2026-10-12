/* The cipher sculpture: the bridge between the white claim and the dark hero.

   The full stop after "more" is a sealed block. Scrolling cuts it into a row of deep slabs; the slabs
   turn on their own vertical axes, lift, fly toward the camera at different moments (a shuffled order,
   like a cipher), and settle as the strips of the screen. The hero is the window through the slabs:
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

type Blade = { u: number; delay: number; dir: number; sway: number; lift: number; fly: number };

function makeBlades(n: number): Blade[] {
  return Array.from({ length: n }, (_, i) => ({
    u: (i + 0.5) / n - 0.5,
    delay: ((i * 4) % n) / (n - 1), /* 4 is coprime to 7 and 9: a shuffle, not a sweep */
    dir: (i % 2 ? 1 : -1) * (0.8 + 0.4 * rnd(i + 1)),
    sway: (rnd(i + 9) - 0.5) * 0.14,
    lift: (rnd(i + 3) - 0.5) * 0.4,
    fly: 0.5 + 0.5 * rnd(i + 5),
  }));
}

export type CipherRect = { x: number; y: number; w: number; h: number };

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

    type Face = { pts: number[]; depth: number; fill: string; edge: string; area: number };
    const drawList: { z: number; alpha: number; faces: Face[] }[] = [];
    const windowPieces: string[] = [];

    for (let bi = 0; bi < n; bi++) {
      const b = blades[bi];
      const s = clamp01((v - 0.5 * b.delay) / 0.5);
      const g = s * s * (3 - 2 * s);
      const arc = Math.sin(Math.PI * g);

      const w = lerp(S / n, (W / n) * 1.1, g);
      const h = lerp(S, H * 1.22, g);
      const t = lerp(S, (W / n) * 0.35, g) + arc * W * 0.16 * b.fly;
      const X = lerp(cx0 + b.u * S, b.u * W, g) + arc * b.sway * W;
      const Y = lerp(cy0, 0, g) + arc * b.lift * H;
      const Z = arc * D * 0.34 * b.fly;
      const yaw = arc * b.dir * 1.15;
      const cy = Math.cos(yaw);
      const sy = Math.sin(yaw);
      const hx = w / 2;
      const hy = h / 2;
      const hz = t / 2;
      const alpha = 1 - smooth(0.78, 1, s); /* a slab that has arrived becomes the window; it fades, the next one is still in the air */

      let zSum = 0;
      const faces: Face[] = [];
      for (const f of FACES) {
        /* the face, transformed: yaw about its own vertical axis, move into place, pitch the whole scene */
        const pts: number[] = [];
        let cX = 0;
        let cY = 0;
        let cZ = 0;
        for (const c of f.c) {
          const lx = c[0] * hx;
          const ly = c[1] * hy;
          const lz = c[2] * hz;
          const x = lx * cy + lz * sy + X;
          const z0 = -lx * sy + lz * cy + Z;
          const y0 = ly + Y;
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
        const nx0 = f.n[0] * cy + f.n[2] * sy;
        const nz0 = -f.n[0] * sy + f.n[2] * cy;
        const ny0 = f.n[1];
        const nxw = nx0;
        const nyw = ny0 * cp + nz0 * sp;
        const nzw = -ny0 * sp + nz0 * cp;
        /* seen from the camera at (0, 0, D)? */
        if (nxw * (0 - cX) + nyw * (0 - cY) + nzw * (D - cZ) <= 0) continue;

        zSum += cZ;
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
        const burg = smooth(0.38, 0.95, key);
        const wine = smooth(0.78, 1, key) * 0.55;
        const shine = rim * rim * 0.22;
        const r = INK[0] + (BURGUNDY[0] - INK[0]) * burg + (WINE[0] - BURGUNDY[0]) * wine + 255 * shine;
        const gg = INK[1] + (BURGUNDY[1] - INK[1]) * burg + (WINE[1] - BURGUNDY[1]) * wine + 255 * shine;
        const bb = INK[2] + (BURGUNDY[2] - INK[2]) * burg + (WINE[2] - BURGUNDY[2]) * wine + 255 * shine;
        faces.push({
          pts,
          depth: cZ,
          area: Math.abs(area) / 2,
          fill: `rgb(${r.toFixed(0)},${gg.toFixed(0)},${bb.toFixed(0)})`,
          edge: `rgba(255,255,255,${(0.1 + key * 0.32).toFixed(3)})`,
        });
      }

      for (const f of faces) {
        const p = f.pts;
        windowPieces.push(
          `M${p[0].toFixed(1)} ${p[1].toFixed(1)}L${p[2].toFixed(1)} ${p[3].toFixed(1)}L${p[4].toFixed(1)} ${p[5].toFixed(1)}L${p[6].toFixed(1)} ${p[7].toFixed(1)}Z`,
        );
      }
      if (alpha > 0.01 && faces.length) drawList.push({ z: zSum / faces.length, alpha, faces });
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
        ctx.fillStyle = f.fill;
        ctx.fill();
        ctx.strokeStyle = f.edge;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    return windowPieces.length ? `path("${windowPieces.join("")}")` : null;
  };

  return { resize, draw, clear };
}
