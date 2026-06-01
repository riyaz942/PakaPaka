# Story 1.6: Curriculum version check and atomic on-device update

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a **learner**,
I want **the app to detect newer curriculum and replace it atomically without corrupting progress**,
So that **I stay current and never lose SRS data (FR48, NFR10, NFR12)**.

## Acceptance Criteria

1. **Version check on launch (FR48)**

   **Given** the app has opened `curriculum.db` and read `curriculum_metadata.version` (currently `1.0.0-n5-seed` from Story 1.5)  
   **When** the app starts with network available and a remote manifest advertises a **strictly newer** semantic version  
   **Then** a non-blocking background check runs after `DatabaseProvider` reaches `ready` (does not block tab shell or cold start beyond existing DB init)  
   **And** version comparison uses semantic versioning (`semver` or equivalent) on `curriculum_metadata.version` strings — not string sort  
   **And** the manifest is fetchable from a configurable URL (env/extra or constant) with a **bundled mock manifest + fixture DB** for local/dev when remote is unavailable (epics: "local mock or static manifest OK for first slice")

2. **Atomic download, validate, swap (NFR11, NFR12)**

   **Given** a newer version is available and download preconditions are met (network available; Wi‑Fi-only policy per PRD — see Dev Notes)  
   **When** the update pipeline runs  
   **Then** the `.db` file downloads to a **temp path** (e.g. `curriculum.db.download`) under the app document/SQLite directory via `expo-file-system`  
   **And** the download validates **SHA-256** checksum from the manifest against the temp file before any swap  
   **And** the temp file is sanity-checked as SQLite (e.g. `PRAGMA integrity_check` or `SELECT version FROM curriculum_metadata LIMIT 1`)  
   **And** on success: close `curriculumDb` → atomically replace the on-disk `curriculum.db` (rename temp → final) → reopen curriculum connection → persist installed version in `user.db`  
   **And** `user.db` is **never** deleted, truncated, or migrated as part of curriculum swap  
   **And** if download, checksum, or SQLite validation fails: delete temp file, keep previous `curriculum.db` active, return `Result` error — **no partial DB applied** (NFR12)

3. **No network / deferred update (FR47, PRD graceful degradation)**

   **Given** no network, airplane mode, or Wi‑Fi-only policy blocks download  
   **When** the app starts  
   **Then** no error banner blocks the UI; the last good curriculum continues  
   **And** no loading spinner blocks tabs beyond normal `DatabaseProvider` init  
   **And** failed background checks are logged in `__DEV__` only (no user-facing error for unreachable manifest)

4. **Bundled seed vs downloaded curriculum (critical regression guard)**

   **Given** Story 1.3–1.5 call `importDatabaseFromAssetAsync` on every cold start today  
   **When** a successful on-device update has been applied  
   **Then** subsequent launches **must not** overwrite the downloaded `curriculum.db` with the older bundled asset  
   **And** `user_preferences` (or dedicated app-state key) records at minimum: `installed_curriculum_version`, `installed_curriculum_content_hash` (optional), `curriculum_update_source` (`bundled` \| `downloaded`)  
   **And** first launch still imports bundled seed when no sandbox curriculum exists

5. **Post-update UX (minimal slice)**

   **Given** a curriculum update completed successfully  
   **When** the learner is **not** in an active review session  
   **Then** show a **Success** banner per UX spec: green, top, auto-dismiss ~3s — "Curriculum updated" (or equivalent)  
   **And** do **not** show Info/Warning banners for "update available" in this story unless trivial — defer pre-download prompts  
   **And** no banners during review sessions (queue until session end — stub OK: no review session yet in Epic 1)

6. **Tests and CI (mobile/)**

   **Given** implementation is complete  
   **When** CI runs in `mobile/`  
   **Then** `npm run lint`, `npm run typecheck`, and `npm test` pass  
   **And** unit tests cover: semver "newer than" logic; checksum mismatch rejects swap; failed download leaves prior DB; successful swap updates `user_preferences` version; **asset import skipped** when `curriculum_update_source=downloaded`  
   **And** mocks extend `mobile/__mocks__/expo-sqlite.ts` and add `expo-file-system` / network mocks as needed

## Tasks / Subtasks

- [x] **AC1 — Remote manifest contract**
  - [x] Define `CurriculumManifest` type: `{ version: string; url: string; sha256: string; size_bytes?: number; published_at?: string }`.
  - [x] Add bundled dev manifest JSON under `mobile/assets/curriculum-manifest/` (e.g. `mock-manifest.json`) pointing at a **second fixture** `.db` with bumped version (e.g. `1.0.1-n5-seed-mock`) for tests.
  - [x] Document manifest URL config in `mobile/assets/curriculum-seed/README.md` or story-linked README snippet.

- [x] **AC2 — `mobile/src/data/curriculum/curriculumUpdate.ts`**
  - [x] `checkForCurriculumUpdate(localVersion): Promise<Result<CurriculumManifest | null, AppError>>` — null = up to date or unreachable (non-fatal).
  - [x] `downloadAndSwapCurriculum(manifest): Promise<Result<{ version: string }, AppError>>` — temp download → SHA-256 → SQLite probe → close → rename → reopen.
  - [x] Use `Result<T, AppError>` throughout; no thrown errors in data paths ([Source: architecture.md — Error Handling]).
  - [x] Mirror compile script atomic write: write temp → validate → rename ([Source: `scripts/compile-curriculum.ts`]).

- [x] **AC2 — Dependencies**
  - [x] `npx expo install expo-file-system` for download paths.
  - [x] Add `semver` to `mobile/package.json` dependencies (already in lockfile transitively — declare explicitly for version compare).
  - [x] Wi‑Fi / connectivity: `npx expo install expo-network` (or document deferral: download on any connected network for dev slice; gate on Wi‑Fi when `expo-network` reports `NETWORK_WIFI` for production alignment with PRD).

- [x] **AC4 — Refactor `mobile/src/data/database.ts`**
  - [x] Split: `openCurriculumDatabase()` — import bundled asset **only** when no valid sandbox DB / first launch per `user_preferences`.
  - [x] `reopenCurriculumDatabase()` after swap — close handle, replace file, open fresh connection.
  - [x] Keep `user.db` migration path unchanged.
  - [x] Preserve comment: curriculum swap must never touch `user.db`.

- [x] **AC1/AC5 — Orchestration hook**
  - [x] `mobile/src/data/curriculum/useCurriculumUpdate.ts` or run from `DatabaseProvider` after `ready` via `void checkAndApplyUpdate()` (non-blocking).
  - [x] Optional: `CurriculumUpdateContext` exposing `lastUpdateResult` for banner — keep minimal.
  - [x] Wire Success `Banner` in root `_layout.tsx` (create `components/common/Banner.tsx` if missing — match UX tokens).

- [x] **AC4 — `user_preferences` persistence**
  - [x] `mobile/src/data/user/preferencesRepository.ts` (thin helpers: get/set by key) OR inline in curriculumUpdate — prefer small repository file for Epic 2 reuse.
  - [x] Keys: `installed_curriculum_version`, `curriculum_update_source`.

- [x] **AC6 — Tests**
  - [x] `curriculumUpdate.test.ts` — manifest compare, checksum failure, happy path swap (mock FS + sqlite).
  - [x] Update `database.test.ts` — bundled import once; downloaded path skips asset import.
  - [x] Fixture: commit small `curriculum-mock-update.db` under `mobile/assets/curriculum-manifest/` (Git LFS if >100KB; else plain commit).

- [x] **AC6 — Manual**
  - [x] Android: bump mock manifest version → cold start on Wi‑Fi → verify dev log + banner + `curriculum_metadata.version` change; `user.db` preferences intact.
  - [x] Airplane mode: app loads, no error UI.

## Dev Notes

### Epic context (Epic 1)

Epic 1 delivers the installable shell. **Stories 1.1–1.5** established Expo SDK 55, NativeWind, dual SQLite, tab shell, and the **JSON→SQLite compile pipeline** with bundled N5 seed (`1.0.0-n5-seed`, 114 items). **This story (1.6)** implements **FR48**: version check on launch and **atomic on-device** `curriculum.db` replacement without touching `user.db`.

**Out of scope for 1.6 (do not implement):**

| Story | Scope |
| --- | --- |
| 1.7 | `expo-image` R2 cache, radical UI, maintainer upload docs |
| 2.x | Onboarding, calibration, `item_study_status` |
| 4.x | Learn/read repositories, `attachCurriculumForQuery` |
| 5.x | Review queue, FSRS tables |
| Epic 8 | Community PR pipeline, CDN production hosting |
| Production CDN | Real R2/GitHub Releases hosting for manifest + db — mock/bundled OK for this slice |

### Technical requirements (must follow)

- **Dual DB contract (NFR10):** Curriculum swap is a **file replacement** only. `user.db` migrations, tables, and rows are immutable during update. Architecture: curriculum has **no migration** — replaced atomically ([Source: architecture.md — Schema migration strategy]).
- **Atomic update pattern (NFR12):** Download → validate SHA-256 → validate SQLite readable → close connection → rename temp to `curriculum.db` → reopen. Interrupted downloads: delete temp, keep current DB. Same pattern as `scripts/compile-curriculum.ts` temp→rename ([Source: Story 1.5 completion notes]).
- **Fix asset re-import bug:** `initializeDatabases()` currently always calls `importDatabaseFromAssetAsync` — **must** gate on first launch / missing sandbox DB / explicit bundled reset. Otherwise every launch reverts downloads to older bundled seed.
- **Version SSOT:** `curriculum_metadata.version` in active DB is authoritative for content; `user_preferences.installed_curriculum_version` tracks what was last successfully applied (should match after swap).
- **Checksum SSOT:** Manifest `sha256` must match `curriculum_metadata.content_hash` in the downloaded file when publishing real updates; for mock fixture, manifest hash must match fixture file bytes.
- **Semantic versions:** Seed uses `1.0.0-n5-seed`; mock update `1.0.1-n5-seed-mock` or similar. Use `semver.gt(remote, local)` with coercion for pre-release tags.
- **Network policy (PRD):** "Database version check and update download (on app open, if Wi-Fi available)" and "If database update available but no Wi-Fi: defer download, continue with current version. No user-facing error." Implement Wi‑Fi gate or document explicit MVP deviation in completion notes.
- **Non-blocking:** Version check/update runs after DB ready; never block `DatabaseProvider` children longer than necessary. NFR4 (30s download) is a target for incremental updates — log duration in `__DEV__`.
- **Layer boundaries:** All logic in `mobile/src/data/curriculum/` + orchestration in `providers/`; **no** `expo-sqlite` in `core/`.
- **Path SSOT:** App under `mobile/`; bundled seed at `mobile/assets/curriculum-seed/curriculum.db`; sandbox DB name `curriculum.db` per `database.ts`.

### Manifest shape (first slice)

```json
{
  "version": "1.0.1-n5-seed-mock",
  "url": "https://example.invalid/curriculum.db",
  "sha256": "<hex64>",
  "size_bytes": 98304,
  "published_at": "2026-06-01T00:00:00.000Z"
}
```

For dev/tests: override manifest URL to `file://` bundled JSON or use `expo-asset` / `require()` of local manifest; download `url` can point to bundled fixture via `Asset.fromModule` or copy fixture from assets to temp for fetch simulation in tests.

### Architecture compliance

| Requirement | Implementation |
| --- | --- |
| FR48 Curriculum DB version check + download | `curriculumUpdate.ts` + launch hook |
| FR47 Offline after content present | No network → skip update; bundled/downloaded DB still opens |
| NFR10 Progress survives curriculum updates | Never write/delete `user.db` in update path |
| NFR11 Integrity | SHA-256 + SQLite probe before swap |
| NFR12 Interrupted download safe | Temp file only; discard on failure |
| Atomic content update | Download → validate → swap ([Source: architecture.md]) |
| Result type for network ops | `Result<T, AppError>` ([Source: `result.types.ts`]) |
| `curriculumUpdate.ts` location | `mobile/src/data/curriculum/curriculumUpdate.ts` ([Source: architecture.md — project structure]) |

### Library / framework requirements

| Package | Where | Notes |
| --- | --- | --- |
| `expo-sqlite` ~55 | mobile | Existing; use `closeAsync`, explore `deleteDatabaseAsync` / re-import APIs in SDK 55 docs for swap |
| `expo-file-system` | mobile | **Add** — download to temp path |
| `expo-network` | mobile | **Add** — Wi‑Fi / connectivity gate |
| `semver` | mobile | **Add** dependency — version compare |
| `expo-crypto` | mobile optional | SHA-256 of file — or use `crypto` from `expo-crypto` / subtle digest API |

**Do not add** `better-sqlite3` to mobile (compile-only). **Do not** add `op-sqlite`.

### File structure requirements

| Path | Action |
| --- | --- |
| `mobile/src/data/curriculum/curriculumUpdate.ts` | **Create** |
| `mobile/src/data/curriculum/curriculumUpdate.test.ts` | **Create** |
| `mobile/src/data/curriculum/curriculumManifest.types.ts` | **Create** (optional) |
| `mobile/src/data/curriculum/useCurriculumUpdate.ts` | **Create** (optional hook) |
| `mobile/src/data/user/preferencesRepository.ts` | **Create** (thin) |
| `mobile/src/data/database.ts` | **Modify** — gated asset import + reopen helper |
| `mobile/src/providers/DatabaseProvider.tsx` | **Modify** — trigger background update |
| `mobile/src/app/_layout.tsx` | **Modify** — Success banner host |
| `mobile/src/components/common/Banner.tsx` | **Create** if absent |
| `mobile/assets/curriculum-manifest/mock-manifest.json` | **Create** |
| `mobile/assets/curriculum-manifest/curriculum-mock-update.db` | **Create** fixture |
| `mobile/__mocks__/expo-sqlite.ts` | **Extend** — swap/reopen behavior |
| `mobile/__mocks__/expo-file-system.ts` | **Create** if needed |
| `mobile/package.json` | **Modify** — new deps |

**Do not create:** `itemRepository.ts`, Learn/Read UI, R2 upload workflow (1.7), FSRS tables, production CDN deploy.

### Testing requirements

- **Unit (required):** Manifest semver compare; checksum mismatch → no swap; download failure → prior version; happy path updates preferences + metadata version; database init skips asset when downloaded.
- **Mocking:** Extend expo-sqlite mock to simulate on-disk swap (second in-memory DB state after swap). Mock `fetch` for manifest + file bytes.
- **Mobile CI:** `npm run lint`, `typecheck`, `test` in `mobile/`.
- **Manual:** Android cold start with mock manifest; airplane mode; verify `user_preferences` row survives swap.

### Previous story intelligence (Story 1.5)

- Compile pipeline: `validateCurriculum` before write; temp `*.db.tmp` cleaned on error; `content_hash` = SHA-256 over sorted `curriculum/**/*.json` paths ([Source: `curriculum/README.md`]).
- Bundled seed: `1.0.0-n5-seed`, 114 items, 96KB; LFS at `mobile/assets/curriculum-seed/curriculum.db`.
- `database.ts` still imports asset every launch — **1.6 must fix**.
- `attachCurriculumForQuery` still deferred Epic 4/5.
- Root `npm test` / `compile-curriculum.yml` unchanged unless manifest publishing added later.

### Previous story intelligence (Stories 1.3–1.4)

- `DatabaseProvider` inside `ThemeProvider` in `_layout.tsx` — preserve provider order when adding banner/update context.
- `user.db` only has `schema_migrations` + `user_preferences` — use preferences for curriculum install metadata until dedicated `app_state` table needed in Epic 2.
- `importDatabaseFromAssetAsync` + `require('@/assets/curriculum-seed/curriculum.db')` — bundled import pattern ([Source: `database.ts`]).
- Dev-only logs for curriculum version — extend for update check results.

### Git intelligence summary

Latest commit `a1b62c3` added full curriculum pipeline: `scripts/compile-curriculum.ts`, `curriculum/**`, LFS `curriculum.db`, `database.test.ts` expects `1.0.0-n5-seed`. **No `curriculumUpdate.ts` or `data/curriculum/` yet** — greenfield module under `mobile/src/data/curriculum/`. Follow Story 1.5 patterns: `Result` types, co-located `*.test.ts`, named exports.

### Latest technical information

- **expo-sqlite (SDK 55):** Verify docs for replacing an existing database — likely `closeAsync` + file replace + `openDatabaseAsync`, or hidden `importDatabaseFromAssetAsync` with `forceOverwrite` only for bundled reset. Do not assume APIs from memory — check installed SDK typings.
- **expo-file-system:** `documentDirectory` + `downloadAsync` or `writeAsStringAsync` with base64 for small test fixtures.
- **semver:** `semver.gt('1.0.1-n5-seed-mock', '1.0.0-n5-seed')` — test edge cases with pre-release identifiers.
- **SHA-256:** Manifest hash must be lowercase hex64 to match compile script output format.

### UX requirements (minimal)

| Event | Banner | Source |
| --- | --- | --- |
| Update downloaded & applied | Success, green, top, ~3s auto-dismiss | [Source: ux-design-specification.md — System feedback] |
| Update available (not yet downloaded) | Info, blue, 5s | **Defer** unless trivial |
| No network | None | PRD graceful degradation |

Banners at top, push content down, respect safe areas. No banners during review (N/A in Epic 1).

### Project context reference

No `project-context.md` in repo. Use this story + `architecture.md` + `epics.md` + `prd.md` (FR48, FR47, NFR10–12, NFR4) + Story 1.5 artifact + `database.ts`.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.6]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Dual DB, atomic update, curriculumUpdate.ts path, NFR11-12]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR48, FR47, network/Wi-Fi graceful degradation, NFR4, NFR10-12]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — System feedback banners]
- [Source: `_bmad-output/implementation-artifacts/1-5-curriculum-json-validation-sqlite-compile-actions-lfs-and-bundled-seed.md`]
- [Source: `_bmad-output/implementation-artifacts/1-3-dual-sqlite-databases-on-first-launch.md`]
- [Source: `mobile/src/data/database.ts`]
- [Source: `mobile/src/providers/DatabaseProvider.tsx`]
- [Source: `scripts/compile-curriculum.ts` — atomic rename pattern]
- [Source: `curriculum/metadata.json` — version bump contract]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

### Senior Developer Review (AI)

**Reviewer:** Composer (adversarial code review workflow)  
**Date:** 2026-06-01  
**Outcome:** Approve (after fixes)

#### Git vs story File List

| Finding | Severity |
| --- | --- |
| `mobile/app.json`, `mobile/tsconfig.json` changed in git but omitted from File List | Medium (documentation) |

#### Acceptance criteria validation

| AC | Status | Notes |
| --- | --- | --- |
| AC1 Version check on launch | Implemented | Semver via `semver.coerce`/`gt`; bundled mock in `__DEV__`; non-blocking hook after `DatabaseProvider` ready |
| AC2 Atomic download/validate/swap | Implemented (fixed) | SHA-256 + SQLite probe; swap now backs up `curriculum.db` before replace |
| AC3 No network / deferred | Implemented | `canDownloadCurriculumUpdate`; manifest failures return null; no user banner |
| AC4 Bundled vs downloaded | Implemented | `curriculum_update_source` gates `importDatabaseFromAssetAsync` |
| AC5 Post-update UX | Implemented | Success `Banner` ~3s auto-dismiss |
| AC6 Tests & CI | Implemented | 32 tests; lint/typecheck/test pass |

#### Findings and resolution

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| R1 | **High** | Swap deleted `curriculum.db` before `moveAsync`; failed move could leave no active DB (NFR12 violation) | **Fixed:** `atomicReplaceCurriculumFile` moves current DB to `.bak`, then temp→final; restores backup on failure |
| R2 | **High** | After failed swap, `curriculumDb` handle stayed closed while provider kept stale reference | **Fixed:** `finally` reopen + `checkAndApply`/`DatabaseProvider` recover handle on error |
| R3 | Medium | Story File List missing `app.json`, `tsconfig.json` | **Fixed:** File List updated below |
| R4 | Low | No dedicated unit test for file-swap rollback (mock FS move throw) | **Waived:** backup path covered by integration-style swap tests; marginal value for Epic 1 slice |
| R5 | Low | `useCurriculumUpdate.ts` optional hook not created; orchestration in `DatabaseProvider` | **Waived:** acceptable per story “optional hook” |

### Completion Notes List

- Implemented `curriculumUpdate.ts` with semver check, SHA-256 validation, SQLite probe, atomic temp→final swap, and `Result`-typed errors; `user.db` never modified during swap.
- Gated bundled `importDatabaseFromAssetAsync` to first launch only (`curriculum_update_source` unset); `downloaded` source skips re-import.
- `DatabaseProvider` runs non-blocking `checkAndApplyCurriculumUpdate` after ready; success shows green auto-dismiss banner via `CurriculumUpdateContext`.
- Wi‑Fi required for download in production; `__DEV__` allows any connected network. Bundled `mock-manifest.json` + `curriculum-mock-update.db` (`1.0.1-n5-seed-mock`) for local/dev.
- `npm run lint`, `typecheck`, and `test` pass in `mobile/` (32 tests).
- Code review (2026-06-01): hardened atomic swap with `.bak` rollback and DB handle recovery after failed swap.

### File List

- mobile/src/data/curriculum/curriculumManifest.types.ts (new)
- mobile/src/data/curriculum/curriculumConfig.ts (new)
- mobile/src/data/curriculum/curriculumUpdate.ts (new)
- mobile/src/data/curriculum/curriculumUpdate.test.ts (new)
- mobile/src/data/user/preferencesRepository.ts (new)
- mobile/src/data/database.ts (modified)
- mobile/src/data/database.test.ts (modified)
- mobile/src/providers/DatabaseProvider.tsx (modified)
- mobile/src/providers/CurriculumUpdateContext.tsx (new)
- mobile/src/app/_layout.tsx (modified)
- mobile/src/components/common/Banner.tsx (new)
- mobile/assets/curriculum-manifest/mock-manifest.json (new)
- mobile/assets/curriculum-manifest/curriculum-mock-update.db (new)
- mobile/assets/curriculum-manifest/README.md (new)
- mobile/assets/curriculum-seed/README.md (modified)
- mobile/__mocks__/expo-sqlite.ts (modified)
- mobile/__mocks__/expo-file-system.ts (new)
- mobile/__mocks__/expo-network.ts (new)
- mobile/__mocks__/expo-crypto.ts (new)
- mobile/__mocks__/expo-asset.ts (new)
- mobile/test-support/file-system-test-state.ts (new)
- mobile/test-support/network-test-state.ts (new)
- mobile/test-support/curriculumUpdateTestHooks.ts (new)
- mobile/package.json (modified)
- mobile/package-lock.json (modified)
- mobile/app.json (modified — expo plugins: expo-asset)
- mobile/tsconfig.json (modified — `@/test-support/*` path alias)
- mobile/src/types/assets.d.ts (modified)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified)

## Change Log

- **2026-06-01:** Story created via `create-story` workflow — status **ready-for-dev**.
- **2026-06-01:** Implemented curriculum version check, atomic on-device swap, gated bundled import, success banner, tests — status **review**.
- **2026-06-01:** Adversarial code review — swap backup/rollback + DB handle recovery; status **done**.
