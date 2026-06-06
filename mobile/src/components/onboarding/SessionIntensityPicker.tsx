import React from 'react';
import { Pressable, Text, View } from 'react-native';

import type { SessionIntensity } from '@/data/user/sessionIntensity.types';
import { cn } from '@/utils/cn';

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
    <View
      accessibilityRole="radiogroup"
      testID={testID}
      className="flex-row gap-3">
      {INTENSITY_OPTIONS.map((option) => {
        const selected = selectedIntensity === option.value;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${option.title}, ${option.sublabel}`}
            onPress={() => onSelect(option.value)}
            testID={testID ? `${testID}-${option.value}` : undefined}
            className={cn(
              'min-h-[44px] min-w-[44px] flex-1 rounded-radius-md bg-surface p-4',
              selected ? 'border-2 border-feedback-info' : 'border border-border',
            )}>
            <Text className="text-body font-semibold text-primary">{option.title}</Text>
            <Text className="mt-1 text-body-sm text-secondary">{option.sublabel}</Text>

            {option.badge ? (
              <View className="mt-2 self-start rounded-radius-sm bg-feedback-correct/15 px-2 py-1">
                <Text className="text-caption text-feedback-correct">{option.badge}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
