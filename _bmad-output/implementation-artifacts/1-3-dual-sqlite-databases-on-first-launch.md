# Story 1.3: Dual SQLite databases on first launch

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a **learner**,
I want **separate curriculum and user databases opened on launch**,
So that **curriculum can be replaced later without touching my progress (FR46, NFR10)**.

## Acceptance Criteria

1. **First launch — dual DB initialization**

   **Given** the app is launched for the first time  
   **When** the database provider initializes  
   **Then** `curriculum.db` is opened from the bundled asset path using expo-sqlite’s `assetSource` / `importDatabaseFromAssetAsync` pattern (read-only **usage** from the app: no writes to curriculum in this story)  
   **And** `user.db` is created in the app SQLite directory if missing, with schema applied via the migration runner  
   **And** only minimal `user.db` tables exist for this epic: `schema_migrations` (version tracking) and `user_preferences` (key/value store) — **no** `srs_states`, `weakness_stats`, `streaks`, `cognitive_load`, `personal_mnemonics`, or `import_metadata` tables yet ([Source: epics.md Story 1.3; implementation-readiness-report])

2. **Subsequent launches — stability**

   **Given** a subsequent app start after first launch  
   **When** initialization runs  
   **Then** both databases open without error  
   **And** existing `user_preferences` rows are preserved  
   **And** no user tables are dropped, truncated, or recreated as part of curriculum-only code paths (curriculum import/swap is Story 1.6 — this story only establishes open + migrate user DB)

3. **Architecture boundaries**

   **Given** the three-layer architecture (`core/` → `data/` → UI)  
   **When** database code is added  
   **Then** all SQLite open/migrate/ATTACH logic lives under `mobile/src/data/` and `mobile/src/providers/` only  
   **And** `core/` has zero `expo-sqlite` imports  
   **And** `DatabaseProvider` wraps the app in `mobile/src/app/_layout.tsx` and exposes handles via `DatabaseContext` ([Source: architecture.md — Layer boundaries, DatabaseContext])

4. **Developer verification**

   **Given** implementation is complete  
   **When** CI runs in `mobile/`  
   **Then** `npm run lint`, `npm run typecheck`, and `npm test` pass  
   **And** unit tests cover: migration runner applies `001_initial` on empty DB; second init is idempotent; curriculum asset import path is invoked (mocked)

## Tasks / Subtasks

- [x] **AC1 — Install `expo-sqlite`**
  - [x] Add `expo-sqlite` at SDK 55 compatible version (`npx expo install expo-sqlite`).
  - [x] Do **not** add `op-sqlite` unless benchmarking later proves need (architecture fallback only).

- [x] **AC1 — Minimal bundled `curriculum.db` stub**
  - [x] Create `mobile/assets/curriculum-seed/curriculum.db` (committed binary) with **only** tables needed to prove open + future swap contract:
    - `curriculum_metadata` (`version` TEXT PRIMARY KEY, `build_date` TEXT NOT NULL, `content_hash` TEXT NULL)
    - One seed row: `version = '0.0.0-stub'`, `build_date` = ISO UTC at creation
  - [x] Document in file header comment or `mobile/assets/curriculum-seed/README.md` that Story **1.5** replaces this with CI-compiled N5 seed — **do not** duplicate full curriculum schema here.
  - [x] `require()` the asset from data layer (Metro bundles .db when required).

- [x] **AC1 — `user.db` migration `001_initial`**
  - [x] `mobile/src/data/migrations/migrations.types.ts` — `Migration` type (`version: number`, `name: string`, `up: (db) => void`).
  - [x] `mobile/src/data/migrations/001_initial.ts` — creates:
    - `schema_migrations` (`version INTEGER PRIMARY KEY`, `applied_at TEXT NOT NULL`)
    - `user_preferences` (`key TEXT PRIMARY KEY`, `value TEXT NOT NULL`, `updated_at TEXT NOT NULL`)
  - [x] `mobile/src/data/migrations/migrationRunner.ts` — read max version, run pending `up` in transactions, insert migration row; idempotent on re-run.

- [x] **AC1 — Database initialization module**
  - [x] `mobile/src/types/result.types.ts` — `Result<T, E>`, `AppError` per architecture (if not already present).
  - [x] `mobile/src/data/database.ts` — `initializeDatabases(): Promise<Result<DatabaseHandles, AppError>>`:
    - Import bundled curriculum via expo-sqlite asset import → open `curriculum.db` connection
    - Open/create `user.db`, run `migrationRunner`
    - Return `{ curriculumDb, userDb }` typed handles
  - [x] Export `DatabaseHandles` type; **do not** expose raw DB to components — context only.

- [x] **AC3 — Provider + context**
  - [x] `mobile/src/providers/DatabaseProvider.tsx` — loading / error / ready states; call `initializeDatabases` once on mount.
  - [x] `mobile/src/providers/DatabaseContext.tsx` (or co-located) — context value: `{ curriculumDb, userDb, isReady, error }`.
  - [x] `mobile/src/data/hooks/useDatabase.ts` — consumer hook with guard if not ready.
  - [x] Wrap children in `mobile/src/app/_layout.tsx` **inside** existing `ThemeProvider` tree (after `global.css` import, before tabs).

- [x] **AC2 — Curriculum/user isolation guard**
  - [x] In `database.ts`, add a short comment + **no** shared migration path between DB files.
  - [x] Ensure curriculum open path never runs `DROP`/`DELETE` on user DB (separate functions/files).

- [x] **AC4 — Tests**
  - [x] `mobile/__mocks__/expo-sqlite.ts` — in-memory or jest mock implementing `openDatabaseAsync`, `execAsync`, `runSync`, `getAllSync`, `withTransactionSync`, `importDatabaseFromAssetAsync`.
  - [x] `mobile/src/data/migrations/migrationRunner.test.ts` — fresh DB gets version 1; re-run does not duplicate migrations.
  - [x] `mobile/src/data/database.test.ts` — mocked import + user migration success path.

- [x] **AC4 — Manual smoke**
  - [x] Android: cold start twice; confirm no redbox; optional dev-only log of `curriculum_metadata.version` and `schema_migrations` count.

## Dev Notes

### Epic context (Epic 1)

Epic 1 delivers the installable shell. **Stories 1.1–1.2** established Expo SDK 55, CI, OTA hooks, and NativeWind tokens. **This story (1.3)** is the data foundation: dual SQLite files with strict separation so Story **1.6** can atomically swap `curriculum.db` without touching `user.db`.

**Out of scope for 1.3 (do not implement):**

| Story | Scope |
| --- | --- |
| 1.4 | Five-tab shell, orientation lock |
| 1.5 | JSON→SQLite compile, Git LFS, real N5 seed content |
| 1.6 | Curriculum version check, download, atomic swap |
| 2.x+ | SRS tables, preferences UI, repositories beyond minimal read/write |

### Technical requirements (must follow)

- **Monorepo path:** All code under **`mobile/`** (same as Stories 1.1–1.2).
- **Dual DB contract ([Source: architecture.md — Data Architecture]):**
  - `curriculum.db` — shipped/bundled; app treats as **read-only** (no INSERT/UPDATE/DELETE in app code this story).
  - `user.db` — sandbox read-write; **never** deleted or replaced on curriculum operations.
- **Cross-DB joins:** Architecture uses `ATTACH DATABASE … AS curriculum` in `data/` only. **Optional in 1.3:** add a `attachCurriculumForQuery(userDb)` helper stub or defer to Story 1.5 when repositories need joins — if deferred, document in `database.ts` TODO with story reference.
- **Result type:** `data/` catches SQLite errors and returns `Result` — never throw to UI ([Source: architecture.md — Error Handling, Enforcement #4]).
- **Transactions:** Migration runner and any multi-statement user writes use `withTransactionSync` ([Source: architecture.md — SQLite Transaction Pattern]).
- **Naming:** DB columns `snake_case`; TS types `camelCase` ([Source: architecture.md — Format Patterns]).
- **Exports:** Named exports for new modules; Expo Router `_layout.tsx` may keep `default` export ([Source: Story 1.2 dev notes]).

### Architecture compliance

| Requirement | Implementation |
| --- | --- |
| `DatabaseContext` app-wide | `DatabaseProvider` in root `_layout.tsx` |
| `data/database.ts` | Init, open/close, future ATTACH |
| `data/migrations/001_initial.ts` | Minimal user schema only |
| `providers/DatabaseProvider.tsx` | Init on launch, loading gate |
| Bundled seed path | `assets/curriculum-seed/curriculum.db` |
| `core/` purity | No sqlite imports in `core/` |

**Physical path note:** Architecture diagram shows repo-root `assets/curriculum-seed/`; with the app in `mobile/`, use **`mobile/assets/curriculum-seed/curriculum.db`** (same pattern as `mobile/assets/images/`).

### Library / framework requirements

| Package | Version guidance | Notes |
| --- | --- | --- |
| `expo-sqlite` | SDK 55 bundled (`~55.x`) | `npx expo install expo-sqlite` |
| `expo` / `react-native` | Pinned in Story 1.1 | Do not change SDK |
| `expo-file-system` | Not required in 1.3 | Story 1.6 curriculum swap |

**expo-sqlite patterns (SDK 55):**

- Bundled DB: `importDatabaseFromAssetAsync` via `assetSource: { assetId: require('@/.../curriculum.db') }` then `openDatabaseAsync('curriculum.db')` ([Expo SQLite — import existing database](https://docs.expo.dev/versions/latest/sdk/sqlite/)).
- User DB: `openDatabaseAsync('user.db')` in default SQLite directory.
- Sync API (`runSync`, `getAllSync`, `withTransactionSync`) is acceptable in migration/init (cold path), matching architecture examples.
- **Expo Go caveat:** If stub `curriculum.db` is updated during dev, use `forceOverwrite: true` on `assetSource` temporarily or rename DB file — stale copies cause “no such table” ([Stack Overflow #79082098](https://stackoverflow.com/questions/79082098/expo-sqlite-using-assetsource-cannot-read-existing-tables)).

### File structure requirements

| Path | Action |
| --- | --- |
| `mobile/package.json` | Add `expo-sqlite` |
| `mobile/assets/curriculum-seed/curriculum.db` | Create minimal stub |
| `mobile/assets/curriculum-seed/README.md` | Optional — stub vs 1.5 real seed |
| `mobile/src/types/result.types.ts` | Create if missing |
| `mobile/src/data/database.ts` | Create — init orchestration |
| `mobile/src/data/database.test.ts` | Create |
| `mobile/src/data/migrations/migrations.types.ts` | Create |
| `mobile/src/data/migrations/001_initial.ts` | Create |
| `mobile/src/data/migrations/migrationRunner.ts` | Create |
| `mobile/src/data/migrations/migrationRunner.test.ts` | Create |
| `mobile/src/data/hooks/useDatabase.ts` | Create |
| `mobile/src/providers/DatabaseProvider.tsx` | Create |
| `mobile/src/app/_layout.tsx` | Wrap with `DatabaseProvider` |
| `mobile/__mocks__/expo-sqlite.ts` | Create for Jest |

**Do not create yet:** `itemRepository.ts`, `srsStateRepository.ts`, `curriculumUpdate.ts`, full `core/` tree — later stories.

### Testing requirements

- **Automated:** Jest unit tests for migration runner + init (mocked sqlite); must pass in CI.
- **Manual:** Two cold starts on Android; verify user preferences survive (insert test row via dev snippet or temporary debug screen — remove debug before review if added).
- **No** requirement for RNTL component tests this story.

### Previous story intelligence (Story 1.2)

- App root is **`mobile/`**; CI: `npm run lint`, `typecheck`, `test` from `mobile/`.
- Root layout: `mobile/src/app/_layout.tsx` imports `@/global.css` once; uses `bg-background` token classes.
- **Jest:** `nativewind/babel` must stay in **presets**, not plugins (Story 1.2 debug note).
- **Android** is maintainer’s primary native platform; iOS documented but not always run locally.
- **Do not** regress `readUpdatesRuntimeMetadata()` in `_layout.tsx`.
- NativeWind / styling unchanged except provider wrapper placement.

### Git intelligence summary

Recent work added NativeWind pipeline (`tailwind.config.js`, `metro.config.js`, `cn.ts`, tokenized layouts). This story is the first **data-layer** change: expect new `src/data/`, `src/providers/`, `__mocks__/expo-sqlite.ts`, and a binary `curriculum.db` in assets.

### Latest technical information

- **expo-sqlite 55.x** ships with SDK 55; default choice per architecture ([architecture.md — SQLite Library Decision]).
- **Read-only curriculum:** Enforce by convention (no write APIs in repositories) this story; SQLite `ATTACH … mode=ro` / `PRAGMA query_only` are optional hardening for later cross-DB work.
- **Stub curriculum:** Real schema lands in Story 1.5; stub must only satisfy “open + metadata row” for 1.3 AC.

### Project context reference

No `project-context.md` in repo — use this story + `_bmad-output/planning-artifacts/architecture.md` + `epics.md`.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.3]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Data Architecture, State Management, Project Structure, Enforcement Guidelines]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR46 local SQLite, NFR10 progress survival]
- [Source: `_bmad-output/planning-artifacts/implementation-readiness-report-2026-05-03.md` — Story 1.3 minimal schema note]
- [Source: `_bmad-output/implementation-artifacts/1-2-nativewind-design-tokens-and-global-styling.md`]
- [Expo SQLite (SDK 55)](https://docs.expo.dev/versions/latest/sdk/sqlite/)

## Dev Agent Record

### Agent Model Used

Composer (Cursor)

### Debug Log References

- Jest `@/assets/*` path required explicit `moduleNameMapper` entry (general `@/` mapping pointed at `src/`).
- Mock `expo-sqlite` needed parameterized `INSERT` handling separate from literal-value parser.

### Completion Notes List

- Installed `expo-sqlite` (~55.x) with Expo config plugin in `app.json`.
- Added bundled stub `curriculum.db` with `curriculum_metadata` row `0.0.0-stub`.
- Implemented user DB migration runner (`001_initial`: `schema_migrations`, `user_preferences`) with transactional, idempotent apply.
- Added `initializeDatabases()` returning `Result<DatabaseHandles, AppError>`; curriculum import via `importDatabaseFromAssetAsync`, user DB migrated separately.
- Wrapped app in `DatabaseProvider` inside `ThemeProvider`; dev-only logs curriculum version and migration count on init.
- Unit tests cover migration runner idempotency and database init (mocked asset import + user migration).
- CI: `npm run lint`, `npm run typecheck`, `npm test` all pass (12 tests).
- Code review: second-init idempotency + `user_preferences` preservation tests; provider closes DB handles on unmount.

### File List

- mobile/app.json
- mobile/package.json
- mobile/package-lock.json
- mobile/assets/curriculum-seed/README.md
- mobile/assets/curriculum-seed/curriculum.db
- mobile/__mocks__/expo-sqlite.ts
- mobile/src/types/result.types.ts
- mobile/src/types/assets.d.ts
- mobile/src/data/database.ts
- mobile/src/data/database.test.ts
- mobile/src/data/migrations/migrations.types.ts
- mobile/src/data/migrations/001_initial.ts
- mobile/src/data/migrations/index.ts
- mobile/src/data/migrations/migrationRunner.ts
- mobile/src/data/migrations/migrationRunner.test.ts
- mobile/src/data/hooks/useDatabase.ts
- mobile/src/providers/DatabaseContext.tsx
- mobile/src/providers/DatabaseProvider.tsx
- mobile/src/app/_layout.tsx
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Senior Developer Review (AI)

**Reviewer:** Riyaz (Composer) · **2026-05-24**

**Outcome:** Approve after fixes

**Findings addressed (4):**

- MEDIUM: Added `initializeDatabases` orchestration tests — second init idempotent; `user_preferences` preserved across re-init
- MEDIUM: `DatabaseProvider` closes curriculum/user handles on unmount (Fast Refresh / remount safety)
- MEDIUM: Documented intentional use of `importDatabaseFromAssetAsync` vs `SQLiteProvider` in `database.ts`
- MEDIUM: Added `sprint-status.yaml` to File List

## Change Log

- **2026-05-24:** Story created via `create-story` workflow — status **ready-for-dev**.
- **2026-05-24:** Implemented dual SQLite init (curriculum + user DB), provider/context, migrations, and tests — status **review**.
- **2026-05-24:** Code review fixes (init tests, provider cleanup, API comment) — status **done**.
