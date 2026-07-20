import { useMemo } from 'react';

import { useDatabase } from '@/data/hooks/useDatabase';
import { isVocabularyItemKnown } from '@/data/user/masteryRepository';

/**
 * Whether the learner has mastered one specific vocabulary item — the Tier 1
 * input to `<FuriganaText isKnownWord>` on surfaces rendering that item's own
 * word (FR78 / BUG6).
 *
 * Returns false for a null id or a non-vocabulary item: only vocabulary carries
 * furigana, and only its own mastery may hide it.
 */
export function useIsKnownWord(itemId: string | null | undefined): boolean {
  const { userDb } = useDatabase();

  return useMemo(() => isVocabularyItemKnown(userDb, itemId), [userDb, itemId]);
}
