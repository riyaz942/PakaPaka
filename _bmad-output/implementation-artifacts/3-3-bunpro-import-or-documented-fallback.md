# Story 3.3: Bunpro import or documented fallback

Status: review

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a **Bunpro user**,
I want **grammar progress imported when an API or export exists, or a clear fallback**,
so that **I am not blocked silently (FR33e, NFR18)**.

## Acceptance Criteria

1. **Bunpro API investigation outcome documented in-repo**

   **Given** Bunpro has no official public API (deprecated) and only an unstable, reverse-engineered frontend API exists  
   **When** a developer or user needs to understand the import limitation  
   **Then** a concise investigation document at `docs/bunpro-import-investigation.md` explains: the API is unofficial/community-reverse-engineered, tokens must be extracted from browser cookies (not accessible from the mobile app natively), endpoints are unstable and may break without warning, and the grammar-point-title endpoint returns 500 errors  
   **And** the document references the community API source ([cbullard-dev/bunpro-community-api](https://github.com/cbullard-dev/bunpro-community-api)) and the Bunpro community forum discussion.

2. **Best-effort Bunpro import pipeline when a user provides a frontend API token**

   **Given** a user has manually obtained their Bunpro frontend API token (from browser DevTools cookies) and enters it in the import screen  
   **When** the import executes  
   **Then** the client fetches the user's grammar review data from `https://api.bunpro.jp/api/frontend/srs_level_overview` (or the most reliable available endpoint) using `Authorization: Token token=<key>`, maps grammar items to internal curriculum IDs via the shared external-ID mapping table, and converts Bunpro SRS levels to FSRS state  
   **And** the pipeline follows the same `Result<T, AppError>` error contract, transactional persistence, and credential discard pattern established by Story 3.2.

3. **Graceful fallback when Bunpro import is unavailable or fails**

   **Given** the Bunpro API is unreachable, returns errors, or the user does not have a token  
   **When** the user reaches the Bunpro import option  
   **Then** the UI presents explicit limitation text explaining that Bunpro does not offer a public API and import requires a manually-obtained token  
   **And** the user is offered clear alternatives: (a) enter a token if they have one, (b) skip Bunpro import and use manual grammar marking from onboarding/settings instead, or (c) go back  
   **And** no silent failure occurs — every error state has user-visible messaging (NFR18).

4. **FSRS conversion for Bunpro SRS levels**

   **Given** Bunpro uses SRS levels (Apprentice 1–4, Guru 1–2, Master, Enlightened, Burned) similar to WaniKani  
   **When** grammar items are imported  
   **Then** Bunpro SRS levels are converted to FSRS fields using the same `fsrsConverter` pattern from Story 3.2, extended with a `convertBunproStageToFsrs` function  
   **And** burned items remain burned, apprentice items receive short-interval FSRS states.

## Tasks / Subtasks

- [x] **AC1 - Document Bunpro API investigation in-repo**
  - [x] Create `docs/bunpro-import-investigation.md` with findings: no official API, deprecated by Bunpro team, community reverse-engineered endpoints exist, token acquisition requires browser cookie extraction, endpoints are unstable (grammar point titles return 500), available data includes SRS distribution and review counts but not grammar point names.
  - [x] Reference sources: community API repo, Bunpro forum posts, OpenClaw skill findings.
  - [x] State the project's decision: best-effort import with prominent limitations disclosure.

- [x] **AC2 - Build Bunpro import client in data layer**
  - [x] Create `mobile/src/data/import/bunproClient.ts` with a `BunproClient` class following the same injectable-deps pattern as `WaniKaniClient` (custom `fetchImpl`, `sleep`).
  - [x] Implement token-based auth: `Authorization: Token token=<key>` header.
  - [x] Fetch grammar review progress from the most reliable endpoint (`/api/frontend/srs_level_overview` or `/api/frontend/jlpt_progress_mixed`). Parse whatever data is available (SRS level counts, grammar point IDs).
  - [x] Handle unstable API gracefully: return `Result<T, AppError>` for all paths; detect 401/403 (invalid token), 500 (endpoint broken), and network errors with specific user-facing messages.
  - [x] Export a `fetchBunproGrammarProgress(token, deps): Promise<Result<BunproGrammarItem[], AppError>>` convenience function.

- [x] **AC2 + AC4 - Implement Bunpro mapper and FSRS conversion**
  - [x] Create `mobile/src/core/import/bunproMapper.ts` as a pure transformer from raw Bunpro response data to internal mapped/unmatched structures. Follow the same `mapBunproGrammarItems(items, externalIdToItemId, now)` signature pattern as `wanikaniMapper`.
  - [x] Add `convertBunproStageToFsrs(srsStage, now)` to `mobile/src/core/import/fsrsConverter.ts` — Bunpro uses the same apprentice→burned SRS stage ladder. Reuse the existing `STAGE_CONVERSIONS` approach; add a Bunpro-specific mapping if stage numbering differs.
  - [x] Add `BunproGrammarItem`, `BunproMapResult` types to `mobile/src/core/import/import.types.ts`.
  - [x] Fail transparently — unmatched grammar items go to the unmatched list, never silently dropped.

- [x] **AC3 - Build fallback UI in onboarding import screen**
  - [x] Extend `mobile/src/app/onboarding/import.tsx` to support Bunpro as a second import source (WaniKani and Bunpro as selectable options, or sequential sections).
  - [x] When the user selects Bunpro import, show a prominently displayed limitation notice: "Bunpro does not offer a public API. Import requires a frontend token you can obtain from your browser's developer tools. This is a best-effort feature — the API may be unavailable."
  - [x] Provide a text input for the Bunpro frontend API token.
  - [x] Show clear alternatives: "Skip Bunpro import" and "Mark grammar manually" (links/buttons to the manual marking flow from Story 2.3/2.4).
  - [x] On import failure, show specific error text (invalid token, API unavailable, network error) with retry and skip options.

- [x] **AC2 + AC3 - Wire Bunpro import through importRepository**
  - [x] Add `runBunproImport(userDb, curriculumDb, deps)` to `mobile/src/data/user/importRepository.ts` following the exact same pattern as `runWaniKaniImport`: get credential → fetch data → map → persist transactionally → discard credential.
  - [x] Reuse `persistMappedImportItems` for the transactional write — Bunpro mapped items use the same `srs_states` table and `import_metadata` row.
  - [x] Source value in `import_metadata` is `'bunpro'` (already in the CHECK constraint from migration 003).

- [x] **Tests and quality gates**
  - [x] Add unit tests for `bunproMapper` covering: mapped grammar item, unmatched grammar item, burned/apprentice conversion, malformed payload handling, empty input.
  - [x] Add unit tests for `convertBunproStageToFsrs` covering each SRS stage level.
  - [x] Add data-layer `bunproClient` tests (mocked fetch) for: auth errors (401/403), 500 responses (unstable endpoint), network failures, successful data fetch.
  - [x] Add integration-style import tests verifying `runBunproImport` transactional persistence and rollback behavior.
  - [x] Run `npm run lint`, `npm run typecheck`, and `npm test` in `mobile/`.

## Dev Notes

### Epic context and intended outcome

Epic 3 establishes trustworthy migration from existing tools. Story 3.3 is the Bunpro import pipeline — but unlike WaniKani (Story 3.2), Bunpro has no official public API. This story implements a best-effort import via the community-discovered frontend API while providing a clear, honest fallback when import is unavailable. The key deliverable is transparency — the user must never be silently blocked or confused about why Bunpro import is limited.

### Bunpro API investigation results (critical context)

**Bunpro deprecated their official API** to focus on core site development. There is NO official public API.

**Community reverse-engineered endpoints exist:**
- Base URL: `https://api.bunpro.jp/api/frontend/`
- Auth: `Authorization: Token token=<frontend_api_token>` header
- Token acquisition: Must be extracted from browser cookies (`frontend_api_token` in `Set-Cookie` from `/settings/account`). This is NOT available through Bunpro's settings page (the settings API key field is broken and doesn't work with the API).
- Available endpoints that work:
  - `/api/frontend/srs_level_overview` — SRS stage distribution (counts per level)
  - `/api/frontend/jlpt_progress_mixed` — JLPT progress by level
  - `/api/frontend/base_stats` — overall user stats
  - `/api/frontend/due` — due items count
- Endpoints that are BROKEN (return 500):
  - Grammar point titles/names by ID — cannot reliably get grammar point names
  - Full review history
  - Complete grammar catalog (only returns next 3 items to learn)

**Implications for this story:**
- The client can fetch SRS distribution but may not get individual grammar point IDs with names
- Mapping Bunpro grammar points to internal curriculum items depends on having `external_id_mappings` in `curriculum.db` for Bunpro — these must exist in the curriculum data
- The user experience must prominently disclose these limitations
- The fallback path (manual marking) must be first-class, not an afterthought

Source: [Bunpro community forum](https://community.bunpro.jp/t/bunpro-api-when/100574), [cbullard-dev/bunpro-community-api](https://github.com/cbullard-dev/bunpro-community-api), [OpenClaw Bunpro skill findings](https://community.bunpro.jp/t/openclaw-skill-for-bunpro-progress-tracking/175471)

### Previous story intelligence (Story 3.2)

- Story 3.2 delivered the complete WaniKani import pipeline: `wanikaniClient.ts`, `wanikaniMapper.ts`, `fsrsConverter.ts`, `importRepository.ts`, `import.types.ts`, and onboarding UI wiring.
- **Reuse patterns from 3.2 exactly:**
  - Data-layer client class with injectable `fetchImpl`/`sleep` deps for testability
  - Pure core mapper receiving already-fetched data, returning `{ mapped, unmatched, summary }`
  - `fsrsConverter` with a stage-to-FSRS conversion table
  - `persistMappedImportItems` for transactional writes (reuse directly — do not duplicate)
  - `runWaniKaniImport` orchestration pattern: get credential → fetch → map → persist → discard
  - `Result<T, AppError>` error contracts on all paths
- Story 3.2 already extended the `expo-sqlite` mock for `srs_states`, `import_metadata`, and transactional rollback snapshots — extend test style rather than creating parallel mocking
- Story 3.2 left Bunpro-specific logic explicitly isolated for this story

### Previous story intelligence (Story 3.1)

- Story 3.1 already delivered `credentialStore.ts` with `bunpro` as a supported `ImportCredentialSource`
- `saveImportCredential('bunpro', token)`, `getImportCredential('bunpro')`, `discardImportCredential('bunpro')` are all ready to use
- The credential store mock (`expo-secure-store`) is already set up and tested

### Architecture compliance (must follow)

- **Layering:** Bunpro API calls in `data/import/bunproClient.ts`; mapping/conversion pure in `core/import/bunproMapper.ts` and `core/import/fsrsConverter.ts`; persistence via `data/user/importRepository.ts`.
- **Boundary rule:** `core/` must not import from `data/`, React, or React Native.
- **Error contract:** All import paths return `Result<T, AppError>`; no throw-based flow control in data paths.
- **Non-destructive import:** On failure/cancel, no partial imported state remains committed. Reuse `persistMappedImportItems` which already wraps writes in a transaction.
- **Secure storage boundary:** Bunpro tokens are accessed only through `credentialStore` and discarded after success.
- **No new migration needed:** `import_metadata.source` CHECK constraint already includes `'bunpro'`; `srs_states` table is generic (item_id based, source-agnostic).

### File structure guidance for this story

New files:
- `mobile/src/data/import/bunproClient.ts` — Bunpro frontend API client
- `mobile/src/data/import/bunproClient.test.ts` — client tests with mocked fetch
- `mobile/src/core/import/bunproMapper.ts` — pure mapper from Bunpro data to internal format
- `mobile/src/core/import/bunproMapper.test.ts` — mapper unit tests
- `docs/bunpro-import-investigation.md` — API investigation documentation

Modified files:
- `mobile/src/core/import/fsrsConverter.ts` — add `convertBunproStageToFsrs`
- `mobile/src/core/import/fsrsConverter.test.ts` — add Bunpro stage conversion tests
- `mobile/src/core/import/import.types.ts` — add `BunproGrammarItem`, `BunproMapResult`
- `mobile/src/data/user/importRepository.ts` — add `runBunproImport`
- `mobile/src/data/user/importRepository.test.ts` — add Bunpro import integration tests
- `mobile/src/app/onboarding/import.tsx` — extend with Bunpro import source and fallback UI

Do NOT modify:
- `mobile/src/data/migrations/*` — no new migration needed
- `mobile/src/data/user/credentialStore.ts` — already supports `bunpro`
- `mobile/src/data/curriculum/externalIdMappingRepository.ts` — already supports `bunpro` source

### Technical requirements

- **Bunpro frontend API base:** `https://api.bunpro.jp/api/frontend/` with `Authorization: Token token=<key>` header.
- **No documented rate limit** — the Bunpro frontend API has no published rate limits. Be conservative: add a reasonable delay between requests if multiple endpoints are called.
- **Token format:** The frontend API token is a string extracted from browser cookies. Treat it the same as a WaniKani API key — store via `credentialStore`, never log, discard after use.
- **Bunpro SRS stages:** Bunpro uses the same apprentice→burned SRS level system as WaniKani (Apprentice 1–4, Guru 1–2, Master, Enlightened, Burned). The FSRS conversion can reuse or closely mirror the WaniKani stage conversion table in `fsrsConverter.ts`.
- **Unstable endpoint handling:** The client MUST treat 500 responses as "endpoint unavailable" (not "server error/retry"). Show the user: "This Bunpro API endpoint is currently unavailable. You can skip import and mark grammar items manually."
- **ts-fsrs** pinned to `^5.3.2` per architecture — follow existing dependency decisions.

### Bunpro SRS stage mapping

Bunpro's SRS stages map roughly to WaniKani's. The client may receive numeric stage values or stage name strings. Handle both:

| Bunpro Stage | Approximate Interval | FSRS Mapping |
| --- | --- | --- |
| Apprentice 1 (1) | 4 hours | stability=0.5, difficulty=5, learning |
| Apprentice 2 (2) | 8 hours | stability=1, difficulty=5, learning |
| Apprentice 3 (3) | 1 day | stability=2, difficulty=5, review |
| Apprentice 4 (4) | 2 days | stability=3, difficulty=5, review |
| Guru 1 (5) | 1 week | stability=7, difficulty=4.5, review |
| Guru 2 (6) | 2 weeks | stability=14, difficulty=4, review |
| Master (7) | 1 month | stability=30, difficulty=3.5, review |
| Enlightened (8) | 4 months | stability=120, difficulty=3, review |
| Burned (9) | 10 years | stability=365, difficulty=2, burned |

This mirrors the WaniKani conversion table. The `convertBunproStageToFsrs` function can delegate to the same underlying `STAGE_CONVERSIONS` if stages align, or define a Bunpro-specific table if the numbering differs.

### UI guidance for fallback

The Bunpro section of the import screen must:
1. **Lead with the limitation** — not bury it. The first thing the user sees is that Bunpro import is "experimental" / "best-effort" because Bunpro has no public API.
2. **Explain token acquisition** clearly: "To import, you need your Bunpro frontend token. Log into bunpro.jp in a browser, open Developer Tools, and find `frontend_api_token` in your cookies."
3. **Prominently offer alternatives** — "Skip Bunpro Import" button should be equally visible as the import button. Manual marking from Epic 2 is the reliable fallback.
4. **On failure, be specific** — don't say "Import failed." Say "The Bunpro API is currently unavailable (this is a known limitation)." or "Invalid token. Make sure you copied the `frontend_api_token` cookie value."

### Testing requirements

- `bunproMapper` tests: mapped grammar item, unmatched item, burned conversion, apprentice conversion, malformed/empty payload, summary counts.
- `convertBunproStageToFsrs` tests: every stage level (1–9), unsupported stage returns null, boundary values.
- `bunproClient` tests (mocked fetch): successful fetch, 401/403 invalid token, 500 endpoint unavailable, network error, empty response.
- `runBunproImport` integration tests: successful end-to-end flow, transactional rollback on failure, credential discard on success.
- No credential value appears in any logs.

### Scope boundaries

**In scope:**
- Bunpro API investigation documentation
- `bunproClient.ts` data-layer client for the frontend API
- `bunproMapper.ts` pure mapper for grammar items
- Extension of `fsrsConverter.ts` for Bunpro stages
- `runBunproImport` orchestration in `importRepository.ts`
- Onboarding import screen extension with Bunpro option and fallback UI
- Tests for all new code

**Out of scope (defer):**
- Anki `.apkg` parsing/import (Story 3.4)
- Full import summary UX polish with `ImportSummaryCard` (Story 3.5)
- Multi-source onboarding branch completion and routing (Story 3.6)
- Curriculum data population of `external_id_mappings` for Bunpro source (that is a content pipeline concern, not an import pipeline concern — the mapper handles missing mappings gracefully)

### Git intelligence summary

Recent commit `933a3e6` (Story 3.2) added the WaniKani import pipeline. The exact patterns (client class, mapper, converter, repository integration, onboarding wiring) should be followed for Bunpro to maintain consistency. Commit `3ad429c` (Story 3.1) established the credential store patterns already supporting `bunpro`.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 3, Story 3.3 ACs]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — External integration points (Bunpro API TBD), layer boundaries, Result pattern, non-destructive import, import data flow clarification]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR33e, NFR18, Bunpro import/fallback requirements]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — ImportSummaryCard states, switcher trust principle, onboarding import flow]
- [Source: `_bmad-output/implementation-artifacts/3-2-wanikani-v2-import-with-mapping-and-fsrs-conversion.md` — prior story patterns, WK client/mapper/converter architecture]
- [Source: `_bmad-output/implementation-artifacts/3-1-secure-storage-for-import-credentials.md` — credential store supporting bunpro source]
- [Source: Bunpro community API research — no official API, community reverse-engineered endpoints, unstable grammar title endpoint]
- [Source: `mobile/src/core/import/import.types.ts` — existing import type contracts to extend]
- [Source: `mobile/src/data/import/wanikaniClient.ts` — client pattern to follow]
- [Source: `mobile/src/data/user/importRepository.ts` — orchestration and persistence pattern to follow]
- [Source: `mobile/src/core/import/fsrsConverter.ts` — stage conversion pattern to extend]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

### Completion Notes List

- Documented Bunpro API limitations in `docs/bunpro-import-investigation.md` with community sources and project decision for best-effort import.
- Implemented `BunproClient` fetching grammar items via paginated `srs_level_details` per SRS stage; 500 responses surface as endpoint-unavailable (no retry), 401/403 as invalid token.
- Added `bunproMapper`, `convertBunproStageToFsrs`, and `runBunproImport` mirroring Story 3.2 WaniKani patterns; reuses `persistMappedImportItems` with `source: 'bunpro'`.
- Extended onboarding import screen with WaniKani/Bunpro source switcher, limitation notice, token input, skip/manual-marking alternatives, and specific error messaging.
- Added 20+ new unit/integration tests; all 175 mobile tests pass with lint and typecheck clean.

### File List

- docs/bunpro-import-investigation.md (new)
- mobile/src/data/import/bunproClient.ts (new)
- mobile/src/data/import/bunproClient.test.ts (new)
- mobile/src/core/import/bunproMapper.ts (new)
- mobile/src/core/import/bunproMapper.test.ts (new)
- mobile/src/core/import/fsrsConverter.ts (modified)
- mobile/src/core/import/fsrsConverter.test.ts (modified)
- mobile/src/core/import/import.types.ts (modified)
- mobile/src/data/user/importRepository.ts (modified)
- mobile/src/data/user/importRepository.test.ts (modified)
- mobile/src/app/onboarding/import.tsx (modified)

### Change Log

- 2026-06-14: Story 3.3 — Bunpro best-effort import pipeline, investigation doc, fallback UI, and tests.
