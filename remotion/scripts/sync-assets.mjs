/* Copies the project's real brand assets into the video workspace, byte for byte:
   the official mark (public/logo.svg) and the site's own fonts (src/app/fonts).
   Nothing is redrawn or approximated. Run: bun run video:sync */
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { deflateSync, crc32 } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const out = join(root, "remotion", "public");
mkdirSync(join(out, "fonts"), { recursive: true });

copyFileSync(join(root, "public", "logo.svg"), join(out, "logo.svg"));
for (const f of [
  "quicksand-latin-400-normal.woff2",
  "quicksand-latin-500-normal.woff2",
  "quicksand-latin-600-normal.woff2",
  "quicksand-latin-700-normal.woff2",
  "jetbrains-mono-latin-400-normal.woff2",
  "jetbrains-mono-latin-500-normal.woff2",
]) {
  copyFileSync(join(root, "src", "app", "fonts", f), join(out, "fonts", f));
}
/* a 256 px film-grain tile (greyscale PNG, deterministic), tiled and stepped per frame by the compositions */
function png(width, height, gray) {
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width + 1)] = 0;
    gray.copy(raw, y * (width + 1) + 1, y * width, (y + 1) * width);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; /* bit depth */
  ihdr[9] = 0; /* greyscale */
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
let seed = 46630;
const next = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const gray = Buffer.alloc(256 * 256);
for (let i = 0; i < gray.length; i++) gray[i] = Math.round(128 + (next() + next() + next() - 1.5) * 90);
writeFileSync(join(out, "grain.png"), png(256, 256, gray));

console.log("synced logo.svg, 6 font files and grain.png into remotion/public");
