# Plan 08 — Stage-based grammar difficulty ladder

**Priority:** P1 after Plan 07. Source: brainstorm Theme 2 + Action P2. Locked matrix:

| Stage | Prompt | Answer input | English / hints |
|--------|--------|--------------|-----------------|
| `< Guru` (Apprentice) | JP cloze · variants | **MC** · same-family distractors | Hint ladder OK (Plan 10) |
| Guru → Master | JP cloze · variants | **Type-in** chunk | Hint ladder OK |
| Enlightened+ | JP cloze · variants | **Type-in** chunk | **No English**; nudge only or none |

Difficulty = **input mode + scaffolding**, not a different task type. Same cloze everywhere.

---

## Current behaviour

- All grammar reviews are free-text type-in (`production` → text field in review session).
- There is **no multiple-choice UI** anywhere in `mobile/src/components/review/`.
- Stage labels already exist via `mapFsrsStateToStageLabel` (`apprentice | guru | master | enlightened | burned`) on `ReviewItem.srsState.srsStageLabel`.
- Hints are always available for grammar (`ProgressiveHint` in `ReviewCard`) with no stage gate.

---

## Decisions

| Decision | Choice | Notes |
|----------|--------|-------|
| Stage → input | Apprentice = MC; Guru/Master = type-in; Enlightened+ = type-in | Burned: treat like Enlightened (type-in, no EN) or skip reviews — burned items shouldn't be in queue anyway |
| Task type | Always cloze (Plan 07) | Do not flip to EN→JP at high stages |
| Distractors | Same grammar family | Plan 09 authors `family`; until then, interim pool from other particles / nearby grammar |
| MC count | 4 options (1 correct + 3 distractors) | Shuffle per card; correct always present |
| Enlightened English | Fully unavailable | Hide meaning hint rung; optional keep structure nudge only |

---

## Changes

### 8.1 — Resolve grammar input mode from stage

Add a pure helper, e.g. `resolveGrammarInputMode(stage: SRSStageLabel): 'mc' | 'type_in'`:

```ts
if (stage === 'apprentice') return 'mc';
return 'type_in'; // guru, master, enlightened, burned
```

Wire into queue mapping so each `ReviewItem` carries `inputMode` (grammar only; other types stay type-in).

### 8.2 — Multiple-choice review UI

New component under `components/review/` (e.g. `GrammarMcOptions.tsx`):

- Renders 4 pressable options when `inputMode === 'mc'`.
- On select, submit through the same `gradeCurrentItem` / evaluator path as typed answers (pass the option string as `userAnswer`).
- Accessibility: role `button` / radiogroup semantics; announce selected option.
- Visual: use existing semantic tokens (`bg-surface-elevated`, `border-border`, content-grammar accent on select) — no new card chrome.

Hide the free-text input when MC is active (review session answer bar already exists — gate it).

### 8.3 — Distractor selection

**Interim (ships with Plan 08):**

- Hardcode or query a small same-family pool for early particles: topic/subject/object particles (`は`, `が`, `を`, `も`, `に`, `で`…) excluding the correct answer.
- If fewer than 3 family mates exist, fill from other grammar `accepted_forms` at the same JLPT level.
- Never include the correct answer twice; never include empty strings.

**Full (Plan 09):** curriculum `family` + precomputed distractor candidates per point.

Pure function: `pickGrammarDistractors({ answer, familyCandidates, fallbackPool, count: 3, rng })`.

### 8.4 — Enlightened scaffolding gate

Flag on the review item or derived at render time:

```ts
const englishHintsAllowed = stage !== 'enlightened' && stage !== 'burned';
```

Pass into hint builder (Plan 10 owns the two-rung content). Plan 08 only needs the **gate**: English meaning must not appear on-card or via hint at Enlightened+.

Structure nudge may remain if Plan 10 keeps a non-English first rung.

### 8.5 — Same item, different mode across stages

Acceptance story: seed/fixture an item at apprentice → MC; advance stage in test (or mock `srsStageLabel`) → type-in; set enlightened → type-in + no English. No curriculum change required for the mode flip.

---

## Acceptance criteria

- [ ] Apprentice grammar review shows 4 MC options; no text field.
- [ ] Guru and Master grammar review shows type-in only (no MC).
- [ ] Enlightened grammar review is type-in; English meaning cannot be revealed.
- [ ] MC distractors never include the correct answer; preferably same family.
- [ ] Selecting an MC option grades through `evaluateGrammarAnswer` / session provider unchanged for FSRS.
- [ ] Non-grammar items unaffected (still meaning/reading type-in).
- [ ] Unit tests for `resolveGrammarInputMode` and `pickGrammarDistractors`.
- [ ] Component tests for MC vs type-in branching on `ReviewCard` / session answer area.

## Files touched (expected)

- `mobile/src/core/grammar/inputMode.ts` *(new)*
- `mobile/src/core/grammar/distractors.ts` *(new)*
- `mobile/src/core/srs/srs.types.ts` — `inputMode`, optional `mcOptions`
- `mobile/src/data/hooks/useReviewQueue.ts` — populate options
- `mobile/src/components/review/GrammarMcOptions.tsx` *(new)*
- `mobile/src/components/review/ReviewCard.tsx` + review session answer input host
- `mobile/src/core/content/hintLevels.ts` — accept `englishAllowed` flag (or Plan 10)
- Tests

## Depends on / unlocks

- **Depends on:** Plan 07 (cloze prompt must exist; MC of `は` alone is still a bad card).
- **Soft depends on:** Plan 09 for rich same-family pools (interim particle pool is OK).
- **Coordinates with:** Plan 10 for Enlightened hint content.

## Out of scope

- Authoring 5 cloze variants (Plan 09)
- Near-miss incomplete detection (Plan 10)
- Splitting SRS cards by prompt type
