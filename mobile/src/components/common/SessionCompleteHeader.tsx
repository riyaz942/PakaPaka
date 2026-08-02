import React from 'react';
import { Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { Icon } from '@/components/common/Icon';
import { useReducedMotion } from '@/data/hooks/useReducedMotion';

type SessionCompleteHeaderProps = {
  title: string;
  /** The one-line tally under the title, e.g. "6 reviews · 4 min". */
  caption?: string;
  testID?: string;
};

/**
 * The jade check disc both session summaries open with (spec screen 13). The
 * disc is the celebration — it lands with a spring unless the learner asked for
 * reduced motion, and it never carries a number of its own.
 */
export function SessionCompleteHeader({ title, caption, testID }: SessionCompleteHeaderProps) {
  const { reducedMotion } = useReducedMotion();

  const disc = (
    <View
      testID="session-complete-disc"
      className="h-[70px] w-[70px] items-center justify-center rounded-radius-full bg-brand-600 shadow-cta-glow">
      <Icon name="correct" size={36} strokeWidth={2.6} className="text-on-primary" />
    </View>
  );

  return (
    <View className="items-center" testID={testID}>
      {reducedMotion ? disc : <Animated.View entering={ZoomIn.springify().damping(12)}>{disc}</Animated.View>}

      <Text
        accessibilityRole="header"
        className="mt-space-md text-center text-title-lg font-ui-extrabold text-primary">
        {title}
      </Text>

      {caption ? (
        <Text className="mt-space-xs text-center text-caption font-ui-medium text-muted">
          {caption}
        </Text>
      ) : null}
    </View>
  );
}
