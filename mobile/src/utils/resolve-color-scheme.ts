import type { ColorSchemeName } from 'react-native';

/**
 * Dark-first default when the OS scheme is null or unknown.
 *
 * @deprecated Only the legacy template palette (`use-theme.ts`) still uses this.
 * The dark-first fallback disagrees with the NativeWind palette, which is
 * light-first — mixing them paints dark chrome over a light background. Anything
 * rendering next to NativeWind surfaces must use `usePaintedColorScheme()`.
 */
export function resolveColorScheme(scheme: ColorSchemeName | null): 'light' | 'dark' {
  return scheme === 'light' ? 'light' : 'dark';
}
