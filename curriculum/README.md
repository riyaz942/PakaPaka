# Curriculum JSON source

Authoritative curriculum content for the mobile app. JSON files here are validated and compiled to `mobile/assets/curriculum-seed/curriculum.db` (Git LFS).

## Layout

- `schema/curriculum.schema.json` — JSON Schema (`$defs` per file type)
- `metadata.json` — semantic version and maintainer counts
- `radicals/`, `kanji/`, `vocabulary/`, `grammar/`, `readings/` — one generated `items.json` per
  item type (`readings/items.json` holds `passages`). Every item has a `level` (1–60) and a
  `sort_order` that runs through the whole file: by level, then the order inside the level
- `radicals/mnemonics.json`, `kanji/mnemonics.json`, `vocabulary/mnemonics.json`,
  `vocabulary/examples.json` and `grammar/lessons/<slug>.md` — generated content, one file (or
  one lesson) for every level, keyed by slug. `_build/generate.py` inlines it into the item
  files, so moving an item to another level does not move its content
- `dependencies/graph.json` — precomputed radical → kanji → vocabulary edges. Every kanji → word
  edge is `requires` (gates the lesson): the ladder never puts a kanji after a word written with
  it

**N5 and N4 are authored in full. The derived kanji, radicals and words carry item lists,
readings and meanings** — no examples, mnemonics, grammar or passages of their own.

### Levels

Every radical, kanji, word, grammar point and passage sits on one of 60 levels.
`_build/ladder.py` assigns them (rules: `docs/superpowers/specs/2026-11-18-level-ladder-design.md`
§7.2): kanji in the order that completes the most common words, then each radical at the level of
the first kanji that uses it, each word at the later of its last kanji and its frequency slot,
grammar in teaching order, and each passage at the highest level of its words and grammar.

`_build/ladder.json` holds the result and **is checked in**. CI does not run `ladder.py`, because
it reads KANJIDIC2 and KanjiVG, which are not committed. After a change to a dataset or to
`levels.json`, re-run it yourself:

```bash
curriculum/_build/import/fetch_sources.sh --kanjivg   # data/kanjidic2.xml.gz, data/kanjivg-main.zip
curriculum/_build/.venv/bin/python curriculum/_build/ladder.py
```

It exits 1 when a move puts a kanji before one of its radicals or a word before one of its kanji.
[`_build/reports/ladder-report.md`](_build/reports/ladder-report.md) shows the levels
(`reports/ladder_report.py`).

### Moving an item to another level

**Edit `_build/levels.json` only.** It maps `"<kind>:<slug>"` to a level from 1 to 60, for any
radical, kanji, word, grammar point or passage, and it wins over the ladder's level. Then run
`ladder.py` and every step in [Regenerating](#regenerating). The slug, the id and the content
files stay the same.

A pinned kanji takes its slot at that level ahead of the ranking, so the level keeps its size.

**A slug does not follow its level, and names no level.** `yen` is `yen` wherever it lands,
because `user.db` and the id registry are keyed by it. `validate-schema` rejects a slug that
starts with `n1-`–`n5-` or `k-`. `_build/slug-renames.json` records every old slug and the slug
that replaced it.

### Regenerating

```bash
curriculum/_build/.venv/bin/python curriculum/_build/ladder.py   # only after a dataset or levels.json change
curriculum/_build/.venv/bin/python curriculum/_build/generate.py --report-pool
curriculum/_build/.venv/bin/python curriculum/_build/generate_deps.py
```

`generate.py` writes all five item files. It exits 1 when `ladder.json` and the datasets do not
name the same items (re-run `ladder.py`), or when a grammar point's sentence pool fails the pool
check; `--report-pool` prints the pool failures and goes on, until the ladder grammar content is
in. CI runs the last two commands and fails when they change a committed file.

### Authoring queue

A mnemonic is owed when a learner *reaches* an item, never because it exists, so only the
N5+N4 bands are in the queue: **2 radicals and 25 kanji** without prose. It lives in
[`_build/reports/kanji-priority.md`](_build/reports/kanji-priority.md) — regenerate with
`python3 curriculum/_build/reports/kanji_priority.py`. Radicals outside the hand-authored
datasets have no art and render as text. See
[docs/content/kanji-coverage-and-dependency-order-plan.md](../docs/content/kanji-coverage-and-dependency-order-plan.md).

## Commands (repo root)

```bash
npm ci
npm run validate-schema
npm run compile-curriculum
```

Set `COMPILE_OUTPUT_PATH` to write elsewhere (CI uses `dist/curriculum.db`). Add
`-- --update-registry` when the change adds or removes an item, passage or question (see
[Item ID assignment](#item-id-assignment)).

## Radical mnemonic images (FR37b)

**Decision:** radical images live **in the repo and are bundled with the app** — no CDN, and **no kanji images**. Files go under `mobile/assets/radicals/{slug}.webp` (Git LFS preferred), with a hard per-image size budget so the pack stays small (~5–12 MB for ~150 radicals). The path holds no level, so art does not move when a radical rebands.

Curriculum rows will point at those bundled assets (schema/app wiring lands with Phase 3). Seed data may still carry legacy placeholder `https://…` values until then; the app shows **text fallback** when an image is missing — that is expected, not a hosting plan.

See **[docs/content/radical-mnemonic-images.md](../docs/content/radical-mnemonic-images.md)** for asset spec, paths, size budget, and verification.

## Item ID assignment

`user.db` stores progress by id, so an id never changes after it first ships. Compile reads every id from [`id-registry.json`](id-registry.json), which has one section for each id space:

| Section | Key | Table |
| --- | --- | --- |
| `items` | `<item_type>:<slug>` | `items.id` |
| `passages` | `passage:<slug>` | `reading_passages.id` |
| `passage_questions` | `<passage-slug>#<question index>` | `passage_questions.id` |

Moving an item to a different level, re-sorting, or adding items elsewhere does not change an id. Each section has `next_id`, `ids`, `retired` and `aliases`.

- **Add an item, passage or question:** run `npm run compile-curriculum -- --update-registry`, then commit the registry. The new key gets `next_id`.
- **Remove one:** the same command moves its key to `retired`. The id is never given to a different key.
- **Rename a slug after launch:** add `"<old key>": "<new key>"` to `aliases`. The new key keeps the old id.
- **Never edit an id by hand.**

Without `--update-registry`, the compile fails when a key has no id, or when a registry key is not in the build. So CI cannot make or drop an id without a person seeing it.

## Content hash

`curriculum_metadata.content_hash` is SHA-256 over sorted JSON paths under `curriculum/` (excluding `schema/`), each entry: relative path + NUL + file bytes + NUL. `npm run compile-curriculum` runs schema validation first; a failed validation exits before any SQLite write.
