import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { getSemanticColors } from '@/constants/semantic-colors';
import { usePaintedColorScheme } from '@/hooks/use-painted-color-scheme';
import { cn } from '@/utils/cn';

type GoalRingProps = {
  variant: 'small' | 'large' | 'hero';
  percent: number;
  accessibilityLabel?: string;
};

const SIZE: Record<GoalRingProps['variant'], number> = {
  small: 32,
  large: 56,
  hero: 160,
};

const FONT_SIZE: Record<GoalRingProps['variant'], number> = {
  small: 8,
  large: 14,
  hero: 34,
};

/** Band thickness, from the spec's 104px ring with an 80px well. */
const STROKE_RATIO = 0.115;

/**
 * Daily goal ring: one jade arc filling a surface-elevated track — no gradient
 * stops, because the ring measures a single thing.
 *
 * Percent is unclamped above 100. Past the goal the arc closes and the ring
 * gains a jade halo plus a BEATEN kicker (large and hero only; the 32px session
 * variant has no room) — overshoot is the good part, so it is celebrated rather
 * than flagged. The a11y value raises `max` alongside `now` so screen readers
 * announce the true overshoot percent, never a capped one.
 */
export function GoalRing({ variant, percent, accessibilityLabel }: GoalRingProps) {
  // SVG stroke props take raw colours, so the track and arc read the hex mirror
  // of the palette rather than a NativeWind class.
  const colors = getSemanticColors(usePaintedColorScheme());
  const size = SIZE[variant];
  const displayPercent = Math.round(Math.max(0, percent));
  const beaten = displayPercent >= 100;
  const label = accessibilityLabel ?? `Goal ${displayPercent} percent`;

  const strokeWidth = Math.max(3, Math.round(size * STROKE_RATIO));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const swept = (Math.min(displayPercent, 100) / 100) * circumference;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: Math.max(100, displayPercent), now: displayPercent }}
      style={{ width: size, height: size }}
      className="items-center justify-center rounded-radius-full">
      {beaten ? (
        <View
          testID="goal-ring-halo"
          pointerEvents="none"
          className="absolute -inset-1 rounded-radius-full border-4 border-brand-soft-strong"
        />
      ) : null}

      <Svg
        width={size}
        height={size}
        // Absolute so the percent label centres on the ring; rotated so the arc
        // starts at 12 o'clock rather than 3 o'clock.
        style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.surfaceElevated}
          strokeWidth={strokeWidth}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.brand}
          strokeWidth={strokeWidth}
          strokeDasharray={`${swept} ${circumference}`}
        />
      </Svg>

      <Text
        style={{ fontSize: FONT_SIZE[variant] }}
        className={cn('font-ui-extrabold', beaten ? 'text-brand-text' : 'text-primary')}>
        {`${displayPercent}%`}
      </Text>

      {beaten && variant !== 'small' ? (
        <Text
          testID="goal-ring-beaten-kicker"
          className="text-overline font-ui-bold uppercase tracking-[0.06em] text-brand-text">
          Beaten
        </Text>
      ) : null}
    </View>
  );
}
