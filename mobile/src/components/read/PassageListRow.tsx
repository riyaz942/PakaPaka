import React from 'react';
import { Pressable, Text, View } from 'react-native';

import type { PassageListItem } from '@/data/curriculum/passageRepository';

type PassageListRowProps = {
  passage: PassageListItem;
  testID?: string;
  onPress?: () => void;
};

export function PassageListRow({ passage, testID, onPress }: PassageListRowProps) {
  const questionLabel =
    passage.questionCount === 1
      ? '1 question'
      : `${passage.questionCount} questions`;

  const content = (
    <View className="flex-row items-center justify-between">
      <View className="flex-1 pr-3">
        <Text className="text-body-lg font-semibold text-primary">{passage.title}</Text>
        {passage.questionCount > 0 ? (
          <Text className="mt-1 text-body text-secondary">{questionLabel}</Text>
        ) : null}
      </View>
      <View className="rounded-radius-sm bg-content-reading/15 px-2 py-1">
        <Text className="text-caption font-semibold text-content-reading">Reading</Text>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={passage.title}
        onPress={onPress}
        testID={testID}
        className="min-h-[44px] border-b border-border py-4">
        {content}
      </Pressable>
    );
  }

  return (
    <View testID={testID} className="min-h-[44px] border-b border-border py-4">
      {content}
    </View>
  );
}
