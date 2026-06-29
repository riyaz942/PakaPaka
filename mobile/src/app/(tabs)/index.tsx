import { useFocusEffect, router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import {
  CognitiveLoadRing,
  LevelProgressBar,
  StreakCounter,
} from '@/components/engagement';
import { BottomTabInset, MaxContentWidth } from '@/constants/theme';
import { useCognitiveLoad } from '@/data/hooks/useCognitiveLoad';
import { useDatabase } from '@/data/hooks/useDatabase';
import { useLevelProgress } from '@/data/hooks/useLevelProgress';
import { useStreak } from '@/data/hooks/useStreak';
import { getStartingJlptLevel } from '@/data/user/preferencesRepository';
import { getDueSrsStates } from '@/data/user/srsStateRepository';

export default function HomeScreen() {
  const { userDb } = useDatabase();
  const [level, setLevel] = useState<ReturnType<typeof getStartingJlptLevel>>(null);
  const [dueCount, setDueCount] = useState(0);
  const [dueCountLoading, setDueCountLoading] = useState(true);

  const {
    percent: cognitiveLoadPercent,
    isLoading: loadLoading,
    refetch: refetchLoad,
  } = useCognitiveLoad();
  const {
    currentStreak,
    streakState,
    isLoading: streakLoading,
    refetch: refetchStreak,
  } = useStreak();
  const {
    perType,
    overallPercent,
    isLoading: progressLoading,
    refetch: refetchProgress,
  } = useLevelProgress(level);

  useEffect(() => {
    try {
      setLevel(getStartingJlptLevel(userDb));
      setDueCount(getDueSrsStates(userDb).length);
    } catch {
      setDueCount(0);
    } finally {
      setDueCountLoading(false);
    }
  }, [userDb]);

  const isInitialFocusRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isInitialFocusRef.current) {
        isInitialFocusRef.current = false;
        return;
      }
      refetchLoad();
      refetchStreak();
      refetchProgress();
      try {
        setDueCount(getDueSrsStates(userDb).length);
      } catch {
        setDueCount(0);
      }
    }, [refetchLoad, refetchStreak, refetchProgress, userDb]),
  );

  const isLoading = loadLoading || streakLoading || progressLoading || dueCountLoading;
  const reviewLabel = dueCount > 0 ? `Review (${dueCount})` : 'All caught up';

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
        <ScrollView contentContainerClassName="gap-space-lg pb-space-md">
          <View className="items-center py-space-lg">
            <CognitiveLoadRing variant="large" percent={cognitiveLoadPercent} />
            <Text className="mt-space-sm text-body text-secondary">Today&apos;s load</Text>
          </View>

          <Button
            label="Learn"
            onPress={() => router.push('/(tabs)/learn')}
            variant="secondary"
            accessibilityLabel="Go to Learn tab"
            testID="home-learn-button"
          />

          {isLoading ? (
            <ActivityIndicator accessibilityLabel="Loading home stats" />
          ) : (
            <>
              <Button
                label={reviewLabel}
                onPress={() => router.push('/review')}
                variant="primary"
                disabled={dueCount === 0}
                accessibilityLabel={
                  dueCount > 0
                    ? `Review ${dueCount} items due`
                    : 'All caught up, no reviews due'
                }
                testID="home-review-button"
              />
              <StreakCounter
                currentStreak={currentStreak}
                streakState={streakState}
                testID="home-streak-counter"
              />
              {level ? (
                <LevelProgressBar
                  level={level}
                  perType={perType}
                  overallPercent={overallPercent}
                />
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
