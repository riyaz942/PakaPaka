# Story 6.1: Placement Quiz Range & Cutoff Flexibility

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a learner setting up the app,
I want to choose which JLPT levels the placement quiz checks and adjust its guess before it's applied,
so that my starting point reflects what I actually know instead of being locked to one level and one blended, all-or-nothing guess.

## Acceptance Criteria

1. **Level-range control before the quiz.** On the placement intro (manual onboarding path, `getStartingJlptLevel` already set), I see a "Test from" / "Test up to" pair built from two instances of the existing `components/common/JlptLevelPicker.tsx` — not a new custom drag component. Both default to my chosen starting level (today's single-level behavior, unchanged if I don't touch it). "To" cannot be set below "From" (`JLPT_LEVELS` order: N5 easiest → N1 hardest).

2. **Sampling spans the whole range.** When the range covers more than one level, the ~12-item stratified sample is drawn across every level in the range (still spanning all four item types per level), and each answer records which level and type it belongs to.

3. **Per-type ratio, not one blended number.** The known-ratio is computed independently per item type. This fixes the current bug: `resolvePlacementKnownIds` blends every answer into one ratio and applies it to all four types, even though `samplePlacementItems` already stratifies the sample by type.

4. **Per-level ratio for multi-level ranges.** For a range spanning more than one level, the ratio is also computed independently per level — acing N5 and struggling on N4 must not average into one flat cutoff applied to both.

5. **Graceful empty cells.** A (level, type) pair with zero sampled items keeps today's behavior: no crash, no cutoff applied there.

6. **Adjustable per-level summary.** The result screen shows the assumed known-count broken out per tested level (today shows one number for one level; this shows one per level in the range). Each level's count is hand-adjustable before confirming — a stepper (`-`/`+` on the count) is recommended over a freeform drag handle (see Dev Notes — Accessibility). Adjusting updates a plain-language line live (e.g. "247 of 340 N5 vocabulary marked known").

7. **Default path is byte-for-byte unchanged.** Confirming without adjusting anything applies exactly what today's single-level, computed-ratio flow would produce. `applyPlacement` generalizes from a single `level` + one known-id list to an ordered list of tested levels each with their own known-id list — a single-level range is a list of length one, a superset of today's behavior, not a parallel path. Everything below the *lowest* tested level is still marked known via `levelsBelow` + `listItemIdsForLevels`, unchanged in spirit from today.

8. **"Start from scratch" unchanged.** Choosing "Start from scratch instead" behaves identically to today: nothing marked known within any tested level; levels below the lowest tested level are still marked known.

9. **Contained blast radius.** `applyPlacement` and `PlacementResult` have exactly one external call site (`app/onboarding/placement.tsx`) — confirmed by repo-wide search. No other screen or module needs updating when these signatures change.

## Tasks / Subtasks

- [ ] Task 1 — Extend `core/placement/placementEngine.ts` for multi-level, per-type scoring (AC: #2, #3, #4, #5)
  - [ ] Thread a `JLPTLevel[]` range through `samplePlacementItems` (or its replacement) instead of an implicit single level
  - [ ] Rewrite `computeKnownRatio` to key by `(level, itemType)` pair instead of one global ratio
  - [ ] Rewrite `resolvePlacementKnownIds` to apply each `(level, itemType)` cutoff independently
  - [ ] Handle empty `(level, itemType)` cells without throwing (mirror today's empty-level early return in `placement.tsx`)
  - [ ] Extend `core/placement/placementEngine.test.ts` with multi-level and per-type-divergence cases; keep existing single-level cases passing unmodified in intent (same inputs → same outputs)

- [ ] Task 2 — Generalize `data/user/placementRepository.ts` (AC: #7, #8, #9)
  - [ ] Change `applyPlacement` to accept the ordered tested-level list + a known-id list per level (replacing the single `level` + single `withinLevelKnownIds` params)
  - [ ] Compose `levelsBelow` / `listItemIdsForLevels` against the range's lowest level (unchanged logic, new anchor point)
  - [ ] Update `PlacementResult` to report counts per tested level instead of one `withinLevelCount`
  - [ ] Add `data/user/placementRepository.test.ts` (none exists today) covering: single-level range parity with old behavior, multi-level range, and the "start from scratch" zero-known-ids path

- [ ] Task 3 — Build the level-range picker UI (AC: #1)
  - [ ] Compose two `JlptLevelPicker` instances labeled "Test from" / "Test up to" in `app/onboarding/placement.tsx` (or a small wrapper component in `components/onboarding/` if the pairing logic warrants extraction)
  - [ ] Default both to `getStartingJlptLevel(userDb)`; clamp "To" so it never sits below "From"

- [ ] Task 4 — Wire multi-level sampling and the adjustable summary (AC: #2, #4, #6)
  - [ ] Replace the single-level `itemsByType` memo with a per-level map covering the whole selected range
  - [ ] Render one result card per tested level with a stepper adjusting that level's known-count, live-updating its caption
  - [ ] On confirm, pass the (possibly adjusted) per-level known-id sets into the generalized `applyPlacement`

- [ ] Task 5 — Regression coverage (AC: #7, #8)
  - [ ] Extend `app/onboarding/placement.test.tsx` (existing fixtures: the `kanji(id, form, sortOrder, level)` helper) to assert the untouched single-level default path produces identical `applyPlacement` calls/results to pre-change behavior
  - [ ] Assert "Start from scratch instead" is unchanged

- [ ] Task 6 — Verify
  - [ ] `npm run lint && npm run typecheck && npm test` in `mobile/` all green
  - [ ] `npm run check-contrast` at repo root if any new tokens/colors touched (expected: none — reuse existing tokens)

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

_(fill in at dev-story time)_

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created.

### File List
