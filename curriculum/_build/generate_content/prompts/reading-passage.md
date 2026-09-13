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

## How the sentences hold together

A graded reader is prose, not a list of example sentences. These five rules are
what makes the difference:

- **Name the subject once.** Say who it is in the first sentence, then leave it
  out of the sentences that follow until the subject changes. Japanese drops a
  subject the reader already has; restating 私 in every sentence does not.
- **Start each sentence from something already on the page.** Take a noun the
  previous sentence introduced and build the next one on it — 大学 → さくら大学
  の食堂 → 食堂の食べ物. A sentence that brings in a new topic and drops the old
  one reads as a list. そして, それから and でも open a sentence on the back of
  the one before it; use them where the link is real.
- **Open some sentences with a time or a place** instead of a subject: 毎朝,
  午後, 電車で, 公園の前に.
- **Join two clauses inside one sentence, in at least two sentences — when the
  grammar list above allows it.** The linkers are 〜から、, 〜ので、 and 〜て、.
  If none of them is in that list yet, keep every sentence to one clause; that
  is the correct shape this early, not a shortcoming.
- **Grow the noun phrases, not the verbs.** Stack の — 母の誕生日のプレゼント,
  さくら大学の英語の先生 — rather than reaching for a longer verb form.

Vary sentence length. A wall of identical 〜です sentences is what a graded
reader is trying not to be.

Do not write `grammar_slugs`, `word_count`, `vocabulary_slugs` or word spans —
the build pipeline derives all four from the body with the tokenizer.
{{VALIDATOR_FEEDBACK}}
