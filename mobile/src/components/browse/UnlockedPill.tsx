import { useEffect } from 'react';
import { Text } from 'react-native';
import Animated, {
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from '@/components/common/Icon';
import { useReducedMotion } from '@/data/hooks/useReducedMotion';

/**
 * Takes the place of a passage's "N to go" pill the first time Browse shows it
 * open: the pill pops in, then the lock wobbles once.
 */
export function UnlockedPill({ testID }: { testID?: string }) {
  const { reducedMotion } = useReducedMotion();
  const tilt = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    tilt.value = withDelay(
      250,
      withSequence(
        withTiming(-14, { duration: 70 }),
        withTiming(12, { duration: 90 }),
        withTiming(-8, { duration: 80 }),
        withTiming(0, { duration: 80 }),
      ),
    );
  }, [reducedMotion, tilt]);

  const lockStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${tilt.value}deg` }] }));

  return (
    <Animated.View
      testID={testID}
      entering={reducedMotion ? undefined : ZoomIn.springify().damping(11)}
      className="flex-row items-center gap-[4px] rounded-radius-full bg-brand-soft px-space-sm py-[3px]">
      <Animated.View style={lockStyle}>
        <Icon name="locked" size={12} strokeWidth={2.4} className="text-brand-text" />
      </Animated.View>
      <Text className="text-overline font-ui-bold text-brand-text">Unlocked</Text>
    </Animated.View>
  );
}
