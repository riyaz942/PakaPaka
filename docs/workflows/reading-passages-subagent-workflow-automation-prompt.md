Task: Generate Reading Passages via Subagents

Generate Phase 4 reading passages using in-session subagents (model configurable
below; a strong reasoning model is recommended) — no API credentials and no
browser. This is the no-API, no-browser sibling of the Message Batches lane in
`generate_readings.py`: only the "call the model" step differs. Here each seed's
reply is produced by a fresh subagent instead of a web chat or the Batches API;
the seed plan, the allowed-vocab/grammar cutoff, the tone tag, and the mechanical
gate are identical in every lane. See
`docs/content/phase-4-reading-passage-tooling.md` for the pipeline background and
the decisions baked into it.

The unit of work here is a **seed** (a planned passage: topic, tone, length band,
question count), not a vocabulary slug. Seeds for <level> are defined in
`curriculum/_build/generate_content/reading_seeds.py` (N5 and N4 each have
their 30; neither level has been generated against them yet).
This run **auto-selects the next batch of seeds that have not yet passed the
gate** (Step 1) — you do NOT paste a seed list.

Level (one JLPT level per run; `n5` and `n4` have seeds, `n3`+ do not yet):

<level = n5>

Subagent model (which model every subagent in this run uses):

<subagent-model = opus-5>

Model notes

- The value above is used for BOTH the generation subagent (Step 2) and every
  repair subagent (Step 3). A strong reasoning model is recommended: a passage is
  a longer, more constrained piece of writing than an example sentence.
- Give it as your environment names the model. If the requested model is
  unavailable, stop and say so rather than silently substituting — then re-run
  with a model you actually have.
- Record the model actually used in the final report, and pass it as the ingest
  `--model` provenance value (Step 3) so `_meta.generator_model` is honest.

Batch size (how many seeds this run processes; used as BATCH_LIMIT in Step 1):

<batch-size = 1>

Seed count for <level> is whatever `reading_seeds.py` lists (30 at both), and a
passage is far more expensive per item than an example sentence. **Start with
`<batch-size = 1>` and read the passage before running any more** — that is the
pilot-slice rule the whole content plan uses, and tone is exactly the thing a
gate cannot check. The auto-select makes stopping and resuming across sessions
seamless: the next run picks up exactly where you left off.

---

Workflow

Process one seed at a time, each with its own fresh subagent (no shared context
between seeds — a fresh subagent per seed is the equivalent of the browser lane's
"fresh chat per item"). Everything is local files plus subagents: no browser, no
clipboard, no downloads.

Step 1: Select Seeds and Generate Prompts

Work from:

curriculum/_build

1a. Select this run's seeds automatically. Do NOT hand-pick or paste a seed list.
Pick the next <batch-size> seeds (in seed position order) that have not already
produced a gate-passing draft. Substitute this run's <batch-size> for
BATCH_LIMIT, then run:

.venv/bin/python - <<'PY'
import json, os, sys; sys.path.insert(0, '.')
from generate_content import reading_seeds
LEVEL, BATCH_LIMIT = '<level>', <batch-size>
drafts_dir = f'generate_content/drafts/readings/{LEVEL}'
done = set()
if os.path.isdir(drafts_dir):
    for name in os.listdir(drafts_dir):
        if not name.endswith('.json') or name == 'requests-preview.json':
            continue
        with open(os.path.join(drafts_dir, name), encoding='utf-8') as f:
            record = json.load(f)
        if record.get('status') == 'draft':
            done.add(name[:-5])
for problem in reading_seeds.seed_errors(LEVEL):
    print(f'SEED PROBLEM: {problem}')
todo = [s for s in reading_seeds.all_slugs(LEVEL) if s not in done][:BATCH_LIMIT]
print(f'{len(done)} seed(s) already passing; {len(todo)} selected (BATCH_LIMIT={BATCH_LIMIT}):')
print(','.join(todo))
PY

If it prints any `SEED PROBLEM:` lines, stop and report them — the seed list
itself is broken (duplicate slug, position gap, tone mix out of the 75–85% band,
a ladder cutoff that falls, a grammar point assigned to no seed or to two) and
nothing generated against it is trustworthy.

If it prints 0 seeds selected, <level> is already fully drafted — stop and report that.
Otherwise treat the printed comma list as this run's seed set: every later step
iterates over exactly these seeds, and no seed outside this list is touched.

1b. Generate the prompt files for the selected seeds in one call. `--slugs` is a
single comma-separated string with NO spaces after the commas:

.venv/bin/python -m generate_content.generate_readings webprompts --level <level> --slugs <selected,seeds,...>

Each prompt file is written to:

curriculum/_build/generate_content/web/readings/<level>/<seed>.prompt.md

Regenerating a prompt is a safe no-op — `webprompts` overwrites deterministically.
Note that the auto-select in 1a picks up seeds whose previous attempt failed the
gate, and `webprompts` **erases the appended gate errors** on those. That is fine
at the start of a run (the seed gets a clean attempt) but do not re-run
`webprompts` for a seed mid-repair in Step 3 — the repair subagent needs those
errors.

---

Step 2: Generate the Reply with a Subagent

For the current seed, launch ONE general-purpose subagent (using <subagent-model>,
high reasoning) in the foreground — ingestion must wait for it to finish. Give the
subagent the prompt file path:

curriculum/_build/generate_content/web/readings/<level>/<seed>.prompt.md

Give the subagent these instructions:

  Read `<seed>.prompt.md`. Everything BELOW the HTML comment header (the block that
  opens with `<!--` and ends with a line ending in `-->`) is your complete,
  self-contained task: a teaching-voice sheet, the passage brief, the tone
  direction, the exact vocabulary and grammar you may use, the length band, the
  question count, and the JSON output contract. The header itself is orchestration
  instructions for the caller — ignore it.

  Write the passage exactly as the prompt body asks, then write your answer to:

  curriculum/_build/generate_content/web/readings/<level>/<seed>.reply.md

  Requirements:

  - Write EXACTLY one fenced ```json code block and nothing else in the file — no
    preamble, no commentary before or after.
  - Use the exact output contract from the prompt: a single JSON object with
    `title`, `body`, `english_translation`, `summary_ja`, `summary_en` and
    `questions`, and no other keys.
  - Do NOT write `grammar_slugs`, `word_count`, `vocabulary_slugs` or word spans.
    The build pipeline derives all four from the body with a tokenizer; anything
    you write for them is discarded.
  - `body` is one continuous paragraph of plain Japanese — no line breaks, no
    furigana, no romaji, no markdown, no brackets. Ingestion annotates the body
    and every question prompt with the tokenizer and stores the result as
    `body_furigana` / `prompt_furigana`; brackets you write are rejected as
    markup, not merged.
  - Keep the passage inside the word band the prompt states. The count is
    tokenizer words (punctuation excluded), not characters, so aim mid-band.
  - Every content word in `body` **and in `summary_ja`** must come from the
    prompt's allowed vocabulary, plus any names the prompt explicitly grants. The
    level check rejects out-of-level words in both.
  - Produce exactly the number of questions the prompt asks for. Each question
    needs at least one accepted answer that appears **literally in the body**, and
    the question prompt itself is level-checked too.
  - Build the passage only out of the prompt's allowed grammar, and use every
    point the prompt lists under "Grammar this passage must use" at least once.
    Both sides are detected in your text by a tokenizer, so there is nothing to
    declare and nothing a declaration can fix.
  - Honour the tone direction. If the seed is humorous, it should actually be
    funny; if the joke and the comprehension pull apart, comprehension wins.
  - Do not set or add any review_status field.
  - Do not modify any file other than the reply file. Do not run tools to fetch
    external content.

Use a fresh subagent for each seed; never reuse a subagent's context across seeds.

---

Step 3: Ingest and Repair

Run:

.venv/bin/python -m generate_content.generate_readings ingest --level <level> --slug <seed> --model <subagent-model>

(The `--model` value is recorded in the dataset entry's `_meta.generator_model`;
pass the same `<subagent-model>` you generated with so provenance is honest.)

If ingestion succeeds:

The passage is enriched — word spans, vocabulary slugs, word count, and the
`body_furigana` / `prompt_furigana` annotations, all derived by the tokenizer —
and merged into the build artifact:

curriculum/_build/generate_content/passages/<level>.json

Every enriched passage should carry a non-empty `body_furigana` (the only
exception is a body with no kanji at all, which will not happen at these
positions). If one is missing, do not paper over it: report it, because the
reader renders a passage without readings as bare kanji and shows no error.

Record the seed as successful and proceed to the next seed.

If ingestion fails:

The ingestion process rewrites:

curriculum/_build/generate_content/web/readings/<level>/<seed>.prompt.md

with the validation errors appended, and exits non-zero.

Do not regenerate from scratch. Count the validation errors appended to the
prompt file and choose the repair method:

- **Fewer than 7 errors — inline fix.** Edit `<seed>.reply.md` yourself, in
  this session. A small fix does not need a subagent.
- **7 or more errors — repair subagent.** Launch a FRESH general-purpose
  subagent (<subagent-model>, high reasoning, foreground) to repair the
  existing reply.

Whichever method repairs the reply, it works from these files:

- curriculum/_build/generate_content/web/readings/<level>/<seed>.prompt.md
- curriculum/_build/generate_content/web/readings/<level>/<seed>.reply.md

The repair instructions are the same for both methods (an inline fix follows
them exactly as a repair subagent would):

  Read the validation errors appended to `<seed>.prompt.md`. Inspect the existing
  `<seed>.reply.md` and the output contract in the prompt. Edit `<seed>.reply.md`
  to resolve every reported error.

  - Make the smallest changes necessary; preserve what already works. An
    out-of-level word is usually a local substitution, not a rewrite.
  - Fix all reported errors, not only the first.
  - Watch for knock-on effects: replacing a sentence can push the word count out
    of band, and deleting text can strand a question whose accepted answer no
    longer appears in the body.
  - Edit only `<seed>.reply.md`; do not edit `<seed>.prompt.md`.
  - Do not modify validators, ingestion code, the seed list, the allowed-vocab or
    allowed-grammar derivation, curriculum source data, or the assembled dataset.
  - Preserve the reply-file format (a single fenced ```json block) and the exact
    output contract (the seven keys, nothing else, no derived fields).
  - Keep `body` a single plain paragraph that the tokenizer can annotate; avoid
    constructions that fail the furigana round-trip.
  - Keep the tone the prompt asked for — a repair should not flatten a humorous
    passage into a neutral one.
  - Ensure valid JSON. Add no commentary outside the JSON block. Do not set
    review_status.

Then run ingestion again:

.venv/bin/python -m generate_content.generate_readings ingest --level <level> --slug <seed> --model <subagent-model>

Retry Limit

Allow at most three ingestion attempts per seed, including the initial attempt:

- Attempt 1: original generation subagent (Step 2)
- Attempt 2: first repair — an inline fix if the failure reported fewer than 7
  errors, otherwise a repair subagent
- Attempt 3: second repair — same rule

Use a fresh subagent for each repair that needs one. If the third ingestion
attempt fails, the repair retry threshold is reached: make ONE last-resort
inline fix — edit the reply file yourself, no subagent, whatever the error
count — and run ingestion a fourth and final time.

If the fourth ingestion attempt fails:

- Stop retrying the seed.
- Record it as failed or skipped (the draft record keeps the errors; the seed is
  simply absent from the dataset).
- Preserve the latest validation errors for the final report.
- Proceed to the next seed.

A seed can legitimately be unwritable at its position — the topic may need a word
the cutoff has not reached yet. If a seed keeps failing on the same missing
word, say so in the report and name the word: the fix is a seed edit (move the
seed later, or reframe the topic), not another attempt.

---

Ordering Note

Seeds are ordered by position and the allowed vocabulary grows with position, so
generate them in the order Step 1a prints. Finish <level> fully before moving to the next level.
Only run a level that has seeds in `reading_seeds.py` (N5's 30 and N4's 30 are
authored; N3+ have none).

---

Step 4: Naturalness Review (every run ends with this)

Steps 1–3 enforce mechanics only — level, length, answerability, span integrity,
furigana. They cannot tell whether the Japanese reads like Japanese, and every
naturalness defect found in this project so far passed them cleanly
(`宿題を書きました`, `「…」と話しました`, `箱が待っています`). Step 4 is the pass
that reads the Japanese. **It is part of this run, not a separate one.**

Run it once, after the seed loop finishes — not per seed. A passage that failed
or was skipped in Step 3 is not reviewed and needs no handling here: the review
lane selects gate-passing drafts only, so a failed seed is invisible to it.

Step 4a — write the review prompts, scoped to what this run produced:

.venv/bin/python -m generate_content.naturalness_check webprompts --level <level> --slugs <the seeds ingested in this run, comma-separated, no spaces>

Pass `--slugs` explicitly. Without it the command picks up **every** unreviewed
draft at the level, which turns a 4-seed generation run into a whole-level
review. Backfilling the rest of a level is a legitimate job, but it is the
standalone runbook's job, not a side effect of generating four passages.

Step 4b — one fresh subagent per passage.

Launch ONE new general-purpose subagent (<subagent-model>, high reasoning) for
each passage. Two rules, and both are load-bearing:

- **Never the subagent that wrote the passage.** A writer asked to review its own
  work clears its own choices. This is the whole reason the review is a separate
  model call at all.
- **Never one subagent across two passages.** A reviewer that has seen three
  passages starts pattern-matching its own earlier findings.

For the instructions to give each reviewer, use the brief in § *Step 2: Review
with a Subagent* of:

docs/workflows/reading-passage-naturalness-subagent-workflow-automation-prompt.md

Do not paraphrase it from memory — read it and pass it as written, plus this
line, which the word band makes necessary:

  A correction replaces a sentence; it can never add one, and the corrected
  passage must stay inside the seed's word band. If your replacement is longer
  than the sentence it replaces, buy the words back within that sentence. A
  passage already at the top of its band has no room.

Step 4c — ingest each reply:

.venv/bin/python -m generate_content.naturalness_check ingest --level <level> --slug <seed> --model <subagent-model>

Three outcomes: **natural** (nothing flagged, body untouched), **corrected**
(the rewrite passed the whole gate again), **rejected** (findings came back but
the corrected passage failed the gate — the body is left exactly as it was,
nothing partial is merged, the gate errors are appended to the prompt file, the
rejected reply is deleted, and the command exits non-zero).

On a rejection, launch a FRESH subagent against the same prompt file, which now
carries the gate errors, and ingest again. **At most two review attempts per
passage.** If the second is also rejected, leave the passage as it is and report
the gate errors — twice-failed means the window has no way to say the thing, and
that is a seed or curriculum change, not another attempt.

Wait for each review subagent to **finish**. Do not poll for the reply file to
appear: a rejected reply is deleted precisely so a repair round cannot re-ingest
it, and a caller that waits on the file rather than the subagent will read the
same failure twice and call it two attempts.

What Step 4 must not do

- Do NOT bump `generate_readings.PROMPT_VERSION` and do NOT regenerate a passage
  because a finding came back. Step 4 corrects the passage in front of it.
- Do NOT edit `prompts/reading-passage.md` during the run. A finding is about one
  passage; a *pattern* across findings is about the generation prompt. Report the
  pattern and let the maintainer decide — and check the `prompt_version` stamps
  first, because a defect the current prompt already forbids is not a pattern,
  it is an older passage.
- Do NOT set `review_status`. A `natural` verdict is one model's opinion, not the
  Phase 5 human read.

---

There Is No Final Build Step

Unlike the example-sentence and mnemonic lanes, **this workflow does not touch
shipped curriculum**, and you must not add a build step that does:

- Do NOT run `generate.py`, `npm run validate-schema`, or `npm run compile-curriculum`
  as part of this run. Nothing this workflow writes is an input to them.
- Do NOT write to or edit `curriculum/readings/<level>.json`, and do NOT edit
  `curriculum/_build/<level>_readings.py`. The shipped passages at both levels
  are being retired and the generated set replaces them — that decision is
  already made, and it is *not* what holds the wire-in back. What holds it back is the
  Phase 5 human read, which has not happened for anything this workflow
  produces. Passages ship as a reviewed level, never a seed at a time. The
  procedure is in `docs/content/phase-4-reading-passage-tooling.md` § "The step
  that is deliberately not automated".

The run ends at `curriculum/_build/generate_content/passages/<level>.json`. That file
is a build artifact for a human to read.

---

What Runs After This

Nothing. The naturalness review used to be a separate run; it is Step 4 of this
one, so a passage generated here leaves the run having been read for naturalness
as well as gated for mechanics.

The standalone runbook still exists and is still the right tool for the other
job — reviewing passages this run did not generate:

docs/workflows/reading-passage-naturalness-subagent-workflow-automation-prompt.md

Use it to backfill a level whose passages predate the review lane, or to
re-review a level after `REVIEW_VERSION` changes. Do not use it to re-review what
Step 4 just reviewed.

---

Final Report

Provide a summary containing:

- <level>, <batch-size>, and the exact auto-selected seed set for this run (with the count vs. <batch-size>)
- The model actually used for generation and repair
- ✅ Successfully ingested seeds, each with its tone tag and derived word count
- Any ingested passage missing `body_furigana`, or any question missing
  `prompt_furigana` where the prompt contains kanji
- ⚠️ Skipped seeds
- ❌ Failed seeds
- The number of repair attempts used for each affected seed, split into inline
  fixes and subagent repairs
- Validation errors remaining after the final allowed attempt, and for any seed
  that failed on a missing word, the word itself
- How many seeds for <level> remain not-yet-passing (re-run Step 1a to get the
  count), so it's clear whether another run is needed
- **Step 4, per passage:** the naturalness verdict (natural / corrected /
  rejected), and for each correction the original sentence, the issue and the
  replacement. Name any passage rejected twice with the gate errors that blocked
  it, and any pattern across findings worth promoting into the generation prompt
  — as a recommendation, not a change you made
- A reminder that the output is a build artifact, and that it ships only after
  a human reads the whole level (Phase 5) and performs the documented wire-in
- Any manual follow-up required

Do not modify or set review_status to reviewed.

That is a manual human-review step (Phase 5) that automation must not perform.
For passages it matters more than anywhere else in the pipeline: the gate can
check level, length, answerability and span integrity, but it cannot check
whether the passage is coherent, whether a humorous one is funny, or whether the
grammar the model *used* matches the grammar it *declared*.

---

Important Constraints

- Each seed's reply is produced by a fresh <subagent-model> subagent; never share
  subagent context across seeds.
- Each seed's Step 4 review is produced by a *different* fresh subagent again —
  never the one that wrote the passage, and never one shared across passages.
- Do not bypass or weaken validation. This includes Step 4: a naturalness
  correction that fails `validate_draft` is rejected whole, and you must not
  hand-merge the part of it that passed.
- Do not modify validator or ingestion code, the seed list, the allowed-vocab
  derivation, or curriculum source data to make invalid content pass.
- Do not widen a seed's `vocab_cutoff`, `pull_forward`, `grammar_cutoff` or
  `pull_forward_grammar` to unblock it. That ladder is authored ahead of
  generation on purpose; a window the writer may move makes the level gate
  vacuous.
- Do not manually mark generated passages as reviewed.
- Do not write shipped curriculum files.
- No browser, no clipboard, no downloads — this lane is entirely local files plus
  subagents.

---

Notes on differences from the API (Message Batches) lane

- The model is called via an in-session subagent (Step 2), not the Batches API, so
  there are no credentials, no batch polling, and no `run` / `collect` commands.
  The generation subagent writes the reply file directly and `ingest` takes over.
- Everything else is identical: the same seeds and prompt, the same gate, the
  same repair rules (inline fix under 7 errors, 3-attempt cap plus one
  last-resort inline fix) with errors fed back into the prompt, the same draft
  records under `drafts/readings/<level>/`, the same assembled dataset, and the
  same `review_status: draft` discipline.
