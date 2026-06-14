# Story 3.2: WaniKani v2 import with mapping and FSRS conversion

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a **WaniKani user**,
I want **my assignments mapped to internal items with FSRS-equivalent states**,
so that **burned items stay burned and apprentice intervals feel right (FR33d, NFR18)**.

## Acceptance Criteria

1. **WaniKani v2 import executes with rate-limit-safe network behavior and readable failures**

   **Given** a valid WaniKani API key and network  
   **When** import runs  
   **Then** the client respects documented rate limits (queue/retry) and surfaces readable errors for invalid keys or HTTP failures.

2. **Mapped subjects persist with shared mapping + FSRS conversion**

   **Given** imported WaniKani assignments/review state  
   **When** mapping and conversion complete  
   **Then** each mapped subject uses the shared mapping-table approach from architecture, converting WK stages to FSRS fields in `user.db`  
   **And** burned items remain burned while apprentice-stage items receive short-interval FSRS states.

## Tasks / Subtasks

- [x] **AC1 - Build WaniKani import client in data layer**
  - [x] Add a data-layer WaniKani API client (either `mobile/src/data/user/importRepository.ts` or `mobile/src/data/import/wanikaniClient.ts`) that accepts a secure-store credential from Story 3.1.
  - [x] Implement authenticated v2 calls (`Authorization: Bearer <key>`) with paginated fetch support for required resources and explicit handling of HTTP `401`, `403`, `429`, and `5xx`.
  - [x] Respect rate limits using response headers (`RateLimit-Remaining`, `RateLimit-Reset`) and bounded retry/backoff for retryable failures.
  - [x] Return `Result<T, AppError>` on all network paths (no thrown errors in normal data flow).
  - [x] Ensure credential is never logged and is discarded through Story 3.1 APIs after successful import completion.

- [x] **AC2 - Implement mapping and FSRS conversion pipeline**
  - [x] Create `mobile/src/core/import/wanikaniMapper.ts` as a pure transformer from raw WK payloads to internal mapped/unmatched structures.
  - [x] Create `mobile/src/core/import/fsrsConverter.ts` for WK-stage-to-FSRS field conversion logic.
  - [x] Add/define shared import contracts in `mobile/src/core/import/import.types.ts` (mapped item, unmatched item, import summary, conversion inputs/outputs).
  - [x] Use a shared mapping-table strategy (`wk_subject_id` -> internal curriculum `item_id`) and fail transparently (unmatched list) instead of dropping unknown items.
  - [x] Persist mapped FSRS-ready rows via transactional write path in user data layer so partial writes are rolled back on failure (non-destructive import).

- [x] **AC1 + AC2 - Integrate with onboarding import flow without over-scoping**
  - [x] Replace placeholder-only behavior in `mobile/src/app/onboarding/import.tsx` with WaniKani import execution entry points required for this story.
  - [x] Keep summary-heavy UI and detailed mapped/unmatched presentation minimal here; Story 3.5 owns full `ImportSummaryCard` richness.
  - [x] Provide clear user-facing failure text for invalid API key, rate-limit wait, and network unavailable cases.

- [x] **Cross-story dependency handling**
  - [x] Reuse Story 3.1 `credentialStore` functions (`getImportCredential`, `discardImportCredential`) instead of introducing duplicate credential storage logic.
  - [x] Leave Bunpro and Anki-specific logic isolated for Stories 3.3 and 3.4.

- [x] **Tests and quality gates**
  - [x] Add unit tests for `wanikaniMapper` covering: mapped subject, unmatched subject, burned mapping, apprentice mapping, and malformed payload handling.
  - [x] Add unit tests for `fsrsConverter` covering every WK SRS stage used by import.
  - [x] Add data-layer client tests (mocked fetch) for auth errors, 429 behavior, retry behavior, and success pagination.
  - [x] Add integration-style repository tests for transactional write behavior (all-or-nothing).
  - [x] Run `npm run lint`, `npm run typecheck`, and `npm test` in `mobile/`.

## Dev Notes

### Epic context and intended outcome

Epic 3 establishes trustworthy migration from existing tools. Story 3.2 is the first real import pipeline implementation and should produce mapped FSRS state in `user.db` with transparent error handling. This story is the bridge between secure credential infrastructure (3.1) and UX transparency work (3.5/3.6).

### Previous story intelligence (Story 3.1)

- Story 3.1 already delivered secure credential storage in `mobile/src/data/user/credentialStore.ts` with strict `Result` return contracts and no credential leakage.
- Use Story 3.1's established patterns: typed source keys, secure-store error wrapping (`secure_store_error`), and strict no-console-secret posture.
- Existing test infrastructure already mocks `expo-secure-store`; extend test style instead of creating a parallel mocking strategy.
- Recent commit pattern for Epic 3 favors data-layer first, tests included in same change, and strict CI gate completion.

### Architecture compliance (must follow)

- **Layering:** Keep WaniKani API calls and DB writes in `data/`; keep mapping/conversion pure in `core/import/`.
- **Boundary rule:** `core/` must not import from `data/`, React, or React Native.
- **Error contract:** Import paths return `Result<T, AppError>`; no throw-based flow control in data paths.
- **Non-destructive import:** On failure/cancel, no partial imported state remains committed.
- **Secure storage boundary:** API keys are accessed only through `data/user/` credential APIs and discarded after success.

### File structure guidance for this story

Recommended additions/changes for 3.2:

- `mobile/src/core/import/wanikaniMapper.ts` (new)
- `mobile/src/core/import/wanikaniMapper.test.ts` (new)
- `mobile/src/core/import/fsrsConverter.ts` (new)
- `mobile/src/core/import/fsrsConverter.test.ts` (new)
- `mobile/src/core/import/import.types.ts` (new)
- `mobile/src/data/user/importRepository.ts` or `mobile/src/data/import/wanikaniClient.ts` (new)
- `mobile/src/data/user/importRepository.test.ts` or equivalent client tests (new)
- `mobile/src/app/onboarding/import.tsx` (modify from placeholder to invoke import path)

Do not move this logic into unrelated modules (`preferencesRepository`, `core/srs/*`, or non-import onboarding screens).

### Technical requirements and latest guidance

- WaniKani v2 endpoint base: `https://api.wanikani.com/v2` with Bearer token auth.
- WaniKani documented rate limit: **60 requests/minute**; handle `429` and use rate-limit headers for pacing/retry.
- Import should process paginated responses robustly and stop safely on unrecoverable errors.
- Current project uses Expo SDK 55 and secure storage from Story 3.1 (`expo-secure-store ~55.0.x`).
- Architecture currently pins `ts-fsrs` to `^5.3.2`; latest available is newer, but this story should follow repository dependency decisions unless explicitly upgraded by separate scope.

### Testing requirements

- Mapper/converter tests are mandatory and should be pure function tests under `core/import/`.
- Data-layer import client tests should mock network at call boundaries and assert `Result` contracts.
- At least one transactional write failure test must verify rollback/no partial import persistence.
- Add regression assertions that burned and apprentice states convert as expected.
- Verify no credential value appears in any logs in import-path tests.

### Scope boundaries (avoid accidental overreach)

In scope:

- WaniKani v2 fetch, mapping, FSRS conversion, and persistence pipeline.
- Error handling for invalid key/rate limiting/network failures.
- Minimal onboarding wiring necessary to execute WaniKani import.

Out of scope (defer):

- Bunpro import behavior (Story 3.3).
- Anki `.apkg` parsing/import (Story 3.4).
- Full import summary UX and unmatched transparency polish (`ImportSummaryCard`, Story 3.5).
- Multi-source onboarding branch completion (Story 3.6).

### Git intelligence summary

Recent relevant commit history shows Story 3.1 completed secure credential infrastructure and test-first data-layer patterns. Reuse that style and interfaces rather than introducing alternate credential/network abstractions.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Epic 3, Story 3.2 ACs]
- [Source: `_bmad-output/planning-artifacts/architecture.md` - External integration points, layer boundaries, Result pattern, non-destructive import]
- [Source: `_bmad-output/planning-artifacts/prd.md` - FR33d, NFR18, WaniKani import/rate-limit requirements]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` - import trust/flow transparency and switcher-first expectations]
- [Source: `_bmad-output/implementation-artifacts/3-1-secure-storage-for-import-credentials.md` - prior story learnings, secure credential APIs]
- [Source: WaniKani API docs - rate-limit and response-header behavior]

## Dev Agent Record

### Agent Model Used

BMAD Story Developer (Composer)

### Debug Log References

- Fixed recursive TS inference in `wanikaniClient.fetchAllAssignments` with explicit `Result` annotation.
- Extended `expo-sqlite` mock for `srs_states`, `import_metadata`, `external_id_mappings`, and transactional rollback snapshots.
- Updated `database.test.ts` migration count expectation for migration `003`.

### Completion Notes List

- Implemented WaniKani v2 client with Bearer auth, pagination, rate-limit header pacing, bounded 429/5xx retry, and `Result` error contracts.
- Added pure core mapping/conversion (`wanikaniMapper`, `fsrsConverter`, `import.types`) with burned/apprentice FSRS behavior.
- Added migration `003` for `srs_states` and `import_metadata`; transactional import persistence via `importRepository`.
- Wired minimal onboarding import screen with API key entry, import execution, readable failures, and credential discard on success.
- Added unit/integration tests; `npm run lint`, `npm run typecheck`, and `npm test` all pass (149 tests).

### File List

- mobile/src/core/import/import.types.ts
- mobile/src/core/import/fsrsConverter.ts
- mobile/src/core/import/fsrsConverter.test.ts
- mobile/src/core/import/wanikaniMapper.ts
- mobile/src/core/import/wanikaniMapper.test.ts
- mobile/src/data/import/wanikaniClient.ts
- mobile/src/data/import/wanikaniClient.test.ts
- mobile/src/data/curriculum/externalIdMappingRepository.ts
- mobile/src/data/migrations/003_srs_states_and_import_metadata.ts
- mobile/src/data/migrations/index.ts
- mobile/src/data/user/importRepository.ts
- mobile/src/data/user/importRepository.test.ts
- mobile/src/data/database.test.ts
- mobile/src/app/onboarding/import.tsx
- mobile/__mocks__/expo-sqlite.ts
- _bmad-output/implementation-artifacts/3-2-wanikani-v2-import-with-mapping-and-fsrs-conversion.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-06-14: Implemented WaniKani v2 import pipeline (client, mapper, FSRS conversion, transactional persistence, onboarding wiring, tests).
- 2026-06-14: Code review auto-fixes added missing auth/5xx retry coverage and hardened rate-limit reset parsing for epoch-or-delta headers.

### Senior Developer Review (AI)

- Outcome: approve-after-fixes
- Findings:
  - HIGH: 0
  - MEDIUM: 2
  - LOW: 0
- Fixed automatically:
  - Added explicit data-layer tests for HTTP `403` auth handling and bounded `5xx` retry/exhaustion behavior in `mobile/src/data/import/wanikaniClient.test.ts`.
  - Hardened `RateLimit-Reset` parsing to support both epoch-seconds and delta-seconds header variants in `mobile/src/data/import/wanikaniClient.ts`, reducing mis-timed wait risk.
- Verification:
  - `npm run lint` passed
  - `npm run typecheck` passed
  - `npm test` passed (149 tests)
