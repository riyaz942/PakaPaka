# Plan 03 — Answer validation and feedback

**Priority:** P1. These are the five items that make the app feel like it is wrong when the user is right, plus the reveal that teaches nothing.

**Feedback addressed:**
> When I give an incorrect answer, apart from saying that this is incorrect, could you also show in detail what the actual information is and all the details around that? For example, if the vocabulary is wrong, show the whole detail of that vocabulary. Similarly, if my reading is wrong for a Kanji, display the whole detail of the Kanji, the reading, the meaning, the mnemonics, etc.

> For vocabulary that has just Hiragana, don't ask for readings, just ask for meanings.

> On the review section, when the application is asking the meaning of a Kanji but I try to input Kanji and hit enter, the application should give a hint that they want the meaning and not the reading, instead of saying that this is incorrect. And similarly, vice versa.

> There can be multiple meanings to Kanji or radical. For example, the two stroke radical is two, but if I say the number two, it shows as incorrect, although it should be right.

> Apart from mnemonics, add another option to add answers. So for example country, vocabulary, radicals — each of them would have multiple meanings. So if an answer isn't accepted they can add their meaning.

---

These five split into three separable pieces: **what we ask** (3.1), **what we accept** (3.2, 3.3, 3.4), and **what we show when it's wrong** (3.5).

---

## 3.1 — Don't ask for the reading of kana-only vocabulary

`resolvePromptType` (`mobile/src/core/srs/promptResolver.ts:11`) alternates reading/meaning by rep parity for *all* vocabulary, with no regard for whether the word contains any kanji.

**127 of the 716 N5 vocabulary items are pure kana.** Verified against `curriculum/vocabulary/n5.json` — `これ`, `それ`, `あなた`, `どれ`, `この`… and every one of them carries a reading answer identical to its own surface form:

```json
{"primary_form":"これ","accepted_answers":[
  {"answer_type":"meaning","answer_text":"this one","is_primary":true},
  {"answer_type":"reading","answer_text":"これ"}]}
```

So roughly half of all reviews for 18% of N5 vocabulary are "type the characters you are currently looking at."

**Fix.** Add a `hasKanji(primaryForm)` predicate (`wanakana.isKana` inverted, or a CJK-ideograph range test) and route in `resolvePromptType`:

```ts
if (itemType === 'vocabulary' && !hasKanji(primaryForm)) return 'meaning';
```

`resolvePromptType` currently takes `(itemType, srsState)` and has no access to the surface form. It gains a third argument; its two call sites are `queueBuilder.ts:150` and the tests.

Guard the same case in `evaluateReviewAnswer` (`mobile/src/core/answer/reviewAnswerEvaluator.ts:11`), which already has a fallback for reading-prompts-with-no-readings — extend it to also catch reading-prompts-whose-only-reading-equals-the-prompt.

**Curriculum cleanup (optional, separate PR).** Strip the tautological reading rows from kana-only vocab in `curriculum/vocabulary/*.json`. Not required for the fix, but it removes the trap for good. Note `radicalItem` has no `accepted_answers` in `curriculum/schema/curriculum.schema.json` at all — see 3.2.

---

## 3.2 — Accept every meaning an item actually has

Today an item has exactly one meaning, and it is a display string.

`queueBuilder.mapToReviewItem` (`mobile/src/core/srs/queueBuilder.ts:147`):
```ts
meanings: [item.curriculumItem.meaning],
```

`buildAnswerKey` (`mobile/src/data/hooks/useReviewQueue.ts:41`) papers over this with `deriveMeaningCandidates`, which splits the packed display string on `/` and `;` and strips parentheticals. So `"ground / one"` accepts `ground` and `one`. That's a decent hack and it should stay.

What it cannot do is accept a synonym that isn't in the string. The radical `二` has `meaning: "two"` (verified in `curriculum/radicals/n5.json`) and **no `accepted_answers` array — the radical schema doesn't define the field.** So "two" is the only accepted answer in the entire system. `"number two"` scores a Levenshtein distance of 7 against a 3-char target with a typo threshold of `0` (`meaningEvaluator.ts:6`), and comes back incorrect.

**Fix, in three layers:**

1. **Schema.** Add `accepted_answers` to `$defs.radicalItem` in `curriculum/schema/curriculum.schema.json`, matching `kanjiItem`/`vocabItem`. Radicals are the only content type that can't carry synonyms today, and radicals are exactly where single-word meanings collide most.

2. **Curriculum data.** Seed synonyms for the number radicals and other high-collision items — `二` → `two`, `number two`, `2`. Do this as a data pass over `curriculum/radicals/*.json` and `curriculum/kanji/*.json`. This is content work, not code work, and can proceed in parallel.

3. **Carry all meanings through to the UI.** `ReviewItem.meanings` should be the full accepted-meaning list, not `[meaning]`. `mapToReviewItem` doesn't currently receive the answer key's meanings even though `QueueInputItem.answerKey` is right there. Change to `meanings: item.answerKey.acceptedMeanings`. This matters for 3.5 — the reveal should show every meaning, not just the primary.

Keep the *display* meaning separate from the *accepted* meanings. `ReviewCard`'s reveal shows the display meaning prominently and the alternates beneath; `formatMeanings` (`ReviewCard.tsx:37`) currently joins with `", "` and would turn `"ground / one"` into noise if fed raw candidates.

---

## 3.3 — Let users add their own accepted answers

The natural resolution of 3.2's long tail: no curriculum will ever contain every synonym a learner reaches for.

There is already a precedent to copy exactly. `PersonalMnemonicEditor` (`mobile/src/components/learn/PersonalMnemonicEditor.tsx`) + `mnemonicRepository` + `migration 005_personal_mnemonics` is a working per-item user-content feature, and `useReviewQueue.ts:194` already pulls `getPersonalMnemonic` into every queue item.

**Build the same shape for synonyms:**

- **Migration `012_user_synonyms.ts`** — `user_synonyms(item_id INTEGER, answer_type TEXT CHECK(answer_type IN ('meaning','reading')), answer_text TEXT, created_at TEXT, PRIMARY KEY (item_id, answer_type, answer_text))`. Two types, not one — a learner may equally want to accept an alternate reading.
- **`userSynonymRepository.ts`** — `listSynonymsForItems(db, ids)` (batched, mirroring `getBoosts`), `addSynonym`, `removeSynonym`.
- **`buildAnswerKey`** merges user synonyms into `acceptedMeanings` / `acceptedReadings`. It already does a `new Set([...])` union of curriculum sources; add a third source.
- **UI.** A "Add my answer" affordance in two places: the item detail screen (alongside the personal mnemonic editor), and — the one that actually matters — **on the incorrect reveal**, where the user is looking at their rejected answer and thinking "that should have counted." One tap adds the answer they just typed.

**Guardrails.** Do not let a user add an answer that is already accepted for a *different* item in the same review queue, or `会` and `合` both become "meet". Warn on collision; don't hard-block. Never let a user-added synonym retroactively change a recorded outcome.

---

## 3.4 — Wrong-script detection

When the prompt is "Meaning" and the user types `二`, we run `evaluateMeaning`, Levenshtein it against `"two"`, and report **Incorrect**. When the prompt is "Reading" and the user types `two`, `normalizeKana` (`readingEvaluator.ts:16`) runs `wanakana.toHiragana("two")` — which yields kana garbage — and reports **Incorrect**.

Both are *category errors*, not knowledge errors, and grading them `Again` actively corrupts the user's schedule and their weakness stats.

**Fix.** Add a pre-evaluation script check in `evaluateReviewAnswer` (`mobile/src/core/answer/reviewAnswerEvaluator.ts`), before routing to an evaluator:

```ts
type EvaluationResult['result'] = 'correct' | 'incorrect' | 'typo' | 'wrong_script';
```

- Prompt is `meaning`, answer contains kana or CJK ideographs → `wrong_script`, message *"We're looking for the meaning in English."*
- Prompt is `reading` or `production`, answer is pure ASCII Latin **and** does not romanize to a valid reading → `wrong_script`, message *"We're looking for the reading in kana or romaji."*

The second case needs care: `wanakana` romaji input is legitimate — `"ni"` → `に` is exactly how the input is meant to work. So the rule is *"Latin input that fails to match any accepted reading, and whose raw form matches an accepted **meaning**"* → the user answered the wrong question. That's an unambiguous signal and it avoids false-flagging a genuinely misremembered romaji reading.

**`wrong_script` is non-terminal, exactly like `typo`.** In `mobile/src/app/review/index.tsx:213` the typo branch re-prompts without advancing and without grading. Mirror it:

```ts
if (evaluation.result === 'wrong_script') {
  setCardState('wrong_script');
  setAnswerText('');
  isSubmittingRef.current = false;
  return;
}
```

`gradeForResult` (`reviewAnswerEvaluator.ts:44`) returns `null` for it, as it does for `typo`. Do **not** call `recordOutcome` — a script mixup is not a weakness signal. `WanaKanaInput`'s `mode` already switches on prompt type (`review/index.tsx:327`), so the input is at least trying to help; this closes the gap when the user pastes or uses an IME.

---

## 3.5 — Show the full item on an incorrect answer

Currently the entire incorrect state is (`ReviewCard.tsx:89`):

```tsx
<Text className="text-title-lg text-feedback-incorrect">✗ Incorrect</Text>
<Text className="text-body-lg text-primary text-center">Correct answer: {answer}</Text>
```

One string. For a kanji reading miss, the user gets `いち` and nothing else — no meaning, no other reading, no mnemonic, no radical breakdown. This is the single highest-leverage teaching moment in the app and we spend it on eleven characters.

**Fix.** Render the full item detail inline on the incorrect reveal. The components already exist and are already built to take an item: `KanjiDetail`, `VocabularyDetail`, `RadicalDetail`, `GrammarDetail` (`mobile/src/components/learn/`), composed by `LessonItemView` (`mobile/src/components/lesson/LessonItemView.tsx`) behind `useItemDetail`.

Two constraints shape the implementation:

1. **The <100ms feedback target.** `ReviewItem` deliberately carries a thin projection — `primaryForm`, `meanings`, `mnemonic`, `answerKey`. The detail components need a full `useItemDetail` fetch. Do **not** fetch on reveal; that puts a DB round-trip on the critical path. Instead, **prefetch the detail for the current item and the `MAX_PREFETCH` buffer** (`ReviewSessionProvider.tsx:145` already maintains a 5-item lookahead) so the reveal is a pure render.

2. **The reveal must not become a wall.** Show a compact summary by default — correct answer, all meanings, all readings with onyomi/kunyomi labels, mnemonic — and put the long tail (example sentences, radical composition, dependency hints) behind a "See full details" expansion. The user asked for detail, not for a scroll.

The incorrect state is already the one state with a manual `Continue` button rather than an 800ms auto-advance (`review/index.tsx:360`), so there is no timing pressure on the user. Keep that.

Apply the same treatment, in reduced form, to the **`wrong_script`** state from 3.4 (a one-line nudge, no detail — the user hasn't been told the answer, so don't tell them) and to **"Don't know"** (`handleDontKnow`, `review/index.tsx:235`), which routes through the identical `incorrect` card state and should get the identical full reveal.

---

## Acceptance criteria

- `これ` and every other kana-only vocabulary item is only ever prompted for meaning.
- The radical `二` accepts `two`, `number two`, and `2`.
- Typing `二` at a Meaning prompt shows a script hint, does not grade, and re-prompts.
- Typing `two` at a Reading prompt shows a script hint, does not grade, and re-prompts.
- A user can add a synonym directly from the incorrect reveal, and it is accepted on the item's next review.
- An incorrect answer displays the item's meanings, readings, and mnemonic without a visible fetch delay.
- Reveal render time for a prefetched item stays within the <100ms budget.
- Neither `wrong_script` nor `typo` writes to `srs_states`, `weakness_stats`, or `cognitive_load_history`.

## Files touched

- `mobile/src/core/srs/promptResolver.ts`
- `mobile/src/core/srs/queueBuilder.ts`
- `mobile/src/core/answer/reviewAnswerEvaluator.ts`
- `mobile/src/core/answer/answer.types.ts`
- `mobile/src/core/answer/meaningEvaluator.ts`
- `mobile/src/components/review/ReviewCard.tsx`
- `mobile/src/app/review/index.tsx`
- `mobile/src/data/hooks/useReviewQueue.ts`
- `mobile/src/providers/ReviewSessionProvider.tsx`
- `mobile/src/data/migrations/012_user_synonyms.ts` *(new)*
- `mobile/src/data/user/userSynonymRepository.ts` *(new)*
- `curriculum/schema/curriculum.schema.json`
- `curriculum/radicals/*.json`, `curriculum/kanji/*.json` *(content pass)*
