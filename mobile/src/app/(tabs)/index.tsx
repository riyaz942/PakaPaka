import { useFocusEffect, router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeSlideIn } from '@/components/common/FadeSlideIn';
import { PressableScale } from '@/components/common/PressableScale';
import {
  CognitiveLoadRing,
  LevelProgressBar,
  ShadowModeSwitchPrompt,
  StreakCounter,
} from '@/components/engagement';
import { BottomTabInset, MaxContentWidth } from '@/constants/theme';
import { useCognitiveLoad } from '@/data/hooks/useCognitiveLoad';
import { useDatabase } from '@/data/hooks/useDatabase';
import { useLevelProgress } from '@/data/hooks/useLevelProgress';
import { useShadowMode } from '@/data/hooks/useShadowMode';
import { useStreak } from '@/data/hooks/useStreak';
import { getStartingJlptLevel } from '@/data/user/preferencesRepository';
import { getDueSrsStates } from '@/data/user/srsStateRepository';
import { cn } from '@/utils/cn';

type ActionCardProps = {
  title: string;
  subtitle: string;
  glyph: string;
  onPress: () => void;
  accent?: boolean;
  disabled?: boolean;
  accessibilityLabel: string;
  testID?: string;
};

function ActionCard({
  title,
  subtitle,
  glyph,
  onPress,
  accent = false,
  disabled = false,
  accessibilityLabel,
  testID,
}: ActionCardProps) {
  return (
    <PressableScale
      focusable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      className={cn(
        'min-h-[44px] flex-row items-center gap-space-md rounded-radius-lg border p-space-md',
        accent ? 'border-feedback-info bg-surface-elevated' : 'border-border bg-surface',
        disabled && 'opacity-40',
      )}>
      <View
        className={cn(
          'h-12 w-12 items-center justify-center rounded-radius-md',
          accent ? 'bg-feedback-info' : 'bg-surface-elevated',
        )}>
        <Text className="text-title text-primary">{glyph}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-body-lg font-semibold text-primary">{title}</Text>
        <Text className="mt-space-xs text-body-sm text-secondary">{subtitle}</Text>
      </View>
    </PressableScale>
  );
}

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
  const {
    daysActive: shadowModeDaysActive,
    shouldShowSwitchPrompt,
    disable: disableShadowMode,
    dismissPrompt: dismissShadowModePrompt,
    snoozePrompt: snoozeShadowModePrompt,
    refetch: refetchShadowMode,
  } = useShadowMode();

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
      refetchShadowMode();
      try {
        setDueCount(getDueSrsStates(userDb).length);
      } catch {
        setDueCount(0);
      }
    }, [refetchLoad, refetchStreak, refetchProgress, refetchShadowMode, userDb]),
  );

  const handleShadowModeCommit = useCallback(() => {
    disableShadowMode();
  }, [disableShadowMode]);

  const isLoading = loadLoading || streakLoading || progressLoading || dueCountLoading;

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
        <ScrollView contentContainerClassName="gap-space-md pb-space-md">
          <FadeSlideIn index={0} className="py-space-sm">
            <Text className="text-title-lg text-primary">おかえり！</Text>
            <Text className="mt-space-xs text-body-sm text-secondary">
              Welcome back — here&apos;s today at a glance.
            </Text>
          </FadeSlideIn>

          <FadeSlideIn index={1}>
            <View className="items-center rounded-radius-lg bg-surface py-space-xl">
              <CognitiveLoadRing variant="hero" percent={cognitiveLoadPercent} />
              <Text className="mt-space-md text-body font-semibold text-primary">
                Today&apos;s load
              </Text>
              <Text className="mt-space-xs text-body-sm text-secondary">
                Your study capacity for today
              </Text>
            </View>
          </FadeSlideIn>

          <FadeSlideIn index={2}>
            <ActionCard
              title="Today's lesson"
              subtitle="A guided lesson picked for you"
              glyph="学"
              onPress={() => router.push('/lesson')}
              accessibilityLabel="Start today's lesson"
              testID="home-learn-button"
            />
          </FadeSlideIn>

          {isLoading ? (
            <ActivityIndicator accessibilityLabel="Loading home stats" />
          ) : (
            <>
              <FadeSlideIn index={3}>
                <ActionCard
                  title={dueCount > 0 ? 'Review' : 'All caught up'}
                  subtitle={
                    dueCount > 0
                      ? `${dueCount} ${dueCount === 1 ? 'item' : 'items'} due now`
                      : 'No reviews due — nice work'
                  }
                  glyph="復"
                  accent
                  onPress={() => router.push('/review')}
                  disabled={dueCount === 0}
                  accessibilityLabel={
                    dueCount > 0
                      ? `Review ${dueCount} items due`
                      : 'All caught up, no reviews due'
                  }
                  testID="home-review-button"
                />
              </FadeSlideIn>
              <FadeSlideIn index={4}>
                <StreakCounter
                  currentStreak={currentStreak}
                  streakState={streakState}
                  testID="home-streak-counter"
                />
              </FadeSlideIn>
              {level ? (
                <FadeSlideIn index={5}>
                  <LevelProgressBar
                    level={level}
                    perType={perType}
                    overallPercent={overallPercent}
                  />
                </FadeSlideIn>
              ) : null}
              {shouldShowSwitchPrompt ? (
                <FadeSlideIn index={6}>
                  <ShadowModeSwitchPrompt
                    daysActive={shadowModeDaysActive}
                    onCommit={handleShadowModeCommit}
                    onSnooze={snoozeShadowModePrompt}
                    onDismiss={dismissShadowModePrompt}
                  />
                </FadeSlideIn>
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
