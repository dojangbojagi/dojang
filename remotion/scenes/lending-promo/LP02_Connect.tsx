import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { C, FONT } from '../../lib/theme';
import { SPR_HERO, SPR_SNAP, fadeIn } from '../../lib/motion';

const ADDR = '0x7f3a…c2e4';

function useTyped(text: string, frame: number, fps: number, startSec: number, cps: number) {
  const chars = Math.floor(Math.max(0, frame - startSec * fps) / fps * cps);
  return text.slice(0, Math.min(chars, text.length));
}

function Cursor({ frame }: { frame: number }) {
  const vis = Math.floor(frame / 16) % 2 === 0;
  return <span style={{ display: 'inline-block', width: 2, height: '1.1em', background: vis ? C.gold : 'transparent', marginLeft: 2, verticalAlign: 'text-bottom' }} />;
}

export function LP02_Connect() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const atmOp = fadeIn(frame, fps, 0, 0.4);
  const typed = useTyped(ADDR, frame, fps, 0.15, 30);
  const done = typed.length >= ADDR.length;

  const fieldSpr = spring({ fps, frame: frame - 0.1 * fps, config: SPR_HERO, durationInFrames: 20 });
  const badgeSpr = spring({ fps, frame: frame - 1.05 * fps, config: SPR_SNAP, durationInFrames: 16 });
  const dotPulse = 0.6 + 0.4 * Math.sin(frame * 0.2);

  return (
    <div style={{ position: 'absolute', inset: 0, background: C.ink1000, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: atmOp, pointerEvents: 'none', background: `radial-gradient(55% 45% at 50% 100%, rgba(109,0,26,0.6) 0%, transparent 65%)` }} />

      <div style={{ position: 'absolute', left: 72, top: 96, opacity: fadeIn(frame, fps, 0.02, 0.35) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 20, height: 1.5, background: C.gold }} />
          <span style={{ fontFamily: FONT.mono, fontSize: 10, fontWeight: 500, letterSpacing: '0.22em', color: C.gold, textTransform: 'uppercase' }}>01 · CONNECT WALLET</span>
        </div>
        <div style={{ fontFamily: FONT.display, fontSize: 52, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 0.96, textTransform: 'uppercase', color: C.text }}>
          ONE WALLET.<br /><span style={{ color: C.gold }}>ZERO IDENTITY LEAK.</span>
        </div>
      </div>

      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          opacity: interpolate(fieldSpr, [0, 0.15], [0, 1]), transform: `translateY(${interpolate(fieldSpr, [0, 1], [30, 0])}px)`,
          width: '100%', maxWidth: 760,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 28px', background: 'rgba(21,15,18,0.88)', border: `1px solid ${done ? 'rgba(184,26,52,0.55)' : C.lineStrong}`, borderRadius: 20, boxShadow: done ? '0 0 0 1px rgba(184,26,52,0.2), inset 0 1px 0 rgba(255,255,255,0.08), 0 40px 90px -20px rgba(0,0,0,0.9)' : 'inset 0 1px 0 rgba(255,255,255,0.05)' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: done ? C.gold : C.textDim, boxShadow: done ? `0 0 ${dotPulse * 10}px ${C.gold}` : 'none' }} />
            <span style={{ fontFamily: FONT.mono, fontSize: 20, letterSpacing: '0.04em', color: done ? C.text : C.textMuted, flex: 1 }}>
              {typed}{!done && <Cursor frame={frame} />}
            </span>
            <div style={{ transform: `scale(${interpolate(badgeSpr, [0, 1], [0.4, 1])})`, opacity: interpolate(badgeSpr, [0, 0.2], [0, 1]), flexShrink: 0 }}>
              <div style={{ padding: '7px 18px', borderRadius: 999, background: 'rgba(109,0,26,0.65)', border: '1px solid rgba(184,26,52,0.65)', boxShadow: '0 0 16px rgba(109,0,26,0.5)', fontFamily: FONT.mono, fontSize: 12, fontWeight: 500, letterSpacing: '0.14em', color: C.gold, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>CONNECTED</div>
            </div>
          </div>
          <div style={{ marginTop: 16, textAlign: 'center', opacity: fadeIn(frame, fps, 1.5, 0.4) }}>
            <span style={{ fontFamily: FONT.mono, fontSize: 11, color: C.textDim, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Robinhood Chain · 46630 · demonstration</span>
          </div>
        </div>
      </div>
    </div>
  );
}
