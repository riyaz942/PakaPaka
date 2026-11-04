import { Redirect, Stack } from 'expo-router';
import React from 'react';

import { supportsTalk } from '@/platform/capabilities';

export default function ConverseTabLayout() {
  if (!supportsTalk()) {
    return <Redirect href="/" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="history" />
      <Stack.Screen name="session/[id]" />
      <Stack.Screen name="summary/[id]" />
    </Stack>
  );
}
