# Deferred Work

## Deferred from: code review of 4-3-item-detail-screens-kanji-vocabulary-grammar (2026-06-21)

- **Vocabulary examples absent from bundled N5 curriculum** — `compile-curriculum.ts` only inserts `example_sentences` for grammar items; vocabulary detail UI is implemented but bundled seed has no vocab-keyed sentences. Address in curriculum compiler or data story.
- **Uncaught JSON.parse in getGrammarRule** — Spec assumes compile-time JSON validation; defensive parsing can be added if corrupt DB rows become a concern.
- **Number(itemId) coercion for non-numeric params** — Pre-existing repository pattern from Story 4.2; route param validation is a cross-cutting concern.

## Deferred from: code review of 4-4-reading-passages-with-comprehension-prompts (2026-06-25)

- **`useLocalSearchParams` id may be `string[]`** — Same pattern as Learn item route; cross-cutting Expo Router param normalization.
- **`JSON.parse` on `accepted_answers` has no try/catch** — Compile-time validated seed; matches grammar rules repository pattern.

## Deferred from: code review of 4-5-dependency-graph-visibility-for-unlock-status (2026-06-27)

- **Synchronous DB calls without try/catch in new hooks** — `useItemDependencyStatus` and `parentStatusMap` useMemo call `getRequiredParentsForItems`/`listStudyStatusesForItems` without error guards; pre-existing pattern across `useItemDetail`, `useLearnItems`, etc. Address with a cross-cutting error boundary or Result wrapper when ready.
- **`parentStatusMap` useMemo performs DB I/O on render thread** — Consistent with pre-existing `dependencyParentsByItemId` useMemo pattern; move to useEffect/state if render jank is observed on large item lists.
- **`renderItem` closure in FlatList not memoized** — Pre-existing; extract to `useCallback` if list scroll performance degrades.
- **`useItemDependencyStatus` queries DB for radical/grammar items unconditionally** — Returns empty result correctly; skip query when `itemType` is radical/grammar as a perf optimization.
- **Two new `[level].test.tsx` tests duplicate item fixture setup** — Refactor to extend `createCurriculumDb` helper rather than copy-pasting item objects.
- **`__mockSetItemStudyStatuses` item_id number vs string type** — Mock stores `item_id: number`; verify mock's IN-clause filter matches string IDs from `listStudyStatusesForItems` without type coercion bugs.
- **Weak "no prerequisites unchanged" test** — Add a test that verifies the locked→unlocked transition when a study status row is added.
- **`KanjiDependencyHints` name is kanji-specific but now handles vocabulary** — Rename to `DependencyHints` or `ItemPrerequisiteHints` in a future refactor.
- **`parentStatuses` exported in `ItemDependencyStatus` but unused by callers** — Remove from public type or consume it when Epic 5 reinforcement display needs it.
