import { Stack } from 'expo-router';
import React from 'react';

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
