import { useColorScheme as useNativeWindColorScheme } from 'nativewind';
import { useColorScheme as useDeviceColorScheme } from 'react-native';

/**
 * The scheme the app is actually painted in.
 *
 * NativeWind owns the palette (`darkMode: 'media'` + the light override in
 * `global.css`) and resolves **light-first**: it treats a `null`/`'unspecified'`
 * scheme as light and keeps the last valid scheme across app-state transitions.
 * Reading RN's `useColorScheme()` directly can disagree with that — RN reports
 * `null` on Android during startup/activity recreation — which is how the status
 * bar ended up white-on-white over a light background (plan 12.1).
 *
 * Anything that must match the painted surfaces (status bar style, navigation
 * theme, programmatic `getSemanticColors` values) reads the scheme from here.
 */
export function usePaintedColorScheme(): 'light' | 'dark' {
  const { colorScheme } = useNativeWindColorScheme();
  const deviceScheme = useDeviceColorScheme();

  return colorScheme ?? (deviceScheme === 'dark' ? 'dark' : 'light');
}
