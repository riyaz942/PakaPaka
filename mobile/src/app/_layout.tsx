import '@/global.css';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import React, { useEffect } from 'react';
import { useColorScheme, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { usePortraitOrientationLock } from '@/hooks/usePortraitOrientationLock';
import { readUpdatesRuntimeMetadata } from '@/lib/safe-updates-metadata';
import { DatabaseProvider } from '@/providers/DatabaseProvider';
import { resolveColorScheme } from '@/utils/resolve-color-scheme';

export default function RootLayout() {
  usePortraitOrientationLock();

  useEffect(() => {
    readUpdatesRuntimeMetadata();
  }, []);

  const colorScheme = useColorScheme();
  const isDark = resolveColorScheme(colorScheme) === 'dark';

  return (
    <View className="flex-1 bg-background">
      <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        <DatabaseProvider>
          <AnimatedSplashOverlay />
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="review"
              options={{ headerShown: false, presentation: 'fullScreenModal' }}
            />
          </Stack>
        </DatabaseProvider>
      </ThemeProvider>
    </View>
  );
}
