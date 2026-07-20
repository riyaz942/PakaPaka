import { useFocusEffect, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeSlideIn } from '@/components/common/FadeSlideIn';
import { PressableScale } from '@/components/common/PressableScale';
import {
  GoalReductionPrompt,
  GoalRing,
  GoalRisePrompt,
  LevelProgressBar,
  ShadowModeSwitchPrompt,
  StreakCounter,
} from '@/components/engagement';
import { MaxContentWidth } from '@/constants/theme';
import {
  computeDailyAllowance,
  type DailyAllowance,
} from '@/core/lesson/lessonAllowance';
import { useCognitiveLoad } from '@/data/hooks/useCognitiveLoad';
import { useDatabase } from '@/data/hooks/useDatabase';
import { useLevelProgress } from '@/data/hooks/useLevelProgress';
import { useShadowMode } from '@/data/hooks/useShadowMode';
import { useStreak } from '@/data/hooks/useStreak';
import { todayKey } from '@/data/user/cognitiveLoadRepository';
import { getLessonItemsStartedOn } from '@/data/user/lessonProgressRepository';
import {
  getSessionIntensity,
  getStartingJlptLevel,
} from '@/data/user/preferencesRepository';
import {
  acceptPendingReduction,
  acceptPendingRise,
  declinePendingReduction,
} from '@/data/user/goalRingRepository';
import { getDueSrsStates } from '@/data/user/srsStateRepository';
import { cn } from '@/utils/cn';

type ActionCardProps = {
  title: string;
  subtitle: string;
  glyph: string;
  onPress: () => void;
  accent?: boolean;
  disabled?: boolean;
  /** Dimmed but still tappable — for advisory states like the lesson cap. */
  muted?: boolean;
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
  muted = false,
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
        muted && 'opacity-60',
      )}>
      <View
        className={cn(
          'h-12 w-12 items-center justify-center rounded-radius-md',
          accent ? 'bg-feedback-info' : 'bg-surface-elevated',
        )}>
        <Text className={cn('text-title', accent ? 'text-white' : 'text-primary')}>
          {glyph}
        </Text>
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
  const [lessonAllowance, setLessonAllowance] = useState<DailyAllowance | null>(null);

  const readLessonAllowance = useCallback(
    (reviewsDueCount: number) => {
      try {
        setLessonAllowance(
          computeDailyAllowance({
            intensity: getSessionIntensity(userDb),
            itemsStartedToday: getLessonItemsStartedOn(userDb, todayKey()),
            reviewsDueCount,
          }),
        );
      } catch {
        setLessonAllowance(null);
      }
    },
    [userDb],
  );

  const {
    percent: cognitiveLoadPercent,
    threshold: dailyGoal,
    pendingRiseTo,
    pendingReductionTo,
    isLoading: loadLoading,
    refetch: refetchLoad,
  } = useCognitiveLoad();
  // Dismiss hides only the current pending rise value. A later week's different
  // offer reappears even while Home stays mounted (tab screens are long-lived).
  const [dismissedRiseTo, setDismissedRiseTo] = useState<number | null>(null);

  const handleAcceptRise = useCallback(() => {
    const result = acceptPendingRise(userDb);
    if (result.ok) {
      setDismissedRiseTo(null);
      refetchLoad();
    } else if (__DEV__) {
      console.warn('[Home] acceptPendingRise failed', result.error);
    }
  }, [userDb, refetchLoad]);

  const handleAdjustGoal = useCallback(() => {
    router.push('/settings');
  }, []);

  const handleAcceptReduction = useCallback(() => {
    const result = acceptPendingReduction(userDb);
    if (result.ok) {
      refetchLoad();
    } else if (__DEV__) {
      console.warn('[Home] acceptPendingReduction failed', result.error);
    }
  }, [userDb, refetchLoad]);

  const handleDeclineReduction = useCallback(() => {
    const result = declinePendingReduction(userDb);
    if (result.ok) {
      refetchLoad();
    } else if (__DEV__) {
      console.warn('[Home] declinePendingReduction failed', result.error);
    }
  }, [userDb, refetchLoad]);
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

  // BUG1: refetch on *every* focus, including the first. Returning from
  // /lesson or /review re-focuses Home without a blur in between, so skipping
  // the initial focus left the ring and counts stale until a tab switch.
  // Focus-only (no mount effect) — useFocusEffect fires on initial mount too,
  // so a single path covers first load and every return.
  useFocusEffect(
    useCallback(() => {
      refetchLoad();
      refetchStreak();
      refetchProgress();
      refetchShadowMode();
      let due = 0;
      try {
        setLevel(getStartingJlptLevel(userDb));
        due = getDueSrsStates(userDb).length;
        setDueCount(due);
      } catch {
        setDueCount(0);
      } finally {
        setDueCountLoading(false);
      }
      readLessonAllowance(due);
    }, [
      refetchLoad,
      refetchStreak,
      refetchProgress,
      refetchShadowMode,
      userDb,
      readLessonAllowance,
    ]),
  );

  const handleShadowModeCommit = useCallback(() => {
    disableShadowMode();
  }, [disableShadowMode]);

  const isLoading = loadLoading || streakLoading || progressLoading || dueCountLoading;

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
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="gap-space-md pb-space-lg">
          <FadeSlideIn index={0} className="py-space-sm">
            <Text className="text-title-lg text-primary">おかえり！</Text>
            <Text className="mt-space-xs text-body-sm text-secondary">
              Welcome back — here&apos;s today at a glance.
            </Text>
          </FadeSlideIn>

          <FadeSlideIn index={1}>
            <View className="items-center rounded-radius-lg bg-surface py-space-xl">
              <GoalRing variant="hero" percent={cognitiveLoadPercent} />
              <Text className="mt-space-md text-body font-semibold text-primary">
                Today&apos;s goal
              </Text>
              <Text className="mt-space-xs text-body-sm text-secondary">
                Something to beat — going past 100% is the good part
              </Text>
            </View>
          </FadeSlideIn>

          {pendingRiseTo !== null && pendingRiseTo !== dismissedRiseTo ? (
            <GoalRisePrompt
              proposedGoal={pendingRiseTo}
              currentGoal={dailyGoal}
              onAccept={handleAcceptRise}
              onAdjust={handleAdjustGoal}
              onDismiss={() => setDismissedRiseTo(pendingRiseTo)}
            />
          ) : null}

          {pendingReductionTo !== null ? (
            <GoalReductionPrompt
              proposedGoal={pendingReductionTo}
              currentGoal={dailyGoal}
              onAccept={handleAcceptReduction}
              onDecline={handleDeclineReduction}
            />
          ) : null}

          <FadeSlideIn index={2}>
            <ActionCard
              title="Today's lesson"
              subtitle={
                lessonAllowance === null
                  ? 'A guided lesson picked for you'
                  : lessonAllowance.remaining > 0
                    ? `${lessonAllowance.remaining} of ${lessonAllowance.total} lesson items remaining today`
                    : "You've learned enough today. Come back tomorrow, or clear some reviews."
              }
              glyph="学"
              muted={lessonAllowance !== null && lessonAllowance.remaining === 0}
              onPress={() => router.push('/lesson')}
              accessibilityLabel={
                lessonAllowance !== null && lessonAllowance.remaining === 0
                  ? 'Daily lesson limit reached'
                  : "Start today's lesson"
              }
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
