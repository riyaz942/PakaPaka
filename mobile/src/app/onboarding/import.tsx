import { router } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';

export default function ImportPlaceholderScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 bg-background px-6"
      style={{ paddingTop: insets.top + 48, paddingBottom: insets.bottom + 16 }}>
      <Text accessibilityRole="header" className="text-title-lg text-primary">
        Import my progress
      </Text>
      <Text className="mt-4 text-body text-secondary">
        Import from WaniKani, Bunpro, or Anki ships in Epic 3. Your progress stays on this device —
        no account required.
      </Text>

      <View className="mt-auto">
        <Button label="Back" onPress={() => router.back()} variant="secondary" />
      </View>
    </View>
  );
}
