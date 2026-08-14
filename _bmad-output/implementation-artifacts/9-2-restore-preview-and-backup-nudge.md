---
baseline_commit: 8c2c804
---
# Story 9.2: Restore, Preview & Backup Nudge

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a learner,
I want to restore a backup and see exactly what it will do before it happens,
so that I can move to a new device without silently losing or corrupting my review schedule.

## Acceptance Criteria

1. **Preview before commit:** restore parses the file and shows item counts and unmatched-slug counts before anything is written, reusing the existing preview-then-confirm *pattern* from `importPreviewStore.ts` rather than a second *mechanism*.
2. **Replace-all, never merge:** restore replaces user tables wholesale inside one transaction. Merging two FSRS histories has no correct answer, and a half-merged schedule is worse than either input. The confirm step says plainly that current progress will be replaced.
3. **Unmatched slugs are surfaced, not dropped:** slugs absent from the current curriculum are counted and shown, matching the transparency precedent set by Story 3.5 (import summary).
4. **Corrupt input fails as a typed error:** a truncated, non-gzip, wrong-`format`, or future-`formatVersion` file produces a `Result<T, AppError>` — never an uncaught throw, per the project Result convention.
5. **Cross-platform round trip:** a backup exported on mobile restores on web and vice versa, since the format is platform-neutral JSON rather than SQLite bytes. *This story proves the format, not the Part B web learner app.*
6. **Backup nudge:** a "last backed up N days ago" indicator in Settings, clearing on export. On web it also takes the existing Home conditional-banner slot, because browser storage is evictable.
7. **Restore is an onboarding import source:** "Kizamu backup" joins WaniKani / Bunpro / Anki as a fourth option on `src/app/onboarding/import.tsx`, reusing the same file-pick → preview → summary flow the Anki path already uses. A fresh install is the primary moment a learner restores, so it must not be buried in Settings.
8. **Restoring skips the rest of onboarding:** a backup already carries `user_preferences` (intensity, daily goal, theme, furigana mode) and `item_study_status`. After a successful restore the learner goes straight to `complete` — never through `intensity` or `placement`, which would re-ask answered questions and let placement overwrite restored study status. This differs from the other three import sources, which continue to `intensity`.

## Tasks / Subtasks

- [x] **Task 1 — Tighten parse + add restore types** (AC: 1, 3, 4)
  - [x] Keep `parseBackupBundle` envelope checks as they are (`BACKUP_INVALID_JSON` / `BACKUP_FORMAT_MISMATCH` / `BACKUP_VERSION_UNSUPPORTED` / `BACKUP_INVALID_SHAPE`). Do not break Story 9.1 tests.
  - [x] Add row-shape validation in `mobile/src/core/backup/` (new `validateBackupData` in `backupSerializer.ts` or a sibling `backupValidator.ts` — no barrel). Null rows, missing `item` refs on item-keyed tables, and non-object entries → `BACKUP_INVALID_SHAPE`. Extra unknown keys in `data` are ignored (forward compatible).
  - [x] Add `BackupPreview` / `BackupSummary` in `backup.types.ts`, mirroring the *naming* of `ImportPreview` / `ImportSummary` — **do not** add `'kizamu'` to `ImportSource` in `core/import/import.types.ts` (see Dev Notes).
  - [x] Suggested preview shape: `{ bundle, summary: { itemCount, unmatchedSlugCount, unmatchedPassageCount, includesConversations, exportedAt, curriculumVersion, schemaVersion } }`. Counts are computed against the live curriculum map; nothing is written.
- [x] **Task 2 — `previewRestore` / `restoreBackup` data layer** (AC: 1, 2, 3, 4, 5)
  - [x] Add `mobile/src/data/user/restoreBackup.ts`. Returns `Result<T, AppError>`. Never throw across the async boundary. Every error needs a `userMessage`.
  - [x] File read + gunzip: inverse of `exportBackup.ts`. Use already-installed `pako@^2` (`pako.ungzip(bytes, { to: 'string' })` — **not** pako 3's `toText`). Wrap gunzip throws as `BACKUP_INVALID_GZIP`. Follow the same `NODE_ENV === 'test'` → `test-support/file-system-test-state.ts` branch as export (`getMockFileContents`); `jest-expo` still shadows `expo-file-system/legacy`.
  - [x] `previewRestore(userDb, fileUri)`: read → ungzip → `parseBackupBundle` → `validateBackupData` → resolve slugs via existing `buildItemRefToIdMap` / `resolveItemRefToId` → return `BackupPreview`. No writes.
  - [x] `restoreBackup(userDb, preview, origin)`: **one** `withTransactionSync` of raw SQL. Re-resolve slugs inside the transaction (do not trust ids cached at preview time). DELETE every restore table, then INSERT. Skip unmatched slugs (already counted). Skip `passage_practice_results` whose `passageId`/`questionId` are absent from the attached curriculum (count them; do not invent slugs — v1 keeps raw ids, per 9.1 defer). Do **not** loop `upsertSrsState` / `bulkSetStudyStatusKnown` / `persistMappedImportItems` — those `ON CONFLICT DO UPDATE` (merge) and several open their own nested `withTransactionSync`.
  - [x] **Column types the JSON omits or disguises (will fail CHECK / PK if ignored):** `goal_ring_state` and `streaks` are single-row tables with `CHECK(id = 1)` — INSERT `id = 1` even though `BackupData` has no `id`. `furigana_overrides.item_id` is **TEXT** PK (`016`); most other item tables are INTEGER; `ai_sessions.topic_item_id` is TEXT (`017`). Match the column type on INSERT.
  - [x] `ai_messages.session_id` references `ai_sessions(id) ON DELETE CASCADE`. `database.ts` sets `PRAGMA foreign_keys = ON` on the real handle, but `mobile/__mocks__/expo-sqlite.ts` does not enforce FKs — delete messages before sessions and insert sessions before messages either way.
  - [x] **Replace-all includes conversations:** if `includesConversations === false`, `ai_sessions` / `ai_messages` are emptied. The restored device matches the file, not a merge of old chats + new progress.
  - [x] **Never write `schema_migrations`.** Live migrations stay. **Never touch secure storage.**
  - [x] `schemaVersion` > current `MAX(version)` from `schema_migrations` → typed `BACKUP_SCHEMA_TOO_NEW` (do not write). `schemaVersion` < current → restore known tables; newer tables (e.g. `card_seen` on an older file) stay empty after DELETE. Curriculum version mismatch is informational in the preview, not a hard fail — unmatched slugs already cover missing items.
  - [x] `origin: 'onboarding' | 'settings'` is applied **inside** the same transaction: settings keeps restored `onboarding_completed`; onboarding deletes/overrides it to false and sets `onboarding_path=import`. After a successful write: set `last_backed_up_at` to `bundle.exportedAt` so a freshly restored device is not "Never backed up".
- [x] **Task 3 — Preview store + Settings restore UI** (AC: 1, 2, 3, 6)
  - [x] Extend `mobile/src/data/import/importPreviewStore.ts` with a **parallel** backup slot in the same module (`setBackupPreview` / `getBackupPreview` / `clearBackupPreview`). Do not create a second store file. Do not jam a `BackupPreview` into `ImportPreview.mapped`. `setImportPreview` clears the backup slot and vice versa so `import-summary` never sees both. Existing `set/get/clearImportPreview` signatures stay unchanged.
  - [x] Add a shared `RestorePreviewCard` (named export) under `mobile/src/components/` — do **not** reuse `ImportSummaryCard` (`SOURCE_LABELS` is WK/Bunpro/Anki-only and talks mapped/burned/apprentice). Show item counts, unmatched-slug count (list slugs if cheap; count is the AC), unmatched-passage count, `includesConversations`, `exportedAt`. Zero unmatched → positive empty state **"All items matched"** (Story 3.5), not a blank section. Confirm copy: **"This replaces your current progress on this device."** Button `variant="destructive"`. Unmatched does not block confirm. This codebase has **no** `Alert.alert`; do not add one.
  - [x] Settings Backup section (`settings.tsx`): add "Restore from backup" next to the existing export control. File pick via `expo-document-picker` (already a dependency; already used for Anki). MIME types are unreliable for `.json.gz` — include `application/gzip`, `application/json`, `application/octet-stream`, and allow any (`*/*` or omit type) so iOS Files / Android Downloads can select the file. Parse → `setBackupPreview` → render `RestorePreviewCard` **inline in Settings** (do **not** `router.push` into `/onboarding/*` — `useOnboardingRedirect` bounces completed users out of onboarding). After a successful Settings restore, re-read intensity / goal / theme from `userDb` so the rest of the screen does not keep pre-restore React state. Picker cancel is a no-op, not an error.
  - [x] Persist last-backed-up: add `lastBackedUpAt: 'last_backed_up_at'` to `PREFERENCE_KEYS` (KV row, **no migration**). Write it inside `exportBackup()` on successful file write (share-sheet failure still counts as a backup, matching 9.1). Settings shows "Never backed up" or "Last backed up today / yesterday / N days ago".
- [x] **Task 4 — Onboarding fourth source + skip intensity/placement** (AC: 7, 8)
  - [x] `import.tsx`: add a fourth pill `{ value: 'kizamu', label: 'Backup' }` on the **local** UI union only. Follow the Anki branch: `DocumentPicker.getDocumentAsync` → `previewRestore` → `setBackupPreview` → `router.push('./import-summary')`. Do **not** require the JLPT picker for this source (the backup already has `starting_jlpt_level`). Hide or ignore the picker on the Backup pane. Copy should say this restores *this app's* progress, not a third-party SRS.
  - [x] Four pills may crowd `SegmentedPill`. If labels truncate on a 320pt width, wrap the track or stack the Backup option as its own control — **do not ship truncated "WaniK…" labels**. Check the layout; do not assume `expand` scales to four.
  - [x] `import-summary.tsx`: if `getBackupPreview()` is set, render `RestorePreviewCard` instead of `ImportSummaryCard`. On confirm: `restoreBackup` → `clearBackupPreview` → `setOnboardingPath(userDb, 'import')` → **force `onboarding_completed` off** (the backup from another device will have it `true`, and `useOnboardingRedirect` would then skip `complete` and dump them on Home) → `router.replace('/onboarding/complete')`. WK/Bunpro/Anki path is unchanged (`/onboarding/intensity`).
  - [x] `complete.tsx`: when arriving from restore (query param `restored=1` or equivalent), do not say "Start your first lesson". Primary CTA: "Continue learning" → `/(tabs)` (lesson is optional). Same `setOnboardingCompleted` as today.
- [x] **Task 5 — Web Home backup banner** (AC: 6)
  - [x] Settings indicator is always on, all platforms.
  - [x] Home conditional banner slot (`mobile/src/app/(tabs)/index.tsx`, UX-DR5): add a dismissible backup nudge **only when `Platform.OS === 'web'`**, because browser storage is evictable (Part A / B0). Native Home stays unchanged — the OS already backs up the sandbox; Settings is enough.
  - [x] Show when last backup is missing or ≥ 7 days ago (Safari's ~7-day eviction window). Slot priority: keep welcome-back → curriculum-update above this banner; this banner outranks the import nudge on web. Session-dismiss (existing import-nudge pattern), not a new preference. CTA opens Settings. Update `index.test.tsx` priority cases; mock `Platform.OS`.
  - [x] Do **not** implement Part B (Cloudflare Pages, PWA, `web/` Curriculum Studio). `web/` is the CMS, not the learner app. AC5 is satisfied by gzip+JSON round-trip tests, not by shipping a web restore UI in Studio.
- [x] **Task 6 — Tests** (AC: 1–8)
  - [x] Gunzip + parse: truncated gzip, random bytes, plain JSON (non-gzip), wrong `format`, `formatVersion: 2` — each a typed `AppError` with `userMessage`. Co-locate next to source.
  - [x] Row-shape: null row / missing `item` → `BACKUP_INVALID_SHAPE`.
  - [x] Unmatched slugs counted in preview and **absent** from the DB after restore.
  - [x] Replace-all: seed SRS on item A, restore a backup for item B, item A is gone.
  - [x] Conversations-off backup empties existing `ai_sessions`.
  - [x] Id-shift: export against curriculum ids `{1,2,3}`, restore against `{101,102,103}` with the same slugs — progress lands on 102, not 2. Reuse `slugResolver.test.ts`'s fixture idea; this is the restore half of AC1.
  - [x] `schemaVersion` too new fails; older schemaVersion restores.
  - [x] Device curriculum install prefs (`installed_curriculum_version`, `installed_curriculum_content_hash`, `curriculum_update_source`) survive restore.
  - [x] Secure storage untouched (no credential values written).
  - [x] `exportBackup` writes `last_backed_up_at`; Settings shows it; Home web banner appears when stale.
  - [x] Onboarding: Backup confirm navigates to `/onboarding/complete`, not `/onboarding/intensity`. Existing WK/Anki `import-summary` tests still pass. Add an `import.tsx` test that the Backup pane does not require a JLPT pick and routes through preview.
  - [x] Round-trip: `exportBackup` → `restoreBackup` into a wiped DB → SRS / study status / preferences (minus preserved keys) match. Use `getMockFileContents` to close the file loop. Copy the ungzip already in `exportBackup.test.ts` (`pako.ungzip(bytes, { to: 'string' })`).
  - [x] Transaction rollback: a throw mid-restore leaves prior SRS intact. Extend `mobile/__mocks__/expo-sqlite.ts` `withTransactionSync` snapshot list (today only `srs_states` / `import_metadata` / `item_study_status` / `ai_sessions` / `ai_messages`) to cover every table restore writes, or the mock will not roll back `user_preferences` / `goal_ring_state` / etc. and the test will lie.

### Review Findings

- [x] [Review][Patch] Settings restore does not refresh mount-cached hooks (vacation, furigana override list, auto-advance, reduced motion) [mobile/src/app/(tabs)/settings.tsx:392]
- [x] [Review][Patch] Settings restore does not reconcile the OS notification schedule [mobile/src/app/(tabs)/settings.tsx:392]
- [x] [Review][Patch] Envelope parse errors, including future formatVersion, reuse the gzip “pick the .json.gz” userMessage [mobile/src/data/user/restoreBackup.ts:228]
- [x] [Review][Patch] File-pick loading UI says “Restoring…” during a read-only preview [mobile/src/components/backup/RestorePreviewCard.tsx:145]
- [x] [Review][Patch] countRows walks every enumerable data key, so extra tables inflate or NaN the preview count [mobile/src/data/user/restoreBackup.ts:186]
- [x] [Review][Patch] Validator allows omitted aiSessions.topicItems; preview then throws in collectItemRefs [mobile/src/core/backup/backupValidator.ts:38]
- [x] [Review][Patch] Onboarding backup pick navigates to import-summary even if the learner already left the screen [mobile/src/app/onboarding/import.tsx:217]
- [x] [Review][Patch] A future exportedAt is “Never backed up” in Settings but treated as fresh by the web Home nudge [mobile/src/core/backup/backupFreshness.ts:27]

## Dev Notes

**Read `docs/design/backup-and-web-plan.md` Part A before starting.** Replace-all, slug keying, credential exclusion, and `.json.gz` are settled (2026-08-06/07). Do not re-litigate.

**Story 9.1 already shipped the read half.** Reuse; do not rewrite:

| Piece | Path | What 9.2 does |
| --- | --- | --- |
| Types / envelope | `core/backup/backup.types.ts` | Add `BackupPreview` / `BackupSummary` only |
| Parse envelope | `core/backup/backupSerializer.ts` `parseBackupBundle` | Keep; add row validator beside it |
| Slug maps | `core/backup/slugResolver.ts` `buildItemRefToIdMap` / `resolveItemRefToId` | Call these; they are already bidirectional and Number()-normalize sqlite ids |
| Export + gzip write | `data/user/exportBackup.ts` `pako.gzip` | Inverse read; also persist `last_backed_up_at` on success |
| Settings export UI | `app/(tabs)/settings.tsx` Backup section | Add restore + last-backed-up text; do not regress export tests |

**`importPreviewStore` is the mechanism, not the type.** Same module, parallel slot — that is what AC1 means by “rather than a second mechanism.” `ImportPreview.source` is `'wanikani' \| 'bunpro' \| 'anki'`. `import_metadata.source` has `CHECK(source IN ('wanikani', 'bunpro', 'anki'))` (`003_srs_states_and_import_metadata.ts`). Adding `'kizamu'` to `ImportSource` would require a migration this epic forbids, would break `confirmCredentialedImport`, and would type-error `ImportSummaryCard.SOURCE_LABELS`. Restore is not a third-party import; do not INSERT `source='kizamu'` into `import_metadata`. A restored backup with no WK/Bunpro/Anki rows will still show the Home import nudge (`countImportMetadataRows === 0`) — leave that; do not fake an import-metadata row.

**Onboarding redirect trap (will silently skip AC8 if ignored):**

```
useOnboardingRedirect: if isOnboardingCompleted && inOnboarding → router.replace('/(tabs)')
```

A backup from a finished device has `onboarding_completed=true`. After replace-all, navigating to `/onboarding/complete` would bounce to Home. Force that preference off (or delete the key) as the last step of an **onboarding** restore, then let `complete.tsx` set it true. Settings restore leaves `onboarding_completed` as in the backup (already true).

**Same trap in the other direction:** an in-progress onboarding user who leaves `/onboarding/*` is redirected by intensity/level checks. Settings restore therefore cannot live on an onboarding route. Preview stays inline in Settings.

**Preserve these preference keys across replace-all** (snapshot before DELETE, write back after). They describe *this* device's curriculum install, not learner progress — clobbering them breaks OTA:

- `installed_curriculum_version`
- `installed_curriculum_content_hash`
- `curriculum_update_source`

Then write `last_backed_up_at` = `exportedAt`. For onboarding restore, also force `onboarding_completed` off and `onboarding_path=import` (existing union — do not add a fourth path; `isImportOnboardingPath` already treats `import` as "go to complete").

**Tables to wipe+replace** (match `BackupData` / 9.1 export, including `card_seen` from migration 019). Do **not** touch `schema_migrations`.

**`passage_practice_results`:** still raw curriculum ids in v1 (no slug column on those tables). Count unmatched passage/question ids in the preview; skip those rows. Do not block the whole restore. Do not add a formatVersion bump.

**Gunzip:** `pako@^2.2.0` is already a direct dependency because 9.1 chose it over `jszip` (zip container ≠ gzip) and over pako 3 (ESM-only, breaks jest-expo CJS). Do not add a gzip library. Catch `pako.ungzip` throws — they are not `Result`s.

**Document picker:** Anki uses `type: ['application/zip', 'application/octet-stream']`. `.json.gz` is often `application/gzip`, `application/x-gzip`, or unlabeled. Prefer a wide type list so restore is not "file picker can't see my backup".

**Result / errors.** Follow `exportBackup.ts`: `userMessage` on every code. Suggested codes: reuse `BACKUP_INVALID_JSON`, `BACKUP_INVALID_SHAPE`, `BACKUP_FORMAT_MISMATCH`, `BACKUP_VERSION_UNSUPPORTED`; add `BACKUP_INVALID_GZIP`, `BACKUP_SCHEMA_TOO_NEW`, `BACKUP_RESTORE_FAILED`. `parseBackupBundle` is JSON-only — ungzip in the I/O layer, then parse. Plain-JSON (unzipped) files fail as non-gzip with a message that says to pick the `.json.gz` file. Restore-txn failure `userMessage` should match import honesty: previous progress was not changed (`importRepository.ts`: *“Import could not be saved. Your previous progress was not changed.”*).

**Credentials on restore.** Replace-all is `user.db` only. Secure storage is untouched: a Settings restore onto a device that already has BYOK keys **keeps those keys**, even if restored prefs name a different provider. Do not wipe Keychain/Keystore. Do not add “re-enter your API key” copy unless it is a one-line note on the preview. Fresh install has no keys — Talk stays unconfigured, which is correct.

**No migration.** Last user migration is `019_card_seen.ts`. Do not take `020`. `last_backed_up_at` is a `user_preferences` key.

**Styling.** Semantic NativeWind tokens only. Destructive confirm = existing `Button` `destructive` variant. `RestorePreviewCard` is a named export; Expo Router screens stay default-exported.

**Web AC5/AC6 scope.** This epic ships *before* Part B and is independently valuable on mobile. The Expo app already has a web `Platform.OS`. Implement the Home banner behind `Platform.OS === 'web'` in the existing learner Home. Do not touch `web/` (Curriculum Studio). Do not add Cloudflare/`_headers`/PWA work.

### Project Structure Notes

```
mobile/src/core/backup/          UPDATE — validator + preview types; still React-free, no I/O
mobile/src/data/user/restoreBackup.ts          NEW — preview + replace-all transaction
mobile/src/data/user/exportBackup.ts           UPDATE — persist last_backed_up_at
mobile/src/data/user/preferencesRepository.ts  UPDATE — PREFERENCE_KEYS.lastBackedUpAt + getters
mobile/src/data/import/importPreviewStore.ts   UPDATE — parallel backup slot; ImportPreview API unchanged
mobile/src/core/import/import.types.ts         UNCHANGED
mobile/src/components/.../RestorePreviewCard.tsx  NEW
mobile/src/app/(tabs)/settings.tsx             UPDATE — restore + nudge text
mobile/src/app/(tabs)/index.tsx                UPDATE — web-only banner in existing slot
mobile/src/app/onboarding/import.tsx           UPDATE — fourth pill, Anki-like file branch
mobile/src/app/onboarding/import-summary.tsx   UPDATE — branch on getBackupPreview() → complete
mobile/src/app/onboarding/complete.tsx         UPDATE — restore CTA copy
```

Path alias `@/*` → `mobile/src/*`. No barrels in `core/` or `data/`.

### Previous Story Intelligence (9.1)

- Orphan `item_id`s are **skipped** on export, never written as raw ids. Restore's unmatched-slug path is the inverse — skip + count, never write an unresolved row.
- Item maps use `Number()` identity (`slugResolver.ts`); sqlite may hand back strings. Restore inserts must use the resolved numeric id.
- `parseBackupBundle` only checks that each `BACKUP_DATA_KEYS` value is an array — **this story owns row-shape checking** (deferred from 9.1 review).
- `jest-expo` shadows `expo-file-system/legacy`. Copy the test-mode file store; do not "fix" the mock.
- Share-sheet failure is not an export failure. Nudge timestamp follows file write, not share success.
- `card_seen` is part of the bundle even though epic AC2 originally omitted it — restore it.
- `ai_sessions.topic_item_id` / `topic_item_ids` / `summaryJson` wordsMet item ids are slug-resolved on export. Restore must map them back.
- Credentials were never in the file; restore must not invent a write to `expo-secure-store`.

### Git Intelligence

- Latest relevant commit: `8c2c804 feat: complete backup format and export functionality`. Working tree may still contain 9.1 review patches — implement against the **current** `core/backup` + `exportBackup.ts`, not the epic's outdated "018 migrations / no export code" snapshot.
- `pako` `^2.2.0`, `@types/pako`, `expo-sharing`, `expo-document-picker ~55.0.14` are already in `mobile/package.json`. No new native modules. No `npx expo install` unless you discover a missing read API, which you will not — `readAsStringAsync` is already used by `ankiFileReader.ts`.
- Import confirm is **upsert/merge** (`ON CONFLICT DO UPDATE` in `importRepository.ts`). Restore is the opposite. Do not call `confirmCredentialedImport` or `persistMappedImportItems`.

### Latest Tech Notes

- **pako 2.x** (`ungzip`/`inflate`, option `{ to: 'string' }`). Pako 3 replaced that with `{ toText: true }` and went ESM-only — 9.1 rejected 3.x for Jest. Stay on 2.x.
- **expo-document-picker 55:** `getDocumentAsync({ copyToCacheDirectory: true, type })`. iOS often ignores MIME and filters by UTType; a narrow gzip type list will hide `.json.gz` in Files. Wide types + `copyToCacheDirectory: true` (Anki already does this).
- Do not use `jszip` for this file; it is a zip container, not gzip.

### References

- `docs/design/backup-and-web-plan.md` — Part A A1.5, A2.3–A2.5, A2.4b/c, A3, B0 (7-day eviction), B3.7 (web Home banner is Part B's *assertive* wiring; this story only uses the existing Expo `Platform.OS === 'web'` slot)
- `_bmad-output/planning-artifacts/epics.md` — Epic 9 / Story 9.2
- `_bmad-output/implementation-artifacts/9-1-backup-format-and-export.md` — format, files, deferred parse validation
- `_bmad-output/implementation-artifacts/deferred-work.md` — 9.1 deferrals this story owns
- `mobile/src/data/import/importPreviewStore.ts` — extend with parallel backup slot; do not replace
- `mobile/__mocks__/expo-sqlite.ts` — `withTransactionSync` snapshot list must cover restore tables
- `mobile/src/data/migrations/009_streak.ts` / `015_goal_ring_state.ts` — `CHECK(id = 1)`
- `mobile/src/data/migrations/016_furigana_overrides.ts` — `item_id TEXT`
- `mobile/src/app/onboarding/import.tsx` — Anki file-pick branch (~137–181), local `ImportSource` + `SOURCE_OPTIONS`
- `mobile/src/app/onboarding/import-summary.tsx` — hard-route to intensity at confirm (~61)
- `mobile/src/hooks/useOnboardingRedirect.ts` — completed-in-onboarding bounce; incomplete-outside-onboarding bounce
- `mobile/src/app/(tabs)/index.tsx` — single conditional banner slot (~452–501)
- `mobile/src/data/migrations/003_srs_states_and_import_metadata.ts` — `import_metadata.source` CHECK
- `mobile/src/types/result.types.ts` — `Result<T, AppError>`
- `mobile/test-support/file-system-test-state.ts` — `getMockFileContents` / `setMockFileContents`

## Dev Agent Record

### Agent Model Used

claude-opus-5 (Claude Code, bmad-dev-story)

### Debug Log References

- `mobile/`: `npm run lint` (0 errors; 1 pre-existing warning in `browse/passage/[id].test.tsx`), `npx tsc --noEmit`, `npx jest` — 234 suites / 2088 tests pass.
- Repo root: `npm run check-contrast` — 152 token pairs pass.

### Completion Notes List

**Deviation from Task 4 (approved by the task's own escape hatch).** The Backup option is a
dedicated control on `import.tsx`, not a fourth `SegmentedPill` segment. At a 320pt width the
`expand` track leaves ~43pt of text per segment across four segments, and `SegmentedPill` renders
labels with `numberOfLines={1}` — "WaniKani" would ship truncated. The task text pre-authorised
"stack the Backup option as its own control". This also removed the need to touch the local
`ImportSource` union at all.

**`import.tsx` now scrolls.** Adding the restore block pushed the tallest source pane past a 667pt
viewport (the iOS 17 floor device), and the screen was a fixed `View` with `mt-auto` actions —
content would have been clipped, not scrolled. Wrapped in a `ScrollView` with a `grow` content
container so `mt-auto` still pins the action group when content is short.

**`restoredRowCount` reports rows actually written**, not the bundle's row count. Skipped
unmatched-slug and unmatched-passage rows are excluded, so the Settings confirmation line cannot
overstate what happened.

**Shared `expo-sqlite` mock extended** (`mobile/__mocks__/expo-sqlite.ts`) rather than a second
private fake: a no-WHERE `DELETE FROM <table>` truncate handler placed *ahead* of the WHERE-filtered
delete handlers (which would otherwise filter on an undefined param and delete nothing), a generic
parameterized INSERT fallback appended last, `curriculum.items` / `curriculum.reading_passages` /
`curriculum.passage_questions` / `user_synonyms` reads, and a shared `zipInsertRow` helper. The
`ai_sessions` insert handler became column-aware via that helper — the session repository binds 7
params across 12 declared columns with literal `NULL`/`0` for the rest, so naive positional zipping
silently wrote `undefined` into `ended_at` (caught by `aiSessionRepository.test.ts`).
`withTransactionSync` now snapshots **every** table rather than a fixed list of five, so the
rollback test cannot pass while `user_preferences` / `goal_ring_state` keep half-written values.

**Preference reads are lazy in `restoreBackup.ts`** (`preservedPreferenceKeys()`): screen tests mock
`@/data/user/preferencesRepository` partially, and a module-scope `PREFERENCE_KEYS` read crashed
`settings.test.tsx` at import time.

**`restoreBackup` is synchronous** — it does no I/O, only a `withTransactionSync` block. Only
`previewRestore` is async (file read + gunzip). Both return `Result<T, AppError>`; nothing throws
across a boundary.

Confirmed against the ACs: no `020` migration (`last_backed_up_at` is a `user_preferences` key), no
`'kizamu'` added to `ImportSource` or `import_metadata`, `schema_migrations` never written, secure
storage never touched (asserted by test), and `curriculum.db` never written.

### File List

**New**
- `mobile/src/core/backup/backupValidator.ts`
- `mobile/src/core/backup/backupValidator.test.ts`
- `mobile/src/core/backup/backupFreshness.ts`
- `mobile/src/core/backup/backupFreshness.test.ts`
- `mobile/src/data/user/restoreBackup.ts`
- `mobile/src/data/user/restoreBackup.test.ts`
- `mobile/src/data/import/importPreviewStore.test.ts`
- `mobile/src/components/backup/RestorePreviewCard.tsx`
- `mobile/src/components/engagement/BackupNudgeCard.tsx`

**Modified**
- `mobile/src/core/backup/backup.types.ts` — `BackupSummary` / `BackupPreview`
- `mobile/src/data/user/exportBackup.ts` — persist `last_backed_up_at` on file write
- `mobile/src/data/user/exportBackup.test.ts` — `runSync` recorder + last-backed-up assertion
- `mobile/src/data/user/preferencesRepository.ts` — `PREFERENCE_KEYS.lastBackedUpAt` + get/set
- `mobile/src/data/import/importPreviewStore.ts` — parallel backup slot, mutually exclusive
- `mobile/src/components/engagement/index.ts` — export `BackupNudgeCard`
- `mobile/src/app/(tabs)/settings.tsx` — restore control, inline preview, last-backed-up indicator, post-restore state refresh
- `mobile/src/app/(tabs)/settings.test.tsx` — restore + nudge coverage, new prefs/picker mocks
- `mobile/src/app/(tabs)/index.tsx` — web-only stale-backup banner in the existing slot
- `mobile/src/app/(tabs)/index.test.tsx` — banner priority + `Platform.OS` cases
- `mobile/src/app/onboarding/import.tsx` — restore control, `ScrollView`, backup preview branch
- `mobile/src/app/onboarding/import.test.tsx` — restore-source coverage
- `mobile/src/app/onboarding/import-summary.tsx` — branch to `RestoreSummary` on a backup preview
- `mobile/src/app/onboarding/import-summary.test.tsx` — restore branch coverage
- `mobile/src/app/onboarding/complete.tsx` — `restored=1` CTA copy
- `mobile/src/app/onboarding/complete.test.tsx` — restored-CTA coverage
- `mobile/__mocks__/expo-sqlite.ts` — truncate, generic insert, curriculum reads, full-table rollback
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `docs/working-history.md`

## Change Log

| Date | Version | Description | Author |
| --- | --- | --- | --- |
| 2026-08-14 | 0.1 | Story drafted from Epic 9.2 + Part A + 9.1 implementation | Cursor |
| 2026-08-14 | 0.2 | Guardrails: same-module preview store, singleton-row ids, TEXT vs INTEGER item ids, mock txn snapshot, restore-fail copy | Cursor |
| 2026-08-14 | 1.0 | Implemented all 6 tasks: row validator, `previewRestore`/`restoreBackup` replace-all transaction, parallel preview slot, `RestorePreviewCard`, Settings restore + last-backed-up indicator, onboarding fourth source routing to `complete`, web-only Home nudge, 60 new tests | Claude Opus 5 |
| 2026-08-14 | 1.1 | Code-review patches: post-restore hook/notification refresh, distinct envelope error copy, preview vs restore loading labels, countRows keyed to known tables, required `topicItems`, unmount guard on onboarding pick, future `exportedAt` treated as today | Cursor |
