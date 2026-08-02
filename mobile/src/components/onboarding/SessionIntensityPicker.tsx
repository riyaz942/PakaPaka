import React from 'react';
import { View } from 'react-native';

import { ChoiceCard } from '@/components/common/ChoiceCard';
import type { SessionIntensity } from '@/data/user/sessionIntensity.types';

type IntensityOption = {
  value: SessionIntensity;
  title: string;
  sublabel: string;
  badge?: string;
};

const INTENSITY_OPTIONS: IntensityOption[] = [
  {
    value: 'relaxed',
    title: 'Relaxed',
    sublabel: '~15 min/day',
    badge: 'Recommended for new learners',
  },
  { value: 'intense', title: 'Intense', sublabel: '~30 min/day' },
];

type SessionIntensityPickerProps = {
  selectedIntensity: SessionIntensity | null;
  onSelect: (intensity: SessionIntensity) => void;
  testID?: string;
};

export function SessionIntensityPicker({
  selectedIntensity,
  onSelect,
  testID,
}: SessionIntensityPickerProps) {
  return (
    <View accessibilityRole="radiogroup" testID={testID} className="flex-row gap-space-sm">
      {INTENSITY_OPTIONS.map((option) => (
        <ChoiceCard
          key={option.value}
          title={option.title}
          description={option.sublabel}
          badgeLabel={option.badge}
          selected={selectedIntensity === option.value}
          onPress={() => onSelect(option.value)}
          testID={testID ? `${testID}-${option.value}` : undefined}
          className="flex-1"
        />
      ))}
    </View>
  );
}
