/** Daily pace tiers, ordered lightest → heaviest. */
export type SessionIntensity = 'light' | 'relaxed' | 'steady' | 'intense' | 'immersive';

export const SESSION_INTENSITY_VALUES: readonly SessionIntensity[] = [
  'light',
  'relaxed',
  'steady',
  'intense',
  'immersive',
] as const;

export function isSessionIntensity(value: string): value is SessionIntensity {
  return (SESSION_INTENSITY_VALUES as readonly string[]).includes(value);
}
