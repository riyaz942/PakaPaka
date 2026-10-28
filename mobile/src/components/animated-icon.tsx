import { useState } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { getSemanticColors } from '@/constants/semantic-colors';
import { usePaintedColorScheme } from '@/hooks/use-painted-color-scheme';

const INITIAL_SCALE_FACTOR = Dimensions.get('screen').height / 90;
const DURATION = 600;
const LIGHT_SPLASH_BACKGROUND = '#FCF2E5';

/**
 * Fades the native splash colour out once JS has mounted, so the handoff from
 * the launch screen into the app is one continuous surface rather than a flash.
 *
 * The fill must stay equal to `app.json`'s `expo-splash-screen` background for
 * the scheme in play. Light is the app icon's own cream, so the icon art has no
 * visible edge; dark is v2 `background`. Raw hex because this is a StyleSheet
 * colour, the documented exception.
 */
export function AnimatedSplashOverlay() {
  const [visible, setVisible] = useState(true);
  const scheme = usePaintedColorScheme();
  const backgroundColor =
    scheme === 'light' ? LIGHT_SPLASH_BACKGROUND : getSemanticColors(scheme).background;

  if (!visible) return null;

  const splashKeyframe = new Keyframe({
    0: {
      transform: [{ scale: INITIAL_SCALE_FACTOR }],
      opacity: 1,
    },
    20: {
      opacity: 1,
    },
    70: {
      opacity: 0,
      easing: Easing.elastic(0.7),
    },
    100: {
      opacity: 0,
      transform: [{ scale: 1 }],
      easing: Easing.elastic(0.7),
    },
  });

  return (
    <Animated.View
      entering={splashKeyframe.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      })}
      style={[styles.backgroundSolidColor, { backgroundColor }]}
    />
  );
}

const styles = StyleSheet.create({
  backgroundSolidColor: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
});
