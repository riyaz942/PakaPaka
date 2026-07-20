import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useDatabase } from '@/data/hooks/useDatabase';
import { isVocabularyItemKnown } from '@/data/user/masteryRepository';

/**
 * Whether the learner has mastered one specific vocabulary item — the Tier 1
 * input to `<FuriganaText isKnownWord>` on surfaces rendering that item's own
 * word (FR78 / BUG6).
 *
 * Returns false for a null id or a non-vocabulary item: only vocabulary carries
 * furigana, and only its own mastery may hide it.
 *
 * Re-reads on focus so a still-mounted detail/sheet picks up a promotion from
 * a lesson or review that ran while this screen stayed alive in the tab stack.
 */
export function useIsKnownWord(itemId: string | null | undefined): boolean {
  const { userDb } = useDatabase();
  const [known, setKnown] = useState(() => isVocabularyItemKnown(userDb, itemId));

  const refresh = useCallback(() => {
    setKnown(isVocabularyItemKnown(userDb, itemId));
  }, [userDb, itemId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(refresh);

  return known;
}
