# Story 2.3: Per-item study status (known / in progress / not started)

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a **returning learner**,
I want **to mark individual kanji, vocabulary, or grammar items as known, in progress, or not started**,
So that **my queue reflects what I already know (FR23)**.

## Acceptance Criteria

1. **Calibration onboarding screen (FR23, UX-DR17, Direction F)**

   **Given** I completed Story 2.2 and land on `/onboarding/calibrate`  
   **When** the screen renders  
   **Then** it uses `OnboardingStep` with `stepIndex={3}` and `stepCount={4}` (welcome → intensity → calibration → complete)  
   **And** the heading reads **"What do you already know?"** with subcopy **"Mark items at your level so reviews focus on what's new."**  
   **And** I see a **type filter** (segmented control or tabs) for: **Radicals**, **Kanji**, **Vocabulary**, **Grammar** — single-select, default **Kanji** (highest-value calibration for returning learners)  
   **And** the list queries **`curriculum.db` only** for items at my stored `starting_jlpt_level` + selected `item_type` — **no** Learn tab / Epic 4 UI dependency  
   **And** each row shows: primary form (`primary_form`), meaning, and a **three-state status control**: **Known** | **In progress** | **Not started**  
   **And** default status for items with no `user.db` row is **Not started** (visual selected state)  
   **And** status control uses `accessibilityRole="radiogroup"` per row with each option as `radio` + `accessibilityState={{ selected }}`  
   **And** touch targets ≥ 44×44 pt; selected state is border/icon + label (not color-only)  
   **And** list is scrollable (`FlatList` or `FlashList` if already in repo — otherwise `FlatList`) with stable `keyExtractor` on `item.id`  
   **And** empty state when no curriculum rows exist for level+type: **"No [type] at [level] yet."** (non-N5 levels may be empty until content ships)

2. **Persist per-item study status (FR23, NFR10)**

   **Given** I change an item's status on the calibration list  
   **When** I tap a status option  
   **Then** the choice is written to `user.db` → `item_study_status` via `itemStudyStatusRepository`  
   **And** stored `status` is one of: `known`, `in_progress`, `not_started`  
   **And** `item_id` matches `curriculum.db` `items.id` (integer stored as number; TypeScript `string` at UI boundary per existing `RadicalItem.id` pattern)  
   **And** writes are **immediate** (no Save button) — same pattern as Settings intensity in Story 2.2  
   **And** selecting **Not started** **deletes** the row (absence = not started) OR upserts `not_started` — **pick one** and test it; recommended: **delete row** to keep table sparse  
   **And** killing and relaunching the app restores every marked status on `/onboarding/calibrate`

3. **Dependency / transition rules (documented behavior)**

   **Given** curriculum `item_relationships` data exists (N5 seed has 87 `requires` edges)  
   **When** I mark an item **Known** or **In progress**  
   **Then** the app **does not hard-block** the change during onboarding calibration (self-reported knowledge — FR23)  
   **And** optional: show non-blocking hint text on kanji rows listing required radicals from `item_relationships` (read-only; **no** modal, **no** disabled buttons in this story)  
   **And** invalid **status value** strings are rejected at repository layer (`isStudyStatus` guard)  
   **And** **strict dependency gating** (cannot unlock kanji until radicals known) is **deferred to Epic 4** (`dependencyGraph.ts`) and Epic 5 queue builder — document in code comment on repository

4. **SRS / queue contract (store only — no FSRS in this story)**

   **Given** I mark items **In progress** or **Known**  
   **When** Epic 5 queue builder or Epic 3 import runs later  
   **Then** `getStudyStatus(userDb, itemId)` and `listStudyStatusesForItems(userDb, itemIds)` provide the contract  
   **And** **`known`** ⇒ exclude from new-lesson queue; treat as mastered/skip input for downstream  
   **And** **`in_progress`** ⇒ seed candidate for SRS (actual `srs_states` rows created in Story 5.1 / import stories — **not** in 2.3)  
   **And** **`not_started`** (no row) ⇒ default new content path  
   **And** this story adds migration `002_item_study_status` only — **no** `srs_states` table yet

5. **Advance onboarding (placeholder for Story 2.4)**

   **Given** I reviewed or skipped per-item marking  
   **When** I tap **Continue**  
   **Then** onboarding navigates to `/onboarding/bulk` (**placeholder** for Story 2.4 — title + "Bulk marking — coming next" is sufficient)  
   **And** `useOnboardingRedirect` behavior is unchanged: level + intensity set → land on `/onboarding/calibrate` until Story 2.5 sets `onboarding_completed`  
   **And** per-item statuses already saved are **not** lost when tapping Continue

6. **Tests and CI**

   **Given** implementation is complete  
   **When** CI runs in `mobile/`  
   **Then** `npm run lint`, `npm run typecheck`, and `npm test` pass  
   **And** unit tests cover: migration `002` creates `item_study_status`; repository set/get/delete round-trip; invalid status rejected; sparse default (no row ⇒ not started)  
   **And** curriculum `itemRepository.listItemsByLevelAndType` returns typed rows for each `item_type`  
   **And** `calibrate.test.tsx` (or component tests): renders list from mocked DB; tapping status calls repository; Continue navigates to bulk placeholder  
   **And** existing `useOnboardingRedirect` tests still pass (no regression)

## Tasks / Subtasks

- [x] **AC1 — Replace calibrate placeholder with real screen**
  - [x] Rewrite `mobile/src/app/onboarding/calibrate.tsx` using `OnboardingStep` (mirror `intensity.tsx` structure).
  - [x] Create `mobile/src/components/onboarding/CalibrationItemTypePicker.tsx` — four-type segmented control (Radicals / Kanji / Vocabulary / Grammar).
  - [x] Create `mobile/src/components/onboarding/CalibrationItemRow.tsx` — row layout + three-option status picker.
  - [x] Create `mobile/src/components/onboarding/ItemStudyStatusPicker.tsx` — reusable three-state control (Known / In progress / Not started).
  - [x] Load `starting_jlpt_level` via `getStartingJlptLevel(userDb)`; show error/redirect if missing (redirect hook should prevent this).
  - [x] Register `bulk` screen in `mobile/src/app/onboarding/_layout.tsx` (placeholder for 2.4).

- [x] **AC2 — user.db migration + repository**
  - [x] Add `mobile/src/data/migrations/002_item_study_status.ts` — create `item_study_status` table + index.
  - [x] Register migration in `mobile/src/data/migrations/index.ts`.
  - [x] Add `StudyStatus` type + `isStudyStatus()` in `mobile/src/data/user/studyStatus.types.ts`.
  - [x] Add `itemStudyStatusRepository.ts`: `getStudyStatus`, `setStudyStatus`, `clearStudyStatus` (for not_started), `listStudyStatusesForItems`, `getStudyStatusOrDefault`.
  - [x] Extend `migrationRunner.test.ts` for 002 idempotency.

- [x] **AC1/AC2 — curriculum queries (onboarding-only, no Epic 4)**
  - [x] Add `mobile/src/data/curriculum/itemRepository.ts` with `listItemsByLevelAndType(db, jlptLevel, itemType)` returning shared `CurriculumListItem` type.
  - [x] Add `mobile/src/data/hooks/useCalibrationItems.ts` — composes `useDatabase` + level + type filter.
  - [x] Optional: `getRequiredParentLabels(curriculumDb, itemId)` for hint text from `item_relationships` (read-only).

- [x] **AC5 — Bulk placeholder + navigation**
  - [x] Create `mobile/src/app/onboarding/bulk.tsx` — minimal placeholder for Story 2.4.
  - [x] `calibrate.tsx` Continue → `router.replace('/onboarding/bulk')`.

- [x] **AC6 — Tests**
  - [x] `studyStatus.types.test.ts` — `isStudyStatus` boundaries.
  - [x] `itemStudyStatusRepository.test.ts` — round-trip, delete-on-not-started, batch read.
  - [x] `itemRepository.test.ts` — N5 counts match seed (25/32/41/16) using test curriculum fixture or mock DB.
  - [x] `ItemStudyStatusPicker.test.tsx` — radiogroup semantics, selection callback.
  - [x] `calibrate.test.tsx` — screen integration with mocked repositories.

- [x] **Manual verification**
  - [x] Path: welcome → intensity → calibrate → mark 3 kanji Known, 2 In progress → force-quit → relaunch → statuses restored on calibrate.
  - [x] Switch type tabs — each loads correct N5 counts.
  - [x] Continue → bulk placeholder; back navigation does not corrupt statuses.
  - [x] Confirm zero sign-up UI on calibrate screen.

## Dev Notes

### Epic context (Epic 2)

Epic 2 delivers the **first-run path without an account**: JLPT starting level (✅ 2.1), session intensity (✅ 2.2), per-item and bulk calibration (**this story** + 2.4), then handoff to main tabs (2.5).

**Story 2.2 delivered:** `session_intensity` persistence, redirect chain through `/onboarding/calibrate`, calibrate **placeholder**, `OnboardingStep` step 2/4, Settings intensity picker.

**This story (2.3)** replaces the calibrate placeholder with a real per-item marking UI, introduces `item_study_status` in `user.db`, and adds curriculum list queries scoped to onboarding.

**Out of scope for 2.3 (do not implement):**

| Area | Deferred to |
| --- | --- |
| Bulk mark known UI + batched writes | Story 2.4 |
| `onboarding_completed = true` + skip to `(tabs)` | Story 2.5 |
| `srs_states` table + FSRS seeding for `in_progress` | Story 5.1 / Epic 3 import |
| Strict dependency unlock blocking | Epic 4 (`dependencyGraph.ts`) + Epic 5 queue |
| Learn tab item lists / detail screens | Epic 4 |
| WaniKani / Bunpro / Anki import | Epic 3 |
| Edit study status from Settings or Learn hub | Epic 4+ |
| `attachCurriculumForQuery` cross-DB joins | Epic 4/5 (separate DB handles OK — query each DB in repository layer) |

### Technical requirements (must follow)

- **New table (migration 002):** `item_study_status` in `user.db` only — never write study status to `curriculum.db` (NFR10).
- **Recommended DDL:**

```sql
CREATE TABLE IF NOT EXISTS item_study_status (
  item_id INTEGER PRIMARY KEY NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('known', 'in_progress', 'not_started')),
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_item_study_status_status ON item_study_status(status);
```

- **Sparse rows:** Prefer **no row** = `not_started`. `setStudyStatus(..., 'not_started')` should `DELETE` the row. `getStudyStatusOrDefault` returns `'not_started'` when missing.
- **Status literals:** lowercase snake_case strings — stable contract for import (Epic 3) and queue builder (Epic 5).
- **Layer boundaries:** SQLite in `data/user/` and `data/curriculum/` repositories; UI in `app/onboarding/` + `components/onboarding/`; **no** `expo-sqlite` in components.
- **Reuse Story 2.1–2.2 patterns:** `OnboardingStep`, `Button`, `useDatabase()`, `router.replace()`, NativeWind tokens, 44pt touch targets, a11y radio groups, immediate persistence on select.
- **Curriculum query pattern:** Mirror `radicalRepository.ts` — SQL against `items` table with `item_type` + `jlpt_level` filters, `ORDER BY sort_order ASC`. Generalize to all four types in `itemRepository.ts` rather than four duplicate repositories.
- **N5 seed counts (sanity check):** 25 radicals, 32 kanji, 41 vocabulary, 16 grammar ([Source: Story 1.5 completion notes]). Other JLPT levels may return 0 rows until content expands — empty state is expected.
- **Dependency hints (optional):** Query `item_relationships` where `child_item_id = ?` and `relationship_type = 'requires'`; join parent `items` for labels. Display as `text-caption text-secondary` under kanji rows only — keep minimal.

### Dependency enforcement (document in repository)

| Rule | Story 2.3 behavior |
| --- | --- |
| Mark kanji Known while radicals Not started | **Allowed** — onboarding self-report |
| Mark vocab Known while kanji Not started | **Allowed** |
| Invalid status string | **Rejected** — throw or no-op with test coverage |
| Queue / lesson unlock order | **Not enforced** — Epic 4/5 |

Add a short module comment in `itemStudyStatusRepository.ts` pointing to Epic 4/5 for hard gating.

### UX compliance (Direction F + UX-DR17)

| Element | Spec |
| --- | --- |
| Heading | "What do you already know?" — `text-title-lg` |
| Subcopy | `text-secondary` — explains why marking matters |
| Type filter | Segmented row — match `SessionIntensityPicker` / `LevelPathCard` border selected styling |
| Row primary | `primary_form` — use `text-display` for kanji/radical, `text-body` for grammar structure |
| Row secondary | `meaning` — `text-body text-primary` |
| Status options | Compact pill or segmented trio per row — labels: **Known**, **In progress**, **Not started** |
| Known state | `border-feedback-correct` or check icon + label (not color-only) |
| In progress | `border-feedback-info` |
| Not started | `border-border` / muted |
| Primary CTA | Full-width "Continue" — always enabled (marking is optional) |
| Progress | Dots — step 3 of 4 |
| Skip | **Not required** — Continue alone is sufficient; user may leave all items Not started |

Reference: Direction F onboarding copy — "Choose your JLPT level and mark what you already know" ([Source: `ux-design-directions.html` — `#dir-f`]).

### Architecture compliance

| Requirement | Implementation |
| --- | --- |
| FR23 Per-item known / in-progress / not started | `item_study_status` + calibration UI |
| FR26 No account | Local SQLite only; no network |
| Dual-DB separation | Curriculum read-only queries; user writes only |
| Migration discipline | Forward-only `002` via `migrationRunner` |
| Naming conventions | `snake_case` columns; `StudyStatus` TS type; `itemStudyStatusRepository.ts` |
| Transactions | Single-row upsert/delete — no transaction required; Story 2.4 bulk uses batched transactions |
| NFR10 Progress survives curriculum swap | Study status in `user.db` untouched by OTA curriculum replace |

### File structure (this story)

```
mobile/src/
├── app/
│   └── onboarding/
│       ├── _layout.tsx                # MODIFY — register bulk screen
│       ├── calibrate.tsx              # MODIFY — replace placeholder
│       └── bulk.tsx                   # NEW — placeholder for 2.4
├── components/
│   └── onboarding/
│       ├── CalibrationItemTypePicker.tsx   # NEW
│       ├── CalibrationItemRow.tsx          # NEW
│       ├── ItemStudyStatusPicker.tsx       # NEW
│       └── *.test.tsx                      # NEW co-located tests
├── data/
│   ├── curriculum/
│   │   ├── itemRepository.ts          # NEW
│   │   └── itemRepository.test.ts     # NEW
│   ├── hooks/
│   │   └── useCalibrationItems.ts   # NEW
│   ├── migrations/
│   │   ├── 002_item_study_status.ts   # NEW
│   │   ├── index.ts                   # MODIFY
│   │   └── migrationRunner.test.ts    # MODIFY
│   └── user/
│       ├── studyStatus.types.ts       # NEW
│       ├── itemStudyStatusRepository.ts    # NEW
│       └── itemStudyStatusRepository.test.ts
```

**Do not create** `srsStateRepository.ts` in this story — architecture lists it for Epic 5.

### Previous story intelligence (Story 2.2)

- **Patterns that work:** `OnboardingStep` + full-width Continue; typed repository with validation helpers; corrupt/invalid preference values treated as unset — apply same validation discipline to `StudyStatus`.
- **Redirect chain:** `useOnboardingRedirect` sends users with level+intensity to `/onboarding/calibrate` — **do not** add a "calibration completed" flag in 2.3; Story 2.5 owns `onboarding_completed`.
- **Placeholder pattern:** Story 2.2 left `calibrate.tsx` as minimal placeholder — **replace entirely**; follow same pattern for new `bulk.tsx` placeholder for 2.4.
- **Component reuse:** `SessionIntensityPicker` is a good structural reference for segmented controls; extract `ItemStudyStatusPicker` for potential reuse in Epic 4.
- **Code review notes from 2.2:** Prefer testing real screen (`calibrate.test.tsx`) over harness-only wrappers; `onWelcome` excluded from calibrate redirect is inherited edge case — leave unchanged.
- **Do not regress:** Welcome, intensity, import stub, settings intensity, `onboarding_completed` early-exit in redirect hook.

### Git intelligence (recent commits)

| Commit | Relevance |
| --- | --- |
| `e150fff` Session intensity onboarding | Direct predecessor — calibrate placeholder exists; extend onboarding step 3 |
| `5b279c9` JLPT onboarding | `OnboardingStep`, redirect hook, preferences patterns |
| `a1b62c3` N5 curriculum seed | `items` table + 114 N5 rows to query; `radicalRepository` query template |
| `dd65064` Curriculum OTA | Confirms `user.db` isolated from curriculum swap — study status safe |

### Latest tech notes

- **expo-router ~55.0.14** / Expo SDK 55 — add `bulk` to onboarding Stack; run app once to refresh generated router types if needed (gitignored `.expo/types/router.d.ts`).
- **expo-sqlite** sync API (`getAllSync`, `runSync`) — matches existing repositories; use `withTransactionSync` only for multi-row batch (2.4).
- No new npm dependencies expected — `FlatList` from `react-native` is sufficient for ~114 rows per type.
- **FlashList:** not in repo — do not add unless profiling shows jank (unlikely at N5 scale).

### Project context reference

- No `project-context.md` in repo. SSOT: `architecture.md`, `epics.md`, `ux-design-specification.md`, `prd.md`.
- PRD FR23 wording: "already known" (skip), "in progress" (add to SRS at appropriate interval), "not started" ([Source: `prd.md` — FR23]).
- Implementation readiness: Story 2.3 must use **onboarding-only `curriculum.db` queries** — no Epic 4 Learn dependency ([Source: `implementation-readiness-report-2026-05-03.md`]).
- `db-schema-diagram.md` referenced by compile script is **not present** in `planning-artifacts/` — use `scripts/curriculum-schema.ts` for curriculum DDL and this story's migration for user DDL.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.3]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR23, onboarding manual marking]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — dual-DB, migrations, naming, transactions]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — OnboardingStep, Flow 1, button hierarchy]
- [Source: `_bmad-output/planning-artifacts/ux-design-directions.html` — Direction F onboarding copy]
- [Source: `_bmad-output/implementation-artifacts/2-2-session-intensity-preference.md` — patterns, redirect, placeholder replacement]
- [Source: `_bmad-output/implementation-artifacts/2-1-welcome-and-jlpt-starting-level-without-sign-up.md` — onboarding architecture, out-of-scope table]
- [Source: `mobile/src/data/curriculum/radicalRepository.ts` — curriculum query pattern]
- [Source: `mobile/src/app/onboarding/calibrate.tsx` — placeholder to replace]
- [Source: `scripts/curriculum-schema.ts` — `items`, `item_relationships` schema]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

### Completion Notes List

- Replaced calibrate placeholder with full onboarding step 3/4: type filter (default Kanji), scrollable FlatList, per-row three-state status picker with radiogroup a11y, immediate persistence.
- Added migration `002_item_study_status` with sparse-row contract (`not_started` deletes row).
- Added `itemStudyStatusRepository` and `itemRepository` (+ optional kanji dependency hints from `item_relationships`).
- Added `bulk.tsx` placeholder; Continue navigates via `router.replace('/onboarding/bulk')`.
- All 84 tests pass; lint and typecheck clean.
- Code review fixes: FlatList `flex-1` for scroll; batched dependency hints via `getRequiredParentLabelsForItems`; status map gate before list render; expanded calibrate/itemRepository tests; bulk placeholder uses `OnboardingStep` step 4/4; removed stray 0-byte `mobile/assets/curriculum.db`.
- Post-review: 89 tests pass; lint and typecheck clean.

### File List

- mobile/__mocks__/expo-sqlite.ts
- mobile/src/app/onboarding/_layout.tsx
- mobile/src/app/onboarding/bulk.tsx
- mobile/src/app/onboarding/calibrate.tsx
- mobile/src/app/onboarding/calibrate.test.tsx
- mobile/src/components/onboarding/CalibrationItemRow.tsx
- mobile/src/components/onboarding/CalibrationItemTypePicker.tsx
- mobile/src/components/onboarding/ItemStudyStatusPicker.tsx
- mobile/src/components/onboarding/ItemStudyStatusPicker.test.tsx
- mobile/src/data/curriculum/itemRepository.ts
- mobile/src/data/curriculum/itemRepository.test.ts
- mobile/src/data/hooks/useCalibrationItems.ts
- mobile/src/data/migrations/002_item_study_status.ts
- mobile/src/data/migrations/index.ts
- mobile/src/data/migrations/migrationRunner.test.ts
- mobile/src/data/user/itemStudyStatusRepository.ts
- mobile/src/data/user/itemStudyStatusRepository.test.ts
- mobile/src/data/user/studyStatus.types.ts
- mobile/src/data/user/studyStatus.types.test.ts
- mobile/src/data/database.test.ts
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Senior Developer Review (AI)

_Reviewer: Riyaz on 2026-06-06_

**Outcome:** Approve (after fixes)

**Findings addressed:**
- FlatList given `flex-1` so the calibration list scrolls inside `OnboardingStep` without pushing Continue off-screen
- Replaced per-row `getRequiredParentLabels` calls with batched `getRequiredParentLabelsForItems` + `useMemo`
- Gated list render on `statusesReady` to avoid per-row DB reads during render
- Capitalized empty-state type labels (`No Kanji at N5 yet.`)
- Expanded `calibrate.test.tsx`: empty state, Not started delete, type filter switch, dependency hints
- Added `getRequiredParentLabelsForItems` test in `itemRepository.test.ts`
- `bulk.tsx` now uses `OnboardingStep` (step 4/4) for onboarding consistency
- Deleted accidental 0-byte `mobile/assets/curriculum.db` (canonical seed remains under `curriculum-seed/`)

## Change Log

- 2026-06-06: Story 2.3 — per-item study status calibration screen, user.db migration 002, repositories, tests.
- 2026-06-06: Code review fixes — scroll, batch hints, test coverage, story status → done (Composer)
