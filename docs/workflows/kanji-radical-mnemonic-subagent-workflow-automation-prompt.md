Task: Generate N5 Radical/Kanji/Vocabulary Mnemonics via Subagents

Generate Rev 1 (`prompt_version: 2`) radical descriptions, kanji mnemonics or
vocabulary mnemonics using in-session subagents (model configurable below; a
strong reasoning model is recommended) — no API credentials and no browser. This
is the no-API, no-browser sibling of the Gemini automation prompt: only the "call
the model" step differs. Here each item's reply is produced by a fresh subagent
instead of a web chat or the Message Batches API; the context builder (the taught
decomposition, the established component prose, the reading target, the reviewed
look-alikes, the cast injection) and the mechanical gate are identical to every
other lane. See `docs/workflows/kanji-radical-mnemonic-web-chat-workflow.md` for
the shared pipeline background.

This run is for ONE content type at a time and **auto-selects the next batch of
not-yet-done slugs** for that type (Step 1) — you do NOT paste a slug list.

Content type (one of `radical`, `kanji` or `vocab`):

<type = kanji>

Subagent model (which model every subagent in this run uses):

<subagent-model = claude-opus-5>

Model notes

- The value above is used for BOTH the generation subagent (Step 2) and every
  repair subagent (Step 3). A strong reasoning model is recommended — these are
  the mnemonics themselves, the thing the app is actually for.
- Give it as your environment names the model. If the requested model is
  unavailable, stop and say so rather than silently substituting — then re-run
  with a model you actually have.
- Record the model actually used in the final report, and pass it as the ingest
  `--model` provenance value (Step 3) so `_meta.generator_model` is honest.

Batch size (how many slugs this run processes; used as BATCH_LIMIT in Step 1):

<batch-size = 5>

This run processes up to <batch-size> slugs. A text-only subagent is far lighter
than the browser lane (no screenshots), but strong reasoning models still cost
usage. Consider starting smaller (~5–8) and calibrating: run one small batch, see
how much usage it consumed, and size later runs from that. The auto-select makes
stopping and resuming across sessions seamless — the next run picks up exactly
where you left off.

---

Layer Ordering — read before starting

The three types are a chain, not three independent jobs:

- a **kanji** meaning mnemonic continues each component radical's established
  `description`
- a **vocabulary** meaning mnemonic hooks into its component kanji's
  `meaning_mnemonic`

So a layer must be finished, ingested, **and inlined by `generate.py`** before the
layer above it is generated. This is enforced, not advisory: `webprompts --type
kanji` raises

  ValueError: component radical hi-sun has no `description` yet. Regenerate the
  radical layer first (...)

if you try to skip ahead. Order for a level: **radicals → `generate.py --level
n5` → kanji → `generate.py --level n5` → vocab**. Do N5 fully before N4. If Step
1b raises that error, stop and report it — the previous layer is not done.

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
Pick the next <batch-size> slugs of <type> (in curriculum sort order) that do not
already have a gate-passing draft **at the current `PROMPT_VERSION`**. Substitute
this run's <type> for KIND and <batch-size> for BATCH_LIMIT, then run:

.venv/bin/python - <<'PY'
import json, os, sys; sys.path.insert(0, '.')
from generate_content import mnemonic_context as mc
from generate_content.generate_mnemonics import KIND_DIR, PROMPT_VERSION
LEVEL, KIND, BATCH_LIMIT = 'n5', '<type>', <batch-size>   # KIND: 'radical', 'kanji' or 'vocab'
drafts_dir = f'generate_content/drafts/mnemonics/{LEVEL}/{KIND}'
done = set()
if os.path.isdir(drafts_dir):
    for name in os.listdir(drafts_dir):
        if not name.endswith('.json') or name == 'requests-preview.json':
            continue
        rec = json.load(open(os.path.join(drafts_dir, name)))
        if rec.get('status') == 'draft' and rec.get('prompt_version') == PROMPT_VERSION[KIND]:
            done.add(rec['slug'])
todo = [s for s in mc.all_slugs(LEVEL, KIND_DIR[KIND]) if s not in done][:BATCH_LIMIT]
print(f'{len(todo)} slug(s) selected (BATCH_LIMIT={BATCH_LIMIT}, done={len(done)}):')
print(','.join(todo))
PY

Note what "done" means here: a draft recorded under an **older** prompt version is
stale, not done, so a version bump correctly re-selects every out-of-date item for
regeneration. This mirrors the API path, whose `run` re-queues old-version drafts.
`PROMPT_VERSION` is keyed by type (`{"radical": 2, "kanji": 3, "vocab": 3}`) —
Rev 2 changed the kanji and vocab contract only, so radical drafts written under
Rev 1 are still current and are not re-selected.

If it prints 0 slugs, this level+type is already fully generated at the current
prompt version — stop and report that. Otherwise treat the printed comma list as
this run's slug set: every later step iterates over exactly these slugs, and no
slug outside this list is touched.

1b. Generate the prompt files for the selected slugs in one call. `--slugs` is a
single comma-separated string with NO spaces after the commas:

.venv/bin/python -m generate_content.generate_mnemonics webprompts --type <type> --level n5 --slugs <selected,slugs,...>

Each prompt file is written to:

curriculum/_build/generate_content/web/mnemonics/n5/<type>/<slug>.prompt.md

Regenerating a prompt is a safe no-op — `webprompts` overwrites deterministically,
and any appended gate errors from an earlier failure are dropped, which is correct
for a fresh attempt.

If this command raises the "no `description` yet" / "no `meaning_mnemonic` yet"
ValueError, the layer below is unfinished — see Layer Ordering above and stop.

---

Step 2: Generate the Reply with a Subagent

For the current slug, launch ONE general-purpose subagent (using <subagent-model>,
high reasoning) in the foreground — ingestion must wait for it to finish. Give the
subagent the prompt file path:

curriculum/_build/generate_content/web/mnemonics/n5/<type>/<slug>.prompt.md

Give the subagent these instructions:

  Read `<slug>.prompt.md`. Everything BELOW the HTML comment header (the block that
  opens with `<!--` and ends with a line ending in `-->`) is your complete,
  self-contained task: the teaching-voice sheet, the item itself, its taught
  decomposition with each component's established prose, the reading target, the
  reviewed look-alikes, the cast block, the writing rules, and the JSON output
  contract. The header itself is orchestration instructions for the caller — ignore
  it.

  Write the mnemonics exactly as the prompt body asks, then write your answer to:

  curriculum/_build/generate_content/web/mnemonics/n5/<type>/<slug>.reply.md

  Requirements:

  - Write EXACTLY one fenced ```json code block and nothing else in the file — no
    preamble, no commentary before or after. The prompt shows the exact key names;
    use them verbatim and add no others.
  - Return the keys for this type:
      radical → `description`
      kanji   → `meaning_mnemonic`, `reading_mnemonic`, and `description` **only
                if this kanji needs one** (see below)
      vocab   → `meaning_mnemonic`, `reading_mnemonic`, and `description` **only
                if this word needs one**
  - `description` is optional for kanji and vocab. Omit the key entirely unless
    the prompt lists look-alikes (then it is required, and its job is the visual
    contrast) or the item has a real nuance the mnemonics cannot carry — an odd
    register, a false friend, a usage trap, a piece of history that explains the
    character. A description that only restates the meaning and counts strokes is
    noise; leave it out.
  - Aim for **roughly 350–700 characters** per mnemonic, about four to six
    sentences. That is a target, not a rule: overrunning it to finish a scene the
    item genuinely needs is fine, padding to reach it is not.
  - Build the story from the components the prompt lists, and **continue the
    established image each component already carries** — do not invent a fresh
    scene that competes with what the learner has already read. Reference every
    listed component by its taught meaning. Never name a component, radical or
    kanji that is not in that list.
  - Highlight tags (kanji and vocab only, exactly as the prompt's "Highlighting"
    section describes): wrap each taught component's meaning where the story uses
    it — `<radical>…</radical>` in a kanji meaning mnemonic, `<kanji>…</kanji>` in
    a vocab one — and wrap both the target reading kana and the English phonetic
    hook in `<reading>…</reading>` in the reading mnemonic. One tag per field, no
    nesting, every tag closed, and none at all in a description or a radical.
  - The reading mnemonic must contain the target reading verbatim, in kana, inside
    a `<reading>` tag, and should use the cast character the prompt assigns for
    that reading.
  - For vocab, obey the reading-regularity block exactly: when it says the reading
    is regular or kana-only, write **one sentence** of derivation and stop —
    padding a regular reading into a story is a gate failure, not a stylistic
    preference. When it says irregular or not-derivable, write the full story.
  - When you write a description, it must address **every** look-alike the prompt
    lists, spelling out the visual difference, and must not introduce any other
    Japanese character. Descriptions carry no furigana, so stray Japanese renders
    unreadable.
  - Write all Japanese as plain text — no furigana brackets, no romaji (write
    kana), no markdown, no headings, no lists, no bold/italic, no emoji. The
    highlight tags above are the only markup allowed; everything else is stored as
    a plain string and rendered as prose.
  - Aim for real depth inside that length band; the gate enforces minimum lengths
    because thin stories do not survive reviews, and maximums because a learner
    rereads these dozens of times.
  - Do not set or add any review_status field.
  - Do not modify any file other than the reply file. Do not run tools to fetch
    external content.

Use a fresh subagent for each slug; never reuse a subagent's context across slugs.

---

Step 3: Ingest and Repair

Run:

.venv/bin/python -m generate_content.generate_mnemonics ingest --type <type> --level n5 --slug <slug> --model <subagent-model>

(The `--model` value is recorded in the sidecar entry's `_meta.generator_model`;
pass the same `<subagent-model>` you generated with so provenance is honest.)

If ingestion succeeds:

The item is merged into the per-level sidecar:

- radical → curriculum/radicals/mnemonics/n5.json
- kanji   → curriculum/kanji/mnemonics/n5.json
- vocab   → curriculum/vocabulary/mnemonics/n5.json

Record the slug as successful and proceed to the next slug.

If ingestion fails:

The ingestion process rewrites:

curriculum/_build/generate_content/web/mnemonics/n5/<type>/<slug>.prompt.md

with the validation errors appended.

Do not regenerate from scratch. Instead, launch a FRESH general-purpose subagent
(<subagent-model>, high reasoning, foreground) to repair the existing reply.

Give the repair subagent these files:

- curriculum/_build/generate_content/web/mnemonics/n5/<type>/<slug>.prompt.md
- curriculum/_build/generate_content/web/mnemonics/n5/<type>/<slug>.reply.md

Give the repair subagent these instructions:

  Read the validation errors appended to `<slug>.prompt.md`. Inspect the existing
  `<slug>.reply.md` and the output contract in the prompt. Edit `<slug>.reply.md`
  to resolve every reported error.

  - Make the smallest changes necessary; preserve the parts that already work.
  - Do not rewrite a passing field to fix a failing one.
  - Fix all reported errors, not only the first.
  - Edit only `<slug>.reply.md`; do not edit `<slug>.prompt.md`.
  - Do not modify validators, ingestion code, curriculum source data, the
    look-alike dataset, the cast bible, or the assembled sidecar.
  - Preserve the reply-file format (a single fenced ```json block) and the exact
    key names for this type. Do not add a `description` the earlier draft omitted
    unless an error asks for one.
  - A "too short" error means the story lacks substance — add scene, not filler
    clauses. A "too long" error means cut, not compress into one dense sentence;
    the target is roughly 350–700 characters per mnemonic.
  - A "never wraps it in <radical>…" or "does not highlight the reading" error
    means the words are there but untagged — add the tags around the words the
    story already uses, do not rewrite the story.
  - Keep every field plain prose apart from the highlight tags (no
    markdown/brackets/romaji/emoji), keep the reading verbatim, keep every listed
    component referenced and tagged, keep every listed look-alike addressed, and
    introduce no Japanese character the prompt did not list.
  - Ensure valid JSON. Add no commentary outside the JSON block. Do not set
    review_status.

Then run ingestion again:

.venv/bin/python -m generate_content.generate_mnemonics ingest --type <type> --level n5 --slug <slug> --model <subagent-model>

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

A skipped slug matters more here than in the example-sentences lane: a radical
with no description blocks every kanji built on it, and a kanji with no meaning
mnemonic blocks every word built on it. Report skips prominently — they must be
cleared before the next layer runs.

---

Ordering Note

Each run is a single content type and covers only its auto-selected <batch-size>
slugs, so finishing a whole layer takes several runs, and a level is three layers.
Do radicals fully (all runs), then kanji, then vocab, re-running `generate.py`
between layers so the next layer's prompts read the new prose. Do N5 fully before
N4. On the first run of a fresh type, read the assembled output in the app before
launching more runs — the batch size is already pilot-sized, so one run doubles as
the pilot.

---

Final Build

After every selected slug has been successfully ingested or skipped, run the
project's normal generation pipeline from the repository root.

Check the current invocation under:

curriculum/_build/generate_content/

Then run:

generate.py --level n5

Followed by:

npm run validate-schema

And:

npm run compile-curriculum

`generate.py` inlines the mnemonic sidecars into the shipped radical/kanji/vocab
JSON (radicals get a `description` and no mnemonic; kanji and vocab get the two
mnemonics, plus a `description` on the items that needed one), each carrying
`_meta.review_status: draft`. Use the current
project-specific `generate.py` invocation and flags found under
`curriculum/_build/`. Do not guess if the documented invocation has changed.

This step is not optional between layers — the next layer's prompts read the
inlined prose, not the sidecar.

---

Final Report

Provide a summary containing:

- The content type, <batch-size>, and the exact auto-selected slug set for this run (with the count vs. <batch-size>)
- The model actually used for generation and repair
- ✅ Successfully generated slugs
- ⚠️ Skipped slugs — call these out as blockers for the layer above
- ❌ Failed slugs
- The number of subagent repair attempts used for each affected slug
- Validation or ingestion issues encountered
- Validation errors remaining after the final allowed attempt
- Roughly how many slugs of this type remain not-yet-done for the level (re-run Step 1a to get the count), so it's clear whether another run is needed
- Final build, schema-validation, and compilation results
- Any manual follow-up required

Do not modify or set review_status to reviewed.

That is a manual human-review step (Phase 5) that automation must not perform. The
gate proves an item is in-constraints; it does not prove the story is good, or that
the cast stays consistent across independently generated items.

---

Important Constraints

- Each slug's reply is produced by a fresh <subagent-model> subagent; never share
  subagent context across slugs.
- Do not bypass or weaken validation.
- Do not modify validator or ingestion code, the look-alike dataset
  (`_build/visually_similar.py`), the cast bible, the prompt templates, or
  curriculum source data to make invalid content pass.
- Never invent a look-alike pair or a component the prompt did not list — both
  lists are reviewed data, and the gate rejects additions.
- Do not manually mark generated mnemonics as reviewed.
- No browser, no clipboard, no downloads — this lane is entirely local files plus
  subagents.

---

Notes on differences from the Gemini web-chat automation prompt

- The model is called via an in-session subagent (Step 2), not a browser chat,
  so there are no browser-setup, paste-integrity, completion-polling, or
  download/rename steps. The generation subagent writes the reply file directly.
- Everything else is identical: the same auto-select (Step 1), the same
  `webprompts`/`ingest` commands and gate, the same 3-attempt repair cap, the same
  per-level keyed-by-slug sidecar, the same layer ordering, and the same
  draft/`review_status` discipline.
