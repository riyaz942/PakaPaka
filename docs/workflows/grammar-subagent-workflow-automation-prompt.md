Task: Generate Grammar Lessons via Subagents

Generate grammar lessons using in-session subagents (model configurable below; a
strong reasoning model is recommended) — no API credentials and no browser. This
is the no-API, no-browser sibling of the Gemini automation prompt: only the "call
the model" step differs. Here each point's reply is produced by a fresh subagent
instead of a web chat or the Message Batches API; the context builder (allowed
vocabulary, taught siblings, upcoming teases, style anchors) and the mechanical
gate (`validate_drafts.py`) are identical to every other lane. See
`docs/workflows/grammar-web-chat-workflow.md` for the shared pipeline background.

This run **auto-selects the next batch of not-yet-written slugs** (Step 1) — you
do NOT paste a slug list, and you never invent a slug. Slugs are existing
grammar-point ids from the curriculum catalog.

Level (one JLPT level per run; change to `n3`, … when ready — N5 is already
fully written):

<level = n4>

Subagent model (which model every subagent in this run uses):

<subagent-model = sonnet-5>

Subagent effort (reasoning effort every subagent in this run uses):

<subagent-effort = high>

Model and effort notes

- Both values above are used for BOTH the generation subagent (Step 2) and every
  repair subagent (Step 3). Pass them explicitly when launching each subagent —
  do not silently drop to a lower effort.
- A strong reasoning model at **high** effort is recommended. A grammar lesson is
  1,200–2,200 words of teaching prose plus a matched example set and cloze
  candidates — the longest single artifact any lane in this repo produces, and
  the most expensive to review by hand. Do not use `low`. (The *orchestrator*
  running this prompt may itself be on a cheaper model — only the subagents write
  the lesson.)
- Give the model as your environment names it. If the requested model or effort
  is unavailable, stop and say so rather than silently substituting — then re-run
  with a combination you actually have.
- Record the model and effort actually used in the final report, and pass the
  model as the ingest `--model` provenance value (Step 3) so the lesson's
  `generator_model` frontmatter is honest.

Batch size (how many slugs this run processes; used as BATCH_LIMIT in Step 1):

<batch-size = 5>

This run processes up to <batch-size> slugs. Keep it low. Lessons are long, so a
batch costs far more usage per slug than the mnemonic or example lanes, and every
lesson also owes a human read afterwards (Phase 5) — generating 40 lessons you
will not read for a month is not progress. 6–10 is a practical sitting. The
auto-select makes stopping and resuming across sessions seamless: the next run
picks up exactly where you left off.

---

Workflow

Process one slug at a time, each with its own fresh subagent (no shared context
between slugs — a fresh subagent per slug is the equivalent of the browser lane's
"fresh chat per slug"). There is no grouping in this lane: one lesson is already a
full subagent's worth of work, and lessons share no cast or scene continuity that
grouping would protect. Everything is local files plus subagents: no browser, no
clipboard, no downloads.

Step 1: Select Slugs and Generate Prompts

Work from:

curriculum/_build

1a. Select this run's slugs automatically. Do NOT hand-pick or paste a slug list.
Pick the next <batch-size> unwritten points in curriculum order (the catalog is
already sorted by `sort_order`, so contrast sections reference points you have
already written). Substitute this run's <level> and <batch-size>, then run:

.venv/bin/python - <<'PY'
import os, sys; sys.path.insert(0, '.')
from generate_content import context
LEVEL, BATCH_LIMIT = '<level>', <batch-size>
done = {f[:-3] for f in os.listdir(f'../grammar/lessons/{LEVEL}')} if os.path.isdir(f'../grammar/lessons/{LEVEL}') else set()
todo = [g['slug'] for g in context.load_grammar(LEVEL) if g['slug'] not in done]
print(f'{len(todo)} {LEVEL} point(s) left; selecting {min(len(todo), BATCH_LIMIT)} (BATCH_LIMIT={BATCH_LIMIT}):')
print(','.join(todo[:BATCH_LIMIT]))
PY

"Done" here means an assembled lesson file exists at
`curriculum/grammar/lessons/<level>/<slug>.md`. That is the committed artifact;
draft records under `generate_content/drafts/<level>/` are working state and are
deliberately not consulted. Consequence: a slug that burned its three attempts in
an earlier run **will** be selected again and gets a fresh generation. That is
intended — a fresh write usually clears what repair could not.

If it prints 0 slugs, this level is already fully written — stop and report that.
Otherwise treat the printed comma list as this run's slug set: every later step
iterates over exactly these slugs, and no slug outside this list is touched.

1b. Generate the prompt files for the selected slugs in one call. `--slugs` is a
single comma-separated string with NO spaces after the commas:

.venv/bin/python -m generate_content.generate_grammar_lessons webprompts --level <level> --slugs <selected,slugs,...>

Each prompt file is written to:

curriculum/_build/generate_content/web/<level>/<slug>.prompt.md

Regenerating a prompt is a safe no-op — `webprompts` overwrites deterministically
from the curriculum.

---

Step 2: Generate the Reply with a Subagent

For the current slug, launch ONE general-purpose subagent (using
<subagent-model> at <subagent-effort>) in the foreground — ingestion must wait for
it to finish. Give the subagent the prompt file path:

curriculum/_build/generate_content/web/<level>/<slug>.prompt.md

Give the subagent these instructions:

  Read `<slug>.prompt.md`. Everything BELOW the HTML comment header (the block
  that opens with `<!--` and ends with a line ending in `-->`) is your complete,
  self-contained task: the teaching-voice sheet, the grammar point and its
  conjugation rules, the grammar already taught and the upcoming points, the exact
  vocabulary you may use, real-usage style anchors, the formatting rules, and the
  JSON output contract. The header itself is orchestration instructions for the
  caller — ignore it.

  Write the lesson exactly as the prompt body asks, then write your answer to:

  curriculum/_build/generate_content/web/<level>/<slug>.reply.md

  Requirements:

  - Write EXACTLY one fenced ```json code block and nothing else in the file — no
    preamble, no commentary before or after. The lesson's ```jp fences live
    *inside* the `lesson_markdown` JSON string; they do not close the outer block.
  - The file must parse as JSON: `lesson_markdown` is one string with escaped
    newlines, not a multi-line literal.
  - Use the exact output contract from the prompt — the five top-level keys
    `lesson_markdown`, `example_sentences`, `caution_notes`,
    `related_grammar_slugs`, `cloze_variants`, and no others.
  - `example_sentences` must reproduce every ```jp fence line in the lesson, in
    order, one entry per fence line, each with `japanese`, `english`, and
    `vocabulary_slugs`. The gate compares the two lists literally: any fence line
    missing from the array, out of order, or differing by a character fails.
  - Aim for 6–10 fence lines across the lesson. At least three of them must
    contain an accepted surface form of the pattern itself. A line that carries
    neither the pattern, a taught sibling pattern, nor a conjugation arrow (→)
    fails unless it directly neighbours a line that does.
  - Every `vocabulary_slugs` entry must come from the prompt's allowed-vocabulary
    list; never invent slugs.
  - Every content word in every Japanese sentence — fenced lines AND Japanese
    embedded in prose — must be in the prompt's allowed vocabulary. Particles, the
    pattern being taught, taught sibling patterns, numbers and names are fine. If
    a scenario needs a word that is not allowed, change the scenario.
  - `caution_notes`: 1–4 one-sentence warnings.
  - `related_grammar_slugs`: only slugs from the taught-siblings and
    upcoming-related lists in the prompt; never the point's own slug.
  - `cloze_variants`: 4–6 entries. `jp_cloze` blanks the pattern with ＿＿＿
    (U+FF3F ×3); `answer` is the removed text; `nudge` is one line written about
    that specific sentence, must differ from every other variant's nudge, and must
    never contain the answer, any accepted form, or the wording of the pattern's
    meaning gloss.
  - Markdown subset only: `#`–`###` headings, paragraphs, `-`/`1.` lists, `>`
    callouts, ```jp fences, inline bold/italic/code. No tables, links, images,
    HTML, or nested lists — the app renderer rejects them. No top-level `#` title.
  - Deliberately incorrect forms you are warning against go in inline `code` in
    prose — never in a fence and never in `example_sentences`.
  - Write all Japanese as plain text — no furigana brackets, no romaji. The build
    pipeline adds furigana with a tokenizer.
  - The style anchors are reference only — never copy, translate, or paraphrase
    one into the lesson.
  - Do not set or add any review_status field.
  - Do not modify any file other than the reply file. Do not run tools to fetch
    external content.

Use a fresh subagent for each slug; never reuse a subagent's context across slugs.

---

Step 3: Ingest and Repair

Run:

.venv/bin/python -m generate_content.generate_grammar_lessons ingest --level <level> --slug <slug> --model <subagent-model>

(The `--model` value is recorded in the assembled lesson's `generator_model`
frontmatter; pass the same <subagent-model> you generated with so provenance is
honest.)

If ingestion succeeds:

The lesson is assembled at

curriculum/grammar/lessons/<level>/<slug>.md

with `review_status: draft`, and its cloze candidates are stashed at

curriculum/_build/generate_content/drafts/<level>/<slug>-cloze-candidates.json

Promoting cloze candidates onto the grammar item is separate editorial work and
is NOT part of this run. Record the slug as successful and proceed to the next.

If ingestion fails:

Nothing is assembled, and the ingestion process rewrites:

curriculum/_build/generate_content/web/<level>/<slug>.prompt.md

with the validation errors appended (an "earlier draft failed mechanical
validation" section).

Do not regenerate from scratch. Instead, launch a FRESH general-purpose subagent
(<subagent-model> at <subagent-effort>, foreground) to repair the existing reply.

Give the repair subagent these files:

- curriculum/_build/generate_content/web/<level>/<slug>.prompt.md
- curriculum/_build/generate_content/web/<level>/<slug>.reply.md

Give the repair subagent these instructions:

  Read the validation errors appended to `<slug>.prompt.md`. Inspect the existing
  `<slug>.reply.md` and the output contract in the prompt. Edit `<slug>.reply.md`
  to resolve every reported error.

  - Make the smallest changes necessary; preserve valid lesson content.
  - Do not rewrite the whole lesson unless the errors make that unavoidable.
  - Fix all reported errors, not only the first.
  - Edit only `<slug>.reply.md`; do not edit `<slug>.prompt.md`.
  - Do not modify validators, ingestion code, curriculum source data, the
    allowed-vocab derivation, or any assembled lesson.
  - Preserve the reply-file format (a single fenced ```json block) and the exact
    five-key output contract. The result must parse as JSON.
  - Keep `lesson_markdown` and `example_sentences` consistent: the ```jp fence
    lines and the array must still match one-to-one and in order after your edit.
    If you change a sentence in one place, change it in the other.
  - Keep at least three fence lines using an accepted form of the pattern.
  - Every `vocabulary_slugs` entry must be in the prompt's allowed list; every
    content word, in fences and in prose, must be in-level. An out-of-level word
    is fixed by rewording the sentence, not by dropping the slug.
  - Keep every Japanese sentence fully annotatable by the tokenizer (avoid
    constructions that fail the furigana round-trip).
  - Keep `caution_notes` at 1–4, `cloze_variants` at 4–6 with a ＿＿＿ blank and a
    distinct, answer-free nudge in each, and `related_grammar_slugs` drawn only
    from the siblings listed in the prompt.
  - Keep the markdown inside the supported subset (no tables, links, images,
    HTML, nested lists) and add no commentary outside the JSON block. Do not set
    review_status.

Then run ingestion again:

.venv/bin/python -m generate_content.generate_grammar_lessons ingest --level <level> --slug <slug> --model <subagent-model>

Retry Limit

Allow at most three ingestion attempts per slug, including the initial attempt:

- Attempt 1: original generation subagent (Step 2)
- Attempt 2: first repair subagent
- Attempt 3: second repair subagent

Use a fresh subagent for each attempt. If the third ingestion attempt fails:

- Stop retrying the slug.
- Record it as failed or skipped.
- Preserve the latest validation errors for the final report.
- Proceed to the next slug.

A slug that fights the gate is not worth a fourth try in the same session — it
returns to the auto-select pool and gets a clean generation on a later run.

---

Ordering Note

Each run covers only its auto-selected <batch-size> slugs, so finishing a level
takes several runs. Work levels in order and finish <level> fully before moving to
the next — N4 lessons are allowed to use all N5 vocabulary, so N5 should be
settled first. On the first run at a fresh level, read the assembled lessons
before launching more runs; the batch size is already pilot-sized, so one run
doubles as the pilot.

---

Final Build

After every selected slug has been successfully ingested or skipped, run the
project's normal generation pipeline from the repository root.

Check the current invocation under:

curriculum/_build/generate_content/

Then run:

generate.py --level <level>

Followed by:

npm run validate-schema

And:

npm run compile-curriculum

`generate.py` inlines the assembled lesson markdown into the shipped grammar JSON
and adds furigana with the tokenizer. Grammar is unbanded, so `--level` alone is
sufficient. Use the current project-specific `generate.py` invocation and flags
found under `curriculum/_build/`. Do not guess if the documented invocation has
changed.

---

Final Report

Provide a summary containing:

- <level>, <batch-size>, and the exact auto-selected slug set for this run (with
  the count vs. <batch-size>)
- The model and effort actually used for generation and repair
- ✅ Successfully generated slugs
- ⚠️ Skipped slugs
- ❌ Failed slugs
- The number of subagent repair attempts used for each affected slug
- Validation or ingestion issues encountered
- Validation errors remaining after the final allowed attempt
- How many points of the level remain unwritten (re-run Step 1a to get the
  count), so it is clear whether another run is needed
- Final build, schema-validation, and compilation results
- Any manual follow-up required

Do not modify or set `review_status` to `reviewed`.

That is a manual human-review step (Phase 5) that automation must not perform.
Every lesson must be read in the app's lesson renderer first — the gate proves a
lesson is in-constraints, never that it teaches well.

---

Important Constraints

- Each slug's lesson is produced by a fresh <subagent-model> subagent; never share
  subagent context across slugs.
- Do not bypass or weaken validation.
- Do not modify validator or ingestion code, the allowed-vocab derivation, the
  prompt templates under `generate_content/prompts/`, or curriculum source data to
  make invalid content pass.
- Style anchors shown in a prompt are reference only — never copy or adapt them
  into a lesson.
- Do not promote cloze candidates onto grammar items; that is separate editorial
  work.
- Do not manually mark generated lessons as reviewed.
- No browser, no clipboard, no downloads — this lane is entirely local files plus
  subagents.

---

Notes on differences from the Gemini web-chat automation prompt

- The model is called via an in-session subagent (Step 2), not a browser chat, so
  there are no browser-setup, paste-integrity, completion-polling, or
  download/rename steps. The generation subagent writes the reply file directly.
- Slugs are auto-selected with a batch limit (Step 1a) instead of being pasted or
  listed by hand.
- Everything else is identical: the same `webprompts`/`ingest` commands and gate,
  the same 3-attempt repair cap, the same assembled lesson path, and the same
  draft/`review_status` discipline.
