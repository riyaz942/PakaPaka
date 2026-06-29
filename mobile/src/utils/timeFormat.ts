import {
  TIME_COMPRESSION_MIN_DOMAINS_FOR_OVERHEAD,
  TIME_COMPRESSION_PER_ITEM_SECONDS,
  TIME_COMPRESSION_SESSION_OVERHEAD_MINUTES,
} from '@/config/constants';

export type DomainCounts = Record<'radical' | 'kanji' | 'vocabulary' | 'grammar', number>;

export type TimeCompressionInput = {
  durationMs: number;
  domainCounts: DomainCounts;
};

export type TimeCompressionResult = {
  actualMinutes: number;
  estimatedMinutes: number;
  savedMinutes: number;
  hasSavings: boolean;
};

/** Elapsed ms → whole minutes, floored with a minimum of 1. */
export function formatMinutes(ms: number): number {
  if (ms <= 0) return 1;
  return Math.max(1, Math.floor(ms / 60_000));
}

/** Sum per-item seconds, convert to minutes, add session overhead when ≥2 domains. */
export function estimateMultiAppMinutes(counts: DomainCounts): number {
  let totalSeconds = 0;
  let domainsWithItems = 0;

  for (const type of ['radical', 'kanji', 'vocabulary', 'grammar'] as const) {
    const count = counts[type];
    if (count > 0) {
      domainsWithItems += 1;
      totalSeconds += TIME_COMPRESSION_PER_ITEM_SECONDS[type] * count;
    }
  }

  let minutes = totalSeconds / 60;
  if (domainsWithItems >= TIME_COMPRESSION_MIN_DOMAINS_FOR_OVERHEAD) {
    minutes += TIME_COMPRESSION_SESSION_OVERHEAD_MINUTES;
  }

  return Math.round(minutes);
}

export function computeTimeCompression(input: TimeCompressionInput): TimeCompressionResult {
  const actualMinutes = formatMinutes(input.durationMs);
  const estimatedMinutes = estimateMultiAppMinutes(input.domainCounts);
  const hasSavings = estimatedMinutes > actualMinutes;
  const savedMinutes = hasSavings ? estimatedMinutes - actualMinutes : 0;

  return { actualMinutes, estimatedMinutes, savedMinutes, hasSavings };
}
