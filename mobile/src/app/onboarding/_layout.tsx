import { Stack } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { MaxContentWidth } from '@/constants/theme';
import { useWideLayout } from '@/hooks/useWideLayout';

export default function OnboardingLayout() {
  // Desktop web: onboarding is a centered column, not the full window.
  const wide = useWideLayout();

  return (
    <View
      className="w-full flex-1 self-center"
      style={{ maxWidth: wide ? MaxContentWidth : undefined }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="intensity" />
        <Stack.Screen name="day-one" />
        <Stack.Screen name="placement" />
        <Stack.Screen name="complete" />
        <Stack.Screen name="import" />
        <Stack.Screen name="import-summary" />
      </Stack>
    </View>
  );
}
