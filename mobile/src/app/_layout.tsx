import '@/global.css';
import '@/platform/registerWebAnimatedClassNames';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Banner } from '@/components/common/Banner';
import { appFonts } from '@/constants/fonts';
import { MaxAppWidth } from '@/constants/theme';
import { useThemeMode } from '@/data/hooks/useThemeMode';
import { usePaintedColorScheme } from '@/hooks/use-painted-color-scheme';
import { usePortraitOrientationLock } from '@/hooks/usePortraitOrientationLock';
import { readUpdatesRuntimeMetadata } from '@/lib/safe-updates-metadata';
import { AccountProvider } from '@/providers/AccountProvider';
import { DatabaseProvider } from '@/providers/DatabaseProvider';
import { OnboardingRedirect } from '@/providers/OnboardingRedirect';
import { useCurriculumUpdateBanner } from '@/providers/CurriculumUpdateContext';

function CurriculumUpdateBannerHost() {
  const insets = useSafeAreaInsets();
  const { showCurriculumUpdatedBanner, dismissCurriculumUpdatedBanner } =
    useCurriculumUpdateBanner();

  if (!showCurriculumUpdatedBanner) {
    return null;
  }

  // The banner itself is the inline v2 slot, so this host owns the placement:
  // floated under the status bar rather than a full-bleed bar.
  return (
    <View
      className="absolute left-0 right-0 top-0 z-10 px-space-md"
      style={{ paddingTop: insets.top + 12 }}
      pointerEvents="box-none">
      <Banner
        message="Curriculum updated"
        variant="success"
        visible
        autoDismissMs={3000}
        onDismiss={dismissCurriculumUpdatedBanner}
      />
    </View>
  );
}

/** Re-applies the stored light/dark preference on launch; Settings writes it. */
function ThemeModeHost() {
  useThemeMode();
  return null;
}

function RootLayoutContent() {
  const isDark = usePaintedColorScheme() === 'dark';

  return (
    <View className="flex-1 bg-background">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        <DatabaseProvider>
          <AccountProvider>
            <ThemeModeHost />
            <OnboardingRedirect />
            <CurriculumUpdateBannerHost />
            <AnimatedSplashOverlay />
            {/* A desktop browser window can be any width; the app stays in a
                centered frame. Phones are always narrower than the cap. */}
            <View className="w-full flex-1 self-center" style={{ maxWidth: MaxAppWidth }}>
              <Stack>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding" options={{ headerShown: false }} />
                <Stack.Screen
                  name="review"
                  options={{ headerShown: false, presentation: 'fullScreenModal' }}
                />
                <Stack.Screen
                  name="lesson"
                  options={{ headerShown: false, presentation: 'fullScreenModal' }}
                />
                <Stack.Screen name="levels" options={{ headerShown: false }} />
              </Stack>
            </View>
          </AccountProvider>
        </DatabaseProvider>
      </ThemeProvider>
    </View>
  );
}

// Holds the native splash so the first frame is never drawn in a system font.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  usePortraitOrientationLock();
  const [fontsLoaded, fontError] = useFonts(appFonts);

  useEffect(() => {
    readUpdatesRuntimeMetadata();
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Faces are bundled, so a load failure means a broken build, not a slow
  // network — surface it instead of quietly rendering system fonts.
  if (fontError) {
    throw fontError;
  }

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <RootLayoutContent />
    </SafeAreaProvider>
  );
}
