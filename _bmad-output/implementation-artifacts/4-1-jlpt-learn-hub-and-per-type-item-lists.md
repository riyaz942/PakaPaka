# Story 4.1: JLPT Learn hub and per-type item lists

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a **learner**,
I want **to browse kanji, vocabulary, and grammar by JLPT level**,
so that **I know what to study next in structure (FR1, FR2, FR3)**.

## Acceptance Criteria

1. **Learn tab replaces Epic 1 radical verification slice with JLPT hub (FR1–FR3)**

   **Given** bundled `curriculum.db` with N5 seed content (114 items: 25 radicals, 32 kanji, 41 vocabulary, 16 grammar)  
   **When** I open the **Learn** tab  
   **Then** the Epic 1.7 radical-only placeholder (`useRadicals('N5')` scroll list) is replaced with a **JLPT Learn hub**  
   **And** I can select a JLPT level (N5→N1) via a level picker  
   **And** the picker defaults to my `starting_jlpt_level` from `user.db` when set (onboarding), else **N5**  
   **And** for the selected level I see **separate sections or navigable cards** for **Kanji**, **Vocabulary**, and **Grammar** each showing an **item count** for that level  
   **And** the `__DEV__` "Epic 4 will replace with full Learn hub" subtitle is removed

2. **Per-type item lists with curriculum data (FR1–FR3)**

   **Given** I have selected a JLPT level on the hub  
   **When** I open a type (kanji, vocabulary, or grammar) — via inline type tabs **or** navigation to `/learn/[level]`  
   **Then** I see a scrollable list of items for that level and type loaded from `curriculum.db` via `listItemsByLevelAndType`  
   **And** each row shows at minimum `primaryForm` and `meaning` (reuse `CurriculumListItem` shape)  
   **And** items are ordered by `sort_order` ascending  
   **And** kanji rows use `text-display` / radical accent styling; grammar rows use `font-mono` — match `CalibrationItemRow` typography conventions  
   **And** list uses `FlatList` (not `ScrollView`) for virtualization per UX spec  
   **And** tapping a row is **optional** for this story — navigation to item detail (`/learn/item/[id]`) is **out of scope** (Stories 4.2–4.5)

3. **Counts without loading full lists (NFR2)**

   **Given** the hub displays per-type counts for a JLPT level  
   **When** counts are computed  
   **Then** they use a dedicated `COUNT(*)` repository query (e.g. `countItemsByLevelAndType` or batch `countItemsByLevel`) — **not** loading full item arrays for each type  
   **And** standard list queries for a single type at N5 complete within the architecture **&lt;100ms** budget on mid-range devices (NFR2) — indexed `WHERE item_type = ? AND jlpt_level = ?` on `items`  
   **And** no cross-database `ATTACH` is required — query `curriculumDb` only for lists; study-status merge is optional read-only for this story

4. **Navigation and layout compliance (UX-DR18, drill-down depth)**

   **Given** the architecture route tree  
   **When** nested Learn routes are added  
   **Then** root `mobile/src/app/_layout.tsx` registers a `learn` stack screen (`headerShown: false`) alongside `(tabs)`, `onboarding`, `review`  
   **And** drill-down follows UX pattern: **list → detail max depth 2** — this story implements hub + per-type list only (depth 1 from tab); item detail is deferred  
   **And** Learn tab remains in the 5-tab bar; nested `/learn/[level]` pushes on the root stack (tab bar visible unless architecture later changes)  
   **And** content respects safe areas, `MaxContentWidth`, `BottomTabInset`, NativeWind tokens, 44px touch targets on pickers

5. **Empty and loading states**

   **Given** a JLPT level or type has zero items in seed data (e.g. N1 not yet seeded)  
   **When** the list renders  
   **Then** an empty state shows explanatory copy and optional next action — never a blank screen (UX empty-state rules)  
   **And** while database is initializing, show loading indicator (follow `DatabaseProvider` / `useDatabase` guard pattern from `calibrate.tsx`)

6. **Tests and CI**

   **Given** implementation is complete  
   **When** CI runs in `mobile/`  
   **Then** `npm run lint`, `npm run typecheck`, and `npm test` pass  
   **And** `itemRepository.test.ts` covers new count query(ies) against mock SQLite  
   **And** screen tests cover: hub renders type counts for selected level; type switch updates list; default level from preferences  
   **And** existing onboarding/calibration tests remain green (no regressions to `useCalibrationItems` / `calibrate.tsx`)

## Tasks / Subtasks

- [x] **AC1 — Replace Learn tab placeholder with JLPT hub**
  - [x] Refactor `mobile/src/app/(tabs)/learn.tsx` — remove `useRadicals` / `MnemonicImage` radical verification UI
  - [x] Add `JlptLevelPicker` (reuse or move from `components/onboarding/JlptLevelPicker.tsx` to `components/learn/` or `components/common/`)
  - [x] Read default level: `getStartingJlptLevel(userDb)` with fallback `'N5'`
  - [x] Display three type sections/cards (Kanji, Vocabulary, Grammar) with counts for selected level
  - [x] Remove `__DEV__` Epic 4 subtitle

- [x] **AC2 — Per-type item lists**
  - [x] Create `mobile/src/app/learn/_layout.tsx` (Stack, `headerShown: false`) and `mobile/src/app/learn/[level].tsx`
  - [x] Register `learn` in root `_layout.tsx` Stack
  - [x] On hub: tapping a type card navigates `router.push(\`/learn/${level}?type=kanji\`)` (or equivalent state param)
  - [x] Level screen: type tabs (reuse `CalibrationItemTypePicker` pattern filtered to kanji/vocabulary/grammar) + `FlatList`
  - [x] Create `mobile/src/components/learn/LearnItemRow.tsx` — read-only row (`primaryForm`, `meaning`); no `ItemStudyStatusPicker` (editing deferred to Epic 4+ per Story 2.3)
  - [x] Create `mobile/src/data/hooks/useLearnItems.ts` — generalize `useCalibrationItems` (same signature pattern: level + itemType → items + loading)

- [x] **AC3 — Count queries (NFR2)**
  - [x] Add `countItemsByLevelAndType(db, jlptLevel, itemType): number` to `itemRepository.ts`
  - [x] Add `countItemsByLevel(db, jlptLevel): Record<ItemType, number>` or single grouped query for hub efficiency
  - [x] Create `mobile/src/data/hooks/useItemCountsByLevel.ts` for hub consumption
  - [x] Extend `itemRepository.test.ts` with count assertions (N5: kanji 32, vocabulary 41, grammar 16)

- [x] **AC4 — Layout and accessibility**
  - [x] Apply `SafeAreaView`, `MaxContentWidth`, `BottomTabInset` on hub and level screens
  - [x] `accessibilityRole` / `testID` on level picker and type tabs (mirror onboarding pickers)
  - [x] Optional: persist last-selected Learn level in component state only (no new preference key required for MVP)

- [x] **AC5 — Empty / loading states**
  - [x] Empty copy per type: `No ${ITEM_TYPE_LABELS[itemType]} at ${level} yet.` (reuse `calibrate.tsx` pattern)
  - [x] `ActivityIndicator` while `useDatabase` / hook loading

- [x] **AC6 — Tests**
  - [x] `learn.test.tsx` — hub counts, level change, navigation to level screen
  - [x] `learn/[level].test.tsx` or combined — type tab switches list content
  - [x] `itemRepository.test.ts` — count functions
  - [x] Run `npm run lint`, `npm run typecheck`, `npm test` in `mobile/`

## Dev Notes

### Epic context (Epic 4)

Epic 4 delivers the **structured curriculum browsing experience** outside the timed review loop: JLPT-organized content, item detail screens, dependency visibility, personal mnemonics, and reading passages.

**This story (4.1)** is the **foundation**: JLPT Learn hub + per-type browse lists. Everything else in Epic 4 builds on these routes and queries.

| Story | Scope | Depends on 4.1 |
| --- | --- | --- |
| 4.2 | Radical detail + mnemonic image | Routes, list → detail navigation |
| 4.3 | Kanji detail (readings, meanings) | Item list rows become tappable |
| 4.4 | Vocabulary detail | Same |
| 4.5 | Grammar detail | Same |
| 4.6 | Reading passages | Separate `read/` routes |
| 4.7 | Dependency unlock visibility | Locked state on list rows |
| 4.8 | Personal mnemonics editor | Item detail screen |

**Epic 4 kickoff:** This is the first story — sets `epic-4` to `in-progress` in sprint-status.

### Current state — what exists vs what to build

**Already implemented (reuse, do not rebuild):**

| Asset | Location | Reuse for 4.1 |
| --- | --- | --- |
| `listItemsByLevelAndType` | `data/curriculum/itemRepository.ts` | Per-type list queries |
| `ITEM_TYPES`, `ITEM_TYPE_LABELS`, `CurriculumListItem` | `itemRepository.ts` | Types and labels |
| `JLPTLevel`, `JLPT_LEVELS` | `data/curriculum/curriculum.types.ts` | Level picker |
| `useCalibrationItems` | `data/hooks/useCalibrationItems.ts` | Template for `useLearnItems` |
| `JlptLevelPicker` | `components/onboarding/JlptLevelPicker.tsx` | Level selection UI |
| `CalibrationItemTypePicker` | `components/onboarding/CalibrationItemTypePicker.tsx` | Type tab pattern |
| `CalibrationItemRow` | `components/onboarding/CalibrationItemRow.tsx` | Typography reference for `LearnItemRow` |
| `getStartingJlptLevel` | `data/user/preferencesRepository.ts` | Default hub level |
| `calibrate.tsx` | `app/onboarding/calibrate.tsx` | **Primary blueprint** for FlatList + type tabs + empty states |
| N5 seed + indexes | `curriculum.db`, `scripts/curriculum-schema.ts` | `idx_items_item_type`, `idx_items_jlpt_level` |
| Learn tab shell | `app/(tabs)/learn.tsx` | Replace content only |
| `useRadicals` / `radicalRepository` | Epic 1.7 | Keep for Story 4.2; remove from Learn tab |

**Gaps this story must fill:**

1. No JLPT hub on Learn tab — only N5 radical verification list
2. No `countItemsByLevelAndType` — `useBulkMarkPresets` loads full lists for counts (inefficient for hub)
3. No `src/app/learn/` nested routes — architecture planned, not implemented
4. No Learn screen tests
5. Root `_layout.tsx` missing `learn` stack registration

### Recommended navigation architecture

Align with `architecture.md` project structure:

```
(tabs)/learn.tsx          → JLPT hub: level picker + type cards with counts
learn/_layout.tsx         → Stack wrapper
learn/[level].tsx         → Type tabs + FlatList for selected level
learn/item/[id].tsx       → Story 4.2+ (do NOT create in 4.1)
```

**Hub → list flow:**

1. User opens Learn tab → sees level picker (default from `starting_jlpt_level` or N5)
2. Hub shows three cards/rows: Kanji (32), Vocabulary (41), Grammar (16) for N5
3. Tap card → `router.push('/learn/N5?type=kanji')` (or push without query and default to kanji tab)
4. Level screen shows type tabs + `FlatList` of items

**Alternative (acceptable if simpler):** Single-screen hub with inline type tabs + list below (no nested route). Prefer nested route if hub and list feel crowded — architecture expects `[level].tsx`.

**Radicals:** AC requires kanji, vocabulary, grammar only. Do **not** expose a radical browse list in 4.1 (Story 4.2). Optional: show radical count on hub as informational only.

### Technical requirements (must follow)

- **Monorepo path:** All code under `mobile/`.
- **Data layer:** Repository functions in `data/curriculum/`; sync `db.getAllSync` / `db.getFirstSync`; map snake_case → camelCase; **no React in repositories**.
- **Hooks:** Thin wrappers in `data/hooks/` using `useDatabase()` → `curriculumDb` / `userDb`.
- **Do not** implement `attachCurriculumForQuery` — separate DB queries are sufficient (same as `calibrate.tsx`).
- **Do not** add `react-native-fast-image` — not used in this story.
- **Named exports** for components/hooks; **default export** for route files per Expo Router.
- **Token-only styling:** NativeWind classes; no new raw hex.
- **Performance (NFR2):** Use indexed columns; `COUNT(*)` for hub; `getAllSync` acceptable for N5 list sizes (largest type: 41 vocabulary). No perf benchmark test required unless trivial — indexes + small N5 sets satisfy AC.

### Architecture compliance

| Requirement | Implementation |
| --- | --- |
| `learn/[level].tsx` route | Per-type item grid/list |
| `data/curriculum/itemRepository.ts` | Query items by type, level |
| Dual-DB separation | Curriculum reads only on `curriculumDb` |
| 5-tab shell preserved | Learn tab stays in `(tabs)` |
| Drill-down depth ≤ 2 | Hub + list only; no item detail yet |
| FR1 kanji by JLPT | Kanji list per level |
| FR2 vocabulary by JLPT | Vocabulary list per level |
| FR3 grammar by JLPT | Grammar list per level |
| NFR2 &lt;100ms queries | Indexed `items` table; COUNT for hub |

### File structure guidance

**Create:**

| Path | Purpose |
| --- | --- |
| `mobile/src/app/learn/_layout.tsx` | Learn stack layout |
| `mobile/src/app/learn/[level].tsx` | Per-level type tabs + item list |
| `mobile/src/components/learn/LearnItemRow.tsx` | Read-only list row |
| `mobile/src/components/learn/JlptLevelPicker.tsx` | Move/re-export from onboarding OR shared `components/common/` |
| `mobile/src/data/hooks/useLearnItems.ts` | Items hook for Learn screens |
| `mobile/src/data/hooks/useItemCountsByLevel.ts` | Hub count hook |
| `mobile/src/app/(tabs)/learn.test.tsx` | Hub screen tests |
| `mobile/src/app/learn/[level].test.tsx` | Level list tests (optional combine with hub) |

**Modify:**

| Path | Change |
| --- | --- |
| `mobile/src/app/(tabs)/learn.tsx` | Replace radical placeholder with hub |
| `mobile/src/app/_layout.tsx` | Add `Stack.Screen name="learn"` |
| `mobile/src/data/curriculum/itemRepository.ts` | Add count query functions |
| `mobile/src/data/curriculum/itemRepository.test.ts` | Count query tests |

**Reuse without modification (initially):**

| Path | Notes |
| --- | --- |
| `components/onboarding/CalibrationItemTypePicker.tsx` | Filter to 3 types or pass `allowedTypes` prop |
| `data/hooks/useCalibrationItems.ts` | Keep for onboarding; don't break |
| `data/curriculum/radicalRepository.ts` | For 4.2, not 4.1 hub |

**Do NOT create in 4.1:**

| Path | Deferred to |
| --- | --- |
| `learn/item/[id].tsx` | Stories 4.2–4.5 |
| `core/content/dependencyGraph.ts` usage in lists | Story 4.7 |
| `LevelProgressBar` on Learn | Epic 6 / Home |
| Study status editing on Learn rows | Epic 4+ (Story 2.3 note) |
| `MnemonicImage` on list rows | Story 4.2 detail |

### UX references (must follow)

- **UX-DR18:** Learn is one of five tabs — hub must feel native to tab context, not a modal.
- **Drill-down (Learn):** Stack navigation list → detail; max depth 2. This story = depth 1 (hub/list).
- **Empty state (Learn):** "You've completed all N5 lessons! Level up when your reviews are ready." + progress bar — **defer full celebration** to Epic 6; for 4.1 use simple empty copy when a level/type has zero items.
- **Lists:** `FlatList`, content column capped at ~500px on tablets (`MaxContentWidth`).
- **Typography:** Kanji/radical `text-display`; grammar `font-mono`; meanings `text-body text-primary`.
- **Touch targets:** 44px minimum on picker controls.

### Database schema reference

`items` table (from `scripts/curriculum-schema.ts`):

```sql
CREATE TABLE items (
  id INTEGER PRIMARY KEY NOT NULL,
  item_type TEXT NOT NULL CHECK(item_type IN ('radical', 'kanji', 'vocabulary', 'grammar')),
  jlpt_level TEXT NOT NULL,
  slug TEXT NOT NULL,
  primary_form TEXT NOT NULL,
  meaning TEXT NOT NULL,
  ...
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (item_type, slug)
);
CREATE INDEX idx_items_item_type ON items(item_type);
CREATE INDEX idx_items_jlpt_level ON items(jlpt_level);
```

**N5 bundled counts:** 25 radicals, 32 kanji, 41 vocabulary, 16 grammar (114 total).

**Suggested count query:**

```ts
export function countItemsByLevelAndType(
  db: SQLiteDatabase,
  jlptLevel: JLPTLevel,
  itemType: ItemType,
): number {
  const row = db.getFirstSync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM items WHERE item_type = ? AND jlpt_level = ?`,
    itemType,
    jlptLevel,
  );
  return row?.count ?? 0;
}
```

### Previous story intelligence

**Epic 3 (just completed):** Onboarding import branch, navigation glue, `useOnboardingRedirect` patterns. No direct Learn impact — ensure onboarding tests still pass.

**Story 1.7 (Learn tab verification):** Introduced `useRadicals`, `MnemonicImage`, radical list on Learn tab. **4.1 removes this slice** but keeps `MnemonicImage` and `radicalRepository` for 4.2. Dev subtitle explicitly said "Epic 4 will replace with full Learn hub".

**Story 2.3 (Study status):** Per-item known/in_progress/not_started in `user.db`. Learn hub editing deferred ("Epic 4+"). Optional read-only badge on rows is polish, not required.

**Story 2.4 (Bulk mark):** `useBulkMarkPresets` loads all types via `listItemsByLevelAndType` — do not copy this pattern for hub counts; add COUNT queries instead.

**Story 1.4 (Tab shell):** Five tabs + review modal. Learn tab route name `learn` → `learn.tsx`. Do not add sixth tab.

**Primary implementation blueprint:** `mobile/src/app/onboarding/calibrate.tsx` — copy its FlatList, type picker, empty message, and dual-DB loading patterns; strip onboarding-specific status picker and navigation.

### Git intelligence summary

Recent commits (Epic 3 complete):
- `dce09e9` — Story 3.6 onboarding import branch routing
- `d06f3ec` — Story 3.5 import summary
- `04a9dfd` — Story 3.4 Anki import
- `25dc8a6` — Story 3.3 Bunpro
- `933a3e6` — Story 3.2 WaniKani

Epic 4 starts fresh on navigation + curriculum browse — build on established data layer from Epics 1–2, not import code.

### Scope boundaries

**In scope:**
- JLPT level hub on Learn tab
- Per-type kanji/vocabulary/grammar lists per level
- Count queries for hub
- Nested `learn/[level]` route (architecture-aligned)
- Empty/loading states
- Repository + screen tests

**Out of scope (defer):**
- Item detail screens (`learn/item/[id].tsx`) — Stories 4.2–4.5
- Radical browse list — Story 4.2
- Dependency lock/unlock UI — Story 4.7
- Study status editing from Learn — Epic 4+ beyond 4.1
- Personal mnemonics — Story 4.8
- Reading passages — Story 4.6 (`read/` tab)
- Home "Learn" button routing to specific level — Epic 6
- `LevelProgressBar` component — Epic 6
- Cross-DB attach for SRS stage on list rows — Epic 5/6
- Search within Learn — future
- Persisting last-viewed Learn level to `user_preferences` — optional polish

### Project Structure Notes

- Align with unified architecture tree under `mobile/src/app/learn/`.
- Consider extracting `JlptLevelPicker` to `components/common/` if both onboarding and Learn import it — avoids onboarding coupling; either move or re-export from `components/learn/`.
- `components/learn/index.ts` barrel optional — follow existing `components/review/index.ts` pattern if multiple exports.

### Latest tech information

- **Expo SDK 55** + **expo-router** Stack for nested `learn` routes — same pattern as `review/` and `onboarding/`.
- **expo-sqlite** sync API (`getAllSync`, `getFirstSync`) — established project convention; no async migration needed.
- **NativeWind** utility classes — no new UI libraries.
- **@testing-library/react-native** — screen test pattern from `welcome.test.tsx`, `calibrate` onboarding tests.

No new npm dependencies expected for this story.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4, Story 4.1 AC]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR1, FR2, FR3, NFR2]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — `src/app/learn/`, `itemRepository.ts`, dual-DB, project structure]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Drill-down depth, FlatList, empty states, tab navigation]
- [Source: `_bmad-output/implementation-artifacts/1-7-cached-radical-mnemonic-images-and-maintainer-r2-workflow.md` — Learn tab placeholder to replace]
- [Source: `_bmad-output/implementation-artifacts/1-4-five-tab-app-shell-with-hidden-review-route-placeholder.md` — Tab shell constraints]
- [Source: `mobile/src/app/onboarding/calibrate.tsx` — List + type picker blueprint]
- [Source: `mobile/src/data/curriculum/itemRepository.ts` — Existing list query]
- [Source: `scripts/curriculum-schema.ts` — `items` table and indexes]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

- Extended `__mocks__/expo-sqlite.ts` to support `COUNT(*)` and grouped count queries on `items` table for repository tests.

### Completion Notes List

- Replaced Epic 1.7 radical verification list on Learn tab with JLPT hub: level picker (defaults from `starting_jlpt_level` or N5), type cards with efficient COUNT-based totals, loading state.
- Added nested `learn/[level]` stack route with filtered type tabs and virtualized `FlatList` via `useLearnItems` / `LearnItemRow`.
- Added `countItemsByLevelAndType`, `countItemsByLevel`, and `useItemCountsByLevel` for hub counts without loading full item arrays.
- Moved `JlptLevelPicker` to `components/common/` with onboarding re-export; extended `CalibrationItemTypePicker` with optional `allowedTypes`.
- All 250 mobile tests pass; lint and typecheck clean.
- Code review fixes: moved learn drill-down under `(tabs)/learn/` stack (tab bar stays visible per AC4); added Back affordance on level list; synced `itemType` state with URL `type` param; removed root `learn` stack registration.

### File List

- mobile/src/app/(tabs)/learn/_layout.tsx (new)
- mobile/src/app/(tabs)/learn/index.tsx (new)
- mobile/src/app/(tabs)/learn/index.test.tsx (new)
- mobile/src/app/(tabs)/learn/[level].tsx (new)
- mobile/src/app/(tabs)/learn/[level].test.tsx (new)
- mobile/src/app/_layout.tsx (modified)
- mobile/src/components/common/JlptLevelPicker.tsx (new)
- mobile/src/components/learn/LearnItemRow.tsx (new)
- mobile/src/components/onboarding/CalibrationItemTypePicker.tsx (modified)
- mobile/src/components/onboarding/JlptLevelPicker.tsx (modified — re-export)
- mobile/src/data/curriculum/itemRepository.ts (modified)
- mobile/src/data/curriculum/itemRepository.test.ts (modified)
- mobile/src/data/hooks/useLearnItems.ts (new)
- mobile/src/data/hooks/useItemCountsByLevel.ts (new)
- mobile/__mocks__/expo-sqlite.ts (modified)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified)

### Change Log

- 2026-06-14: Story 4.1 — JLPT Learn hub, per-type browse lists, COUNT queries, nested learn routes, and screen/repository tests.
- 2026-06-14: Code review — nested learn routes under Learn tab stack, back navigation, URL param sync; story marked done.

## Senior Developer Review (AI)

**Reviewer:** Riyaz (Composer) on 2026-06-14  
**Outcome:** Approve (after fixes)

### Findings addressed

| Severity | Issue | Resolution |
| --- | --- | --- |
| HIGH | Root-stack `/learn/[level]` hid tab bar (AC4) | Moved hub + level list to `(tabs)/learn/` stack; removed root `learn` screen |
| HIGH | No back affordance on level list | Added `learn-level-back` button calling `router.back()` |
| MEDIUM | `sprint-status.yaml` not in File List | Documented in File List |
| MEDIUM | `itemType` stale when URL `type` param changes | `useEffect` syncs from `params.type` |
| MEDIUM | `BottomTabInset` mismatched hidden tab bar | Resolved by keeping tab bar visible under tab stack |
| LOW | Misleading repository test name | Renamed to "returns N5 items per type ordered by sort_order" |
