# Curriculum update manifest (dev / tests)

Bundled artifacts for Story 1.6 local version check and atomic on-device `curriculum.db` swap.

| File | Purpose |
| --- | --- |
| `mock-manifest.json` | Dev default manifest (`1.0.1-n5-seed-mock`) with SHA-256 of `curriculum-mock-update.db` |
| `curriculum-mock-update.db` | Fixture DB copied from seed with bumped `curriculum_metadata.version` |

The fixture is a copy of the early 114-item N5 seed. Its item slugs went through `curriculum/_build/slug-renames.json` (17 kanji renamed); slugs from before that map are unchanged. Tests read only its bytes, so after any change to the file update `sha256` in `mock-manifest.json` and `content_hash` in `mobile/__mocks__/expo-sqlite.ts`.

## Manifest URL configuration

Set one of:

- `EXPO_PUBLIC_CURRICULUM_MANIFEST_URL` — remote manifest JSON URL
- `expo.extra.curriculumManifestUrl` in app config

When unset in `__DEV__`, the app loads `mock-manifest.json` via the `bundled://mock-manifest` scheme.

Production builds without a URL fall back to `https://example.invalid/curriculum-manifest.json` (check is non-fatal).

## Wi‑Fi policy

Downloads run on Wi‑Fi in production. In `__DEV__`, any connected network is allowed for faster local testing.
