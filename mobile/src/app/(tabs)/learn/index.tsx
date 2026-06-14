import { type Href, router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { JlptLevelPicker } from '@/components/common/JlptLevelPicker';
import { BottomTabInset, MaxContentWidth } from '@/constants/theme';
import type { JLPTLevel } from '@/data/curriculum/curriculum.types';
import {
  ITEM_TYPE_LABELS,
  type ItemType,
} from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';
import { useItemCountsByLevel } from '@/data/hooks/useItemCountsByLevel';
import { getStartingJlptLevel } from '@/data/user/preferencesRepository';

const HUB_ITEM_TYPES: readonly ItemType[] = ['kanji', 'vocabulary', 'grammar'];

export default function LearnScreen() {
  const { userDb } = useDatabase();
  const defaultLevel = getStartingJlptLevel(userDb) ?? 'N5';
  const [selectedLevel, setSelectedLevel] = useState<JLPTLevel>(defaultLevel);
  const { counts, loading } = useItemCountsByLevel(selectedLevel);

  const typeCards = useMemo(
    () =>
      HUB_ITEM_TYPES.map((itemType) => ({
        itemType,
        label: ITEM_TYPE_LABELS[itemType],
        count: counts[itemType],
      })),
    [counts],
  );

  const handleTypePress = (itemType: ItemType) => {
    router.push(`/learn/${selectedLevel}?type=${itemType}` as Href);
  };

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
        <Text className="text-title text-primary">Learn</Text>

        <JlptLevelPicker
          selectedLevel={selectedLevel}
          onSelect={setSelectedLevel}
          testID="learn-level-picker"
        />

        {loading ? (
          <View className="mt-8 items-center">
            <ActivityIndicator accessibilityLabel="Loading counts" />
          </View>
        ) : (
          <View className="mt-6 gap-space-md">
            {typeCards.map((card) => (
              <Pressable
                key={card.itemType}
                accessibilityRole="button"
                accessibilityLabel={`${card.label}, ${card.count} items`}
                onPress={() => handleTypePress(card.itemType)}
                testID={`learn-type-card-${card.itemType}`}
                className="min-h-[44px] flex-row items-center justify-between rounded-radius-md border border-border bg-surface p-space-md">
                <Text className="text-body font-semibold text-primary">{card.label}</Text>
                <Text className="text-body text-secondary">{card.count}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}
