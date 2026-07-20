import {
  TIME_COMPRESSION_MIN_DOMAINS_FOR_OVERHEAD,
  TIME_COMPRESSION_PER_ITEM_SECONDS,
  TIME_COMPRESSION_SESSION_OVERHEAD_MINUTES,
} from '@/config/constants';

export type DomainCounts = Record<'radical' | 'kanji' | 'vocabulary' | 'grammar', number>;

/** Elapsed ms → whole minutes, floored with a minimum of 1. */
export function formatMinutes(ms: number): number {
  if (ms <= 0) return 1;
  return Math.max(1, Math.floor(ms / 60_000));
}

/**
 * Estimated minutes the same items would take across separate single-purpose
 * apps (FR33b): conservative per-item rates plus app-switching overhead per
 * extra app once the session spans multiple domains. Math.round — the claim
 * is deliberately not inflated.
 */
export function estimateMultiAppMinutes(domainCounts: DomainCounts): number {
  let seconds = 0;
  let domains = 0;
  for (const domain of Object.keys(TIME_COMPRESSION_PER_ITEM_SECONDS) as (keyof DomainCounts)[]) {
    const count = domainCounts[domain];
    if (count > 0) {
      domains += 1;
      seconds += count * TIME_COMPRESSION_PER_ITEM_SECONDS[domain];
    }
  }

  let minutes = Math.round(seconds / 60);
  if (domains >= TIME_COMPRESSION_MIN_DOMAINS_FOR_OVERHEAD) {
    minutes += (domains - 1) * TIME_COMPRESSION_SESSION_OVERHEAD_MINUTES;
  }
  return minutes;
}

/** The compression claim only appears when the estimate actually beats reality. */
export function hasSavings(estimatedMinutes: number, actualMinutes: number): boolean {
  return estimatedMinutes > actualMinutes;
}
