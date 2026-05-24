import type { ColorSchemeName } from 'react-native';

/** Dark-first default when the OS scheme is null or unknown. */
export function resolveColorScheme(scheme: ColorSchemeName | null): 'light' | 'dark' {
  return scheme === 'light' ? 'light' : 'dark';
}
