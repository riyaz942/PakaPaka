/**
 * useWeaknessStats — Pattern accuracy trends and weakness stats for the Stats tab.
 *
 * STUB: Full rendering is implemented in Story 6.2. This file is the reserved
 * architecture path (architecture.md §907 capability map) and provides the
 * data-access foundation that 6.2 will build upon.
 */

import { useCallback, useEffect, useState } from 'react';

import type { ConfusionCluster, WeaknessStats } from '@/core/srs/srs.types';
import { detectConfusionClusters } from '@/core/srs/weaknessEngine';
import { CONFUSION_PATTERNS } from '@/config/confusionPatterns';
import { useDatabase } from '@/data/hooks/useDatabase';
import { getAllWeaknessStats } from '@/data/user/weaknessRepository';
import type { AppError } from '@/types/result.types';

type UseWeaknessStatsResult = {
  stats: WeaknessStats[];
  clusters: ConfusionCluster[];
  isLoading: boolean;
  error: AppError | null;
  refetch: () => void;
};

/**
 * Fetches all weakness stats and detects confusion clusters.
 * Called on Stats-screen entry per AC3; no UI is rendered in this story.
 */
export function useWeaknessStats(): UseWeaknessStatsResult {
  const { userDb } = useDatabase();
  const [stats, setStats] = useState<WeaknessStats[]>([]);
  const [clusters, setClusters] = useState<ConfusionCluster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [fetchCount, setFetchCount] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    try {
      const allStats = getAllWeaknessStats(userDb);
      const detectedClusters = detectConfusionClusters(allStats, CONFUSION_PATTERNS, new Date());
      setStats(allStats);
      setClusters(detectedClusters);
    } catch (cause) {
      setError({
        code: 'weakness_stats_load_failed',
        message: 'Failed to load weakness stats',
        cause,
      });
    } finally {
      setIsLoading(false);
    }
  }, [userDb, fetchCount]);

  const refetch = useCallback(() => {
    setFetchCount((c) => c + 1);
  }, []);

  return { stats, clusters, isLoading, error, refetch };
}
