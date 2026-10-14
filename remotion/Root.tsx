import React from 'react';
import { Composition } from 'remotion';
import { MotionTestComposition } from './MotionTest';
import { FullFilmComposition } from './FullFilm';
import { LendingPromoComposition, LENDING_PROMO_DURATION } from './LendingPromo';

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
      <Composition
        id="GyevoLendingPromo"
        component={LendingPromoComposition}
        durationInFrames={LENDING_PROMO_DURATION}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
      <Composition
        id="GyevoLaunchFinal"
        component={FullFilmComposition}
        durationInFrames={870}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
    </>
  );
}
