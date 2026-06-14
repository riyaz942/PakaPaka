import { type Href, router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import type { CurriculumParentItem } from '@/data/curriculum/itemRepository';

type KanjiDependencyHintsProps = {
  parents: CurriculumParentItem[];
  testID?: string;
};

export function KanjiDependencyHints({ parents, testID }: KanjiDependencyHintsProps) {
  if (parents.length === 0) {
    return null;
  }

  return (
    <View testID={testID} className="mt-2 flex-row flex-wrap items-center gap-1">
      <Text className="text-caption text-secondary">Requires:</Text>
      {parents.map((parent, index) => (
        <React.Fragment key={parent.id}>
          {index > 0 ? <Text className="text-caption text-secondary">, </Text> : null}
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={
              parent.itemType === 'radical'
                ? `Radical ${parent.primaryForm}`
                : `${parent.primaryForm}`
            }
            onPress={() => router.push(`/learn/item/${parent.id}` as Href)}
            testID={testID ? `${testID}-${parent.id}` : undefined}
            className="min-h-[44px] min-w-[44px] justify-center px-2 py-1">
            <Text className="text-caption text-feedback-info">{parent.primaryForm}</Text>
          </Pressable>
        </React.Fragment>
      ))}
    </View>
  );
}
