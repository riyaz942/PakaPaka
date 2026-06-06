import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { JLPT_LEVELS, type JLPTLevel } from '@/data/curriculum/curriculum.types';
import { cn } from '@/utils/cn';

type JlptLevelPickerProps = {
  selectedLevel: JLPTLevel | null;
  onSelect: (level: JLPTLevel) => void;
  testID?: string;
};

export function JlptLevelPicker({ selectedLevel, onSelect, testID }: JlptLevelPickerProps) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="JLPT level"
      testID={testID}
      className="mt-3 flex-row flex-wrap gap-2">
      {JLPT_LEVELS.map((level) => {
        const isSelected = selectedLevel === level;
        return (
          <Pressable
            key={level}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected, checked: isSelected }}
            accessibilityLabel={`JLPT ${level}`}
            onPress={() => onSelect(level)}
            testID={`jlpt-level-${level}`}
            className={cn(
              'min-h-[44px] min-w-[56px] items-center justify-center rounded-radius-md px-4 py-2',
              isSelected
                ? 'border-2 border-feedback-info bg-surface-elevated'
                : 'border border-border bg-surface',
            )}>
            <Text className={cn('text-body font-semibold', isSelected && 'text-feedback-info')}>
              {level}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
