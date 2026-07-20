import { useEffect, useState } from 'react';

import { useDatabase } from '@/data/hooks/useDatabase';
import {
  getOnboardingPath,
  getSeenKanjiReadingPrimer,
  setSeenKanjiReadingPrimer,
} from '@/data/user/preferencesRepository';

type PrimerInput = {
  itemId: string | null;
  isDualReadingKanji: boolean;
};

/**
 * Items that already showed the unprompted primer this JS runtime. Survives
 * remounts of the lesson section pager (`FadeSlideIn` keys on section index)
 * after `seenKanjiReadingPrimer` is written — otherwise the effect would see
 * the flag and yank the primer mid-item.
 */
const primerShownThisSession = new Set<string>();

/**
 * Gates the unprompted on'yomi/kun'yomi primer (FR74, AC #5).
 *
 * Shows only for an absolute beginner (`onboarding_path = 'beginner'`) who has
 * not seen it, on the first kanji carrying *both* reading types. Manual and
 * import learners never get it unprompted — they reach the same explainer from
 * the readings heading instead.
 *
 * The flag is written the moment the primer becomes visible, not on Continue:
 * a learner who quits mid-lesson has still seen it, and "shown once" must
 * survive that. Session latch keeps it on-screen for the rest of that item
 * even when the flag is already true.
 */
export function useKanjiReadingPrimer({ itemId, isDualReadingKanji }: PrimerInput): boolean {
  const { userDb } = useDatabase();
  const [showPrimer, setShowPrimer] = useState(false);

  useEffect(() => {
    if (!itemId || !isDualReadingKanji) {
      setShowPrimer(false);
      return;
    }

    if (primerShownThisSession.has(itemId)) {
      setShowPrimer(true);
      return;
    }

    if (getOnboardingPath(userDb) !== 'beginner' || getSeenKanjiReadingPrimer(userDb)) {
      setShowPrimer(false);
      return;
    }

    setSeenKanjiReadingPrimer(userDb);
    primerShownThisSession.add(itemId);
    setShowPrimer(true);
  }, [userDb, itemId, isDualReadingKanji]);

  return showPrimer;
}

/** Test-only: clear the session latch between cases. */
export function __resetKanjiReadingPrimerSessionForTests(): void {
  primerShownThisSession.clear();
}
