import React from 'react';
import { Pressable, type PressableProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { SPRING } from '@/constants/motion';
import { useReducedMotion } from '@/data/hooks/useReducedMotion';


const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressableScaleProps = PressableProps & {
  children?: React.ReactNode;
  className?: string;
};

/**
 * Pressable with a subtle spring scale-down on press. Motion is skipped
 * entirely when reduced motion is active (system or in-app preference).
 */
export function PressableScale({
  children,
  onPressIn,
  onPressOut,
  ...props
}: PressableScaleProps) {
  const { reducedMotion } = useReducedMotion();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...props}
      style={animatedStyle}
      onPressIn={(event) => {
        if (!reducedMotion) {
          scale.value = withSpring(0.97, SPRING);
        }
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        if (!reducedMotion) {
          scale.value = withSpring(1, SPRING);
        }
        onPressOut?.(event);
      }}>
      {children}
    </AnimatedPressable>
  );
}
