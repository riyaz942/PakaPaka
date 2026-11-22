# Generating radical/kanji/vocabulary mnemonics via web chat (no API cost)

This is the **no-API alternative** to the Message Batches driver for producing the
radical descriptions, kanji mnemonics and vocabulary mnemonics
(`docs/content/content-pipeline-plan.md`, 2b + 2d). The first set was generated
through the API for a few dollars; regenerating items under Rev 1's
`prompt_version: 2`, or writing the new items of a ladder level (a number from 1 to 60),
can instead be done by pasting each item's
prompt into a Claude or Gemini web chat (covered by a flat subscription) and feeding
the reply back through the **same context builder and the same mechanical gate** the
API path uses. Only the "call the model" step moves to the browser — nothing about
the decomposition constraint, the reading constraint, the look-alike list, the cast
injection, or the validation changes.

For a copy-paste browser-automation task (Gemini web), see
[`radical-kanji-vocab-mnemonic-web-chat-workflow-automation-prompt.md`](./radical-kanji-vocab-mnemonic-web-chat-workflow-automation-prompt.md).
For a no-browser variant that produces replies with in-session subagents — same
`webprompts`/`ingest` commands, same gate, but one subagent per small group of
related items so their scenes can be kept distinct — see
[`radical-kanji-vocab-mnemonic-subagent-workflow-automation-prompt.md`](./radical-kanji-vocab-mnemonic-subagent-workflow-automation-prompt.md).
Ingestion and repair stay per item in every lane.

Everything runs from `curriculum/_build` with the existing venv:

```bash
cd curriculum/_build
# .venv already exists; it does NOT need the anthropic package for this workflow.
```

The one command you use is the mnemonic generator with two subcommands,
`webprompts` and `ingest`. **Every command takes `--type radical`, `--type kanji`,
`--type vocab` or `--type grammar`** — the content types are generated separately;
radical, kanji and vocab in that order, grammar at any time (see "Grammar" and
"Doing a batch efficiently" below). Slugs are existing curriculum ids — list
them first (see "List remaining slugs" below), then pass them to `webprompts`:

```bash
.venv/bin/python -m generate_content.generate_mnemonics webprompts --type kanji   --level 6     # or --levels 1-20, or --slugs <slug,slug,...>
.venv/bin/python -m generate_content.generate_mnemonics ingest     --type kanji   --slug <slug> --model <claude-web|gemini-web>
```

Working files live under
`curriculum/_build/generate_content/web/mnemonics/level-NN/<type>/` (NN = the
item's ladder level, two digits: `level-06`) and are
**gitignored** (like `drafts/`) — they are throwaway. The committed artifact is
**not** a per-item file (that's how grammar lessons work); it is the
keyed-by-slug **sidecar** (one file for every level) that `ingest` merges each
passing item into:

- radicals → `curriculum/radicals/mnemonics.json`
- kanji → `curriculum/kanji/mnemonics.json`
- vocabulary → `curriculum/vocabulary/mnemonics.json`

`generate.py` inlines those sidecars into the shipped JSON at build time (kanji and
vocabulary get `meaning_mnemonic` / `reading_mnemonic`; radicals get
`mnemonic_text`; all three get a `description` only when the item needed one),
each carrying `_meta.review_status: draft`.

---

## Why this is safe to do by hand

The expensive, error-prone parts are automated; only copy/paste is manual.

- **The taught decomposition, the reading target, the look-alikes and the cast
  character** are computed from the curriculum and baked into each prompt — you
  never pick these yourself. The kanji prompt lists the *exact* taught radicals
  (from `dependencies/graph.json`, in our radical names) the meaning mnemonic must
  be built from, along with each radical's established `mnemonic_text` so the story
  continues that image; the primary reading the reading mnemonic must contain; the
  reviewed look-alike pairs (from `_build/visually_similar.py`) the description must
  contrast; and the fixed cast character for that reading (from
  `prompts/cast-bible.md`). The vocab prompt adds the component kanji's meaning
  mnemonics, the word's **part of speech** (distilled from JMdict by
  `import/build_vocab_word_types.py`), whether the word simply *is* one of its
  kanji, the computed **reading composition** (jukugo, kun'yomi, a mix, plus any
  rendaku or gemination — the field that ships on the page), and the
  **mechanically computed reading regularity**, which decides whether the word
  gets a full reading story, a one-sentence pointer back at the word that
  already taught the reading, or — for the derivable majority — no reading
  mnemonic at all.
- **The mechanical gate** (`validate_mnemonics.py`) runs on ingest exactly as it
  does in the API path: it rejects a meaning mnemonic that ignores a taught
  component, a reading mnemonic missing the target reading, a description that
  skips a reviewed look-alike or invents one, a reading mnemonic written for a
  vocabulary word whose reading needs none, a back-reference that never names
  the word it points at, unsupported markdown, and out-of-bounds lengths. A reply that passes the gate is as constraint-clean
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

## List remaining slugs

Slugs already exist as curriculum ids (`east` is one kanji; they live in
`curriculum/{radicals|kanji|vocabulary}/items.json`). `webprompts` writes a
prompt *for* a slug; it does not invent the slug. From `curriculum/_build`, list
the items of this type that have **no** sidecar entry yet:

```bash
# list the remaining (not-yet-generated) level 6 kanji slugs
.venv/bin/python - <<'PY'
import json, os, sys; sys.path.insert(0, '.')
from generate_content import mnemonic_context as mc
from generate_content.generate_mnemonics import default_slugs
level, kind = 6, 'kanji'               # kind: 'radical', 'kanji', 'vocab' or 'grammar'
todo = default_slugs(kind, [level])
print(f'{len(todo)} level {level} {kind} items left:')
print(','.join(todo))
PY
```

Take one slug from that list for the one-item loop below, or keep the whole comma
list for a batch. `--level 6` instead of `--slugs` writes a prompt for **every**
item of that level with no sidecar entry yet — the same list.

> The snippet lists items that have **no** sidecar entry yet. After a
> `PROMPT_VERSION` bump the existing entries are stale, not done: name them with
> `--slugs` and let `ingest` overwrite. The API path's `run --level` takes the
> same items as this list; `run --slugs` regenerates the named ones.
> `PROMPT_VERSION` is keyed by type (`{"radical": 1, "kanji": 4, "vocab": 6, "grammar": 1}`),
> because the four prompts move independently. Radicals sitting at 1 is
> deliberate: Rev 3 reverted the radical contract to the original shape — a
> `mnemonic_text` of ~150–300 characters, description demoted to optional — so a
> draft written under the original prompt is exactly what the current one asks
> for, and is correctly not re-selected.

---

## The loop (one item)

### 1. Generate the prompt

`east` is a worked example. Substitute a slug from the list above.

```bash
.venv/bin/python -m generate_content.generate_mnemonics webprompts --type kanji --slugs east
```

Writes `generate_content/web/mnemonics/level-NN/kanji/east.prompt.md` (NN = the level of
`east`). Open it.
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
generate_content/web/mnemonics/level-NN/kanji/east.reply.md
```

The filename must match the slug and the `--type` subfolder.

The JSON keys the model must return depend on the type:

| Type | Required JSON keys | Optional |
|---|---|---|
| `radical` | `mnemonic_text` | `description` |
| `kanji` | `meaning_mnemonic`, `reading_mnemonic` | `description` |
| `vocab` | `meaning_mnemonic`, `reading_mnemonic` | `description` |

`description` is written only when the item has reviewed look-alikes to contrast
(then it is required) or a nuance the mnemonic cannot carry. Omitting it
otherwise is correct, not incomplete.

### 4. Ingest

```bash
.venv/bin/python -m generate_content.generate_mnemonics ingest --type kanji --slug east --model claude-web
```

**On pass:** it merges the item into `curriculum/kanji/mnemonics.json`
(`_meta.review_status: draft`) and reports the new sidecar count. Done — move to
the next item.

**On failure:** it prints the gate errors, does *not* merge, and **rewrites the
prompt file with the errors appended** (an "earlier draft failed mechanical
validation" section). Re-roll:

1. Open the rewritten `web/mnemonics/level-NN/kanji/east.prompt.md`.
2. Paste it into a fresh chat (or say "regenerate fixing these" in the same chat —
   the errors are now in the prompt).
3. Save the new reply over `east.reply.md`.
4. Run `ingest` again.

The common kanji failures are a meaning mnemonic that skipped a taught component,
or a reading mnemonic missing the target kana; the appended feedback names the
exact offender, and the model usually fixes it on the second try. If an item
fights the gate for 3+ rolls, skip it and come back — don't burn a session on one
stubborn item.

---

## Grammar

**Grammar** sits outside the radical → kanji → vocab chain: its prompt uses no
other layer's prose, so it can run at any time. Two conditions instead:
`curriculum/_build/grammar_origins.json` must cover every grammar slug and
carry `"review_status": "reviewed"` (every command with `--type grammar` stops
with an error otherwise — report it, do not edit the file yourself). The gate rules are in
`validate_mnemonics.validate_grammar`: one or two story sentences plus a
Japanese example ending in 。, `<reading>` on the English sound-alike and on the
form's kana, `<grammar>` on the meaning, example words and kanji at or below
the level, and the origin's keyword in the story (or no origin claim at all).
After ingesting grammar, run `generate.py`.

Design: `docs/superpowers/specs/2026-10-17-grammar-mnemonics-design.md`.

## Doing a batch efficiently

`webprompts` accepts a comma-separated `--slugs` list (or `--level` / `--levels`
for every item of those levels with no sidecar entry yet), so generate a screenful at once, then
work them one chat at a time.

Run the listing snippet above. Paste that comma list into
`webprompts --type kanji --slugs ...`. Work in
curriculum order (the list is already sorted by `sort_order`). Do **radicals, then
kanji, then vocabulary** — a kanji story continues its radicals' descriptions and a
vocabulary story hooks into its kanji's meaning mnemonics, so each layer must be
settled (and ideally reviewed) before the layer built on it, and `generate.py` has
to be re-run between layers so the next layer's prompts read the new prose. And do
one level fully before the next.

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
cd curriculum/_build && .venv/bin/python generate.py && cd -
# 2. validate + compile
npm run validate-schema
npm run compile-curriculum
```

Then review the assembled mnemonics (Phase 5) — read them, run the cross-batch
cast-coherence check, and set `_meta.review_status: reviewed` on each entry in the
sidecar once it clears. `compile-curriculum` warns on `draft` content, and CI can
fail on it, so unreviewed prose can't silently ship.

> The `mnemonics.json` sidecars are deliberately **excluded** from
> `validate-schema`'s file walk (they are keyed-by-slug build inputs, not
> standalone curriculum files); their contents are validated once `generate.py`
> inlines them into `kanji/items.json` / `radicals/items.json`.

---

## Quick reference

| Step | Command / action |
|---|---|
| List remaining slugs | the Python snippet under "List remaining slugs" |
| Make prompts | `... webprompts --type <radical|kanji|vocab> --level 6` (or `--slugs a,b,c`) |
| Paste | one item per fresh Claude/Gemini chat (skip the header comment) |
| Save reply | `web/mnemonics/level-NN/<type>/<slug>.reply.md` |
| Ingest + gate | `... ingest --type kanji --slug a --model claude-web` |
| On gate failure | reopen the rewritten `<slug>.prompt.md`, re-roll, re-save, re-ingest |
| After a batch | `generate.py` → `npm run validate-schema` → `npm run compile-curriculum` → human review |

The prompts, the context builder (`mnemonic_context.py`), the cast loader
(`cast.py`), and the gate (`validate_mnemonics.py`) are shared with the API batch
path — this workflow only swaps *how the model is called*. If you later want to
batch a large tranche through the API instead, `run` / `collect` still work
unchanged (`docs/content/content-pipeline-plan.md`, Phase 2b).
