import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { C, FONT } from '../../lib/theme';
import { SPR_HERO, SPR_STAMP, fadeIn } from '../../lib/motion';
import { HexIrisMask, HexIrisEdge } from '../../lib/hex-iris';

const CX = 960, CY = 540;
const HINGE_R = 198;
const FLAP_W = 240, FLAP_L = 232;
const FOLD_START = -132; // standing open, tipped back away from viewer
const FOLD_END = -2;     // lying flat, wrapped over the bundle

// A single cloth plate, hinged at a hex vertex, folding inward over the witness.
function Flap({ i, frame, fps }: { i: number; frame: number; fps: number }) {
  const a = (i * 60 - 90) * (Math.PI / 180);
  const hx = CX + HINGE_R * Math.cos(a);
  const hy = CY + HINGE_R * Math.sin(a);
  const delay = 0.55 + i * 0.12;
  const spr = spring({ fps, frame: frame - delay * fps, config: SPR_HERO, durationInFrames: 36 });
  const foldDeg = interpolate(spr, [0, 1], [FOLD_START, FOLD_END]);
  const settle = interpolate(frame, [(delay + 0.9) * fps, (delay + 1.3) * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        position: 'absolute', left: hx - FLAP_W / 2, top: hy, width: FLAP_W, height: FLAP_L,
        transformOrigin: '50% 0%', transformStyle: 'preserve-3d',
        transform: `rotateZ(${i * 60}deg) rotateX(${foldDeg}deg)`,
        opacity: interpolate(spr, [0, 0.12], [0, 1]),
      }}
    >
      <div style={{
        width: '100%', height: '100%',
        clipPath: 'polygon(50% 0%, 100% 28%, 82% 100%, 18% 100%, 0% 28%)',
        background: `linear-gradient(175deg, rgba(247,243,244,0.20) 0%, rgba(184,26,52,0.55) 42%, rgba(109,0,26,0.88) 75%, rgba(14,10,12,0.96) 100%)`,
        boxShadow: `0 0 ${30 + settle * 20}px rgba(109,0,26,0.45), inset 0 1px 0 rgba(255,255,255,0.14)`,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.22,
          background: 'repeating-linear-gradient(64deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 1px, transparent 1px, transparent 13px)',
        }} />
        <div style={{ position: 'absolute', top: 0, left: '18%', right: '18%', height: 1, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)' }} />
      </div>
    </div>
  );
}

// The concealed private witness, visible only before the cloth converges.
function WitnessChip({ frame, fps }: { frame: number; fps: number }) {
  const spr = spring({ fps, frame: frame - 0.08 * fps, config: SPR_HERO, durationInFrames: 18 });
  const hideOp = interpolate(frame, [0.45 * fps, 0.85 * fps], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{
      position: 'absolute', left: CX, top: CY, transform: 'translate(-50%,-50%)',
      opacity: interpolate(spr, [0, 0.2], [0, 1]) * hideOp, zIndex: 3,
    }}>
      <div style={{
        padding: '10px 20px', borderRadius: 999, background: 'rgba(3,2,3,0.88)',
        border: `1px solid rgba(184,26,52,0.55)`, display: 'flex', alignItems: 'center', gap: 10,
        boxShadow: '0 0 26px rgba(109,0,26,0.5)', whiteSpace: 'nowrap',
      }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.gold, boxShadow: `0 0 8px ${C.gold}` }} />
        <span style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: '0.08em', color: C.textMuted }}>witness ≥ 1,000 units · ████████</span>
      </div>
    </div>
  );
}

// Verified payload revealed once the hex iris cracks the sealed bundle open.
function VerifiedSeal({ frame, fps }: { frame: number; fps: number }) {
  const startSec = 4.55;
  if (frame < startSec * fps - 2) return null;
  const spr = spring({ fps, frame: frame - startSec * fps, config: SPR_STAMP, durationInFrames: 18 });
  const ringPulse = interpolate(frame, [startSec * fps, (startSec + 1) * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: CX, top: CY, transform: 'translate(-50%,-50%)', textAlign: 'center', zIndex: 1 }}>
      {[0, 0.18, 0.36].map((off, i) => {
        const p = Math.max(0, ringPulse - off);
        return (
          <div key={i} style={{
            position: 'absolute', left: '50%', top: '50%', borderRadius: '50%',
            width: 40 + p * 420, height: 40 + p * 420, transform: 'translate(-50%,-50%)',
            border: `1px solid rgba(184,26,52,${(1 - p) * 0.55})`, pointerEvents: 'none',
          }} />
        );
      })}
      <div style={{
        position: 'relative', transform: `scale(${interpolate(spr, [0, 1], [0.6, 1])})`,
        opacity: interpolate(spr, [0, 0.2], [0, 1]),
      }}>
        <svg width="54" height="54" viewBox="0 0 22 22" style={{ filter: `drop-shadow(0 0 18px ${C.gold})` }}>
          <path d="M5 11 L9.5 15.5 L17 7" stroke={C.gold} strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div style={{ marginTop: 14, fontFamily: FONT.mono, fontSize: 13, fontWeight: 500, letterSpacing: '0.2em', color: '#fff', textTransform: 'uppercase' }}>π Verified</div>
        <div style={{ marginTop: 6, fontFamily: FONT.mono, fontSize: 10, color: C.textDim, letterSpacing: '0.1em' }}>Noir · UltraHonk · Policy 03</div>
      </div>
    </div>
  );
}

export function LP04_BojagiFold() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const atmOp = interpolate(frame, [0, fps * 1.2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const sealedAt = 3.3 * fps;
  const irisProgress = interpolate(frame, [sealedAt, sealedAt + 1.15 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: (x) => 1 - Math.pow(1 - x, 2.2) });
  const bundleOp = interpolate(frame, [sealedAt, sealedAt + 0.5 * fps], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const label = frame < sealedAt ? 'PRIVATE WITNESS' : frame < sealedAt + 20 ? 'ZK PROOF SEALED' : 'VERIFIED · NOT REVEALED';

  return (
    <div style={{ position: 'absolute', inset: 0, background: C.ink1000, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: atmOp, pointerEvents: 'none', background: `radial-gradient(48% 42% at 50% 50%, rgba(109,0,26,0.55) 0%, transparent 68%)` }} />

      {/* Reveal layer (gated by the hex mask below) + the mask that hides it until the seal cracks */}
      <VerifiedSeal frame={frame} fps={fps} />
      <div style={{ zIndex: 3, position: 'absolute', inset: 0 }}>
        <HexIrisMask progress={irisProgress} cx={CX} cy={CY} maxR={900} fill={C.ink1000} />
      </div>
      <div style={{ zIndex: 4, position: 'absolute', inset: 0 }}>
        <HexIrisEdge progress={Math.min(irisProgress * 1.15, 1)} cx={CX} cy={CY} maxR={900} opacity={interpolate(irisProgress, [0, 0.08, 0.9, 1], [0, 1, 1, 0])} />
      </div>

      {/* The fold itself, always visible above the mask, fading out as the seal cracks */}
      <div style={{ zIndex: 5, position: 'absolute', inset: 0, opacity: bundleOp, perspective: 1400 }}>
        <WitnessChip frame={frame} fps={fps} />
        {Array.from({ length: 6 }, (_, i) => <Flap key={i} i={i} frame={frame} fps={fps} />)}
      </div>

      {/* Section label */}
      <div style={{ zIndex: 10, position: 'absolute', left: 72, top: 96, opacity: fadeIn(frame, fps, 0.05, 0.4) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 20, height: 1.5, background: C.gold }} />
          <span style={{ fontFamily: FONT.mono, fontSize: 10, fontWeight: 500, letterSpacing: '0.22em', color: C.gold, textTransform: 'uppercase' }}>03 · BOJAGI</span>
        </div>
        <div style={{ fontFamily: FONT.display, fontSize: 52, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 0.96, textTransform: 'uppercase', color: C.text }}>
          PROVE MORE.<br /><span style={{ color: C.gold }}>REVEAL LESS.</span>
        </div>
      </div>

      {/* State caption beneath the bundle */}
      <div style={{ zIndex: 10, position: 'absolute', left: '50%', top: CY + 260, transform: 'translateX(-50%)', opacity: fadeIn(frame, fps, 0.3, 0.3) }}>
        <span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: '0.2em', color: C.textDim, textTransform: 'uppercase' }}>{label}</span>
      </div>
    </div>
  );
}
