# Plan 01 — SRS scheduling correctness

**Priority:** P0 — this is a data-correctness bug, not a UX gap. Every review the user has done so far is scheduled wrong.

**Feedback addressed:**
> The SRS system doesn't seem to be working. Whenever I click on review it seems to always show the exact same thing that I already did 10 minutes ago. Like each item is kind of repeated again. Ideally if I give a correct answer the time or the interval that it should ask should increase.

> If I answer the meaning and reading correctly, it upgrades to guru, or is it if I answer one incorrectly, it downgrades to apprentice, something like that? (stage-transition half of this item — the re-quiz half lives in Plan 02)

---

## Root cause

`ts-fsrs` runs with `enable_short_term: true` (the default), which means a card in `New`/`Learning`/`Relearning` state is scheduled by **learning steps** rather than by the stability curve. The default steps are `['1m', '10m']` (`node_modules/ts-fsrs/dist/index.cjs:509`).

Which step a card is currently on is carried on the card itself, in `Card.learning_steps` (an *index*, not a duration). `ts-fsrs` reads it in `getLearningInfo` and writes the advanced index back onto the next card (`index.cjs:997`, `index.cjs:1022`).

We destroy that index on every round-trip. In `mobile/src/core/srs/fsrsScheduler.ts:65`:

```ts
return {
  due,
  stability: dbRow.stability,
  ...
  learning_steps: 0,   // ← always 0, regardless of the card's real step
  state: stringToFsrsState(dbRow.fsrsState),
  last_review: lastReview,
};
```

And `fromFsrsCard` (`fsrsScheduler.ts:94`) never copies `card.learning_steps` back out, because `SRSState` (`mobile/src/core/srs/srs.types.ts:7`) has no such field and `srs_states` has no such column (`mobile/src/data/migrations/003_srs_states_and_import_metadata.ts`).

So the loop is:

1. New card, `learning_steps` index 0. Answer `Good` → scheduled `10m`, next index `1`. Index `1` is thrown away.
2. 10 minutes later the card is due. We rebuild it with `learning_steps: 0`. Answer `Good` → scheduled `10m`, next index `1`. Thrown away.
3. Forever.

The card never graduates out of `Learning`, so it never reaches `State.Review`, so `next_interval()` is never called, so **the interval never grows past 10 minutes.**

This also explains the stage complaint. `mapFsrsStateToStageLabel` (`fsrsScheduler.ts:75`) returns `'apprentice'` for any card in `New | Learning | Relearning`. Since cards never leave `Learning`, **no item can ever display anything but Apprentice**, no matter how many times it is answered correctly.

## Verification before fixing

Reproduce in a unit test first, so the fix is provably a fix:

```ts
// mobile/src/core/srs/fsrsScheduler.test.ts
it('grows the interval across consecutive Good answers', () => {
  let state = createInitialSrsState('1', new Date('2026-01-01T00:00:00Z'));
  const dues: string[] = [];
  for (let i = 0; i < 4; i++) {
    const now = new Date(state.dueDate);
    state = gradeItem(state, 3, now);
    dues.push(state.dueDate);
  }
  // Currently: every entry is exactly +10m. Expected: strictly increasing gaps.
});
```

## Changes

### 1. Persist the learning-step index

- **Migration `011_srs_learning_steps.ts`** — `ALTER TABLE srs_states ADD COLUMN learning_steps INTEGER NOT NULL DEFAULT 0;` Register it in `mobile/src/data/migrations/index.ts`.
- **`srs.types.ts`** — add `learningSteps: number` to `SRSState`.
- **`srsStateRepository.ts`** — read/write the column in `getDueSrsStates`, `getSrsStatesForItems`, `upsertSrsState`, `seedMissingSrsStatesForInProgress`.
- **`fsrsScheduler.ts`** — `toFsrsCard` returns `learning_steps: dbRow.learningSteps`; `fromFsrsCard` returns `learningSteps: card.learning_steps`; `createInitialSrsState` returns `learningSteps: 0`.
- **`fsrsConverter.ts`** — imported WaniKani/Bunpro/Anki cards land in `Review` state with real stability, so `learningSteps: 0` is correct for them. Assert this explicitly rather than letting it default.

Existing rows default to `0`, which is exactly where they are today. No data repair needed — the fix is forward-only and lossless.

### 2. Decide the learning-step policy deliberately

Right now we inherit `['1m', '10m']` implicitly. For a WaniKani-style app the first correct answer should not come back in one minute. Set it explicitly in the `fsrs()` call (`fsrsScheduler.ts:5`) so the policy is visible and reviewable:

```ts
const SCHEDULER = fsrs({
  request_retention: 0.9,
  maximum_interval: 3650,
  learning_steps: ['10m'],      // one short step, then graduate to the stability curve
  relearning_steps: ['10m'],
});
```

With a single learning step, one `Good` answer graduates the card to `Review` and hands scheduling to FSRS proper — which is the behaviour the feedback is asking for. Keep `enable_short_term: true` so the 10-minute confirmation still happens; it is genuinely valuable right after a lesson.

Note the interaction with Plan 02: if incorrect items are re-asked *within the session*, the `Again` grade already gets its retry immediately, and the 10-minute step is doing less work than it looks like it is. Land Plan 01 first, then revisit whether `learning_steps: []` (graduate immediately) reads better.

### 3. Make the stage ladder reachable

`mapFsrsStateToStageLabel` is correct in shape but unreachable in practice. Once cards graduate, re-check the boundaries against `fsrsConverter.ts` so an item imported at Guru and an item grown to Guru in-app land on the same label:

| Stage | Current rule | Keep? |
|---|---|---|
| apprentice | `New`/`Learning`/`Relearning`, or `stability < 7` | yes |
| guru | `stability < 21` | yes |
| master | `stability < 120` | yes |
| enlightened | `stability < 365` | yes |
| burned | `stability >= 365` or sticky `isBurned` | yes |

Add a test asserting a card graded `Good` repeatedly walks apprentice → guru → master → enlightened, which is impossible today.

## Acceptance criteria

- A card graded `Good` four times in a row produces four strictly increasing due-date gaps, and the fourth is measured in days, not minutes.
- A card graded `Good` repeatedly eventually reports `srsStageLabel === 'guru'`, then `'master'`.
- A card graded `Again` from `Review` state moves to `Relearning` and reports `'apprentice'`.
- `learning_steps` survives a write/read round-trip through `srs_states`.
- Existing rows migrate without loss; an imported Guru item still reports Guru.

## Files touched

- `mobile/src/core/srs/fsrsScheduler.ts`
- `mobile/src/core/srs/srs.types.ts`
- `mobile/src/data/user/srsStateRepository.ts`
- `mobile/src/data/migrations/011_srs_learning_steps.ts` *(new)*
- `mobile/src/data/migrations/index.ts`
- `mobile/src/core/import/fsrsConverter.ts`
