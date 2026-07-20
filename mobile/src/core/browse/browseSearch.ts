import { toHiragana, toKatakana } from 'wanakana';

/**
 * A Browse search query expanded into parallel OR branches (FR65).
 *
 * The raw text is always the first branch and is never replaced — unlike the
 * review screen's `WanaKanaInput`, the Browse field must not rewrite what the
 * learner typed, because "nihon" may legitimately be an English meaning as well
 * as romaji for にほん.
 */
export type BrowseSearchBranches = {
  /** The trimmed query exactly as typed. */
  raw: string;
  /** Kana conversions of the raw query, excluding the raw text itself. */
  kana: string[];
  /** `raw` followed by `kana` — the full OR fan-out, deduplicated. */
  all: string[];
};

const LATIN = /[a-z]/i;

/**
 * Trailing latin characters wanakana could not turn into kana (a partial
 * romaji tail like the "k" in "nihonk"). Dropping the tail keeps the usable
 * kana prefix searchable while the raw branch still covers the literal text.
 */
function stripUnconvertedTail(candidate: string): string | null {
  if (!LATIN.test(candidate)) return candidate;

  const firstLatinIndex = candidate.search(LATIN);
  const prefix = candidate.slice(0, firstLatinIndex);
  return prefix.length > 0 ? prefix : null;
}

/**
 * Expands a raw search query into the branches the Browse fan-out query ORs
 * together. Returns `null` for a blank query so callers can omit the search
 * predicate rather than matching everything against `%%`.
 */
export function buildSearchBranches(query: string): BrowseSearchBranches | null {
  const raw = query.trim();
  if (raw.length === 0) return null;

  const kana: string[] = [];

  // Only romaji needs converting. A query already written in kana or kanji is
  // its own best branch, and round-tripping it would just add noise.
  if (LATIN.test(raw)) {
    for (const converted of [toHiragana(raw), toKatakana(raw)]) {
      const usable = stripUnconvertedTail(converted);
      if (usable && usable !== raw && !kana.includes(usable)) {
        kana.push(usable);
      }
    }
  }

  return { raw, kana, all: [raw, ...kana] };
}
