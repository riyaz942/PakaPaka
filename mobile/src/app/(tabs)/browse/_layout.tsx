import { Stack } from 'expo-router';
import React from 'react';

// Keeps the Browse list under a detail screen pushed from another tab (e.g.
// Home → passage), so the Browse tab never gets stuck on that detail.
export const unstable_settings = { initialRouteName: 'index' };

export default function BrowseTabLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="item/[id]" />
      <Stack.Screen name="compare" />
      <Stack.Screen name="passage/[id]" />
    </Stack>
  );
}
