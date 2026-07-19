---
baseline_commit: ff3fc6fca4038e1993aa2214a3bd6bedb3681c8d
---

# Story 1.1: Two-Card Kanji Grading

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a learner,
I want each kanji reviewed as separate meaning and on'yomi cards with correct reading-type validation,
so that I practise the right skill and my SRS grade isn’t polluted by accepting the wrong reading type.

## Acceptance Criteria

1. **Given** a kanji due for review  
   **When** the queue builds cards for that item  
   **Then** I receive two cards — meaning and on'yomi reading — both required before the item can advance  
   **And** the reading prompt is labeled (e.g. “Reading — on'yomi”) and validates only on'yomi (FR81, FR5)  
   **And** kun'yomi is not accepted as the kanji reading answer (kun'yomi delivered via vocabulary pairing)

2. **Given** I submit a reading that is valid for the other reading type but not the prompted type  
   **When** the answer is evaluated  
   **Then** the result is non-terminal `wrong_reading_type` (nudge + re-prompt)  
   **And** no FSRS grade and no weakness signal are recorded (FR82, FR14)

3. **Given** I have answered both cards for a kanji in one session  
   **When** the item’s grade is applied  
   **Then** a single FSRS update uses worst-of-both  
   **And** there is no double FSRS write and no SRS schema change (FR83)  
   **And** BUG3 is fixed (flattened any-reading acceptance is gone)

4. **Given** vocabulary or grammar cards in the same session  
   **When** they are presented  
   **Then** existing single-card behavior remains unchanged

## Tasks / Subtasks

- [x] **Task 1 — Fix kanji answer-key assembly (BUG3)** (AC: #1, #3)
  - [x] In `buildAnswerKey` (`useReviewQueue.ts`), for `itemType === 'kanji'` reading prompts: accept **only** `onyomi` rows from `getKanjiReadings` (+ user reading synonyms). Do **not** merge all `kanji_readings` or untyped `accepted_answers` readings into one flat set.
  - [x] Keep kun'yomi available for evaluation as an alternate set (e.g. `alternateReadings` / `rejectedTypeReadings` on `ReviewAnswerKey`) so `wrong_reading_type` can detect them — do not treat them as correct.
  - [x] Vocabulary / radical / grammar answer-key paths unchanged.

- [x] **Task 2 — Emit two cards per due kanji** (AC: #1, #4)
  - [x] Stop using rep-parity for kanji (`resolvePromptType` parity path must not choose meaning XOR reading for kanji).
  - [x] For each due kanji, emit **two** `ReviewItem`s (same `itemId` / `srsState`): one `promptType: 'meaning'`, one `promptType: 'reading'` with on'yomi-only `acceptedReadings`.
  - [x] Prefer expanding **before** / as part of queue build so the mixer can separate the pair (do not force meaning→reading back-to-back).
  - [x] Vocabulary (including kanji-bearing vocab) and grammar remain **one card** with existing `resolvePromptType` behavior.
  - [x] Edge: kanji with **zero** on'yomi rows → emit meaning card only; grade immediately like a single-card item (log `__DEV__` warning). Do not emit an empty reading card.

- [x] **Task 3 — `wrong_reading_type` evaluation** (AC: #2)
  - [x] Extend `AnswerResult` with `'wrong_reading_type'` (parallel to `'wrong_script'`, not only a `feedbackKind`).
  - [x] In `evaluateReviewAnswer` for kanji reading prompts: if answer matches a kun'yomi / alternate reading (after `normalizeKana`) but not an accepted on'yomi → `{ result: 'wrong_reading_type' }`.
  - [x] `gradeForResult('wrong_reading_type')` → `null` (non-terminal).
  - [x] Typo / incorrect / wrong_script precedence unchanged: check wrong_reading_type only when the answer is a valid alternate-type reading; near-miss on'yomi still uses typo path.

- [x] **Task 4 — Worst-of-both single FSRS write** (AC: #3)
  - [x] In `ReviewSessionProvider`, hold first-attempt terminal outcomes per `itemId` for two-card kanji until **both** cards have a terminal first-attempt (`correct` | `incorrect`).
  - [x] Then call `gradeItem` / `upsertSrsState` **once** with worst-of-both:
    - any card `incorrect` → Again (`1`)
    - else if any card used hints (existing Story 5.4 rule) → Hard (`2`)
    - else both correct → Good (`3`)
  - [x] Never double-update FSRS. No `srs_states` PK / schema change.
  - [x] `addDailyLoad` / `domainCounts` / `correctCount` / streak / boosts: fire **once** when the item grade is applied (not per card).
  - [x] Weakness `recordOutcome`: once per **terminal card** with that card’s `promptType` (so meaning vs reading weakness stays useful); **never** on `wrong_reading_type` / typo / wrong_script.
  - [x] Retries: re-queue **only the failed card** (existing retry tail behavior); retries remain pedagogical (no second FSRS write).
  - [x] Single-card items (vocab / grammar / radical / meaning-only kanji edge): keep current immediate-grade path.

- [x] **Task 5 — UI: label + non-terminal nudge** (AC: #1, #2)
  - [x] Kanji reading mode label: `Reading — on'yomi` (not bare `Reading`). Meaning stays `Meaning`.
  - [x] Add `ReviewCardState` / screen branch for `wrong_reading_type` mirroring `wrong_script` (amber nudge, clear input, re-prompt, keep input editable).
  - [x] Nudge copy: `We're looking for the on'yomi reading.`
  - [x] Wire `review/index.tsx` submit path: treat `wrong_reading_type` like `wrong_script` (no `gradeCurrentItem`, no typo weakness).
  - [x] Stage-transition peek / pending grade: only when the item-level grade is known (both cards done for two-card kanji).

- [x] **Task 6 — Session progress must not stall under two cards** (AC: #1, #3; enables Story 1.2)
  - [x] Treat the queue as **cards**: `totalItems = queue.length` after expansion.
  - [x] Advance `retiredCount` / header progress **per completed card** (correct first-attempt or successful retry), not only when the pair’s FSRS write fires — otherwise the header stalls (BUG4 precursor).
  - [x] Full FR86 polish / AnswerReveal / Return-to-advance remain Story **1.2** — do not implement those here.

- [x] **Task 7 — Tests** (AC: #1–#4)
  - [x] `buildAnswerKey` / queue: kanji → two cards; on'yomi-only readings; vocab/grammar single-card unchanged.
  - [x] `evaluateReviewAnswer`: kun'yomi on on'yomi prompt → `wrong_reading_type`; true on'yomi → correct; unknown → incorrect; typo still typo.
  - [x] `gradeForResult`: `wrong_reading_type` → null.
  - [x] `ReviewSessionProvider`: two-card item → exactly one `upsertSrsState`; worst-of-both matrix (both good / one fail / both fail); load increment once; failed card only retries; single-card path regression.
  - [x] `ReviewCard` / `review/index`: label + nudge + non-terminal submit path.
  - [x] Update `promptResolver` tests: kanji no longer depends on parity for the two-card emit path.

## Dev Notes

### Scope boundaries

| In scope (1.1) | Out of scope (→ 1.2 or later) |
| --- | --- |
| Two cards per kanji, on'yomi-only, BUG3 | Return-to-advance / Lightning Mode opt-in (FR84) |
| `wrong_reading_type` | Shared `AnswerReveal` (FR85) |
| Worst-of-both single FSRS write (FR83) | Details under `review/` |
| Minimal card-native progress (no stall) | FR86 polish, Compare collision link (FR86/C2) |
| Vocab/grammar unchanged | Two-card vocabulary (brainstorm A5 mentioned it; **Epic AC forbids it**) |

**Do not confuse** with legacy files `_bmad-output/implementation-artifacts/1-*-bootstrap-*.md` etc. — those are the **old** Epic 1 (installable shell). This story is the **v2** Epic 1: Kanji Review Clarity.

### Current behavior (must change)

| Area | Today | Target |
| --- | --- | --- |
| Kanji prompts | One card; `resolvePromptType` parity (`reps % 2`) | Two cards every time (meaning + on'yomi) |
| Readings | `useReviewQueue.ts` merges **all** `getKanjiReadings` into `acceptedReadings` (BUG3) | On'yomi only for kanji reading card |
| Evaluation | `correct \| incorrect \| typo \| wrong_script` | + `wrong_reading_type` |
| FSRS | `gradeCurrentItem` writes once per first-attempt **card** | Hold pair → one write per **item** |
| Progress | `retiredCount` / `queue.length` | Same fields, but queue = cards; retire per card |

### Architecture compliance (non-negotiable)

- **Never** double-update FSRS for a two-card kanji item. [Source: `architecture.md` — Enforcement MUST #10]
- **No** `srs_states` schema fork / per-prompt-type PK. Worst-of-both against the existing single row. [Source: FR83, brainstorm A4 option C rejected]
- Pure logic in `core/answer/` + `core/srs/`; UI only renders. [Source: `architecture.md` placement table]
- Fallible async → `Result<T, AppError>`; review never throws across async; failed SRS writes stay in `pendingWrites` / unmount flush. [Source: project conventions]
- Dual DB unchanged: curriculum reads (`getKanjiReadings`); user writes (`upsertSrsState`, weakness, load).
- NFR1: keep grade hot path &lt;100ms (pairing bookkeeping is in-memory Map, not extra DB round-trips before UI feedback).
- NFR5b: no new review-loop animations.

### Worst-of-both algorithm (implement exactly)

```
firstAttemptOutcomes[itemId] = { meaning?: 'correct'|'incorrect', reading?: 'correct'|'incorrect', hintsUsedMax: number }

when both meaning and reading first-attempts are terminal:
  if either === 'incorrect' → grade 1 (Again)
  else if hintsUsedMax > 0 → grade 2 (Hard)   // preserve Story 5.4
  else → grade 3 (Good)

then: upsertSrsState once, clearBoosts once, load once, domainCounts once
re-queue each incorrect card only
```

Non-terminal (`typo`, `wrong_script`, `wrong_reading_type`) never enter the pair map and never call weakness/FSRS.

### Files to touch (expected)

| File | Change |
| --- | --- |
| `mobile/src/data/hooks/useReviewQueue.ts` | BUG3 fix; expand kanji → 2 cards; alternate readings on key |
| `mobile/src/core/srs/promptResolver.ts` | Kanji no longer XOR via parity (or only used for non-kanji) |
| `mobile/src/core/srs/srs.types.ts` | Optional `alternateReadings` / reading-type metadata on answer key or item |
| `mobile/src/core/answer/answer.types.ts` | Add `wrong_reading_type` |
| `mobile/src/core/answer/reviewAnswerEvaluator.ts` | Detect wrong type; `gradeForResult` |
| `mobile/src/providers/ReviewSessionProvider.tsx` | Pair bookkeeping; deferred single FSRS; card-level retiredCount |
| `mobile/src/app/review/index.tsx` | Submit branch for `wrong_reading_type`; defer peek/grade until pair ready |
| `mobile/src/components/review/ReviewCard.tsx` | Label + state + nudge |
| Tests listed in Task 7 | |

**Reuse, do not reinvent:** `evaluateReading` / `normalizeKana`, `getKanjiReadings` (`readingType: 'onyomi' \| 'kunyomi'` already exists), `wrong_script` UI/session pattern, `gradeItem` / `upsertSrsState`, retry tail in provider.

### Anti-patterns (will fail review)

- Accepting any kanji reading on the reading card (BUG3 left in place)
- Calling `upsertSrsState` after each kanji card
- Splitting SRS by `prompt_type` in SQLite
- Making vocabulary two-card in this story
- Putting `wrong_reading_type` only as grammar-style `feedbackKind` without a top-level `AnswerResult` / card state
- Leaving `retiredCount` item-scoped so the header freezes until both cards finish

### Project Structure Notes

- Path alias `@/*` → `mobile/src/*`
- Review route shell already wraps `ReviewSessionProvider` in `app/review/_layout.tsx` — keep session ownership there
- Semantic NativeWind only (`text-content-reading`, `text-feedback-*`, etc.)

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1 / Story 1.1]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR5 amended, FR81–FR83, BUG3]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — two-card / worst-of-both, MUST #10]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — ReviewCard states, “Reading — on'yomi”, UX-DR7/29]
- [Source: `_bmad-output/brainstorming/brainstorming-session-2026-07-19-1628.md` — A1–A5]
- [Source: `_bmad-output/planning-artifacts/.decision-log.md` — R4]
- [Source: `mobile/src/data/hooks/useReviewQueue.ts` — BUG3 locus ~L81–84]
- [Source: `mobile/src/providers/ReviewSessionProvider.tsx` — grade / retry / retiredCount]
- [Source: `mobile/src/core/answer/reviewAnswerEvaluator.ts` — evaluation + `gradeForResult`]

### Previous Story Intelligence

No prior story in **v2** Epic 1. Relevant brownfield patterns from earlier shipped review work:

- Story 5.3 centralized `evaluateReviewAnswer` + `gradeForResult` and the submit state machine in `review/index.tsx` — extend, don’t fork a second evaluator.
- Story 5.4 hint→Hard lives in `gradeForResult` / hint count threading — worst-of-both must preserve it when combining card outcomes.
- Provider contract: retries pedagogical; first attempt owns FSRS/weakness/load; `pendingWrites` + unmount flush — keep intact when deferring the pair write.
- `wrong_script` is the template for `wrong_reading_type` (non-terminal, no weakness).

### Git Intelligence Summary

Recent commits are planning/curriculum (v2 epics, UX, decision log, N5 examples) — no review-engine code landed for two-card yet. Implement against current `mobile/src` review stack as described above.

### Latest Tech Information

- App already depends on `ts-fsrs@^5.4.1` — keep using existing `gradeItem` wrapper; do **not** add a second scheduler call per card.
- Rating enum remains Again/Hard/Good/Easy (`1|2|3|4`); this story only emits 1/2/3 via worst-of-both + hints.

### Project Context Reference

No `project-context.md` in repo. Follow `CLAUDE.md` / workspace conventions: `Result` type, dual DB, NativeWind tokens, `@/*` alias.

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5) via Claude Code

### Debug Log References

- Full suite: 121 suites / 905 tests pass. `npm run typecheck` clean. `npm run lint` clean.
- Only pre-existing test updates needed: kanji parity expectations in `promptResolver.test.ts`, bare `Reading` label in `ReviewCard.test.tsx` (both were asserting the old behavior this story removes).

### Completion Notes List

- **BUG3 fixed** in `buildAnswerKey`: kanji reading key now accepts only `onyomi` rows from `getKanjiReadings` plus user reading synonyms. Untyped `accepted_answers` reading rows are dropped for kanji; kun'yomi rows go to a new `ReviewAnswerKey.alternateReadings` field (deduped, minus normalized collisions with accepted readings). Non-kanji paths untouched.
- **Two-card emit** lives in `buildReviewQueue`: the round-robin mixer orders items, then an expansion pass emits meaning + reading cards (`isTwoCardItem: true`, shared `srsState`) for each kanji with `kanjiHasOnyomi`. The reading card is deferred at least `KANJI_PAIR_MIN_GAP` (2) cards so the pair never lands back-to-back unless the queue is too short. Zero-on'yomi kanji emit a meaning card only (single-card grade path) with a `__DEV__` warning; `resolvePromptType` now returns `meaning` for kanji (parity kept for vocabulary only).
- **`wrong_reading_type`** added as a top-level `AnswerResult`. Detected in `evaluateReviewAnswer` only when the accepted set fully missed and the answer exactly matches an alternate reading after `normalizeKana` — near-miss on'yomi still hits the typo path; unknown readings stay `incorrect`. `gradeForResult` returns `null` (non-terminal). `PassageAnswerResult` excludes it (passages stay correct/incorrect).
- **Worst-of-both single write**: `ReviewSessionProvider` holds first-attempt grades per two-card item in an in-memory `pairGradesRef` map; when both cards are terminal it applies `combinePairGrades` (numeric min — Again dominates, Hard capped, preserving the Story 5.4 hint→Hard rule structurally) via a new `applyItemGrade` helper that owns the single `upsertSrsState`, boost consume/apply, streak, cognitive load, and summary counters. Weakness `recordOutcome` fires once per terminal card with that card's `promptType`. Retries re-queue only the failed card and never write. `peekStageTransition` returns null on a two-card item until the pair-completing card, which peeks the combined grade. Abandoning a session mid-pair writes nothing (same contract as abandoning before any first attempt).
- **UI**: kanji reading card labeled `Reading — on'yomi`; `wrong_reading_type` card state mirrors `wrong_script` (amber nudge `We're looking for the on'yomi reading.`, input cleared, editable, re-prompt, no grade/weakness). MC collapse in `review/index.tsx` includes the new state defensively (grammar MC can't produce it).
- **Progress**: queue is already card-native after expansion (`totalItems = queue.length`); `retiredCount` advances per completed card, so the header never stalls waiting for a pair's FSRS write.
- Note: kanji cards currently have no hint UI (hints are grammar-only), so `combinePairGrades` will see Hard only if a future story threads hint-derived grades; the combiner already supports it.

### File List

- mobile/src/core/answer/answer.types.ts — `wrong_reading_type` in `AnswerResult`
- mobile/src/core/answer/reviewAnswerEvaluator.ts — alternate-reading detection; doc update
- mobile/src/core/answer/evaluatePassageAnswer.ts — exclude `wrong_reading_type` from passage results
- mobile/src/core/srs/srs.types.ts — `ReviewAnswerKey.alternateReadings`, `ReviewItem.isTwoCardItem`
- mobile/src/core/srs/promptResolver.ts — kanji no longer parity-driven
- mobile/src/core/srs/queueBuilder.ts — two-card expansion with pair gap; `kanjiHasOnyomi` input; prompt override in mapper
- mobile/src/core/srs/pairGrading.ts — new: `combinePairGrades` worst-of-both
- mobile/src/data/hooks/useReviewQueue.ts — BUG3 fix in `buildAnswerKey` (now exported); `kanjiHasOnyomi` threading; zero-on'yomi dev warning
- mobile/src/providers/ReviewSessionProvider.tsx — pair bookkeeping, `applyItemGrade`, per-card weakness/progress, pair-gated peek
- mobile/src/app/review/index.tsx — `wrong_reading_type` submit branch, editable/focus states, MC collapse
- mobile/src/components/review/ReviewCard.tsx — `Reading — on'yomi` label; `wrong_reading_type` nudge state
- mobile/src/core/srs/pairGrading.test.ts — new
- mobile/src/data/hooks/useReviewQueue.test.ts — new: `buildAnswerKey` unit tests
- mobile/src/core/srs/queueBuilder.test.ts — two-card expansion suite
- mobile/src/core/srs/promptResolver.test.ts — kanji expectations updated
- mobile/src/core/answer/reviewAnswerEvaluator.test.ts — `wrong_reading_type` suite; `gradeForResult` null case
- mobile/src/providers/ReviewSessionProvider.test.tsx — worst-of-both matrix, per-card weakness/progress, peek gating, single-card regression; `recordOutcome` mocked
- mobile/src/components/review/ReviewCard.test.tsx — label tests split kanji/vocab; nudge state test
- mobile/src/app/review/index.test.tsx — kun'yomi nudge non-terminal path; label test

## Change Log

- 2026-07-20 — Story 1.1 implemented: two-card kanji grading (meaning + on'yomi), BUG3 on'yomi-only answer key, non-terminal `wrong_reading_type`, worst-of-both single FSRS write, card-native session progress. 121 suites / 905 tests green; typecheck + lint clean. Status → review.
- 2026-07-20 — Code review patches applied: pair-safe queue limit, duplicate grade latch, exact-alternate-over-typo precedence, blank on'yomi filter. Status → done.

### Review Findings

- [x] [Review][Patch] `options.limit` can orphan a two-card kanji pair — slice after expansion can keep `isTwoCardItem: true` meaning without its reading partner, so `pairGradesRef` never completes and FSRS never writes [`mobile/src/core/srs/queueBuilder.ts:186`]
- [x] [Review][Patch] Unguarded double `gradeCurrentItem` on incomplete two-card item — first pair card never latches `isGrading`, and `handleContinueIncorrect` has no submit latch, so a double Continue advances the cursor twice and can skip the partner (pair never FSRS-writes) [`mobile/src/providers/ReviewSessionProvider.tsx:340`] [`mobile/src/app/review/index.tsx:303`]
- [x] [Review][Patch] Exact kun'yomi can lose to typo path — `wrong_reading_type` is only checked when `evaluateReading` returns `incorrect`, so an exact alternate within on'yomi typo distance records typo/weakness instead of the non-terminal nudge (AC2 / Task 3) [`mobile/src/core/answer/reviewAnswerEvaluator.ts:54`]
- [x] [Review][Patch] Blank/whitespace on'yomi rows still set `kanjiHasOnyomi` — emits a reading card with no usable accepted readings [`mobile/src/data/hooks/useReviewQueue.ts:94`]
