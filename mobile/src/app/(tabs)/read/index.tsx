import { type Href, router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { JlptLevelPicker } from '@/components/common/JlptLevelPicker';
import { PassageListRow } from '@/components/read/PassageListRow';
import { MaxContentWidth } from '@/constants/theme';
import type { JLPTLevel } from '@/data/curriculum/curriculum.types';
import { useDatabase } from '@/data/hooks/useDatabase';
import { usePassagesByLevel } from '@/data/hooks/usePassagesByLevel';
import { getStartingJlptLevel } from '@/data/user/preferencesRepository';

export default function ReadScreen() {
  const { userDb } = useDatabase();
  const defaultLevel = getStartingJlptLevel(userDb) ?? 'N5';
  const [selectedLevel, setSelectedLevel] = useState<JLPTLevel>(defaultLevel);
  const { passages, loading } = usePassagesByLevel(selectedLevel);

  const emptyMessage = `No reading passages at ${selectedLevel} yet.`;

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView
        edges={['top', 'left', 'right']}
        className="flex-1 px-space-lg pt-space-md"
        style={{
          alignSelf: 'center',
          maxWidth: MaxContentWidth,
          width: '100%',
        }}>
        <Text className="text-title text-primary">Read</Text>

        <JlptLevelPicker
          selectedLevel={selectedLevel}
          onSelect={setSelectedLevel}
          testID="read-level-picker"
        />

        {loading ? (
          <View className="mt-8 items-center">
            <ActivityIndicator accessibilityLabel="Loading passages" />
          </View>
        ) : passages.length === 0 ? (
          <Text className="mt-8 text-body text-secondary">{emptyMessage}</Text>
        ) : (
          <FlatList
            className="mt-6 flex-1"
            data={passages}
            keyExtractor={(passage) => passage.id}
            renderItem={({ item }) => (
              <PassageListRow
                passage={item}
                testID={`read-passage-row-${item.id}`}
                onPress={() => router.push(`/read/${item.id}` as Href)}
              />
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}
