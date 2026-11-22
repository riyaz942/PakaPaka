# Curriculum update fixture (tests only)

This folder holds one file: the test fixture `curriculum-mock-update.db`. It is not bundled in the app. Curriculum updates come from signed releases in R2 (see [`docs/curriculum-releases.md`](../../../docs/curriculum-releases.md)).

| File | Purpose |
| --- | --- |
| `curriculum-mock-update.db` | Fixture DB copied from seed with bumped `curriculum_metadata.version` |

The fixture is a copy of the early 114-item N5 seed. Its item slugs went through `curriculum/_build/slug-renames.json` (17 kanji renamed); slugs from before that map are unchanged. Tests read only its bytes, so after any change to the file update `content_hash` in `mobile/__mocks__/expo-sqlite.ts`.

## Manifest URL

There is one manifest URL and no setting for it: `<API base>/api/curriculum/s<REQUIRED_CURRICULUM_SCHEMA_VERSION>/manifest.json`. On web the base is empty (same origin). On native it is `API_BASE_URL` (`mobile/src/config/api.ts`). Its only override is the build-time `EXPO_PUBLIC_API_BASE_URL`. There is no dev mock manifest and no placeholder URL.

## Wi-Fi policy

Native downloads run on Wi-Fi only, in every build (`curriculumDownloadNeedsWifi()`). Web has no Wi-Fi rule.
