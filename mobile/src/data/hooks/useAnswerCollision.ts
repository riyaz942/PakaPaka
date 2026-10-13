import { useCallback } from 'react';
import * as wanakana from 'wanakana';

import type { AnswerCollision } from '@/core/answer/answer.types';
import { normalizeMeaning } from '@/core/answer/meaningEvaluator';
import { normalizeKana } from '@/core/answer/readingEvaluator';
import type { ReviewItem } from '@/core/srs/srs.types';
import { findItemsByAcceptedAnswer } from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';

/**
 * Answer-collision detection (FR86): when a graded-incorrect submission is
 * actually another curriculum item's accepted answer, the reveal explains the
 * mixup and links to Compare. Looks up against curriculum accepted answers
 * (and kanji readings) — deliberately broader than the session-queue scan the
 * synonym-add guard uses. Sync exact-match SQL keeps it inside the <100ms
 * feedback hot path (NFR1); hits are re-verified with the shared JS
 * normalization helpers.
 */
export function useAnswerCollision(): (
  item: ReviewItem,
  userAnswer: string,
) => AnswerCollision | null {
  const { curriculumDb } = useDatabase();

  return useCallback(
    (item, userAnswer) => {
      const trimmed = userAnswer.trim();
      if (!trimmed) return null;

      // Production prompts are grammar Build sentences — not meaning/reading lookups.
      // Mapping them to 'reading' would miss grammar collisions or false-hit kana.
      if (item.promptType === 'production') return null;

      const answerType = item.promptType === 'meaning' ? 'meaning' : 'reading';
      const normalize = answerType === 'meaning' ? normalizeMeaning : normalizeKana;
      const normalized = normalize(trimmed);
      if (!normalized) return null;

      // Curriculum on'yomi are stored in katakana while normalizeKana yields
      // hiragana — search both scripts so the SQL exact match can hit either.
      const candidates =
        answerType === 'reading'
          ? [trimmed, normalized, wanakana.toKatakana(normalized)]
          : [trimmed, normalized];

      const matches = findItemsByAcceptedAnswer(curriculumDb, answerType, candidates, item.itemId);
      // Deterministic when multiple items collide — lowest itemId wins so
      // Compare `right` is stable across runs.
      const verified = matches
        .filter((match) => normalize(match.answerText) === normalized)
        .sort((a, b) => a.itemId.localeCompare(b.itemId, undefined, { numeric: true }))[0];
      return verified ? { itemId: verified.itemId, primaryForm: verified.primaryForm } : null;
    },
    [curriculumDb],
  );
}
