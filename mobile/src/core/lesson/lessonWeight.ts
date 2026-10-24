import type { ContentItemType } from '@/core/content/content.types';

export type LessonWeight = 'light' | 'normal' | 'heavy';

export type LessonWeightFacts = {
  itemType: ContentItemType;
  /** Kanji only: count of `builds_on` radical parents. */
  radicalComponentCount?: number;
  /** Vocabulary only: `items.reading_composition`, e.g. "Kun'yomi — 私（わたし）." */
  readingComposition?: string | null;
  /** Vocabulary only: `items.word_type`, e.g. "godan verb, transitive verb". */
  wordType?: string | null;
};

const HEAVY_READING_CATEGORIES = new Set(['Irregular', 'Mixed']);

/**
 * How much load a new item adds to a lesson. Only `heavy` changes selection
 * (capped per lesson); `light` vs `normal` is kept for presentation and tuning.
 */
export function lessonWeight(facts: LessonWeightFacts): LessonWeight {
  switch (facts.itemType) {
    case 'radical':
      return 'light';
    case 'grammar':
      return 'heavy';
    case 'kanji': {
      const count = facts.radicalComponentCount ?? 0;
      if (count >= 3) return 'heavy';
      return count === 2 ? 'normal' : 'light';
    }
    case 'vocabulary': {
      // The category is the text before the first "—"; a missing or unknown one is normal.
      const category = (facts.readingComposition ?? '').split('—')[0].trim();
      if (category === 'Kana only') return 'light';
      if (HEAVY_READING_CATEGORIES.has(category)) return 'heavy';
      if (category === 'Jukugo' && /\bverb\b/.test(facts.wordType ?? '')) return 'heavy';
      return 'normal';
    }
  }
}
