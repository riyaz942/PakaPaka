import React from 'react';
import { Pressable, Text, View } from 'react-native';

import type { ItemType } from '@/data/curriculum/itemRepository';
import { cn } from '@/utils/cn';

type TypeOption = {
  value: ItemType;
  label: string;
};

const TYPE_OPTIONS: TypeOption[] = [
  { value: 'radical', label: 'Radicals' },
  { value: 'kanji', label: 'Kanji' },
  { value: 'vocabulary', label: 'Vocabulary' },
  { value: 'grammar', label: 'Grammar' },
];

type CalibrationItemTypePickerProps = {
  selectedType: ItemType;
  onSelect: (type: ItemType) => void;
  testID?: string;
};

export function CalibrationItemTypePicker({
  selectedType,
  onSelect,
  testID,
}: CalibrationItemTypePickerProps) {
  return (
    <View
      accessibilityRole="tablist"
      testID={testID}
      className="flex-row flex-wrap gap-2">
      {TYPE_OPTIONS.map((option) => {
        const selected = selectedType === option.value;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => onSelect(option.value)}
            testID={testID ? `${testID}-${option.value}` : undefined}
            className={cn(
              'min-h-[44px] min-w-[44px] flex-1 justify-center rounded-radius-md bg-surface px-2 py-2',
              selected ? 'border-2 border-feedback-info' : 'border border-border',
            )}>
            <Text
              className={cn(
                'text-center text-body-sm',
                selected ? 'font-semibold text-primary' : 'text-secondary',
              )}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
