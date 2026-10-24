import { isItemUnlocked } from '@/core/content/dependencyGraph';
import type { ContentParentItem, ContentStudyStatus } from '@/core/content/content.types';
import type { SRSStageLabel } from '@/core/srs/srs.types';
import { createSeededRng } from '@/utils/seededRng';

import {
  hasStartableItems,
  planLesson,
  type LessonCandidate,
  type LessonPlanInput,
} from './lessonPlanner';

function c(
  id: string,
  itemType: LessonCandidate['itemType'],
  sortOrder: number,
  extra: Partial<LessonCandidate> = {},
): LessonCandidate {
  return {
    id,
    itemType,
    primaryForm: id,
    meaning: `meaning-${id}`,
    sortOrder,
    weight: 'normal',
    gateParentIds: [],
    ...extra,
  };
}

function input(
  candidates: LessonCandidate[],
  overrides: Partial<LessonPlanInput> = {},
): LessonPlanInput {
  return {
    candidates,
    studyStatuses: new Map<string, ContentStudyStatus>(),
    startedItemIds: new Set<string>(),
    parentsByItemId: new Map<string, ContentParentItem[]>(),
    parentStatuses: new Map<string, ContentStudyStatus>(),
    parentStages: new Map<string, SRSStageLabel>(),
    learner: {
      kanjiStartedOrKnown: 0,
      vocabStartedOrKnown: 0,
      grammarPace: { startedToday: 0, recentApprentice: 0 },
      dailyLessonItems: 15,
    },
    size: 5,
    rng: () => 0,
    ...overrides,
  };
}

const ids = (items: LessonCandidate[]) => items.map((item) => item.id);
const range = <T,>(n: number, make: (i: number) => T): T[] =>
  Array.from({ length: n }, (_, i) => make(i));

describe('planLesson', () => {
  it('returns at most `size` items', () => {
    expect(planLesson(input(range(20, (i) => c(`r${i}`, 'radical', i))))).toHaveLength(5);
  });

  it('returns empty for size zero or no candidates', () => {
    expect(planLesson(input([]))).toEqual([]);
    expect(planLesson(input([c('r1', 'radical', 1)], { size: 0 }))).toEqual([]);
  });

  it('excludes known, in_progress and already-started items', () => {
    const i = input(range(4, (n) => c(String(n + 1), 'radical', n + 1)), { size: 10 });
    i.studyStatuses.set('1', 'known');
    i.studyStatuses.set('2', 'in_progress');
    i.startedItemIds.add('3');
    expect(ids(planLesson(i))).toEqual(['4']);
  });

  it('excludes items whose requires parents are not started', () => {
    const i = input([c('r1', 'radical', 1), c('r2', 'radical', 2)]);
    i.parentsByItemId.set('r1', [{ id: 'p', primaryForm: 'p', itemType: 'kanji' }]);
    expect(ids(planLesson(i))).toEqual(['r2']);
  });

  it('orders within a type by sortOrder', () => {
    expect(ids(planLesson(input([c('b', 'radical', 5), c('a', 'radical', 1)])))).toEqual([
      'a',
      'b',
    ]);
  });

  it('holds a kanji whose radical is Apprentice', () => {
    const i = input([c('k1', 'kanji', 1, { gateParentIds: ['r1'] })]);
    i.parentStatuses.set('r1', 'in_progress');
    i.parentStages.set('r1', 'apprentice');
    expect(planLesson(i)).toEqual([]);
  });

  it('offers it when the radical reaches Guru', () => {
    const i = input([c('k1', 'kanji', 1, { gateParentIds: ['r1'] })]);
    i.parentStatuses.set('r1', 'in_progress');
    i.parentStages.set('r1', 'guru');
    expect(ids(planLesson(i))).toEqual(['k1']);
  });

  it('known parent satisfies the kanji gate', () => {
    const i = input([c('k1', 'kanji', 1, { gateParentIds: ['r1'] })]);
    i.parentStatuses.set('r1', 'known');
    expect(ids(planLesson(i))).toEqual(['k1']);
  });

  it('holds a word whose requires kanji is Apprentice', () => {
    const i = input([c('v1', 'vocabulary', 1, { gateParentIds: ['k1'] })]);
    i.learner.kanjiStartedOrKnown = 5;
    i.parentsByItemId.set('v1', [{ id: 'k1', primaryForm: 'k1', itemType: 'kanji' }]);
    i.parentStatuses.set('k1', 'in_progress');
    i.parentStages.set('k1', 'apprentice');
    expect(planLesson(i)).toEqual([]);
  });

  it('holds an ungated word until 5 kanji are started', () => {
    const i = input([c('v1', 'vocabulary', 1)]);
    i.learner.kanjiStartedOrKnown = 4;
    expect(planLesson(i)).toEqual([]);
    i.learner.kanjiStartedOrKnown = 5;
    expect(ids(planLesson(i))).toEqual(['v1']);
  });

  it('holds grammar until 10 words are started', () => {
    const i = input([c('g1', 'grammar', 1, { weight: 'heavy' })]);
    i.learner.vocabStartedOrKnown = 9;
    expect(planLesson(i)).toEqual([]);
    i.learner.vocabStartedOrKnown = 10;
    expect(ids(planLesson(i))).toEqual(['g1']);
  });

  it('takes at most one grammar per lesson', () => {
    const i = input(range(3, (n) => c(`g${n}`, 'grammar', n, { weight: 'heavy' })));
    i.learner.vocabStartedOrKnown = 10;
    i.learner.dailyLessonItems = 40;
    i.size = 10;
    expect(planLesson(i).filter((item) => item.itemType === 'grammar')).toHaveLength(1);
  });

  it('takes no grammar when the slot is closed', () => {
    const i = input([
      c('g1', 'grammar', 1, { weight: 'heavy' }),
      ...range(5, (n) => c(`r${n}`, 'radical', n)),
    ]);
    i.learner.vocabStartedOrKnown = 10;
    i.learner.grammarPace = { startedToday: 1, recentApprentice: 0 };
    expect(planLesson(i).some((item) => item.itemType === 'grammar')).toBe(false);
  });

  it('never exceeds the heavy cap and grammar counts as heavy', () => {
    const i = input([
      c('g1', 'grammar', 1, { weight: 'heavy' }),
      ...range(3, (n) => c(`h${n + 1}`, 'kanji', n + 1, { weight: 'heavy' })),
      ...range(3, (n) => c(`n${n + 1}`, 'kanji', n + 4)),
    ]);
    i.learner.vocabStartedOrKnown = 10;
    const result = ids(planLesson(i));
    expect(result).toContain('g1');
    expect(result.filter((id) => id.startsWith('h'))).toEqual([]);
  });

  it('a skipped heavy item comes in the next lesson', () => {
    const i = input([
      c('h1', 'kanji', 1, { weight: 'heavy' }),
      c('h2', 'kanji', 2, { weight: 'heavy' }),
      ...range(10, (n) => c(`n${n + 1}`, 'kanji', n + 3)),
    ]);
    const first = ids(planLesson(i));
    expect(first).toContain('h1');
    expect(first).not.toContain('h2');
    for (const id of first) i.startedItemIds.add(id);
    expect(ids(planLesson(i))).toContain('h2');
  });

  it('looks only LESSON_HEAVY_LOOKAHEAD items past a blocked heavy', () => {
    const i = input([
      c('g1', 'grammar', 1, { weight: 'heavy' }),
      ...range(12, (n) => c(`h${n}`, 'kanji', n, { weight: 'heavy' })),
      c('kn', 'kanji', 13),
      ...range(10, (n) => c(`v${n}`, 'vocabulary', n)),
    ]);
    i.learner.kanjiStartedOrKnown = 5;
    i.learner.vocabStartedOrKnown = 10;
    const result = planLesson(i);
    expect(result.filter((item) => item.itemType === 'kanji')).toEqual([]);
    expect(result.filter((item) => item.itemType === 'vocabulary')).toHaveLength(4);
  });

  it('opt-ins come first, ignore the Guru gate and keep type order', () => {
    const i = input([
      c('r1', 'radical', 1),
      c('k9', 'kanji', 67, { optedIn: true, gateParentIds: ['r1'] }),
      c('r9', 'radical', 70, { optedIn: true }),
    ]);
    i.parentStatuses.set('r1', 'in_progress');
    i.parentStages.set('r1', 'apprentice');
    expect(ids(planLesson(i)).slice(0, 2)).toEqual(['r9', 'k9']);
  });

  it('lower-level parts lead their type', () => {
    const i = input([c('r1', 'radical', 1), c('p1', 'radical', 70, { lowerLevelPart: true })]);
    expect(ids(planLesson(i))).toEqual(['p1', 'r1']);
  });

  it('orders the lesson radical, kanji, vocabulary, grammar', () => {
    const i = input([
      c('g1', 'grammar', 1, { weight: 'heavy' }),
      c('v1', 'vocabulary', 1),
      c('k1', 'kanji', 1),
      c('r1', 'radical', 1),
    ]);
    i.learner.kanjiStartedOrKnown = 5;
    i.learner.vocabStartedOrKnown = 10;
    expect(planLesson(i).map((item) => item.itemType)).toEqual([
      'radical',
      'kanji',
      'vocabulary',
      'grammar',
    ]);
  });

  it('same rng → same lesson; varied rng → varied mixes', () => {
    const candidates = [
      ...range(40, (n) => c(`r${n}`, 'radical', n)),
      ...range(40, (n) => c(`k${n}`, 'kanji', n)),
      ...range(40, (n) => c(`v${n}`, 'vocabulary', n)),
    ];
    const withSeed = (seed: string) => {
      const i = input(candidates, { rng: createSeededRng(seed) });
      i.learner.kanjiStartedOrKnown = 5;
      return planLesson(i);
    };
    expect(ids(withSeed('a'))).toEqual(ids(withSeed('a')));

    const mixes = new Set<string>();
    for (let s = 0; s < 50; s++) {
      const result = withSeed(String(s));
      const count = (type: string) => result.filter((item) => item.itemType === type).length;
      mixes.add(`${count('radical')}/${count('kanji')}/${count('vocabulary')}`);
    }
    expect(mixes.size).toBeGreaterThanOrEqual(3);
  });

  it('every planned item passes isItemUnlocked', () => {
    const rng = createSeededRng('fixtures');
    const pick = <T,>(values: readonly T[]) => values[Math.floor(rng() * values.length)];
    const statuses = ['known', 'in_progress', 'not_started'] as const;
    const stages = ['apprentice', 'guru', 'master', undefined] as const;
    const types = ['radical', 'kanji', 'vocabulary', 'grammar'] as const;

    for (let f = 0; f < 200; f++) {
      const parents = range(6, (n) => `p${n}`);
      const candidates = range(12, (n) => {
        const gate = parents.filter(() => rng() < 0.3);
        return c(`c${n}`, pick(types), n, {
          gateParentIds: gate,
          optedIn: rng() < 0.2,
          weight: pick(['light', 'normal', 'heavy'] as const),
        });
      });
      const i = input(candidates, { rng, size: 1 + Math.floor(rng() * 10) });
      i.learner.kanjiStartedOrKnown = Math.floor(rng() * 10);
      i.learner.vocabStartedOrKnown = Math.floor(rng() * 20);
      for (const parent of parents) {
        i.parentStatuses.set(parent, pick(statuses));
        const stage = pick(stages);
        if (stage) i.parentStages.set(parent, stage);
      }
      for (const candidate of candidates) {
        const requires = parents
          .filter(() => rng() < 0.3)
          .map((id) => ({ id, primaryForm: id, itemType: 'kanji' as const }));
        i.parentsByItemId.set(candidate.id, requires);
      }

      for (const item of planLesson(i)) {
        expect(isItemUnlocked(i.parentsByItemId.get(item.id) ?? [], i.parentStatuses)).toBe(true);
      }
    }
  });
});

describe('hasStartableItems', () => {
  it('is true for a gated kanji and false when only grammar is left', () => {
    const gated = input([c('k1', 'kanji', 1, { gateParentIds: ['r1'] })]);
    gated.parentStatuses.set('r1', 'in_progress');
    gated.parentStages.set('r1', 'apprentice');
    expect(hasStartableItems(gated)).toBe(true);

    expect(hasStartableItems(input([c('g1', 'grammar', 1, { weight: 'heavy' })]))).toBe(false);
  });
});
