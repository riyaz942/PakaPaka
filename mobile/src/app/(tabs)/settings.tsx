import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { SessionIntensityPicker } from '@/components/onboarding/SessionIntensityPicker';
import { BottomTabInset, MaxContentWidth } from '@/constants/theme';
import { useDatabase } from '@/data/hooks/useDatabase';
import {
  clearOnboardingCompleted,
  getSessionIntensity,
  getWeaknessBiasEnabled,
  setSessionIntensity,
  setWeaknessBiasEnabled,
} from '@/data/user/preferencesRepository';
import type { SessionIntensity } from '@/data/user/sessionIntensity.types';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { userDb } = useDatabase();
  const [selectedIntensity, setSelectedIntensity] = useState<SessionIntensity | null>(null);
  const [weaknessBiasEnabled, setWeaknessBiasEnabledState] = useState(true);

  useEffect(() => {
    setSelectedIntensity(getSessionIntensity(userDb));
    setWeaknessBiasEnabledState(getWeaknessBiasEnabled(userDb));
  }, [userDb]);

  const handleSelect = (intensity: SessionIntensity) => {
    setSessionIntensity(userDb, intensity);
    setSelectedIntensity(intensity);
  };

  const handleWeaknessBiasToggle = (value: boolean) => {
    setWeaknessBiasEnabled(userDb, value);
    setWeaknessBiasEnabledState(value);
  };

  const handleResetOnboarding = () => {
    clearOnboardingCompleted(userDb);
    router.replace('/onboarding/welcome');
  };

  return (
    <View
      className="flex-1 bg-background px-6"
      style={{
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + BottomTabInset,
        maxWidth: MaxContentWidth,
        alignSelf: 'center',
        width: '100%',
      }}>
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
    </View>
  );
}
