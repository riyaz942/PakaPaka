# Generating kanji + radical mnemonics via web chat (no API cost)

This is the **no-API alternative** to the Message Batches driver for producing
the Phase 2b kanji + radical mnemonics (`docs/content/content-pipeline-plan.md`, 2b). The
N5 set (76 radicals + 106 kanji) was generated through the API for a few dollars;
regenerating a level, or extending to N4, can instead be done by pasting each
item's prompt into a Claude or Gemini web chat (covered by a flat subscription)
and feeding the reply back through the **same context builder and the same
mechanical gate** the API path uses. Only the "call the model" step moves to the
browser — nothing about the decomposition constraint, the reading constraint, the
cast injection, or the validation changes.

For a copy-paste browser-automation task (Gemini web), see
[`kanji-radical-mnemonic-web-chat-workflow-automation-prompt.md`](./kanji-radical-mnemonic-web-chat-workflow-automation-prompt.md).

Everything runs from `curriculum/_build` with the existing venv:

```bash
cd curriculum/_build
# .venv already exists; it does NOT need the anthropic package for this workflow.
```

The one command you use is the mnemonic generator with two subcommands,
`webprompts` and `ingest`. **Every command takes `--type kanji` or
`--type radical`** — the two content types are generated separately:

```bash
.venv/bin/python -m generate_content.generate_mnemonics webprompts --type kanji   --level n5 --slugs <slug,slug,...>
.venv/bin/python -m generate_content.generate_mnemonics ingest     --type kanji   --level n5 --slug <slug> --model <claude-web|gemini-web>
```

Working files live under
`curriculum/_build/generate_content/web/mnemonics/<level>/<type>/` and are
**gitignored** (like `drafts/`) — they are throwaway. The committed artifact is
**not** a per-item file (that's how grammar lessons work); it is the per-level,
keyed-by-slug **sidecar** that `ingest` merges each passing item into:

- kanji → `curriculum/kanji/mnemonics/<level>.json`
- radicals → `curriculum/radicals/mnemonics/<level>.json`

`generate.py` inlines those sidecars into the shipped kanji/radical JSON at build
time (kanji get `meaning_mnemonic` / `reading_mnemonic` / `description`; radicals
get their vivid `mnemonic_text`), each carrying `_meta.review_status: draft`.

---

## Why this is safe to do by hand

The expensive, error-prone parts are automated; only copy/paste is manual.

- **The taught decomposition, the reading target, and the cast character** are
  computed from the curriculum and baked into each prompt — you never pick these
  yourself. The kanji prompt lists the *exact* taught radicals (from
  `dependencies/graph.json`, in our radical names) the meaning mnemonic must be
  built from, the primary reading the reading mnemonic must contain, and the
  fixed cast character for that reading (from `prompts/cast-bible.md`).
- **The mechanical gate** (`validate_mnemonics.py`) runs on ingest exactly as it
  does in the API path: it rejects a meaning mnemonic that ignores a taught
  component, a reading mnemonic missing the target reading, unsupported markdown,
  and out-of-bounds lengths. A reply that passes the gate is as constraint-clean
  as an API-generated one.
- **Provenance is honest:** the `--model` you pass is recorded in the sidecar
  entry's `_meta.generator_model` (`claude-web` / `gemini-web`), so a reviewer can
  see which items came from which model.

What you *do* still owe each item is a **human read** plus a **cross-batch
cast-coherence pass** (Phase 5). The gate proves an item is *in-constraints*; it
does not prove the story is *good* or that the cast stays consistent across
independent chats. Read the assembled mnemonics before flipping `review_status`
to `reviewed`.

---

## The loop (one item)

### 1. Generate the prompt

```bash
.venv/bin/python -m generate_content.generate_mnemonics webprompts --type kanji --level n5 --slugs n5-higashi
```

Writes `generate_content/web/mnemonics/n5/kanji/n5-higashi.prompt.md`. Open it.
Everything below the `<!-- ... -->` header is one self-contained block: the
teaching-voice sheet, the character + meaning + readings, the taught
decomposition, the cast block, the formatting rules, and a JSON output contract.

### 2. Paste into a chat

Open a **fresh** Claude or Gemini chat (fresh = no prior context bleeding in).
Paste **everything below the header comment** — the `<!-- ... -->` block is an
instruction to *you*, not part of the prompt, and pasting it wastes context. One
item per chat.

- **Claude web:** use the most capable model available to your plan.
- **Gemini:** use its most capable model. Same prompt works; the gate is the
  equalizer.

The model should reply with a single ```json block. If it adds chatter before or
after, that's fine — the ingest step extracts the JSON object regardless.

### 3. Save the reply

Copy the model's **entire** reply (the whole ```json block, or the raw JSON — both
work) into the reply path the prompt header names:

```
generate_content/web/mnemonics/n5/kanji/n5-higashi.reply.md
```

The filename must match the slug and the `--type` subfolder.

The JSON keys the model must return depend on the type:

| Type | Required JSON keys |
|---|---|
| `kanji` | `meaning_mnemonic`, `reading_mnemonic`, `description` |
| `radical` | `mnemonic_text` |

### 4. Ingest

```bash
.venv/bin/python -m generate_content.generate_mnemonics ingest --type kanji --level n5 --slug n5-higashi --model claude-web
```

**On pass:** it merges the item into `curriculum/kanji/mnemonics/n5.json`
(`_meta.review_status: draft`) and reports the new sidecar count. Done — move to
the next item.

**On failure:** it prints the gate errors, does *not* merge, and **rewrites the
prompt file with the errors appended** (an "earlier draft failed mechanical
validation" section). Re-roll:

1. Open the rewritten `web/mnemonics/n5/kanji/n5-higashi.prompt.md`.
2. Paste it into a fresh chat (or say "regenerate fixing these" in the same chat —
   the errors are now in the prompt).
3. Save the new reply over `n5-higashi.reply.md`.
4. Run `ingest` again.

The common kanji failures are a meaning mnemonic that skipped a taught component,
or a reading mnemonic missing the target kana; the appended feedback names the
exact offender, and the model usually fixes it on the second try. If an item
fights the gate for 3+ rolls, skip it and come back — don't burn a session on one
stubborn item.

---

## Doing a batch efficiently

`webprompts` accepts a comma-separated `--slugs` list (and defaults to **every**
item of the type when you omit `--slugs`), so generate a screenful at once, then
work them one chat at a time:

```bash
# list the remaining (not-yet-generated) N5 kanji slugs
.venv/bin/python - <<'PY'
import json, os, sys; sys.path.insert(0, '.')
from generate_content import mnemonic_context as mc
level, kind = 'n5', 'kanji'            # kind: 'kanji' or 'radical'
subdir = 'kanji' if kind == 'kanji' else 'radicals'
sidecar = f'../{subdir}/mnemonics/{level}.json'
done = set(json.load(open(sidecar))) if os.path.exists(sidecar) else set()
todo = [s for s in mc.all_slugs(level, subdir) if s not in done]
print(f'{len(todo)} {level} {kind} items left:')
print(','.join(todo))
PY
```

Paste that comma list into `webprompts --type kanji --slugs ...`. Work in
curriculum order (the list is already sorted by `sort_order`). Do **radicals
before kanji** — kanji meaning mnemonics are built from radical names, so the
radical set should be settled (and reviewed) first. And do N5 fully before N4
(`--level n4`).

A practical cadence: batch ~10 prompts, then do the paste → save → ingest loop for
each. Keep a terminal open in `curriculum/_build` and a browser tab on the chat.

---

## After a batch of mnemonics is assembled

The sidecars are drafts inlined at build time; nothing ships until you rebuild and
validate. From the **repo root** (check the current `generate.py` invocation under
`curriculum/_build/` first — it is the source of truth if it drifts from this
doc):

```bash
# 1. inline the sidecars into the kanji/radical JSON
cd curriculum/_build && .venv/bin/python generate.py --level n5 && cd -
# 2. validate + compile
npm run validate-schema
npm run compile-curriculum
```

Then review the assembled mnemonics (Phase 5) — read them, run the cross-batch
cast-coherence check, and set `_meta.review_status: reviewed` on each entry in the
sidecar once it clears. `compile-curriculum` warns on `draft` content, and CI can
fail on it, so unreviewed prose can't silently ship.

> The `mnemonics/` sidecar directories are deliberately **excluded** from
> `validate-schema`'s file walk (they are keyed-by-slug build inputs, not
> standalone curriculum files); their contents are validated once `generate.py`
> inlines them into `kanji/<level>.json` / `radicals/<level>.json`.

---

## Quick reference

| Step | Command / action |
|---|---|
| Make prompts | `... webprompts --type kanji --level n5 --slugs a,b,c` |
| Paste | one item per fresh Claude/Gemini chat (skip the header comment) |
| Save reply | `web/mnemonics/<level>/<type>/<slug>.reply.md` |
| Ingest + gate | `... ingest --type kanji --level n5 --slug a --model claude-web` |
| On gate failure | reopen the rewritten `<slug>.prompt.md`, re-roll, re-save, re-ingest |
| After a batch | `generate.py` → `npm run validate-schema` → `npm run compile-curriculum` → human review |

The prompts, the context builder (`mnemonic_context.py`), the cast loader
(`cast.py`), and the gate (`validate_mnemonics.py`) are shared with the API batch
path — this workflow only swaps *how the model is called*. If you later want to
batch a large tranche through the API instead, `run` / `collect` still work
unchanged (`docs/content/content-pipeline-plan.md`, Phase 2b).
