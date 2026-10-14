import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { C, FONT } from '../lib/theme';
import { SPR_CARD, SPR_HERO, SPR_STAMP, fadeIn } from '../lib/motion';

function HexGrid() {
  const cells = [];
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 10; col++) {
      const x = col * 72 + (row % 2 === 0 ? 0 : 36);
      const y = row * 62;
      cells.push(
        <polygon
          key={`${row}-${col}`}
          points={`${x+20},${y} ${x+40},${y+10} ${x+40},${y+30} ${x+20},${y+40} ${x},${y+30} ${x},${y+10}`}
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="1"
        />
      );
    }
  }
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 1 }}>
      {cells}
    </svg>
  );
}

function CredField({ label, value, frame, fps, delay, redacted = false, highlight = false }: {
  label: string; value: string; frame: number; fps: number; delay: number;
  redacted?: boolean; highlight?: boolean;
}) {
  const spr = spring({ fps, frame: frame - delay * fps, config: SPR_HERO, durationInFrames: 22 });
  const y = interpolate(spr, [0, 1], [18, 0]);
  const opacity = interpolate(spr, [0, 0.25], [0, 1]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 24,
      padding: '16px 0',
      borderBottom: `1px solid rgba(255,255,255,0.06)`,
      transform: `translateY(${y}px)`, opacity,
    }}>
      <span style={{
        fontFamily: FONT.mono, fontSize: 10, fontWeight: 500,
        letterSpacing: '0.16em', color: C.textDim, textTransform: 'uppercase',
        minWidth: 90, flexShrink: 0,
      }}>{label}</span>
      <span style={{
        fontFamily: redacted ? FONT.mono : FONT.display,
        fontSize: redacted ? 13 : 15,
        fontWeight: highlight ? 700 : 500,
        letterSpacing: redacted ? '0.06em' : '-0.01em',
        color: highlight ? C.gold : (redacted ? C.textMuted : C.text),
      }}>
        {redacted ? (
          <span>
            <span style={{ color: 'rgba(255,255,255,0.15)', letterSpacing: '0.2em' }}>{'· · · · ·'}&nbsp;</span>
            <span style={{ color: C.textMuted }}>.4c2e</span>
          </span>
        ) : value}
      </span>
    </div>
  );
}

function VerificationStamp({ frame, fps, delay }: { frame: number; fps: number; delay: number }) {
  const spr = spring({ fps, frame: frame - delay * fps, config: SPR_STAMP, durationInFrames: 22 });
  const scale = interpolate(spr, [0, 1], [0.3, 1]);
  const opacity = interpolate(spr, [0, 0.2], [0, 1]);
  const ripple = interpolate(frame, [delay * fps + 6, delay * fps + 28], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <div style={{ position: 'relative', width: 64, height: 64, transform: `scale(${scale})`, opacity, flexShrink: 0 }}>
      {/* ripple ring */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        border: `1.5px solid ${C.gold}`,
        transform: `scale(${1 + ripple * 1.6})`,
        opacity: (1 - ripple) * 0.5,
      }} />
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: `radial-gradient(circle, #9B1230 0%, ${C.burgundy} 55%, #3A0010 100%)`,
        border: `1.5px solid ${C.gold}`,
        boxShadow: `0 0 28px rgba(184,26,52,0.65), inset 0 1px 0 rgba(255,255,255,0.18)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M5 12 L10 17 L19 7" stroke="#fff" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

export function Dojang() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardSpr = spring({ fps, frame, config: SPR_CARD, durationInFrames: 26 });
  const cardY  = interpolate(cardSpr, [0, 1], [70, 0]);
  const cardOp = interpolate(cardSpr, [0, 0.15], [0, 1]);

  const atmOp = interpolate(frame, [0, fps * 1.2], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const STAMP_DELAY = 2.2;

  return (
    <div style={{ position: 'absolute', inset: 0, background: C.ink1000, overflow: 'hidden' }}>
      {/* hex grid texture */}
      <HexGrid />

      {/* burgundy atmosphere */}
      <div style={{
        position: 'absolute', inset: 0, opacity: atmOp,
        background: `
          radial-gradient(55% 45% at 50% 108%, rgba(109,0,26,0.65) 0%, transparent 65%),
          radial-gradient(28% 22% at 85% 15%, rgba(168,24,58,0.12) 0%, transparent 60%)
        `,
        pointerEvents: 'none',
      }} />

      {/* ── LEFT PANEL ── */}
      <div style={{
        position: 'absolute', left: 88, top: '50%',
        transform: 'translateY(-50%)',
        width: 320,
      }}>
        {/* eyebrow */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18,
          opacity: fadeIn(frame, fps, 0.05, 0.4),
          transform: `translateX(${interpolate(
            spring({ fps, frame: frame - 0.05 * fps, config: SPR_HERO, durationInFrames: 18 }),
            [0,1],[-20,0]
          )}px)`,
        }}>
          <div style={{ width: 24, height: 1.5, background: C.gold, borderRadius: 1 }} />
          <span style={{
            fontFamily: FONT.mono, fontSize: 10, fontWeight: 500,
            letterSpacing: '0.22em', color: C.gold, textTransform: 'uppercase',
          }}>01 · Dojang</span>
        </div>

        {/* headline */}
        <div style={{
          fontFamily: FONT.display, fontSize: 70, fontWeight: 700,
          letterSpacing: '-0.035em', lineHeight: 0.95,
          textTransform: 'uppercase',
          opacity: fadeIn(frame, fps, 0.08, 0.45),
          transform: `translateY(${interpolate(
            spring({ fps, frame: frame - 0.08 * fps, config: SPR_HERO, durationInFrames: 22 }),
            [0,1],[30,0]
          )}px)`,
        }}>
          <span style={{ color: C.text }}>CRED-<br />ENTIAL</span>
          <br />
          <span style={{ color: C.gold }}>ISSUED</span>
        </div>

        {/* sub-copy */}
        <div style={{
          marginTop: 28,
          fontFamily: FONT.mono, fontSize: 11, fontWeight: 400,
          letterSpacing: '0.1em', color: C.textDim, textTransform: 'uppercase',
          lineHeight: 1.7,
          opacity: fadeIn(frame, fps, 0.55, 0.5),
        }}>
          Policy-based eligibility<br />
          Holder identity concealed
        </div>

        {/* divider */}
        <div style={{
          marginTop: 32, height: 1,
          background: `linear-gradient(90deg, ${C.gold}44, transparent)`,
          width: interpolate(frame, [fps * 0.7, fps * 1.1], [0, 220], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          }),
        }} />
      </div>

      {/* vertical separator */}
      <div style={{
        position: 'absolute', left: '50%', top: '22%', bottom: '22%',
        width: 1,
        background: `linear-gradient(180deg, transparent, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0.08) 70%, transparent)`,
        opacity: fadeIn(frame, fps, 0.3, 0.6),
      }} />

      {/* ── RIGHT PANEL — credential card ── */}
      <div style={{
        position: 'absolute',
        left: '53%', top: '50%',
        width: 600,
        transform: `translate(0, calc(-50% + ${cardY}px))`,
        opacity: cardOp,
      }}>
        <div style={{
          background: `linear-gradient(158deg, ${C.ink700} 0%, ${C.ink850} 100%)`,
          borderRadius: 24,
          border: `1px solid rgba(255,255,255,0.14)`,
          boxShadow: `
            inset 0 1px 0 rgba(255,255,255,0.1),
            0 0 0 1px rgba(184,26,52,0.25),
            0 48px 96px -28px rgba(0,0,0,0.98),
            0 0 80px -12px rgba(109,0,26,0.4)
          `,
          padding: '30px 36px 28px',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* top highlight line */}
          <div style={{
            position: 'absolute', top: 0, left: 24, right: 24, height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)',
          }} />

          {/* card header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 24,
            opacity: fadeIn(frame, fps, 0.08, 0.35),
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <polygon points="10,1.5 18,6 18,14 10,18.5 2,14 2,6"
                  fill="none" stroke={C.gold} strokeWidth="1.3" />
                <polygon points="10,5.5 14.5,8 14.5,12 10,14.5 5.5,12 5.5,8"
                  fill={C.burgundy} />
              </svg>
              <span style={{
                fontFamily: FONT.mono, fontSize: 11, fontWeight: 500,
                letterSpacing: '0.18em', color: C.gold, textTransform: 'uppercase',
              }}>DOJANG</span>
            </div>
            <span style={{
              fontFamily: FONT.mono, fontSize: 10, fontWeight: 400,
              letterSpacing: '0.1em', color: C.textDim,
            }}>v1.0.0</span>
          </div>

          {/* credential fields */}
          <div>
            <CredField label="Policy"   value="POLICY 04 — GOVERNANCE" frame={frame} fps={fps} delay={0.18} highlight />
            <CredField label="Holder"   value="0x7f3a...4c2e"          frame={frame} fps={fps} delay={0.36} redacted />
            <CredField label="Network"  value="Robinhood Chain · 46630" frame={frame} fps={fps} delay={0.54} />
            <CredField label="Status"   value="ACTIVE"                 frame={frame} fps={fps} delay={0.72} highlight />
          </div>

          {/* stamp row */}
          <div style={{ marginTop: 26, display: 'flex', alignItems: 'center', gap: 20 }}>
            <VerificationStamp frame={frame} fps={fps} delay={STAMP_DELAY} />
            <div style={{ opacity: fadeIn(frame, fps, STAMP_DELAY + 0.12, 0.35) }}>
              <div style={{
                fontFamily: FONT.mono, fontSize: 11, fontWeight: 500,
                letterSpacing: '0.14em', color: '#fff', textTransform: 'uppercase',
              }}>Credential Valid</div>
              <div style={{
                fontFamily: FONT.mono, fontSize: 10, fontWeight: 400,
                letterSpacing: '0.08em', color: C.textDim, marginTop: 4,
              }}>testnet · chain 46630 · block #14,837</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
