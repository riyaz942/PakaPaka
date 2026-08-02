import { type Href, router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import type { CurriculumParentItem } from '@/data/curriculum/itemRepository';

/**
 * Compact prerequisite hints for *list rows* (`LearnItemRow`).
 *
 * Detail screens no longer use this: they show always-browsable component
 * chips via `CrossReferenceSection` plus a passive `StudyStatusBanner`, so
 * lock state never doubles as the only way to see an item's parts (FR72/FR76).
 */
type KanjiDependencyHintsProps = {
  parents: CurriculumParentItem[];
  mode?: 'all' | 'unmet';
  testID?: string;
};

export function KanjiDependencyHints({
  parents,
  mode = 'all',
  testID,
}: KanjiDependencyHintsProps) {
  if (parents.length === 0) {
    return null;
  }

  return (
    <View testID={testID} className="mt-2 flex-row flex-wrap items-center gap-1">
      <Text className="text-caption font-ui-medium text-muted">
        {mode === 'unmet' ? 'Learn first:' : 'Requires:'}
      </Text>
      {parents.map((parent, index) => (
        <React.Fragment key={parent.id}>
          {index > 0 ? <Text className="text-caption font-ui-medium text-muted">, </Text> : null}
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={
              parent.itemType === 'radical'
                ? `Radical ${parent.primaryForm}`
                : `${parent.primaryForm}`
            }
            onPress={() => router.push(`/browse/item/${parent.id}` as Href)}
            testID={testID ? `${testID}-${parent.id}` : undefined}
            className="min-h-[44px] min-w-[44px] justify-center px-2 py-1">
            <Text className="text-caption font-jp-medium text-brand-text">
              {parent.primaryForm}
            </Text>
          </Pressable>
        </React.Fragment>
      ))}
    </View>
  );
}
