import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { C, FONT } from '../lib/theme';
import { SPR_HERO, SPR_SNAP, fadeIn } from '../lib/motion';

function DotGrid() {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.15 }}>
      <defs>
        <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill={C.textDim} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dots)" />
    </svg>
  );
}

function Word({
  text, frame, fps, delay, size, color = '#ffffff',
  weight = 700, tracking = '-0.035em',
}: {
  text: string; frame: number; fps: number; delay: number;
  size: number; color?: string; weight?: number; tracking?: string;
}) {
  const f = frame - delay * fps;
  const spr = spring({ fps, frame: f, config: SPR_HERO, durationInFrames: 28 });
  const y    = interpolate(spr, [0, 1], [50, 0]);
  const blur = interpolate(spr, [0, 1], [8, 0]);
  const op   = interpolate(f, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <div style={{
      fontFamily: FONT.display,
      fontSize: size, fontWeight: weight,
      letterSpacing: tracking,
      color,
      transform: `translateY(${y}px)`,
      opacity: op,
      filter: blur > 0.5 ? `blur(${blur}px)` : 'none',
      lineHeight: 1,
      textTransform: 'uppercase',
      display: 'inline-block',
    }}>
      {text}
    </div>
  );
}

function Rule({ frame, fps, delay }: { frame: number; fps: number; delay: number }) {
  const spr = spring({ fps, frame: frame - delay * fps, config: SPR_SNAP, durationInFrames: 16 });
  return (
    <div style={{
      width: spr * 280,
      height: 2,
      background: `linear-gradient(90deg, ${C.gold}, rgba(184,26,52,0.3))`,
      borderRadius: 1,
    }} />
  );
}

function BrandMark({ frame, fps }: { frame: number; fps: number }) {
  const op = fadeIn(frame, fps, 0.08, 0.5);
  return (
    <div style={{ position: 'absolute', top: 52, left: 72, display: 'flex', alignItems: 'center', gap: 12, opacity: op }}>
      <svg width="26" height="26" viewBox="0 0 26 26">
        <polygon points="13,2 23,8 23,18 13,24 3,18 3,8"
          fill="none" stroke={C.gold} strokeWidth="1.4" />
        <polygon points="13,7 19,10.5 19,15.5 13,19 7,15.5 7,10.5"
          fill={C.burgundy} />
      </svg>
      <span style={{
        fontFamily: FONT.mono, fontSize: 11, fontWeight: 500,
        letterSpacing: '0.2em', color: C.textMuted, textTransform: 'uppercase',
      }}>GYEVO</span>
    </div>
  );
}

function ChainLabel({ frame, fps }: { frame: number; fps: number }) {
  const op = fadeIn(frame, fps, 0.55, 0.5);
  return (
    <div style={{ position: 'absolute', bottom: 52, right: 72, opacity: op, display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.celadon, boxShadow: `0 0 8px ${C.celadon}` }} />
      <span style={{
        fontFamily: FONT.mono, fontSize: 11, fontWeight: 400,
        letterSpacing: '0.12em', color: C.textDim, textTransform: 'uppercase',
      }}>Robinhood Chain · Private Protocol</span>
    </div>
  );
}

export function Hook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const atmOp = interpolate(frame, [0, fps * 0.7], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // bass-hit flash frame 0
  const flash = interpolate(frame, [0, 3, 10], [0.08, 0.0, 0.0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: C.ink1000,
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        position: 'absolute', inset: 0, background: `rgba(184,26,52,${flash})`, pointerEvents: 'none',
      }} />
      <DotGrid />

      {/* deep burgundy glow — much stronger */}
      <div style={{
        position: 'absolute', inset: 0, opacity: atmOp, pointerEvents: 'none',
        background: `
          radial-gradient(65% 55% at 50% 100%, rgba(109,0,26,0.75) 0%, transparent 65%),
          radial-gradient(45% 35% at 50% 120%, rgba(168,24,58,0.5) 0%, transparent 55%)
        `,
      }} />

      <BrandMark frame={frame} fps={fps} />
      <ChainLabel frame={frame} fps={fps} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, zIndex: 1 }}>
        <Word text="PROVE"        frame={frame} fps={fps} delay={0}    size={148} />
        <div style={{ marginTop: -14 }}>
          <Word text="ELIGIBILITY." frame={frame} fps={fps} delay={0.1}  size={148} />
        </div>
        <div style={{ marginTop: 32 }}>
          <Rule frame={frame} fps={fps} delay={0.48} />
        </div>
        <div style={{ marginTop: 24 }}>
          <Word
            text="NOT IDENTITY."
            frame={frame} fps={fps} delay={0.62}
            size={32} color={C.textMuted} weight={600} tracking="0.1em"
          />
        </div>
      </div>
    </div>
  );
}
