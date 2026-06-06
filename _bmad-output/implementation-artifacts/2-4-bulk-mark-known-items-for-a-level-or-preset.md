# Story 2.4: Bulk mark known items for a level or preset

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a **returning learner**,
I want **to bulk-mark sets of items (e.g. all N5 kanji) as known**,
So that **I avoid re-proving obvious material (FR24)**.

## Acceptance Criteria

1. **Bulk marking onboarding screen (FR24, UX-DR17, Direction F)**

   **Given** I completed Story 2.3 and land on `/onboarding/bulk`  
   **When** the screen renders  
   **Then** it uses `OnboardingStep` with `stepIndex={4}` and `stepCount={4}` (welcome → intensity → calibrate → bulk)  
   **And** the heading reads **"Know a whole group already?"** with subcopy **"Mark everything at your level in one tap. You can still fine-tune item by item on the previous screen."**  
   **And** I see **preset action cards** for my stored `starting_jlpt_level` (from `getStartingJlptLevel`) — each card shows label, item count, and a **Mark as known** action:
   - **All {level} Radicals** — count from `listItemsByLevelAndType(..., 'radical')`
   - **All {level} Kanji**
   - **All {level} Vocabulary**
   - **All {level} Grammar**
   - **Everything at {level}** — sum of all four types at that level  
   **And** presets with **0 items** are hidden (non-N5 levels may have sparse content — expected)  
   **And** counts load from **`curriculum.db` only** via `itemRepository` — no Epic 4 Learn UI dependency  
   **And** touch targets ≥ 44×44 pt; cards use border selected/highlight styling consistent with `LevelPathCard` / `CalibrationItemTypePicker`  
   **And** screen shows loading skeleton or `ActivityIndicator` while counts load (brief — local SQLite)

2. **Confirm and persist bulk known state (FR24, NFR10, architecture transaction rule)**

   **Given** I tap **Mark as known** on a preset card  
   **When** I confirm in a confirmation dialog  
   **Then** matching item IDs are resolved from curriculum (`listItemsByLevelAndType` or all four types for the "Everything" preset)  
   **And** all matching items are written to `user.db` → `item_study_status` with `status = 'known'` inside a **single `withTransactionSync` block** (architecture bulk-update note — avoid SQLite lock stalls)  
   **And** writes use upsert semantics (`ON CONFLICT DO UPDATE`) — same as single-item `setStudyStatus`  
   **And** items already `known` are included in the write (idempotent)  
   **And** items previously `in_progress` or `not_started` become **`known`** (bulk is explicit user intent — no blocking)  
   **And** **`not_started` bulk semantics:** rows are inserted (sparse table grows only for known/in_progress)  
   **And** implementation lives in `itemStudyStatusRepository.bulkSetStudyStatusKnown(userDb, itemIds)` returning `{ updatedCount: number }` where `updatedCount` equals `itemIds.length`  
   **And** no new migration — reuse migration `002_item_study_status` from Story 2.3  
   **And** killing and relaunching the app preserves bulk-marked statuses (verify via calibrate screen or DB read)

3. **Post-action summary feedback**

   **Given** a bulk mark completes successfully  
   **When** the transaction commits  
   **Then** an inline success message appears on the bulk screen: **"{count} {type label} marked as known"** (e.g. "32 kanji marked as known", "114 items marked as known" for full-level preset)  
   **And** the message uses `text-feedback-correct` or success border styling — not color-only (pair with check icon or bold label)  
   **And** the message auto-clears when the user triggers another bulk action or navigates away  
   **And** confirmation dialog copy includes the count: **"Mark {count} {type} as known?"** with **Cancel** / **Mark as known** actions

4. **Onboarding redirect allowlist (regression fix — required)**

   **Given** `starting_jlpt_level` and `session_intensity` are set and `onboarding_completed` is false  
   **When** I am on `/onboarding/bulk` or `/onboarding/complete` (Story 2.5 placeholder)  
   **Then** `useOnboardingRedirect` does **not** redirect me back to `/onboarding/calibrate`  
   **And** cold-start redirect rule remains: level + intensity set, not completed → land on `/onboarding/calibrate` (user re-enters linear flow at calibrate — acceptable until 2.5 adds furthest-step tracking)  
   **And** existing redirect tests for welcome / intensity / calibrate / completed still pass  
   **And** new tests cover: no redirect when segments are `['onboarding', 'bulk']` and `['onboarding', 'complete']`

5. **Advance onboarding (placeholder for Story 2.5)**

   **Given** I reviewed or skipped bulk marking  
   **When** I tap **Continue**  
   **Then** onboarding navigates to `/onboarding/complete` (**placeholder** for Story 2.5 — title + "Finishing setup — coming next" is sufficient)  
   **And** `onboarding_completed` is **not** set in this story  
   **And** per-item and bulk statuses already saved are **not** lost when tapping Continue  
   **And** register `complete` screen in `mobile/src/app/onboarding/_layout.tsx`

6. **Tests and CI**

   **Given** implementation is complete  
   **When** CI runs in `mobile/`  
   **Then** `npm run lint`, `npm run typecheck`, and `npm test` pass  
   **And** unit tests cover: `bulkSetStudyStatusKnown` transaction round-trip; empty `itemIds` returns `{ updatedCount: 0 }` without error; overwrites `in_progress` → `known`; idempotent re-mark; invalid IDs rejected  
   **And** `bulk.test.tsx` (or screen test): renders preset cards with mocked counts; confirm triggers repository; success message shows count; Continue navigates to complete placeholder; zero-count presets hidden  
   **And** `useOnboardingRedirect.test.tsx` extended for bulk + complete allowlist  
   **And** existing `calibrate.test.tsx` still passes (Continue → bulk)

## Tasks / Subtasks

- [x] **AC1 — Replace bulk placeholder with real screen**
  - [x] Rewrite `mobile/src/app/onboarding/bulk.tsx` using `OnboardingStep` (mirror `calibrate.tsx` / `intensity.tsx` structure).
  - [x] Create `mobile/src/components/onboarding/BulkMarkPresetCard.tsx` — card with title, count sublabel, and Mark as known button.
  - [x] Create `mobile/src/data/hooks/useBulkMarkPresets.ts` — loads `starting_jlpt_level`, queries counts per type + total via `itemRepository.listItemsByLevelAndType`.
  - [x] Hide presets where count === 0.
  - [x] Use `Alert.alert` (React Native) for confirmation — no new modal dependency unless project already has a confirm bottom sheet.

- [x] **AC2 — Repository bulk write**
  - [x] Add `bulkSetStudyStatusKnown(userDb, itemIds: string[]): { updatedCount: number }` to `itemStudyStatusRepository.ts`.
  - [x] Wrap all upserts in `userDb.withTransactionSync(() => { ... })`.
  - [x] Reuse `parseItemId` validation; throw on invalid IDs before transaction.
  - [x] Optional helper: `listItemIdsByLevelAndType(curriculumDb, level, type)` in `itemRepository.ts` if cleaner than mapping full list items — keep DRY with `listItemsByLevelAndType`.

- [x] **AC3 — Success feedback**
  - [x] Local `successMessage` state on bulk screen; set after successful bulk write.
  - [x] Format message with singular/plural type labels matching `ITEM_TYPE_LABELS` from calibrate.

- [x] **AC4 — Redirect hook fix**
  - [x] Update `mobile/src/hooks/useOnboardingRedirect.ts` — add `onBulk` and `onComplete` to the allowlist alongside `onCalibrate`, `onWelcome`, `onIntensity`.
  - [x] Extend `useOnboardingRedirect.test.tsx`.

- [x] **AC5 — Complete placeholder + navigation**
  - [x] Create `mobile/src/app/onboarding/complete.tsx` — minimal placeholder for Story 2.5 (`OnboardingStep`, disabled Continue or no primary action).
  - [x] Register `complete` in `_layout.tsx`.
  - [x] `bulk.tsx` Continue → `router.replace('/onboarding/complete')`.

- [x] **AC6 — Tests**
  - [x] `itemStudyStatusRepository.test.ts` — bulk write cases.
  - [x] `bulk.test.tsx` — screen integration with mocked DB/repository.
  - [x] `useOnboardingRedirect.test.tsx` — bulk/complete allowlist.

- [x] **Manual verification**
  - [x] Path: calibrate → bulk → tap "All N5 Kanji" → confirm → see "32 kanji marked as known" → Continue → complete placeholder.
  - [x] Return to calibrate — bulk-marked kanji show **Known**.
  - [x] Force-quit on bulk screen — relaunch lands on calibrate (expected); bulk marks persist.
  - [x] N5 "Everything at N5" marks all 114 items (25+32+41+16).

## Dev Notes

### Epic context (Epic 2)

Epic 2 delivers the **first-run path without an account**: JLPT starting level (✅ 2.1), session intensity (✅ 2.2), per-item calibration (✅ 2.3), bulk calibration (**this story**), then handoff to main tabs (2.5).

**Story 2.3 delivered:** `item_study_status` table (migration 002), `itemStudyStatusRepository`, per-item calibration UI on `/onboarding/calibrate`, `itemRepository.listItemsByLevelAndType`, `bulk.tsx` placeholder at step 4/4, Continue from calibrate → bulk.

**This story (2.4)** replaces the bulk placeholder with preset bulk-mark-known actions, adds batched transactional writes, summary feedback, redirect allowlist fix, and a `complete.tsx` placeholder for 2.5.

**Out of scope for 2.4 (do not implement):**

| Area | Deferred to |
| --- | --- |
| `onboarding_completed = true` + skip to `(tabs)` | Story 2.5 |
| Furthest-onboarding-step resume (relaunch → bulk) | Story 2.5 (optional enhancement) |
| Bulk mark **in progress** (only **known** per FR24) | Future / import flows |
| Undo / revert bulk operation | Future |
| `srs_states` seeding for bulk-known items | Story 5.1 / Epic 3 import |
| Strict dependency gating on bulk mark | Epic 4/5 (same as 2.3 — allow self-report) |
| Learn tab or Settings bulk actions | Epic 4+ |
| WaniKani / Anki import bulk mapping | Epic 3 (may **reuse** `bulkSetStudyStatusKnown`) |
| New npm dependencies | Not needed |

### Technical requirements (must follow)

- **Bulk write contract:** `bulkSetStudyStatusKnown` is the shared API for onboarding presets **and** future import stories — keep signature stable.
- **Transaction required:** Architecture mandates `withTransactionSync` for multi-row writes ([Source: `architecture.md` — SQLite Transaction Pattern]). Story 2.3 used single-row writes without transactions; **2.4 bulk must use a transaction**.
- **Recommended implementation:**

```typescript
export function bulkSetStudyStatusKnown(
  userDb: SQLiteDatabase,
  itemIds: string[],
): { updatedCount: number } {
  if (itemIds.length === 0) {
    return { updatedCount: 0 };
  }

  const numericIds = itemIds.map(parseItemId);
  const updatedAt = new Date().toISOString();

  userDb.withTransactionSync(() => {
    for (const itemId of numericIds) {
      userDb.runSync(
        `INSERT INTO item_study_status (item_id, status, updated_at) VALUES (?, 'known', ?)
         ON CONFLICT(item_id) DO UPDATE SET status = 'known', updated_at = excluded.updated_at`,
        itemId,
        updatedAt,
      );
    }
  });

  return { updatedCount: numericIds.length };
}
```

- **Performance:** N5 max ~114 items per full-level preset — per-row upsert inside one transaction is sufficient. Do **not** add chunking unless profiling shows lock stalls (unlikely at this scale).
- **Sparse rows:** Bulk known **inserts** rows. Do not insert `not_started` rows. `clearStudyStatus` / not_started semantics unchanged from 2.3.
- **Layer boundaries:** SQLite in repositories; UI in `app/onboarding/` + `components/onboarding/`; **no** `expo-sqlite` in components.
- **Reuse Story 2.3 patterns:** `OnboardingStep`, `Button`, `useDatabase()`, `router.replace()`, NativeWind tokens, 44pt touch targets, immediate persistence on confirm.
- **Curriculum queries:** Reuse `listItemsByLevelAndType` — do not duplicate SQL. Map to `item.id` strings for repository calls.
- **N5 seed counts (sanity check):** 25 radicals, 32 kanji, 41 vocabulary, 16 grammar — total **114** for "Everything at N5" ([Source: Story 1.5 / 2.3 completion notes]).

### Redirect hook fix (critical — without this, bulk screen breaks)

Current `useOnboardingRedirect` only allowlists `calibrate`, `welcome`, and `intensity`. Users on `/onboarding/bulk` get redirected to calibrate on any segment change or relaunch within onboarding.

```49:53:mobile/src/hooks/useOnboardingRedirect.ts
    if (!onCalibrate && !onWelcome && !onIntensity) {
      if (!inOnboarding || segmentList[1] === 'import') {
        router.replace('/onboarding/calibrate');
      }
    }
```

**Fix:** Add `onBulk` and `onComplete` checks to this condition. Do **not** change cold-start default (still `/onboarding/calibrate`).

### UX compliance (Direction F + UX-DR17)

| Element | Spec |
| --- | --- |
| Heading | "Know a whole group already?" — `text-title-lg` |
| Subcopy | `text-secondary` — references previous calibrate step |
| Preset cards | `bg-surface`, `border-border`, `rounded-radius-md`, count as `text-caption text-secondary` |
| Mark action | Secondary or tertiary button per card — label **"Mark as known"** |
| Confirmation | Native `Alert.alert` — title **"Mark as known?"**, message with count |
| Success | Inline banner — `border-feedback-correct` + check + **"{n} {type} marked as known"** |
| Primary CTA | Full-width **"Continue"** — always enabled (bulk is optional) |
| Progress | Dots — step 4 of 4 |
| Skip | Not required — Continue alone is sufficient |

Reference: Direction F — "Choose your JLPT level and mark what you already know" ([Source: `ux-design-directions.html` — `#dir-f`]). Bulk is the fast path after per-item calibrate.

### Architecture compliance

| Requirement | Implementation |
| --- | --- |
| FR24 Bulk-mark known items | Preset cards + `bulkSetStudyStatusKnown` |
| FR26 No account | Local SQLite only; no network |
| Dual-DB separation | Curriculum read for IDs/counts; user writes only |
| Migration discipline | No new migration — reuse `002` |
| Transactions | `withTransactionSync` for bulk writes |
| Naming conventions | `snake_case` columns; `bulkSetStudyStatusKnown` camelCase function |
| NFR10 Progress survives curriculum swap | Study status in `user.db` untouched by OTA curriculum replace |

### File structure (this story)

```
mobile/src/
├── app/
│   └── onboarding/
│       ├── _layout.tsx                # MODIFY — register complete screen
│       ├── bulk.tsx                   # MODIFY — replace placeholder
│       ├── complete.tsx               # NEW — placeholder for 2.5
│       └── bulk.test.tsx              # NEW
├── components/
│   └── onboarding/
│       └── BulkMarkPresetCard.tsx     # NEW
├── data/
│   ├── curriculum/
│   │   └── itemRepository.ts          # MODIFY only if helper needed
│   ├── hooks/
│   │   └── useBulkMarkPresets.ts      # NEW
│   └── user/
│       ├── itemStudyStatusRepository.ts    # MODIFY — add bulkSetStudyStatusKnown
│       └── itemStudyStatusRepository.test.ts  # MODIFY
└── hooks/
    ├── useOnboardingRedirect.ts       # MODIFY — bulk/complete allowlist
    └── useOnboardingRedirect.test.tsx # MODIFY
```

**Do not modify** `calibrate.tsx` except if Continue target already correct (`/onboarding/bulk` — verify unchanged).

### Previous story intelligence (Story 2.3)

- **Patterns that work:** `OnboardingStep` + full-width Continue; typed repository with validation; immediate persistence; `statusesReady` gate before list render; batched curriculum queries (`getRequiredParentLabelsForItems`).
- **Placeholder pattern:** Story 2.3 created `bulk.tsx` placeholder — **replace entirely** with real UI; follow same pattern for new `complete.tsx` placeholder for 2.5.
- **Component reuse:** `CalibrationItemTypePicker` labels/types — import `ITEM_TYPES` / `ItemType` from `itemRepository`; share `ITEM_TYPE_LABELS` constant (extract to shared file or duplicate minimally — prefer extract to `itemRepository.ts` or `onboarding/constants.ts` if calibrate and bulk both need it).
- **Code review notes from 2.3:** FlatList needs `flex-1`; batch DB reads; capitalize type labels in user-facing strings; `bulk.tsx` must use `OnboardingStep` step 4/4.
- **Redirect gap:** 2.3 did not update redirect for bulk — **2.4 must fix** or bulk screen is unusable after navigation.
- **Do not regress:** Per-item calibrate flow, migration 002, sparse not_started deletes, `calibrate.test.tsx` Continue → bulk.

### Git intelligence (recent commits)

| Commit | Relevance |
| --- | --- |
| `b3bfd33` Per-item study status / calibrate | Direct predecessor — bulk placeholder, `itemStudyStatusRepository`, `itemRepository` |
| `e150fff` Session intensity | OnboardingStep pattern, redirect chain |
| `5b279c9` JLPT onboarding | Preferences, welcome flow |
| `a1b62c3` N5 curriculum seed | Item counts for preset cards |

### Latest tech notes

- **expo-router ~55.0.14** / Expo SDK 55 — add `complete` to onboarding Stack; run app once to refresh generated router types if needed.
- **expo-sqlite** sync API — `withTransactionSync` already mocked in `__mocks__/expo-sqlite.ts` (used by `migrationRunner`).
- **Alert.alert** — React Native built-in; sufficient for confirmation per UX bottom-sheet rules for lightweight 2-action dialogs.
- No new npm dependencies expected.

### Project context reference

- No `project-context.md` in repo. SSOT: `architecture.md`, `epics.md`, `ux-design-specification.md`, `prd.md`.
- PRD FR24: "bulk-mark items when importing existing knowledge (e.g., mark all N5 kanji as known)" — onboarding presets satisfy the manual-marking path; import reuses same repository in Epic 3.
- Product brief: "bulk-mark entire JLPT levels" alongside per-item marking ([Source: `product-brief-japanese-learning-2026-04-12.md`]).
- Implementation readiness: onboarding-only `curriculum.db` queries — no Epic 4 Learn dependency.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.4]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR24]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — SQLite transactions, bulk operations note]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — OnboardingStep, button hierarchy, confirmation patterns]
- [Source: `_bmad-output/planning-artifacts/ux-design-directions.html` — Direction F]
- [Source: `_bmad-output/implementation-artifacts/2-3-per-item-study-status-known-in-progress-not-started.md` — predecessor patterns, out-of-scope table]
- [Source: `mobile/src/app/onboarding/bulk.tsx` — placeholder to replace]
- [Source: `mobile/src/data/user/itemStudyStatusRepository.ts` — extend with bulk write]
- [Source: `mobile/src/data/curriculum/itemRepository.ts` — listItemsByLevelAndType]
- [Source: `mobile/src/hooks/useOnboardingRedirect.ts` — allowlist fix required]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

### Completion Notes List

- Replaced bulk onboarding placeholder with preset cards driven by `useBulkMarkPresets` (curriculum counts per type + "Everything at {level}"); zero-count presets hidden.
- Added `bulkSetStudyStatusKnown` with `withTransactionSync` upserts; exported `ITEM_TYPE_LABELS` from `itemRepository` for shared type naming.
- Bulk screen uses `Alert.alert` confirmation with count copy, inline success banner (`text-feedback-correct`), and Continue → `/onboarding/complete` placeholder.
- Fixed `useOnboardingRedirect` allowlist for `bulk` and `complete` segments so onboarding step 4 is usable.
- Tests: repository bulk cases, `bulk.test.tsx` screen integration, redirect allowlist extensions; `npm run lint`, `typecheck`, and full `npm test` pass (102 tests).
- Regenerated local `mobile/.expo/types/router.d.ts` for `/onboarding/complete` typed route (gitignored Expo artifact).
- Code review fixes: deduplicated `ITEM_TYPE_LABELS` in calibrate and `CalibrationItemTypePicker`; added bulk loading-state test.

### File List

- _bmad-output/implementation-artifacts/sprint-status.yaml
- mobile/src/app/onboarding/_layout.tsx
- mobile/src/app/onboarding/bulk.tsx
- mobile/src/app/onboarding/bulk.test.tsx
- mobile/src/app/onboarding/calibrate.tsx
- mobile/src/app/onboarding/complete.tsx
- mobile/src/components/onboarding/BulkMarkPresetCard.tsx
- mobile/src/components/onboarding/CalibrationItemTypePicker.tsx
- mobile/src/data/curriculum/itemRepository.ts
- mobile/src/data/hooks/useBulkMarkPresets.ts
- mobile/src/data/user/itemStudyStatusRepository.ts
- mobile/src/data/user/itemStudyStatusRepository.test.ts
- mobile/src/hooks/useOnboardingRedirect.ts
- mobile/src/hooks/useOnboardingRedirect.test.tsx

### Senior Developer Review (AI)

_Reviewer: Riyaz on 2026-06-06_

**Outcome:** Approve (after fixes)

**Findings addressed:**
- [x] [MEDIUM] `ITEM_TYPE_LABELS` duplicated in `calibrate.tsx` — now imports from `itemRepository`
- [x] [MEDIUM] `CalibrationItemTypePicker` label drift risk — now derives from `ITEM_TYPES` + `ITEM_TYPE_LABELS`
- [x] [MEDIUM] `sprint-status.yaml` missing from File List — documented
- [x] [LOW] Bulk loading indicator untested — added `hides loading indicator after presets load`

**Deferred (acceptable for 2.5 placeholder):**
- Complete screen shares step 4/4 with bulk until Story 2.5 finalizes onboarding flow

### Change Log

- 2026-06-06: Story 2.4 — bulk mark-known presets, transactional repository write, redirect allowlist, complete placeholder, and tests.
- 2026-06-06: Code review — deduplicated item type labels, loading test, story/sprint status → done.
