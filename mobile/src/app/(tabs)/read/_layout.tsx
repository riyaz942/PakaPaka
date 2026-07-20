import { Stack } from 'expo-router';
import React from 'react';

/**
 * Retained only to host the `/read/*` rollout redirects into Browse — the Read
 * tab itself is gone (FR63). Safe to delete once no shipped build links here.
 */
export default function ReadTabLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
