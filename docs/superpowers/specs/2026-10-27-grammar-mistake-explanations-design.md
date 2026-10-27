# Grammar Build — Mistake Explanations (design, 2026-10-27)

## Why

A grammar Build card shows an English sentence. The learner types the whole
Japanese sentence. When the answer is wrong, the "Incorrect" screen shows only
the correct sentence. The learner must find the difference alone. With three
particles and a verb in one sentence, that is slow, and the learner often does
not see the real mistake.

The maintainer's most frequent mistakes are:

1. the wrong particle,
2. plain form where the card asks for polite form (or the opposite),
3. the wrong tense.

This feature tells the learner **what** is wrong and **where**, with no AI.
All checks are rules that run on the device, offline.

## What it is

When a Build answer grades `incorrect`, the app compares the learner's
sentence with the correct sentence. It finds each mistake, puts a mark on the
learner's sentence at the mistake, and writes one explanation for each mark.
The explanation names the words around the mistake, because one sentence can
have many particles:

> After 学校, you used に. This sentence needs で.

> Between 今年 and 学校, you need は. Your answer has no particle there.

## Goals

- Find all 14 mistake types below (the maintainer asked for all of them, not
  only the top three).
- Each explanation names the place of the mistake (the words around it).
- Works offline, with no AI and no network.

## Non-goals

- No reason "why" (for example, why に and not で). A correct reason depends
  on how the particle is used in each sentence. The curriculum does not record
  that, so each reason would need to be written by hand. Maybe later.
- Only grammar Build cards. Not the grammar Read card, not vocabulary or kanji
  cards, not passage questions.
- No change to grading. A wrong answer stays wrong.

## Anti-goals (a failure even if it works)

- **A wrong explanation.** An explanation that names the wrong mistake teaches
  the wrong thing. When the app is not sure, it shows no explanation. It never
  guesses.
- **A hidden fallback.** There is one path: explanations appear when the app
  finds the mistakes, and the screen is as it is now when it does not. No
  silent second method.
- **A change to the grade or to the SRS.** The explanation is only help.

## The 14 mistake types

| # | Type | Example (typed → correct) | Explanation text |
|---|---|---|---|
| 1a | Missing particle | 今年学校 → 今年は学校 | "Between 今年 and 学校, you need は. Your answer has no particle there." |
| 1b | Wrong particle | 学校に → 学校で | "After 学校, you used に. This sentence needs で." |
| 1c | Extra particle | 明日に → 明日 | "After 明日, you added に. This sentence has no particle there." |
| 2 | Polite / plain | 食べる → 食べます | "You wrote 食べる. This card asks for polite form: 食べます." (and the opposite for plain) |
| 3 | Wrong tense | 行きます → 行きました | "You wrote 行きます. The English is past: 行きました." (and the opposite) |
| 4 | Negative / positive | 行きます → 行きません | "You wrote 行きます. The English is negative: 行きません." (and the opposite) |
| 5 | Wrong verb group | 帰ます → 帰ります | "You wrote 帰ます. 帰る is a う-verb: 帰ります." |
| 6 | Bad て / た form | 書って → 書いて | "You wrote 書って. く verbs change to いて: 書いて." |
| 7 | い / な adjective mix | きれいくない → きれいじゃない | "You wrote きれいくない. きれい is a な-adjective: きれいじゃない." |
| 8 | Transitive / intransitive | ドアを開く → ドアを開ける | "You wrote 開く. With を, use 開ける." |
| 9 | Grammar point not used | correct meaning, no 〜たい | "This card tests 〜たい." |
| 10 | Wrong word | 来る → 行く | "You wrote 来る. This sentence needs 行く." |
| 11 | Missing / extra word | no 明日 | "You did not write 明日." / "You added 毎日. This sentence does not have it." |
| 12 | Word order | right words, wrong order | "All words are correct. The order is not." |
| 13 | Spelling | きて → きって; ここう → こうこう | "Small っ is missing: きって." / "Long vowel is missing: こうこう." |
| 14 | Wrong kanji, same sound | 合う → 会う | "Same sound, different kanji: 会う." |

(Type 1, particle, has three cases: missing, wrong, extra.)

### One word, more than one mistake (my call)

When one word has more than one mistake (食べる for 食べました: plain and
non-past), it gets **one mark** with **one explanation** that names all of
them: "You wrote 食べる. This card asks for polite past: 食べました." It
counts as one mark toward the limit.

### Type 9 rule (my call)

"Grammar point not used" shows only when the answer agrees with an accepted
answer everywhere outside the grammar point (`grammarSpan`) and differs inside
it. If the difference inside the grammar point is a conjugation mistake of the
grammar form (食べたかった for 食べたい), the conjugation type (2, 3, 4, 5, 6 or
7) is shown, not type 9. The text does not say "Good sentence", because the
app cannot be sure the rest is good; it says only "This card tests 〜たい."

### More than one accepted answer (maintainer's decision)

A card can have more than one accepted answer: the sentence, its `valid`
alternates, and the learner's saved answers. The app checks **all** of them,
place by place:

- If any accepted answer allows what the learner typed at a place, that place
  gets **no mark**.
- If more than one form is correct at a place, the explanation names all of
  them: "After 家, you used で. This sentence needs に or へ."
- A word that some accepted answer leaves out (an optional 私は) is never
  marked as "extra" or "missing".
- Word order (type 12) shows only when no accepted answer has the learner's
  order.

This keeps the anti-goal: never a wrong explanation.

The explanation texts are the agreed style: short, they name the word the
learner wrote, and they give the correct form. Exact wording is the builder's,
inside that style.

### Words in the explanation

The explanation writes the learner's words as the learner typed them. If the
learner typed in kana, it names them in kana. The correct form is written as
in the correct sentence.

## The screen

Agreed layout (mockup "C"; the tapped mark uses the style in the bullets below):

```
✕ Incorrect

YOUR ANSWER — TAP A MARK
今年 _ 学校[に]日本語を[勉強する]
        ▲
┌──────────────────────────────────────┐
│ After 学校, you used に.               │
│ This sentence needs で.         2 of 3 │
└──────────────────────────────────────┘

CORRECT ANSWER
This year I will study Japanese at school.
今年は学校で日本語を勉強します。

[ My answer is correct too ]
```

- **Your answer** is new on this screen. The app does not show the typed
  answer now.
- Each mistake has a mark on the learner's sentence:
  - **missing** word or particle: an empty underlined gap where it goes;
  - **wrong** or **extra** word: the word in light red.
- **The tapped mark** is solid red with white text and an outline. The other
  marks stay light red. (The outline changes the shape, not only the color,
  so a learner who cannot see red well can find it.)
- **The explanation box** sits below the learner's sentence. It has a pointer
  that goes up to the tapped mark, and it shows "2 of 3" (this mark / all
  marks).
- **The first mark is open** when the screen appears. The learner taps another
  mark to see its explanation.
- **Mistakes with no single place** (word order, "grammar point not used")
  show as one line below the learner's sentence, always visible, with no mark.
  They do not count in "2 of 3".
- Below: the correct sentence and the English, as now. Then the "My answer is
  correct too" button, as now.
- **Screen reader:** each mark is a button. Its label is its explanation.

## Rules

- **The grade does not change.** `incorrect` stays `incorrect`. Explanations
  run only after the grade, only for `incorrect`. `correct` and
  `other_grammar` (the existing same-family nudge) do not change.
- **No guessing.** If the answer is too different from the correct sentence,
  the app shows no marks and no explanations. It shows "Your answer" with no
  marks, then the correct sentence (my call: seeing your own answer next to
  the correct one still helps).
  The agreed limit: **more than 3 marked mistakes, or less than half of the
  correct sentence's words found in the answer**. Mistakes with no single
  place do not count toward the 3.
- **All accepted answers count.** See "More than one accepted answer" above.
- **"My answer is correct too"** still works as now. Explanations do not
  change it.

## What the app already has (from recon)

- `GrammarSentenceCard` (`mobile/src/core/srs/srs.types.ts`): `japanese`,
  `furigana`, `english`, `register` (`'polite' | 'plain'`), `grammarSpan`,
  `spans` (word spans), `answers`, `otherGrammarAnswers`, `userAnswers`.
- `example_sentence_spans` in `curriculum.db`: for each word in the sentence,
  its item, its start and end offset, and its taught inflection (`masu`, `te`,
  `nai`, `ta`). Spans exist **only for the main sentence**, and only for
  linked vocabulary. The text between spans is not only particles: it also
  holds です / ます endings, grammar-point text (ようになりました) and words with
  no span (一番, あまり). So the app cannot find particles from spans alone.
- `grammar_sentence_answers`: the `valid` and `other_grammar` alternates. They
  are plain furigana strings, with no spans. The learner's saved answers are
  only normalized text.
- `items.word_type` (for example "godan verb, transitive verb") and
  `items.conjugation_class` (for example "godan", "ichidan", "adj-na").
- An on-device conjugator: `mobile/src/core/content/conjugation.ts`
  (`conjugate(word, cls)` gives every form of a verb or adjective).
- Build answer matching: `mobile/src/core/grammar/buildEvaluator.ts`
  (`normalizeBuildText`, `matchesFuriganaAnswer` — each word as kanji or as
  its reading).
- The "Incorrect" screen: `mobile/src/components/review/IncorrectReveal.tsx`
  and `GrammarBuildCard.tsx`.
- A word index over the curriculum vocabulary for the AI chat:
  `mobile/src/data/curriculum/chatWordIndex.ts`, `core/ai/chatWordSpans.ts`.
  It can maybe find which vocabulary word the learner typed where it differs
  from the correct sentence (for types 8, 10, 14).

## New curriculum data (maintainer's decision: add it in the build)

Three types of new data. None of it needs a workflow per grammar item.

1. **Word spans for the `valid` alternates.** Code change only. The build
   already derives spans for the main sentence (`_example_word_spans` →
   `spans_lib.derive_spans` in `curriculum/_build/generate.py`). Run the same
   derivation on each alternate. `npm run compile-curriculum` makes it for
   every sentence.
2. **Particle positions** for the main sentence and each alternate. Code change
   only. The build already runs a Japanese tokenizer for furigana; it also
   gives the part of speech, so the build can save where each particle is.
   This lets the app tell a particle from a word ending such as ます.
3. **Transitive / intransitive verb pairs** (開く / 開ける). No data source has
   them. In one AI session: a script finds candidate pairs (same kanji, one
   transitive and one intransitive, from `items.word_type`), wrong pairs are
   removed, and the list is saved as one fixed build file (like
   `curriculum/_build/conjugation_class_overrides.json`). The maintainer
   checks the list one time. When new verbs are added later, the script shows
   only the new candidates.

The learner's saved answers stay plain text. The app can compare with them as
text only (for example: if a saved answer matches the learner's text at a
place, no mark there).

The new tables come through the normal curriculum build and the OTA update.

## Constraints (project conventions)

- Offline. No AI, no network.
- Never write to `curriculum.db`. If the feature needs new curriculum data, it
  comes from the curriculum build, not from the app.
- Fallible operations return `Result<T, AppError>`; nothing throws across
  async boundaries.
- Styling with semantic NativeWind tokens only (the existing
  `feedback-incorrect` family); no raw hex. New colors must pass
  `npm run check-contrast`.
- `npm run lint` in `mobile/` (a11y rules) must pass.

## Decided by the maintainer

- Scope: all 14 mistake types.
- Explanations name the place of the mistake (the words around it).
- No reason "why" for now.
- Screen layout C: the learner's answer with marks, tap a mark to see its
  explanation.
- Tapped mark: solid red, white text, outline; other marks light red.
  Explanation box: pointer to the tapped mark, "N of M".
- First mark open at the start.
- Mistakes with no single place: one always-visible line, no mark.
- Too-different answers: no marks, no explanation, no guessing (limit: more
  than 3 mistakes, or less than half the words match).
- Grade does not change.
- Check all accepted answers; no mark where any accepted answer allows the
  learner's text; name all correct forms ("needs に or へ").
- Add the three types of new curriculum data in the build (two by code, one
  verb-pair list from one session that the maintainer checks).
- Screen reader reads each mark's explanation.
- Words named as the learner typed them (kana if typed in kana).

## Left to the builder

- How to line up the learner's sentence with the accepted answers (for
  example a diff that uses the word spans and particle positions as anchors,
  and the conjugator to make the wrong forms of each word to compare with).
- The table shape for the new curriculum data, and how an app with an older
  `curriculum.db` (no new tables yet) behaves: no explanations, screen as now.
- Exact explanation wording, inside the agreed style.
- The order of the marks (sentence order is the obvious choice).
- The build order of the 14 types. The maintainer's top three (particle,
  polite / plain, tense) are the most used, so they are a good first step.
