import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/data/hooks/useReducedMotion';

type ProgressFillProps = {
  /** 0–100. */
  percent: number;
  /** Fill colour and shape, e.g. "h-full rounded-radius-full bg-brand-500". */
  className: string;
  /** Wait before filling, so a list of bars can fill one after the other. */
  delayMs?: number;
  testID?: string;
};

/**
 * The coloured part of a progress bar. It fills from where it was to
 * `percent`; at once under reduced motion.
 */
export function ProgressFill({ percent, className, delayMs = 0, testID }: ProgressFillProps) {
  const { reducedMotion } = useReducedMotion();
  const width = useSharedValue(reducedMotion ? percent : 0);

  useEffect(() => {
    width.value = reducedMotion
      ? percent
      : withDelay(delayMs, withTiming(percent, { duration: 600, easing: Easing.out(Easing.cubic) }));
  }, [width, reducedMotion, percent, delayMs]);

  const style = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return <Animated.View testID={testID} className={className} style={style} />;
}
