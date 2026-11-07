import { useEffect } from 'react';
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/data/hooks/useReducedMotion';

/**
 * The three answer-feedback motions. Each one has its own shape so the learner
 * can feel the verdict before reading it:
 * - `shake` — close, try again: a quick side-to-side wobble.
 * - `thud`  — wrong: the field drops a little and settles.
 * - `pop`   — correct: a small spring bounce.
 */
export type FeedbackMotion = 'shake' | 'thud' | 'pop';

const SHAKE_STEP_MS = 45;

/**
 * Plays `motion` each time `trigger` changes. Pass a submit counter as the
 * trigger so a second identical verdict (two typos in a row) plays again; a
 * trigger of 0 means nothing was submitted yet, so nothing plays on mount.
 * Returns a style for an `Animated.View`. Does nothing under reduced motion.
 */
export function useFeedbackMotion(motion: FeedbackMotion | null, trigger: number) {
  const { reducedMotion } = useReducedMotion();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!motion || trigger === 0 || reducedMotion) return;

    if (motion === 'shake') {
      translateX.value = withSequence(
        withTiming(-9, { duration: SHAKE_STEP_MS }),
        withTiming(9, { duration: SHAKE_STEP_MS }),
        withTiming(-6, { duration: SHAKE_STEP_MS }),
        withTiming(6, { duration: SHAKE_STEP_MS }),
        withTiming(-3, { duration: SHAKE_STEP_MS }),
        withTiming(0, { duration: SHAKE_STEP_MS }),
      );
    } else if (motion === 'thud') {
      translateY.value = withSequence(
        withTiming(6, { duration: 90, easing: Easing.out(Easing.quad) }),
        withSpring(0, { damping: 9, stiffness: 260 }),
      );
      scale.value = withSequence(
        withTiming(0.97, { duration: 90 }),
        withSpring(1, { damping: 12, stiffness: 260 }),
      );
    } else {
      scale.value = withSequence(
        withTiming(1.04, { duration: 110, easing: Easing.out(Easing.quad) }),
        withSpring(1, { damping: 8, stiffness: 220 }),
      );
    }
  }, [motion, trigger, reducedMotion, translateX, translateY, scale]);

  return useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));
}
