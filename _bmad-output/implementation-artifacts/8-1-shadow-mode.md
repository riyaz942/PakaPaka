# Story 8.1: Shadow mode (positioning, stats, switch prompts)

Status: done

---
baseline_commit: 3ef54da
---

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> **First story of Epic 8 (Post-MVP expansion).** Shadow mode is a **UX framing, not a separate engine** — reviews are scheduled by the existing FSRS pipeline exactly as they are today. This story ships the feature **dormant behind a build-level feature flag (`SHADOW_MODE_FEATURE_ENABLED = false`)** so it can be enabled in a future build with zero MVP behavior change. It consolidates original stories 8.1 + 8.2 (both shadow-mode features, small scope). Scope is: (1) a build flag + user preferences, (2) parallel-tool positioning copy, (3) comparison stats (retention / items-across-domains / total time) surfaced in the existing post-session summary, and (4) a non-blocking "ready to switch?" prompt after ≥14 days. **No new SQLite migration** (preferences are key-value), **no changes to queue building, grading, or scheduling.**

## Story

As a **switcher (post-MVP)**,
I want **shadow mode framing with comparative stats and gentle switch prompts after sustained use**,
so that **I can trial the app alongside my existing paid tools (WaniKani/Bunpro) and decide when to commit — with evidence, not faith (FR33i-PM, FR33j-PM, FR33k-PM)**.

## Context: what's already built and what this story creates

Shadow mode reuses infrastructure that already exists — this story is **UI composition + preference plumbing + one small provider extension.** It adds no migration and touches no scheduling code.

**Already built and directly reused (do NOT rebuild):**
- Key-value preference store — `user_preferences` table + `getPreference`/`setPreference` and the boolean getter/setter pattern in `mobile/src/data/user/preferencesRepository.ts` (mirror `getWeaknessBiasEnabled`/`setWeaknessBiasEnabled`, `getNotificationsEnabled`/`setNotificationsEnabled`). **Shadow-mode flags are new keys here — no new table, no new migration.**
- `countImportMetadataRows(userDb)` (`mobile/src/data/user/importRepository.ts`, line ~306) — returns the number of import batches. `> 0` is the credible "this learner imported progress" signal that gates who may enable shadow mode (FR33i-PM).
- `getOnboardingPath(userDb)` (`preferencesRepository.ts`) → `'beginner' | 'manual' | 'import' | null` — secondary import signal.
- Post-session summary route (`mobile/src/app/review/summary.tsx`) and `ReviewSessionProvider.sessionSummary` (`mobile/src/providers/ReviewSessionProvider.tsx`) — already expose `domainCounts`, `itemsReviewed`, `durationMs`, `sessionEndAt`. **You extend the summary with one field (`correctCount`) to derive retention rate; total time and items-across-domains already exist.**
- `formatMinutes(ms)` (`mobile/src/utils/timeFormat.ts`) — reuse for "total time" display; keep it pure.
- Settings screen (`mobile/src/app/(tabs)/settings.tsx`) — the established `Switch` + `useEffect(() => set…State(get…(userDb)), [userDb])` + `handleToggle` pattern for adding a preference toggle. Follow it exactly (labels, `testID`, semantic tokens).
- Home screen (`mobile/src/app/(tabs)/index.tsx`) — composed in story 6.5 with `useFocusEffect` refetch-on-refocus (`isInitialFocusRef` skip-first guard). The switch prompt mounts here below the existing content.
- `Button` (`mobile/src/components/common/Button.tsx`) — variants `primary | secondary | tertiary | ghost | destructive`.
- `mobile/src/components/engagement/index.ts` — barrel that already exports `CognitiveLoadRing`, `StreakCounter`, `TimeCompressionSummary`, etc. New shadow-mode components export from here.

**This story creates:**
- Build flag + tunables in `mobile/src/config/constants.ts`: `SHADOW_MODE_FEATURE_ENABLED` (false), `SHADOW_MODE_SWITCH_PROMPT_DAYS` (14), `SHADOW_MODE_SNOOZE_DAYS`.
- New preference keys + typed getters/setters in `preferencesRepository.ts`: `shadowModeEnabled`, `shadowModeEnabledAt`, `shadowModePromptDismissed`, `shadowModePromptSnoozedUntil`.
- `mobile/src/data/hooks/useShadowMode.ts` — the single source of shadow-mode state/day-math for UI.
- `mobile/src/components/engagement/ShadowModeComparison.tsx` — parallel-tool comparison block for the summary (retention %, items across domains, total minutes + methodology/framing copy).
- `mobile/src/components/engagement/ShadowModeSwitchPrompt.tsx` — non-blocking "ready to switch fully?" card with Commit / Snooze / Dismiss.
- Provider extension: `correctCount` added to `ReviewSessionProvider`'s `SessionSummary`.
- Wiring: comparison in `review/summary.tsx`, toggle in `settings.tsx`, prompt in `(tabs)/index.tsx`, exports in `engagement/index.ts`.

## Acceptance Criteria

**AC1 — Feature ships dormant behind a build flag; no MVP path depends on it (FR33i-PM, epics.md AC "off by default")**
**Given** `SHADOW_MODE_FEATURE_ENABLED = false` in `mobile/src/config/constants.ts` (the default shipped value)
**When** the app runs as built today
**Then** no shadow-mode UI is reachable — no Settings toggle, no comparison block, no switch prompt render, and no shadow-mode code path executes during onboarding, review, or Home
**And** all existing tests (651+) and screens behave identically to before this story (the flag is the only gate; flipping it to `true` is what a future build does).

**AC2 — Parallel-tool positioning without breaking FSRS scheduling (FR33i-PM, epics.md architecture note)**
**Given** `SHADOW_MODE_FEATURE_ENABLED = true` (future build) and a learner who has imported progress (`countImportMetadataRows(userDb) > 0`)
**When** they open Settings
**Then** a "Shadow mode" toggle is shown with copy that positions the app as a **parallel tool** ("try before you commit" / "run alongside your current tools"), not a replacement
**And** enabling it persists `shadow_mode_enabled = true` and records `shadow_mode_enabled_at` (ISO timestamp, set only on the first enable / when currently null)
**And** enabling/disabling shadow mode does **not** alter the review queue builder, FSRS grading, scheduling intervals, or any due-count — reviews are scheduled identically whether shadow mode is on or off (verified: no shadow-mode read inside `srsStateRepository`, the queue builder, `fsrsScheduler`, or `gradeCurrentItem`'s scheduling logic).

**AC3 — Toggle is gated on imported progress (FR33i-PM)**
**Given** `SHADOW_MODE_FEATURE_ENABLED = true`
**When** the learner has **not** imported progress (`countImportMetadataRows(userDb) === 0`)
**Then** the Shadow mode toggle is **not** shown in Settings (shadow mode is a switcher affordance; a fresh-start learner has nothing to compare against).

**AC4 — Comparison stats in the post-session summary when data exists (FR33j-PM)**
**Given** shadow mode is active (`SHADOW_MODE_FEATURE_ENABLED && shadow_mode_enabled`) and a session reviewed ≥1 item
**When** the learner reaches `/review/summary`
**Then** a `ShadowModeComparison` block shows: **retention rate** (correct ÷ items reviewed, as a %), **items covered across domains** (Kanji / Grammar / Vocab counts, sourced from the existing `sessionSummary.domainCounts`), and **total time** this session (from `sessionSummary.durationMs` via `formatMinutes`)
**And** the block frames these as data to compare with the learner's existing tool experience (e.g. "Compare this with your WaniKani/Bunpro session")
**And** when shadow mode is off, the summary renders exactly as it does today (comparison block absent).

**AC5 — Retention rate is derived from real session outcomes**
**Given** the session graded items (Again = incorrect; Hard/Good/Easy = correct, matching the existing `outcomeResult` logic in `gradeCurrentItem`)
**When** the comparison computes retention
**Then** retention = `round(100 × correctCount / itemsReviewed)` using a new `correctCount` on `sessionSummary`, incremented on the **existing async tail** of `gradeCurrentItem` (never on the <100ms answer hot path), and guarded against divide-by-zero (0 items → block not shown / 0%).

**AC6 — Non-blocking switch prompt after ≥14 days, with dismiss and snooze, no forced migration (FR33k-PM)**
**Given** shadow mode active for **≥ `SHADOW_MODE_SWITCH_PROMPT_DAYS` (14)** days (from `shadow_mode_enabled_at`), the prompt not permanently dismissed, and not currently snoozed
**When** the Home screen renders
**Then** a **non-blocking** `ShadowModeSwitchPrompt` appears offering "You've been comparing for X days — ready to switch fully?" with three actions:
- **Commit** ("I'm ready") → sets `shadow_mode_enabled = false` (they've decided; the parallel-tool framing turns off). **No data migration, no destructive action.**
- **Snooze** → hides the prompt for `SHADOW_MODE_SNOOZE_DAYS` (persists `shadow_mode_prompt_snoozed_until`).
- **Dismiss** → hides the prompt permanently (persists `shadow_mode_prompt_dismissed = true`).
**And** the prompt never blocks navigation or gates any screen; ignoring it leaves the app fully usable (no forced conversion — PRD FR33k-PM).

**AC7 — Accessibility & offline (UX-DR philosophy, FR47 offline)**
**Given** any new shadow-mode component
**Then** every interactive control has `accessibilityRole` + `accessibilityLabel`; numeric summaries announce full context (e.g. "Retention rate: 87 percent, 13 of 15 correct"); the "X days" count and each button are screen-reader legible; all copy and computation are fully offline (no network); and NativeWind semantic tokens are used (no raw hex).

## Tasks / Subtasks

- [x] **Task 1 — Build flag + tunable constants (AC: 1, 6)**
  - [x] Add to `mobile/src/config/constants.ts`:
    - `export const SHADOW_MODE_FEATURE_ENABLED = false;` — the "off by default / enabled in a future build" gate. **Ship it `false`.** Add a comment: enabling requires a deliberate future build change.
    - `export const SHADOW_MODE_SWITCH_PROMPT_DAYS = 14;` — days of active shadow mode before the switch prompt appears (FR33k-PM "1–2 weeks").
    - `export const SHADOW_MODE_SNOOZE_DAYS = 7;` — how long a snooze hides the prompt.
  - [x] These are the single source of truth for the thresholds — do not hardcode `14`/`7` anywhere else.

- [x] **Task 2 — Shadow-mode preferences (AC: 2, 3, 6)**
  - [x] In `mobile/src/data/user/preferencesRepository.ts`, add to `PREFERENCE_KEYS`: `shadowModeEnabled: 'shadow_mode_enabled'`, `shadowModeEnabledAt: 'shadow_mode_enabled_at'`, `shadowModePromptDismissed: 'shadow_mode_prompt_dismissed'`, `shadowModePromptSnoozedUntil: 'shadow_mode_prompt_snoozed_until'`.
  - [x] Add typed getters/setters mirroring the existing boolean pattern (`getWeaknessBiasEnabled`/`setWeaknessBiasEnabled`):
    - `getShadowModeEnabled(userDb): boolean` — default `false` when unset.
    - `setShadowModeEnabled(userDb, enabled): void` — writes `'true'`/`'false'`. **On enabling, if `shadow_mode_enabled_at` is currently null, set it to `new Date().toISOString()`** (first-enable timestamp). Do NOT overwrite it on re-enable, and do NOT clear it on disable (so a re-enable keeps continuity — or, document if you choose to reset; prefer preserve).
    - `getShadowModeEnabledAt(userDb): string | null` and `setShadowModeEnabledAt(userDb, iso)`.
    - `getShadowModePromptDismissed(userDb): boolean` / `setShadowModePromptDismissed(userDb, boolean)`.
    - `getShadowModePromptSnoozedUntil(userDb): string | null` / `setShadowModePromptSnoozedUntil(userDb, iso)`.
  - [x] **No migration.** These are `user_preferences` rows created lazily by `setPreference`'s upsert. Confirm `preferencesRepository.test.ts` covers the new getters/setters (default values, round-trip, first-enable stamps `enabled_at` once).

- [x] **Task 3 — `useShadowMode` hook (AC: 1, 2, 3, 6)**
  - [x] Create `mobile/src/data/hooks/useShadowMode.ts`. It reads `useDatabase().userDb` and returns:
    - `isFeatureEnabled: boolean` — `SHADOW_MODE_FEATURE_ENABLED`.
    - `canEnable: boolean` — `isFeatureEnabled && countImportMetadataRows(userDb) > 0` (AC3 gate).
    - `isEnabled: boolean`, `enabledAt: Date | null`, `daysActive: number` (whole days since `enabledAt`, `Math.floor`, 0 when null).
    - `shouldShowSwitchPrompt: boolean` — `isFeatureEnabled && isEnabled && daysActive >= SHADOW_MODE_SWITCH_PROMPT_DAYS && !dismissed && !(snoozedUntil && now < snoozedUntil)`.
    - Actions: `enable()`, `disable()`, `dismissPrompt()`, `snoozePrompt()` (sets snoozed-until = now + `SHADOW_MODE_SNOOZE_DAYS`), plus `refetch()`.
  - [x] Follow the try/catch-in-hook + `useState` shape used by `useStreak`/`useReducedMotion` — never throw across async boundaries; on read error, return safe "off" defaults. Keep DB reads synchronous (`getPreference` is sync) as the other prefs hooks do.
  - [x] Tests (`useShadowMode.test.tsx`): feature-off → everything false; feature-on + no import → `canEnable=false`; enabled 13 days → `shouldShowSwitchPrompt=false`; enabled 14 days → true; dismissed → false; snoozed (future) → false; snooze expired → true. Use the `expo-sqlite` manual mock to control returned preference values and `countImportMetadataRows`.

- [x] **Task 4 — Track `correctCount` in the session summary (AC: 5)**
  - [x] In `mobile/src/providers/ReviewSessionProvider.tsx`: add `correctCount: number` to the `SessionSummary` type and a `correctCountRef` initialized/reset alongside `domainCountsRef` (same reset points at lines ~80/~93).
  - [x] Increment `correctCountRef.current` on the **existing async tail** of `gradeCurrentItem` (right where `domainCountsRef.current[gradedItemType] += 1` happens, ~line 218) **only when `outcomeResult === 'correct'`** (grade !== 1). Do not add work before `setCurrentIndex` — the <100ms answer path must not regress (NFR1/AC5).
  - [x] Include `correctCount: correctCountRef.current` in the assembled `sessionSummary` object (~line 276). Typos never reach `gradeCurrentItem`, so they correctly do not count.
  - [x] Extend `ReviewSessionProvider.test.tsx`: assert `correctCount` increments on Good/Easy grades, does NOT increment on Again (grade 1), and equals items minus incorrect answers.

- [x] **Task 5 — `ShadowModeComparison` component (AC: 4, 5, 7)**
  - [x] Create `mobile/src/components/engagement/ShadowModeComparison.tsx`. Props: `{ domainCounts: Record<ItemType, number>; itemsReviewed: number; correctCount: number; durationMs: number }`.
  - [x] Compute `retentionPercent = itemsReviewed > 0 ? Math.round(100 * correctCount / itemsReviewed) : 0`. If `itemsReviewed === 0`, render nothing (caller also guards).
  - [x] Anatomy: a titled block ("Shadow mode — compare your session") showing retention %, domain counts row (Kanji N | Grammar N | Vocab N; Radical N only when > 0 — mirror `TimeCompressionSummary`), total minutes (`formatMinutes(durationMs)`), and a short framing line ("Compare these with your WaniKani/Bunpro session to see the difference"). Keep copy conservative and non-boastful.
  - [x] Accessibility (AC7): retention carries `accessibilityLabel` like "Retention rate: 87 percent, 13 of 15 correct"; each domain count announces full context ("Kanji: 8 items reviewed"); block has a header role. Semantic tokens only (`bg-surface`, `text-primary`, `text-secondary`, content accents; `space-*`, `radius-*`). No raw hex, no emoji.
  - [x] Export from `mobile/src/components/engagement/index.ts`.
  - [x] Tests (`ShadowModeComparison.test.tsx`): retention math (round), hides radical row at 0, renders domain/time; a11y labels present.

- [x] **Task 6 — Render comparison in the summary when shadow mode is active (AC: 1, 4)**
  - [x] In `mobile/src/app/review/summary.tsx`: read `useShadowMode()`; when `isEnabled` (which is already `false` unless `isFeatureEnabled`) **and** `sessionSummary.itemsReviewed > 0`, render `<ShadowModeComparison … />` inside the existing `itemsReviewed > 0` branch (alongside `TimeCompressionSummary`).
  - [x] When shadow mode is off, the summary is byte-for-byte its current behavior (regression guard). Do not reorder or restyle the existing summary content.
  - [x] Extend the summary test (or add one) to assert: shadow-off → no comparison block; shadow-on + items → comparison present.

- [x] **Task 7 — Settings toggle, gated (AC: 2, 3, 7)**
  - [x] In `mobile/src/app/(tabs)/settings.tsx`: add a "Shadow mode" section following the exact `Switch` pattern used for "Bias reviews toward my weak points". Wire it to `useShadowMode()` (`canEnable`, `isEnabled`, `enable`, `disable`) — or read the prefs directly with the same `useEffect`/state pattern the file already uses; prefer the hook to keep logic in one place.
  - [x] **Only render the section when `canEnable` is true** (feature flag on AND imported). When off, render nothing (AC1/AC3).
  - [x] Copy: title "Shadow mode", subtitle positions parallel use ("Run this app alongside your current tools and compare your results before you fully switch. Nothing is deleted."). Toggle `accessibilityLabel="Shadow mode"`, `testID="settings-shadow-mode-toggle"`.
  - [x] Test (`settings.test.tsx`): with feature flag mocked off → toggle absent; with flag on + import present → toggle present, toggling calls enable/disable. (Mock `SHADOW_MODE_FEATURE_ENABLED` / `countImportMetadataRows` as needed — see Dev Notes on mocking the build constant.)

- [x] **Task 8 — Switch prompt on Home (AC: 6, 7)**
  - [x] Create `mobile/src/components/engagement/ShadowModeSwitchPrompt.tsx`. Props: `{ daysActive: number; onCommit: () => void; onSnooze: () => void; onDismiss: () => void }`.
  - [x] Anatomy: a calm, non-blocking card: headline "You've been comparing for {daysActive} days", body "Ready to switch fully? No rush — nothing changes until you decide.", and three controls — **primary** "I'm ready to switch" (`onCommit`), **tertiary/ghost** "Remind me later" (`onSnooze`), **ghost** "Don't show again" (`onDismiss`). Never a modal that blocks; it's an inline card.
  - [x] Accessibility: card has header role; each button has role + label; the day count is in the accessible label. Semantic tokens only; no emoji.
  - [x] In `mobile/src/app/(tabs)/index.tsx`: read `useShadowMode()`; when `shouldShowSwitchPrompt`, render `<ShadowModeSwitchPrompt daysActive={daysActive} onCommit={disable-then-refetch} onSnooze={snoozePrompt} onDismiss={dismissPrompt} />` (place it below the existing Home content — after the level progress bar). Wire it into the existing `useFocusEffect` refetch so state updates after actions and on refocus.
  - [x] Guard AC1: when the feature flag is off, `shouldShowSwitchPrompt` is always false → prompt never renders; Home is unchanged.
  - [x] Export from `engagement/index.ts`. Tests: `ShadowModeSwitchPrompt.test.tsx` (renders day count, all three callbacks fire); extend `index.test.tsx` — prompt absent when feature off / <14 days, present at ≥14 days.

- [x] **Task 9 — Full verification (AC: all)**
  - [x] Run from `mobile/`: `npm run lint`, `npm run typecheck`, `npm test` — all green (a11y lint gate from story 7.3 applies to the new JSX).
  - [x] Manually confirm (code inspection) that with `SHADOW_MODE_FEATURE_ENABLED = false`, no shadow-mode branch is reachable and no scheduling/queue code reads any shadow-mode preference (AC1/AC2 non-interference).
  - [x] Confirm no new dependency was added and no new migration file was created.

## Dev Notes

### Guiding principle — shadow mode is framing, not an engine (PRD line 345)
The PRD is explicit: *"Shadow mode is a UX framing, not a separate engine — reviews work identically."* This story must **not** touch the review queue builder, FSRS scoring (`0.7 × fsrs + 0.3 × weakness`), scheduling intervals, `gradeCurrentItem`'s scheduling math, or due counts. Shadow mode only (a) toggles copy/visibility, (b) reads the already-computed `sessionSummary`, and (c) reads/writes four preference keys. If any change would alter what/when items are reviewed, it is out of scope and wrong. The only provider change is an **additive counter** (`correctCount`) that has no effect on scheduling.

### Why a build flag AND a user preference
- **Build flag `SHADOW_MODE_FEATURE_ENABLED` (Task 1)** = the epics.md AC "feature flag `shadow_mode` off by default … enabled in a future build" and PRD "Deferred to post-MVP." It guarantees AC1: shipping this story changes nothing observable. A future build flips it to `true`.
- **User preference `shadow_mode_enabled` (Task 2)** = FR33i-PM "Learners who import progress **can enable** shadow mode" — a per-user opt-in, only offered when the build flag is on and the user imported.
- Every UI entry point checks the flag first (usually via `useShadowMode`, which folds the flag into `isEnabled`/`canEnable`/`shouldShowSwitchPrompt`), so no consumer can accidentally render shadow-mode UI in the shipped build.

### No migration — preferences are key-value
`user_preferences` is a `(key, value, updated_at)` table (migration `001_initial.ts`). New settings are just new keys written through `setPreference`'s upsert — exactly how `weakness_bias_enabled`, `notifications_enabled`, `reduced_motion` were added without migrations. **Do not add a `010_*` migration.** The latest migration is `009_streak.ts`; leave `migrations/index.ts` untouched.

### Detecting "imported progress" (FR33i-PM gate)
Use `countImportMetadataRows(userDb) > 0` (`importRepository.ts` ~line 306 — `SELECT COUNT(*) FROM import_metadata`). This is the most direct signal: any WaniKani/Bunpro/Anki import writes an `import_metadata` row (story 3.x). `getOnboardingPath(userDb) === 'import'` is a weaker secondary signal (a user could import outside onboarding), so prefer the count. Keep this read in `useShadowMode` so the gate lives in one place.

### Retention rate — the only new datum needed (FR33j-PM)
`sessionSummary` already has `domainCounts` (items across domains) and `durationMs` (total time). The missing piece for FR33j-PM is **retention rate**, which needs a correct-answer count. `gradeCurrentItem` already computes `outcomeResult: 'correct' | 'incorrect'` (line ~154; `grade === 1` is Again = incorrect). Add a `correctCountRef` and increment it on the **same async tail** where `domainCountsRef` is incremented (line ~218) so the hot path is untouched (NFR1: <100ms feedback, "no work before `setCurrentIndex`"). Retention = `round(100 × correctCount / itemsReviewed)`; guard `itemsReviewed === 0`.

### Switch-prompt logic (FR33k-PM) — non-blocking, no forced conversion
PRD FR33k-PM: *"'You've been comparing for X days — ready to switch fully?' without forcing a decision."* The prompt is an **inline Home card**, never a modal/gate. Three outcomes, all persisted so the prompt doesn't nag:
- **Commit** → `setShadowModeEnabled(false)`. "Switching fully" is purely turning off the parallel-tool framing — **there is no migration** (all the user's data already lives in `user.db`; shadow mode never forked it). This is the whole point of the PRD's "UX framing, not a separate engine."
- **Snooze** → `shadow_mode_prompt_snoozed_until = now + SHADOW_MODE_SNOOZE_DAYS`.
- **Dismiss** → `shadow_mode_prompt_dismissed = true` (permanent).
`daysActive` = whole days since `shadow_mode_enabled_at` (`Math.floor((now - enabledAt) / 86_400_000)`). Wall-clock day math is acceptable here (same posture as stories 6-3/6-4 for streak/threshold — see `deferred-work.md`); do not over-engineer timezone/DST handling for a post-MVP nudge.

### Mocking the build constant in tests
`SHADOW_MODE_FEATURE_ENABLED` is a module-level `const`. For tests that need it `true` (comparison, settings toggle, prompt-present cases), use `jest.mock('@/config/constants', () => ({ ...jest.requireActual('@/config/constants'), SHADOW_MODE_FEATURE_ENABLED: true }))` (or `jest.spyOn` via a getter if you prefer). Keep the **default** (unmocked) tests asserting the off/dormant behavior so AC1 is regression-guarded by the majority of the suite. Prefer driving `useShadowMode` states through the `expo-sqlite` mock (preference values + `countImportMetadataRows`) so component tests can pass explicit props instead of mocking the flag everywhere.

### Architecture compliance
- **Hook** in `data/hooks/` (`useShadowMode.ts`), **preference logic** in `data/user/preferencesRepository.ts`, **visual components** in `components/engagement/` exported via its `index.ts` — matches the layering used by streak/cognitive-load/time-compression features (architecture.md data-layer + engagement-component conventions).
- **Result type not required** — no new fallible network/FS operations; preference reads/writes are synchronous SQLite via existing helpers. Hook uses the try/catch-in-hook + safe-default pattern (no throwing across async boundaries).
- **NativeWind semantic tokens only** — `bg-background`/`bg-surface`/`bg-surface-elevated`, `text-primary`/`text-secondary`, content accents `content-kanji`/`content-vocabulary`/`content-grammar`, `space-*`, `radius-*`, typography scale. No raw hex; `theme.ts` only for layout constants.
- **a11y lint gate (story 7.3)** — every `Pressable`/`Button`/touchable in the new components needs `accessibilityRole` + `accessibilityLabel` or `npm run lint` fails (`react-native-a11y/has-accessibility-props`). No emoji (CLAUDE.md).
- **FSRS/scheduling untouched** — this is the load-bearing architectural constraint (PRD line 345). Reviewers should verify no shadow-mode symbol is imported by `srsStateRepository.ts`, the queue builder, `core/srs/fsrsScheduler.ts`, or `gradeCurrentItem`'s scheduling branch.

### File structure — new / modified
**New:**
- `mobile/src/data/hooks/useShadowMode.ts` (+ `useShadowMode.test.tsx`)
- `mobile/src/components/engagement/ShadowModeComparison.tsx` (+ `.test.tsx`)
- `mobile/src/components/engagement/ShadowModeSwitchPrompt.tsx` (+ `.test.tsx`)

**Modified:**
- `mobile/src/config/constants.ts` — build flag + prompt/snooze day constants
- `mobile/src/data/user/preferencesRepository.ts` (+ test) — 4 new keys + getters/setters
- `mobile/src/providers/ReviewSessionProvider.tsx` (+ test) — additive `correctCount` on `SessionSummary`
- `mobile/src/app/review/summary.tsx` — render `ShadowModeComparison` when active
- `mobile/src/app/(tabs)/settings.tsx` (+ test) — gated Shadow mode toggle
- `mobile/src/app/(tabs)/index.tsx` (+ test) — render `ShadowModeSwitchPrompt` when due
- `mobile/src/components/engagement/index.ts` — export new components

### Reuse map (do NOT reinvent)
| Need | Reuse |
|------|-------|
| Boolean preference get/set | `getWeaknessBiasEnabled`/`setWeaknessBiasEnabled` pattern in `preferencesRepository.ts` |
| Timestamp preference | `getPreference`/`setPreference` + ISO string (mirror `notification_reminder_time` string storage) |
| "Did the user import?" | `countImportMetadataRows(userDb)` (`importRepository.ts`) |
| Items across domains / total time | existing `sessionSummary.domainCounts` + `sessionSummary.durationMs` |
| Minutes formatting | `formatMinutes(ms)` (`utils/timeFormat.ts`) |
| Correct/incorrect classification | existing `outcomeResult` in `gradeCurrentItem` (grade 1 = incorrect) |
| Settings toggle UX | `Switch` block pattern in `settings.tsx` (weakness bias / notifications) |
| Home refetch-on-refocus | `useFocusEffect` + `isInitialFocusRef` in `(tabs)/index.tsx` (from story 6.5) |
| Buttons | `Button` (`primary`/`tertiary`/`ghost`) |
| Component barrel | `components/engagement/index.ts` |
| Jest DB mock | `mobile/__mocks__/expo-sqlite.ts` |

### Testing requirements
- Co-located `.test.ts`/`.test.tsx`; run `npm run lint && npm run typecheck && npm test` from `mobile/`.
- **Keep most tests on the dormant path** (flag unmocked = false) so AC1 stays guarded: settings without toggle, summary without comparison, Home without prompt.
- Flag-on tests mock `@/config/constants` (see "Mocking the build constant").
- `useShadowMode.test.tsx` drives day-math and gating via the `expo-sqlite` mock preference values + `countImportMetadataRows`; cover the 13-vs-14-day boundary, dismissed, snoozed-future, snoozed-expired.
- `ReviewSessionProvider.test.tsx` extends the existing grade-counting assertions to `correctCount` (increments on non-Again, not on Again, not on typo).
- Pure retention math tested inside `ShadowModeComparison.test.tsx` (round, divide-by-zero guard).

### Project Structure Notes
- One package touched: `mobile/`. No repo-root `scripts/` or curriculum changes.
- No new migration; latest remains `009_streak.ts`.
- No new dependency; RN `Share` and existing hooks/components cover everything.
- Path alias `@/*` → `mobile/src/*`; `@/config/constants`, `@/data/hooks/useShadowMode`, `@/components/engagement`.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.1 (lines 1030–1048)] — user story + AC (feature flag off by default, parallel-tool positioning without breaking FSRS, comparison metrics when data exists, ≥14-day non-blocking prompt with dismiss/snooze, no forced migration).
- [Source: _bmad-output/planning-artifacts/prd.md — Shadow Mode FR33i-PM/FR33j-PM/FR33k-PM (lines 622–626); "UX framing, not a separate engine … reviews work identically" (line 345); "try before you commit" (lines 304–305, 495)].
- [Source: _bmad-output/planning-artifacts/architecture.md (line 40)] — post-MVP `-PM` features "should not constrain MVP architecture but the data model should not preclude them" (key-value prefs satisfy this).
- [Source: _bmad-output/implementation-artifacts/6-5-post-session-summary-and-home-screen-composition.md] — `sessionSummary` shape, summary route, Home composition + `useFocusEffect` refetch; note (line 152) "Shadow-mode comparison stats (FR33j-PM) are Epic 8."
- [Source: mobile/src/providers/ReviewSessionProvider.tsx] — `SessionSummary` type (~25), `domainCountsRef` reset (~80/93), `outcomeResult` (~154), async-tail increment (~218), assembled `sessionSummary` (~276).
- [Source: mobile/src/app/review/summary.tsx] — current summary render + `itemsReviewed > 0` branch.
- [Source: mobile/src/data/user/preferencesRepository.ts] — `PREFERENCE_KEYS`, `getPreference`/`setPreference`, boolean getter/setter pattern (`getWeaknessBiasEnabled` ~132), `getOnboardingPath` (~109).
- [Source: mobile/src/data/user/importRepository.ts] — `countImportMetadataRows` (~306).
- [Source: mobile/src/app/(tabs)/settings.tsx] — Switch section pattern (weakness bias, notifications, reduced motion).
- [Source: mobile/src/app/(tabs)/index.tsx] — Home composition + `useFocusEffect`/`isInitialFocusRef` refetch.
- [Source: mobile/src/utils/timeFormat.ts] — `formatMinutes`.
- [Source: CLAUDE.md#Styling / #CI] — semantic tokens, a11y lint gate, no-emoji policy.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (bmad-dev-story)

### Debug Log References

- `npm run lint` — pass (0 findings)
- `npm run typecheck` — pass (`tsc --noEmit`, 0 errors)
- `npm test` — pass (102 suites, 692 tests)
- Manual grep verification: no `shadow` symbol referenced in `srsStateRepository.ts`, `fsrsScheduler.ts`, `queueBuilder.ts`, or `useReviewQueue.ts` (AC1/AC2 non-interference).

### Completion Notes List

- Implemented shadow mode fully dormant behind `SHADOW_MODE_FEATURE_ENABLED = false` (Task 1). No behavior change today; a future build flips the flag.
- Added 4 new key-value preference keys + typed getters/setters in `preferencesRepository.ts` (no migration — reuses existing `user_preferences` upsert pattern). First-enable-only timestamp semantics verified by test.
- `useShadowMode.ts` hook centralizes the build-flag gate, the FR33i-PM import gate (`countImportMetadataRows`), day-math for the switch prompt, and all four preference actions (`enable`/`disable`/`dismissPrompt`/`snoozePrompt`). When the build flag is off, the hook's effect never touches the database — zero shadow-mode DB reads in the shipped build.
- Added an additive `correctCount` counter to `ReviewSessionProvider`'s `SessionSummary`, incremented synchronously alongside the existing `domainCountsRef` increment (immediately before `setCurrentIndex`, after the fire-and-forget persist promise is kicked off) — the <100ms answer path is unaffected. Verified with dedicated tests (increments on Good/Easy, not on Again, not on typo).
- Built `ShadowModeComparison` (summary) and `ShadowModeSwitchPrompt` (Home) components, exported via `components/engagement/index.ts`, following the existing `TimeCompressionSummary`/`Button` conventions (semantic tokens only, full-context `accessibilityLabel`s, no emoji).
- Wired: `review/summary.tsx` renders the comparison block only when `useShadowMode().isEnabled && itemsReviewed > 0`; `(tabs)/settings.tsx` renders the toggle only when `canEnable` is true; `(tabs)/index.tsx` renders the switch prompt only when `shouldShowSwitchPrompt` is true and refetches shadow-mode state in the existing `useFocusEffect` refetch-on-refocus.
- Testing strategy per Dev Notes: the majority of new/updated tests exercise the dormant (flag-off) path so AC1 stays regression-guarded by default; a smaller set of flag-on tests cover the enabled-path logic, using a `jest.mock('@/config/constants', ...)` with a mutable outer variable read through a getter defined via `Object.defineProperty` (a plain object-literal `get` accessor combined with `...jest.requireActual(...)` spread silently lost the live closure under this project's Babel/Jest object-spread transform — confirmed via isolated repro; `Object.defineProperty` after the spread does not have this problem and is what `useShadowMode.test.tsx` and `preferencesRepository`-adjacent tests use).
- No new dependency added; no new migration file created (latest remains `009_streak.ts`).

### File List

**New:**
- `mobile/src/data/hooks/useShadowMode.ts`
- `mobile/src/data/hooks/useShadowMode.test.tsx`
- `mobile/src/components/engagement/ShadowModeComparison.tsx`
- `mobile/src/components/engagement/ShadowModeComparison.test.tsx`
- `mobile/src/components/engagement/ShadowModeSwitchPrompt.tsx`
- `mobile/src/components/engagement/ShadowModeSwitchPrompt.test.tsx`
- `mobile/src/app/review/summary.test.tsx`

**Modified:**
- `mobile/src/config/constants.ts`
- `mobile/src/data/user/preferencesRepository.ts`
- `mobile/src/data/user/preferencesRepository.test.ts`
- `mobile/src/providers/ReviewSessionProvider.tsx`
- `mobile/src/providers/ReviewSessionProvider.test.tsx`
- `mobile/src/app/review/summary.tsx`
- `mobile/src/app/(tabs)/settings.tsx`
- `mobile/src/app/(tabs)/settings.test.tsx`
- `mobile/src/app/(tabs)/index.tsx`
- `mobile/src/app/(tabs)/index.test.tsx`
- `mobile/src/components/engagement/index.ts`

## Change Log

- 2026-07-02: Story 8.1 drafted (create-story) — shadow mode shipped dormant behind `SHADOW_MODE_FEATURE_ENABLED`; build flag + preferences + `useShadowMode` hook, comparison stats in post-session summary (retention/domains/time), gated Settings toggle, non-blocking ≥14-day switch prompt. No migration, no scheduling changes.
- 2026-07-02: Story 8.1 implemented (dev-story) — all 9 tasks complete. Build flag + tunables, 4 preference keys + getters/setters, `useShadowMode` hook, additive `correctCount` on `ReviewSessionProvider`, `ShadowModeComparison` + `ShadowModeSwitchPrompt` components, gated Settings toggle, non-blocking Home switch prompt. Verified no shadow-mode symbol is read by the queue builder, FSRS scheduler, or SRS state repository. `npm run lint`, `npm run typecheck`, `npm test` all pass (102 suites, 692 tests). Status → review.
- 2026-07-02: Story 8.1 code-reviewed (code-review, fresh session) — adversarial review against all 7 ACs and 9 tasks, cross-checked File List against `git status` (exact match, no drift), independently re-verified the FSRS/queue-builder non-interference claim via grep (`shadow` absent from `queueBuilder.ts`, `fsrsScheduler.ts`, `srsStateRepository.ts`, `useReviewQueue.ts` — only pre-existing `getWeaknessBiasEnabled` read remains in `useReviewQueue.ts`, unrelated). Zero HIGH, zero MEDIUM, zero LOW findings — no fixes required. `npm run lint`, `npm run typecheck`, `npm test` re-confirmed green (102 suites, 692 tests). Status → done.

## Senior Developer Review (AI)

**Reviewer:** bmad-code-reviewer (fresh session, Claude Sonnet 5)
**Date:** 2026-07-02
**Outcome:** **Approve** — zero HIGH/MEDIUM/LOW findings, no fixes required.

### Scope of review
Full diff for all 18 files in the dev handoff's `files_changed` list, cross-checked against `git status --porcelain -uall` (exact match — no untracked/modified files outside the declared File List, no drift). All 9 tasks and all 7 ACs verified individually against the actual code (not taken on faith from the Dev Agent Record).

### AC-by-AC verification
- **AC1 (dormant by default):** Confirmed. `useShadowMode`'s `useEffect` returns before any DB read when `SHADOW_MODE_FEATURE_ENABLED` is false; all four action callbacks (`enable`/`disable`/`dismissPrompt`/`snoozePrompt`) also short-circuit before any write. Every UI entry point (`settings.tsx`, `index.tsx`, `summary.tsx`) gates rendering on hook-derived booleans that fold in the flag. Full suite (692 tests) green with the flag at its shipped default.
- **AC2 (parallel-tool positioning, FSRS non-interference):** Independently re-ran the grep the dev's notes claimed — confirmed zero `shadow` references in `queueBuilder.ts`, `fsrsScheduler.ts`, `srsStateRepository.ts`, `useReviewQueue.ts` (the only preference read in `useReviewQueue.ts` is the pre-existing `getWeaknessBiasEnabled`, unrelated to this story). `setShadowModeEnabled` correctly stamps `shadow_mode_enabled_at` only when currently null (verified against `getShadowModeEnabledAt(userDb) === null` guard).
- **AC3 (gated on imported progress):** `canEnable = SHADOW_MODE_FEATURE_ENABLED && countImportMetadataRows(userDb) > 0`; Settings only renders the section when `shadowModeCanEnable` is true. Test coverage confirms toggle absence/presence for both branches.
- **AC4/AC5 (comparison stats, retention math):** `ShadowModeComparison` computes `Math.round(100 * correctCount / itemsReviewed)` with an `itemsReviewed === 0` early return (divide-by-zero guarded, tested at the 2/3 → 67% rounding boundary). `correctCount` increments in `ReviewSessionProvider.gradeCurrentItem` only when `grade !== 1`, synchronously alongside the pre-existing `domainCountsRef` increment and strictly before `setCurrentIndex` — identical performance profile to the counter it sits beside, so the <100ms hot path is not regressed (this mirrors, not duplicates, the pre-existing pattern). Verified `recordTypoForCurrentItem` does not touch `correctCountRef` (dedicated test present).
- **AC6 (14-day non-blocking switch prompt):** Day-math (`Math.floor`, `MS_PER_DAY = 86_400_000`) verified correct at the 13/14-day boundary via dedicated tests. Commit → `disable()` (turns off `shadow_mode_enabled`, preserves `enabled_at`, no migration). Snooze → persists `snoozed_until = now + SHADOW_MODE_SNOOZE_DAYS`. Dismiss → persists permanent `prompt_dismissed`. Prompt is a plain inline `View`, never a modal — confirmed no `Modal`/gating import in `ShadowModeSwitchPrompt.tsx` or its Home wiring.
- **AC7 (accessibility/offline):** Every interactive control (`Switch`, three `Button`s) carries `accessibilityRole`/`accessibilityLabel`; numeric summaries use full-context labels (e.g. "Retention rate: 87 percent, 13 of 15 correct"). Confirmed zero raw hex and zero emoji in all new files via grep. `npx eslint` run directly against the six touched/new UI files individually — clean, confirming the a11y lint gate (`eslint-plugin-react-native-a11y`) is actually satisfied, not just assumed from the dev's summary.

### Claims verified as true (per reviewer instructions, not taken on faith)
- **No migration:** Confirmed — `preferencesRepository.ts` changes are pure `PREFERENCE_KEYS` additions + `getPreference`/`setPreference` upsert calls; `migrations/index.ts` untouched, latest migration remains `009_streak.ts`.
- **Flag left at `false`:** Confirmed in `constants.ts` — intentional per story framing, not a gap.
- **`Object.defineProperty` test-mocking pattern:** Confirmed necessary and correctly used in `useShadowMode.test.tsx` (and mirrored in `settings.test.tsx`/`index.test.tsx`/`summary.test.tsx` via direct hook mocks instead) — a live-closure getter over a mutable flag variable, standard test-infra technique, not a scope concern.

### File List / git reality cross-check
`git status --porcelain -uall` output matches the story's File List exactly (7 new + 11 modified application/test files, plus the story file itself and `sprint-status.yaml` which are correctly excluded from the File List as meta-files). No orphaned or undeclared changes.

### Verification run (post-review, no fixes needed)
- `npm run lint` — pass, 0 findings
- `npm run typecheck` — pass, 0 errors
- `npm test` — pass, 102 suites, 692 tests

### Notes for future stories
None — this is a template-quality post-MVP feature-flagged story: correct dormancy guarantee, correct additive-only provider change, correct reuse of every existing helper called out in the Dev Notes reuse map, and test coverage that actually exercises the dormant path as the majority case (guarding AC1 by default) per the story's own testing strategy.
