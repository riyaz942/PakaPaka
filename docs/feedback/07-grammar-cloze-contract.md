# Plan 07 — Grammar cloze contract

**Priority:** P0 for grammar reviews. Unblocks Plans 08–10. Source: [brainstorming session 2026-07-11](../../_bmad-output/brainstorming/brainstorming-session-2026-07-11-1800.md) Theme 1 + Action P1.

**Problem:**
> Learning particle は and being asked for its "reading" / production of は — a kanji-style pattern that doesn't transfer. Grammar should test **placement in context**, not reading the surface form.

---

## Current behaviour

Grammar is already routed to `production` (not `reading`) in `promptResolver.ts`:

```ts
if (itemType === 'grammar') return 'production';
```

But the review UI still fails the diagnostic test. `ReviewCard` shows `primaryForm` as the big prompt (`ReviewCard.tsx` ~175), and for particles that is the answer itself:

| Item | Shown prompt | Expected answer | Effect |
|------|--------------|-----------------|--------|
| `wa-topic` | `は` | `は` | Type what you see |
| `ga-subject` | `が` | `が` | Same trap |
| `o-object` | `を` | `を` | Same trap |

Curriculum already has rich example sentences (`curriculum/grammar/n5.json` — `wa-topic` has 6+ JP/EN pairs), but the review path never uses them. `useReviewQueue.buildAnswerKey` only loads `grammar_rules` (`structure`, `conjugation_rules`, `accepted_forms`) — no sentence, no blank, no English scaffolding on the card.

Hints today expose structure → meaning → reinforcement (`hintLevels.ts`). That helps a little, but the prompt itself is still tautological.

**Locked contract from brainstorm (do not reopen without stress-test):**

1. JP cloze for **all** grammar families — never ask reading; never show bare `primaryForm` as the only prompt when it equals the answer chunk.
2. Blank = the **variable chunk only**; sentence frame stays fixed.
3. Answer grades the grammar chunk (`accepted_forms` / cloze answer), not a full-sentence translation.
4. Shelved: image+Q Guru production, full EN→JP as Enlightened mode, live image search.

---

## Decisions (already locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Task type | Universal JP cloze | Survives を and conjugations; consistency > per-family UX |
| What the blank is | Variable bit only | `私＿学生です` → answer `は`, not the whole sentence |
| Prompt label | Prefer "Grammar" / cloze over "Production" / "Reading" | Stops implying kanji-style drills |
| Interim content | Derive cloze from existing `example_sentences` until Plan 09 schema lands | Unblocks the は playtest this week |

---

## Changes

### 7.1 — Stop tautological grammar prompts (quick win)

In the review mapping path (`useReviewQueue` → `queueBuilder.mapToReviewItem` → `ReviewCard`):

1. For `itemType === 'grammar'`, **never** use bare `primaryForm` as the sole visible prompt when it equals an accepted form.
2. Load at least one example sentence for the item (`getExampleSentences` already exists in `itemRepository.ts`).
3. Build a cloze string by replacing the answer chunk with a blank marker (e.g. `＿` or `___`):
   - Prefer an authored `jp_cloze` once Plan 09 lands.
   - Interim: replace the first occurrence of an `accepted_forms` entry inside `example.japanese` (longest-match wins for multi-mora forms like `てください`).
4. Set `ReviewItem.primaryForm` (or a new dedicated field `clozePrompt`) to that cloze string for display.
5. Keep grading against `answerKey.grammar.acceptedForms` (chunk only).

Add a guard test: for `wa-topic`, the prompting surface must contain a blank and must **not** equal `"は"`.

### 7.2 — Review card display for cloze

In `ReviewCard`:

- Mode label: for grammar, show `Grammar` (or `Fill in`) instead of `Production`.
- Prompt text: render the cloze sentence (support furigana later via existing `FuriganaText` if the sentence has furigana).
- Do **not** show English on the card by default (English is a hint rung — Plan 10). Showing EN on the card collapses the diagnostic.

Optional interim: if no example sentence exists, fall back to `structure` with a blank (`Noun + ＿ + comment`) rather than bare `は`.

### 7.3 — Answer evaluation stays chunk-scoped

`evaluateGrammarAnswer` already grades against `acceptedForms` / conjugation parser. Keep that.

Add an explicit invariant in tests: user input is compared to the grammar chunk, never to the full Japanese sentence.

Near-miss / incomplete handling is Plan 10 — do not expand the evaluator here beyond the cloze display fix.

### 7.4 — Lesson teach surface (light touch)

Lesson item view can keep showing `primaryForm` + meaning + examples (teaching ≠ testing). Only the **review** prompt contract changes in this plan. If lesson "check yourself" cards reuse `ReviewCard`, apply the same cloze rules there.

---

## Acceptance criteria

- [x] Reviewing `は` never shows a prompt whose only content is `は` with expected answer `は`.
- [x] Grammar review prompt is a JP sentence (or structure frame) with a blank; answer is the grammar chunk.
- [x] Mode label is not "Reading"; prefer "Grammar" over "Production".
- [x] `evaluateGrammarAnswer` still accepts `は` / `が` / conjugated forms as today.
- [x] Items without example sentences degrade to structure-frame cloze, never to bare particle.
- [x] Unit tests cover: particle cloze derivation, longest-match blanking, no-example fallback.

## Files touched (expected)

- `mobile/src/core/grammar/` — cloze derivation helper (new, pure)
- `mobile/src/data/hooks/useReviewQueue.ts` — attach sentence/cloze to review item
- `mobile/src/core/srs/srs.types.ts` — optional `clozePrompt` / `clozeAnswer` fields
- `mobile/src/components/review/ReviewCard.tsx` — display + label
- `mobile/src/data/curriculum/itemRepository.ts` — only if sentence fetch isn't already wired into the queue path
- Tests alongside the above

## Depends on / unlocks

- **Depends on:** Grammar reaching reviews (Plan 04 §4.1 — already done per working history).
- **Unlocks:** Plan 08 (stage ladder needs a real cloze prompt), Plan 09 (schema upgrades the interim derivation), Plan 10 (hints attach to cloze variants).

## Out of scope

- MC vs type-in (Plan 08)
- Authoring 5 variants + family tags (Plan 09)
- Hint ladder / near-miss copy (Plan 10)
- Changing FSRS card identity or prompt-type split (Plan 02 deferred Option B)
