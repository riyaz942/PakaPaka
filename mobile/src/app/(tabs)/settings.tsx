import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { ChoiceCard } from '@/components/common/ChoiceCard';
import { ExplainerSheet } from '@/components/common/ExplainerSheet';
import { ScreenTitle } from '@/components/common/ScreenTitle';
import { SectionHeading } from '@/components/common/SectionHeading';
import { SegmentedPill, type SegmentedPillOption } from '@/components/common/SegmentedPill';
import { StepperRow } from '@/components/common/StepperRow';
import { ToggleRow } from '@/components/common/ToggleRow';
import { ByokSettingsSection } from '@/components/converse/ByokSettingsSection';
import {
  GUIDANCE_CARD_BY_ID,
  GUIDANCE_CARDS,
  type GuidanceCard,
  type GuidanceCardId,
} from '@/components/onboarding/cardRegistry';
import { SessionIntensityPicker } from '@/components/onboarding/SessionIntensityPicker';
import {
  cancelAllNotifications,
  requestNotificationPermission,
  scheduleReviewReminder,
} from '@/config/notifications';
import { MaxContentWidth } from '@/constants/theme';
import { useDatabase } from '@/data/hooks/useDatabase';
import { useFuriganaOverrideList } from '@/data/hooks/useFuriganaOverrideList';
import { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';
import { useReducedMotion } from '@/data/hooks/useReducedMotion';
import { useReviewAutoAdvance } from '@/data/hooks/useReviewAutoAdvance';
import { useShadowMode } from '@/data/hooks/useShadowMode';
import { useThemeMode } from '@/data/hooks/useThemeMode';
import { useVacationMode } from '@/data/hooks/useVacationMode';
import { exportBackup } from '@/data/user/exportBackup';
import {
  clearOnboardingCompleted,
  getNotificationTime,
  getNotificationsEnabled,
  getSessionIntensity,
  getWeaknessBiasEnabled,
  NOTIFICATION_TIME_HOURS,
  setNotificationTime,
  setNotificationsEnabled,
  setSessionIntensity,
  setWeaknessBiasEnabled,
  type FuriganaDisplayMode,
  type NotificationTime,
  type ThemeMode,
} from '@/data/user/preferencesRepository';
import {
  resolveDailyGoalTarget,
  setDailyGoalTarget,
} from '@/data/user/goalRingRepository';
import type { SessionIntensity } from '@/data/user/sessionIntensity.types';

const NOTIFICATION_TIME_OPTIONS: { value: NotificationTime; label: string }[] = [
  { value: 'morning', label: 'Morning (8:00)' },
  { value: 'afternoon', label: 'Afternoon (13:00)' },
  { value: 'evening', label: 'Evening (19:00)' },
  { value: 'night', label: 'Night (21:00)' },
];

/** Spec order: the device-following option sits last and is labelled "Auto". */
const THEME_MODE_OPTIONS: readonly SegmentedPillOption<ThemeMode>[] = [
  { value: 'light', label: 'Light', testID: 'settings-theme-mode-light' },
  { value: 'dark', label: 'Dark', testID: 'settings-theme-mode-dark' },
  { value: 'system', label: 'Auto', testID: 'settings-theme-mode-system' },
];

const FURIGANA_DISPLAY_OPTIONS: { value: FuriganaDisplayMode; label: string }[] = [
  { value: 'auto', label: 'Auto (until known)' },
  { value: 'shown', label: 'Always shown' },
  { value: 'hidden', label: 'Always hidden' },
];

/** The daily goal moves in load units; 5 is one small item's worth of load. */
const DAILY_GOAL_STEP = 5;

function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatVacationStart(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'earlier';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Grouped settings card — the spec stacks related rows behind one border. */
function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <View className="mt-space-sm rounded-radius-md border border-border bg-surface px-space-md shadow-e1">
      {children}
    </View>
  );
}

function CardDivider({ children }: { children: React.ReactNode }) {
  return <View className="border-b border-border">{children}</View>;
}

/**
 * One row of the "How this works" library. Not a `ChoiceCard`: that is a radio
 * with a required `selected` prop, and nothing here is being selected — the row
 * just opens the card.
 */
function GuidanceLibraryRow({ card, onPress }: { card: GuidanceCard; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Explain: ${card.title}`}
      onPress={onPress}
      testID={`settings-guidance-card-${card.id}`}
      className="min-h-[44px] justify-center py-space-sm">
      <Text className="text-body font-ui-medium text-primary">{card.title}</Text>
    </Pressable>
  );
}

/** One sheet for the whole section, driven by which row was tapped. */
function GuidanceLibrarySheet({ card, onDismiss }: { card: GuidanceCard; onDismiss: () => void }) {
  const { Render } = card;

  return (
    <ExplainerSheet title={card.title} visible onDismiss={onDismiss}>
      <Render />
    </ExplainerSheet>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { userDb } = useDatabase();
  const { reducedMotion, setReducedMotion } = useReducedMotion();
  const { mode: themeMode, setMode: setThemeMode } = useThemeMode();
  const { mode: furiganaMode, setMode: setFuriganaMode } = useFuriganaPreference();
  const {
    entries: furiganaOverrides,
    clearOne: clearOneFuriganaOverride,
    clearAll: clearAllFuriganaOverrides,
  } = useFuriganaOverrideList();
  const { autoAdvanceEnabled, setAutoAdvanceEnabled } = useReviewAutoAdvance();
  const {
    isVacationActive,
    startedAt: vacationStartedAt,
    start: startVacationMode,
    end: endVacationMode,
  } = useVacationMode();
  const {
    canEnable: shadowModeCanEnable,
    isEnabled: shadowModeEnabled,
    enable: enableShadowMode,
    disable: disableShadowMode,
  } = useShadowMode();
  const [selectedIntensity, setSelectedIntensity] = useState<SessionIntensity | null>(null);
  const [weaknessBiasEnabled, setWeaknessBiasEnabledState] = useState(true);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(false);
  const [notificationTime, setNotificationTimeState] = useState<NotificationTime>('evening');
  const [notificationPermissionDenied, setNotificationPermissionDenied] = useState(false);
  const [dailyGoal, setDailyGoal] = useState(DAILY_GOAL_STEP);
  const [vacationResultMessage, setVacationResultMessage] = useState<string | null>(null);
  const [openCardId, setOpenCardId] = useState<GuidanceCardId | null>(null);
  const [includeConversationsInBackup, setIncludeConversationsInBackup] = useState(false);
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [backupResult, setBackupResult] = useState<{
    itemCount: number;
    byteSize: number;
    omittedCount: number;
  } | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const isRequestingPermission = useRef(false);

  const openCard = openCardId ? GUIDANCE_CARD_BY_ID[openCardId] : null;

  useEffect(() => {
    setSelectedIntensity(getSessionIntensity(userDb));
    setWeaknessBiasEnabledState(getWeaknessBiasEnabled(userDb));
    setNotificationsEnabledState(getNotificationsEnabled(userDb));
    setNotificationTimeState(getNotificationTime(userDb));
    setDailyGoal(resolveDailyGoalTarget(userDb));
  }, [userDb]);

  const handleGoalChange = (next: number) => {
    const result = setDailyGoalTarget(userDb, next);
    if (result.ok) {
      setDailyGoal(resolveDailyGoalTarget(userDb));
    }
  };

  const handleSelect = (intensity: SessionIntensity) => {
    setSessionIntensity(userDb, intensity);
    setSelectedIntensity(intensity);
    // Intensity only seeds the goal while it is unset — refresh the displayed
    // value, but never overwrite a user-set goal.
    setDailyGoal(resolveDailyGoalTarget(userDb));
  };

  const handleWeaknessBiasToggle = (value: boolean) => {
    setWeaknessBiasEnabled(userDb, value);
    setWeaknessBiasEnabledState(value);
  };

  const handleVacationToggle = (value: boolean) => {
    if (value) {
      startVacationMode();
      setVacationResultMessage(null);
      return;
    }
    const result = endVacationMode();
    if (!result.ok) {
      setVacationResultMessage(result.error.userMessage ?? result.error.message);
      return;
    }
    const { shiftedCount } = result.value;
    setVacationResultMessage(
      shiftedCount > 0
        ? `Welcome back — ${shiftedCount} ${shiftedCount === 1 ? 'review' : 'reviews'} rescheduled.`
        : 'Welcome back — nothing needed rescheduling.',
    );
  };

  const handleNotificationsToggle = async (value: boolean) => {
    if (isRequestingPermission.current) return;
    if (value) {
      isRequestingPermission.current = true;
      try {
        const granted = await requestNotificationPermission();
        if (granted) {
          setNotificationsEnabled(userDb, true);
          setNotificationsEnabledState(true);
          setNotificationPermissionDenied(false);
          await scheduleReviewReminder(NOTIFICATION_TIME_HOURS[notificationTime]);
        } else {
          setNotificationPermissionDenied(true);
        }
      } finally {
        isRequestingPermission.current = false;
      }
      return;
    }

    setNotificationsEnabled(userDb, false);
    setNotificationsEnabledState(false);
    setNotificationPermissionDenied(false);
    await cancelAllNotifications();
  };

  const handleNotificationTimeChange = async (time: NotificationTime) => {
    setNotificationTime(userDb, time);
    setNotificationTimeState(time);
    if (notificationsEnabled) {
      await scheduleReviewReminder(NOTIFICATION_TIME_HOURS[time]);
    }
  };

  const handleShadowModeToggle = (value: boolean) => {
    if (value) {
      enableShadowMode();
    } else {
      disableShadowMode();
    }
  };

  const handleExportBackup = async () => {
    setIsExportingBackup(true);
    setBackupError(null);
    setBackupResult(null);

    try {
      const result = await exportBackup(userDb, {
        includeConversations: includeConversationsInBackup,
      });

      if (!result.ok) {
        setBackupError(result.error.userMessage ?? result.error.message);
        return;
      }

      setBackupResult({
        itemCount: result.value.itemCount,
        byteSize: result.value.byteSize,
        omittedCount: result.value.omittedCount,
      });

      try {
        const canShare = await Sharing.isAvailableAsync();
        if (!canShare) {
          setBackupError(
            'Sharing is unavailable. The backup was saved on this device, but the share sheet could not be opened.',
          );
        } else {
          await Sharing.shareAsync(result.value.fileUri, {
            mimeType: 'application/gzip',
            dialogTitle: 'Back up your progress',
          });
        }
      } catch {
        setBackupError('Could not open the share sheet.');
      }
    } finally {
      setIsExportingBackup(false);
    }
  };

  const handleResetOnboarding = () => {
    clearOnboardingCompleted(userDb);
    router.replace('/onboarding/welcome');
  };

  return (
    <View
      className="flex-1 bg-background"
      style={{
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom,
        maxWidth: MaxContentWidth,
        alignSelf: 'center',
        width: '100%',
      }}>
      <ScrollView contentContainerClassName="px-6 pb-space-xl">
        <ScreenTitle>Settings</ScreenTitle>

        <View className="mt-space-lg">
          <SectionHeading label="Session" />
          <Text className="mt-space-xs text-caption font-ui-medium text-muted">
            Changes save immediately.
          </Text>

          <View className="mt-space-sm">
            <SessionIntensityPicker
              selectedIntensity={selectedIntensity}
              onSelect={handleSelect}
              testID="settings-intensity-picker"
            />
          </View>

          <SettingsCard>
            <StepperRow
              label="Daily goal"
              description="load units · no upper limit"
              value={dailyGoal}
              onValueChange={handleGoalChange}
              step={DAILY_GOAL_STEP}
              min={DAILY_GOAL_STEP}
              unitLabel="load units"
              testID="settings-daily-goal"
            />
          </SettingsCard>
          <Text className="mt-space-xs text-caption font-ui-medium text-muted">
            Your goal ring fills toward this many load units per day. It also rises with a prompt
            when you keep beating it.
          </Text>
        </View>

        <View className="mt-space-lg">
          <SectionHeading label="Review queue" />
          <SettingsCard>
            <CardDivider>
              <ToggleRow
                label="Bias reviews toward my weak points"
                description="Items you often miss come earlier in the queue."
                value={weaknessBiasEnabled}
                onValueChange={handleWeaknessBiasToggle}
                testID="settings-weakness-bias-toggle"
              />
            </CardDivider>
            <CardDivider>
              <ToggleRow
                label="Auto-advance after correct answers"
                description="Lightning Mode: move to the next card automatically after a correct answer. When off, press Return (or Continue) to advance."
                value={autoAdvanceEnabled}
                onValueChange={setAutoAdvanceEnabled}
                testID="settings-review-auto-advance-toggle"
              />
            </CardDivider>
            <ToggleRow
              label="Pause reviews and lessons"
              description={
                isVacationActive && vacationStartedAt
                  ? `Paused since ${formatVacationStart(vacationStartedAt)}. Turn this off when you're back and your reviews pick up where they left off.`
                  : 'Vacation mode — nothing piles up while this is on, and your reviews resume where you left off.'
              }
              value={isVacationActive}
              onValueChange={handleVacationToggle}
              testID="settings-vacation-mode-toggle"
            />
          </SettingsCard>

          {vacationResultMessage !== null ? (
            <Text
              className="mt-space-sm text-caption font-ui-medium text-muted"
              testID="settings-vacation-result">
              {vacationResultMessage}
            </Text>
          ) : null}
        </View>

        <View className="mt-space-lg">
          <SectionHeading label="Appearance" />
          <SettingsCard>
            <View className="flex-row items-center justify-between gap-space-md py-space-sm">
              <Text className="text-body font-ui-semibold text-primary">Theme</Text>
              <SegmentedPill
                accessibilityLabel="Theme"
                options={THEME_MODE_OPTIONS}
                value={themeMode}
                onChange={setThemeMode}
              />
            </View>
          </SettingsCard>
        </View>

        <View className="mt-space-lg">
          <SectionHeading label="Accessibility" />
          <SettingsCard>
            <ToggleRow
              label="Reduce motion"
              description="Uses stepped, static updates instead of motion. Defaults to your device setting until you change it here."
              value={reducedMotion}
              onValueChange={setReducedMotion}
              testID="settings-reduced-motion-toggle"
            />
          </SettingsCard>
        </View>

        <View className="mt-space-lg">
          <SectionHeading label="Furigana" />
          <Text className="mt-space-xs text-caption font-ui-medium text-muted">
            Controls the reading shown above kanji. Tap any kanji in a lesson or passage to toggle
            it individually.
          </Text>

          <View className="mt-space-sm flex-row flex-wrap gap-space-sm">
            {FURIGANA_DISPLAY_OPTIONS.map((option) => (
              <ChoiceCard
                key={option.value}
                title={option.label}
                selected={furiganaMode === option.value}
                onPress={() => setFuriganaMode(option.value)}
                testID={`settings-furigana-display-${option.value}`}
                className="min-w-[44px] flex-1"
              />
            ))}
          </View>

          {furiganaOverrides.length > 0 ? (
            <View className="mt-space-md" testID="settings-furigana-overrides">
              <SectionHeading label="Per-word overrides" />
              <Text className="mt-space-xs text-caption font-ui-medium text-muted">
                Words you set individually on their detail page. These win over the setting above.
              </Text>

              <SettingsCard>
                {furiganaOverrides.map((override) => (
                  <View
                    key={override.itemId}
                    className="min-h-[56px] flex-row items-center gap-space-md py-space-sm">
                    <View className="flex-1">
                      <Text className="text-body font-jp-medium text-primary">
                        {override.primaryForm}
                      </Text>
                      <Text className="mt-[3px] text-caption font-ui-medium text-muted">
                        {override.mode === 'shown' ? 'Shown' : 'Hidden'}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Reset furigana override for ${override.primaryForm}`}
                      onPress={() => clearOneFuriganaOverride(override.itemId)}
                      testID={`settings-furigana-override-reset-${override.itemId}`}
                      className="min-h-[44px] min-w-[44px] justify-center px-space-sm">
                      <Text className="text-body-sm font-ui-bold text-brand-text">Reset</Text>
                    </Pressable>
                  </View>
                ))}
              </SettingsCard>

              <Button
                label="Reset all overrides"
                variant="destructive"
                onPress={clearAllFuriganaOverrides}
                className="mt-space-sm w-full"
                testID="settings-furigana-overrides-reset"
              />
            </View>
          ) : null}
        </View>

        <View className="mt-space-lg">
          <SectionHeading label="Backup" />
          <Text className="mt-space-xs text-caption font-ui-medium text-muted">
            Export your progress to a file you keep. Nothing is uploaded — the file goes straight to
            wherever you choose to save it.
          </Text>

          <SettingsCard>
            <ToggleRow
              label="Include AI conversations"
              description="Off by default. Chat transcripts can be large and are not needed to restore your progress."
              value={includeConversationsInBackup}
              onValueChange={setIncludeConversationsInBackup}
              testID="settings-backup-include-conversations-toggle"
            />
          </SettingsCard>

          <Button
            label={isExportingBackup ? 'Exporting…' : 'Back up my progress'}
            onPress={handleExportBackup}
            disabled={isExportingBackup}
            className="mt-space-sm w-full"
            testID="settings-backup-export-button"
          />

          {backupResult ? (
            <View className="mt-space-sm">
              <Text
                className="text-caption font-ui-medium text-muted"
                testID="settings-backup-result">
                {`Exported ${backupResult.itemCount} ${backupResult.itemCount === 1 ? 'row' : 'rows'} · ${formatByteSize(backupResult.byteSize)}`}
              </Text>
              {backupResult.omittedCount > 0 ? (
                <Text
                  className="mt-space-xs text-caption font-ui-medium text-muted"
                  testID="settings-backup-omitted">
                  {`${backupResult.omittedCount} ${backupResult.omittedCount === 1 ? 'item was' : 'items were'} skipped — no longer in the curriculum.`}
                </Text>
              ) : null}
            </View>
          ) : null}

          {backupError ? (
            <Text
              className="mt-space-sm text-caption font-ui-medium text-feedback-incorrect-deep"
              testID="settings-backup-error">
              {backupError}
            </Text>
          ) : null}
        </View>

        <View className="mt-space-lg">
          <SectionHeading label="Daily reminders" />
          <SettingsCard>
            <ToggleRow
              label="Review reminder"
              description="One reminder per day, at your chosen time."
              value={notificationsEnabled}
              onValueChange={handleNotificationsToggle}
              testID="settings-notifications-toggle"
            />
          </SettingsCard>

          {notificationPermissionDenied ? (
            <Text className="mt-space-sm text-caption font-ui-medium text-muted">
              Please enable notifications in device Settings to use this feature.
            </Text>
          ) : null}

          {notificationsEnabled ? (
            <View className="mt-space-sm flex-row flex-wrap gap-space-sm">
              {NOTIFICATION_TIME_OPTIONS.map((option) => (
                <ChoiceCard
                  key={option.value}
                  title={option.label}
                  selected={notificationTime === option.value}
                  onPress={() => handleNotificationTimeChange(option.value)}
                  testID={`settings-notification-time-${option.value}`}
                  className="min-w-[44px] flex-1"
                />
              ))}
            </View>
          ) : null}
        </View>

        {shadowModeCanEnable ? (
          <View className="mt-space-lg">
            <SectionHeading label="Shadow mode" />
            <SettingsCard>
              <ToggleRow
                label="Shadow mode"
                description="Run this app alongside your current tools and compare your results before you fully switch. Nothing is deleted."
                value={shadowModeEnabled}
                onValueChange={handleShadowModeToggle}
                testID="settings-shadow-mode-toggle"
              />
            </SettingsCard>
          </View>
        ) : null}

        <ByokSettingsSection />

        {/* The whole registry, in registry order, deck cards included — the
            library is how the day-1 deck stays reachable after onboarding.
            Opening a card here never writes `card_seen`: reading the manual
            does not consume the just-in-time moment. */}
        <View className="mt-space-lg">
          <SectionHeading label="How this works" />
          <Text className="mt-space-xs text-caption font-ui-medium text-muted">
            Short explanations of the things the app does that are easy to
            mistake for a bug.
          </Text>
          <SettingsCard>
            {GUIDANCE_CARDS.map((card, index) => {
              const row = (
                <GuidanceLibraryRow card={card} onPress={() => setOpenCardId(card.id)} />
              );
              return index === GUIDANCE_CARDS.length - 1 ? (
                <React.Fragment key={card.id}>{row}</React.Fragment>
              ) : (
                <CardDivider key={card.id}>{row}</CardDivider>
              );
            })}
          </SettingsCard>
          {openCard ? (
            <GuidanceLibrarySheet card={openCard} onDismiss={() => setOpenCardId(null)} />
          ) : null}
        </View>

        {__DEV__ ? (
          <View className="mt-space-lg">
            <SectionHeading label="Developer" />
            <Text className="mt-space-xs text-caption font-ui-medium text-muted">
              Clears onboarding completion only. Level and intensity preferences are kept.
            </Text>
            <Button
              label="Reset onboarding"
              onPress={handleResetOnboarding}
              variant="destructive"
              className="mt-space-sm w-full"
              testID="dev-reset-onboarding"
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
