---
baseline_commit: 4df1297192590263e5d3591867331accff9417fd
---

# Story 6.2: Stats tab with weakness trends and SRS stage breakdown

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> This story is the **rendering** half of the weakness pipeline. Story 6.1 already built the **data + logic** layer (the `weakness_stats` table, the pure `weaknessEngine`, the `weaknessRepository`, the `useWeaknessStats` hook, and the `ConfusionCluster` objects with their learner-facing copy strings). **Do not rebuild any of that.** This story replaces the Stats tab placeholder with a real screen that renders (a) an SRS stage breakdown and (b) weakness/confusion cards, plus the first-launch empty state. It adds the one reserved hook/repo function the SRS breakdown needs and the UX-named components — nothing more.

## Story

As a **learner**,
I want **the Stats tab to show weakness cards and SRS stage counts**,
so that **I see proof of progress (FR28, FR32, UX-DR14, UX-DR13)**.

## Context: this is a read-only UI screen over data that already exists

- `mobile/src/app/(tabs)/stats.tsx` is currently `<TabPlaceholderScreen title="Stats" />`. This story replaces it.
- The data is **already produced** by Story 6.1:
  - `useWeaknessStats()` (`mobile/src/data/hooks/useWeaknessStats.ts`) already returns `{ stats, clusters, isLoading, error, refetch }` — `clusters: ConfusionCluster[]` is the rendered weakness data; it already runs `detectConfusionClusters(...)` over `getAllWeaknessStats(...)`. **It needs no changes** beyond possibly being re-fetched on screen focus.
  - SRS stage labels are already computed and persisted per item: `srs_states.srs_stage_label ∈ { apprentice, guru, master, enlightened, burned }` (`mapFsrsStateToStageLabel` in `core/srs/fsrsScheduler.ts`). The only missing piece is a **count-by-stage** read, which this story adds.
- The existing `SRSStageIndicator` component (`components/common/SRSStageIndicator.tsx`) already renders a stage's name in its semantic color with the correct `accessibilityLabel`. Reuse it for stage labels; do not duplicate the label/color mapping.

This screen is **not** on the `<100ms` review answer path. Synchronous `getAllSync` reads in the hooks are fine here — that is already how `useWeaknessStats` works.

## Acceptance Criteria

1. **(FR32 / UX-DR14 — weakness cards)** Given the learner has opened the Stats tab after some reviews, when confusion clusters exist (above 6.1's `CLUSTER_MIN_SAMPLE` + `CLUSTER_ACCURACY_THRESHOLD`), then a list of `WeaknessStatCard`s renders — one per `ConfusionCluster` — each showing the cluster's pattern label, its learner-facing `copy` sentence, its current accuracy as a percentage, and its sample size. The cards are driven by `useWeaknessStats().clusters`; no weakness math is re-implemented in the component.
2. **(FR28 / UX-DR13 — SRS stage breakdown)** Given the Stats tab, when it loads, then an SRS stage breakdown shows a count for **each** of the five stages (Apprentice, Guru, Master, Enlightened, Burned) computed from **all** `srs_states` rows (burned items **included** — this is an inventory view, unlike the review queue which excludes burned). Each stage's count uses its semantic SRS color **and** a text label (never color-only).
3. **(UX-DR19 — SRS buckets belong on Stats, not Home)** Given the architecture's information hierarchy, the SRS stage counts render **only** on the Stats tab. This story does **not** add stage counts to Home and does **not** modify any Home/other-tab screen.
4. **(UX-DR27 — empty state)** Given a first-launch learner with no SRS states and no weakness stats, when they open the Stats tab, then the empty state pattern renders: an illustration/icon, the explanation copy "Complete your first session to see stats here.", and never a blank screen. When SRS states exist but **no** confusion clusters have surfaced (the normal case with sparse data — see 6.1), the weakness section shows its own non-blank encouraging sub-state while the SRS breakdown still renders.
5. **(Accessibility — UX-DR13 / §667 / §999)** Given a screen reader, each SRS stage count is announced with its stage name and count (e.g. "Apprentice: 12 items"), and each `WeaknessStatCard` announces its pattern name and current accuracy. SRS stages never rely on color alone.
6. **(Freshness)** Given the learner finishes a review session and returns to the Stats tab, when the tab regains focus, then both the SRS breakdown and the weakness stats re-read from `user.db` (via `refetch` on focus) so newly recorded outcomes are reflected without an app restart.
7. **(Layering / architecture)** Given the three-layer rule, the SRS-stage count query lives in `data/user/srsStateRepository.ts`; the hook `data/hooks/useSRSBreakdown.ts` (reserved architecture path) wires it for the UI; the screen and the new presentational components contain **no** SQL and **no** weakness/stage math. Loading and error states are handled in the screen, matching the existing tab-screen pattern.

## Tasks / Subtasks

- [x] **Task 1 — SRS stage count read (AC: #2, #7)**
  - [x] Add `getSrsStageCounts(userDb: SQLiteDatabase): Record<SRSStageLabel, number>` to `mobile/src/data/user/srsStateRepository.ts`. Implement as a single `SELECT srs_stage_label, COUNT(*) AS count FROM srs_states GROUP BY srs_stage_label` (burned **included** — do **not** filter `is_burned`). Initialize the returned record with all five stages at `0` so every stage is always present, then fold in the rows. Use `getAllSync` (mirror the existing read style in this file).
  - [x] Add `getSrsStageCounts` cases to the `expo-sqlite` mock if the existing mock does not already satisfy a `GROUP BY` over `srs_states` (check `mobile/__mocks__/expo-sqlite.ts` first; extend minimally only if needed).
  - [x] Extend `srsStateRepository.test.ts`: empty DB → all five stages `0`; mixed rows → correct per-stage counts; burned rows are counted (not excluded).
- [x] **Task 2 — `useSRSBreakdown` hook (AC: #2, #6, #7)**
  - [x] Create `mobile/src/data/hooks/useSRSBreakdown.ts` at the reserved architecture path (architecture.md §823 "SRS stage counts for Stats tab"). Mirror the shape/structure of `useWeaknessStats.ts`: `const { userDb } = useDatabase();` then a `useEffect`/`useState` that calls `getSrsStageCounts(userDb)`, exposing `{ counts: Record<SRSStageLabel, number>; total: number; isLoading: boolean; error: AppError | null; refetch: () => void }`. Wrap the read in try/catch and surface an `AppError` (code e.g. `'srs_breakdown_load_failed'`) — never throw out of the hook.
  - [x] Co-locate `useSRSBreakdown.test.ts` (loading→loaded transition; counts surfaced; error path sets `error` and clears loading).
- [x] **Task 3 — `WeaknessStatCard` component (AC: #1, #5)**
  - [x] Create `mobile/src/components/stats/WeaknessStatCard.tsx` (UX-named component, §367/§1001). Props: `cluster: ConfusionCluster`. Render: the `cluster.copy` sentence as the headline, `cluster.label` as a secondary pattern name, accuracy as `Math.round(cluster.accuracy * 100)%`, and sample size (e.g. "23 attempts"). Use NativeWind semantic tokens only (`bg-surface`, `text-primary`, `text-secondary`, `border-border`, `rounded-radius-md`, `feedback-*` for the accuracy emphasis). **Read the "Trend data — the reality" Dev Note before adding any trend line.**
  - [x] Accessibility: set `accessibilityLabel` announcing pattern name + current accuracy (e.g. `"${cluster.label}: ${pct}% accuracy"`). Do not encode meaning in color alone.
  - [x] Co-locate `WeaknessStatCard.test.tsx`: renders copy/label/accuracy %/sample size from a fixture cluster; accessibility label present.
- [x] **Task 4 — `SrsStageBreakdown` component (AC: #2, #5)**
  - [x] Create `mobile/src/components/stats/SrsStageBreakdown.tsx`. Props: `counts: Record<SRSStageLabel, number>`. Render the five stages **in canonical order** (apprentice → guru → master → enlightened → burned), each as a row/tile with the count and the stage name. Reuse `SRSStageIndicator` for the colored stage label (or apply the same `bg-srs-*`/`text-srs-*` semantic tokens) so color + text are always paired.
  - [x] Accessibility: each stage entry has an `accessibilityLabel` like `"Apprentice: 12 items"`.
  - [x] Co-locate `SrsStageBreakdown.test.tsx`: all five stages render even when some counts are 0; counts displayed correctly; canonical order preserved.
- [x] **Task 5 — Stats empty state (AC: #4)**
  - [x] Create `mobile/src/components/stats/StatsEmptyState.tsx` following the UX empty-state rule (illustration/icon + explanation + next action/timeline; never blank — §1159, "Rules"). Copy: "Complete your first session to see stats here." Use an icon/emoji or simple illustration consistent with how other screens handle empty/placeholder visuals (no new asset pipeline). Keep it presentational (no data access).
  - [x] Reuse this (or a small inline sub-state) for the "stats exist but no clusters yet" weakness sub-state so that section is never blank.
- [x] **Task 6 — Stats screen composition (AC: #1, #2, #3, #4, #6, #7)**
  - [x] Replace `mobile/src/app/(tabs)/stats.tsx` with a real screen. Use the existing tab-screen layout pattern from `app/(tabs)/learn/index.tsx`: `View bg-background` → `SafeAreaView` with `alignSelf: 'center'`, `maxWidth: MaxContentWidth`, `paddingBottom: BottomTabInset`, `width: '100%'`, `px-space-lg pt-space-md`, a `Text className="text-title text-primary"` heading ("Stats"), and a `ScrollView` for content.
  - [x] Consume `useWeaknessStats()` and `useSRSBreakdown()`. While either is loading show an `ActivityIndicator` (accessibilityLabel "Loading stats") matching the learn screen. On error show a minimal inline error message (reuse `Banner` from `components/common` if it fits) — do not crash.
  - [x] Full-screen empty state (AC4): when `srsBreakdown.total === 0` **and** `weakness.stats.length === 0`, render `StatsEmptyState` and nothing else.
  - [x] Otherwise render the `SrsStageBreakdown` section (always, when any SRS states exist) and the weakness section: map `weakness.clusters` → `WeaknessStatCard`s; when `clusters` is empty, render the encouraging weakness sub-state (Task 5) instead of an empty list.
  - [x] Freshness (AC6): call both `refetch` functions on focus via `useFocusEffect(useCallback(() => { weakness.refetch(); srsBreakdown.refetch(); }, [...]))` from `expo-router` (or `@react-navigation/native`). Guard against refetch identity churn.
  - [x] **Do not** modify Home or any other tab (AC3).
- [x] **Task 7 — Verification**
  - [x] `npm run typecheck` (zero errors), `npm run lint`, `npm test` all green from `mobile/`.
  - [x] Manually confirm the Stats tab renders the breakdown + (with synthetic data) a weakness card, and shows the empty state on a fresh install. Confirm no Home/other-tab regressions.

## Dev Notes

### Out of scope (do NOT build here — later Epic 6 stories / future work own these)

| Deferred | Owner |
| --- | --- |
| Cognitive load ring / "enough for today" | Story 6.3 (`CognitiveLoadRing` already stubbed under `components/engagement/`) |
| Streaks / `StreakCounter` / notifications | Story 6.4 |
| Post-session summary, `TimeCompressionSummary`, Home composition (incl. any Home-side progress) | Story 6.5 |
| Per-session **time-series** weakness history / multi-point sparkline / "45% → 72% over 2 weeks" | **No existing owner — see "Trend data — the reality" below. Do NOT fake it here.** |

### Trend data — the reality (READ THIS — primary risk)

The epic AC and UX spec use aspirational language: FR32 says *"track improvement over time (e.g. 'te-form accuracy: 45% → 72% over 2 weeks')"*; the `WeaknessStatCard` UX anatomy (§1003) lists a *"mini trend line (last 7 sessions)"* and an *"improvement indicator (improving/declining/stable)"*. **The data to support a real multi-point trend does not exist.**

- The `weakness_stats` table (migration 007) stores only **lifetime aggregate** counters per item: `correct_count`, `incorrect_count`, `typo_count`, `last_error_at`, `last_error_type`, `pattern_tags`. There is **no per-session or dated history** — no time series to plot.
- `ConfusionCluster` (the object this screen renders) exposes a single **current snapshot**: `accuracy` and `sampleSize`. It is not a series.

Therefore:
- **Render honest current-state data only:** pattern label, the `copy` sentence, current accuracy %, and sample size. This fully satisfies AC1 (FR32 "see which patterns are weakest") and UX-DR14.
- **Do NOT fabricate** a 7-point sparkline or a "45% → 72%" delta from data you do not have. Inventing trend points is worse than omitting them. If you include any "improvement indicator," it must be derivable from real data (e.g. omit it, or show a neutral/"new" state) — never a random or hard-coded trend.
- A true trend line requires a new dated history table (e.g. per-session or daily snapshots of pattern accuracy), which is **out of scope here** and has no current owner. Note it in Completion Notes as follow-on work so it is captured for a future story. This mirrors exactly how Story 6.1 handled the "pattern tags don't exist in curriculum" reality — scope to what the data honestly supports and document the gap loudly.

### Architecture compliance (must follow)

- **Three-layer purity:** SQL lives only in `data/user/srsStateRepository.ts`. The hook `data/hooks/useSRSBreakdown.ts` wires DB → UI. The screen and `components/stats/*` are presentational: no `expo-sqlite` imports, no stage/weakness math. [Source: architecture.md §289–290 core/data/hook layering; §279 "Custom hooks … encapsulate SQLite queries".]
- **Reserved paths — use these exact names:** screen `src/app/(tabs)/stats.tsx` ("SRS stage breakdown, weakness trends, session history", §698); hooks `data/hooks/useWeaknessStats.ts` (exists, §821) and `data/hooks/useSRSBreakdown.ts` ("SRS stage counts for Stats tab", §823). [Source: architecture.md §698, §821, §823.]
- **UX component names:** `WeaknessStatCard` (§367, §1001) and `SRSStageIndicator` (§993, exists). Group the new presentational components under `components/stats/` (new dir, parallel to `components/learn/`, `components/engagement/`). [Source: ux-design-specification.md §367, §993–1005.]
- **Naming:** functions `camelCase` (`getSrsStageCounts`, `useSRSBreakdown`); types `PascalCase` no `I`-prefix; `type` over `interface`; prefer `T | null` for SQLite reads. [Source: architecture.md §390–414.]
- **Error handling:** the hook surfaces an `AppError` in state and never throws across the boundary (match `useWeaknessStats`). The new repo read is a non-fallible synchronous getter consistent with `getDueSrsStates`/`getSrsStatesForItems` (those return plain values, not `Result`) — follow that precedent; `Result<T, AppError>` is for **writes**, reads in this file return values directly. [Source: `srsStateRepository.ts` existing read signatures; architecture.md §495.]
- **Styling:** NativeWind semantic tokens only — `bg-background`, `bg-surface`, `text-primary`, `text-secondary`, `border-border`, `rounded-radius-md`, spacing `space-*`, and SRS tokens `srs-apprentice|guru|master|enlightened|burned` (defined in `tailwind.config.js` as both text and bg colors). No raw hex, no legacy `Colors`. [Source: CLAUDE.md Styling; tailwind.config.js §22–26.]

### SRS stage breakdown — counting reality

- Stage labels are precomputed and stored on every row as `srs_states.srs_stage_label`; you do **not** recompute them. The five values are exactly `apprentice | guru | master | enlightened | burned` (`SRSStageLabel` in `core/srs/srs.types.ts`).
- The breakdown is an **inventory** view → include **burned** items (the review queue's `getDueSrsStates` excludes burned because they are done; the Stats inventory must show them). A simple `GROUP BY srs_stage_label` over the whole table is correct.
- Scope is **global** (all items the learner has an SRS state for) for v1 — no per-JLPT-level filtering. UX-DR19's Home reference and the Stats mockup show a flat five-bucket count, not a level selector. A level filter is possible future polish; do not add it now.
- Always return all five stages (zero-filled) so `SrsStageBreakdown` renders a stable five-row layout even early on.

### Empty / sub-states — never blank (UX-DR27)

- **Two distinct emptiness conditions:**
  1. **First-launch (whole screen):** `srsBreakdown.total === 0 && weakness.stats.length === 0` → render only `StatsEmptyState` ("Complete your first session to see stats here." + icon). [Source: ux §1159 "First launch, no data → Stats tab".]
  2. **Has reviews but no clusters (normal, expected):** SRS breakdown renders; the weakness section shows its own encouraging sub-state (e.g. "No weak patterns detected yet — keep reviewing."). With the current sparse N5 seed and 6.1's thresholds, **expect zero clusters in normal testing — that is correct, not a bug** (6.1 Dev Note). Test card rendering with synthetic cluster fixtures, not the seed.
- Every empty state must include illustration/icon + explanation (+ next action/timeline where natural) — never a blank screen. [Source: ux §1159 "Rules".]

### Freshness on focus (AC6)

`useWeaknessStats` and `useSRSBreakdown` read once on mount. When the learner returns from a review session the tab is already mounted, so without a focus refetch the numbers are stale. Use `useFocusEffect` (from `expo-router`, which re-exports React Navigation's) to call both `refetch`s when the tab gains focus. Memoize the callback so it does not refire every render. Story 6.1 explicitly designed weakness aggregation to run "on Stats-screen entry" — this focus hook is that entry point. [Source: 6.1 AC3; `useWeaknessStats` `refetch`.]

### Reuse map (do NOT rebuild)

| Need | Reuse |
| --- | --- |
| Weakness clusters + stats data | `useWeaknessStats()` — already exists, returns `{ stats, clusters, isLoading, error, refetch }` |
| Cluster detection / accuracy math | already done inside `useWeaknessStats` via `detectConfusionClusters` — render only |
| Stage label + color + a11y label | `components/common/SRSStageIndicator.tsx` |
| Screen layout / inset / max width | pattern in `app/(tabs)/learn/index.tsx` (`SafeAreaView`, `BottomTabInset`, `MaxContentWidth` from `@/constants/theme`) |
| Loading spinner pattern | `ActivityIndicator` usage in `learn/index.tsx` |
| Inline banner (error) | `components/common/Banner.tsx` (if it fits) |

### File structure (new / modified)

**New:**
- `mobile/src/data/hooks/useSRSBreakdown.ts` + `useSRSBreakdown.test.ts`
- `mobile/src/components/stats/WeaknessStatCard.tsx` + `WeaknessStatCard.test.tsx`
- `mobile/src/components/stats/SrsStageBreakdown.tsx` + `SrsStageBreakdown.test.tsx`
- `mobile/src/components/stats/StatsEmptyState.tsx`

**Modified:**
- `mobile/src/app/(tabs)/stats.tsx` (replace placeholder with real screen)
- `mobile/src/data/user/srsStateRepository.ts` (add `getSrsStageCounts`) + `srsStateRepository.test.ts`
- `mobile/__mocks__/expo-sqlite.ts` (only if the existing mock cannot satisfy the `GROUP BY` read — check first)

**Explicitly NOT touched:** `useWeaknessStats.ts`, `weaknessEngine.ts`, `weaknessRepository.ts`, migration files, any Home/other-tab screen, `srs_states` write paths.

### Testing requirements

- **Framework:** Jest; tests co-located `*.test.ts(x)`; expo modules already mocked under `mobile/__mocks__/`. Component tests use the project's existing RN testing-library setup (see `SRSStageIndicator.test.tsx`, `MnemonicImage.test.tsx` for the in-repo pattern). [Source: CLAUDE.md Testing; architecture.md §344.]
- **`srsStateRepository.test.ts`:** zero-filled five stages on empty DB; correct counts for mixed rows; burned counted.
- **`useSRSBreakdown.test.ts`:** loading→loaded; counts surfaced; error path.
- **`WeaknessStatCard.test.tsx`:** renders copy/label/accuracy %/sample size from a fixture `ConfusionCluster`; a11y label present; **no fabricated trend rendered**.
- **`SrsStageBreakdown.test.tsx`:** all five stages render with zeros; counts and canonical order correct; a11y labels per stage.
- **Gate:** `npm run typecheck`, `npm run lint`, `npm test` green from `mobile/`.

### Project Structure Notes

Paths align with the architecture's reserved source tree (`app/(tabs)/stats.tsx`, `data/hooks/useSRSBreakdown.ts`, `data/hooks/useWeaknessStats.ts`). The new `components/stats/` directory parallels the existing per-feature component grouping (`components/learn/`, `components/engagement/`, `components/read/`). The single deliberate scope variance from the literal UX anatomy is omitting the multi-session trend line / improvement delta — see "Trend data — the reality"; the underlying time-series data does not exist and creating it is out of scope. No structural conflicts.

### References

- [Source: epics.md §890–905 — Story 6.2 acceptance criteria; Epic 6 framing]
- [Source: prd.md §599 (FR28), §606 (FR32) — weakness stats visibility + trend-over-time intent]
- [Source: ux-design-specification.md §183/§276/§304 (SRS stage visibility), §367 + §993–1005 (`SRSStageIndicator`, `WeaknessStatCard` anatomy), §695/§703 (UX-DR19 — SRS buckets on Stats not Home), §667/§999 (color+text never color-only), §1159 + "Rules" (empty-state pattern)]
- [Source: architecture.md §279 (hooks encapsulate SQLite), §289–290 (layer purity), §390–414 (naming), §698 (`stats.tsx`), §821 (`useWeaknessStats`), §823 (`useSRSBreakdown` — SRS stage counts for Stats tab), §907 (capability map)]
- [Source: Story 6.1 (`6-1-weakness-detection-pipeline.md`) — `weakness_stats` schema, `ConfusionCluster` shape, `useWeaknessStats` contract, "sparse data → expect zero clusters", pattern-tags data-reality precedent]
- [Source: mobile/src/data/hooks/useWeaknessStats.ts; mobile/src/core/srs/srs.types.ts (`SRSStageLabel`, `ConfusionCluster`, `WeaknessStats`); mobile/src/data/user/srsStateRepository.ts; mobile/src/core/srs/fsrsScheduler.ts (`mapFsrsStateToStageLabel`); mobile/src/components/common/SRSStageIndicator.tsx; mobile/src/app/(tabs)/learn/index.tsx; mobile/tailwind.config.js (srs-* tokens)]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

### Completion Notes List

- Replaced Stats tab placeholder with a real screen composing `useWeaknessStats` + new `useSRSBreakdown` hook.
- Added `getSrsStageCounts` inventory query (burned included, all five stages zero-filled) and extended expo-sqlite mock `GROUP BY srs_stage_label`.
- Built `WeaknessStatCard`, `SrsStageBreakdown`, and `StatsEmptyState` (+ `WeaknessEmptySubState`) under `components/stats/`.
- Stats screen refetches both hooks on tab focus via `useFocusEffect`; first-launch empty state and weakness sub-state implemented per UX-DR27.
- **Intentionally omitted** multi-session trend sparklines / "45% → 72%" deltas — `weakness_stats` stores lifetime aggregates only; no dated history table exists. Follow-on work: per-session or daily pattern-accuracy snapshots for real trend rendering.
- Verification: `npm test` (548 passed), `npm run typecheck`, `npm run lint` all green.

### File List

- mobile/src/data/user/srsStateRepository.ts (modified)
- mobile/src/data/user/srsStateRepository.test.ts (modified)
- mobile/src/data/hooks/useSRSBreakdown.ts (new)
- mobile/src/data/hooks/useSRSBreakdown.test.tsx (new)
- mobile/src/components/stats/WeaknessStatCard.tsx (new)
- mobile/src/components/stats/WeaknessStatCard.test.tsx (new)
- mobile/src/components/stats/SrsStageBreakdown.tsx (new)
- mobile/src/components/stats/SrsStageBreakdown.test.tsx (new)
- mobile/src/components/stats/StatsEmptyState.tsx (new)
- mobile/src/app/(tabs)/stats.tsx (modified)
- mobile/__mocks__/expo-sqlite.ts (modified)

### Review Findings

- [x] [Review][Patch] SRS count numeric not stage-colored — changed count Text to `text-srs-{stage}` via STAGE_COUNT_CLASS map [mobile/src/components/stats/SrsStageBreakdown.tsx]
- [x] [Review][Patch] WeaknessStatCard hierarchy swapped — `cluster.label` is now bold headline, `cluster.copy` is secondary text [mobile/src/components/stats/WeaknessStatCard.tsx]
- [x] [Review][Patch] SrsStageBreakdown.test.tsx empty test bodies — false positive (tests were real); added singular "item" coverage [mobile/src/components/stats/SrsStageBreakdown.test.tsx]
- [x] [Review][Patch] `accessible` on WeaknessStatCard collapses cluster.copy — expanded accessibilityLabel to include copy and sample size [mobile/src/components/stats/WeaknessStatCard.tsx]
- [x] [Review][Patch] Double fetch on initial mount via useFocusEffect — added isInitialFocusRef to skip refetch on first focus [mobile/src/app/(tabs)/stats.tsx]
- [x] [Review][Patch] "1 items" grammatically wrong — pluralized correctly with `count === 1 ? 'item' : 'items'` [mobile/src/components/stats/SrsStageBreakdown.tsx]
- [x] [Review][Patch] cluster.accuracy not clamped — added `Math.min(100, Math.max(0, ...))` guard [mobile/src/components/stats/WeaknessStatCard.tsx]
- [x] [Review][Patch] WeaknessEmptySubState inherits full-page layout — refactored to standalone inline component without mt-8/centering [mobile/src/components/stats/StatsEmptyState.tsx]
- [x] [Review][Patch] srsError silently shadowed — replaced `const error` with `const hasError = weaknessError !== null || srsError !== null`; always shows generic message [mobile/src/app/(tabs)/stats.tsx]
- [x] [Review][Patch] No test file for StatsEmptyState.tsx — created StatsEmptyState.test.tsx with 5 tests [mobile/src/components/stats/StatsEmptyState.test.tsx]
- [x] [Review][Defer] error.userMessage never set — AppError.userMessage is optional; hooks use {code, message, cause} without userMessage, so generic fallback always shows — deferred, pre-existing AppError design
- [x] [Review][Defer] Mock GROUP BY ignores WHERE clauses — current getSrsStageCounts has no WHERE; future-proofing only — deferred, pre-existing
- [x] [Review][Defer] SRS_STAGE_LABELS and emptyStageCounts must be kept in manual sync — TypeScript's exhaustive Record catches new stages at compile time — deferred, pre-existing
- [x] [Review][Defer] STAGE_LABEL map duplicated across SrsStageBreakdown and SRSStageIndicator — different use contexts; minor DRY — deferred, pre-existing

### Change Log

- 2026-06-28: Story 6.2 — Stats tab with SRS stage breakdown, weakness cards, empty states, and focus refetch (Date: 2026-06-28)
