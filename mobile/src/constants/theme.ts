/**
 * Below are legacy colors used by template components (ThemedText, ThemedView, NativeTabs)
 * until full NativeWind migration. Prefer Tailwind semantic tokens in new UI.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app/), etc.
 */

import { Platform } from 'react-native';

/**
 * @deprecated Use NativeWind tokens from tailwind.config.js — bg-background, text-primary,
 * text-secondary, bg-surface, border-border, text-feedback-info, etc.
 */
export const Colors = {
  light: {
    text: '#1a1a2e',
    background: '#f8f8fa',
    backgroundElement: '#ffffff',
    backgroundSelected: '#e8e8ee',
    textSecondary: '#686878',
    linkPrimary: '#4488ee',
  },
  dark: {
    text: '#eeeef0',
    background: '#0a0a0f',
    backgroundElement: '#141420',
    backgroundSelected: '#252538',
    textSecondary: '#9898a8',
    linkPrimary: '#4488ee',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const MaxContentWidth = 800;
