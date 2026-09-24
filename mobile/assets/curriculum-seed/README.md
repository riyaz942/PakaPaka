# Curriculum seed database (N5)

Bundled `curriculum.db` compiled from repo-root `curriculum/` JSON. Tracked via **Git LFS** (`mobile/assets/curriculum-seed/curriculum.db`).

## Current seed

| Field | Value |
| --- | --- |
| Version | `1.0.0-n5-seed` |
| Total items | 114 (25 radicals, 32 kanji, 41 vocabulary, 16 grammar) |
| Reading passages | 4 |
| Dependency edges | 87 |

## Maintainer workflow

From repository root:

```bash
git lfs install
npm ci
npm run validate-schema
npm run compile-curriculum
```

Commit the updated `curriculum.db` and `curriculum-seed.json` together when JSON changes. `npm run compile-curriculum` raises the whole-number `version` in `curriculum/metadata.json` by 1 on every run (do not edit it by hand) and writes it to `curriculum-seed.json`. The app reads `curriculum-seed.json` at launch and re-imports the seed when its `version` is higher than the installed curriculum's, whether that was bundled or downloaded. CI (`.github/workflows/compile-curriculum.yml`) validates and compiles to `dist/curriculum.db` but does **not** auto-commit the LFS binary.

## Without Git LFS

If `curriculum.db` is a small pointer file (~130 bytes), run `git lfs pull` after clone. The app will fail to import curriculum until the real binary is present.

## On-device updates (Story 1.6)

See `mobile/assets/curriculum-manifest/README.md` for mock manifest URL config and dev testing of atomic curriculum swaps.
