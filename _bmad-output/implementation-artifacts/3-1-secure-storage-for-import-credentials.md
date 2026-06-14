# Story 3.1: Secure storage for import credentials

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a **switcher**,
I want **API keys held in secure storage only for the import session**,
So that **my credentials are not leaked (NFR6, NFR7)**.

## Acceptance Criteria

1. **`expo-secure-store` installed and SDK-aligned**

   **Given** the `mobile/` Expo SDK 55 project
   **When** the dependency is added
   **Then** it is installed via `npx expo install expo-secure-store` (resolves to `~55.0.x`) and appears in `mobile/package.json` `dependencies`
   **And** `npm run typecheck` and `npm test` still pass after install (no native rebuild required for Jest)

2. **Typed secure credential store wraps `expo-secure-store` (data layer only)**

   **Given** the architecture rule "Secure storage — API keys only. Accessed only from `data/user/` during import"
   **When** the credential store module is created at `mobile/src/data/user/credentialStore.ts`
   **Then** it exposes an async API keyed by import source (`'wanikani' | 'bunpro'`):
   - `saveImportCredential(source, apiKey): Promise<Result<void>>`
   - `getImportCredential(source): Promise<Result<string | null>>`
   - `hasImportCredential(source): Promise<Result<boolean>>`
   - `discardImportCredential(source): Promise<Result<void>>`
   - `discardAllImportCredentials(): Promise<Result<void>>`
   **And** every function returns the existing `Result<T, AppError>` type (`@/types/result.types`) — it never throws in the data path
   **And** values are written with `SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY })` (device-only, not synced to backups)
   **And** secure-store keys are sourced from a single `IMPORT_CREDENTIAL_KEYS` map containing only allowed characters (alphanumeric, `.`, `-`, `_`)

3. **Stored only in secure store — never in plaintext or analytics (NFR6, NFR7)**

   **Given** a pasted API key
   **When** it is saved
   **Then** the value is persisted **only** via `expo-secure-store` (iOS Keychain / Android Keystore) — it is **never** written to `user.db`, `user_preferences`, `AsyncStorage`, logs, or any plaintext file
   **And** the credential value is **never** passed to `console.log/warn/error` or any analytics call anywhere in the module
   **And** on a `SecureStore` failure, the returned `AppError` message/`cause` does **not** embed the credential value (only `source` and a generic message)
   **And** empty/whitespace-only keys are rejected before any write with `AppError.code = 'invalid_credential'` (the key is trimmed before storage)

4. **Discard after successful import (FR33d/FR33e support)**

   **Given** a credential previously saved for a source
   **When** `discardImportCredential(source)` is called
   **Then** `SecureStore.deleteItemAsync(key)` runs and a subsequent `getImportCredential(source)` resolves to `{ ok: true, value: null }`
   **And** `discardAllImportCredentials()` clears both WaniKani and Bunpro keys (safe to call when none exist — deleting a missing key is not an error)
   **And** discarding a non-existent credential resolves `{ ok: true }` (idempotent)

5. **Jest mock + module mapping for `expo-secure-store`**

   **Given** unit tests must run without native modules (matches existing `__mocks__` pattern)
   **When** the mock is added at `mobile/__mocks__/expo-secure-store.ts`
   **Then** it provides in-memory `setItemAsync` / `getItemAsync` / `deleteItemAsync`, the `WHEN_UNLOCKED_THIS_DEVICE_ONLY` constant, and a `__mockResetSecureStore()` reset helper (model after `__mocks__/expo-crypto.ts` self-contained style)
   **And** `mobile/package.json` `jest.moduleNameMapper` adds `"^expo-secure-store$": "<rootDir>/__mocks__/expo-secure-store.ts"`

6. **Tests and CI**

   **Given** implementation is complete
   **When** CI runs in `mobile/`
   **Then** `npm run lint`, `npm run typecheck`, and `npm test` all pass
   **And** `credentialStore.test.ts` covers: save→get round-trip per source; `getImportCredential` returns `null` when unset; `hasImportCredential` true/false; `discardImportCredential` removes the value; `discardAllImportCredentials` clears both sources and is safe when empty; empty/whitespace key rejected with `invalid_credential`; key is trimmed; a `console`-spy assertion proving the raw value is never logged; sources are isolated (saving WaniKani does not affect Bunpro)
   **And** the mock is reset in `beforeEach` via `__mockResetSecureStore()`

## Tasks / Subtasks

- [x] **AC1 — Install dependency**
  - [x] Run `npx expo install expo-secure-store` in `mobile/` (do not hand-edit the version — let Expo pick the SDK 55 build).
  - [x] Confirm it lands in `dependencies` (not `devDependencies`).

- [x] **AC2 + AC3 + AC4 — Credential store module**
  - [x] Create `mobile/src/data/user/importCredential.types.ts`: `ImportCredentialSource = 'wanikani' | 'bunpro'`, `IMPORT_CREDENTIAL_KEYS` map (`{ wanikani: 'import_credential_wanikani', bunpro: 'import_credential_bunpro' }`), and `isImportCredentialSource(value): value is ImportCredentialSource` guard.
  - [x] Create `mobile/src/data/user/credentialStore.ts` with the five `Result`-returning async functions from AC2.
  - [x] Trim the key; reject empty/whitespace with `AppError { code: 'invalid_credential' }` before any secure-store call.
  - [x] Wrap all `SecureStore` calls in try/catch; on failure return `{ ok: false, error: { code: 'secure_store_error', message: 'Secure storage operation failed', userMessage: 'Could not access secure storage.', cause: <error without credential> } }`.
  - [x] Use `{ keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }` on `setItemAsync`.
  - [x] Do **not** import or write to `preferencesRepository` / `user.db` / any file. Never `console.*` the value.

- [x] **AC5 — Jest mock + mapper**
  - [x] Create `mobile/__mocks__/expo-secure-store.ts` (in-memory `Map`, async methods, `WHEN_UNLOCKED_THIS_DEVICE_ONLY` constant, `__mockResetSecureStore`).
  - [x] Add `"^expo-secure-store$": "<rootDir>/__mocks__/expo-secure-store.ts"` to `jest.moduleNameMapper` in `mobile/package.json`.

- [x] **AC6 — Tests**
  - [x] Create `mobile/src/data/user/credentialStore.test.ts` covering every bullet in AC6; reset mock in `beforeEach`.
  - [x] Run `npm run lint`, `npm run typecheck`, `npm test` in `mobile/` until green.

- [x] **Optional enhancement — reusable hook for downstream UI (3.2/3.6)** *(skipped)*
  - [x] Skipped — Story 3.2/3.6 will call `credentialStore` directly (noted in Dev Agent Record).

## Dev Notes

### Epic context (Epic 3 — Trustworthy import)

Epic 3 lets switchers bring existing progress (WaniKani API / Bunpro / Anki file), map foreign items to internal curriculum, convert foreign SRS state to FSRS, and show a transparent mapped-vs-unmatched summary. **This story (3.1) is the security foundation the rest of the epic builds on** — a discardable, secure-only home for the API keys that Stories 3.2 (WaniKani) and 3.3 (Bunpro) will consume.

**This is the first story of Epic 3** (epic moved `backlog → in-progress`). There is **no previous story in this epic** — patterns below are inherited from the Epic 1–2 data layer.

### Scope boundary (read carefully — prevents scope creep)

**In scope (3.1):** the secure credential storage module, its types, the Jest mock + mapper, and tests. This is infrastructure: "API keys held in secure storage only for the import session" + the discard capability.

**Out of scope — do NOT build here:**

| Area | Belongs to |
| --- | --- |
| WaniKani key-entry screen, key validation, API fetch, rate limiting, FSRS mapping | Story 3.2 |
| Bunpro import / fallback UI | Story 3.3 |
| Anki `.apkg` file picker + parsing | Story 3.4 |
| Import summary / unmatched UI (`ImportSummaryCard`) | Story 3.5 |
| Import source selection screen + onboarding routing (replacing the `import.tsx` placeholder) | Story 3.6 |
| `data/user/importRepository.ts` (bulk write of imported items) | Story 3.2+ |

The existing `mobile/src/app/onboarding/import.tsx` is a **placeholder** — leave it as-is. Story 3.6 replaces it. Do not wire a live key-entry UI in this story.

### Technical requirements (must follow)

- **Layer placement:** credential store lives in `data/user/` (architecture: *"Secure storage — API keys only. Accessed only from `data/user/` during import."*). It must **not** be placed in `core/` (core is pure TS, zero RN/Expo imports) or in `components/`. [Source: `architecture.md` — Architectural Boundaries → Data Boundaries; Core Layer rules]
- **Result type contract:** network/IO-ish operations return `Result<T, AppError>` and never throw in the data path. Reuse the existing shape — do not redefine it. [Source: `architecture.md` — Error Handling Patterns; `mobile/src/types/result.types.ts`]

```typescript
// mobile/src/types/result.types.ts (existing — reuse)
export type AppError = { code: string; message: string; userMessage?: string; cause?: unknown };
export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };
```

- **SecureStore API (SDK 55, `expo-secure-store ~55.0.x`):** `setItemAsync(key, value, options)`, `getItemAsync(key, options)`, `deleteItemAsync(key, options)`. Values **must be strings**. Keys may contain only alphanumeric, `.`, `-`, `_` (our `import_credential_wanikani` / `import_credential_bunpro` keys comply). On iOS this is Keychain (`kSecClassGenericPassword`); on Android it is Keystore-encrypted SharedPreferences — exactly the NFR6 "Keychain on iOS, Android Keystore on Android" requirement. [Source: web verify — Expo SDK 55 SecureStore docs]
- **`keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY`** — keeps the credential on this device and out of iCloud/backup restore. Do **not** use `requireAuthentication: true` (biometric) — it has an Expo Go caveat and is unnecessary for a transient import key.
- **NFR6/NFR7 — no leakage:**
  - Never persist the key anywhere except SecureStore. Do not touch `user.db` / `user_preferences` / `preferencesRepository`.
  - Never log the value. No analytics SDK exists in the repo today (confirmed — no Sentry/analytics import in `mobile/src`); do not add one. Existing `console.*` usages are limited to `curriculumUpdate.ts`, `safe-updates-metadata.ts`, `DatabaseProvider.tsx` — none must receive a credential.
  - When mapping a SecureStore error to `AppError`, set a generic `message` and only attach the original error as `cause` (SecureStore errors do not contain the value). Do not interpolate the key into any string.
- **Discardability (FR33d/FR33e, NFR6 "discarded after import completes"):** `discardImportCredential` / `discardAllImportCredentials` are the explicit discard hooks Stories 3.2/3.3 call after a successful import. Deleting a missing key must not error (idempotent).

### Recommended implementation shape

```typescript
// mobile/src/data/user/importCredential.types.ts
export type ImportCredentialSource = 'wanikani' | 'bunpro';

export const IMPORT_CREDENTIAL_KEYS: Record<ImportCredentialSource, string> = {
  wanikani: 'import_credential_wanikani',
  bunpro: 'import_credential_bunpro',
};

export function isImportCredentialSource(value: string): value is ImportCredentialSource {
  return value === 'wanikani' || value === 'bunpro';
}
```

```typescript
// mobile/src/data/user/credentialStore.ts
import * as SecureStore from 'expo-secure-store';

import type { Result } from '@/types/result.types';
import {
  IMPORT_CREDENTIAL_KEYS,
  type ImportCredentialSource,
} from '@/data/user/importCredential.types';

const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

function secureStoreError(cause: unknown): Result<never> {
  return {
    ok: false,
    error: {
      code: 'secure_store_error',
      message: 'Secure storage operation failed',
      userMessage: 'Could not access secure storage. Please try again.',
      cause,
    },
  };
}

export async function saveImportCredential(
  source: ImportCredentialSource,
  apiKey: string,
): Promise<Result<void>> {
  const trimmed = apiKey.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: { code: 'invalid_credential', message: 'API key is empty' } };
  }
  try {
    await SecureStore.setItemAsync(IMPORT_CREDENTIAL_KEYS[source], trimmed, SECURE_OPTIONS);
    return { ok: true, value: undefined };
  } catch (cause) {
    return secureStoreError(cause);
  }
}

export async function getImportCredential(
  source: ImportCredentialSource,
): Promise<Result<string | null>> {
  try {
    const value = await SecureStore.getItemAsync(IMPORT_CREDENTIAL_KEYS[source]);
    return { ok: true, value };
  } catch (cause) {
    return secureStoreError(cause);
  }
}
// hasImportCredential → getImportCredential then map to boolean
// discardImportCredential → deleteItemAsync(IMPORT_CREDENTIAL_KEYS[source])
// discardAllImportCredentials → delete both keys (await all, idempotent)
```

> Note: `SecureStore.SecureStoreOptions` is the exported options type in SDK 55. If TS cannot resolve the named type, type the const as `Parameters<typeof SecureStore.setItemAsync>[2]` instead — do not loosen to `any`.

### Jest mock shape (model after `__mocks__/expo-crypto.ts`)

```typescript
// mobile/__mocks__/expo-secure-store.ts
const store = new Map<string, string>();

export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 'WHEN_UNLOCKED_THIS_DEVICE_ONLY';

export async function setItemAsync(key: string, value: string): Promise<void> {
  store.set(key, value);
}
export async function getItemAsync(key: string): Promise<string | null> {
  return store.has(key) ? (store.get(key) as string) : null;
}
export async function deleteItemAsync(key: string): Promise<void> {
  store.delete(key);
}
export function __mockResetSecureStore(): void {
  store.clear();
}
```

Then add to `mobile/package.json` `jest.moduleNameMapper`: `"^expo-secure-store$": "<rootDir>/__mocks__/expo-secure-store.ts"`. The module is consumed as `import * as SecureStore from 'expo-secure-store'`, so named exports above are correct.

### Testing standards

- **Framework:** Jest with `jest-expo` preset (see `mobile/package.json`). Data-layer modules are tested directly (no RN renderer needed). [Source: `architecture.md` — Testing Strategy: Core/Data logic via Jest]
- **Co-locate** `credentialStore.test.ts` next to the module (pattern: every repo/module has a sibling `*.test.ts`). [Source: existing `preferencesRepository.test.ts`, `itemRepository.test.ts`]
- **Reset mock per test:** `import { __mockResetSecureStore } from '../../../__mocks__/expo-secure-store'` and call in `beforeEach` (mirror how `preferencesRepository.test.ts` imports `__mockResetSqlite`).
- **No-leak assertion:** spy on `console.log/warn/error` (e.g. `jest.spyOn`) across save/get/discard and assert the raw key string never appears in any call arg.
- Async tests `await` each `Result` and assert on `.ok` / `.value` / `.error.code`.

### Project structure (this story)

```
mobile/
├── __mocks__/
│   └── expo-secure-store.ts                 # NEW — Jest mock + __mockResetSecureStore
├── package.json                             # MODIFY — add expo-secure-store dep + jest mapper
└── src/
    └── data/
        ├── user/
        │   ├── importCredential.types.ts    # NEW — source enum + key map + guard
        │   ├── credentialStore.ts           # NEW — secure Result-based API
        │   └── credentialStore.test.ts      # NEW — round-trip, discard, no-leak, isolation
        └── hooks/
            └── useImportCredential.ts        # OPTIONAL — thin hook for 3.2/3.6 UI
```

**Do not modify:** `app/onboarding/import.tsx` (placeholder — 3.6), `preferencesRepository.ts`, `database.ts`, migrations. **No new migration** — credentials never enter `user.db`.

### Architecture compliance

| Requirement | Implementation |
| --- | --- |
| NFR6 platform-appropriate secure storage | `expo-secure-store` → iOS Keychain / Android Keystore |
| NFR6 discardable after import | `discardImportCredential` / `discardAllImportCredentials` |
| NFR7 no app learning data transmitted | Module only stores/reads/deletes a string locally; performs zero network |
| Secure storage boundary | Module lives in `data/user/`; not imported by `core/` |
| Result error handling | All functions return `Result<T, AppError>`, never throw |
| Naming conventions | `camelCase` functions; `snake_case`-safe secure-store keys |
| Reuse over reinvention | Reuse existing `Result`/`AppError`; follow `preferencesRepository` + `__mocks__` patterns |

[Source: `architecture.md` — Authentication & Security; Data Boundaries; Error Handling Patterns; External Integration Points (WaniKani 60 req/min belongs to 3.2, not here)]

### Codebase intelligence (Epic 1–2 patterns to reuse)

- **Data-layer module + co-located test + named-export Jest mock + moduleNameMapper** is the established stack: `expo-sqlite`, `expo-network`, `expo-crypto`, `expo-file-system`, `expo-asset`, `expo-image` are all mocked this way. Add `expo-secure-store` the same way — do not invent a new mocking approach. [Source: `mobile/package.json` jest config; `mobile/__mocks__/*`]
- **`@/` path alias** maps to `mobile/src/` (jest + tsconfig). Use `@/data/user/...`, `@/types/result.types`. [Source: `package.json` moduleNameMapper]
- **Self-contained mock style** (in-memory, plus a `__mockReset*` export) — see `__mocks__/expo-crypto.ts` and the `__mockResetSqlite` usage in `preferencesRepository.test.ts`.
- **`expo install` for Expo modules** — all current `expo-*` deps are `~55.0.x`; never pin a version manually.

### Latest tech notes

- `expo-secure-store ~55.0.x` (SDK 55; latest changelog build `55.0.13`). API: `setItemAsync` / `getItemAsync` / `deleteItemAsync`; values must be strings; keys limited to `[A-Za-z0-9._-]`. `WHEN_UNLOCKED_THIS_DEVICE_ONLY` keeps the secret off backups. [Source: web verify — Expo SecureStore SDK 55 docs + source]
- No native rebuild is needed for Jest (the mock replaces the native module). A dev/device run of the import flow only becomes relevant in Stories 3.2/3.6.

### Lint compliance

`mobile/eslint.config.js` uses `eslint-config-expo/flat` via `npm run lint` (`expo lint`). Keep imports ordered/grouped like sibling data modules; no unused vars; no `any`. (Note: the user rule references a `web/.eslintrc.js` — this repo has no `web/` folder; the active mobile config is `mobile/eslint.config.js`, which governs all code in this story.)

### Project context reference

- No `project-context.md` in repo. SSOT: `architecture.md`, `epics.md`, `ux-design-specification.md`. No prior Epic 3 story exists; Epic 1–2 data-layer modules are the pattern source.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 3, Story 3.1; NFR6, NFR7, NFR9]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Authentication & Security (`expo-secure-store`); Architectural Boundaries → Data Boundaries (secure storage in `data/user/`); Error Handling Patterns (Result type, non-destructive import); Tech stack table (Secure Storage row); Testing Strategy]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — switcher import trust principle #42, anti-pattern: import must feel effortless/trustworthy (UI lands in 3.2/3.6)]
- [Source: `mobile/src/types/result.types.ts` — Result/AppError to reuse]
- [Source: `mobile/src/data/user/preferencesRepository.ts` + `preferencesRepository.test.ts` — data-layer + test + mock-reset pattern]
- [Source: `mobile/__mocks__/expo-crypto.ts`, `mobile/__mocks__/expo-network.ts` — mock style; `mobile/package.json` — jest moduleNameMapper]
- [Source: `mobile/src/app/onboarding/import.tsx` — placeholder to leave untouched]

## Dev Agent Record

### Agent Model Used

Composer (bmad-story-developer subagent)

### Debug Log References

None

### Completion Notes List

- Installed `expo-secure-store ~55.0.14` via `npx expo install`; Expo config plugin added to `mobile/app.json`.
- Added `importCredential.types.ts` and `credentialStore.ts` with five `Result`-returning APIs, trim/empty validation, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, and idempotent discard helpers.
- Added Jest mock + `moduleNameMapper` entry following existing `expo-crypto` / `expo-sqlite` patterns.
- Added 13 unit tests including console-spy no-leak assertion, source isolation, and `secure_store_error` mapping without credential embedding.
- Skipped optional `useImportCredential` hook — Story 3.2/3.6 can import `credentialStore` directly.
- All gates green: lint, typecheck, 121 tests passed.
- Code review auto-fix aligned `secure_store_error.userMessage` to the exact story contract (`Could not access secure storage.`).
- Story tracking synced: File List updated with review-side documentation changes and sprint status moved to `done`.

### File List

- mobile/__mocks__/expo-secure-store.ts (new)
- mobile/app.json (modified — expo-secure-store config plugin)
- mobile/package.json (modified — dependency + jest mapper)
- mobile/package-lock.json (modified)
- mobile/src/data/user/importCredential.types.ts (new)
- mobile/src/data/user/credentialStore.ts (new)
- mobile/src/data/user/credentialStore.test.ts (new)
- _bmad-output/implementation-artifacts/3-1-secure-storage-for-import-credentials.md (new, reviewed/updated)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified — `3-1-secure-storage-for-import-credentials` set to `done`)

### Change Log

- 2026-06-14: Story 3.1 — secure credential storage infrastructure (expo-secure-store, credentialStore module, Jest mock, tests).
- 2026-06-14: Code review auto-fix — aligned secure-store user message and synchronized story/sprint tracking status to done.

## Senior Developer Review (AI)

- Outcome: approve-after-fixes
- Findings: high=0, medium=1, low=0
- Fixed: 1 medium issue
- Notes:
  - Fixed task/contract mismatch in `credentialStore` by aligning `secure_store_error.userMessage` to the story's specified value.
  - Resolved git-vs-story tracking discrepancy by updating this story's File List to include review-updated artifacts.
  - Acceptance criteria and completed tasks were re-validated against implementation and tests; no remaining HIGH/MEDIUM issues.
