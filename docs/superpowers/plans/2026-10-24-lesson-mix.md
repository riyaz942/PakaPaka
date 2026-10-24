# Lesson Mix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed "one of each type" lesson with WaniKani-style unlock waves, a variable lead-weighted mix, a light/heavy cap, and a paced grammar track.

**Architecture:** All decisions live in pure functions under `mobile/src/core/lesson/` (weights, grammar pace, type mix, planner). One data function, `buildLessonPlan` in `mobile/src/data/lessonPlan.ts`, collects inputs from both databases and calls the planner; the hook, the Home card and the goal ring all read it. Reviews are not touched.

**Tech Stack:** Expo / React Native, TypeScript (strict), expo-sqlite (sync API), Jest with the hand-written `mobile/__mocks__/expo-sqlite.ts`, `tsx` + `better-sqlite3` at the repo root for the simulator.

**Spec:** `docs/superpowers/specs/2026-10-24-lesson-mix-design.md` (D-numbers below refer to its §4).

**Branch:** `feat/lesson-mix` from `main`.

## Global Constraints

- Do not change `isItemUnlocked` (`mobile/src/core/content/dependencyGraph.ts`), `queueBuilder.ts`, `reviewEligibility.ts` or `useReviewQueue.ts`. Every item a lesson returns must still pass `isItemUnlocked` with its `requires` parents.
- No writes to `curriculum.db`, no curriculum schema change, no compile-pipeline change.
- No new user.db migration. `item_study_status.updated_at` is the start time of an `in_progress` item: the only writers of `in_progress` are `startLessonItems`, `importRepository` and the per-item `StudyStatusControl` (checked 2026-10-24).
- No new Settings control. Everything scales from `getDailyLessonItems` and `getLessonItemCount`.
- `mobile/src/core/**` imports nothing from `@/data/**` (types from `@/core/**` and `@/config/constants` only).
- New constants go in `mobile/src/config/constants.ts`, each with a one-line `/** … */` comment in the file's style.
- UI: semantic NativeWind tokens only, no raw hex; copy is short and plain.
- Commands run in `mobile/` unless stated: `npx jest <path>`, `npm run lint`, `npm run typecheck`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- The expo-sqlite mock matches SQL by pattern. A new SQL string needs a branch in `mobile/__mocks__/expo-sqlite.ts`, written like the existing `FROM items` / `item_study_status` branches.

## Review Focus

1. **Placement-known items with no SRS row** (an N4 starter whose N5 is all `known`): `known` must satisfy the Guru gates and count toward the 5-kanji / 10-word thresholds. → Task 4 test `known parent satisfies the kanji gate`, Task 5 test `counts known items that have no srs row`.
2. **Local-date boundary for "grammar started today":** `updated_at` is UTC ISO; a start at 23:30 local yesterday is not "today". → Task 2 test `uses the local calendar day`.
3. **Re-mount and re-plan return the same lesson; the next lesson differs.** → Task 6 test `seeds by local day and items started today`.
4. **A lesson item that reviews would then drop.** → Task 4 test `every planned item passes isItemUnlocked`.
5. **`word_type` "adverb" read as a verb**, and **a learner with every level finished** (no crash, empty plan, not waiting). → Task 1 test `adverb is not a verb`, Task 6 test `everything finished`.

---

### Task 1: Item weights

**Files:**
- Create: `mobile/src/core/lesson/lessonWeight.ts`
- Test: `mobile/src/core/lesson/lessonWeight.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type LessonWeight = 'light' | 'normal' | 'heavy';
  export type LessonWeightFacts = {
    itemType: ContentItemType;            // from '@/core/content/content.types'
    radicalComponentCount?: number;       // kanji only
    readingComposition?: string | null;   // vocabulary: items.reading_composition
    wordType?: string | null;             // vocabulary: items.word_type
  };
  export function lessonWeight(facts: LessonWeightFacts): LessonWeight;
  ```

- [ ] **Step 1: Write the failing test**

```ts
describe('lessonWeight', () => {
  it('radical is light', () => expect(lessonWeight({ itemType: 'radical' })).toBe('light'));
  it('grammar is heavy', () => expect(lessonWeight({ itemType: 'grammar' })).toBe('heavy'));
  it.each([[1, 'light'], [2, 'normal'], [3, 'heavy'], [4, 'heavy']])(
    'kanji with %i components is %s', (n, w) =>
      expect(lessonWeight({ itemType: 'kanji', radicalComponentCount: n })).toBe(w));
  it.each([
    ['Kana only — これ.', 'noun', 'light'],
    ["Kun'yomi — 私（わたし）.", 'pronoun', 'normal'],
    ["On'yomi — 本（ほん）.", 'noun', 'normal'],
    ['Jukugo — 学生（がくせい）.', 'noun', 'normal'],
    ['Jukugo — 勉強する.', 'godan verb, transitive verb', 'heavy'],
    ['Irregular — 今日（きょう）.', 'noun', 'heavy'],
    ['Mixed — 毎朝.', 'noun', 'heavy'],
    [null, null, 'normal'],
    ['Something else', 'noun', 'normal'],
  ])('vocabulary %s / %s is %s', (rc, wt, w) =>
    expect(lessonWeight({ itemType: 'vocabulary', readingComposition: rc, wordType: wt })).toBe(w));
  it('adverb is not a verb', () =>
    expect(lessonWeight({ itemType: 'vocabulary', readingComposition: 'Jukugo — 大変.', wordType: 'adverb, noun' })).toBe('normal'));
});
```

- [ ] **Step 2: Run it — `npx jest src/core/lesson/lessonWeight.test.ts`** — Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lessonWeight` in `lessonWeight.ts`**

Category = text before the first `—`, trimmed. Verb = `/\bverb\b/` on `wordType`. Tiers per spec §6.

- [ ] **Step 4: Run the test** — Expected: PASS.

- [ ] **Step 5: Commit** — `git add mobile/src/core/lesson/lessonWeight*` · `feat(lesson): light/normal/heavy item weights`

---

### Task 2: Grammar pace (D6, D7)

**Files:**
- Create: `mobile/src/core/lesson/grammarPace.ts`
- Modify: `mobile/src/config/constants.ts` (add after `LESSON_BACKLOG_THROTTLE_FULL`)
- Test: `mobile/src/core/lesson/grammarPace.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const LESSON_GRAMMAR_DAILY_PER_ITEMS = 15;          // constants.ts
  export const LESSON_GRAMMAR_PILE_LIMIT_PER_DAILY_CAP = 10; // constants.ts
  export const LESSON_GRAMMAR_PILE_WINDOW_DAYS = 14;         // constants.ts

  export type GrammarStart = { itemId: string; startedAt: string; stage: SRSStageLabel | null };
  export type GrammarPace = { startedToday: number; recentApprentice: number };
  export function grammarDailyCap(dailyLessonItems: number): number;   // max(1, round(d / 15))
  export function grammarPileLimit(dailyLessonItems: number): number;  // cap × 10
  export function summarizeGrammarStarts(starts: GrammarStart[], now: Date): GrammarPace;
  export function isGrammarSlotOpen(pace: GrammarPace, dailyLessonItems: number): boolean;
  ```

- [ ] **Step 1: Write the failing test**

```ts
it.each([[8, 1], [15, 1], [21, 1], [28, 2], [40, 3]])('daily cap for %i items is %i', (d, c) =>
  expect(grammarDailyCap(d)).toBe(c));
it.each([[15, 10], [28, 20], [40, 30]])('pile limit for %i items is %i', (d, l) =>
  expect(grammarPileLimit(d)).toBe(l));

describe('summarizeGrammarStarts', () => {
  const now = new Date(2026, 9, 24, 9, 0);              // local 09:00
  const at = (d: Date) => d.toISOString();
  it('uses the local calendar day', () => {
    const lateYesterday = new Date(2026, 9, 23, 23, 30);
    const earlyToday = new Date(2026, 9, 24, 0, 15);
    expect(summarizeGrammarStarts([
      { itemId: 'g1', startedAt: at(lateYesterday), stage: 'apprentice' },
      { itemId: 'g2', startedAt: at(earlyToday), stage: 'apprentice' },
    ], now).startedToday).toBe(1);
  });
  it('counts Apprentice grammar started in the last 14 days only', () => {
    const daysAgo = (n: number) => at(new Date(now.getTime() - n * 86_400_000));
    expect(summarizeGrammarStarts([
      { itemId: 'a', startedAt: daysAgo(13), stage: 'apprentice' },
      { itemId: 'b', startedAt: daysAgo(15), stage: 'apprentice' },
      { itemId: 'c', startedAt: daysAgo(3), stage: 'guru' },
      { itemId: 'd', startedAt: daysAgo(1), stage: null },
    ], now).recentApprentice).toBe(2);
  });
});

it('slot closes at the daily cap', () => {
  expect(isGrammarSlotOpen({ startedToday: 1, recentApprentice: 0 }, 15)).toBe(false);
  expect(isGrammarSlotOpen({ startedToday: 1, recentApprentice: 0 }, 28)).toBe(true);
});
it('slot closes at the pile limit', () => {
  expect(isGrammarSlotOpen({ startedToday: 0, recentApprentice: 10 }, 15)).toBe(false);
  expect(isGrammarSlotOpen({ startedToday: 0, recentApprentice: 9 }, 15)).toBe(true);
});
```

- [ ] **Step 2: Run it** — Expected: FAIL.
- [ ] **Step 3: Add the three constants; implement `grammarPace.ts`.** A `null` stage counts as Apprentice. Compare local dates with `getFullYear/getMonth/getDate` (no import of `todayKey` — it lives in `@/data`).
- [ ] **Step 4: Run it** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(lesson): grammar daily cap and pile brake`

---

### Task 3: Seeded RNG and type mix (D8, D9)

**Files:**
- Create: `mobile/src/utils/seededRng.ts`, `mobile/src/core/lesson/lessonMix.ts`
- Modify: `mobile/src/config/constants.ts`
- Test: `mobile/src/utils/seededRng.test.ts`, `mobile/src/core/lesson/lessonMix.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function createSeededRng(seed: string): () => number;   // values in [0, 1)

  export const LESSON_TYPE_LEAD = { radical: 4, kanji: 2, vocabulary: 1 } as const;  // constants.ts
  export type MixType = 'radical' | 'kanji' | 'vocabulary';
  export type MixBucket = { type: MixType; available: number; remaining: number };
  export function allocateTypeSlots(slots: number, buckets: MixBucket[], rng: () => number): Record<MixType, number>;
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// seededRng.test.ts
it('repeats for the same seed', () => {
  const a = createSeededRng('2026-10-24:0'); const b = createSeededRng('2026-10-24:0');
  expect([a(), a(), a()]).toEqual([b(), b(), b()]);
});
it('differs for another seed', () =>
  expect(createSeededRng('2026-10-24:0')()).not.toBe(createSeededRng('2026-10-24:5')()));
it('stays in [0, 1)', () => {
  const r = createSeededRng('x');
  for (let i = 0; i < 1000; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
});

// lessonMix.test.ts
const early: MixBucket[] = [
  { type: 'radical', available: 50, remaining: 118 },   // weight 472
  { type: 'kanji', available: 50, remaining: 150 },     // weight 300
  { type: 'vocabulary', available: 50, remaining: 718 },// weight 718 → quotas 1.58 / 1.01 / 2.41
];
it('gives the leftover slot by the fractional parts', () => {
  expect(allocateTypeSlots(5, early, () => 0)).toEqual({ radical: 2, kanji: 1, vocabulary: 2 });
  expect(allocateTypeSlots(5, early, () => 0.99)).toEqual({ radical: 1, kanji: 1, vocabulary: 3 });
});
it('never moves a type more than one from its floor', () => {
  for (let s = 0; s < 1000; s++) {
    const a = allocateTypeSlots(5, early, createSeededRng(String(s)));
    expect(a.radical).toBeGreaterThanOrEqual(1); expect(a.radical).toBeLessThanOrEqual(2);
    expect(a.kanji).toBeGreaterThanOrEqual(1);   expect(a.kanji).toBeLessThanOrEqual(2);
    expect(a.vocabulary).toBeGreaterThanOrEqual(2); expect(a.vocabulary).toBeLessThanOrEqual(3);
  }
});
it('caps a type at what is available and gives the rest to others', () => {
  const a = allocateTypeSlots(5, [{ ...early[0], available: 1 }, early[1], early[2]], () => 0.5);
  expect(a.radical).toBe(1); expect(a.kanji + a.vocabulary).toBe(4);
});
it('fills at most what is available in total', () =>
  expect(Object.values(allocateTypeSlots(5, [{ type: 'radical', available: 2, remaining: 2 }], () => 0)))
    .toEqual([2, 0, 0]));
it('returns zeros for no buckets', () =>
  expect(allocateTypeSlots(5, [], () => 0)).toEqual({ radical: 0, kanji: 0, vocabulary: 0 }));
```

- [ ] **Step 2: Run both** — Expected: FAIL.
- [ ] **Step 3: Implement.** `createSeededRng`: a 32-bit string hash (cyrb53 or FNV-1a) seeding mulberry32. `allocateTypeSlots`:

```
alloc = {radical:0, kanji:0, vocabulary:0}; left = slots
loop while left > 0:
  open = buckets with available - alloc[type] > 0 and remaining > 0
  if open empty: break
  w[t] = LESSON_TYPE_LEAD[t] * remaining[t]; q[t] = left * w[t] / Σw
  for t in open: alloc[t] += min(floor(q[t]), available[t] - alloc[t])
  left = slots - Σalloc; if left == 0: break
  open = open still with capacity; if empty: break
  frac[t] = q[t] - floor(q[t]) (use 1e-9 when 0)
  r = rng() * Σfrac; pick first t in [radical, kanji, vocabulary] order whose cumulative frac > r
  alloc[t] += 1; left -= 1
```

- [ ] **Step 4: Run both** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(lesson): seeded rng and lead-weighted type mix`

---

### Task 4: Planner rewrite (D1, D2, D4, D5, D10, D13, D15)

**Files:**
- Modify: `mobile/src/core/lesson/lessonPlanner.ts` (full rewrite; remove `ROUND_QUOTAS` and the floor pass)
- Modify: `mobile/src/config/constants.ts`
- Test: `mobile/src/core/lesson/lessonPlanner.test.ts` (rewrite; drop the Plan 04 floor tests)

**Interfaces:**
- Consumes: Task 1 `LessonWeight`; Task 2 `GrammarPace`, `isGrammarSlotOpen`; Task 3 `allocateTypeSlots`; `GURU_PLUS` from `@/core/content/passageUnlock`; `isItemUnlocked`.
- Produces:
  ```ts
  export const LESSON_VOCAB_OPEN_MIN_KANJI = 5;    // constants.ts
  export const LESSON_GRAMMAR_OPEN_MIN_VOCAB = 10; // constants.ts
  export const LESSON_HEAVY_PER_ITEMS = 5;         // constants.ts
  export const LESSON_HEAVY_LOOKAHEAD = 10;        // constants.ts

  export type LessonItemType = 'radical' | 'kanji' | 'vocabulary' | 'grammar';
  export type LessonCandidate = {
    id: string; itemType: LessonItemType; primaryForm: string; meaning: string; sortOrder: number;
    optedIn?: boolean;
    /** D3: a lower-level radical or kanji pulled in because an active-level item needs it. */
    lowerLevelPart?: boolean;
    weight: LessonWeight;
    /** Lesson-only gate: kanji → radical component ids; vocabulary → `requires` kanji ids; else []. */
    gateParentIds: string[];
  };
  export type LessonLearnerContext = {
    kanjiStartedOrKnown: number; vocabStartedOrKnown: number;
    grammarPace: GrammarPace; dailyLessonItems: number;
  };
  export type LessonPlanInput = {
    candidates: LessonCandidate[];
    studyStatuses: Map<string, ContentStudyStatus>;
    startedItemIds: Set<string>;
    /** `requires` parents — today's review-safe rule. */
    parentsByItemId: Map<string, ContentParentItem[]>;
    /** Statuses of every `requires` and gate parent. */
    parentStatuses: Map<string, ContentStudyStatus>;
    /** Stored `srs_stage_label` of every `requires` and gate parent that has an SRS row. */
    parentStages: Map<string, SRSStageLabel>;
    learner: LessonLearnerContext;
    size: number;
    rng: () => number;
  };
  export function isReadyToLearn(candidate: LessonCandidate, input: LessonPlanInput): boolean;
  /** D11: any unstarted radical/kanji/word that passes `isItemUnlocked`. */
  export function hasStartableItems(input: LessonPlanInput): boolean;
  export function planLesson(input: LessonPlanInput): LessonCandidate[];
  ```

Rules for `isReadyToLearn` (all also require `isItemUnlocked(parentsByItemId.get(id) ?? [], parentStatuses)`):
- opted-in: that rule only (D13).
- radical: always.
- kanji: every `gateParentIds` is `known` or has a Guru+ stage.
- vocabulary: `gateParentIds` non-empty → every one `known` or Guru+; empty → `kanjiStartedOrKnown >= 5`.
- grammar: `vocabStartedOrKnown >= 10`.

- [ ] **Step 1: Write the failing tests.** Helper `input(candidates, overrides)` builds empty maps, `learner = { kanjiStartedOrKnown: 0, vocabStartedOrKnown: 0, grammarPace: { startedToday: 0, recentApprentice: 0 }, dailyLessonItems: 15 }`, `size: 5`, `rng: () => 0`; helper `c(id, type, sort, extra?)` defaults `weight: 'normal'`, `gateParentIds: []`.

```ts
it('excludes known, in_progress and already-started items');          // as today
it('holds a kanji whose radical is Apprentice', () => {
  const i = input([c('k1', 'kanji', 1, { gateParentIds: ['r1'] })]);
  i.parentStatuses.set('r1', 'in_progress'); i.parentStages.set('r1', 'apprentice');
  expect(planLesson(i)).toEqual([]);
});
it('offers it when the radical reaches Guru', () => { /* same, stage 'guru' */ expect(ids).toEqual(['k1']); });
it('known parent satisfies the kanji gate', () => { /* r1 status 'known', no stage */ expect(ids).toEqual(['k1']); });
it('holds a word whose requires kanji is Apprentice');                 // gateParentIds ['k1'], stage apprentice → []
it('holds an ungated word until 5 kanji are started', () => {
  // kanjiStartedOrKnown 4 → []; 5 → ['v1']
});
it('holds grammar until 10 words are started');                        // 9 → no g1; 10 → g1
it('takes at most one grammar per lesson', () => {
  // 3 ready grammar, dailyLessonItems 40 → exactly 1 grammar in result
});
it('takes no grammar when the slot is closed', () => {
  // grammarPace { startedToday: 1, recentApprentice: 0 }, dailyLessonItems 15 → 0 grammar
});
it('never exceeds the heavy cap and grammar counts as heavy', () => {
  // size 5 → cap 1; one ready grammar + kanji h1..h3 heavy + kanji n1..n3 normal
  // result has g1, no heavy kanji
});
it('a skipped heavy item comes in the next lesson', () => {
  // size 5, no grammar; kanji queue [h1 heavy, h2 heavy, n1..n10 normal], only kanji ready
  // lesson 1 contains h1 not h2; mark lesson 1 started; lesson 2 contains h2
});
it('looks only LESSON_HEAVY_LOOKAHEAD items past a blocked heavy', () => {
  // kanji queue: 12 heavy then 1 normal, heavy cap already used by grammar → no kanji; vocab fills the slots
});
it('opt-ins come first, ignore the Guru gate and keep type order', () => {
  // opted-in kanji k9 with Apprentice radical gate, opted-in radical r9 → result starts ['r9','k9']
});
it('lower-level parts lead their type', () => {
  // radicals r1 (sort 1) and p1 (sort 70, lowerLevelPart) → p1 before r1
});
it('orders the lesson radical, kanji, vocabulary, grammar');
it('same rng → same lesson; varied rng → varied mixes', () => {
  // 40 ready of each R/K/V; seeds '0'..'49' → at least 3 distinct type-count tuples
});
it('every planned item passes isItemUnlocked', () => {
  // 200 random fixtures from createSeededRng: random requires parents, statuses, stages
  for (const item of planLesson(i))
    expect(isItemUnlocked(i.parentsByItemId.get(item.id) ?? [], i.parentStatuses)).toBe(true);
});
it('hasStartableItems: true for a gated kanji, false when only grammar is left');
```

- [ ] **Step 2: Run it — `npx jest src/core/lesson/lessonPlanner.test.ts`** — Expected: FAIL.
- [ ] **Step 3: Add the four constants; rewrite `lessonPlanner.ts`.**

```
unstarted = candidates − known − in_progress − startedItemIds
ready     = unstarted.filter(isReadyToLearn)
sortKey   = optedIn desc, lowerLevelPart desc, sortOrder asc
heavyCap  = max(1, round(size / LESSON_HEAVY_PER_ITEMS)); heavy = 0; picked = []

1 opt-ins:  ready.filter(optedIn), type order R,K,V,G then sortKey → take up to size (count heavies, never skip)
2 grammar:  if picked < size && isGrammarSlotOpen(learner.grammarPace, learner.dailyLessonItems)
            && heavy < heavyCap && a non-opted ready grammar exists → take the first; heavy++
3 queues:   per R/K/V, non-opted ready sorted by sortKey; remaining[t] = unstarted count of t
  loop: need = size − picked; if 0 break
        buckets = types with a non-empty queue → { type, available: queue.length, remaining }
        if none break
        alloc = allocateTypeSlots(need, buckets, rng); took = 0
        for t in R,K,V: repeat alloc[t] times:
          j = first index in queue[t][0 .. LESSON_HEAVY_LOOKAHEAD] with weight ≠ heavy or heavy < heavyCap
          if none: queue[t] = []; stop this type
          take queue[t][j] (remove it); if heavy-weight: heavy++; took++
        if took == 0 break
4 order:    opt-ins block first (as taken), then the rest by type R,K,V,G, then sortKey
```

- [ ] **Step 4: Run it** — Expected: PASS. Also run `npx jest src/core` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(lesson): wave-gated, weighted, variable lesson planner`

---

### Task 5: Data queries

**Files:**
- Modify: `mobile/src/data/curriculum/itemRepository.ts`
- Create: `mobile/src/data/user/lessonLearnerRepository.ts`
- Modify: `mobile/__mocks__/expo-sqlite.ts` (branches for the two new SQL strings)
- Test: `mobile/src/data/curriculum/itemRepository.test.ts`, `mobile/src/data/user/lessonLearnerRepository.test.ts`

**Interfaces:**
- Consumes: Task 2 `GrammarStart`.
- Produces:
  ```ts
  // itemRepository.ts
  /** Radical parents (`builds_on`, parent type radical) per kanji id. */
  export function getRadicalComponentsForItems(db: SQLiteDatabase, itemIds: string[]): Map<string, CurriculumParentItem[]>;
  export type VocabularyWeightFacts = { readingComposition: string | null; wordType: string | null };
  export function getVocabularyWeightFacts(db: SQLiteDatabase, itemIds: string[]): Map<string, VocabularyWeightFacts>;

  // lessonLearnerRepository.ts
  /** Ids with an srs_states row or status in_progress / known, each counted once. */
  export function countStartedOrKnownItems(userDb: SQLiteDatabase, itemIds: string[]): number;
  /** in_progress items among `grammarIds`: startedAt = item_study_status.updated_at, stage = srs_stage_label or null. */
  export function listGrammarStarts(userDb: SQLiteDatabase, grammarIds: string[]): GrammarStart[];
  ```

- [ ] **Step 1: Write the failing tests**
  - `getRadicalComponentsForItems`: kanji `k1` with `builds_on` parents radical `r1` and radical `r2`, word `w1` with `builds_on` parent kanji `k1` → `get('k1')` ids `['r1','r2']`, `get('w1')` undefined.
  - `getVocabularyWeightFacts`: item with `reading_composition: "Kun'yomi — 私（わたし）."`, `word_type: 'pronoun'` → `{ readingComposition: "Kun'yomi — 私（わたし）.", wordType: 'pronoun' }`; item with nulls → `{ readingComposition: null, wordType: null }`.
  - `countStartedOrKnownItems`: `a` srs row only, `b` in_progress + srs row, `c` known with no srs row, `d` nothing → `3` for `['a','b','c','d']` (**counts known items that have no srs row**).
  - `listGrammarStarts`: `g1` in_progress, updated_at `2026-10-24T01:00:00.000Z`, srs stage `guru`; `g2` known; `g3` in_progress, no srs row → `[{ itemId: 'g1', startedAt: '2026-10-24T01:00:00.000Z', stage: 'guru' }, { itemId: 'g3', …, stage: null }]`.
- [ ] **Step 2: Run them** — Expected: FAIL.
- [ ] **Step 3: Implement.** `getRadicalComponentsForItems` = `getParentsByRelationshipType(db, ids, 'builds_on', true)` filtered to radicals (no new SQL). `getVocabularyWeightFacts`: `SELECT id, reading_composition, word_type FROM items WHERE id IN (…)`, chunked like `listItemSummariesByIds`. `countStartedOrKnownItems` from `getSrsStatesForItems` + `listStudyStatusesForItems` (no new SQL). `listGrammarStarts`: `SELECT item_id, updated_at FROM item_study_status WHERE status = 'in_progress' AND item_id IN (…)`, chunked, plus `getSrsStatesForItems`. Add mock branches for the two new SQL strings.
- [ ] **Step 4: Run them, then `npx jest src/data`** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(lesson): weight, component and learner-count queries`

---

### Task 6: `buildLessonPlan` (D3, D11, D14, D16, D17) and thin hook

**Files:**
- Create: `mobile/src/data/lessonPlan.ts`, `mobile/src/data/lessonPlan.test.ts`
- Modify: `mobile/src/data/hooks/useLessonPlan.ts` (thin wrapper), `mobile/src/data/hooks/useLessonPlan.test.tsx` (move the four opt-in cases to `lessonPlan.test.ts`; keep a wrapper test)

**Interfaces:**
- Consumes: Tasks 1–5; existing `listLessonCandidatePool`, `getOptInPoolForItems`, `getRequiredParentsForItems`, `listItemSummariesByIds`, `listItemsByLevelAndType`, `listStudyStatusesForItems`, `getSrsStatesForItems`, `getDueSrsStates`, `getLessonItemsStartedOn`, `todayKey`, `computeDailyAllowance`, preferences getters, `isVacationActive`, `listLessonOptInIds`.
- Produces:
  ```ts
  export type LessonPlan = {
    items: LessonCandidate[];
    /** Radical/kanji/vocabulary level. */
    level: JLPTLevel | null;
    /** D17: lowest level ≥ the starting level with unstarted grammar. */
    grammarLevel: JLPTLevel | null;
    size: number; allowance: DailyAllowance; capReached: boolean;
    /** Startable radicals/kanji/words exist but none is ready (waiting on Guru). */
    waiting: boolean;
  };
  export type BuildLessonPlanOptions = { ignoreAllowance?: boolean; now?: Date; sizeOverride?: number };
  export function buildLessonPlan(curriculumDb: SQLiteDatabase, userDb: SQLiteDatabase, options?: BuildLessonPlanOptions): LessonPlan;
  // useLessonPlan(options) keeps its signature; returns LessonPlan & { isLoading; refetch }
  ```

Assembly (per level, from the starting level up):
1. Pool = level items minus grammar (`listLessonCandidatePool`), then D3 parts, then opt-in pool (`optedIn: true`), then grammar candidates of `grammarLevel`; dedupe by id, first wins.
2. D3 parts: for pool kanji → `getRadicalComponentsForItems`; for pool words → `getRequiredParentsForItems`; every parent id not in the level pool is a lower-level part (curriculum bands guarantee it). For part kanji, add their radical components not in the pool. Rows from `listItemSummariesByIds`, `lowerLevelPart: true`.
3. `gateParentIds`, `weight` (Task 1 with Task 5 facts), statuses, stages, `startedItemIds` as in the Task 4 `LessonPlanInput`.
4. First level where `hasStartableItems` is true wins; if none, the last level (grammar-only or empty).
5. Learner context: `countStartedOrKnownItems` over all kanji / all vocabulary ids (`listItemsByLevelAndType` per `JLPT_LEVELS`); `summarizeGrammarStarts(listGrammarStarts(all grammar ids), now)`.
6. `size = sizeOverride ?? getLessonItemCount`; allowance and `effectiveSize` as today. `full = planLesson(size)`; `items = effectiveSize < size ? (effectiveSize > 0 ? planLesson(effectiveSize) : []) : full`; `capReached` as today; `waiting = hasStartableItems && !full.some(i => i.itemType !== 'grammar')`.
7. Each `planLesson` call gets a fresh `createSeededRng(\`${todayKey(now)}:${itemsStartedToday}\`)`.
8. Every date read uses `now` (default `new Date()`).

- [ ] **Step 1: Write the failing tests** in `lessonPlan.test.ts`, mocking repositories the way `useLessonPlan.test.tsx` does today (plus `@/utils/seededRng` wrapped to record seeds):
  - ported opt-in cases: pool-only; opt-in union with `1091` before `2552` and both ahead of `r1`/`k1`; **does not displace the rest**: with 2 opt-ins and size 5, 3 level items remain; dedupe.
  - `waiting`: N5 pool = `r1` (in_progress, apprentice) and `k1` gated on `r1`; N4 has items → `items` `[]`, `waiting` true, `level` `'N5'`. (`r1` must be in the N5 pool; a parent outside the pool is a D3 lower-level part.)
  - level finished: every N5 radical/kanji/word started → `level` `'N4'`.
  - grammar track: N5 radicals/kanji/words started, N5 `g1` unstarted, 10 words started → `level` `'N4'`, `grammarLevel` `'N5'`, `items` contain `g1`.
  - D3: start N4; N4 word `w4` requires N5 `k5`; `k5` has radical `r5`; both unstarted → plan contains `r5` with `lowerLevelPart`, not `k5`, and no other N5 item; with `r5` at guru → plan contains `k5`; with `k5` `known` → neither is offered.
  - **seeds by local day and items started today**: `now = new Date(2026, 9, 24, 9)`, started today 0 then 5 → seeds `'2026-10-24:0'` then `'2026-10-24:5'`; two calls with the same state return equal `items`.
  - **everything finished**: all items started → `items` `[]`, `waiting` false, no throw.
  - vacation → empty plan (as today).
- [ ] **Step 2: Run it — `npx jest src/data/lessonPlan.test.ts`** — Expected: FAIL.
- [ ] **Step 3: Implement `lessonPlan.ts`; reduce `useLessonPlan` to state + `buildLessonPlan` in the effect, with the existing try/catch to the empty plan (add `grammarLevel: null`, `waiting: false`).** The wrapper test asserts `ignoreAllowance` is passed through and `refetch` calls `buildLessonPlan` again.
- [ ] **Step 4: Run `npx jest src/data src/core`** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(lesson): buildLessonPlan with waves, grammar track and lower-level parts`

---

### Task 7: Waiting state, Home card, goal ring (D12)

**Files:**
- Modify: `mobile/src/app/lesson/index.tsx` (empty states, ~line 323), `mobile/src/app/(tabs)/index.tsx` (`readLessonAllowance`, `lesson-cta` card), `mobile/src/data/user/goalRingRepository.ts`
- Test: `mobile/src/app/lesson/index.test.tsx`, `mobile/src/app/(tabs)/index.test.tsx`, `mobile/src/data/user/goalRingRepository.test.ts`

**Interfaces:**
- Consumes: Task 6 `buildLessonPlan`, `LessonPlan.waiting`.

Copy (exact):
- Lesson screen, `items.length === 0 && !capReached && waiting`, `testID="lesson-waiting"`: title **"New items are on the way"**, body **"Your next items unlock when the items they build on reach Guru. Do your reviews, then check back."**, button **Back**.
- Home card subtitle when `remaining > 0` and the plan has no items and `waiting`: **"New items unlock as your reviews level up"**; card `muted`; accessibility label **"New lesson items are waiting on reviews"**.

- [ ] **Step 1: Write the failing tests**
  - lesson: hook mocked to `{ items: [], capReached: false, waiting: true }` → `lesson-waiting` shown, "Nothing new today" not shown; `waiting: false` → "Nothing new today" as before; `capReached: true` → cap screen wins.
  - Home: `buildLessonPlan` mocked to `{ items: [], waiting: true }` with allowance remaining 10 → subtitle text above.
  - ring: allowance total 15, 5 started today, `buildLessonPlan` mocked to 3 items → target lesson part `8` (`computeDailyGoalTarget` receives `lessonAllowanceTotal: 8`); `buildLessonPlan` called with `{ ignoreAllowance: true, sizeOverride: 10 }`; remaining 0 → `lessonAllowanceTotal` = `allowance.total`, `buildLessonPlan` not called.
- [ ] **Step 2: Run them** — Expected: FAIL.
- [ ] **Step 3: Implement.** Lesson: read `waiting` from `useLessonPlan`, branch after `capReached`. Home: inside the existing `readLessonAllowance` try, also read `buildLessonPlan(curriculumDb, userDb)` and keep `lessonWaiting = plan.items.length === 0 && plan.waiting`. Ring: `lessonAllowanceTotal = remaining > 0 ? Math.min(total, lessonItemsToday + buildLessonPlan(…, { ignoreAllowance: true, sizeOverride: remaining }).items.length) : total`.
- [ ] **Step 4: Run them, then `npx jest`** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(lesson): waiting state on lesson, Home and goal ring`

---

### Task 8: Simulator acceptance and docs

**Files:**
- Create: `scripts/simulate-lessons.ts` (repo root)
- Modify: `docs/superpowers/specs/2026-10-24-lesson-mix-design.md` (Status line; §7 if tuned), `docs/working-history.md` (this spec's row)

**Interfaces:**
- Consumes: the real `buildLessonPlan`, `runMigrations` + `migrations` (`mobile/src/data/migrations`), preference setters, `summarizeGrammarStarts`, `grammarDailyCap`, `grammarPileLimit`.

- [ ] **Step 1: Write the simulator.** Run with `npx tsx --tsconfig mobile/tsconfig.json scripts/simulate-lessons.ts` from the repo root.
  - Adapter: a class over `better-sqlite3` exposing `execSync`, `runSync`, `getAllSync`, `getFirstSync`, `withTransactionSync` (add any other method a called function needs). Curriculum = `mobile/assets/curriculum-seed/curriculum.db` read-only; user = `:memory:` with all migrations.
  - Runs: presets light (8/day, 5 per lesson), relaxed (15, 5), immersive (40, 10) × answer models "all correct" and "20% wrong"; starting level N5; 30 days; each day at local 09:00, one minute later per lesson.
  - Review model (seeded): an item reaches Guru 2 days after start; in "20% wrong" each Guru check fails with p = 0.2 and moves it 2 days later. Each morning set `srs_stage_label` from this model; keep `due_date` far ahead so the backlog throttle never fires.
  - Lessons: call `buildLessonPlan(cur, user, { now })` until the day's allowance is used or `items` is empty; write the items yourself (`item_study_status` in_progress with `updated_at = now`, an `srs_states` row from `createInitialSrsState(id, now)` with the model's stage, `daily_lesson_log` += count).
  - Print a day table (R/K/V/G per day) per run, then check and exit 1 on any failure:
    - days 1–2: radicals only;
    - first kanji by day 3, first word by day 4, first grammar by day 7;
    - grammar per day ≤ `grammarDailyCap(daily)` every day;
    - after day 4, ≥ 80% of consecutive lesson pairs have a different type-count tuple;
    - radical share of week 1 > week 4; vocabulary share of week 1 < week 4;
    - "20% wrong": days where grammar was ready but `recentApprentice ≥ grammarPileLimit(daily)` ≤ 3 of 30.
  - If the chain imports a native module and `tsx` cannot load it, stop and report; do not stub product code.
- [ ] **Step 2: Run it** — Expected: all six runs print tables and the script exits 0. If a pass line fails, tune only the §7 constants, rerun, and record the new values and the reason in the spec's §7.
- [ ] **Step 3: Full gates in `mobile/`: `npx jest`, `npm run lint`, `npm run typecheck`** — Expected: all pass. At the root: `npm test` — Expected: PASS.
- [ ] **Step 4: Docs.** Spec status → `Code done; in-app check pending`. `working-history.md` row → `Partial — code done YYYY-MM-DD (plan: docs/superpowers/plans/2026-10-24-lesson-mix.md); in-app check pending`, plus the simulator's relaxed day table in one line (days 1–5).
- [ ] **Step 5: Commit** — `test(lesson): simulator acceptance for the lesson mix; docs`
