import '@/global.css';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import React, { useEffect } from 'react';
import { useColorScheme, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { readUpdatesRuntimeMetadata } from '@/lib/safe-updates-metadata';

export default function TabLayout() {
  useEffect(() => {
    readUpdatesRuntimeMetadata();
  }, []);
  const colorScheme = useColorScheme();
  return (
    <View className="flex-1 bg-background">
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <AppTabs />
      </ThemeProvider>
    </View>
  );
}
