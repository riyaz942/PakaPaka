import { Stack } from 'expo-router';
import React from 'react';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="intensity" />
      <Stack.Screen name="calibrate" />
      <Stack.Screen name="bulk" />
      <Stack.Screen name="complete" />
      <Stack.Screen name="import" />
      <Stack.Screen name="import-summary" />
    </Stack>
  );
}
