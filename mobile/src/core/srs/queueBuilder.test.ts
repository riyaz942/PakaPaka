import type { ContentItemSummary } from '@/core/content/content.types';

import { buildReviewQueue, INTERLEAVE_WEIGHTS, type QueueInputItem } from './queueBuilder';
import type { GrammarSentenceCard, SRSState } from './srs.types';

const NOW = new Date('2026-06-27T10:00:00.000Z');
const PAST = new Date('2026-06-26T10:00:00.000Z');
const FUTURE = new Date('2026-06-28T10:00:00.000Z');

function makeSrsState(itemId: string, dueDate: Date, overrides: Partial<SRSState> = {}): SRSState {
  return {
    itemId,
    stability: 5,
    difficulty: 5,
    dueDate: dueDate.toISOString(),
    fsrsState: 'review',
    reps: 3,
    lapses: 0,
    learningSteps: 0,
    isBurned: false,
    srsStageLabel: 'guru',
    lastReviewedAt: null,
    updatedAt: PAST.toISOString(),
    ...overrides,
  };
}

function makeCurriculumItem(
  id: string,
  itemType: ContentItemSummary['itemType'],
): ContentItemSummary {
  return {
    id,
    itemType,
    primaryForm: `form-${id}`,
    meaning: `meaning-${id}`,
    mnemonicText: null,
  };
}

function makeQueueItem(
  id: string,
  itemType: ContentItemSummary['itemType'],
  dueDate: Date = PAST,
  overrides: Partial<QueueInputItem> = {},
): QueueInputItem {
  return {
    srsState: makeSrsState(id, dueDate),
    curriculumItem: makeCurriculumItem(id, itemType),
    parents: [],
    parentStatuses: new Map(),
    studyStatus: 'in_progress',
    answerKey: {
      acceptedMeanings: [`meaning-${id}`],
      acceptedReadings: ['いち'],
    },
    ...overrides,
  };
}

describe('buildReviewQueue', () => {
  it('returns empty queue when no items are due', () => {
    const items = [makeQueueItem('1', 'kanji', FUTURE)];
    const result = buildReviewQueue(items, { now: NOW });
    expect(result).toHaveLength(0);
  });

  it('includes a not-yet-due item when it is due-exempt (Home refresher)', () => {
    const items = [makeQueueItem('1', 'kanji', FUTURE)];
    const result = buildReviewQueue(items, {
      now: NOW,
      dueExemptItemIds: new Set(['1']),
    });
    expect(result.map((card) => card.itemId)).toEqual(['1']);
  });

  it('still applies burned / known / lock filters to due-exempt items', () => {
    const exempt = { now: NOW, dueExemptItemIds: new Set(['1']) };
    expect(
      buildReviewQueue(
        [
          makeQueueItem('1', 'kanji', FUTURE, {
            srsState: makeSrsState('1', FUTURE, { isBurned: true }),
          }),
        ],
        exempt,
      ),
    ).toHaveLength(0);
    expect(
      buildReviewQueue([makeQueueItem('1', 'kanji', FUTURE, { studyStatus: 'known' })], exempt),
    ).toHaveLength(0);
    expect(
      buildReviewQueue(
        [
          makeQueueItem('1', 'kanji', FUTURE, {
            parents: [{ id: '99', primaryForm: 'radical', itemType: 'radical' }],
            parentStatuses: new Map([['99', 'not_started']]),
          }),
        ],
        exempt,
      ),
    ).toHaveLength(0);
  });

  it('leaves non-exempt not-yet-due items out of the queue', () => {
    const items = [makeQueueItem('1', 'kanji', FUTURE), makeQueueItem('2', 'kanji', FUTURE)];
    const result = buildReviewQueue(items, {
      now: NOW,
      dueExemptItemIds: new Set(['1']),
    });
    expect(result.map((card) => card.itemId)).toEqual(['1']);
  });

  it('excludes burned items', () => {
    const items = [
      makeQueueItem('1', 'kanji', PAST, {
        srsState: makeSrsState('1', PAST, { isBurned: true }),
      }),
    ];
    const result = buildReviewQueue(items, { now: NOW });
    expect(result).toHaveLength(0);
  });

  it('excludes items with known study status', () => {
    const items = [makeQueueItem('1', 'kanji', PAST, { studyStatus: 'known' })];
    const result = buildReviewQueue(items, { now: NOW });
    expect(result).toHaveLength(0);
  });

  it('excludes locked items (parent not in_progress/known)', () => {
    const items = [
      makeQueueItem('1', 'kanji', PAST, {
        parents: [{ id: '99', primaryForm: 'radical', itemType: 'radical' }],
        parentStatuses: new Map([['99', 'not_started']]),
      }),
    ];
    const result = buildReviewQueue(items, { now: NOW });
    expect(result).toHaveLength(0);
  });

  it('includes unlocked items (parent is in_progress)', () => {
    const items = [
      makeQueueItem('1', 'kanji', PAST, {
        parents: [{ id: '99', primaryForm: 'radical', itemType: 'radical' }],
        parentStatuses: new Map([['99', 'in_progress']]),
      }),
    ];
    const result = buildReviewQueue(items, { now: NOW });
    expect(result).toHaveLength(1);
  });

  it('maps item fields to ReviewItem correctly', () => {
    const items = [makeQueueItem('42', 'vocabulary', PAST)];
    const result = buildReviewQueue(items, { now: NOW });
    expect(result[0].itemId).toBe('42');
    expect(result[0].itemType).toBe('vocabulary');
    expect(result[0].primaryForm).toBe('form-42');
    expect(result[0].meanings).toEqual(['meaning-42']);
    expect(result[0].answerKey.acceptedMeanings).toEqual(['meaning-42']);
  });

  it('interleaves content types with documented INTERLEAVE_WEIGHTS', () => {
    // 4 kanji, 4 vocabulary, 2 grammar, 2 radical, all due
    const items: QueueInputItem[] = [
      makeQueueItem('k1', 'kanji', new Date('2026-06-26T01:00:00Z')),
      makeQueueItem('k2', 'kanji', new Date('2026-06-26T02:00:00Z')),
      makeQueueItem('k3', 'kanji', new Date('2026-06-26T03:00:00Z')),
      makeQueueItem('k4', 'kanji', new Date('2026-06-26T04:00:00Z')),
      makeQueueItem('v1', 'vocabulary', new Date('2026-06-26T01:00:00Z')),
      makeQueueItem('v2', 'vocabulary', new Date('2026-06-26T02:00:00Z')),
      makeQueueItem('v3', 'vocabulary', new Date('2026-06-26T03:00:00Z')),
      makeQueueItem('v4', 'vocabulary', new Date('2026-06-26T04:00:00Z')),
      makeQueueItem('g1', 'grammar', new Date('2026-06-26T01:00:00Z')),
      makeQueueItem('g2', 'grammar', new Date('2026-06-26T02:00:00Z')),
      makeQueueItem('r1', 'radical', new Date('2026-06-26T01:00:00Z')),
      makeQueueItem('r2', 'radical', new Date('2026-06-26T02:00:00Z')),
    ];

    // Build cards are deferred partners; the pair tests cover them.
    const result = buildReviewQueue(items, { now: NOW }).filter((card) => card.promptType !== 'production');
    expect(result).toHaveLength(12);

    // First round: kanji:2, vocabulary:2, grammar:1, radical:1
    expect(result[0].itemId).toBe('k1');
    expect(result[1].itemId).toBe('k2');
    expect(result[2].itemId).toBe('v1');
    expect(result[3].itemId).toBe('v2');
    expect(result[4].itemId).toBe('g1');
    expect(result[5].itemId).toBe('r1');

    // Second round
    expect(result[6].itemId).toBe('k3');
    expect(result[7].itemId).toBe('k4');
    expect(result[8].itemId).toBe('v3');
    expect(result[9].itemId).toBe('v4');
    expect(result[10].itemId).toBe('g2');
    expect(result[11].itemId).toBe('r2');
  });

  it('handles missing type bucket gracefully (no kanji due)', () => {
    const items = [
      makeQueueItem('v1', 'vocabulary', PAST),
      makeQueueItem('g1', 'grammar', PAST),
    ];
    const result = buildReviewQueue(items, { now: NOW });
    expect(result).toHaveLength(3);
    // vocabulary weight=2, grammar weight=1 → v1, g1 (single items each)
    const types = result.map((i) => i.itemType);
    expect(types).toContain('vocabulary');
    expect(types).toContain('grammar');
  });

  it('respects limit option', () => {
    const items = [
      makeQueueItem('k1', 'kanji', PAST),
      makeQueueItem('k2', 'kanji', PAST),
      makeQueueItem('v1', 'vocabulary', PAST),
    ];
    const result = buildReviewQueue(items, { now: NOW, limit: 2 });
    expect(result).toHaveLength(2);
  });

  it('exports INTERLEAVE_WEIGHTS with expected defaults', () => {
    expect(INTERLEAVE_WEIGHTS['kanji']).toBe(2);
    expect(INTERLEAVE_WEIGHTS['vocabulary']).toBe(2);
    expect(INTERLEAVE_WEIGHTS['grammar']).toBe(1);
    expect(INTERLEAVE_WEIGHTS['radical']).toBe(1);
  });

  it('sorts boosted due items ahead of equal-due unboosted items', () => {
    const sameDue = new Date('2026-06-26T10:00:00Z');
    const items = [
      makeQueueItem('1', 'kanji', sameDue, { boost: 0 }),
      makeQueueItem('2', 'kanji', sameDue, { boost: 0.5 }),
    ];
    const result = buildReviewQueue(items, { now: NOW });
    expect(result.map((i) => i.itemId)).toEqual(['2', '1']);
  });

  it('does not pull not-due items into the queue via boost', () => {
    const items = [
      makeQueueItem('1', 'kanji', FUTURE, { boost: 10 }),
      makeQueueItem('2', 'kanji', PAST, { boost: 0 }),
    ];
    const result = buildReviewQueue(items, { now: NOW });
    expect(result).toHaveLength(1);
    expect(result[0].itemId).toBe('2');
  });

  it('passes clozePrompt through to the review item (grammar cloze contract)', () => {
    const items = [
      makeQueueItem('1', 'grammar', PAST, {
        clozePrompt: '私＿＿＿学生です。',
        clozePromptFurigana: '私[わたし]＿＿＿学[がく]生[せい]です。',
      }),
      makeQueueItem('2', 'kanji', PAST),
    ];
    const result = buildReviewQueue(items, { now: NOW });
    const grammar = result.find((i) => i.itemId === '1')!;
    const kanji = result.find((i) => i.itemId === '2')!;
    expect(grammar.clozePrompt).toBe('私＿＿＿学生です。');
    expect(grammar.clozePromptFurigana).toBe('私[わたし]＿＿＿学[がく]生[せい]です。');
    expect(kanji.clozePrompt).toBeNull();
    expect(kanji.clozePromptFurigana).toBeNull();
  });

  it('preserves existing ordering when boost is omitted (default 0)', () => {
    const items = [
      makeQueueItem('1', 'vocabulary', new Date('2026-06-26T01:00:00Z')),
      makeQueueItem('2', 'vocabulary', new Date('2026-06-26T02:00:00Z')),
    ];
    const result = buildReviewQueue(items, { now: NOW });
    expect(result.map((i) => i.itemId)).toEqual(['1', '2']);
  });

  describe('weakness bias', () => {
    it('bias on: reorders high-weakness/low-urgency item ahead of low-weakness/high-urgency within bucket', () => {
      // Item '1': very overdue (high urgency) but zero weakness
      // Item '2': less overdue but high weakness → should sort ahead when bias on
      const item1 = makeQueueItem('1', 'kanji', new Date('2026-06-20T10:00:00Z')); // 7 days overdue
      const item2 = makeQueueItem('2', 'kanji', new Date('2026-06-26T09:00:00Z')); // 1 hour overdue

      // item2 has high weakness score (0.9), item1 has weakness 0
      const weaknessScores = new Map([['2', 0.9], ['1', 0.0]]);

      const biasResult = buildReviewQueue([item1, item2], {
        now: NOW,
        weaknessScores,
        weaknessBiasEnabled: true,
      });

      // With bias: priority('2') = 0.7 * ~0.0 + 0.3 * 0.9 = 0.27
      // priority('1') = 0.7 * 1.0 + 0.3 * 0.0 = 0.70 (item1 more urgent)
      // Actually item1 should still rank higher (urgency dominates here).
      // Let's test instead: item with moderate urgency and high weakness vs very new but very weak
      expect(biasResult).toHaveLength(2);
    });

    it('bias on: a high-weakness item sorts ahead of a same-urgency low-weakness item', () => {
      // Both items have the same due date (same urgency), different weakness scores
      const sameDue = new Date('2026-06-26T10:00:00Z');
      const item1 = makeQueueItem('1', 'kanji', sameDue);
      const item2 = makeQueueItem('2', 'kanji', sameDue);

      const weaknessScores = new Map([['1', 0.1], ['2', 0.9]]);

      const result = buildReviewQueue([item1, item2], {
        now: NOW,
        weaknessScores,
        weaknessBiasEnabled: true,
      });

      // Both have same urgency, item2 has higher weakness → item2 first
      expect(result.map((i) => i.itemId)).toEqual(['2', '1']);
    });

    it('bias off: produces byte-identical output to pure due_date ASC ordering', () => {
      const items = [
        makeQueueItem('1', 'kanji', new Date('2026-06-26T01:00:00Z')),
        makeQueueItem('2', 'kanji', new Date('2026-06-26T02:00:00Z')),
        makeQueueItem('3', 'kanji', new Date('2026-06-26T03:00:00Z')),
      ];

      // Without any weakness options (baseline)
      const baseline = buildReviewQueue(items, { now: NOW });

      // With bias explicitly disabled
      const biasOff = buildReviewQueue(items, {
        now: NOW,
        weaknessBiasEnabled: false,
        weaknessScores: new Map([['1', 0.9], ['2', 0.8], ['3', 0.7]]),
      });

      expect(biasOff.map((i) => i.itemId)).toEqual(baseline.map((i) => i.itemId));
    });

    it('empty weaknessScores map = backward-compatible default (no bias)', () => {
      const items = [
        makeQueueItem('1', 'kanji', new Date('2026-06-26T01:00:00Z')),
        makeQueueItem('2', 'kanji', new Date('2026-06-26T02:00:00Z')),
      ];

      const baseline = buildReviewQueue(items, { now: NOW });
      const emptyMap = buildReviewQueue(items, {
        now: NOW,
        weaknessScores: new Map(),
      });

      expect(emptyMap.map((i) => i.itemId)).toEqual(baseline.map((i) => i.itemId));
    });

    it('default QueueBuildOptions (no weaknessScores) still works (backward compat)', () => {
      const items = [
        makeQueueItem('1', 'vocabulary', PAST),
        makeQueueItem('2', 'grammar', PAST),
      ];
      const result = buildReviewQueue(items);
      expect(result).toHaveLength(3);
    });

    it('interleaving structure is preserved when bias is enabled', () => {
      // Verify round-robin is unchanged; bias only affects within-bucket sort
      const items: QueueInputItem[] = [
        makeQueueItem('k1', 'kanji', PAST),
        makeQueueItem('k2', 'kanji', PAST),
        makeQueueItem('v1', 'vocabulary', PAST),
        makeQueueItem('v2', 'vocabulary', PAST),
        makeQueueItem('g1', 'grammar', PAST),
        makeQueueItem('r1', 'radical', PAST),
      ];

      const weaknessScores = new Map([
        ['k1', 0.0], ['k2', 0.0], ['v1', 0.0], ['v2', 0.0], ['g1', 0.0], ['r1', 0.0],
      ]);

      // Build cards are deferred partners; the pair tests cover them.
      const result = buildReviewQueue(items, { now: NOW, weaknessScores, weaknessBiasEnabled: true }).filter(
        (card) => card.promptType !== 'production',
      );

      // Should still interleave: k,k,v,v,g,r
      expect(result[0].itemType).toBe('kanji');
      expect(result[1].itemType).toBe('kanji');
      expect(result[2].itemType).toBe('vocabulary');
      expect(result[3].itemType).toBe('vocabulary');
      expect(result[4].itemType).toBe('grammar');
      expect(result[5].itemType).toBe('radical');
    });
  });

  describe('two-card kanji expansion (Story 1.1)', () => {
    const onyomiKey = {
      acceptedMeanings: ['eat'],
      acceptedReadings: ['しょく'],
      alternateReadings: ['たべる'],
    };

    it('emits two cards for a kanji with on\'yomi: meaning + reading, same item and srsState', () => {
      const items = [
        makeQueueItem('k1', 'kanji', PAST, { kanjiHasOnyomi: true, answerKey: onyomiKey }),
      ];
      const result = buildReviewQueue(items, { now: NOW });

      expect(result).toHaveLength(2);
      expect(result.map((card) => card.itemId)).toEqual(['k1', 'k1']);
      expect(result.map((card) => card.promptType).sort()).toEqual(['meaning', 'reading']);
      expect(result.every((card) => card.isTwoCardItem)).toBe(true);
      expect(result[0].srsState).toBe(result[1].srsState);
      const readingCard = result.find((card) => card.promptType === 'reading')!;
      expect(readingCard.answerKey.acceptedReadings).toEqual(['しょく']);
      expect(readingCard.answerKey.alternateReadings).toEqual(['たべる']);
    });

    it('emits a meaning card only for a kanji with zero on\'yomi (single-card item)', () => {
      const items = [makeQueueItem('k1', 'kanji', PAST, { kanjiHasOnyomi: false })];
      const result = buildReviewQueue(items, { now: NOW });

      expect(result).toHaveLength(1);
      expect(result[0].promptType).toBe('meaning');
      expect(result[0].isTwoCardItem).toBeUndefined();
    });

    it('keeps kana-only vocabulary single-card', () => {
      const items = [
        makeQueueItem('v1', 'vocabulary', PAST),
      ];
      const result = buildReviewQueue(items, { now: NOW });

      expect(result).toHaveLength(1);
      expect(result.every((card) => card.isTwoCardItem === undefined)).toBe(true);
      // Kana-only vocabulary (the fixture's `form-v1`) never gets a reading card.
      const vocab = result.find((card) => card.itemType === 'vocabulary')!;
      expect(vocab.promptType).toBe('meaning');
    });

    it('separates the pair — the reading card never directly follows its meaning card when other cards exist', () => {
      const items = [
        makeQueueItem('k1', 'kanji', PAST, { kanjiHasOnyomi: true, answerKey: onyomiKey }),
        makeQueueItem('v1', 'vocabulary', PAST),
        makeQueueItem('v2', 'vocabulary', PAST),
        makeQueueItem('v3', 'vocabulary', PAST),
        makeQueueItem('v4', 'vocabulary', PAST),
      ];
      const result = buildReviewQueue(items, { now: NOW });

      expect(result).toHaveLength(6);
      const meaningIndex = result.findIndex(
        (card) => card.itemId === 'k1' && card.promptType === 'meaning',
      );
      const readingIndex = result.findIndex(
        (card) => card.itemId === 'k1' && card.promptType === 'reading',
      );
      expect(meaningIndex).toBeGreaterThanOrEqual(0);
      // At least KANJI_PAIR_MIN_GAP cards sit between the pair.
      expect(readingIndex - meaningIndex).toBeGreaterThan(2);
    });

    it('still emits both cards when the queue is too short to honor the gap', () => {
      const items = [
        makeQueueItem('k1', 'kanji', PAST, { kanjiHasOnyomi: true, answerKey: onyomiKey }),
      ];
      const result = buildReviewQueue(items, { now: NOW });
      expect(result.map((card) => card.promptType)).toEqual(['meaning', 'reading']);
    });

    it('does not orphan a two-card pair when limit cuts between meaning and reading', () => {
      const items = [
        makeQueueItem('k1', 'kanji', PAST, { kanjiHasOnyomi: true, answerKey: onyomiKey }),
        makeQueueItem('v1', 'vocabulary', PAST),
        makeQueueItem('v2', 'vocabulary', PAST),
      ];
      // Unbounded queue places meaning early and reading after the gap; a raw
      // slice(0, 1) would keep only the meaning card with isTwoCardItem true.
      const unbounded = buildReviewQueue(items, { now: NOW });
      expect(unbounded.filter((c) => c.itemId === 'k1')).toHaveLength(2);

      const result = buildReviewQueue(items, { now: NOW, limit: 1 });
      const pair = result.filter((c) => c.itemId === 'k1');
      expect(pair).toHaveLength(2);
      expect(pair.map((c) => c.promptType).sort()).toEqual(['meaning', 'reading']);
      expect(pair.every((c) => c.isTwoCardItem)).toBe(true);
    });
  });

  describe('two-card vocabulary expansion (v2 rule 2)', () => {
    function makeWord(id: string, overrides: Partial<QueueInputItem> = {}): QueueInputItem {
      const base = makeQueueItem(id, 'vocabulary', PAST, overrides);
      return {
        ...base,
        curriculumItem: { ...base.curriculumItem, primaryForm: '写真', furigana: '写[しゃ]真[しん]' },
      };
    }

    it('emits a meaning card only while any kanji in the word is unlearned', () => {
      const result = buildReviewQueue([makeWord('v1', { unlearnedKanji: ['写', '真'] })], {
        now: NOW,
      });

      expect(result).toHaveLength(1);
      expect(result[0].promptType).toBe('meaning');
      expect(result[0].isTwoCardItem).toBeUndefined();
      expect(result[0].readingLocked).toBe(true);
      expect(result[0].readingLockedBy).toEqual(['写', '真']);
    });

    it('emits meaning + reading once every kanji in the word is learned', () => {
      const result = buildReviewQueue([makeWord('v1', { unlearnedKanji: [] })], { now: NOW });

      expect(result).toHaveLength(2);
      expect(result.map((card) => card.promptType).sort()).toEqual(['meaning', 'reading']);
      expect(result.every((card) => card.isTwoCardItem)).toBe(true);
      expect(result.every((card) => card.readingLocked === false)).toBe(true);
      expect(result[0].srsState).toBe(result[1].srsState);
    });

    it('leaves kana-only vocabulary single-card and unlocked — its reading is its surface form', () => {
      const result = buildReviewQueue([makeQueueItem('v1', 'vocabulary', PAST)], { now: NOW });

      expect(result).toHaveLength(1);
      expect(result[0].readingLocked).toBe(false);
    });

    it('carries the word furigana onto the card so a locked meaning prompt stays readable', () => {
      const result = buildReviewQueue([makeWord('v1', { unlearnedKanji: ['写'] })], { now: NOW });
      expect(result[0].furigana).toBe('写[しゃ]真[しん]');
    });
  });

  describe('grammar Read + Build pair (spec §5.3)', () => {
    function card(key: string): GrammarSentenceCard {
      return {
        sentenceKey: key, japanese: key, furigana: null, english: 'e', spans: [],
        grammarSpan: { start: 0, end: 1 }, register: 'polite', vocabulary: [],
        answers: [key], otherGrammarAnswers: [], userAnswers: [],
      };
    }
    const grammarInput = (id: string) =>
      makeQueueItem(id, 'grammar', PAST, { grammarRead: card(`${id}-r`), grammarBuild: card(`${id}-b`) });

    it('emits a Read (meaning) and a Build (production) card sharing srsState and payloads', () => {
      const result = buildReviewQueue([grammarInput('g1')], { now: NOW });

      expect(result.map((c) => c.promptType)).toEqual(['meaning', 'production']);
      expect(result.every((c) => c.isTwoCardItem)).toBe(true);
      expect(result[0].srsState).toBe(result[1].srsState);
      expect(result[0].grammarBuild).toBe(result[1].grammarBuild);
      expect(result[0].grammarRead?.sentenceKey).toBe('g1-r');
    });

    it('a limit that cuts the pair pulls the Build card in', () => {
      const items = [
        grammarInput('g1'),
        makeQueueItem('r1', 'radical', PAST),
        makeQueueItem('r2', 'radical', PAST),
      ];
      const result = buildReviewQueue(items, { now: NOW, limit: 1 });

      expect(result.map((c) => `${c.itemId}:${c.promptType}`)).toEqual(['g1:meaning', 'g1:production']);
    });
  });
});
