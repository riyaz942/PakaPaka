# Plan 10 — Grammar hints & near-miss feedback

**Priority:** P1 polish after Plan 07; coordinates with Plan 08 Enlightened gate. Source: brainstorm Theme 3 + Action P4 + Quick Wins 2–3.

**Goals:**

1. Two-rung hints (nudge → English) with **no SRS penalty** for revealing hints.
2. Near-miss / incomplete answers = **incorrect** for SRS + teaching nudge (WK-style honesty).
3. Enlightened+: English rung unavailable (Plan 08 flag).

---

## Current behaviour

**Hints**

- `buildGrammarHintLevels` (`hintLevels.ts`) builds: structure → `Grammar point: {meaning}` → reinforcement link.
- `ProgressiveHint` reveals levels on demand; `onHintReveal` is passed from `ReviewCard`.
- Need to confirm session grading ignores hint usage — today hints should already be display-only (no grade coupling). Explicitly lock that contract with a test.

**Feedback**

- Incorrect reveal shows full item detail (`IncorrectReveal` / Plan 03 work).
- Grammar evaluation: conjugation parser, then Levenshtein fallback on `acceptedForms` (`answerEvaluator.ts` → `readingEvaluator`).
- Short particles use **exact match** (reading evaluator: length ≤ 2 → no typo tolerance). Good for は/が/を.
- No dedicated "incomplete but on the right track" path for grammar (e.g. typing `学生です` when blank only wants `は`, or typing a longer phrase that contains the right particle).

---

## Locked UX

| Rung | Content source | When available |
|------|----------------|----------------|
| 1 — Nudge | Variant `nudge` (Plan 09) or interim structure-based poke | All stages including Enlightened (optional: Enlightened = nudge only or none — product default: **nudge allowed**) |
| 2 — English | Variant `english` or example sentence EN | **Not** at Enlightened+ |

- Hints never change FSRS grade (never force Again/Hard because a hint was opened).
- Incomplete / near-miss: grade **incorrect**, show soft teaching copy, still reveal the target chunk (and optionally full sentence).

Shelved from brainstorm: treating incomplete as soft-pass; 50/50 EN→JP at Enlightened.

---

## Changes

### 10.1 — Two-rung hint builder

Replace/adapt `buildGrammarHintLevels`:

```ts
buildGrammarHintLevels({
  nudge?: string | null,
  english?: string | null,
  englishAllowed: boolean,
  // optional keep reinforcement as rung 3 for pre-Enlightened only
  reinforcementLink?: …
})
```

Order:

1. Nudge (if non-empty)
2. English (if `englishAllowed` and non-empty)
3. Optional reinforcement (pre-Enlightened only; drop if it leaks English-like meaning — prefer dropping at Enlightened)

Interim without Plan 09 variants: nudge ≈ shortened `structure`; english ≈ first example sentence English or `meaning` labeled clearly as "Meaning (hint)".

Update button copy if useful: first press "Hint", second "Show English" — optional; existing `Hint (n/m)` is fine.

### 10.2 — Prove hints don't affect SRS

- Trace `onHintReveal` / any hint state in `ReviewSessionProvider` — ensure no call into `gradeItem` / weakness / load.
- Add a regression test: reveal all hints → submit correct answer → grade is still Good/Easy path as without hints; submit wrong → Again as usual.

### 10.3 — Near-miss / incomplete detector

Add `assessGrammarNearMiss(userAnswer, context) → 'none' | 'incomplete' | 'wrong_category'`:

**Incomplete (primary WK-style case):**

- User answer is longer than the target chunk and **contains** the correct chunk as a substring (e.g. answer `は`, user typed `私は` or `は学生`), **or**
- User pasted/typed a full sentence that matches the unclozered JP.

→ Result: `incorrect` for SRS, UI copy like: "Close — you need just the grammar piece: **は**." Show full target sentence after.

**Wrong category (optional stretch):**

- User entered a clear English gloss when type-in expects kana chunk → reuse wrong_script-style nudge without revealing if desired; or treat as incorrect with "We're looking for the Japanese grammar form."

Do **not** auto-upgrade incomplete to correct. Soft nudge only.

Wire through `evaluateGrammarAnswer` or a thin wrapper used by `reviewAnswerEvaluator` so `displayAnswer` and a `feedbackKind: 'incomplete'` can drive UI.

### 10.4 — Incorrect reveal copy for grammar

On incomplete:

- Acknowledge intent ("You had the right idea").
- Show expected chunk prominently.
- Show completed sentence (cloze + answer).
- Keep Plan 03 full detail below (structure, meaning, examples).

On plain incorrect: existing full reveal is fine; ensure chunk vs sentence distinction is clear.

### 10.5 — Enlightened gate (shared with Plan 08)

Single source of truth: `englishHintsAllowed(stage)`. Plan 08 flips input mode; Plan 10 consumes the same helper for hint rungs.

---

## Acceptance criteria

- [ ] Pre-Enlightened: user can reveal nudge then English; grading unchanged.
- [ ] Enlightened+: English hint rung absent; nudge may remain.
- [ ] Opening hints never writes Again/Hard or bumps weakness by itself.
- [ ] Incomplete answers that contain the right chunk grade incorrect and show teaching copy.
- [ ] Exact wrong particle (は vs が) is plain incorrect (not "incomplete").
- [ ] Tests for hint builder gating, near-miss classification, and session grade isolation.

## Files touched (expected)

- `mobile/src/core/content/hintLevels.ts`
- `mobile/src/core/grammar/nearMiss.ts` *(new)*
- `mobile/src/core/grammar/answerEvaluator.ts` — integrate near-miss display metadata
- `mobile/src/core/answer/answer.types.ts` — optional feedback kind
- `mobile/src/components/review/ProgressiveHint.tsx` — only if copy/rung labels change
- `mobile/src/components/review/ReviewCard.tsx` / `IncorrectReveal.tsx` — incomplete copy
- `mobile/src/providers/ReviewSessionProvider.tsx` — verify no hint→grade coupling
- Tests

## Depends on / unlocks

- **Depends on:** Plan 07 for cloze context (incomplete detection needs a known full sentence).
- **Soft depends on:** Plan 09 for authored nudge/english; interim fallbacks OK.
- **Coordinates with:** Plan 08 Enlightened flag.

## Out of scope

- MC distractor UX (Plan 08)
- Curriculum authoring (Plan 09)
- Changing typo Levenshtein thresholds for long conjugations (separate if needed)
