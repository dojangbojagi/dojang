import React from 'react';
import { Composition } from 'remotion';
import { MotionTestComposition } from './MotionTest';

export function Root() {
  return (
    <>
      <Composition
        id="GyevoMotionTest"
        component={MotionTestComposition}
        durationInFrames={210}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
    </>
  );
}
