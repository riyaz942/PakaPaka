import { Stack } from 'expo-router';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function LessonLayout() {
  return (
    // Card-swipe gestures only resolve under a gesture root, and the app has
    // none above this stack — so the lesson stack hosts its own.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="complete" />
        <Stack.Screen name="item/[id]" />
        <Stack.Screen name="preview/[id]" />
      </Stack>
    </GestureHandlerRootView>
  );
}
