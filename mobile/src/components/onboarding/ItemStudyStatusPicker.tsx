import React from 'react';
import { Pressable, Text, View } from 'react-native';

import type { StudyStatus } from '@/data/user/studyStatus.types';
import { cn } from '@/utils/cn';

type StatusOption = {
  value: StudyStatus;
  label: string;
  selectedBorderClass: string;
};

const STATUS_OPTIONS: StatusOption[] = [
  { value: 'known', label: 'Known', selectedBorderClass: 'border-2 border-feedback-correct' },
  {
    value: 'in_progress',
    label: 'In progress',
    selectedBorderClass: 'border-2 border-feedback-info',
  },
  { value: 'not_started', label: 'Not started', selectedBorderClass: 'border-2 border-border' },
];

type ItemStudyStatusPickerProps = {
  selectedStatus: StudyStatus;
  onSelect: (status: StudyStatus) => void;
  testID?: string;
};

export function ItemStudyStatusPicker({
  selectedStatus,
  onSelect,
  testID,
}: ItemStudyStatusPickerProps) {
  return (
    <View
      accessibilityRole="radiogroup"
      testID={testID}
      className="flex-row flex-wrap gap-2">
      {STATUS_OPTIONS.map((option) => {
        const selected = selectedStatus === option.value;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => onSelect(option.value)}
            testID={testID ? `${testID}-${option.value}` : undefined}
            className={cn(
              'min-h-[44px] min-w-[44px] justify-center rounded-radius-sm bg-surface px-3 py-2',
              selected ? option.selectedBorderClass : 'border border-border',
            )}>
            <Text
              className={cn(
                'text-caption text-center',
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
