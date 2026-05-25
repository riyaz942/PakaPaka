# Story 1.5: Curriculum JSON validation, SQLite compile, Actions, LFS, and bundled seed

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a **maintainer**,
I want **JSON curriculum validated and compiled to SQLite in CI with artifacts versioned for the app bundle**,
So that **learners ship with real N5 seed content and integrity is enforced (FR35, FR36, FR37, FR37b, NFR11)**.

## Acceptance Criteria

1. **JSON schema validation (FR35, NFR11)**

   **Given** `curriculum/` JSON sources and `curriculum/schema/curriculum.schema.json`  
   **When** `npm run validate-schema` runs locally or in GitHub Actions  
   **Then** every JSON file under `curriculum/` (radicals, kanji, vocabulary, grammar, readings, dependencies, metadata) validates against the schema  
   **And** invalid JSON or schema violations exit non-zero with a clear file path and error message  
   **And** no SQLite file is written when validation fails

2. **SQLite compilation (FR36)**

   **Given** valid curriculum JSON  
   **When** `npm run compile-curriculum` runs  
   **Then** a new `curriculum.db` is produced with the **full target schema** (not the Story 1.3 stub) per [Source: `_bmad-output/planning-artifacts/db-schema-diagram.md` — Target schema `curriculum.db`]  
   **And** tables include at minimum: `curriculum_metadata`, `items`, `kanji_readings`, `accepted_answers`, `grammar_rules`, `example_sentences`, `item_relationships`, `grammar_vocabulary_links`, `reading_passages`, `passage_questions`, `external_id_mappings` (may be empty), with planned indexes  
   **And** `curriculum_metadata` contains semantic `version`, `build_date`, `content_hash` (SHA-256 of canonical JSON inputs), and content counts (`item_count`, `radical_count`, `kanji_count`, `vocabulary_count`, `grammar_count`)  
   **And** compilation writes to a **temp file** then atomically renames to the output path — a failed compile must not leave a partial database at the destination  
   **And** the compile script exits non-zero on any SQL/IO error

3. **N5 seed content (FR1–FR8c foundation, NFR22 scale target)**

   **Given** the bundled seed replaces Story 1.3 stub (`0.0.0-stub`)  
   **When** the compiled database is opened by the app  
   **Then** `curriculum_metadata.version` is a semantic version (e.g. `1.0.0-n5-seed`), not `0.0.0-stub`  
   **And** seed JSON includes **real Japanese learning content** for JLPT N5 (not lorem ipsum): radicals, kanji, vocabulary, grammar, readings, and a precomputed dependency graph  
   **And** seed size is a **meaningful MVP slice** toward ~500 items (architecture/PRD): target **≥100** total `items` rows with balanced types; document actual counts in `curriculum/metadata.json`  
   **And** N5 radical rows include **HTTPS** `visual_mnemonic_url` values pointing at public Cloudflare R2 URLs (FR37b) — placeholder R2 URLs are acceptable if assets ship in Story 1.7; URLs must be valid HTTPS and stable format  
   **And** grammar rows include structured `conjugation_rules` / `accepted_forms` JSON per FR6; example sentences reference vocabulary from the same seed where possible (FR6c, FR8)

4. **Git LFS and repo layout (FR37)**

   **Given** compiled `curriculum.db` is large/binary  
   **When** the repo is configured  
   **Then** `.gitattributes` tracks `mobile/assets/curriculum-seed/curriculum.db` via Git LFS  
   **And** root `README.md` documents clone steps: `git lfs install` and `git lfs pull` (or equivalent) before working with the mobile app  
   **And** contributors without LFS see a documented failure mode (pointer file / missing DB) and recovery steps

5. **GitHub Actions workflow**

   **Given** `.github/workflows/compile-curriculum.yml`  
   **When** a PR or push touches `curriculum/**`, `scripts/**`, or `package.json` / `package-lock.json` at repo root  
   **Then** the workflow runs `npm ci` (repo root), `npm run validate-schema`, and `npm run compile-curriculum` to a **CI temp output** (e.g. `dist/curriculum.db`)  
   **And** the job fails if validation or compile fails (NFR11)  
   **And** the workflow does **not** replace the committed LFS binary automatically unless explicitly implemented — committed `mobile/assets/curriculum-seed/curriculum.db` must match what maintainers compile when JSON changes (document in README)

6. **App bundle integration (regression)**

   **Given** Stories 1.3–1.4 are complete  
   **When** the new `curriculum.db` is committed under `mobile/assets/curriculum-seed/`  
   **Then** `mobile/src/data/database.ts` still imports the bundled asset via `require('@/assets/curriculum-seed/curriculum.db')` — update path only if compile output location changes  
   **And** cold start opens both databases without error; `DatabaseProvider` dev log shows the new `curriculum_metadata.version`  
   **And** `npm run lint`, `npm run typecheck`, and `npm test` pass in `mobile/`  
   **And** optional: add a root-level Jest test suite for `scripts/` (run from repo root `npm test`) — if added, wire into `compile-curriculum.yml` or document as local-only; **do not** break existing `mobile/` CI job

## Tasks / Subtasks

- [x] **AC1 — Repo-root tooling**
  - [x] Add root `package.json` + `package-lock.json` with scripts: `validate-schema`, `compile-curriculum`, `test` (scripts only).
  - [x] Add root `tsconfig.json` for Node scripts (ESM or CJS — pick one, document in README).
  - [x] Dependencies (suggested): `ajv` + `ajv-formats` for JSON Schema; `better-sqlite3` for compile-time SQLite; `tsx` or `ts-node` to run TypeScript; `typescript`, `jest`, `@types/better-sqlite3` as devDeps.
  - [x] **Do not** move `mobile/` app into root `package.json` workspaces unless necessary — keep mobile CI independent.

- [x] **AC1 — Curriculum JSON tree**
  - [x] Create `curriculum/schema/curriculum.schema.json` — formalize types for metadata, items (by `item_type`), readings, grammar rules, dependencies graph, passages/questions, R2 URLs.
  - [x] Create `curriculum/metadata.json` — `version`, `jlpt_levels`, description, maintainer notes.
  - [x] Create `curriculum/radicals/n5.json`, `kanji/n5.json`, `vocabulary/n5.json`, `grammar/n5.json`, `readings/n5.json`, `dependencies/graph.json` with real N5 seed content.
  - [x] Ensure `dependencies/graph.json` edges use stable slugs/ids that resolve to compiled `items.id` (compile script assigns integer IDs deterministically — document ordering rule, e.g. sort by `item_type` then `slug`).

- [x] **AC1 — `scripts/validate-schema.ts`**
  - [x] Discover all `curriculum/**/*.json` except schema file itself.
  - [x] Validate each file; print `file: message` on failure; `process.exit(1)` on any error.
  - [x] Support `$ref` in schema if splitting schema shards later.

- [x] **AC2 — `scripts/compile-curriculum.ts`**
  - [x] Read validated JSON; build in-memory model; open SQLite temp path.
  - [x] `CREATE TABLE` + indexes per `db-schema-diagram.md` target section.
  - [x] Insert rows: polymorphic `items`, child tables, `item_relationships` from graph, passages/questions, empty `external_id_mappings` OK.
  - [x] Compute SHA-256 `content_hash` over canonical serialized inputs (document algorithm: e.g. hash of sorted file contents concatenated).
  - [x] Insert `curriculum_metadata` row; `fsync`/close; atomic rename to `mobile/assets/curriculum-seed/curriculum.db`.
  - [x] Export shared table/column constants or types to `scripts/curriculum-schema.ts` if useful for tests (optional).

- [x] **AC2/AC3 — Replace bundled stub**
  - [x] Run compile; commit `mobile/assets/curriculum-seed/curriculum.db` via Git LFS.
  - [x] Update `mobile/assets/curriculum-seed/README.md` — describe N5 seed version, counts, LFS, compile commands.
  - [x] Remove or update Story 1.3 stub documentation that says "do not expand schema here".

- [x] **AC4 — Git LFS**
  - [x] Add `.gitattributes`: `mobile/assets/curriculum-seed/curriculum.db filter=lfs diff=lfs merge=lfs -text`.
  - [x] Update root `README.md` with LFS clone/pull section and link to Git LFS install docs.
  - [x] Verify `git lfs track` list includes curriculum.db.

- [x] **AC5 — `compile-curriculum.yml`**
  - [x] Trigger on `curriculum/**`, `scripts/**`, root `package.json`, `.github/workflows/compile-curriculum.yml`.
  - [x] Node 22.x (match `ci.yml`); `npm ci` at repo root; run validate + compile to `dist/curriculum.db`.
  - [x] Upload `dist/curriculum.db` as workflow artifact (optional, aids debugging).
  - [x] Add status badge note in README (optional).

- [x] **AC6 — App regression**
  - [x] Open app: confirm `DatabaseProvider` logs new version in `__DEV__`.
  - [x] Add `mobile/src/data/database.test.ts` or extend existing test: mock asset import still called; optional assertion that compile output path unchanged.
  - [x] Resolve `database.ts` TODO for Story 1.5 — add `attachCurriculumForQuery(userDb)` **only if** a test or script needs cross-DB proof; otherwise leave TODO for Epic 4/5 with story reference.
  - [x] Run `mobile/` lint, typecheck, test.

- [x] **AC1/AC2 — Script tests**
  - [x] `scripts/validate-schema.test.ts` — valid fixture passes; invalid fixture fails.
  - [x] `scripts/compile-curriculum.test.ts` — compile fixture JSON to temp db; assert table counts, metadata hash present, FK-like slug resolution.

## Dev Notes

### Epic context (Epic 1)

Epic 1 delivers the installable shell. **Stories 1.1–1.4** established Expo SDK 55, NativeWind, dual SQLite open, and five-tab navigation. **This story (1.5)** is the **content pipeline foundation**: JSON source of truth, CI validation/compile, Git LFS binary, and **real bundled N5 seed** replacing the 1.3 stub.

**Out of scope for 1.5 (do not implement):**

| Story | Scope |
| --- | --- |
| 1.6 | Curriculum version check, download, atomic on-device swap (`curriculumUpdate.ts`) |
| 1.7 | `expo-image` cache, R2 upload maintainer workflow, radical UI |
| 2.x+ | Onboarding, `item_study_status`, preferences UI |
| 4.x | Learn/read screens querying curriculum |
| 5.x | Review queue, FSRS tables in `user.db` |
| Epic 8 | Community PR pipeline, in-app curriculum edits |

### Technical requirements (must follow)

- **Path SSOT (architecture vs implemented layout):** Architecture diagram shows repo-root `assets/curriculum-seed/` and `src/app/`. **Implemented layout** places the app under **`mobile/`** and bundled DB at **`mobile/assets/curriculum-seed/curriculum.db`**. All compile output and LFS tracking use the **mobile** path — do not create a duplicate root `assets/curriculum-seed/` unless migrating the whole app (out of scope).
- **Dual DB contract unchanged:** App still treats `curriculum.db` as read-only; compile pipeline is the **only** writer of curriculum schema/data. `user.db` migrations untouched.
- **Deterministic compile:** Same JSON inputs → same `content_hash` and stable `items.id` assignment (required for future import mapping and tests).
- **Fail closed:** Validation failure blocks compile; compile failure must not publish partial DB (NFR11).
- **Layer boundaries:** Compile scripts live in repo-root `scripts/` — **no** `expo-sqlite` in compile path (use `better-sqlite3` or Node `sqlite3`). Mobile `data/` layer still no writes to curriculum.
- **Semantic versioning:** `curriculum/metadata.json` `version` flows into `curriculum_metadata.version`; bump on every content publish.
- **R2 URLs (FR37b):** Store full HTTPS URLs in JSON → compile to `items.visual_mnemonic_url` for radicals. Document expected R2 bucket URL pattern in `curriculum/README.md` or root README for maintainers.

### Target `curriculum.db` schema (compile output)

Implement tables and indexes from [Source: `_bmad-output/planning-artifacts/db-schema-diagram.md` — Target schema `curriculum.db`]. Story 1.3 stub only had `curriculum_metadata` — **replace entirely** with full schema.

**`curriculum_metadata` columns (target):**

| Column | Notes |
| --- | --- |
| `version` | TEXT PK — semantic version from `metadata.json` |
| `build_date` | ISO 8601 UTC |
| `content_hash` | SHA-256 hex of canonical JSON bundle |
| `item_count` | INTEGER |
| `radical_count` | INTEGER |
| `kanji_count` | INTEGER |
| `vocabulary_count` | INTEGER |
| `grammar_count` | INTEGER |

**`items` discriminator:** `item_type` ∈ `radical` \| `kanji` \| `vocabulary` \| `grammar`; `jlpt_level` = `N5` for this seed; `slug` unique per type; `visual_mnemonic_url` for radicals; `mnemonic_text` for text mnemonics.

**Graph:** `item_relationships` with `relationship_type` ∈ `requires` \| `builds_on` \| `reinforces`; encode radical→kanji→vocab chain from `dependencies/graph.json`.

### JSON source layout (create)

```
curriculum/
├── schema/
│   └── curriculum.schema.json
├── metadata.json
├── radicals/n5.json
├── kanji/n5.json
├── vocabulary/n5.json
├── grammar/n5.json
├── readings/n5.json
└── dependencies/graph.json
```

**Schema formalization:** Architecture gap "define during first content pipeline story" — this story **owns** the schema. Align field names with compile script and future `curriculum.types.ts` (Epic 4+). Prefer `snake_case` in JSON for parity with DB columns.

### Architecture compliance

| Requirement | Implementation |
| --- | --- |
| FR35 CI JSON validation | `validate-schema.ts` + `compile-curriculum.yml` |
| FR36 JSON→SQLite compile | `compile-curriculum.ts` |
| FR37 Git LFS for compiled DB | `.gitattributes` + LFS docs |
| FR37b R2 mnemonic URLs in data | radical `visual_mnemonic_url` in seed JSON/DB |
| NFR11 compile failure blocks publish | non-zero exit; temp-file atomic rename |
| NFR22 scale headroom | indexes on `item_type`, `jlpt_level`, relationships |
| Dual DB separation | no user.db changes |

### Library / framework requirements

| Package | Where | Notes |
| --- | --- | --- |
| `ajv` | root devDep | JSON Schema validation |
| `better-sqlite3` | root devDep | Sync SQLite writes in Node compile script |
| `tsx` | root devDep | Run TS scripts without separate build step |
| `expo-sqlite` | mobile only | Unchanged — app reads bundled DB |
| Node | 22.13.0 | Match `.github/workflows/ci.yml` |

**Do not add** `op-sqlite`, `ts-fsrs`, or mobile dependencies for compile scripts.

### File structure requirements

| Path | Action |
| --- | --- |
| `package.json` (repo root) | **Create** — scripts + devDeps |
| `package-lock.json` (repo root) | **Create** |
| `tsconfig.json` (repo root) | **Create** — for scripts |
| `curriculum/**` | **Create** — JSON source + schema |
| `scripts/validate-schema.ts` | **Create** |
| `scripts/compile-curriculum.ts` | **Create** |
| `scripts/*.test.ts` | **Create** — recommended |
| `.gitattributes` | **Create** — LFS track curriculum.db |
| `.github/workflows/compile-curriculum.yml` | **Create** |
| `mobile/assets/curriculum-seed/curriculum.db` | **Replace** — LFS binary |
| `mobile/assets/curriculum-seed/README.md` | **Update** |
| `README.md` (repo root) | **Update** — LFS + compile commands |
| `mobile/src/data/database.ts` | **Verify only** — asset path unchanged |

**Do not create:** `mobile/src/data/curriculum/` repositories, `curriculumUpdate.ts`, `core/content/*`, Learn/Read UI.

### Testing requirements

- **Root (recommended):** Jest tests for validate + compile against small fixture JSON in `scripts/__fixtures__/`.
- **Mobile (required):** Existing suite passes; no regression in `database.test.ts` / `migrationRunner.test.ts`.
- **Manual:** After compile, `cd mobile && npm start` — dev log shows new curriculum version; spot-check `SELECT COUNT(*) FROM items` via dev-only query or temporary log in `DatabaseProvider` (remove before merge if noisy).
- **LFS manual:** Fresh clone with `git lfs pull` — confirm `curriculum.db` is non-pointer binary (>1KB).

### Previous story intelligence (Story 1.4)

- Root `_layout.tsx`: `DatabaseProvider` inside `ThemeProvider`; preserve provider order when touching layouts.
- App code only under `mobile/`; CI runs in `mobile/`.
- `resolveColorScheme()` / semantic tokens — no styling work in 1.5.
- Android primary for manual verification.

### Previous story intelligence (Story 1.3)

- Bundled import: `importDatabaseFromAssetAsync` + `require('@/assets/curriculum-seed/curriculum.db')` in `database.ts`.
- Stub schema: **only** `curriculum_metadata` — **full replace** in 1.5, not ALTER.
- `DatabaseProvider` already logs `curriculum_metadata.version` in `__DEV__` — use to verify seed swap.
- `database.ts` TODO: `attachCurriculumForQuery` — defer unless compile tests need ATTACH proof.
- Migration runner / `user.db` — **do not modify** except if a test requires a preference key (not needed).

### Previous story intelligence (Stories 1.1–1.2)

- CI: `.github/workflows/ci.yml` — mobile only; add **separate** curriculum workflow.
- Named exports in new TS modules; co-located `*.test.ts`.
- Jest: `nativewind/babel` in presets for mobile — root Jest config is independent.

### Git intelligence summary

Recent commits completed tab shell (1.4), dual SQLite (1.3), NativeWind (1.2). **No `curriculum/`, `scripts/`, or compile workflow exist yet** — this story is greenfield pipeline work at repo root plus replacing one LFS binary under `mobile/assets/`. Expect large diff: new root `package.json`, many JSON files, workflow, `.gitattributes`, and binary db swap.

### Latest technical information

- **Git LFS:** Track large binaries with `.gitattributes`; contributors need Git LFS extension installed ([Git LFS](https://git-lfs.com/)).
- **Ajv JSON Schema:** Use draft-07 or 2020-12 consistently; compile schema once per run.
- **better-sqlite3:** Synchronous API suits batch compile; run in CI on `ubuntu-latest` (prebuild binaries available).
- **Atomic write pattern:** `write → close → rename` to final path; same pattern Story 1.6 uses for on-device swap.
- **Metro `.db` bundling:** Existing `require('@/assets/curriculum-seed/curriculum.db')` — larger DB increases bundle size; acceptable for MVP seed (~500 items target).

### Project context reference

No `project-context.md` in repo. Use this story + `db-schema-diagram.md` + `architecture.md` + `epics.md` + `prd.md` (FR35–37b, NFR11).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.5]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Data Architecture, Content pipeline, Project Structure]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR35–37b, NFR11, NFR22, content pipeline]
- [Source: `_bmad-output/planning-artifacts/db-schema-diagram.md` — Target curriculum schema, Story 1.5 roadmap row]
- [Source: `_bmad-output/implementation-artifacts/1-3-dual-sqlite-databases-on-first-launch.md`]
- [Source: `_bmad-output/implementation-artifacts/1-4-five-tab-app-shell-with-hidden-review-route-placeholder.md`]
- [Source: `mobile/src/data/database.ts`]
- [Source: `mobile/assets/curriculum-seed/README.md`]
- [Git LFS documentation](https://git-lfs.com/)

## Dev Agent Record

### Agent Model Used

Composer (dev-story subagent)

### Debug Log References

- `npm run validate-schema` — 7 JSON files OK
- `npm run compile-curriculum` — `mobile/assets/curriculum-seed/curriculum.db` (96KB, version `1.0.0-n5-seed`, 114 items)
- Root `npm test` — 4 passed
- `mobile/` lint, typecheck, test — all passed

### Completion Notes List

- Greenfield repo-root pipeline: Ajv draft-07 validation, better-sqlite3 compile, atomic temp→rename write, deterministic `items.id` (type then slug).
- N5 seed: 25 radicals (HTTPS R2 URLs), 32 kanji, 41 vocabulary, 16 grammar, 4 reading passages, 87 dependency edges.
- Replaced Story 1.3 stub (`0.0.0-stub`) with full target schema; mobile tests/mock updated to `1.0.0-n5-seed`.
- `attachCurriculumForQuery` deferred to Epic 4/5 (TODO updated in `database.ts`).
- `.gitattributes` LFS rule added; local `git-lfs` CLI not installed in dev environment — rule verified in file.
- **Code review (2026-05-25):** Compile now validates JSON before SQLite write; CI runs `npm test`; content hash includes paths; grammar vocab links fail closed; temp DB cleanup on error.

### File List

- package.json
- package-lock.json
- tsconfig.json
- jest.config.cjs
- .gitignore
- .gitattributes
- .github/workflows/compile-curriculum.yml
- README.md
- curriculum/README.md
- curriculum/metadata.json
- curriculum/schema/curriculum.schema.json
- curriculum/radicals/n5.json
- curriculum/kanji/n5.json
- curriculum/vocabulary/n5.json
- curriculum/grammar/n5.json
- curriculum/readings/n5.json
- curriculum/dependencies/graph.json
- scripts/curriculum-schema.ts
- scripts/validate-schema.ts
- scripts/compile-curriculum.ts
- scripts/validate-schema.test.ts
- scripts/compile-curriculum.test.ts
- scripts/__fixtures__/valid/metadata.json
- scripts/__fixtures__/valid/radicals/n5.json
- scripts/__fixtures__/valid/kanji/n5.json
- scripts/__fixtures__/valid/vocabulary/n5.json
- scripts/__fixtures__/valid/grammar/n5.json
- scripts/__fixtures__/valid/readings/n5.json
- scripts/__fixtures__/valid/dependencies/graph.json
- scripts/__fixtures__/invalid-radical.json
- mobile/assets/curriculum-seed/curriculum.db
- mobile/assets/curriculum-seed/README.md
- mobile/src/data/database.ts
- mobile/src/data/database.test.ts
- mobile/__mocks__/expo-sqlite.ts

## Senior Developer Review (AI)

**Reviewer:** Riyaz (Composer) — **2026-05-25**

**Outcome:** Approve after fixes

### Findings addressed (auto-fixed)

| Severity | Issue | Fix |
| --- | --- | --- |
| HIGH | `compile-curriculum` could write SQLite without schema validation (AC1 gap) | `compileCurriculum` calls `validateCurriculum` before any DB write |
| MEDIUM | Failed compile could leave `*.db.tmp` on disk | Unlink temp file in `catch` before rethrow |
| MEDIUM | Unresolved `grammar.vocabulary_slugs` silently skipped | Throw with slug context (matches dependency edge behavior) |
| MEDIUM | Root `npm test` not run in `compile-curriculum.yml` | Added CI step; trigger paths include `jest.config.cjs` |
| MEDIUM | `content_hash` omitted file paths (ambiguous concatenation) | Hash relative path + NUL + bytes per sorted file; documented in `curriculum/README.md` |
| LOW | No `.gitignore` for compile temp artifacts | Ignore `mobile/assets/curriculum-seed/*.db.tmp` and `dist/` |

### Deferred (no product decision needed later)

| Severity | Issue | Rationale |
| --- | --- | --- |
| LOW | `validate-schema.test.ts` only exercises radicals `$def`, not full CLI | Fixture coverage sufficient for MVP; expand when schema shards |
| LOW | Story File List omits `jest.config.cjs`, `.gitignore` | Documentation drift only |
| LOW | `git lfs` not verified in dev sandbox | `.gitattributes` rule present; maintainers verify on clone |

### AC verification

- AC1–AC6: **IMPLEMENTED** after review fixes (validation gates compile; 114 items; LFS docs; CI validate+test+compile; mobile regression green).

## Change Log

- **2026-05-25:** Story created via `create-story` workflow — status **ready-for-dev**.
- **2026-05-25:** Implemented curriculum JSON pipeline, CI workflow, LFS config, N5 bundled seed — status **review**.
- **2026-05-25:** Code review (AI) — validation-before-compile, CI test step, hash/temp fixes — status **done**.
