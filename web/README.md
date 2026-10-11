# Curriculum Studio

A local-only web app to view, filter, and edit the curriculum JSON files under
`curriculum/` — a "god's eye view" over radicals, kanji, vocabulary, grammar,
and readings, with direct write-back to the JSON files on disk.

## Run it

From the repo root:

```bash
npm run studio
```

Opens one process (Express + Vite middleware) at http://localhost:4701. There
is a separate `web/package-lock.json` — run `npm install` inside `web/` after
pulling changes that touch its `package.json`.

## What it does

- **Dashboard** — content counts vs `targets.json`, review-status breakdown,
  completeness, recently-drafted items.
- **Content** — filterable tables per content type, showing every match at once (status,
  skeleton, missing field, audit findings, free text).
- **Item detail** — every field rendered (readings, mnemonics, examples,
  dependencies), plus an edit form that writes straight to the source JSON —
  see the write-back rules under Safety notes.
- **Slugs** — paste the slug list from a generation session (bare, `kanji:mizu`,
  or studio URLs; bullets and numbering stripped) and get every matching item
  with its status, completeness and a link into the detail page, plus "Copy
  links" and bulk "Mark reviewed". A bare slug that exists under two content
  types (radical `mizu` vs. vocabulary `mizu`) is shown as **ambiguous** and left
  out of "select all" — pick the right one by hand. Tokens matching nothing are
  listed under Unresolved.
- **Generated** — read-only view of the Phase 4 reading-passage build artifact
  (`curriculum/_build/generate_content/passages/<level>.json`), joined onto the
  seed ladder in `reading_seeds.py` so every planned passage shows either its
  generated text or a `pending` row. Per level: how many of the 30 seeds are
  done, each passage's tone tag, derived word count against the seed's band,
  question count, `_meta` model and review status, and the passage itself
  rendered with derived furigana, translation, summaries, questions and
  grammar/vocabulary chips. **These passages do not ship** — they reach the app
  only after the Phase 5 human read and the wire-in documented in
  `docs/content/phase-4-reading-passage-tooling.md`, so they are deliberately
  outside the shipped index: no target counts, no graph, no completeness, and
  no way to mark them reviewed from here.
- **Graph** — the radical → kanji → vocab → grammar dependency graph
  (Cytoscape + dagre), a per-item neighborhood view, and a "build order" list
  of what's blocked on missing/draft/skeleton prerequisites.
- **Audit** — runs `curriculum/_build/generate_content/audit_shipped.py` and
  browses its findings, with links back into Content.
- **Pipeline** — runs `npm run validate-schema` and
  `npm run compile-curriculum -- --update-registry` from the UI and shows their
  output.
- **Guide** — the generation playbook: stage order, the exact commands per
  content type and lane, and one "how to fix" card per audit check. Every
  completeness percentage, remaining count, missing field and audit finding
  elsewhere in the studio links into the matching section, and each stage links
  back out to the filtered list of items still missing that field.

## Safety notes

- **Writes go straight to `curriculum/`.** There is no undo built into the
  tool — the undo mechanism is `git diff` / `git checkout` on the files it
  touched. Review your changes with git before committing.
- Every save is validated (Ajv schema + furigana checks) before it touches
  disk; a failing edit is rejected and the file is left untouched.
- **`curriculum/{kind}/{level}.json` is generated output.**
  `curriculum/_build/generate.py` rebuilds it from the Python datasets plus the
  mnemonic/example sidecars, so anything written only to the level file is
  destroyed by the next generate run. Every save therefore also writes the
  sidecar generate.py reads back (`server/curriculum/sidecar.ts`), and an edit
  to a field with no sidecar behind it is **refused**, naming the dataset to
  edit instead. Locked fields are shown 🔒 and disabled in the edit form.
  Editable through the studio: radical `mnemonic_text` / `description`; kanji
  and vocabulary `meaning_mnemonic` / `reading_mnemonic` / `description` and
  the `japanese` / `english` / `vocabulary_slugs` of their example sentences;
  review status for everything except reading passages (grammar's goes to its
  lesson frontmatter). Everything else — meanings, readings, accepted answers,
  furigana, word spans, grammar and reading bodies — is authored in
  `curriculum/_build/` and has to be edited there.
- Each content type has one sidecar of each kind for every level, keyed by
  slug (`curriculum/radicals/mnemonics.json`, `curriculum/vocabulary/examples.json`),
  and each grammar point has one lesson (`curriculum/grammar/lessons/<slug>.md`).
  A save never depends on the level the item is taught at.
- The **Pipeline → compile-curriculum** run writes to a scratch path
  (`web/.build/curriculum.db`, gitignored) — it never overwrites
  `mobile/assets/curriculum-seed/curriculum.db`. Run the real
  `npm run compile-curriculum` from the repo root (no `COMPILE_OUTPUT_PATH`
  override) when you actually want to update the shipped seed, then commit it
  through Git LFS as usual.
- The studio compile runs with `--update-registry`, so an item, passage or
  question you added gets an id in `curriculum/id-registry.json` (and a key that
  left the build is retired). Review and commit the registry change. Like every
  compile, it also raises `curriculum/metadata.json` `version` and rewrites its
  `content_counts`. The terminal `npm run compile-curriculum` stays strict: with
  no flag it fails on a key that has no id.
- This tool never writes to `curriculum/_build/` or
  `curriculum/dependencies/graph.json`. It does write the `*/mnemonics.json` and
  `*/examples.json` sidecars — those are the generator's *inputs*, and the only
  place an edit survives a regeneration.

## Targets and audit

- `web/targets.json` holds the per-level, per-type content targets shown on
  the Dashboard ("remaining to generate"). It's not derived from anything —
  edit it by hand as goals change.
- Audit findings come from `curriculum/_build/reports/content-audit-{n5,n4}.json`,
  written by the "Run audit" button (or by running `audit_shipped.py --json`
  directly). The Content and Item-detail views only reflect whatever the most
  recent report on disk says — re-run the audit after editing content to
  refresh them.
