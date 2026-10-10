# Glyph Solid: a 3D object made of characters

Handoff for any agent or developer who needs to make, change or reuse the turning character objects on the landing and the inner pages. Written 2026-10-10. Presentation only: no wallet, chain, credential or proof logic is involved.

## 1. What it is, and its name

A **glyph solid** is a 3D shape drawn as a cloud of about 500 hex characters (`0-9 A-F`) that turns in perspective, can be dragged with the mouse, and can reshape itself into another shape.

The general technique is called a **3D point cloud** (or particle cloud) drawn with **software projection on a 2D canvas**: there is no WebGL, no Three.js, no model file and no library. Each point is a 3D coordinate; every frame the points are rotated, projected to the screen with simple perspective, sorted far to near, and drawn as small pre-rendered character sprites. In this repo the component is named `GlyphSolid`.

It was chosen because it matches the hero's character clouds, costs almost nothing (about 2 % of one core at rest, 60 fps while scrolling), and works without any dependency.

Colour keeps the product's meaning. **Blue/white = public, on-chain. Orange = private, on your device. Grey square = sealed.**

## 2. Where it is used

| Shape id | What it looks like | Page | Meaning |
|---|---|---|---|
| `sphere` | sphere of readable characters, a few orange | landing idea scene, state 1 | a public attestation, with the private value exposed |
| `cube` | closed cube of grey sealed cells | landing idea scene state 2, `/vault` | private and unverifiable / a closed gate |
| `seal` | orange sealed core inside a flat blue ring | landing idea scene state 3, `/bojagi` | private value, public proof |
| `orb` | sphere, blue and white only | `/dojang` | the official record is public |
| `rings` | two linked rings, blue and orange | `/lending` | supply and borrow, joined by a proof |
| `stack` | four slabs of characters | `/contracts` | evidence, layer by layer |
| `book` | open book of text lines, sways | `/docs` | the written trust model |
| `assembly` | tiered half-circle seating, sways | `/dao` | a governing body voting in public |

## 3. Files

| File | Role |
|---|---|
| `src/components/landing/glyph-solid.tsx` | the whole engine: shapes, palette, sprite sheet, morph, projection, drag. Exports `GlyphSolid` and `ShapeId`. |
| `src/components/page-glyph.tsx` | `PageGlyphFigure`: the canvas with a caption, a colour key and a "Drag to turn it" hint. |
| `src/components/protocol-page.tsx` | `ProtocolPage` renders `PageGlyphFigure` from its required `glyph` prop. |
| `src/app/vault/page.tsx`, `contracts/page.tsx`, `docs/page.tsx` | older `.page` layout: a `<header className="page-head">` holds the figure and the title. |
| `src/components/landing/idea-scene.tsx` | the landing scene: switches `shape` with the scroll and passes it to `GlyphSolid`. |
| `src/app/theme.css` | `.stub__glyph`, `.stub__canvas`, `.page-head`: size, position, key colours, small-screen layout. |

## 4. How it works, step by step

1. **Shape.** A shape is a function `pos(i, spin, out)` that writes the x, y, z of point `i` (0..485) into `out`, plus a palette array that gives each point a colour id. Coordinates stay inside roughly -1..1. `spin` is a time value for shapes whose parts move (a ring orbiting).
2. **Sprite sheet.** At start (and when the canvas size or font changes) every character in every colour is drawn once into an offscreen canvas: 16 characters across, one row per colour. Colour ids: `0` white `(228,236,255)`, `1` blue `(112,168,255)`, `2` orange `(255,122,61)`, `3` grey `(154,164,184)`, which is drawn as a small closed square instead of a character. No text is laid out per frame.
3. **Per frame**, for each point:
   - take the shape position; if a morph is running, blend from the old position to it with a per-point delay and a small arc (see section 6);
   - turn around the vertical axis by `yaw`: `x1 = x cos(yaw) + z sin(yaw)`, `z1 = -x sin(yaw) + z cos(yaw)`;
   - tilt by `pitch`: `y1 = y cos(pitch) - z1 sin(pitch)`, `z2 = y sin(pitch) + z1 cos(pitch)`;
   - perspective: `s = CAMERA / (CAMERA - z2)` with `CAMERA = 5`; screen `x = cx + x1 * s * R`, `y = cy + y1 * s * R`, with `R = 0.33 * min(canvasWidth, canvasHeight)` (y points down on screen).
4. **Sort** the 486 indices by `z2` (far to near, painter's algorithm).
5. **Draw** each sprite with `drawImage`: size `16 * dpr * sizeK * s * (0.62 + 0.5 * depth)`, opacity `0.2 + 0.8 * depth^1.25`, where `depth = (z2 + 1.3) / 2.6` clamped to 0..1. Near points are larger and brighter, far points small and faint.

## 5. Parameters (all in `glyph-solid.tsx`)

| Name | Value | Meaning |
|---|---|---|
| `COUNT` | 486 | points per shape (6 faces x 81). Keep it the same for every shape so shapes can morph into each other. |
| `CORE` | 216 | `seal` only: the first 216 points are the core, the rest the ring |
| `CAMERA` | 5 | perspective distance; larger is flatter |
| `R` | `0.33 * minDim` | scale. Do not raise it: shapes would be clipped |
| auto yaw | 0.28 rad/s | continuous turn (`autoYaw += dt * 0.28`) |
| sway phase | 0.45 rad/s | for shapes with `sway`, the angle is `yaw + sin(phase) * sway` |
| ring spin | `t * 0.7` | passed to `pos` as `spin` |
| pitch | `0.5 + sin(t * 0.35) * 0.06` | slight nod; static still frames use 0.5 |
| `FRAME_MS` | 33 | about 30 frames per second |
| `MORPH_MS` | 1500 | time to change shape |
| drag | 0.011 rad per px | mouse turns both ways; touch only sideways |
| inertia | velocity `* exp(-3 dt)`, clamp +-6 rad/s | glide after a flick |
| tilt return | pitch offset `* exp(-0.5 dt)` | a tilt given by hand eases back to level |
| sprite cell | `20 * dpr` px, glyph font `0.68 * cell` | sharp at any pixel ratio (dpr capped at 2) |

## 6. Morph between shapes

When the `shape` prop changes, the current positions are copied to `from`. For each point `i` a delay `d_i = random(i) * 0.38` is fixed. With global progress `m` (0..1 over `MORPH_MS`): `local = clamp((m - d_i) / 0.62)`, eased with an ease-in-out cubic `e`, and the point is `from + (target - from) * e + jitter_i * sin(pi * e)`. The jitter makes the points swirl a little on the way. The colour switches at `e = 0.5`. Because the starting point is the current position, changing shape in the middle of a morph does not jump.

## 7. Grab and drag

- Pointer events on the canvas (`pointerdown` / `move` / `up` / `cancel`) with pointer capture. Mouse: left button only.
- The **automatic motion keeps its own clock**; the hand only adds an offset (`userYaw`, `userPitch`) on top. While held, the clock stops, so everything (turn, nod, ring orbit) is still in the hand. On release the drift continues from where the object was left; nothing is reset.
- A quick flick glides to a stop (inertia). Letting go after holding still (over 120 ms without movement) does not glide.
- Touch: `touch-action: pan-y` on the canvas, so a vertical swipe still scrolls the page and a horizontal swipe turns the object. The browser then sends `pointercancel`, which is handled like a release.
- The canvas gets `cursor: grab` / `grabbing` and `user-select: none`. In layouts where the surrounding figure ignores the pointer (`pointer-events: none`), the canvas itself must set `pointer-events: auto`, and the figure must sit above any text container (`z-index: 1`), otherwise the container swallows the events.
- With reduced motion or `animated={false}` there is no loop: the canvas redraws only while you drag.

## 8. Use it

```tsx
import { GlyphSolid } from "@/components/landing/glyph-solid";

// the canvas fills its CSS box; give it a size and keep it square
<GlyphSolid className="my-canvas" shape="seal" label="Plain-language description of the picture" />
// a still frame (no loop), for stacked layouts:  animated={false}
```

```tsx
// a page header with caption, colour key and drag hint
import { PageGlyphFigure } from "@/components/page-glyph";
<PageGlyphFigure glyph={{ shape: "rings", label: "...", caption: "One line", legend: ["public", "private"] }} />
```

On a page built with `ProtocolPage`, pass the same object as its `glyph` prop. On an older `.page` layout wrap the heading in `<header className="page-head">` and put `<PageGlyphFigure />` first inside it. Legend values: `"public"`, `"private"`, `"sealed"`; list only the colours that appear in the shape.

## 9. Add a new shape (recipe)

1. Add the id to `ShapeId` in `glyph-solid.tsx`.
2. Write the positions. Always produce exactly `COUNT` points; if the shape needs fewer, park the spare points somewhere harmless (for example on top). Keep every coordinate inside about +-1 (the perspective can enlarge near points by about 1.3x, so nothing may reach the edge).

   ```ts
   function helixPoint(i: number, spin: number, out: Float32Array, o: number) {
     const a = (i / COUNT) * Math.PI * 8 + spin;     // 4 turns
     out[o] = Math.cos(a) * 0.6;
     out[o + 1] = (i / COUNT) * 2 - 1;               // from -1 to 1
     out[o + 2] = Math.sin(a) * 0.6;
   }
   ```
3. Write the palette with `palette((i) => colourId)`; ids as in section 4.
4. Register it in `SHAPES`: `helix: { pos: (i, spin, out) => helixPoint(i, spin, out, 0), pal: PAL_HELIX, yaw: 0.5 }`. `yaw` is the angle used for a still frame. Add `sway: 0.75` for a flat shape that is unreadable edge-on (the book): it then sways either side of `yaw` instead of turning all the way round.
5. Use it: `<GlyphSolid shape="helix" ... />`.
6. Check it (section 11): inside the canvas at every angle, readable, and the colours mean what the page says.

Design rules that kept the set coherent: make a shape say something about the page (a sealed thing for private, a ring for a proof, layers for evidence); use at most three colours; spacing between points about 0.15 to 0.2 so characters stay legible without piling up.

## 10. Performance and accessibility rules

- Never lay out text per frame; always `drawImage` from the sprite sheet. No `shadowBlur`, no filters on the canvas.
- Run the loop only while the canvas is in view (`IntersectionObserver`, 80 px margin) and the tab is visible; about 30 fps; stop it completely for reduced motion.
- Measured on a retina laptop: scroll stays at 16.7 ms frames through all the pages and the landing scene; resting cost is about 2 % of the main thread with one object turning.
- The canvas is a picture: `role="img"` and a plain-language `aria-label` that says what the shape means. It is not focusable (decorative, no keyboard controls); do not make it a tab stop.
- Respect `prefers-reduced-motion`: one still frame, redrawn only when dragged.

## 11. Verify (checklist)

- `bun run typecheck` and `bun run build`.
- Look at the shape at four angles (it turns): capture the canvas with `canvas.toDataURL()` at about 2.5 s apart and view the images side by side. Look for clipping at the canvas edge, an edge-on view that turns it into a line, and points piled on each other.
- Drag test with a real mouse (Puppeteer: `mouse.down`, several small `mouse.move` steps, `mouse.up`): the picture must change while dragging; it must be still while held; the cursor is `grab` / `grabbing`; after release the drift resumes; a vertical drag tilts and the tilt eases back; the mouse wheel over the canvas still scrolls the page.
- Small screens: the picture sits above the title, nothing overflows horizontally (390 px).
- Page text is not covered: the figure ignores the pointer except for the canvas.

## 12. Pitfalls found while building it

- A ring tilted a lot goes edge-on at some angles and looks like a line. Keep rings horizontal (`TILT = 0.2`) so the turn does not hide them.
- A flat shape (the book) must sway, not spin.
- Shapes drawn too large were clipped at the canvas edge; the fix was `R = 0.33 * minDim` and smaller shape extents.
- The text container sits above an absolutely positioned figure and swallows the mouse: raise the figure (`z-index: 1`) and give only the canvas `pointer-events: auto`.
- Time-driven parts (ring orbit, nod) kept moving while held until all automatic motion was moved onto one clock that stops during a drag.
- A clipped screenshot makes headless Chrome resize the page, which rebuilds canvases: capture the canvas itself instead.

## 13. Minimal reference (no framework, copy and run)

A complete, single-file version of the whole idea, with the same maths, the same sprite sheet and the same drag behaviour, for one shape (a sphere). Save it as an `.html` file and open it. To port the technique to another stack, keep these five parts: shape, sprite sheet, state, frame, drag.

```html
<!doctype html>
<meta charset="utf-8">
<title>Glyph solid, minimal</title>
<body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#0d1322">
<canvas id="c" width="600" height="600" style="width:300px;height:300px;cursor:grab;touch-action:pan-y;user-select:none" role="img" aria-label="A sphere of characters, turning"></canvas>
<script>
/* A 3D object made of characters. No library, no WebGL: points are turned and projected by hand and drawn as sprites. */
const COUNT = 486, GLYPHS = "0123456789ABCDEF", CAMERA = 5;
const c = document.getElementById("c"), g = c.getContext("2d");

/* 1. THE SHAPE: COUNT points, each [x, y, z] inside about -1..1. Swap this for any other shape. */
const pts = Array.from({ length: COUNT }, (_, i) => {
  const y = 1 - ((i + 0.5) * 2) / COUNT, r = Math.sqrt(1 - y * y), th = i * 2.399963229728653; /* golden angle */
  return [Math.cos(th) * r, y, Math.sin(th) * r];
});

/* 2. THE SPRITE SHEET: every character in every colour, drawn once. Per frame we only copy from it. */
const cs = 40, COLOURS = ["#e4ecff", "#70a8ff"]; /* white, blue */
const atlas = document.createElement("canvas");
atlas.width = cs * GLYPHS.length; atlas.height = cs * COLOURS.length;
const a = atlas.getContext("2d");
a.font = `500 ${cs * 0.68}px ui-monospace, monospace`; a.textAlign = "center"; a.textBaseline = "middle";
COLOURS.forEach((col, row) => { a.fillStyle = col; [...GLYPHS].forEach((ch, k) => a.fillText(ch, k * cs + cs / 2, row * cs + cs / 2)); });

/* 3. STATE: the automatic turn keeps its own angle; the hand adds an offset on top and never changes the drift. */
let auto = 0, uYaw = 0, uPitch = 0, vYaw = 0, vPitch = 0, held = false, last = 0, lx = 0, ly = 0, lt = 0;

/* 4. ONE FRAME: turn, project, sort far to near, copy sprites. */
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
  if (!held) { /* a flick glides to a stop; a tilt given by hand eases back to level */
    uYaw += vYaw * dt; uPitch += vPitch * dt;
    vYaw *= Math.exp(-3 * dt); vPitch *= Math.exp(-3 * dt); uPitch *= Math.exp(-0.5 * dt);
    auto += dt * 0.28; /* rad/s */
  }
  const yaw = auto + uYaw, pitch = 0.5 + uPitch;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const R = c.width * 0.33; /* keeps the whole shape inside the canvas */
  g.clearRect(0, 0, c.width, c.height);
  const p = pts.map(([x, y, z], i) => {
    const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;       /* turn around the vertical axis */
    const y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;      /* tilt towards the viewer */
    const s = CAMERA / (CAMERA - z2);                         /* perspective: near points are larger */
    return { i, x: c.width / 2 + x1 * s * R, y: c.height / 2 + y1 * s * R, z: z2, s };
  }).sort((m, n) => m.z - n.z);                               /* painter's algorithm */
  for (const q of p) {
    const depth = (q.z + 1.3) / 2.6, w = 26 * q.s * (0.62 + 0.5 * depth);
    g.globalAlpha = 0.2 + 0.8 * Math.pow(depth, 1.25);        /* far points fade */
    g.drawImage(atlas, ((q.i * 7 + 3) % GLYPHS.length) * cs, (q.i % 5 > 1 ? 1 : 0) * cs, cs, cs, q.x - w / 2, q.y - w / 2, w, w);
  }
  g.globalAlpha = 1;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* 5. GRAB AND DRAG. Mouse turns both ways; touch only sideways (touch-action: pan-y keeps the page scrollable). */
const K = 0.011; /* radians per pixel */
c.addEventListener("pointerdown", (e) => { held = true; vYaw = vPitch = 0; lx = e.clientX; ly = e.clientY; lt = e.timeStamp; c.setPointerCapture(e.pointerId); c.style.cursor = "grabbing"; });
c.addEventListener("pointermove", (e) => {
  if (!held) return;
  const dx = e.clientX - lx, dy = e.clientY - ly, s = Math.max(0.001, (e.timeStamp - lt) / 1000);
  lx = e.clientX; ly = e.clientY; lt = e.timeStamp;
  uYaw += dx * K; vYaw = vYaw * 0.6 + ((dx * K) / s) * 0.4;
  if (e.pointerType === "mouse") { uPitch = Math.max(-1.2, Math.min(1.2, uPitch - dy * K)); vPitch = vPitch * 0.6 - ((dy * K) / s) * 0.4; }
});
const release = (e) => { if (!held) return; held = false; c.style.cursor = "grab"; if (e.timeStamp - lt > 120) vYaw = vPitch = 0; vYaw = Math.max(-6, Math.min(6, vYaw)); vPitch = Math.max(-6, Math.min(6, vPitch)); };
c.addEventListener("pointerup", release); c.addEventListener("pointercancel", release);
</script>
```
