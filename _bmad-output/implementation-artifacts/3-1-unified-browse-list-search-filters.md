---
baseline_commit: e736944
---

# Story 3.1: Unified Browse List, Search & Filters

Status: ready-for-dev

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

- [ ] **Task 1 — Tab shell: Browse + remove Read + Conversation placeholder** (AC: #1)
  - [ ] Update `app/(tabs)/_layout.tsx`: tabs = **Home · Browse · Talk · Stats · Settings**. Icon suggestions: Browse `search` / `menu-book`; Talk `chat` / `forum`. Short label **Talk** is OK (UX-DR3).
  - [ ] Add `app/(tabs)/browse/` stack (`_layout.tsx`, `index.tsx`). Remove or unmount Read as a tab screen.
  - [ ] Add `app/(tabs)/converse/index.tsx` (or `talk/`) placeholder: calm empty state (“Conversation coming soon” / offline-friendly). No BYOK, no chat — Epic 5 owns that.
  - [ ] Temporary redirects: `learn/*` → browse equivalents; `read/index` → `/browse`; `read/[id]` → `/browse/passage/[id]` (Expo Router redirect or thin re-export screens). Keep working deep-links from Home readiness (`/read/[id]` today).
  - [ ] Home **Learn CTA stays “Learn”** and still starts a lesson (`/lesson`) — Home offers study modes; Browse is discovery (FR58 vs FR62). Do not rename Home CTA to Browse.
  - [ ] Retarget `ReadingReadiness` navigation to `/browse/passage/[id]` (keep `/read/[id]` redirect as safety).
  - [ ] Update tab layout tests / any hardcoded “Learn” / “Read” tab assertions.

- [ ] **Task 2 — Browse query layer (UNION + pagination + count)** (AC: #2, #3, #4)
  - [ ] New `data/curriculum/browseRepository.ts` (SQL lives here — **never** build UNION SQL in JSX).
  - [ ] Row model e.g. `BrowseRowModel`:
    - Discriminated: `{ kind: 'item' | 'passage'; id; jlptLevel; sortKey; ... }`
    - Item: `itemType`, `primaryForm`, `meaning`, optional reading snippet, optional study/SRS fields for display
    - Passage: `title`, `summaryJa?`, `summaryEn?`, `locked`, `itemsRemainingToUnlock?`
  - [ ] `listBrowsePage(userDb, filters, search, { limit, offset })` and `countBrowse(userDb, filters, search)` using **ATTACH** (`CURRICULUM_ATTACH_ALIAS` / `curriculum.*`) so SRS + study status join in one query when facets need them.
  - [ ] Default sort: JLPT easy-first (N5→N1) then `sort_order`, with a stable tie-break (e.g. kind+id) so pagination does not duplicate/skip.
  - [ ] Page size constant (suggest `BROWSE_PAGE_SIZE = 40`) in `config/constants.ts`.
  - [ ] Indexes: if LIKE search is slow on device, add curriculum compile indexes on searched columns (`items.primary_form`, `items.meaning`, `accepted_answers.answer_text`, passage title/summary fields) — measure before inventing FTS.

- [ ] **Task 3 — Faceted filters + live Apply count + pills** (AC: #3, #7)
  - [ ] Facets (multi-select each; empty facet = no constraint):
    | Facet | Values | Source |
    | --- | --- | --- |
    | Level | N5–N1 | `items.jlpt_level` / `reading_passages.jlpt_level` |
    | Type | radical, kanji, vocabulary, grammar, **passage** | item_type + passage kind |
    | Performance | known, in_progress, not_started | `item_study_status` (default missing → `not_started`); passages: map via unlock or exclude from this facet when N/A — document choice (prefer: performance applies to items only; selecting performance alone still returns matching items + all/unfiltered passages unless Type=passage also set) |
    | SRS stage | apprentice, guru, master, enlightened, burned | `srs_states.srs_stage_label` (items without SRS row = no stage — only match when facet empty or treat as not-in-SRS; do **not** invent fake stages) |
    | Lock | locked, unlocked | **Passages only** via `computePassageUnlock` (≥90% Guru+). Items never participate in lock facet. |
  - [ ] UI: five `FilterPill` entry points → `FilterDrawer` (modal/bottom sheet) with multi-select options + **Apply (N)** live count (debounce count queries ~100–150ms while toggling). Disable Apply when N=0.
  - [ ] Applied filters render as **self-summarizing pills** (e.g. “N5”, “Vocab + Grammar”, “Guru+”, “Locked”) with clear-one / clear-all.
  - [ ] Filter state: local React state or tiny `BrowseFilterContext` — **not** `ReviewSessionProvider`.
  - [ ] Empty list: “No matches” + clear-filters action (UX-DR30). Distinct from loading skeletons.

- [ ] **Task 4 — Fan-out search (~200ms debounce)** (AC: #4)
  - [ ] `SearchField` at top of Browse (Direction G). Controlled input; debounce **200ms** before querying.
  - [ ] Fan-out: keep **raw query** always; if romaji-ish, also compute `wanakana.toHiragana(raw)` (and optionally katakana) **in parallel as extra OR branches** — never replace the TextInput value with kana (unlike review `WanaKanaInput`).
  - [ ] OR branches (case-insensitive WHERE possible): `primary_form`, `meaning`, `accepted_answers.answer_text`, `kanji_readings.reading`, passage `title`, passage summary JA/EN when columns exist, fallback `english_translation` for EN.
  - [ ] Partial romaji: untranslated consonant tail must not break search (brainstorm) — keep raw prefix; treat failed kana conversion as “raw only”.
  - [ ] Reject progressive/streaming result merging — one ranked/ordered query after debounce (sync SQLite).

- [ ] **Task 5 — Browse list UI + BUG7** (AC: #2, #5, #6, #7)
  - [ ] Components under `components/browse/`: `BrowseList`, `BrowseRow` (items), `PassageBrowseRow`, `SearchField`, `FilterPill`, `FilterDrawer`, empty state.
  - [ ] Virtualized list: **RN `FlatList` + pagination** is the default for this story (no FlashList dependency yet; New Architecture / FlashList is Epic 5 platform work). Memoize row components; stable `keyExtractor` (`item:{id}` / `passage:{id}`). Load next page on end-reached.
  - [ ] Item rows: content-type accent (`CONTENT_TYPE_ACCENT` / `content-reading` for passages). **Never** pass `isLocked` / dependency dimming for kanji/vocab/grammar — fix BUG7 by not porting `learn/[level].tsx:105-110` logic.
  - [ ] Tapping item → `/browse/item/[id]` (reuse existing detail components from `components/learn/*` via thin route wrapper; redirects from `/learn/item/[id]` OK).
  - [ ] Passage rows: title + bilingual summary when available; lock chip as destination framing (“3 to go”), not a dead-end padlock-only. Tap unlocked → `/browse/passage/[id]` (reuse `read/[id]` reader for now). Tap locked → **temporary**: navigate to passage route or show a lightweight “needs more study” sheet — full needed-items to-do list is **Story 3.2**. For 3.1, showing lock chip + opening a stub/existing reader that already handles locked state is OK if it is not a blank dead end; do not invent the full FR69 list here.
  - [ ] Passage accent token: reuse `content-reading` (UX-DR32). Extend `contentType.ts` if needed for a passage label.

- [ ] **Task 6 — Passage summary display (FR66 interim)** (AC: #6)
  - [ ] Schema today: `reading_passages` has `title`, `body`, `english_translation` — **no** `summary_ja` / `summary_en` columns yet (Story 3.2 pipeline).
  - [ ] Interim display: EN line from `english_translation` (truncated one-line); JA line omit or use a short title-adjacent fallback — **do not** block 3.1 on compile-pipeline summary columns. Wire row props so real summary columns plug in later.
  - [ ] Search interim: include `title` + `english_translation` in fan-out; when summary columns land in 3.2, extend OR branches.

- [ ] **Task 7 — Hook wiring** (AC: #2–#4)
  - [ ] `data/hooks/useBrowseItems.ts`: debounce search, hold applied filters, page accumulation, `loading` / `loadingMore`, `totalCount`, `clearFilters`, `loadMore`.
  - [ ] Separate cheap `countBrowse` for drawer live Apply (pending draft filters ≠ applied filters until Apply).
  - [ ] Use `userDb` (with curriculum ATTACH) for joined queries; never write curriculum.

- [ ] **Task 8 — Verification**
  - [ ] Unit: browse filter SQL builder / fan-out branch construction; debounce behavior; lock facet uses `computePassageUnlock` only for passages; BUG7 — item rows have no lock prop from deps.
  - [ ] Component/RNTL: Browse tab label; empty “No matches” + clear; Apply disabled at 0; pills summarize; search debounce (fake timers).
  - [ ] Update/remove obsolete `learn/[level].test.tsx` lock assertions if level screen is deleted or reduced to redirect.
  - [ ] Gates: `npm run typecheck`, `npm run lint`, `npm test` from `mobile/`.

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

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-07-20 — Story context created (ready-for-dev). Ultimate context engine analysis completed — comprehensive developer guide created.
