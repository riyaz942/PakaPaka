import React from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useReducedMotion } from '@/data/hooks/useReducedMotion';

type FadeSlideInProps = {
  children: React.ReactNode;
  /** Stagger index — each step delays entry by 70ms. */
  index?: number;
  /** Entrance duration in ms. */
  duration?: number;
  className?: string;
};

/**
 * Entrance wrapper: content fades in and slides up on mount, staggered by
 * `index`. Renders a plain View when reduced motion is active.
 */
export function FadeSlideIn({ children, index = 0, duration = 320, className }: FadeSlideInProps) {
  const { reducedMotion } = useReducedMotion();

  if (reducedMotion) {
    return <View className={className}>{children}</View>;
  }

  return (
    <Animated.View
      className={className}
      entering={FadeInDown.duration(duration).delay(index * 70)}>
      {children}
    </Animated.View>
  );
}
