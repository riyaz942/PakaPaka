Task: Generate Vocab Example Sentences via Subagents

Generate Phase 2c example sentences using in-session subagents (model configurable
below; a strong reasoning model is recommended) — no API credentials and no
browser. This is the no-API, no-browser sibling of the Gemini automation prompt:
only the "call the model" step differs. Here each item's reply is produced by a
fresh subagent instead of a web chat or the Message
Batches API; the context builder, the allowed-vocab constraints, and the
mechanical gate are identical to every other lane. See
`docs/workflows/example-sentences-web-chat-workflow.md` for the shared pipeline
background.

This run **auto-selects the next batch of not-yet-done slugs** (Step 1) — you do
NOT paste a slug list.

Level (one JLPT level per run; change to `n4`, `n3`, … when ready):

<level = n4>

Content type (always `vocab`):

<type = vocab>

Note: the only content type is `vocab`. Do NOT generate examples for kanji — a kanji
rarely stands alone as a word, so the app lists the vocabulary written with it
instead. Radicals get no example sentences. Grammar examples are authored with the
grammar lessons.

Subagent model (which model every subagent in this run uses):

<subagent-model = opus-5.5>

Model notes

- The value above is used for BOTH the generation subagent (Step 2) and every
  repair subagent (Step 3). A strong reasoning model is recommended.
- Give it as your environment names the model. If the requested model is
  unavailable, stop and say so rather than silently substituting — then re-run
  with a model you actually have.
- Record the model actually used in the final report, and pass it as the ingest
  `--model` provenance value (Step 3) so `_meta.generator_model` is honest.

Batch size (how many slugs this run processes; used as BATCH_LIMIT in Step 1):

<batch-size = 10>

This run processes up to <batch-size> slugs. A text-only subagent is far lighter
than the browser lane (no screenshots), but strong reasoning models still cost
usage. Consider starting smaller (~5–8) and calibrating: run one small batch, see
how much usage it consumed, and size later runs from that. The auto-select makes
stopping and resuming across sessions seamless — the next run picks up exactly
where you left off.

---

Workflow

Process one slug at a time, each with its own fresh subagent (no shared context
between slugs — a fresh subagent per slug is the equivalent of the browser lane's
"fresh chat per slug"). Do NOT mix content types in one run — all slugs in this run
share the same <type>. Everything is local files plus subagents: no browser, no
clipboard, no downloads.

Step 1: Select Slugs and Generate Prompts

Work from:

curriculum/_build

1a. Select this run's slugs automatically. Do NOT hand-pick or paste a slug list.
Pick the next <batch-size> slugs of <type> (in curriculum sort order) that are
neither generated (absent from the committed sidecar) nor drafted (no record under
`drafts/examples`). Substitute this run's <type> for KIND and <batch-size> for
BATCH_LIMIT, then run:

.venv/bin/python - <<'PY'
import json, os, sys; sys.path.insert(0, '.')
from generate_content import example_context as ec
LEVEL, KIND, BATCH_LIMIT = '<level>', 'vocab', <batch-size>
path = f'../vocabulary/examples/{LEVEL}.json'
generated = set(json.load(open(path))) if os.path.exists(path) else set()
drafts_dir = f'generate_content/drafts/examples/{LEVEL}/{KIND}'
drafted = {n[:-5] for n in os.listdir(drafts_dir) if n.endswith('.json')} if os.path.isdir(drafts_dir) else set()
drafted.discard('requests-preview')
done = generated | drafted
todo = [s for s in ec.all_slugs(LEVEL, KIND) if s not in done][:BATCH_LIMIT]
print(f'{len(todo)} slug(s) selected (BATCH_LIMIT={BATCH_LIMIT}):')
print(','.join(todo))
PY

If it prints 0 slugs, this level+type is already fully generated/drafted — stop and
report that. Otherwise treat the printed comma list as this run's slug set: every
later step iterates over exactly these slugs, and no slug outside this list is
touched.

1b. Generate the prompt files for the selected slugs in one call. `--slugs` is a
single comma-separated string with NO spaces after the commas:

.venv/bin/python -m generate_content.generate_examples webprompts --type <type> --level <level> --slugs <selected,slugs,...>

Each prompt file is written to:

curriculum/_build/generate_content/web/examples/<level>/<type>/<slug>.prompt.md

Regenerating a prompt is a safe no-op — `webprompts` overwrites deterministically,
and the auto-select in 1a already excludes any slug whose prompt carries appended
gate errors (those have a draft record and are handled by repair, not regenerated).

---

Step 2: Generate the Reply with a Subagent

For the current slug, launch ONE general-purpose subagent (using <subagent-model>,
high reasoning) in the foreground — ingestion must wait for it to finish. Give the
subagent the prompt file path:

curriculum/_build/generate_content/web/examples/<level>/<type>/<slug>.prompt.md

Give the subagent these instructions:

  Read `<slug>.prompt.md`. Everything BELOW the HTML comment header (the block that
  opens with `<!--` and ends with a line ending in `-->`) is your complete,
  self-contained task: a teaching-voice sheet, the item being exemplified, the
  exact vocabulary you may use, real-usage style anchors, the writing rules, and the
  JSON output contract. The header itself is orchestration instructions for the
  caller — ignore it.

  Produce the example sentences exactly as the prompt body asks, then write your
  answer to:

  curriculum/_build/generate_content/web/examples/<level>/<type>/<slug>.reply.md

  Requirements:

  - Write EXACTLY one fenced ```json code block and nothing else in the file — no
    preamble, no commentary before or after.
  - Use the exact output contract from the prompt: one top-level `example_sentences`
    array whose elements each have exactly `japanese`, `english`, and
    `vocabulary_slugs`.
  - Include 2–4 sentences (the prompt asks for 3; stay in that range).
  - Every sentence must actually use the target: the word's dictionary form (a
    natural conjugation counts — 食べました exemplifies 食べる).
  - Every slug you put in a sentence's `vocabulary_slugs` must come from the
    prompt's allowed-vocabulary list; never reference a word outside it, and never
    invent slugs.
  - Every content word in each Japanese sentence must be in the prompt's allowed
    vocabulary (the level-check will reject out-of-level words).
  - Write all Japanese as plain text — no furigana, no romaji, no markdown, no
    brackets. The build pipeline adds furigana with a tokenizer.
  - Keep sentences short and everyday (roughly ≤ 40 Japanese characters each) with
    natural English translations.
  - The style anchors are reference only — never copy or adapt them into a sentence.
  - Do not set or add any review_status field.
  - Do not modify any file other than the reply file. Do not run tools to fetch
    external content.

Use a fresh subagent for each slug; never reuse a subagent's context across slugs.

---

Step 3: Ingest and Repair

Run:

.venv/bin/python -m generate_content.generate_examples ingest --type <type> --level <level> --slug <slug> --model <subagent-model>

(The `--model` value is recorded in the sidecar entry's `_meta.generator_model`;
pass the same `<subagent-model>` you generated with so provenance is honest.)

If ingestion succeeds:

The item is merged into the per-level sidecar
curriculum/vocabulary/examples/<level>.json.

Record the slug as successful and proceed to the next slug.

If ingestion fails:

The ingestion process rewrites:

curriculum/_build/generate_content/web/examples/<level>/<type>/<slug>.prompt.md

with the validation errors appended.

Do not regenerate from scratch. Count the validation errors appended to the
prompt file and choose the repair method:

- **Fewer than 7 errors — inline fix.** Edit `<slug>.reply.md` yourself, in
  this session. A small fix does not need a subagent.
- **7 or more errors — repair subagent.** Launch a FRESH general-purpose
  subagent (<subagent-model>, high reasoning, foreground) to repair the
  existing reply.

Whichever method repairs the reply, it works from these files:

- curriculum/_build/generate_content/web/examples/<level>/<type>/<slug>.prompt.md
- curriculum/_build/generate_content/web/examples/<level>/<type>/<slug>.reply.md

The repair instructions are the same for both methods (an inline fix follows
them exactly as a repair subagent would):

  Read the validation errors appended to `<slug>.prompt.md`. Inspect the existing
  `<slug>.reply.md` and the output contract in the prompt. Edit `<slug>.reply.md`
  to resolve every reported error.

  - Make the smallest changes necessary; preserve valid sentences.
  - Do not rewrite every sentence unless the errors make that unavoidable.
  - Fix all reported errors, not only the first.
  - Edit only `<slug>.reply.md`; do not edit `<slug>.prompt.md`.
  - Do not modify validators, ingestion code, curriculum source data, the
    allowed-vocab derivation, or the assembled sidecar.
  - Preserve the reply-file format (a single fenced ```json block) and the exact
    output contract (one `example_sentences` array of `japanese` / `english` /
    `vocabulary_slugs` objects, 2–4 sentences).
  - Every sentence must use the target (the word's dictionary form incl. natural
    conjugations).
  - Every `vocabulary_slugs` entry must be in the prompt's allowed list; every
    content word must be in-level.
  - Keep every Japanese sentence fully annotatable by the tokenizer (avoid
    constructions that fail the furigana round-trip).
  - Keep all fields plain prose (no markdown/brackets/romaji) and within the length
    bounds implied by the gate errors.
  - Ensure valid JSON. Add no commentary outside the JSON block. Do not set
    review_status.

Then run ingestion again:

.venv/bin/python -m generate_content.generate_examples ingest --type <type> --level <level> --slug <slug> --model <subagent-model>

Retry Limit

Allow at most three ingestion attempts per slug, including the initial attempt:

- Attempt 1: original generation subagent (Step 2)
- Attempt 2: first repair — an inline fix if the failure reported fewer than 7
  errors, otherwise a repair subagent
- Attempt 3: second repair — same rule

Use a fresh subagent for each repair that needs one. If the third ingestion
attempt fails, the repair retry threshold is reached: make ONE last-resort
inline fix — edit the reply file yourself, no subagent, whatever the error
count — and run ingestion a fourth and final time.

If the fourth ingestion attempt fails:

- Stop retrying the slug.
- Record it as failed or skipped.
- Preserve the latest validation errors for the final report.
- Proceed to the next slug.

---

Ordering Note

Each run covers only its auto-selected <batch-size> slugs, so finishing a whole
level takes several runs. Finish <level> fully before moving to the next level. On the first run, read the assembled
output before launching more runs — the batch size is already pilot-sized, so one run
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

`generate.py` inlines the example sidecars into the shipped vocab JSON and adds
furigana with the tokenizer. Use the current project-specific `generate.py`
invocation and flags found under `curriculum/_build/`. Do not guess if the documented
invocation has changed.

---

Final Report

Provide a summary containing:

- <level>, the content type, <batch-size>, and the exact auto-selected slug set for this run (with the count vs. <batch-size>)
- The model actually used for generation and repair
- ✅ Successfully generated slugs
- ⚠️ Skipped slugs
- ❌ Failed slugs
- The number of repair attempts used for each affected slug, split into inline
  fixes and subagent repairs
- Validation or ingestion issues encountered
- Validation errors remaining after the final allowed attempt
- Roughly how many slugs of this type remain not-yet-done for the level (re-run Step 1a to get the count), so it's clear whether another run is needed
- Final build, schema-validation, and compilation results
- Any manual follow-up required

Do not modify or set review_status to reviewed.

That is a manual human-review step (Phase 5) that automation must not perform.

---

Important Constraints

- Each slug's reply is produced by a fresh <subagent-model> subagent; never share
  subagent context across slugs.
- Do not bypass or weaken validation.
- Do not modify validator or ingestion code, the allowed-vocab derivation, or
  curriculum source data to make invalid content pass.
- Style anchors shown in a prompt are reference only — never copy or adapt them into
  a generated sentence.
- Do not manually mark generated examples as reviewed.
- No browser, no clipboard, no downloads — this lane is entirely local files plus
  subagents.

---

Notes on differences from the Gemini web-chat automation prompt

- The model is called via an in-session subagent (Step 2), not a browser chat,
  so there are no browser-setup, paste-integrity, completion-polling, or
  download/rename steps. The generation subagent writes the reply file directly.
- Everything else is identical: the same auto-select (Step 1), the same
  `webprompts`/`ingest` commands and gate, the same repair rules (inline fix
  under 7 errors, 3-attempt cap plus one last-resort inline fix), the same
  per-level keyed-by-slug sidecar, and the same draft/`review_status` discipline.
