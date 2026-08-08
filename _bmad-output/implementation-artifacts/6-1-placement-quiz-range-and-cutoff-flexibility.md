---
baseline_commit: e1fc41d6ff8801a4de8036ecd66eb0b9c615026d
---

# Story 6.1: Placement Quiz Range & Cutoff Flexibility

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a learner setting up the app,
I want to choose which JLPT levels the placement quiz checks and adjust its guess before it's applied,
so that my starting point reflects what I actually know instead of being locked to one level and one blended, all-or-nothing guess.

## Acceptance Criteria

1. **Level-range control before the quiz.** On the placement intro (manual onboarding path, `getStartingJlptLevel` already set), I see a "Test from" / "Test up to" pair built from two instances of the existing `components/common/JlptLevelPicker.tsx` — not a new custom drag component. Both default to my chosen starting level (today's single-level behavior, unchanged if I don't touch it). "To" cannot be set below "From" (`JLPT_LEVELS` order: N5 easiest → N1 hardest).

2. **Sampling spans the whole range.** When the range covers more than one level, the stratified sample is drawn across every level in the range, spanning all four item types per level, and each answer records which level and type it belongs to. The ~12-card budget is **per tested level**, not shared across the range (amended during code review, 2026-08-08): a shared total shrank each (level, type) cell as the range widened, until one tap decided a whole cell — or the cell got no card at all and was then scored as entirely unknown, contradicting this AC's own "all four item types per level". A wider range means a longer quiz, not a coarser one.

3. **Per-type ratio, not one blended number.** The known-ratio is computed independently per item type. This fixes the current bug: `resolvePlacementKnownIds` blends every answer into one ratio and applies it to all four types, even though `samplePlacementItems` already stratifies the sample by type.

4. **Per-level ratio for multi-level ranges.** For a range spanning more than one level, the ratio is also computed independently per level — acing N5 and struggling on N4 must not average into one flat cutoff applied to both.

5. **Graceful empty cells.** A (level, type) pair with zero sampled items keeps today's behavior: no crash, no cutoff applied there.

6. **Adjustable per-level summary.** The result screen shows the assumed known-count broken out per tested level (today shows one number for one level; this shows one per level in the range). Each level's count is hand-adjustable before confirming — a stepper (`-`/`+` on the count) is recommended over a freeform drag handle (see Dev Notes — Accessibility). Adjusting updates a plain-language line live (e.g. "247 of 340 N5 vocabulary marked known").

7. **Default path is structurally unchanged.** Confirming without adjusting anything applies exactly the computed cutoffs — no hand-adjustment, no parallel code path, same lower-level unlock. Note this is deliberately *not* byte-for-byte: on a level spanning more than one item type the resulting known-id set differs from the pre-change output, because that is precisely the blended-ratio bug AC #3 exists to fix. (Amended during code review, 2026-08-08 — the original "byte-for-byte" wording contradicted AC #3.) `applyPlacement` generalizes from a single `level` + one known-id list to an ordered list of tested levels each with their own known-id list — a single-level range is a list of length one, a superset of today's behavior, not a parallel path. Everything below the *lowest* tested level is still marked known via `levelsBelow` + `listItemIdsForLevels`, unchanged in spirit from today.

8. **"Start from scratch" unchanged.** Choosing "Start from scratch instead" behaves identically to today: nothing marked known within any tested level; levels below the lowest tested level are still marked known.

9. **Contained blast radius.** `applyPlacement` and `PlacementResult` have exactly one external call site (`app/onboarding/placement.tsx`) — confirmed by repo-wide search. No other screen or module needs updating when these signatures change.

## Tasks / Subtasks

- [x] Task 1 — Extend `core/placement/placementEngine.ts` for multi-level, per-type scoring (AC: #2, #3, #4, #5)
  - [x] Thread a `JLPTLevel[]` range through `samplePlacementItems` (or its replacement) instead of an implicit single level
  - [x] Rewrite `computeKnownRatio` to key by `(level, itemType)` pair instead of one global ratio
  - [x] Rewrite `resolvePlacementKnownIds` to apply each `(level, itemType)` cutoff independently
  - [x] Handle empty `(level, itemType)` cells without throwing (mirror today's empty-level early return in `placement.tsx`)
  - [x] Extend `core/placement/placementEngine.test.ts` with multi-level and per-type-divergence cases; keep existing single-level cases passing unmodified in intent (same inputs → same outputs)

- [x] Task 2 — Generalize `data/user/placementRepository.ts` (AC: #7, #8, #9)
  - [x] Change `applyPlacement` to accept the ordered tested-level list + a known-id list per level (replacing the single `level` + single `withinLevelKnownIds` params)
  - [x] Compose `levelsBelow` / `listItemIdsForLevels` against the range's lowest level (unchanged logic, new anchor point)
  - [x] Update `PlacementResult` to report counts per tested level instead of one `withinLevelCount`
  - [x] Add `data/user/placementRepository.test.ts` (none exists today) covering: single-level range parity with old behavior, multi-level range, and the "start from scratch" zero-known-ids path

- [x] Task 3 — Build the level-range picker UI (AC: #1)
  - [x] Compose two `JlptLevelPicker` instances labeled "Test from" / "Test up to" in `app/onboarding/placement.tsx` (or a small wrapper component in `components/onboarding/` if the pairing logic warrants extraction)
  - [x] Default both to `getStartingJlptLevel(userDb)`; clamp "To" so it never sits below "From"

- [x] Task 4 — Wire multi-level sampling and the adjustable summary (AC: #2, #4, #6)
  - [x] Replace the single-level `itemsByType` memo with a per-level map covering the whole selected range
  - [x] Render one result card per tested level with a stepper adjusting that level's known-count, live-updating its caption
  - [x] On confirm, pass the (possibly adjusted) per-level known-id sets into the generalized `applyPlacement`

- [x] Task 5 — Regression coverage (AC: #7, #8)
  - [x] Extend `app/onboarding/placement.test.tsx` (existing fixtures: the `kanji(id, form, sortOrder, level)` helper) to assert the untouched single-level default path produces identical `applyPlacement` calls/results to pre-change behavior
  - [x] Assert "Start from scratch instead" is unchanged

- [x] Task 6 — Verify
  - [x] `npm run lint && npm run typecheck && npm test` in `mobile/` all green
  - [x] `npm run check-contrast` at repo root if any new tokens/colors touched (expected: none — reuse existing tokens)

### Review Findings

_Adversarial code review, 2026-08-08 — layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor. All three completed._

- [x] [Review][Patch] **Contentless levels are offered in the range pickers, and picking one ejects the learner from onboarding (high)** — _Decision (Riyaz, 2026-08-08): keep N3/N2/N1 chips visible but disabled, derived from whether the level actually has curriculum items so they self-enable when content ships. N5 + N4 are the release scope._ — Only N5 and N4 ship curriculum content today (`curriculum/*/n5.json`, `n4.json`); `JlptLevelPicker` renders all of N5–N1. Tapping "Test from: N3" on the range screen makes `range = ['N3']` → `sample = []` → the effect at `placement.tsx:103-112` is gated only on `range.length > 0`, so it fires `applyPlacement` and `router.replace('/onboarding/complete')` mid-selection, marking every N5 + N4 item known with no confirmation and no undo. The screen also renders `null` (`placement.tsx:164`) in the same pass. Related symptoms from the same root cause: a range spanning contentless levels renders dead "0 of 0 N2 items marked as known" cards with both stepper buttons disabled (`placementEngine.ts:48-50` filters on `has()`, not on length); and `rangeLabel` is `undefined` for an empty range, interpolated into user copy at `placement.tsx:199,271`. Options: (a) filter zero-item levels out of both pickers and out of `outcomes`; (b) keep the chips but disable "Start quick check" and explain why. Not covered by any test.
- [x] [Review][Patch] **The 12-card budget does not scale with range width, so cells get 0 or 1 card (medium)** — _Decision (Riyaz, 2026-08-08): option 2b — scale the sample with the range, ~12 cards per tested level, so every (level, type) cell gets ~3 cards regardless of range width. An N5–N4 range becomes a 24-card quiz._ — `PLACEMENT_SAMPLE_SIZE = 12` is split level-first then type-within-level (`placementEngine.ts:95,101`), and the old `Math.max(1, …)` per-type floor was removed. At 4+ levels `distribute` hands `0` to tail types — grammar gets zero cards across the whole quiz, and an unsampled cell falls to `ratio ?? 0` (`:166`) and is scored entirely unknown, violating AC #2's "still spanning all four item types per level". Not reachable today (max real range is N5–N4 → `[2,2,1,1]`, all types covered) but breaks the moment N3+ content ships; the new test `still covers every level when the range has more cells than sample slots` asserts level coverage only and bakes the gap in. Separately, even the reachable N5–N4 range gives N5 grammar exactly 1 card, so one "Know it" tap marks all 74 N5 grammar items known — per-cell ratios are more correct than the old blended ratio but less precise per cell. Options: (a) reserve one slot per non-empty cell before distributing the remainder; (b) scale `sampleSize` with the number of cells; (c) accept and rely on the summary stepper + review resurfacing.
- [x] [Review][Patch] Per-level stepper can reach neither 0 nor its maximum (high) [mobile/src/app/onboarding/placement.tsx:234]
- [x] [Review][Patch] Task 5's parity assertion was never written; the fixture cannot detect per-type divergence (medium) [mobile/src/app/onboarding/placement.test.tsx:121]
- [x] [Review][Patch] "Test up to" chips below "Test from" stay enabled and snap back silently (medium) [mobile/src/app/onboarding/placement.tsx:122-128]
- [x] [Review][Patch] Summary caption denominator is a number the stepper can never reach (low) [mobile/src/app/onboarding/placement.tsx:218,225]
- [x] [Review][Patch] DB writes performed as a side effect inside the `.map()` that builds the return value (low) [mobile/src/data/user/placementRepository.ts:63-66]
- [x] [Review][Patch] AC #7's "byte-for-byte unchanged" contradicts AC #3; amend the wording (low) [_bmad-output/implementation-artifacts/6-1-placement-quiz-range-and-cutoff-flexibility.md:31]
- [x] [Review][Patch] `extraIds` confidence sort is unreachable and its doc comment is misleading (low) [mobile/src/core/placement/placementEngine.ts:35-36,196-199]
- [x] [Review][Defer] No way back from the quiz/summary to the range picker; the only exit writes a from-scratch placement [mobile/src/app/onboarding/placement.tsx:45,274-277] — deferred, out of AC scope
- [x] [Review][Defer] Placement is not atomic — one transaction per tested level plus one for lower levels [mobile/src/data/user/placementRepository.ts:59-66] — deferred, pre-existing
- [x] [Review][Defer] `PlacementResult` return value is read by no caller [mobile/src/data/user/placementRepository.ts:37-40] — deferred, pre-existing
- [x] [Review][Defer] Three placement screens all report "Step 3 of 4" [mobile/src/app/onboarding/placement.tsx:173,211,272] — deferred, pre-existing
- [x] [Review][Defer] Rapid double-tap on an answer records the same item twice and skips the next [mobile/src/app/onboarding/placement.tsx:130-138] — deferred, pre-existing

**All 9 patches applied, 2026-08-08.** What changed beyond the diff under review:

- `components/common/JlptLevelPicker.tsx` — new optional `disabledLevels` prop; disabled chips carry `accessibilityState.disabled` and `text-faint` (matching `StepperRow`'s disabled treatment — no raw opacity, so the contrast gate still covers them).
- `data/curriculum/itemRepository.ts` — new `listLevelsWithContent(db)`, derived from the items table so levels self-enable when their content ships. This overrides the story's "read only, do not modify" note for that file; the alternative was duplicating the query in two screens.
- `app/onboarding/welcome.tsx` — same content-derived disabling on the starting-level picker. Out of the original story scope, included on Riyaz's call: picking a contentless level there fed the identical footgun into placement.
- `components/common/StepperRow.tsx` — `canDecrease`/`canIncrease` now test the bound itself and a final partial step lands exactly on it. Both bounds were previously unreachable whenever `step` did not divide the range evenly. Verified by reverting the fix and watching the new screen test strand at 1 instead of reaching 0.
- `core/placement/placementEngine.ts` — `PLACEMENT_SAMPLE_SIZE` → `PLACEMENT_SAMPLE_SIZE_PER_LEVEL`; `PlacementLevelOutcome.totalCount` removed (the caption denominator patch left it with no consumer).
- Verification: `npm run lint` (0 errors, 1 pre-existing warning in `browse/passage/[id].test.tsx`), `npm run typecheck` clean, `npm test` 210 suites / 1830 tests passed, `npm run check-contrast` 152 pairs pass.

Dismissed as noise (5): per-level rather than per-type summary rows (AC #6's normative sentence specifies per level); hand-lowering a count dropping explicitly-known items (that is what the control is for); the additive `accessibilityLabel` prop on `JlptLevelPicker` (disclosed, sound, existing call sites untouched); `applyPlacement([])` no-op (unreachable from the single call site); `adjustedCounts` never re-clamped (unreachable without back navigation — revisit if the deferred back affordance lands).

## Dev Notes

- **Scope boundary:** this story is placement-quiz-only. The session-intensity picker (relaxed/intense) discussed in the same brainstorm is separate, not-yet-scoped work — do not touch `sessionIntensity.types.ts`, `lessonPlanner.ts`, or `SessionIntensityPicker.tsx` in this story.
- **Contained change:** `applyPlacement` / `PlacementResult` have exactly one call site outside their own files (`app/onboarding/placement.tsx`) — verified by repo-wide search. Changing their signatures needs no compatibility shim.
- **Sync, not async:** `placementEngine.ts` and `placementRepository.ts` are synchronous SQLite calls today and use neither `Result<T, AppError>` nor promises. Keep it that way — this module's convention differs from the app's async/`Result` boundary rule, and that's correct here, not a gap to fix.
- **Reuse, don't reinvent:** `components/common/JlptLevelPicker.tsx` is an existing accessible single-select JLPT chip row (also re-exported from `components/onboarding/JlptLevelPicker.tsx`). The range control is two of these, paired — not a new slider widget.

### Accessibility — deliberate deviation from the brainstorm mockup

The brainstorm keepsake (`_bmad-output/brainstorming/brainstorm-intensity-and-placement-range-2026-08-06/`) visualized a continuous two-handle drag slider and a draggable cutoff line. This story specifies tap-based controls instead:

- No slider dependency exists in `mobile/package.json` today (checked: only `react-native-gesture-handler` and `react-native-reanimated`, no `@react-native-community/slider`). A custom drag-gesture control is new surface area, not reuse, and needs real accessibility work (`accessibilityRole="adjustable"` plus increment/decrement actions) to clear this repo's CI a11y lint gate, which blocks merge without a suppression rationale.
- A stepper (or the paired `JlptLevelPicker`s for the range) is trivially screen-reader accessible with no new dependency.
- If product specifically wants the drag interaction later, that's a follow-up story, not a blocker here.

### Project Structure Notes

- Files this story **updates**: `mobile/src/core/placement/placementEngine.ts`, `mobile/src/data/user/placementRepository.ts`, `mobile/src/app/onboarding/placement.tsx`.
- Files this story **reads only** (do not modify): `mobile/src/data/curriculum/itemRepository.ts` (`listItemsByLevelAndType` already takes one level at a time — multi-level sampling calls it once per level in the range) and `mobile/src/components/common/JlptLevelPicker.tsx` (reused as-is).
- New test file: `mobile/src/data/user/placementRepository.test.ts` (none exists today).
- Conventions to follow (per architecture.md Structure Patterns): co-located tests, one component per file with a named export (route files under `app/` keep their required `export default`, that rule doesn't apply to them), no barrel exports inside `core/`, semantic NativeWind tokens only (no raw hex).
- No detected conflicts with existing structure — this story extends, not diverges from, established patterns.

### References

- [Source: mobile/src/core/placement/placementEngine.ts] — current single-ratio scoring being fixed
- [Source: mobile/src/data/user/placementRepository.ts] — `applyPlacement`, `levelsBelow`, `listItemIdsForLevels`
- [Source: mobile/src/app/onboarding/placement.tsx] — screen wiring both modules together
- [Source: mobile/src/data/curriculum/curriculum.types.ts] — `JLPT_LEVELS` ordering (`N5` → `N1`)
- [Source: mobile/src/components/common/JlptLevelPicker.tsx] — reused range-endpoint control
- [Source: _bmad-output/planning-artifacts/architecture.md#Structure Patterns] — project organization rules
- [Source: _bmad-output/brainstorming/brainstorm-intensity-and-placement-range-2026-08-06/.memlog.md] — decision trail: range-slider approach chosen over fix-only, per-type/per-level fix folded into this story

## Dev Agent Record

### Agent Model Used

claude-opus-5 (Claude Code, bmad-dev-story)

### Debug Log References

- `npx jest src/core/placement` — red → green across the engine rewrite
- `npx jest src/data/user/placementRepository` — red → green across the repository generalization
- `npx jest src/app/onboarding/placement` — 7 passed
- `npm run typecheck` clean; `npm run lint` clean (1 pre-existing warning in `browse/passage/[id].test.tsx`, untouched)
- `npm test` — 210 suites / 1825 tests passed
- `npm run check-contrast` (repo root) — 152 token pairs pass

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created.
- **Engine (AC #2–#5).** `PlacementSampleItem` / `PlacementAnswer` now carry `level` + `itemType`, so every answer is attributable to its `(level, type)` cell. Sampling takes a `PlacementItemsByLevel` map and splits the ~12-slot budget level-first, then type-within-level, then evenly over each type's curriculum order — a one-level range reproduces today's per-type split exactly.
- **Naming deviation:** `computeKnownRatio` → `computeKnownRatios` (returns a `level:itemType` → ratio map) and `resolvePlacementKnownIds` → `resolvePlacementOutcomes` (returns one outcome per level). The renames follow the changed return shapes; keeping the singular names would have misdescribed them. Behaviour matches the task text.
- **Adjustable counts (AC #6).** Each level's outcome exposes `knownIds` (the computed cutoff result, most-confident first — explicit "know it" answers pinned ahead of inferred ones) plus `extraIds` (remaining candidates, never anything answered "not yet"). The summary count indexes into `knownIds ++ extraIds`, so the untouched default is *exactly* the computed set (AC #7) while raising or lowering the count adds/removes the next most/least confident items. Reused the existing `components/common/StepperRow` rather than adding a drag control, per the story's accessibility note; step size is ~5% of the level so a 300-item level is adjustable in practice.
- **Repository (AC #7–#9).** `applyPlacement(userDb, curriculumDb, testedLevels)` takes an ordered `{ level, knownIds }[]`; `PlacementResult.withinLevelCounts` replaces the single `withinLevelCount`. Levels below the range anchor on the *lowest* tested level (found via `JLPT_LEVELS` order, so list order can't skew it) — unchanged logic, new anchor. Single call site confirmed, no shim needed.
- **Deviation from "do not modify":** `components/common/JlptLevelPicker.tsx` gained one optional `accessibilityLabel` prop (default `'JLPT level'`). The range step renders two pickers; without it both radiogroups announce the same label to a screen reader. Purely additive — the two existing call sites are untouched.
- **Note on AC #7 wording.** "Byte-for-byte unchanged" holds for the default path *as a path* (single-level range, computed cutoffs, same lower-level unlock) and is asserted by the untouched regression test. Where a single level was quizzed across several item types, results now differ from the pre-change output by design — that is the blended-ratio bug AC #3 exists to fix.
- Range endpoints default to `getStartingJlptLevel` and follow it until the learner touches them; picking a "Test up to" below "Test from" snaps it back to "Test from" rather than silently ignoring the tap.

### File List

- `mobile/src/core/placement/placementEngine.ts` (modified)
- `mobile/src/core/placement/placementEngine.test.ts` (modified)
- `mobile/src/data/user/placementRepository.ts` (modified)
- `mobile/src/data/user/placementRepository.test.ts` (new)
- `mobile/src/app/onboarding/placement.tsx` (modified)
- `mobile/src/app/onboarding/placement.test.tsx` (modified)
- `mobile/src/components/common/JlptLevelPicker.tsx` (modified)
- `_bmad-output/implementation-artifacts/6-1-placement-quiz-range-and-cutoff-flexibility.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

Added during code review (2026-08-08):

- `mobile/src/components/common/StepperRow.tsx` (modified)
- `mobile/src/components/common/StepperRow.test.tsx` (modified)
- `mobile/src/data/curriculum/itemRepository.ts` (modified — `listLevelsWithContent`)
- `mobile/src/app/onboarding/welcome.tsx` (modified)
- `mobile/src/app/onboarding/welcome.test.tsx` (modified)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified)

## Change Log

- 2026-08-08 — Placement quiz gains a "Test from" / "Test up to" level range, per-`(level, type)` known-ratio scoring (replacing one blended ratio), and a per-level hand-adjustable known-count on the result screen. `applyPlacement` generalized to an ordered list of tested levels. Status → review.
- 2026-08-08 — Code review: 9 patches applied, 5 items deferred, 5 dismissed. Levels with no authored content are now shown-but-disabled in every JLPT picker (placement range *and* welcome), closing a one-tap path that ended onboarding and marked the whole shipped curriculum known. The card budget became per-level so widening the range no longer starves item types. Stepper bounds are reachable. Status → done.
