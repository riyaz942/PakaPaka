# Story 9-1: Guided onboarding placement and auto-lesson daily loop

Status: done
Completed: 2026-07-04

## Story

As a learner opening the app for the first time,
I want onboarding to assess my level quickly and drop me straight into an auto-built first lesson,
so that I start learning within minutes instead of filling out checklists and constructing sessions by hand.

## Context / why this story exists

A UX audit (2026-07-04) found four divergences between the shipped experience and the PRD/UX spec:

1. **Onboarding was transactional.** The UX spec's Flow 1 ends onboarding with "Lesson: first 5 radicals → first 3 kanji → input test → summary"; the shipped complete screen said "Your first review session ships in a later update" and dumped users on Home.
2. **"I know some Japanese" required duplicate checklist work.** After JLPT level selection users faced full per-item radical/kanji/vocab/grammar checklists (calibrate) *and then* a bulk-mark screen over the same items.
3. **The selected level was structurally ignored.** Starting at N3 never marked N5/N4 content as covered, so the dependency graph locked essentially everything and progress/recommendation surfaces behaved as if the user were at N5.
4. **No daily learn loop existed.** `setStudyStatus` was only reachable from onboarding calibration; the Learn tab was a browse-only hub (level picker → type list → item detail), and there was no way to start learning a new item post-onboarding at all.

## Acceptance criteria

1. Onboarding is 4 steps max: path choice (+ level), pace, placement (manual path only), ready screen. Beginner and import paths skip placement entirely.
2. The "I know some Japanese" path replaces both checklists with a ≤12-card placement self-check ("Know it" / "Not yet") over a stratified, difficulty-ordered sample of the chosen level. The known ratio maps to a curriculum-order cut per type; explicit answers always win over the cut. A skip path exists.
3. Any placement outcome (including skip) marks all levels below the starting level as known so the dependency graph unlocks the user's actual level.
4. The final onboarding screen's primary CTA launches the first auto-built lesson; a secondary CTA goes to the tabs. Both complete onboarding.
5. A `/lesson` full-screen session auto-generates from level + intensity + dependency graph (relaxed = 5 items, intense = 10; radicals lead, types interleaved, curriculum order within type) and advances to the next harder JLPT level when the current one is exhausted.
6. Lesson items commit (in_progress + seeded FSRS state, due immediately) only when the lesson is finished; the completion screen offers an immediate "Quiz me now" handoff into the existing review session.
7. The Learn tab leads with a one-tap "Today's lesson" hero and a reviews shortcut; the browse hub is demoted to a secondary "library" section. Home's Learn button becomes "Today's lesson".
8. Motion respects reduced motion (system + in-app pref) everywhere: staggered entrance on onboarding/learn cards, scale press feedback, lesson-complete celebration.
9. `npm run lint`, `npm run typecheck`, `npm test` pass.

## Implementation summary

**New core (pure):**
- `src/core/lesson/lessonPlanner.ts` — lesson selection: filters known/in-progress/started/locked, per-type buckets sorted by `sort_order`, weighted round-robin (radical 2 → kanji 2 → vocab 2 → grammar 1), `LESSON_SIZE_BY_INTENSITY`.
- `src/core/placement/placementEngine.ts` — stratified even-spaced sampling, known-ratio computation, ratio→curriculum-cut resolution with explicit-answer overrides.

**New data layer:**
- `src/data/user/placementRepository.ts` — `applyPlacement` (lower-level bulk known + within-level ids), `levelsBelow`.
- `src/data/user/lessonProgressRepository.ts` — `startLessonItems` (in_progress + seed FSRS, transactional).
- `src/data/hooks/useLessonPlan.ts` — builds today's plan; auto-advances past exhausted levels.

**Onboarding:**
- `welcome.tsx` — journey copy; beginner path is now one tap (no Continue).
- `intensity.tsx` — pace framing with live lesson-size preview; routes manual→placement, beginner/import→complete. Removed the "Mark items manually" escape hatch into the checklist.
- `placement.tsx` (new) — card-based self-check + starting-point summary with "Start from scratch" fallback.
- `complete.tsx` — celebration + "Start your first lesson" primary CTA.
- Deleted `calibrate.tsx`, `bulk.tsx`, `CalibrationItemRow`, `BulkMarkPresetCard`, `ItemStudyStatusPicker`, `useCalibrationItems`, `useBulkMarkPresets`. Updated `useOnboardingRedirect` accordingly.

**Lesson session:**
- `src/app/lesson/{_layout,index,complete}.tsx` — full-screen modal (registered beside `/review`), progress bar, reuses the four Learn detail components via `src/components/lesson/LessonItemView.tsx`, commit-on-finish, celebration screen with review handoff.

**Learn tab / Home:**
- `learn/index.tsx` rebuilt: "Today's lesson" hero (auto-built, one tap), reviews card, browse-by-level section. `learn/[level]` browse route unchanged.
- Home "Learn" button → "Today's lesson" → `/lesson`.

**Motion:**
- `src/components/common/PressableScale.tsx`, `src/components/common/FadeSlideIn.tsx`; `ZoomIn` spring on lesson completion. All gated by `useReducedMotion`.
- Jest: mapped `react-native-reanimated` → its official mock and `react-native-worklets` → `src/mock.ts` in `package.json` moduleNameMapper.

## Key decisions

- **Placement over placement *test*.** A typed placement test contradicts the "three taps to first value" principle and would gate onboarding on answer-evaluation UX. Confidence self-report over a difficulty-stratified sample gives a defensible curriculum cut in under a minute; the FSRS/weakness engine corrects miscalibration organically (misjudged items resurface on failure).
- **Lower levels are marked known on every manual-path outcome.** This is the structural fix for "recommendations ignore selected level": the dependency graph treats sub-level prerequisites as satisfied, so lessons/queue actually draw from the chosen level.
- **Lessons commit atomically at the end.** Abandoning a half-viewed lesson costs nothing and avoids orphaned in_progress items.
- **Fresh FSRS cards are due immediately**, so "Quiz me now" needs no special queue mode — the existing review pipeline picks the new items up.

## Verification

- 103 suites / 697 tests pass (new: lessonPlanner 18, placementEngine, placement screen, lesson screen; updated: welcome, intensity, complete, redirect, learn index, home).
- `tsc --noEmit` clean (typed routes regenerated), `expo lint` clean.

## Deferred

- Post-lesson quiz scoped to lesson items only (currently the full due queue, which right after onboarding is equivalent).
- Page-transition animation between lesson cards beyond fade/slide; XP system (streak + cognitive-load ring already cover the motivation loop).
- `useRadicals` hook is now unused outside its test — candidate for deletion.
- CLAUDE.md sprint table is stale relative to sprint-status.yaml (predates Epics 5–8 completion).
