import React from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';

import { soft, softSlow, STAGGER_MS } from '@/constants/motion';
import { useReducedMotion } from '@/data/hooks/useReducedMotion';

type FadeSlideInProps = {
  children: React.ReactNode;
  /** Stagger index — each step delays entry by STAGGER_MS. */
  index?: number;
  /** Enter on the calmer fill spring instead of the standard one. */
  slow?: boolean;
  /** Also fade and slide away when removed (dismissable cards). */
  exit?: boolean;
  className?: string;
};

/**
 * Entrance wrapper: content fades in and slides up on mount, staggered by
 * `index`; with `exit`, it also leaves the same way. Renders a plain View when
 * reduced motion is active.
 */
export function FadeSlideIn({
  children,
  index = 0,
  slow = false,
  exit = false,
  className,
}: FadeSlideInProps) {
  const { reducedMotion } = useReducedMotion();

  if (reducedMotion) {
    return <View className={className}>{children}</View>;
  }

  return (
    <Animated.View
      className={className}
      entering={(slow ? softSlow : soft)(FadeInDown.delay(index * STAGGER_MS))}
      exiting={exit ? soft(FadeOutUp) : undefined}>
      {children}
    </Animated.View>
  );
}
