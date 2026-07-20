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
 * Gates the unprompted on'yomi/kun'yomi primer (FR74, AC #5).
 *
 * Shows only for an absolute beginner (`onboarding_path = 'beginner'`) who has
 * not seen it, on the first kanji carrying *both* reading types. Manual and
 * import learners never get it unprompted — they reach the same explainer from
 * the readings heading instead.
 *
 * The flag is written the moment the primer becomes visible, not on Continue:
 * a learner who quits mid-lesson has still seen it, and "shown once" must
 * survive that. `showPrimer` is held in state so writing the flag does not
 * yank the primer out from under the reader on the next render.
 */
export function useKanjiReadingPrimer({ itemId, isDualReadingKanji }: PrimerInput): boolean {
  const { userDb } = useDatabase();
  const [showPrimer, setShowPrimer] = useState(false);

  useEffect(() => {
    if (!itemId || !isDualReadingKanji) {
      setShowPrimer(false);
      return;
    }

    if (getOnboardingPath(userDb) !== 'beginner' || getSeenKanjiReadingPrimer(userDb)) {
      setShowPrimer(false);
      return;
    }

    setSeenKanjiReadingPrimer(userDb);
    setShowPrimer(true);
  }, [userDb, itemId, isDualReadingKanji]);

  return showPrimer;
}
