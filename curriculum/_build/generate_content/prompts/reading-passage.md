# Write one {{LEVEL}} reading passage

You are writing a graded reader passage — a short, self-contained piece of
Japanese a learner reads end to end, with comprehension questions under it.
Follow the teaching voice above.

This passage is number {{POSITION}} of {{SEED_COUNT}} in the level, so the
learner has met exactly the vocabulary and grammar listed below and nothing
else.

## What this passage is about

{{TOPIC}}

{{TONE_DIRECTION}}

## Vocabulary you may use

Every content word in the passage — and in your questions — must come from this
list, plus particles, numbers, and everyday grammatical machinery. The learner
knows nothing else yet. If the scenario needs a word that is not here, change
the scenario, not the vocabulary.

{{ALLOWED_VOCAB}}

{{EXTRA_ALLOWED_BLOCK}}

## Grammar you may use

These are the patterns the learner has been taught by this point. Build the
passage out of these; anything later is off limits, even if it would read more
naturally.

{{ALLOWED_GRAMMAR}}

{{REQUIRED_GRAMMAR_BLOCK}}

## What to write

{{TOOL_LINE}}:

- `title` — a short Japanese title, 2–20 characters. No punctuation.
- `body` — the passage itself, **{{WORD_LO}}–{{WORD_HI}} words** (counted by the
  tokenizer, punctuation excluded), written as a **single line**: sentences end
  with 。 and run on in one paragraph, with no line breaks.
- `english_translation` — natural English for the whole passage, one sentence
  per Japanese sentence, same order.
- `summary_ja` — one short Japanese sentence saying what happens (8–60
  characters), within the same vocabulary.
- `summary_en` — the same in one English sentence.
- `questions` — exactly {{QUESTION_COUNT}} comprehension questions. Each has a
  `prompt` (Japanese, 4–40 characters, ending in か。) and `accepted_answers`.

Rules the automated gate enforces, so getting them wrong costs a regeneration:

- **Answers must be readable off the page.** For every question, at least one
  entry in `accepted_answers` must appear in the body **exactly as written
  there**. Give the natural variants too — the kanji form, the kana form, the
  form with its particle — but include the literal one.
- Ask about facts the passage states: who, what, where, when, how many. Never
  ask for an opinion or for something the learner has to infer.
- **Plain Japanese only** — no furigana, no romaji, no markdown, no HTML. The
  build pipeline adds furigana with a tokenizer, and any bracket you write is a
  rejection.
- Keep one situation running through the whole passage. A passage that is five
  unrelated sentences is not a reading; it is an example-sentence list.
- Vary sentence length. A wall of identical 〜です sentences is what a graded
  reader is trying not to be.

Do not write `grammar_slugs`, `word_count`, `vocabulary_slugs` or word spans —
the build pipeline derives all four from the body with the tokenizer.
{{VALIDATOR_FEEDBACK}}
