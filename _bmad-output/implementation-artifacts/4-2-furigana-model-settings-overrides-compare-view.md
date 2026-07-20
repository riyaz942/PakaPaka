---
baseline_commit: 683d598
---

# Story 4.2: Furigana Model, Settings Overrides & Compare View

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a learner,
I want furigana that follows vocabulary mastery (with Settings overrides) and a side-by-side Compare view,
so that reading practice matches what I actually know and lookalike mistakes become teachable.

## Acceptance Criteria

1. **Given** furigana `auto` mode on vocabulary
   **When** visibility is resolved
   **Then** auto-hide keys on the vocabulary item's mastery (Guru+ or known), never on component kanji characters (FR78)
   **And** BUG6 is fixed (`getKnownKanjiCharacters()` is no longer the mastery unit)

2. **Given** I tap furigana on a word
   **When** visibility toggles
   **Then** the tap is a stateless peek/self-test only (FR79) — unchanged from current `FuriganaText` per-segment toggle behavior

3. **Given** I set a persistent per-word show/hide override in Settings
   **When** furigana resolves for that word
   **Then** the order is Settings override → SRS default (vocabulary mastery) → global preference mode (FR79, UX-DR19, UX-DR33)
   **And** overrides live in `user.db` via the next free numbered migration (`016_furigana_overrides` — **not** `015`, which `015_goal_ring_state` already occupies), independent of `item_study_status`
   **And** Settings provides a reset for overrides

4. **Given** I open Compare from details or from a review answer-collision link
   **When** two items are provided (picker or route params)
   **Then** Compare shows sticky side-by-side glyphs, columnized short attributes, stacked prose, and component chips with shared parts dimmed (FR80, UX-DR18)
   **And** the route/params contract from Story 1.2 (`left` / `right` search params, both required, on `review/compare`) is fulfilled — no stub left, and the param names/shape are unchanged
   **And** a new details-page entry point (Compare picker) reaches the same Compare UI without mounting `ReviewSessionProvider` outside an active review

5. **Given** shared furigana rendering
   **When** curriculum bracket text is displayed (details, lesson, passages)
   **Then** the shared `FuriganaText` component is used (UX-DR19) — unchanged as the single rendering primitive; AI reply rendering is out of scope (Epic 5)

## Tasks / Subtasks

- [x] **Task 0 — Migration `016_furigana_overrides`** (AC: #3)
  - [x] Add `mobile/src/data/migrations/016_furigana_overrides.ts` following the `015_goal_ring_state.ts` pattern (see Dev Notes — do **not** reuse migration id 15, it is taken).
  - [x] Schema: `furigana_overrides(item_id TEXT PRIMARY KEY, display_mode TEXT NOT NULL CHECK(display_mode IN ('shown','hidden')), updated_at TEXT NOT NULL)`. Keyed by curriculum `item_id` (vocabulary item) — one override per word, matching FR79's "per-word" language and the existing `FuriganaDisplayMode` vocabulary.
  - [x] Register in `mobile/src/data/migrations/index.ts` (`migration016FuriganaOverrides`, appended after `migration015GoalRingState`).
  - [x] Migration runner test: confirm it runs cleanly on top of `015` (extend `migrationRunner.test.ts` fixtures if that suite enumerates migrations).

- [x] **Task 1 — Repository: `furiganaOverrideRepository.ts`** (AC: #3)
  - [x] New `mobile/src/data/user/furiganaOverrideRepository.ts`: `getFuriganaOverride(userDb, itemId): FuriganaDisplayMode | null` (only `'shown' | 'hidden'`, never `'auto'` — an override is always a definite choice), `setFuriganaOverride(userDb, itemId, mode: 'shown' | 'hidden'): void`, `clearFuriganaOverride(userDb, itemId): void`, `listFuriganaOverrides(userDb): { itemId: string; primaryForm: string; mode: 'shown' | 'hidden' }[]` (joins `curriculum.items` for the Settings list — reuse the `ATTACH` cross-DB pattern already used by `getKnownKanjiCharacters`, not a new attach mechanism).
  - [x] Unit tests mirroring `masteryRepository.test.ts`'s fake-db style (existing `expo-sqlite` jest mock has no cross-schema-qualified table support — see that file's comment).

- [x] **Task 2 — BUG6 fix: vocabulary-mastery furigana resolution** (AC: #1)
  - [x] **Tier 1 (the item's own word):** wherever `FuriganaText` renders a single vocabulary item's own `furigana`/`primaryForm` as the whole text (`LessonHero` in `LessonItemSections.tsx`, `VocabularyDetail.tsx` hero, `PassageWordDetailSheet.tsx` when the sheet is showing a vocabulary item), the `auto` default must key on **that item's own** study status / SRS stage (guru+ or `known`), not per-character `knownKanji`. Add a boolean path to `FuriganaText`/`defaultFuriganaVisible` (e.g. an optional `isKnownWord?: boolean` that short-circuits the per-segment `knownKanji` check when the caller knows it's rendering exactly one vocabulary item's own word) — see Dev Notes for the exact signature decision to make.
  - [x] **Tier 2 (embedded multi-word text — example sentences, grammar bodies, passage bodies/questions):** these render text spanning multiple words with no per-word boundary data (only passages have authored word spans, from Story 3.2, and those are for long-press lookup, not furigana visibility). Fix BUG6 here by changing the **source** of the "known" character set: replace `getKnownKanjiCharacters()` (currently `item_type = 'kanji'`) with a set derived from **mastered vocabulary items** (`item_type = 'vocabulary'`, same `item_study_status = 'known'` OR guru+ `srs_states` predicate), so a kanji character only counts as "known" when it appears in a vocabulary word the learner has mastered — never merely because the standalone kanji item is mastered. This keeps the existing per-segment matching code path (`isSegmentKnown` in `FuriganaText.tsx`) intact and is a minimal, testable diff.
  - [x] Rename or add alongside: decide whether to rename `getKnownKanjiCharacters` → `getKnownVocabularyCharacters` (updating its doc comment, which currently says "'auto' hides furigana only on kanji the user already knows" — also stale, update in `preferencesRepository.ts`) or add a new function and delete the old one once all call sites migrate. Update `masteryRepository.test.ts` accordingly (its assertions currently pin `item_type = 'kanji'` in the SQL — these must flip to `'vocabulary'`).
  - [x] Update all 7 current `useFuriganaPreference()` call sites (`VocabularyDetail.tsx`, `LessonItemSections.tsx` ×2, `ExampleSentencesSection.tsx`, `GrammarDetail.tsx`, `PassageWordDetailSheet.tsx`, `PassageQuestion.tsx`, `PassageBody.tsx`, `LessonMarkdown.tsx` prop-drilled) to pass whichever of Tier 1 / Tier 2 fits their render.

- [x] **Task 3 — Settings: per-word overrides + reset UI** (AC: #3)
  - [x] New `useFuriganaOverride` hook or extend `useFuriganaPreference` with override read/write, applying the resolution order: override → item mastery (Tier 1 logic) → global `mode`.
  - [x] `(tabs)/settings.tsx` Furigana section (currently ~line 269–297): below the existing shown/hidden/auto picker, add an overrides list (word + current effective mode + reset control) sourced from `listFuriganaOverrides`. Empty state: omit the section or show "No overrides set" — match the disclosure/empty-state conventions from Story 4.1 (no empty shells for zero-item lists elsewhere in this codebase — see `CrossReferenceSection`).
  - [x] Per-word override **setting** UI (where the learner actually sets one) is the tap target on `FuriganaText` itself, or a long-press / explicit control — **this needs a product decision**: FR79 says tap is a stateless peek, so setting a persistent override needs a distinct affordance (e.g. long-press with the existing non-gesture-alternative pattern from Story 4.1/NFR29, or an entry point from the word's own details page). Flag this as a judgment call in Dev Agent Record if you resolve it during implementation; do not silently skip AC #3's "Settings provides a reset for overrides" — that part is unambiguous regardless.

- [x] **Task 4 — Compare view (fulfill Story 1.2 stub)** (AC: #4)
  - [x] Build the shared Compare UI as `mobile/src/components/common/CompareView.tsx` (cross-cutting — consumed by both the review-collision path and the details-page path, same bucket as `FuriganaText`/`SectionHeading`). Layout per FR80: sticky glyphs (both items' primary forms pinned while columns beneath scroll), columnized short attributes (meaning, reading, item type, JLPT level), stacked prose (mnemonic / notes), component chips (from existing cross-reference queries — `getComponentParentsForItem` / `useComponentParents`) with **shared parts dimmed** (chips appearing in both items' component sets get a visually muted treatment — new comparison logic, not existing).
  - [x] `review/compare.tsx`: replace the "Compare coming soon" stub body with `<CompareView leftId={left} rightId={right} />`, keeping `left`/`right` param names and the `ScreenHeader` exactly as today (contract locked — the header comment in that file says so).
  - [x] New details-page entry: a Compare picker reachable from `ItemDetailBody`/`ItemDetailScreen` (browse item details) — **do not** push to `/review/compare` from Browse, since `review/_layout.tsx` wraps all `review/*` routes in `ReviewSessionProvider`, which should not mount outside an active review session. Add a sibling route, e.g. `mobile/src/app/(tabs)/browse/compare.tsx`, taking the same `left`/`right` params and rendering the same `CompareView`. The "picker" itself (choosing the second item) can be a simple item search/list reusing existing item-lookup patterns (e.g. `findItemsByAcceptedAnswer`-style search or a lightweight item picker) — scope this modestly; it does not need Browse's full filter/search UI.
  - [x] `AnswerReveal.tsx`'s existing `router.push({ pathname: '/review/compare', params: { left, right } })` call needs no change — verify it still resolves correctly once the stub body is replaced.

- [x] **Task 5 — Verification** (AC: #1, #2, #3, #4, #5)
  - [x] Unit: `getKnownVocabularyCharacters`/renamed mastery function (guru+/known predicate now against `item_type = 'vocabulary'`); `furiganaOverrideRepository` get/set/clear/list; override resolution order (override → item mastery → global mode) as a pure function if extracted, or via the hook.
  - [x] Component/RNTL: `FuriganaText` Tier 1 known-word path (AC #1); confirm existing per-segment stateless toggle behavior is unchanged — resets on `text` prop change, no persisted state (AC #2); `CompareView` renders both items, dims shared component chips, sticky glyph behavior (structural test, not visual regression) (AC #4); `review/compare` still resolves `left`/`right` params correctly after the stub is replaced (AC #4); Settings overrides list renders + reset works (AC #3); spot-check that details/lesson/passage surfaces still render via the shared `FuriganaText` primitive with no per-surface fork (AC #5).
  - [x] Gates from `mobile/`: `npm run typecheck`, `npm run lint`, `npm test` (targeted suites OK while iterating; full test before review) — mirror Story 4.1's gate results (150 suites / 1192 tests passing baseline; expect growth, not shrinkage).

### Review Findings

- [x] [Review][Patch] Override control and hero use disconnected `useFuriganaPreference` state — setting Always show/hide updates the control's local map (and DB) but not the parent's `modeForItem`, so the hero stays stale until remount [`VocabularyDetail.tsx:43`][`FuriganaOverrideControl.tsx:27`]
- [x] [Review][Patch] Settings override reset does not invalidate other mounted furigana hooks — Expo tabs keep screens alive; `useFuriganaOverrideList` clears DB + its own list while retained `useFuriganaPreference` maps stay stale [`useFuriganaOverrideList.ts:31`][`useFuriganaPreference.ts:50`]
- [x] [Review][Patch] Passage word sheet forces Tier-1 always-show for non-vocab — `useIsKnownWord(null)` is `false`, and passing `isKnownWord={false}` skips Tier 2; omit the prop (and restore `knownKanji`) when `itemType !== 'vocabulary'` [`PassageWordDetailSheet.tsx:36`]
- [x] [Review][Patch] CompareView omits the Reading short attribute required by AC #4 / Task 4 (`meaning, reading, item type, JLPT level`) — `useItemDetail` already loads `kanjiReadings` / `acceptedAnswers` but Compare never surfaces them [`CompareView.tsx:184`]
- [x] [Review][Patch] Orphan overrides stay active but vanish from Settings — `listFuriganaOverrides` INNER JOINs curriculum; `getAllFuriganaOverrides` still applies missing-item rows that cannot be reset individually [`furiganaOverrideRepository.ts:72`]
- [x] [Review][Patch] `useIsKnownWord` never refreshes after mastery changes — memoized on `[userDb, itemId]` only; a still-mounted hero/sheet keeps pre-promotion Tier 1 visibility [`useIsKnownWord.ts:17`]
- [x] [Review][Patch] Shared Compare chips use `opacity-40` which likely fails readable contrast — mute via semantic tokens (`text-secondary` / surface) without crushing opacity [`CompareView.tsx:92`]
- [x] [Review][Patch] Stale `preferencesRepository` furigana doc comment still says auto hides on known *kanji* — Task 2 required updating it for vocabulary-mastery [`preferencesRepository.ts:178`]

## Dev Notes

### Scope boundary (critical)

| In 4.2 | Out (later / other stories) |
| --- | --- |
| BUG6 fix: vocabulary-mastery-keyed auto-hide (Tier 1 + Tier 2) | Word-boundary spans for example sentences (only passages have these, from 3.2, and only for long-press lookup) |
| Settings per-word overrides + reset (migration `016`) | AI reply furigana rendering (Epic 5, FR91 — reuses `FuriganaText` but is out of scope here) |
| Compare view UI + both entry points (review collision + details picker) | Curated lookalike-word content/schema (rejected — D-DET-2, per Story 4.1 dev notes) |
| Migration `016_furigana_overrides` (015 is taken) | Any further migrations beyond furigana overrides |

### Current state (must read before coding)

| Area | Today | This story changes |
| --- | --- | --- |
| `getKnownKanjiCharacters` (`mobile/src/data/user/masteryRepository.ts`) | Queries `item_type = 'kanji'` mastery (guru+ SRS stage OR `item_study_status = 'known'`); returns `Set<string>` of individual kanji characters | BUG6 fix: source becomes mastered **vocabulary** items (Tier 2), plus a separate Tier-1 boolean path for a vocabulary item's own word |
| `FuriganaText.tsx` / `defaultFuriganaVisible` | `'auto'` mode: segment hidden only when every kanji character in that segment's run is in `knownKanji` (`isSegmentKnown`) | Needs the Tier 1 whole-word-known path added alongside the existing per-character Tier 2 path |
| `useFuriganaPreference.ts` | Returns `{ mode, setMode, knownKanji, refreshKnownKanji }`; `knownKanji` computed once per mount from `getKnownKanjiCharacters` | Extend or add a hook for override resolution; `knownKanji` source flips to vocabulary-derived (Tier 2) |
| `preferencesRepository.ts` | `FuriganaDisplayMode = 'shown' \| 'hidden' \| 'auto'`; `getFuriganaDisplay`/`setFuriganaDisplay` against `PREFERENCE_KEYS.furiganaDisplay` (global mode only); doc comment on line 178 is stale re: BUG6 | Unchanged shape for global mode; add override resolution layered on top via new repository (not this file — overrides get their own table, not `user_preferences` key/value, since they need one row per word) |
| `review/compare.tsx` | Stub: renders params, "Compare coming soon" | Replace body with real `CompareView`; keep header/back/params exactly as-is (explicit contract lock in the file's own comment) |
| Compare entry points | None from details; review collision link already wired (`AnswerReveal.tsx` → `/review/compare?left=&right=`) | Add details-page Compare picker + new route outside `review/`'s `ReviewSessionProvider` |
| Migrations | `001`–`015` exist; `015_goal_ring_state` is the latest (single-row goal-ring table) | Add `016_furigana_overrides` — **the epics/PRD/architecture docs all say "`015_furigana_overrides`"; that name is now taken by goal-ring state (built in an earlier story) — use `016`, and don't trust the doc-stated migration number literally** |
| 7 `useFuriganaPreference` call sites | `VocabularyDetail.tsx`, `LessonItemSections.tsx` (×2 functions), `ExampleSentencesSection.tsx`, `GrammarDetail.tsx`, `PassageWordDetailSheet.tsx`, `PassageQuestion.tsx`, `PassageBody.tsx`, plus `LessonMarkdown.tsx` (prop-drilled `knownKanji`, not a direct hook call) | Each needs to route through Tier 1 or Tier 2 depending on whether it's rendering one vocabulary item's own word or embedded multi-word text |

### Architecture compliance

- **Migration numbering:** `015_goal_ring_state.ts` already exists (built during Story 2.1/2.2 or an earlier pass) — every planning doc's `015_furigana_overrides` reference is stale. Use `016`. [Source: `mobile/src/data/migrations/index.ts`; confirmed live in this repo, not just Story 4.1's dev-notes warning]
- **Dual DB:** overrides + all new reads are `user.db` only; curriculum reads for Compare (item attributes, component parents) stay read-only via existing `itemRepository.ts` functions — no new curriculum schema needed.
- **Result type:** existing repository functions in this codebase (`masteryRepository.ts`, `preferencesRepository.ts`) use plain sync return values / throw-on-invalid-input, not `Result<T, AppError>` — match that established local pattern for the new `furiganaOverrideRepository.ts` rather than introducing `Result` where the surrounding module doesn't use it.
- **NativeWind** semantic tokens only — no deprecated `Colors` / raw hex, including in new `CompareView` styling.
- **Route boundary:** `review/*` routes are wrapped in `ReviewSessionProvider` (`review/_layout.tsx`). Never push a `review/*` route from outside an active review session — this is why Compare needs a second route for the details-page entry, not a shared push target.
- **`core/` purity:** if override-resolution logic is extracted into a pure function (recommended — e.g. `resolveFuriganaVisibility(override, itemMastery, globalMode)`), it belongs in `core/` (no React, no SQLite), consistent with `core/furigana/parseFurigana.ts` already being pure.

### Anti-patterns (do NOT)

- Do not add the `016_furigana_overrides` migration as `015` — that id is taken; check `mobile/src/data/migrations/` before assuming the doc-stated number is free (this bit Story 4.1's own dev notes into flagging it).
- Do not fix BUG6 by just renaming `getKnownKanjiCharacters` without changing its query predicate — the bug is the **source table** (`item_type = 'kanji'`), not the function name.
- Do not push `/review/compare` from a non-review context (Browse/details) — it mounts `ReviewSessionProvider`.
- Do not change the `left`/`right` param names or shape on `review/compare` — Story 1.2 contract-locked them, and `AnswerReveal.tsx` already calls `router.push` with those exact names.
- Do not store furigana overrides in the `user_preferences` key/value table — that table is one-row-per-key; overrides need one row per word (curriculum `item_id`), hence a dedicated table.
- Do not build AI-reply furigana handling here — FR91 is Epic 5 scope; `FuriganaText` just needs to keep working as the shared primitive it already is.
- Do not invent per-example-sentence word-boundary authoring to solve Tier 2 "properly" — that's a curriculum pipeline change out of scope for this story; the vocabulary-sourced character-set fix (Tier 2) is the agreed-scope BUG6 fix.
- Do not silently drop the "Settings provides a reset for overrides" requirement even if the override-setting affordance (Task 3's flagged judgment call) ends up minimal — reset is unambiguous in FR79/AC #3.

### Settled product meanings

| Term | Meaning for 4.2 |
| --- | --- |
| "Vocabulary item mastery" | `item_study_status = 'known'` OR SRS stage in `{'guru','master','enlightened','burned'}` — same guru+ predicate already used by `getKnownKanjiCharacters`, just re-scoped to `item_type = 'vocabulary'` |
| Override | A per-word (curriculum `item_id`) row in `furigana_overrides`, value `'shown'` or `'hidden'` only (never `'auto'` — an override is a definite choice) |
| Resolution order | Settings override (this word has a row) → SRS default (Tier 1 item-mastery boolean, only meaningful when global mode is `'auto'`) → global preference mode (`shown`/`hidden`/`auto`) |
| Tap-to-toggle | Unchanged: stateless, resets on `text` prop change, per-segment — this is FR79's "peek," distinct from a persistent override |
| Compare "shared parts dimmed" | Component chips (from `getComponentParentsForItem`) appearing in **both** compared items' component sets get a muted visual treatment — new comparison logic |

### Reuse map

| Need | Reuse |
| --- | --- |
| Guru+ SRS stage constant | `KNOWN_SRS_STAGES` pattern in `masteryRepository.ts` (currently local; consider exporting if Tier 1 needs it too) |
| Cross-DB known-set query shape | `getKnownKanjiCharacters`'s `ATTACH`-based `curriculum.items` join — same mechanism, re-scoped predicate |
| Preference key/value pattern | `PREFERENCE_KEYS` + `getPreference`/`setPreference` in `preferencesRepository.ts` — for the global mode only; overrides get a dedicated table, not this pattern |
| Migration shape | `015_goal_ring_state.ts` — single new table, `up` only, `execSync` DDL |
| Compare data: component parents | `getComponentParentsForItem` (`itemRepository.ts`) / `useComponentParents` hook — already built for Story 4.1's cross-references |
| Compare data: item attributes | `useItemDetail` / `getItemById` / `CurriculumItemDetail` |
| Chip visual pattern | `CrossReferenceSection.tsx` — Pressable chip styling; Compare's chips are likely non-navigating (or navigate like existing chips — your call) but should look visually consistent |
| Route param parsing | `review/compare.tsx`'s existing `paramString` helper — reuse verbatim in the new details-page route |
| Settings section pattern | `(tabs)/settings.tsx` Furigana section (~line 269) — existing radio-style picker for the 3 global modes; extend below it |
| Modal/sheet UX | `PassageWordDetailSheet` / `SessionExitSheet` `Modal` pattern — if the override-setting affordance (Task 3) needs a sheet |

### Files being modified — current behavior (UPDATE)

**`mobile/src/data/user/masteryRepository.ts`**
Today: `getKnownKanjiCharacters(userDb)` queries `item_type = 'kanji'`, returns `Set<string>` of kanji characters whose **kanji item** is known/guru+.
Change: query becomes `item_type = 'vocabulary'` (or add a new function) so the returned set reflects characters appearing in known/guru+ **vocabulary words**. Update/rename per Task 2. Update the doc comment (it currently self-describes as matching "the WaniKani convention" for kanji-item mastery — that framing is what BUG6 says is wrong).

**`mobile/src/components/common/FuriganaText.tsx`**
Today: `defaultFuriganaVisible(segment, mode, knownKanji)` — pure function, `knownKanji: ReadonlySet<string> | undefined`, checks every character in the segment run.
Change: add a Tier 1 path (see Task 2) without breaking the existing Tier 2 signature/behavior for callers that don't have a single-item context.

**`mobile/src/data/hooks/useFuriganaPreference.ts`**
Today: `{ mode, setMode, knownKanji, refreshKnownKanji }`, `knownKanji` from `getKnownKanjiCharacters`.
Change: `knownKanji` source flips to the Tier 2 vocabulary-derived set; may need a new return field or a second hook for Tier 1 (per-item boolean) and override resolution.

**`mobile/src/app/review/compare.tsx`**
Today: stub, "Compare coming soon", renders `left`/`right` params as text.
Change: render `CompareView` with those params. Keep `ScreenHeader`, `backTestID`, `backAccessibilityLabel`, and the `paramString` param-parsing exactly as today.

**`mobile/src/components/review/AnswerReveal.tsx`**
Today: already pushes to `/review/compare` with `{ left: item.itemId, right: collision.itemId }` on collision (lines 94–98).
Change: none expected — verify behavior once the stub is replaced; do not touch this file unless a real bug surfaces.

**`mobile/src/app/(tabs)/settings.tsx`**
Today: Furigana section (~line 269–297) has the 3-way global mode picker only.
Change: add overrides list + reset UI below it, per Task 3.

**`mobile/src/data/migrations/index.ts`**
Today: array ends at `migration015GoalRingState`.
Change: append `migration016FuriganaOverrides`.

### Previous story intelligence (4.1)

- **Migration numbering trap already flagged once** (see 4.1's own dev notes: "note: `015_goal_ring_state` already exists; 4.2 must use next free migration id") — confirmed still true; use `016`.
- Prefer reuse over reimplementation — cross-reference/component-parent queries already exist for Compare's chip data; don't rebuild them.
- Modal sheet pattern is the house standard for overlays — no new bottom-sheet dependency.
- Document settled empty-state policies explicitly (this story does, above) — code review in 4.1 caught several stale-until-effect-settles and remount-timing bugs; write tests for override resolution timing (item mastery computed once per mount vs. override changes) up front.
- 4.1 shipped `ItemLinkContext` / `useItemHref` so cross-ref chips route correctly inside vs. outside a review session — Compare's chips (if navigable) should reuse this rather than hardcoding `/browse/item/...`.
- Code review in 4.1 found real bugs in "stale until effect settles" hook patterns (`useItemStudyStatus`, `useRelatedItems`) — apply the same scrutiny to any new override/mastery hook here.

### Git intelligence

Recent work (`683d598`, `43be7cf` — Story 4.1): established the lesson/details split, `SectionHeading`, cross-reference chip patterns, and confirmed the migration-numbering gotcha. This story is the second and final Epic 4 story — after this, `epic-4` should be eligible to move to `done` (retrospective is optional per `sprint-status.yaml`).

### Latest tech notes

- No new npm dependency expected. `CompareView` uses existing RN primitives + NativeWind, matching Story 4.1's precedent of not introducing new UI libraries.
- Sticky glyph behavior (glyphs pinned while attribute columns scroll) can be done with a fixed header `View` above a `ScrollView` for the columnized content — no special sticky-header library needed for a two-item side-by-side layout.

### Project Structure Notes

- Path alias `@/*` → `mobile/src/*`.
- New shared UI (`CompareView`) goes in `components/common/` alongside `FuriganaText`/`SectionHeading` — it's consumed by both `review/` and `(tabs)/browse/` surfaces, not owned by either.
- New repository: `data/user/furiganaOverrideRepository.ts` (mirrors `masteryRepository.ts` / `preferencesRepository.ts` placement).
- Tests colocated `*.test.ts(x)`.
- Do not treat `_bmad-output/` as backlog beyond this story file + `sprint-status.yaml`.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4 / Story 4.2, FR Coverage Map]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR78–FR80, BUG6 table, NFR28]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Subsystem 5, furigana resolution helper placement, `furigana_overrides` table naming]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — UX-DR18–19, UX-DR33, CompareView/FuriganaText component list]
- [Source: `_bmad-output/implementation-artifacts/4-1-lesson-details-split-cross-refs-primer.md` — migration-numbering warning, scope boundary table, reuse map]
- [Source: `docs/content/furigana-support-plan.md` — Phase 4 knowledge-aware furigana design note (superseded in intent by FR78/BUG6, kept for historical rendering-primitive context)]
- [Source: `mobile/src/data/user/masteryRepository.ts` — `getKnownKanjiCharacters`, `KNOWN_SRS_STAGES`]
- [Source: `mobile/src/components/common/FuriganaText.tsx` — `defaultFuriganaVisible`, `isSegmentKnown`]
- [Source: `mobile/src/data/hooks/useFuriganaPreference.ts`]
- [Source: `mobile/src/data/user/preferencesRepository.ts` — `FuriganaDisplayMode`, `PREFERENCE_KEYS`]
- [Source: `mobile/src/app/review/compare.tsx` — locked route contract]
- [Source: `mobile/src/components/review/AnswerReveal.tsx` — existing Compare link]
- [Source: `mobile/src/data/migrations/015_goal_ring_state.ts`, `mobile/src/data/migrations/index.ts`]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, bmad-dev-story workflow)

### Debug Log References

- `npx jest` (mobile/) — 157 suites / 1255 tests passing (baseline 150/1192)
- `npx tsc --noEmit` — clean
- `npm run lint` (mobile/) — 0 errors; 1 pre-existing warning in `browse/passage/[id].test.tsx` (unrelated `require()` import)
- `npm run check-contrast` (root) — 72 token pairs pass
- Expo typed routes regenerated (brief `expo start`) so `/browse/compare` type-checks

### Completion Notes List

**BUG6 (AC #1)** — fixed at the source, not by renaming. `getKnownKanjiCharacters` → `getKnownVocabularyCharacters`, predicate flipped from `item_type = 'kanji'` to `'vocabulary'`, and each mastered word is expanded into its characters. A kanji now counts as known only because it appears in a word the learner mastered.

Two tiers, as scoped:
- **Tier 1** — new `isVocabularyItemKnown(userDb, itemId)` + `useIsKnownWord` hook, surfaced as `FuriganaText`'s optional `isKnownWord?: boolean`. When set, it short-circuits the per-character check in `defaultFuriganaVisible`. Wired into the three single-word surfaces: `VocabularyDetail` hero, `LessonHero`, `PassageWordDetailSheet`.
- **Tier 2** — the five embedded multi-word surfaces (`ExampleSentencesSection`, `GrammarDetail`, `PassageBody`, `PassageQuestion`, `LessonMarkdown` via `LessonIntroSection`) needed **no call-site edit**: they already pass `mode` + `knownKanji`, and the set's source flipped underneath them. Intentionally minimal diff.

**Resolution order (AC #3)** — split across two places so each stays simple: `resolveFuriganaMode(override, globalMode)` (pure, `core/furigana/`) covers override → global; the SRS default sits between them and is applied by `FuriganaText`'s `isKnownWord`, which only matters once the resolved mode is `'auto'`. An override never resolves to `'auto'`, so an overridden word skips the mastery tier entirely — which is exactly the specified precedence.

**Judgment call — where a learner *sets* an override (flagged in Task 3).** Resolved as an explicit three-way picker (`FuriganaOverrideControl`: Follow my progress / Always show / Always hide) on the vocabulary detail page, not a gesture on the word. Rationale: FR79 reserves the tap for the stateless peek, and a long-press would have needed a non-gesture alternative anyway (NFR29). "Follow my progress" deletes the row rather than storing `'auto'`, keeping the override table strictly definite choices. Settings additionally provides per-word Reset and Reset-all (AC #3's unambiguous part).

**Compare (AC #4)** — `CompareView` in `components/common/`, consumed by both entry points. The review route's `left`/`right` params, `ScreenHeader`, `backTestID` and `paramString` helper are untouched; only the body changed, so `AnswerReveal`'s existing `router.push` needed no edit (verified by the route's own tests). The Browse entry is a **separate route** (`(tabs)/browse/compare`) so nothing pushes `review/*` from outside a session; `CompareEntryPoint` renders only when `useItemLinkBase()` is `/browse/item`, so the shared `ItemDetailBody` doesn't leak a Browse push into the review-nested detail screen. The picker reuses `useBrowseItems` for search rather than rebuilding one.

**Two notes for review:**
1. The shared `expo-sqlite` mock hardcodes SQL handling per table, so it needed `furigana_overrides` cases (insert/upsert, delete-one, delete-all, select) — `mobile/__mocks__/expo-sqlite.ts`.
2. `overrides` and `knownKanji` are both read synchronously in `useState` initializers, not effects — deliberate, per 4.1's code-review findings about "stale until effect settles" hook patterns. A word's mode is correct on first paint.

**Not done (out of scope, per the story's own boundary table):** word-boundary spans for example sentences, AI-reply furigana (Epic 5 / FR91), curated lookalike content.

### File List

**New**
- `mobile/src/data/migrations/016_furigana_overrides.ts`
- `mobile/src/data/user/furiganaOverrideRepository.ts`
- `mobile/src/data/user/furiganaOverrideRepository.test.ts`
- `mobile/src/core/furigana/resolveFuriganaMode.ts`
- `mobile/src/core/furigana/resolveFuriganaMode.test.ts`
- `mobile/src/data/hooks/useIsKnownWord.ts`
- `mobile/src/data/hooks/useFuriganaOverrideList.ts`
- `mobile/src/data/hooks/useFuriganaPreference.test.tsx`
- `mobile/src/components/learn/FuriganaOverrideControl.tsx`
- `mobile/src/components/learn/FuriganaOverrideControl.test.tsx`
- `mobile/src/components/common/CompareView.tsx`
- `mobile/src/components/common/CompareView.test.tsx`
- `mobile/src/components/learn/CompareEntryPoint.tsx`
- `mobile/src/components/learn/CompareEntryPoint.test.tsx`
- `mobile/src/app/(tabs)/browse/compare.tsx`
- `mobile/src/app/(tabs)/browse/compare.test.tsx`

**Modified**
- `mobile/src/data/migrations/index.ts`
- `mobile/src/data/migrations/migrationRunner.test.ts`
- `mobile/src/data/user/masteryRepository.ts`
- `mobile/src/data/user/masteryRepository.test.ts`
- `mobile/src/data/hooks/useFuriganaPreference.ts`
- `mobile/src/components/common/FuriganaText.tsx`
- `mobile/src/components/common/FuriganaText.test.tsx`
- `mobile/src/components/learn/VocabularyDetail.tsx`
- `mobile/src/components/learn/ItemDetailBody.tsx`
- `mobile/src/components/lesson/LessonItemSections.tsx`
- `mobile/src/components/read/PassageWordDetailSheet.tsx`
- `mobile/src/app/(tabs)/settings.tsx`
- `mobile/src/app/(tabs)/settings.test.tsx`
- `mobile/src/app/(tabs)/browse/_layout.tsx`
- `mobile/src/app/review/compare.tsx`
- `mobile/src/app/review/compare.test.tsx`
- `mobile/__mocks__/expo-sqlite.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

| Date | Change |
| --- | --- |
| 2026-07-20 | Story 4.2 implemented: migration `016_furigana_overrides`, per-word override repository/hooks/UI, BUG6 vocabulary-mastery furigana fix (Tier 1 + Tier 2), shared `CompareView` fulfilling the Story 1.2 `review/compare` contract plus a new Browse Compare picker route. Status → review. |
| 2026-07-20 | Code review patches applied: cross-mount override sync, passage Tier-1/Tier-2 fix, Compare Reading column + chip contrast, orphan override listing, `useIsKnownWord` focus refresh, preferences doc. Status → done. |
