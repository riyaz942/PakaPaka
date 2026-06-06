import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SessionIntensityPicker } from '@/components/onboarding/SessionIntensityPicker';
import { BottomTabInset, MaxContentWidth } from '@/constants/theme';
import { useDatabase } from '@/data/hooks/useDatabase';
import {
  getSessionIntensity,
  setSessionIntensity,
} from '@/data/user/preferencesRepository';
import type { SessionIntensity } from '@/data/user/sessionIntensity.types';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { userDb } = useDatabase();
  const [selectedIntensity, setSelectedIntensity] = useState<SessionIntensity | null>(null);

  useEffect(() => {
    setSelectedIntensity(getSessionIntensity(userDb));
  }, [userDb]);

  const handleSelect = (intensity: SessionIntensity) => {
    setSessionIntensity(userDb, intensity);
    setSelectedIntensity(intensity);
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
    </View>
  );
}
