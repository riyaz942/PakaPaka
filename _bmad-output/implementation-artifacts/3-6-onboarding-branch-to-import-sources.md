# Story 3.6: Onboarding branch to import sources

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a **switcher**,
I want **to choose WaniKani, Bunpro, Anki, or skip import during onboarding**,
so that **I land on the path that matches my history and finish onboarding without dead ends (FR22, FR50)**.

## Acceptance Criteria

1. **Welcome screen exposes the "existing knowledge" branch (UX Flow 3 entry)**

   **Given** first launch on `/onboarding/welcome`  
   **When** I choose the switcher/import path  
   **Then** I am routed to `/onboarding/import` (source selection: WaniKani / Bunpro / Anki)  
   **And** the welcome copy clearly frames this as **"I have existing knowledge"** / import-from-another-tool (per PRD Mika journey and UX binary entry split)  
   **And** the beginner path (`I'm a beginner` → N5) and manual calibration path (`I know some Japanese` → JLPT picker → intensity) remain unchanged and regression-safe

2. **Each import source routes through preview → summary → confirm (Stories 3.2–3.5)**

   **Given** I am on `/onboarding/import`  
   **When** I select WaniKani, Bunpro, or Anki and complete the source-specific input (API key, token, or `.apkg` file)  
   **Then** the existing `preview*` → `import-summary` → `confirmCredentialedImport` pipeline runs without regression  
   **And** failed previews stay on the import screen with `AppError.userMessage` (no navigation to summary)  
   **And** WaniKani/Bunpro flows surface a one-time network requirement note before fetch (FR50) — e.g. inline copy: "Requires a one-time internet connection. Data stays on your device after import."

3. **Post-import confirm continues onboarding (does not skip required prefs)**

   **Given** I confirmed an import on `/onboarding/import-summary`  
   **When** persistence succeeds  
   **Then** mapped SRS data and `import_metadata` remain in `user.db` (unchanged from Story 3.5)  
   **And** navigation advances to `/onboarding/intensity` (not directly to `/onboarding/complete`) so `session_intensity` is collected before completion  
   **And** if `starting_jlpt_level` is unset, a JLPT level is collected before or during the import branch (see Dev Notes — default-on-confirm vs pre-import picker)  
   **And** after intensity is set, the import path may skip calibrate/bulk and route to `/onboarding/complete` (import already populated `srs_states` / study statuses — manual marking is optional, not blocking)

4. **Skip import reaches manual calibration without dead ends**

   **Given** I am on `/onboarding/import`  
   **When** I tap a global **Skip import** / **Mark manually instead** affordance (visible for all source tabs, not only Bunpro)  
   **Then** I am routed into the Epic 2 manual path: JLPT level selection (if unset) → `/onboarding/intensity` → `/onboarding/calibrate` → `/onboarding/bulk` → `/onboarding/complete`  
   **And** no import credentials are saved or discarded  
   **And** `useOnboardingRedirect` does not trap me in redirect loops while traversing this path

5. **Back / dismiss returns safely without corrupting state**

   **Given** I entered import from welcome and have not confirmed an import  
   **When** I tap **Back** on `/onboarding/import` or **Re-import** on `/onboarding/import-summary`  
   **Then** I return to welcome (or the prior onboarding step) with no writes to `srs_states` or `import_metadata`  
   **And** any in-memory `importPreviewStore` preview is cleared  
   **And** credentials are not discarded (Story 3.5 guarantee preserved)

6. **Onboarding redirect hook respects the import branch**

   **Given** onboarding is not completed  
   **When** I am on `/onboarding/import` or `/onboarding/import-summary`  
   **Then** `useOnboardingRedirect` does **not** force-redirect me away (same as current `import` allowlist — extend to `import-summary`)  
   **And** cold-start while mid-import (no `starting_jlpt_level` yet) keeps me on the import screens, not `/onboarding/welcome`  
   **And** after import confirm + intensity set, redirect behavior matches Story 2.5 (incomplete users with level + intensity may resume at calibrate for manual path, or complete for import path per chosen routing)

7. **Completion gate still works for both paths**

   **Given** I finished the import branch (import confirmed + intensity set) or the manual branch (level + intensity + calibrate/bulk)  
   **When** I reach `/onboarding/complete` and tap **Go to Home**  
   **Then** `setOnboardingCompleted` runs and `router.replace('/(tabs)')` executes (Story 2.5 — no regression)  
   **And** relaunch skips onboarding

8. **Tests and CI**

   **Given** implementation is complete  
   **When** CI runs in `mobile/`  
   **Then** `npm run lint`, `npm run typecheck`, and `npm test` pass  
   **And** new/updated tests cover: welcome → import navigation; global skip → intensity/calibrate; import-summary confirm → intensity (not complete); redirect hook allows `import-summary`; manual path regression (welcome → intensity → calibrate) unchanged

## Tasks / Subtasks

- [x] **AC1 — Align welcome with existing-knowledge / import entry**
  - [x] Update `mobile/src/app/onboarding/welcome.tsx` copy so the import card title/description matches UX Flow 3 ("I have existing knowledge" framing — adjust title from "Import my progress" if needed while keeping source badges)
  - [x] Ensure `router.push('/onboarding/import')` remains the import-branch entry (no accidental `replace` that breaks back navigation)
  - [x] Add `welcome.test.tsx` (or extend existing onboarding tests): tapping import card navigates to `/onboarding/import`; beginner and intermediate paths still route to intensity with level persisted

- [x] **AC2 — FR50 network notice on credentialed sources**
  - [x] Add concise inline notice on WaniKani and Bunpro panels in `import.tsx` (one-time network, local-after-import)
  - [x] Anki panel keeps "entirely on-device" copy (no network required)

- [x] **AC3 — Fix post-import onboarding continuation**
  - [x] Change `import-summary.tsx` post-confirm navigation from `router.replace('/onboarding/complete')` to `router.replace('/onboarding/intensity')`
  - [x] Decide JLPT level for import path (recommended: prompt on import screen header OR default `N3` with optional picker — document choice). If unset at confirm time, set a sensible default before intensity OR add a lightweight JLPT picker step between summary and intensity
  - [x] After intensity on import path: `router.replace('/onboarding/complete')` (skip calibrate/bulk — import already wrote SRS/study data). Optional tertiary link on intensity: "Mark items manually" → calibrate for users who want Epic 2 calibration after import
  - [x] Update `import-summary.test.tsx` to expect `/onboarding/intensity` after confirm

- [x] **AC4 — Global skip import affordance**
  - [x] Add **Skip import** / **Mark manually instead** button on `import.tsx` visible regardless of selected source tab (tertiary/secondary variant per button hierarchy)
  - [x] Skip routes to manual path: if no `starting_jlpt_level`, navigate to welcome with intermediate path focused OR inline JLPT picker on import before intensity — prefer reusing `JlptLevelPicker` + `setStartingJlptLevel` then `router.push('/onboarding/intensity')`
  - [x] Remove or consolidate redundant Bunpro-only skip buttons if the global skip covers the same journeys (`Skip Bunpro import`, `Mark grammar manually` may become secondary hints within Bunpro tab only)

- [x] **AC5 — Back/dismiss safety**
  - [x] Verify `import.tsx` Back uses `router.back()` → welcome
  - [x] Verify `import-summary` Re-import clears `importPreviewStore` and returns to import (existing — keep)
  - [x] No credential discard on back/cancel paths (regression test in repository if touched)

- [x] **AC6 — Extend `useOnboardingRedirect`**
  - [x] Add `import-summary` to the import-branch allowlist alongside `import`
  - [x] Consider `onboarding_path` preference (`import` | `manual` | `beginner`) in `preferencesRepository.ts` if needed to distinguish post-intensity routing (import → complete vs manual → calibrate). If added: set on welcome/import entry; read in intensity screen continue handler
  - [x] Extend `useOnboardingRedirect.test.tsx` for `['onboarding', 'import-summary']` segment — no redirect
  - [x] Add test: user with import confirmed + intensity unset on `import-summary` → allowed; after intensity on import path → may land on complete without forced calibrate redirect

- [x] **AC7 — Completion gate regression**
  - [x] Run through both paths manually: import branch and manual branch both reach complete → tabs
  - [x] Ensure `complete.test.tsx` and Story 2.5 redirect tests still pass

- [x] **AC8 — Tests and quality gates**
  - [x] `welcome.test.tsx` (new)
  - [x] Update `import-summary.test.tsx` (confirm → intensity)
  - [x] Update `intensity.test.tsx` if continue handler branches on onboarding path
  - [x] `useOnboardingRedirect.test.tsx` extensions
  - [x] Run `npm run lint`, `npm run typecheck`, `npm test` in `mobile/`

## Dev Notes

### Epic context and intended outcome

Epic 3 built the import **engine** (credentials, WK/Bunpro/Anki pipelines, preview/confirm summary). Story 3.6 is the **onboarding integration** story: wire the switcher branch so users can enter import from welcome, pick a source, confirm data, and **finish onboarding** without bypassing required preferences or getting stuck in redirect loops.

This is primarily **navigation + onboarding UX glue**, not new import parsing. Reuse everything from Stories 3.1–3.5.

### Current state — what works vs what is broken

**Already implemented (do not rebuild):**
- `welcome.tsx` third card navigates to `/onboarding/import` with source badges
- `import.tsx` three-source tab UI with preview → `import-summary` navigation
- `import-summary.tsx` preview/confirm/cancel via `ImportSummaryCard` + `importPreviewStore`
- `useOnboardingRedirect` allows `/onboarding/import` when no JLPT level is set (test exists)

**Gaps this story must fix:**
1. **Post-import skips intensity** — `import-summary.tsx` line 52 routes to `/onboarding/complete` directly. Users can complete onboarding without `session_intensity` (and often without `starting_jlpt_level`), violating Epic 2 prefs and FR25.
2. **No global skip import** — only Bunpro tab has skip/manual buttons; AC requires skip for all sources.
3. **`import-summary` not in redirect allowlist** — cold-start on summary may redirect incorrectly once level/intensity prefs exist from a partial manual path.
4. **Welcome copy mismatch** — UX/PRD say "I have existing knowledge"; UI says "Import my progress" (minor but AC1).
5. **No FR50 network notice** on WK/Bunpro panels.
6. **No welcome screen tests** for the import branch entry.

### Recommended onboarding flows after this story

**Import branch (switcher):**
```
welcome ("I have existing knowledge" card)
  → import (pick WK / Bunpro / Anki)
  → import-summary (preview → confirm)
  → intensity
  → complete → tabs
```
Optional: JLPT picker on import screen or default level at confirm. Optional tertiary "Mark more items" from intensity → calibrate.

**Manual branch (skip import):**
```
welcome ("I know some Japanese" card)
  → intensity (after JLPT pick on welcome)
  → calibrate → bulk → complete → tabs

OR from import:
import → Skip import
  → (JLPT pick if needed) → intensity → calibrate → bulk → complete → tabs
```

**Beginner branch (unchanged):**
```
welcome ("I'm a beginner") → intensity → calibrate → bulk → complete → tabs
```

### JLPT level for import path — decision guide

`calibrate.tsx` requires `getStartingJlptLevel(userDb)` for item queries. Import does **not** currently set JLPT level.

**Recommended approach (pick one, document in Debug Log):**
- **Option A (minimal):** On first import confirm, default `setStartingJlptLevel(userDb, 'N3')` with optional inline picker on import screen ("What level are you studying toward?") — switchers are typically N3+.
- **Option B:** Add JLPT picker to import screen header (always visible) before allowing import — more friction but explicit.
- **Option C:** Route import branch through welcome's intermediate JLPT picker before `import` — requires welcome sub-state.

Option A with a visible JLPT picker on the import screen (above source tabs) is the best balance: satisfies FR22 onboarding import without blocking switchers, gives calibrate a level if user later chooses manual marking.

### `onboarding_path` preference (optional but helpful)

If intensity continue handler needs to branch (import → complete vs manual → calibrate), add:

```ts
// preferencesRepository.ts
onboardingPath: 'beginner' | 'manual' | 'import'
```

Set when user picks a welcome card or taps Skip import. Read in `intensity.tsx` `handleContinue`:
- `import` → `router.replace('/onboarding/complete')`
- `beginner` | `manual` → `router.replace('/onboarding/calibrate')` (existing)

If omitted, infer: if `import_metadata` row exists in `user.db` after confirm, treat as import path.

### Architecture compliance (must follow)

- **Layering:** Navigation changes in `app/onboarding/*` only. Optional preference in `data/user/preferencesRepository.ts`. Do **not** move import logic into screens — keep `importRepository` calls as-is.
- **Error contract:** Unchanged `Result<T, AppError>` from repository functions.
- **Non-destructive import:** Story 3.5 guarantees preserved — no persistence until confirm; cancel/back clears preview store only.
- **Credential lifecycle:** No discard on preview, cancel, back, or skip (only after successful confirm — unchanged).
- **No new migrations** unless `onboarding_path` is added to `user_preferences` (string key/value is fine without migration — `user_preferences` is key-value).
- **Styling:** NativeWind tokens; reuse `OnboardingStep`, `Button`, `LevelPathCard`, `JlptLevelPicker`. Import screen may adopt `OnboardingStep` wrapper for consistency (optional polish).

### File structure guidance

**Modified (expected):**
- `mobile/src/app/onboarding/welcome.tsx` — copy/entry alignment (AC1)
- `mobile/src/app/onboarding/import.tsx` — global skip, FR50 notice, optional JLPT picker (AC2, AC4)
- `mobile/src/app/onboarding/import-summary.tsx` — post-confirm → intensity (AC3)
- `mobile/src/app/onboarding/intensity.tsx` — branch continue to complete vs calibrate (AC3, AC6)
- `mobile/src/hooks/useOnboardingRedirect.ts` — allowlist `import-summary` (AC6)
- `mobile/src/data/user/preferencesRepository.ts` — optional `onboarding_path` helpers (AC6)

**New tests:**
- `mobile/src/app/onboarding/welcome.test.tsx`

**Updated tests:**
- `mobile/src/app/onboarding/import-summary.test.tsx`
- `mobile/src/hooks/useOnboardingRedirect.test.tsx`
- `mobile/src/app/onboarding/intensity.test.tsx` (if branching)

**Do NOT modify:**
- `mobile/src/core/import/*` mappers/parsers/converters
- `mobile/src/data/user/importRepository.ts` preview/confirm logic (unless a tiny helper for `hasImportMetadata` is useful)
- `mobile/src/components/import/ImportSummaryCard.tsx` (Story 3.5 complete)
- `mobile/src/data/migrations/*`

### UX references (must follow)

- **UX Flow 3:** Entry = "I have existing knowledge" → source select → summary → confirm → calibrated session (session/queue building is Epic 5 — for now, complete onboarding after intensity).
- **UX binary entry split:** Beginner vs existing knowledge forks the flow; manual JLPT path and import path are both "existing knowledge" sub-paths.
- **UX modal pattern:** Import is full-screen with dismiss via Back/X → returns to onboarding. Back button on import satisfies this; optional header X is polish only.
- **Button hierarchy:** One primary per screen; Skip import = tertiary/secondary; Confirm import = primary on summary card.

### Previous story intelligence

- **3.5 (Import summary):** Preview/confirm split, `importPreviewStore`, `ImportSummaryCard`, confirm routes to complete ( **this story changes that to intensity** ). Code review fixed confirmed-state snapshot and Re-import label. 221 tests passing.
- **3.4 (Anki):** Third source tab; on-device parsing; `warningMessage` for empty decks — surface in summary, not import routing.
- **3.3 (Bunpro):** Bunpro-only skip buttons to bulk/calibrate — consolidate with global skip in this story.
- **3.2–3.1:** Canonical pipeline; credential discard only after confirm.
- **2.5 (Completion gate):** `setOnboardingCompleted` only on explicit "Go to Home"; `useOnboardingRedirect` blocks completed users from onboarding. Import branch must still collect required prefs **before** complete.
- **2.3–2.4 (Calibration):** Manual path screens unchanged; import path may skip them when SRS data already imported.

### Git intelligence summary

Recent commits (Epic 3):
- `d06f3ec` — Story 3.5 import summary + preview/confirm split
- `04a9dfd` — Story 3.4 Anki import
- `25dc8a6` — Story 3.3 Bunpro
- `933a3e6` — Story 3.2 WaniKani
- `3ad429c` — Story 3.1 secure credentials

Story 3.6 is a small diff across onboarding screens + redirect hook — build on these commits, do not rewrite import engine.

### Scope boundaries

**In scope:**
- Welcome → import entry alignment
- Global skip import → manual calibration path
- Post-import → intensity → complete routing
- JLPT level collection/default for import path
- `useOnboardingRedirect` import-branch allowlist
- FR50 network notice
- Navigation tests

**Out of scope (defer):**
- Building review queue after import (Epic 5)
- Multi-source sequential import (WK then Bunpro in one session) — user can re-enter import from settings later; not required for MVP onboarding
- Refactoring welcome to strict two-card binary split (three cards OK if import = existing knowledge)
- Import-from-settings outside onboarding (future story)
- `onboarding_furthest_step` resume (Story 2.5 optional — still deferred)

### Project Structure Notes

- Architecture doc lists `import-progress.tsx` — actual file is `import-summary.tsx` (Story 3.5). Use `import-summary.tsx`.
- `components/import/` and `data/import/importPreviewStore.ts` are stable — consume, don't duplicate.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 3, Story 3.6 ACs (FR22, FR50)]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR22, FR50, Mika journey ("I have existing knowledge")]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Flow 3, binary entry split, import modal pattern, button hierarchy]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — onboarding/ import screen layout, app state preferences]
- [Source: `mobile/src/app/onboarding/welcome.tsx` — current import entry card]
- [Source: `mobile/src/app/onboarding/import.tsx` — source tabs, Bunpro-only skip buttons]
- [Source: `mobile/src/app/onboarding/import-summary.tsx` — post-confirm navigation to fix]
- [Source: `mobile/src/app/onboarding/intensity.tsx` — session intensity persistence]
- [Source: `mobile/src/hooks/useOnboardingRedirect.ts` — redirect allowlist to extend]
- [Source: `mobile/src/data/user/preferencesRepository.ts` — JLPT level + intensity + completion prefs]
- [Source: `_bmad-output/implementation-artifacts/3-5-import-summary-and-unmatched-transparency.md` — preview/confirm patterns, do not regress]
- [Source: `_bmad-output/implementation-artifacts/2-5-onboarding-completion-gate-to-main-tabs.md` — completion gate, redirect hook behavior]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

- JLPT level decision: Option A — visible `JlptLevelPicker` on import screen (default N3), with N3 fallback at confirm if unset.
- Added `onboarding_path` preference (`beginner` | `manual` | `import`) to branch intensity continue and redirect hook; falls back to `import_metadata` row count when path unset.

### Completion Notes List

- Welcome import card retitled to "I have existing knowledge"; sets `onboarding_path=import` on entry via `router.push`.
- Import screen: JLPT picker, FR50 network notice on WaniKani/Bunpro, global "Mark manually instead" skip (replaces Bunpro-only buttons).
- Post-import confirm routes to intensity; sets `onboarding_path=import` and JLPT fallback.
- Intensity branches: import path → complete (optional "Mark items manually" → calibrate); manual/beginner → calibrate.
- `useOnboardingRedirect` extended for `import-summary` allowlist and import-path completion routing.
- Code review fixes: `import` screen + pending-import `welcome` allowed when intensity unset; shared `onboardingPathUtils`; `import.test.tsx`; `onboarding_path` preference tests.
- 240 tests passing; lint and typecheck clean.

### File List

- `mobile/src/app/onboarding/welcome.tsx`
- `mobile/src/app/onboarding/welcome.test.tsx` (new)
- `mobile/src/app/onboarding/import.tsx`
- `mobile/src/app/onboarding/import.test.tsx` (new)
- `mobile/src/app/onboarding/import-summary.tsx`
- `mobile/src/app/onboarding/import-summary.test.tsx`
- `mobile/src/app/onboarding/intensity.tsx`
- `mobile/src/app/onboarding/intensity.test.tsx`
- `mobile/src/hooks/useOnboardingRedirect.ts`
- `mobile/src/hooks/useOnboardingRedirect.test.tsx`
- `mobile/src/data/user/preferencesRepository.ts`
- `mobile/src/data/user/preferencesRepository.test.ts`
- `mobile/src/data/user/onboardingPathUtils.ts` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Senior Developer Review (AI)

**Reviewer:** Riyaz (Composer) on 2026-06-14  
**Outcome:** Approve (after fixes)

### Findings addressed

1. **HIGH** — Redirect hook omitted `import` from no-intensity allowlist; fixed via `onImportBranch` + `isPendingImportBranch` for welcome.
2. **HIGH** — Back from import after JLPT selection trapped user on intensity; fixed by allowing welcome when pending import branch.
3. **MEDIUM** — Added `import.test.tsx` (FR50 notice, skip → intensity/manual path, JLPT persist).
4. **MEDIUM** — Added `onboarding_path` round-trip tests in `preferencesRepository.test.ts`.
5. **MEDIUM** — File List updated to include sprint-status and new files.
6. **LOW** — Extracted `isImportOnboardingPath` to `onboardingPathUtils.ts`; removed `welcome` from post-intensity import-path allowlist.

## Change Log

- 2026-06-14 — Story 3.6: Wire onboarding import branch (welcome entry, skip, intensity continuation, redirect allowlist, FR50 notice, tests).
- 2026-06-14 — Code review: redirect allowlist fixes, shared onboarding path utils, import + preference tests (240 passing).
