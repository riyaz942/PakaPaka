# Plan 04 — Lesson pacing and grammar coverage

**Priority:** P1. Two independent bugs that happen to live in the same 100-line file.

**Feedback addressed:**
> It seems like there is no limit to how much I can learn. When I click on today's lesson, each day it should calculate a certain amount of available lessons that can be done, similar to WaniKani.

> I didn't get a grammar lesson or SRS yet.

---

## 4.1 — Grammar is starved out of every relaxed lesson

Not a content gap. Grammar content exists (74 N5 items in `curriculum/grammar/n5.json`), `LessonItemView` renders it (`mobile/src/components/lesson/LessonItemView.tsx:69`), `lessonPlanner` buckets it, `promptResolver` gives it a `production` prompt, and `evaluateGrammarAnswer` grades it. It is wired end to end.

It is starved by the round-robin in `mobile/src/core/lesson/lessonPlanner.ts:41`:

```ts
const ROUND_QUOTAS = [
  { type: 'radical',    quota: 2 },
  { type: 'kanji',      quota: 2 },
  { type: 'vocabulary', quota: 2 },
  { type: 'grammar',    quota: 1 },   // ← last
];
```

with the fill loop at `lessonPlanner.ts:86`:

```ts
for (const { type, quota } of ROUND_QUOTAS) {
  ...
  for (let i = start; i < end && result.length < size; i++) { ... }
  if (result.length >= size) break;   // ← bails before grammar
}
```

**Relaxed intensity is `size: 5`** (`lessonPlanner.ts:28`). Trace round one: radical takes 2 (result = 2), kanji takes 2 (result = 4), vocabulary takes 1 and stops at the `result.length < size` guard (result = 5), the `break` fires. **Grammar is never reached. Not on day one, not ever.** A relaxed user — the default — will never see a grammar lesson.

Intense (`size: 10`) does slightly better: radical 2, kanji 2, vocab 2, grammar 1, then round two takes radical 2 and kanji 1. Grammar gets 1 slot in 10.

It compounds on a fresh account. `isItemUnlocked` (`mobile/src/core/content/dependencyGraph.ts:3`) gates kanji behind radicals and vocabulary behind kanji (`curriculum/dependencies/graph.json`: 165 `kanji ← radical`, 745 `vocabulary ← kanji`). **Grammar has zero incoming `requires` edges** — the only grammar edges are 458 outgoing `vocabulary ← grammar (reinforces)` — so grammar is unlocked from minute one. But on day one the radical bucket is deep and the kanji/vocab buckets are empty, so the loop fills all 5 slots from radicals and never advances. The one content type that is *always available* is the one that never gets picked.

**Fix.** Guarantee a floor rather than a trailing quota. Reserve a slot for each type that has available candidates before filling the remainder round-robin:

```ts
// Every type with candidates gets at least one slot when size allows.
// Remainder is distributed by weight, so grammar never starves and radicals
// never monopolise a first-day lesson.
```

Then fill by weight. With `size: 5` and all four types available: one each, one remainder to kanji. With `size: 5` and only radicals available (day one), all five go to radicals *and grammar*, because grammar is available. Concretely, day one should produce roughly 4 radicals + 1 grammar.

Add a test asserting `planLesson({ size: 5 })` returns ≥1 grammar item whenever grammar candidates exist. That test fails today.

**Check the review side too.** `queueBuilder`'s `INTERLEAVE_WEIGHTS` (`mobile/src/core/srs/queueBuilder.ts:20`) is `kanji: 2, vocabulary: 2, grammar: 1, radical: 1` but its round-robin has no `size` cap and no early `break` (`queueBuilder.ts:121`) — every eligible item lands in the queue. So reviews do **not** have the starvation bug. The user has never seen a grammar review because they have never had a grammar *lesson*, and `seedMissingSrsStatesForInProgress` only seeds items marked `in_progress`. Fixing the lesson planner fixes the review side for free.

---

## 4.2 — No daily lesson cap

`mobile/src/app/(tabs)/index.tsx:178` routes "Today's lesson" straight to `/lesson`. `useLessonPlan` (`mobile/src/data/hooks/useLessonPlan.ts:84`) builds a plan of `size` items on every mount, where `size` is `5` or `10` from intensity. `/lesson` commits them via `startLessonItems` on the final card (`mobile/src/app/lesson/index.tsx:34`) and returns home.

Tap "Today's lesson" again → `useLessonPlan` re-runs → the items just committed are now `in_progress` and correctly excluded → **a fresh batch of 5 appears.** There is no daily counter anywhere. A user can sit and learn the entire N5 curriculum in an evening, then be buried under 900 apprentice reviews for a fortnight. `size` is a *batch* size that the UI presents as a *daily* limit.

Note that a cognitive-load ceiling already exists and is enforced — `computeThreshold` / `addDailyLoad` / `cognitive_load_history` (`ReviewSessionProvider.tsx:120`, migration 008). But it only tracks **reviews**, and it is advisory: `DailyThresholdNotice` says *"Keep going if you like"* (`review/index.tsx:174`).

**Fix.** Introduce a daily lesson allowance, and reuse the cognitive-load infrastructure rather than inventing a parallel one.

- **Migration `013_daily_lesson_log.ts`** — `daily_lesson_log(date TEXT PRIMARY KEY, items_started INTEGER NOT NULL DEFAULT 0)`. `startLessonItems` increments it in the same transaction that writes `item_study_status`, so the counter cannot drift from reality.
- **`lessonAllowance.ts`** (core, pure) — `computeDailyAllowance({ intensity, itemsStartedToday, reviewsDueCount, recentLoads })`. WaniKani's lever is the apprentice-item count; ours should be the same idea expressed through the machinery we already have. A first cut:
  - Base allowance = `LESSON_SIZE_BY_INTENSITY[intensity] × 3` (15 relaxed / 30 intense per day).
  - Throttle when the review backlog is already large: if `reviewsDueCount > threshold`, shrink the allowance toward zero. Learning new items while 200 reviews are overdue is how people quit.
  - Never negative; always allow at least one lesson batch if `itemsStartedToday === 0`, so a returning user with a backlog isn't locked out entirely.
- **`useLessonPlan`** clamps `size` to `min(size, allowanceRemaining)`.
- **Home tab** shows the allowance, not just a button: *"Today's lesson — 5 of 15 remaining."* When exhausted, the card goes secondary and reads *"You've learned enough today. Come back tomorrow, or clear some reviews."*
- **`/lesson`** with zero allowance shows a distinct empty state. It must not read as the existing *"Nothing new today — you've started everything available"* (`lesson/index.tsx:56`), which means something entirely different and will confuse anyone who hits the cap.

Make the cap **advisory but real**: gate it behind an explicit "Learn anyway" confirmation rather than a hard block, matching the tone `DailyThresholdNotice` already sets. This is a no-accounts, on-device app — the user owns their pace. But the default should protect them.

---

## Acceptance criteria

- `planLesson({ size: 5 })` returns at least one grammar item whenever unstarted grammar candidates exist.
- A brand-new relaxed account's first lesson contains grammar.
- A grammar item that has been through a lesson appears in the next review queue.
- Starting a lesson increments `daily_lesson_log` atomically with `item_study_status`.
- Exhausting the daily allowance changes the home card and the `/lesson` empty state, with copy distinct from "nothing new to learn."
- The allowance shrinks when the review backlog is large.
- Crossing midnight resets the allowance.

## Files touched

- `mobile/src/core/lesson/lessonPlanner.ts`
- `mobile/src/core/lesson/lessonAllowance.ts` *(new)*
- `mobile/src/data/hooks/useLessonPlan.ts`
- `mobile/src/data/user/lessonProgressRepository.ts`
- `mobile/src/data/migrations/013_daily_lesson_log.ts` *(new)*
- `mobile/src/data/migrations/index.ts`
- `mobile/src/app/(tabs)/index.tsx`
- `mobile/src/app/lesson/index.tsx`
- `mobile/src/config/constants.ts`
