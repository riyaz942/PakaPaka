import { Text, View } from 'react-native';

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
  large: 12,
  hero: 28,
};

function ringBandClasses(percent: number): { border: string; text: string } {
  // ≥90 (including all overshoot) gets the cyan "complete" treatment — proud,
  // not alarming (UX-DR2).
  if (percent >= 90) {
    return { border: 'border-ring-complete', text: 'text-ring-complete' };
  }
  if (percent >= 70) {
    return { border: 'border-ring-end', text: 'text-ring-end' };
  }
  if (percent >= 40) {
    return { border: 'border-ring-mid', text: 'text-ring-mid' };
  }
  return { border: 'border-ring-start', text: 'text-ring-start' };
}

/**
 * Daily goal ring. Percent is unclamped above 100 — overshoot is shown raw
 * with a `+N%` badge (large/hero; the 32px small variant has no room). The
 * a11y value raises `max` alongside `now` so screen readers announce the true
 * overshoot percent, never a capped one.
 */
export function GoalRing({ variant, percent, accessibilityLabel }: GoalRingProps) {
  const size = SIZE[variant];
  const displayPercent = Math.round(Math.max(0, percent));
  const overshoot = displayPercent > 100 ? displayPercent - 100 : 0;
  const label = accessibilityLabel ?? `Goal ${displayPercent} percent`;
  const fontSize = FONT_SIZE[variant];
  const borderWidth = variant === 'hero' ? 'border-4' : 'border-2';
  const band = ringBandClasses(displayPercent);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: Math.max(100, displayPercent), now: displayPercent }}
      style={{ width: size, height: size }}
      className={`items-center justify-center rounded-full ${borderWidth} ${band.border}`}>
      <Text style={{ fontSize }} className="font-semibold text-primary">
        {`${displayPercent}%`}
      </Text>
      {overshoot > 0 && variant !== 'small' ? (
        <View
          testID="goal-ring-overshoot-badge"
          className="absolute -right-space-xs -top-space-xs rounded-radius-full bg-ring-complete px-space-xs py-[1px]">
          <Text className="text-caption font-semibold text-white">{`+${overshoot}%`}</Text>
        </View>
      ) : null}
    </View>
  );
}

export { ringBandClasses };
