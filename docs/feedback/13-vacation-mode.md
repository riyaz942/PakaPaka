# Plan 13 — Vacation mode

Built 2026-07-28. A WaniKani-style pause switch in Settings that freezes review
build-up, and answers the long-open goal-ring question **O4**.

| # | Item | Status |
|---|------|--------|
| 13.1 | Settings toggle that pauses reviews and lessons | **Done** |
| 13.2 | Due dates shift forward by the vacation length on resume | **Done** |
| 13.3 | Goal ratchet re-anchored so weeks away are not judged as missed | **Done** |
| 13.4 | Home paused surface (vacation card replaces the goal ring) | **Done** |

---

## 13.1 — Why

Reviews accumulate unconditionally: `queueBuilder`'s round-robin has no size cap
and no early break, so every eligible item lands in the queue. Take two weeks
off and you come back to a wall of overdue cards — the churn driver the product
brief names first ("the '200 reviews pending' anxiety is the number one reason
learners abandon SRS apps").

Welcome-back triage (FR61) only *slices* the pile after the fact. Vacation mode
prevents it from forming.

This also closes brainstorm open question **O4** — "Yuki's goal stays high across
an absence (good for the ratchet) but may be punishing on return; interaction
with welcome-back triage undefined." With vacation mode on, no absence is
recorded at all: the goal week is re-anchored on resume, and the due count on
return is small enough that welcome-back never fires.

Note this is *not* the streak freeze that `6-4-streak-tracking...` ruled out of
MVP. Streaks were later removed from Home entirely (decision-log R2); this is
about review scheduling, not loss-aversion mechanics.

## 13.2 — Behaviour

**Vacation mode pauses everything.** Reviews and lessons are both unavailable
while it is on. Allowing lessons was considered and rejected: new items created
mid-vacation would need special-casing in the shift, and learning new material
you can't review is not much of a rest.

**On resume, every not-yet-due card is pushed forward by the length of the
break.** Cards already overdue when the break began stay due — the user had
already fallen behind and vacation mode does not erase that. Everything else
keeps its spacing relative to the other cards, so the backlog re-spreads across
the days after resume rather than landing in one lump. A card due on day 7 of a
10-day break comes due 7 days after resume.

**`last_reviewed_at` shifts by the same delta.** `toFsrsCard` derives
`elapsed_days` from it, so shifting only `due_date` would leave FSRS believing
the user retained each card across the entire vacation — inflating stability
gains and stretching every subsequent interval. Moving both makes each card
behave exactly as if the break never happened. The scheduler itself
(`core/srs/fsrsScheduler.ts`) is untouched; this is a data shift in the
repository layer.

Timestamps are recomputed in TypeScript, not with SQLite's `datetime()`, which
emits `YYYY-MM-DD HH:MM:SS` and would break the lexicographic ISO comparison the
entire due path depends on.

If the device clock has moved backwards since the break began, the shift is
skipped (it would pull cards *earlier*) but vacation mode still turns off —
otherwise the user is stuck paused until the clock catches up.

## 13.3 — Goal ring

`runWeeklyGoalCheck` walks every Monday boundary since its last anchor and
increments `consecutiveMissWeeks` for each one, *including* weeks that fail the
`GOAL_RING_MIN_ACTIVE_DAYS` sample gate. Left alone, a three-week vacation would
greet the returning user with a "been a tough stretch? you can lower your goal"
offer they did not earn.

Two changes: `useCognitiveLoad` skips the check entirely while paused, and
`endVacation` calls the new `anchorGoalWeek` to move the anchor to the current
week without judging anything in between. The goal target itself is never
touched — every downward move stays opt-in (brainstorm O8).

Days-studied needed no change: `cognitive_load_history` only gets rows on active
days, so vacation days are simply absent rather than marked as misses.

## 13.4 — Surfaces

Settings gains a "Vacation mode" section after Review pacing: one switch, a
"Paused since {date}" line while on, and a "N reviews rescheduled" confirmation
on resume.

Home replaces the goal ring outright with a vacation card (`休`, "Vacation mode
is on", a link back to Settings). Dimming the ring was rejected — a paused goal
has nothing honest to show, and a rest that renders as a failed day defeats the
point of taking one (UX-DR: "permission to stop is permission to return"). The
Review and Learn cards go disabled, and the forecast, at-risk section and goal
prompts are hidden. The due and lesson-allowance reads are skipped entirely so
the paused surface can never quote a backlog that is still growing behind it.

`useReviewQueue` and `useLessonPlan` both return empty while paused, so deep
links and the legacy `href: null` routes can't bypass the disabled CTAs.

## Files

- `src/data/user/vacationRepository.ts` (new) — `isVacationActive`,
  `startVacation`, `endVacation`
- `src/data/user/srsStateRepository.ts` — `shiftDueDatesAfter`
- `src/data/user/goalRingRepository.ts` — `anchorGoalWeek`
- `src/data/user/preferencesRepository.ts` — `vacation_started_at` key (one key
  carries both the on/off state and the start timestamp), plus `clearPreference`
- `src/data/hooks/useVacationMode.ts` (new)
- `src/app/(tabs)/settings.tsx`, `src/app/(tabs)/index.tsx`
- Guards in `useReviewQueue.ts`, `useLessonPlan.ts`, `useCognitiveLoad.ts`

No migration — `user_preferences` is already a key/value table.

`__mocks__/expo-sqlite.ts` gained branches for the two new statement shapes. The
mock silently returns every row for unrecognised `WHERE` clauses, so a missing
branch shows up as a test that passes for the wrong reason.
