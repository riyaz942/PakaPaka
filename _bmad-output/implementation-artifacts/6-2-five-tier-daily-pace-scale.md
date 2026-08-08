---
baseline_commit: db48fbae7b74339710bb3a04a7409ffc4d00f4b2
---

# Story 6.2: Five-Tier Daily Pace Scale

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a learner setting my daily pace,
I want to choose from a wider range of daily study intensities instead of just two,
so that my pace matches how much time I actually have, without over- or under-shooting the two extremes.

## Acceptance Criteria

1. **Five tiers, not two.** `SessionIntensity` widens from `'relaxed' | 'intense'` to `'light' | 'relaxed' | 'steady' | 'intense' | 'immersive'`, ordered lightest → heaviest. `SESSION_INTENSITY_VALUES` lists all five in that order.

2. **Relaxed and Intense keep their exact current numbers.** `SESSION_INTENSITY_MINUTES` stays `relaxed: 15, intense: 30`; `LESSON_SIZE_BY_INTENSITY` stays `relaxed: 5, intense: 10`; `COGNITIVE_LOAD_THRESHOLD_BASE` stays `relaxed: 30, intense: 55`. A stored preference must not silently change meaning under an existing user.

3. **Every `Record<SessionIntensity, number>` map gains all five keys.** Concretely: `SESSION_INTENSITY_MINUTES` and `COGNITIVE_LOAD_THRESHOLD_BASE` (`config/constants.ts`), `LESSON_SIZE_BY_INTENSITY` (`core/lesson/lessonPlanner.ts`). Use the values in **Dev Notes → Tier table** — do not invent your own. TypeScript's exhaustive `Record` check is the safety net; no map may be left with 2 of 5 keys.

4. **One `SessionIntensity` type, not two.** `core/cognitive-load/cognitiveLoad.types.ts` currently declares a second, hand-synced copy of the union. It must stop declaring its own and re-export the canonical `data/user/sessionIntensity.types` type instead, so the two can never drift. (`goalRingRepository.ts:69` already passes a `data/user` value into `initialGoalForIntensity`, which is typed against the `cognitive-load` copy — this only compiles today because the two unions happen to be identical.)

5. **No second new-items map.** The per-tier "new items" figure shown in the picker is read from `LESSON_SIZE_BY_INTENSITY`, and the minutes figure from `SESSION_INTENSITY_MINUTES`. Do **not** add a `SESSION_INTENSITY_NEW_ITEMS` map — it would be a display-only duplicate of `LESSON_SIZE_BY_INTENSITY` free to drift from the lesson size the learner actually gets. See Dev Notes → *Deviation from the epic*.

6. **Vertical single-column picker.** `SessionIntensityPicker` renders five rows in a single column (drop `flex-row` from the container **and** `flex-1` from each `ChoiceCard` — `flex-1` on children of a column parent stretches rows to fill height). Container keeps `accessibilityRole="radiogroup"`; each row stays a `ChoiceCard` (already `accessibilityRole="radio"` with `accessibilityState={{ selected, checked }}` and `min-h-[44px]`). Reuse `ChoiceCard` as-is — it takes `className` externally and makes no internal row/column assumption.

7. **Both surfaces use the same widened picker.** `app/onboarding/intensity.tsx` and the Settings › Session pace row (`app/(tabs)/settings.tsx:239`) both render `SessionIntensityPicker` with the same five options. One option list, not two copies. Neither screen needs logic changes.

8. **"Recommended for new learners" badge stays on Relaxed only.** Unchanged from today.

9. **Stored legacy values keep working with no migration.** A `user.db` row holding `session_intensity = 'relaxed'` or `'intense'` still passes `isSessionIntensity`, still resolves to the same minutes / lesson size / threshold, and the learner is never forced to re-pick. No new migration file.

10. **Existing fallbacks unchanged.** `LESSON_SIZE_BY_INTENSITY[intensity ?? 'relaxed']` (`lessonPlanner.ts:34`, `lessonAllowance.ts:35`, `intensity.tsx:21`) and `getSessionIntensity(userDb) ?? 'relaxed'` (`goalRingRepository.ts:69`) all keep `'relaxed'` as the default. Adding a lighter tier does **not** move the default.

11. **Onboarding default selection stays Relaxed.** `intensity.tsx` still pre-selects `'relaxed'` on mount and Continue is enabled immediately.

12. **Tests extended, not replaced.** `SessionIntensityPicker.test.tsx` (asserts exactly 2 radios today — must become 5, with each tier's title asserted), `intensity.test.tsx`, `sessionIntensity.types.test.ts`, `lessonPlanner.test.ts`, `thresholdCalculator.test.ts`, `lessonAllowance.test.ts`. Existing single-tier assertions for relaxed/intense must keep passing **unmodified** — they are the AC #2 regression net.

13. **Verify green.** `npm run lint && npm run typecheck && npm test` in `mobile/`. No new color tokens are introduced, so `npm run check-contrast` at repo root is expected to be unaffected — run it only if you touch a token.

**Explicitly out of scope (do not implement):**

- **Placement-based recommendation line** ("Based on your placement check, we suggest Steady"). Onboarding order is `intensity` → `placement`, and placement is skipped entirely on the beginner and import paths — pace is chosen *before* any placement data exists. Wiring this needs an onboarding reorder; separate story.
- **Re-offering the pace screen after the first real lesson.** Same reasoning; separate story.
- **Splitting pace into separate new-items and reviews-per-day controls** (brainstorm idea, not chosen).
- **Fixing the Light-tier grammar starvation** described in Dev Notes → *Known consequence*. Document it; do not change `planLesson`'s round-robin in this story.

## Tasks / Subtasks

- [x] Task 1 — Widen the canonical type (AC: #1, #4, #9)
  - [x] `data/user/sessionIntensity.types.ts`: widen `SessionIntensity` and `SESSION_INTENSITY_VALUES` to the five literals in lightest→heaviest order. `isSessionIntensity` needs no change (it derives from `SESSION_INTENSITY_VALUES`).
  - [x] `core/cognitive-load/cognitiveLoad.types.ts`: delete the duplicate union; replace with `export type { SessionIntensity } from '@/data/user/sessionIntensity.types';`. Leave `LoadOutcome` and `DailyLoad` untouched.
  - [x] Confirm `thresholdCalculator.ts`'s existing `import type { SessionIntensity } from './cognitiveLoad.types'` still resolves — do not change its import path.

- [x] Task 2 — Extend the three numeric maps (AC: #2, #3, #10)
  - [x] `config/constants.ts`: `SESSION_INTENSITY_MINUTES` → 5 keys; `COGNITIVE_LOAD_THRESHOLD_BASE` → 5 keys. Update the `COGNITIVE_LOAD_THRESHOLD_BASE` doc comment so it explains the five-tier scale rather than the old two.
  - [x] `core/lesson/lessonPlanner.ts`: `LESSON_SIZE_BY_INTENSITY` → 5 keys.
  - [x] Use exactly the values in Dev Notes → Tier table. Leave `?? 'relaxed'` fallbacks alone.

- [x] Task 3 — Widen the picker to five vertical rows (AC: #5, #6, #7, #8)
  - [x] `components/onboarding/SessionIntensityPicker.tsx`: `INTENSITY_OPTIONS` grows to 5 entries in lightest→heaviest order; keep `badge: 'Recommended for new learners'` on `relaxed` only.
  - [x] Replace the hardcoded `sublabel` strings with a value derived from `SESSION_INTENSITY_MINUTES` + `LESSON_SIZE_BY_INTENSITY` (see Dev Notes → Sublabel copy for the exact format). This gives `SESSION_INTENSITY_MINUTES` its first real consumer — it has none today.
  - [x] Container: `className="gap-space-sm"` (drop `flex-row`). Each `ChoiceCard`: drop `className="flex-1"`.
  - [x] Do not touch `ChoiceCard.tsx`.

- [x] Task 4 — Test coverage (AC: #12)
  - [x] `SessionIntensityPicker.test.tsx`: `getAllByRole('radio')` → 5; assert all five titles render and the selected-state assertions still hold. Keep the existing `intensity` press test.
  - [x] `sessionIntensity.types.test.ts`: accept all five literals; keep the existing reject cases (`'standard'`, `'Relaxed'`, `''`, `'intense '`) passing untouched — note `'standard'` is still invalid, the new tier is `'steady'`.
  - [x] `lessonPlanner.test.ts` / `thresholdCalculator.test.ts` / `lessonAllowance.test.ts`: add one assertion per new tier alongside the existing relaxed/intense ones. Leave the existing ones byte-for-byte.
  - [x] `intensity.test.tsx`: add a case selecting a new tier (e.g. `light` or `immersive`) that asserts it persists via `getSessionIntensity`. Existing relaxed/intense persistence + routing cases stay unmodified.
  - [x] `data/user/preferencesRepository.test.ts`: extend the round-trip to cover one new tier. The `setSessionIntensity(db, 'standard' as 'relaxed')` throw case stays valid as-is.

- [x] Task 5 — Verify (AC: #13)
  - [x] `npm run lint && npm run typecheck && npm test` in `mobile/` all green.
  - [x] Sanity-read Settings › Session and the onboarding pace screen for five stacked cards — no horizontal squeeze, no stretched rows.

### Review Findings

- [x] [Review][Decision→Patch] Onboarding pace screen overflows on small devices — five stacked `ChoiceCard`s + lesson-preview + Banner inside non-scrolling `OnboardingStep` (`OnboardingStep.tsx:60-76`, `flex-1` + RN `flexShrink: 0` default) clipped bottom cards on ~667pt screens. Resolved per Riyaz: children now render in a `ScrollView` inside `OnboardingStep`, fixing all four onboarding screens.
- [x] [Review][Patch] `SESSION_INTENSITY_MINUTES` values have no pinning test — the old `'~15 min/day'` / `'~30 min/day'` assertions were replaced by a loop that builds the expected string from the map itself (tautological), weakening the AC #2 regression net for the minutes map. Fixed: added `pins the minutes for each tier` asserting all five values explicitly. [mobile/src/components/onboarding/SessionIntensityPicker.test.tsx]
- [x] [Review][Patch] Python spotcheck port of `planLesson` only simulates the two legacy sizes — `LESSON_SIZES` extended to all five tiers; script re-runs clean. [curriculum/_build/import/spotcheck_allowed_vocab.py:35]
- [x] [Review][Defer] "Recommended for new learners" badge invisible to screen readers — `ChoiceCard` builds `accessibilityLabel` from title + description only; badge is decorative. [mobile/src/components/common/ChoiceCard.tsx:39] — deferred, pre-existing
- [x] [Review][Defer] Stale goal ring on intensity downgrade amplified by wider range — immersive→light leaves a sticky goal 5.3× the new base until the weekly ratchet reduces it. [mobile/src/data/user/goalRingRepository.ts:64-70] — deferred, pre-existing
- [x] [Review][Defer] Downgrade forward-compat gap — an older build rejects newly stored tiers (`light`/`steady`/`immersive`) → `getSessionIntensity` returns null → user bounced back to `/onboarding/intensity`. [mobile/src/hooks/useOnboardingRedirect.ts:46-60] — deferred, pre-existing

## Dev Notes

### Tier table — use these exact values

| Tier | Literal | Minutes (`SESSION_INTENSITY_MINUTES`) | New items (`LESSON_SIZE_BY_INTENSITY`) | Threshold base (`COGNITIVE_LOAD_THRESHOLD_BASE`) |
| --- | --- | --- | --- | --- |
| Light | `light` | 5 | 3 | 15 |
| Relaxed | `relaxed` | **15** (unchanged) | **5** (unchanged) | **30** (unchanged) |
| Steady | `steady` | 22 | 7 | 42 |
| Intense | `intense` | **30** (unchanged) | **10** (unchanged) | **55** (unchanged) |
| Immersive | `immersive` | 45 | 15 | 80 |

Minutes and new-item counts come from the epic. Threshold bases for the three new tiers are interpolated from the two anchors the epic pins (relaxed 30 @ 15 min, intense 55 @ 30 min → ≈1.67 load units per minute, intercept ≈5), rounded to a round number and kept strictly monotonic. Do not re-derive; these are the story's numbers.

`COGNITIVE_LOAD_THRESHOLD_MIN` (20) and `COGNITIVE_LOAD_THRESHOLD_ADAPTATION_GAIN` are declared in `config/constants.ts` but have **zero consumers today** (verified by repo-wide search) — so `light: 15` sitting below that "floor" has no runtime effect. Do not add clamping logic to make them agree, and do not delete them (pre-existing dead code, out of scope per CLAUDE.md §3).

### Sublabel copy — derive, don't hardcode

Today each option hardcodes its sublabel string (`'~15 min/day'`) while `SESSION_INTENSITY_MINUTES` holds the same 15 with no consumer. Derive it instead so the five tiers cannot disagree with the maps:

```ts
`~${SESSION_INTENSITY_MINUTES[value]} min/day · ${LESSON_SIZE_BY_INTENSITY[value]} new items`
```

`intensity.tsx` already imports `LESSON_SIZE_BY_INTENSITY` from `@/core/lesson/lessonPlanner` (line 9), so a component importing that module is established precedent — no boundary violation.

**Copy note:** the epic writes Light as "2–3 new items". Deriving yields "3 new items". This is deliberate — a hardcoded "2–3" would be a display string contradicting the actual `light: 3` lesson size. Flagged for Riyaz below; implement the derived form.

### Deviation from the epic — no `SESSION_INTENSITY_NEW_ITEMS`

The epic asks for a new `SESSION_INTENSITY_NEW_ITEMS: Record<SessionIntensity, number>` map, on the stated grounds that "no existing map covers this today". That premise is wrong: `LESSON_SIZE_BY_INTENSITY` is `relaxed: 5, intense: 10` — exactly the epic's per-tier new-item figures — and `intensity.tsx:21,57` already renders it as *"Today's lesson at this pace: **5 new items**"*. A parallel display-only map would be two sources of truth for one number, free to drift from the lesson the learner actually receives. AC #5 forbids it. If product later wants the picker to advertise a figure that deliberately differs from the real lesson size, that is a product decision needing its own story.

### Known consequence — Light starves grammar in steady state

`planLesson`'s floor pass (`lessonPlanner.ts:89-97`) reserves one slot per type in `ROUND_QUOTAS` order: radical → kanji → vocabulary → grammar. At `size: 3` the first three types consume every slot and **grammar never gets one** once all four buckets are non-empty. This is the same class of starvation `docs/feedback/04-lesson-pacing-and-grammar-coverage.md` §4.1 fixed for relaxed (`size: 5`), and it is unavoidable arithmetic: 3 slots cannot cover 4 types. Day one is unaffected (kanji/vocab buckets are empty behind dependency gating, so grammar does get picked).

**Do not fix this here** — do not rotate the floor order, do not add day-based cycling. Note it in your Completion Notes so code review recognizes it as known, not missed.

### Regression surface — where legacy values flow

Verified call sites that consume a stored `SessionIntensity` and must keep behaving identically for `'relaxed'` / `'intense'`:

- `data/hooks/useLessonPlan.ts:131-132` → `lessonSizeForIntensity(intensity)`
- `core/lesson/lessonAllowance.ts:35` → `LESSON_SIZE_BY_INTENSITY[intensity ?? 'relaxed']` × `DAILY_LESSON_BATCHES`
- `data/user/goalRingRepository.ts:69` → `initialGoalForIntensity(getSessionIntensity(userDb) ?? 'relaxed')` — the cross-module type usage AC #4 makes safe
- `hooks/useOnboardingRedirect.ts:46` → presence check only, value-agnostic
- `app/(tabs)/index.tsx:154` → passes intensity into the allowance input

`data/user/preferencesRepository.ts:105-121` is the only read/write pair; `setSessionIntensity` throws on an invalid literal and `getSessionIntensity` returns `null` for a corrupt stored value. Both stay as-is — widening `SESSION_INTENSITY_VALUES` is all that's needed.

**No migration.** `session_intensity` is a free-text preferences row (migration 017 test references it at `data/migrations/017_ai_sessions.test.ts:64,73`); widening the accepted value set requires no schema change and no data rewrite.

### Conventions to follow

- **No `Result<T, AppError>` here.** Everything this story touches is synchronous — pure maps, a sync SQLite preference read, and a presentational component. Do not introduce Result wrapping; it isn't this code's pattern.
- **Semantic NativeWind tokens only.** Reuse existing spacing tokens (`gap-space-sm`); no raw hex, no new tokens. The picker introduces no new colors.
- **Co-located tests**, one component per file with a named export (route files under `app/` keep their required `export default`). No barrel exports in `core/`. [Source: `_bmad-output/planning-artifacts/architecture.md#Structure Patterns`]
- **a11y lint gate blocks merge.** The radiogroup/radio pairing and `min-h-[44px]` already satisfy it via `ChoiceCard`; keep them.

### Previous story intelligence (6.1, done 2026-08-08)

- **Reuse the existing accessible component rather than building a new control.** 6.1's code review confirmed this repo's a11y gate makes custom gesture widgets expensive; it shipped paired `JlptLevelPicker`s and `StepperRow` instead of the brainstorm's drag sliders. Same principle here: five `ChoiceCard`s, not a slider or wheel. No slider dependency exists in `mobile/package.json` (only `react-native-gesture-handler` / `react-native-reanimated`).
- **6.1's review caught bounds that were unreachable in practice.** The analogue here is the layout: verify five cards actually render stacked and tappable, not just that the tests count five radios.
- **6.1 explicitly fenced this work off** — its Dev Notes said "do not touch `sessionIntensity.types.ts`, `lessonPlanner.ts`, or `SessionIntensityPicker.tsx` in this story." Those files are untouched by 6.1 and are yours now; expect no merge conflicts.
- **Test conventions to copy:** `intensity.test.tsx` already has the full harness (mocked `expo-sqlite` via `__mockResetSqlite`, mocked `expo-router`, `SafeAreaProvider` with `initialMetrics`, `runMigrations(db, [migration001Initial])`). Extend that file's existing `renderIntensityScreen` helper — do not write a new harness.

### Git intelligence

`0af0ae2` (Story 6.1) is the most recent feature commit and touched only placement files plus `JlptLevelPicker` / `StepperRow` / `itemRepository` / `welcome.tsx` — no overlap with this story's file set. `db48fba` is docs/sprint-status only. Working tree at baseline has four untracked docs files (`docs/content/`, `docs/design/`, `docs/feedback/14-*`) unrelated to this story; leave them alone.

### Latest tech information

No web research was required for this story: it adds no dependency, upgrades nothing, and calls no external API. It is a TypeScript union widening plus a flex-direction change inside the existing Expo / React Native / NativeWind stack already pinned by `mobile/package.json`. Do **not** add packages.

### Project Structure Notes

- Files this story **updates**: `mobile/src/data/user/sessionIntensity.types.ts`, `mobile/src/core/cognitive-load/cognitiveLoad.types.ts`, `mobile/src/config/constants.ts`, `mobile/src/core/lesson/lessonPlanner.ts`, `mobile/src/components/onboarding/SessionIntensityPicker.tsx`, plus the test files in Task 4.
- Files this story **reads only (do not modify)**: `mobile/src/components/common/ChoiceCard.tsx`, `mobile/src/app/(tabs)/settings.tsx`, `mobile/src/app/onboarding/intensity.tsx` (source only — its *test* is updated), `mobile/src/core/lesson/lessonAllowance.ts`, `mobile/src/core/cognitive-load/thresholdCalculator.ts`, `mobile/src/data/user/preferencesRepository.ts`, `mobile/src/data/user/goalRingRepository.ts`. All of these are consumers that compile unchanged once the maps are widened — if one of them *requires* a code change, stop and say so rather than quietly editing it.
- No new files. No new migration. No new dependency.
- **Supersedes PRD FR25** ("relaxed ~15 min or intense ~30 min"), UX spec line 818 ("Two options: Relaxed ~15 / Intense ~30"), and `docs/design/redesign-v2/README.md:164`. Updating those docs is not required by this story's ACs; mention the drift in Completion Notes.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 6.2: Five-Tier Daily Pace Scale`] — tier names, minutes, new-item counts, out-of-scope fences
- [Source: `mobile/src/data/user/sessionIntensity.types.ts`] — canonical union being widened
- [Source: `mobile/src/core/cognitive-load/cognitiveLoad.types.ts`] — duplicate union being consolidated
- [Source: `mobile/src/config/constants.ts:3-6,86-97`] — `SESSION_INTENSITY_MINUTES`, `COGNITIVE_LOAD_THRESHOLD_BASE` and its calibration comment
- [Source: `mobile/src/core/lesson/lessonPlanner.ts:28-35,89-97`] — `LESSON_SIZE_BY_INTENSITY` and the floor pass behind the Light/grammar note
- [Source: `mobile/src/components/onboarding/SessionIntensityPicker.tsx`] — the two-option row being widened
- [Source: `mobile/src/components/common/ChoiceCard.tsx`] — reused row, already radio + 44pt + `className` passthrough
- [Source: `mobile/src/app/(tabs)/settings.tsx:239`] — second render site, no logic change
- [Source: `docs/feedback/04-lesson-pacing-and-grammar-coverage.md#4.1`] — why the floor pass exists and why size 3 re-opens it
- [Source: `_bmad-output/implementation-artifacts/6-1-placement-quiz-range-and-cutoff-flexibility.md`] — a11y/reuse precedent and scope fence
- [Source: `_bmad-output/brainstorming/brainstorm-intensity-and-placement-range-2026-08-06/.memlog.md`] — decision trail: 5-step named scale chosen; recommendation-line and re-offer deferred
- [Source: `_bmad-output/planning-artifacts/architecture.md#Structure Patterns`] — organization rules

## Dev Agent Record

### Agent Model Used

claude-opus-5 (Claude Code, bmad-dev-story workflow)

### Debug Log References

- `npx jest src/data/user/sessionIntensity.types.test.ts` — red (2 failed) before Task 1, green after.
- `npx jest src/core/lesson/lessonAllowance.test.ts src/core/lesson/lessonPlanner.test.ts src/core/cognitive-load/thresholdCalculator.test.ts` — red (2 failed: monotonicity assertions) before Task 2, green (37) after.
- `npx jest src/components/onboarding/SessionIntensityPicker.test.tsx` — red (3 failed) before Task 3, green (6) after.
- `npm run typecheck` — clean. `npm run lint` — 0 errors, 1 pre-existing warning (`src/app/(tabs)/browse/passage/[id].test.tsx:35`, unrelated `require()` import).
- `npm test` — 211 suites / 1848 tests passed.

### Completion Notes List

**Implemented as specified.** `SessionIntensity` widened to five ordered literals; `cognitiveLoad.types.ts` now re-exports the canonical type instead of declaring its own copy (AC #4); the three `Record<SessionIntensity, number>` maps carry all five keys at exactly the Dev Notes tier-table values; the picker renders five vertical `ChoiceCard` rows with sublabels derived from `SESSION_INTENSITY_MINUTES` + `LESSON_SIZE_BY_INTENSITY`. No `SESSION_INTENSITY_NEW_ITEMS` map added (AC #5). No migration, no new dependency, no new files, no token changes (so `check-contrast` was not run — nothing it covers was touched).

**Relaxed/intense numbers verified unchanged** (AC #2, #9): the pre-existing relaxed/intense assertions in `lessonPlanner.test.ts`, `lessonAllowance.test.ts`, `thresholdCalculator.test.ts` and `preferencesRepository.test.ts` all still pass byte-for-byte unmodified. The only pre-existing assertions edited were the two sublabel string checks in `SessionIntensityPicker.test.tsx` (`'~15 min/day'` → derived `'~15 min/day · 5 new items'`), which Task 3 requires by design.

**⚠️ Needs Riyaz's call — onboarding pace screen may now overflow.** `OnboardingStep` is a non-scrolling `flex-1` container (`OnboardingStep.tsx:60-76`) and RN defaults `flexShrink: 0`, so content taller than the screen is clipped rather than scrolled. Going 2 → 5 cards puts the intensity screen at roughly 850pt of content (≈454pt picker + preview + banner + header + action button + safe-area insets) against 844pt on an iPhone 14 and 667pt on an SE. Settings is unaffected — it already renders inside a `ScrollView` (`settings.tsx:229`). Both fixes fall outside this story's declared file set (`intensity.tsx` and `OnboardingStep.tsx` are read-only / unlisted), so per Project Structure Notes I stopped rather than editing: either wrap `OnboardingStep`'s children in a `ScrollView` (touches all four onboarding screens) or drop the now-redundant `intensity-lesson-preview` block, whose "N new items" figure the picker sublabel already shows for every tier. Needs a device/simulator check to confirm the estimate.

**Known consequence, deliberately not fixed (per Dev Notes):** at `light`'s `size: 3`, `planLesson`'s floor pass (`lessonPlanner.ts:89-97`) reserves radical → kanji → vocabulary first, so **grammar gets no slot** once all four buckets are non-empty — 3 slots cannot cover 4 types. Day one is unaffected (kanji/vocab are dependency-gated empty). Known, not missed.

**Copy deviation from the epic, as sanctioned by Dev Notes:** the epic writes Light as "2–3 new items"; the derived sublabel reads "3 new items", matching the actual `light: 3` lesson size.

**Doc drift to clean up separately** (not required by this story's ACs): PRD FR25, UX spec line 818, and `docs/design/redesign-v2/README.md:164` all still describe the two-tier relaxed/intense scale.

### File List

- `mobile/src/data/user/sessionIntensity.types.ts` (modified)
- `mobile/src/core/cognitive-load/cognitiveLoad.types.ts` (modified)
- `mobile/src/config/constants.ts` (modified)
- `mobile/src/core/lesson/lessonPlanner.ts` (modified)
- `mobile/src/components/onboarding/SessionIntensityPicker.tsx` (modified)
- `mobile/src/data/user/sessionIntensity.types.test.ts` (modified)
- `mobile/src/core/cognitive-load/thresholdCalculator.test.ts` (modified)
- `mobile/src/core/lesson/lessonPlanner.test.ts` (modified)
- `mobile/src/core/lesson/lessonAllowance.test.ts` (modified)
- `mobile/src/components/onboarding/SessionIntensityPicker.test.tsx` (modified)
- `mobile/src/app/onboarding/intensity.test.tsx` (modified)
- `mobile/src/data/user/preferencesRepository.test.ts` (modified)
- `_bmad-output/implementation-artifacts/6-2-five-tier-daily-pace-scale.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

## Change Log

- 2026-08-08 — Story created. Status → ready-for-dev.
- 2026-08-08 — Implemented five-tier pace scale: widened `SessionIntensity`, consolidated the duplicate union, extended the three numeric maps, rebuilt the picker as five vertical rows with derived sublabels, extended six test files. Lint / typecheck / 1848 tests green. Status → review.
- 2026-08-08 — Code review (3 layers: blind, edge-case, acceptance): 13/13 ACs pass. Patched: `OnboardingStep` children wrapped in `ScrollView` (small-screen overflow), `SESSION_INTENSITY_MINUTES` value-pinning test added, spotcheck script extended to all five tiers. 3 items deferred (pre-existing: badge a11y, stale goal ring on downgrade, downgrade forward-compat). 211 suites / 1849 tests green. Status → done.
