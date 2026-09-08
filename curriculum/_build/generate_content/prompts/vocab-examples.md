# Write example sentences for one {{LEVEL}} vocabulary word

You are writing the example sentences a learner sees on this word's detail
card — the first real Japanese they meet this word inside. Follow the teaching
voice above.

## The word

- Word: **{{FORM}}**{{KANA_LINE}}
- Meaning we teach: **{{MEANING}}**

## Vocabulary you may use

Every content word in your sentences must come from this list (plus particles,
numbers, names, and everyday grammatical machinery). The learner knows nothing
else yet.

{{ALLOWED_VOCAB}}

## Grammar you may use

These are the patterns the learner has been taught by the time they meet this
word. Build your sentences from these plus basic particles, the copula, and
plain/polite verb and adjective endings. Do not use a pattern that is not on
this list — a later pattern is as unreadable to this learner as a later word.

**Just taught** — when a sentence needs more than a plain statement, reach for
one of these first; they are what the learner is still consolidating. Do not
force one into every sentence.

{{RECENT_GRAMMAR}}

**Taught earlier** — also fine to use:

{{EARLIER_GRAMMAR}}

## Real usage, for style only

These are real native-written sentences using the word. Do NOT copy or adapt
them — they are here so your sentences sound like this (natural, concrete,
everyday), not like textbook filler:

{{STYLE_ANCHORS}}

## What to write

Call the `submit_example_sentences` tool exactly once with 3 example
sentences. For each: `japanese`, `english`, and `vocabulary_slugs` (the slugs
in [brackets] above for every vocabulary word the sentence uses, including
this word's own slug).

- Every sentence must actually use **{{FORM}}** (natural conjugations are
  fine: 食べました exemplifies 食べる).
- Short, everyday, concrete — one situation per sentence, ≤ 40 characters of
  Japanese. Vary the situations and the grammatical shape across the three.
- Show the word doing its real job: if it is a verb, use it with a natural
  object or place; if a noun, in a scene where it matters; if an adjective,
  describing something a beginner would actually describe.
- Plain Japanese text only — no furigana, no romaji, no markdown. The build
  pipeline adds furigana with a tokenizer.
- English translations: natural English, not word-by-word glosses.
{{VALIDATOR_FEEDBACK}}
