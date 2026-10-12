/* The hero's third and fourth forms. Same material as the first two (the hero's hex characters, one
   sprite per point), different geometry. glyph-field.tsx owns the sprites, the camera, the drag and the
   morph; this file only says where point i is, and which colour it is, at time t.

     C  "Proof lattice"    a skewed crystal, cut from ten hand-placed vertices, with a smaller cell and a
                           core inside it that turn against the shell and are strutted back to it: complex
                           inside, plain white outside. Private (wine) inside, public (silver) outside.
     D  "Access topology"  a recursive, right-angled branching of pathways on stacked layers, each ending
                           in a gate; one route is lit, and a pulse of light runs along it. It is wide and
                           sparse where C is compact and dense, so the two read apart even as silhouettes.

   Both are built once and are pure functions of t, so scrolling in reverse needs nothing. */

type V3 = [number, number, number];

export interface HeroForm {
  /* where point i is at time t (the hero's own clock, seconds), in a space about one unit in radius */
  pos(i: number, t: number, out: Float32Array): void;
  /* its colour: 0 white, 1 silver, 2 wine, 3 burgundy, 4 garnet (the palette in glyph-field.tsx) */
  pal(i: number, t: number): number;
}

const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/* split `total` into whole numbers in proportion to `weights` */
function allocate(weights: number[], total: number): number[] {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (w / sum) * total);
  const out = raw.map(Math.floor);
  let rest = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((p, q) => q[0] - p[0]);
  for (let k = 0; rest > 0; k++, rest--) out[order[k % order.length][1]]++;
  return out;
}

const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/* Euler rotation, Z * Y * X, into a 3x3 row-major matrix */
function euler(m: Float32Array, ax: number, ay: number, az: number) {
  const cx = Math.cos(ax), sx = Math.sin(ax);
  const cy = Math.cos(ay), sy = Math.sin(ay);
  const cz = Math.cos(az), sz = Math.sin(az);
  m[0] = cz * cy; m[1] = cz * sy * sx - sz * cx; m[2] = cz * sy * cx + sz * sx;
  m[3] = sz * cy; m[4] = sz * sy * sx + cz * cx; m[5] = sz * sy * cx - cz * sx;
  m[6] = -sy; m[7] = cy * sx; m[8] = cy * cx;
}

/* ================================================================ C: proof lattice */

export function buildLattice(count: number): HeroForm {
  /* 0 apex, 1-4 upper ring, 5-8 lower ring, 9 foot: none of them symmetric, so no view repeats */
  const V: V3[] = [
    [0.22, -1.05, 0.04],
    [0.66, -0.4, 0.3], [-0.18, -0.34, 0.74], [-0.78, -0.46, -0.16], [0.1, -0.28, -0.7],
    [0.84, 0.26, -0.2], [0.38, 0.4, 0.8], [-0.58, 0.3, 0.56], [-0.46, 0.46, -0.64],
    [-0.1, 1.02, 0.14],
  ];
  const edges: [number, number][] = [];
  const faces: [number, number, number][] = [];
  for (let i = 0; i < 4; i++) {
    const u = 1 + i, un = 1 + ((i + 1) % 4), l = 5 + i, ln = 5 + ((i + 1) % 4);
    edges.push([0, u], [u, un], [l, ln], [u, l], [u, ln], [l, 9]);
    faces.push([0, u, un], [u, l, ln], [u, un, ln], [9, l, ln]);
  }
  const IN = 0.5; /* the inner cell is the shell at half size */
  const C0: V3 = [-0.14, 0.08, 0.1]; /* off-centre, so the two never line up */

  const kind = new Uint8Array(count); /* 0 shell, 1 cell, 2 core, 3 strut */
  const bx = new Float32Array(count);
  const by = new Float32Array(count);
  const bz = new Float32Array(count);
  const au = new Float32Array(count); /* strut: how far along */
  const av = new Uint8Array(count); /* strut: which vertex */
  const pal = new Uint8Array(count);
  let n = 0;
  const put = (k: number, x: number, y: number, z: number, p: number) => {
    if (n >= count) return;
    kind[n] = k; bx[n] = x; by[n] = y; bz[n] = z; pal[n] = p; n++;
  };

  const along = (pa: V3, pb: V3, c: number, scale: number, k: number, pick: (r: number) => number, seed: number) => {
    for (let j = 0; j < c; j++) {
      const u = Math.min(0.98, Math.max(0.02, (j + 0.5 + (rnd(seed + j * 1.37) - 0.5) * 0.5) / c));
      put(k, (pa[0] + (pb[0] - pa[0]) * u) * scale, (pa[1] + (pb[1] - pa[1]) * u) * scale, (pa[2] + (pb[2] - pa[2]) * u) * scale, pick(rnd(seed + j * 2.11 + 5)));
    }
  };
  const lens = edges.map(([a, b]) => dist(V[a], V[b]));

  const nCell = Math.round(count * 0.24);
  const nCore = Math.round(count * 0.068);
  const nHeart = Math.round(count * 0.038);
  const nStrut = Math.round(count * 0.114);
  const nFace = Math.round(count * 0.14);

  /* the cell's edges, then the core's, so they are in front of the shell in the list too */
  allocate(lens, nCell).forEach((c, e) => along(V[edges[e][0]], V[edges[e][1]], c, IN, 1, (r) => (r > 0.4 ? 2 : 3), 100 + e * 17));

  const OCT: V3[] = [[0.2, 0, 0], [-0.2, 0, 0], [0, 0.27, 0], [0, -0.27, 0], [0, 0, 0.2], [0, 0, -0.2]];
  const octEdges: [number, number][] = [];
  for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) if (a >> 1 !== b >> 1) octEdges.push([a, b]);
  allocate(octEdges.map(([a, b]) => dist(OCT[a], OCT[b])), nCore).forEach((c, e) =>
    along(OCT[octEdges[e][0]], OCT[octEdges[e][1]], c, 1, 2, (r) => (r > 0.35 ? 4 : 0), 300 + e * 13),
  );
  for (let j = 0; j < nHeart; j++) { /* a few characters at the heart, on a small golden-angle sphere */
    const y = 1 - ((j + 0.5) * 2) / nHeart;
    const r = Math.sqrt(1 - y * y) * 0.085;
    const th = j * 2.399963229728653;
    put(2, Math.cos(th) * r, y * 0.085, Math.sin(th) * r, rnd(j + 700) > 0.3 ? 4 : 0);
  }

  /* struts: every shell vertex is tied to its twin in the cell */
  const per = Math.max(1, Math.floor(nStrut / V.length));
  for (let v = 0; v < V.length; v++) {
    for (let j = 0; j < per && n < count; j++) {
      const i = n;
      put(3, V[v][0], V[v][1], V[v][2], rnd(v * 31 + j * 7 + 900) < 0.7 ? 3 : rnd(v * 5 + j + 950) < 0.6 ? 2 : 0);
      au[i] = 0.1 + (0.8 * (j + 0.5)) / per;
      av[i] = v;
    }
  }

  /* precision-cut surfaces: a triangular lattice of characters inset on about half of the faces */
  const cand: { p: V3; k: number }[] = [];
  faces.forEach(([a, b, c], f) => {
    if (rnd(f * 3.7 + 1) < 0.42) return;
    const N = 8;
    for (let i = 1; i < N - 1; i++) {
      for (let j = 1; j < N - i; j++) {
        const k = N - i - j;
        if (k < 1) continue;
        cand.push({
          p: [
            (V[a][0] * i + V[b][0] * j + V[c][0] * k) / N,
            (V[a][1] * i + V[b][1] * j + V[c][1] * k) / N,
            (V[a][2] * i + V[b][2] * j + V[c][2] * k) / N,
          ],
          k: f,
        });
      }
    }
  });
  cand.sort((p, q) => rnd(p.p[0] * 91 + p.p[1] * 37 + p.p[2] * 11 + p.k) - rnd(q.p[0] * 91 + q.p[1] * 37 + q.p[2] * 11 + q.k));
  for (let j = 0; j < Math.min(nFace, cand.length); j++) put(0, cand[j].p[0], cand[j].p[1], cand[j].p[2], rnd(j + 1200) > 0.8 ? 0 : 1);

  /* the outer shell's edges take everything that is left, so the count is exact */
  const left = count - n;
  allocate(lens, left).forEach((c, e) => along(V[edges[e][0]], V[edges[e][1]], c, 1, 0, (r) => (r > 0.5 ? 0 : 1), 1500 + e * 19));
  while (n < count) put(0, 0, 0, 0, 1);

  /* the cell turns one way, the core another, and the struts stretch to follow */
  const m1 = new Float32Array(9);
  const m2 = new Float32Array(9);
  let tm = Number.NaN;
  const mats = (t: number) => {
    if (t === tm) return;
    tm = t;
    euler(m1, 0.25 + 0.08 * Math.sin(t * 0.3), 0.5 + t * 0.2, 0);
    euler(m2, t * 0.45, t * 0.7 + 1, t * 0.3);
  };

  return {
    pos(i, t, out) {
      const k = kind[i];
      if (k === 0) {
        out[0] = bx[i]; out[1] = by[i]; out[2] = bz[i];
        return;
      }
      mats(t);
      if (k === 3) {
        const o = V[av[i]];
        const x = o[0] * IN, y = o[1] * IN, z = o[2] * IN;
        const wx = m1[0] * x + m1[1] * y + m1[2] * z + C0[0];
        const wy = m1[3] * x + m1[4] * y + m1[5] * z + C0[1];
        const wz = m1[6] * x + m1[7] * y + m1[8] * z + C0[2];
        const u = au[i];
        out[0] = o[0] + (wx - o[0]) * u;
        out[1] = o[1] + (wy - o[1]) * u;
        out[2] = o[2] + (wz - o[2]) * u;
        return;
      }
      const m = k === 1 ? m1 : m2;
      const x = bx[i], y = by[i], z = bz[i];
      out[0] = m[0] * x + m[1] * y + m[2] * z + C0[0];
      out[1] = m[3] * x + m[4] * y + m[5] * z + C0[1];
      out[2] = m[6] * x + m[7] * y + m[8] * z + C0[2];
    },
    pal(i) {
      return pal[i];
    },
  };
}

/* ================================================================ D: access topology */

interface Seg { a: V3; b: V3; la: number; lb: number; route: boolean; s0: number; s1: number }
interface Gate { p: V3; axis: number; layer: number; route: boolean }

const DIRS: V3[] = [[1, 0, 0], [0, 0, 1], [-1, 0, 0], [0, 0, -1]];
const LAYER_DY = 0.62;

export function buildTopology(count: number): HeroForm {
  const segs: Seg[] = [];
  const nodes: { p: V3; layer: number; route: boolean }[] = [];
  const gates: Gate[] = [];

  /* Right-angled growth: turn left, turn right, and (near the root) carry straight on one layer down.
     From the third generation on a branch may simply be missing, so the tree is lopsided. */
  const grow = (p: V3, di: number, len: number, depth: number, layer: number, route: boolean, acc: number, seed: number) => {
    const d = DIRS[di];
    const q: V3 = [p[0] + d[0] * len, p[1], p[2] + d[2] * len];
    segs.push({ a: p, b: q, la: layer, lb: layer, route, s0: acc, s1: acc + len });
    nodes.push({ p: q, layer, route });
    const acc1 = acc + len;
    if (depth >= 3 || len < 0.12) {
      gates.push({ p: q, axis: di % 2, layer, route });
      return;
    }
    const kids: { di: number; len: number; down: boolean }[] = [];
    kids.push({ di: (di + 1) % 4, len: len * (0.86 + 0.24 * rnd(seed + 1)), down: false });
    kids.push({ di: (di + 3) % 4, len: len * (0.78 + 0.3 * rnd(seed + 2)), down: false });
    if (depth === 0 || (depth === 1 && rnd(seed + 3) > 0.35) || (depth === 2 && rnd(seed + 6) > 0.62)) {
      kids.push({ di, len: len * (0.7 + 0.25 * rnd(seed + 4)), down: true });
    }
    const kept = kids.filter((k, n) => !(depth >= 2 && n === 1 && rnd(seed + 5) < 0.4));
    const routeKid = route ? (kept.find((k) => k.down) ?? kept[0]) : null;
    kept.forEach((k, n) => {
      const isRoute = k === routeKid;
      const s = seed * 3 + n * 7 + depth;
      if (k.down) {
        const q2: V3 = [q[0], q[1] + LAYER_DY, q[2]];
        segs.push({ a: q, b: q2, la: layer, lb: layer + 1, route: isRoute, s0: acc1, s1: acc1 + LAYER_DY });
        nodes.push({ p: q2, layer: layer + 1, route: isRoute });
        grow(q2, k.di, k.len, depth + 1, layer + 1, isRoute, acc1 + LAYER_DY, s);
      } else {
        grow(q, k.di, k.len, depth + 1, layer, isRoute, acc1, s);
      }
    });
  };
  grow([-1.0, -0.62, -0.1], 0, 0.66, 0, 0, true, 0, 5);

  /* centre it and fit it into the space the other forms use */
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const s of segs) for (const p of [s.a, s.b]) {
    x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]);
    y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
    z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]);
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
  const fit = Math.min(1.05 / Math.max(0.01, (x1 - x0) / 2), 0.95 / Math.max(0.01, (y1 - y0) / 2), 1.0 / Math.max(0.01, (z1 - z0) / 2));
  const T = (p: V3): V3 => [(p[0] - cx) * fit, (p[1] - cy) * fit, (p[2] - cz) * fit];
  const dyL = LAYER_DY * fit;
  const yL0 = T([0, -0.62, 0])[1]; /* the top layer's height after fitting */
  const total = segs.reduce((m, s) => Math.max(m, s.route ? s.s1 : 0), 0) || 1;
  const maxLayer = segs.reduce((m, s) => Math.max(m, s.lb), 0);

  const bx = new Float32Array(count);
  const by = new Float32Array(count);
  const bz = new Float32Array(count);
  const lf = new Float32Array(count); /* layer, fractional on a riser: the layers drift, the risers follow */
  const rs = new Float32Array(count).fill(-1); /* position along the lit route, or -1 */
  const pal = new Uint8Array(count);
  let n = 0;
  const put = (p: V3, layer: number, p0: number, s = -1) => {
    if (n >= count) return;
    bx[n] = p[0]; by[n] = p[1]; bz[n] = p[2]; lf[n] = layer; pal[n] = p0; rs[n] = s; n++;
  };
  const shade = (layer: number, r: number) => (layer >= 2 ? (r > 0.5 ? 3 : 1) : r > 0.72 ? 0 : 1);

  const nGate = Math.round(count * 0.16);
  const nNode = Math.round(count * 0.1);
  const nPlate = Math.round(count * 0.07); /* each layer's outline */
  const nFloor = Math.round(count * 0.06); /* and a sparse grid inside it */
  const perGate = Math.max(8, Math.floor(nGate / Math.max(1, gates.length)));
  const perNode = Math.max(3, Math.floor(nNode / Math.max(1, nodes.length)));
  const plates = maxLayer + 1;
  const perPlate = Math.floor(nPlate / plates);
  const perFloor = Math.floor(nFloor / plates);
  const hx = ((x1 - x0) / 2 + 0.1) * fit;
  const hz = ((z1 - z0) / 2 + 0.1) * fit;
  const cols = Math.max(3, Math.round(Math.sqrt(perFloor * (hx / Math.max(0.05, hz)))));
  const rows = Math.max(3, Math.floor(perFloor / cols));
  const nPath = count - perGate * gates.length - perNode * nodes.length - (perPlate + cols * rows) * plates; /* what is left is pathway, so the count is exact */

  /* pathways: two rails each (a corridor), points in proportion to length */
  const SW = 0.06;
  const segLen = segs.map((s) => dist(s.a, s.b));
  allocate(segLen, nPath).forEach((c, si) => {
    const s = segs[si];
    const vertical = s.la !== s.lb;
    const horizX = Math.abs(s.b[0] - s.a[0]) > Math.abs(s.b[2] - s.a[2]);
    const strands = 2;
    for (let j = 0; j < c; j++) {
      const strand = j % strands;
      const u = Math.min(0.99, Math.max(0.01, (Math.floor(j / strands) + 0.5 + (rnd(si * 53 + j) - 0.5) * 0.4) / Math.ceil(c / strands)));
      const w = (strand - 0.5) * SW;
      const p: V3 = [
        s.a[0] + (s.b[0] - s.a[0]) * u + (vertical || !horizX ? w / fit : 0),
        s.a[1] + (s.b[1] - s.a[1]) * u,
        s.a[2] + (s.b[2] - s.a[2]) * u + (!vertical && horizX ? w / fit : 0),
      ];
      const layer = s.la + (s.lb - s.la) * u;
      const t = T(p);
      if (s.route) put(t, layer, 2, s.s0 + (s.s1 - s.s0) * u);
      else put(t, layer, shade(layer, rnd(si * 17 + j + 3)));
    }
  });

  /* junctions: a few characters at the corners of a small cube */
  nodes.forEach((nd, k) => {
    const c = T(nd.p);
    for (let j = 0; j < perNode; j++) {
      const sx = j & 1 ? 1 : -1, sy = j & 2 ? 1 : -1, sz = j & 4 ? 1 : -1;
      put([c[0] + sx * 0.032, c[1] + sy * 0.032, c[2] + sz * 0.032], nd.layer, nd.route ? 0 : rnd(k * 9 + j) > 0.5 ? 0 : 1);
    }
  });

  /* gates: an upright frame facing the way the pathway was going */
  gates.forEach((g, k) => {
    const c = T(g.p);
    const hw = 0.1, hh = 0.17;
    for (let j = 0; j < perGate; j++) {
      const f = (j + 0.5) / perGate; /* around the perimeter */
      const per = 2 * (2 * hw + 2 * hh);
      let d = f * per;
      let a = 0, b = 0;
      if (d < 2 * hw) { a = -hw + d; b = -hh; }
      else if ((d -= 2 * hw) < 2 * hh) { a = hw; b = -hh + d; }
      else if ((d -= 2 * hh) < 2 * hw) { a = hw - d; b = hh; }
      else { d -= 2 * hw; a = -hw; b = hh - d; }
      const p: V3 = g.axis === 0 ? [c[0], c[1] + b, c[2] + a] : [c[0] + a, c[1] + b, c[2]];
      put(p, g.layer, g.route ? (j % 3 === 0 ? 0 : 4) : rnd(k * 31 + j) > 0.7 ? 2 : 0);
    }
  });

  /* the layers themselves: a dotted outline and a sparse grid at each level, so the depth between
     them reads and the pathways seem to stand on something */
  for (let L = 0; L < plates; L++) {
    const yy = yL0 + L * dyL + 0.04;
    for (let j = 0; j < perPlate; j++) {
      const per = 2 * (2 * hx + 2 * hz);
      let d = ((j + 0.5) / perPlate) * per;
      let x = 0, z = 0;
      if (d < 2 * hx) { x = -hx + d; z = -hz; }
      else if ((d -= 2 * hx) < 2 * hz) { x = hx; z = -hz + d; }
      else if ((d -= 2 * hz) < 2 * hx) { x = hx - d; z = hz; }
      else { d -= 2 * hx; x = -hx; z = hz - d; }
      put([x, yy, z], L, 3);
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const jx = (rnd(L * 211 + r * 17 + c * 3 + 1) - 0.5) * 0.35;
        const jz = (rnd(L * 197 + r * 13 + c * 7 + 2) - 0.5) * 0.35;
        const x = -hx + ((c + 0.5 + jx) / cols) * 2 * hx;
        const z = -hz + ((r + 0.5 + jz) / rows) * 2 * hz;
        put([x, yy, z], L, rnd(L * 53 + r * 5 + c) > 0.9 ? 1 : 3);
      }
    }
  }
  while (n < count) put([0, 0, 0], 0, 3);

  return {
    pos(i, t, out) {
      out[0] = bx[i];
      out[1] = by[i] + Math.sin(t * 0.5 + lf[i] * 1.9) * 0.032;
      out[2] = bz[i];
    },
    pal(i, t) {
      const s = rs[i];
      if (s < 0) return pal[i];
      const pulse = ((t * 0.16) % 1.25) * total; /* a packet of light, then a rest */
      const d = Math.abs(s - pulse);
      return d < 0.06 * total ? 0 : d < 0.13 * total ? 4 : 2;
    },
  };
}
