import { useState } from 'react';

import { useDatabase } from '@/data/hooks/useDatabase';
import { todayKey } from '@/data/user/cognitiveLoadRepository';
import {
  claimStreakCelebration,
  type StreakCelebration,
} from '@/data/user/streakRepository';

const NO_CELEBRATION: StreakCelebration = { shouldCelebrate: false, currentStreak: 0 };

/**
 * Claims the once-per-day streak celebration for this screen. Evaluated once
 * on mount — the claim marks today celebrated, so any summary screen mounted
 * later today gets shouldCelebrate false. Pass `enabled: false` when the
 * screen won't render a celebration, so the daily claim isn't consumed.
 */
export function useStreakCelebration(enabled: boolean = true): StreakCelebration {
  const { userDb } = useDatabase();
  const [celebration] = useState<StreakCelebration>(() =>
    enabled ? claimStreakCelebration(userDb, todayKey()) : NO_CELEBRATION,
  );
  return celebration;
}
