import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { C, FONT } from '../../lib/theme';
import { SPR_SNAP, fadeIn } from '../../lib/motion';
import { HexIrisMask, HexIrisEdge } from '../../lib/hex-iris';

// First-second impact: the hex iris cracks open directly onto the claim.
export function LP01_ColdOpen() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const irisProgress = interpolate(frame, [0, 0.62 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: (x) => 1 - Math.pow(1 - x, 2.4) });
  const titleSpr = spring({ fps, frame: frame - 0.08 * fps, config: SPR_SNAP, durationInFrames: 16 });
  const flash = interpolate(frame, [0, 3, 10], [1, 0.4, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div style={{ position: 'absolute', inset: 0, background: C.ink1000, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(45% 55% at 50% 50%, rgba(184,26,52,0.55) 0%, transparent 70%)`, opacity: interpolate(frame, [0, 0.5 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }} />

      <HexIrisMask progress={irisProgress} maxR={1500} fill={C.ink1000} />
      <HexIrisEdge progress={Math.min(irisProgress * 1.1, 1)} maxR={1500} opacity={interpolate(irisProgress, [0, 0.1, 1], [0, 1, 0])} />

      <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: flash * 0.5, mixBlendMode: 'screen', pointerEvents: 'none' }} />

      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          fontFamily: FONT.display, fontSize: 118, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 0.92, textTransform: 'uppercase', textAlign: 'center',
          opacity: interpolate(titleSpr, [0, 0.15], [0, 1]), transform: `scale(${interpolate(titleSpr, [0, 1], [0.92, 1])})`,
        }}>
          <span style={{ color: '#fff' }}>PRIVATE</span><br />
          <span style={{ color: C.gold }}>LENDING.</span>
        </div>
        <div style={{ marginTop: 26, opacity: fadeIn(frame, fps, 0.55, 0.35) }}>
          <span style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: '0.24em', color: C.textMuted, textTransform: 'uppercase' }}>Powered by DOJANG · BOJAGI</span>
        </div>
      </div>
    </div>
  );
}
