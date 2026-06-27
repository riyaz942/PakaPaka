# Deferred Work

## Deferred from: code review of 4-3-item-detail-screens-kanji-vocabulary-grammar (2026-06-21)

- **Vocabulary examples absent from bundled N5 curriculum** — `compile-curriculum.ts` only inserts `example_sentences` for grammar items; vocabulary detail UI is implemented but bundled seed has no vocab-keyed sentences. Address in curriculum compiler or data story.
- **Uncaught JSON.parse in getGrammarRule** — Spec assumes compile-time JSON validation; defensive parsing can be added if corrupt DB rows become a concern.
- **Number(itemId) coercion for non-numeric params** — Pre-existing repository pattern from Story 4.2; route param validation is a cross-cutting concern.

## Deferred from: code review of 4-4-reading-passages-with-comprehension-prompts (2026-06-25)

- **`useLocalSearchParams` id may be `string[]`** — Same pattern as Learn item route; cross-cutting Expo Router param normalization.
- **`JSON.parse` on `accepted_answers` has no try/catch** — Compile-time validated seed; matches grammar rules repository pattern.

## Deferred from: code review of 4-6-personal-mnemonics-editor (2026-06-27)

- **No error handling in `useEffect` / `handleSave` for DB or `parseItemId` exceptions** — `PersonalMnemonicEditor.tsx`. Pre-existing pattern across all user repos and PassageQuestion; address with a cross-cutting error boundary or Result wrapper when ready.
- **`clearPersonalMnemonic` has no direct unit test** — All AC6-required test cases are covered; a standalone clear test is a minor completeness gap, not spec-required.
- **Migration 005 has no `down` path** — Pre-existing pattern across all migrations.
- **`updated_at` column lacks `CHECK` constraint enforcing ISO format** — Pre-existing; no existing migration enforces format constraints. A future schema-lint migration could add them globally.
- **`withTransactionSync` mock rollback snapshot omits `personal_mnemonics` table** — Single-statement migration; no current test exercises rollback of migration 005. Include when adding mid-migration failure tests.
- **`runSync` mock always returns `{ changes: 1 }` regardless of actual rows affected** — Pre-existing mock behavior across all table handlers. Impacts future `.changes` guards.
- **One-render stale text visible when `itemId` prop changes before `useEffect` fires** — Accepted pattern; same as `PassageQuestion`. Add `initialText` prop or transition guard if user-visible flash is observed.
- **`parseItemId` admits scientific-notation integers (`1e20` passes `Number.isInteger`)** — Hypothetical; item IDs from curriculum DB are bounded integers. Add upper-bound guard if IDs ever arrive from untrusted sources.
- **"persists personal mnemonic text after save" test asserts local state, not DB round-trip** — DB persistence is thoroughly covered in `mnemonicRepository.test.ts`; consider adding unmount/remount cycle if a regression is ever suspected.

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

## Deferred from: code review of 5-1-review-queue-builder-fsrs-scheduling-and-prefetch (2026-06-27)

- **N+1 per-item `getItemById` in queue build** — `useReviewQueue.ts`. Acceptable at N5 scale per dev notes; optimize with batch fetch if queue build exceeds 100ms budget.
- **Per-item `getSrsState` in seed transaction** — `srsStateRepository.ts`. Bulk existence check optimization for large in_progress counts.
- **`QUEUE_FETCH_LIMIT` may truncate due items beyond cap** — `srsStateRepository.ts`. Documented limit; paginate remaining due items in a future session if cap is hit in production.
- **Duplicate unlock filtering in hook and `queueBuilder`** — Redundant but correct; consolidate when refactoring queue build path.
- **No cross-module test verifying stage boundaries match `fsrsConverter.ts`** — Import and runtime paths share comment alignment only; add shared constants test if drift is observed.
