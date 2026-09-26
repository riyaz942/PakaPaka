# Write example sentences for one {{LEVEL}} vocabulary word

You are writing the example sentences a learner sees on this word's detail
card — the first real Japanese they meet this word inside. Follow the teaching
voice above.

## The word

- Word: **{{FORM}}**{{KANA_LINE}}
- Meaning we teach: **{{MEANING}}**

## Vocabulary you may use

Every content word in your sentences must come from the two lists below (plus
particles, numbers, names, and everyday grammatical machinery).

**Already known** — the learner has met these by the time they meet this
word. Build your sentences from these first, so the example feels familiar.

{{ALLOWED_VOCAB}}

**Later in this level** — the learner has not met these yet, but they are the
same level. Use one only when the sentence would be stiff or unnatural
without it, and keep it to one such word per sentence at most.

{{LATER_VOCAB}}

## Grammar you may use

Build your sentences from the patterns below plus basic particles, the
copula, and plain/polite verb and adjective endings. Do not use a pattern that
is on none of these lists — a higher-level pattern is as unreadable to this
learner as a higher-level word.

**Just taught** — when a sentence needs more than a plain statement, reach for
one of these first; they are what the learner is still consolidating. Do not
force one into every sentence.

{{RECENT_GRAMMAR}}

**Taught earlier** — also fine to use:

{{EARLIER_GRAMMAR}}

**Later in this level** — not taught yet; use one only when the sentence needs
it, and prefer the lists above:

{{LATER_GRAMMAR}}

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
