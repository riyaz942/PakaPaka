---
baseline_commit: 84e7757
---

# Story 5.3: Answer input and validation (WanaKana, Levenshtein, conjugation)

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a **learner**,
I want **romaji-to-kana input, fair typo tolerance on meanings, and conjugation-aware grammar validation**,
so that **every answer type is checked accurately and fairly (FR6b, FR13, FR14, UX-DR6, UX-DR23, NFR5)**.

*Consolidates original stories 5.4, 5.5, and 5.6 from epics — all answer-validation pipelines sharing a common input field. This story turns the Story 5.2 review shell (which has a **disabled** input and a `__DEV__`-only grade row) into a real, typeable, self-grading review loop. Progressive hints, reinforcement highlights, and related-item boosts ship in Story 5.4; weakness recording ships in Epic 6.*

## Acceptance Criteria

1. **Real-time romaji → kana input (FR13, UX-DR6, NFR5)**

   **Given** a `reading` (or grammar `production`) prompt
   **When** I type romaji in the answer field
   **Then** the text converts to kana on each keystroke via `wanakana` (e.g. `ta` → `た`, `shi` → `し`, `nn` → `ん`) with no perceptible lag on a mid-range device (NFR5 — document the conversion call and that it runs synchronously per keystroke)
   **And** the input renders kana inline (not a separate preview line) — the user sees `た` where they typed `ta`
   **And** the field has `accessibilityLabel="Answer input, type in romaji"` (UX-DR6) and announces the converted text on submit
   **And** `meaning` prompts use a plain English text field (no kana conversion) with `accessibilityLabel="Answer input"` and `autoCapitalize="none"`, `autoCorrect={false}`
   **And** the input is **pre-focused** when an item enters `prompting` state and submits on the keyboard return key (UX-DR23) or a dedicated submit affordance

2. **Meaning validation with typo tolerance (FR14, UX-DR23)**

   **Given** a `meaning` prompt with a primary answer and zero or more synonym answers
   **When** I submit an answer that is an exact (normalized) match to any accepted meaning
   **Then** the result is `correct`
   **And When** I submit a near-miss within the Levenshtein accept threshold (document the chosen length-scaled rule)
   **Then** the result is `typo` — a non-punishing amber **"Close! Try again."** re-prompt that **re-activates the input without advancing the SRS state incorrectly** (typo must NOT be graded as wrong)
   **And When** the answer is neither exact nor within typo threshold
   **Then** the result is `incorrect`, the correct answer is shown, and the card waits for an explicit tap to continue (no auto-advance)

3. **Reading validation (kana, typo-aware)**

   **Given** a `reading` prompt with one or more accepted kana readings
   **When** I submit a converted-kana answer that exactly matches (after normalization — trim, and treat katakana/hiragana equivalently) any accepted reading
   **Then** the result is `correct`
   **And** a near-miss within the kana Levenshtein threshold yields a `typo` "close!" re-prompt (FR14) — never a harsh rejection
   **And** anything else is `incorrect` with the correct reading shown

4. **Grammar conjugation-aware validation with documented fallback (FR6b)**

   **Given** a grammar item with parser-supported `conjugation_rules`
   **When** I submit an answer
   **Then** the conjugation parser validates first; an answer with the right lemma but wrong conjugation **fails** as `incorrect` with the correct form shown (not silently accepted)
   **And** patterns the parser does **not** support fall back to Levenshtein matching against the grammar item's `accepted_forms`, with the fallback path logged **only** in `__DEV__` (no user-visible "fallback" wording)
   **And** the parser is pure TS in `core/grammar/`, deterministic, and unit-tested for at least: an exact accepted form, a wrong conjugation rejected, and an unsupported-pattern fallback

5. **Result states wired into the review loop (UX-DR completes 5.2 deferral)**

   **Given** the Story 5.2 `ReviewCard` renders `null` for non-`prompting` states
   **When** an answer is submitted
   **Then** `ReviewCard` renders the `correct` / `incorrect` / `typo` states with **color + icon + text** (never color alone — NFR/accessibility): `feedback-correct` ✓, `feedback-incorrect` ✗, `feedback-warning` ~ ("Close! Try again.")
   **And** `correct` reveals the meaning/reading and auto-advances after a short pause; `incorrect` shows the correct answer and stays until the user taps Continue; `typo` re-prompts immediately and re-focuses the input (UX feedback table)
   **And** the result is announced for screen readers: `"Correct, meaning: …"` / `"Incorrect, correct answer is …"`
   **And** **no inter-item animation** is introduced — the intra-item result flash is permitted, but advancing to item *n+1* stays instant (NFR5b); the <100ms feedback budget from Story 5.1 is preserved

6. **Submit → grade wiring (replaces `__DEV__` grade buttons)**

   **Given** the Story 5.2 `__DEV__`-only Again/Hard/Good/Easy grade row
   **When** answer submission is implemented
   **Then** the production submit path derives the FSRS grade from correctness — document the mapping: **`correct` → `Good (3)`**, **`incorrect` → `Again (1)`**, **`typo` → no grade / no advance** (retry) — and calls the existing `gradeCurrentItem` engine path (do **not** rebuild SRS persistence)
   **And** the `__DEV__` grade buttons are removed (or kept strictly behind `__DEV__` for engine QA only; default production UI must not show them)
   **And** grade persistence remains async/non-blocking exactly as Story 5.1/5.2 established (`pendingWrites`, flush-on-unmount preserved)

7. **Answer data reaches the evaluators**

   **Given** evaluators are pure functions that need the item's accepted answers
   **When** the review queue hydrates an item
   **Then** each `ReviewItem` carries the accepted-answer data required for its `promptType` (accepted meanings + synonyms, accepted kana readings, and grammar `conjugation_rules` + `accepted_forms`), sourced from `getAcceptedAnswers` / `getKanjiReadings` / `getGrammarRule` in `useReviewQueue` (curriculum DB reads, consistent with the existing per-item hydration pattern)
   **And** items lacking answer data for their resolved prompt (e.g. a vocab `reading` prompt with no `reading` accepted answer in the current seed) are handled gracefully — document the chosen behavior (skip/`__DEV__` warn) and do **not** crash the session

8. **Tests and CI**

   **Given** implementation is complete
   **When** CI runs in `mobile/`
   **Then** `npm run lint`, `npm run typecheck`, and `npm test` pass, and all existing Story 5.1/5.2 tests remain green
   **And** new tests cover: `levenshtein` distance; `meaningEvaluator` (exact / synonym / typo / incorrect); `readingEvaluator` (exact / kana-equivalence / typo); `conjugationParser` (accepted form / wrong conjugation / unsupported fallback); `WanaKanaInput` live conversion + a11y label + submit; `ReviewCard` `correct`/`incorrect`/`typo` render with icon+text; and the submit→grade mapping (correct→3, incorrect→1, typo→no-advance)

## Tasks / Subtasks

- [x] **Dependency — add `wanakana`** (AC: 1)
  - [x] `npm install wanakana` in `mobile/`; confirm it resolves in the RN/Jest environment (it is pure JS, no native module)
  - [x] Add a Jest mock under `mobile/__mocks__/` only if the real module misbehaves in jsdom/node — prefer the real module for conversion fidelity in tests
  - [x] (Optional, low priority) `expo-haptics` for the soft/medium result haptics in the UX feedback table — acceptable to defer; if added, gate behind a future accessibility "haptics" pref and never make feedback haptic-only

- [x] **AC7 — Enrich `ReviewItem` with answer data** (AC: 7)
  - [x] Extend `ReviewItem` in `core/srs/srs.types.ts` with an `answerKey` (e.g. `{ acceptedMeanings: string[]; acceptedReadings: string[]; grammar?: { conjugationRules: Record<string, unknown>; acceptedForms: string[] } }`)
  - [x] Extend `QueueInputItem` in `queueBuilder.ts` to carry the fetched answer data; have `mapToReviewItem` attach `answerKey` (keep `mapToReviewItem` pure — the DB reads happen in the hook)
  - [x] In `useReviewQueue.ts`, fetch per item via `getAcceptedAnswers` (+ `getKanjiReadings` as a reading source for kanji, `getGrammarRule` for grammar) and pass into `QueueInputItem`
  - [x] Document the vocab-reading seed gap behavior (AC7 second clause)

- [x] **AC2/AC3 — `core/answer` evaluators** (AC: 2, 3)
  - [x] `core/answer/levenshtein.ts` + `.test.ts` — classic DP distance (no new dependency)
  - [x] Widen `AnswerResult` in `core/answer/answer.types.ts` to `'correct' | 'incorrect' | 'typo'`; add an `EvalContext`/options type if needed — verify `evaluatePassageAnswer` (Epic 4) still compiles and behaves unchanged (it only returns correct/incorrect)
  - [x] `core/answer/meaningEvaluator.ts` + `.test.ts` — normalize (lowercase, trim, collapse whitespace/punctuation) → exact vs accepted/synonyms → length-scaled Levenshtein typo → else incorrect
  - [x] `core/answer/readingEvaluator.ts` + `.test.ts` — normalize kana (trim; katakana↔hiragana equivalence via `wanakana.toHiragana`) → exact → kana Levenshtein typo → else incorrect

- [x] **AC4 — `core/grammar` validation** (AC: 4)
  - [x] `core/grammar/grammar.types.ts` — `GrammarPoint`/`ConjugationRule`/`EvaluationResult` shapes aligned with `GrammarRule` from `itemRepository`
  - [x] `core/grammar/conjugationParser.ts` + `.test.ts` — exact-against-`accepted_forms` first; supported conjugation checks for a **documented, bounded** set (don't over-build for the N5 particle-heavy seed); return an explicit "unsupported" signal for unhandled patterns
  - [x] `core/grammar/answerEvaluator.ts` + `.test.ts` — orchestrates parser → Levenshtein fallback against `accepted_forms`; `__DEV__`-only log on fallback

- [x] **AC1 — `WanaKanaInput`** (AC: 1)
  - [x] `components/review/WanaKanaInput.tsx` + `.test.tsx` — controlled `TextInput`; on `onChangeText`, convert via `wanakana.toKana(value, { IMEMode: true })` for kana modes, pass-through for English meaning mode
  - [x] Props: `mode: 'kana' | 'english'`, `value`, `onChangeText`, `onSubmit`, `placeholder`, `editable`; pre-focus on mount/prompt; `returnKeyType="done"`/`onSubmitEditing`
  - [x] A11y per AC1; styling per UX (`surface-elevated`, `radius-sm`, `feedback-info` focus border, `text-muted` placeholder)
  - [x] Export from `components/review/index.ts`

- [x] **AC5 — `ReviewCard` result states** (AC: 5)
  - [x] Implement `correct` / `incorrect` / `typo` renders in `ReviewCard.tsx` (color token + icon + text; reveal meaning/reading on correct/incorrect; "Close! Try again." on typo)
  - [x] Screen-reader result announcement; extend `ReviewCard.test.tsx`

- [x] **AC5/AC6 — Wire submission state machine in `app/review/index.tsx`** (AC: 5, 6)
  - [x] Add local `cardState` (`prompting`→`evaluating`→`correct`/`incorrect`/`typo`) + `answerText` state; route input through `WanaKanaInput`
  - [x] On submit: pick evaluator by `promptType` (`reading`/`production` grammar → reading/grammar evaluator; `meaning` → meaning evaluator), set result state
  - [x] `typo` → clear + re-focus, no grade; `correct` → reveal + auto-advance after pause → `gradeCurrentItem(3)`; `incorrect` → wait for Continue tap → `gradeCurrentItem(1)`
  - [x] Reset `cardState`/`answerText` when `currentItem` changes; preserve loading/error/complete/exit flows from 5.2; remove production `DevGradeButtons`

- [x] **AC8 — CI** (AC: 8)
  - [x] `npm run lint && npm run typecheck && npm test` from `mobile/`

### Review Findings (code review 2026-06-28)

Reviewed uncommitted changes vs baseline `84e7757`. Independently verified: typecheck clean, **456/456 tests pass (70 suites)**. No `decision-needed` findings.

- [x] [Review][Patch] Correct-state reveal labels English meanings as "Reading" on reading/production prompts [mobile/src/components/review/ReviewCard.tsx:32-54] — `revealLabel()` returns `'Reading'` for `reading`/`production`, but the revealed value is `formatMeanings(meanings)` (English). A correct reading answer renders/announces `Reading: eat, food`. The screen also fires `announceForAccessibility("Correct, meaning: …")` (index.tsx:128) while the card's own `accessibilityLabel` says `Correct, reading: …` — two conflicting a11y signals. Fix: make the label match the revealed content (label "Meaning") or reveal the actual `answerKey.acceptedReadings`, and align the screen announcement with the card.
- [x] [Review][Patch] Kana typo threshold is length-blind — wrong single-mora particles/readings accepted as `typo` not `incorrect` [mobile/src/core/answer/readingEvaluator.ts:7,46] — `KANA_TYPO_THRESHOLD = 1` with no length scaling. `が` vs accepted `を` (distance 1) → `typo` "Close! Try again." instead of `incorrect`. Hits the particle-heavy N5 grammar set (parser returns `unsupported` → `evaluateReading` fallback) and any 1-kana reading. Fix: scale like `meaningTypoThreshold` so length-1 (and length-2) accepted forms require an exact match.
- [x] [Review][Patch] `evaluateReading` displayAnswer index can misalign [mobile/src/core/answer/readingEvaluator.ts:22-53] — `accepted` is built via `.map(normalizeKana).filter(len>0)`, then `acceptedReadings[accepted.indexOf(closest)]` indexes the *unfiltered* array. If any earlier reading normalizes to empty, the wrong correct-answer is shown. Fix: keep original/normalized pairs so the display index stays aligned.
- [x] [Review][Patch] `gradeForResult` is dead code; screen hardcodes grades [mobile/src/core/answer/reviewAnswerEvaluator.ts:43, mobile/src/app/review/index.tsx:131,150] — the canonical AC6 mapping helper is exported and tested but unused; index.tsx hardcodes `gradeCurrentItem(3)`/`(1)`. Fix: call `gradeForResult` (single source of truth) or remove the helper.
- [x] [Review][Patch] Double-submit race in `handleSubmit` [mobile/src/app/review/index.tsx:115-147] — `inputEditable` is derived from `cardState` (React state); two rapid return-key submits can both pass the guard before re-render, double-scheduling the auto-advance timer / double-grading. Fix: add a `useRef` submit-in-flight guard.
- [x] [Review][Patch] `WanaKanaInput.clear()` is broken for a controlled input and unused [mobile/src/components/review/WanaKanaInput.tsx:45] — calls native `inputRef.current?.clear()` which doesn't update the controlled `value`; the typo path uses `setAnswerText('')` instead. Fix: remove the dead `clear` from the imperative handle (or make it call `onChangeText('')`).
- [x] [Review][Patch] `production` placeholder gives no romaji hint though input is kana mode [mobile/src/app/review/index.tsx:34] — reading placeholder says "...in romaji" but production says "Type the conjugated form..." while also using `mode="kana"`. Fix: align production placeholder copy with the romaji input model.
- [x] [Review][Defer] Reading prompt with no accepted readings grades the meaning answer as Good (3) [mobile/src/core/answer/reviewAnswerEvaluator.ts:21-29] — deferred, documented AC7 seed-gap fallback; rewards the wrong skill and advances FSRS. Revisit when vocab readings are seeded (tracked in deferred-work.md).
- [x] [Review][Defer] `getGrammarRule` unguarded `JSON.parse` fails the whole queue build on one malformed row [mobile/src/data/curriculum/itemRepository.ts:358] — deferred, pre-existing; caught by `buildQueue` try/catch (graceful error state, no crash) and seed is compiler-controlled.
- [x] [Review][Defer] Per-keystroke `toKana` does not preserve cursor on mid-string edits [mobile/src/components/review/WanaKanaInput.tsx:55] — deferred, inherent wanakana IME limitation; acceptable for v1, revisit if mid-string editing complaints arise.

Dismissed as noise (3): `levenshtein` UTF-16 code-unit counting (unreachable for BMP N5 chars); grammar fallback running `toHiragana` over kanji forms (kanji pass through unchanged, exact-match path holds); "unbounded typo retry loop" (intended re-prompt behavior, further bounded by the threshold patch above).

## Dev Notes

### Scope at a glance

Story 5.3 makes the review loop **playable**: the user types an answer, it is validated fairly (kana conversion, typo-tolerant meanings, conjugation-aware grammar), a color+icon+text result shows, and the FSRS grade is derived from correctness and persisted through the existing engine.

**In scope:** `wanakana` input, `levenshtein` + `meaningEvaluator` + `readingEvaluator` (`core/answer/`), `conjugationParser` + grammar `answerEvaluator` (`core/grammar/`), `WanaKanaInput` component, `ReviewCard` result states, submit→grade wiring, answer-data hydration on `ReviewItem`.

**Out of scope (do not build):**
| Deferred | Owner |
| --- | --- |
| `ProgressiveHint`, layered hints | Story 5.4 |
| `ReinforcementHighlight` ("← you learned this yesterday") | Story 5.4 |
| Related-item priority boosts | Story 5.4 |
| Weakness recording / confusion clusters | Epic 6 |
| Real cognitive-load increment + ring fill | Epic 6 |
| Post-session `summary.tsx`, `TimeCompressionSummary` | Epic 6 |
| Configurable auto-advance pause (0.5/1/2s/manual) UI | Epic 6 settings — use a single sensible default constant here |

### Critical: build on Stories 5.1 + 5.2 — do not rebuild engine or shell

| Asset | Location | Role in 5.3 |
| --- | --- | --- |
| `ReviewSessionProvider` | `providers/ReviewSessionProvider.tsx` | **Keep** — `gradeCurrentItem(grade)` is the only grading entry point; async persist + `pendingWrites` flush preserved |
| `useReviewQueue` | `data/hooks/useReviewQueue.ts` | **Extend** — add per-item answer-data fetch into `QueueInputItem` |
| `queueBuilder` / `ReviewItem` | `core/srs/queueBuilder.ts`, `srs.types.ts` | **Extend** — `mapToReviewItem` attaches `answerKey`; keep pure |
| `promptResolver` | `core/srs/promptResolver.ts` | **Reuse unchanged** — `promptType` already drives which evaluator runs |
| `ReviewCard` | `components/review/ReviewCard.tsx` | **Extend** — implement non-`prompting` states (currently `return null`) |
| `app/review/index.tsx` | review route | **Modify** — swap disabled `TextInput` for `WanaKanaInput`, add submit state machine, remove `DevGradeButtons` from production |
| `SessionHeader` / `SessionExitSheet` | `components/review/` | **Keep** — no changes |
| `evaluatePassageAnswer` | `core/answer/evaluatePassageAnswer.ts` | **Do not break** — widening `AnswerResult` to add `'typo'` must leave this Epic-4 function compiling and behaving identically |

### Architecture compliance (must follow)

- **Layering (hard rule):** evaluators and the conjugation parser are **pure TypeScript with ZERO React/RN imports**, under `core/answer/` and `core/grammar/`. UI (`WanaKanaInput`, `ReviewCard`) under `components/review/`. Orchestration/state machine stays in `app/review/index.tsx` (+ existing provider). [Source: architecture.md — `core/` "Pure TypeScript — ZERO React/RN imports"]
- **Canonical file paths** (architecture source tree, lines ~762–791): `core/answer/levenshtein.ts`, `meaningEvaluator.ts`, `readingEvaluator.ts`, `answer.types.ts`; `core/grammar/conjugationParser.ts`, `answerEvaluator.ts`, `grammar.types.ts`; `components/review/WanaKanaInput.tsx`. Use these exact names/locations.
- **Composable per content type:** "reading prompt → WanaKana + Levenshtein kana; meaning prompt → Levenshtein English; grammar prompt → parser + fallback." [Source: architecture.md #Japanese-text-handling]
- **No new heavy deps beyond `wanakana`.** Levenshtein is hand-rolled (`utils`/`core/answer/levenshtein.ts`), not a library. [Source: architecture.md naming example `levenshtein.ts`]
- **Styling:** NativeWind semantic tokens only — `feedback-correct` / `feedback-incorrect` / `feedback-warning` / `feedback-info`, `surface-elevated`, `text-muted`, `text-display`. No raw hex in components. Feedback is **always color + icon + text**, never color alone. [Source: ux-design-specification.md #Feedback-Patterns]
- **Named exports** (`export function …`), **co-located `*.test.ts(x)`** beside each new file.
- **Performance:** <100ms tap-to-next preserved; result flash is intra-item and allowed, but **no `LayoutAnimation`/Reanimated/confetti between items** (NFR5b).

### Data flow: where accepted answers come from (most important design point)

`ReviewItem` today carries only `meanings: [curriculumItem.meaning]` — **insufficient** for validation (no readings, no synonyms, no conjugation rules). The repository already exposes everything needed:

- `getAcceptedAnswers(db, itemId)` → `AcceptedAnswer[]` with `answerType: 'meaning' | 'reading' | 'production'`, `answerText`, `isPrimary` (table `accepted_answers`).
- `getKanjiReadings(db, itemId)` → onyomi/kunyomi kana (table `kanji_readings`) — a reading source for kanji.
- `getGrammarRule(db, itemId)` → `{ structure, conjugationRules, acceptedForms }` (table `grammar_rules`).

Hydrate in `useReviewQueue` (same place it already calls `getItemById`, `getPersonalMnemonic`) and pass into `QueueInputItem`; `mapToReviewItem` attaches an `answerKey`. Evaluators then receive plain arrays/objects — staying pure and prefetch-friendly.

**Seed coverage (verified against bundled N5):**
- Kanji items have both `meaning` and `reading` accepted answers (e.g. `一` → `{meaning:"one"}`, `{reading:"いち"}`) plus `readings[]`.
- Vocabulary items in the seed currently have **only `meaning`** accepted answers (e.g. `私` → `{meaning:"I"}`, no `reading`). Since `promptResolver` alternates vocab between `reading` and `meaning`, a vocab `reading` prompt can resolve with **no accepted reading**. Handle per AC7 — recommended: if `acceptedReadings` is empty for a `reading` prompt, fall back to the `meaning` evaluator for that item OR treat as a soft skip with a `__DEV__` warn (document your choice in the Dev Agent Record). Do not crash. (This seed gap is also tracked in `deferred-work.md` for the curriculum compiler.)
- Grammar items have `conjugation_rules` (often simple, e.g. `{"polite": true}` or `{"particle": "object"}`) and `accepted_forms` (e.g. `["です","だ"]`). The N5 seed is **particle-heavy**, so most grammar items validate via exact `accepted_forms` match — design the parser to lean on `accepted_forms` and only add conjugation transforms where they clearly apply.

### Validation rules to implement (document final choices in Dev Agent Record)

- **Normalization (meaning):** lowercase, `trim()`, collapse internal whitespace, optionally strip trailing punctuation. Compare against every accepted meaning + synonym.
- **Typo threshold (meaning), length-scaled — suggested:** `maxDistance = len<=3 ? 0 : len<=5 ? 1 : 2` (computed against the closest accepted answer). Within → `typo`; beyond → `incorrect`. This mirrors WaniKani-style fat-finger tolerance (FR14). Pick and document a concrete rule.
- **Reading:** convert both sides to a common kana form (`wanakana.toHiragana`) before comparing so katakana/hiragana don't false-fail; exact → `correct`; Levenshtein `<= 1` on kana → `typo`; else `incorrect`. (Kana threshold should be tight — readings are short.)
- **Grammar:** `accepted_forms` exact (after trim) → `correct`; supported wrong-conjugation → `incorrect` (show correct form); unsupported pattern → Levenshtein vs `accepted_forms` (`<= 1`) → `typo`/`correct`, else `incorrect`; `__DEV__` log when the fallback path runs.

### Submit → grade mapping (AC6)

The engine grades with `ReviewGrade = 1|2|3|4` (Again/Hard/Good/Easy). For 5.3:

| Result | Action | Grade |
| --- | --- | --- |
| `correct` | reveal, auto-advance after pause | `gradeCurrentItem(3)` (Good) |
| `incorrect` | show correct answer, wait for Continue tap | `gradeCurrentItem(1)` (Again) |
| `typo` | re-prompt, re-focus input | **no grade, no advance** |

Hard/Easy differentiation (e.g. from hint usage) is **Story 5.4**. Keep it binary here. `gradeCurrentItem` already advances the index — so call it at the moment you want to move on (after the correct-pause, or after the incorrect Continue tap), not at submit time. The result state lives in the **screen**, not the provider; the provider stays a thin grade/advance engine.

### `WanaKanaInput` conversion notes

- Use `wanakana.toKana(value, { IMEMode: true })` (not raw `toHiragana`) so trailing `n`, double consonants (`tt`→`っ`), and in-progress syllables behave like an IME. Display the converted value back into the controlled `TextInput`. [Source: ux-design-specification.md #WanaKanaInput — "Keystroke → WanaKana toHiragana() → displayed as kana in real-time"]
- English/meaning mode: pass text straight through, `autoCapitalize="none"`, `autoCorrect={false}`, `autoComplete="off"`.
- Pre-focus on prompt (`autoFocus` or `useRef().focus()` in an effect keyed to the item id). Submit on `onSubmitEditing` / return key (UX-DR23) and clear+refocus on `typo`.
- Verify `wanakana` runs acceptably in the RN JS runtime (architecture flags this as an early-validation risk) — note measured per-keystroke behavior in the Dev Agent Record.

### Previous story intelligence (5.1 / 5.2)

- `usePreventRemove` is imported from `@react-navigation/core` (not `@react-navigation/native`) in this project — do not change.
- RNTL v13.3 here: `getByRole('progressbar')` is unreliable; tests use `UNSAFE_getByProps`/`getByLabelText`. Follow the same pattern for any role-based queries.
- `gradeCurrentItem` guards against double-grade via `isGrading` ref and advances `currentIndex` synchronously while persisting async into `pendingWrites` (flushed on unmount). Submitting an answer must funnel through this — do **not** add a second persistence path.
- `ReviewCard` already maps `promptType` → mode label/color and hides meanings during `prompting`; 5.3 only adds the result branches.
- 5.2 review-finding patterns to honor: clamp/guard inputs, handle negative/edge values, no silent navigation, `accessible` grouping on info regions.

### Git intelligence

| Commit | Relevance |
| --- | --- |
| `84e7757` Review session UI + card prompting (5.2) | **Baseline** — shell, `ReviewCard` prompting, disabled input, `DevGradeButtons` to replace |
| `b5215d3` Review queue + FSRS + prefetch (5.1) | Engine to preserve — `gradeItem`, `upsertSrsState`, prefetch, `pendingWrites` |
| Epic 4 item-detail commits | `getAcceptedAnswers`/`getKanjiReadings`/`getGrammarRule` already used for detail screens — reuse the same readers |
| `f52ceda` Personal mnemonics | `personalMnemonic` may surface in result/incorrect state later (5.4), not required here |

### Latest technical notes

- **`wanakana`** is a pure-JS library (no native module) — installs cleanly into Expo and runs in Jest/node. Prefer the real module in tests for conversion fidelity. API: `toKana`, `toHiragana`, `toKatakana`, `isKana`, with `{ IMEMode: true }` for incremental input. [Source: architecture.md #Technology-stack "wanakana — romaji-to-hiragana conversion (runs in JS runtime)"]
- **Levenshtein**: standard two-row DP; O(m·n) is trivial for short answers. No library.
- **Conjugation parser**: phased per architecture risk note — "phased approach starting with common verb forms." Don't attempt full Japanese morphology; implement a small, tested, documented rule set and fall back cleanly. The N5 seed barely exercises it (mostly particles), so over-engineering here is wasted scope.
- **Haptics** (optional): `expo-haptics` matches the UX feedback table (light/medium/soft). Acceptable to defer; if added, it must be additive to color+icon+text, never the sole signal, and respect a future reduce-motion/haptics setting.

### File structure (new / modified)

```
mobile/
  package.json                        MODIFY — add wanakana
  src/
    core/
      answer/
        answer.types.ts               MODIFY — AnswerResult adds 'typo' (+ optional EvalContext)
        levenshtein.ts                NEW
        levenshtein.test.ts           NEW
        meaningEvaluator.ts           NEW
        meaningEvaluator.test.ts      NEW
        readingEvaluator.ts           NEW
        readingEvaluator.test.ts      NEW
        evaluatePassageAnswer.ts      VERIFY — still compiles with widened union
      grammar/
        grammar.types.ts              NEW
        conjugationParser.ts          NEW
        conjugationParser.test.ts     NEW
        answerEvaluator.ts            NEW
        answerEvaluator.test.ts       NEW
      srs/
        srs.types.ts                  MODIFY — add answerKey to ReviewItem
        queueBuilder.ts               MODIFY — QueueInputItem + mapToReviewItem attach answerKey
    data/hooks/
      useReviewQueue.ts               MODIFY — fetch accepted answers/readings/grammar rule per item
    components/review/
      WanaKanaInput.tsx               NEW
      WanaKanaInput.test.tsx          NEW
      ReviewCard.tsx                  MODIFY — correct/incorrect/typo states
      ReviewCard.test.tsx             MODIFY — result-state coverage
      index.ts                        MODIFY — export WanaKanaInput
    app/review/
      index.tsx                       MODIFY — WanaKanaInput + submit state machine, remove prod grade buttons
```

**Do not create in 5.3:** `ProgressiveHint.tsx`, `ReinforcementHighlight.tsx`, `review/summary.tsx`, weakness/cognitive-load logic.

### Testing requirements

| File | Minimum coverage |
| --- | --- |
| `levenshtein.test.ts` | Equal strings = 0; single edit = 1; empty cases; symmetry sanity |
| `meaningEvaluator.test.ts` | Exact match; synonym match; case/whitespace normalization; in-threshold typo → `typo`; out-of-threshold → `incorrect`; empty → `incorrect` |
| `readingEvaluator.test.ts` | Exact kana; katakana↔hiragana equivalence; one-edit typo → `typo`; wrong → `incorrect` |
| `conjugationParser.test.ts` | Exact `accepted_forms`; a wrong conjugation rejected; unsupported pattern → unsupported signal |
| `answerEvaluator.test.ts` (grammar) | Parser hit; fallback-to-Levenshtein path; correct/typo/incorrect outcomes |
| `WanaKanaInput.test.tsx` | `ta`→`た` live conversion; english mode pass-through; a11y label; submit on return key; disabled state |
| `ReviewCard.test.tsx` | `correct` shows ✓+meaning; `incorrect` shows ✗+correct answer; `typo` shows ~ + "Close! Try again." |
| review screen (or provider) | submit `correct`→grade 3 + advance; `incorrect`→grade 1 + wait; `typo`→no advance |

Manual QA:
1. Open `/review` (via `__DEV__` Home entry) — input is focused; type `taべる`-style romaji → kana appears live.
2. Reading prompt: correct kana → green ✓ auto-advance; near-miss → amber "Close!" re-prompt; wrong → red ✗ with correct reading, stays until tap.
3. Meaning prompt: exact English → correct; one-letter typo → amber re-prompt; unrelated → incorrect.
4. Grammar prompt: an `accepted_forms` value → correct; nonsense → incorrect.
5. Advance through several items — verify no animation flash and instant next-item.

Run from `mobile/`: `npm run lint && npm run typecheck && npm test`.

### Project Structure Notes

- All new logic lands in the architecture-canonical `core/answer/` and `core/grammar/` folders (already partially present from Epic 4's `evaluatePassageAnswer`). No structural deviation.
- The single intentional extension to the data model is `ReviewItem.answerKey`, fetched in the existing per-item hydration loop in `useReviewQueue` — consistent with how `personalMnemonic` was added in Story 5.1.
- `AnswerResult` is widened (additive) rather than forked, keeping one shared result vocabulary across passage answers (Epic 4) and review answers (Epic 5).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 5, Story 5.3 AC (FR6b, FR13, FR14, UX-DR6, UX-DR23, NFR5)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — `core/answer/`, `core/grammar/`, `WanaKanaInput` in source tree (~lines 762–791, 717–727); Japanese-text-handling composition rule (~line 95); `wanakana` in stack (~line 71, 181); phased conjugation parser risk (~line 81)]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — `ReviewCard` states, `WanaKanaInput` (~932–947); Feedback Patterns table (~1085–1098); WanaKana input form pattern (~1115–1121); "close!" hints philosophy (~80, 466)]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR6b, FR13, FR14, NFR5]
- [Source: `_bmad-output/implementation-artifacts/5-2-review-session-ui-layout-and-card-prompting.md` — shell, deferral table (5.3 owns input/validation/result states)]
- [Source: `_bmad-output/implementation-artifacts/5-1-review-queue-builder-fsrs-scheduling-and-prefetch.md` — engine baseline, async grade persistence]
- [Source: `mobile/src/data/curriculum/itemRepository.ts` — `getAcceptedAnswers`, `getKanjiReadings`, `getGrammarRule`, `AcceptedAnswer`/`GrammarRule` types]
- [Source: `mobile/src/core/srs/queueBuilder.ts`, `srs.types.ts` — `ReviewItem`, `QueueInputItem`, `mapToReviewItem`]
- [Source: `mobile/src/data/hooks/useReviewQueue.ts` — per-item hydration loop]
- [Source: `mobile/src/providers/ReviewSessionProvider.tsx` — `gradeCurrentItem`, async persist, `pendingWrites`]
- [Source: `mobile/src/components/review/ReviewCard.tsx` — prompting render to extend]
- [Source: `mobile/src/app/review/index.tsx` — disabled input + `DevGradeButtons` to replace]
- [Source: `mobile/src/core/answer/evaluatePassageAnswer.ts`, `answer.types.ts` — existing `AnswerResult` to widen without regression]
- [Source: `scripts/curriculum-schema.ts` — `accepted_answers`, `grammar_rules` schema; `scripts/compile-curriculum.ts` — seed population]
- [Source: `mobile/tailwind.config.js` — `feedback-*`, `content-reading`, `surface-*` tokens]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — vocab example/reading seed gaps]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

### Completion Notes List

- Installed `wanakana` (pure JS; real module used in Jest — no mock needed). Conversion runs synchronously per keystroke via `wanakana.toKana(value, { IMEMode: true })` in `WanaKanaInput`.
- **Validation rules:** meaning typo threshold `len≤3→0, len≤5→1, else→2`; reading kana Levenshtein `≤1` for typo; grammar parser handles `polite: true/false` conjugation mismatches, else Levenshtein fallback (`__DEV__` log).
- **Vocab reading seed gap:** when `promptType === 'reading'` and `acceptedReadings` is empty, `evaluateReviewAnswer` falls back to meaning validation with `__DEV__` warn — session does not crash.
- **Submit→grade:** `correct` → `gradeCurrentItem(3)` after 800ms pause; `incorrect` → Continue tap → `gradeCurrentItem(1)`; `typo` → no grade, re-focus input.
- `evaluatePassageAnswer` narrowed to `PassageAnswerResult` (`Exclude<AnswerResult, 'typo'>`) so Epic 4 passage UI is unchanged.
- All CI checks pass: lint, typecheck, 456 tests (70 suites).

### File List

- mobile/package.json
- mobile/package-lock.json
- mobile/src/config/constants.ts
- mobile/src/core/answer/answer.types.ts
- mobile/src/core/answer/evaluatePassageAnswer.ts
- mobile/src/core/answer/levenshtein.ts
- mobile/src/core/answer/levenshtein.test.ts
- mobile/src/core/answer/meaningEvaluator.ts
- mobile/src/core/answer/meaningEvaluator.test.ts
- mobile/src/core/answer/readingEvaluator.ts
- mobile/src/core/answer/readingEvaluator.test.ts
- mobile/src/core/answer/reviewAnswerEvaluator.ts
- mobile/src/core/answer/reviewAnswerEvaluator.test.ts
- mobile/src/core/grammar/grammar.types.ts
- mobile/src/core/grammar/conjugationParser.ts
- mobile/src/core/grammar/conjugationParser.test.ts
- mobile/src/core/grammar/answerEvaluator.ts
- mobile/src/core/grammar/answerEvaluator.test.ts
- mobile/src/core/srs/srs.types.ts
- mobile/src/core/srs/queueBuilder.ts
- mobile/src/core/srs/queueBuilder.test.ts
- mobile/src/data/hooks/useReviewQueue.ts
- mobile/src/components/review/WanaKanaInput.tsx
- mobile/src/components/review/WanaKanaInput.test.tsx
- mobile/src/components/review/ReviewCard.tsx
- mobile/src/components/review/ReviewCard.test.tsx
- mobile/src/components/review/index.ts
- mobile/src/app/review/index.tsx
- mobile/src/providers/ReviewSessionProvider.test.tsx

## Change Log

- 2026-06-28: Story 5.3 drafted — answer input (WanaKana) + validation (Levenshtein meaning/reading, conjugation-aware grammar), ReviewCard result states, submit→grade wiring, ReviewItem answer-data hydration. Status set to ready-for-dev.
- 2026-06-28: Story 5.3 implemented — playable review loop with WanaKana input, evaluators, result states, and FSRS grade derivation. Status set to review.
- 2026-06-28: Code review — 7 patches applied (reading/production correct-reveal label + a11y alignment via `resolveCorrectReveal`; length-scaled kana typo threshold so wrong 1-mora particles/readings are `incorrect`; `evaluateReading` displayAnswer index alignment; `gradeForResult` wired as the single grade-mapping source; double-submit ref guard; removed dead `WanaKanaInput.clear()`; production placeholder romaji hint). 3 findings deferred (seed-gap meaning fallback, `getGrammarRule` JSON.parse, wanakana cursor), 3 dismissed. +5 regression tests; lint/typecheck/461 tests green. Status set to done.
