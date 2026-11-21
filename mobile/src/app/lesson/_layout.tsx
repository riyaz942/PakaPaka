import { Stack } from 'expo-router';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SyncGate } from '@/components/sync/SyncGate';
import { useHoldCurriculumSwap } from '@/hooks/useHoldCurriculumSwap';

export default function LessonLayout() {
  useHoldCurriculumSwap();

  return (
    // Card-swipe gestures only resolve under a gesture root, and the app has
    // none above this stack — so the lesson stack hosts its own.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SyncGate mode="lesson">
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="complete" />
          <Stack.Screen name="item/[id]" />
          <Stack.Screen name="preview/[id]" />
        </Stack>
      </SyncGate>
    </GestureHandlerRootView>
  );
}
