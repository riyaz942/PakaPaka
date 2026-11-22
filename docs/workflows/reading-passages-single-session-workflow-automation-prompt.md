Task: Generate Reading Passages — Single Session, This Session Writes

Generate Phase 4 reading passages **entirely within the current session** — no
browser, no clipboard, no API credentials. This session writes every passage
itself and spawns no subagent to do it.

There is exactly one exception, and it is at the end: the naturalness review
(Step 5) spawns one fresh subagent per passage. It has to. That review's whole
value is that it comes from a model which did not write the passage, and in this
lane the writer is this session — so this session is the one model that cannot
perform it. Drafting stays here; reviewing cannot. This is the
single-session sibling of
`docs/workflows/reading-passages-subagent-workflow-automation-prompt.md`: same
seed plan, same auto-select, same allowed-vocab/grammar cutoff, same tone tag,
same mechanical gate, same per-seed repair budget — the only difference is who
writes the passage. There, a fresh subagent drafts each seed. Here, THIS session
drafts them directly, then the session ends; you get the next seeds by running
this same prompt again in a brand-new session. Use this shape when you want each
unit of work isolated in its own session (cost/context isolation) rather than
orchestrated by a long-running coordinator that spawns subagents. See
`docs/content/phase-4-reading-passage-tooling.md` for the pipeline background and
the decisions baked into it.

The unit of work here is a **seed** (a planned passage: topic, tone, length band,
question count), not a vocabulary slug. Seeds for <level> are defined in
`curriculum/_build/generate_content/reading_seeds.py`. A level with no seeds stops
at Step 1 ("no reading seeds at level N"); writing the seeds (at least 3 for each
level 2–20) is Task 9 of the ladder plan, not part of this session.
This run **auto-selects the next seeds that have not yet passed the gate**
(Step 1) — you do NOT paste a seed list.

Level (one ladder level, 1–60, per run). Its folder below is `<level-dir>`:
`level-` and two digits, so level 6 is `level-06`. Levels 2–20 each need passages
(the level test, below); level 1 has none:

<level = 2>

What a passage is now: the level test

The 60 shipped passages are rewritten with new ids (Task 9 of
`docs/superpowers/plans/2026-11-18-level-ladder.md`); this lane writes the new set.
A passage is the **level test** (spec §7.6 of
`docs/superpowers/specs/2026-11-18-level-ladder-design.md`): the learner completes a
level 2–20 by passing 2 of its passages. So:

- Levels 2–20 need at least 3 passages each. Level 1 has none. Not checked by
  script yet (Task 9 adds `levels_2_20_with_fewer_than_3_passages` to
  `reports/ladder_report.py`).
- Every word of a passage, in the body, the summary and the question prompts, is at
  or below the passage's level. Checked by script (`validate_readings`, check 4).
- Every grammar point found in the body is at or below the passage's level.
  Checked by script (`validate_readings`, check 6).
- The app never shows a wrong answer. Each question's accepted answers must cover
  the kana form and the kanji form of the answer, each with and without です where
  the answer can end that way. Not checked by script: the gate only needs one
  accepted answer that appears in the body. The app ignores punctuation.
- The operator reviews the accepted answers before release. Task 9 writes them to
  `reports/passage-answers.md`.

Number of seeds this session targets (this session drafts, ingests and repairs
exactly this many seeds, then stops — no more, no less unless the auto-select
prints fewer because the level is nearly done):

<seed-count = 1>

Keep <seed-count> very small — this is one session's entire attention span, not a
batch to delegate. A passage is a long, heavily constrained piece of writing, far
more expensive per item than a mnemonic or an example sentence. **Start with
`<seed-count = 1>` and read the passage before running any more** — that is the
pilot-slice rule the whole content plan uses, and tone is exactly the thing a
gate cannot check. 1–3 is the working range; past that the last passage gets
noticeably less care and each successive reply re-bills earlier replies as
context, which erodes the isolation this shape is for. If you want more
passages, run this prompt again in a new session rather than raising
<seed-count>.

Model/effort notes

- There is no subagent to configure for the writing — THIS session's own model
  does it. Use a strong reasoning model at high effort: this is the passage
  itself, the thing the learner actually reads.
- Pass this session's model name as the ingest `--model` value (Step 4) so
  `_meta.generator_model` is honest.
- The Step 5 review subagents are configured separately, below. Use a strong
  reasoning model there too: a weak reviewer invents findings on correct
  sentences and proposes corrections from outside the teaching window.

Review subagent model (Step 5 only):

<review-model = opus-5>

---

Ordering — read before starting

Seeds are ordered by position within the level. The window is the same for every
seed of a level: every word and grammar point at or below it. Generate the seeds
in the order Step 1 prints. Never reorder, never hand-pick a later seed because
it looks easier. Finish <level> fully before moving to the next level. Only run a
level that has seeds in `reading_seeds.py` (Step 1 stops with "no reading seeds
at level N" otherwise). Levels 2–20 need at least 3 passages each.

---

Workflow

Work from:

curriculum/_build

Step 1: Select This Session's Seeds

Select automatically — do NOT hand-pick or paste a seed list. Pick the next
<seed-count> seeds (in seed position order) that have not already produced a
gate-passing draft. Substitute this run's <level> and <seed-count> for
BATCH_LIMIT, then run:

.venv/bin/python - <<'PY'
import json, os, sys; sys.path.insert(0, '.')
from generate_content import reading_seeds
from generate_content.context import level_dir
LEVEL, BATCH_LIMIT = <level>, <seed-count>
drafts_dir = f'generate_content/drafts/readings/{level_dir(LEVEL)}'
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
itself is broken (duplicate slug, tone mix out of the 75–85% band, a
`required_grammar` point above the seed's level or one no script can detect, a
grammar point of levels 1–20 assigned to no seed or to two) and
nothing generated against it is trustworthy.

Because "done" is read from the checked-in draft records (keyed by seed slug, not
by which session wrote it), a previous single-session run's successfully ingested
seeds are already excluded here automatically — this is what makes running this
prompt repeatedly in fresh sessions seamless.

If it prints 0 seeds selected, <level> is already fully drafted — stop and report
that. Otherwise treat the printed comma list as this session's seed set: every
later step iterates over exactly these seeds, and no seed outside this list is
touched.

Step 2: Generate the Prompt Files

`--slugs` is a single comma-separated string with NO spaces after the commas:

.venv/bin/python -m generate_content.generate_readings webprompts --level <level> --slugs <selected,seeds,...>

Each prompt file is written to:

curriculum/_build/generate_content/web/readings/<level-dir>/<seed>.prompt.md

Regenerating a prompt is a safe no-op — `webprompts` overwrites
deterministically. Note that the auto-select in Step 1 picks up seeds whose
previous attempt failed the gate, and `webprompts` **erases the appended gate
errors** on those. That is fine at the start of a session (the seed gets a clean
attempt) but do not re-run `webprompts` for a seed mid-repair in Step 4 — the
repair needs those errors.

Step 3: Draft Every Passage Yourself — No Subagent

Read each prompt file listed above, one per seed. In each file, everything BELOW
the HTML comment header (the block that opens with `<!--` and ends with a line
ending in `-->`) is the complete, self-contained task for that seed: the
teaching-voice sheet, the passage brief, the tone direction, the exact vocabulary
and grammar you may use, the length band, the question count, and the JSON output
contract. The header itself is orchestration instructions for the caller — ignore
it. Each header names its own seed; do not let one file's header send you to
another file's reply path.

The teaching-voice sheet is identical in every file — read it once and apply it
to all of them. Everything from the passage brief onward is per-seed and must be
obeyed per seed.

Write each passage exactly as its own prompt body asks, then write ONE reply file
per seed, each to its own path:

curriculum/_build/generate_content/web/readings/<level-dir>/<seed>.reply.md

Do not write a combined file. Requirements:

- Write EXACTLY one fenced ```json code block and nothing else in each reply file
  — no preamble, no commentary before or after, nothing referring to the other
  seeds in this session.
- Use the exact output contract from the prompt: a single JSON object with
  `title`, `body`, `english_translation`, `summary_ja`, `summary_en` and
  `questions`, and no other keys.
- Do NOT write `grammar_slugs`, `word_count`, `vocabulary_slugs` or word spans.
  The build pipeline derives all four from the body with a tokenizer; anything
  you write for them is discarded.
- `body` is one continuous paragraph of plain Japanese — no line breaks, no
  furigana, no romaji, no markdown, no brackets. Ingestion annotates the body and
  every question prompt with the tokenizer and stores the result as
  `body_furigana` / `prompt_furigana`; brackets you write are rejected as markup,
  not merged.
- Keep the passage inside the word band the prompt states. The count is tokenizer
  words (punctuation excluded), not characters, so aim mid-band.
- Every content word in `body` **and in `summary_ja`** must come from the prompt's
  allowed vocabulary, plus any names the prompt explicitly grants. The level check
  rejects words above the passage's level in both.
- Widen the accepted answers of every question: list the kana form and the kanji
  form of the answer, each with and without です where the answer can end that
  way. Not checked by script; the operator reviews them.
- Produce exactly the number of questions the prompt asks for. Each question needs
  at least one accepted answer that appears **literally in the body**, and the
  question prompt itself is level-checked too.
- Build the passage only out of the prompt's allowed grammar, and use every point
  the prompt lists under "Grammar this passage must use" at least once. Both sides
  are detected in your text by a tokenizer, so there is nothing to declare and
  nothing a declaration can fix.
- Honour the tone direction. If the seed is humorous, it should actually be funny;
  if the joke and the comprehension pull apart, comprehension wins.
- Do not set or add any `review_status` field.
- Do not modify any file other than this session's reply files. Do not edit any
  `.prompt.md`. Do not run tools to fetch external content.
- **Treat each seed as independent, and make each passage feel different from the
  others in this session.** Do not reuse a setting, cast, opening move, or ending
  across two passages, and do not let two resolve the same way. A seed may only
  use the vocabulary and grammar ITS OWN prompt lists, even when another seed in
  this session was allowed more. Give the last passage the same effort as the
  first; if you find yourself writing to a template by the last seed, stop and
  re-read that seed's own brief.

Step 4: Ingest and Repair — one seed at a time, inline only

For each seed, run:

.venv/bin/python -m generate_content.generate_readings ingest --level <level> --slug <seed> --model <this session's model name>

(The `--model` value is recorded in the draft record's `_meta.generator_model`;
pass this session's own model name so provenance is honest.)

If ingestion succeeds:

The passage is enriched — word spans, vocabulary slugs, word count, and the
`body_furigana` / `prompt_furigana` annotations, all derived by the tokenizer —
and merged into the build artifact:

curriculum/_build/generate_content/passages/<level-dir>.json

Ingestion then deletes that seed's `.prompt.md` and `.reply.md`; their content now
lives in the draft record and the dataset, so an empty
`web/readings/<level-dir>/` after a clean session is expected, not a lost reply.

Every enriched passage should carry a non-empty `body_furigana` (the only
exception is a body with no kanji at all, which will not happen at these
positions). If one is missing, do not paper over it: report it, because the reader
renders a passage without readings as bare kanji and shows no error.

Record the seed as successful and move to the next seed.

If ingestion fails:

The process rewrites `<seed>.prompt.md` with the validation errors appended, and
exits non-zero. Do not regenerate from scratch. Since this session has no
subagent to delegate a large repair to, **fix inline yourself regardless of error
count** — this is the one deliberate difference from the subagent workflow's
"7+ errors → subagent" rule:

  Read the validation errors appended to `<seed>.prompt.md`. Inspect the existing
  `<seed>.reply.md` and the output contract in the prompt. Edit `<seed>.reply.md`
  to resolve every reported error.

  - Make the smallest changes necessary; preserve what already works. An
    word above the level is usually a local substitution, not a rewrite.
  - Fix all reported errors, not only the first.
  - Watch for knock-on effects: replacing a sentence can push the word count out
    of band, and deleting text can strand a question whose accepted answer no
    longer appears in the body.
  - Edit only `<seed>.reply.md`; never `<seed>.prompt.md`, never a validator,
    ingestion code, the seed list, the allowed-vocab or allowed-grammar
    derivation, curriculum source data, or the assembled dataset.
  - Preserve the reply-file format (a single fenced ```json block) and the exact
    output contract (the six keys, nothing else, no derived fields).
  - Keep `body` a single plain paragraph that the tokenizer can annotate; avoid
    constructions that fail the furigana round-trip.
  - Keep the tone the prompt asked for — a repair should not flatten a humorous
    passage into a neutral one.
  - Ensure valid JSON, no commentary outside the JSON block, no `review_status`.

Then run ingestion again. Retry budget, per seed: attempt 1 (Step 3's draft),
attempt 2 (first inline repair), attempt 3 (second inline repair). If attempt 3
still fails, make ONE last-resort inline fix and run ingestion a fourth and final
time. If that also fails, stop retrying this seed, record it as skipped, preserve
its latest validation errors for the final report, and move to the next seed — a
failure never touches another seed's already-passed files.

A seed can legitimately be unwritable at its level — the topic may need a word
above the seed's level. If a seed keeps failing on the same missing word,
say so in the report and name the word: the fix is a seed edit (move the seed
to a higher level, or reframe the topic), not another attempt.

---

Step 5: Naturalness Review — the one place this lane spawns subagents

Steps 1–4 enforce mechanics only — level, length, answerability, span integrity,
furigana. They cannot tell whether the Japanese reads like Japanese, and every
naturalness defect found in this project so far passed them cleanly
(`宿題を書きました`, `「…」と話しました`, `箱が待っています`). Step 5 is the pass that
reads the Japanese, and this session must not perform it itself.

**You wrote these passages. You are therefore the one model that cannot review
them.** A writer asked to judge its own work clears its own choices — this is not
a theoretical worry: the review lane's first version cleared `箱が待っています` by
reading it as deliberate style. That is why Step 5 delegates even though the rest
of this lane does not, and why "I will just check them myself, it is cheaper" is
the one shortcut that destroys the point of the step.

Run it once, after the seed loop finishes — not per seed. A seed that failed or
was skipped in Step 4 needs no handling here: the review lane selects
gate-passing drafts only, so a failed seed is invisible to it. If every seed
failed, there is nothing to review; say so and stop.

Step 5a — write the review prompts, scoped to this session's seeds:

.venv/bin/python -m generate_content.naturalness_check webprompts --level <level> --slugs <the seeds ingested this session, comma-separated, no spaces>

Pass `--slugs`. Without it the command selects **every** unreviewed draft at the
level, which turns a two-seed session into a whole-level review and destroys the
context isolation this lane exists for.

Step 5b — one fresh subagent per passage.

Launch ONE new general-purpose subagent (<review-model>, high reasoning) for each
passage. Never one subagent across two passages: a reviewer that has seen three
passages starts pattern-matching its own earlier findings.

For the instructions to give each reviewer, use the brief in § *Step 2: Review
with a Subagent* of:

docs/workflows/reading-passage-naturalness-subagent-workflow-automation-prompt.md

Read it and pass it as written rather than paraphrasing from memory, and add this
line, which the word band makes necessary:

  A correction replaces a sentence; it can never add one, and the corrected
  passage must stay inside the seed's word band. If your replacement is longer
  than the sentence it replaces, buy the words back within that sentence. A
  passage already at the top of its band has no room.

Do not give the reviewer your drafting rationale, your notes, or your reasons for
a word choice. It judges what is on the page. Telling it what you meant is how
you get your own choices confirmed back to you.

Step 5c — ingest each reply:

.venv/bin/python -m generate_content.naturalness_check ingest --level <level> --slug <seed> --model <review-model>

Three outcomes: **natural** (nothing flagged, body untouched), **corrected** (the
rewrite passed the whole gate again), **rejected** (findings came back but the
corrected passage failed the gate — the body is left exactly as it was, nothing
partial is merged, the gate errors are appended to the prompt file, the rejected
reply is deleted, and the command exits non-zero).

On a rejection, launch a FRESH subagent against the same prompt file, which now
carries the gate errors, and ingest again. **At most two review attempts per
passage.** If the second is also rejected, leave the passage as it is and report
the gate errors — twice-failed means the window has no way to say the thing, and
that is a seed or curriculum change, not another attempt.

Wait for each review subagent to **finish**. Do not poll for the reply file to
appear: a rejected reply is deleted precisely so a repair round cannot re-ingest
it, and a caller that waits on the file rather than the subagent will read the
same failure twice and call it two attempts.

Repairing a rejection is the reviewer's job, not yours. Do not hand-edit a reply
file in this step. The inline-repair rule in Step 4 exists because this lane has
no drafting subagent; Step 5 has a reviewing one, and editing its reply yourself
puts your judgement back into the one place it was excluded from.

What Step 5 must not do

- Do NOT bump `generate_readings.PROMPT_VERSION` and do NOT regenerate a passage
  because a finding came back. Step 5 corrects the passage in front of it.
- Do NOT edit `prompts/reading-passage.md` during the session. A finding is about
  one passage; a *pattern* across findings is about the generation prompt. Report
  the pattern and let the maintainer decide.
- Do NOT set `review_status`. A `natural` verdict is one model's opinion, not the
  Phase 5 human read.

---

Step 6: There Is No Final Build Step — Stop After Ingestion

Unlike the mnemonic single-session workflow, **this session runs no build command
at all**, and you must not add one:

- Do NOT run `generate.py`, `npm run validate-schema`, or `npm run
  compile-curriculum` as part of this session. Nothing this workflow writes is an
  input to them.
- Do NOT write to or edit the shipped passage data (`curriculum/readings/items.json`),
  and do NOT edit the `*_readings.py` files in `curriculum/_build/`. The old shipped passages are
  being retired and the generated set replaces them — that decision is already
  made, and it is *not* what holds the wire-in back. What holds it back is the
  Phase 5 human read, which has not happened for anything this workflow produces.
  Passages ship as a reviewed level, never a seed at a time. The procedure is in
  `docs/content/phase-4-reading-passage-tooling.md` § "The step that is
  deliberately not automated".

The session ends at `curriculum/_build/generate_content/passages/<level-dir>.json`.
That file is a build artifact for a human to read.

---

Final Report (for this session)

- <level>, <seed-count>, and the exact auto-selected seed set for this session
  (with the count vs. <seed-count>)
- The model used for drafting and for `--model` provenance
- ✅ Successfully ingested seeds, each with its tone tag and derived word count
- Any ingested passage missing `body_furigana`, or any question missing
  `prompt_furigana` where the prompt contains kanji
- ⚠️ Skipped seeds
- ❌ Failed seeds
- Repair attempts used per affected seed (all inline in this shape)
- Validation errors remaining after the final allowed attempt, and for any seed
  that failed on a missing word, the word itself
- How many seeds for <level> remain not-yet-passing (re-run Step 1 to get the
  count) — this tells you whether another session is needed
- **Step 5, per passage:** the naturalness verdict (natural / corrected /
  rejected), and for each correction the original sentence, the issue and the
  replacement. Name any passage rejected twice with the gate errors that blocked
  it, and any pattern across findings worth promoting into the generation prompt
  — as a recommendation, not a change you made
- Confirmation that no build command was run in this session
- A reminder that the output is a build artifact, and that it ships only after a
  human reads the whole level (Phase 5) and performs the documented wire-in
- Any manual follow-up required

Do not modify or set `review_status` to `reviewed`.

That is a manual human-review step (Phase 5) that automation must never perform.
For passages it matters more than anywhere else in the pipeline: the gate can
check level, length, answerability and span integrity, but it cannot check
whether the passage is coherent or whether a humorous one is funny.

---

Important Constraints

- This session drafts every passage itself. The only subagents in this lane are
  the Step 5 naturalness reviewers — one fresh one per passage, never shared, and
  never asked to do anything but review.
- Do not review your own passages in this session, and do not hand-edit a review
  reply. Both put the writer's judgement back into the step that exists to keep
  it out.
- Auto-select only — never hand-pick or paste a seed list.
- Ingestion, the gate, repairs and the attempt budget are per seed, always.
- A failure in one seed never invalidates another seed's already-ingested work in
  this session.
- Do not bypass or weaken validation. Do not modify validator or ingestion code,
  the seed list, the allowed-vocab derivation, or curriculum source data to make
  invalid content pass.
- Do not change a seed's level, or its `extra_allowed`, to unblock it. The
  seed's level is the passage's level and sets its window (every word and
  grammar point at or below it); a window the writer may move makes the level
  gate vacuous.
- Do not manually mark generated passages as reviewed.
- Do not write shipped curriculum files, and run no build command.
- No browser, no clipboard, no downloads.

---

Notes on differences from the subagent workflow

- No subagent drafts or repairs a passage; this session both drafts and ingests.
  <seed-count> IS this session's whole unit of work, and there is exactly one
  "draft" pass, done by the session itself. Step 5's reviewers are the sole
  exception, and they only read and correct what is already gated.
- Because there is no subagent to hand a large repair to, every repair in this
  shape is inline, regardless of error count — the subagent workflow's "7+ errors
  → repair subagent" branch does not apply here.
- Everything else is identical: the same seeds and prompt, the same auto-select
  (Step 1, reading "done" from the checked-in draft records), the same
  `webprompts`/`ingest` commands and gate, the same tokenizer-derived fields, the
  same 3-attempt cap plus one last-resort inline fix, the same draft records under
  `drafts/readings/<level-dir>/`, the same assembled dataset, the same position
  ordering, and the same `review_status: draft` discipline.
