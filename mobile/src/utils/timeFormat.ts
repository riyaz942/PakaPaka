export type DomainCounts = Record<'radical' | 'kanji' | 'vocabulary' | 'grammar', number>;

/** Elapsed ms → whole minutes, floored with a minimum of 1. */
export function formatMinutes(ms: number): number {
  if (ms <= 0) return 1;
  return Math.max(1, Math.floor(ms / 60_000));
}
