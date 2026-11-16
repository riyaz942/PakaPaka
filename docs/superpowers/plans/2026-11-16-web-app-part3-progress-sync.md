# Web app Part 3 — Progress sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in user has the same progress on all devices: each device pulls, merges row by row (three-way), and pushes one progress file, with one conflict dialog only when the same item changed on two devices.

**Architecture:** The server keeps one gzipped progress file per user (the backup format, no AI conversations) and a revision number; `PUT /api/sync` is a compare-and-swap on that revision. Each device keeps a base copy (last synced file + revision) in a one-row `user.db` table. The merge is pure functions in `mobile/src/core/sync/`; an async data layer reads and writes `user.db`; a runner connects them to the API and the UI.

**Tech Stack:** Cloudflare Workers + D1 + R2 (existing Worker `pakapaka-web`); Vitest 4 + `@cloudflare/vitest-pool-workers`; Expo 55 / RN 0.83, `expo-sqlite` 55 async API, `pako` 2; Jest (`jest-expo`); `sql.js` (new devDependency, tests only).

**Spec:** `docs/superpowers/specs/2026-11-04-web-app-accounts-sync-design.md`, Part 3 (read "Anti-goals" and "Existing work to build on" too). The spec wins where this plan is silent. Where this plan differs from the spec, the difference is listed in "Approved decisions" or "Findings".

**Start state:** branch `part3-sync` (made from `main` after PR #24, Part 2). Part 2 is live at https://paka-paka.app.

## Global Constraints

- **Sync must never silently lose reviews or progress.** Merge decisions use row content, never `updatedAt`.
- Sign-in and sync stay optional. A signed-out user makes zero `/api/*` requests and sees no change.
- Server boundary: the server never gets BYOK keys or AI conversations, never stores or logs email. Never log tokens, ID tokens, request bodies or auth headers (server and client).
- No silent fallback paths. One path that can fail, or a visible setting. No silent retries; one retry on the next trigger is fine.
- Mobile: fallible ops return `Result<T, AppError>` (`mobile/src/types/result.types.ts`); no throws across async boundaries. Platform differences through `mobile/src/platform/capabilities.ts`, never try/catch. Semantic NativeWind tokens only, no raw hex. `user.db` changes through numbered migrations.
- New sync code uses the **async** SQLite API (`getAllAsync`, `runAsync`, transactions) with batched writes. Do not call `exportBackup`, `restoreBackup`, `getAllSync`, `runSync` or `withTransactionSync` from sync code. gzip/JSON work yields to the UI between chunks.
- The sync file is the backup format: `format: 'pakapaka-backup'`, `formatVersion: 1`, `includesConversations: false`, `aiSessions: []`, `aiMessages: []`. JSON key order of the envelope: `format, formatVersion, schemaVersion, curriculumVersion, exportedAt, includesConversations, data`.
- Server checks only: size (2,000,000 bytes), gzip header, envelope (first 4,096 compressed bytes). The full shape check is on the client, for every upload and every download. Free plan fails closed (`quota_exceeded` → "Sync is paused…").
- JSON error body is `{ "error": "<code>" }`. New code: `revision_conflict` (409, body also has `revision`).
- Rate limit on `PUT /api/sync`: `UPLOAD_LIMITER`, 6 per 60 s per user (exists).
- Backend never imports from `mobile/`; mobile never imports from `backend/`.
- Existing tests stay unchanged and green, except the edits named in Tasks 1, 8, 11 and 12 (new cases, a `lessonOptIns: []` field in fixtures, a `SyncProvider` mock, and one replaced case).
- **Stop and ask the operator before:** `wrangler d1 migrations apply --remote`, any `wrangler deploy` / `deploy:web`, any `wrangler secret put` (the operator runs it), any Cloudflare setting change. These steps are marked **(operator)**.
- Exact copy:
  - Newer remote schema: `Update the app to sync`
  - Restore warning when signed in: `This replaces the progress on all your signed-in devices.`
  - Dialog title: `Progress changed on two devices`
  - Dialog body: `These items changed on this device and on another device. Choose which version to keep. All other changes are already merged.`
  - Dialog buttons: `Keep this device` / `Use other device`
  - Sync status: `Syncing…` / `Last synced <date and time>` / `Not synced yet.`
  - Damaged remote file: `The progress file on the server cannot be read. Your progress on this device is safe.`
  - Run did not finish: `Sync did not finish. It runs again the next time.`
  - Local write failed: `Sync could not save on this device. Nothing was changed.`
  - Review gate: `Syncing your progress…` and button `Start now`
  - Erase sheet body: `This erases all your progress and settings on this device. Progress that is not synced yet is lost. To keep it, cancel and tap Sync now first.`

## Approved decisions (operator, 2026-11-16)

**1. Row key per table**

| Table | Key | Kind |
| --- | --- | --- |
| `userPreferences` | `key` | preference |
| `itemStudyStatus`, `srsStates`, `weaknessStats`, `personalMnemonics`, `furiganaOverrides`, `grammarSentenceHistory`, `lessonOptIns` | `itemType` + `slug` | per-item |
| `userSynonyms` | item + `answerType` + `answerText` | per-item |
| `grammarAnswers` | item + `sentenceKey` + `answerText` | per-item |
| `relatedItemBoosts` | `itemType` + `slug` | boost (see Findings 1) |
| `cardSeen` | `cardId` | append-only |
| `importMetadata` | `source` + `importedAt` | append-only |
| `passagePracticeResults` | `passageId` + `questionId` | passage (see below) |
| `dailyLessonLog`, `cognitiveLoadHistory` | `date` | per-day counter |
| `streaks`, `goalRingState` | one row | singleton |

- Two rows are the same when all fields are equal except `updatedAt`. For `userSynonyms`, `grammarAnswers`, `lessonOptIns`, `cardSeen` the compare also ignores `createdAt`, `optedInAt`, `seenAt`.
- `cardSeen`: same card on two sides → keep the earlier `seenAt`.
- `passagePracticeResults` is not append-only in the code (an answer overwrites). Rule: normal three-way rule; if the two sides changed the same answer differently, the later `answeredAt` wins (tie: `isCorrect: true` wins, then the larger `userAnswer` string). Never a conflict.

**2. Base copy:** one-row table `sync_base` in `user.db` (migration 022). It holds the revision, the last synced file as JSON text, the last sync time and the last error. The merged progress and the new base are written in one transaction. Rows for items this device does not know live only in this base copy and are pushed unchanged.

**3. Singletons:** `streaks` is recomputed from the merged `cognitiveLoadHistory` (a study day is a day with `load > 0`). `goalRingState` is not recomputed (no code reads or writes it): normal one-row rule, never in the dialog; if the two sides differ, take remote.

**4. Per-day counters**

| Field | Rule |
| --- | --- |
| `dailyLessonLog.itemsStarted` | `base + (local − base) + (remote − base)`; missing row = 0 |
| `cognitiveLoadHistory.load` | the same sum |
| `cognitiveLoadHistory.threshold` | the larger value |
| `updatedAt` | the later value (display only) |

With no base: `max(local, remote)`.

**5. Never-synced preference keys:** `installed_curriculum_version`, `installed_curriculum_content_hash`, `curriculum_update_source`, `last_backed_up_at`, `ai_openai_base_url`, `ai_active_provider`, `ai_openai_model`, `ai_anthropic_model`, `cloud_stt_opt_in`, `word_translate_opt_in`, `notifications_enabled`, `notification_reminder_time`, `reduced_motion`, `theme_mode`, `haptics_enabled`. The client removes them before each push and ignores them in a pulled file. All other keys sync.

## Steps that need the operator

| Where | What |
| --- | --- |
| Task 8, Step 1 | Only if `sql.js` does not load under Jest: a decision on the test engine. |
| Task 9, Step 3 | A phone or emulator with a dev build, to check binary upload and download. |
| Task 12, Step 3 | The local `backend/.dev.vars` from Part 2 for `wrangler dev`. |
| Task 14, Step 1 | **D1 change:** apply migration `0002` to the remote database. |
| Task 14, Step 2 | **Deploy:** `npm run deploy:web`. |
| Task 14, Step 4 | Dev-client rebuild and Google sign-in on a real Android phone and iPhone. |
| Task 14, Step 5 | The two-device check. |

No new secret, no R2 change and no Cloudflare setting change is planned. If one becomes necessary, stop and ask.

## Findings made while planning (operator: review these)

1. **`relatedItemBoosts` is merged as a number, not as a conflict.** A review of item A changes the boost rows of A's related items. Two devices that review different items can change the same boost row, and that would open the dialog against the "different items → no dialog" goal. Rule: `merged = base + (local − base) + (remote − base)`, missing row = 0, cap at `RELATED_ITEM_BOOST_CAP` (`mobile/src/config/constants.ts`), result ≤ 0 → no row. With no base: `max(local, remote)`. Boost rows do not follow the dialog choice.
2. **Preference `seen_unlocked_passage_ids`** is a JSON list that each device appends to. If both sides changed it differently, the result is the sorted union of the two lists (no conflict). If either value is not a JSON string array, it is a normal preference conflict.
3. **`withExclusiveTransactionAsync` throws on web** (`expo-sqlite` 55). Web uses `withTransactionAsync`; native uses `withExclusiveTransactionAsync`. The choice is a capability check (Task 8). Accepted risk: on web, a write from the UI during the transaction joins it; on native, a write from the UI during the transaction can get `database is locked`. The transaction is short (a re-read and a row diff, no network), a merge is never applied while a lesson or review is open (Task 10, step 6d), and a snapshot that changed stops the apply (Review Focus 1).
4. **The expo-sqlite Jest mock is a regex emulator with no async API.** Sync data-layer tests use a real SQLite engine (`sql.js`) through a small test adapter (Task 8). The shared mock is not changed.
5. **`passagePracticeResults` uses raw curriculum row ids** (existing backup limit). Two devices on different curriculum versions can map one id to different passages. Not fixed in Part 3; write it in the docs (Task 13).
6. **Web background push is best effort.** A browser can stop the page before a 160 KB upload ends. Nothing is lost: the next open sees local changes against the base and pushes.
7. **Decode limit:** one `JSON.parse` of the whole file runs on the JS thread (about 1.2 MB for a typical user, 9.5 MB worst case). Encode and gzip are chunked. Task 6 measures this.

## Review Focus

1. **Local data changes between the snapshot read and the apply** (the user answers a card while sync runs): the apply writes nothing and the run starts again from the read. → Task 8 test `apply stops when local changed after the snapshot`; Task 10 test `local change during a run restarts the cycle`.
2. **Two PUTs with the same `base_revision` at the same time:** exactly one wins; the loser gets 409; `GET` never serves the loser's bytes. → Task 7 test `concurrent PUTs: one wins and GET returns the winner's bytes`.
3. **The push fails after a merge was applied locally** (network drops): the next run sees local ≠ base, pushes, shows no dialog, loses nothing. → Task 10 test `push failure after apply is finished by the next run`.
4. **The remote file is damaged or has a row with a wrong type:** nothing is written locally, nothing is pushed, the error text shows. → Task 2 test `validateSyncData rejects a wrong field type`; Task 10 test `damaged remote file changes nothing`.
5. **Stale base** (remote revision is lower than the base revision, for example the account was deleted and made again): the base is dropped and the two-way compare runs; no local row is deleted. → Task 10 test `remote revision below base drops the base`.

---

## File Structure

```
backend/
  migrations/0002_sync_object_key.sql   sync_state.object_key
  src/syncEnvelope.ts                   checkSyncEnvelope()
  src/routes/sync.ts                    GET + PUT /api/sync
  src/http.ts, src/index.ts             + error code, + routes
  test/sync.test.ts, test/syncEnvelope.test.ts
mobile/
  src/core/backup/backup.types.ts       + LessonOptInEntry, lessonOptIns
  src/core/sync/
    sync.types.ts        shared types
    syncTables.ts        table descriptors, keys, rowsEqual, never-synced list
    syncFile.ts          toSyncData(), validateSyncData()
    mergeRows.ts         generic three-way row merge
    mergeSpecial.ts      counters, boosts, passages, cardSeen, streak, preferences
    mergeSyncData.ts     whole-file merge, item grouping, carried rows, conflicts
    diffSyncData.ts      diffSyncData(), sameSyncData()
    syncCodec.ts         encodeSyncFile(), decodeSyncFile() (chunked gzip)
    syncRunner.ts        createSyncRunner() (ports in, no I/O imports)
    syncMessages.ts      syncErrorMessage()
  src/data/migrations/022_sync_base.ts
  src/data/sync/
    syncTransaction.ts   withSyncTransaction()
    syncSnapshot.ts      readCurriculumLookup(), readUserTables(), readSyncSnapshot()
    syncApply.ts         applySyncMerge()
    syncBaseStore.ts     read/write/clear base, status, pending replace
    syncApi.ts           createSyncApi()
  src/providers/SyncProvider.tsx        context, triggers, runner wiring
  src/components/sync/SyncConflictDialog.tsx, SyncGate.tsx
  test-support/sqliteTestDb.ts          sql.js adapter (tests only)
```

---

# Part A — Merge engine (pure functions, test-first)

### Task 1: `lessonOptIns` in the backup format

**Files:**
- Modify: `mobile/src/core/backup/backup.types.ts`, `backupSerializer.ts`, `backupValidator.ts`, `mobile/src/data/user/exportBackup.ts`, `mobile/src/data/user/restoreBackup.ts`
- Test: add cases to `backupSerializer.test.ts`, `backupValidator.test.ts`, `exportBackup.test.ts`, `restoreBackup.test.ts` (new cases only)

**Interfaces:**
- Produces: `LessonOptInEntry = { item: ItemRef; optedInAt: string }`; `BackupData.lessonOptIns: LessonOptInEntry[]`; `'lessonOptIns'` in `BACKUP_DATA_KEYS` (after `grammarSentenceHistory`, before `aiSessions`).

- [x] **Step 1: Failing tests.**
  - `parseBackupBundle accepts a file with no lessonOptIns key` → `data.lessonOptIns` equals `[]`.
  - `validateBackupData rejects a lessonOptIns row with no item` → `BACKUP_INVALID_SHAPE`.
  - `export writes lessonOptIns keyed by slug` → a `lesson_opt_ins` row `('7', '2026-11-01T00:00:00.000Z')` exports as `{ item: { itemType, slug }, optedInAt }` for curriculum item 7.
  - `restore writes lesson_opt_ins and skips an unknown slug`; `restore empties lesson_opt_ins first`.
- [x] **Step 2:** Run `npx jest src/core/backup src/data/user/exportBackup.test.ts src/data/user/restoreBackup.test.ts` in `mobile/` → the new cases FAIL.
- [x] **Step 3: Implement.** Add `'lessonOptIns'` to `OPTIONAL_DATA_KEYS` and `ITEM_KEYED_KEYS`. Export: `SELECT item_id, opted_in_at FROM lesson_opt_ins` through `mapItemRows` (add its `omitted` to `omittedCount`). Restore: add `'lesson_opt_ins'` to `RESTORE_TABLES`, add the refs to `collectItemRefs`, insert `[String(itemId), row.optedInAt]` (`item_id` is TEXT). If the expo-sqlite mock needs the new table name, add only that.
- [x] **Step 4:** Run the same command → PASS. `npm run typecheck` → clean (fix every `BackupData` literal in tests/fixtures that now needs `lessonOptIns: []`; that is the only allowed edit to those files).
- [x] **Step 5: Commit** `feat(backup): lesson opt-ins in the backup format`.

### Task 2: Table descriptors, row compare, file shaping

**Files:**
- Create: `mobile/src/core/sync/sync.types.ts`, `syncTables.ts`, `syncFile.ts`, `syncMessages.ts`
- Test: `mobile/src/core/sync/syncTables.test.ts`, `syncFile.test.ts`, `syncMessages.test.ts`

**Interfaces:**
- Produces (`sync.types.ts`):
  - `SyncTableKey = Exclude<keyof BackupData, 'aiSessions' | 'aiMessages'>`; `SYNC_TABLE_KEYS: readonly SyncTableKey[]`.
  - `KnownContent = { hasItem(ref: ItemRef): boolean; hasPassageQuestion(passageId: string, questionId: string): boolean }`.
  - `ConflictChoice = 'local' | 'remote'`.
  - `ConflictEntry = { kind: 'item'; item: ItemRef; localUpdatedAt: string | null; remoteUpdatedAt: string | null } | { kind: 'preference'; key: string; localUpdatedAt: string | null; remoteUpdatedAt: string | null }` (`null` = that side has no row).
  - `SyncErrorCode = 'sync_update_required' | 'sync_bad_file' | 'sync_busy' | 'sync_local_failed' | 'sync_local_changed'`.
- Produces (`syncTables.ts`):
  - `TableKind = 'preference' | 'per_item' | 'boost' | 'append_only' | 'passage' | 'per_day' | 'singleton'`.
  - `SYNC_TABLES: Record<SyncTableKey, { kind: TableKind; key(row): string; ignored: readonly string[]; fields: Record<string, FieldType> }>` with the keys, kinds and ignored fields of "Approved decisions 1". `FieldType = 'string' | 'number' | 'boolean' | 'string|null' | 'number|null' | 'itemRef' | 'string[]'`; `fields` lists every field of the entry type in `backup.types.ts`. Singleton key is the constant `'1'`.
  - `rowKey(table, row): string`; `rowsEqual(table, a, b): boolean` (deep compare of all `fields` except `ignored`; both `undefined` → true; one `undefined` → false); `itemKeyOf(table, row): string | null` (`itemRefKey` for per-item and boost tables, else null).
  - `NEVER_SYNCED_PREFERENCE_KEYS: ReadonlySet<string>` (the 15 keys of "Approved decisions 5", built from `PREFERENCE_KEYS` values).
- Produces (`syncFile.ts`):
  - `toSyncData(data: BackupData): BackupData` — a copy with never-synced preference rows removed, `aiSessions: []`, `aiMessages: []`.
  - `validateSyncData(data: BackupData): Result<BackupData, AppError>` — runs `validateBackupData`, then checks every row of every sync table against `fields`; any failure → code `sync_bad_file`.
- Produces (`syncMessages.ts`): `syncErrorMessage(code: SyncErrorCode): string` (exact copy from Global Constraints; `sync_local_changed` → the "did not finish" copy); `syncError(code, cause?): AppError`.

- [ ] **Step 1: Failing tests.**
  - `every sync table has a descriptor and every field of its entry type` (compare `Object.keys(SYNC_TABLES)` with `SYNC_TABLE_KEYS`; one sample row per table passes its own `fields`).
  - `rowsEqual ignores updatedAt`: two `srsStates` rows that differ only in `updatedAt` → true; that differ in `reps` → false.
  - `rowsEqual ignores createdAt for userSynonyms, optedInAt for lessonOptIns, seenAt for cardSeen`.
  - `rowsEqual compares sentenceKeys in order`: `['a','b']` vs `['b','a']` → false.
  - `rowKey`: `userSynonyms` row → `'vocabulary:neko|meaning|cat'`-style key that differs when `answerText` differs; `importMetadata` key = source + importedAt.
  - `toSyncData removes each never-synced key` (table test over all 15 keys) `and keeps session_intensity, home_layout, vacation_started_at`.
  - `toSyncData empties aiSessions and aiMessages`.
  - `validateSyncData rejects a wrong field type` (`srsStates[0].reps = '3'` → `sync_bad_file`); `rejects a missing field`; `accepts a valid full sample`.
  - `syncErrorMessage` table test with the exact copy.
- [ ] **Step 2:** Run `npx jest src/core/sync` → FAIL. Implement. Run → PASS.
- [ ] **Step 3: Commit** `feat(sync): table descriptors, row compare, sync file shaping`.

### Task 3: Three-way row merge (the four spec rules, deletes, no base)

**Files:**
- Create: `mobile/src/core/sync/mergeRows.ts`
- Test: `mobile/src/core/sync/mergeRows.test.ts`

**Interfaces:**
- Consumes: `rowKey`, `rowsEqual` (Task 2).
- Produces: `RowDecision = 'unchanged' | 'take_remote' | 'keep_local' | 'same_change' | 'conflict'`.
- Produces: `mergeRows<K extends SyncTableKey>(table: K, base: BackupData[K] | null, local: BackupData[K], remote: BackupData[K]): Array<{ key: string; decision: RowDecision; base?: Row; local?: Row; remote?: Row }>` — one entry per key found on any side. A missing row is a value ("no row"). `base === null` means every base row is missing (two-way compare).

Decision table (per key, using `rowsEqual`):

| Local vs base | Remote vs base | Decision |
| --- | --- | --- |
| same | same | `unchanged` |
| same | different | `take_remote` |
| different | same | `keep_local` |
| different | different, local = remote | `same_change` |
| different | different, local ≠ remote | `conflict` |

- [ ] **Step 1: Failing tests, one per rule** (table `srsStates`, rows built by a small `srs(slug, reps)` helper in the test):
  - `local same, remote different → take_remote`
  - `local different, remote same → keep_local`
  - `both different and equal → same_change`
  - `both different and not equal → conflict`
  - `row in base, missing on remote, same on local → take_remote (delete)`
  - `row in base, missing on local, same on remote → keep_local (delete)`
  - `row in base, deleted on local, changed on remote → conflict`
  - `row not in base, added on remote only → take_remote`
  - `row not in base, added on both with equal content → same_change`
  - `no base: row on one side only → added (take_remote / keep_local)`
  - `no base: row on both sides, different → conflict`; `no base: equal → same_change`
  - `updatedAt alone never makes a row different`
- [ ] **Step 2:** Run `npx jest src/core/sync/mergeRows.test.ts` → FAIL. Implement. Run → PASS.
- [ ] **Step 3: Commit** `feat(sync): three-way row merge`.

### Task 4: Special table rules

**Files:**
- Create: `mobile/src/core/sync/mergeSpecial.ts`
- Test: `mobile/src/core/sync/mergeSpecial.test.ts`

**Interfaces:**
- Consumes: `mergeRows` (Task 3), `RELATED_ITEM_BOOST_CAP`.
- Produces (each returns the merged row list for its table; none returns a conflict):
  - `mergeAppendOnly(table: 'cardSeen' | 'importMetadata', base, local, remote)` — union by key; `cardSeen` on both sides → earlier `seenAt`.
  - `mergePassageResults(base, local, remote)` — rule of "Approved decisions 1".
  - `mergeDailyLessonLog(base, local, remote)`, `mergeCognitiveLoad(base, local, remote)` — rules of "Approved decisions 4"; result clamped at ≥ 0.
  - `mergeBoosts(base, local, remote)` — Findings 1.
  - `mergeSingleton(table: 'goalRingState', base, local, remote)` — one-row three-way; both changed and differ → remote.
  - `mergeStreak(local: StreakEntry[], remote: StreakEntry[], mergedHistory: CognitiveLoadHistoryEntry[]): StreakEntry[]`.
  - `mergePreferences(base, local, remote): { rows: UserPreferenceEntry[]; conflicts: Array<{ key: string; local?: UserPreferenceEntry; remote?: UserPreferenceEntry }> }` — per key normal rule; `seen_unlocked_passage_ids` per Findings 2. Callers pass rows that already went through `toSyncData`.

`mergeStreak` algorithm (the signature does not determine it):

```
days = { h.date for h in mergedHistory if h.load > 0 }
       ∪ { local.lastReviewDate, remote.lastReviewDate } (non-null)
if days is empty and neither side has a row → []
last = max(days)
run = count of consecutive calendar days in `days` that end at `last`
current = max(run, side.currentStreak for each side whose lastReviewDate == last)
longest = max(local.longestStreak, remote.longestStreak, current, longest run in days)
lastCelebratedDate = the later non-null of the two sides
updatedAt = the later of the two sides
```

- [ ] **Step 1: Failing tests, one per rule:**
  - `append-only: union of both sides, never a conflict` (cardSeen and importMetadata); `cardSeen on both sides keeps the earlier seenAt`.
  - `passage: one side changed → that side`; `passage: both changed differently → later answeredAt`; `passage: equal answeredAt → isCorrect true wins`.
  - `per-day: base 5, local 7, remote 6 → 8` (`itemsStarted` and `load`); `per-day: row only on remote → remote value`; `per-day: no base, local 7, remote 6 → 7`; `threshold takes the larger`; `per-day updatedAt is the later`.
  - `per-day: second device converges` (base 6, local 6, remote 8 → 8).
  - `boost: base 1, local 3, remote 2 → 4`; `boost: capped at RELATED_ITEM_BOOST_CAP`; `boost: deleted on local, raised on remote from 2 to 5 → 3`; `boost: deleted on local, unchanged on remote → no row`; `boost: no base → max`.
  - `singleton goalRingState: only remote changed → remote; only local changed → local; both changed → remote`.
  - `streak: phone Mon, web Tue without sync → current 7` (history Sun-run of 5 + Mon + Tue; local `{current 6, last Mon}`, remote `{current 1, last Tue}`); `streak: longest never goes down` (local longest 30, history short → 30); `streak: gap in history ends the run`; `streak: no rows and no history → []`; `streak: lastCelebratedDate is the later date`.
  - `preferences: one side changed → that value`; `preferences: both changed differently → conflict entry`; `preferences: both set the same value → no conflict`; `seen_unlocked_passage_ids: both changed → sorted union, no conflict`; `seen_unlocked_passage_ids: bad JSON on one side → conflict`.
- [ ] **Step 2:** Run `npx jest src/core/sync/mergeSpecial.test.ts` → FAIL. Implement. Run → PASS.
- [ ] **Step 3: Commit** `feat(sync): counter, boost, passage, streak and preference merge rules`.

### Task 5: Whole-file merge, item grouping, carried rows, diff

**Files:**
- Create: `mobile/src/core/sync/mergeSyncData.ts`, `mobile/src/core/sync/diffSyncData.ts`
- Test: `mobile/src/core/sync/mergeSyncData.test.ts`, `diffSyncData.test.ts`, `mobile/src/core/sync/mergeScenarios.test.ts`

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces:
  - `withCarriedRows(local: BackupData, base: BackupData | null, known: KnownContent): BackupData` — `local` plus every base row whose item (per-item and boost tables) or passage question (`passagePracticeResults`) this device does not know.
  - `isEmptyProgress(data: BackupData): boolean` — true when `srsStates`, `itemStudyStatus`, `personalMnemonics`, `userSynonyms`, `grammarAnswers`, `passagePracticeResults`, `dailyLessonLog`, `cognitiveLoadHistory`, `lessonOptIns` all have 0 rows.
  - `mergeSyncData(input: { base: BackupData | null; local: BackupData; remote: BackupData }, choice: ConflictChoice | null): { conflicts: ConflictEntry[]; merged: BackupData | null }` — `merged` is `null` only when `conflicts.length > 0` and `choice === null`. `local` must already include carried rows. Output always has `aiSessions: []`, `aiMessages: []`, and per-table rows sorted by key (stable output).
  - `SyncDiff = { [K in SyncTableKey]: { upserts: BackupData[K]; deletes: BackupData[K] } }`; `diffSyncData(from: BackupData, to: BackupData, known: KnownContent): SyncDiff` — rows to write so a device at `from` becomes `to`; rows for unknown items / passage questions are left out; a row that differs only in ignored fields is not in the diff.
  - `sameSyncData(a: BackupData, b: BackupData): boolean` — true when every sync table has the same keys and `rowsEqual` rows.

Item grouping (spec): run `mergeRows` on every per-item table. An item is in conflict when any of its rows has decision `conflict`. One `ConflictEntry` per item (`localUpdatedAt` / `remoteUpdatedAt` = the latest `updatedAt` of that item's per-item rows on that side, `null` when that side has none). With a choice, **all** per-item rows of a conflicting item come from the chosen side, in every per-item table (rows the other side has and the chosen side lacks are dropped). Boost, per-day, append-only, passage, singleton and streak tables never follow the choice. Preference conflicts follow the same choice, per key.

- [ ] **Step 1: Failing tests.**
  - `unknown-item rows are carried and stay in the merged file` (base has `srsStates` for slug `x`, `known.hasItem` false, local lacks it → merged has it unchanged; remote changed it → merged has the remote row).
  - `unknown passage rows are carried`.
  - `an unknown-item row is never a conflict`.
  - `one conflicting row puts the whole item in one entry` (srs conflicts, mnemonic changed only on remote → 1 entry).
  - `choice local: every row of the item comes from local` (srsStates, weaknessStats, itemStudyStatus, personalMnemonics, userSynonyms); `choice remote: every row comes from remote, including a synonym only remote has, and without a synonym only local has`.
  - `non-conflicting items merge with no entry` (item A changed on local, item B on remote → both in merged, `conflicts` empty).
  - `conflicts and no choice → merged is null`.
  - `preference conflict is an entry of kind preference and follows the choice`.
  - `boost rows of a conflicting item still use the number rule`.
  - `streak is recomputed from the merged history`.
  - `isEmptyProgress`: only preferences and cardSeen → true; one `srsStates` row → false.
  - `empty device: merge with base = local takes all of remote with no conflict`.
  - `merged output is independent of input row order` (shuffle inputs → deep-equal output).
  - `diffSyncData: changed row → upsert; row missing in to → delete; unknown item row → not in the diff; updatedAt-only change → not in the diff`; `sameSyncData is true after applying a diff in memory`.
  - **Scenario tests (`mergeScenarios.test.ts`), the Part 3 "done when" as pure functions:**
    - `two devices review different items: no conflict, both reviews kept` — base B; phone reviews item 1 (srs, weakness, cognitive load +1, streak, boost of item 3); web reviews item 2 (same kinds, boost of item 3 too). Merge on web after the phone pushed: `conflicts` is `[]`; merged has both new srs rows; today's `load` is base + 2; boost of item 3 is the sum.
    - `both devices review the same item: one entry; local choice and remote choice give that side's rows`.
    - `convergence`: device A merges and pushes M; device B (base B, local B's changes, remote M) merges → result equals M when B had no other change, with no conflict.
- [ ] **Step 2:** Run `npx jest src/core/sync` → FAIL. Implement. Run → PASS.
- [ ] **Step 3: Commit** `feat(sync): whole-file merge with item conflicts, carried rows and diff`.

### Task 6: Chunked gzip codec

**Files:**
- Create: `mobile/src/core/sync/syncCodec.ts`
- Test: `mobile/src/core/sync/syncCodec.test.ts`

**Interfaces:**
- Consumes: `buildBackupBundle`, `serializeBackupBundle`, `parseBackupBundle`, `validateSyncData`, `toSyncData`.
- Produces: `yieldToUi(): Promise<void>` (`setTimeout(resolve, 0)`).
- Produces: `encodeSyncFile(envelope: { schemaVersion: number; curriculumVersion: string | null; exportedAt: string }, data: BackupData): Promise<Uint8Array>` — writes the JSON text in pieces into `new pako.Deflate({ gzip: true })`: the envelope prefix, then each table as `"name":[` + rows in chunks of 500 (`JSON.stringify` per chunk) + `]`, with `await yieldToUi()` after each chunk. The output text must equal `serializeBackupBundle(buildBackupBundle({ ...envelope, includesConversations: false }, toSyncData(data)))` byte for byte.
- Produces: `decodeSyncFile(bytes: Uint8Array): Promise<Result<BackupBundle, AppError>>` — `new pako.Inflate({ to: 'string' })` fed in 64 KB slices with `await yieldToUi()` between slices; then `parseBackupBundle`; then `validateSyncData`; then `toSyncData`. gzip failure, JSON failure, format mismatch or shape failure → `sync_bad_file`; `BACKUP_VERSION_UNSUPPORTED` → `sync_update_required`.

- [ ] **Step 1: Failing tests.**
  - `encoded text equals the backup serializer output` (`pako.ungzip(encoded, { to: 'string' })` === the serializer string, sample with rows in every table and a table with 1,201 rows).
  - `the first 300 characters match the server envelope pattern` (the regex of Task 7, copied into the test).
  - `decode(encode(x)) returns x`.
  - `decode strips never-synced preferences and AI rows found in a remote file`.
  - `decode of non-gzip bytes → sync_bad_file`; `decode of a file with formatVersion 2 → sync_update_required`; `decode of a row with a wrong type → sync_bad_file`.
  - `encode yields between chunks` (jest fake timers: the promise does not resolve until timers run).
- [ ] **Step 2:** Run `npx jest src/core/sync/syncCodec.test.ts` → FAIL. Implement. Run → PASS.
- [ ] **Step 3: Measure.** Add `syncCodec.perf.test.ts`: it builds a 1,500-item sample and a 12,700-item sample and prints the encode and decode times with `console.info`. No assertion on time. Write the four numbers in the commit message. (Phone numbers come in Task 14.)
- [ ] **Step 4: Commit** `feat(sync): chunked gzip codec for the sync file`.

---

# Part B — Server endpoints

### Task 7: `GET /api/sync` and `PUT /api/sync`

**Files:**
- Create: `backend/migrations/0002_sync_object_key.sql`, `backend/src/syncEnvelope.ts`, `backend/src/routes/sync.ts`, `backend/test/sync.test.ts`, `backend/test/syncEnvelope.test.ts`
- Modify: `backend/src/http.ts` (`ErrorCode` + `'revision_conflict'`), `backend/src/index.ts` (two routes), `backend/README.md` (Routes)

**Interfaces:**
- Consumes: `authenticate`, `requireSameOrigin`, `checkUploadBody`, `uploadRateLimit`, `toServerErrorResponse` (all exist).
- Produces: migration `ALTER TABLE sync_state ADD COLUMN object_key TEXT;`
- Produces: `checkSyncEnvelope(bytes: Uint8Array): Promise<boolean>` — inflates **only** `bytes.subarray(0, 4096)` through `DecompressionStream('gzip')` (write the slice, read the first chunk, then cancel both sides; do not close the writer), decodes it as UTF-8, and tests it against:
  `^\{"format":"pakapaka-backup","formatVersion":1,"schemaVersion":\d+,"curriculumVersion":(null|"[^"]*"),"exportedAt":"[^"]*","includesConversations":false,"data":\{`
  Any stream error → `false`.
- Produces: `handleGetSync(req, env, deps)` for `GET /api/sync?have=<int>`:
  - no auth → `401 unauthorized`. `have` missing or not an integer ≥ 0 → `400 bad_payload`.
  - no `sync_state` row → `204`, header `X-Sync-Revision: 0`.
  - `revision === have` → `204`, `X-Sync-Revision: <revision>`.
  - else → `200`, body = the R2 object at `object_key` (streamed), `Content-Type: application/gzip`, `X-Sync-Revision: <revision>`, `Cache-Control: no-store`. R2 object missing → `500 server_error`.
- Produces: `handlePutSync(req, env, deps)` for `PUT /api/sync?base_revision=<int>`, in this order:
  1. `authenticate` → `401`. `requireSameOrigin` → `403 bad_origin`.
  2. `base_revision` not an integer ≥ 0 → `400 bad_payload`.
  3. `uploadRateLimit(env, userId)` → `429 rate_limited`.
  4. `checkUploadBody(req)` → `413 payload_too_large` / `400 bad_payload`. `checkSyncEnvelope` false → `400 bad_payload`.
  5. `SELECT 1 FROM users WHERE user_id = ?` → none → `401 unauthorized` (deleted account, live access token).
  6. Read the current revision (no row = 0). `≠ base_revision` → `409 {"error":"revision_conflict","revision":<current>}`.
  7. `newRev = base_revision + 1`; `key = progress/${userId}/${String(newRev).padStart(10,'0')}-${crypto.randomUUID()}.json.gz`; `env.PROGRESS.put(key, bytes)`.
  8. Compare-and-swap in D1, guarded by the user row:
     - `base_revision === 0`: `INSERT INTO sync_state (user_id, revision, updated_at, last_device_id, object_key) SELECT ?, 1, ?, ?, ? WHERE EXISTS (SELECT 1 FROM users WHERE user_id = ?) ON CONFLICT(user_id) DO NOTHING`
     - else: `UPDATE sync_state SET revision = ?, updated_at = ?, last_device_id = ?, object_key = ? WHERE user_id = ? AND revision = ? AND EXISTS (SELECT 1 FROM users WHERE user_id = ?)`
     - `meta.changes !== 1` → delete `key` from R2, then: user row gone → `401`; else `409 revision_conflict` with the current revision.
  9. Prune: list `progress/${userId}/`; delete every object whose 10-digit revision prefix is `< newRev − 3`. A prune error is logged by name only and does not change the response.
  10. `200 {"revision": newRev}`.
- The unique key per upload is the reason two racing PUTs cannot overwrite each other's bytes. Never log the body.

- [ ] **Step 1: Failing tests** (`SELF.fetch` with a bearer token from a helper that inserts a user + issues an access token; body built with `CompressionStream('gzip')` over a JSON string that starts with the valid envelope):
  - `syncEnvelope`: `valid prefix → true`; `includesConversations true → false`; `formatVersion 2 → false`; `other JSON → false`; `garbage after the first 4096 bytes still → true` (proves only the head is read); `gzip of 10 bytes → false`.
  - `GET with no file → 204 and X-Sync-Revision 0`.
  - `first PUT with base_revision 0 → 200 revision 1; GET have=0 → 200 with the same bytes and X-Sync-Revision 1`.
  - `GET have=1 after revision 1 → 204 and X-Sync-Revision 1`.
  - `PUT with a stale base_revision → 409 with the current revision and no R2 object left behind` (list count unchanged).
  - `concurrent PUTs: one wins and GET returns the winner's bytes` (`Promise.all` of two PUTs with base 1 and different bodies → statuses are one 200 and one 409; GET bytes equal the 200 request's body; exactly one object exists for revision 2).
  - `keeps the current file and the previous 3` (5 PUTs → the prefix holds 4 objects, revisions 2–5).
  - `PUT without auth → 401`; `GET without auth → 401`; `cookie PUT with a foreign Origin → 403`.
  - `PUT after the users row is deleted → 401 and no R2 object, no sync_state row`.
  - `PUT larger than 2,000,000 bytes → 413`; `non-gzip → 400`; `gzip with a wrong envelope → 400`; `missing base_revision → 400`.
  - `7th PUT in a minute → 429` (fake limiter, same style as `limits.test.ts`).
  - `another user's file is never returned` (user B `GET` → 204 revision 0 while A has a file).
  - `Delete account removes the sync files and the sync_state row` (existing handler; new assertion with a pushed file).
  - `no body bytes and no token appear in console output` (spy on `console.*` across a PUT + GET).
- [ ] **Step 2:** Run `npm test` in `backend/` → FAIL. Implement; wire `GET /api/sync` and `PUT /api/sync` in `index.ts`. Run → PASS. `npm run typecheck` → clean.
- [ ] **Step 3:** `backend/README.md`: add the two routes, the R2 key layout, and "Recovery: the previous 3 files stay in R2. To restore one, copy it to a new key and set `sync_state.object_key` and a **higher** `revision` by hand; never reuse a revision number."
- [ ] **Step 4: Commit** `feat(backend): sync endpoints with compare-and-swap and 3-file history`.

> The remote D1 migration and the deploy are in Task 14 **(operator)**. Do not run them here.

---

# Part C — Sync runner

### Task 8: `sync_base` table and the async data layer

**Files:**
- Create: `mobile/src/data/migrations/022_sync_base.ts` (+ `022_sync_base.test.ts`), `mobile/src/data/sync/syncTransaction.ts`, `syncSnapshot.ts`, `syncApply.ts`, `syncBaseStore.ts`, `mobile/test-support/sqliteTestDb.ts`
- Modify: `mobile/src/data/migrations/index.ts`, `mobile/src/platform/capabilities.ts` (+ new cases in `capabilities.test.ts`), `mobile/src/data/user/restoreBackup.ts` (`eraseLocalData` also runs `DELETE FROM sync_base`; new test case), `mobile/package.json` (devDependency `sql.js`)
- Test: `mobile/src/data/sync/syncSnapshot.test.ts`, `syncApply.test.ts`, `syncBaseStore.test.ts`

**Interfaces:**
- Produces: migration 022:
  ```sql
  CREATE TABLE IF NOT EXISTS sync_base (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    revision INTEGER NOT NULL DEFAULT 0,
    data_json TEXT,
    pending_replace INTEGER NOT NULL DEFAULT 0,
    last_synced_at TEXT,
    last_error_code TEXT
  );
  ```
  `data_json IS NULL` means "no base". `sync_base` is never in `BackupData`.
- Produces: `supportsExclusiveTransaction = (): boolean => !isWeb()`.
- Produces: `SyncSql = Pick<SQLiteDatabase, 'getAllAsync' | 'getFirstAsync' | 'runAsync'>`; `withSyncTransaction(db: SQLiteDatabase, task: (tx: SyncSql) => Promise<void>): Promise<void>` — native: `db.withExclusiveTransactionAsync(task)`; web: `db.withTransactionAsync(() => task(db))`.
- Produces: `CurriculumLookup = { idToRef: Map<number, ItemRef>; refToId: Map<string, number>; known: KnownContent; curriculumVersion: string | null }`; `readCurriculumLookup(userDb): Promise<CurriculumLookup>` — async reads on the main handle through the `curriculum` ATTACH alias (`items`, `reading_passages`, `passage_questions`, `curriculum_metadata`). A transaction connection has no ATTACH, so this runs before the transaction.
- Produces: `readUserTables(sql: SyncSql, lookup: CurriculumLookup): Promise<BackupData>` — every sync table read with `getAllAsync` (the same columns as `exportBackup.ts`, plus `lesson_opt_ins`), rows whose item id is not in `idToRef` left out, result passed through `toSyncData`. Small pure row mappers are written again here; do not refactor `exportBackup.ts`.
- Produces: `SyncSnapshot = { data: BackupData; schemaVersion: number; lookup: CurriculumLookup }`; `readSyncSnapshot(userDb): Promise<Result<SyncSnapshot>>` (errors → `sync_local_failed`).
- Produces: `SyncBase = { revision: number; data: BackupData; pendingReplace: boolean }`; `SyncStatusRow = { lastSyncedAt: string | null; lastErrorCode: string | null }`; in `syncBaseStore.ts`: `readSyncBase(db): Promise<Result<SyncBase | null>>`, `writeSyncBase(sql: SyncSql, base: { revision: number; data: BackupData }, syncedAt: string | null): Promise<void>` (clears `pending_replace` and `last_error_code`; `syncedAt === null` keeps `last_synced_at`), `markPendingReplace(db, data: BackupData): Promise<Result<void>>` (sets `data_json`, `pending_replace = 1`, keeps `revision`; with no row it inserts one with `revision = 0`), `readSyncStatus(db)`, `writeSyncError(db, code: string | null)`, `clearSyncBase(db): Promise<Result<void>>` (`DELETE FROM sync_base`).
- Produces: `applySyncMerge(userDb, args: { expectedLocal: BackupData; merged: BackupData; lookup: CurriculumLookup; base: { revision: number; data: BackupData } }): Promise<Result<{ changedRows: number }>>` — inside one `withSyncTransaction`:
  1. `now = await readUserTables(tx, lookup)`; if `!sameSyncData(now, expectedLocal)` → write nothing, return error `sync_local_changed`.
  2. `diff = diffSyncData(expectedLocal, merged, lookup.known)`; write it: deletes by primary key, then upserts with multi-row `INSERT OR REPLACE` (rows per statement = `floor(900 / column count)`). `import_metadata` has no natural primary key: plain `INSERT` for its upserts, no deletes. `streaks` and `goal_ring_state` write `id = 1`. `furigana_overrides.item_id` and `lesson_opt_ins.item_id` are TEXT.
  3. `writeSyncBase(tx, args.base, null)`.
  A thrown SQL error rolls back and returns `sync_local_failed`. After a commit with `changedRows > 0`, call `notifyFuriganaOverridesChanged()`.
- Produces (tests only): `openTestUserDb(): Promise<TestDb>` in `test-support/sqliteTestDb.ts` — an in-memory `sql.js` database with `ATTACH DATABASE ':memory:' AS curriculum`, the real migrations 001–022 applied through an `execSync` shim, minimal `curriculum.items` / `reading_passages` / `passage_questions` / `curriculum_metadata` tables, and `getAllAsync` / `getFirstAsync` / `runAsync` / `withExclusiveTransactionAsync` / `withTransactionAsync` over the real engine (`BEGIN` / `COMMIT` / `ROLLBACK`). Sync data tests use it instead of the regex mock.

- [ ] **Step 1:** `npm install --save-dev sql.js @types/sql.js` in `mobile/`. Write `sqliteTestDb.ts` and one test `sqliteTestDb applies all migrations and rolls back a failed transaction`. Run it. **If `sql.js` cannot load under `jest-expo`, stop and ask the operator.**
- [ ] **Step 2: Failing tests.**
  - `022 creates sync_base with one allowed row` (second insert with `id = 2` fails).
  - `readUserTables returns every table keyed by slug and leaves out never-synced preferences` (seed one row in each of the 18 tables).
  - `readUserTables leaves out a row whose item is not in the curriculum`.
  - `applySyncMerge writes upserts and deletes for every table` (start state S, merged M that changes, adds and removes one row in each table → `readUserTables` equals M's known rows).
  - `applySyncMerge writes the base in the same transaction` (`readSyncBase` → the given revision and data).
  - `apply stops when local changed after the snapshot` (change one `srs_states` row between the snapshot and the call → error `sync_local_changed`; the changed row is still there; `sync_base` unchanged).
  - `a failing write rolls back every table and the base` (merged row that breaks a `CHECK`, e.g. `itemStudyStatus.status = 'bad'` → `sync_local_failed`; state equals S).
  - `applySyncMerge does not write rows for unknown items but the base keeps them`.
  - `applySyncMerge never touches a never-synced preference` (`theme_mode` row survives a merge whose preferences lack it).
  - `applySyncMerge inserts 2,000 srs rows` (batch path).
  - `sync base store`: `write then read round-trips`; `markPendingReplace keeps the revision and sets the flag`; `writeSyncBase clears the flag and the error`; `clearSyncBase removes the row`; `readSyncBase with data_json NULL → null`.
  - `eraseLocalData empties sync_base` (existing mock-based test file, new case; add the table name to the mock if it needs it).
  - `capabilities`: `supportsExclusiveTransaction` is false on web, true on ios and android.
  - `withSyncTransaction uses withTransactionAsync on web and the exclusive form on native` (spies on the test db; `Platform.OS` switched as in `capabilities.test.ts`).
- [ ] **Step 3:** Run `npx jest src/data/sync src/data/migrations src/platform` → FAIL. Implement. Run → PASS. Run the full suite `npm test -- --ci`, `npm run typecheck`, `npm run lint` → green.
- [ ] **Step 4: Commit** `feat(sync): sync_base table and async snapshot, apply and base store`.

### Task 9: Sync API client

**Files:**
- Create: `mobile/src/data/sync/syncApi.ts` (+ `syncApi.test.ts`)
- Modify: `mobile/src/core/account/account.types.ts` (`AccountErrorCode` + `'revision_conflict'`; `AccountSession` + `request`), `mobile/src/core/account/errorMessages.ts` (`revision_conflict: null`), `mobile/src/core/account/apiClient.ts` (`toAccountError`: JSON `revision_conflict` → that code), `mobile/src/data/account/session.ts`, `session.web.ts` (implement `request`); new cases only in their test files

**Interfaces:**
- Produces: `AccountSession.request(path: string, init: RequestInit): Promise<Result<Response>>` — native: `manager().authorizedRequest(path, init)`; web: the existing `authorized(path, init)`. Same refresh rules as every other account call.
- Produces: `createSyncApi(request: AccountSession['request'], timeoutMs = 15_000): SyncApi` with
  - `pull(have: number): Promise<Result<{ revision: number; bytes: Uint8Array | null }>>` — `GET /api/sync?have=<have>`; `204` → `bytes: null`; `200` → `new Uint8Array(await res.arrayBuffer())`; `revision` from `X-Sync-Revision` (missing or not an integer → `server` error).
  - `push(baseRevision: number, bytes: Uint8Array): Promise<Result<{ revision: number }>>` — `PUT /api/sync?base_revision=<n>`, `Content-Type: application/gzip`, body `bytes`; `409` arrives as error code `revision_conflict`.
  - Each request has an `AbortController` that aborts after `timeoutMs` → error code `network`.
  - Never logs bodies or headers.

- [ ] **Step 1: Failing tests** (fake `request`): `pull 204 → bytes null and the header revision`; `pull 200 → bytes and revision`; `pull without the header → server`; `push sends base_revision, the gzip content type and the same bytes`; `push 409 → revision_conflict`; `a request that never answers → network after the timeout` (fake timers); `toAccountError maps JSON revision_conflict`; `session.request uses the session manager (native)`; `session.web request refreshes once on 401`.
- [ ] **Step 2:** Run `npx jest src/data/sync/syncApi.test.ts src/core/account src/data/account` → FAIL. Implement. Run → PASS.
- [ ] **Step 3: Check binary transport on native (needs a phone or emulator; ask the operator if none is available).** In a dev build, run once from a temporary screen or the debugger: `fetch('https://paka-paka.app/favicon.ico').then(r => r.arrayBuffer())` must resolve with bytes, and a `PUT` of a `Uint8Array` body to `https://paka-paka.app/api/nope` must reach the server (404 JSON). **If either fails, stop and ask the operator** (the likely change is `fetch` from `expo/fetch` in `session.ts`). Remove the temporary code.
- [ ] **Step 4: Commit** `feat(sync): sync API client and authorized request on the account session`.

### Task 10: The runner

**Files:**
- Create: `mobile/src/core/sync/syncRunner.ts`
- Test: `mobile/src/core/sync/syncRunner.test.ts`

**Interfaces:**
- Consumes: `mergeSyncData`, `withCarriedRows`, `isEmptyProgress`, `sameSyncData` (Task 5); types of Tasks 8–9 (imported as types only; the runner has no I/O imports).
- Produces: `SyncTrigger = 'open' | 'before_review' | 'session_end' | 'background' | 'manual'`.
- Produces: `SyncRunResult = { status: 'skipped' | 'up_to_date' | 'pushed' | 'pulled' | 'merged' | 'deferred' | 'error'; error: AppError | null; changedLocal: boolean }`.
- Produces: `SyncPorts = { isSignedIn(): Promise<boolean>; readSnapshot(): Promise<Result<SyncSnapshot>>; readBase(): Promise<Result<SyncBase | null>>; applyMerge(args: { expectedLocal: BackupData; merged: BackupData; lookup: CurriculumLookup; base: { revision: number; data: BackupData } }): Promise<Result<{ changedRows: number }>>; writeBase(base: { revision: number; data: BackupData }, syncedAt: string): Promise<Result<void>>; clearBase(): Promise<Result<void>>; writeError(code: string | null): Promise<void>; api: SyncApi; encode: typeof encodeSyncFile; decode: typeof decodeSyncFile; askConflict(entries: ConflictEntry[]): Promise<ConflictChoice>; isStudyActive(): boolean; onPhase(phase: 'idle' | 'syncing' | 'conflict'): void; nowIso(): string }`.
- Produces: `createSyncRunner(ports: SyncPorts): { run(trigger: SyncTrigger): Promise<SyncRunResult> }`.

Algorithm (one **cycle**; a run does at most 3 cycles, then `sync_busy`):

```
0. not signed in → 'skipped' (no DB read, no request)
1. base = readBase(); snap = readSnapshot()
   local = withCarriedRows(snap.data, base?.data ?? null, snap.lookup.known)
2. trigger is 'session_end' or 'background', base exists, not pendingReplace,
   and sameSyncData(local, base.data) → 'up_to_date' (no request)
3. pulled = api.pull(base?.revision ?? 0)
4. pendingReplace (restore while signed in):
     if pulled.bytes: decode it only for the schema check (step 6a)
     push local with base_revision = pulled.revision → step 8
5. pulled.revision === 0 → push local with base_revision 0 → step 8
   pulled.bytes === null (remote = base):
     sameSyncData(local, base.data) → writeBase(base, now) → 'up_to_date'
     else push local with base_revision = base.revision → step 8
6. pulled.bytes present:
   a. remote = decode(bytes); error → stop with that error.
      remote.schemaVersion > snap.schemaVersion → 'sync_update_required'; stop.
   b. mergeBase =
        base && pulled.revision > base.revision → base.data
        base && pulled.revision < base.revision → clearBase(), then as "no base"
        no base && isEmptyProgress(snap.data)   → local   (device empty: pull)
        no base                                 → null    (two-way compare)
   c. out = mergeSyncData({ base: mergeBase, local, remote: remote.data }, null)
      conflicts → onPhase('conflict'); choice = await askConflict(out.conflicts);
                  out = mergeSyncData(same input, choice)
   d. isStudyActive() and !sameSyncData(out.merged, local) → 'deferred' (write nothing)
   e. applyMerge({ expectedLocal: snap.data, merged: out.merged, lookup: snap.lookup,
                   base: { revision: pulled.revision, data: remote.data } })
      'sync_local_changed' → next cycle (from step 1)
   f. sameSyncData(out.merged, remote.data) → writeBase(same, now) → 'pulled'
      else push out.merged with base_revision = pulled.revision → step 8
8. push(file, baseRevision):
     bytes = encode({ schemaVersion: snap.schemaVersion,
                      curriculumVersion: snap.lookup.curriculumVersion,
                      exportedAt: nowIso() }, file)
     api.push ok  → writeBase({ revision: new, data: file }, now) → 'pushed' / 'merged'
     'revision_conflict' → next cycle (from step 1)   ("on 409, pull and compare again")
     other error → stop with that error
```

Rules around the cycle:
- **Single flight.** While a run is in flight, `run()` returns the same promise. If the new trigger is `session_end` or `manual`, one more full run starts when the current one ends, and the caller's promise resolves after it.
- Every stop with an error calls `writeError(code)` and returns `status: 'error'`. Every success calls `writeBase(…, now)` (which clears the error). `session_ended` is returned to the caller and not written.
- `onPhase('syncing')` at the start, `onPhase('idle')` at the end.
- The file that goes to `encode` is the merged file (with carried rows). The base after a push is exactly that file.
- Never call `applyMerge` in steps 4 and 5: a push changes no local row.

- [ ] **Step 1: Failing tests** (in-memory fakes for every port; a fake server object with `revision` + `file` that implements `pull`/`push` with real compare-and-swap; `encode`/`decode` replaced by identity wrappers):
  - `signed out: no port is called`.
  - `first sign-in, account empty → pushes local with base_revision 0 and writes the base`.
  - `first sign-in, device empty → applies the remote file, no push, no dialog`.
  - `first sign-in, both have data → two-way compare; a differing item opens the dialog; rows on one side only are added`.
  - `remote unchanged and local unchanged → up_to_date, no push`.
  - `session_end with no local change makes no request`.
  - `local changed only → push; base becomes the pushed file`.
  - `remote changed only → apply; no push`.
  - `both changed different items → apply and push, askConflict is not called, both changes are in the pushed file`.
  - `both changed the same item → askConflict gets one entry; 'local' pushes the local rows; 'remote' applies the remote rows and pushes nothing new for that item` (two tests).
  - `409 on push → pulls again and merges again, then pushes` (the fake server changes between pull and push).
  - `three 409s in a row → sync_busy`.
  - `local change during a run restarts the cycle` (`applyMerge` returns `sync_local_changed` once).
  - `push failure after apply is finished by the next run` (push returns `network`; second `run` pushes; no dialog; the fake server file has both sides' changes).
  - `damaged remote file changes nothing` (decode error → no `applyMerge`, no `push`, `writeError('sync_bad_file')`).
  - `remote schemaVersion newer → sync_update_required, no apply, no push`.
  - `remote revision below base drops the base` (`clearBase` called, two-way compare, no local delete).
  - `unknown-item rows from the base are in the pushed file`.
  - `study active and the merge would change local rows → deferred, nothing written`; `study active and only a push is needed → pushes`.
  - `pending replace → pushes local over the remote without a merge and clears the flag`; `pending replace with a newer remote schema → sync_update_required`.
  - `second run while the first is in flight returns the same promise`; `a session_end trigger during a run starts one more run`.
  - `quota error from the API is returned as paused and written as the last error`.
- [ ] **Step 2:** Run `npx jest src/core/sync/syncRunner.test.ts` → FAIL. Implement. Run → PASS.
- [ ] **Step 3: Commit** `feat(sync): sync runner with compare-and-swap retry and conflict hold`.

---

# Part D — Settings and dialog UI

### Task 11: SyncProvider and the triggers

**Files:**
- Create: `mobile/src/providers/SyncProvider.tsx` (+ test), `mobile/src/components/sync/SyncGate.tsx` (+ test)
- Modify: `mobile/src/app/_layout.tsx` (wrap inside `AccountProvider`: `<SyncProvider>`), `mobile/src/app/review/_layout.tsx`, `mobile/src/app/lesson/_layout.tsx`, and the screens that reload user data in `useFocusEffect` (`(tabs)/dashboard.tsx`, `(tabs)/stats.tsx`, `(tabs)/browse/index.tsx`, `levels/index.tsx`)

**Interfaces:**
- Consumes: `createSyncRunner`, the data layer of Task 8, `createSyncApi`, `encodeSyncFile`/`decodeSyncFile`, `useAccount`, `useDatabase`.
- Produces: `useSync(): { phase: 'idle' | 'syncing' | 'conflict'; lastSyncedAt: string | null; error: string | null; conflicts: ConflictEntry[] | null; appliedVersion: number; syncNow(): Promise<void>; chooseConflict(choice: ConflictChoice): void; runBeforeReview(): Promise<void>; beginStudy(): void; endStudy(): void; replaceRemoteAfterRestore(data: BackupData): Promise<void> }` (throws outside the provider, like `useAccount`).
- `SyncProvider` takes an optional `session?: AccountSession` prop for tests (same pattern as `AccountProvider`); the app uses `createAccountSession()`.
- Behavior:
  - `account.status` becomes `'signed_in'` → `run('open')`. Becomes `'signed_out'` → `clearSyncBase(userDb)`, state reset. While signed out: no listener, no request, no snapshot read.
  - While signed in, `AppState` `'change'` to `'background'` → `run('background')`. (react-native-web maps `visibilitychange` hidden to `'background'`; one code path for native and web.)
  - `error` = `userMessage` of the last run's error (`accountErrorMessage` codes or `syncErrorMessage`); `session_ended` is passed to the account provider path by calling `account.refresh()`.
  - `appliedVersion` goes up by 1 after any run with `changedLocal`.
  - `askConflict` port: sets `conflicts`, returns a promise that `chooseConflict` resolves.
  - `beginStudy` / `endStudy` keep a counter; `isStudyActive` port reads it. `endStudy` then runs `run('session_end')` inside `setTimeout(…, 0)` so the session's last writes are done first.
  - `replaceRemoteAfterRestore(data)`: `markPendingReplace(userDb, toSyncData(data))`, then `run('manual')`.
- Produces: `<SyncGate mode="review" | "lesson">{children}</SyncGate>`:
  - signed out → renders children at once and does nothing else.
  - `mode="review"`, signed in → shows `Syncing your progress…` (existing loading layout, `bg-background`, `text-secondary`), calls `runBeforeReview()`; after 3 s also shows a secondary `Button` `Start now`. When the run ends or the button is pressed: `beginStudy()` and render children.
  - `mode="lesson"`, signed in → `beginStudy()` and render children at once (the spec pulls only before a review).
  - unmount (signed in) → `endStudy()`.
- `review/_layout.tsx`: `<SyncGate mode="review"><ReviewSessionProvider>…`; `lesson/_layout.tsx`: `<SyncGate mode="lesson">` around its stack.
- Screens: add `appliedVersion` from `useSync()` to the dependency list of the `useFocusEffect` callback that reloads user data, so a focused screen reloads after an applied merge. No other change in those files.

- [ ] **Step 1: Failing tests.**
  - `SyncProvider`: `signed out: no fetch, no snapshot read, no AppState listener`; `signed in on mount → one run with trigger open`; `status change to signed_out clears the base`; `AppState background → run with trigger background`; `conflict: conflicts is set until chooseConflict, then the run continues`; `appliedVersion rises after a run that changed local rows`; `replaceRemoteAfterRestore marks pending replace then runs`; `endStudy starts a session_end run after the current tick`.
  - `SyncGate`: `signed out renders children at once and calls nothing`; `review mode waits for runBeforeReview then renders children`; `Start now appears after 3 s and renders children` (fake timers); `lesson mode renders at once and calls beginStudy`; `unmount calls endStudy`.
  - Existing screen tests that render `dashboard`, `stats`, `browse`, `levels`, `review`, `lesson` now need a sync context: add `jest.mock('@/providers/SyncProvider', …)` returning an idle `useSync` in those test files. Add the mock only; change no assertion.
- [ ] **Step 2:** Run the new tests → FAIL. Implement. Run `npm test -- --ci`, `npm run typecheck`, `npm run lint` → green.
- [ ] **Step 3: Commit** `feat(sync): provider, triggers on open, review, session end and background`.

### Task 12: Settings, conflict dialog, restore while signed in

**Files:**
- Create: `mobile/src/components/sync/SyncConflictDialog.tsx` (+ test)
- Modify: `mobile/src/components/settings/AccountSettingsSection.tsx`, `mobile/src/components/settings/SignOutSheet.tsx`, `mobile/src/components/backup/RestorePreviewCard.tsx`, `mobile/src/app/(tabs)/settings/index.tsx`, `mobile/src/app/_layout.tsx` (render `<SyncConflictDialog />` inside `SyncProvider`)
- Test edits allowed: `AccountSettingsSection.test.tsx` (add the SyncProvider mock; **replace** the case `Sync now is disabled with the caption`), `settings/index.test.tsx` (add the SyncProvider mock only), new cases elsewhere

**Interfaces:**
- Consumes: `useSync()` (Task 11), `ConflictEntry`.
- Produces: `SyncConflictDialog` — a `Modal` sheet in the style of `SignOutSheet` (`useSheetFrame`, `bg-surface`, `border-border`), visible when `useSync().conflicts` is not null. Title and body: exact copy. A scrolling list, one row per entry:
  - item entry: the item's characters and primary meaning, read by `(item_type, slug)` from `curriculumDb` (use the existing item repository lookup); if the item is not found, show the slug.
  - preference entry: `Setting: <key with "_" replaced by spaces>`.
  - second line: `This device: <changed date and time | removed>` · `Other device: <changed date and time | removed>` from `localUpdatedAt` / `remoteUpdatedAt` (display only).
  - Buttons `Keep this device` → `chooseConflict('local')`, `Use other device` → `chooseConflict('remote')`. `onRequestClose` does nothing (the dialog needs an answer). testIDs `sync-conflict-dialog`, `sync-conflict-keep-local`, `sync-conflict-use-remote`, `sync-conflict-row-<n>`. Each button has an `accessibilityLabel` equal to its label.
- `AccountSettingsSection` (signed in): `Sync now` is enabled, `onPress = sync.syncNow`, disabled while `sync.phase !== 'idle'`. Caption (same style as today): `Syncing…` while syncing; else `Last synced <toLocaleString date and time>` when `lastSyncedAt`; else `Not synced yet.` Sync error text below it in the `settings-account-error` style, testID `settings-account-sync-error`.
- `SignOutSheet`: the erase step body becomes the exact "Erase sheet body" copy; update the component comment.
- `RestorePreviewCard`: new prop `signedIn: boolean`; when true the warning text is `This replaces the progress on all your signed-in devices.` (else the existing `RESTORE_CONFIRM_WARNING`).
- `settings/index.tsx`: pass `signedIn={account.status === 'signed_in'}`; in `handleConfirmRestore`, after a successful `restoreBackup` and when signed in, call `await sync.replaceRemoteAfterRestore(preview.bundle.data)`. When `sync.appliedVersion` changes, run the same refresh block that follows a restore (`setSettingsVersion`, theme, furigana, vacation, auto-advance, reduced motion, haptics, shadow mode, notifications).

- [ ] **Step 1: Failing tests.**
  - `SyncConflictDialog`: `hidden when conflicts is null`; `lists an item entry with its characters and meaning`; `lists a preference entry as "Setting: session intensity"`; `shows "removed" for a side with no row`; `Keep this device calls chooseConflict('local')`; `Use other device calls chooseConflict('remote')`; `the exact title and body`.
  - `AccountSettingsSection`: `Sync now calls syncNow` (replaces the old disabled case); `Sync now is disabled while syncing and the caption is "Syncing…"`; `caption shows "Not synced yet." with no sync time`; `caption shows the last sync time`; `sync error shows under the button`; `signed out renders no sync row`.
  - `SignOutSheet`: `erase step shows the exact copy`.
  - `RestorePreviewCard`: `signed in shows the all-devices warning`; `signed out shows the device warning`.
  - `settings/index`: `restore while signed in calls replaceRemoteAfterRestore with the bundle data`; `restore while signed out does not`.
- [ ] **Step 2:** Run → FAIL. Implement. Run `npm test -- --ci`, `npm run typecheck`, `npm run lint` (a11y rules) → green.
- [ ] **Step 3: Verify on web, local.** `cd mobile && npm run build:web`, then `cd ../backend && npx wrangler dev` (local D1 and R2; the operator's `.dev.vars` from Part 2). `BROWSER=none` if `expo start` is used. In Chrome, signed in: Settings shows `Last synced …` after open; a review then a return to Settings shows a newer time; `wrangler dev` log shows one `PUT /api/sync` per session and no body or token. Signed out: the Network panel shows no `/api/sync` request.
- [ ] **Step 4: Commit** `feat(sync): Sync now, conflict dialog, restore over all devices`.

---

# Part E — Docs, deploy, final check

### Task 13: Docs

**Files:** Modify `CLAUDE.md`, `docs/design/backup-and-web-plan.md`, `docs/working-history.md`, `backend/README.md`

- [ ] **Step 1:** `CLAUDE.md`: in "Project overview", say that sync is built (one progress file per user, three-way merge on the device, one conflict dialog). In "Hard conventions" add one line: "**Sync** — merge decisions use row content, never `updatedAt`; sync code uses the async SQLite API (`src/data/sync/`), merge rules are pure functions in `src/core/sync/`; a new `user.db` table must be added to `BackupData` and `SYNC_TABLES` or named as device-only." In "Architecture crux" add one sentence on `sync_base`.
- [ ] **Step 2:** `backup-and-web-plan.md`: §A1/§A2 — note that `lessonOptIns` is in the format and that the sync file is this format without conversations and without the never-synced preference keys (list them). Note the raw passage id limit (Findings 5).
- [ ] **Step 3:** `working-history.md`, row "Web app, optional accounts, progress sync": Part 3 status (built on `part3-sync`; what is deployed is written in Task 14), the Findings of this plan, and the open items (web background push is best effort; the decode limit; raw passage ids).
- [ ] **Step 4: Commit** `docs: Part 3 progress sync, rules and status`.

### Task 14: Deploy and the two-device check (operator-gated)

Ask before each **(operator)** step and show the exact command. No new secret is needed for Part 3; if one becomes necessary, the operator runs `wrangler secret put` — never ask for a secret value in chat.

- [ ] **Step 1 (operator, D1 change):** `cd backend && npx wrangler d1 migrations apply pakapaka --remote` (applies `0002_sync_object_key`). Verify: `npx wrangler d1 execute pakapaka --remote --command "PRAGMA table_info(sync_state)"` lists `object_key`.
- [ ] **Step 2 (operator, deploy):** `cd mobile && npm run deploy:web`.
- [ ] **Step 3: Smoke test on https://paka-paka.app:** `curl -i https://paka-paka.app/api/sync?have=0` → `401`; signed-out Settings shows only "Sign in to sync" and the Network panel has no `/api/sync` call; sign in on web → `Last synced …` appears; `npx wrangler r2 object get`/dashboard shows one object under `progress/<user id>/`.
- [ ] **Step 4 (operator, phone build):** dev-client rebuild for Android and iPhone (also open from Part 2) and Google sign-in on each.
- [ ] **Step 5: Final "done when" (phone + web, same account):**
  1. Phone reviews item A; web reviews item B without a sync between. Sync both. → No dialog. Both devices show both reviews (Browse item detail: SRS stage and next due date equal on the two devices). Stats "days studied" and today's ring count both reviews.
  2. Phone and web both review item C without a sync between. Sync the second device. → The dialog lists C only. Choose **Keep this device** → C has this device's state on both devices after the other device syncs.
  3. Do step 2 again with item D and choose **Use other device** → D has the other device's state on both.
  4. Restore a backup on web while signed in → the all-devices warning shows; after it, the phone pulls and has the restored progress.
  5. Sign out on the phone → progress stays; sign in again → no dialog when nothing changed elsewhere (two-way compare finds equal rows).
  6. On the phone with a typical account, a sync shows no visible freeze; write the Task 6 timings measured on the phone in `working-history.md`.
- [ ] **Step 6:** All tests green: `cd mobile && npm test -- --ci && npm run typecheck && npm run lint`; `cd backend && npm test && npm run typecheck`; repo root `npm run check-contrast`. Existing native tests are unchanged except the edits named in Tasks 1, 8, 11 and 12.
- [ ] **Step 7:** Update `docs/working-history.md` with the deploy date and the results of Step 5. Commit `docs: Part 3 deployed`.

**Done when (whole of Part 3):** two devices (phone + web) each review different items and sync with no dialog and no lost reviews. Both review the same item → the dialog lists it, and both choices give the expected result. The merge logic is pure functions with tests for every rule. All tests are green. Native tests are unchanged.
