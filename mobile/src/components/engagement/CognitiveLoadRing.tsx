import { Text, View } from 'react-native';

type CognitiveLoadRingProps = {
  variant: 'small' | 'large' | 'hero';
  percent: number;
  accessibilityLabel?: string;
};

const SIZE: Record<CognitiveLoadRingProps['variant'], number> = {
  small: 32,
  large: 56,
  hero: 144,
};

const FONT_SIZE: Record<CognitiveLoadRingProps['variant'], number> = {
  small: 8,
  large: 12,
  hero: 28,
};

function ringBandClasses(percent: number): { border: string; text: string } {
  const clamped = Math.min(100, Math.max(0, percent));
  if (clamped >= 90) {
    return { border: 'border-ring-complete', text: 'text-ring-complete' };
  }
  if (clamped >= 70) {
    return { border: 'border-ring-end', text: 'text-ring-end' };
  }
  if (clamped >= 40) {
    return { border: 'border-ring-mid', text: 'text-ring-mid' };
  }
  return { border: 'border-ring-start', text: 'text-ring-start' };
}

export function CognitiveLoadRing({ variant, percent, accessibilityLabel }: CognitiveLoadRingProps) {
  const size = SIZE[variant];
  const clamped = Math.min(100, Math.max(0, percent));
  const label = accessibilityLabel ?? `Cognitive load ${clamped} percent`;
  const fontSize = FONT_SIZE[variant];
  const borderWidth = variant === 'hero' ? 'border-4' : 'border-2';
  const band = ringBandClasses(clamped);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      style={{ width: size, height: size }}
      className={`items-center justify-center rounded-full ${borderWidth} ${band.border}`}>
      <Text style={{ fontSize }} className="font-semibold text-primary">
        {`${clamped}%`}
      </Text>
    </View>
  );
}

export { ringBandClasses };
