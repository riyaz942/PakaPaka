export type PlacementItemType = 'radical' | 'kanji' | 'vocabulary' | 'grammar';

export type PlacementSampleItem = {
  id: string;
  itemType: PlacementItemType;
  primaryForm: string;
  meaning: string;
  sortOrder: number;
};

export type PlacementAnswer = {
  itemId: string;
  known: boolean;
};

export const PLACEMENT_SAMPLE_SIZE = 12;

/**
 * Stratified, evenly-spaced sample across a type's curriculum order so the
 * self-check spans easy → hard items instead of only the first few.
 */
export function samplePlacementItems(
  itemsByType: ReadonlyMap<PlacementItemType, PlacementSampleItem[]>,
  sampleSize: number = PLACEMENT_SAMPLE_SIZE,
): PlacementSampleItem[] {
  const nonEmpty = [...itemsByType.entries()].filter(([, items]) => items.length > 0);
  if (nonEmpty.length === 0 || sampleSize <= 0) {
    return [];
  }

  const perType = Math.max(1, Math.floor(sampleSize / nonEmpty.length));
  const sample: PlacementSampleItem[] = [];

  for (const [, items] of nonEmpty) {
    const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
    const take = Math.min(perType, sorted.length);
    for (let i = 0; i < take; i++) {
      // Even spacing across the ordered list, midpoint of each stratum.
      const index = Math.min(
        sorted.length - 1,
        Math.floor(((i + 0.5) * sorted.length) / take),
      );
      sample.push(sorted[index]);
    }
  }

  return sample;
}

/**
 * Known ratio → how far into the level's curriculum order the user likely is.
 * Because sampled items are evenly spaced by difficulty order, the fraction of
 * "know it" answers approximates the fraction of the level already covered.
 */
export function computeKnownRatio(answers: PlacementAnswer[]): number {
  if (answers.length === 0) {
    return 0;
  }
  const known = answers.filter((answer) => answer.known).length;
  return known / answers.length;
}

/**
 * Returns the ids to mark as known: the first `ratio` fraction of each type's
 * curriculum order. Items the user explicitly said they don't know are never
 * included, and items they said they do know always are.
 */
export function resolvePlacementKnownIds(
  itemsByType: ReadonlyMap<PlacementItemType, PlacementSampleItem[]>,
  answers: PlacementAnswer[],
): string[] {
  const ratio = computeKnownRatio(answers);
  const saidKnown = new Set(answers.filter((a) => a.known).map((a) => a.itemId));
  const saidUnknown = new Set(answers.filter((a) => !a.known).map((a) => a.itemId));

  const knownIds = new Set<string>();

  for (const [, items] of itemsByType) {
    const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
    const cut = Math.floor(sorted.length * ratio);
    for (let i = 0; i < sorted.length; i++) {
      const item = sorted[i];
      if (saidUnknown.has(item.id)) continue;
      if (i < cut || saidKnown.has(item.id)) {
        knownIds.add(item.id);
      }
    }
  }

  return [...knownIds];
}
