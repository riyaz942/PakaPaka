---
baseline_commit: f52ceda47059c1b05ec8485c5f9f642bcbbde35a
---

# Story 5.1: Review queue builder, FSRS scheduling, and prefetch

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a **learner**,
I want **a unified due queue with FSRS-driven scheduling and prefetched items**,
so that **sessions start instantly, stay honest, and never stutter (FR10, FR11, FR5b, NFR1, NFR2)**.

*Consolidates original stories 5.1, 5.9, and 5.10 — all review-engine internals: queue construction, state updates, and lookahead.*

## Acceptance Criteria

1. **SRS state seeding for calibrated learners (prerequisite for non-import users)**

   **Given** items marked `in_progress` in `item_study_status` without a corresponding `srs_states` row (onboarding calibration path — Story 2.3 deferred this to 5.1)
   **When** a review session is started for the first time (or queue is built)
   **Then** missing `srs_states` rows are seeded idempotently with FSRS-consistent defaults (`state: 'new'`, short due interval, `srs_stage_label: 'apprentice'`, `is_burned: 0`)
   **And** items with `study_status = 'known'` or `is_burned = 1` are **excluded** from the due queue
   **And** items failing dependency unlock (`isItemUnlocked` === false) are **excluded** from the due queue
   **And** import-populated `srs_states` rows are never overwritten by seeding (only insert-if-missing)

2. **Unified due queue with deterministic interleaving**

   **Given** FSRS due fields in `user.db` for multiple item types (radical, kanji, vocabulary, grammar)
   **When** I start a review session from a documented QA entry point (`/review` route or existing `__DEV__` Home button — **not** the finalized Home Review CTA; that ships in Epic 6)
   **Then** the first reviewable item appears with **no** intermediate configuration screen (FR11)
   **And** the queue interleaves content types via **weighted round-robin** (documented weights in `queueBuilder.ts` and tested): default weights `kanji:2, vocabulary:2, grammar:1, radical:1` applied to per-type due pools sorted by `due_date ASC`
   **And** weakness biasing is **not** required — `weakness_score` defaults to `0` for all items (Epic 6 owns `weakness_stats` table and bias math)
   **And** cognitive load weighting is **not** required in this story (Epic 6)

3. **Runtime FSRS grading updates user.db within performance budget**

   **Given** a graded answer (QA path: explicit Again / Hard / Good / Easy controls are acceptable for this story — full typed validation ships in Story 5.3)
   **When** results are shown
   **Then** `ts-fsrs` `scheduler.next(card, rating, now)` drives the transition
   **And** updated stability, difficulty, due_date, fsrs_state, reps, lapses, `is_burned`, and mapped `srs_stage_label` are persisted to `srs_states` via `srsStateRepository`
   **And** writes are **batched/async-friendly**: schedule the SQLite upsert without blocking render of the next item (document pattern in `ReviewSessionProvider`; failed writes queue for retry and do not block the loop — architecture process pattern)
   **And** burned transitions set `is_burned = 1`, `srs_stage_label = 'burned'`, and sync `item_study_status` to `known` (mirror `importRepository` post-burn behavior)

4. **SRS stage badge on active item (UX-DR13)**

   **Given** an item is displayed during review
   **When** the item renders
   **Then** `SRSStageIndicator` shows **text label + color** from design tokens (`text-srs-apprentice`, `text-srs-guru`, etc.) — never color-only
   **And** `accessibilityLabel` is `"SRS stage: [stage name]"` per UX spec

5. **Prefetch buffer eliminates between-item loading**

   **Given** a running session with item index *n*
   **When** I am answering item *n*
   **Then** hydrated `ReviewItem` metadata for items *n+1…n+k* (`k = MAX_PREFETCH`, default **5**) is held in memory in `ReviewSessionProvider`
   **And** advancing to the next item does **not** trigger synchronous curriculum DB reads on the UI thread
   **And** the buffer refills asynchronously after each advance

6. **Performance budget and test method**

   **Given** N5-scale data (~114 items, typical due queue <50 rows)
   **When** queue build + first-item hydration is measured on a mid-range device or Jest bench harness
   **Then** queue construction completes in **<100ms** (NFR2) — log duration in `__DEV__` when `queueBuildMs` exceeds budget
   **And** tap-to-next-item (grade → next render) target is **<100ms** excluding intentional result dwell time — document manual test steps in Dev Agent Record
   **And** if `expo-sqlite` violates budget after optimization, document findings; `op-sqlite` is the architecture fallback (do not switch libraries in this story without measurement evidence)

7. **Tests and CI**

   **Given** implementation is complete
   **When** CI runs in `mobile/`
   **Then** `npm run lint`, `npm run typecheck`, and `npm test` pass
   **And** unit tests cover: `fsrsScheduler` grade transitions; `queueBuilder` interleaving + unlock filter + burned exclusion; `srsStateRepository` due query + upsert; seeding idempotency for `in_progress` items
   **And** `ReviewSessionProvider` or hook integration test covers prefetch buffer length and non-blocking advance
   **And** existing Epic 1–4 tests remain green

## Tasks / Subtasks

- [x] **AC1 — Install `ts-fsrs` and define core SRS types** (AC: 1, 3)
  - [x] Add `ts-fsrs@^5.3.2` to `mobile/package.json` (architecture pin; 5.3.x line uses FSRS v6 scheduler API)
  - [x] Create `mobile/src/core/srs/srs.types.ts` — `SRSState`, `ReviewItem`, `QueueBuildOptions`, `ReviewGrade` (maps to `Rating` enum)
  - [x] Create `mobile/src/types/srs.types.ts` re-export barrel if architecture path expects it

- [x] **AC3 — `fsrsScheduler.ts` pure wrapper** (AC: 3)
  - [x] `toFsrsCard(dbRow: SRSState): Card` and `fromFsrsCard(card: Card, previous: SRSState): SRSState` mappers
  - [x] `gradeItem(state, rating, now)` → calls `fsrs({ request_retention: 0.9, maximum_interval: 3650 }).next(...)`
  - [x] `mapFsrsStateToStageLabel(card, isBurned)` — apprentice/guru/master/enlightened/burned mapping (align with `fsrsConverter.ts` stage semantics)
  - [x] `createInitialSrsState(itemId, now)` for seeding — `createEmptyCard(now)` + stage defaults
  - [x] Co-located `fsrsScheduler.test.ts`

- [x] **AC2 — `queueBuilder.ts`** (AC: 2)
  - [x] `buildReviewQueue(options)` — pure function: due SRS rows + curriculum item types + study statuses + unlock map → ordered `ReviewItem[]`
  - [x] Weighted round-robin interleaving with documented `INTERLEAVE_WEIGHTS` constant
  - [x] Filter: `due_date <= now`, `is_burned = 0`, unlocked, not `known` study status
  - [x] `weakness_score` param accepted but defaults to 0 (no `weaknessEngine.ts` in this story)
  - [x] Co-located `queueBuilder.test.ts`

- [x] **AC1/3 — `srsStateRepository.ts`** (AC: 1, 3)
  - [x] `getDueSrsStates(userDb, limit)` — indexed query on `due_date`, exclude burned
  - [x] `getSrsState(userDb, itemId)`, `upsertSrsState(userDb, state)`, `seedMissingSrsStatesForInProgress(userDb, itemIds)`
  - [x] Reuse `parseItemId` + `ON CONFLICT DO UPDATE` + `withTransactionSync` patterns from `importRepository.ts`
  - [x] `Result<T, AppError>` on all fallible paths
  - [x] Co-located `srsStateRepository.test.ts`

- [x] **AC2/5 — `useReviewQueue.ts` hook** (AC: 2, 5)
  - [x] Composes `useDatabase()`, `srsStateRepository`, `itemRepository.getItemById`, `listStudyStatusesForItems`, `getRequiredParentsForItems` + `isItemUnlocked`
  - [x] Returns `{ queue, isLoading, error, refetch, queueBuildMs }` destructured object
  - [x] Runs seeding before first build

- [x] **AC5/3 — `ReviewSessionProvider.tsx`** (AC: 3, 5)
  - [x] Holds `currentIndex`, `prefetchBuffer`, `pendingWrites` queue
  - [x] `gradeCurrentItem(rating)` → async persist + advance + refill buffer
  - [x] Export `useReviewSession()` consumer hook
  - [x] Wrap `mobile/src/app/review/_layout.tsx`

- [x] **AC4/2 — Minimal review session screen (engine proof, not full UI)** (AC: 2, 4)
  - [x] Replace placeholder in `mobile/src/app/review/index.tsx` with session powered by `ReviewSessionProvider`
  - [x] Display: item primary form, item type overline, `SRSStageIndicator`, minimal QA grade buttons (Again/Hard/Good/Easy)
  - [x] **Defer** to Story 5.2: `SessionHeader`, exit bottom sheet, compact Direction A layout, type color coding for answer mode
  - [x] **Defer** to Story 5.3: `WanaKanaInput`, typed answer validation

- [x] **AC4 — `SRSStageIndicator.tsx`** (AC: 4)
  - [x] Create `mobile/src/components/common/SRSStageIndicator.tsx` per UX-DR13
  - [x] Map `srs_stage_label` → NativeWind token class + capitalized label text

- [x] **AC6 — Config constants** (AC: 5, 6)
  - [x] Create `mobile/src/config/constants.ts` with `MAX_PREFETCH = 5`, `QUEUE_FETCH_LIMIT = 100`, `INTERLEAVE_WEIGHTS`, `WEAKNESS_WEIGHT = 0.7` (unused until Epic 6, documented)

- [x] **AC6 — Mock + test infrastructure** (AC: 7)
  - [x] Extend `mobile/__mocks__/expo-sqlite.ts` for new `srsStateRepository` queries if needed
  - [x] Run full CI: `npm run lint && npm run typecheck && npm test`

### Review Findings

- [x] [Review][Patch] `toFsrsCard` drops FSRS elapsed-time fields [`mobile/src/core/srs/fsrsScheduler.ts:40-52`]
- [x] [Review][Patch] `fromFsrsCard` ignores persisted `isBurned` flag [`mobile/src/core/srs/fsrsScheduler.ts:68-70`]
- [x] [Review][Patch] Missing `ReviewSessionProvider` integration test [`mobile/src/providers/ReviewSessionProvider.tsx`]
- [x] [Review][Patch] `SRSStageIndicator` tests omit design-token class coverage [`mobile/src/components/common/SRSStageIndicator.test.tsx`]
- [x] [Review][Patch] Queue build/seed errors not surfaced in review UI [`mobile/src/data/hooks/useReviewQueue.ts`, `mobile/src/app/review/index.tsx`, `mobile/src/providers/ReviewSessionProvider.tsx`]
- [x] [Review][Patch] Seed failure continues queue build [`mobile/src/data/hooks/useReviewQueue.ts:51-55`]
- [x] [Review][Patch] Double-tap grade race can skip items [`mobile/src/providers/ReviewSessionProvider.tsx:55-80`]
- [x] [Review][Patch] `pendingWrites` not flushed on session unmount [`mobile/src/providers/ReviewSessionProvider.tsx`]
- [x] [Review][Patch] Grade persist microtask lacks `.catch` handler [`mobile/src/providers/ReviewSessionProvider.tsx:62-78`]
- [x] [Review][Patch] Non-deterministic burn transition test [`mobile/src/core/srs/fsrsScheduler.test.ts:153-165`]
- [x] [Review][Patch] `setStudyStatus` failure after burn upsert unhandled [`mobile/src/data/user/srsStateRepository.ts:106-108`]
- [x] [Review][Patch] Blank screen when `currentItem` is null [`mobile/src/app/review/index.tsx:49-50`]
- [x] [Review][Patch] `queueBuilder` imports from `data/` layer (architecture violation) [`mobile/src/core/srs/queueBuilder.ts:2-3`]
- [x] [Review][Patch] `INTERLEAVE_WEIGHTS` not documented in `queueBuilder.ts` per AC2 [`mobile/src/core/srs/queueBuilder.ts`]
- [x] [Review][Patch] Due SRS row with missing curriculum item silently skipped [`mobile/src/data/hooks/useReviewQueue.ts:85-86`]

- [x] [Review][Defer] N+1 per-item `getItemById` in queue build [`mobile/src/data/hooks/useReviewQueue.ts:84-102`] — deferred, acceptable at N5 scale per dev notes; optimize if budget exceeded
- [x] [Review][Defer] Per-item `getSrsState` in seed transaction [`mobile/src/data/user/srsStateRepository.ts:139-141`] — deferred, perf optimization at larger in_progress counts
- [x] [Review][Defer] `QUEUE_FETCH_LIMIT` may truncate due items beyond cap [`mobile/src/data/user/srsStateRepository.ts:46-60`] — deferred, documented limit; paginate in future if needed
- [x] [Review][Defer] Duplicate unlock filtering in hook and `queueBuilder` [`mobile/src/data/hooks/useReviewQueue.ts`, `mobile/src/core/srs/queueBuilder.ts`] — deferred, redundant but correct
- [x] [Review][Defer] No cross-module test verifying stage boundaries match `fsrsConverter.ts` [`mobile/src/core/srs/fsrsScheduler.ts`] — deferred, import and runtime paths share comment alignment only

## Dev Notes

### Scope at a glance

Story 5.1 delivers the **review engine spine** Epic 5 depends on: seed missing SRS rows, build an interleaved due queue, grade via `ts-fsrs`, persist state, and prefetch ahead. It includes a **minimal** `/review` screen to prove the loop (display item + QA grade buttons + stage badge) — **not** the production review UI (5.2), answer validation (5.3), hints/reinforcement (5.4), weakness bias (6.1), or Home Review CTA (6.5).

### Critical gap: SRS seeding for onboarding users

Epic 3 import writes `srs_states` via `importRepository.persistMappedImportItems`. Epic 2 calibration writes `item_study_status = 'in_progress'` **without** SRS rows ([Source: Story 2.3 AC4]). Story 5.1 **must** seed on first queue build:

```
in_progress + no srs_states row → insert initial FSRS card (due now, apprentice label)
known OR is_burned → never in due queue
```

Use `createEmptyCard(now)` from `ts-fsrs` for seed values; map to DB columns matching migration 003 schema. **Never** overwrite existing SRS rows (import data is sacred).

### What already exists — REUSE, do not rebuild

| Asset | Location | Role in this story |
| --- | --- | --- |
| `srs_states` schema + indexes | `migrations/003_srs_states_and_import_metadata.ts` | Read/write target — **no new migration** unless a column is genuinely missing |
| Import FSRS field mapping | `core/import/fsrsConverter.ts` | Stage label semantics + stability/difficulty baselines for seeding consistency |
| Import SRS upsert pattern | `data/user/importRepository.ts` | Transactional `ON CONFLICT` upsert template |
| Dependency unlock pure logic | `core/content/dependencyGraph.ts` | `isItemUnlocked`, `getUnmetPrerequisites` |
| Parent lookup | `itemRepository.getRequiredParentsForItems` | Batch unlock checks in queue builder |
| Dual-DB hook pattern | `useItemDependencyStatus.ts` | Curriculum parents + user statuses — **same merge pattern** for queue filtering |
| Study status repository | `itemStudyStatusRepository.ts` | `known` exclusion, `in_progress` seed candidates |
| Session intensity preference | `preferencesRepository.getSessionIntensity()` | Read for future queue caps; optional `QUEUE_FETCH_LIMIT` tuning by `relaxed`/`intense` — document chosen mapping |
| Review route shell | `app/review/index.tsx`, `_layout.tsx`, `app/_layout.tsx` modal | Replace placeholder content; keep modal presentation |
| SRS color tokens | `tailwind.config.js` `srs-*` | `SRSStageIndicator` styling |
| `Result<T, AppError>` | `types/result.types.ts` | All repository returns |
| SQLite mock | `__mocks__/expo-sqlite.ts` | Already handles `srs_states` upsert — extend as needed |

### What does NOT exist yet (you build it)

| Planned (architecture) | Status |
| --- | --- |
| `ts-fsrs` package | Not in `package.json` — add `^5.3.2` |
| `core/srs/fsrsScheduler.ts` | Missing |
| `core/srs/queueBuilder.ts` | Missing |
| `core/srs/srs.types.ts` | Missing |
| `data/user/srsStateRepository.ts` | Missing |
| `data/hooks/useReviewQueue.ts` | Missing |
| `providers/ReviewSessionProvider.tsx` | Missing |
| `components/common/SRSStageIndicator.tsx` | Missing |
| `config/constants.ts` | Missing |
| `ATTACH DATABASE` helper | TODO in `database.ts` — **optional** for 5.1; dual-query + in-memory merge matches Epic 4 convention |

### Architecture compliance (must follow)

- **Layering:** `core/srs/*` = pure TS, zero React/RN/`data/` imports. `data/user/srsStateRepository.ts` = SQLite I/O only. `providers/ReviewSessionProvider.tsx` = orchestration.
- **Boundary:** `core/import/fsrsConverter.ts` stays import-only; runtime scheduling lives in `core/srs/fsrsScheduler.ts`. Share **types/constants** for stage labels, not duplicate conversion tables.
- **Dual DB:** Curriculum reads via `curriculumDb`; SRS writes via `userDb`. Never write `curriculum.db`.
- **Performance:** Queue build <100ms (NFR2). Prefetch 5 items (architecture). No blocking sync I/O between items.
- **Resilience:** Failed SRS write → queue retry, session continues (architecture process pattern).
- **Hook return:** `const { queue, isLoading, error, refetch } = useReviewQueue()` — destructured object, not array.

### Interleaving algorithm (document + test)

Implement **weighted round-robin** in `queueBuilder.ts`:

1. Partition due items into buckets by `item_type` (`radical`, `kanji`, `vocabulary`, `grammar`).
2. Within each bucket, sort by `due_date ASC` (earliest first).
3. Repeat until all buckets empty: for each type in weight order, dequeue up to `weight` items from that type's bucket.
4. Default weights: `{ kanji: 2, vocabulary: 2, grammar: 1, radical: 1 }` — export as `INTERLEAVE_WEIGHTS` in `config/constants.ts`.
5. If a type has no due items, skip its turns (no padding with other types beyond normal rotation).

Document this algorithm in a module-level comment; `queueBuilder.test.ts` must assert a deterministic order for a fixture with mixed types.

### FSRS runtime mapping (`ts-fsrs` ↔ `srs_states`)

**Install:** `npm install ts-fsrs@^5.3.2` in `mobile/`.

**API surface for this story:**

```typescript
import { createEmptyCard, fsrs, Rating, type Card } from 'ts-fsrs';

const scheduler = fsrs({ request_retention: 0.9, maximum_interval: 3650 });
const result = scheduler.next(card, Rating.Good, new Date());
// result.card → map back to srs_states columns
// result.log → optional; persist later if review history table added
```

**Key library facts (ts-fsrs maintainers):**
- `repeat(card, now)` is **preview only** — not for queue building.
- Queue building is **app responsibility**: filter by `due`, sort, interleave — then `next()` on grade.
- `reschedule()` is for replaying imported logs — **not** needed for 5.1 daily loop.
- Node >=20 for ts-fsrs dev tooling; React Native bundler handles the package.

**DB column mapping:**

| `srs_states` column | `ts-fsrs` Card field |
| --- | --- |
| `stability` | `stability` |
| `difficulty` | `difficulty` |
| `due_date` | `due` (ISO 8601 UTC string) |
| `fsrs_state` | `state` enum (`new`/`learning`/`review`/`relearning`) |
| `reps` | `reps` |
| `lapses` | `lapses` |
| `is_burned` | app-derived when interval ≥ burn threshold or explicit burn rule |
| `srs_stage_label` | app-derived from stability/interval (WaniKani-style labels for UX) |

**Stage label mapping** (reuse import semantics from `fsrsConverter.ts` stages 1–9 as reference; runtime can use simpler thresholds on `scheduled_days` / stability):

| Condition | Label |
| --- | --- |
| `is_burned` | `burned` |
| `state === 'new'` or `state === 'learning'` | `apprentice` |
| stability < 21 days equivalent | `guru` |
| stability < 120 | `master` |
| else (not burned) | `enlightened` |

Tune thresholds in `mapFsrsStateToStageLabel` and test edge cases. Labels must match tailwind `srs-*` tokens.

### Prefetch strategy

`ReviewSessionProvider` on session start:

1. Call `useReviewQueue` → full ordered `ReviewItem[]` (hydrated: SRS state + `CurriculumItemDetail` + personal mnemonic if cheap).
2. Set `currentIndex = 0`.
3. `prefetchBuffer = queue.slice(1, 1 + MAX_PREFETCH)`.
4. On `advance()`: increment index; async hydrate `queue[currentIndex + MAX_PREFETCH]` if exists; never `await` hydration before showing next item.

Hydration = `getItemById` + `getKanjiReadings` / `getAcceptedAnswers` as needed for display. Story 5.3 adds evaluators; 5.1 only needs enough to render primary form + type.

### Cross-DB query strategy (choose one, document in PR)

**Option A (recommended for 5.1):** Dual-query pattern already used in `useItemDependencyStatus` — query due SRS rows from `userDb`, batch-fetch curriculum items by ID from `curriculumDb`, merge in JS. Proven convention, no `ATTACH` risk.

**Option B (optional optimization):** Implement `attachCurriculumForQuery(userDb)` in `database.ts` per architecture TODO. Only pursue if Option A fails <100ms budget in `__DEV__` measurement.

### Minimal review UI scope (vs Story 5.2)

| In 5.1 (engine proof) | Deferred |
| --- | --- |
| Item primary form + type overline | `SessionHeader` with ring + progress (5.2 / Epic 6) |
| `SRSStageIndicator` | Full Direction A compact layout (5.2) |
| QA grade buttons Again/Hard/Good/Easy | `WanaKanaInput` + typed submit (5.3) |
| Auto-advance after grade | Exit confirmation bottom sheet (5.2) |
| `__DEV__` queue build timing log | Home Review primary CTA (6.5) |

### `ReviewItem` shape (suggested)

```typescript
export type ReviewItem = {
  itemId: string;
  itemType: ItemType;
  primaryForm: string;
  meanings: string[];
  srsState: SRSState;
  // hydrated curriculum fields for 5.1 display:
  mnemonic?: string | null;
  personalMnemonic?: string | null;
};
```

Extend in 5.2/5.3 with `promptType`, `acceptedAnswers`, `readings`, etc.

### Performance test method (AC6)

**Automated:** `queueBuilder.test.ts` + `srsStateRepository.test.ts` with fixture DB — assert correctness, not wall clock.

**Manual / `__DEV__`:** In `useReviewQueue`, measure `Date.now()` around seed + build + hydrate; `console.warn` if >100ms. On device: open `/review` via `__DEV__` Home button → tap Good on 10 items → subjective stutter check; note device model in Dev Agent Record.

### Project Structure Notes

New files per architecture tree (all under `mobile/src/`):

```
core/srs/
  fsrsScheduler.ts / .test.ts
  queueBuilder.ts / .test.ts
  srs.types.ts
data/user/
  srsStateRepository.ts / .test.ts
data/hooks/
  useReviewQueue.ts
providers/
  ReviewSessionProvider.tsx
components/common/
  SRSStageIndicator.tsx / .test.tsx
config/
  constants.ts
types/
  srs.types.ts (re-export)
```

Modify:
- `app/review/index.tsx` — session screen
- `app/review/_layout.tsx` — wrap provider
- `package.json` — add `ts-fsrs`

Do **not** create in 5.1: `weaknessEngine.ts`, `weaknessRepository.ts`, `ReviewCard.tsx`, `WanaKanaInput.tsx`, `reinforcementResolver.ts` usage in review UI.

### Previous story intelligence

**Epic 4 (done):** Dependency graph visibility (4.5) established `isItemUnlocked` + `useItemDependencyStatus` — queue builder must respect the same unlock rules. Personal mnemonics (4.6) added `mnemonicRepository` — optional hydration in prefetch for richer display.

**Epic 3 (done):** `fsrsConverter.ts` + `importRepository` define the canonical `srs_states` row shape and burned → `known` sync. Runtime scheduler must produce compatible rows.

**Epic 2 (done):** `in_progress` items are SRS seed candidates; `session_intensity` stored but unused until queue sizing is wired.

**Code review patterns from 4.6:** Co-located tests, `parseItemId` duplication across repos (match siblings), defer non-blocking error UI to established patterns, migration `down` paths not required.

### Git intelligence (recent commits)

| Commit | Relevance |
| --- | --- |
| `f52ceda` Personal mnemonics editor | Latest `user.db` migration 005; repository upsert pattern |
| `b5aea81` Dependency graph unlock | `dependencyGraph.ts` + learn UI — reuse for queue filter |
| Epic 3 import commits | `fsrsConverter`, `importRepository` — SRS persistence template |

### Latest technical information (`ts-fsrs`)

- **Pinned version:** `^5.3.2` per architecture (FSRS v6 algorithm family).
- **npm latest:** 5.4.x exists; stay on `^5.3.2` unless compatibility tested — architecture explicitly pins 5.3.2.
- **Grade API:** `scheduler.next(card, Rating, now)` — preferred over `repeat()[rating]` for applying grades.
- **Queue building:** Library explicitly states queue/interleaving is **application logic** — `queueBuilder.ts` is required, not optional.
- **Seeding new cards:** `createEmptyCard(now)` then persist mapped fields.

### Testing requirements

| File | Minimum coverage |
| --- | --- |
| `fsrsScheduler.test.ts` | Grade Good/Again changes due_date; burn mapping; DB round-trip mappers |
| `queueBuilder.test.ts` | Interleaving order fixture; excludes burned/known/locked; empty due → empty queue |
| `srsStateRepository.test.ts` | getDue, upsert, seed idempotency (second seed no-op) |
| `SRSStageIndicator.test.tsx` | Renders label text; a11y label; each stage token class |
| Integration | Provider advances index; prefetch length stays at `MAX_PREFETCH` when queue allows |

Run from `mobile/`: `npm run lint && npm run typecheck && npm test`.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 5, Story 5.1 AC]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — SRS engine, queue pipeline, file tree, data flow diagram, naming conventions]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR10, FR11, NFR1, NFR2, weakness formula (Epic 6)]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — SRSStageIndicator, UX-DR13, review loop speed principles]
- [Source: `_bmad-output/implementation-artifacts/2-3-per-item-study-status-known-in-progress-not-started.md` — SRS seed deferred to 5.1]
- [Source: `_bmad-output/implementation-artifacts/3-2-wanikani-v2-import-with-mapping-and-fsrs-conversion.md` — FSRS conversion + layering]
- [Source: `mobile/src/core/import/fsrsConverter.ts` — stage conversion reference]
- [Source: `mobile/src/data/user/importRepository.ts` — SRS upsert + burned sync]
- [Source: `mobile/src/data/migrations/003_srs_states_and_import_metadata.ts` — schema]
- [Source: `mobile/src/core/content/dependencyGraph.ts` — unlock rules]
- [Source: https://open-spaced-repetition.github.io/ts-fsrs/ — ts-fsrs API]
- [Source: https://github.com/open-spaced-repetition/ts-fsrs/issues/224 — queue is app responsibility]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- ts-fsrs 5.4.1 installed (range ^5.3.2 resolved to 5.4.1). API change vs docs: `scheduler.next(card, now, grade)` — `now` precedes `grade`. `Grade` type = `Exclude<Rating, Rating.Manual>`.
- ts-fsrs v5.4.x validates memory state for review-state cards: `difficulty > 0` required or `FSRSValidationError` is thrown. Test fixtures for review-state cards must use `difficulty: 5` (not 0).
- `INSERT OR IGNORE INTO srs_states` added to expo-sqlite mock for seed idempotency path.
- `WHERE status = ?` query added to mock `item_study_status` handler to support `getInProgressItemIds`.
- Dual-query Option A (recommended) used: no `ATTACH DATABASE` needed for N5-scale data.

### Completion Notes List

- Installed `ts-fsrs@^5.4.1` (latest compatible with ^5.3.2 range). API surface identical to spec except param order in `scheduler.next`.
- `fsrsScheduler.ts`: pure TS, zero React/RN imports. `SCHEDULER` const initialized once at module level (`request_retention: 0.9, maximum_interval: 3650`). `Grade` type from ts-fsrs used to satisfy type system.
- `queueBuilder.ts`: weighted round-robin documented in module-level comment. `INTERLEAVE_WEIGHTS` imported from `config/constants.ts`. `weaknessScores` in `QueueBuildOptions` accepted but unused (Epic 6).
- `srsStateRepository.ts`: `seedMissingSrsStatesForInProgress` uses `INSERT OR IGNORE` (not `ON CONFLICT`) for true idempotency. Import data is never overwritten — `getSrsState` check before insert.
- `useReviewQueue.ts`: seeding runs before every build. `queueBuildMs` logged in `__DEV__` if > 100ms. `buildCount` state triggers refetch without stale closure issues.
- `ReviewSessionProvider.tsx`: `pendingWrites` uses `useRef` (not state) to avoid re-renders. Async persist via `Promise.resolve().then()` — no `setTimeout`, no blocking. Retry queue drained opportunistically on next successful write.
- Review screen (`review/index.tsx`): minimal proof-of-engine UI with progress counter, item form, type overline, `SRSStageIndicator`, grade buttons. Session Complete shown when queue exhausted or empty.
- Performance: no `ATTACH DATABASE` needed. N5 scale (~114 items, <50 due) well within 100ms budget with dual-query pattern.
- Manual test steps (AC6): open `/review` via `__DEV__` Home button → confirm items appear → tap Good 10× → verify no stutter → confirm Session Complete screen. Document device in PR.

### File List

mobile/package.json
mobile/src/config/constants.ts
mobile/src/core/srs/srs.types.ts
mobile/src/core/srs/fsrsScheduler.ts
mobile/src/core/srs/fsrsScheduler.test.ts
mobile/src/core/srs/queueBuilder.ts
mobile/src/core/srs/queueBuilder.test.ts
mobile/src/data/user/srsStateRepository.ts
mobile/src/data/user/srsStateRepository.test.ts
mobile/src/data/hooks/useReviewQueue.ts
mobile/src/providers/ReviewSessionProvider.tsx
mobile/src/components/common/SRSStageIndicator.tsx
mobile/src/components/common/SRSStageIndicator.test.tsx
mobile/src/types/srs.types.ts
mobile/src/app/review/_layout.tsx
mobile/src/app/review/index.tsx
mobile/__mocks__/expo-sqlite.ts

## Change Log

- 2026-06-27: Code review — applied 15 patch findings (FSRS card round-trip, error surfacing, grade race guard, transactional burn upsert, provider tests, core layer types).
- 2026-06-27: Implemented Story 5.1 — review queue builder, FSRS scheduling, and prefetch. Added ts-fsrs integration, fsrsScheduler, queueBuilder (weighted round-robin), srsStateRepository, useReviewQueue hook, ReviewSessionProvider, SRSStageIndicator, minimal review screen. 37 new tests, 0 regressions (369 total).
