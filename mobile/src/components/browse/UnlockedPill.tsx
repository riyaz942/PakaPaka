import { useEffect } from 'react';
import { Text } from 'react-native';
import Animated, {
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { Icon } from '@/components/common/Icon';
import { SHAKE_SPRING, soft } from '@/constants/motion';
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
    // Kicked once after the pill lands: the lock sways and settles.
    tilt.value = withDelay(200, withSpring(0, { ...SHAKE_SPRING, velocity: -300 }));
  }, [reducedMotion, tilt]);

  const lockStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${tilt.value}deg` }] }));

  return (
    <Animated.View
      testID={testID}
      entering={reducedMotion ? undefined : soft(ZoomIn)}
      className="flex-row items-center gap-[4px] rounded-radius-full bg-brand-soft px-space-sm py-[3px]">
      <Animated.View style={lockStyle}>
        <Icon name="locked" size={12} strokeWidth={2.4} className="text-brand-text" />
      </Animated.View>
      <Text className="text-overline font-ui-bold text-brand-text">Unlocked</Text>
    </Animated.View>
  );
}
