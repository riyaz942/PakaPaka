# Generating grammar lessons via web chat (no API cost)

This is the **no-API alternative** to the Message Batches driver for producing
grammar lessons for a ladder level (`docs/content/content-pipeline-plan.md`, step 4).
The unit of work is a **ladder level** (a number from 1 to 60; content before release
is levels 1-20). Writing lessons through the API costs money per point. Instead, you paste each point's prompt
into a Claude or Gemini web chat (covered by a flat subscription) and feed the
reply back through the **same context builder and the same mechanical gate** the
API path uses. Only the "call the model" step moves to the browser — nothing about
the quality bar, vocabulary constraints, or validation changes.

For a copy-paste browser-automation task (Gemini web), see
[`grammar-web-chat-workflow-automation-prompt.md`](./grammar-web-chat-workflow-automation-prompt.md).
For the no-browser lane — same prompts, same gate, lessons written by in-session
subagents — see
[`grammar-subagent-workflow-automation-prompt.md`](./grammar-subagent-workflow-automation-prompt.md).

Everything runs from `curriculum/_build` with the existing venv:

```bash
cd curriculum/_build
# .venv already exists; it does NOT need the anthropic package for this workflow.
```

The one command you use is the grammar generator with two new subcommands,
`webprompts` and `ingest`. Slugs are existing grammar-point ids — list them first
(see "List remaining slugs" below), then pass them to `webprompts`:

```bash
.venv/bin/python -m generate_content.generate_grammar_lessons webprompts --level <N> [--slugs <slug,slug,...>]
.venv/bin/python -m generate_content.generate_grammar_lessons ingest     --slug <slug> --model <claude-web|gemini-web>
```

`webprompts` takes `--level N`, `--levels 1-20` or `--slugs a,b` (use one of the three).
A level run picks only the points of that level that have **no lesson file yet**. Use
`--slugs` to rewrite a point that has a lesson already. `ingest` needs only `--slug`: the
level comes from the point.

Files live under `curriculum/_build/generate_content/web/grammar/level-NN/` (NN = the
point's level, two digits) and are
**gitignored** (like `drafts/`) — they are throwaway working files. The committed
artifact is the assembled lesson at `curriculum/grammar/lessons/<slug>.md`.

---

## Why this is safe to do by hand

The expensive, error-prone parts are automated; only copy/paste is manual.

- **Allowed vocabulary, taught siblings, style anchors** are computed from the
  curriculum and baked into each prompt — you never pick these yourself.
- **The mechanical gate** (`validate_drafts.py`) runs on ingest exactly as it does
  in the API path: it rejects words above the point's level, missing pattern usage, furigana
  failures, unsupported markdown, and slug typos. A sentence may use only words at or
  below the point's level. A reply that passes the gate is
  as constraint-clean as an API-generated one.
- **Furigana is never written by the model** — the build pipeline (`generate.py`)
  adds it mechanically. You (and the chat) only ever write plain Japanese.
- **Provenance is honest:** the `--model` you pass is recorded in the lesson's
  frontmatter (`generator_model: claude-web` / `gemini-web`), so a reviewer can see
  which lessons came from which model.

What you *do* still owe each lesson is a **human read** (Phase 5). The gate proves
a lesson is *in-constraints*; it does not prove it is *good*. Read every assembled
lesson in the app's lesson renderer before flipping `review_status` to `reviewed`.

---

## List remaining slugs

Slugs already exist as grammar-point ids (`mo-also` is one; they live in the
grammar catalog `context.load_grammar` reads). `webprompts` writes a prompt
*for* a slug; it does not invent the slug. From `curriculum/_build`, list the
points that have **no** assembled lesson yet:

```bash
# list the remaining (unwritten) grammar slugs of levels 1-20
.venv/bin/python - <<'PY'
import os, sys; sys.path.insert(0, '.')
from generate_content import context
levels = range(1, 21)   # one level: range(6, 7)
done = {f[:-3] for f in os.listdir('../grammar/lessons') if f.endswith('.md')}
todo = [g['slug'] for g in context.load_grammar() if g['level'] in levels and g['slug'] not in done]
print(f'{len(todo)} levels {levels.start}-{levels.stop - 1} points left:')
print(','.join(todo))
PY
```

Take one slug from that list for the one-item loop below, or keep the whole comma
list for a batch.

---

## The loop (one grammar point)

### 1. Generate the prompt

`mo-also` is a worked example. Substitute a slug from the list above.

```bash
.venv/bin/python -m generate_content.generate_grammar_lessons webprompts --slugs mo-also
```

Writes `generate_content/web/grammar/level-NN/mo-also.prompt.md` (NN = the level of `mo-also`). Open it. Everything below the
`<!-- ... -->` header is one self-contained block: the teaching-voice sheet, the
grammar point, the exact allowed vocabulary, taught/upcoming siblings, the style
anchors, the formatting rules, and a JSON output contract.

### 2. Paste into a chat

Open a **fresh** Claude or Gemini chat (fresh = no prior context bleeding in).
Paste the whole block. One point per chat.

- **Claude web:** use the most capable model available to your plan.
- **Gemini:** use its most capable model. Same prompt works; the gate is the
  equalizer.

The model should reply with a single ```json block. If it adds chatter before or
after, that's fine — the ingest step extracts the JSON object regardless.

### 3. Save the reply

Copy the model's **entire** reply (the whole ```json block, or the raw JSON — both
work) into:

```
generate_content/web/grammar/level-NN/mo-also.reply.md
```

The filename must match the slug. (The prompt file's header comment restates this
path so you don't have to remember it.)

### 4. Ingest

```bash
.venv/bin/python -m generate_content.generate_grammar_lessons ingest --slug mo-also --model claude-web
```

**On pass:** it assembles `curriculum/grammar/lessons/mo-also.md`
(`review_status: draft`), stashes cloze candidates in
`drafts/level-NN/mo-also-cloze-candidates.json`, and deletes the staged
`mo-also.prompt.md` / `mo-also.reply.md`. Done — move to the next point.

**On failure:** it prints the gate errors, does *not* assemble, and **rewrites the
prompt file with the errors appended** (an "earlier draft failed mechanical
validation" section). Re-roll:

1. Open the rewritten `web/grammar/level-NN/mo-also.prompt.md`.
2. Paste it into a fresh chat (or say "regenerate fixing these" in the same chat —
   the errors are now in the prompt).
3. Save the new reply over `mo-also.reply.md`.
4. Run `ingest` again.

Most failures are a stray word above the point's level or a fence/`example_sentences`
mismatch; the appended feedback names the exact offenders, and the model usually
fixes them on the second try. If a point fights the gate for 3+ rolls, skip it and
come back — don't burn a session on one stubborn point.

---

## Doing a batch efficiently

`webprompts` accepts a comma-separated `--slugs` list, so generate a screenful at
once, then work them one chat at a time.

Run the listing snippet above. Paste that comma list into `webprompts --slugs ...`.
Work in curriculum order (the list is already sorted by `sort_order`) so contrast
sections reference points you've already seen. Work in level order (level 1, then 2, …):
a lesson may use every word at or below its level, so the lower levels should be settled
first.

A practical cadence: batch ~10 prompts, then do the paste → save → ingest loop for
each. Keep a terminal open in `curriculum/_build` and a browser tab on the chat.

---

## After a batch of lessons is assembled

The lessons are drafts inlined at build time; nothing ships until you rebuild and
validate. From the **repo root**:

```bash
# 1. inline the new lesson markdown into the grammar JSON + add furigana
#    (from curriculum/_build: .venv/bin/python generate.py — it builds every level;
#     add --report-pool to print grammar pool failures and continue)
# 2. validate + compile
npm run validate-schema
npm run compile-curriculum
```

Then review the assembled lessons in the app's lesson renderer (Phase 5) and set
`review_status: reviewed` in each lesson's frontmatter once it clears. `compile-curriculum`
warns on `draft` content, and CI can fail on it, so unreviewed prose can't silently
ship.

> Check `curriculum/_build/generate.py --help` for the current invocation before the
> first compile of a session — the pipeline commands there are the source of truth
> if they drift from this doc.

---

## Quick reference

| Step | Command / action |
|---|---|
| List remaining slugs | the Python snippet under "List remaining slugs" |
| Make prompts | `... webprompts --level 6` or `... webprompts --slugs a,b,c` |
| Paste | one point per fresh Claude/Gemini chat |
| Save reply | `web/grammar/level-NN/<slug>.reply.md` |
| Ingest + gate | `... ingest --slug a --model claude-web` |
| On gate failure | reopen the rewritten `<slug>.prompt.md`, re-roll, re-save, re-ingest |
| After a batch | `generate.py` → `npm run validate-schema` → `npm run compile-curriculum` → human review |

The prompts, the allowed-vocab derivation (`context.py`), the gate
(`validate_drafts.py`), and the assembler (`assemble.py`) are shared with the API
batch path — this workflow only swaps *how the model is called*. If you later want
to batch a large tranche through the API instead, `run` / `collect` still work
unchanged (`docs/content/content-pipeline-plan.md`, Phase 2a).
