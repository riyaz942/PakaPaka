# Backup/restore + web build plan

Two related pieces of work:

- **Part A — Backup & restore.** A user-owned export/import of their own progress. Needed on mobile
  regardless of web; it is also the honest answer to "will I lose my data" on any platform.
- **Part B — Web build + PWA.** Zero-install trial, and a real answer to the keyboard/desktop use
  case without building a desktop app.

**Sequencing: A before B.** Browser storage is evictable (see [B0](#b0--the-durability-problem)).
Shipping a web build with no way to get progress out would be shipping a data-loss bug. Part A is
also independently valuable, so it is not blocked on any of Part B's unknowns.

Last checked against the codebase: **2026-08-06**

---

## Part A — Backup & restore

### A0 — What exists today

Import is already built and is worth reusing rather than reinventing:

| Piece | Where |
| --- | --- |
| Source mappers (WaniKani / Bunpro / Anki) | `mobile/src/core/import/` |
| Canonical shapes — `MappedImportItem`, `ImportPreview`, `ImportSummary` | `mobile/src/core/import/import.types.ts` |
| Preview-then-confirm store | `mobile/src/data/import/importPreviewStore.ts` |
| File picking (already works on web) | `expo-document-picker`, used in `src/app/onboarding/import.tsx` |
| Zip handling, if the format ever needs it | `jszip` (already a dependency) |

The user database is **17 tables across 18 migrations** (`mobile/src/data/migrations/`):

```
user_preferences      item_study_status     srs_states            weakness_stats
personal_mnemonics    user_synonyms         furigana_overrides    related_item_boosts
goal_ring_state       daily_lesson_log      cognitive_load_history streaks
passage_practice_results  import_metadata   ai_sessions           ai_messages
schema_migrations
```

There is **no export code anywhere** — this is greenfield.

### A1 — Format decisions (settle these first)

These are the choices that are expensive to change later.

**1. Key by curriculum `slug`, never by integer `id`.**
`items` is `UNIQUE (item_type, slug)` with an `INTEGER PRIMARY KEY`. Row ids are assigned by the
compile step and can shift whenever the curriculum is recompiled or updated OTA. A backup keyed by
integer id will silently attach progress to the wrong kanji after a curriculum update. Export
`{item_type, slug}` pairs and resolve them back to ids on restore.

**2. Never export credentials.** BYOK provider keys live in secure storage
(`src/data/ai/byokCredentialStore.ts`, `src/data/user/credentialStore.ts`). They must be excluded
unconditionally — not behind an option. A backup file is something users email themselves.

**3. AI transcripts are opt-in, off by default.** `ai_sessions` / `ai_messages` are the only
unbounded-size tables and the only ones holding free text. Default off keeps the file small and
predictable.

**4. Plain JSON, gzipped, one file.** Not SQLite bytes. JSON survives schema drift, is inspectable
by the user (which is the point of an open, no-accounts app), and can be restored across platforms
where the SQLite page format or VFS differs. Include:

```jsonc
{
  "format": "pakapaka-backup",
  "formatVersion": 1,
  "schemaVersion": 18,        // max applied migration at export time
  "curriculumVersion": "…",   // from curriculum_metadata
  "exportedAt": "…",
  "includesConversations": false,
  "data": { /* per-table rows, item refs as {type, slug} */ }
}
```

**5. Restore is replace-all, with an explicit warning.** Not a merge. Merging two FSRS histories has
no correct answer, and a half-merged review schedule is worse than either input. One path that can
fail loudly, per the project's no-hidden-fallbacks rule.

### A2 — Steps

| # | Step | Verify |
| --- | --- | --- |
| A2.1 | Define the backup schema + a `BackupBundle` type alongside `import.types.ts`. Write the round-trip serializer/deserializer as pure functions in `src/core/backup/`. | Unit tests: full DB → bundle → DB is byte-identical on every table. Property test on slug resolution with a shifted-id curriculum fixture. |
| A2.2 | `exportBackup()` in `src/data/user/` — read all tables, resolve ids → slugs, gzip, write via `expo-file-system`, hand to the share sheet. | Export on a seeded DB produces a file that A2.1's parser accepts. |
| A2.3 | `restoreBackup()` — parse, validate `format`/`formatVersion`, resolve slugs → ids, report unmatched items, replace all user tables in one transaction. | Restore of an A2.2 file reproduces exact SRS state. Corrupt/truncated file fails with a typed `AppError`, never a throw. Unknown slugs are counted and surfaced, not dropped silently. |
| A2.4 | Settings UI: "Back up my progress" / "Restore from backup", conversation-include toggle, and a preview-then-confirm restore screen reusing the `importPreviewStore` pattern. Show item counts and a clear "this replaces your current progress" gate. | Manual: export → wipe app data → restore → progress intact. |
| A2.4b | **Restore as an onboarding import source.** Add "PakaPaka backup" as a fourth pill on `src/app/onboarding/import.tsx` alongside WaniKani / Bunpro / Anki, following the Anki file-pick branch. A fresh install is the main moment anyone restores, so Settings alone is the wrong home for it. | Restore reachable from first launch without visiting Settings. |
| A2.4c | **Branch the post-restore route.** `import-summary.tsx` hard-routes to `/onboarding/intensity`; restore must go to `complete` instead. A backup already carries `user_preferences` and `item_study_status`, so continuing through intensity/placement would re-ask answered questions and let placement overwrite restored progress. | Restore → complete, with intensity/goal/theme and study status all matching the backup. |
| A2.5 | A "last backed up N days ago" nudge. Surfaced in Settings; on web also as a dismissible Home banner (the existing conditional banner slot). | Nudge appears after the threshold, clears on export. |

### A3 — Explicitly out of scope

- ~~Cloud sync, accounts, or a server of any kind.~~ **Replaced:** optional Google sign-in, a Cloudflare Worker and progress sync are now in scope. See the [web app design (2026-11-04)](../superpowers/specs/2026-11-04-web-app-accounts-sync-design.md).
- Merge/conflict resolution between two devices.
- Automatic scheduled backups on mobile (the OS backup systems already cover the app sandbox).

---

## Part B — Web build + PWA

> **Updated 2026-11-04.** The web build is now scoped by
> [the web app design](../superpowers/specs/2026-11-04-web-app-accounts-sync-design.md) (Part 1) and
> [its plan](../superpowers/plans/2026-11-04-web-app-part1-web-build.md). Where this section
> disagrees (hosting on Cloudflare Workers static assets instead of Pages, no PWA / offline shell,
> seeding, the sync-bridge fix), the spec wins. Notes below mark each change.

### B0 — The durability problem

Browser storage is evictable. Safari clears IndexedDB/OPFS after ~7 days without a visit unless the
site is installed to the home screen; Chrome evicts under disk pressure; "clear browsing data" wipes
everything. This is why Part A ships first, and why the install prompt is a feature rather than
polish.

Mitigations, in order of effect: request `navigator.storage.persist()`, prompt to install as a PWA,
and make backup visible and easy.

### B1 — Verified constraints (checked in `node_modules`, not assumed)

These three findings shape the whole effort.

**1. `expo-sqlite` on web needs `SharedArrayBuffer` → the host must send COOP/COEP headers.**
`expo-sqlite/web/WorkerChannel.ts` allocates `SharedArrayBuffer` and blocks on `Atomics`. That
requires cross-origin isolation:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

**GitHub Pages cannot set response headers, so it is not a viable host.** **Decided: Cloudflare
Pages.** Headers go in a `_headers` file at the root of the build output (`mobile/dist/`):

```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

`require-corp` also blocks any cross-origin subresource that does not opt in via CORP/CORS. Fonts
are the thing to watch — `@expo-google-fonts/*` are npm packages bundled locally rather than fetched
from Google, so this should be fine, but verify no runtime request escapes the origin. Confirm with
`crossOriginIsolated === true` in the deployed page's console before building anything else.

> **Superseded 2026-11-04:** a probe build showed `importDatabaseFromAssetAsync` **does work on web**
> in `expo-sqlite` 55.0.17 (`web/worker.ts` handles `importAssetDatabase`). The curriculum seeded and
> a lesson ran. There is **no `database.web.ts`**; `src/data/database.ts` is unchanged. The seed is
> now 12 MB, not 1.9 MB. The text below is kept as history.

**2. `importDatabaseFromAssetAsync` has no web implementation.** It appears only in
`expo-sqlite/build/hooks.js` (an `expo-file-system` copy) and is entirely absent from
`expo-sqlite/web/SQLiteModule.ts`. Our curriculum seeding at `src/data/database.ts:47` therefore
cannot work as-is on web.

The web seeding path instead becomes:

1. Serve `curriculum.db` (1.9 MB) as a static asset from the same origin — it must be same-origin
   anyway under `require-corp`.
2. `fetch()` it into an `ArrayBuffer` on first run, gated behind a loading state. One-time cost;
   afterwards it lives in OPFS.
3. Hand the bytes to `deserializeAsync`, which **does** exist on web
   (`expo-sqlite/web/SQLiteModule.ts`), or write them into the OPFS VFS as a named file.

Which of those two lands depends on the B3.1 spike: `deserializeAsync` may produce a memory-resident
database, which interacts with the `ATTACH` question below. Split the seeding logic into a
`database.web.ts` so the native path at `database.ts:47` is left completely untouched.

Also worth checking during the spike: whether the curriculum OTA flow
(`src/data/curriculum/curriculumUpdate.ts`) needs an explicit no-op on web, since deploys replace
the bundle instead — see [B4](#b4--explicitly-out-of-scope).

**3. ~~The `ATTACH` is the real unknown~~ — resolved 2026-08-06: it works, unchanged.** Confirmed by
executing real SQLite + the vendored VFS against the real `curriculum.db`; cross-database JOINs
returned correct rows. `database.ts:117` needs no change. Peak OPFS pool usage is 3 of 6 slots. Full
evidence and caveats in [web-sqlite-attach-findings.md](./web-sqlite-attach-findings.md).

> **Updated 2026-11-04:** the sync bridge has **three** bugs, not one: (a) the length truncation
> below; (b) `invokeWorkerSync` gives up after 1,000,000 `Atomics.pause()` spins (milliseconds), so
> ordinary writes fail with `Sync operation timeout`; (c) the result buffer is a fixed 1 MB, smaller
> than a full backup-export read. **Decided:** all three are fixed in one `patch-package` patch
> (`mobile/patches/expo-sqlite+55.0.17.patch`), re-checked on every `expo-sqlite` bump.

**4. The actual blocker is a bug in `expo-sqlite`'s web sync bridge.** `web/WorkerChannel.ts:43`
writes the result length as `resultArray.set(new Uint32Array([length]), 0)` — a `Uint32Array` into a
`Uint8Array` target, which truncates element-wise to `length & 0xFF`. Any synchronous result of 256
bytes or more comes back with a corrupt length and fails as `SyntaxError: Unterminated string in
JSON`.

Our data layer is **70 synchronous SQLite calls across 35 files, and zero async calls** — so on web
essentially every query above trivial size hits this. Present in 55.0.17, 56.0.0 and 57.0.1;
upstream fix [expo/expo#44148](https://github.com/expo/expo/pull/44148) has been open since March
2026, unmerged. **There is no expo-sqlite version where this app works on web as written.**

### B2 — Native modules that need a web story

Blast radius is small and well contained:

| Module | Files | Web plan |
| --- | --- | --- |
| `react-native-executorch` (+ resource fetcher) | 4 (`src/data/ai/voice/*`) | No web support. Hide push-to-talk on web. |
| `expo-secure-store` | 2 (`credentialStore.ts`, `byokCredentialStore.ts`) | No web implementation. Either hide BYOK on web, or store the key in memory for the session only and say so plainly. **Do not** silently fall back to `localStorage`. |
| `react-native-audio-api` | 1 (`audioSession.ts`) | Follows the voice decision. |
| `expo-notifications` | 1 (`src/config/notifications.ts`) | Daily reminders need Web Push + VAPID. Cut for v1; hide the setting. |
| `expo-updates` | 1 (`safe-updates-metadata.ts`) | No-op on web; deploys replace the bundle. |
| `expo-file-system` | 3 | Used by curriculum OTA and Anki import. Needs a web branch or feature-gating. |

`app.json` already has `web.output: "static"` and a favicon, so config groundwork is done.

### B3 — Steps

**Gate the whole thing on B3.1.** If the dual-DB spike fails, stop and reconsider before spending
more.

| # | Step | Verify |
| --- | --- | --- |
| B3.1 | ~~Dual-DB spike~~ — **done 2026-08-06, ATTACH works.** See [web-sqlite-attach-findings.md](./web-sqlite-attach-findings.md). Remaining sub-task: re-confirm in a real browser (the proof used a Node OPFS shim, not browser OPFS) on Chrome **and** Safari. | Cross-database JOIN returns correct rows in both browsers. |
| B3.1b | **Fix the `WorkerChannel` truncation bug — now the gating item.** Either `patch-package` the one-line fix from [expo/expo#44148](https://github.com/expo/expo/pull/44148), or migrate the data layer to the async API. Decide before any UI work; see [B5](#b5--the-sync-bridge-decision). | A query returning >256 bytes round-trips intact on web. |
| B3.1c | Guard OPFS pool capacity (6 slots; measured peak 3). The failure mode is a thrown `SQLITE_CANTOPEN(14)` while the actionable `'cannot create file'` text only reaches `console.error` — so surface a typed `AppError` rather than letting the raw throw escape. | Simulated pool exhaustion produces a readable error, not a crash. |
| B3.2 | Cloudflare Pages project + `_headers` with COOP/COEP; build command emits `mobile/dist/`. | `crossOriginIsolated === true` in the deployed page's console. |
| B3.3 | Platform-split `src/data/database.ts` seeding (`.web.ts`) per B3.1's outcome. Keep the native path untouched. | Native tests unchanged and green; web app boots to Home with real curriculum data. |
| B3.4 | Feature-gate the B2 modules behind an explicit capability check. Hide unsupported surfaces rather than degrading them silently. | Web build compiles; Talk/voice/notification surfaces are absent or show a plain "not available on web" state. |
| B3.5 | Walk every screen on web. Expect breakage in gesture/reanimated interactions, the review input, and swipe navigation in lessons. | Full lesson → review → browse loop completes in Chrome and Safari. |
| B3.6 | **Superseded by the [web app design](../superpowers/specs/2026-11-04-web-app-accounts-sync-design.md): no service worker, offline shell, or install prompt in Part 1. `navigator.storage.persist()` is kept.** PWA: manifest, icons, offline service worker for the app shell + curriculum, `navigator.storage.persist()` on first run, and an install prompt. Surface persistence status honestly in Settings. | Lighthouse PWA pass. Installs on Chrome desktop and iOS Safari. Works offline after first load. Denied persistence is shown to the user, not hidden. |
| B3.7 | Wire Part A's export/import into the web build and show the backup nudge more assertively there. | Export downloads a file; restore accepts a file exported from mobile (cross-platform round trip). |

### B5 — The sync-bridge decision

> **Decided 2026-11-04: `patch-package`** (all three bugs; see B1 point 4). The async-API migration stays a later option.

The truncation bug in [B1](#b1--verified-constraints-checked-in-node_modules-not-assumed) forces a
choice. Settle it before B3.3.

| Option | Effort | Risk |
| --- | --- | --- |
| **`patch-package` the upstream one-liner** | Hours | Carries a local patch until #44148 merges; re-verify on every expo bump. Native path untouched. |
| **Migrate the data layer to the async API** | Days — 70 callsites in 35 files | Bigger diff, touches native too, but removes the dependency on an unmerged PR. Also the direction Expo pushes for web. |

Leaning **patch first, migrate later** — it unblocks the web spike immediately at near-zero risk to
mobile, and the migration can happen on its own schedule rather than as a prerequisite. Note that
`SharedArrayBuffer`/COOP-COEP is required by the *sync* bridge specifically, so a full async
migration would also relax the hosting constraint.

### B4 — Explicitly out of scope

- Electron/Tauri desktop packaging. An installed PWA covers the keyboard use case; revisit only on
  real user demand.
- Web Push notifications.
- On-device voice on web.
- Curriculum OTA on web (a deploy replaces the bundle instead). **Replaced:** the [web app design (2026-11-04)](../superpowers/specs/2026-11-04-web-app-accounts-sync-design.md) adds curriculum updates from R2 (Part 4).

---

## Open questions

1. ~~**Host**~~ — **Decided 2026-08-06: Cloudflare Pages.** See [B1](#b1--verified-constraints-checked-in-node_modules-not-assumed).
2. ~~**BYOK on web**~~ — **Decided 2026-08-07: hide Talk on web for v1.** Avoids both the missing
   `expo-secure-store` web implementation and the CORS problem on provider calls, and keeps the key
   out of page-readable storage. The tab is absent on web rather than present-but-broken. Point
   users at the mobile app for conversation practice.
3. ~~**Backup file extension**~~ — **Decided 2026-08-07: `.json.gz`.** Transparent and inspectable,
   consistent with the open-source, no-accounts posture. No custom file-association work. A branded
   `.pakapaka` wrapper can be added later without changing the format if deep-link-to-restore becomes
   worth it.
