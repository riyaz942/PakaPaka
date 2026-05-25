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

Commit the updated `curriculum.db` when JSON changes. CI (`.github/workflows/compile-curriculum.yml`) validates and compiles to `dist/curriculum.db` but does **not** auto-commit the LFS binary.

## Without Git LFS

If `curriculum.db` is a small pointer file (~130 bytes), run `git lfs pull` after clone. The app will fail to import curriculum until the real binary is present.
