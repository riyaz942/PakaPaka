import React, { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Icon } from '@/components/common/Icon';
import { soft, SPRING } from '@/constants/motion';
import { useReducedMotion } from '@/data/hooks/useReducedMotion';

type DisclosureProps = {
  label: string;
  children: ReactNode;
  /** Open on first render. Details sections default to collapsed. */
  defaultExpanded?: boolean;
  testID: string;
};

/**
 * Collapsed-by-default section for the details scroll (FR71): the page stays a
 * single vertical scroll, with dense reference blocks tucked behind a tap
 * rather than moved to another screen.
 */
export function Disclosure({
  label,
  children,
  defaultExpanded = false,
  testID,
}: DisclosureProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  // The chevron turns and the content fades in; both snap under reduced motion.
  const { reducedMotion } = useReducedMotion();
  const rotation = useSharedValue(expanded ? 90 : 0);
  useEffect(() => {
    const target = expanded ? 90 : 0;
    rotation.value = reducedMotion
      ? target
      : withSpring(target, SPRING);
  }, [expanded, reducedMotion, rotation]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View className="mt-4" testID={testID}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        testID={`${testID}-toggle`}
        className="min-h-[44px] flex-row items-center gap-space-xs">
        <Animated.View style={chevronStyle}>
          <Icon name="chevron" size={14} strokeWidth={2.4} className="text-muted" />
        </Animated.View>
        <Text className="text-overline font-ui-bold uppercase tracking-[0.12em] text-faint">
          {label}
        </Text>
      </Pressable>
      {expanded ? (
        <Animated.View
          testID={`${testID}-content`}
          entering={reducedMotion ? undefined : soft(FadeIn)}>
          {children}
        </Animated.View>
      ) : null}
    </View>
  );
}
