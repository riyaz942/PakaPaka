---
baseline_commit: e736944
---

# Story 3.1: Unified Browse List, Search & Filters

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a learner,
I want one Browse surface for radicals, kanji, vocab, grammar, and passages with search and filters,
so that I can find anything without navigating per-level Learn screens or a separate Read tab.

## Acceptance Criteria

1. **Given** the app tab shell  
   **When** I open the discovery tab  
   **Then** it is labeled Browse (replacing Learn-as-tab discovery) and the dedicated Read tab is removed (FR62–FR63, UX-DR3)  
   **And** a Conversation/Talk placeholder tab may occupy the freed slot until Epic 5  
   **And** temporary redirects from `learn/*` / `read/*` are allowed during rollout  

2. **Given** Browse is open  
   **When** the list loads  
   **Then** it is a flat, virtualized, paginated UNION of items and reading passages (FR62–FR63, UX-DR13)  
   **And** JLPT level is a filter attribute, not a navigational container  

3. **Given** I apply faceted multi-select filters (level, type, performance, SRS stage, lock)  
   **When** I view the Apply control  
   **Then** it shows a live result count and is disabled at zero (FR64)  
   **And** active selections appear as self-summarizing pills  

4. **Given** I type in the search field (English, romaji, kana, or kanji)  
   **When** ~200ms debounce elapses  
   **Then** a fan-out query runs with parallel OR branches (FR65)  
   **And** romaji converts to kana in parallel without replacing the raw query  

5. **Given** kanji, vocabulary, or grammar rows  
   **When** they appear in Browse  
   **Then** they are always viewable regardless of lesson eligibility (FR67)  
   **And** BUG7 is fixed — dependency-graph locking is not applied to these rows  

6. **Given** a passage row  
   **When** it is rendered  
   **Then** it shows its bilingual (JA/EN) one-line summary when available (FR66)  
   **And** lock/readiness affordance is passage-specific (UX-DR13–14)  

7. **Given** Browse has no matches for current filters/search  
   **When** the empty state shows  
   **Then** I see “No matches” with a clear-filters action (UX-DR30)  

## Tasks / Subtasks

- [x] **Task 1 — Tab shell: Browse + remove Read + Conversation placeholder** (AC: #1)
  - [x] Update `app/(tabs)/_layout.tsx`: tabs = **Home · Browse · Talk · Stats · Settings**. Icon suggestions: Browse `search` / `menu-book`; Talk `chat` / `forum`. Short label **Talk** is OK (UX-DR3).
  - [x] Add `app/(tabs)/browse/` stack (`_layout.tsx`, `index.tsx`). Remove or unmount Read as a tab screen.
  - [x] Add `app/(tabs)/converse/index.tsx` (or `talk/`) placeholder: calm empty state (“Conversation coming soon” / offline-friendly). No BYOK, no chat — Epic 5 owns that.
  - [x] Temporary redirects: `learn/*` → browse equivalents; `read/index` → `/browse`; `read/[id]` → `/browse/passage/[id]` (Expo Router redirect or thin re-export screens). Keep working deep-links from Home readiness (`/read/[id]` today).
  - [x] Home **Learn CTA stays “Learn”** and still starts a lesson (`/lesson`) — Home offers study modes; Browse is discovery (FR58 vs FR62). Do not rename Home CTA to Browse.
  - [x] Retarget `ReadingReadiness` navigation to `/browse/passage/[id]` (keep `/read/[id]` redirect as safety).
  - [x] Update tab layout tests / any hardcoded “Learn” / “Read” tab assertions.

- [x] **Task 2 — Browse query layer (UNION + pagination + count)** (AC: #2, #3, #4)
  - [x] New `data/curriculum/browseRepository.ts` (SQL lives here — **never** build UNION SQL in JSX).
  - [x] Row model e.g. `BrowseRowModel`:
    - Discriminated: `{ kind: 'item' | 'passage'; id; jlptLevel; sortKey; ... }`
    - Item: `itemType`, `primaryForm`, `meaning`, optional reading snippet, optional study/SRS fields for display
    - Passage: `title`, `summaryJa?`, `summaryEn?`, `locked`, `itemsRemainingToUnlock?`
  - [x] `listBrowsePage(userDb, filters, search, { limit, offset })` and `countBrowse(userDb, filters, search)` using **ATTACH** (`CURRICULUM_ATTACH_ALIAS` / `curriculum.*`) so SRS + study status join in one query when facets need them.
  - [x] Default sort: JLPT easy-first (N5→N1) then `sort_order`, with a stable tie-break (e.g. kind+id) so pagination does not duplicate/skip.
  - [x] Page size constant (suggest `BROWSE_PAGE_SIZE = 40`) in `config/constants.ts`.
  - [x] Indexes: if LIKE search is slow on device, add curriculum compile indexes on searched columns (`items.primary_form`, `items.meaning`, `accepted_answers.answer_text`, passage title/summary fields) — measure before inventing FTS.

- [x] **Task 3 — Faceted filters + live Apply count + pills** (AC: #3, #7)
  - [x] Facets (multi-select each; empty facet = no constraint):
    | Facet | Values | Source |
    | --- | --- | --- |
    | Level | N5–N1 | `items.jlpt_level` / `reading_passages.jlpt_level` |
    | Type | radical, kanji, vocabulary, grammar, **passage** | item_type + passage kind |
    | Performance | known, in_progress, not_started | `item_study_status` (default missing → `not_started`); passages: map via unlock or exclude from this facet when N/A — document choice (prefer: performance applies to items only; selecting performance alone still returns matching items + all/unfiltered passages unless Type=passage also set) |
    | SRS stage | apprentice, guru, master, enlightened, burned | `srs_states.srs_stage_label` (items without SRS row = no stage — only match when facet empty or treat as not-in-SRS; do **not** invent fake stages) |
    | Lock | locked, unlocked | **Passages only** via `computePassageUnlock` (≥90% Guru+). Items never participate in lock facet. |
  - [x] UI: five `FilterPill` entry points → `FilterDrawer` (modal/bottom sheet) with multi-select options + **Apply (N)** live count (debounce count queries ~100–150ms while toggling). Disable Apply when N=0.
  - [x] Applied filters render as **self-summarizing pills** (e.g. “N5”, “Vocab + Grammar”, “Guru+”, “Locked”) with clear-one / clear-all.
  - [x] Filter state: local React state or tiny `BrowseFilterContext` — **not** `ReviewSessionProvider`.
  - [x] Empty list: “No matches” + clear-filters action (UX-DR30). Distinct from loading skeletons.

- [x] **Task 4 — Fan-out search (~200ms debounce)** (AC: #4)
  - [x] `SearchField` at top of Browse (Direction G). Controlled input; debounce **200ms** before querying.
  - [x] Fan-out: keep **raw query** always; if romaji-ish, also compute `wanakana.toHiragana(raw)` (and optionally katakana) **in parallel as extra OR branches** — never replace the TextInput value with kana (unlike review `WanaKanaInput`).
  - [x] OR branches (case-insensitive WHERE possible): `primary_form`, `meaning`, `accepted_answers.answer_text`, `kanji_readings.reading`, passage `title`, passage summary JA/EN when columns exist, fallback `english_translation` for EN.
  - [x] Partial romaji: untranslated consonant tail must not break search (brainstorm) — keep raw prefix; treat failed kana conversion as “raw only”.
  - [x] Reject progressive/streaming result merging — one ranked/ordered query after debounce (sync SQLite).

- [x] **Task 5 — Browse list UI + BUG7** (AC: #2, #5, #6, #7)
  - [x] Components under `components/browse/`: `BrowseList`, `BrowseRow` (items), `PassageBrowseRow`, `SearchField`, `FilterPill`, `FilterDrawer`, empty state.
  - [x] Virtualized list: **RN `FlatList` + pagination** is the default for this story (no FlashList dependency yet; New Architecture / FlashList is Epic 5 platform work). Memoize row components; stable `keyExtractor` (`item:{id}` / `passage:{id}`). Load next page on end-reached.
  - [x] Item rows: content-type accent (`CONTENT_TYPE_ACCENT` / `content-reading` for passages). **Never** pass `isLocked` / dependency dimming for kanji/vocab/grammar — fix BUG7 by not porting `learn/[level].tsx:105-110` logic.
  - [x] Tapping item → `/browse/item/[id]` (reuse existing detail components from `components/learn/*` via thin route wrapper; redirects from `/learn/item/[id]` OK).
  - [x] Passage rows: title + bilingual summary when available; lock chip as destination framing (“3 to go”), not a dead-end padlock-only. Tap unlocked → `/browse/passage/[id]` (reuse `read/[id]` reader for now). Tap locked → **temporary**: navigate to passage route or show a lightweight “needs more study” sheet — full needed-items to-do list is **Story 3.2**. For 3.1, showing lock chip + opening a stub/existing reader that already handles locked state is OK if it is not a blank dead end; do not invent the full FR69 list here.
  - [x] Passage accent token: reuse `content-reading` (UX-DR32). Extend `contentType.ts` if needed for a passage label.

- [x] **Task 6 — Passage summary display (FR66 interim)** (AC: #6)
  - [x] Schema today: `reading_passages` has `title`, `body`, `english_translation` — **no** `summary_ja` / `summary_en` columns yet (Story 3.2 pipeline).
  - [x] Interim display: EN line from `english_translation` (truncated one-line); JA line omit or use a short title-adjacent fallback — **do not** block 3.1 on compile-pipeline summary columns. Wire row props so real summary columns plug in later.
  - [x] Search interim: include `title` + `english_translation` in fan-out; when summary columns land in 3.2, extend OR branches.

- [x] **Task 7 — Hook wiring** (AC: #2–#4)
  - [x] `data/hooks/useBrowseItems.ts`: debounce search, hold applied filters, page accumulation, `loading` / `loadingMore`, `totalCount`, `clearFilters`, `loadMore`.
  - [x] Separate cheap `countBrowse` for drawer live Apply (pending draft filters ≠ applied filters until Apply).
  - [x] Use `userDb` (with curriculum ATTACH) for joined queries; never write curriculum.

- [x] **Task 8 — Verification**
  - [x] Unit: browse filter SQL builder / fan-out branch construction; debounce behavior; lock facet uses `computePassageUnlock` only for passages; BUG7 — item rows have no lock prop from deps.
  - [x] Component/RNTL: Browse tab label; empty “No matches” + clear; Apply disabled at 0; pills summarize; search debounce (fake timers).
  - [x] Update/remove obsolete `learn/[level].test.tsx` lock assertions if level screen is deleted or reduced to redirect.
  - [x] Gates: `npm run typecheck`, `npm run lint`, `npm test` from `mobile/`.

### Review Findings

- [x] [Review][Patch] Paginated append can corrupt the list across filter/search resets [`mobile/src/data/hooks/useBrowseItems.ts:113`] — `loadMore` appends with stale `rows.length` / new `queryInput` when `onEndReached` races a first-page reset; add a generation/request token so appends ignore superseded queries.
- [x] [Review][Patch] Every Browse focus recomputes unlock for all passages and reloads page 0 [`mobile/src/data/hooks/useBrowseItems.ts:75`] [`mobile/src/app/(tabs)/browse/index.tsx:51`] — `refresh()` bumps unlock → new `queryInput` → full list reset; avoid remounting the list when unlock map is unchanged (or refresh unlock without resetting scroll/pages).
- [x] [Review][Patch] `/learn/[level]?type=` redirect drops the type facet [`mobile/src/app/(tabs)/browse/index.tsx:29`] — `learn/[level]` forwards `type`, but Browse only seeds `levels`; apply `params.type` into `filters.types` when valid.
- [x] [Review][Patch] Level seed is one-shot and sticky; `?level=` is never cleared from the URL [`mobile/src/app/(tabs)/browse/index.tsx:60`] — later `/browse?level=` navigations while mounted are ignored; remount after clear re-applies the old param. Re-seed on param change and strip/clear the query after apply / on clearFilters.
- [x] [Review][Patch] LIKE fan-out does not escape `%` / `_` [`mobile/src/data/curriculum/browseRepository.ts:100`] — bind escaped patterns (or `ESCAPE`) so literal wildcards do not broaden results.
- [x] [Review][Patch] Query / unlock failures are swallowed as empty curriculum [`mobile/src/data/hooks/useBrowseItems.ts:102`] — ATTACH/SQL errors become `[]` / `0` and the “nothing to browse yet” empty state; surface a distinct error path.
- [x] [Review][Patch] Unlock-map failure renders every passage as unlocked [`mobile/src/data/hooks/useBrowseItems.ts:79`] [`mobile/src/data/curriculum/browseRepository.ts:327`] — empty Map + `locked: status ? … : false` fails open; fail closed or treat missing status as unknown/error.
- [x] [Review][Patch] Clear-all is missing from the filter bar when the list is non-empty [`mobile/src/app/(tabs)/browse/index.tsx:122`] — Task 3 requires clear-one / clear-all; `clearFilters` is only wired through the empty state.
- [x] [Review][Patch] Draft Apply count uses raw search while the list uses debounced search [`mobile/src/app/(tabs)/browse/index.tsx:76`] — `Apply (N)` can disagree with visible rows around the 200ms debounce; count with the same debounced term (and flush debounce on clearFilters).
- [x] [Review][Patch] Apply control hides the live count while draft count is in flight [`mobile/src/components/browse/FilterDrawer.tsx:121`] — shows bare `Apply` and disables during `isCounting`; keep last settled `N` visible and only disable when settled count is 0.
- [x] [Review][Patch] Duplicate/array `level` param skips seeding [`mobile/src/app/(tabs)/browse/index.tsx:59`] — if Expo supplies `string[]`, `isJlptLevel` fails and Browse loads unscoped; normalize to the first string value.
- [x] [Review][Defer] Home screen engagement/forecast churn shipped inside the story path set [`mobile/src/app/(tabs)/index.tsx`] — deferred, pre-existing (Story 2.2 / baseline mix); only the Browse passage retarget is in 3.1 scope

## Dev Notes

### Scope boundary (critical)

| In 3.1 | Out → 3.2 / later |
| --- | --- |
| Tab shell Browse; remove Read tab; Talk placeholder | BYOK chat, PTT, KeySetup (Epic 5) |
| Virtualized paginated UNION list | Formal NFR22 benchmark harness |
| Faceted filters + live Apply + pills | FlashList / New Architecture (Epic 5) |
| Fan-out search + 200ms debounce | Curriculum FTS5 (only if LIKE fails NFR22) |
| Always-viewable items; fix BUG7 | Lesson/details split (Epic 4) |
| Passage row summary **when available** + lock chip | Pipeline `summary_ja/en` + word spans |
| Redirects `learn/*` `read/*` | Full locked-passage needed-items to-do (FR69) |
| Reuse existing item detail + passage reader routes | Long-press word details + NFR29 (FR70) |
| | `passage_practice_results` read-back (BUG5) |

### Current state (must read before coding)

| Area | Today | This story changes |
| --- | --- | --- |
| Tabs | Home · Learn · Read · Stats · Settings | Home · Browse · Talk · Stats · Settings |
| Discovery | `/learn` hub → `/learn/[level]` → type picker → FlatList | Flat Browse list; level/type are filters |
| Passages | Separate `/read` tab | Rows in Browse UNION |
| Item lock in list | `learn/[level].tsx` deps dim + “Learn first” (**BUG7**) | Removed from Browse |
| Search | None | Fan-out + debounce |
| Filters | Single type tab + level route | 5 faceted multi-select drawers |
| `browseRepository` / `useBrowseItems` | Missing | New |
| Passage summaries | No summary columns; `english_translation` exists | Interim EN line; JA when pipeline lands |
| Unlock math | `core/content/passageUnlock.ts` (Story 2.2) | Reuse for lock facet + row chip |
| Home Learn CTA | → `/lesson` | Unchanged label/target |
| Home readiness | → `/read/[id]` | → Browse passage (+ redirect) |

### Architecture compliance

- **Three-layer purity:** search normalization / filter serialization helpers in `core/` if pure; SQL only in `data/curriculum/browseRepository.ts`; hooks wire; components presentational.
- **Result type:** fallible async → `Result<T, AppError>`. Sync SQLite reads may return plain values (match existing repos); do not throw across async hook boundaries — catch and surface empty/error UI.
- **Dual DB:** curriculum read-only; user mutable; **ATTACH** for Browse joins (SRS, study status). Never write `curriculum.db`.
- **NativeWind:** semantic tokens only (`bg-background`, `text-primary`, `text-secondary`, `border-border`, `content-*`, `srs-*`). No raw hex / deprecated `Colors`.
- **Filter state** not in review session context.
- **View permission ≠ lesson eligibility:** Browse never applies dependency-graph lock to item rows; lesson planner keeps graph rules.

### Anti-patterns (do NOT)

- Do not keep a Read tab “just in case” once Browse lists passages.
- Do not make JLPT a navigational stack (`/browse/N5`) — filters only.
- Do not apply `isItemUnlocked` / unmet-prereq dimming to Browse item rows (BUG7).
- Do not put UNION SQL or debounce timers inside presentational rows.
- Do not replace the search TextInput value with kana while typing.
- Do not implement FR69 full to-do sheet, FR70 long-press, or BUG5 practice read-back here.
- Do not add a separate unlock table — derived `computePassageUnlock` only.
- Do not block on FlashList / `newArchEnabled` / platform floor (Epic 5).
- Do not compile new summary columns in the curriculum pipeline in this story (3.2).
- Do not invent a second lesson planner inside Browse.
- Do not use progressive streaming search merges (rejected in brainstorm).

### Settled product meanings

| Term | Meaning for 3.1 |
| --- | --- |
| Performance facet | `StudyStatus`: known / in_progress / not_started |
| SRS stage facet | `srs_stage_label` on `srs_states` |
| Lock facet | Passage unlock via `PASSAGE_UNLOCK_COVERAGE` (0.9) Guru+ |
| Talk tab | Placeholder until Epic 5 |
| Home “Learn” | Lesson CTA — not the Browse tab label |

### Reuse map

| Need | Reuse |
| --- | --- |
| Item list fields | `itemRepository` patterns / columns (`primary_form`, `meaning`, `item_type`, `jlpt_level`) |
| Passage list | `passageRepository` + extend for browse fields |
| Unlock / remaining | `computePassageUnlock`, `PASSAGE_UNLOCK_COVERAGE`, link getters from 2.2 |
| Study status | `listStudyStatusesForItems` / ATTACH `item_study_status` |
| SRS labels | `srs_states.srs_stage_label` via ATTACH |
| Romaji→kana | `wanakana` (already in `package.json`) — parallel branch only |
| Content accents | `CONTENT_TYPE_ACCENT`, `ContentTypeBadge` |
| Item details UI | `components/learn/*` behind browse routes |
| Passage reader | Existing `read/[id].tsx` behind redirect/wrapper |
| ATTACH alias | `database.ts` `CURRICULUM_ATTACH_ALIAS` |
| Empty-state tone | UX-DR30 invitation, not shame |
| Chip patterns | `JlptLevelPicker` / `CalibrationItemTypePicker` as visual reference only — need **multi-select** drawers |

### File structure (expected)

**New:**
- `mobile/src/app/(tabs)/browse/_layout.tsx`
- `mobile/src/app/(tabs)/browse/index.tsx` (+ test)
- `mobile/src/app/(tabs)/browse/item/[id].tsx` (wrapper or move)
- `mobile/src/app/(tabs)/browse/passage/[id].tsx` (wrapper)
- `mobile/src/app/(tabs)/converse/index.tsx` (Talk placeholder) (+ light test)
- `mobile/src/components/browse/BrowseList.tsx`
- `mobile/src/components/browse/BrowseRow.tsx`
- `mobile/src/components/browse/PassageBrowseRow.tsx`
- `mobile/src/components/browse/SearchField.tsx`
- `mobile/src/components/browse/FilterPill.tsx`
- `mobile/src/components/browse/FilterDrawer.tsx`
- `mobile/src/components/browse/BrowseEmptyState.tsx`
- `mobile/src/data/curriculum/browseRepository.ts` (+ `.test.ts`)
- `mobile/src/data/hooks/useBrowseItems.ts` (+ test)
- Optional pure helpers: `mobile/src/core/browse/searchQuery.ts` (normalize + kana branches)

**Update:**
- `mobile/src/app/(tabs)/_layout.tsx` — tab titles/icons/order
- `mobile/src/app/(tabs)/learn/**` — redirects or delete screens after browse parity
- `mobile/src/app/(tabs)/read/**` — redirects
- `mobile/src/components/engagement/ReadingReadiness.tsx` — browse passage href
- `mobile/src/constants/contentType.ts` — passage accent/label if missing
- `mobile/src/config/constants.ts` — `BROWSE_PAGE_SIZE`, `BROWSE_SEARCH_DEBOUNCE_MS = 200`
- `mobile/__mocks__/expo-sqlite.ts` — UNION / filter query branches as needed
- Tests that assert Learn/Read tab names or level-lock browse behavior

**Do not confuse with historical artifacts:** older `_bmad-output/implementation-artifacts/3-*-import-*.md` files are from a prior epic numbering (import epic). This story is **v2 Epic 3 Browse**.

### Testing requirements

- Pure: fan-out query string building (raw + hiragana branches); filter serialization; pagination stability; passage lock facet uses unlock helper; items ignored by lock facet.
- Repo: `countBrowse` matches `listBrowsePage` length for same filters; type+level filters; search hits meaning and reading; zero-result Apply path.
- UI: tab labels; Apply disabled at 0; pills; empty clear-filters; no dependency “Learn first” on item rows; passage row shows lock chip when locked.
- Gates: typecheck, lint, test from `mobile/`.
- Watch mock pitfall: expo-sqlite mock **GROUP BY ignoring WHERE** can lie about counts — prefer explicit count query tests with controlled fixtures (`deferred-work.md`).

### Previous story intelligence (Epic 2)

- **2.2** already shipped `passageUnlock.ts` + link reads + Home readiness — **reuse**, do not reimplement 90% math.
- **2.2** deferred Browse IA / Read removal / UNION explicitly to this story.
- **2.2** deferred `useReadingReadiness` N+1 batching to 3.2 — do not expand Home readiness scope here beyond href retarget.
- Story-file shape to mirror: scope table, anti-patterns, reuse map, expected files (this file).
- Home composition + goal ring are done — do not regress CTA order or reintroduce streak.
- FlatList `renderItem` memoization called out in deferred-work — apply on Browse from day one.

### Git intelligence

Recent work: review pacing done (`e736944`); Home triage in review (`186ef4e`); goal ring done. Patterns: co-located Jest, NativeWind tokens, pure `core/` helpers, ATTACH joins for cross-DB, RNTL with stabilized mocks. Mirror those — no new UI kit.

### Latest tech notes

- **Virtualization:** Expo documents `@shopify/flash-list` for SDK 55, but this app has not enabled New Architecture / platform floor yet (Epic 5). **Ship FlatList + pagination** in 3.1; revisit FlashList after New Arch if scroll jank appears at ~10k rows.
- **wanakana ^5.3.1** already installed — use `toHiragana` / `toKatakana` for search branches only.
- **Sync SQLite:** prefer one debounced query; do not fake async streaming.
- **SQLITE variable limit:** chunk large `IN` lists if binding thousands of IDs (existing import pattern).

### Project Structure Notes

Aligns with architecture target tree: `app/(tabs)/browse`, `components/browse`, `data/curriculum/browseRepository`, `hooks/useBrowseItems`. Max Browse drill-down ~2 (list → item/passage detail). Conversation placeholder occupies the fifth tab until Epic 5.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 3 Story 3.1 ACs]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR62–FR67, FR8b/c amended, BUG7, NFR22]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Unified Browse subsystem; ATTACH; browseRepository; tabs]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — UX-DR3, UX-DR13–14, UX-DR30–32, UX-DR34]
- [Source: `_bmad-output/planning-artifacts/ux-design-directions.html` — Direction G Browse]
- [Source: `_bmad-output/brainstorming/brainstorming-session-2026-07-18-2354.md` — facets, fan-out, Gating #11, BUG7/G8]
- [Source: `_bmad-output/planning-artifacts/.decision-log.md` — R3 Read→Browse]
- [Source: `_bmad-output/implementation-artifacts/2-2-home-triage-post-session-proof-days-studied.md` — unlock helper + scope deferrals]
- [Source: `mobile/src/app/(tabs)/learn/[level].tsx` — BUG7 site lines 105–110]
- [Source: `scripts/curriculum-schema.ts` — `reading_passages` columns (no summaries yet)]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Opus 4.8)

### Debug Log References

- **Expo Router type generation broke on a `_layout.test.tsx` sibling.** The tab-shell test was first written as `src/app/(tabs)/_layout.test.tsx`. Expo Router treats *any* `_layout.*` file in a route directory as a layout, so the duplicate silently dropped every `(tabs)` route from `.expo/types/router.d.ts` (14K → 7.6K), which surfaced as ~8 bogus "not assignable to Href" typecheck errors across untouched files. Moved to `mobile/__tests__/tabs-layout.test.tsx`; types regenerate fully (16K) and typecheck is clean. Comment left in the test file so it is not moved back.
- **Infinite render loop in the first `useBrowseItems` test run** (V8 OOM). Cause was the test's `useDatabase` mock returning a fresh object literal per render, invalidating the `passageUnlock` memo and re-firing the query effect forever. The real `DatabaseProvider` hands out a stable context value; the mock now does too, and the reason is commented in the test.
- **Pre-existing suite failure fixed:** `countDueSrsStates › returns an uncapped count of non-burned dues` was already red on the baseline commit (verified by stashing this story's work and re-running). The `srs_states` `COUNT(*)` branch of the expo-sqlite mock counted the whole table before applying `WHERE due_date <= ? AND is_burned = 0` — exactly the "GROUP BY / COUNT ignoring WHERE" pitfall recorded in `deferred-work.md` and flagged in this story's Dev Notes. Fixed in the mock rather than worked around, since Browse relies on count queries being truthful.

### Completion Notes List

**Architecture decisions worth knowing:**

- **One `UNION ALL` query, not two merged reads.** Items and passages are unioned in SQL with a shared `level_rank` column so ordering, `LIMIT` and `OFFSET` apply once across both kinds. Merging two paginated result sets in JS cannot page correctly across a combined ordering.
- **Ordering is total:** `level_rank ASC, sort_order ASC, kind ASC, id ASC`. The `kind`+`id` tie-break is what stops pagination duplicating or skipping rows when an item and a passage share a level and sort order.
- **Count and page cannot drift.** Both `buildBrowsePageQuery` and `buildBrowseCountQuery` are built from one `buildBrowseUnion(...)`; the page query is literally the counted subquery plus ordering and paging. A test asserts the count query contains the page query's exact `FROM`/`WHERE` body and identical params. This is a stronger guarantee than the "count matches page length" fixture test the story suggested, which the ATTACH-blind sqlite mock cannot express honestly.
- **Passage lock is resolved before the query, not in it.** Unlock is derived from `computePassageUnlock` (reused from Story 2.2 — the 90% Guru+ math was not reimplemented) and cannot be expressed in SQL. `listPassageUnlockStates` resolves it up front and binds the matching passage ids into the query, so the Lock facet still paginates correctly without inventing an unlock table.
- **Facets that do not apply to a row kind leave that kind unconstrained** (the choice the story asked to be documented): Performance and SRS stage narrow items while passages still show; Lock narrows passages while items still show. Narrowing to a single kind is what the Type facet is for. Documented on the `BrowseFilters` type.
- **SRS stage facet uses no `COALESCE`.** An item with no SRS row has no stage; giving it a stand-in would let it match a facet the learner never earned. A test asserts the absence of `COALESCE(r.srs_stage_label`.

**BUG7 (AC #5) is fixed structurally, not by omission.** `BrowseRow` accepts no lock, prerequisite or dependency prop — there is nowhere to pass one — and `BrowseItemRow` carries no such field. The old `learn/[level].tsx:105-110` dimming logic was not ported. Covered by a repository test (mapped item rows have no `locked`/`isLocked` key) and a screen test (row is enabled, un-dimmed, has no dependency hints, and navigates on press).

**FR66 passage summaries are interim, as scoped.** `reading_passages` has no `summary_ja` / `summary_en` columns yet (Story 3.2 pipeline). `summaryJa` is null today and `summaryEn` falls back to `english_translation`; the row props and search branches are already shaped so the real columns drop in without touching the component.

**Search never rewrites the input.** `SearchField` is deliberately not a `WanaKanaInput`. Kana conversion happens downstream as *extra OR branches* — "mizu" probes the raw text plus みず and ミズ, because it may legitimately be an English meaning too. A partial romaji tail ("nihonk") keeps the convertible kana prefix and drops the unmatchable remainder rather than breaking the branch.

**Deliberately NOT done (out of scope per the story's scope table):**

- **Task 2's index subtask was conditional and its condition was not met.** It reads "if LIKE search is slow on device... measure before inventing FTS". No on-device measurement was performed in this story, so no curriculum compile indexes and no FTS5 were added. This is the documented NFR22 deferral, not an oversight — flagging it explicitly so it is not mistaken for completed work.
- Locked-passage rows open the existing reader (which already handles locked state) with a "3 to go" destination chip. The full FR69 needed-items to-do sheet is Story 3.2, as scoped.
- FlashList / New Architecture (Epic 5), FR70 long-press word details, BUG5 practice read-back, and the `summary_ja/en` compile pipeline were all left alone.

**Legacy routes:** `learn/*` and `read/*` are now `<Redirect>` screens kept mounted via `href: null` in the tab layout, so the Read/Learn tabs are gone from the bar while existing deep links (including the `/read/[id]` one Story 2.2 shipped on Home) still resolve. `/learn/[level]` forwards into Browse with that level seeded as a *filter*, since level is a facet now and never a route. Both `_layout.tsx` files carry a comment saying they are safe to delete once no shipped build links into them.

**Detail screens were extracted, not duplicated:** `ItemDetailScreen` and `PassageDetailScreen` now live in `components/`, with the Browse routes as thin wrappers. Their existing test suites moved with them rather than being dropped.

### File List

**New:**
- `mobile/src/app/(tabs)/browse/_layout.tsx`
- `mobile/src/app/(tabs)/browse/index.tsx`
- `mobile/src/app/(tabs)/browse/index.test.tsx`
- `mobile/src/app/(tabs)/browse/item/[id].tsx`
- `mobile/src/app/(tabs)/browse/passage/[id].tsx`
- `mobile/src/app/(tabs)/converse/index.tsx`
- `mobile/src/app/(tabs)/converse/index.test.tsx`
- `mobile/src/components/browse/BrowseList.tsx`
- `mobile/src/components/browse/BrowseRow.tsx`
- `mobile/src/components/browse/PassageBrowseRow.tsx`
- `mobile/src/components/browse/SearchField.tsx`
- `mobile/src/components/browse/FilterPill.tsx`
- `mobile/src/components/browse/FilterDrawer.tsx`
- `mobile/src/components/browse/BrowseEmptyState.tsx`
- `mobile/src/components/learn/ItemDetailScreen.tsx`
- `mobile/src/components/read/PassageDetailScreen.tsx`
- `mobile/src/core/browse/browseFilters.ts`
- `mobile/src/core/browse/browseFilters.test.ts`
- `mobile/src/core/browse/browseSearch.ts`
- `mobile/src/core/browse/browseSearch.test.ts`
- `mobile/src/data/curriculum/browseRepository.ts`
- `mobile/src/data/curriculum/browseRepository.test.ts`
- `mobile/src/data/hooks/useBrowseItems.ts`
- `mobile/src/data/hooks/useBrowseItems.test.tsx`
- `mobile/__tests__/tabs-layout.test.tsx`

**Moved (test suites followed their screens into Browse):**
- `mobile/src/app/(tabs)/learn/item/[id].test.tsx` → `mobile/src/app/(tabs)/browse/item/[id].test.tsx`
- `mobile/src/app/(tabs)/read/[id].test.tsx` → `mobile/src/app/(tabs)/browse/passage/[id].test.tsx`

**Modified:**
- `mobile/src/app/(tabs)/_layout.tsx` — tabs are Home · Browse · Talk · Stats · Settings; learn/read hidden via `href: null`
- `mobile/src/app/(tabs)/_layout.web.tsx` — matching web tab triggers
- `mobile/src/app/(tabs)/index.tsx` — `ReadingReadiness` navigates to `/browse/passage/[id]`
- `mobile/src/app/(tabs)/index.test.tsx` — updated readiness navigation assertion
- `mobile/src/app/(tabs)/learn/index.tsx` — redirect to `/browse`
- `mobile/src/app/(tabs)/learn/[level].tsx` — redirect to `/browse` with the level seeded as a filter
- `mobile/src/app/(tabs)/learn/item/[id].tsx` — redirect to `/browse/item/[id]`
- `mobile/src/app/(tabs)/learn/_layout.tsx` — comment recording redirect-only purpose
- `mobile/src/app/(tabs)/read/index.tsx` — redirect to `/browse`
- `mobile/src/app/(tabs)/read/[id].tsx` — redirect to `/browse/passage/[id]`
- `mobile/src/app/(tabs)/read/_layout.tsx` — comment recording redirect-only purpose
- `mobile/src/config/constants.ts` — `BROWSE_PAGE_SIZE`, `BROWSE_SEARCH_DEBOUNCE_MS`, `BROWSE_COUNT_DEBOUNCE_MS`
- `mobile/src/constants/contentType.ts` — `PASSAGE_CONTENT_ACCENT` / `PASSAGE_CONTENT_LABEL` on the `content-reading` token
- `mobile/src/data/database.ts` — exported `CURRICULUM_ATTACH_ALIAS`
- `mobile/__mocks__/expo-sqlite.ts` — `srs_states` `COUNT(*)` now applies the due/burned predicate before counting

**Deleted (screens replaced by redirects):**
- `mobile/src/app/(tabs)/learn/index.test.tsx`
- `mobile/src/app/(tabs)/learn/[level].test.tsx`
- `mobile/src/app/(tabs)/read/index.test.tsx`

## Change Log

- 2026-07-20 — Story context created (ready-for-dev). Ultimate context engine analysis completed — comprehensive developer guide created.
- 2026-07-20 — Implemented Story 3.1. Browse replaces Learn/Read as the single discovery tab (Talk placeholder added); new `browseRepository` UNION query layer with ATTACH joins, pagination and a count query that cannot drift from the page; five multi-select facets with a live `Apply (N)` that disables at zero; 200ms-debounced fan-out search with parallel kana branches; BUG7 fixed structurally (Browse item rows have no lock affordance and no prop to pass one). Legacy `learn/*` and `read/*` routes kept as redirects. Gates: typecheck clean, lint clean, 141 suites / 1117 tests green, contrast check passes. Also fixed a pre-existing `countDueSrsStates` failure caused by the expo-sqlite mock counting before filtering.
- 2026-07-20 — Code review patches applied: pagination generation guard, stable unlock Map on focus, type+level seed with URL clear, LIKE ESCAPE, distinct query error UI, unlock fail-closed, Clear all on filter bar, synced Apply/list debounce, Apply keeps settled N while recounting. Story → done.
