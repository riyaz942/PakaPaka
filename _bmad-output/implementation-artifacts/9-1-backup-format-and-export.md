---
baseline_commit: acb7007bade3a0c881fd7cfe9bca9ad07fd9ba16
---
# Story 9.1: Backup Format & Export

Status: ready-for-dev

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

- [ ] **Task 1 — Backup types + pure serializer** (AC: 1, 2, 5, 7)
  - [ ] Create `mobile/src/core/backup/` for pure logic with no I/O, mirroring how `src/core/import/` splits pure mapping from the `src/data/import/` clients. Suggested split: `backup.types.ts`, `backupSerializer.ts`, `slugResolver.ts`.
  - [ ] Define `BackupBundle`, `BackupEnvelope`, and per-table row types. Mirror the naming/shape conventions in `mobile/src/core/import/import.types.ts` (`ImportPreview`, `ImportSummary`) rather than inventing a parallel style.
  - [ ] `slugResolver.ts` — bidirectional `itemId ↔ {item_type, slug}` resolution against the attached `curriculum` schema. Read `mobile/src/data/database.ts` first for how `CURRICULUM_ATTACH_ALIAS` joins are done; do not open a second connection.
  - [ ] Serializer and parser must be pure functions taking already-read rows, so they can be unit-tested without a database.
- [ ] **Task 2 — Export implementation** (AC: 2, 3, 4, 6)
  - [ ] Add `exportBackup()` under `mobile/src/data/user/`. Returns `Result<T, AppError>` per the project convention (`src/types/result.types.ts`) — do not throw across the async boundary.
  - [ ] Read every table in AC2. **Verify the table list against `mobile/src/data/migrations/` rather than trusting this story** — migrations `001`–`018` are the source of truth, and Epic 7 may add `019_card_registry.ts` before this lands. If a new user-state table exists by then, include it and say so in completion notes.
  - [ ] Gate `ai_sessions` / `ai_messages` behind an explicit `includeConversations` argument defaulting to `false`.
  - [ ] Never read from secure storage in this code path at all — exclusion by construction, not by filtering.
  - [ ] Gzip and write the file. `expo-file-system` is already used for downloads in `src/data/curriculum/curriculumUpdate.ts` — follow whichever import path that file uses (`expo-file-system/legacy`), since `mobile/__mocks__/expo-file-system.ts` only mocks that path. Extend the mock if you need a write function it does not yet cover.
  - [ ] Check whether a gzip helper is needed — `jszip` is already a dependency, but prefer the smallest thing that works; note in completion notes what you used and why.
- [ ] **Task 3 — Settings UI** (AC: 4, 6)
  - [ ] Add a backup entry point to `mobile/src/app/(tabs)/settings.tsx` with the conversations-include toggle and a share action.
  - [ ] Use semantic NativeWind tokens only — no raw hex, no deprecated `Colors` from `src/constants/theme.ts`.
  - [ ] Show the real exported item count and file size after export; do not show a placeholder.
- [ ] **Task 4 — Tests** (AC: 1, 7)
  - [ ] Round-trip unit tests: seeded rows → bundle → parsed rows are identical on every covered table.
  - [ ] Slug-resolution test using a fixture curriculum whose integer ids are deliberately shifted relative to the export, proving progress lands on the correct items. This is the test that justifies AC1 — do not skip it.
  - [ ] A test asserting no credential value can appear in the output.
  - [ ] Co-locate as `*.test.ts` next to the source, per project convention.

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

### Debug Log References

### Completion Notes List

### File List

### Review Findings

## Change Log

| Date | Version | Description | Author |
| --- | --- | --- | --- |
| 2026-08-07 | 0.1 | Story drafted from `docs/design/backup-and-web-plan.md` Part A | Claude |
