import React from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function IntensityPlaceholderScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 bg-background px-6"
      style={{ paddingTop: insets.top + 48, paddingBottom: insets.bottom + 16 }}>
      <Text accessibilityRole="header" className="text-title-lg text-primary">
        Session intensity
      </Text>
      <Text className="mt-2 text-body-sm text-secondary">Session intensity — coming next</Text>
    </View>
  );
}
