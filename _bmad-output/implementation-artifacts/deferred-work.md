# Deferred Work

## Deferred from: code review of 5-2-push-to-talk-voice-with-on-device-tts-stt (2026-07-21)

- **Presence check is basename-only (no size/hash)** — `areVoiceModelsDownloaded` trusts listed filenames; cache-then-move already keeps half-files out of the listing. Deeper integrity (size/hash) deferred pending on-device soak (`modelDownloadManager.ts`).
- **Cloud STT `Blob`+`FormData` multipart path unproven on device** — unit tests cover field names against mocks; first real-device build must confirm WAV upload encoding through `expo/fetch` (`cloudSttClient.ts`).
- **`getAiSession` outside grammar `try`** — sync SQLite throw would crash the session effect; pre-existing 5.1 pattern in `session/[id].tsx`, not introduced by PTT wiring.
- **`handleFinish` does not catch `end()` failure** — end prompt can stick / summary never opens; pre-existing wrap-up path from 5.1.
- **Connectivity checked once per focus** — mid-session offline/online flips do not refresh the chat gate; pre-existing Conversation connectivity UX from 5.1.

## Deferred from: code review of 5-1-platform-floor-byok-chat-session-summary (2026-07-21)

- **OpenAI-compatible requests always send `max_tokens`** — some newer compatible models prefer/require `max_completion_tokens`; deferred as provider API variance beyond v1 transport normalize (`openAiCompatibleAdapter.ts`).
- **Auto-scroll on every content-size change during streaming** — `session/[id].tsx` always `scrollToEnd`s; learners reading earlier turns or opening lookup get dragged to the bottom. Deferred UX polish.
- **Assistant reply completion has no live-region announcement** — screen readers may miss that a new AI turn arrived; NFR29’s non-gesture lookup alternative is already present. Deferred a11y polish.

## Deferred from: code review of 7-3-automated-accessibility-checks-in-ci (2026-07-02)

- **Unrelated quote-style churn bundled into `eslint.config.js`** — double→single quotes changed on pre-existing lines alongside the feature change; diff-hygiene nit, not a defect.
- **`eslint-plugin-react-native-a11y` pinned with caret range (`^3.5.1`) while gating CI merges** — a minor version bump could silently change the enabled rule set and break a future PR's lint step with no code change on that PR's part.
- **`index.test.tsx` hardcodes `/review 2 items due/i`** — couples an a11y-label assertion to an incidental mock due-count; pre-existing test-writing convention in this codebase.
- **`settings.test.tsx` asserts hardcoded `toggle.props.value === false`** — no corresponding "toggled to true" counterpart test.
- **New review test conflates label-existence and wrong-answer-submission concerns** — weakly-motivated `'wrong'` input value with no assertion on the resulting incorrect-answer state; test-quality nit not required by AC3.
- **`collapsible.tsx` has no accompanying test coverage for its new a11y props** — the only production code change in the diff; out of AC3's explicit Home/Review/Settings scope.
- **`sprint-status.yaml` modified but not listed in the story's own File List section** — bookkeeping gap only.
- **`delete a11yRules['react-native-a11y/has-accessibility-hint']` silently becomes a no-op if the plugin renames/removes that rule ID** — theoretical future-plugin-upgrade risk.

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

## Deferred from: code review of 5-3-answer-input-and-validation (2026-06-28)

- **Reading prompt with no accepted readings grades meaning answer as Good (3)** — `reviewAnswerEvaluator.ts`. Documented AC7 seed-gap fallback; rewards the wrong skill and advances FSRS scheduling. Revisit when vocabulary `reading` accepted-answers are seeded by the curriculum compiler (consider blocking reading prompts for items with no reading at the queue/promptResolver level instead of falling back to meaning).
- **`getGrammarRule` unguarded `JSON.parse`** — `itemRepository.ts`. One malformed `conjugation_rules`/`accepted_forms` row throws and fails the entire queue build (caught into an error state, no crash). Pre-existing and seed is compiler-controlled; wrap in try/catch returning `null` if untrusted content is ever introduced.
- **Per-keystroke `toKana` cursor position** — `WanaKanaInput.tsx`. Whole-field reconversion on each keystroke doesn't preserve caret position for mid-string edits. Inherent wanakana IME behavior; acceptable for v1, revisit if users report editing friction.

## Deferred from: code review of 5-4-progressive-hints-reinforcement-and-related-item-boosts (2026-06-28)

- **`clearBoosts` failure silently swallowed in production** — `useReviewQueue.ts`. Best-effort persistence is explicitly spec-designed; `console.warn` only in `__DEV__`; bounded by cap. A failed clear allows the boost to persist into a second build (cap-bounded). Consider production logging if queue distortion is observed.
- **O(n²) sort comparator in `resolveReinforcement`** — `reinforcementResolver.ts`. `find` inside the sort comparator; negligible at N5 scale (max ~14 reinforces edges); build a `Map<id, RelatedItem>` before sorting when reinforcement graph grows.
- **Boost write not retried on `catch` in `ReviewSessionProvider`** — Best-effort by spec; SRS grade path is independent; boost loss on provider throw doesn't affect FSRS schedule.
- **Mock `item_id` type divergence risk** — `__mocks__/expo-sqlite.ts`. Mock correctly mirrors current integer-ID contract; future risk if `item_id` is ever stored as TEXT.
- **SQLite `SQLITE_LIMIT_VARIABLE_NUMBER` (999) not chunked** — `itemRepository.ts`, `relatedItemBoostRepository.ts`, `srsStateRepository.ts`. N5 curriculum is ~100 items; chunk `IN (...)` queries into batches of ≤999 when curriculum grows to JLPT N4+.
- **`levels` prop shrinks while `revealedCount > levels.length`** — `ProgressiveHint.tsx`. Levels is static per item in practice; make `visibleLevels = levels.slice(0, Math.min(revealedCount, levels.length))` if dynamic levels are ever introduced.

## Deferred from: code review of 6-3-cognitive-load-ring-and-daily-threshold-guidance (2026-06-29)

- **Midnight rollover drift** — `baseLoad` seeded from the old day's key if a review session crosses midnight; `gradeCurrentItem` writes to the new date row while the in-session percent still uses the old baseline. Accepted v1 limitation per spec ("do not over-engineer DST"); revisit if a bug is reported.
- **`thresholdRef` not re-computed when session intensity changes mid-session** — Preference is set at onboarding and rarely changed; threshold stays at the mount-time value for the session's lifetime.
- **Same-day multi-session threshold adaptation blind to today's earlier load** — `getRecentDailyLoads` filters `date < today`, so a second same-day session does not factor the first session's load into threshold adaptation. Design-consistent v1 approach; revisit if users report premature 100% on multi-session days.
- **Threshold notice re-shows after `ReviewScreen` unmount/remount** — `thresholdNoticeShownRef` is a local ref (no persistence). A tab-switch mid-session resets it, allowing the notice to appear a second time. Add a `useRef` keyed to today's date in AsyncStorage if this is user-reported.
- **Mock `LIMIT ?` parameter extraction fragility** — `expo-sqlite.ts` test mock uses `params[params.length - 1]` to extract the LIMIT value; silently breaks if query gains a trailing param after LIMIT.

## Deferred from: code review of 6-2-stats-tab-with-weakness-trends-and-srs-stage-breakdown (2026-06-28)

- **error.userMessage never set** — `useSRSBreakdown.ts` constructs AppError with `{code, message, cause}` but no `userMessage`; screen's `error.userMessage ?? fallback` always falls through to generic copy. Pre-existing AppError design limitation; provide userMessage in hook error construction when UX requires specific error messages.
- **Mock GROUP BY ignores WHERE clauses** — `__mocks__/expo-sqlite.ts` new GROUP BY branch groups over unfiltered rows; current query has no WHERE so tests pass. If a WHERE-filtered variant is added, the mock will return wrong counts silently.
- **SRS_STAGE_LABELS and emptyStageCounts manual sync** — `srsStateRepository.ts` has two separate enumerations of the five stage labels; TypeScript's exhaustive Record catches additions at compile time, low risk.
- **STAGE_LABEL map duplicated** — `SrsStageBreakdown.tsx` and `SRSStageIndicator.tsx` each define capitalized display names independently; refactor into a shared constant if labels ever change.

## Deferred from: code review of 6-5-post-session-summary-and-home-screen-composition (2026-06-29)

- **`useLevelProgress` runs 6+ synchronous DB calls per focus event** — pre-existing pattern across `useStreak`, `useCognitiveLoad`; optimize with async if render jank is observed on large curriculum levels. [`mobile/src/data/hooks/useLevelProgress.ts`]
- **`navigatedToSummaryRef` never reset if review component instance reused** — not current Expo Router behavior; revisit if stack keep-alive is enabled. [`mobile/src/app/review/index.tsx`]
- **`dueCount` capped at `QUEUE_FETCH_LIMIT` (100) with no visual truncation indicator** — pre-existing `getDueSrsStates` behavior; already noted in story 5-1 deferred work. [`mobile/src/data/user/srsStateRepository.ts`]
- **`sessionSummary` object allocated every render with no memoization** — correctness unaffected; adds allocations and breaks `useEffect` dep-array stability for any future consumer; add `useMemo` if instability is observed. [`mobile/src/providers/ReviewSessionProvider.tsx`]
- **`level` state not refreshed in `useFocusEffect`** — Settings level-change UX not yet built; revisit when Settings allows JLPT level editing. [`mobile/src/app/(tabs)/index.tsx`]

## Deferred from: code review of 6-4-streak-tracking-and-opt-in-notifications (2026-06-29)

- **`useStreak` no midnight refetch trigger** — stale `currentStreak`/`lastReviewDate` DB values persist until `refetch()` or remount; `streakState` derivation uses fresh `todayKey()` per render. Accepted v1 limitation. [`mobile/src/data/hooks/useStreak.ts`]
- **`isComplete` streak effect re-fires on `userDb` reference change past midnight** — if context parent re-renders while `isComplete=true` after midnight, `recordReviewAndUpdateStreak` fires again; same-day idempotency guard protects against double-count within one calendar day. [`mobile/src/providers/ReviewSessionProvider.tsx`]
- **`isGrading.current` drops rapid successive grades** — pre-existing behavior; second grade within the async `.finally()` window is silently discarded with no retry. [`mobile/src/providers/ReviewSessionProvider.tsx`]
- **`yesterdayKey` DST edge case** — `new Date(year, month-1, day-1)` is local-time and could mis-calculate across a DST boundary; spec explicitly accepts "do not over-engineer DST" for v1. [`mobile/src/data/user/streakRepository.ts`]
- **Notification content hardcoded English** — no i18n path for "Time to review!" and body copy; out of scope for MVP. [`mobile/src/config/notifications.ts`]

## Deferred from: code review of 7-1-screen-reader-keyboard-and-input-accessibility (2026-06-30)

- **No test coverage for cleanup/rapid-state-transition paths** — Testing async cleanup races in the focus-management effect is a real gap but out of scope for this story's test charter.
- **Typo state a11y label `"Close, try again"` gives no context about what was wrong** — SR user sees generic retry prompt with no indication of which characters were off. UX decision for a future story.
- **No `min-h-[44px]` on ProgressiveHint Pressable and other non-Button controls** — Pre-existing sizing across multiple components; audit touch targets globally in story 7.2 or a dedicated pass.
- **AC5 regression test doesn't prove end-to-end romaji→kana→evaluator path** — Component test covers conversion; integration-level test gap is a test architecture choice.

## Deferred from: code review of spec-beautify-home-tab (2026-07-04)

- **`useReducedMotion` reads the in-app preference once per mount** — a Settings toggle while Home stays mounted doesn't propagate to already-mounted `FadeSlideIn`/`PressableScale` instances until remount; pre-existing hook design (local `useState` seed, no shared subscription). [`mobile/src/data/hooks/useReducedMotion.ts`]
- **Review a11y label says "Review 1 items due" for a single item** — pre-existing label wording, pinned verbatim by tests and this story's AC ("identical to today"); the new visible subtitle pluralizes correctly, so label and subtitle diverge at dueCount=1. Fix label + test together in a copy pass. [`mobile/src/app/(tabs)/index.tsx`]

## Deferred from: code review of 2-1-adaptive-goal-ring-from-lessons-reviews (2026-07-20)

- **Mid-session goal denominator stays stale** — `ReviewSessionProvider` resolves sticky goal once when the queue loads; accepting a rise/reduction or editing Settings mid-session leaves in-session percent on the old goal until remount. Session-capture pattern; out of Home-focused AC scope.
- **Device clock rollback can re-judge a week** — if stored `goalWeekStart` is after `weekStartKey(now)`, `runWeeklyGoalCheck` re-runs the prior-week judgment and can double-apply miss/offer updates. Rare clock/timezone edge.

## Deferred from: code review of 1-2-review-pacing-reveal-card-progress (2026-07-20)

- **Sync exact-match collision SQL can miss normalize-equal answers / may slow as curriculum grows** — `findItemsByAcceptedAnswer` uses `lower(...) IN (...)` only (intentional for NFR1); JS normalize verify never sees candidates that differ only by meaning-normalization (e.g. “eat” vs “to eat”), and full-table IN scans may degrade as `accepted_answers` grows. Revisit with indexed/normalized lookup if false negatives or latency appear. [`mobile/src/data/curriculum/itemRepository.ts`]

## Deferred from: code review of 2-2-home-triage-post-session-proof-days-studied (2026-07-20)

- **Greeting sentence does up to 20 sequential curriculum lookups on every Home focus** — documented I4 interim (no `vocabulary_slugs` on example sentences); optimize later. [`mobile/src/data/curriculum/greetingRepository.ts`]
- ~~**`useReadingReadiness` N+1 link/SRS fetches per passage on each Home focus**~~ — RESOLVED in Story 3.2: `getAllPassageLinkedItemIds` batches both link tables in one pass and a single `getSrsStatesForItems` covers the union of linked ids. Same fix applied to `listPassageUnlockStates`. [`mobile/src/data/hooks/useReadingReadiness.ts`, `mobile/src/data/curriculum/browseRepository.ts`]

## Deferred from: code review of 3-1-unified-browse-list-search-filters (2026-07-20)

- **Home screen engagement/forecast churn in the story-scoped diff** — `mobile/src/app/(tabs)/index.tsx` includes Goal/forecast/banner work from Story 2.2 mixed under baseline `e736944`; only the Browse passage retarget belongs to 3.1. Split or ignore when reviewing Browse-only patches.

## Deferred from: code review of 3-2-passage-unlock-reader-practice-state (2026-07-20)

- **Malformed `bodyFurigana` can desync span offsets from rendered text** — `buildPassageBodyParts` walks `parseFurigana(bodyFurigana ?? body)` while spans index plain `body`; ill-formed furigana markup can attach pressable slices to the wrong characters. Pre-existing furigana/body integrity concern; compile already validates shipped content. [`mobile/src/core/content/passageBodyParts.ts`]

## Deferred from: code review of 4-1-lesson-details-split-cross-refs-primer (2026-07-20)

- **`getRequiredParentsForItems` only reads `requires`** — real radical→kanji edges are `builds_on`, so kanji lock/unlock and “Built from” parents stay empty against bundled curriculum. Pre-existing graph/API mismatch; unlock fix is broader than this story’s UI wiring. [`mobile/src/data/curriculum/itemRepository.ts`]
- **No error handling around `setPersonalMnemonic` / `clearPersonalMnemonic` in the editor** — repo can throw (e.g. `parseItemId`); pre-existing user-repo pattern. [`mobile/src/components/learn/PersonalMnemonicEditor.tsx`]

## Deferred from: code review of 5-2-push-to-talk-voice-with-on-device-tts-stt — Chunk D (2026-07-21)

- **Connectivity is refreshed only on focus** — going offline while conversation mode is open is never noticed; the offline block renders under the covering Modal and sends keep failing. Pre-existing pattern, also deferred in Chunk B. [`mobile/src/app/(tabs)/converse/session/[id].tsx`]
- **Exit / Android back while recording tears the overlay down mid-capture** — `releaseAudioSession` stops the recorder so nothing leaks, but the utterance is dropped with no explanation to the learner. [`mobile/src/components/converse/PttOverlay.tsx`]
- **STT/TTS models are released and re-loaded on every chat↔PTT toggle** — deliberate memory decision (whisper-small is hundreds of MB resident); the cost is a multi-second stall on re-entry that needs on-device measurement before deciding whether to cache. [`mobile/src/components/converse/PttOverlay.tsx`]
- **PTT state is not reset when `sessionId` changes without a remount** — a deep link to another conversation while this screen is on top would leave the overlay bound to the previous session's `send`. Not reachable through current navigation. [`mobile/src/app/(tabs)/converse/session/[id].tsx`]
- **Non-string `ResourceSource` values can never satisfy the presence check** — `fileNameOf` returns null, so `areVoiceModelsDownloaded` stays false and the mic would prompt for an already-completed download forever. Not reachable with the pinned models (all remote URLs); the new test helpers filter the case out. [`mobile/src/data/ai/voice/modelDownloadManager.ts`]
