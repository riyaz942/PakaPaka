import { useEffect } from 'react';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Circle } from 'react-native-svg';

import { FILL_SPRING } from '@/constants/motion';
import { useReducedMotion } from '@/data/hooks/useReducedMotion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type AnimatedArcProps = {
  size: number;
  radius: number;
  strokeWidth: number;
  circumference: number;
  /** Arc length to draw, 0…circumference. */
  swept: number;
  color: string;
};

/**
 * The filled arc of a ring. It sweeps from where it was to `swept`, so a ring
 * fills on first show and grows as progress comes in. Drawn at once under
 * reduced motion.
 */
export function AnimatedArc({ size, radius, strokeWidth, circumference, swept, color }: AnimatedArcProps) {
  const { reducedMotion } = useReducedMotion();
  const progress = useSharedValue(reducedMotion ? swept : 0);

  useEffect(() => {
    progress.value = reducedMotion
      ? swept
      : withSpring(swept, FILL_SPRING);
  }, [progress, reducedMotion, swept]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference - progress.value,
  }));

  return (
    <AnimatedCircle
      testID="ring-arc"
      cx={size / 2}
      cy={size / 2}
      r={radius}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeDasharray={`${circumference} ${circumference}`}
      animatedProps={animatedProps}
    />
  );
}
