import { useFocusEffect } from 'expo-router';
import React, { useCallback } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenTitle } from '@/components/common/ScreenTitle';
import { SectionHeading } from '@/components/common/SectionHeading';
import { DaysStudiedStat } from '@/components/engagement';
import { SrsStageBreakdown } from '@/components/stats/SrsStageBreakdown';
import { StatsEmptyState, WeaknessEmptySubState } from '@/components/stats/StatsEmptyState';
import { StatTile } from '@/components/stats/StatTile';
import { WeaknessStatCard } from '@/components/stats/WeaknessStatCard';
import { MaxContentWidth } from '@/constants/theme';
import { useDaysStudied } from '@/data/hooks/useDaysStudied';
import { useSRSBreakdown } from '@/data/hooks/useSRSBreakdown';
import { useWeaknessStats } from '@/data/hooks/useWeaknessStats';

export default function StatsScreen() {
  const {
    stats: weaknessStats,
    clusters,
    isLoading: weaknessLoading,
    error: weaknessError,
    refetch: refetchWeakness,
  } = useWeaknessStats();
  const {
    counts,
    total: srsTotal,
    readingLockedCount,
    isLoading: srsLoading,
    error: srsError,
    refetch: refetchSrsBreakdown,
  } = useSRSBreakdown();

  const { daysStudied, isLoading: daysLoading, refetch: refetchDaysStudied } = useDaysStudied();

  // BUG1 pattern (mirrors Home): refetch on *every* focus including the first,
  // so returning from a session immediately reflects the new study day.
  useFocusEffect(
    useCallback(() => {
      refetchWeakness();
      refetchSrsBreakdown();
      refetchDaysStudied();
    }, [refetchWeakness, refetchSrsBreakdown, refetchDaysStudied]),
  );

  const isLoading = weaknessLoading || srsLoading || daysLoading;
  const hasError = weaknessError !== null || srsError !== null;
  const isFirstLaunchEmpty =
    srsTotal === 0 && weaknessStats.length === 0 && !isLoading && !hasError;

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
        <ScreenTitle>Stats</ScreenTitle>

        {isLoading ? (
          <View className="mt-8 items-center">
            <ActivityIndicator accessibilityLabel="Loading stats" />
          </View>
        ) : hasError ? (
          <Text className="mt-8 text-body font-ui-medium text-feedback-incorrect-deep">
            Stats could not be loaded. Try again later.
          </Text>
        ) : isFirstLaunchEmpty ? (
          <StatsEmptyState />
        ) : (
          <ScrollView className="mt-space-md" contentContainerClassName="gap-space-lg pb-space-md">
            {/* The spec's two-up headline row. The second tile is the tracked-item
                count, not the spec's day streak — see the Session 4 deviations. */}
            <View className="flex-row gap-space-sm">
              <DaysStudiedStat daysStudied={daysStudied} />
              <StatTile
                testID="items-tracked-stat"
                accessibilityLabel={`${srsTotal} items in review`}
                value={srsTotal}
                label="Items in review"
                caption="across all stages"
              />
            </View>

            <View>
              <SectionHeading label="SRS stages" />
              <View className="mt-space-sm">
                <SrsStageBreakdown counts={counts} />
              </View>
              {/* Rule 3 holds meaning-only words at master, so the stages above
                  contain a population that cannot climb yet. Without this line
                  it reads as stalled progress. */}
              {readingLockedCount > 0 ? (
                <Text
                  testID="reading-locked-note"
                  className="mt-space-sm text-caption font-ui-medium text-secondary">
                  {readingLockedCount === 1
                    ? '1 word is held at Master until you learn the kanji it is written with.'
                    : `${readingLockedCount} words are held at Master until you learn the kanji they are written with.`}
                </Text>
              ) : null}
            </View>

            <View>
              <SectionHeading label="Weak patterns" />
              {clusters.length === 0 ? (
                <WeaknessEmptySubState />
              ) : (
                <View className="mt-space-sm gap-space-sm">
                  {clusters.map((cluster) => (
                    <WeaknessStatCard key={cluster.id} cluster={cluster} />
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
