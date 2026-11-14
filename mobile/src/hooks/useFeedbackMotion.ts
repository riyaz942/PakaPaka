import { useEffect } from 'react';
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { SHAKE_SPRING, SPRING } from '@/constants/motion';
import { useReducedMotion } from '@/data/hooks/useReducedMotion';

/**
 * The three answer-feedback motions. Each one has its own shape so the learner
 * can feel the verdict before reading it:
 * - `shake` — close, try again: the field sways side to side and settles.
 * - `thud`  — wrong: the field sinks a little and comes back up.
 * - `pop`   — correct: a small swell and release.
 *
 * Each is a spring kicked with a velocity from rest, so it moves out and comes
 * home on the same curve as every other motion in the app.
 */
export type FeedbackMotion = 'shake' | 'thud' | 'pop';

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
      translateX.value = withSpring(0, { ...SHAKE_SPRING, velocity: -300 });
    } else if (motion === 'thud') {
      translateY.value = withSpring(0, { ...SPRING, velocity: 260 });
      scale.value = withSpring(1, { ...SPRING, velocity: -0.5 });
    } else {
      scale.value = withSpring(1, { ...SPRING, velocity: 1.1 });
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
