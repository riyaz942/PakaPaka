import { Stack } from 'expo-router';
import React from 'react';

import { browseOnlyScreenLayout } from '@/components/tabs/BrowseOnlyScreenLayout';

export default function SettingsTabLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} screenLayout={browseOnlyScreenLayout}>
      <Stack.Screen name="index" />
      <Stack.Screen name="home-layout" />
      <Stack.Screen name="about" />
    </Stack>
  );
}
