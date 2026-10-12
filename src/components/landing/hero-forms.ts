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
  /* its colour: 0 white, 1 silver, 2 wine, 3 burgundy, 4 garnet (the palette in glyph-field.tsx),
     or HIDDEN for a point this form does not use (the renderer skips it) */
  pal(i: number, t: number): number;
}

export const HIDDEN = 255;

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

/* A small kinetic tower, composed by hand so that it reads at a glance and from every three-quarter view:
   three stacked slabs (back, middle, front) that turn on one shared core, each standing on four posts;
   bridges leave every level, branch once or twice, and end in gates. One route climbs the core and out
   along the top bridge; a pulse of light runs up it. The rest is silver and white, the back slab burgundy,
   so depth reads by colour as well as by perspective. Everything is a chain of characters on a line, with
   whole characters of air between the lines, so nothing piles up. */

interface Prim {
  pts: V3[]; /* polyline, absolute coordinates before fitting */
  closed: boolean;
  group: number; /* 0 back slab and what stands on it, 1 middle, 2 front, 3 the far dust */
  rails: number; /* 1 a line, 2 a walkway, 4 a square tube */
  railW: number;
  weight: number; /* share of the points, per unit of length */
  route: boolean;
  s0: number; /* position along the lit route at the start of the polyline */
  pick: (r: number) => number;
}

export function buildTopology(count: number): HeroForm {
  const prims: Prim[] = [];
  const AX = 0.05; /* the core the levels turn on */
  const AZ = 0.05;
  const Y0 = 0.62, Y1 = 0.02, Y2 = -0.56; /* back, middle, front level */

  const white = (r: number) => (r > 0.25 ? 0 : 1);
  const silver = (r: number) => (r > 0.7 ? 0 : 1);
  const deep = (r: number) => (r > 0.55 ? 3 : 1);
  const add = (pts: V3[], o: Partial<Prim> & { group: number; pick: (r: number) => number }) => {
    prims.push({ closed: false, rails: 1, railW: 0.05, weight: 1, route: false, s0: 0, ...o, pts });
  };
  const rect = (cx: number, y: number, cz: number, hx: number, hz: number): V3[] => [
    [cx - hx, y, cz - hz], [cx + hx, y, cz - hz], [cx + hx, y, cz + hz], [cx - hx, y, cz + hz],
  ];

  /* slabs and the posts that carry them */
  const slabs: { y: number; cx: number; cz: number; hx: number; hz: number; g: number; pick: (r: number) => number }[] = [
    { y: Y0, cx: -0.05, cz: -0.2, hx: 0.95, hz: 0.55, g: 0, pick: deep },
    { y: Y1, cx: 0.12, cz: -0.02, hx: 0.62, hz: 0.38, g: 1, pick: silver },
    { y: Y2, cx: -0.2, cz: 0.26, hx: 0.36, hz: 0.26, g: 2, pick: white },
  ];
  slabs.forEach((sl, k) => {
    add(rect(sl.cx, sl.y, sl.cz, sl.hx, sl.hz), { group: sl.g, closed: true, weight: 1.15, pick: sl.pick });
    if (k > 0) {
      const below = slabs[k - 1];
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const x = sl.cx + sx * sl.hx, z = sl.cz + sz * sl.hz;
        add([[x, sl.y, z], [x, below.y, z]], { group: sl.g, weight: 1.1, pick: k === 1 ? deep : silver });
      }
    }
  });

  /* the core: a square tube from the back slab to the front one, and the lit route */
  const coreLen = Y0 - Y2;
  add([[AX, Y0, AZ], [AX, Y2, AZ]], { group: 0, rails: 4, railW: 0.07, weight: 1.0, route: true, s0: 0, pick: () => 2 });

  /* bridges: [level index, start, direction axis, length, [branch lengths]], branching once more at the end */
  type Bridge = { lv: number; from: V3; axis: 0 | 2; sign: 1 | -1; len: number; kids: { axis: 0 | 2; sign: 1 | -1; len: number }[]; route?: boolean };
  const bridges: Bridge[] = [
    { lv: 0, from: [0.9, Y0, -0.35], axis: 0, sign: 1, len: 0.5, kids: [{ axis: 2, sign: 1, len: 0.3 }, { axis: 2, sign: -1, len: 0.36 }] },
    { lv: 0, from: [-0.4, Y0, -0.75], axis: 2, sign: -1, len: 0.42, kids: [] },
    { lv: 1, from: [-0.5, Y1, 0.1], axis: 0, sign: -1, len: 0.5, kids: [{ axis: 2, sign: 1, len: 0.3 }, { axis: 0, sign: -1, len: 0.22 }] },
    { lv: 1, from: [0.3, Y1, 0.36], axis: 2, sign: 1, len: 0.4, kids: [] },
    { lv: 2, from: [0.16, Y2, 0.3], axis: 0, sign: 1, len: 0.62, kids: [{ axis: 2, sign: 1, len: 0.26 }, { axis: 2, sign: -1, len: 0.2 }], route: true },
    { lv: 2, from: [-0.3, Y2, 0.0], axis: 2, sign: -1, len: 0.36, kids: [] },
  ];
  const picks = [deep, silver, white];
  const gateAt = (c: V3, axis: 0 | 2, g: number, route: boolean, big: boolean) => {
    const hw = big ? 0.11 : 0.085, hh = big ? 0.19 : 0.15;
    const mid: V3 = [c[0], c[1] - hh, c[2]];
    const pts: V3[] = axis === 0
      ? [[mid[0], mid[1] - hh, mid[2] - hw], [mid[0], mid[1] - hh, mid[2] + hw], [mid[0], mid[1] + hh, mid[2] + hw], [mid[0], mid[1] + hh, mid[2] - hw]]
      : [[mid[0] - hw, mid[1] - hh, mid[2]], [mid[0] + hw, mid[1] - hh, mid[2]], [mid[0] + hw, mid[1] + hh, mid[2]], [mid[0] - hw, mid[1] + hh, mid[2]]];
    add(pts, { group: g, closed: true, weight: 1.3, route, pick: route ? (r) => (r > 0.5 ? 4 : 0) : (r) => (r > 0.8 ? 2 : 0) });
  };
  const nodes: { p: V3; g: number }[] = [];
  let routeLen = coreLen;
  bridges.forEach((b) => {
    const end: V3 = [b.from[0] + (b.axis === 0 ? b.sign * b.len : 0), b.from[1], b.from[2] + (b.axis === 2 ? b.sign * b.len : 0)];
    add([b.from, end], { group: b.lv, rails: 2, railW: 0.06, weight: 1.0, route: Boolean(b.route), s0: b.route ? routeLen : 0, pick: b.route ? () => 2 : picks[b.lv] });
    nodes.push({ p: b.from, g: b.lv }, { p: end, g: b.lv });
    if (b.route) routeLen += b.len;
    if (!b.kids.length) {
      gateAt(end, b.axis, b.lv, Boolean(b.route), b.lv === 2);
      return;
    }
    b.kids.forEach((k, ki) => {
      const kend: V3 = [end[0] + (k.axis === 0 ? k.sign * k.len : 0), end[1], end[2] + (k.axis === 2 ? k.sign * k.len : 0)];
      const lit = Boolean(b.route) && ki === 0;
      add([end, kend], { group: b.lv, rails: 2, railW: 0.05, weight: 0.9, route: lit, s0: lit ? routeLen : 0, pick: lit ? () => 2 : picks[b.lv] });
      if (lit) routeLen += k.len;
      gateAt(kend, k.axis, b.lv, lit, false);
    });
  });
  const total = routeLen;
  /* junction cubes where the core meets the levels */
  for (const y of [Y0, Y1, Y2]) nodes.push({ p: [AX, y, AZ], g: y === Y0 ? 0 : y === Y1 ? 1 : 2 });

  /* fit it into the space the other forms use (before the points are laid out, so spacing is in final units) */
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const pr of prims) for (const p of pr.pts) {
    x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]);
    y0 = Math.min(y0, p[1] - 0.2); y1 = Math.max(y1, p[1]);
    z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]);
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
  const fit = Math.min(1.08 / ((x1 - x0) / 2), 0.98 / ((y1 - y0) / 2), 1.0 / ((z1 - z0) / 2));
  const F = (p: V3): V3 => [(p[0] - cx) * fit, (p[1] - cy) * fit, (p[2] - cz) * fit];
  const pivX = (AX - cx) * fit;
  const pivZ = (AZ - cz) * fit;

  /* lay the characters out: points in proportion to length, whole rails, a little jitter along the line */
  const lenOf = (pr: Prim) => {
    let L = 0;
    const n = pr.pts.length - (pr.closed ? 0 : 1);
    for (let i = 0; i < n; i++) L += dist(pr.pts[i], pr.pts[(i + 1) % pr.pts.length]);
    return L * fit;
  };
  const nodePts = 8;
  const nHalo = Math.round(count * 0.03);
  /* A character is about 0.045 wide, so a line of them needs about 0.05 between points to stay a clean chain.
     The structure only has that much length, so the rest of the points are not drawn in this form: they
     vanish as it resolves, and come back when it dissolves. */
  const nPool = Math.round(count * 0.34);
  const nStruct = count - nHalo - nPool - nodePts * nodes.length;
  const weights = prims.map((pr) => lenOf(pr) * pr.weight * pr.rails);
  const counts = allocate(weights, nStruct);

  const bx = new Float32Array(count);
  const by = new Float32Array(count);
  const bz = new Float32Array(count);
  const grp = new Uint8Array(count);
  const rs = new Float32Array(count).fill(-1);
  const pal = new Uint8Array(count);
  let n = 0;
  const put = (p: V3, g: number, color: number, s = -1) => {
    if (n >= count) return;
    bx[n] = p[0]; by[n] = p[1]; bz[n] = p[2]; grp[n] = g; pal[n] = color; rs[n] = s; n++;
  };

  prims.forEach((pr, pi) => {
    const c = counts[pi];
    const segN = pr.pts.length - (pr.closed ? 0 : 1);
    const segLen: number[] = [];
    let L = 0;
    for (let i = 0; i < segN; i++) { const d = dist(pr.pts[i], pr.pts[(i + 1) % pr.pts.length]); segLen.push(d); L += d; }
    const per = Math.ceil(c / pr.rails);
    const offs: [number, number][] = pr.rails === 1 ? [[0, 0]] : pr.rails === 2 ? [[-0.5, 0], [0.5, 0]] : [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
    for (let j = 0; j < c; j++) {
      const rail = j % pr.rails;
      const u = ((Math.floor(j / pr.rails) + 0.5 + (rnd(pi * 131 + j) - 0.5) * 0.3) / per) * L;
      let acc = 0, si = 0;
      while (si < segN - 1 && acc + segLen[si] < u) { acc += segLen[si]; si++; }
      const a = pr.pts[si], b = pr.pts[(si + 1) % pr.pts.length];
      const f = segLen[si] > 0 ? Math.min(1, Math.max(0, (u - acc) / segLen[si])) : 0;
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const dl = Math.hypot(dx, dy, dz) || 1;
      /* two directions at right angles to the line, to put the rails on */
      let n1: V3, n2: V3;
      if (Math.abs(dy / dl) > 0.9) { n1 = [1, 0, 0]; n2 = [0, 0, 1]; }
      else { const hl = Math.hypot(dx, dz) || 1; n1 = [-dz / hl, 0, dx / hl]; n2 = [0, 1, 0]; }
      const o = offs[rail];
      const p: V3 = [
        a[0] + dx * f + (n1[0] * o[0] + n2[0] * o[1]) * pr.railW,
        a[1] + dy * f + (n1[1] * o[0] + n2[1] * o[1]) * pr.railW,
        a[2] + dz * f + (n1[2] * o[0] + n2[2] * o[1]) * pr.railW,
      ];
      const sLocal = pr.route ? (pr.s0 + (pr.pts.length > 1 ? (u / L) * (L) : 0)) / total : -1;
      put(F(p), pr.group, pr.pick(rnd(pi * 17 + j + 3)), sLocal);
    }
  });
  /* junction cubes */
  nodes.forEach((nd, k) => {
    for (let j = 0; j < nodePts; j++) {
      const sx = j & 1 ? 1 : -1, sy = j & 2 ? 1 : -1, sz = j & 4 ? 1 : -1;
      put(F([nd.p[0] + sx * 0.035, nd.p[1] - 0.035 + sy * 0.035, nd.p[2] + sz * 0.035]), nd.g, 0);
      void k;
    }
  });
  /* a thin halo of far, dim characters: the background layer */
  for (let j = 0; j < nHalo; j++) {
    const th = j * 2.399963229728653;
    const yy = 1 - ((j + 0.5) * 2) / Math.max(1, nHalo);
    const r = 1.05 + 0.2 * rnd(j * 3.1 + 5);
    const rr = Math.sqrt(Math.max(0, 1 - yy * yy));
    put([Math.cos(th) * rr * r, yy * r * 0.8, Math.sin(th) * rr * r], 3, rnd(j + 40) > 0.5 ? 3 : 1);
  }
  /* the unused ones, whatever is left: not drawn, but placed on a sphere so they fade from, and into, a spread */
  for (let j = 0; n < count; j++) {
    const th = j * 2.399963229728653;
    const yy = 1 - ((j + 0.5) * 2) / Math.max(1, nPool);
    const rr = Math.sqrt(Math.max(0, 1 - yy * yy));
    put([Math.cos(th) * rr * 0.9, yy * 0.9, Math.sin(th) * rr * 0.9], 3, HIDDEN);
  }

  /* each level turns on the core by its own small amount: the parallax that gives the tower its depth */
  const turn = (g: number, t: number) =>
    g === 0 ? 0 : g === 1 ? 0.34 * Math.sin(t * 0.23 + 0.5) : g === 2 ? -0.46 * Math.sin(t * 0.19 + 1.7) : t * 0.04;
  let tm = Number.NaN;
  const ang = new Float32Array(4);
  const sinA = new Float32Array(4);
  const cosA = new Float32Array(4);

  return {
    pos(i, t, out) {
      if (t !== tm) {
        tm = t;
        for (let g = 0; g < 4; g++) { ang[g] = turn(g, t); sinA[g] = Math.sin(ang[g]); cosA[g] = Math.cos(ang[g]); }
      }
      const g = grp[i];
      const lx = bx[i] - pivX;
      const lz = bz[i] - pivZ;
      out[0] = pivX + lx * cosA[g] + lz * sinA[g];
      out[1] = by[i] + (g < 3 ? Math.sin(t * 0.4 + g * 2.1) * 0.014 : 0);
      out[2] = pivZ - lx * sinA[g] + lz * cosA[g];
    },
    pal(i, t) {
      const s = rs[i];
      if (s < 0) return pal[i];
      const pulse = (t * 0.16) % 1.3; /* a packet of light, then a rest */
      const d = Math.abs(s - pulse);
      return d < 0.07 ? 0 : d < 0.15 ? 4 : 2;
    },
  };
}
