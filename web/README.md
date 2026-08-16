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
  dependencies), plus an edit form that writes straight to the source JSON.
- **Graph** — the radical → kanji → vocab → grammar dependency graph
  (Cytoscape + dagre), a per-item neighborhood view, and a "build order" list
  of what's blocked on missing/draft/skeleton prerequisites.
- **Audit** — runs `curriculum/_build/generate_content/audit_shipped.py` and
  browses its findings, with links back into Content.
- **Pipeline** — runs `npm run validate-schema` and `npm run compile-curriculum`
  from the UI and shows their output.
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
- The **Pipeline → compile-curriculum** run writes to a scratch path
  (`web/.build/curriculum.db`, gitignored) — it never overwrites
  `mobile/assets/curriculum-seed/curriculum.db`. Run the real
  `npm run compile-curriculum` from the repo root (no `COMPILE_OUTPUT_PATH`
  override) when you actually want to update the shipped seed, then commit it
  through Git LFS as usual.
- This tool never writes to `curriculum/_build/`, `*/mnemonics/`,
  `*/examples/`, or `curriculum/dependencies/graph.json` — those are pipeline
  outputs, not hand-edited sources.

## Targets and audit

- `web/targets.json` holds the per-level, per-type content targets shown on
  the Dashboard ("remaining to generate"). It's not derived from anything —
  edit it by hand as goals change.
- Audit findings come from `curriculum/_build/reports/content-audit-{n5,n4}.json`,
  written by the "Run audit" button (or by running `audit_shipped.py --json`
  directly). The Content and Item-detail views only reflect whatever the most
  recent report on disk says — re-run the audit after editing content to
  refresh them.
