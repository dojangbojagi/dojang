import { interpolate, spring, type SpringConfig } from 'remotion';

// Canonical spring presets for the film
export const SPR_HERO: SpringConfig = { damping: 26, mass: 1, stiffness: 180, overshootClamping: false };
export const SPR_CARD: SpringConfig = { damping: 30, mass: 1, stiffness: 220, overshootClamping: false };
export const SPR_SNAP: SpringConfig = { damping: 40, mass: 0.8, stiffness: 320, overshootClamping: true };
export const SPR_STAMP: SpringConfig = { damping: 20, mass: 1.2, stiffness: 260, overshootClamping: false };

/** Ease-out cubic-bezier approximated via interpolate extrapolateClamp */
export function easeOut(v: number): number {
  return interpolate(v, [0, 1], [0, 1], {
    easing: (x) => 1 - Math.pow(1 - x, 3),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

export function fadeIn(frame: number, fps: number, delay = 0, duration = 0.4): number {
  return interpolate(frame, [delay * fps, (delay + duration) * fps], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: (x) => 1 - Math.pow(1 - x, 2),
  });
}

export function slideY(frame: number, fps: number, delay = 0, duration = 0.5, from = 40): number {
  const spr = spring({ fps, frame: frame - delay * fps, config: SPR_HERO });
  return interpolate(spr, [0, 1], [from, 0]);
}

export function scaleIn(frame: number, fps: number, delay = 0): number {
  return spring({ fps, frame: frame - delay * fps, config: SPR_CARD });
}
