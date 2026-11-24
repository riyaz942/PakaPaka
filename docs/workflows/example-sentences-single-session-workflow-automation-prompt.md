Task: Generate Vocab Example Sentences — Single Session, No Subagents

Generate Phase 2c vocabulary example sentences **entirely within the current
session** — no subagents, no browser, no clipboard, no API credentials. This
is the single-session sibling of
`docs/workflows/example-sentences-subagent-workflow-automation-prompt.md`:
same auto-select, same context builder, same mechanical gate, same per-slug
repair budget — the only difference is who writes the sentences. There, a
fresh subagent drafts each slug. Here, THIS session drafts them directly,
then the session ends; you get the next batch of slugs by running this same
prompt again in a brand-new session. See
`docs/workflows/example-sentences-web-chat-workflow.md` for the shared
pipeline background.

This run **auto-selects the next <slug-count> not-yet-done slugs** — you do
NOT paste a slug list.

Level (one ladder level, 1–60, per run). Its folder below is `<level-dir>`:
`level-` and two digits, so level 6 is `level-06`:

<level = 6>

Content type (always `vocab`):

<type = vocab>

Note: the only content type is `vocab`. Do NOT generate examples for kanji —
a kanji rarely stands alone as a word, so the app lists the vocabulary written
with it instead. Radicals get no example sentences. Grammar examples are
authored with the grammar lessons.

Number of slugs this session targets (this session drafts, ingests and
repairs exactly this many slugs, then stops — fewer only if the auto-select
prints fewer because the level is nearly done):

<slug-count = 10>

Model/effort notes

- There is no subagent to configure — THIS session's own model does the
  writing. Use a strong reasoning model at high effort.
- Pass this session's model name as the ingest `--model` value (Step 4) so
  `_meta.generator_model` is honest.

---

Workflow

Work from:

curriculum/_build

Step 1: Select This Session's Slugs

Select automatically — do NOT hand-pick or paste a slug list. Pick the next
<slug-count> slugs (in ladder order) that are neither generated
(no example sentences in the committed sidecar) nor drafted (no record under
`drafts/examples`). A level run picks only words with no sentences, so reviewed
sentences are never regenerated here; to regenerate a reviewed word, name it
with `--slugs` by hand (outside this auto-select). Substitute this run's <level> for LEVEL and <slug-count>
for BATCH_LIMIT, then run:

.venv/bin/python - <<'PY'
import json, os, sys; sys.path.insert(0, '.')
from generate_content import example_context as ec
from generate_content.context import level_dir
LEVEL, KIND, BATCH_LIMIT = <level>, 'vocab', <slug-count>
path = '../vocabulary/examples.json'
entries = json.load(open(path)) if os.path.exists(path) else {}
generated = {s for s, e in entries.items() if e.get('example_sentences')}
drafts_dir = f'generate_content/drafts/examples/{level_dir(LEVEL)}/{KIND}'
drafted = {n[:-5] for n in os.listdir(drafts_dir) if n.endswith('.json')} if os.path.isdir(drafts_dir) else set()
drafted.discard('requests-preview')
done = generated | drafted
slugs = ec.all_slugs(LEVEL, KIND)
todo = [s for s in slugs if s not in done][:BATCH_LIMIT]
print(f'{len(todo)} slug(s) selected (target={BATCH_LIMIT}, done={len(done)}/{len(slugs)}):')
print(','.join(todo))
PY

"Done" is read from the sidecar and the draft records, not from which
session wrote them, so a previous session's slugs are excluded
automatically — this is what makes running this prompt repeatedly in fresh
sessions seamless. A slug skipped by an earlier session has a draft record
too, so it is not selected again; it is listed in that session's report for
manual follow-up. If Step 1 prints 0 slugs, the level is fully generated or
drafted — stop and report that.

Step 2: Generate the Prompt Files

`--slugs` is a single comma-separated string with NO spaces after the commas:

.venv/bin/python -m generate_content.generate_examples webprompts --type vocab --slugs <selected,slugs,...>

Each prompt file is written to:

curriculum/_build/generate_content/web/examples/<level-dir>/vocab/<slug>.prompt.md

Regenerating a prompt is a safe no-op.

Step 3: Draft Every Reply Yourself — No Subagent

Read each prompt file listed above, one per slug. In each file, everything
BELOW the HTML comment header (the block that opens with `<!--` and ends with
a line ending in `-->`) is the complete, self-contained task for that item: a
teaching-voice sheet, the word being exemplified, the exact vocabulary you
may use, real-usage style anchors, the writing rules, and the JSON output
contract. The header itself is orchestration instructions for the caller —
ignore it. Each header names its own slug; do not let one file's header send
you to another file's reply path.

The teaching-voice sheet is identical in every file — read it once and apply
it to all of them. Everything from the item onward is per-item and must be
obeyed per item.

Write the sentences for every item exactly as its own prompt body asks, then
write ONE reply file per item, each to its own path:

curriculum/_build/generate_content/web/examples/<level-dir>/vocab/<slug>.reply.md

Do not write a combined file. Requirements:

- Write EXACTLY one fenced ```json code block and nothing else in each reply
  file — no preamble, no commentary, nothing referring to the other items in
  this run.
- Use the exact output contract from the prompt: one top-level
  `example_sentences` array whose elements each have exactly `japanese`,
  `english`, and `vocabulary_slugs`.
- Include 2–4 sentences (the prompt asks for 3; stay in that range).
- Every sentence must actually use the target: the word's dictionary form (a
  natural conjugation counts — 食べました exemplifies 食べる).
- **Treat each item's vocabulary lists as its own.** Each prompt splits the
  vocabulary into "Already known" (words before this item) and "Coming up
  next" (the next 50 words in ladder order). Both lists move through the ladder,
  so a word allowed for a later item in this run may be out of range for an
  earlier one. Build most sentences from the "Already known" list in THAT
  item's prompt only; use a "coming up next" word (or pattern) only when a
  sentence needs it, at most one in the whole set.
- Every slug in a sentence's `vocabulary_slugs` must come from that prompt's
  two vocabulary lists; never invent slugs. Every content word in each
  Japanese sentence must be in one of those lists (the level-check rejects
  any other word, including words further ahead).
- Write all Japanese as plain text — no furigana, no romaji, no markdown, no
  brackets. The build pipeline adds furigana with a tokenizer.
- Keep sentences short and everyday (roughly ≤ 40 Japanese characters each)
  with natural English translations.
- The style anchors are reference only — never copy or adapt them into a
  sentence.
- **Make every item feel different from the others in this run.** Do not
  reuse a setting, a subject (私 / 母 / 友達 …), a sentence frame or a time
  word across items more than the words themselves require. Give the last
  item the same effort as the first; if you find yourself writing to a
  template by the last item, stop and re-read that item's own prompt.
- Do not set or add any `review_status` field.
- Do not modify any file other than this run's reply files. Do not edit any
  `.prompt.md`. Do not run tools to fetch external content.

Step 4: Ingest and Repair — one slug at a time, inline only

For each slug, run:

.venv/bin/python -m generate_content.generate_examples ingest --type vocab --slug <slug> --model <this session's model name>

If ingestion succeeds, the item is merged into the sidecar
`curriculum/vocabulary/examples.json` and its prompt and reply files
are deleted — record it as successful and move to the next slug.

If ingestion fails, the process rewrites `<slug>.prompt.md` with the
validation errors appended. Do not regenerate from scratch. Since this
session has no subagent to delegate a large repair to, **fix inline yourself
regardless of error count** — this is the one deliberate difference from the
subagent workflow's "7+ errors → subagent" rule:

  Read the validation errors appended to `<slug>.prompt.md`. Inspect the
  existing `<slug>.reply.md` and the output contract. Edit `<slug>.reply.md`
  to resolve every reported error.

  - Make the smallest changes necessary; preserve valid sentences. Do not
    rewrite every sentence unless the errors make that unavoidable. Fix all
    reported errors, not only the first.
  - Edit only `<slug>.reply.md`; never `<slug>.prompt.md`, never a validator,
    ingestion code, the allowed-vocab derivation, curriculum source data, or
    the assembled sidecar.
  - Keep every sentence using the target, every `vocabulary_slugs` entry in
    that prompt's allowed list, and every content word in that prompt's allowed lists.
  - Keep every Japanese sentence fully annotatable by the tokenizer (avoid
    constructions that fail the furigana round-trip).
  - Keep the reply format (a single fenced ```json block), the output
    contract, 2–4 sentences, plain prose, valid JSON, no commentary, no
    `review_status`.

Then run ingestion again. Retry budget, per slug: attempt 1 (Step 3's draft),
attempt 2 (first inline repair), attempt 3 (second inline repair). If attempt
3 still fails, make ONE last-resort inline fix and run ingestion a fourth and
final time. If that also fails, stop retrying this slug, record it as
skipped, preserve its latest validation errors for the final report, and move
to the next slug — a failure never touches another slug's already-passed
files.

Step 5: Run `generate.py`, Then Stop — Do Not Run the Rest of the Final Build

As soon as Step 4 finishes (all slugs attempted, whether passed or skipped),
run `generate.py` in this same session:

cd curriculum/_build && .venv/bin/python generate.py

`generate.py` lives at `curriculum/_build/generate.py` and needs that
directory's venv interpreter — never shorten it to a bare
`generate.py`, which fails with `command not found`. It builds every level
(it takes no level flag). It inlines the examples sidecar into the shipped
`curriculum/vocabulary/items.json` and adds furigana with the tokenizer.

Do NOT run `npm run validate-schema` or `npm run compile-curriculum` in this
session — run those once from the repository root after every session
covering this batch has finished:

npm run validate-schema
npm run compile-curriculum

If the curriculum studio's `web/server` is already running, its curriculum
index is an in-memory cache loaded at startup with no file watcher. After the
Final Build, hit `POST /api/reload` (the studio header's Reload button) or
restart the server before checking the result in the studio.

---

Final Report (for this session)

- <level>, <slug-count>, and the exact auto-selected slug set for this
  session (with the count vs. <slug-count>)
- The model used for drafting and for `--model` provenance
- ✅ Successfully generated slugs
- ⚠️ Skipped slugs, with their latest validation errors
- Repair attempts used per affected slug (all inline in this shape)
- Roughly how many slugs remain not-yet-done for the level (re-run Step 1 to
  get the count)
- Confirmation that `generate.py` was run, and that
  `npm run validate-schema` / `npm run compile-curriculum` were NOT run in
  this session

Do not modify or set `review_status` to `reviewed` — that is a manual human
Phase 5 step this automation must never perform.

---

Important Constraints

- No subagents. This session drafts every reply itself.
- Auto-select only — never hand-pick or paste a slug list.
- Ingestion, the gate, repairs and the attempt budget are per slug, always.
- Do not bypass or weaken validation. Do not modify validator or ingestion
  code, the allowed-vocab derivation, the prompt templates, or curriculum
  source data to make invalid content pass.
- Style anchors are reference only — never copy or adapt them.
- Do run `generate.py` at the end of this session (Step 5).
  Do not run `npm run validate-schema` or `npm run compile-curriculum` here.
- No browser, no clipboard, no downloads.

---

Notes on differences from the subagent workflow

- No subagent is spawned at any point; this session both drafts and ingests.
  <slug-count> IS this session's whole unit of work.
- Every repair is inline, regardless of error count — the subagent
  workflow's "7+ errors → repair subagent" branch does not apply here.
- `generate.py` runs at the end of every session (Step 5); only
  `validate-schema` and `compile-curriculum` are deferred to one run after
  the last session.
- Everything else is identical: the same auto-select, the same
  `webprompts`/`ingest` commands and gate, the same per-slug retry budget,
  the same sidecar, and the same draft/`review_status` discipline.

---

Last step of every run: commit, then end with the level status

Do this after the workflow above is complete and before you write the final
report. Use `git status --porcelain` to see the changed files.

1. Decide if this run has issues. It has issues if one of these is true:
   - an item (slug, point or seed) was skipped or failed, or still has
     validation errors;
   - a command stopped with an error that you did not resolve (Step 1
     problems included);
   - a file changed outside `curriculum/` (ignore `.DS_Store`).
2. No issues: stage only the changed files under `curriculum/`, by name
   (never `git add -A` or `git add .`), and commit on the current branch.
   Message: `feat(content): <what this run made> for level <level>`, for
   example `feat(content): draft radical mnemonics for level 15`. Do not push.
   If no file changed, do not commit.
3. Issues: do not stage and do not commit. Leave every change in the working
   tree for the maintainer, and name each issue in the final report.
4. Re-run Step 1 for the same level(s). The last line of the final report is
   exactly one of these two lines:

   LEVEL_STATUS: done
   LEVEL_STATUS: more

   `done` means Step 1 now selects nothing. `more` means items are still left.
   `scripts/run-content-lane.sh` reads this line to choose the next run.
