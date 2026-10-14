import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { C, FONT } from '../../lib/theme';
import { SPR_HERO, SPR_SNAP, SPR_STAMP, fadeIn } from '../../lib/motion';

function MarketRow({ frame, fps }: { frame: number; fps: number }) {
  const spr = spring({ fps, frame: frame - 0.1 * fps, config: SPR_HERO, durationInFrames: 18 });
  const assets = [
    { sym: 'rUSD2', role: 'Supply asset', val: '100.00' },
    { sym: 'rCOL2', role: 'Collateral asset', val: '10.00' },
  ];
  return (
    <div style={{ display: 'flex', gap: 14, opacity: interpolate(spr, [0, 0.2], [0, 1]), transform: `translateY(${interpolate(spr, [0, 1], [16, 0])}px)` }}>
      {assets.map((a) => (
        <div key={a.sym} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderRadius: 14, background: 'rgba(21,15,18,0.8)', border: `1px solid ${C.lineStrong}` }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: `linear-gradient(155deg,${C.burgundyHi},${C.burgundy})`, border: `1px solid rgba(184,26,52,0.6)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.mono, fontSize: 9, color: C.gold }}>{a.sym[1]}</div>
          <div>
            <div style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: C.text }}>{a.sym}</div>
            <div style={{ fontFamily: FONT.mono, fontSize: 9, color: C.textDim, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{a.role}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function HealthFactor({ frame, fps }: { frame: number; fps: number }) {
  const startSec = 0.55;
  const spr = spring({ fps, frame: frame - startSec * fps, config: SPR_HERO, durationInFrames: 34 });
  const target = 1.82;
  const countT = interpolate(frame, [startSec * fps, (startSec + 1.1) * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: (x) => 1 - Math.pow(1 - x, 3) });
  const val = (countT * target).toFixed(2);
  const barFill = interpolate(countT, [0, 1], [8, 68]);
  const badgeSpr = spring({ fps, frame: frame - (startSec + 1.05) * fps, config: SPR_SNAP, durationInFrames: 16 });

  return (
    <div style={{ opacity: interpolate(spr, [0, 0.12], [0, 1]) }}>
      <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: '0.2em', color: C.textDim, textTransform: 'uppercase', marginBottom: 6 }}>Health Factor</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 20 }}>
        <span style={{ fontFamily: FONT.display, fontSize: 148, fontWeight: 700, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1 }}>{val}<span style={{ fontSize: 64 }}>×</span></span>
        <div style={{ transform: `scale(${interpolate(badgeSpr, [0, 1], [0.5, 1])})`, opacity: interpolate(badgeSpr, [0, 0.2], [0, 1]) }}>
          <div style={{ padding: '9px 22px', borderRadius: 999, background: 'rgba(16,40,24,0.0)', border: `1.5px solid ${C.gold}`, boxShadow: `0 0 22px rgba(184,26,52,0.4)`, fontFamily: FONT.display, fontSize: 18, fontWeight: 700, letterSpacing: '0.04em', color: C.gold, textTransform: 'uppercase' }}>Safe</div>
        </div>
      </div>
      <div style={{ marginTop: 22, width: 560, height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${barFill}%`, borderRadius: 999, background: `linear-gradient(90deg, ${C.burgundy}, ${C.gold})`, boxShadow: `0 0 14px rgba(184,26,52,0.6)` }} />
        <div style={{ position: 'absolute', left: '22%', top: -4, bottom: -4, width: 2, background: 'rgba(255,92,92,0.8)' }} />
      </div>
      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', width: 560 }}>
        <span style={{ fontFamily: FONT.mono, fontSize: 10, color: C.textDim, letterSpacing: '0.1em' }}>1.0× liquidation</span>
        <span style={{ fontFamily: FONT.mono, fontSize: 10, color: C.textDim, letterSpacing: '0.1em' }}>below 1.0× is liquidatable</span>
      </div>
    </div>
  );
}

function BorrowReceipt({ frame, fps }: { frame: number; fps: number }) {
  const startSec = 2.3;
  const spr = spring({ fps, frame: frame - startSec * fps, config: SPR_STAMP, durationInFrames: 20 });
  if (spr < 0.01) return null;
  return (
    <div style={{
      marginTop: 36, display: 'flex', alignItems: 'center', gap: 18, padding: '18px 26px', width: 'fit-content',
      borderRadius: 18, background: 'rgba(21,15,18,0.9)', border: `1px solid rgba(184,26,52,0.45)`,
      boxShadow: `0 0 30px rgba(109,0,26,0.35), inset 0 1px 0 rgba(255,255,255,0.08)`,
      opacity: interpolate(spr, [0, 0.2], [0, 1]), transform: `translateY(${interpolate(spr, [0, 1], [18, 0])}px)`,
    }}>
      <svg width="30" height="30" viewBox="0 0 22 22" style={{ flexShrink: 0 }}>
        <polygon points="11,1.5 19,6 19,16 11,20.5 3,16 3,6" fill="none" stroke={C.gold} strokeWidth="1.3" />
        <path d="M6.5 11 L9.5 14 L15.5 7.5" stroke={C.gold} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div>
        <div style={{ fontFamily: FONT.display, fontSize: 20, fontWeight: 700, color: '#fff' }}>Borrow 3 rUSD2</div>
        <div style={{ fontFamily: FONT.mono, fontSize: 11, color: C.textDim, letterSpacing: '0.08em', marginTop: 3 }}>Protected by Policy 03 proof · verified testnet history</div>
      </div>
    </div>
  );
}

function LifecycleRail({ frame, fps }: { frame: number; fps: number }) {
  const steps = ['Supply', 'Collateral', 'Proof', 'Borrow'];
  const spr = spring({ fps, frame: frame - 1.5 * fps, config: SPR_HERO, durationInFrames: 22 });
  return (
    <div style={{
      position: 'absolute', right: 150, top: '50%', transform: `translateY(-50%) translateX(${interpolate(spr, [0, 1], [24, 0])}px)`,
      opacity: interpolate(spr, [0, 0.25], [0, 1]), display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0,
    }}>
      {steps.map((s, i) => {
        const active = i === steps.length - 1;
        const rowSpr = spring({ fps, frame: frame - (1.6 + i * 0.12) * fps, config: SPR_HERO, durationInFrames: 16 });
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 16, opacity: interpolate(rowSpr, [0, 0.3], [0, 1]) }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: active ? 14 : 9, height: active ? 14 : 9, borderRadius: '50%',
                background: active ? C.gold : 'transparent', border: `1.5px solid ${active ? C.gold : C.lineStrong}`,
                boxShadow: active ? `0 0 16px ${C.gold}` : 'none',
              }} />
              {i < steps.length - 1 && <div style={{ width: 1.5, height: 38, background: 'rgba(255,255,255,0.14)' }} />}
            </div>
            <span style={{
              fontFamily: FONT.mono, fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: i < steps.length - 1 ? 38 : 0,
              color: active ? '#fff' : C.textDim, fontWeight: active ? 700 : 400,
            }}>{s}</span>
          </div>
        );
      })}
    </div>
  );
}

export function LP05_Lending() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const atmOp = interpolate(frame, [0, fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div style={{ position: 'absolute', inset: 0, background: C.ink1000, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: atmOp, pointerEvents: 'none', background: `radial-gradient(60% 50% at 78% 50%, rgba(109,0,26,0.42) 0%, transparent 68%)` }} />
      <svg width="640" height="640" viewBox="0 0 640 640" style={{ position: 'absolute', right: -140, top: '50%', transform: 'translateY(-50%)', opacity: interpolate(atmOp, [0, 1], [0, 0.1]) }}>
        <polygon points="320,20 560,160 560,480 320,620 80,480 80,160" fill="none" stroke={C.gold} strokeWidth="1.5" />
      </svg>
      <LifecycleRail frame={frame} fps={fps} />

      <div style={{ position: 'absolute', left: 72, top: 96, opacity: fadeIn(frame, fps, 0.02, 0.35) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 20, height: 1.5, background: C.gold }} />
          <span style={{ fontFamily: FONT.mono, fontSize: 10, fontWeight: 500, letterSpacing: '0.22em', color: C.gold, textTransform: 'uppercase' }}>04 · LENDING</span>
        </div>
        <div style={{ fontFamily: FONT.display, fontSize: 52, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 0.96, textTransform: 'uppercase', color: C.text }}>
          PROTECTED<br /><span style={{ color: C.gold }}>LENDING.</span>
        </div>
      </div>

      <div style={{ position: 'absolute', left: 72, top: 318 }}>
        <MarketRow frame={frame} fps={fps} />
      </div>

      <div style={{ position: 'absolute', left: 72, top: 420 }}>
        <HealthFactor frame={frame} fps={fps} />
        <BorrowReceipt frame={frame} fps={fps} />
      </div>
    </div>
  );
}
