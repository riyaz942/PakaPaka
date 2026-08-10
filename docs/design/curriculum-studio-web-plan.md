# Curriculum Studio — local web debug tool for curriculum content

A local-only web app to view, filter, and edit the curriculum JSON files — a
"god's eye view" over radicals, kanji, vocabulary, grammar, and readings, with
direct write-back to the JSON files on disk.

**Non-negotiables:** local only (no auth, no hosting), the JSON files under
`curriculum/` are the single source of truth, every save must keep
`npm run validate-schema` green, and diffs must stay minimal (2-space JSON,
key order preserved).

Written 2026-08-10, against the corpus state: 122 radicals, 191 kanji, 1,245
vocabulary, 171 grammar, 19 passages, 1,488 dependency edges (N5 + N4).

---

## Architecture (decided)

| Decision | Choice | Why |
| --- | --- | --- |
| Location | new `web/` package at repo root | User rule: code complies with `web/.eslintrc.js` (created in Chunk 1) |
| Server | Node + Express, run via root's `tsx` | Must write to the filesystem, so a pure SPA is impossible; tsx is already a root devDependency |
| Frontend | React + Vite, TypeScript, mounted as Vite **middleware** inside the Express server | One command (`npm run studio`), one process, HMR in dev, static `web/dist` in "prod" mode |
| Styling | Plain CSS + CSS variables (dark theme), no UI kit | Debug tool; zero extra build config keeps every chunk small |
| Charts | Recharts | Simple, sufficient for bars/donuts |
| Graph viz | Cytoscape + dagre layout | 1,729 nodes / 1,488 edges is too much for hand-rolled SVG; dagre suits the radical→kanji→vocab DAG |
| Validation on save | Reuse `scripts/validate-schema.ts` (Ajv, `$data: true`) | The repo's own gate; the tool must never write content the pipeline rejects |
| Undo / safety net | git (files are tracked) + atomic writes (tmp + rename) | No custom versioning |

Ports: API + UI both on `http://localhost:4701` (single process). Nothing else
in the repo uses that port.

## Ground truth about the data (verified 2026-08-10)

- Shipped files: `curriculum/{radicals,kanji,vocabulary,grammar,readings}/{n4,n5}.json`,
  plus `curriculum/dependencies/graph.json` and `curriculum/metadata.json`.
- **Skip these dirs** (build inputs, not shipped content) — same rule as
  `discoverJsonFilesIn` in `scripts/validate-schema.ts`: `_build/`,
  `*/mnemonics/`, `*/examples/`, `schema/`.
- File shape: `{ jlpt_level, items[] }` — except readings: `{ jlpt_level, passages[] }`,
  graph: `{ edges[] }`.
- Every item has `slug` (unique per type), `primary_form`, `meaning`, `sort_order`.
- `_meta` is optional: `{ generator_model, prompt_version, review_status }`,
  `review_status ∈ {draft, reviewed, flagged_for_rewrite}`. **Reading passages
  have no `_meta` at all** — treat status as `none`.
- "Skeleton" is derived, not stored: item has its required fields but is
  missing enrichment (see per-type checklists in Chunk 2).
- "Recently drafted" is derived: `review_status == "draft"`, groupable by
  `_meta.prompt_version` / `generator_model`. There are no timestamps — do not
  invent them. The sidecar dirs (`kanji/mnemonics/n5.json` etc., keyed by
  slug) are the staging queue of freshly generated, not-yet-merged content.
- JSON formatting: 2-space indent, trailing newline — reproduce with
  `JSON.stringify(data, null, 2) + "\n"`; mutating the parsed object in place
  preserves key order.
- Schema quirks: `wordSpan.end` uses `exclusiveMinimum: { $data: "1/start" }`
  → Ajv must be constructed with `$data: true` (see `scripts/validate-schema.ts:319`).
- Radical images live at `mobile/assets/radicals/n5/ichi.webp`; items store
  `visual_mnemonic_url` as `radicals/n5/ichi.webp` → serve `mobile/assets`
  as a static mount.
- Existing validation entry point: `validateCurriculum()` exported from
  `scripts/validate-schema.ts` — importable directly by the server (tsx runs TS).
- Audit: `python3 curriculum/_build/generate_content/audit_shipped.py --level n5`
  writes `curriculum/_build/reports/content-audit-<level>.md` (markdown only —
  Chunk 7 adds `--json`). Findings are graded ERROR / WARNING / INFO and most
  mention item slugs inline.
- `curriculum/metadata.json` `content_counts` are **actuals**, not targets.
  "Remaining to generate" needs configurable targets (a small
  `web/targets.json` the user edits by hand).

## Shared orientation block (paste into every chunk session)

> Repo: offline-first Japanese learning app. This task builds **Curriculum
> Studio**, a local-only debug web app in `web/` (React + Vite frontend,
> Express server, both TypeScript, run with `npm run studio` →
> http://localhost:4701). It reads/writes the shipped curriculum JSON under
> `curriculum/` (see "Ground truth" in
> `docs/design/curriculum-studio-web-plan.md`). Code in `web/` must comply with
> `web/.eslintrc.js`. Never write to `_build/`, `*/mnemonics/`, `*/examples/`.
> Saves must keep `npm run validate-schema` green. Plan chunks are in that same
> doc — implement ONLY the chunk below; prior chunks are already done.

---

## Chunk 1 — Scaffold: package, server, Vite middleware, health check

**Goal:** `npm run studio` boots one process serving a placeholder page + a
working JSON health endpoint.

**Read first:** root `package.json`, `scripts/validate-schema.ts` (imports only).

**Build:**
1. `web/package.json` (name `curriculum-studio`, private; deps: react,
   react-dom, express; devDeps: vite, @vitejs/plugin-react, typescript,
   @types/express, @types/react, @types/react-dom). `web/tsconfig.json`.
2. `web/.eslintrc.js` — minimal: `@typescript-eslint` recommended +
   react-hooks; no rules that fight the existing codebase style (2-space,
   single quotes).
3. `web/server/index.ts` — Express app; `GET /api/health` →
   `{ ok: true, curriculumDir }`; serve `mobile/assets` at `/assets`; mount
   Vite in middleware mode when `NODE_ENV !== 'production'`, else serve
   `web/dist`. Resolve repo root as `path.resolve(__dirname, '../..')`.
4. `web/index.html`, `web/src/main.tsx`, `web/src/App.tsx` — dark-themed shell
   with header "Curriculum Studio" and nav placeholders (Dashboard, Content,
   Graph, Audit). `web/src/theme.css` with CSS variables.
5. Root `package.json` script: `"studio": "tsx web/server/index.ts"`.
   `npm install` inside `web/` (separate lockfile — keep root lockfile
   untouched).

**Verify:** `npm run studio` → page loads at :4701; `curl localhost:4701/api/health`
returns ok; `curl localhost:4701/assets/radicals/n5/ichi.webp` returns an image.

---

## Chunk 2 — Data layer: loader, derived fields, overview + items API

**Goal:** a pure, testable server module that turns the corpus into a
normalized index with every derived field the UI needs.

**Read first:** `curriculum/schema/curriculum.schema.json`,
`curriculum/metadata.json`, `scripts/validate-schema.ts` (the
`discoverJsonFilesIn` skip rules), one sample file per type (first item only).

**Build:**
1. `web/server/curriculum/types.ts` — `ContentType = 'radical'|'kanji'|'vocabulary'|'grammar'|'reading'`;
   `ContentItem { type, level, slug, primaryForm, meaning, sortOrder,
   reviewStatus: 'draft'|'reviewed'|'flagged_for_rewrite'|'none', meta?,
   completeness: { percent, missing: string[] }, raw }`.
2. `web/server/curriculum/completeness.ts` — per-type checklists of expected
   fields; `percent = present/expected`, and the missing-field names:
   - radical: `mnemonic_text`, `description`, `accepted_answers`,
     `visual_mnemonic_url` (also check the webp exists under `mobile/assets`)
   - kanji: `readings`, `accepted_answers`, `meaning_mnemonic`,
     `reading_mnemonic`, `description`, `example_sentences` (≥1)
   - vocabulary: `furigana`, `accepted_answers`, `meaning_mnemonic`,
     `reading_mnemonic`, `example_sentences` (≥1)
   - grammar: `explanation_markdown`, `caution_notes`, `accepted_forms`,
     `cloze_variants` (≥1), `example_sentences` (≥1)
   - reading: `body_furigana`, `english_translation`, `summary_ja`,
     `summary_en`, `word_spans`, `grammar_slugs`, `vocabulary_slugs`,
     `questions` (≥2)
   - `isSkeleton = percent < 0.6` (single threshold; expose in the UI copy as
     "skeleton (<60% complete)").
3. `web/server/curriculum/loader.ts` — `loadCurriculum(root)`: walks the
   shipped files (skip rules above), also loads `dependencies/graph.json` and
   `metadata.json`, returns `{ items: ContentItem[], edges, metadata,
   bySlug: Map<"type:slug", ContentItem> }`. Cache in memory with a
   `reload()` export; no file watcher in this chunk.
4. Endpoints:
   - `GET /api/overview` → per type×level: total, status rollup, mean
     completeness, skeleton count; totals vs `web/targets.json` (create it:
     `{ "N5": { "radicals": 90, ... }, "N4": { ... } }` seeded with the user's
     real targets; document that the user edits it).
   - `GET /api/items?type&level&status&skeleton=true&missing=<field>&q&sort&
     page&pageSize` → filtered page + total count. `q` matches slug,
     primary_form, meaning (case-insensitive).
   - `GET /api/item/:type/:slug` → one item with `raw` (full original JSON)
     and derived fields.

**Verify:** `curl '/api/items?type=vocabulary&level=N5&status=draft'` returns
716 total (matches audit rollup); `/api/overview` totals equal
`metadata.json content_counts`; a known skeleton item lists its missing fields.

---

## Chunk 3 — Dashboard UI ("god's eye view")

**Goal:** landing page answering "where is the content and what's left."

**Read first:** `web/src/App.tsx`, `web/src/theme.css`, the Chunk 2 API
shapes (read `web/server/curriculum/types.ts`, not the whole server).

**Build:**
1. Install `recharts` in `web/`.
2. `web/src/pages/Dashboard.tsx` fetching `/api/overview`:
   - Stacked bar per content type: draft vs reviewed vs flagged (split N5/N4).
   - Donut: overall review-status distribution.
   - Completeness bars: mean completeness per type; skeleton counts as warning
     badges.
   - "Remaining to generate" table: target − actual per type×level from
     `targets.json` data in the overview response.
   - "Recently drafted" panel: latest drafts grouped by
     `_meta.prompt_version` + `generator_model` (add
     `GET /api/items?status=draft&sort=...` usage — no timestamps exist, group
     by prompt_version, descending).
3. Shared bits: `web/src/components/StatusBadge.tsx`,
   `web/src/components/CompletenessPill.tsx`, a tiny `useApi` fetch hook.

**Verify:** dashboard renders all panels with real numbers; clicking a
stacked-bar segment is out of scope (Chunk 4 wires navigation).

---

## Chunk 4 — Content list pages + filters

**Goal:** browsable, filterable tables per content type — the daily driver view.

**Read first:** `web/src/App.tsx`, `web/src/components/StatusBadge.tsx`,
Chunk 2 API (`web/server/curriculum/types.ts` only).

**Build:**
1. React Router (`react-router-dom`) with routes `/content/:type` and deep-
   linkable query params for every filter.
2. `web/src/pages/ContentList.tsx`:
   - Type tabs (Radicals, Kanji, Vocabulary, Grammar, Readings) + level toggle
     (All/N5/N4).
   - Filter bar: review status (draft / reviewed / flagged / none), skeleton
     only, missing-field dropdown (e.g. "missing example_sentences"), free
     text search, audit-issues toggle (placeholder, disabled until Chunk 7),
     sort (sort_order, completeness asc, slug).
   - Table: primary_form, slug, meaning, status badge, completeness pill,
     missing-fields tooltip. Rows link to `/content/:type/:slug`.
   - Server-side pagination (pageSize 50) + total count display.
3. Empty states and loading skeletons.

**Verify:** `?type=vocabulary&status=draft` shows 716; skeleton toggle on N4
kanji matches Chunk 2's counts; URL params survive reload and restore filters.

---

## Chunk 5 — Item detail view (read-only)

**Goal:** every field of every type rendered appropriately — Japanese text
with furigana, structured nested data, related-content links.

**Read first:** `curriculum/schema/curriculum.schema.json` ($defs for the five
item shapes), one full sample item per type from the JSON files,
`web/src/pages/ContentList.tsx`.

**Build:**
1. `GET /api/item/:type/:slug` already returns `raw`; extend server response
   with `dependencySummary` (incoming/outgoing edges from graph.json, resolved
   to `{type, slug, primaryForm, relationship}` — read
   `web/server/curriculum/loader.ts` for `bySlug`).
2. `web/src/lib/furigana.tsx` — parse `字[よみ]` bracket syntax into `<ruby>`
   elements; toggle to show/hide readings.
3. `web/src/pages/ItemDetail.tsx` + per-type section components:
   - Common header: primary_form (large, Japanese font stack), slug, level,
     status badge, `_meta` panel (model, prompt version), completeness +
     missing fields.
   - Kanji: readings table (on/kun), accepted answers (type + primary marker),
     meaning/reading mnemonics with `<radical>`/`<kanji>`/`<reading>` tags
     rendered as highlighted chips, description, visually-similar links,
     example sentences.
   - Vocabulary: furigana display, accepted answers, mnemonics, examples.
   - Radical: image from `/assets/<visual_mnemonic_url>` (fallback: big
     character), mnemonic, description, look-alikes.
   - Grammar: structure, `explanation_markdown` (render markdown — small dep
     like `marked`, sanitized), caution notes, accepted forms, conjugation
     rules (key/value), cloze variants (blank `＿` rendered visibly), related
     grammar links, examples.
   - Reading: title, body with furigana toggle, translation, both summaries,
     word_spans as highlighted inline spans (click → linked vocab item),
     questions with accepted answers, grammar/vocab slug chips.
   - Example sentences (shared): japanese + furigana toggle + english,
     word_spans highlighting, linked vocabulary_slugs.
   - Dependencies panel: "Built from" (incoming) / "Unlocks" (outgoing) chips
     linking to those items.

**Verify:** hand-check one item of each type against its raw JSON — every
field visible somewhere; furigana toggle works; dependency chips navigate.

---

## Chunk 6 — Editing + write-back API

**Goal:** edit any field in the UI; save writes the JSON file atomically and
keeps `validate-schema` green.

**Read first:** `scripts/validate-schema.ts` (entire file),
`web/server/curriculum/loader.ts`, `web/src/pages/ItemDetail.tsx`.

**Build:**
1. Small surgical change to `scripts/validate-schema.ts`: export
   `runFuriganaChecks` and `resolveValidatorKey` (add `export` keyword only —
   no refactor). The server imports them.
2. `web/server/curriculum/writer.ts` — `saveItem(type, slug, updatedRaw)`:
   locate item's file, replace the item in the parsed file object **in place**
   (preserves key order of untouched items), validate the whole modified file
   with a per-`$defs` Ajv validator (`new Ajv({ allErrors, strict:false,
   $data:true })`) plus `runFuriganaChecks`, refuse with
   `{ ok:false, errors }` on failure; on success write
   `JSON.stringify(file, null, 2) + "\n"` to `*.tmp` then `fs.rename`
   (atomic), then `reload()` the loader cache.
3. `PUT /api/item/:type/:slug` — body = full updated raw item; 400 with
   validation errors on rejection; also support
   `PATCH /api/item/:type/:slug/meta` with `{ review_status }` for one-click
   draft→reviewed flips.
4. UI: `Edit` toggle on the detail page → form generated from the item's
   shape: text inputs for scalars, textareas for mnemonics/markdown, small
   repeater UIs for arrays of objects (readings, accepted_answers,
     example_sentences, cloze_variants, questions — add/remove/reorder),
     comma-separated inputs for slug arrays. Dirty indicator + "unsaved
     changes" guard; on save error, show the Ajv/furigana errors inline.
5. `POST /api/reload` button in the header ("Reload from disk") for when the
   user edits files externally.

**Verify:** edit a meaning → `git diff curriculum/` shows a one-line change;
`npm run validate-schema` passes; UI reflects the change without restart;
submitting a schema violation (e.g. empty meaning) is rejected with a readable
error and the file is untouched.

---

## Chunk 7 — Audit integration ("content with issues")

**Goal:** run the shipped-content audit from the UI and filter/browse items by
their findings.

**Read first:** `curriculum/_build/generate_content/audit_shipped.py` (skim —
note how findings are collected and how the markdown is written),
`curriculum/_build/reports/content-audit-n5.md`, Chunk 2 loader.

**Build:**
1. Python change (small): add `--json` to `audit_shipped.py` writing
   `curriculum/_build/reports/content-audit-<level>.json`:
   `[{ check, severity, message, slugs: string[] }]`. Extract slugs from the
   finding objects where the check tracks them; otherwise regex
   `n[45]-[a-z0-9-]+` / known slugs out of the message text. Do not change the
   markdown output.
2. Server: `POST /api/audit/run` (spawn `python3 .../audit_shipped.py --json
   --level n5 --level n4`, stream status, return summary); loader gains an
   `auditBySlug: Map<string, Finding[]>` populated from the JSON reports at
   load/reload; `GET /api/audit/findings?severity&check&type`.
3. UI: enable the "has audit issues" filter on list pages (Chunk 4 left the
   placeholder; server: `&audit=any|error|warning|info`); severity badges on
   rows and a findings panel on the detail page; `/audit` page: findings table
   grouped by check with severity filter and item links, plus a "Run audit"
   button showing the last-run time (from report file mtime).

**Verify:** run audit from the UI → finding counts match the `.md` report's
totals; filtering kanji by `audit=warning` shows only flagged items; clicking
a finding lands on the item's detail page with the finding highlighted.

---

## Chunk 8 — Dependency graph + "what to generate next"

**Goal:** visualize the radical→kanji→vocab→grammar graph and surface
generation order — items blocked by missing/skeleton prerequisites.

**Read first:** `curriculum/dependencies/graph.json` (first ~50 edges),
`web/server/curriculum/loader.ts`, Chunk 2 derived fields.

**Build:**
1. Server (`web/server/curriculum/graph.ts`):
   - `GET /api/graph/neighborhood?type&slug&depth=2` → nodes + edges around an
     item.
   - `GET /api/graph/summary` → per-type edge counts, orphan items (no edges),
     edges pointing at slugs not in the corpus (dangling).
   - `GET /api/graph/build-order` → items whose incoming `requires`/`builds_on`
     prerequisites are missing, dangling, draft, or skeleton — sorted by how
     much they unblock (out-degree desc), i.e. "create/finish these first".
2. UI `/graph`:
   - Global view: cytoscape + dagre, nodes colored by type, opacity by
     completeness, level filter, type filter; click node → detail page. (If
     full-corpus rendering is slow, default to per-level and lazy-load.)
   - Neighborhood view embedded on the item detail page (depth 1).
   - "Build order" page: table of blockers with reason chips (missing /
     skeleton / draft prerequisite), each row linking to the item — this is
     the "what needs to be created first" answer.

**Verify:** `n5-ichi` neighborhood shows radical `ichi` + dependent kanji;
build-order flags match the audit's decomposition INFO findings (e.g. items
needing untaught KRADFILE components); dangling-edge count is visible.

---

## Chunk 9 — Pipeline actions + finishing touches

**Goal:** run the repo's own gates from the UI; document the tool.

**Read first:** root `package.json`, `scripts/compile-curriculum.ts` (CLI
contract only — first 40 lines), `web/server/index.ts`.

**Build:**
1. `POST /api/pipeline/validate` and `POST /api/pipeline/compile` — spawn
   `npm run validate-schema` / `npm run compile-curriculum` at repo root,
   stream stdout/stderr via SSE (or buffered response if SSE is bulky);
   compile needs `COMPILE_OUTPUT_PATH` pointed at a scratch path
   (`web/.build/curriculum.db`) — **never** overwrite
   `mobile/assets/curriculum-seed/curriculum.db` from this tool.
2. UI: header button "Validate" with pass/fail toast; a `/pipeline` page with
   run buttons and scrollable output log.
3. `web/README.md`: what it is, `npm run studio`, safety notes (writes go
   straight to `curriculum/`, undo = git), how targets/audit work.
4. Root README + `docs/README.md`: one-line pointer.

**Verify:** validate button goes green on a clean corpus; deliberately break
an item in the editor → save is refused (Chunk 6) → and a hand-edited invalid
file makes the pipeline page show the failure output.

---

## Explicitly out of scope

- Auth, multi-user, hosting, any network exposure beyond localhost.
- Creating new items from the UI (build-order view identifies gaps; generation
  stays with the existing subagent workflows in `docs/workflows/`).
- Editing `_build/` drafts, sidecar mnemonics/examples, or `graph.json` by
  hand (graph edits come from the compile pipeline).
- Git automation (commit/push) — the user reviews `git diff` and commits.
- OTA publish and mobile seed rebuild (manual `npm run compile-curriculum` +
  LFS commit stays as-is).

## Risks / gotchas

- **Ajv `$data: true`** is mandatory (wordSpan `exclusiveMinimum`) — forgetting
  it makes every schema compile throw.
- **Key-order churn:** always mutate the parsed file object; never rebuild
  items from a field whitelist, or every save is a giant diff.
- **Readings have no `_meta`** — status filter must offer "none" or readings
  vanish from filtered views.
- **Two vocab slugs can share spelling** — always key by `type:slug`, never by
  primary_form.
- **Portability:** server must resolve repo root from `__dirname`, not
  `process.cwd()`, so it works from any cwd.
- Keep chunks independent: if a later chunk needs an earlier chunk's API, read
  the earlier chunk's `types.ts` — never re-derive shapes ad hoc.
