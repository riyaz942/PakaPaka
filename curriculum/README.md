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

Radical rows store full HTTPS URLs in `visual_mnemonic_url`, compiled to `items.visual_mnemonic_url`. Expected CDN pattern:

`https://assets.japanese-learning.app/radicals/n5/{slug}.png`

N4 uses the same pattern with `n4/` in the path (e.g. `…/radicals/n4/n4-hito.png`).

See **[docs/content/radical-mnemonic-images.md](../docs/content/radical-mnemonic-images.md)** for the full maintainer workflow: asset spec, R2 upload, curriculum re-compile, and verification.

Placeholder URLs are valid HTTPS until assets ship. The app shows **text fallback** (`mnemonic_text` or meaning label) when an image 404s or is offline-uncached — do not block releases on CDN going live.

## Item ID assignment

Compile assigns integer `items.id` deterministically: sort by JLPT level (`N5` → `N4` → `N3` → `N2` → `N1`), then `item_type` (`radical` → `kanji` → `vocabulary` → `grammar`), then `slug` ascending within each level/type group. Adding a new level appends IDs after existing levels without renumbering prior items.

## Content hash

`curriculum_metadata.content_hash` is SHA-256 over sorted JSON paths under `curriculum/` (excluding `schema/`), each entry: relative path + NUL + file bytes + NUL. `npm run compile-curriculum` runs schema validation first; a failed validation exits before any SQLite write.
