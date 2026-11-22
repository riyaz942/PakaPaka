Task: Review Generated Reading Passages for Naturalness via Subagents

Check whether the Japanese in a generated passage reads like Japanese, and apply
the sentence corrections that come back. This runs **after** a passage has
already passed the mechanical gate in
`curriculum/_build/generate_content/validate_readings.py` — it is the layer that
gate cannot cover.

`validate_readings.py` checks level, length band, grammar coverage, span
integrity and furigana. Every naturalness defect found in this project so far
passed all of it:

    箱が先月から待っています   — a box does not wait
    角に持っていきました        — that is carrying, not putting down
    「明日も来ます」と話しました — 話す does not carry a quotation
    お茶は辛いです              — 辛い is spicy; the tea was salty

This workflow is the missing pass. Background:
`docs/content/reading-passage-minna-no-nihongo-alignment.md`, § *An object is not
a person* (cause 6).

When to use this runbook instead of the generation lane

Generation now ends with this review built in — it is Step 4 of
`reading-passages-subagent-workflow-automation-prompt.md`, scoped by `--slugs`
to the seeds that run produced. A freshly generated passage is already reviewed
and does not need this file.

Use this runbook for the passages generation did not cover:

- a level whose passages predate the review lane (backfill),
- a re-review after `REVIEW_VERSION` changes, which makes every earlier verdict
  stale,
- a single passage you want a second opinion on (`--slugs <seed> --recheck`).

The mechanics below are the same either way; only the selection differs.

Level (one ladder level, 1–60, per run). Its folder below is `<level-dir>`:
`level-` and two digits, so level 6 is `level-06`:

<level = 2>

Subagent model (which model every review subagent in this run uses):

<subagent-model = opus-5>

Model notes

- A weak model produces two bad outcomes here, both expensive: it invents
  findings on correct sentences, and it proposes corrections from outside the
  teaching window. Use a strong reasoning model.
- Give it as your environment names the model. If the requested model is
  unavailable, stop and say so rather than silently substituting.
- Pass the model you actually used as the ingest `--model` value — it is recorded
  on the draft as `naturalness.reviewer_model`.

Batch size (how many passages this run reviews):

<batch-size = 4>

---

What the reviewer is given, and why

The prompt file carries the passage **and the seed's whole allowed vocabulary
and grammar window**. This is the part that makes the lane work, and it is not
optional.

An outside review of seed 12 (in the JLPT-era seed list) got the diagnosis right — 箱が待っています is wrong —
and proposed 置いてあります, which is `tearu`, N4 grammar, off the list at every
N5 seed. It also proposed the counter 二着, which is in neither level. Both
corrections were unusable. A reviewer that cannot see the window can only
complain; a reviewer that can see it can fix.

---

Workflow

Work from:

curriculum/_build

Step 1: Generate the Review Prompts

.venv/bin/python -m generate_content.naturalness_check webprompts --level <level>

This selects **gate-passing drafts only** (`status: draft`) that have not been
reviewed at the current `REVIEW_VERSION`. A passage that cannot pass the
mechanical gate is not ready for an opinion about its Japanese — fix the
mechanics first, in the generation lane.

Add `--slugs a,b,c` (no spaces) to review named seeds, or `--recheck` to
re-review passages already reviewed at this version.

If it reports nothing to review, the level is fully reviewed — stop and say so.

Each prompt file is written to:

curriculum/_build/generate_content/web/naturalness/<level-dir>/<seed>.prompt.md

Take the first <batch-size> of them as this run's set.

---

Step 2: Review with a Subagent

For each passage, launch ONE fresh general-purpose subagent (<subagent-model>,
high reasoning, foreground). Never reuse a subagent across passages: a reviewer
that has already seen three passages starts pattern-matching its own earlier
findings.

Give the subagent these instructions:

  Read `generate_content/web/naturalness/<level-dir>/<seed>.prompt.md` in full.
  Everything BELOW the HTML comment header (the block opening `<!--` and ending
  in `-->`) is your complete, self-contained task. The header is orchestration
  for the caller — ignore it.

  Do exactly what the prompt body asks, then write your answer to:

  generate_content/web/naturalness/<level-dir>/<seed>.reply.md

  - The reply file must contain EXACTLY one fenced ```json code block and
    nothing else — no preamble, no commentary.
  - Follow the reply contract exactly: the key names, the `sentences_checked`
    integer, and `original` values copied character for character from the
    numbered sentence list. A retyped or abbreviated `original` cannot be
    matched to a sentence and the whole reply is rejected.
  - Every `replacement` must be built only from the vocabulary and grammar in
    the prompt's window section. Check each word against that list before you
    write it. A replacement reaching outside the window is rejected by the
    build and the sentence you objected to stays as it is.
  - Judge what is on the page. An empty `findings` array is a normal, expected
    result — do not manufacture findings to look thorough, and do not flag a
    sentence merely for being simple or plain. These passages are written for
    beginners and are supposed to be plain.
  - Do not modify any file other than your reply file. Do not edit the prompt
    file, drafts, curriculum data, or validators. Do not run the ingest command.

---

Step 3: Ingest

.venv/bin/python -m generate_content.naturalness_check ingest --level <level> --slug <seed> --model <subagent-model>

Three outcomes, and all three are final for that passage in this run:

**natural** — no sentence flagged. The body is untouched, the verdict is
recorded on the draft, and the staging files are removed. This is the expected
result for most passages.

**corrected** — the flagged sentences were swapped for their replacements, the
reply's `english_translation` (and any `summary_ja` / `summary_en` / `questions`
it supplied) replaced the shipped ones, and the whole corrected passage passed
`validate_draft` again. The draft keeps its original body under
`naturalness.original_body`, and the dataset is rebuilt. **Read the printed
diff** — the gate proves the correction is legal at this level, not that it is
better writing.

**rejected** — findings came back, but the corrected passage failed the gate.
The draft body is left exactly as it was; nothing partial is merged. The gate
errors are appended to the prompt file, the rejected reply file is **deleted**,
and ingest exits non-zero.

The deletion matters to you: wait for the repair subagent to **finish**, not for
the reply file to exist. If you poll for the file and a rejected reply is still
sitting there, you will ingest the reply that was just rejected and read the
identical failure as a second attempt.

On a rejection, launch a FRESH subagent against the same prompt file (it now
carries a "Your last correction was rejected" section listing what failed) and
run ingest again. **Allow at most two review attempts per passage.** If the
second is also rejected, stop, leave the passage as it is, and report the gate
errors — a reviewer that cannot correct a sentence inside the window twice is
telling you the window has no way to say it, and the fix is a seed or
curriculum change, not another attempt.

---

Applying What the Run Teaches

A finding is about one passage. A *pattern* across findings is about the
prompt. If three passages get the same class of correction, the rule belongs in
`curriculum/_build/generate_content/prompts/reading-passage.md` and
`generate_readings.PROMPT_VERSION` should be bumped, so passages generated later
do not need the correction at all. Record what you changed and why in
`docs/content/reading-passage-minna-no-nihongo-alignment.md`.

Do not make that change silently as part of a review run — report the pattern
and let the maintainer decide.

---

There Is No Final Build Step

This workflow does not touch shipped curriculum, and you must not add a step
that does:

- Do NOT run `generate.py`, `npm run validate-schema`, or
  `npm run compile-curriculum`. Nothing here is an input to them.
- Do NOT write the shipped passage data (`curriculum/readings/items.json`) or edit
  the `*_readings.py` files in `curriculum/_build/`.
- Do NOT set `review_status` to reviewed. A clean naturalness verdict is one
  model's opinion, not the Phase 5 human read.

The run ends at `curriculum/_build/generate_content/passages/<level-dir>.json`, a
build artifact for a human to read.

---

Final Report

- <level>, <batch-size>, and the seeds reviewed
- The model actually used
- Per passage: the verdict (natural / corrected / rejected), and for each
  correction the original sentence, the issue, and the replacement
- Any passage rejected twice, with the gate errors that blocked it and the word
  or pattern the window appears to lack
- Any pattern worth promoting into the generation prompt (see above)
- How many passages at <level> remain unreviewed

---

Important Constraints

- Fresh subagent per passage; never share reviewer context across passages.
- Do not bypass the gate. A correction that fails `validate_draft` is rejected
  whole — do not hand-merge the part that passed.
- Do not edit validators, the seed list, the allowed-vocab derivation, or
  curriculum source data to make a correction pass.
- Do not widen a seed's `vocab_cutoff`, `pull_forward`, `grammar_cutoff` or
  `pull_forward_grammar` to unblock a correction. If the window genuinely cannot
  say a thing, that is a finding to report, not a limit to move.
- No browser, no clipboard, no downloads — local files plus subagents.

---

Checking the Lane Itself

.venv/bin/python -m generate_content.naturalness_check --selftest

Runs the reply contract against a known-bad reply for every rule it enforces,
plus the sentence splitter and the fix applier. No model call, so run it after
any change to `naturalness_check.py`.
