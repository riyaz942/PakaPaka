import React from 'react';
import { View } from 'react-native';

import { ChoiceCard } from '@/components/common/ChoiceCard';
import { DAILY_LESSON_ITEMS_BY_INTENSITY } from '@/config/constants';
import type { SessionIntensity } from '@/data/user/sessionIntensity.types';

type IntensityOption = {
  value: SessionIntensity;
  title: string;
  badge?: string;
};

/** Lightest → heaviest. Sublabels are derived so they can never drift from the maps. */
const INTENSITY_OPTIONS: IntensityOption[] = [
  { value: 'light', title: 'Light' },
  {
    value: 'relaxed',
    title: 'Relaxed',
    badge: 'Recommended for new learners',
  },
  { value: 'steady', title: 'Steady' },
  { value: 'intense', title: 'Intense' },
  { value: 'immersive', title: 'Immersive' },
];

function sublabelFor(intensity: SessionIntensity): string {
  return `${DAILY_LESSON_ITEMS_BY_INTENSITY[intensity]} new items/day`;
}

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
    <View accessibilityRole="radiogroup" testID={testID} className="gap-space-sm">
      {INTENSITY_OPTIONS.map((option) => (
        <ChoiceCard
          key={option.value}
          title={option.title}
          description={sublabelFor(option.value)}
          badgeLabel={option.badge}
          selected={selectedIntensity === option.value}
          onPress={() => onSelect(option.value)}
          testID={testID ? `${testID}-${option.value}` : undefined}
        />
      ))}
    </View>
  );
}
