import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { SessionIntensityPicker } from '@/components/onboarding/SessionIntensityPicker';
import {
  cancelAllNotifications,
  requestNotificationPermission,
  scheduleStreakReminder,
} from '@/config/notifications';
import { BottomTabInset, MaxContentWidth } from '@/constants/theme';
import { useDatabase } from '@/data/hooks/useDatabase';
import { useReducedMotion } from '@/data/hooks/useReducedMotion';
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
  type NotificationTime,
} from '@/data/user/preferencesRepository';
import type { SessionIntensity } from '@/data/user/sessionIntensity.types';
import { cn } from '@/utils/cn';

const NOTIFICATION_TIME_OPTIONS: { value: NotificationTime; label: string }[] = [
  { value: 'morning', label: 'Morning (8:00)' },
  { value: 'afternoon', label: 'Afternoon (13:00)' },
  { value: 'evening', label: 'Evening (19:00)' },
  { value: 'night', label: 'Night (21:00)' },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { userDb } = useDatabase();
  const { reducedMotion, setReducedMotion } = useReducedMotion();
  const [selectedIntensity, setSelectedIntensity] = useState<SessionIntensity | null>(null);
  const [weaknessBiasEnabled, setWeaknessBiasEnabledState] = useState(true);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(false);
  const [notificationTime, setNotificationTimeState] = useState<NotificationTime>('evening');
  const [notificationPermissionDenied, setNotificationPermissionDenied] = useState(false);
  const isRequestingPermission = useRef(false);

  useEffect(() => {
    setSelectedIntensity(getSessionIntensity(userDb));
    setWeaknessBiasEnabledState(getWeaknessBiasEnabled(userDb));
    setNotificationsEnabledState(getNotificationsEnabled(userDb));
    setNotificationTimeState(getNotificationTime(userDb));
  }, [userDb]);

  const handleSelect = (intensity: SessionIntensity) => {
    setSessionIntensity(userDb, intensity);
    setSelectedIntensity(intensity);
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
          await scheduleStreakReminder(NOTIFICATION_TIME_HOURS[notificationTime]);
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
      await scheduleStreakReminder(NOTIFICATION_TIME_HOURS[time]);
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
        paddingBottom: insets.bottom + BottomTabInset,
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
