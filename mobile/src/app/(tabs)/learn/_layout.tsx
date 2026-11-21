import { Stack } from 'expo-router';
import React from 'react';

import { browseOnlyScreenLayout } from '@/components/tabs/BrowseOnlyScreenLayout';

/**
 * Retained only to host the `/learn/*` rollout redirects into Browse — the
 * Learn tab itself is gone (FR62). Safe to delete once no shipped build links
 * into these routes.
 */
export default function LearnTabLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} screenLayout={browseOnlyScreenLayout}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[level]" />
      <Stack.Screen name="item/[id]" />
    </Stack>
  );
}
