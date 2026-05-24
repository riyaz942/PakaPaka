/**
 * Legacy template palette for ThemedText/ThemedView until full NativeWind migration.
 * Uses the same dark-first default as NativeWind semantic tokens in global.css (:root + media query).
 *
 * @see https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveColorScheme } from '@/utils/resolve-color-scheme';

export function useTheme() {
  const scheme = useColorScheme();

  return Colors[resolveColorScheme(scheme)];
}
