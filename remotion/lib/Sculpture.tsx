import { icosahedronEdges, icosahedronVertices, project, rotateX, rotateY, rotateZ, type Vec3 } from "./geo3d";

/* The protocol's one recurring technical object: a rotating wireframe icosahedron, drawn from real
   projected 3D coordinates. Scaled and recoloured it reads as a credential, a sealed commitment or a
   verified proof — the same "hex-glyph 3D form" language as the site's hero, recreated as true geometry
   instead of captured from a screen. */
export function Lattice({
  cx,
  cy,
  radius,
  spinY,
  spinX = 0,
  spinZ = 0,
  focal = 1000,
  color,
  nodeColor,
  opacity = 1,
  lineWidth = 1.6,
  nodeSize = 5,
  reveal = 1,
  core,
}: {
  cx: number;
  cy: number;
  radius: number;
  spinY: number;
  spinX?: number;
  spinZ?: number;
  focal?: number;
  color: string;
  nodeColor?: string;
  opacity?: number;
  lineWidth?: number;
  nodeSize?: number;
  /** 0..1: edges draw themselves in, like the scene is building the object */
  reveal?: number;
  /** an optional small solid core, 0..radius*0.6, drawn behind the wire */
  core?: { radius: number; color: string; opacity?: number };
}) {
  const verts = icosahedronVertices(radius);
  const edges = icosahedronEdges(verts);
  const spin = (p: Vec3) => rotateZ(rotateX(rotateY(p, spinY), spinX), spinZ);
  const proj = verts.map((v) => project(spin(v), { focal, cx, cy }));
  const order = edges
    .map(([a, b], i) => ({ i, a, b, z: proj[a].z + proj[b].z }))
    .sort((p, q) => p.z - q.z);
  const nEdges = Math.round(edges.length * Math.min(1, Math.max(0, reveal)));
  return (
    <svg width="100%" height="100%" viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, overflow: "visible", opacity }}>
      {core ? <circle cx={cx} cy={cy} r={core.radius} fill={core.color} opacity={core.opacity ?? 1} /> : null}
      {order.slice(0, nEdges).map(({ i, a, b, z }) => {
        const pa = proj[a];
        const pb = proj[b];
        const depth = (z + radius) / (radius * 2); // 0 far .. 1 near
        return <line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={color} strokeWidth={lineWidth * (0.6 + depth * 0.8)} opacity={0.3 + depth * 0.6} />;
      })}
      {proj.map((p, i) => {
        if (i >= Math.ceil((nEdges / edges.length) * verts.length) && nEdges < edges.length) return null;
        const depth = (p.z + radius) / (radius * 2);
        return <circle key={i} cx={p.x} cy={p.y} r={nodeSize * (0.6 + depth * 0.7)} fill={nodeColor ?? color} opacity={0.5 + depth * 0.5} />;
      })}
    </svg>
  );
}

/* a flat hex board that reads as data/a fingerprint rather than decoration: a steady grid of hex pairs,
   each one flipping to a new value on its own deterministic clock. Used thin and dim, as a texture. */
const HEX = "0123456789abcdef";
function hexAt(seed: number, slot: number): string {
  const r = (n: number) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const a = HEX[Math.floor(r(seed * 7.1 + slot * 3.3) * 16)];
  const b = HEX[Math.floor(r(seed * 11.7 + slot * 5.9 + 1) * 16)];
  return a + b;
}

export function GlyphField({
  t,
  x,
  y,
  w,
  h,
  cols,
  rows,
  color,
  opacity = 1,
  size = 17,
  flipEvery = 0.5,
  seed = 0,
}: {
  t: number;
  x: number;
  y: number;
  w: number;
  h: number;
  cols: number;
  rows: number;
  color: string;
  opacity?: number;
  size?: number;
  flipEvery?: number;
  seed?: number;
}) {
  const cw = w / cols;
  const ch = h / rows;
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const phase = ((idx * 37) % 23) / 23;
      const slot = Math.floor(t / flipEvery + phase * 6);
      const flicker = 0.35 + 0.65 * Math.pow(Math.sin((t * 0.6 + phase * 9) * Math.PI * 2) * 0.5 + 0.5, 2.2);
      cells.push(
        <div
          key={idx}
          style={{
            position: "absolute",
            left: c * cw,
            top: r * ch,
            width: cw,
            height: ch,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontWeight: 500,
            fontSize: size,
            letterSpacing: "0.04em",
            color,
            opacity: flicker,
          }}
        >
          {hexAt(seed + idx, slot)}
        </div>,
      );
    }
  }
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, opacity, pointerEvents: "none" }}>
      {cells}
    </div>
  );
}
