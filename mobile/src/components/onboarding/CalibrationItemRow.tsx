import React from 'react';
import { Text, View } from 'react-native';

import { ItemStudyStatusPicker } from '@/components/onboarding/ItemStudyStatusPicker';
import type { CurriculumListItem } from '@/data/curriculum/itemRepository';
import type { StudyStatus } from '@/data/user/studyStatus.types';
import { cn } from '@/utils/cn';

type CalibrationItemRowProps = {
  item: CurriculumListItem;
  status: StudyStatus;
  dependencyHint?: string | null;
  onStatusChange: (status: StudyStatus) => void;
  testID?: string;
};

export function CalibrationItemRow({
  item,
  status,
  dependencyHint,
  onStatusChange,
  testID,
}: CalibrationItemRowProps) {
  const isGrammar = item.itemType === 'grammar';
  const isJapaneseForm = item.itemType === 'radical' || item.itemType === 'kanji';

  return (
    <View testID={testID} className="border-b border-border py-4">
      <Text
        className={cn(
          isJapaneseForm ? 'text-display text-primary' : 'text-body text-primary',
          isGrammar && 'font-mono',
        )}>
        {item.primaryForm}
      </Text>
      <Text className="mt-1 text-body text-primary">{item.meaning}</Text>

      {dependencyHint ? (
        <Text className="mt-1 text-caption text-secondary">{dependencyHint}</Text>
      ) : null}

      <View className="mt-3">
        <ItemStudyStatusPicker
          selectedStatus={status}
          onSelect={onStatusChange}
          testID={testID ? `${testID}-status` : undefined}
        />
      </View>
    </View>
  );
}
