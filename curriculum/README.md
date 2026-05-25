# Curriculum JSON source

Authoritative curriculum content for the mobile app. JSON files here are validated and compiled to `mobile/assets/curriculum-seed/curriculum.db` (Git LFS).

## Layout

- `schema/curriculum.schema.json` — JSON Schema (`$defs` per file type)
- `metadata.json` — semantic version and maintainer counts
- `radicals/`, `kanji/`, `vocabulary/`, `grammar/`, `readings/` — N5 seed slices
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

Story 1.7 adds maintainer upload to Cloudflare R2; placeholder URLs are valid HTTPS until assets ship.

## Item ID assignment

Compile assigns integer `items.id` deterministically: sort by `item_type` (`radical` → `kanji` → `vocabulary` → `grammar`), then `slug` ascending within each type.

## Content hash

`curriculum_metadata.content_hash` is SHA-256 over sorted JSON paths under `curriculum/` (excluding `schema/`), each entry: relative path + NUL + file bytes + NUL. `npm run compile-curriculum` runs schema validation first; a failed validation exits before any SQLite write.
