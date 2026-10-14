import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { C, FONT } from '../../lib/theme';
import { SPR_HERO, SPR_SNAP, fadeIn } from '../../lib/motion';

function HexMark({ frame, fps }: { frame: number; fps: number }) {
  const SIZE = 120;
  const cx = SIZE / 2, cy = SIZE / 2, R = 48, r = 29;
  const outerPts = Array.from({ length: 6 }, (_, i) => { const a = (i * 60 - 90) * Math.PI / 180; return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }; });
  const innerPts = Array.from({ length: 6 }, (_, i) => { const a = (i * 60 - 90) * Math.PI / 180; return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }; });
  const outerPath = outerPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';
  const innerPath = innerPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';
  const outerSpr = spring({ fps, frame, config: SPR_HERO, durationInFrames: 16 });
  const innerSpr = spring({ fps, frame: frame - 0.08 * fps, config: SPR_HERO, durationInFrames: 16 });
  const glow = 0.7 + 0.3 * Math.sin(frame * 0.14);
  return (
    <svg width={SIZE} height={SIZE} style={{ overflow: 'visible', filter: `drop-shadow(0 0 ${26 * glow}px rgba(184,26,52,0.6))` }}>
      <path d={outerPath} fill="none" stroke={C.gold} strokeWidth="2" opacity={outerSpr} />
      <path d={innerPath} fill={C.burgundy} opacity={innerSpr} />
      <circle cx={cx} cy={cy} r="4" fill={C.gold} opacity={spring({ fps, frame: frame - 0.15 * fps, config: SPR_SNAP, durationInFrames: 10 })} />
    </svg>
  );
}

function StatFlash({ frame, fps }: { frame: number; fps: number }) {
  const op = interpolate(frame, [0, 0.12 * fps, 0.62 * fps, 0.82 * fps], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  if (op <= 0.001) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <div style={{ fontFamily: FONT.display, fontSize: 150, fontWeight: 700, color: '#fff', lineHeight: 0.9, letterSpacing: '-0.03em' }}>10/10</div>
      <div style={{ fontFamily: FONT.mono, fontSize: 13, color: C.gold, letterSpacing: '0.22em', textTransform: 'uppercase', marginTop: 10 }}>Contracts Source-Verified</div>
    </div>
  );
}

export function LP06_Outro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const brandStart = 0.78 * fps;
  const bf = Math.max(0, frame - brandStart);
  const bgOp = interpolate(frame, [0, fps * 0.3], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div style={{ position: 'absolute', inset: 0, background: C.ink1000, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: bgOp, background: `radial-gradient(50% 50% at 50% 50%, rgba(109,0,26,0.5) 0%, transparent 65%)` }} />

      <StatFlash frame={frame} fps={fps} />

      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: fadeIn(bf, fps, 0, 0.3) }}>
        <HexMark frame={bf} fps={fps} />
        <div style={{ marginTop: 20, fontFamily: FONT.display, fontSize: 60, fontWeight: 700, letterSpacing: '-0.03em', color: '#fff' }}>GYEVO</div>
        <div style={{ marginTop: 10, fontFamily: FONT.display, fontSize: 18, fontWeight: 600, letterSpacing: '0.04em', color: C.gold, textTransform: 'uppercase' }}>Private Eligibility. Public Execution.</div>
        <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 10, opacity: fadeIn(bf, fps, 0.35, 0.4) }}>
          <div style={{ width: 32, height: 1, background: `linear-gradient(90deg, transparent, ${C.gold})` }} />
          <span style={{ fontFamily: FONT.mono, fontSize: 11, color: C.textDim, letterSpacing: '0.16em', textTransform: 'uppercase' }}>Robinhood Chain Testnet · Demonstration</span>
          <div style={{ width: 32, height: 1, background: `linear-gradient(90deg, ${C.gold}, transparent)` }} />
        </div>
      </div>
    </div>
  );
}
