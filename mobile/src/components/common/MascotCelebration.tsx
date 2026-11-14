import { Image } from 'expo-image';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { SPRING } from '@/constants/motion';
import { useReducedMotion } from '@/data/hooks/useReducedMotion';

export type MascotPose = 'goal-achieved' | 'yay';

const POSES = {
  'goal-achieved': {
    source: require('@/assets/images/mascot/alpi-goal-achieved.png'),
    width: 160,
    height: 138,
  },
  yay: {
    source: require('@/assets/images/mascot/alpi-yay.png'),
    width: 128,
    height: 134,
  },
} as const;

const CONFETTI_COLORS = [
  'bg-content-radical',
  'bg-content-kanji',
  'bg-content-vocabulary',
  'bg-content-grammar',
  'bg-brand-600',
  'bg-srs-guru',
];
const CONFETTI_COUNT = 18;

type MascotCelebrationProps = {
  pose: MascotPose;
};

/**
 * Alpi celebrates a finished session: jumps in with a squash, then bobs while a
 * one-shot confetti burst falls behind. Reduced motion shows the still pose.
 */
export function MascotCelebration({ pose }: MascotCelebrationProps) {
  const { reducedMotion } = useReducedMotion();
  const { source, width, height } = POSES[pose];

  const image = (
    <Image
      testID="mascot-celebration"
      source={source}
      style={{ width, height }}
      contentFit="contain"
      accessible
      accessibilityLabel="Alpi the alpaca cheering"
    />
  );

  if (reducedMotion) {
    return image;
  }

  return (
    <View className="items-center justify-center" style={{ width: width * 2, height }}>
      {Array.from({ length: CONFETTI_COUNT }, (_, i) => (
        <ConfettiPiece key={i} index={i} />
      ))}
      <Bouncing>{image}</Bouncing>
    </View>
  );
}

function Bouncing({ children }: { children: React.ReactNode }) {
  const translateY = useSharedValue(60);
  const scaleX = useSharedValue(0.6);
  const scaleY = useSharedValue(0.6);

  useEffect(() => {
    // Jump in, land with a squash, then keep a gentle hop going.
    translateY.value = withSequence(
      withSpring(0, SPRING),
      withDelay(
        300,
        withRepeat(
          withSequence(
            withTiming(-10, { duration: 360, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 360, easing: Easing.in(Easing.quad) }),
          ),
          -1,
        ),
      ),
    );
    scaleX.value = withSequence(
      withTiming(1.15, { duration: 260 }),
      withSpring(1, SPRING),
    );
    scaleY.value = withSequence(
      withTiming(0.85, { duration: 260 }),
      withSpring(1, SPRING),
    );
  }, [translateY, scaleX, scaleY]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scaleX: scaleX.value },
      { scaleY: scaleY.value },
    ],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

function ConfettiPiece({ index }: { index: number }) {
  const progress = useSharedValue(0);

  // Spread the pieces evenly around the upper half, with a little jitter.
  const angle = Math.PI + (Math.PI * (index + 0.5)) / CONFETTI_COUNT;
  const distance = 90 + (index % 3) * 30;
  const dx = Math.cos(angle) * distance;
  const dy = Math.sin(angle) * distance;
  const spin = (index % 2 === 0 ? 1 : -1) * (180 + index * 20);

  useEffect(() => {
    progress.value = withDelay(
      150 + (index % 4) * 40,
      withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }),
    );
  }, [progress, index]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p === 0 ? 0 : 1 - p * p,
      transform: [
        { translateX: dx * p },
        // Burst up and out, then gravity pulls the piece down.
        { translateY: dy * p + 140 * p * p },
        { rotate: `${spin * p}deg` },
      ],
    };
  });

  return (
    <Animated.View
      className={`absolute h-2.5 w-1.5 rounded-sm ${CONFETTI_COLORS[index % CONFETTI_COLORS.length]}`}
      style={style}
    />
  );
}
