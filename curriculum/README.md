# Curriculum JSON source

Authoritative curriculum content for the mobile app. JSON files here are validated and compiled to `mobile/assets/curriculum-seed/curriculum.db` (Git LFS).

## Layout

- `schema/curriculum.schema.json` — JSON Schema (`$defs` per file type)
- `metadata.json` — semantic version and maintainer counts
- `radicals/`, `kanji/`, `vocabulary/`, `grammar/`, `readings/` — per-level seed slices (`n5.json`, `n4.json`, …)
- `dependencies/graph.json` — precomputed radical → kanji → vocabulary edges

## Commands (repo root)

```bash
npm ci
npm run validate-schema
npm run compile-curriculum
```

Set `COMPILE_OUTPUT_PATH` to write elsewhere (CI uses `dist/curriculum.db`).

## Radical mnemonic images (FR37b)

**Decision:** radical images live **in the repo and are bundled with the app** — no CDN, and **no kanji images**. Files go under `mobile/assets/radicals/{jlpt_lower}/{slug}.webp` (Git LFS preferred), with a hard per-image size budget so the pack stays small (~5–12 MB for ~150 radicals).

Curriculum rows will point at those bundled assets (schema/app wiring lands with Phase 3). Seed data may still carry legacy placeholder `https://…` values until then; the app shows **text fallback** when an image is missing — that is expected, not a hosting plan.

See **[docs/content/radical-mnemonic-images.md](../docs/content/radical-mnemonic-images.md)** for asset spec, paths, size budget, and verification.

## Item ID assignment

Compile assigns integer `items.id` deterministically: sort by JLPT level (`N5` → `N4` → `N3` → `N2` → `N1`), then `item_type` (`radical` → `kanji` → `vocabulary` → `grammar`), then `slug` ascending within each level/type group. Adding a new level appends IDs after existing levels without renumbering prior items.

## Content hash

`curriculum_metadata.content_hash` is SHA-256 over sorted JSON paths under `curriculum/` (excluding `schema/`), each entry: relative path + NUL + file bytes + NUL. `npm run compile-curriculum` runs schema validation first; a failed validation exits before any SQLite write.
