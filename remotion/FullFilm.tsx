import React from 'react';
import { AbsoluteFill, Audio, Sequence, useCurrentFrame, interpolate, staticFile } from 'remotion';
import { C } from './lib/theme';
import { FontLoader } from './lib/fonts';
import { Scene01_Intro }      from './scenes/Scene01_Intro';
import { Scene02_Credential } from './scenes/Scene02_Credential';
import { Scene03_Bojagi }     from './scenes/Scene03_Bojagi';
import { Scene04_Auth }       from './scenes/Scene04_Auth';
import { Scene05_Evidence }   from './scenes/Scene05_Evidence';
import { Scene06_Finale }     from './scenes/Scene06_Finale';

// Frame boundaries at 30fps
const CUT = {
  s1: 0,    // Scene 1: 0–90   (0–3s)   Intro / wallet in motion
  s2: 88,   // Scene 2: 88–268 (≈3–9s)  Dojang credential assembly
  s3: 268,  // Scene 3: 268–508 (≈9–17s) BOJAGI ZK proof
  s4: 508,  // Scene 4: 508–658 (≈17–22s) Authorization split
  s5: 658,  // Scene 5: 658–778 (≈22–26s) Deployment evidence
  s6: 778,  // Scene 6: 778–870 (≈26–29s) Brand finale
  end:870,
};

// Hard-cut dissolve: brief black at every scene boundary
function CutFlash({ atFrame, dur=8 }: { atFrame: number; dur?: number }) {
  const frame = useCurrentFrame();
  const op = frame >= atFrame && frame < atFrame + dur
    ? interpolate(frame, [atFrame, atFrame+2, atFrame+dur-2, atFrame+dur], [0,1,1,0], { extrapolateLeft:'clamp', extrapolateRight:'clamp' })
    : 0;
  return op > 0 ? <div style={{ position:'absolute', inset:0, background:C.ink1000, opacity:op, zIndex:20, pointerEvents:'none' }}/> : null;
}

function FilmInner() {
  return (
    <AbsoluteFill style={{ background: C.ink1000 }}>
      <Audio src={staticFile('audio/launch.mp3')} />

      <Sequence from={CUT.s1} durationInFrames={CUT.s2 - CUT.s1 + 10}>
        <AbsoluteFill><Scene01_Intro /></AbsoluteFill>
      </Sequence>

      <Sequence from={CUT.s2} durationInFrames={CUT.s3 - CUT.s2 + 10}>
        <AbsoluteFill><Scene02_Credential /></AbsoluteFill>
      </Sequence>

      <Sequence from={CUT.s3} durationInFrames={CUT.s4 - CUT.s3 + 10}>
        <AbsoluteFill><Scene03_Bojagi /></AbsoluteFill>
      </Sequence>

      <Sequence from={CUT.s4} durationInFrames={CUT.s5 - CUT.s4 + 10}>
        <AbsoluteFill><Scene04_Auth /></AbsoluteFill>
      </Sequence>

      <Sequence from={CUT.s5} durationInFrames={CUT.s6 - CUT.s5 + 10}>
        <AbsoluteFill><Scene05_Evidence /></AbsoluteFill>
      </Sequence>

      <Sequence from={CUT.s6} durationInFrames={CUT.end - CUT.s6}>
        <AbsoluteFill><Scene06_Finale /></AbsoluteFill>
      </Sequence>

      {/* Cut flashes between scenes */}
      <CutFlash atFrame={CUT.s2} />
      <CutFlash atFrame={CUT.s3} />
      <CutFlash atFrame={CUT.s4} />
      <CutFlash atFrame={CUT.s5} />
      <CutFlash atFrame={CUT.s6} />
    </AbsoluteFill>
  );
}

export function FullFilmComposition() {
  return (
    <FontLoader>
      <FilmInner />
    </FontLoader>
  );
}
