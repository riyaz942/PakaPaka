---
baseline_commit: 7d9c827cfb1d87f80fba0fe225235652a2f6f72e
---

# Story 6.3: Cognitive load ring and daily threshold guidance

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> This story makes the **cognitive load ring real**. The ring component and its `SessionHeader` slot **already exist** — but the percent is hard-wired to `0`. This story builds the missing **load model** (a pure `core/cognitive-load/` layer), **persists daily load** (migration 008 + a repository), **wires the ring to live session load**, and adds the **"you've done enough for today" guidance** (informational, never blocking). It does **not** build the Home-screen ring, streaks, or the post-session summary — those are Stories 6.4 / 6.5.

## Story

As a **learner**,
I want **a cognitive load ring that fills as I study and gentle guidance when I've done enough**,
so that **I understand my mental spend and feel permission to stop (FR15, FR16, FR17, UX-DR4, UX-DR30)**.

## Context: the ring exists but is inert; this story gives it a brain and memory

What is **already built** (do NOT rebuild):

- `mobile/src/components/engagement/CognitiveLoadRing.tsx` — renders a circular indicator with `variant: 'small' | 'large'`, a clamped `percent`, an `accessibilityRole="progressbar"`, `accessibilityValue`, and an always-visible numeric `"{percent}%"`. It is currently a single-color bordered ring (`border-ring-start`). This story **upgrades its color** to follow the gradient bands but keeps its API and the numeric label.
- `mobile/src/components/review/SessionHeader.tsx` — already has a `cognitiveLoadPercent?: number` prop (defaults to `0`), already renders `<CognitiveLoadRing variant="small" percent={cognitiveLoadPercent} />`, and already folds the percent into its container `accessibilityLabel`. **The plumbing is there; the value is missing.** Today `review/index.tsx` renders `<SessionHeader>` **without** passing `cognitiveLoadPercent`, so it is always `0`.
- `mobile/src/config/constants.ts` — the home for tunable constants (`INTERLEAVE_WEIGHTS`, `WEAKNESS_*`, etc.). Add the new load weights here.
- `mobile/src/data/user/sessionIntensity.types.ts` + `SESSION_INTENSITY_MINUTES` (in `config/constants.ts`, `{ relaxed: 15, intense: 30 }`) and `getSessionIntensity(userDb)` (in `preferencesRepository.ts`) — the intensity preference from Epic 2. The threshold is derived from this.

What does **not** exist yet and this story creates:

- The pure load math (`core/cognitive-load/loadTracker.ts`, `thresholdCalculator.ts`, `cognitiveLoad.types.ts`) — the reserved architecture paths (architecture.md §778–783).
- Daily-load persistence: migration `008_cognitive_load_history` + `data/user/cognitiveLoadRepository.ts`.
- The read hook `data/hooks/useCognitiveLoad.ts` (reserved path, §820 "Today's load progress, threshold").
- Live in-session load accumulation in `ReviewSessionProvider` + the threshold-reached signal.
- The "enough for today" guidance UI in the review screen.

**Critical performance rule (NFR1 / <100ms answer path):** the load increment is computed by a **pure synchronous function** over data already in memory (the current `ReviewItem` + outcome) and persisted on the **same async write tail** that already handles SRS/weakness writes in `ReviewSessionProvider.gradeCurrentItem` — it must **not** add a synchronous DB read or block the next item. NFR5b explicitly permits the ring-fill as non-blocking UI; do not animate anything between items.

## Acceptance Criteria

1. **(FR15 / UX-DR4 — load fills as you study)** Given item weights by type and maturity defined in config, when the learner grades items in a review session, then cumulative load increases and **both** the ring's color band **and** its numeric percent update; heavier items (new/apprentice kanji) add more load than light reviews (mature vocabulary), and an incorrect outcome adds more than a correct one. The percent shown is `round(min(100, todayLoad / threshold × 100))`. The ring is **never color-only** — the numeric percent is always rendered alongside (FR53 / §669).
2. **(NFR1 / NFR5b — non-blocking)** Given the <100ms answer path, when an item is graded, then computing and persisting the load increment does not block advancing to the next item: the increment is a pure in-memory computation and the DB write rides the existing async write tail in `ReviewSessionProvider`. No new synchronous DB read is added to the per-item path.
3. **(FR16 / UX-DR30 — "enough for today", informational only)** Given the learner's session intensity preference, when cumulative daily load first crosses the adaptive threshold (percent reaches 100%), then an informational, WHOOP-toned message appears once (e.g. "You've done enough for today — keep going if you like, or wrap up anytime."), the ring shows its **complete** state (cyan, not red/orange — accomplishment not alarm), and the learner **can still continue reviewing** (no hard stop, no modal that blocks the next item).
4. **(FR17 — adaptive threshold)** Given the threshold is derived from session intensity, when the threshold is computed, then it scales with the intensity preference (intense > relaxed) and **adapts over time** from the learner's recent daily-load history (documented formula and constants), so the threshold grows as the learner sustains heavier days. The adaptation is bounded (documented floor/ceiling) and never collapses to zero on a first-ever session.
4b. **(Daily, cross-session, day-keyed)** Given load is a **daily** measure, when the learner opens a second session on the same local calendar day, then the ring starts **partially filled** from load already accumulated earlier today (UX §458); when a new local day begins, today's load starts at 0. Load is keyed by local calendar date and survives app restart (persisted in `user.db`).
5. **(Accessibility — §667/§669/§999)** Given a screen reader, the ring continues to announce its progressbar role and value, the `SessionHeader` container label includes the live percent, and the "enough for today" message is announced when it appears. The ring's meaning never relies on color alone (numeric percent always present).
6. **(Layering / architecture)** Given the three-layer rule, all load and threshold math lives in pure `core/cognitive-load/*` (zero React/DB imports); the SQL lives only in `data/user/cognitiveLoadRepository.ts`; the read hook `data/hooks/useCognitiveLoad.ts` wires DB→UI; the ring and guidance components contain no SQL and no load math. Writes return `Result<T, AppError>`; reads return plain values (file precedent).
7. **(No scope bleed)** This story does **not** add the ring to the Home screen, does **not** build streaks/notifications, and does **not** build the post-session summary. It does not modify `src/app/(tabs)/index.tsx` (Home) or any tab screen. The only screen touched is the review session (`app/review/index.tsx`) plus the engagement/review components and the data/core layers listed below.

## Tasks / Subtasks

- [x] **Task 1 — Load weights & threshold constants in config (AC: #1, #4)**
  - [x] In `mobile/src/config/constants.ts` add `COGNITIVE_LOAD_WEIGHTS`: a base load per `itemType` (`radical | kanji | vocabulary | grammar`) where new kanji/grammar are heaviest (suggest e.g. `kanji: 3, grammar: 3, vocabulary: 2, radical: 1` — document as tunable defaults, mirror the `INTERLEAVE_WEIGHTS` comment style).
  - [x] Add a maturity multiplier keyed by `SRSStageLabel` (apprentice heaviest → burned lightest, suggest `apprentice: 1.0, guru: 0.7, master: 0.5, enlightened: 0.4, burned: 0.3`) and an `INCORRECT_LOAD_SURCHARGE` multiplier (>1, e.g. `1.5`) applied when the outcome is incorrect (architecture flow §945 "increments (higher weight)" on incorrect).
  - [x] Add threshold constants: `COGNITIVE_LOAD_THRESHOLD_BASE: Record<SessionIntensity, number>` (relaxed < intense — derive sensible load-unit targets so a typical relaxed session of ~15 light/medium items reaches ~100%; document the reasoning), plus adaptation bounds `COGNITIVE_LOAD_THRESHOLD_MIN`, `COGNITIVE_LOAD_THRESHOLD_MAX`, the rolling-window size `COGNITIVE_LOAD_HISTORY_WINDOW` (e.g. 7 days), and an adaptation gain factor. Keep every value a named, commented constant — no magic numbers in core.

- [x] **Task 2 — Pure load tracker (`core/cognitive-load/loadTracker.ts`) (AC: #1, #2, #6)**
  - [x] Create `mobile/src/core/cognitive-load/cognitiveLoad.types.ts`: `LoadOutcome = 'correct' | 'incorrect'`; `DailyLoad = { date: string; load: number; threshold: number }`; any other shared shapes. Zero React/RN/expo imports.
  - [x] Create `mobile/src/core/cognitive-load/loadTracker.ts` with a pure `computeLoadIncrement(input: { itemType: ReviewItem['itemType']; stageLabel: SRSStageLabel; outcome: LoadOutcome }): number` = `base[itemType] × maturity[stageLabel] × (outcome === 'incorrect' ? INCORRECT_LOAD_SURCHARGE : 1)`. Also export `computeLoadPercent(load: number, threshold: number): number` = `round(min(100, max(0, load / threshold × 100)))` (guard `threshold <= 0` → return 0). No side effects, no imports beyond config constants + types.
  - [x] Co-locate `loadTracker.test.ts`: heavier for new kanji than mature vocab; incorrect > correct for the same item; percent clamps to [0,100] and rounds; `threshold <= 0` → 0.

- [x] **Task 3 — Adaptive threshold (`core/cognitive-load/thresholdCalculator.ts`) (AC: #4, #6)**
  - [x] Create `mobile/src/core/cognitive-load/thresholdCalculator.ts` with a pure `computeThreshold(input: { intensity: SessionIntensity; recentLoads: number[] }): number`. Base = `COGNITIVE_LOAD_THRESHOLD_BASE[intensity]`. Adapt: nudge the base toward the recent-history signal (e.g. blend base with a fraction of the rolling average of `recentLoads`, weighted by the gain factor) so sustained heavier days raise the threshold (FR17 "adapts as the learner grows stronger"). Clamp to `[MIN, MAX]`. Empty `recentLoads` → exactly the base (never 0 on first session — AC4).
  - [x] Document the formula in a header comment with a worked example. Co-locate `thresholdCalculator.test.ts`: empty history → base; intense > relaxed; sustained high history raises threshold but never above MAX; clamps at MIN; first-session non-zero.

- [x] **Task 4 — Migration 008 + `cognitiveLoadRepository` (AC: #4, #4b, #6)**
  - [x] Create `mobile/src/data/migrations/008_cognitive_load_history.ts` (version 8, follow the 006/007 shape): `CREATE TABLE IF NOT EXISTS cognitive_load_history (date TEXT PRIMARY KEY NOT NULL, load REAL NOT NULL DEFAULT 0, threshold REAL NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);` Register it in `migrations/index.ts` (append to the array — forward-only).
  - [x] Create `mobile/src/data/user/cognitiveLoadRepository.ts`:
    - `getDailyLoad(userDb, date: string): DailyLoad | null` — `getFirstSync` by PK; map row → `DailyLoad` or `null`.
    - `getRecentDailyLoads(userDb, beforeDate: string, limit: number): number[]` — `SELECT load FROM cognitive_load_history WHERE date < ? ORDER BY date DESC LIMIT ?`; return the load values (most-recent-first) for threshold adaptation.
    - `addDailyLoad(userDb, params: { date: string; increment: number; threshold: number }): Result<void, AppError>` — read current row's load (or 0), compute `nextLoad = current + increment` **in JS**, then upsert `INSERT ... ON CONFLICT(date) DO UPDATE SET load = excluded.load, threshold = excluded.threshold, updated_at = excluded.updated_at` with the **computed** `nextLoad` (mirror `relatedItemBoostRepository.applyBoosts` — do NOT use SQL arithmetic like `load = load + ?`, the mock + precedent both compute in JS). Wrap in try/catch → `Result`.
    - Reads return plain values; the write returns `Result` (file precedent: `srsStateRepository`, `relatedItemBoostRepository`).
  - [x] **Local-day key helper:** add a small `todayKey(now = new Date()): string` returning the **local** `YYYY-MM-DD` (use local date parts, NOT `toISOString()` which is UTC — AC4b day boundary must follow the device's local day). Put it in the repository or a `utils` file and unit-test it. [Cross-check Story 6.1/streak NFR13 timezone resilience intent.]
  - [x] Extend `mobile/__mocks__/expo-sqlite.ts` **only if needed**: add an `INSERT INTO cognitive_load_history ... ON CONFLICT` handler (mirror the `related_item_boosts` handler at line ~327) and ensure `SELECT ... FROM cognitive_load_history WHERE date < ? ORDER BY date DESC LIMIT ?` returns sorted/limited rows (mirror existing ORDER BY/LIMIT handling). Check first; extend minimally.
  - [x] Tests: `008_cognitive_load_history` registered & runnable; `cognitiveLoadRepository.test.ts` — empty → `getDailyLoad` null & `getRecentDailyLoads` []; `addDailyLoad` accumulates across calls on the same date; distinct dates are independent; `todayKey` returns local `YYYY-MM-DD`.

- [x] **Task 5 — `useCognitiveLoad` read hook (AC: #6)**
  - [x] Create `mobile/src/data/hooks/useCognitiveLoad.ts` at the reserved path (§820). Mirror `useSRSBreakdown.ts`/`useWeaknessStats.ts` structure: `const { userDb } = useDatabase();` read today's load (`getDailyLoad(userDb, todayKey())`), recent loads, session intensity (`getSessionIntensity`), compute `threshold` (`computeThreshold`) and `percent` (`computeLoadPercent`). Expose `{ todayLoad: number; threshold: number; percent: number; isComplete: boolean; isLoading: boolean; error: AppError | null; refetch: () => void }`. Wrap reads in try/catch → `error` state; never throw across the boundary. **This hook is the read path for Home (Story 6.5) and any non-session display — the live in-session value comes from the provider (Task 6), so the review screen does NOT depend on this hook for the live fill.**
  - [x] Co-locate `useCognitiveLoad.test.tsx`: loading→loaded; percent surfaced from seeded load+threshold; intensity default (`relaxed` when unset) handled; error path sets `error` and clears loading.

- [x] **Task 6 — Wire live load into `ReviewSessionProvider` (AC: #1, #2, #3, #4b)**
  - [x] In `ReviewSessionProvider.tsx`: on session start (once, when `userDb` + queue ready), synchronously read **once** the day's starting load (`getDailyLoad(userDb, todayKey())?.load ?? 0`), recent loads, and intensity → compute and hold `threshold` (state/ref) and a `baseLoad` ref. This is a one-time read at mount, **not** on the per-item path (AC2).
  - [x] Add a `sessionLoad` state (default 0). In `gradeCurrentItem`, on the existing async write tail (the `Promise.resolve().then(...)` block, alongside the SRS/weakness writes), compute `increment = computeLoadIncrement({ itemType: currentItem.itemType, stageLabel: currentItem.srsState.srsStageLabel, outcome: outcomeResult })`, call `addDailyLoad(userDb, { date: todayKey(), increment, threshold })` (best-effort; on `!ok` log in `__DEV__` like the boost write), and update React state `setSessionLoad((l) => l + increment)`. **Typos add no load** (the typo branch / `recordTypoForCurrentItem` does not touch load).
  - [x] Derive and expose on the context value: `cognitiveLoadPercent = computeLoadPercent(baseLoad + sessionLoad, threshold)` and `cognitiveLoadComplete = cognitiveLoadPercent >= 100`. Add these two fields to `ReviewSessionState` (and the throwing `useReviewSession` consumers stay compatible — they're additive).
  - [x] Keep the increment math pure (core) — the provider only orchestrates. Do not regress the existing pending-write retry logic or `isGrading` guard.
  - [x] Update `ReviewSessionProvider.test.tsx`: mock `cognitiveLoadRepository`/`core/cognitive-load` as needed (follow the existing `jest.mock` style for `srsStateRepository`/`relatedItemBoostRepository`); assert percent rises after a correct grade, rises more after an incorrect grade, and that a typo does not change it.

- [x] **Task 7 — Ring color bands (AC: #1, #3, #5)**
  - [x] Upgrade `CognitiveLoadRing.tsx` to pick its color from the percent band per the UX gradient (UX §543–551): 0–40% `ring-start` (green), 40–70% `ring-mid` (yellow), 70–90% `ring-end` (orange), 90–100% `ring-complete` (cyan glow). Apply the band color to the ring border **and** the numeric text. Keep the existing API (`variant`, `percent`, `accessibilityLabel`), the clamp, the `progressbar` role + `accessibilityValue`, and the always-visible numeric label. Use NativeWind `border-ring-*`/`text-ring-*` semantic tokens (defined in `tailwind.config.js` §34–38) — no raw hex.
  - [x] **Scope note (read Dev Notes "Ring fidelity — the honest scope"):** do NOT add `react-native-svg` or any new dependency in this story. The architecture's "SVG arc fill" is deferred polish; the dependency-free band-color + numeric ring fully satisfies AC1/AC5. Do not introduce an animated arc.
  - [x] Update `CognitiveLoadRing.test.tsx`: band color selection at representative percents (e.g. 0→green, 55→yellow, 80→orange, 100→cyan) via the applied className; numeric label still renders at each.

- [x] **Task 8 — "Enough for today" guidance in the review screen (AC: #3, #5, #7)**
  - [x] Create `mobile/src/components/engagement/DailyThresholdNotice.tsx` — a presentational, informational banner (NOT a modal, NOT a blocker). Props: `visible: boolean`, `onDismiss?: () => void`. Copy: WHOOP-toned, e.g. "You've done enough for today 🎉 — keep going if you like, or wrap up anytime." Use semantic tokens (`bg-surface`/`bg-surface-elevated`, `text-primary`/`text-secondary`, `feedback-info` accent, `rounded-radius-md`). Accessible: `accessibilityRole` text/alert and a clear label; announced when shown. Export it from `components/engagement/index.ts`.
  - [x] In `app/review/index.tsx`: read `cognitiveLoadPercent` + `cognitiveLoadComplete` from `useReviewSession()`, pass `cognitiveLoadPercent` to `<SessionHeader cognitiveLoadPercent={...} />`, and render `<DailyThresholdNotice>` **once** when `cognitiveLoadComplete` first becomes true (latch with a ref so it shows once per session and does not re-fire every item or block the loop). The learner can dismiss it and keep reviewing (FR16). Do not gate the input or the next item on it.
  - [x] Co-locate `DailyThresholdNotice.test.tsx`: renders copy when `visible`; nothing when not; a11y label/announcement present; `onDismiss` fires.

- [x] **Task 9 — Verification**
  - [x] `npm run typecheck`, `npm run lint`, `npm test` all green from `mobile/`.
  - [x] Manually (or via the `__DEV__` grade buttons in the review screen) confirm the ring fills and changes color band as items are graded, the percent number tracks it, the "enough for today" notice appears once at 100% and review continues past it, and a second same-day session starts partially filled.

## Dev Notes

### Out of scope (do NOT build — later Epic 6 stories own these)

| Deferred | Owner |
| --- | --- |
| Cognitive load ring on the **Home screen** (`large` variant) | Story 6.5 (Home composition) — uses the `useCognitiveLoad` hook this story creates |
| Streaks / `StreakCounter` / notifications | Story 6.4 |
| Post-session summary / `TimeCompressionSummary` / share card | Story 6.5 |
| True **SVG arc-fill** ring + fill animation | Deferred polish — see "Ring fidelity" below; no `react-native-svg` dependency added now |
| "Recovery suggestions" (lighter activities when ring fills) | Future (PRD "Out of scope for MVP", prd.md §500) |

### Ring fidelity — the honest scope (READ THIS — primary risk)

The architecture aspires to an **SVG ring with a color gradient** (`CognitiveLoadRing.tsx # SVG ring with color gradient`, architecture.md §729; UX §362 "SVG-based circular progress"). **`react-native-svg` is not a project dependency** (`package.json` has `react-native-reanimated` and `react-native-gesture-handler` only). Adding it requires a native dependency, a jest mock, and a config-plugin rebuild — disproportionate risk for this story and not required by any AC.

Therefore, **scope to what the existing primitives honestly support**:
- The ring stays the dependency-free bordered circle it already is, **upgraded** to switch its border + text color across the four gradient bands (green → yellow → orange → cyan-complete) and always show the numeric percent. This fully satisfies AC1 ("ring visual + numeric percent update, never color-only") and AC5.
- A true arc that fills proportionally (sweep) needs SVG/Skia; that is **deferred polish with no current owner** — note it in Completion Notes. Do **not** add the dependency or a Reanimated arc hack in this story. This mirrors how Story 6.2 scoped to honest data (no fabricated trend line) rather than inventing capability.

NFR5b permits a ring-fill animation as non-blocking UI, but it is optional and explicitly **not** required here — and must never delay the next item. Ship the static band-color ring; do not animate between items.

### Load model — the math (document the constants)

- **Increment per graded item** = `base[itemType] × maturity[stageLabel] × (incorrect ? INCORRECT_LOAD_SURCHARGE : 1)`. Source data is already on the in-memory `ReviewItem`: `itemType` and `srsState.srsStageLabel` (`apprentice|guru|master|enlightened|burned`). New/apprentice kanji = heavy; mature (guru+) vocab = light — exactly the FR15 "heavier items cost more energy" intent.
- **Typos add no load.** Typos re-prompt with no SRS change (`recordTypoForCurrentItem`); they are fat-finger events, not cognitive work. Only `correct`/`incorrect` graded items add load.
- **Percent** = `round(min(100, todayLoad / threshold × 100))`, guarding `threshold <= 0 → 0`.
- **Threshold** = base from session intensity (`COGNITIVE_LOAD_THRESHOLD_BASE[intensity]`, intense > relaxed), adapted by a bounded blend with the rolling average of recent days' load (`getRecentDailyLoads`, window `COGNITIVE_LOAD_HISTORY_WINDOW`), clamped to `[MIN, MAX]`. Empty history → exactly the base (FR17 must not zero-out a first session). Tune the base so a typical relaxed day (~15 light/medium items) reaches ~100% — document your arithmetic in the constant comments so the reviewer can verify the calibration rather than guess.
- These are **tunable defaults**, exactly like `INTERLEAVE_WEIGHTS`/`WEAKNESS_BIAS_WEIGHT`. Name and comment every constant in `config/constants.ts`; keep `core/*` free of literals.

### Daily, local-day-keyed, cross-session (AC4b)

- Load is a **per-day** accumulator. The key is the **local** calendar date (`YYYY-MM-DD` from local date parts — **not** `toISOString()`, which is UTC and would roll the day at the wrong moment). Provide and test a `todayKey()` helper.
- A second session on the same day **continues** today's load (ring starts partially filled — UX §458 "empty or partially filled from earlier today"). The provider reads the day's starting load **once at mount** and adds session increments on top; the persisted total is what a later session/`useCognitiveLoad` reads back.
- Persisted in `user.db` → survives restart (NFR10). Timezone-change resilience parallels the streak NFR13 intent — keying on local date parts is the v1 approach; do not over-engineer DST.

### Non-blocking path (AC2 — do not regress the <100ms loop)

- The per-item write already happens inside `gradeCurrentItem`'s `Promise.resolve().then(...)` tail (SRS upsert, boosts, weakness record). **Add the `addDailyLoad` call there** — never as a synchronous read/write before `setCurrentIndex`. The only synchronous read is the **one-time** session-start load read at mount.
- `computeLoadIncrement` is pure and operates on in-memory data — no DB touch. The React `setSessionLoad` update drives the ring re-render in the header, which is outside the answer-eval critical path.

### Architecture compliance (must follow)

- **Three-layer purity:** math in `core/cognitive-load/*` (zero React/RN/expo imports); SQL only in `data/user/cognitiveLoadRepository.ts`; `data/hooks/useCognitiveLoad.ts` wires DB→UI; components are presentational. [architecture.md §289–290, §778–783, §820.]
- **Reserved paths — use these exact names:** `core/cognitive-load/loadTracker.ts`, `core/cognitive-load/thresholdCalculator.ts`, `core/cognitive-load/cognitiveLoad.types.ts` (§778–783); `data/hooks/useCognitiveLoad.ts` (§820); component `components/engagement/CognitiveLoadRing.tsx` (§729, exists). [architecture.md §778–783, §820, §729, §908, §1014.]
- **Naming:** functions `camelCase`; types `PascalCase`, no `I-` prefix, `type` over `interface`; prefer `T | null` for reads. [architecture.md §390–414.]
- **Error handling:** writes return `Result<T, AppError>` (try/catch → typed error); reads return plain values (precedent: `srsStateRepository` getters, `relatedItemBoostRepository.getBoosts`). The hook surfaces `AppError` in state and never throws. [architecture.md §495; file precedent.]
- **Migrations:** forward-only, numbered; `008` follows the `006`/`007` shape (`Migration` object with `version`, `name`, `up`); register in `migrations/index.ts` array. Migration runner applies `version > current` in order. [migrationRunner.ts; migrations/index.ts.]
- **Styling:** NativeWind semantic tokens only — `ring-start|ring-mid|ring-end|ring-complete` (tailwind.config.js §34–38, available as both `border-*`/`text-*`), `bg-surface`, `text-primary/secondary`, `feedback-info`, `rounded-radius-md`, `space-*`. No raw hex, no legacy `Colors`. [CLAUDE.md Styling; tailwind.config.js.]

### Reuse map (do NOT rebuild)

| Need | Reuse |
| --- | --- |
| Ring component + a11y progressbar + numeric label | `components/engagement/CognitiveLoadRing.tsx` (upgrade color only) |
| Ring slot in session header (prop already wired) | `components/review/SessionHeader.tsx` `cognitiveLoadPercent` prop |
| Session intensity preference | `getSessionIntensity(userDb)` (`preferencesRepository.ts`) + `SESSION_INTENSITY_MINUTES` |
| Async write tail / pending-write pattern | `ReviewSessionProvider.gradeCurrentItem` (`Promise.resolve().then`) |
| JS-computed upsert (no SQL arithmetic) | `relatedItemBoostRepository.applyBoosts` |
| Hook shape (loading/error/refetch) | `data/hooks/useSRSBreakdown.ts`, `useWeaknessStats.ts` |
| Migration object shape | `006_related_item_boosts.ts` / `007_weakness_stats.ts` |
| Provider test harness (`jest.mock` repos, `DatabaseContext`) | `ReviewSessionProvider.test.tsx` |
| Gradient band hexes / meanings | ux-design-specification.md §543–551 |

### File structure (new / modified)

**New:**
- `mobile/src/core/cognitive-load/cognitiveLoad.types.ts`
- `mobile/src/core/cognitive-load/loadTracker.ts` + `loadTracker.test.ts`
- `mobile/src/core/cognitive-load/thresholdCalculator.ts` + `thresholdCalculator.test.ts`
- `mobile/src/data/migrations/008_cognitive_load_history.ts`
- `mobile/src/data/user/cognitiveLoadRepository.ts` + `cognitiveLoadRepository.test.ts`
- `mobile/src/data/hooks/useCognitiveLoad.ts` + `useCognitiveLoad.test.tsx`
- `mobile/src/components/engagement/DailyThresholdNotice.tsx` + `DailyThresholdNotice.test.tsx`

**Modified:**
- `mobile/src/config/constants.ts` (load weights + threshold constants)
- `mobile/src/data/migrations/index.ts` (register migration 008)
- `mobile/src/components/engagement/CognitiveLoadRing.tsx` (gradient band color) + `CognitiveLoadRing.test.tsx`
- `mobile/src/components/engagement/index.ts` (export `DailyThresholdNotice`)
- `mobile/src/providers/ReviewSessionProvider.tsx` (live load accumulation + expose percent/complete) + `ReviewSessionProvider.test.tsx`
- `mobile/src/app/review/index.tsx` (pass percent to header + render notice)
- `mobile/__mocks__/expo-sqlite.ts` (only if needed for `cognitive_load_history`)

**Explicitly NOT touched:** `src/app/(tabs)/index.tsx` (Home — 6.5), any other tab screen, streak/notification code (none yet — 6.4), `TimeCompressionSummary` (6.5), SRS/weakness write paths (read `srsStageLabel` only).

### Testing requirements

- **Framework:** Jest; tests co-located `*.test.ts(x)`; expo modules mocked under `mobile/__mocks__/`. Component tests use the in-repo RN testing-library setup (see `CognitiveLoadRing.test.tsx`, `SessionHeader.test.tsx`). Provider/hook tests use `renderHook` + `DatabaseContext` (see `ReviewSessionProvider.test.tsx`, `useSRSBreakdown.test.tsx`). [CLAUDE.md Testing; architecture.md §344–346.]
- **Core (`loadTracker`, `thresholdCalculator`):** pure unit tests — the architecture explicitly lists "cognitive load thresholds" as a Jest core-logic target (§344).
- **Repository:** accumulation across calls; per-date isolation; empty reads; local `todayKey`.
- **Hook:** loading→loaded; percent surfaced; intensity default; error path.
- **Provider:** percent rises on correct, more on incorrect, unchanged on typo; no regression to grade/pending-write logic.
- **Components:** ring band-color per percent + numeric still shown; notice visibility/dismiss/a11y.
- **Gate:** `npm run typecheck`, `npm run lint`, `npm test` green from `mobile/`.

### Project Structure Notes

Paths align with the architecture's reserved source tree: `core/cognitive-load/{loadTracker,thresholdCalculator,cognitiveLoad.types}` (§778–783), `data/hooks/useCognitiveLoad.ts` (§820), `components/engagement/CognitiveLoadRing.tsx` (§729). The new `data/user/cognitiveLoadRepository.ts` parallels the existing per-concern user repositories. `DailyThresholdNotice` is a new engagement component (the UX names the ring and the "you've done enough" copy but not a discrete notice component — naming it per convention). The single deliberate scope variance from the architecture's literal "SVG ring" is the dependency-free band-color ring — see "Ring fidelity"; SVG arc-fill is deferred with no current owner. No structural conflicts.

### References

- [Source: epics.md §"Story 6.3" — acceptance criteria (load increments, threshold guidance, informative-only); Epic 6 framing]
- [Source: prd.md §579 (FR15 daily cognitive load, heavier new items), §580 (FR16 "done enough for the day"), §581 (FR17 threshold adapts), §662 (FR53 contrast), §674 (NFR5b non-blocking ring fill only), §685 (NFR10 progress survives updates), §310–311 (cognitive load ring rationale), §347 (risk: informational not patronizing), §500 (recovery suggestions out of scope)]
- [Source: ux-design-specification.md §84/§90/§130/§142/§168 (ending-a-session tone, "you've done enough"), §154/§231 (inform-not-nag, avoid Apple "close your rings" nagging), §269/§275 (fill during session, color-coded bands), §362 (SVG ring), §458 ("empty or partially filled from earlier today"), §466/§472 ("ring increments visibly"), §543–551 (gradient band hexes + cyan-complete meaning), §629/§633/§641 (ring in fixed header), §669 (color + numeric, never color-only)]
- [Source: architecture.md §241 (cognitive load history in user.db), §278 (ring position in session state), §290 (core layer purity), §293 (ReviewSessionProvider owns cognitive load updates), §344–346 (testing targets incl. cognitive load thresholds + ring a11y), §369/§375 (engagement layer, queue depends on load tracker), §405/§410 (naming), §729 (CognitiveLoadRing SVG variants), §778–783 (cognitive-load module paths), §820 (useCognitiveLoad), §908/§1014 (FR15–17 capability map), §941–945 (review flow: ring increments, higher weight on incorrect)]
- [Source: Story 6.2 (`6-2-stats-tab-...md`) — honest-scope precedent (don't fabricate capability the data doesn't support); reserved-path + layering discipline; hook/test patterns]
- [Source: mobile/src/components/engagement/CognitiveLoadRing.tsx; mobile/src/components/review/SessionHeader.tsx; mobile/src/providers/ReviewSessionProvider.tsx; mobile/src/app/review/index.tsx; mobile/src/config/constants.ts; mobile/src/data/user/preferencesRepository.ts (getSessionIntensity); mobile/src/data/user/relatedItemBoostRepository.ts (JS-computed upsert + Result); mobile/src/data/migrations/{006,007,index}.ts; mobile/src/core/srs/srs.types.ts (ReviewItem, SRSStageLabel); mobile/tailwind.config.js (ring-* tokens §34–38)]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

### Completion Notes List

- Implemented pure `core/cognitive-load/` layer: `loadTracker` (increment + percent) and `thresholdCalculator` (intensity base + bounded adaptation from 7-day history).
- Added migration 008 `cognitive_load_history` table and `cognitiveLoadRepository` with local-day `todayKey()`, JS-computed upserts, and expo-sqlite mock support.
- Created `useCognitiveLoad` read hook for Story 6.5 Home composition; live session fill wired through `ReviewSessionProvider` on the existing async write tail (non-blocking).
- Upgraded `CognitiveLoadRing` with gradient band colors (green→yellow→orange→cyan) + always-visible numeric percent; deferred SVG arc-fill per honest-scope note.
- Added `DailyThresholdNotice` informational banner in review screen, latched once at 100% with screen-reader announcement; review continues uninterrupted.
- All 585 tests pass; typecheck and lint green. Updated `database.test.ts` migration count to 8.

### File List

- mobile/src/config/constants.ts
- mobile/src/core/cognitive-load/cognitiveLoad.types.ts
- mobile/src/core/cognitive-load/loadTracker.ts
- mobile/src/core/cognitive-load/loadTracker.test.ts
- mobile/src/core/cognitive-load/thresholdCalculator.ts
- mobile/src/core/cognitive-load/thresholdCalculator.test.ts
- mobile/src/data/migrations/008_cognitive_load_history.ts
- mobile/src/data/migrations/index.ts
- mobile/src/data/user/cognitiveLoadRepository.ts
- mobile/src/data/user/cognitiveLoadRepository.test.ts
- mobile/src/data/hooks/useCognitiveLoad.ts
- mobile/src/data/hooks/useCognitiveLoad.test.tsx
- mobile/src/data/database.test.ts
- mobile/src/components/engagement/CognitiveLoadRing.tsx
- mobile/src/components/engagement/CognitiveLoadRing.test.tsx
- mobile/src/components/engagement/DailyThresholdNotice.tsx
- mobile/src/components/engagement/DailyThresholdNotice.test.tsx
- mobile/src/components/engagement/index.ts
- mobile/src/providers/ReviewSessionProvider.tsx
- mobile/src/providers/ReviewSessionProvider.test.tsx
- mobile/src/app/review/index.tsx
- mobile/__mocks__/expo-sqlite.ts

### Review Findings

- [x] [Review][Patch] AC6 — `thresholdCalculator.ts` imports `SessionIntensity` from `@/data/user/sessionIntensity.types`, crossing the core→data boundary. `SessionIntensity` should be defined in `core/cognitive-load/cognitiveLoad.types.ts` or `config/`. [mobile/src/core/cognitive-load/thresholdCalculator.ts]
- [x] [Review][Patch] AC5 — `DailyThresholdNotice` `accessibilityLabel` contains emoji `🎉`; VoiceOver/TalkBack will verbalize it as "party popper". Use a clean string for `accessibilityLabel` (the `announceForAccessibility` call in `review/index.tsx` is already clean). [mobile/src/components/engagement/DailyThresholdNotice.tsx]
- [x] [Review][Patch] `computeLoadIncrement` returns `NaN` if `stageLabel` is an unrecognised value (no fallback — `COGNITIVE_LOAD_MATURITY_MULTIPLIER[unknown]` → `undefined`, `base * undefined` → `NaN`). Add a fallback (e.g., default to `apprentice` multiplier or return 0 and log in `__DEV__`). [mobile/src/core/cognitive-load/loadTracker.ts]
- [x] [Review][Defer] Midnight rollover drift — `baseLoad` is seeded from the day's key at session mount; if the user grads past midnight, `gradeCurrentItem` writes to the new date's row while `baseLoad` counts against the old day's threshold. Accepted v1 limitation, consistent with spec's "do not over-engineer DST". [mobile/src/providers/ReviewSessionProvider.tsx] — deferred, pre-existing
- [x] [Review][Defer] `thresholdRef` not re-computed when session intensity preference changes mid-session — extremely rare in practice; preference is set during onboarding. [mobile/src/providers/ReviewSessionProvider.tsx] — deferred, pre-existing
- [x] [Review][Defer] Same-day multi-session threshold adaptation is blind to today's earlier load — `getRecentDailyLoads` uses `date < today` so today's accumulated load never influences the same-day threshold. Design-consistent for v1; revisit if users with multiple daily sessions report premature 100% ring. [mobile/src/data/user/cognitiveLoadRepository.ts] — deferred, pre-existing
- [x] [Review][Defer] Threshold notice re-shows if `ReviewScreen` fully unmounts and remounts (e.g. tab switch) — `thresholdNoticeShownRef` is a local ref and resets on remount. No persistent "shown today" flag. [mobile/src/app/review/index.tsx] — deferred, pre-existing
- [x] [Review][Defer] Mock `LIMIT ?` extraction uses `params[params.length - 1]` — works for current 2-param query but is an undocumented coupling in test infrastructure. [mobile/__mocks__/expo-sqlite.ts] — deferred, pre-existing

### Change Log

- 2026-06-28: Story 6.3 — cognitive load model, daily persistence, live ring fill, threshold guidance banner (Date: 2026-06-28)
