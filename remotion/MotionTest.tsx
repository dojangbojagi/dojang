import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Composition,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { FontLoader } from './lib/fonts';
import { Hook } from './scenes/Hook';
import { Dojang } from './scenes/Dojang';
import { C } from './lib/theme';
import { SPR_HERO } from './lib/motion';

const HOOK_DURATION = 62;   // ~2.07s
const DOJANG_START  = 56;   // hook overlaps into dojang for a clean blend
const TOTAL_FRAMES  = 210;  // exactly 7.0s

// Cross-dissolve blend layer between scenes
function SceneBlend({ startFrame, duration }: { startFrame: number; duration: number }) {
  const frame = useCurrentFrame();
  // transparent before transition, flash black at cut, fade out revealing next scene
  const opacity = frame < startFrame
    ? 0
    : interpolate(frame, [startFrame, startFrame + duration], [1, 0], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      });
  return (
    <div style={{
      position: 'absolute', inset: 0, background: C.ink1000, opacity,
      pointerEvents: 'none', zIndex: 10,
    }} />
  );
}

function MotionTestInner() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: C.ink1000, overflow: 'hidden' }}>
      {/* Audio track */}
      <Audio src={staticFile('audio/motion-test.mp3')} />

      {/* Scene 1: HOOK — plays immediately */}
      <Sequence from={0} durationInFrames={HOOK_DURATION + 12}>
        <AbsoluteFill>
          <Hook />
        </AbsoluteFill>
      </Sequence>

      {/* Scene 2: DOJANG — starts at frame 56, blends over hook */}
      <Sequence from={DOJANG_START} durationInFrames={TOTAL_FRAMES - DOJANG_START}>
        <AbsoluteFill>
          {/* Dojang renders with its own local frame via Sequence */}
          <Dojang />
        </AbsoluteFill>
      </Sequence>

      {/* Cross-dissolve: briefly darken between scenes */}
      <SceneBlend startFrame={DOJANG_START} duration={10} />
    </AbsoluteFill>
  );
}

export function MotionTestComposition() {
  return (
    <FontLoader>
      <MotionTestInner />
    </FontLoader>
  );
}
