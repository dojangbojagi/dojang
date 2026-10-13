import { Easing, interpolate } from "remotion";
import { FPS } from "./theme";

export const sec = (s: number) => Math.round(s * FPS);

/* the site's own ease (--lp-ease) and a symmetric one for camera moves */
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
export const easeIn = Easing.bezier(0.7, 0, 0.84, 0);

/* progress 0..1 of time t between a and b (seconds), eased */
export function prog(t: number, a: number, b: number, ease: (x: number) => number = easeOut): number {
  return interpolate(t, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
}

export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/* a tiny deterministic pseudo-random, so a render is identical every time */
export function rand(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
