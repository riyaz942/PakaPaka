# Write example sentences for one {{LEVEL}} kanji

You are writing the example sentences a learner sees on this kanji's detail
card — real sentences showing the character at work inside words they know.
Follow the teaching voice above.

## The kanji

- Character: **{{CHAR}}**
- Meaning we teach: **{{MEANING}}**
- Readings: {{READINGS}}

## Target words — the words that carry this kanji

Each sentence must use at least one of these taught words (they are the point
of the exercise):

{{TARGET_WORDS}}

## Vocabulary you may use

Every content word in your sentences must come from this list (plus particles,
numbers, names, and everyday grammatical machinery). The learner knows nothing
else yet.

{{ALLOWED_VOCAB}}

## Grammar you may use

These are the patterns the learner has been taught by the time they meet this
kanji. Build your sentences from these plus basic particles, the copula, and
plain/polite verb and adjective endings. Do not use a pattern that is not on
this list — a later pattern is as unreadable to this learner as a later word.

**Just taught** — when a sentence needs more than a plain statement, reach for
one of these first; they are what the learner is still consolidating. Do not
force one into every sentence.

{{RECENT_GRAMMAR}}

**Taught earlier** — also fine to use:

{{EARLIER_GRAMMAR}}

## Real usage, for style only

These are real native-written sentences containing the character. Do NOT copy
or adapt them — they are here so your sentences sound like this (natural,
concrete, everyday), not like textbook filler:

{{STYLE_ANCHORS}}

## What to write

Call the `submit_example_sentences` tool exactly once with 3 example
sentences. For each: `japanese`, `english`, and `vocabulary_slugs` (the slugs
in [brackets] above for every vocabulary word the sentence uses).

- Every sentence must contain the character **{{CHAR}}** inside a target word
  (natural conjugations are fine).
- If the target words cover more than one reading of the kanji, spread the
  sentences across readings so the learner sees the character's range.
- Short, everyday, concrete — one situation per sentence, ≤ 40 characters of
  Japanese. Vary the situations across the three.
- Plain Japanese text only — no furigana, no romaji, no markdown. The build
  pipeline adds furigana with a tokenizer.
- English translations: natural English, not word-by-word glosses.
{{VALIDATOR_FEEDBACK}}
