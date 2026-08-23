Task: Run the Tier-2 Semantic Audit via Subagents

Run the tier-2 semantic pass (docs/content/content-audit-plan.md, "Tier 2") using
in-session subagents (model configurable below; a strong reasoning model is
recommended) — no API credentials and no browser. This is the no-API, no-browser
sibling of the web-chat generation lanes: only the "call the model" step differs.
Here each batch's reply is produced by a fresh subagent instead of a web chat or
the Anthropic API. Findings are **advisory only** — this pass never edits
curriculum content and never flips `review_status`; it only appends a "Semantic
(advisory)" section to a report for a human to read.

This run auto-resumes: `webprompts` skips any batch whose reply already exists
and validates, so you do NOT hand-pick a batch list, and stopping partway through
a run is safe — the next run picks up exactly where you left off.

Level (one JLPT level per run):

<level = n5>

Scope (which items are audited):

<scope = draft-only>

`draft-only` (default) covers items whose `_meta.review_status` is `draft` or
absent — everything that hasn't been through human review yet. Pass `--all` for
a full re-audit of every item, reviewed included; only do this if asked.

Subagent model (which model every subagent in this run uses):

<subagent-model = sonnet-5>

Model notes

- The value above is used for BOTH the generation subagent (Step 2) and every
  repair subagent (Step 3). A strong reasoning model is recommended — this pass
  is judging translation fidelity, not producing prose.
- Give it as your environment names the model. If the requested model is
  unavailable, stop and say so rather than silently substituting — then re-run
  with a model you actually have.
- Record the model actually used in the final report, and pass it as the ingest
  `--model` value (Step 4) so the report's provenance line is honest.

Batch size (sentence pairs per batch file; used as BATCH_SIZE in Step 1):

<batch-size = 40>

Each reading passage is always its own batch regardless of this value — a
passage carries its whole body, so batching several into one call would push a
single request past useful attention. A full N5 draft-only run is on the order
of 60-70 batch files total; consider a pilot of 2-3 batches first (see Ordering
Note) before committing to a full run.

---

Prerequisites

Tier 2 is only worth paying for once tiers 0-1 are green. Before Step 1, confirm
`curriculum/_build/reports/content-audit-<level>.md` exists (run
`.venv/bin/python -m generate_content.audit_shipped --level <level>` first if
not) — `ingest` refuses to run without it.

---

Workflow

Work from:

curriculum/_build

Step 1: Generate Batch Prompts

Run:

.venv/bin/python -m generate_content.audit_semantic webprompts --level <level> --batch-size <batch-size>

(Add `--all` if <scope> is `all`.)

Each batch prompt file is written to:

curriculum/_build/generate_content/web/semantic/<level>/<NNN>-<slugified-label>.prompt.md

Rerunning this command is a safe no-op for every batch that already has a valid
`.reply.md` — it prints how many batch files were written vs. skipped, plus a
rough per-batch token size for calibration. Treat every `<NNN>-<slugified-label>`
whose `.prompt.md` was written (not skipped) as this run's candidate batch set —
pick a subset for a pilot, or take all of them for a full run (see Ordering
Note).

---

Step 2: Generate the Reply with a Subagent

For each batch file in this run's set, launch ONE general-purpose subagent
(using <subagent-model>, high reasoning) in the foreground — ingestion must wait
for it to finish. Give the subagent the prompt file path:

curriculum/_build/generate_content/web/semantic/<level>/<NNN>-<slugified-label>.prompt.md

Give the subagent these instructions:

  Read `<NNN>-<slugified-label>.prompt.md`. Everything BELOW the HTML comment
  header (the block that opens with `<!--` and ends with a line ending in `-->`)
  is your complete, self-contained task: the judging instructions, the batch of
  items to check (example-sentence pairs, or one reading passage's translation/
  summaries/questions), and the JSON output contract. The header itself is
  orchestration instructions for the caller — ignore it.

  Judge each item exactly as the prompt asks, then write your answer to:

  curriculum/_build/generate_content/web/semantic/<level>/<NNN>-<slugified-label>.reply.md

  Requirements:

  - Write EXACTLY one fenced ```json code block and nothing else in the file —
    no preamble, no commentary before or after.
  - The JSON object has exactly two keys: `evaluated` (the integer count of
    items in the batch, given in the prompt — this must match exactly, judging
    only some of the items is a malformed reply) and `findings` (an array, one
    entry per item with a real problem, each `{"id": ..., "issue": ...}`).
  - Every `id` you use must be copied exactly from one of the items in the
    prompt — never invent, abbreviate, or alter an id.
  - `issue` is a single sentence naming the problem. No newlines.
  - Flag only real mismatches — wrong meaning, a mistranslated word, content
    present on one side and missing from the other, a politeness or tense shift
    that changes what is being said, a claim the source doesn't support. Do not
    flag a natural, non-literal rendering that preserves the meaning, or a
    translation you'd merely have worded differently. When in doubt, do not
    flag.
  - Items with no problem must not appear in `findings`. An empty array is the
    expected, common result for clean material.
  - Do not modify any file other than the reply file. Do not run tools to fetch
    external content. Do not edit curriculum data, validators, or reports.

Use a fresh subagent for each batch file; never reuse a subagent's context
across batches.

---

Step 3: Repair a Malformed Reply

Run ingest (Step 4) after each batch's reply is written, or after a small group
of them. If a reply is rejected, ingest's output names the batch and the exact
reason (unknown id, wrong `evaluated` count, missing/duplicate fence, malformed
JSON).

Do not regenerate from scratch. Count the distinct errors ingest reported for
the batch and choose the repair method:

- **Fewer than 7 errors — inline fix.** Edit the reply file yourself, in this
  session. A rejection is usually one or two contract violations — a small fix
  does not need a subagent.
- **7 or more errors — repair subagent.** Launch a FRESH general-purpose
  subagent (<subagent-model>, high reasoning, foreground) to repair the
  existing reply.

Whichever method repairs the reply, it works from these files:

- curriculum/_build/generate_content/web/semantic/<level>/<NNN>-<slugified-label>.prompt.md
- curriculum/_build/generate_content/web/semantic/<level>/<NNN>-<slugified-label>.reply.md

The repair instructions are the same for both methods (an inline fix follows
them exactly as a repair subagent would; for an inline fix you already have the
ingest error text — nothing to paste):

  Ingestion rejected this reply for the reason: <paste the exact ingest error
  text>. Inspect the existing `<NNN>-<slugified-label>.reply.md` against the
  output contract in `<NNN>-<slugified-label>.prompt.md` and fix it.

  - Make the smallest change necessary; preserve valid findings.
  - If the error was an unknown id, either correct it to the exact id from the
    prompt's item list or drop that finding.
  - If the error was a wrong `evaluated` count, set it to the exact count given
    in the prompt (the number of items in the batch), not the number of
    findings.
  - If the error was a missing/duplicate fence, ensure the file contains
    EXACTLY one fenced ```json code block and nothing else.
  - Preserve the exact contract: two top-level keys (`evaluated`, `findings`),
    each finding `{"id": ..., "issue": ...}`, `issue` a single sentence.
  - Edit only `<NNN>-<slugified-label>.reply.md`; do not edit the prompt file,
    validators, ingestion code, or curriculum source data.

Then run ingest again.

Retry Limit

Allow at most three ingestion attempts per batch, including the initial attempt:

- Attempt 1: original generation subagent (Step 2)
- Attempt 2: first repair — an inline fix if the rejection reported fewer than
  7 errors, otherwise a repair subagent
- Attempt 3: second repair — same rule

Use a fresh subagent for each repair that needs one. If the third ingestion
attempt fails, the repair retry threshold is reached: make ONE last-resort
inline fix — edit the reply file yourself, no subagent, whatever the error
count — and run ingest a fourth and final time.

If the fourth ingestion attempt still fails: stop retrying that batch, record
it as failed, preserve the latest validation error for the final report, and
move on to the next batch. A failed batch shows up in the report's "Failed
calls" section so a human knows it was not checked — it does not block
ingesting the batches that did pass.

---

Step 4: Ingest

Run:

.venv/bin/python -m generate_content.audit_semantic ingest --level <level> --batch-size <batch-size> --model <subagent-model>

(Add `--all` if <scope> is `all` — pass the same `--batch-size`/`--all` used in
Step 1, or the batch filenames won't line up. `--model` is recorded in the
report's provenance line; pass the same `<subagent-model>` you generated with so
it's honest.)

This is idempotent and safe to run after every batch, or once at the end — it
rebuilds the whole "Semantic (advisory)" section from every currently-valid
reply on disk, and lists any batch with a missing or malformed reply under
"Failed calls" so a human can see what was NOT checked. Rerunning ingest never
touches curriculum content.

Report written to: curriculum/_build/reports/content-audit-<level>.md

---

Ordering Note

`webprompts` writes (or skips) every batch for <level>+<scope>+<batch-size> in
one call — there's no separate "select N batches" step like the per-slug
example-sentence lane. For a pilot, run `webprompts` once, then process only
2-3 of the batch files it wrote through Steps 2-4 before committing subagent
budget to the rest. On the first run of a fresh level, read the assembled report
section before launching more subagents — the pilot doubles as a sanity check
on prompt quality and model judgment.

---

Final Report

Provide a summary containing:

- <level>, <scope>, <batch-size>, and the batch file set this run processed
  (with the count vs. the total `webprompts` reported)
- The model actually used for generation and repair
- ✅ Successfully ingested batches
- ⚠️ Skipped batches (already had a valid reply from a prior run)
- ❌ Failed batches (exhausted the repair budget)
- The number of repair attempts used for each affected batch, split into inline
  fixes and subagent repairs
- The advisory finding count and a few representative findings
- How many batches remain not-yet-attempted for <level>+<scope> (rerun
  `webprompts` to get the count), so it's clear whether another run is needed
- Final `ingest` output (finding count, failed-call count)

Findings are advisory. Automation must NEVER flip `review_status` and must
NEVER edit curriculum content, drafts, or sidecars based on a finding — a human
reads the flagged ids in the report and decides what, if anything, to change.

---

Important Constraints

- Each batch's reply is produced by a fresh <subagent-model> subagent; never
  share subagent context across batches.
- Do not bypass or weaken the reply-contract validation (id membership,
  `evaluated` count, single fence) to force a batch to pass.
- Do not modify `audit_semantic.py`, the report format, curriculum source data,
  or any other file to make an invalid reply pass.
- Do not manually mark anything as reviewed, and do not edit
  `_meta.review_status` anywhere as a side effect of this run.
- No browser, no clipboard, no downloads — this lane is entirely local files
  plus subagents.

---

Notes on differences from the example-sentences subagent lane

- Generation is many-items-per-batch (sentence pairs chunked by <batch-size>,
  one passage per batch), not one-item-per-slug — a batch prompt file covers
  several ids, and its reply must judge all of them (`evaluated` enforces this).
- There is no draft sidecar or shipped-content assembly step. The only output
  is the "Semantic (advisory)" report section; nothing here is inlined into
  curriculum JSON.
- `ingest` rebuilds the *known id set* for each batch itself (by re-deriving it
  from the same curriculum data `webprompts` used), rather than trusting the
  reply — this is what replaces the API lane's structured-output/schema
  guarantee.
- Everything else is the same shape: the same auto-resume-via-skip in
  `webprompts`, a fresh subagent per unit of work, the same repair rules
  (inline fix under 7 errors, 3-attempt cap plus one last-resort inline fix),
  and `--model` provenance recorded at ingest.
