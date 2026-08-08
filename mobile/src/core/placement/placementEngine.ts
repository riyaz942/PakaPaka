import { JLPT_LEVELS, type JLPTLevel } from '@/data/curriculum/curriculum.types';

export type PlacementItemType = 'radical' | 'kanji' | 'vocabulary' | 'grammar';

export type PlacementSampleItem = {
  id: string;
  itemType: PlacementItemType;
  level: JLPTLevel;
  primaryForm: string;
  meaning: string;
  sortOrder: number;
};

export type PlacementAnswer = {
  itemId: string;
  itemType: PlacementItemType;
  level: JLPTLevel;
  known: boolean;
};

/** Every curriculum item of each tested level, keyed by level. */
export type PlacementItemsByLevel = ReadonlyMap<JLPTLevel, PlacementSampleItem[]>;

/** Scoring is per (level, item type) cell — never one blended ratio. */
type PlacementCellKey = `${JLPTLevel}:${PlacementItemType}`;

/**
 * One (level, item type) cell's result — the same granularity the cutoffs are
 * computed at. Reported per cell rather than flattened per level because a
 * blended "380 of 972 N5 items" hides which types the estimate actually landed
 * on, and it is the estimate the learner is asked to sanity-check.
 */
export type PlacementCellOutcome = {
  level: JLPTLevel;
  itemType: PlacementItemType;
  /**
   * Ids this cell's cutoff marks as known, most-confident first: items the
   * learner explicitly claimed, then the rest by curriculum position. Lowering
   * the count by hand drops from the tail.
   */
  knownIds: string[];
  /**
   * Candidates beyond the cutoff, in curriculum order — used when the count is
   * raised. Never contains an explicitly-claimed item (those always land in
   * `knownIds`) nor one answered "not yet" (those are dropped outright).
   */
  extraIds: string[];
};

/** Canonical reporting order, so output does not depend on input grouping. */
const ITEM_TYPE_ORDER: readonly PlacementItemType[] = [
  'radical',
  'kanji',
  'vocabulary',
  'grammar',
];

/**
 * Cards drawn per tested level. The budget is *per level*, not shared across the
 * range: splitting a fixed total would shrink each (level, type) cell as the
 * range widens, until one tap decided a whole cell — or the cell got no card at
 * all and was scored as entirely unknown.
 */
export const PLACEMENT_SAMPLE_SIZE_PER_LEVEL = 12;

function cellKey(level: JLPTLevel, itemType: PlacementItemType): PlacementCellKey {
  return `${level}:${itemType}`;
}

/** Levels in curriculum order (N5 → N1), skipping ones outside the range. */
function orderedLevels(itemsByLevel: PlacementItemsByLevel): JLPTLevel[] {
  return JLPT_LEVELS.filter((level) => itemsByLevel.has(level));
}

/** Groups one level's items by type, preserving the caller's type ordering. */
function groupByType(
  items: PlacementSampleItem[],
): Map<PlacementItemType, PlacementSampleItem[]> {
  const byType = new Map<PlacementItemType, PlacementSampleItem[]>();
  for (const item of items) {
    const bucket = byType.get(item.itemType);
    if (bucket) {
      bucket.push(item);
    } else {
      byType.set(item.itemType, [item]);
    }
  }
  return byType;
}

/** Splits `total` across `buckets` as evenly as possible, remainder to the front. */
function distribute(total: number, buckets: number): number[] {
  if (buckets <= 0) {
    return [];
  }
  const base = Math.floor(total / buckets);
  const remainder = total % buckets;
  return Array.from({ length: buckets }, (_, index) => base + (index < remainder ? 1 : 0));
}

/**
 * Stratified, evenly-spaced sample across the tested range: every level gets its
 * own full budget, split across that level's item types, then spread evenly over
 * each type's curriculum order so the self-check spans easy → hard items instead
 * of only the first few. A wider range means a longer quiz, not a coarser one.
 */
export function samplePlacementItems(
  itemsByLevel: PlacementItemsByLevel,
  sampleSizePerLevel: number = PLACEMENT_SAMPLE_SIZE_PER_LEVEL,
): PlacementSampleItem[] {
  const levels = orderedLevels(itemsByLevel).filter(
    (level) => (itemsByLevel.get(level) ?? []).length > 0,
  );
  if (levels.length === 0 || sampleSizePerLevel <= 0) {
    return [];
  }

  const sample: PlacementSampleItem[] = [];

  levels.forEach((level) => {
    const byType = groupByType(itemsByLevel.get(level) ?? []);
    const types = [...byType.entries()].filter(([, items]) => items.length > 0);
    const perType = distribute(sampleSizePerLevel, types.length);

    types.forEach(([, items], typeIndex) => {
      const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
      const take = Math.min(perType[typeIndex], sorted.length);
      for (let i = 0; i < take; i++) {
        // Even spacing across the ordered list, midpoint of each stratum.
        const index = Math.min(
          sorted.length - 1,
          Math.floor(((i + 0.5) * sorted.length) / take),
        );
        sample.push(sorted[index]);
      }
    });
  });

  return sample;
}

/**
 * Known ratio per (level, item type) → how far into that cell's curriculum
 * order the learner likely is. Because sampled items are evenly spaced by
 * difficulty order, the fraction of "know it" answers approximates the fraction
 * of the cell already covered. Cells with no answers get no entry, so no cutoff
 * is applied there.
 */
export function computeKnownRatios(
  answers: PlacementAnswer[],
): Map<PlacementCellKey, number> {
  const tally = new Map<PlacementCellKey, { known: number; total: number }>();

  for (const answer of answers) {
    const key = cellKey(answer.level, answer.itemType);
    const cell = tally.get(key) ?? { known: 0, total: 0 };
    cell.total += 1;
    if (answer.known) {
      cell.known += 1;
    }
    tally.set(key, cell);
  }

  return new Map([...tally].map(([key, cell]) => [key, cell.known / cell.total]));
}

/**
 * Per (level, item type) cell: the ids to mark as known — the first `ratio`
 * fraction of that cell's curriculum order — plus the remaining candidates in
 * the same confidence order so the learner can adjust the count before
 * confirming. Items they explicitly said they don't know are never included,
 * and items they said they do know always are.
 *
 * Cells with no items are omitted rather than reported empty: there is nothing
 * to show and nothing to adjust.
 */
export function resolvePlacementOutcomes(
  itemsByLevel: PlacementItemsByLevel,
  answers: PlacementAnswer[],
): PlacementCellOutcome[] {
  const ratios = computeKnownRatios(answers);
  const saidKnown = new Set(answers.filter((a) => a.known).map((a) => a.itemId));
  const saidUnknown = new Set(answers.filter((a) => !a.known).map((a) => a.itemId));

  const outcomes: PlacementCellOutcome[] = [];

  for (const level of orderedLevels(itemsByLevel)) {
    const byType = groupByType(itemsByLevel.get(level) ?? []);

    for (const itemType of ITEM_TYPE_ORDER) {
      const typeItems = byType.get(itemType);
      if (!typeItems || typeItems.length === 0) {
        continue;
      }

      const sorted = [...typeItems].sort((a, b) => a.sortOrder - b.sortOrder);
      const ratio = ratios.get(cellKey(level, itemType)) ?? 0;
      const cut = Math.floor(sorted.length * ratio);

      // Explicit claims lead so a hand-lowered count drops inferred items before
      // anything the learner actually answered; `extraIds` holds no explicit
      // entries by construction, so it stays in plain curriculum order.
      const explicitKnown: string[] = [];
      const inferredKnown: string[] = [];
      const extraIds: string[] = [];

      sorted.forEach((item, index) => {
        if (saidUnknown.has(item.id)) {
          return;
        }
        if (saidKnown.has(item.id)) {
          explicitKnown.push(item.id);
        } else if (index < cut) {
          inferredKnown.push(item.id);
        } else {
          extraIds.push(item.id);
        }
      });

      outcomes.push({
        level,
        itemType,
        knownIds: [...explicitKnown, ...inferredKnown],
        extraIds,
      });
    }
  }

  return outcomes;
}
