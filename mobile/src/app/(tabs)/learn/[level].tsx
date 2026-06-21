import { type Href, router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LearnItemRow } from '@/components/learn/LearnItemRow';
import { CalibrationItemTypePicker } from '@/components/onboarding/CalibrationItemTypePicker';
import { BottomTabInset, MaxContentWidth } from '@/constants/theme';
import { isJlptLevel } from '@/data/curriculum/curriculum.types';
import {
  getRequiredParentsForItems,
  ITEM_TYPE_LABELS,
  type ItemType,
} from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';
import { useLearnItems } from '@/data/hooks/useLearnItems';

const LEARN_ITEM_TYPES: readonly ItemType[] = ['radical', 'kanji', 'vocabulary', 'grammar'];

function isLearnItemType(value: string): value is ItemType {
  return (LEARN_ITEM_TYPES as readonly string[]).includes(value);
}

function resolveItemType(typeParam: string | undefined): ItemType {
  return typeParam && isLearnItemType(typeParam) ? typeParam : 'kanji';
}

export default function LearnLevelScreen() {
  const params = useLocalSearchParams<{ level: string; type?: string }>();
  const jlptLevel = isJlptLevel(params.level) ? params.level : 'N5';
  const [itemType, setItemType] = useState<ItemType>(() => resolveItemType(params.type));
  const { items, loading } = useLearnItems(jlptLevel, itemType);
  const { curriculumDb } = useDatabase();

  useEffect(() => {
    setItemType(resolveItemType(params.type));
  }, [params.type]);

  const dependencyParentsByItemId = useMemo(() => {
    if (itemType !== 'kanji') {
      return new Map();
    }
    const kanjiIds = items.map((item) => item.id);
    return getRequiredParentsForItems(curriculumDb, kanjiIds);
  }, [curriculumDb, itemType, items]);

  const emptyMessage = useMemo(() => {
    return `No ${ITEM_TYPE_LABELS[itemType]} at ${jlptLevel} yet.`;
  }, [itemType, jlptLevel]);

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView
        className="flex-1 px-space-lg pt-space-md"
        style={{
          alignSelf: 'center',
          maxWidth: MaxContentWidth,
          paddingBottom: BottomTabInset,
          width: '100%',
        }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Learn hub"
          onPress={() => router.back()}
          testID="learn-level-back"
          className="mb-2 min-h-[44px] self-start justify-center py-1">
          <Text className="text-body text-feedback-info">Back</Text>
        </Pressable>

        <Text className="text-title text-primary">{jlptLevel}</Text>

        <CalibrationItemTypePicker
          selectedType={itemType}
          onSelect={setItemType}
          allowedTypes={LEARN_ITEM_TYPES}
          testID="learn-type-picker"
        />

        {loading ? (
          <View className="mt-8 items-center">
            <ActivityIndicator accessibilityLabel="Loading items" />
          </View>
        ) : items.length === 0 ? (
          <Text className="mt-8 text-body text-secondary">{emptyMessage}</Text>
        ) : (
          <FlatList
            className="mt-4 flex-1"
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <LearnItemRow
                item={item}
                testID={`learn-item-${item.id}`}
                onPress={() => router.push(`/learn/item/${item.id}` as Href)}
                dependencyParents={dependencyParentsByItemId.get(item.id)}
              />
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}
