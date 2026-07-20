import { useCallback, useEffect, useState } from 'react';

import { AT_RISK_TOP_N } from '@/config/constants';
import { selectAtRiskItems } from '@/core/engagement/atRiskSelector';
import { calculateWeaknessScore } from '@/core/srs/weaknessEngine';
import { getItemById } from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';
import { getSrsStatesForItems } from '@/data/user/srsStateRepository';
import { getAllWeaknessStats } from '@/data/user/weaknessRepository';

import type { AtRiskCandidate } from '@/core/engagement/atRiskSelector';

export type AtRiskListItem = {
  itemId: string;
  primaryForm: string;
  meaning: string;
};

type UseAtRiskItemsResult = {
  totalCount: number;
  topItems: AtRiskListItem[];
  /** Ranked display rows for the full list (capped at AT_RISK_DISPLAY_LIMIT). */
  allItems: AtRiskListItem[];
  /** Full ranked IDs for the "small revision" session handoff. */
  rankedItemIds: string[];
  isLoading: boolean;
  refetch: () => void;
};

/** Max display rows resolved from curriculum for the full-list modal. */
const AT_RISK_DISPLAY_LIMIT = 50;

/** FR59: weak items worth a refresher — invitation framing, hidden at zero. */
export function useAtRiskItems(): UseAtRiskItemsResult {
  const { curriculumDb, userDb } = useDatabase();
  const [totalCount, setTotalCount] = useState(0);
  const [topItems, setTopItems] = useState<AtRiskListItem[]>([]);
  const [allItems, setAllItems] = useState<AtRiskListItem[]>([]);
  const [rankedItemIds, setRankedItemIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchCount, setFetchCount] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    try {
      const stats = getAllWeaknessStats(userDb);
      const scored = stats
        .map((stat) => ({ itemId: stat.itemId, weaknessScore: calculateWeaknessScore(stat) }))
        .filter((entry) => entry.weaknessScore > 0);

      const srsStates = getSrsStatesForItems(
        userDb,
        scored.map((entry) => entry.itemId),
      );

      const candidates: AtRiskCandidate[] = scored
        // Burned items are done — never invite a refresher for them.
        .filter((entry) => !(srsStates.get(entry.itemId)?.isBurned ?? false))
        .map((entry) => ({
          itemId: entry.itemId,
          weaknessScore: entry.weaknessScore,
          dueDate: srsStates.get(entry.itemId)?.dueDate ?? null,
        }));

      const selection = selectAtRiskItems(candidates);

      // Drop orphans (SRS/weakness without a curriculum row) from counts and handoff.
      const resolved: AtRiskListItem[] = [];
      for (const itemId of selection.rankedItemIds) {
        const item = getItemById(curriculumDb, itemId);
        if (!item) continue;
        resolved.push({ itemId, primaryForm: item.primaryForm, meaning: item.meaning });
      }

      setTotalCount(resolved.length);
      setTopItems(resolved.slice(0, AT_RISK_TOP_N));
      setAllItems(resolved.slice(0, AT_RISK_DISPLAY_LIMIT));
      setRankedItemIds(resolved.map((row) => row.itemId));
    } catch {
      setTotalCount(0);
      setTopItems([]);
      setAllItems([]);
      setRankedItemIds([]);
    } finally {
      setIsLoading(false);
    }
  }, [curriculumDb, userDb, fetchCount]);

  const refetch = useCallback(() => {
    setFetchCount((count) => count + 1);
  }, []);

  return { totalCount, topItems, allItems, rankedItemIds, isLoading, refetch };
}
