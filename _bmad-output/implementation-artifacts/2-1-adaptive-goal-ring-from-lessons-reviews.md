---
baseline_commit: 5362079
---

# Story 2.1: Adaptive Goal Ring from Lessons & Reviews

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a learner,
I want a daily goal ring that fills from both lessons and reviews and can overshoot 100%,
so that progress feels like an aspiration I can beat — not a capacity ceiling.

## Acceptance Criteria

1. **Given** I complete review cards and/or lesson items in a day  
   **When** daily load is recorded  
   **Then** both lessons and reviews contribute to the goal ring (FR55)  
   **And** BUG2 is fixed (`addDailyLoad` is called from the lesson flow, not only reviews)

2. **Given** my achievement exceeds the daily target  
   **When** the ring renders  
   **Then** it may show >100% with cyan overshoot treatment and a `+N%` badge (UX-DR2)  
   **And** there is no maximum clamp; the ring never blocks continuing to study (FR55)

3. **Given** a week of activity with enough active days  
   **When** the weekly recalculation runs  
   **Then** the new goal is the average daily achievement over active days only (FR56)  
   **And** if the minimum active-day sample is not met, the current goal carries forward

4. **Given** the recalculated average is higher than my current goal  
   **When** the rise is surfaced  
   **Then** I see a congratulatory prompt that also offers to change the goal (FR57, UX-DR28)  
   **And** the goal never auto-drops; after 2–3 consecutive miss weeks the system may *offer* an opt-in reduction  
   **And** Settings lets me set an unbounded goal manually (FR57, UX-DR33)

5. **Given** I finish a lesson or review and return to Home  
   **When** Home is focused/visible  
   **Then** goal and related metrics refresh without requiring a tab switch (BUG1)

6. **Given** assistive technology reads the ring  
   **When** progress is announced  
   **Then** it exposes a progressbar including overshoot percent (e.g. “Goal 120 percent”) (UX-DR2)

## Tasks / Subtasks

- [x] **Task 1 — Persist sticky goal + ratchet state (migration + prefs)** (AC: #3, #4)
  - [x] Add next user migration (**015** as of baseline — claim the next free number; if another story lands first, use whatever is free). Do **not** wait for architecture’s old label `015_furigana_overrides` — furigana (Story 4.2) takes the next number after this ships.
  - [x] Persist at minimum (prefs columns and/or a small `goal_ring_state` table — pick one pattern and stick to it; prefs are fine and match existing intensity/auto-advance):
    - `daily_goal_target` (REAL) — sticky goal in load units; seed from `COGNITIVE_LOAD_THRESHOLD_BASE[intensity]` when unset
    - `goal_week_start` (TEXT `YYYY-MM-DD`, local Monday or documented week boundary)
    - `goal_consecutive_miss_weeks` (INTEGER, default 0)
    - `goal_pending_rise_to` (REAL nullable) — proposed higher goal awaiting user ack
    - `goal_pending_reduction_to` (REAL nullable) — optional opt-in reduction offer
  - [x] Keep existing `cognitive_load_history` as the achievement ledger (do not recreate it). Daily `load` = achievement; stop treating row `threshold` as the live goal — the sticky `daily_goal_target` is the denominator.
  - [x] Repository helpers in `data/user/` (extend `cognitiveLoadRepository` **or** add `goalRingRepository` — prefer one cohesive module): getters/setters returning plain values on read, `Result` on writes.
  - [x] Register migration in `migrations/index.ts` (append only).

- [x] **Task 2 — Unclamp percent + rewrite weekly goal calculator** (AC: #2, #3, #4)
  - [x] In `loadTracker.ts`: change `computeLoadPercent` so it **does not clamp at 100**. Guard `threshold/goal <= 0 → 0`; floor at 0; allow `>100` (e.g. load 45 / goal 30 → `150`). Update `loadTracker.test.ts`.
  - [x] Replace daily rolling `computeThreshold` (intensity blend + `[MIN, MAX]` clamp) with weekly goal semantics in `thresholdCalculator.ts` (rename exports to goal language if clean — e.g. `computeWeeklyGoalProposal` — but keep import churn low):
    - **Initial / unset:** `COGNITIVE_LOAD_THRESHOLD_BASE[intensity]` (intensity still seeds calibration).
    - **Weekly proposal:** mean of prior week’s **active-day** loads only (`cognitive_load_history` rows with load > 0 in the week window). Rest days excluded (brainstorm O7 — rows already exist only for active days if load was written).
    - **Min sample:** require `GOAL_RING_MIN_ACTIVE_DAYS` (constant, default **3**) before accepting a recalculation; else carry current goal forward (O9).
    - **Rise-only auto path:** if proposal > current → set `goal_pending_rise_to = proposal` (do **not** silently mutate `daily_goal_target`).
    - **Down week:** never auto-drop; increment `goal_consecutive_miss_weeks` when weekly mean &lt; current goal (and sample met); else reset miss counter on a hit/rise week.
    - **Opt-in reduction offer:** when `goal_consecutive_miss_weeks >= GOAL_RING_MISS_WEEKS_BEFORE_OFFER` (constant, default **2**), set `goal_pending_reduction_to` to the weekly mean (user must accept).
  - [x] **Remove `COGNITIVE_LOAD_THRESHOLD_MAX` usage** from the calculator (D5 / R1). Delete or leave the constant unused with a deprecation comment — do not clamp the goal. Keep `COGNITIVE_LOAD_THRESHOLD_MIN` only if still useful as a seed floor for first-run intensity base; do not use it to cap overshoot %.
  - [x] Add named constants in `config/constants.ts` for min active days, miss-week threshold, week boundary helper docs. No magic numbers in core.
  - [x] Co-locate pure tests: empty history → intensity base; sample guard; rise sets pending not target; down week holds target; miss weeks eventually offer reduction; mean uses active days only.

- [x] **Task 3 — BUG2: lesson flow calls `addDailyLoad`** (AC: #1)
  - [x] In `app/lesson/index.tsx` final `handleNext` (after successful `startLessonItems`, alongside streak write): for each completed lesson item, compute `computeLoadIncrement({ itemType, stageLabel: 'apprentice', outcome: 'correct' })` (new lesson items are apprentice; no incorrect outcome in lesson UI), sum increments, call `addDailyLoad(userDb, { date: todayKey(), increment: sum, threshold: currentGoal })` once.
  - [x] Source `itemType` from the in-memory lesson plan items (`useLessonPlan` already exposes `itemType`). Do not add a sync curriculum DB round-trip on the critical path.
  - [x] Best-effort: load persist failure must not block navigation to `/lesson/complete` (mirror streak `__DEV__` warn pattern).
  - [x] Resolve `currentGoal` via sticky `daily_goal_target` (or intensity base if unset) — same denominator the ring uses.
  - [x] Tests: lesson completion path mocks `addDailyLoad` and asserts it was called with a positive increment when items exist; reviews path in `ReviewSessionProvider` still calls once per **item grade** (unchanged two-card rule from Story 1.1).

- [x] **Task 4 — Rename UI to `GoalRing` + overshoot presentation** (AC: #2, #6)
  - [x] Rename `CognitiveLoadRing` → `GoalRing` (file, export, tests, `SessionHeader`, Home). Update barrel `components/engagement/index.ts`. No need for a permanent alias unless a transient re-export eases the PR.
  - [x] Variants: keep `small` (session ~32px) and Home hero. Size hero toward ~160px if cheap (today `hero: 144`); do not rebuild Home layout (2.2 owns composition).
  - [x] **Unclamp display:** show raw percent including >100; label e.g. `120%`.
  - [x] **Overshoot badge:** when percent > 100, show `+N%` where `N = percent - 100` (UX-DR2). Cyan / `ring-complete` treatment for ≥90 and all overshoot (proud, not alarming).
  - [x] **A11y:** default label `Goal ${percent} percent` (not “Cognitive load…”). `accessibilityRole="progressbar"`; `accessibilityValue.now = percent`; set `max` to `Math.max(100, percent)` so overshoot is not capped in the a11y value.
  - [x] **Ring fidelity (honest scope):** `react-native-svg` is still **not** a dependency. Do **not** add it in this story. Satisfy overshoot with uncapped numeric %, `+N%` badge, and cyan complete band. True proportional overflow arc remains deferred polish (same honesty as Story 6.3). Document in Completion Notes.
  - [x] Update Home copy beside the ring: replace “Today's load / Your study capacity for today” with goal framing (e.g. “Today's goal” / short aspiration subtitle). Do **not** remove `StreakCounter` or restructure CTAs (Story 2.2).

- [x] **Task 5 — Wire hooks / provider to sticky goal** (AC: #1–#4)
  - [x] Update `useCognitiveLoad` (optional rename to `useGoalRing` if churn is acceptable — otherwise keep name, change semantics): read sticky goal as denominator; expose `percent` via unclamped `computeLoadPercent`; expose `isComplete` (`percent >= 100`), optionally `isOvershoot` (`percent > 100`); run weekly recalculation check on read/refetch (pure propose + persist pending flags).
  - [x] Update `ReviewSessionProvider` session-start threshold read to use sticky `daily_goal_target` (not daily-adapted `computeThreshold`). Keep non-blocking `addDailyLoad` on the existing async write tail. Preserve Story 1.1 once-per-item load accounting.
  - [x] Reframe `DailyThresholdNotice` copy from capacity (“done enough”) to goal-met (“Goal met — keep going if you like…”) — still informational, once per session, never blocking (FR55 / UX permission principle).

- [x] **Task 6 — Goal-rise / reduction prompts + Settings unbounded goal** (AC: #4)
  - [x] New presentational component (e.g. `GoalRisePrompt`) shown on **Home only** (UX-DR28 — non-review): when `goal_pending_rise_to` is set, congratulate and offer Accept (writes target, clears pending, resets miss weeks) / Adjust (opens inline editor or deep-links Settings) / Dismiss-for-now (keep pending or clear per product choice — document: prefer keep pending until Accept/Adjust).
  - [x] Opt-in reduction prompt when `goal_pending_reduction_to` is set — kindness framing (“Been a tough stretch?”), Accept lowers target, Decline clears offer and resets miss counter.
  - [x] Settings: add “Daily goal” control (numeric field or stepper) that sets `daily_goal_target` with **no upper bound** (UX-DR33). Validate `> 0`. Place near Session intensity. Changing intensity does **not** silently overwrite a user-set goal; intensity only seeds when target is unset.
  - [x] Tests: prompt visibility from pending state; Accept persists; Settings round-trip unbounded value.

- [x] **Task 7 — BUG1: Home focus refresh** (AC: #5)
  - [x] In `app/(tabs)/index.tsx`, fix `useFocusEffect` + `isInitialFocusRef` skip (`~153–159`). Root cause: first focus after returning from `/lesson` or `/review` can be the skipped event when Home never blurred.
  - [x] **Prescribed fix:** always refetch on every focus (including the first). Keep or simplify the mount `useEffect` so data still loads; prefer one path (focus-only) if it avoids double-fetch flicker — either is fine if returning from lesson/review updates the ring without a tab switch.
  - [x] Update `index.test.tsx` for renamed GoalRing / new a11y label / goal copy; do not assert streak removal.

- [x] **Task 8 — Verification**
  - [x] `npm run typecheck`, `npm run lint`, `npm test` green from `mobile/`.
  - [x] Manual: lesson-only day fills ring; review still fills; overshoot shows >100 + badge; weekly rise prompt appears in a seeded scenario; Settings can set a high goal; Home updates after lesson without tab switch; screen reader announces overshoot %.

### Review Findings

- [x] [Review][Patch] Exact-mean week is a hit [`thresholdCalculator.ts:77`] — decided: `proposal === currentGoal` resets miss counter and clears pending offers (not a miss). Align code + canonical algorithm (§ Weekly ratchet step 6) with Task 2 (`mean < goal` only).
- [x] [Review][Patch] Multi-week app gap skips intermediate weeks [`goalRingRepository.ts:187`] — `runWeeklyGoalCheck` only judges `[currentMonday-7, currentMonday)` then jumps `goalWeekStart` to now; weeks skipped while the app was closed never update miss/rise state.
- [x] [Review][Patch] Rise dismiss hides later offers while Home stays mounted [`index.tsx`] — dismiss now keys off the pending value (`dismissedRiseTo`), so a later week’s different offer reappears while Home stays mounted.
- [x] [Review][Patch] Manual goal save leaves reduction offer stale [`goalRingRepository.ts:124`] — `setDailyGoalTarget` clears `pendingRiseTo` but not `pendingReductionTo`; accepting the stale offer can overwrite the manual target.
- [x] [Review][Patch] Accept/decline handlers ignore `Result` [`index.tsx:132`] — `handleAcceptRise` / reduction accept/decline call writers then always `refetchLoad()` without checking `.ok`.
- [x] [Review][Patch] Accepting one pending offer does not clear the other [`goalRingRepository.ts:128`] — `acceptPendingRise` / `acceptPendingReduction` only null their own field; combined with the Settings clear gap, both prompts can appear.
- [x] [Review][Patch] Weekly proposal can round to 0 [`thresholdCalculator.ts:75`] — `Math.round(mean)` with tiny loads yields `0`; `acceptPendingReduction` writes it without a `> 0` guard (resolve falls back, but sticky target becomes 0).
- [x] [Review][Defer] Mid-session goal denominator stays stale [`ReviewSessionProvider.tsx`] — deferred, pre-existing session-capture pattern; threshold ref resolved once when queue loads
- [x] [Review][Defer] Device clock rollback can re-judge a week [`goalRingRepository.ts:179`] — deferred, rare clock/timezone edge; no guard when stored `goalWeekStart` is in the future

## Dev Notes

### Scope boundary (critical)

| In 2.1 | Out → Story 2.2 |
| --- | --- |
| Goal engine, lesson+review load, overshoot UI, weekly ratchet, Settings goal, rise/reduction prompts, BUG1/BUG2, GoalRing rename | Full Home composition (greeting redesign, CTA hierarchy, forecast+wall, reading readiness, empty states) |
| Goal framing copy on existing ring card | Streak removal / DaysStudiedStat |
| DailyThresholdNotice reframe | Post-session share card overshoot centerpiece |
| | At-risk / welcome-back / conditional banners |

Architecture’s high-level “Home goal-ring + streak removal + triage” sequence is Epic 2 overall — **story ACs win**: streak and triage wait for 2.2.

### Current state (must read before coding)

| Area | Today | This story changes |
| --- | --- | --- |
| `addDailyLoad` | Sole call site: `ReviewSessionProvider` async grade tail | + lesson `handleNext` |
| `computeLoadPercent` | Clamps `[0,100]` | Allow >100 |
| `CognitiveLoadRing` | Clamps display + a11y max 100; “Cognitive load…” | → `GoalRing`, overshoot %, `+N%`, “Goal…” |
| `computeThreshold` | Daily blend + clamp `[20,90]` | Weekly active-day mean, rise-only pending, no MAX |
| Home focus | Skips first focus → BUG1 | Always refresh on focus |
| Home copy | “Today's load / capacity” | Goal framing (minimal) |
| Settings | Intensity only | + unbounded daily goal |
| Migration latest | **014** | **015** (goal-ring state) |

### Lesson load policy (do not invent alternatives)

- Increment per lesson item = `computeLoadIncrement({ itemType, stageLabel: 'apprentice', outcome: 'correct' })`.
- Rationale: lesson commit introduces new apprentice items; there is no grade outcome in the lesson UI.
- One batched `addDailyLoad` for the sum at lesson finish (not per card flip during the lesson walk).
- Typos N/A; leaving mid-lesson still commits nothing (existing behavior).

### Weekly ratchet algorithm (canonical)

From FR56–57 + brainstorming 2244 O7–O9 / Risk 1:

1. Week boundary: local calendar week (document Monday-start or Sunday-start in code comment; be consistent).
2. On Home focus / hook refetch, if `today` is in a new week vs `goal_week_start` → run recalc once, advance `goal_week_start`.
3. `proposal = mean(loads for active days in prior week)`.
4. If `activeDays < MIN` → no change to target or miss counter (carry forward).
5. If `proposal > target` → set pending rise (prompt); do not silent-write target.
6. If `proposal < target` → hold target; `missWeeks++`; at threshold set pending reduction offer. If `proposal === target` → hit (reset misses, clear offers).
7. Accepting a rise writes target and clears pending; rejecting reduction clears offer.

**Why mean not best-day:** keeps overshoot reachable ~half the time (Anti-Solution Risk 1). Do not implement best-day or silent daily Garmin-style auto goal.

### Architecture compliance

- **Three-layer purity:** math in `core/cognitive-load/*` (keep this folder — renaming to `goal-ring/` is optional and high-churn; prefer semantic renames inside). SQL only in `data/user/*`. Hooks wire DB→UI. Components presentational. [architecture.md]
- **Result type:** writes → `Result<T, AppError>`; reads → plain values. Never throw across async boundaries.
- **Styling:** NativeWind semantic tokens only (`border-ring-*`, `text-ring-*`, `bg-surface`, `text-primary/secondary`). No raw hex, no legacy `Colors`.
- **Never** treat the ring as a hard capacity ceiling (architecture rule #11).
- **Migrations:** forward-only numbered; claim next free version when implementing.

### Anti-patterns (do NOT)

- Do not add `react-native-svg` / Skia for an overflow arc.
- Do not remove Home streak or rebuild Home IA (2.2).
- Do not clamp percent or goal with `COGNITIVE_LOAD_THRESHOLD_MAX`.
- Do not silently raise or lower `daily_goal_target` without the prompt / Settings.
- Do not call `addDailyLoad` per lesson card flip — only on final commit.
- Do not double-count load for two-card kanji (Story 1.1 already fires once per item grade).
- Do not block review/lesson continuation when goal is met or overshot.
- Do not show goal-rise overlay inside the review route (UX-DR28).

### Reuse map

| Need | Reuse |
| --- | --- |
| Load increment weights | `computeLoadIncrement` + `COGNITIVE_LOAD_*` constants |
| Daily ledger + `todayKey` | `cognitiveLoadRepository` |
| Review write path | `ReviewSessionProvider` async tail |
| Lesson commit hook point | `lesson/index.tsx` `handleNext` after `startLessonItems` |
| Ring UI shell | Rename/upgrade `CognitiveLoadRing` |
| Settings control patterns | Intensity picker / Switch sections in `settings.tsx` |
| Prefs get/set | `preferencesRepository` `PREFERENCE_KEYS` |
| Hook shape | `useCognitiveLoad` loading/error/refetch |

### File structure (expected)

**New (typical):**
- `mobile/src/data/migrations/015_goal_ring_state.ts` (name flexible)
- `mobile/src/components/engagement/GoalRisePrompt.tsx` (+ test)
- Possibly `goalRingRepository.ts` if not folded into cognitive-load repo
- Pure weekly helpers in `core/cognitive-load/` (+ tests)

**Rename / modify:**
- `CognitiveLoadRing.tsx` → `GoalRing.tsx` (+ test, barrel, SessionHeader, Home)
- `loadTracker.ts`, `thresholdCalculator.ts`, `constants.ts`
- `useCognitiveLoad.ts`, `ReviewSessionProvider.tsx`, `lesson/index.tsx`
- `DailyThresholdNotice.tsx` (copy)
- `app/(tabs)/index.tsx` (BUG1 + copy + GoalRing)
- `app/(tabs)/settings.tsx` (unbounded goal)
- `preferencesRepository.ts` (+ tests)
- Related tests listed above

**Explicitly NOT touched for product scope:** streak UI removal, Stats days-studied, post-session share card redesign, Browse/Conversation, forecast/wall.

### Testing requirements

- Core: unclamped percent; weekly proposal; sample guard; rise-only; miss-week offer.
- Repository/prefs: sticky goal round-trip; pending rise/reduction.
- Lesson: `addDailyLoad` invoked on complete.
- Provider: review load still accumulates; percent can exceed 100.
- GoalRing: >100 label, `+N%` badge, a11y “Goal 120 percent”.
- Home: focus refetch (BUG1) — unit or integration coverage if practical; at least remove the skip and assert refetch wiring.
- Settings: set goal above old MAX (e.g. 200) and read back.
- Gate: typecheck, lint, test from `mobile/`.

### Previous story intelligence

- **Epic 2 has no prior story** — foundational prior art is **Story 6.3** (cognitive load ring + migration 008 + `useCognitiveLoad` + review-only `addDailyLoad`) and Home wiring in **6.5**.
- **Story 1.1** established: load / domain counts fire **once per item grade**, not per kanji card — preserve that.
- **Story 1.2** (in progress) touches SessionHeader card progress — GoalRing `small` variant must keep coexisting with `N of M`; do not regress header layout.
- Recent commits are review-engine focused; treat engagement/load files as stable from 6.3 unless this story edits them.

### Git intelligence

Recent work (`5362079`, `66f624a`, …): two-card grading + queue/provider tests. Patterns to mirror: co-located Jest tests, `jest.mock` repos in provider tests, Result-based writes, `__DEV__` warn on best-effort persist failures.

### Project Structure Notes

Aligns with architecture FR55–61 mapping: `core/cognitive-load|goal-ring`, `app/(tabs)/index`, `components/engagement`. Keeping `core/cognitive-load/` path avoids churn; UI rename to `GoalRing` satisfies UX-DR2. Migration number ownership: **this story claims the next free user migration** even though older architecture text reserved `015` for furigana — readiness report explicitly allows goal-ring “when first needed.”

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2 Story 2.1 ACs; UX-DR2, UX-DR28, UX-DR33]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR55–FR57; BUG1/BUG2]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — goal-ring semantics; rule #11; user.db revise]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — GoalRing component; gradient; overshoot]
- [Source: `_bmad-output/planning-artifacts/.decision-log.md` — R1; UX-U7]
- [Source: `_bmad-output/brainstorming/brainstorming-session-2026-07-18-2244.md` — D1–D5, O7–O9, Risk 1]
- [Source: `_bmad-output/implementation-artifacts/6-3-cognitive-load-ring-and-daily-threshold-guidance.md` — prior ring implementation]

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5)

### Debug Log References

- Settings test initially failed because its `useDatabase` mock returned a fresh `{}` per render, re-running the `[userDb]` effect and resetting screen state mid-test; fixed with a stable mock reference.
- `__mocks__/expo-sqlite.ts` extended with `goal_ring_state` insert/select handlers and a date-range + `load > 0` filter for `cognitive_load_history` (the mock is a hand-rolled per-table SQL fake).

### Completion Notes List

- **Storage pattern:** chose a single-row `goal_ring_state` table (migration 015) over prefs keys — one cohesive module (`goalRingRepository`) owns the sticky goal, week anchor, miss counter, and both pending offers. `cognitive_load_history` stays the achievement ledger; its per-row `threshold` column is now informational only.
- **Weekly ratchet:** pure math in `thresholdCalculator.ts` (`computeWeeklyGoalUpdate`, `weekStartKey` — Monday-start local week, `addDaysToKey`); orchestration in `runWeeklyGoalCheck`, driven from `useCognitiveLoad` on read. Rise and reduction are always pending offers — the target is only ever written by user action (accept or Settings). On a carry-forward week (sample < `GOAL_RING_MIN_ACTIVE_DAYS`), unanswered offers are kept pending; a judged week replaces them.
- **Old `computeThreshold`** (daily blend + clamp) removed along with its call sites; `COGNITIVE_LOAD_THRESHOLD_MAX` left in constants with a deprecation comment, unused.
- **BUG2:** lesson `handleNext` sums `computeLoadIncrement` (apprentice/correct) over the planned items and makes one batched `addDailyLoad` call, best-effort, after the streak write. Reviews still write once per item grade (Story 1.1 rule untouched).
- **BUG1:** Home now fetches everything in a single `useFocusEffect` path (fires on initial focus too); the mount effect and `isInitialFocusRef` skip are gone.
- **Ring fidelity (honest scope):** `react-native-svg` was NOT added. Overshoot is expressed via uncapped numeric %, a `+N%` badge (large/hero variants; the 32px small variant has no room), and the cyan `ring-complete` band for ≥90 and all overshoot. True proportional overflow arc remains deferred polish. Hero size raised 144→160.
- **A11y:** default ring label is `Goal ${percent} percent`; `accessibilityValue.max = Math.max(100, percent)` so overshoot is announced uncapped. SessionHeader group label updated to goal language.
- **Prompts:** `GoalRisePrompt` / `GoalReductionPrompt` render on Home only. Rise dismiss hides the current pending value (`dismissedRiseTo`) and keeps the offer pending; a later different pending value reappears. Reduction decline clears the offer and resets the miss counter.
- **Settings:** unbounded "Daily goal" numeric field near Session intensity; validates > 0 inline; intensity changes refresh the displayed seed but never overwrite a user-set goal.

### File List

**New**
- mobile/src/data/migrations/015_goal_ring_state.ts
- mobile/src/data/user/goalRingRepository.ts
- mobile/src/data/user/goalRingRepository.test.ts
- mobile/src/components/engagement/GoalRing.tsx
- mobile/src/components/engagement/GoalRing.test.tsx
- mobile/src/components/engagement/GoalRisePrompt.tsx
- mobile/src/components/engagement/GoalRisePrompt.test.tsx

**Modified**
- mobile/src/config/constants.ts
- mobile/src/core/cognitive-load/loadTracker.ts
- mobile/src/core/cognitive-load/loadTracker.test.ts
- mobile/src/core/cognitive-load/thresholdCalculator.ts
- mobile/src/core/cognitive-load/thresholdCalculator.test.ts
- mobile/src/data/migrations/index.ts
- mobile/src/data/user/cognitiveLoadRepository.ts
- mobile/src/data/hooks/useCognitiveLoad.ts
- mobile/src/data/hooks/useCognitiveLoad.test.tsx
- mobile/src/providers/ReviewSessionProvider.tsx
- mobile/src/components/engagement/index.ts
- mobile/src/components/engagement/DailyThresholdNotice.tsx
- mobile/src/components/engagement/DailyThresholdNotice.test.tsx
- mobile/src/components/review/SessionHeader.tsx
- mobile/src/components/review/SessionHeader.test.tsx
- mobile/src/app/lesson/index.tsx
- mobile/src/app/lesson/index.test.tsx
- mobile/src/app/(tabs)/index.tsx
- mobile/src/app/(tabs)/index.test.tsx
- mobile/src/app/(tabs)/settings.tsx
- mobile/src/app/(tabs)/settings.test.tsx
- mobile/__mocks__/expo-sqlite.ts

**Deleted**
- mobile/src/components/engagement/CognitiveLoadRing.tsx
- mobile/src/components/engagement/CognitiveLoadRing.test.tsx

## Change Log

- 2026-07-20 — Story 2.1 implemented: sticky adaptive goal ring (migration 015 + goalRingRepository), unclamped overshoot percent, weekly active-day-mean ratchet with rise/reduction offers, lesson-flow load recording (BUG2), Home focus refresh (BUG1), GoalRing rename with `+N%` badge and goal a11y, Settings unbounded daily goal, DailyThresholdNotice goal-met copy. Gate: typecheck, lint, 986 tests / 128 suites green.
- 2026-07-20 — Code review patches: exact-mean week = hit; multi-week gap walks intermediate weeks; rise dismiss resets on focus/`pendingRiseTo`; Settings/accept clear both pending offers; Home Result checks before refetch; proposal floored at 1.

---

**Status:** done  
**Completion note:** Implementation complete — all ACs satisfied; code review patches applied (exact-mean hit, multi-week ratchet walk, rise-dismiss reset, pending-offer clears, Result checks, proposal floor).
