import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { getSemanticColors } from '@/constants/semantic-colors';
import { usePaintedColorScheme } from '@/hooks/use-painted-color-scheme';

import { AnimatedArc } from './AnimatedArc';

type AccuracyRingProps = {
  /** First-try accuracy, 0–100. */
  percent: number;
  size?: number;
  testID?: string;
};

/** Band thickness, matching the goal ring's proportions. */
const STROKE_RATIO = 0.115;

/**
 * First-try accuracy as an arc. Drawn like the goal ring but deliberately a
 * separate component: accuracy is a share of a fixed whole, so it clamps at
 * 100 and has no overshoot halo or "beaten" state to celebrate — the jade halo
 * means *goal beaten* everywhere else in the app and must keep meaning that.
 */
export function AccuracyRing({ percent, size = 82, testID }: AccuracyRingProps) {
  // SVG stroke props take raw colours, so the arc reads the hex mirror.
  const colors = getSemanticColors(usePaintedColorScheme());
  const value = Math.round(Math.min(Math.max(percent, 0), 100));

  const strokeWidth = Math.max(3, Math.round(size * STROKE_RATIO));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const swept = (value / 100) * circumference;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`First-try accuracy ${value} percent`}
      accessibilityValue={{ min: 0, max: 100, now: value }}
      testID={testID}
      style={{ width: size, height: size }}
      className="items-center justify-center rounded-radius-full">
      <Svg
        width={size}
        height={size}
        // Rotated so the arc starts at 12 o'clock rather than 3 o'clock.
        style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.surfaceElevated}
          strokeWidth={strokeWidth}
        />
        <AnimatedArc
          size={size}
          radius={radius}
          strokeWidth={strokeWidth}
          circumference={circumference}
          swept={swept}
          color={colors.brand}
        />
      </Svg>

      <Text style={{ fontSize: 20 }} className="font-ui-extrabold text-primary">
        {`${value}%`}
      </Text>
    </View>
  );
}
