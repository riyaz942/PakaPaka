---
baseline_commit: ff3fc6fca4038e1993aa2214a3bd6bedb3681c8d
depends_on: 1-1-two-card-kanji-grading
---

# Story 1.2: Review Pacing, Reveal & Card Progress

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a learner,
I want Return-to-advance pacing, a clear inline reveal, and a progress counter that tracks cards,
so that a longer two-card session still feels fast, honest, and controllable.

## Acceptance Criteria

1. **Given** I answered a card correctly  
   **When** I press Return  
   **Then** the answer is submitted on first Return and the session advances on the next Return  
   **And** 800ms auto-advance is off by default and only runs if enabled in Settings (FR84)  
   **And** multiple-choice / incorrect paths show a visible Continue control

2. **Given** any graded answer (correct or incorrect)  
   **When** the result is shown  
   **Then** a shared `AnswerReveal` shows reading + meaning (trimmed) on both paths (FR85, UX-DR8)  
   **And** no review-loop animations delay the next card (NFR5b)  
   **And** deeper detail opens a details route mounted under `review/` so the session survives (FR85)

3. **Given** a session that includes two-card kanji  
   **When** I view the session header progress  
   **Then** progress counts **cards** (`N of M`), not items (FR86, UX-DR9)  
   **And** BUG4 is fixed (counter does not stall)

4. **Given** my answer collides with another item’s accepted answer  
   **When** the reveal is shown  
   **Then** one extra line explains the collision and links to Compare with both items preselected (FR86)  
   **And** if Compare UI is not yet built, the route/params contract is stubbed so Epic 4 can fill it without rework

5. **Given** deferred grades waiting on an indefinite Return advance  
   **When** I eventually continue or leave the session  
   **Then** the deferred-grade flush contract still applies correctly (FR84)

## Tasks / Subtasks

- [x] **Task 1 — Return-to-advance + Lightning Mode preference** (AC: #1, #5)
  - [x] Stop unconditional `setTimeout(..., REVIEW_CORRECT_AUTO_ADVANCE_MS)` on correct in `review/index.tsx`.
  - [x] Default path: set `cardState = 'correct'`, stash grade in `pendingGradeRef`, **wait** for second Return (or Continue) before calling `gradeCurrentItem`.
  - [x] Second Return while `cardState === 'correct'`: clear pending + call `gradeCurrentItem` (advance). Do **not** re-evaluate empty input. Today `inputEditable` excludes `correct` and `editable={false}` — fix so Return still advances (keep input mounted/focused for typed path; see Dev Notes).
  - [x] MC correct + incorrect: always show visible **Continue** (no keyboard assumption). Incorrect Continue already exists; add Continue for MC-correct when auto-advance is off (and keep it as the advance control when Lightning Mode is on too for MC — MC has no Return).
  - [x] Add preference key (e.g. `review_auto_advance`) via `PREFERENCE_KEYS` + `get`/`set` helpers in `preferencesRepository.ts`. **Default off** (`null`/`false` = off).
  - [x] Settings toggle (UX-DR10 / UX-DR33): label clearly as auto-advance after correct / Lightning Mode; pattern after `useReducedMotion` + Settings `Switch`.
  - [x] When preference **on**: restore 800ms timer using existing `REVIEW_CORRECT_AUTO_ADVANCE_MS` (keep constant; update its comment — no longer “Epic 6”).
  - [x] Preserve `flushPendingGrade` on unmount and `handleEndSession`. Under indefinite wait, pending grade must still flush on exit/unmount so a correct answer is never lost (FR84). Cursor-change reset may clear timer/pending **without** flush only when advancing (existing intentional behavior).
  - [x] No new review-loop animations (NFR5b).

- [x] **Task 2 — Shared trimmed `AnswerReveal`** (AC: #2)
  - [x] Create `mobile/src/components/review/AnswerReveal.tsx` (+ tests): panel shows **reading + meaning only** (trimmed). Reuse data already available from `ReviewItem` + prefetched `ReviewRevealDetail` (`useReviewRevealDetails`) — do not fetch on reveal.
  - [x] Wire on **correct** path in `ReviewCard` (under ✓ / keep stage badge + `ReinforcementHighlight`).
  - [x] Refactor `IncorrectReveal` to compose `AnswerReveal` for the meaning/reading block; **remove** mnemonic + examples from the inline incorrect panel (move depth to details link — FR85/B2). Keep near-miss grammar teaching chrome, synonym offer, and primary-form / “Correct answer” header as incorrect-path chrome around the shared panel.
  - [x] Export from `components/review/index.ts`.
  - [x] Resolve ambiguity: correct path shows the panel **expanded** (epics/FR85/UX-DR8). Do **not** gate behind an icon unless product revisits — brainstorm “collapsed behind icon” is superseded by AC wording “shows”.
  - [x] Historical `docs/feedback/03-*` mnemonic-on-incorrect is **superseded** by FR85 — do not restore mnemonic/examples inline.

- [x] **Task 3 — Details route under `review/`** (AC: #2)
  - [x] Add nested route e.g. `mobile/src/app/review/item/[id].tsx` inside the existing `review/_layout.tsx` `Stack` so `ReviewSessionProvider` **does not remount**.
  - [x] “See full details” (or equivalent) from the reveal navigates here — **never** to `(tabs)/learn/item/[id]` (that destroys the session; review is a fullScreenModal sibling of tabs).
  - [x] Stub or thin reuse of existing detail sections is OK for this story; session back-stack must return to the same card. Prefer a working back affordance over a perfect details redesign (Epic 4 owns full details split).

- [x] **Task 4 — Card-based progress / BUG4** (AC: #3)
  - [x] Coordinate with Story **1.1** Task 6: queue length = **cards** after kanji expansion; advance header progress **per completed card**, not when the item’s worst-of-both FSRS write fires.
  - [x] If 1.1 is not merged yet: implement progress semantics so that when two cards share an `itemId`, the header still moves per card completion; do not wait on pair FSRS.
  - [x] Update `SessionHeader` comments / a11y from “Item N of M” → card-oriented wording (architecture naming: prefer `cardsCompleted` / `totalCards` in progress UI semantics; prop renames OK if call sites updated). Keep visual `"N of M"`.
  - [x] Preserve monotonic progress (never moves backwards) and clamp while retries are in flight.
  - [x] Do **not** make vocabulary two-card (Epic AC forbids; 1.1 scope table).

- [x] **Task 5 — Answer-collision line + Compare route stub** (AC: #4)
  - [x] On graded incorrect (and optionally correct if a collision context exists — primary case is incorrect / confusion): if the submitted answer matches another curriculum item’s accepted answer, show one extra line (copy intent: what you answered belongs to a different item) + link to Compare with **both** item IDs preselected (FR86, UX-DR8/29, D-DET-2).
  - [x] Prefer a formal `feedbackKind: 'confused_with'` (architecture answer-feedback union) when detection is clean; otherwise annotate reveal props — but do not invent a second parallel collision system. Reuse normalization helpers (`normalizeMeaning` / `normalizeKana`). Synonym-add collision in `addSynonymForCurrentItem` is a **related** pattern but scans only the session queue — evaluation collision should look up against curriculum accepted answers (or a dedicated query), not only the current queue.
  - [x] **Stub Compare route** under `review/` so session survives, e.g. `review/compare.tsx` with search params:
    - **Contract (lock for Epic 4 / Story 4.2):** `left` = current item id, `right` = colliding item id (both required strings).
    - Stub UI: minimal placeholder (“Compare coming soon”) + Back; preserve params. Do not build sticky glyphs / chips here (Story 4.2).
  - [x] Document the contract in Dev Notes / code comment on the stub route so Story 4.2 can replace the body without changing the deep-link shape.

- [x] **Task 6 — Tests** (AC: #1–#5)
  - [x] `review/index.test.tsx`: Return submit → correct waits; second Return advances; Lightning Mode on → auto-advance after 800ms; unmount/end still flushes pending grade under indefinite wait; MC correct shows Continue.
  - [x] `AnswerReveal.test.tsx`: reading + meaning on both composition paths; no mnemonic/examples in shared panel.
  - [x] `IncorrectReveal` / `ReviewCard` tests updated for trim + shared panel.
  - [x] `SessionHeader` / provider: card progress under a two-card (same `itemId`) fixture does not stall; a11y label card-oriented.
  - [x] Preferences + Settings toggle: default off; persists on.
  - [x] Compare stub: navigates with `left`/`right` params; details under `review/item/[id]` does not remount provider (smoke via layout or navigation test if practical).

## Dev Notes

### Scope boundaries

| In scope (1.2) | Out of scope |
| --- | --- |
| Return-to-advance; Lightning Mode opt-in (FR84) | Two-card kanji emit / `wrong_reading_type` / worst-of-both (Story **1.1**) |
| Shared trimmed `AnswerReveal` (FR85) | Full Compare UI (sticky glyphs, chips) — Story **4.2** |
| Details under `review/` (session-safe) | Lesson/details composition redesign — Epic **4** |
| Card progress polish / BUG4 (FR86) | Two-card vocabulary |
| Collision line + Compare **route/params stub** (FR86) | PreferencesContext rewrite (use existing hook + repo pattern) |

**Do not confuse** with legacy `_bmad-output/implementation-artifacts/1-2-nativewind-design-tokens-and-global-styling.md` — that is old Epic 1 bootstrap. This story is **v2** Epic 1 Story 1.2.

### Dependency on Story 1.1

Story 1.1 owns two-card expansion, `wrong_reading_type`, worst-of-both, and **minimal** per-card `retiredCount` so the header does not freeze. Story 1.2 owns pacing, reveal UX, collision stub, flush under indefinite wait, and FR86 polish.

At story-creation time, `1-1-two-card-kanji-grading` is tracked **in-progress** (story file exists; review engine code may still be single-card). **Land or coordinate with 1.1** before claiming BUG4 fixed under real two-card queues. Return-to-advance and `AnswerReveal` can ship independently of two-card.

### Current behavior (must change)

| Area | Today | Target |
| --- | --- | --- |
| Correct advance | Always `setTimeout` 800ms → `gradeCurrentItem` | Wait for Return (default); timer only if Settings on |
| Correct Return | Input `editable={false}`; second Return does nothing | Second Return advances |
| MC correct | Same auto-advance timer | Visible Continue |
| Correct reveal | One-line `Label: value` via `resolveCorrectReveal` | Shared `AnswerReveal` (reading + meaning) |
| Incorrect reveal | Meaning, readings, **mnemonic**, **examples** expand | Shared panel only; depth via `review/item/[id]` |
| Progress | `retiredCount` / `queue.length`; a11y says “Item” | Card units; no stall with two cards / item |
| Auto-advance pref | None (`constants.ts` comment says Epic 6) | `review_auto_advance` default off |
| Details from review | “See full details” expands inline examples | Navigate under `review/` |
| Answer collision | Only synonym-add queue scan | Reveal line + Compare stub link |

### Critical code loci (UPDATE files — read before editing)

**`mobile/src/app/review/index.tsx`**
- Current state: submit state machine; correct branch starts `autoAdvanceTimer`; `flushPendingGrade` on unmount/end; `pendingGradeRef`; cursor effect clears timer/pending without flush; Continue only for incorrect.
- This story changes: correct pacing; second-Return / Continue advance; preference-gated timer; wire collision annotation into reveal props; keep flush contract.
- Preserve: `isSubmittingRef`, evaluating flash, don’t-know → incorrect, typo/`wrong_script` re-prompt, exit sheet, a11y focus on result, input remains mounted for typed path.

**`mobile/src/components/review/ReviewCard.tsx` / `IncorrectReveal.tsx`**
- Current: thin correct reveal; rich incorrect panel with mnemonic/examples.
- Change: compose `AnswerReveal`; trim incorrect; optional details link + collision line props.
- Preserve: `resolveCorrectReveal` for a11y agreement where still used; reinforcement + stage badge on correct; synonym UX; grammar near-miss teaching.

**`mobile/src/providers/ReviewSessionProvider.tsx`**
- Current: `currentIndex` exposes `retiredCount` (correct completions); retries pedagogical; `addSynonymForCurrentItem` queue collision guard.
- Change: ensure card-level progress (with 1.1); optional helpers for collision lookup if kept in provider/data layer.
- Preserve: `pendingWrites` unmount flush; first-attempt owns FSRS/weakness/load; retry path writes nothing.

**`mobile/src/components/review/SessionHeader.tsx`**
- Current: `displayNumber = min(currentIndex+1, totalItems)`; a11y “Item N of M”.
- Change: card semantics + a11y copy; keep clamp.

**`mobile/src/app/review/_layout.tsx`**
- Current: wraps Stack in `ReviewSessionProvider`.
- Change: add nested screens only — **never** move provider to a child screen.

**`mobile/src/config/constants.ts`**
- Keep `REVIEW_CORRECT_AUTO_ADVANCE_MS = 800`; retarget comment to Lightning Mode / Settings.

**`mobile/src/data/user/preferencesRepository.ts` + Settings + hook**
- Mirror `reducedMotion` pattern (`get`/`set` + `useReviewAutoAdvance` or similar + Settings `Switch`).

### Architecture compliance (non-negotiable)

- No UI animations inside the review loop; **no default** 800ms auto-advance. [Source: `architecture.md` MUST #5]
- Progress by **cards**, not items. [Source: architecture naming + FR86]
- Nested `review/item/[id]` (and Compare stub) must **not remount** `ReviewSessionProvider`. [Source: architecture]
- Fallible async → `Result<T, AppError>`; review never throws across async; failed SRS writes stay in `pendingWrites`.
- Dual DB unchanged; NativeWind semantic tokens only; path alias `@/*`.
- NFR1: grade/feedback hot path &lt;100ms — collision lookup must not block UI (prefetch / sync local query OK if fast; never network).
- NFR5b: no between-card delay animations.

### Return-to-advance algorithm (implement exactly)

```
on Submit (Return) while prompting|typo|wrong_script:
  evaluate → if correct:
    cardState = correct
    pendingGradeRef = grade
    if autoAdvanceEnabled:
      timer 800ms → flush pending via gradeCurrentItem
    else:
      wait
  elif incorrect: show reveal + Continue (unchanged)
  elif non-terminal: re-prompt (unchanged)

on Return while cardState === correct:
  clear timer if any
  apply pendingGradeRef via gradeCurrentItem  // advances cursor
  // do not call evaluateReviewAnswer again

on Continue (incorrect | MC-correct):
  gradeCurrentItem(...)

on End session / unmount:
  flushPendingGrade()  // MUST apply deferred correct grade
```

### Compare stub contract (lock for Story 4.2)

| Field | Value |
| --- | --- |
| Route | `app/review/compare.tsx` (under review layout) |
| Params | Expo Router search params: `left` (string item id), `right` (string item id) |
| Caller | AnswerReveal / IncorrectReveal collision link from review session |
| Stub behavior | Read params; show placeholder; Back returns to prior review screen |
| Story 4.2 | Replace stub body with full Compare UI; **keep** `left`/`right` names |

### Anti-patterns (will fail review)

- Leaving 800ms auto-advance on by default
- Navigating to `(tabs)/learn/item/[id]` from review (session death)
- Restoring mnemonic/examples on the inline incorrect panel
- Counting progress by items / waiting on worst-of-both before advancing the header
- Dropping `flushPendingGrade` so exit mid-correct loses the grade
- Building full Compare UI in this story
- Making vocabulary two-card
- Adding review-loop celebration animations
- Confusing synonym-add collision with answer-collision feedback (related, not the same UX)

### Project Structure Notes

- Path alias `@/*` → `mobile/src/*`
- Review routes live under `mobile/src/app/review/`; provider ownership stays in `_layout.tsx`
- Prefer new components beside existing review components; export via barrel
- Legacy story files `1-2-nativewind-*.md` are unrelated

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1 / Story 1.2]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR84–FR86, FR80]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — review engine, AnswerReveal, nested routes, MUST #5, naming cardsCompleted/totalCards]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — UX-DR8–10, UX-DR29, UX-DR33]
- [Source: `_bmad-output/brainstorming/brainstorming-session-2026-07-19-1628.md` — B1–B3, C1–C2]
- [Source: `_bmad-output/planning-artifacts/.decision-log.md` — R4, D-DET-2]
- [Source: `_bmad-output/implementation-artifacts/1-1-two-card-kanji-grading.md` — explicit handoff / out-of-scope table]
- [Source: `mobile/src/app/review/index.tsx` — auto-advance + flushPendingGrade]
- [Source: `mobile/src/components/review/IncorrectReveal.tsx` — extract/trim source]
- [Source: `mobile/src/providers/ReviewSessionProvider.tsx` — retiredCount / synonym collision]
- [Source: `mobile/src/config/constants.ts` — `REVIEW_CORRECT_AUTO_ADVANCE_MS`]

### Previous Story Intelligence

From `1-1-two-card-kanji-grading.md`:

- Task 6 starts card-native progress so BUG4 does not ship with two-card; **full** FR86 / AnswerReveal / Return-to-advance are explicitly deferred to **1.2**.
- Worst-of-both defers the **item** FSRS write until both cards are terminal — progress must **not** key off that write.
- `wrong_script` / non-terminal pattern stays; 1.2 must not break `wrong_reading_type` once 1.1 lands (treat like other non-terminals: no advance, no AnswerReveal of the answer).
- Provider contract: pedagogical retries; `pendingWrites` + unmount flush — keep intact when extending deferred UI-grade wait from 800ms to indefinite.
- Do not confuse v2 stories with legacy bootstrap `1-*` artifact filenames.

### Git Intelligence Summary

Recent commits are primarily planning/artifact work (`1-1` story file + sprint status, epics/UX/architecture v2). Review pacing code (`autoAdvanceTimer`, `IncorrectReveal`, `retiredCount`) is still the shipped brownfield behavior described above — implement against current `mobile/src` review stack.

### Latest Tech Information

- No new npm dependencies required. Reuse Expo Router nested stacks, existing preference + Settings Switch patterns, RNTL tests.
- WaniKani-style pacing: default is Return-to-advance; “Lightning Mode” is the community name for opt-in auto-advance after correct — Settings copy may use “Auto-advance after correct answers” with optional Lightning Mode subtitle; default **off**.
- `REVIEW_CORRECT_AUTO_ADVANCE_MS = 800` remains the Lightning Mode delay; do not invent a second constant without reason.

### Project Context Reference

No `project-context.md` in repo. Follow `CLAUDE.md` / workspace conventions: `Result` type, dual DB, NativeWind tokens, `@/*` alias, tests colocated with source.

### Open questions resolved for the dev agent

| Ambiguity | Resolution for this story |
| --- | --- |
| Correct reveal icon-collapsed (brainstorm B2) vs “shows” (FR85) | **Show** expanded shared panel |
| Details link incorrect-only (B3) vs FR85 | Available whenever reveal is shown (both paths may link) |
| `confused_with` vs reveal-only annotation | Prefer `feedbackKind: 'confused_with'` if evaluation can emit it cleanly |
| Compare param names | Lock **`left` / `right`** search params under `review/compare` |
| Progress remaining-count (WK-style) | Not in AC — keep ascending `N of M` |

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Fable 5)

### Implementation Plan

- **Pacing (Task 1):** Split the old `inputEditable` into `canSubmitAnswer` (prompting/typo/wrong_script/wrong_reading_type — gates evaluation, Don't-know, MC options, dim styling) and `inputEditable` (adds `correct` — the `WanaKanaInput` stays editable and focused via `submitBehavior="submit"` so the second Return fires `onSubmitEditing`). `handleSubmit` branches: `cardState === 'correct'` → `advanceFromCorrect()` (clears timer, applies `pendingGradeRef` via `gradeCurrentItem`, never re-evaluates); otherwise → `submitAnswer`. The 800ms timer is now gated on `useReviewAutoAdvance().autoAdvanceEnabled`. `flushPendingGrade` on unmount/end-session unchanged and covers the indefinite wait (FR84). MC-correct renders the same Continue button as incorrect (MC has no Return), kept even when Lightning Mode is on.
- **Preference:** `review_auto_advance` key + `getReviewAutoAdvanceEnabled`/`setReviewAutoAdvanceEnabled` (default OFF when unset), `useReviewAutoAdvance` hook mirroring `useReducedMotion`, Settings "Review pacing" section with a Switch labeled "Auto-advance after correct answers" + Lightning Mode subtitle.
- **AnswerReveal (Task 2):** New shared panel = meaning (+ non-derived alternates) + readings (grouped on'/kun' from prefetched `ReviewRevealDetail`, falling back to non-tautological `answerKey.acceptedReadings`), collision line + Compare link, and a "See full details" link → `/review/item/[id]`. `ReviewCard` correct path renders it expanded under ✓ (stage badge + `ReinforcementHighlight` kept; the one-line `Label: value` text was replaced by the panel while `resolveCorrectReveal` still drives the result-region a11y label so announcements agree). `IncorrectReveal` composes it and dropped mnemonic/examples/inline-expand (FR85 supersedes docs/feedback/03-*).
- **Details route (Task 3):** `review/item/[id].tsx` thin-reuses `useItemDetail` + the learn detail section components inside the review Stack; `ReviewSessionProvider` ownership stays in `review/_layout.tsx` (no layout change needed — Expo Router auto-registers nested file routes), so the session survives and Back returns to the same card.
- **Card progress (Task 4):** Provider-side card-scoped `retiredCount` landed in Story 1.1 (its provider test asserts the first card of a pair already moves the header — no stall/BUG4). This story renamed `SessionHeader` props to `cardsCompleted`/`totalCards`, switched a11y copy to "Card N of M … card", kept the visual `N of M` + clamp, and updated the call site.
- **Collision (Task 5):** Detection needs the curriculum DB, so the pure evaluator cannot emit `feedbackKind: 'confused_with'` — per the story's fallback, the reveal props are annotated instead with a single `AnswerCollision` type in `core/answer/answer.types.ts` (no parallel system). `findItemsByAcceptedAnswer` (itemRepository) does exact lowercase SQL matching against `accepted_answers` + `kanji_readings` (readings), excluding the current item; `useAnswerCollision` builds candidates (trimmed / normalized / katakana variant for readings, since curriculum on'yomi are katakana while `normalizeKana` yields hiragana) and re-verifies hits with `normalizeMeaning`/`normalizeKana`. Sync lookup on the graded-incorrect branch only (NFR1). Compare stub at `review/compare.tsx` locks the `left`/`right` search-param contract for Story 4.2.

### Debug Log References

- Full suite: 126 suites / 954 tests pass; `expo lint` clean; `tsc --noEmit` clean; `npm run check-contrast` (repo root) — 72 pairs pass.
- Expo typed routes for the new `review/item/[id]` and `review/compare` screens were regenerated (`.expo/types/router.d.ts`, gitignored) via a brief `expo start` — required for `tsc` to accept the new `Href`s.

### Completion Notes List

- AC1: 800ms auto-advance is OFF by default and only runs with the Settings toggle on; first Return submits, second Return advances; MC-correct and incorrect always show Continue. Covered by 8 new pacing tests in `review/index.test.tsx` + settings/preference/hook tests.
- AC2: shared trimmed `AnswerReveal` (reading + meaning, expanded) on both paths; no new review-loop animations; depth moved to `review/item/[id]` inside the review Stack (session-safe; back returns to the same card). Mnemonic/examples removed from the inline incorrect panel by design — the prior `ReviewCard` test asserting inline mnemonic was inverted to assert the trim (FR85 supersedes `docs/feedback/03-*`).
- AC3: header counts cards (`cardsCompleted`/`totalCards`), advances per completed card (Story 1.1 provider behavior verified by its existing two-card no-stall test), a11y label now card-oriented, monotonic + clamped.
- AC4: graded-incorrect submissions that match another item's accepted answer show one explanatory line + "Compare these items" linking `review/compare?left=<current>&right=<other>`; contract documented on the stub for Story 4.2. Detection is annotate-reveal-props (documented rationale: evaluator is pure, collision needs DB).
- AC5: deferred grade under indefinite wait still flushes on unmount and End Session (explicit regression test).
- Provider non-remount for nested routes is guaranteed structurally (`ReviewSessionProvider` stays in `review/_layout.tsx`; both new screens are children of that Stack) and smoke-tested at the route level; a full navigation-container remount test was not practical in RNTL and was skipped per the story's "if practical" qualifier.
- `mobile/__mocks__/expo-sqlite.ts` gained two JOIN-aware query branches for the collision lookup (mock is regex-per-query-shape by design).

### File List

**New**
- mobile/src/components/review/AnswerReveal.tsx
- mobile/src/components/review/AnswerReveal.test.tsx
- mobile/src/data/hooks/useReviewAutoAdvance.ts
- mobile/src/data/hooks/useReviewAutoAdvance.test.tsx
- mobile/src/data/hooks/useAnswerCollision.ts
- mobile/src/data/hooks/useAnswerCollision.test.tsx
- mobile/src/app/review/item/[id].tsx
- mobile/src/app/review/item/[id].test.tsx
- mobile/src/app/review/compare.tsx
- mobile/src/app/review/compare.test.tsx

**Modified**
- mobile/src/app/review/index.tsx
- mobile/src/app/review/index.test.tsx
- mobile/src/app/(tabs)/settings.tsx
- mobile/src/app/(tabs)/settings.test.tsx
- mobile/src/components/review/ReviewCard.tsx
- mobile/src/components/review/ReviewCard.test.tsx
- mobile/src/components/review/IncorrectReveal.tsx
- mobile/src/components/review/SessionHeader.tsx
- mobile/src/components/review/SessionHeader.test.tsx
- mobile/src/components/review/index.ts
- mobile/src/config/constants.ts
- mobile/src/core/answer/answer.types.ts
- mobile/src/data/curriculum/itemRepository.ts
- mobile/src/data/curriculum/itemRepository.test.ts
- mobile/src/data/user/preferencesRepository.ts
- mobile/src/data/user/preferencesRepository.test.ts
- mobile/__mocks__/expo-sqlite.ts

## Change Log

- 2026-07-20 — Story 1.2 implemented (claude-fable-5): Return-to-advance pacing with opt-in Lightning Mode (`review_auto_advance`, default off) + Settings toggle; shared trimmed `AnswerReveal` on correct & incorrect paths with depth moved to new session-safe `review/item/[id]` route; `SessionHeader` progress renamed to card semantics (`cardsCompleted`/`totalCards`, "Card N of M" a11y); answer-collision line with curriculum-wide lookup (`findItemsByAcceptedAnswer` + `useAnswerCollision`) and `review/compare` stub locking the `left`/`right` param contract for Story 4.2. All tasks complete; 954 tests pass, lint/typecheck/contrast clean. Status → review.
