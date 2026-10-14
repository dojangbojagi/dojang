import React from 'react';
import { C } from './theme';

// GYEVO's signature wipe: a hexagonal aperture (echoes the DOJANG/brand hex mark)
// cut out of a solid field. progress 0 = fully sealed, 1 = fully open.
// Coordinates are real frame pixels (1920x1080) so the hex never distorts.
export function HexIrisMask({ progress, cx = 960, cy = 540, maxR = 1400, rotate = 0, fill = C.ink1000 }: {
  progress: number; cx?: number; cy?: number; maxR?: number; rotate?: number; fill?: string;
}) {
  const r = Math.max(0.0001, progress * maxR);
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = ((i * 60 - 90 + rotate) * Math.PI) / 180;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' L');
  return (
    <svg
      viewBox="0 0 1920 1080"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      <path d={`M0,0 H1920 V1080 H0 Z M${pts} Z`} fill={fill} fillRule="evenodd" />
    </svg>
  );
}

// Thin glowing edge traced around the hex aperture boundary — sells the "seal cracking" moment.
export function HexIrisEdge({ progress, cx = 960, cy = 540, maxR = 1400, rotate = 0, stroke = C.gold, opacity = 1 }: {
  progress: number; cx?: number; cy?: number; maxR?: number; rotate?: number; stroke?: string; opacity?: number;
}) {
  if (progress <= 0.001) return null;
  const r = progress * maxR;
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = ((i * 60 - 90 + rotate) * Math.PI) / 180;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      <polygon points={pts} fill="none" stroke={stroke} strokeWidth={2.2} opacity={opacity} style={{ filter: `drop-shadow(0 0 18px ${stroke})` }} />
    </svg>
  );
}
