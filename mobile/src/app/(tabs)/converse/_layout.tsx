import { Stack } from 'expo-router';
import React from 'react';

export default function ConverseTabLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="history" />
      <Stack.Screen name="session/[id]" />
      <Stack.Screen name="summary/[id]" />
    </Stack>
  );
}
