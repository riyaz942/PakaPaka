# Story 3.5: Import summary and unmatched transparency

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a **switcher**,
I want **a transparent summary of mapped vs unmatched items and how my SRS stages map, shown before I commit**,
so that **I trust the migration and confirm only after seeing exactly what will be imported (FR33h, FR33g, UX-DR11)**.

## Acceptance Criteria

1. **Preview is computed before any `user.db` write**

   **Given** a successful WaniKani, Bunpro, or Anki fetch/parse + mapping  
   **When** the import is run from the import screen  
   **Then** a preview result containing the full mapped list, full unmatched list, and `ImportSummary` is produced **without** writing to `srs_states` or `import_metadata`  
   **And** no credential is discarded and no temp Anki file decision changes until the user confirms (cleanup of the Anki temp file still happens after the run, but persistence is deferred)

2. **`ImportSummaryCard` renders the summary state**

   **Given** a computed preview  
   **When** the summary screen renders  
   **Then** an `ImportSummaryCard` component shows: a **source badge** (WaniKani / Bunpro / Anki), **mapped count vs total** (mapped + unmatched), and an **SRS stage mapping** section communicating burned→burned and apprentice→short-interval framing (UX-DR11, UX flow Step I/J)  
   **And** the card supports `loading`, `summary`, `confirmed`, and `error` states per the UX spec

3. **Unmatched items are clearly listed for follow-up (FR33g)**

   **Given** a preview with one or more unmatched items  
   **When** the summary screen renders  
   **Then** the unmatched items are shown in a clearly labeled section (count + the external identifiers / front text already carried on `UnmatchedImportItem.externalId`)  
   **And** when there are zero unmatched items, the unmatched section shows a positive empty state ("All items matched") rather than an empty container

4. **Confirm persists mapped progress transactionally**

   **Given** a preview displayed in the `summary` state  
   **When** the user taps **Confirm import**  
   **Then** mapped items persist via the existing `persistMappedImportItems` transaction (`srs_states` + `import_metadata`) and the card moves to `confirmed`  
   **And** for credentialed sources (WaniKani/Bunpro) the credential is discarded only after a successful persist  
   **And** the flow then routes onward (return toward onboarding completion / next step) consistent with the existing screen navigation

5. **Cancel leaves `user.db` uncorrupted (FR33h)**

   **Given** a preview displayed in the `summary` state  
   **When** the user taps **Cancel** / **Re-import**  
   **Then** no rows are written to `srs_states` or `import_metadata` (verifiable by row counts unchanged)  
   **And** the credential is **not** discarded (user can retry), and the user is returned to source selection without a dead end

6. **Error state with retry**

   **Given** a fetch/parse/mapping failure (invalid key, unreachable API, malformed `.apkg`)  
   **When** the failure is returned  
   **Then** the `ImportSummaryCard` `error` state (or inline error) shows the typed `AppError.userMessage` with a retry affordance  
   **And** any partial-import warning (`ImportSummary.warningMessage`, e.g. Bunpro partial or Anki empty-deck) is surfaced in the summary, not swallowed

7. **Accessibility of the summary**

   **Given** the summary screen is shown to a screen-reader user  
   **When** they traverse it  
   **Then** the summary region uses `accessibilityRole="summary"`, each SRS mapping line is announced clearly, and counts are verbalized (not color-only) per UX-DR11

## Tasks / Subtasks

- [x] **AC1 - Separate "preview" (fetch + map) from "persist" in `importRepository.ts`**
  - [x] Introduce a preview type, e.g. `ImportPreview = { source: ImportSource; mapped: MappedImportItem[]; unmatched: UnmatchedImportItem[]; summary: ImportSummary }`, added to `mobile/src/core/import/import.types.ts`
  - [x] Add `previewWaniKaniImport(curriculumDb, deps)` and `previewBunproImport(curriculumDb, deps)` that read the credential, fetch, map, and return `Result<ImportPreview, AppError>` **without** persisting and **without** discarding the credential
  - [x] Add `previewAnkiImport(curriculumDb, filePath, deps)` that reads + parses + maps and returns `Result<ImportPreview, AppError>`; keep temp-file cleanup behavior (clean up after producing the preview, since the parsed data is already in memory)
  - [x] Add a `confirmImport(userDb, preview)` that calls `persistMappedImportItems(userDb, preview.mapped, preview.summary)` and returns `Result<void, AppError>`
  - [x] Add `discardImportCredential` call as a separate post-confirm step for credentialed sources (or expose a `confirmCredentialedImport` that persists then discards) — do NOT discard on preview or cancel
  - [x] Keep the existing `runWaniKaniImport` / `runBunproImport` / `runAnkiImport` functions working (refactor them to compose preview + confirm) OR retarget their tests; preserve all current behavioral guarantees (transactional rollback, no-discard-on-failure)

- [x] **AC2 + AC3 + AC7 - Build `ImportSummaryCard` component (UX-DR11)**
  - [x] Create `mobile/src/components/import/ImportSummaryCard.tsx`
  - [x] Props: `state: 'loading' | 'summary' | 'confirmed' | 'error'`, `preview?: ImportPreview`, `errorMessage?: string`, `onConfirm`, `onCancel`, `onRetry`
  - [x] Source badge maps `ImportSource` → display label (WaniKani / Bunpro / Anki)
  - [x] Mapped section: "Mapped {mapped} of {mapped + unmatched}" with burned/apprentice breakdown from `summary.burnedCount` / `summary.apprenticeCount`
  - [x] SRS mapping explainer lines (static copy): "Burned items stay burned", "Apprentice items enter at short intervals"
  - [x] Unmatched section: count + scrollable list of `unmatched[].externalId`; positive empty state when zero
  - [x] `warningMessage` surfaced when present
  - [x] A11y: wrap summary in `accessibilityRole="summary"`; per-line `accessibilityLabel`s; counts verbalized; use NativeWind tokens (no color-only signals)
  - [x] Reuse `@/components/common/Button` for confirm/cancel/retry; follow button hierarchy (one primary = Confirm)

- [x] **AC2 + AC4 + AC5 + AC6 - Add summary screen and wire navigation**
  - [x] Create `mobile/src/app/onboarding/import-summary.tsx` and register it in `mobile/src/app/onboarding/_layout.tsx` (`<Stack.Screen name="import-summary" />`)
  - [x] Decide how the preview crosses the navigation boundary. Preferred: a lightweight in-memory module-scoped store / React context (`importPreviewStore`) set by `import.tsx` before `router.push('/onboarding/import-summary')`, since Expo Router params should not carry large objects. Document the choice in Dev Notes/Debug Log.
  - [x] On confirm: call `confirmImport(userDb, preview)`, show `confirmed`, then route forward (e.g. `router.replace('/onboarding/complete')` or the existing next step — match current screen behavior)
  - [x] On cancel: clear the preview store and `router.back()` to source selection — assert no persistence occurred
  - [x] On error/retry: return to `import.tsx` source selection (or re-run preview)

- [x] **AC1 + AC4 - Refactor `import.tsx` to use preview → summary instead of inline persist**
  - [x] Replace `handleWaniKaniImportPress` / `handleBunproImportPress` / `handleAnkiImportPress` so they call the new `preview*` functions and, on success, stash the preview and navigate to `import-summary`
  - [x] Keep credential save (`saveImportCredential`) before preview for WaniKani/Bunpro (preview reads the stored credential, consistent with current `getImportCredential` flow)
  - [x] Remove inline success `setStatusMessage` strings now superseded by the summary screen (keep inline error handling for pre-navigation failures)
  - [x] Preserve the existing skip/manual-mark secondary actions and privacy note

- [x] **Tests and quality gates**
  - [x] `ImportSummaryCard` tests (React Native Testing Library): renders summary counts, renders unmatched list + empty state, surfaces `warningMessage`, confirm/cancel/retry callbacks fire, a11y `summary` role present
  - [x] `importRepository` tests: `preview*` functions return mapped/unmatched/summary and do **not** write to `user.db` (assert `countSrsStates`/`countImportMetadataRows` stay 0); `confirmImport` persists; cancel path (no confirm) leaves DB untouched; credential not discarded on preview, discarded only after confirm for WK/Bunpro
  - [x] Update existing `runWaniKaniImport`/`runBunproImport`/`runAnkiImport` tests if those functions are refactored — all current guarantees must still pass (rollback, no-discard-on-failure, partial warning)
  - [x] `import-summary.tsx` screen test if feasible with existing onboarding test patterns (see `complete.test.tsx`, `calibrate.test.tsx`)
  - [x] Run `npm run lint`, `npm run typecheck`, and `npm test` in `mobile/`

## Dev Notes

### Epic context and intended outcome

Epic 3 is about **trustworthy** migration. Stories 3.2 (WaniKani), 3.3 (Bunpro), and 3.4 (Anki) all built working import pipelines, but each currently **persists immediately** and shows only a one-line inline status string. Story 3.5 delivers the **transparency layer** (FR33h, FR33g, UX-DR11): the user must see mapped vs unmatched counts and SRS-stage mapping **before** committing, and confirming/cancelling must be safe.

This is primarily a **refactor + UI** story, not a new parsing pipeline. The hard part is cleanly splitting "fetch + map" (preview, no writes) from "persist" (confirm) without regressing the transactional and credential guarantees the previous three stories established.

### Current state of the import pipeline (critical — read before coding)

All three importers live in `mobile/src/data/user/importRepository.ts` and currently do fetch/parse → map → **persist** → discard credential in one call:

- `runWaniKaniImport(userDb, curriculumDb, deps)` — reads credential, fetches assignments, maps via `mapWaniKaniAssignments`, persists, discards credential.
- `runBunproImport(userDb, curriculumDb, deps)` — same shape; sets `summary.warningMessage` when `unavailableLevelCount > 0` (`BUNPRO_PARTIAL_IMPORT_WARNING`).
- `runAnkiImport(userDb, curriculumDb, filePath, deps)` — reads + parses file, maps via `mapAnkiCards`, persists, cleans up temp file. No credential.

`persistMappedImportItems(userDb, mapped, summary, options)` already:
- Wraps all writes in `userDb.withTransactionSync(...)` (atomic; rollback on throw — proven by existing tests).
- Inserts/updates `srs_states` (ON CONFLICT upsert) and sets study status (`in_progress`, or bulk `known` for burned items).
- Inserts one `import_metadata` row.
- Returns `Result<void, AppError>` with `code: 'import_persist_failed'` on error.

**The split:** preview functions should do everything `run*` does **except** `persistMappedImportItems` and `discardImportCredential`. `confirmImport` does the persist; credential discard becomes a post-confirm step for WK/Bunpro only.

### `ImportSummary` data already available (no new computation needed)

From `mobile/src/core/import/import.types.ts`:

```ts
type ImportSummary = {
  source: ImportSource;          // 'wanikani' | 'bunpro' | 'anki'
  mappedCount: number;
  unmatchedCount: number;
  burnedCount: number;
  apprenticeCount: number;
  warningMessage?: string;
};
```

- `mappedCount + unmatchedCount` = total considered → use for "Mapped X of Y".
- `burnedCount` / `apprenticeCount` → power the "burned→burned, apprentice→short interval" SRS-mapping framing the UX flow calls for (Step J).
- `warningMessage` → already set for Bunpro partial imports and Anki empty decks; must be surfaced in the card (AC6).
- Unmatched detail comes from the `unmatched: UnmatchedImportItem[]` list (each has `externalId`, `srsStage`, `srsStageName`). For Anki, `externalId` is the card front (`sfld`); for WK it's `subject_id`; for Bunpro it's the grammar point id.

The mappers (`wanikaniMapper`, `bunproMapper`, `ankiMapper`) **already return** `{ mapped, unmatched, summary }`. So the preview type is essentially what the mappers already produce, lifted to the repository layer with the source attached.

### UX-DR11 / `ImportSummaryCard` spec (must follow)

From the UX design specification (`ux-design-specification.md`):

- **Purpose:** Transparent import results for switchers; builds trust by showing exactly what was mapped.
- **Anatomy:** Source badge (WaniKani / Bunpro / Anki), item counts (mapped vs total), SRS stage mapping table, gaps identified, confirm/re-import actions.
- **States:** `loading` (fetching), `summary` (results), `confirmed` (accepted), `error` (failed — with retry).
- **Accessibility:** Summary table uses `accessibilityRole="summary"`; each mapping line announced clearly.
- **Flow 3 (Mika — Switcher):** `Fetch & map` → **Import Summary screen** → "Mapped: 1,200 kanji, 340 grammar points" → "SRS mapping: burned→burned, apprentice→short interval" → "New items identified" → `User confirms import?` → Confirm builds queue / Adjust returns to source select.
- **Empty/loading state:** "Import loading" → skeleton loader matching `ImportSummaryCard` layout.
- **Key principle:** "No black box. Trust is critical for switchers leaving paid tools."

Note: full review-queue building and the "new items identified / N3 gaps" intelligence belong to later epics — for this story the "new/gaps" line can be represented by the unmatched section and the mapped breakdown. Do not implement queue building here.

### Architecture compliance (must follow)

- **Layering:** Pure mapping stays in `core/import/*` (unchanged). Orchestration/persistence stays in `data/user/importRepository.ts`. The new component lives in `components/import/`. The screen lives in `app/onboarding/`. `core/` must never import from `data/`, React, or React Native.
- **Error contract:** Every new repository function returns `Result<T, AppError>`; no throw-based control flow. UI reads `error.userMessage ?? error.message` (see existing `getImportErrorMessage` in `import.tsx`).
- **Non-destructive import (the whole point of this story):** Persistence happens **only** on explicit confirm, inside the existing transaction. Cancel writes nothing. This is the literal FR33h guarantee.
- **Credential lifecycle:** Do not discard credentials on preview or cancel — only after a successful confirm for WK/Bunpro. This preserves retry (matches existing "no-discard-on-failure" tests).
- **No new migration:** `srs_states` and `import_metadata` already exist (migration 003); `import_metadata.source` CHECK already allows `'wanikani' | 'bunpro' | 'anki'`. Do not add migrations.
- **Styling:** NativeWind tokens only (`text-primary`, `text-secondary`, `bg-surface`, `border-border`, `rounded-radius-md`, etc.), consistent with `import.tsx` and `OnboardingStep.tsx`. Never color-only signaling (UX-DR11 a11y).

### File structure guidance

New files:
- `mobile/src/components/import/ImportSummaryCard.tsx` — the UX-DR11 component
- `mobile/src/components/import/ImportSummaryCard.test.tsx` — component tests
- `mobile/src/app/onboarding/import-summary.tsx` — summary screen
- (optional) `mobile/src/data/import/importPreviewStore.ts` — tiny in-memory holder to pass the preview between `import.tsx` and `import-summary.tsx` (avoid serializing large objects through router params)

Modified files:
- `mobile/src/core/import/import.types.ts` — add `ImportPreview`
- `mobile/src/data/user/importRepository.ts` — add `previewWaniKaniImport`, `previewBunproImport`, `previewAnkiImport`, `confirmImport`; refactor `run*` to compose them
- `mobile/src/data/user/importRepository.test.ts` — add preview/confirm tests; keep `run*` guarantees
- `mobile/src/app/onboarding/import.tsx` — switch from inline persist to preview → navigate to summary
- `mobile/src/app/onboarding/_layout.tsx` — register `import-summary` screen

Do NOT modify:
- `mobile/src/core/import/wanikaniMapper.ts`, `bunproMapper.ts`, `ankiMapper.ts` — they already return `{ mapped, unmatched, summary }`
- `mobile/src/core/import/fsrsConverter.ts`
- `mobile/src/data/migrations/*` — no new migration
- `mobile/src/data/user/credentialStore.ts`

### Passing the preview between screens

Expo Router params are string-serialized and not suited for large mapped/unmatched arrays. Recommended approach: a module-scoped store (`importPreviewStore`) with `setImportPreview(preview)` / `getImportPreview()` / `clearImportPreview()`, set in `import.tsx` immediately before `router.push('/onboarding/import-summary')` and cleared on confirm/cancel. A React context provider is an acceptable alternative. Document whichever is chosen.

### Previous story intelligence

- **3.4 (Anki):** Added the third source tab and `formatAnkiImportSuccessMessage`. Anki has no credential step; temp-file cleanup runs after the (now preview) read. Code review on 3.4 enforced surfacing `summary.warningMessage` — keep that behavior in the card. 205 tests passing as of 3.4.
- **3.3 (Bunpro):** Established `warningMessage` for partial imports (`BUNPRO_PARTIAL_IMPORT_WARNING`) and the source-switcher UI. Existing tests assert no-persist + no-discard when fetch fails — these must keep passing after the refactor.
- **3.2 (WaniKani):** Canonical pipeline client→mapper→converter→repository→UI; established the `persistMappedImportItems` transaction and credential discard-after-success pattern.
- **Test infra:** `__mocks__/expo-sqlite.ts`, `__mocks__/expo-secure-store.ts`, `__mocks__/expo-document-picker.ts` exist. `importRepository.test.ts` builds real migrated DBs via `runMigrations` and asserts row counts with `countSrsStates` / `countImportMetadataRows` — reuse this exact pattern to prove "no write on preview/cancel."

### Git intelligence summary

Recent commits:
- Story 3.4 (Anki `.apkg` import) — current HEAD work; added file picker, parser, mapper, FSRS interval conversion.
- Story 3.3 (Bunpro) — source-switcher UI + partial warning.
- Story 3.2 (WaniKani) — canonical pipeline + persist transaction + credential discard.

The import screen has three working source tabs that all persist immediately. 3.5 inserts a confirm gate between map and persist for all three.

### Scope boundaries

**In scope:**
- Preview/confirm split in `importRepository.ts` (no-write preview, confirm persists)
- `ImportSummaryCard` (UX-DR11) with loading/summary/confirmed/error states
- `import-summary` onboarding screen + navigation wiring + preview passing
- Mapped/unmatched/SRS-stage transparency and confirm/cancel safety (FR33h, FR33g)
- Surfacing `warningMessage`
- Tests for all new/changed behavior + a11y

**Out of scope (defer):**
- Building the calibrated review queue (Epic 5) — confirm just persists + routes
- "New items identified / N3 gaps" analytics beyond the unmatched list
- Onboarding branch routing to import sources (Story 3.6)
- Any change to mapping logic or FSRS conversion
- New migrations or schema changes
- Skeleton-loader polish beyond a basic `loading` state (basic loading is sufficient)

### Project Structure Notes

- `components/import/` is a new folder consistent with existing `components/onboarding/` and `components/common/` grouping.
- `app/onboarding/import-summary.tsx` follows the linear onboarding screen pattern already registered in `_layout.tsx`.
- The preview/confirm naming mirrors the established `run*` verb convention in `importRepository.ts`.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 3, Story 3.5 ACs (FR33h, FR33g, UX-DR11)]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR33g (unmatched flagged), FR33h (summary before finalize), NFR19]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — `ImportSummaryCard` (UX-DR11) anatomy/states/a11y; Flow 3 Import Summary screen; Import-loading empty state]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — non-destructive import, Result/AppError contract, core/data/UI layer boundaries]
- [Source: `mobile/src/data/user/importRepository.ts` — `run*` functions + `persistMappedImportItems` transaction to split]
- [Source: `mobile/src/core/import/import.types.ts` — `ImportSummary`, `MappedImportItem`, `UnmatchedImportItem` to reuse; add `ImportPreview`]
- [Source: `mobile/src/core/import/ankiMapper.ts` — `{ mapped, unmatched, summary }` shape the preview reuses]
- [Source: `mobile/src/app/onboarding/import.tsx` — current inline-persist UI to convert to preview→summary]
- [Source: `mobile/src/app/onboarding/_layout.tsx` — onboarding Stack to register `import-summary`]
- [Source: `mobile/src/components/common/OnboardingStep.tsx` + `Button.tsx` — reusable UI + button hierarchy pattern]
- [Source: `mobile/src/data/user/importRepository.test.ts` — DB-row-count assertion pattern proving no-write guarantees]
- [Source: `_bmad-output/implementation-artifacts/3-4-local-anki-apkg-import.md` — Anki/warningMessage prior intelligence]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

- Preview crossing navigation: module-scoped `importPreviewStore` (`setImportPreview` / `getImportPreview` / `clearImportPreview`) in `mobile/src/data/import/importPreviewStore.ts` — avoids serializing large mapped/unmatched arrays through Expo Router params.

### Completion Notes List

- Split import pipeline into preview (fetch + map, no writes) and confirm (persist + credential discard for WK/Bunpro) in `importRepository.ts`; `run*` functions refactored to compose preview + confirm preserving all prior guarantees.
- Added `ImportSummaryCard` with loading/summary/confirmed/error states, SRS mapping explainer, unmatched list with positive empty state, warning surfacing, and a11y labels.
- Added `import-summary` onboarding screen; confirm routes to `/onboarding/complete`, cancel/retry clears store and navigates back.
- Refactored `import.tsx` to preview → stash → navigate instead of inline persist.
- 15 new tests (6 component, 4 screen, 5 repository); 221 total tests passing after review fixes; lint and typecheck clean.

### File List

- mobile/src/core/import/import.types.ts (modified)
- mobile/src/data/import/importPreviewStore.ts (new)
- mobile/src/data/user/importRepository.ts (modified)
- mobile/src/data/user/importRepository.test.ts (modified)
- mobile/src/components/import/ImportSummaryCard.tsx (new)
- mobile/src/components/import/ImportSummaryCard.test.tsx (new)
- mobile/src/app/onboarding/import-summary.tsx (new)
- mobile/src/app/onboarding/import-summary.test.tsx (new)
- mobile/src/app/onboarding/import.tsx (modified)
- mobile/src/app/onboarding/_layout.tsx (modified)

### Change Log

- 2026-06-14: Story 3.5 — import preview/confirm split, ImportSummaryCard, import-summary screen, navigation wiring, and tests.
- 2026-06-14: Code review — fixed confirmed-state preview snapshot, renamed Cancel→Re-import (AC5), added confirm-failure screen test.

## Senior Developer Review (AI)

**Reviewer:** Composer (bmad-code-reviewer)  
**Date:** 2026-06-14  
**Outcome:** Approve after fixes

### Findings (pre-fix)

| Severity | Finding | Resolution |
|----------|---------|------------|
| MEDIUM | `import-summary.tsx` called `getImportPreview()` each render; clearing the store on confirm before navigation left `confirmed` state with no preview (empty card flash) | Snapshot preview in `useState` on mount; clear store before setting `confirmed` |
| MEDIUM | AC5 labels action "Cancel / Re-import" but button read "Cancel" | Renamed secondary button to "Re-import" |
| MEDIUM | No screen test for persist failure → error state with retry | Added `shows error state when confirm fails` test |
| LOW | Confirmed state never visible to user (immediate `router.replace`) | Acceptable per AC4 "then routes onward" |

### AC Validation

| AC | Status |
|----|--------|
| AC1 Preview before write | IMPLEMENTED — `preview*` functions + repository tests assert zero DB rows |
| AC2 ImportSummaryCard states | IMPLEMENTED |
| AC3 Unmatched list + empty state | IMPLEMENTED |
| AC4 Confirm persists transactionally | IMPLEMENTED — `confirmCredentialedImport` |
| AC5 Cancel leaves DB uncorrupted | IMPLEMENTED — no confirm call on cancel/re-import |
| AC6 Error + warning surfacing | IMPLEMENTED — inline on import screen; card error on summary |
| AC7 Accessibility | IMPLEMENTED — `accessibilityRole="summary"`, verbalized counts |

### Git vs File List

No discrepancies — all claimed files match git changes.

### Verification

- `npm run lint` — pass
- `npm run typecheck` — pass
- `npm test` — 221 passed
