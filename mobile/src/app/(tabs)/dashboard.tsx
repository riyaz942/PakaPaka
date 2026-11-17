import { useFocusEffect, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeSlideIn } from '@/components/common/FadeSlideIn';
import { GuidanceCardNotice } from '@/components/common/GuidanceCardNotice';
import { GuidanceInfoButton } from '@/components/common/GuidanceInfoButton';
import { Icon } from '@/components/common/Icon';
import { PressableScale } from '@/components/common/PressableScale';
import {
  ActionCard,
  AtRiskSection,
  BackupNudgeCard,
  GoalRing,
  ImportNudgeCard,
  LevelProgressBar,
  ReadingReadiness,
  ReviewForecast,
  ShadowModeSwitchPrompt,
  WelcomeBackCard,
  accessibilitySummary,
} from '@/components/engagement';
import { GUIDANCE_CARD_BY_ID } from '@/components/onboarding/cardRegistry';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useWideLayout } from '@/hooks/useWideLayout';
import {
  defaultHomeLayout,
  type HomeSectionEntry,
  type HomeSectionId,
} from '@/core/engagement/homeLayout';
import {
  computeDailyAllowance,
  type DailyAllowance,
} from '@/core/lesson/lessonAllowance';
import { useCognitiveLoad } from '@/data/hooks/useCognitiveLoad';
import { useDatabase } from '@/data/hooks/useDatabase';
import { useGuidanceCard } from '@/data/hooks/useGuidanceCard';
import { useLevelProgress } from '@/data/hooks/useLevelProgress';
import { useAtRiskItems } from '@/data/hooks/useAtRiskItems';
import { useReadingReadiness } from '@/data/hooks/useReadingReadiness';
import { useReviewForecast } from '@/data/hooks/useReviewForecast';
import { useShadowMode } from '@/data/hooks/useShadowMode';
import { getGreetingSentence } from '@/data/curriculum/greetingRepository';
import { buildLessonPlan } from '@/data/lessonPlan';
import { getLessonItemsStartedOn } from '@/data/user/lessonProgressRepository';
import {
  getDailyLessonItems,
  getHomeLayout,
  getLastBackedUpAt,
  getLessonItemCount,
  getStartingJlptLevel,
  isOnboardingCompleted,
} from '@/data/user/preferencesRepository';
import { isBackupStale } from '@/core/backup/backupFreshness';
import { getLastActiveDate, todayKey } from '@/data/user/cognitiveLoadRepository';
import { setReviewPriority } from '@/data/reviewPriorityStore';
import { countServableDueItems } from '@/data/reviewEligibility';
import { countImportMetadataRows } from '@/data/user/importRepository';
import { isVacationActive } from '@/data/user/vacationRepository';
import { buildReviewForecast } from '@/core/engagement/reviewForecast';
import { computeWelcomeBackOffer, type WelcomeBackOffer } from '@/core/engagement/welcomeBack';
import { AT_RISK_TOP_N, WELCOME_BACK_SLICE } from '@/config/constants';
import { useCurriculumUpdateBanner } from '@/providers/CurriculumUpdateContext';
import { useSync } from '@/providers/SyncProvider';
import { cn } from '@/utils/cn';
import { supportsThirdPartyImport } from '@/platform/capabilities';

/**
 * Desktop web splits Home into two columns: today's work on the left, progress
 * on the right. The stored order still applies inside each column.
 */
const TODAY_COLUMN_SECTIONS: ReadonlySet<HomeSectionId> = new Set([
  'goal-ring',
  'review-cta',
  'lesson-cta',
]);

export default function HomeScreen() {
  const wide = useWideLayout();
  const { curriculumDb, userDb } = useDatabase();
  const { appliedVersion } = useSync();
  const [level, setLevel] = useState<ReturnType<typeof getStartingJlptLevel>>(null);
  const [greetingSentence, setGreetingSentence] = useState<string | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [dueCountLoading, setDueCountLoading] = useState(true);
  const [lessonAllowance, setLessonAllowance] = useState<DailyAllowance | null>(null);
  // New items exist but none is ready yet — they unlock as reviews reach Guru.
  const [lessonWaiting, setLessonWaiting] = useState(false);
  const [welcomeBackOffer, setWelcomeBackOffer] = useState<WelcomeBackOffer | null>(null);
  // Visit-scoped dismissals (mirrors risePromptHidden semantics from 2.1).
  const [welcomeBackDismissed, setWelcomeBackDismissed] = useState(false);
  const [importNudgeDismissed, setImportNudgeDismissed] = useState(false);
  const [showImportNudge, setShowImportNudge] = useState(false);
  const [backupNudgeDismissed, setBackupNudgeDismissed] = useState(false);
  const [lastBackedUpAt, setLastBackedUpAt] = useState<string | null>(null);
  const [onVacation, setOnVacation] = useState(false);
  const [layout, setLayout] = useState<HomeSectionEntry[]>(defaultHomeLayout());
  // `onVacation` defaults to false and only becomes true once the focus effect
  // has read it. The overshoot card must wait for that answer — firing on the
  // default would mark it seen for a learner who is actually paused.
  const [vacationResolved, setVacationResolved] = useState(false);

  const readLessonAllowance = useCallback(
    (reviewsDueCount: number) => {
      try {
        setLessonAllowance(
          computeDailyAllowance({
            dailyLessonItems: getDailyLessonItems(userDb),
            itemsPerLesson: getLessonItemCount(userDb),
            itemsStartedToday: getLessonItemsStartedOn(userDb, todayKey()),
            reviewsDueCount,
          }),
        );
        const plan = buildLessonPlan(curriculumDb, userDb);
        setLessonWaiting(plan.items.length === 0 && plan.waiting);
      } catch {
        setLessonAllowance(null);
        setLessonWaiting(false);
      }
    },
    [curriculumDb, userDb],
  );

  const {
    percent: cognitiveLoadPercent,
    isOvershoot,
    isLoading: loadLoading,
    refetch: refetchLoad,
  } = useCognitiveLoad();
  // Suppressed on vacation, matching the ring itself — the paused hero has no
  // overshoot to explain.
  const goalOvershootCard = useGuidanceCard(
    'goal-overshoot',
    vacationResolved && isOvershoot && !onVacation,
  );
  const {
    perType,
    overallPercent,
    isLoading: progressLoading,
    refetch: refetchProgress,
  } = useLevelProgress(level);
  const { forecast, refetch: refetchForecast } = useReviewForecast();
  const { target: readingTarget, refetch: refetchReadiness } = useReadingReadiness();
  const {
    totalCount: atRiskCount,
    topItems: atRiskTopItems,
    allItems: atRiskAllItems,
    rankedItemIds: atRiskRankedIds,
    refetch: refetchAtRisk,
  } = useAtRiskItems();

  const handleStartRevision = useCallback(() => {
    setReviewPriority({ itemIds: atRiskRankedIds, limit: AT_RISK_TOP_N });
    router.push('/review');
  }, [atRiskRankedIds]);

  const handleStartWelcomeBackSlice = useCallback(() => {
    setReviewPriority({ itemIds: [], limit: WELCOME_BACK_SLICE });
    router.push('/review');
  }, []);

  const showBackupNudge = Platform.OS === 'web' && isBackupStale(lastBackedUpAt);

  const { showCurriculumUpdatedBanner, dismissCurriculumUpdatedBanner } =
    useCurriculumUpdateBanner();
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
      refetchProgress();
      refetchShadowMode();
      refetchForecast();
      refetchReadiness();
      refetchAtRisk();
      try {
        setGreetingSentence(getGreetingSentence(curriculumDb, userDb));
      } catch {
        setGreetingSentence(null);
      }
      try {
        setLayout(getHomeLayout(userDb));
      } catch {
        setLayout(defaultHomeLayout());
      }
      // Vacation mode freezes everything: skip the due and allowance reads so
      // the paused surface can't quote a backlog that is still growing behind
      // it, and so nothing here re-enables the disabled CTAs.
      let paused = false;
      try {
        paused = isVacationActive(userDb);
        setVacationResolved(true);
      } catch {
        // A failed read leaves the overshoot trigger unresolved — fail closed
        // rather than fire (and mark seen) on a guessed vacation state.
        paused = false;
      }
      setOnVacation(paused);

      let due = 0;
      try {
        setLevel(getStartingJlptLevel(userDb));
        due = paused ? 0 : countServableDueItems(curriculumDb, userDb);
        setDueCount(due);
      } catch {
        setDueCount(0);
      } finally {
        setDueCountLoading(false);
      }
      if (paused) {
        setLessonAllowance(null);
      } else {
        readLessonAllowance(due);
      }
      try {
        // Include today when finding the last active day — studying today
        // ends the absence immediately.
        const now = new Date();
        const tomorrow = todayKey(
          new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
        );
        setWelcomeBackOffer(
          computeWelcomeBackOffer({
            lastActiveDate: getLastActiveDate(userDb, tomorrow),
            todayKey: todayKey(now),
            dueCount: due,
          }),
        );
      } catch {
        setWelcomeBackOffer(null);
      }
      try {
        setShowImportNudge(
          supportsThirdPartyImport() &&
            countImportMetadataRows(userDb) === 0 &&
            isOnboardingCompleted(userDb),
        );
      } catch {
        setShowImportNudge(false);
      }
      try {
        setLastBackedUpAt(getLastBackedUpAt(userDb));
      } catch {
        setLastBackedUpAt(null);
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- appliedVersion is an explicit reload trigger
    }, [
      refetchLoad,
      refetchProgress,
      refetchShadowMode,
      refetchForecast,
      refetchReadiness,
      refetchAtRisk,
      curriculumDb,
      userDb,
      readLessonAllowance,
      appliedVersion,
    ]),
  );

  const handleShadowModeCommit = useCallback(() => {
    disableShadowMode();
  }, [disableShadowMode]);

  const isLoading = loadLoading || progressLoading || dueCountLoading;

  // One switch per customizable section id — the learner's stored order and
  // visibility decide *whether/where* this renders; the conditions below are
  // unchanged from before customization existed and still have final say.
  function renderHomeSection(id: HomeSectionId) {
    switch (id) {
      case 'goal-ring':
        // The vacation card (pinned, not part of the layout) already covers
        // this slot when paused.
        return onVacation ? null : (
          <View className="items-center rounded-radius-xl bg-surface p-space-md shadow-e2">
            <GoalRing variant="hero" percent={cognitiveLoadPercent} />
            <View className="mt-space-sm flex-row items-center gap-space-xs">
              <Text className="text-body font-ui-extrabold text-primary">
                Today&apos;s goal
              </Text>
              <GuidanceInfoButton cardId="goal-overshoot" />
            </View>
            <Text className="mt-space-xs text-center text-caption font-ui text-muted">
              Something to beat — going past 100% is the good part
            </Text>
          </View>
        );
      case 'review-cta':
        return (
          <ActionCard
            title={onVacation ? 'Review' : dueCount > 0 ? 'Review' : 'All caught up'}
            subtitle={
              onVacation
                ? 'Paused for vacation'
                : dueCountLoading
                  ? 'Checking what’s due…'
                  : dueCount > 0
                    ? `${dueCount} ${dueCount === 1 ? 'item' : 'items'} ready`
                    : 'No reviews due — nice work'
            }
            glyph="復"
            accent={!onVacation}
            onPress={() => router.push('/review')}
            disabled={onVacation || dueCountLoading || dueCount === 0}
            accessibilityLabel={
              onVacation
                ? 'Reviews paused for vacation mode'
                : dueCountLoading
                  ? 'Checking reviews due'
                  : dueCount > 0
                    ? `Review ${dueCount} items due`
                    : 'All caught up, no reviews due'
            }
            testID="home-review-button"
          />
        );
      case 'lesson-cta':
        return (
          <ActionCard
            title="Today's lesson"
            subtitle={
              onVacation
                ? 'Paused for vacation'
                : lessonAllowance === null
                  ? 'A guided lesson picked for you'
                  : lessonAllowance.remaining > 0
                    ? lessonWaiting
                      ? 'New items unlock as your reviews level up'
                      : `${lessonAllowance.remaining} of ${lessonAllowance.total} lesson items remaining today`
                    : "You've learned enough today. Come back tomorrow, or clear some reviews."
            }
            glyph="学"
            disabled={onVacation}
            muted={
              !onVacation &&
              lessonAllowance !== null &&
              (lessonAllowance.remaining === 0 || lessonWaiting)
            }
            onPress={() => router.push('/lesson')}
            accessibilityLabel={
              onVacation
                ? 'Lessons paused for vacation mode'
                : lessonAllowance !== null && lessonAllowance.remaining === 0
                  ? 'Daily lesson limit reached'
                  : lessonAllowance !== null && lessonWaiting
                    ? 'New lesson items are waiting on reviews'
                    : "Start today's lesson"
            }
            testID="home-learn-button"
          />
        );
      case 'level-progress':
        return level ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`${accessibilitySummary(level, perType, Math.min(100, Math.max(0, overallPercent)))}. View all JLPT levels.`}
            onPress={() => router.push({ pathname: '/levels', params: { level } })}
            testID="home-level-progress-button">
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <LevelProgressBar level={level} perType={perType} overallPercent={overallPercent} />
            </View>
          </PressableScale>
        ) : null;
      case 'review-forecast':
        return !onVacation ? (
          <ReviewForecast forecast={forecast ?? buildReviewForecast([])} />
        ) : null;
      case 'reading-readiness':
        return readingTarget ? (
          <ReadingReadiness
            target={readingTarget}
            onPress={() =>
              router.push(`/browse/passage/${readingTarget.passageId}`, { withAnchor: true })
            }
          />
        ) : null;
      case 'at-risk':
        return !onVacation && atRiskCount > 0 ? (
          <AtRiskSection
            totalCount={atRiskCount}
            topItems={atRiskTopItems}
            allItems={atRiskAllItems}
            onStartRevision={handleStartRevision}
          />
        ) : null;
      default:
        return null;
    }
  }

  const sections = layout.flatMap((entry, i) => {
    if (!entry.visible) return [];
    const content = renderHomeSection(entry.id);
    if (content === null) return [];
    return [
      {
        id: entry.id,
        node: (
          <FadeSlideIn key={entry.id} index={i}>
            {content}
          </FadeSlideIn>
        ),
      },
    ];
  });

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView
        edges={['top', 'left', 'right']}
        className={cn('flex-1', wide ? 'px-space-xl' : 'px-space-lg pt-space-md')}
        style={{
          alignSelf: 'center',
          maxWidth: wide ? undefined : MaxContentWidth,
          width: '100%',
          // Inline: on web SafeAreaView's own inset padding overrides a pt-* class.
          paddingTop: wide ? Spacing.four : undefined,
        }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="gap-space-md pb-space-lg">
          <FadeSlideIn index={0} className="py-space-sm">
            {/* The greeting is the one place a JP glyph opens a tab screen, so it
                is set in the rounded display face rather than the UI family. */}
            <Text className="text-title-lg font-jp-hero-bold text-primary">おかえり！</Text>
            {/* Comprehensible sentence from started vocab; calm invitation on day 1.
                The day-1 fallback is English, so it keeps the UI face. */}
            <Text
              className={cn(
                'mt-space-xs text-body-sm text-muted',
                greetingSentence ? 'font-jp-medium' : 'font-ui-medium',
              )}
              testID="home-greeting-subtitle">
              {greetingSentence ?? 'Welcome back — here’s today at a glance.'}
            </Text>
          </FadeSlideIn>

          {/* Vacation mode takes the hero slot outright rather than dimming the
              ring: a paused goal has nothing honest to show, and a rest that
              looks like a failed day defeats the point of taking one. Pinned —
              not part of the customizable layout — so it still shows even if
              the learner has hidden goal-ring, since it carries the "turn off
              vacation mode" link. */}
          {onVacation ? (
            <FadeSlideIn index={1}>
              <View
                className="items-center rounded-radius-xl bg-surface px-space-md py-space-xl shadow-e2"
                testID="home-vacation-card">
                <View className="h-24 w-24 items-center justify-center rounded-radius-full bg-surface-elevated">
                  <Text className="text-display font-jp-hero-bold text-muted">休</Text>
                </View>
                <Text className="mt-space-md text-body font-ui-extrabold text-primary">
                  Vacation mode is on
                </Text>
                <Text className="mt-space-xs text-center text-caption font-ui text-muted">
                  Reviews and lessons are paused. Nothing is piling up — take your time.
                </Text>
                <Text
                  accessibilityRole="button"
                  accessibilityLabel="Turn off vacation mode in Settings"
                  onPress={() => router.push('/settings')}
                  testID="home-vacation-settings-link"
                  className="mt-space-md min-h-[44px] text-body-sm font-ui-semibold text-brand-text">
                  Turn off vacation mode
                </Text>
              </View>
            </FadeSlideIn>
          ) : null}

          {goalOvershootCard.visible ? (
            <GuidanceCardNotice
              card={GUIDANCE_CARD_BY_ID['goal-overshoot']}
              onDismiss={goalOvershootCard.dismiss}
            />
          ) : null}

          {isLoading ? (
            <ActivityIndicator accessibilityLabel="Loading home stats" />
          ) : null}

          {/* Single conditional banner slot (UX-DR5, brainstorm O2):
              highest-priority eligible banner wins; permanent sections
              below always render. Each banner is keyed so a dismissed one
              slides away and the next one slides in. */}
          {!isLoading && welcomeBackOffer && !welcomeBackDismissed ? (
            <FadeSlideIn key="welcome-back" index={1} exit>
              <WelcomeBackCard
                sliceSize={welcomeBackOffer.sliceSize}
                dueCount={welcomeBackOffer.dueCount}
                onStartSlice={handleStartWelcomeBackSlice}
                onDismiss={() => setWelcomeBackDismissed(true)}
              />
            </FadeSlideIn>
          ) : !isLoading && showCurriculumUpdatedBanner ? (
            <FadeSlideIn key="curriculum-updated" index={1} exit>
              {/* The v2 banner shape (soft jade fill, drawn icon, one line), kept
                  as its own card because this notice carries a dismiss. */}
              <View
                testID="home-curriculum-updated-card"
                className="flex-row items-center gap-space-sm rounded-radius-md bg-brand-soft px-space-md py-space-sm">
                <Icon name="info" size={20} strokeWidth={2} className="text-brand-text" />
                <Text className="flex-1 text-body-sm font-ui-semibold text-brand-text">
                  Curriculum updated — fresh content is live.
                </Text>
                <Text
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss curriculum update notice"
                  onPress={dismissCurriculumUpdatedBanner}
                  testID="home-curriculum-updated-dismiss"
                  className="min-h-[44px] px-space-sm pt-space-sm text-body-sm font-ui-bold text-brand-text">
                  Got it
                </Text>
              </View>
            </FadeSlideIn>
          ) : /* Web only: browser storage is evictable, so a stale backup is a
                 real risk of losing the schedule. Native keeps this in Settings
                 — the OS already backs the sandbox up. Outranks the import
                 nudge: losing progress beats importing more of it. */
            !isLoading && showBackupNudge && !backupNudgeDismissed ? (
            <FadeSlideIn key="backup-nudge" index={1} exit>
              <BackupNudgeCard
                lastBackedUpAt={lastBackedUpAt}
                onBackUp={() => router.push('/settings')}
                onDismiss={() => setBackupNudgeDismissed(true)}
              />
            </FadeSlideIn>
          ) : !isLoading && showImportNudge && !importNudgeDismissed ? (
            <FadeSlideIn key="import-nudge" index={1} exit>
              <ImportNudgeCard
                onImport={() => router.push('/settings')}
                onDismiss={() => setImportNudgeDismissed(true)}
              />
            </FadeSlideIn>
          ) : !isLoading && shouldShowSwitchPrompt ? (
            <FadeSlideIn key="shadow-switch" index={1} exit>
              <ShadowModeSwitchPrompt
                daysActive={shadowModeDaysActive}
                onCommit={handleShadowModeCommit}
                onSnooze={snoozeShadowModePrompt}
                onDismiss={dismissShadowModePrompt}
              />
            </FadeSlideIn>
          ) : null}

          {/* UX-DR3: Review is the primary CTA and sits first by default; the
              reviews-ready count lives here only — never on a tab badge.
              Order and visibility below come from the stored layout — see
              renderHomeSection. */}
          {wide ? (
            <View className="flex-row items-start gap-space-lg">
              <View className="flex-1 gap-space-md">
                {sections.filter((section) => TODAY_COLUMN_SECTIONS.has(section.id)).map(
                  (section) => section.node,
                )}
              </View>
              <View className="flex-1 gap-space-md">
                {sections.filter((section) => !TODAY_COLUMN_SECTIONS.has(section.id)).map(
                  (section) => section.node,
                )}
              </View>
            </View>
          ) : (
            sections.map((section) => section.node)
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
