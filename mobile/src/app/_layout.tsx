import '@/global.css';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import React, { useEffect } from 'react';
import { useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Banner } from '@/components/common/Banner';
import { usePortraitOrientationLock } from '@/hooks/usePortraitOrientationLock';
import { readUpdatesRuntimeMetadata } from '@/lib/safe-updates-metadata';
import { DatabaseProvider } from '@/providers/DatabaseProvider';
import { useCurriculumUpdateBanner } from '@/providers/CurriculumUpdateContext';
import { resolveColorScheme } from '@/utils/resolve-color-scheme';

function CurriculumUpdateBannerHost() {
  const { showCurriculumUpdatedBanner, dismissCurriculumUpdatedBanner } =
    useCurriculumUpdateBanner();

  return (
    <Banner
      message="Curriculum updated"
      variant="success"
      visible={showCurriculumUpdatedBanner}
      autoDismissMs={3000}
      onDismiss={dismissCurriculumUpdatedBanner}
    />
  );
}

function RootLayoutContent() {
  const colorScheme = useColorScheme();
  const isDark = resolveColorScheme(colorScheme) === 'dark';

  return (
    <View className="flex-1 bg-background">
      <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        <DatabaseProvider>
          <CurriculumUpdateBannerHost />
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

export default function RootLayout() {
  usePortraitOrientationLock();

  useEffect(() => {
    readUpdatesRuntimeMetadata();
  }, []);

  return (
    <SafeAreaProvider>
      <RootLayoutContent />
    </SafeAreaProvider>
  );
}
