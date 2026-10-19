import { Stack } from 'expo-router';
import React from 'react';

export default function SettingsTabLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="home-layout" />
      <Stack.Screen name="about" />
    </Stack>
  );
}
