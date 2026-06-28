import { Text, View } from 'react-native';

type CognitiveLoadRingProps = {
  variant: 'small' | 'large';
  percent: number;
  accessibilityLabel?: string;
};

const SIZE: Record<CognitiveLoadRingProps['variant'], number> = {
  small: 32,
  large: 56,
};

export function CognitiveLoadRing({ variant, percent, accessibilityLabel }: CognitiveLoadRingProps) {
  const size = SIZE[variant];
  const clamped = Math.min(100, Math.max(0, percent));
  const label = accessibilityLabel ?? `Cognitive load ${clamped} percent`;
  const fontSize = variant === 'small' ? 8 : 12;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      style={{ width: size, height: size }}
      className="items-center justify-center rounded-full border-2 border-ring-start">
      <Text style={{ fontSize }} className="font-semibold text-ring-start">
        {`${clamped}%`}
      </Text>
    </View>
  );
}
