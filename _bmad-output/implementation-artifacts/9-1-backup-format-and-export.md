---
baseline_commit: acb7007bade3a0c881fd7cfe9bca9ad07fd9ba16
---
# Story 9.1: Backup Format & Export

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a learner,
I want to export my progress to a file I keep,
so that reinstalling, switching phones, or a browser clearing its storage does not erase months of study.

## Acceptance Criteria

1. **Slug-keyed, not id-keyed:** every item reference in the backup is a `{item_type, slug}` pair, never a `curriculum.db` integer row id. `items` is `UNIQUE (item_type, slug)` with an `INTEGER PRIMARY KEY` assigned by the compile step — ids shift on recompile/OTA, so an id-keyed backup would silently reattach progress to the wrong kanji after a curriculum update.
2. **Covers all user progress state:** `item_study_status`, `srs_states`, `user_preferences`, `personal_mnemonics`, `user_synonyms`, `furigana_overrides`, `related_item_boosts`, `goal_ring_state`, `daily_lesson_log`, `cognitive_load_history`, `streaks`, `passage_practice_results`, `weakness_stats`, `import_metadata`. `schema_migrations` is recorded as a `schemaVersion` number, not exported as rows.
3. **Credentials are never exported:** BYOK provider keys (`src/data/ai/byokCredentialStore.ts`, `src/data/user/credentialStore.ts`) are excluded unconditionally — not behind a toggle.
4. **AI transcripts are opt-in, default off:** `ai_sessions` / `ai_messages` are excluded unless the learner explicitly ticks the option.
5. **Format is gzipped JSON in one `.json.gz` file** with envelope fields `format: "kizamu-backup"`, `formatVersion: 1`, `schemaVersion`, `curriculumVersion`, `exportedAt`, `includesConversations`, and a `data` object of per-table rows.
6. **Export is offline and local:** written on-device, handed to the OS share sheet. Nothing is uploaded.
7. **Round-trip is lossless:** a full database exported and re-parsed yields identical rows on every covered table.

## Tasks / Subtasks

- [x] **Task 1 — Backup types + pure serializer** (AC: 1, 2, 5, 7)
  - [x] Create `mobile/src/core/backup/` for pure logic with no I/O, mirroring how `src/core/import/` splits pure mapping from the `src/data/import/` clients. Suggested split: `backup.types.ts`, `backupSerializer.ts`, `slugResolver.ts`.
  - [x] Define `BackupBundle`, `BackupEnvelope`, and per-table row types. Mirror the naming/shape conventions in `mobile/src/core/import/import.types.ts` (`ImportPreview`, `ImportSummary`) rather than inventing a parallel style.
  - [x] `slugResolver.ts` — bidirectional `itemId ↔ {item_type, slug}` resolution against the attached `curriculum` schema. Read `mobile/src/data/database.ts` first for how `CURRICULUM_ATTACH_ALIAS` joins are done; do not open a second connection.
  - [x] Serializer and parser must be pure functions taking already-read rows, so they can be unit-tested without a database.
- [x] **Task 2 — Export implementation** (AC: 2, 3, 4, 6)
  - [x] Add `exportBackup()` under `mobile/src/data/user/`. Returns `Result<T, AppError>` per the project convention (`src/types/result.types.ts`) — do not throw across the async boundary.
  - [x] Read every table in AC2. **Verify the table list against `mobile/src/data/migrations/` rather than trusting this story** — migrations `001`–`018` are the source of truth, and Epic 7 may add `019_card_registry.ts` before this lands. If a new user-state table exists by then, include it and say so in completion notes.
  - [x] Gate `ai_sessions` / `ai_messages` behind an explicit `includeConversations` argument defaulting to `false`.
  - [x] Never read from secure storage in this code path at all — exclusion by construction, not by filtering.
  - [x] Gzip and write the file. `expo-file-system` is already used for downloads in `src/data/curriculum/curriculumUpdate.ts` — follow whichever import path that file uses (`expo-file-system/legacy`), since `mobile/__mocks__/expo-file-system.ts` only mocks that path. Extend the mock if you need a write function it does not yet cover.
  - [x] Check whether a gzip helper is needed — `jszip` is already a dependency, but prefer the smallest thing that works; note in completion notes what you used and why.
- [x] **Task 3 — Settings UI** (AC: 4, 6)
  - [x] Add a backup entry point to `mobile/src/app/(tabs)/settings.tsx` with the conversations-include toggle and a share action.
  - [x] Use semantic NativeWind tokens only — no raw hex, no deprecated `Colors` from `src/constants/theme.ts`.
  - [x] Show the real exported item count and file size after export; do not show a placeholder.
- [x] **Task 4 — Tests** (AC: 1, 7)
  - [x] Round-trip unit tests: seeded rows → bundle → parsed rows are identical on every covered table.
  - [x] Slug-resolution test using a fixture curriculum whose integer ids are deliberately shifted relative to the export, proving progress lands on the correct items. This is the test that justifies AC1 — do not skip it.
  - [x] A test asserting no credential value can appear in the output.
  - [x] Co-locate as `*.test.ts` next to the source, per project convention.

## Dev Notes

**Read `docs/design/backup-and-web-plan.md` Part A before starting.** The format decisions above were settled deliberately (2026-08-06/07) and are not open for re-litigation inside the story: slug keying, unconditional credential exclusion, opt-in transcripts, `.json.gz`.

**Why plain JSON and not SQLite bytes.** JSON survives schema drift, is inspectable by the learner (the point of an open, no-accounts app), and restores across platforms where the SQLite page format or VFS differs — which matters because the web build uses an OPFS-backed VFS. See `docs/design/web-sqlite-attach-findings.md`.

**No migration required.** This story reads existing tables and adds no schema. Last migration is `018_ai_session_topic_ids.ts`; Epic 7 has claimed `019_card_registry.ts` — do not take `019`.

**Restore is deliberately not in this story.** Story 9.2 covers parse/preview/replace-all and the backup nudge. Keep the serializer symmetric so 9.2 only adds the write path, but do not build restore UI here.

**Result convention.** `exportBackup()` is a fallible async data operation, so it returns `Result<T, AppError>` — matching `src/data/import/` and `src/data/curriculum/curriculumUpdate.ts`, not the synchronous unwrapped style used by `preferencesRepository.ts`.

### Project Structure Notes

- Pure logic in `src/core/backup/`; I/O in `src/data/user/`. This mirrors the existing `core/import` ↔ `data/import` split and keeps the serializer testable without a DB.
- Path alias `@/*` → `mobile/src/*`.
- `expo-document-picker` (already used in `src/app/onboarding/import.tsx`) is for Story 9.2's restore, not needed here.

### References

- `docs/design/backup-and-web-plan.md` — Part A, format decisions A1 and steps A2.1–A2.2
- `mobile/src/core/import/import.types.ts` — shape conventions to mirror
- `mobile/src/data/database.ts` — dual-DB handles and `CURRICULUM_ATTACH_ALIAS`
- `mobile/src/data/migrations/` — authoritative user-table list
- `mobile/src/types/result.types.ts` — `Result<T, AppError>`
- `mobile/src/data/curriculum/curriculumUpdate.ts` — existing `expo-file-system` usage pattern

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

None — no non-obvious failures required a debug log. One environment finding worth recording: `jest-expo`'s setup (`node_modules/jest-expo/src/preset/setup.js`) calls `jest.mock('expo-file-system/legacy', ...)` with stateless `jest.fn()` stubs, which shadows this project's own `mobile/__mocks__/expo-file-system.ts` moduleNameMapper entry for that exact import path — `documentDirectory` and a working `writeAsStringAsync` come back `undefined`/no-op under test regardless of the custom mock file's content. This is the same reason `curriculumConfig.ts`'s `getDocumentDirectory` and `curriculumUpdate.ts`'s `readFileAsBase64`/`atomicReplaceCurriculumFile` branch on `process.env.NODE_ENV === 'test'` into `test-support/file-system-test-state.ts` directly; `exportBackup.ts` follows the same established pattern rather than relying on the shadowed mock.

### Completion Notes List

- **Table list vs. story AC2**: verified the live table list against `mobile/src/data/migrations/` (019 migrations, not 018) rather than trusting the story text. Migration `019_card_seen.ts` (Epic 7's guidance-card-seen tracking) exists and is exported unconditionally as `cardSeen` — it isn't in AC2's list but is genuine unconditional user-progress state with no credential/PII content, so it's included per the story's own instruction to include any new table found. `card_id` values are static app-known guidance-card ids, not curriculum items, so no slug resolution applies to that table.
- **`passage_practice_results` scope boundary**: `passage_id`/`question_id` reference `curriculum.reading_passages`/`curriculum.passage_questions`, which — unlike `items` — have no `slug` column at all in the curriculum schema (`scripts/curriculum-schema.ts`). AC1 and the story's `slugResolver.ts` subtask are scoped to `itemId ↔ {item_type, slug}` resolution specifically; there is no passage-level slug to resolve against, so these two columns are exported as raw (string-cast) curriculum row ids, unchanged from the source table. Documented here as a known scope boundary, not a gap introduced by this story — flagging for whoever scopes passage-level backup/restore robustness later.
- **Orphaned `item_id` handling**: if a progress row's `item_id` has no matching row in the currently-attached `curriculum.items` (e.g. a curriculum OTA update removed that item since the row was written), the row is skipped from that table's export rather than falling back to the raw integer id — falling back would reproduce exactly the bug AC1 exists to prevent. Covered by an `exportBackup.test.ts` case.
- **AI session topic-item resolution**: `ai_sessions.topic_item_id` (single id) and `.topic_item_ids` (JSON array of ids) are also item references, so both are slug-resolved to `ItemRef`/`ItemRef[]` when conversations are included — not left as raw ids, keeping AC1's guarantee uniform across every item reference in the backup, not just the tables AC2 enumerates.
- **Gzip helper**: added `pako` (`^2.1.0`) as a direct dependency rather than reaching into `jszip`'s private transitive copy (`jszip` depends on `pako@~1.0.2`, undocumented and not guaranteed stable across `jszip` version bumps) or using `jszip` itself (`jszip` only produces `.zip` container format — deflate-in-zip-with-headers — not the raw RFC 1952 gzip stream AC5's `.json.gz` requires). `pako@2.x` was chosen over the newer `pako@3.x` because 3.x ships ESM-only with no reliable CJS `require` entry, which risks Jest resolution issues under this project's CJS-oriented `jest-expo` transform; `2.1.0` has a `require` export and needed `@types/pako` added as a devDependency since it ships no bundled types.
- **`expo-sharing` dependency (user-approved)**: AC6 requires handing the backup file to the OS share sheet on both platforms. React Native's built-in `Share` module (used elsewhere in this codebase, e.g. Story 6.5's post-session summary, specifically to avoid new native deps) only forwards a shareable `url` on iOS — `Share.js`'s Android branch drops `content.url` entirely and only sends `title`/`message` to the native module, so it cannot share an actual file on Android. Confirmed with the user before adding `expo-sharing` (`npx expo install expo-sharing`), which is a new native module and needs a dev-client rebuild (`npx expo run:ios` / `run:android`) before the share button works on-device — it does not affect typecheck/lint/jest, all of which pass without a rebuild.
- **Settings placement**: added a "Backup" section between "Review queue"/Appearance/Furigana and "Daily reminders" in `settings.tsx` — a natural home near other data/session-state controls, not buried at the bottom.
- **Restore is out of scope** (per Dev Notes) — `slugResolver.ts` is bidirectional (`itemId → ref` and `ref → itemId`) so Story 9.2 only needs to add the read/write path, but no `restoreBackup()` or restore UI was added here. The bidirectional resolver is exercised by `slugResolver.test.ts`'s "id-shift round trip" test, which proves an id-keyed backup would land on the wrong item after a curriculum recompile while the slug-keyed resolution lands correctly — this is the test that justifies AC1.
- All four tasks' unit/integration tests pass; full repo test suite (230 suites / 1999 tests), `tsc --noEmit`, `npm run lint` (mobile), and `npm run check-contrast` (repo root) all pass with no regressions.

### File List

- `mobile/src/core/backup/backup.types.ts` (new)
- `mobile/src/core/backup/slugResolver.ts` (new)
- `mobile/src/core/backup/slugResolver.test.ts` (new)
- `mobile/src/core/backup/backupSerializer.ts` (new)
- `mobile/src/core/backup/backupSerializer.test.ts` (new)
- `mobile/src/data/user/exportBackup.ts` (new)
- `mobile/src/data/user/exportBackup.test.ts` (new)
- `mobile/src/app/(tabs)/settings.tsx` (modified — Backup section, export handler)
- `mobile/src/app/(tabs)/settings.test.tsx` (modified — Backup section tests)
- `mobile/package.json` (modified — added `pako`, `expo-sharing`; added `@types/pako` devDependency)
- `mobile/package-lock.json` (modified — dependency lockfile update)
- `mobile/app.json` (modified — `expo-sharing` config plugin, added by `npx expo install`)

### Review Findings

- [x] [Review][Patch] Orphan `item_id` rows are skipped; surface the omitted count in the Settings result [`mobile/src/data/user/exportBackup.ts:73`]
- [x] [Review][Patch] Share sheet failure or unavailability is treated as success [`mobile/src/app/(tabs)/settings.tsx:286`]
- [x] [Review][Patch] Empty curriculum item map still exports "successfully" with all item-keyed progress omitted [`mobile/src/data/user/exportBackup.ts:457`]
- [x] [Review][Patch] Item-id maps use raw `number` identity; rest of data layer String()/Number()s sqlite ids [`mobile/src/core/backup/slugResolver.ts:16`]
- [x] [Review][Patch] Same-day backup filename overwrites; export button re-enables before share sheet finishes [`mobile/src/data/user/exportBackup.ts:29`]
- [x] [Review][Patch] Opt-in conversation `summaryJson` copies `wordsMet[].itemId` as live curriculum row ids [`mobile/src/data/user/exportBackup.ts:418`]
- [x] [Review][Patch] `parseTopicItemIds` does not fall back to `topic_item_id` (pre-018 rows) [`mobile/src/data/user/exportBackup.ts:362`]
- [x] [Review][Patch] Export errors have no `userMessage`; Settings shows the raw exception text [`mobile/src/data/user/exportBackup.ts:505`]
- [x] [Review][Patch] Multi-table export reads are not in a snapshot transaction [`mobile/src/data/user/exportBackup.ts:456`]
- [x] [Review][Patch] Tests do not run export → `parseBackupBundle`, and the AC1 id-shift test never exports a progress row [`mobile/src/data/user/exportBackup.test.ts:85`]

- [x] [Review][Defer] `parseBackupBundle` only checks that each table is an array — deferred to Story 9.2 (A2.3 restore validation)
- [x] [Review][Defer] `passage_practice_results` keyed by curriculum integer ids — deferred to 9.2 / later format version; tables have no slug, keep raw ids in v1

## Change Log

| Date | Version | Description | Author |
| --- | --- | --- | --- |
| 2026-08-07 | 0.1 | Story drafted from `docs/design/backup-and-web-plan.md` Part A | Claude |
| 2026-08-14 | 1.1 | Code-review patches: omitted-count UI, share-sheet errors, id normalization, unique filenames, snapshot reads, conversation slug rewrite, tighter tests. | Cursor |
