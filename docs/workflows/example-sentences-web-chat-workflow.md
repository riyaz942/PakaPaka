# Generating vocab example sentences via web chat (no API cost)

This is the **no-API alternative** to the Message Batches driver for producing
the Phase 2c example sentences (`docs/content/content-pipeline-plan.md`, 2c).
Example generation for N5/N4 can be run either through the API for a few dollars
or, instead, by pasting each item's prompt into a Claude or Gemini web chat
(covered by a flat subscription) and feeding the reply back through the **same
context builder and the same mechanical gate** the API path uses. Only the "call
the model" step moves to the browser — nothing about the allowed-vocabulary
constraint, the target-word requirement, the level-check, or the furigana
round-trip changes.

**Only vocab gets example sentences here. Do not generate examples for kanji.**
A kanji rarely stands alone as a word, so its sentences only ever show the
vocabulary written with it (説 appears in 説明 and 小説, not by itself). The app
lists that vocabulary on the kanji instead ("Vocabulary using this kanji").
Radicals get no example sentences. Grammar examples are authored with the grammar
lessons, not with this workflow.

For a copy-paste browser-automation task (Gemini web), see
[`example-sentences-web-chat-workflow-automation-prompt.md`](./example-sentences-web-chat-workflow-automation-prompt.md).

Everything runs from `curriculum/_build` with the existing venv:

```bash
cd curriculum/_build
# .venv already exists; it does NOT need the anthropic package for this workflow.
```

The one command you use is the example generator with two subcommands,
`webprompts` and `ingest`. **Every command takes `--type vocab`** (the only
type). Slugs are
existing curriculum ids — list them first (see "List remaining slugs" below),
then pass them to `webprompts`:

```bash
.venv/bin/python -m generate_content.generate_examples webprompts --type vocab --level n5 --slugs <slug,slug,...>
.venv/bin/python -m generate_content.generate_examples ingest     --type vocab --level n5 --slug <slug> --model <claude-web|gemini-web>
```

`--slugs` is **one comma-separated string with no spaces after the commas**
(`watashi,taberu,mizu`). Working files live under
`curriculum/_build/generate_content/web/examples/<level>/<type>/` and are
**gitignored** (like `drafts/`) — they are throwaway. The committed artifact is
**not** a per-item file; it is the keyed-by-slug **sidecar** that `ingest`
merges each passing item into, named by level:
`curriculum/vocabulary/examples/<level>.json`.

`generate.py` inlines that sidecar into the shipped vocab JSON at build
time as each item's `example_sentences`, **adding furigana with the tokenizer**
(bracket notation via `furigana.py`, never the LLM), and each entry carries
`_meta.review_status: draft`.

Slug source (curriculum, sort order): `curriculum/vocabulary/n5.json` (e.g.
`watashi`, `taberu`).

---

## Why this is safe to do by hand

The expensive, error-prone parts are automated; only copy/paste is manual.

- **The allowed vocabulary and the target the sentence must exemplify** are
  computed from the curriculum and baked into each prompt — you never pick these
  yourself. A **vocab** prompt lists the allowed vocab in two parts: "Already
  known" (the item's own `sort_order` prefix + all lower levels + core seeds),
  preferred, and "Coming up next" (the next 50 words of the level), allowed
  when a sentence needs it. Grammar is split the same way. The gate accepts
  both parts and rejects every other word, including words further ahead in
  the same level. The prompt requires every
  sentence to use the word (natural conjugations count: 食べました exemplifies
  食べる) (`example_context.py`).
- **The mechanical gate** (`validate_examples.py`) runs on ingest exactly as it
  does in the API path. It rejects a set that: doesn't actually use the target;
  references a `vocabulary_slugs` outside the allowed set; contains an
  out-of-level content word (tokenizer level-check); has 2–4 sentences violated;
  breaks the length/plain-prose bounds; or — critically — **fails the furigana
  round-trip**, meaning a sentence the shipping tokenizer can't fully annotate is
  a *rejection*, not silent no-furigana. A reply that passes the gate is as
  constraint-clean as an API-generated one.
- **Tatoeba is style anchors only.** In-level Tatoeba sentences may appear in the
  prompt as real-usage references, but no Tatoeba text is ever shipped or adapted
  (ground rule 2). They are fetched optionally via
  `import/fetch_sources.sh --tatoeba`; if absent, the prompt simply has fewer
  anchors — the gate is unaffected.
- **Provenance is honest:** the `--model` you pass is recorded in the sidecar
  entry's `_meta.generator_model` (`claude-web` / `gemini-web`), so a reviewer can
  see which items came from which model.

What you *do* still owe each item is a **human read** (Phase 5). The gate proves
a set is *in-constraints*; it does not prove the sentences are *good, natural, or
varied*. Read the assembled examples before flipping `review_status` to
`reviewed`.

---

## List remaining slugs

Slugs already exist as curriculum ids (`taberu` is one vocab item; they live in
the file named under "Slug source" above). `webprompts` writes a prompt *for*
a slug; it does not invent the slug. From `curriculum/_build`, list the items of
this type that have **no** sidecar entry yet:

```bash
# list the remaining (not-yet-generated) N5 vocab example slugs
.venv/bin/python - <<'PY'
import json, os, sys; sys.path.insert(0, '.')
from generate_content import example_context as ec
level, kind = 'n5', 'vocab'
path = f'../vocabulary/examples/{level}.json'
done = set(json.load(open(path))) if os.path.exists(path) else set()
todo = [s for s in ec.all_slugs(level, kind) if s not in done]
print(f'{len(todo)} {level} {kind} items left:')
print(','.join(todo))
PY
```

Take one slug from that list for the one-item loop below, or keep the whole comma
list for a batch. Omitting `--slugs` writes a prompt for **every** item of the
type — useful for a full-level dump, not for a sitting of ~10.

---

## The loop (one item)

### 1. Generate the prompt

`taberu` is a worked example. Substitute a slug from the list above.

```bash
.venv/bin/python -m generate_content.generate_examples webprompts --type vocab --level n5 --slugs taberu
```

Writes `generate_content/web/examples/n5/vocab/taberu.prompt.md`. Open it.
Everything below the `<!-- ... -->` header is one self-contained block: the
teaching-voice sheet, the word being exemplified, the allowed
vocabulary list, the Tatoeba style anchors, the writing rules, and a JSON output
contract.

### 2. Paste into a chat

Open a **fresh** Claude or Gemini chat (fresh = no prior context bleeding in).
Paste **everything below the header comment** — the `<!-- ... -->` block is an
instruction to *you*, not part of the prompt, and pasting it wastes context. One
item per chat.

- **Claude web:** use the most capable model available to your plan.
- **Gemini:** use its most capable model. Same prompt works; the gate is the
  equalizer.

The model should reply with a single ```json block. If it adds chatter before or
after, that's fine — the ingest step extracts the first JSON object regardless.

### 3. Save the reply

Copy the model's **entire** reply (the whole ```json block, or the raw JSON — both
work) into the reply path the prompt header names:

```
generate_content/web/examples/n5/vocab/taberu.reply.md
```

The filename must match the slug and the `--type` subfolder.

The JSON contract is a single `example_sentences` array, each element carrying
three keys:

| Key | Meaning |
|---|---|
| `japanese` | the sentence, plain Japanese (no furigana/romaji/markdown) |
| `english` | a natural English translation |
| `vocabulary_slugs` | the allowed-list slugs for every vocab word the sentence uses |

### 4. Ingest

```bash
.venv/bin/python -m generate_content.generate_examples ingest --type vocab --level n5 --slug taberu --model claude-web
```

**On pass:** it merges the item into `curriculum/vocabulary/examples/n5.json`
(`_meta.review_status: draft`) and reports the new sidecar count. Done — move to
the next item.

**On failure:** it prints the gate errors, does *not* merge, and **rewrites the
prompt file with the errors appended** (an "earlier draft failed mechanical
validation" section). Re-roll:

1. Open the rewritten `web/examples/n5/vocab/taberu.prompt.md`.
2. Paste it into a fresh chat (or say "regenerate fixing these" in the same chat —
   the errors are now in the prompt).
3. Save the new reply over `taberu.reply.md`.
4. Run `ingest` again.

The common failures are a sentence that never actually uses the target, a
`vocabulary_slugs` reference outside the allowed list, an out-of-level content
word, or a furigana round-trip failure; the appended feedback names the exact
offender, and the model usually fixes it on the second try. If an item fights the
gate for 3+ rolls, skip it and come back — don't burn a session on one stubborn
item.

---

## Doing a batch efficiently

`webprompts` accepts a comma-separated `--slugs` list (and defaults to **every**
item of the type when you omit `--slugs`), so generate a screenful at once, then
work them one chat at a time.

Run the listing snippet above. Paste that comma list into
`webprompts --type vocab --slugs ...`. Work in
curriculum order (the list is already sorted by `sort_order`). Do **N5 fully before N4**
(`--level n4`).

**Pilot first.** Before committing to a full level, run **~10 items** and
read the assembled output. Examples are cheaper to review than grammar lessons
(bulk-skim, 10–20 per screen), but a bad prompt tune shows up fastest on a small
batch. Only widen to the whole level once the pilot reads well.

A practical cadence: batch ~10 prompts, then do the paste → save → ingest loop for
each. Keep a terminal open in `curriculum/_build` and a browser tab on the chat.

---

## After a batch of examples is assembled

The sidecars are drafts inlined at build time; nothing ships until you rebuild and
validate. From the **repo root** (check the current `generate.py` invocation under
`curriculum/_build/` first — it is the source of truth if it drifts from this
doc):

```bash
# 1. inline the sidecar into the vocab JSON (adds tokenizer furigana)
cd curriculum/_build && .venv/bin/python generate.py --level n5 && cd -
# 2. validate + compile
npm run validate-schema
npm run compile-curriculum
```

Then review the assembled examples (Phase 5) — read them and set
`_meta.review_status: reviewed` on each entry in the sidecar once it clears.
`compile-curriculum` warns on `draft` content, and CI can fail on it, so
unreviewed prose can't silently ship.

> The `examples/` sidecar directories are deliberately **excluded** from
> `validate-schema`'s file walk (they are keyed-by-slug build inputs, not
> standalone curriculum files); their contents are validated once `generate.py`
> inlines them into `vocabulary/<level>.json`. The schema rejects
> `example_sentences` on a kanji item.

---

## Quick reference

| Step | Command / action |
|---|---|
| List remaining slugs | the Python snippet under "List remaining slugs" |
| Make prompts | `... webprompts --type vocab --level n5 --slugs a,b,c` |
| Paste | one item per fresh Claude/Gemini chat (skip the header comment) |
| Save reply | `web/examples/<level>/<type>/<slug>.reply.md` |
| Ingest + gate | `... ingest --type vocab --level n5 --slug a --model claude-web` |
| On gate failure | reopen the rewritten `<slug>.prompt.md`, re-roll, re-save, re-ingest |
| After a batch | `generate.py` → `npm run validate-schema` → `npm run compile-curriculum` → human review |

The prompts, the context builder (`example_context.py`), the Tatoeba anchors
(`tatoeba.py`), and the gate (`validate_examples.py`) are shared with the API
batch path — this workflow only swaps *how the model is called*. If you later
want to batch a large tranche through the API instead, `run` / `collect` still
work unchanged (`docs/content/content-pipeline-plan.md`, Phase 2c).
