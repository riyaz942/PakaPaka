import { Stack } from 'expo-router';
import React from 'react';

export default function LearnTabLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[level]" />
      <Stack.Screen name="item/[id]" />
    </Stack>
  );
}
