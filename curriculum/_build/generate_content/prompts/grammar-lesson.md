# Grammar lesson generation prompt — prompt_version 2

<!--
Template consumed by generate_grammar_lessons.py. {{PLACEHOLDER}} tokens are
substituted per grammar point. The persona sheet (persona.md) is prepended as
the system prompt. Bump the version header AND the PROMPT_VERSION constant in
generate_grammar_lessons.py together whenever this file or persona.md changes.
-->

You are writing one complete, self-contained grammar lesson for a Japanese
learning app, in the teaching voice defined in your system prompt. The learner
is an adult self-learner at {{LEVEL}} working through a fixed curriculum;
you know exactly what they have and have not learned yet.

## The grammar point

- Pattern: {{PRIMARY_FORM}} — {{MEANING}}
- Structure: {{STRUCTURE}}
- Conjugation rules (JSON): {{CONJUGATION_RULES}}
- Accepted surface forms: {{ACCEPTED_FORMS}}

## What the learner already knows

**Grammar already taught** (use these for the contrast section; do not contrast
against anything not listed):
{{TAUGHT_SIBLINGS}}

**Upcoming related grammar** (for at most one short forward tease; do not teach
these):
{{UPCOMING_RELATED}}

**Allowed vocabulary** — every content word in every Japanese sentence you write
(fenced examples AND Japanese embedded in prose) must come from this list.
Particles, the pattern being taught, taught sibling patterns, numbers, names of
people, and bare grammatical machinery are also fine. If a scenario needs a word
not on the list, change the scenario.
{{ALLOWED_VOCAB}}

## Style anchors (real usage — reference only)

The following native-written sentences show the pattern in real use. They are
**style anchors only**: absorb the register and shape, then write entirely
original sentences. Do not copy, translate, or lightly paraphrase any of them.
{{STYLE_ANCHORS}}

## What a finished lesson contains

Aim for 1,200–2,200 words of English prose (Japanese excluded from the count),
structured roughly as:

1. **A hook scenario** (no heading needed): a concrete situation where the
   learner needs this pattern, then the pattern shown solving it.
2. **How it works** (`##` heading): the mechanics — what attaches to what, with
   short fenced examples after each point. Cover every conjugation rule given
   above.
3. **Rules and exceptions** (`##`): the sharp edges — where the pattern cannot
   be used, common wrong guesses, politeness constraints. Use `>` callouts for
   the genuinely surprising ones.
4. **Casual speech** (`##`, only if the pattern actually contracts or changes
   in casual Japanese): show the casual form next to the neutral one.
5. **Contrast** (`##`): the new pattern against its closest taught sibling(s) —
   minimal pairs where swapping one for the other changes the meaning.
6. **A closing thought**: one-line recap and, if natural, one forward tease
   toward an upcoming related point.

Include 6–10 fenced example sentences total across the lesson, each framed by
the surrounding prose as part of a scenario (never a bare drill list). Every
fence is followed by its *italic* English translation paragraph.

## Hard formatting rules

- Markdown subset only: `#`–`###` headings, paragraphs, `-`/`1.` lists, `>`
  callouts, ` ```jp ` fences, inline `**bold**` / `*italic*` / `` `code` ``.
  No tables, links, images, HTML, or nested lists.
- ` ```jp ` fences contain Japanese only, **exactly one sentence per line**.
  English translations go in the *italic* paragraph immediately after the
  fence. A conjugation display like 食べる → 食べて may also be a fence line.
- **Vocabulary discipline applies to every Japanese word you write anywhere**
  — fences, prose snippets, contrast asides. If a word is not in the allowed
  list (and is not grammatical machinery), do not use it at all.
- Deliberately **incorrect** forms (a wrong conjugation you are warning
  against) go in inline `` `code` `` in prose — never inside a fence and never
  in `example_sentences`.
- Write all Japanese **plain** — no furigana brackets, no romaji glosses. The
  build pipeline adds furigana mechanically.
- Do not include a top-level `#` title; the app renders the lesson under the
  grammar point's own header.

## Output contract

Call the `submit_grammar_lesson` tool exactly once with:

- `lesson_markdown` — the full lesson.
- `example_sentences` — every fenced Japanese line from the lesson, in order,
  **one array entry per fence line** (never join two lines with a newline in
  one entry), each with its English translation and the `vocabulary_slugs`
  (from the allowed list) for the content words it uses.
- Contrast lines showing a taught sibling pattern are welcome, but **most
  fence lines must use {{PRIMARY_FORM}} itself** (at least 3).
- `caution_notes` — 1–4 one-sentence warnings distilled from your rules and
  exceptions section (the app shows these on the item's review card).
- `related_grammar_slugs` — the slugs of the taught siblings you actually
  contrasted against, plus any upcoming point you teased (choose only from the
  slugs listed above).
- `cloze_variants` — 4–6 candidate fill-in-the-blank drills for this pattern:
  `jp_cloze` uses ＿＿＿ (U+FF3F ×3) in place of the pattern, `answer` is the
  removed text, `english` is the sentence translation. Reuse sentences from
  `example_sentences` where possible; the same vocabulary constraints apply.
  `nudge` is the learner's first hint, shown before the English one, and it
  must be written **about that specific sentence** — a question or an
  observation about what the words in it are doing ("Is 私 doing anything here,
  or is it what the sentence talks about?"), never a definition of the pattern
  ("Marks the topic — what the sentence is about", which for a one-particle
  blank simply *is* the answer). Rules: a different nudge per variant; never
  contains the answer, any accepted form, or the wording of the pattern's
  meaning gloss / textbook name; one line.

{{VALIDATOR_FEEDBACK}}
