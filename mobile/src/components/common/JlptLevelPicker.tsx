import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { JLPT_LEVELS, type JLPTLevel } from '@/data/curriculum/curriculum.types';
import { cn } from '@/utils/cn';

type JlptLevelPickerProps = {
  selectedLevel: JLPTLevel | null;
  onSelect: (level: JLPTLevel) => void;
  /** Distinguishes the group when a screen shows more than one picker. */
  accessibilityLabel?: string;
  /** Levels shown but not selectable — e.g. no curriculum content shipped yet. */
  disabledLevels?: readonly JLPTLevel[];
  testID?: string;
};

export function JlptLevelPicker({
  selectedLevel,
  onSelect,
  accessibilityLabel = 'JLPT level',
  disabledLevels = [],
  testID,
}: JlptLevelPickerProps) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      className="mt-space-sm flex-row flex-wrap gap-space-sm">
      {JLPT_LEVELS.map((level) => {
        const isSelected = selectedLevel === level;
        const isDisabled = disabledLevels.includes(level);
        return (
          <Pressable
            key={level}
            accessibilityRole="radio"
            accessibilityState={{
              selected: isSelected,
              checked: isSelected,
              disabled: isDisabled,
            }}
            accessibilityLabel={`JLPT ${level}`}
            disabled={isDisabled}
            onPress={() => onSelect(level)}
            testID={`jlpt-level-${level}`}
            className={cn(
              'min-h-[44px] min-w-[56px] items-center justify-center rounded-radius-sm px-space-md py-space-sm',
              isSelected
                ? 'border-2 border-brand-500 bg-brand-soft'
                : 'border border-border bg-surface',
            )}>
            <Text
              className={cn(
                'text-label font-ui-bold',
                isDisabled ? 'text-faint' : isSelected ? 'text-brand-text' : 'text-primary',
              )}>
              {level}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
