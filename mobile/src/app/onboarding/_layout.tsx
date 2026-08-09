import { Stack } from 'expo-router';
import React from 'react';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="intensity" />
      <Stack.Screen name="day-one" />
      <Stack.Screen name="placement" />
      <Stack.Screen name="complete" />
      <Stack.Screen name="import" />
      <Stack.Screen name="import-summary" />
    </Stack>
  );
}
