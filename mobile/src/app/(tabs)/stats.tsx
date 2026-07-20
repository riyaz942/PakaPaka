import { useFocusEffect } from 'expo-router';
import React, { useCallback } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DaysStudiedStat } from '@/components/engagement';
import { SrsStageBreakdown } from '@/components/stats/SrsStageBreakdown';
import { StatsEmptyState, WeaknessEmptySubState } from '@/components/stats/StatsEmptyState';
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
        <Text className="text-title text-primary">Stats</Text>

        {isLoading ? (
          <View className="mt-8 items-center">
            <ActivityIndicator accessibilityLabel="Loading stats" />
          </View>
        ) : hasError ? (
          <Text className="mt-8 text-body text-feedback-incorrect">
            Stats could not be loaded. Try again later.
          </Text>
        ) : isFirstLaunchEmpty ? (
          <StatsEmptyState />
        ) : (
          <ScrollView className="mt-6" contentContainerClassName="gap-space-lg pb-space-md">
            <DaysStudiedStat daysStudied={daysStudied} />
            <View>
              <Text className="mb-space-sm text-body-lg font-semibold text-primary">
                SRS stages
              </Text>
              <SrsStageBreakdown counts={counts} />
            </View>

            <View>
              <Text className="mb-space-sm text-body-lg font-semibold text-primary">
                Weak patterns
              </Text>
              {clusters.length === 0 ? (
                <WeaknessEmptySubState />
              ) : (
                <View className="gap-space-md">
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
