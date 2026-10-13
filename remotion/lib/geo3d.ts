/* A small, deliberately plain 3D kit: just enough vector math to rotate and project a handful of points.
   No WebGL, no three.js — the "3D-style technical objects" in these films are drawn as SVG lines and
   circles from real rotated coordinates, so the depth is actually there, not faked with a blur. */

export type Vec3 = readonly [number, number, number];

export const PHI = (1 + Math.sqrt(5)) / 2;

export function rotateY([x, y, z]: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c + z * s, y, -x * s + z * c];
}

export function rotateX([x, y, z]: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x, y * c - z * s, y * s + z * c];
}

export function rotateZ([x, y, z]: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c - y * s, x * s + y * c, z];
}

export type Projected = { x: number; y: number; scale: number; z: number };

/* camera sits on -focal along z, looking at the origin; points are offset so the denominator stays positive */
export function project(p: Vec3, opts: { focal: number; cx: number; cy: number }): Projected {
  const z = p[2] + opts.focal;
  const s = opts.focal / Math.max(1, z);
  return { x: opts.cx + p[0] * s, y: opts.cy + p[1] * s, scale: s, z: p[2] };
}

/* the 12 vertices of a regular icosahedron — every cyclic permutation of (0, ±1, ±φ), normalized to radius 1 */
export function icosahedronVertices(radius: number): Vec3[] {
  const a = 1 / Math.sqrt(1 + PHI * PHI);
  const b = PHI * a;
  const raw: Vec3[] = [
    [0, a, b], [0, a, -b], [0, -a, b], [0, -a, -b],
    [a, b, 0], [a, -b, 0], [-a, b, 0], [-a, -b, 0],
    [b, 0, a], [-b, 0, a], [b, 0, -a], [-b, 0, -a],
  ];
  return raw.map(([x, y, z]) => [x * radius, y * radius, z * radius] as const);
}

/* every nearest-neighbour pair (each vertex has exactly 5) */
export function icosahedronEdges(verts: Vec3[]): [number, number][] {
  const dist2 = (p: Vec3, q: Vec3) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
  let min = Infinity;
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      const d = dist2(verts[i], verts[j]);
      if (d < min) min = d;
    }
  }
  const edges: [number, number][] = [];
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      if (dist2(verts[i], verts[j]) < min * 1.02) edges.push([i, j]);
    }
  }
  return edges;
}

/* 8 vertices of a cube, radius = half the edge length (so corners sit at distance radius*sqrt(3)) */
export function cubeVertices(radius: number): Vec3[] {
  const out: Vec3[] = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) out.push([x * radius, y * radius, z * radius]);
  return out;
}

export function cubeEdges(): [number, number][] {
  const edges: [number, number][] = [];
  const verts = cubeVertices(1);
  for (let i = 0; i < verts.length; i++)
    for (let j = i + 1; j < verts.length; j++) {
      const d = Math.abs(verts[i][0] - verts[j][0]) + Math.abs(verts[i][1] - verts[j][1]) + Math.abs(verts[i][2] - verts[j][2]);
      if (d === 2) edges.push([i, j]); // exactly one axis differs -> an edge, not a face or space diagonal
    }
  return edges;
}
