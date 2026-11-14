import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { SPRING } from '@/constants/motion';
import { useReducedMotion } from '@/data/hooks/useReducedMotion';

const DOT_DELAY_MS = 150;

function Dot({ index }: { index: number }) {
  const { reducedMotion } = useReducedMotion();
  const lift = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    lift.value = withDelay(
      index * DOT_DELAY_MS,
      withRepeat(
        withSequence(withSpring(-4, SPRING), withSpring(0, SPRING)),
        -1,
      ),
    );
  }, [index, lift, reducedMotion]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));

  return <Animated.View className="h-[7px] w-[7px] rounded-radius-full bg-muted" style={style} />;
}

/**
 * The reply is on its way but no text has arrived yet: three dots in an
 * assistant bubble, bouncing one after the other (still under reduced motion).
 */
export function TypingDots() {
  return (
    <View
      accessible
      accessibilityLabel="Waiting for a reply"
      testID="typing-dots"
      style={{ borderBottomLeftRadius: 5 }}
      className="mb-space-sm flex-row items-center gap-[5px] self-start rounded-radius-lg border border-border bg-surface px-space-md py-space-md">
      {[0, 1, 2].map((index) => (
        <Dot key={index} index={index} />
      ))}
    </View>
  );
}
