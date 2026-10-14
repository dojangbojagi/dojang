import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { C, FONT } from '../../lib/theme';
import { SPR_HERO, SPR_STAMP, fadeIn } from '../../lib/motion';

function CredRow({ label, value, frame, fps, delay, highlight = false }: {
  label: string; value: string; frame: number; fps: number; delay: number; highlight?: boolean;
}) {
  const spr = spring({ fps, frame: frame - delay * fps, config: SPR_HERO, durationInFrames: 18 });
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '13px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: interpolate(spr, [0, 0.2], [0, 1]), transform: `translateX(${interpolate(spr, [0, 1], [-18, 0])}px)` }}>
      <span style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: '0.16em', color: C.textDim, textTransform: 'uppercase', width: 150, flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: highlight ? FONT.display : FONT.mono, fontSize: highlight ? 16 : 13, fontWeight: highlight ? 700 : 400, color: highlight ? C.gold : C.text, letterSpacing: highlight ? '-0.01em' : '0.03em' }}>{value}</span>
    </div>
  );
}

function Seal({ frame, fps, delay }: { frame: number; fps: number; delay: number }) {
  const spr = spring({ fps, frame: frame - delay * fps, config: SPR_STAMP, durationInFrames: 20 });
  const ripple = interpolate(frame, [delay * fps + 8, delay * fps + 34], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'relative', width: 58, height: 58, transform: `scale(${interpolate(spr, [0, 1], [0.2, 1])})`, opacity: interpolate(spr, [0, 0.15], [0, 1]), flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1.5px solid ${C.gold}`, transform: `scale(${1 + ripple * 1.8})`, opacity: (1 - ripple) * 0.45 }} />
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `radial-gradient(circle,#9B1230 0%,${C.burgundy} 55%,#3A0010 100%)`, border: `1.5px solid ${C.gold}`, boxShadow: `0 0 26px rgba(184,26,52,0.7),inset 0 1px 0 rgba(255,255,255,0.18)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M5 11 L9.5 15.5 L17 7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
    </div>
  );
}

function Panel({ frame, fps }: { frame: number; fps: number }) {
  const panelSpr = spring({ fps, frame, config: SPR_HERO, durationInFrames: 22 });
  const width = interpolate(panelSpr, [0, 1], [0, 780]);
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 780, overflow: 'hidden' }}>
      <div style={{ width, overflow: 'hidden' }}>
        <div style={{ width: 780, background: `linear-gradient(155deg,${C.ink700} 0%,${C.ink850} 100%)`, borderRadius: 22, border: '1px solid rgba(255,255,255,0.12)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(184,26,52,0.22), 0 48px 96px -24px rgba(0,0,0,0.98), 0 0 80px -10px rgba(109,0,26,0.42)', padding: '32px 40px 28px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, left: 24, right: 24, height: 1, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26, opacity: fadeIn(frame, fps, 0.08, 0.3) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="18" height="18" viewBox="0 0 18 18"><polygon points="9,1.5 16,5.5 16,12.5 9,16.5 2,12.5 2,5.5" fill="none" stroke={C.gold} strokeWidth="1.2" /><polygon points="9,5.5 13,8 13,11 9,13.5 5,11 5,8" fill={C.burgundy} /></svg>
              <span style={{ fontFamily: FONT.mono, fontSize: 11, fontWeight: 500, letterSpacing: '0.18em', color: C.gold, textTransform: 'uppercase' }}>DOJANG · Lending Eligibility</span>
            </div>
            <span style={{ fontFamily: FONT.mono, fontSize: 10, color: C.textDim, letterSpacing: '0.1em' }}>chain:46630</span>
          </div>
          <CredRow label="Policy" value="POLICY 03 — PROOF-GATED" frame={frame} fps={fps} delay={0.18} highlight />
          <CredRow label="Requires" value="BOJAGI proof · witness ≥ 1,000 units" frame={frame} fps={fps} delay={0.36} />
          <CredRow label="Gates" value="Supply · Collateral · Borrow" frame={frame} fps={fps} delay={0.54} />
          <CredRow label="Status" value="ELIGIBLE" frame={frame} fps={fps} delay={0.86} highlight />
          <div style={{ marginTop: 26, display: 'flex', alignItems: 'center', gap: 20, opacity: fadeIn(frame, fps, 3.0, 0.3) }}>
            <Seal frame={frame} fps={fps} delay={3.0} />
            <div>
              <div style={{ fontFamily: FONT.mono, fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', color: '#fff', textTransform: 'uppercase' }}>Credential Valid</div>
              <div style={{ fontFamily: FONT.mono, fontSize: 10, color: C.textDim, marginTop: 4, letterSpacing: '0.08em' }}>testnet · identity concealed · proof required next</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LP03_Dojang() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const atmOp = interpolate(frame, [0, fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div style={{ position: 'absolute', inset: 0, background: C.ink1000, overflow: 'hidden' }}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.9 }}>
        {Array.from({ length: 6 }, (_, row) => Array.from({ length: 10 }, (_, col) => {
          const x = col * 92 + (row % 2 === 0 ? 0 : 46), y = row * 80;
          return <polygon key={`${row}-${col}`} points={`${x + 26},${y} ${x + 52},${y + 14} ${x + 52},${y + 40} ${x + 26},${y + 54} ${x},${y + 40} ${x},${y + 14}`} fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth="1" />;
        })).flat()}
      </svg>
      <div style={{ position: 'absolute', inset: 0, opacity: atmOp, pointerEvents: 'none', background: `radial-gradient(55% 45% at 50% 108%, rgba(109,0,26,0.68) 0%, transparent 65%)` }} />

      <div style={{ position: 'absolute', left: 72, top: '50%', transform: 'translateY(-50%)', width: 280, opacity: fadeIn(frame, fps, 0.05, 0.4) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 22, height: 1.5, background: C.gold, borderRadius: 1 }} />
          <span style={{ fontFamily: FONT.mono, fontSize: 10, fontWeight: 500, letterSpacing: '0.22em', color: C.gold, textTransform: 'uppercase' }}>02 · DOJANG</span>
        </div>
        <div style={{
          fontFamily: FONT.display, fontSize: 64, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 0.94, textTransform: 'uppercase',
          transform: `translateY(${interpolate(spring({ fps, frame: frame - 0.08 * fps, config: SPR_HERO, durationInFrames: 22 }), [0, 1], [30, 0])}px)`,
          opacity: fadeIn(frame, fps, 0.08, 0.45),
        }}>
          <span style={{ color: C.text }}>ELIGIBLE,</span><br /><span style={{ color: C.gold }}>NOT EXPOSED.</span>
        </div>
        <div style={{ marginTop: 22, fontFamily: FONT.mono, fontSize: 11, color: C.textDim, textTransform: 'uppercase', lineHeight: 1.7, letterSpacing: '0.1em', opacity: fadeIn(frame, fps, 0.55, 0.45) }}>
          Credential checked<br />Holder stays private
        </div>
      </div>

      <div style={{ position: 'absolute', right: 72, top: '50%', transform: 'translateY(-50%)' }}>
        <Panel frame={frame} fps={fps} />
      </div>
    </div>
  );
}
