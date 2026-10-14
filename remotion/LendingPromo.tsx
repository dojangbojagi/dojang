import React from 'react';
import { AbsoluteFill, Audio, Sequence, useCurrentFrame, interpolate, staticFile } from 'remotion';
import { C } from './lib/theme';
import { FontLoader } from './lib/fonts';
import { LP01_ColdOpen } from './scenes/lending-promo/LP01_ColdOpen';
import { LP02_Connect } from './scenes/lending-promo/LP02_Connect';
import { LP03_Dojang } from './scenes/lending-promo/LP03_Dojang';
import { LP04_BojagiFold } from './scenes/lending-promo/LP04_BojagiFold';
import { LP05_Lending } from './scenes/lending-promo/LP05_Lending';
import { LP06_Outro } from './scenes/lending-promo/LP06_Outro';

// Frame boundaries at 30fps — 23.0s total
const CUT = {
  s1: 0,    // Cold open — PRIVATE LENDING.            0.0–1.33s
  s2: 40,   // Connect wallet                           1.33–5.0s
  s3: 150,  // Dojang eligibility                       5.0–9.67s
  s4: 290,  // Bojagi fold — hero proof moment           9.67–15.67s
  s5: 470,  // Protected lending — hero product moment  15.67–20.67s
  s6: 620,  // Outro                                    20.67–23.0s
  end: 690,
};

function CutFlash({ atFrame, dur = 8 }: { atFrame: number; dur?: number }) {
  const frame = useCurrentFrame();
  const op = frame >= atFrame && frame < atFrame + dur
    ? interpolate(frame, [atFrame, atFrame + 2, atFrame + dur - 2, atFrame + dur], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 0;
  return op > 0 ? <div style={{ position: 'absolute', inset: 0, background: C.ink1000, opacity: op, zIndex: 20, pointerEvents: 'none' }} /> : null;
}

function FilmInner() {
  return (
    <AbsoluteFill style={{ background: C.ink1000 }}>
      <Audio src={staticFile('audio/lending.mp3')} />

      <Sequence from={CUT.s1} durationInFrames={CUT.s2 - CUT.s1 + 6}>
        <AbsoluteFill><LP01_ColdOpen /></AbsoluteFill>
      </Sequence>

      <Sequence from={CUT.s2} durationInFrames={CUT.s3 - CUT.s2 + 10}>
        <AbsoluteFill><LP02_Connect /></AbsoluteFill>
      </Sequence>

      <Sequence from={CUT.s3} durationInFrames={CUT.s4 - CUT.s3 + 10}>
        <AbsoluteFill><LP03_Dojang /></AbsoluteFill>
      </Sequence>

      <Sequence from={CUT.s4} durationInFrames={CUT.s5 - CUT.s4 + 10}>
        <AbsoluteFill><LP04_BojagiFold /></AbsoluteFill>
      </Sequence>

      <Sequence from={CUT.s5} durationInFrames={CUT.s6 - CUT.s5 + 10}>
        <AbsoluteFill><LP05_Lending /></AbsoluteFill>
      </Sequence>

      <Sequence from={CUT.s6} durationInFrames={CUT.end - CUT.s6}>
        <AbsoluteFill><LP06_Outro /></AbsoluteFill>
      </Sequence>

      <CutFlash atFrame={CUT.s2} />
      <CutFlash atFrame={CUT.s3} />
      <CutFlash atFrame={CUT.s4} />
      <CutFlash atFrame={CUT.s5} />
      <CutFlash atFrame={CUT.s6} />
    </AbsoluteFill>
  );
}

export function LendingPromoComposition() {
  return (
    <FontLoader>
      <FilmInner />
    </FontLoader>
  );
}

export const LENDING_PROMO_DURATION = CUT.end;
