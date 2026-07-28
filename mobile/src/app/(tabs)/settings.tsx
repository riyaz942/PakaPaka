import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { ByokSettingsSection } from '@/components/converse/ByokSettingsSection';
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
import { cn } from '@/utils/cn';

const NOTIFICATION_TIME_OPTIONS: { value: NotificationTime; label: string }[] = [
  { value: 'morning', label: 'Morning (8:00)' },
  { value: 'afternoon', label: 'Afternoon (13:00)' },
  { value: 'evening', label: 'Evening (19:00)' },
  { value: 'night', label: 'Night (21:00)' },
];

const THEME_MODE_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const FURIGANA_DISPLAY_OPTIONS: { value: FuriganaDisplayMode; label: string }[] = [
  { value: 'auto', label: 'Auto (until known)' },
  { value: 'shown', label: 'Always shown' },
  { value: 'hidden', label: 'Always hidden' },
];

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
  const [goalInput, setGoalInput] = useState('');
  const [goalError, setGoalError] = useState(false);
  const isRequestingPermission = useRef(false);

  useEffect(() => {
    setSelectedIntensity(getSessionIntensity(userDb));
    setWeaknessBiasEnabledState(getWeaknessBiasEnabled(userDb));
    setNotificationsEnabledState(getNotificationsEnabled(userDb));
    setNotificationTimeState(getNotificationTime(userDb));
    setGoalInput(String(resolveDailyGoalTarget(userDb)));
  }, [userDb]);

  const handleGoalCommit = () => {
    const parsed = Number(goalInput);
    const result =
      Number.isFinite(parsed) && parsed > 0
        ? setDailyGoalTarget(userDb, parsed)
        : ({ ok: false } as const);
    if (result.ok) {
      setGoalError(false);
      setGoalInput(String(resolveDailyGoalTarget(userDb)));
    } else {
      setGoalError(true);
    }
  };

  const handleSelect = (intensity: SessionIntensity) => {
    setSessionIntensity(userDb, intensity);
    setSelectedIntensity(intensity);
    // Intensity only seeds the goal while it is unset — refresh the displayed
    // value, but never overwrite a user-set goal.
    setGoalInput(String(resolveDailyGoalTarget(userDb)));
  };

  const handleWeaknessBiasToggle = (value: boolean) => {
    setWeaknessBiasEnabled(userDb, value);
    setWeaknessBiasEnabledState(value);
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
      <ScrollView contentContainerClassName="px-6 pb-space-md">
      <Text accessibilityRole="header" className="text-title-lg text-primary">
        Settings
      </Text>

      <View className="mt-8">
        <Text className="text-body font-semibold text-primary">Session intensity</Text>
        <Text className="mt-1 text-body-sm text-secondary">
          Changes save immediately.
        </Text>

        <View className="mt-4">
          <SessionIntensityPicker
            selectedIntensity={selectedIntensity}
            onSelect={handleSelect}
            testID="settings-intensity-picker"
          />
        </View>
      </View>

      <View className="mt-8">
        <Text className="text-body font-semibold text-primary">Daily goal</Text>
        <Text className="mt-1 text-body-sm text-secondary">
          Your goal ring fills toward this many load units per day. No upper limit — set it as
          high as you like. It also rises with a prompt when you keep beating it.
        </Text>

        <TextInput
          accessibilityLabel="Daily goal"
          testID="settings-daily-goal-input"
          keyboardType="numeric"
          value={goalInput}
          onChangeText={setGoalInput}
          onBlur={handleGoalCommit}
          onSubmitEditing={handleGoalCommit}
          className="mt-4 min-h-[44px] rounded-radius-md border border-border bg-surface px-4 text-body text-primary"
        />
        {goalError ? (
          <Text className="mt-2 text-body-sm text-feedback-incorrect">
            Enter a number greater than zero.
          </Text>
        ) : null}
      </View>

      <View className="mt-8">
        <Text className="text-body font-semibold text-primary">Review queue</Text>

        <View className="mt-4 flex-row items-center justify-between">
          <View className="flex-1 pr-space-md">
            <Text className="text-body text-primary">Bias reviews toward my weak points</Text>
            <Text className="mt-1 text-body-sm text-secondary">
              When enabled, items you often miss appear earlier in the review queue.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Bias reviews toward my weak points"
            testID="settings-weakness-bias-toggle"
            value={weaknessBiasEnabled}
            onValueChange={handleWeaknessBiasToggle}
          />
        </View>
      </View>

      <View className="mt-8">
        <Text className="text-body font-semibold text-primary">Review pacing</Text>

        <View className="mt-4 flex-row items-center justify-between">
          <View className="flex-1 pr-space-md">
            <Text className="text-body text-primary">Auto-advance after correct answers</Text>
            <Text className="mt-1 text-body-sm text-secondary">
              Lightning Mode: move to the next card automatically after a correct answer. When
              off, press Return (or Continue) to advance.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Auto-advance after correct answers"
            testID="settings-review-auto-advance-toggle"
            value={autoAdvanceEnabled}
            onValueChange={setAutoAdvanceEnabled}
          />
        </View>
      </View>

      <View className="mt-8">
        <Text className="text-body font-semibold text-primary">Appearance</Text>
        <Text className="mt-1 text-body-sm text-secondary">
          Light or dark palette. Follows your device setting unless you pick one here.
        </Text>

        <View className="mt-4 flex-row flex-wrap gap-3">
          {THEME_MODE_OPTIONS.map((option) => {
            const selected = themeMode === option.value;

            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={option.label}
                onPress={() => setThemeMode(option.value)}
                testID={`settings-theme-mode-${option.value}`}
                className={cn(
                  'min-h-[44px] min-w-[44px] flex-1 rounded-radius-md bg-surface p-4',
                  selected ? 'border-2 border-feedback-info' : 'border border-border',
                )}>
                <Text className="text-body-sm font-semibold text-primary">{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="mt-8">
        <Text className="text-body font-semibold text-primary">Accessibility</Text>

        <View className="mt-4 flex-row items-center justify-between">
          <View className="flex-1 pr-space-md">
            <Text className="text-body text-primary">Reduce motion</Text>
            <Text className="mt-1 text-body-sm text-secondary">
              Uses stepped, static updates instead of motion. Defaults to your device setting until
              you change it here.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Reduce motion"
            testID="settings-reduced-motion-toggle"
            value={reducedMotion}
            onValueChange={setReducedMotion}
          />
        </View>
      </View>

      <View className="mt-8">
        <Text className="text-body font-semibold text-primary">Furigana</Text>
        <Text className="mt-1 text-body-sm text-secondary">
          Controls the reading shown above kanji. Tap any kanji in a lesson or passage to toggle
          it individually.
        </Text>

        <View className="mt-4 flex-row flex-wrap gap-3">
          {FURIGANA_DISPLAY_OPTIONS.map((option) => {
            const selected = furiganaMode === option.value;

            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={option.label}
                onPress={() => setFuriganaMode(option.value)}
                testID={`settings-furigana-display-${option.value}`}
                className={cn(
                  'min-h-[44px] min-w-[44px] flex-1 rounded-radius-md bg-surface p-4',
                  selected ? 'border-2 border-feedback-info' : 'border border-border',
                )}>
                <Text className="text-body-sm font-semibold text-primary">{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {furiganaOverrides.length > 0 ? (
          <View className="mt-4" testID="settings-furigana-overrides">
            <Text className="text-body-sm font-semibold text-primary">Per-word overrides</Text>
            <Text className="mt-1 text-body-sm text-secondary">
              Words you set individually on their detail page. These win over the setting above.
            </Text>

            {furiganaOverrides.map((override) => (
              <View
                key={override.itemId}
                className="mt-3 flex-row items-center justify-between gap-space-md">
                <View className="flex-1">
                  <Text className="text-body text-primary">{override.primaryForm}</Text>
                  <Text className="text-caption text-secondary">
                    {override.mode === 'shown' ? 'Shown' : 'Hidden'}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Reset furigana override for ${override.primaryForm}`}
                  onPress={() => clearOneFuriganaOverride(override.itemId)}
                  testID={`settings-furigana-override-reset-${override.itemId}`}
                  className="min-h-[44px] min-w-[44px] justify-center rounded-radius-md border border-border px-3">
                  <Text className="text-body-sm text-feedback-info">Reset</Text>
                </Pressable>
              </View>
            ))}

            <View className="mt-4">
              <Button
                label="Reset all overrides"
                variant="secondary"
                onPress={clearAllFuriganaOverrides}
                testID="settings-furigana-overrides-reset"
              />
            </View>
          </View>
        ) : null}
      </View>

      <View className="mt-8">
        <Text className="text-body font-semibold text-primary">Daily reminders</Text>

        <View className="mt-4 flex-row items-center justify-between">
          <View className="flex-1 pr-space-md">
            <Text className="text-body text-primary">Review reminder</Text>
            <Text className="mt-1 text-body-sm text-secondary">
              One reminder per day, at your chosen time.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Enable daily review reminder"
            testID="settings-notifications-toggle"
            value={notificationsEnabled}
            onValueChange={handleNotificationsToggle}
          />
        </View>

        {notificationPermissionDenied ? (
          <Text className="mt-2 text-body-sm text-secondary">
            Please enable notifications in device Settings to use this feature.
          </Text>
        ) : null}

        {notificationsEnabled ? (
          <View className="mt-4 flex-row flex-wrap gap-3">
            {NOTIFICATION_TIME_OPTIONS.map((option) => {
              const selected = notificationTime === option.value;

              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={option.label}
                  onPress={() => handleNotificationTimeChange(option.value)}
                  testID={`settings-notification-time-${option.value}`}
                  className={cn(
                    'min-h-[44px] min-w-[44px] flex-1 rounded-radius-md bg-surface p-4',
                    selected ? 'border-2 border-feedback-info' : 'border border-border',
                  )}>
                  <Text className="text-body-sm font-semibold text-primary">{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {shadowModeCanEnable ? (
        <View className="mt-8">
          <Text className="text-body font-semibold text-primary">Shadow mode</Text>

          <View className="mt-4 flex-row items-center justify-between">
            <View className="flex-1 pr-space-md">
              <Text className="text-body text-primary">Shadow mode</Text>
              <Text className="mt-1 text-body-sm text-secondary">
                Run this app alongside your current tools and compare your results before you
                fully switch. Nothing is deleted.
              </Text>
            </View>
            <Switch
              accessibilityLabel="Shadow mode"
              testID="settings-shadow-mode-toggle"
              value={shadowModeEnabled}
              onValueChange={handleShadowModeToggle}
            />
          </View>
        </View>
      ) : null}

      <ByokSettingsSection />

      {__DEV__ ? (
        <View className="mt-10">
          <Text className="text-body font-semibold text-primary">Developer</Text>
          <Text className="mt-1 text-body-sm text-secondary">
            Clears onboarding completion only. Level and intensity preferences are kept.
          </Text>
          <Button
            label="Reset onboarding"
            onPress={handleResetOnboarding}
            variant="secondary"
            className="mt-4 w-full"
            testID="dev-reset-onboarding"
          />
        </View>
      ) : null}
      </ScrollView>
    </View>
  );
}
