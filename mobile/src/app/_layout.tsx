import '@/global.css';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import React, { useEffect } from 'react';
import { useColorScheme, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { readUpdatesRuntimeMetadata } from '@/lib/safe-updates-metadata';
import { DatabaseProvider } from '@/providers/DatabaseProvider';
import { resolveColorScheme } from '@/utils/resolve-color-scheme';

export default function TabLayout() {
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
          <AppTabs />
        </DatabaseProvider>
      </ThemeProvider>
    </View>
  );
}
