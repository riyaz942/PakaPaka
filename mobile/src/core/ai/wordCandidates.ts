import { parseFurigana } from '@/core/furigana/parseFurigana';

/**
 * Candidate words a learner can flag from an AI reply (FR92).
 *
 * The reply already arrives segmented: furigana bracket notation marks each
 * kanji run explicitly, so the annotated runs are the words worth offering —
 * no tokenizer, no extra model call. Kana-only stretches are left alone because
 * without word boundaries any split would be a guess.
 */

const TRAILING_PUNCTUATION = /[。、！？」』,.)）"'…～\s]+$/u;

export function extractWordCandidates(annotatedText: string): string[] {
  const segments = parseFurigana(annotatedText);
  const seen = new Set<string>();
  const candidates: string[] = [];

  for (const segment of segments) {
    if (!segment.reading) {
      continue;
    }
    // `parseFurigana` folds trailing punctuation into the preceding segment,
    // so strip it back off before offering the word for lookup.
    const word = segment.text.replace(TRAILING_PUNCTUATION, '');
    if (word.length === 0 || seen.has(word)) {
      continue;
    }
    seen.add(word);
    candidates.push(word);
  }

  return candidates;
}
