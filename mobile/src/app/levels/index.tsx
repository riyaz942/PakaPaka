import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { ScreenHeader } from '@/components/common/ScreenHeader';
import { LevelOverviewCard } from '@/components/engagement';
import { MaxContentWidth } from '@/constants/theme';
import { isJlptLevel, type JLPTLevel } from '@/data/curriculum/curriculum.types';
import { useAllLevelsProgress } from '@/data/hooks/useAllLevelsProgress';
import { useDatabase } from '@/data/hooks/useDatabase';
import { setStartingJlptLevel } from '@/data/user/preferencesRepository';

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function seededLevelFromParams(level: string | string[] | undefined): JLPTLevel | null {
  const value = firstParam(level);
  return value && isJlptLevel(value) ? value : null;
}

export default function LevelsScreen() {
  const { userDb } = useDatabase();
  const params = useLocalSearchParams<{ level?: string | string[] }>();
  const seededLevel = seededLevelFromParams(params.level);
  const { levels, activeLevel, isLoading, refetch } = useAllLevelsProgress();
  const scrollRef = useRef<ScrollView>(null);
  const rowOffsetsRef = useRef<Partial<Record<JLPTLevel, number>>>({});
  const scrolledRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const handleSetActive = useCallback(
    (level: JLPTLevel) => {
      setStartingJlptLevel(userDb, level);
      refetch();
    },
    [userDb, refetch],
  );

  const initialLevel = seededLevel ?? activeLevel;

  const maybeScrollToInitialLevel = useCallback(() => {
    if (scrolledRef.current || isLoading || !initialLevel) return;
    const y = rowOffsetsRef.current[initialLevel];
    if (y === undefined) return;
    scrolledRef.current = true;
    scrollRef.current?.scrollTo({ y, animated: false });
  }, [isLoading, initialLevel]);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="JLPT Levels" backAccessibilityLabel="Back to Home" backTestID="levels-back" />
      <View className="flex-1" style={{ alignSelf: 'center', maxWidth: MaxContentWidth, width: '100%' }}>
        <ScrollView
          ref={scrollRef}
          contentContainerClassName="gap-space-md px-space-lg pb-space-xl pt-space-md">
          <Text className="text-caption font-ui-medium text-muted">
            Pick any level to make it your active level for lessons, reviews, and Talk.
          </Text>
          {levels.map((summary) => (
            <View
              key={summary.level}
              onLayout={(event) => {
                rowOffsetsRef.current[summary.level] = event.nativeEvent.layout.y;
                maybeScrollToInitialLevel();
              }}>
              <LevelOverviewCard
                level={summary.level}
                perCategory={summary.perCategory}
                overallPercent={summary.overallPercent}
                isActive={summary.level === activeLevel}
                hasFullContent={summary.hasFullContent}
                onSetActive={handleSetActive}
                testID={`levels-card-${summary.level}`}
              />
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}
