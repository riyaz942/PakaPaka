import { useCallback, useEffect, useRef, useState } from 'react';

import type { GuidanceCardId } from '@/components/onboarding/cardRegistry';
import { useDatabase } from '@/data/hooks/useDatabase';
import { isCardSeen, markCardSeen } from '@/data/user/cardSeenRepository';

/**
 * Gates one contextual guidance card on one surface (Epic 7).
 *
 * The first time `active` is true the hook reads `card_seen`: unseen means mark
 * and show, already seen means never show. Seen is written the moment the card
 * becomes visible rather than on dismiss — a learner who leaves the screen has
 * still been shown it, the same rule `useKanjiReadingPrimer` follows.
 *
 * After that first decision the surface is settled: a later `active` swing
 * cannot re-fire it, so a session with ten wrong answers shows `first-miss`
 * once. `active` going false hides the card, so the review notice does not sit
 * over the next prompt.
 *
 * No module-level session latch (unlike `useKanjiReadingPrimer`): `visible` is
 * this instance's own state and is never re-derived from the flag, so the
 * remount problem the primer's latch solves cannot arise here.
 */
export function useGuidanceCard(
  cardId: GuidanceCardId,
  active: boolean,
): { visible: boolean; dismiss: () => void } {
  const { userDb } = useDatabase();
  const [visible, setVisible] = useState(false);
  const settledRef = useRef(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    if (settledRef.current) return;

    // The repository is sync and unwrapped: a throw must not crash the
    // surface, and a failed read does not settle it — a later swing retries.
    try {
      if (isCardSeen(userDb, cardId)) {
        settledRef.current = true;
        return;
      }
      markCardSeen(userDb, cardId);
    } catch {
      return;
    }
    settledRef.current = true;
    setVisible(true);
  }, [active, cardId, userDb]);

  const dismiss = useCallback(() => {
    setVisible(false);
  }, []);

  return { visible, dismiss };
}
