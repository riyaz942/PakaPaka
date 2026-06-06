export type SessionIntensity = 'relaxed' | 'intense';

export const SESSION_INTENSITY_VALUES: readonly SessionIntensity[] = ['relaxed', 'intense'] as const;

export function isSessionIntensity(value: string): value is SessionIntensity {
  return (SESSION_INTENSITY_VALUES as readonly string[]).includes(value);
}
