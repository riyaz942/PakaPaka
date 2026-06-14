# Story 4.2: Radical detail with mnemonic image

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a **learner**,
I want **radical detail with meaning and mnemonic image**,
so that **radicals stick before kanji (FR4, FR4b, FR27)**.

## Acceptance Criteria

1. **Radical browse list on Learn (FR4, FR27)**

   **Given** bundled `curriculum.db` with N5 radicals (25 rows, each with `visual_mnemonic_url` and `mnemonic_text`)  
   **When** I open the Learn tab and select a JLPT level  
   **Then** I see a **Radicals** type card on the hub with an accurate count (reuse `countItemsByLevel`)  
   **And** tapping it opens the level list screen with `type=radical` showing all radicals for that level ordered by `sort_order`  
   **And** each row shows `primaryForm` (large radical glyph styling) and `meaning`  
   **And** tapping a radical row navigates to that item's detail screen

2. **Radical detail screen with mnemonic image (FR4b, FR27, FR49)**

   **Given** a radical item with optional R2 `visual_mnemonic_url`  
   **When** I open `/learn/item/[id]` for that radical  
   **Then** the screen shows:
   - **Radical glyph** — `primary_form` at `text-display` size (this is the stroke/component visual; there is **no** `stroke_count` column in `items`)  
   - **Meaning** — `meaning` as primary label text  
   - **Text mnemonic** — `mnemonic_text` when present (below meaning or under image)  
   - **Visual mnemonic** — `MnemonicImage` with `imageUrl`, `mnemonicText`, `meaning`, `primaryForm` (reuse Story 1.7 component **unchanged** except optional `className` for larger detail layout)  
   **And** image uses `expo-image` with `cachePolicy="disk"` and text fallback on missing/invalid URL or `onError` — **no** broken-image icon, spinner, or empty box (NFR20, Story 1.7)  
   **And** `accessibilityLabel` on the image uses `buildMnemonicAccessibilityLabel` — never empty (UX-DR33)  
   **And** a **Back** affordance returns to the previous Learn screen (`router.back()`)

3. **Item detail route and data layer (NFR2)**

   **Given** any valid curriculum `items.id`  
   **When** the detail screen loads  
   **Then** it fetches via `getItemById(db, id)` returning `CurriculumItemDetail` (id, slug, itemType, jlptLevel, primaryForm, meaning, mnemonicText, visualMnemonicUrl)  
   **And** query completes within the architecture **&lt;100ms** budget for N5 (indexed `PRIMARY KEY` lookup)  
   **And** invalid or unknown `id` shows an error/empty state with Back — never a blank screen or crash  
   **And** non-radical item types render a minimal placeholder ("Detail for {type} coming soon") so Stories 4.3–4.5 can extend the same route without a new navigation pattern

4. **Dependency links: kanji → required radicals (FR4)**

   **Given** `item_relationships` rows with `relationship_type = 'requires'` (parent radical → child kanji)  
   **When** I view the kanji list on `/learn/[level]?type=kanji`  
   **Then** each kanji row shows required radical names (reuse calibrate dependency-hint pattern)  
   **And** each radical name is **tappable** and navigates to `/learn/item/[radicalId]`  
   **And** the radical detail screen loads the correct item (verify with at least one N5 kanji that has `requires` edges in seed data)  
   **And** use `getRequiredParentsForItems` (new) returning `{ id, primaryForm, itemType }[]` — **do not** duplicate graph logic in components

5. **Navigation depth and layout (UX drill-down)**

   **Given** the Learn tab stack from Story 4.1  
   **When** nested item detail is added  
   **Then** route lives at `mobile/src/app/(tabs)/learn/item/[id].tsx` (tab bar remains visible — same fix as 4.1 code review)  
   **And** register `item/[id]` in `learn/_layout.tsx` Stack  
   **And** drill-down depth stays ≤ 2: hub → level list → item detail (detail is depth 2 from tab)  
   **And** layout uses `SafeAreaView`, `MaxContentWidth`, `BottomTabInset`, NativeWind tokens, 44px touch targets on Back and tappable dependency links

6. **Tests and CI**

   **Given** implementation is complete  
   **When** CI runs in `mobile/`  
   **Then** `npm run lint`, `npm run typecheck`, and `npm test` pass  
   **And** `itemRepository.test.ts` covers `getItemById` and `getRequiredParentsForItems`  
   **And** screen tests cover: radical list navigation to detail; detail renders glyph, meaning, `MnemonicImage`; kanji row dependency link navigates to radical detail  
   **And** existing Learn hub/level tests (Story 4.1) remain green

## Tasks / Subtasks

- [x] **AC1 — Radical browse on Learn hub and level list**
  - [x] Add `'radical'` to hub `HUB_ITEM_TYPES` in `learn/index.tsx`
  - [x] Add `'radical'` to `LEARN_ITEM_TYPES` in `learn/[level].tsx` (or shared constant)
  - [x] Make `LearnItemRow` tappable when `onPress` provided; wire `router.push(\`/learn/item/${item.id}\`)` for radical list
  - [x] Update hub test for radical count card; update level test for radical list

- [x] **AC2 — Radical detail UI**
  - [x] Create `mobile/src/components/learn/RadicalDetail.tsx` — glyph, meaning, mnemonic text, `MnemonicImage` (taller container e.g. `h-48` or `h-56` on detail vs list fallback `h-36`)
  - [x] Create `mobile/src/app/(tabs)/learn/item/[id].tsx` — load item, branch on `itemType === 'radical'`, render `RadicalDetail`
  - [x] Add Back button (`learn-item-back` testID, mirror `learn-level-back` pattern)

- [x] **AC3 — Repository and hook**
  - [x] Add `CurriculumItemDetail` type and `getItemById(db, id)` to `itemRepository.ts`
  - [x] Create `mobile/src/data/hooks/useItemDetail.ts` — `useDatabase` → `getItemById`, loading + not-found state
  - [x] Register `item/[id]` in `learn/_layout.tsx`

- [x] **AC4 — Dependency parent links with IDs**
  - [x] Add `getRequiredParentsForItems(db, itemIds)` returning `Map<string, CurriculumParentItem[]>` where `CurriculumParentItem = { id, primaryForm, itemType }`
  - [x] Refactor `getRequiredParentLabelsForItems` to compose from `getRequiredParentsForItems` (labels only) — **keep existing calibrate behavior**
  - [x] On `learn/[level].tsx` kanji list: fetch parents via `getRequiredParentsForItems`, pass to row component
  - [x] Create `DependencyLinkRow` section in `LearnItemRow` or `KanjiDependencyHints.tsx` — pressable radical names → `/learn/item/[id]`

- [x] **AC5 — Layout and accessibility**
  - [x] Apply safe area + max width on detail screen
  - [x] `accessibilityRole="link"` on dependency radical chips; `accessibilityLabel` per radical

- [x] **AC6 — Tests**
  - [x] `itemRepository.test.ts` — `getItemById`, `getRequiredParentsForItems`
  - [x] `learn/item/[id].test.tsx` — radical detail content + back
  - [x] `learn/[level].test.tsx` — kanji dependency link navigation (mock router)
  - [x] Run `npm run lint`, `npm run typecheck`, `npm test` in `mobile/`

## Dev Notes

### Epic context (Epic 4)

Epic 4 delivers structured curriculum browsing outside the review loop. **Story 4.1** shipped the JLPT hub and per-type lists (kanji, vocabulary, grammar). **This story (4.2)** adds the first **item detail** screen (radicals) and establishes the shared `/learn/item/[id]` route pattern for 4.3–4.5.

| Story | Scope | Builds on 4.2 |
| --- | --- | --- |
| 4.2 | Radical detail + mnemonic image | — |
| 4.3 | Kanji detail (readings, meanings) | Same `item/[id]` route; replace kanji placeholder |
| 4.4 | Vocabulary detail | Same route |
| 4.5 | Grammar detail | Same route |
| 4.7 | Lock/unlock visibility | Extends list rows + detail |
| 4.8 | Personal mnemonics editor | Extends detail screens |

### Current state — what exists vs what to build

**Already implemented (reuse, do not rebuild):**

| Asset | Location | Reuse for 4.2 |
| --- | --- | --- |
| `MnemonicImage` | `components/common/MnemonicImage.tsx` | Radical detail visual mnemonic (Story 1.7) |
| `buildMnemonicAccessibilityLabel` | `utils/mnemonicAccessibilityLabel.ts` | A11y on detail image |
| `listRadicalsByLevel` / `RadicalItem` | `radicalRepository.ts`, `curriculum.types.ts` | Reference only — prefer unified `getItemById` for detail |
| `listItemsByLevelAndType` | `itemRepository.ts` | Radical list via `type=radical` |
| `getRequiredParentLabelsForItems` | `itemRepository.ts` | Refactor to derive from new parents-with-ids query |
| Learn hub + level list | `(tabs)/learn/index.tsx`, `[level].tsx` | Add radical type + navigation |
| `LearnItemRow` | `components/learn/LearnItemRow.tsx` | Extend with `onPress` + dependency hints |
| `CalibrationItemRow` dependency pattern | `onboarding/calibrate.tsx` | Blueprint for kanji dependency hints |
| N5 radicals + R2 URLs | `curriculum/radicals/n5.json`, `curriculum.db` | 25 radicals, HTTPS URLs each |
| `item_relationships` | `curriculum/dependencies/graph.json` → DB | `requires` edges radical→kanji |

**Gaps this story must fill:**

1. No `getItemById` — detail cannot load
2. No `learn/item/[id].tsx` route
3. No radical browse on Learn hub (4.1 intentionally excluded radicals)
4. List rows not tappable — no navigation to detail
5. `getRequiredParentLabelsForItems` returns labels only — no IDs for linking
6. No `RadicalDetail` presentation component

### “Strokes” clarification (prevent schema mistakes)

Epics AC mentions **“strokes”** but the `items` table has **no** `stroke_count` or stroke-order fields ([Source: `scripts/curriculum-schema.ts`]). For radicals, the **glyph** (`primary_form`, e.g. `一`, `口`) **is** the visual stroke/component representation.

**Do NOT** add a migration or JSON field for stroke count in this story. Display `primary_form` at `text-display` (48px per UX spec) on the detail screen. Kanji stroke counts are out of scope until a future curriculum schema story.

### Recommended navigation architecture

Story 4.1 code review moved Learn drill-down under the **tab stack** (tab bar stays visible). Follow that pattern — **not** the root-level `src/app/learn/` tree shown in older architecture diagrams.

```
(tabs)/learn/index.tsx       → Hub (+ Radicals card)
(tabs)/learn/[level].tsx     → Type tabs (+ radical) + FlatList
(tabs)/learn/item/[id].tsx   → Item detail (radical first; other types placeholder)
(tabs)/learn/_layout.tsx     → Stack: index, [level], item/[id]
```

**Flows:**

1. Learn tab → N5 → Radicals (25) → tap 一 → detail with mnemonic image  
2. Learn tab → N5 → Kanji → row shows "Requires: 一, 口" (example) → tap 一 → radical detail  
3. `router.back()` from detail returns to list

### Technical requirements (must follow)

- **Monorepo path:** All code under `mobile/`.
- **Data layer:** Repository functions in `data/curriculum/`; sync `db.getFirstSync` / `db.getAllSync`; snake_case → camelCase; **no React in repositories**.
- **Hooks:** Thin wrappers in `data/hooks/` using `useDatabase()` → `curriculumDb`.
- **Do not** implement `core/content/dependencyGraph.ts` — Story 4.7; use existing SQL on `item_relationships` like calibrate does.
- **Do not** modify `MnemonicImage` behavior (error fallback, cache policy) unless sizing via `className`.
- **Do not** add personal mnemonics UI — Story 4.8.
- **Do not** add SRS stage badges on detail — Epic 5/6.
- **Named exports** for components/hooks; **default export** for route files.
- **Token-only styling:** NativeWind classes; no new raw hex.

### Suggested repository additions

```ts
export type CurriculumItemDetail = {
  id: string;
  slug: string;
  itemType: ItemType;
  jlptLevel: JLPTLevel;
  primaryForm: string;
  meaning: string;
  mnemonicText: string | null;
  visualMnemonicUrl: string | null;
};

export type CurriculumParentItem = {
  id: string;
  primaryForm: string;
  itemType: ItemType;
};

export function getItemById(db: SQLiteDatabase, id: string): CurriculumItemDetail | null {
  const row = db.getFirstSync<ItemDetailRow>(
    `SELECT id, slug, item_type, jlpt_level, primary_form, meaning, mnemonic_text, visual_mnemonic_url
     FROM items WHERE id = ?`,
    Number(id),
  );
  return row ? mapRowToDetail(row) : null;
}

export function getRequiredParentsForItems(
  db: SQLiteDatabase,
  itemIds: string[],
): Map<string, CurriculumParentItem[]> {
  // Same JOIN as getRequiredParentLabelsForItems but SELECT p.id, p.primary_form, p.item_type
}
```

Refactor `getRequiredParentLabelsForItems` to map parents → `primaryForm` strings so `calibrate.tsx` and tests stay green without behavior change.

### Architecture compliance

| Requirement | Implementation |
| --- | --- |
| `learn/item/[id].tsx` | Radical detail (+ type placeholder) |
| `itemRepository.ts` | `getItemById`, parent lookups |
| `MnemonicImage` reuse | FR4b, FR49 cached offline images |
| Dual-DB separation | Detail reads `curriculumDb` only |
| Drill-down depth ≤ 2 | Hub → list → detail |
| FR4 dependency graph | Tappable radical links from kanji list |
| FR27 view mnemonics | Text + visual on radical detail |
| NFR2 &lt;100ms | PK lookup by `id` |

### File structure guidance

**Create:**

| Path | Purpose |
| --- | --- |
| `mobile/src/app/(tabs)/learn/item/[id].tsx` | Item detail route |
| `mobile/src/app/(tabs)/learn/item/[id].test.tsx` | Detail screen tests |
| `mobile/src/components/learn/RadicalDetail.tsx` | Radical presentation |
| `mobile/src/components/learn/KanjiDependencyHints.tsx` | Tappable parent radical links (optional — can live in LearnItemRow) |
| `mobile/src/data/hooks/useItemDetail.ts` | Detail data hook |

**Modify:**

| Path | Change |
| --- | --- |
| `mobile/src/app/(tabs)/learn/_layout.tsx` | Register `item/[id]` screen |
| `mobile/src/app/(tabs)/learn/index.tsx` | Add radicals hub card |
| `mobile/src/app/(tabs)/learn/[level].tsx` | Radical type, row press, kanji dependency hints |
| `mobile/src/components/learn/LearnItemRow.tsx` | `onPress`, optional `dependencyParents` |
| `mobile/src/data/curriculum/itemRepository.ts` | `getItemById`, `getRequiredParentsForItems` |
| `mobile/src/data/curriculum/itemRepository.test.ts` | New query tests |
| `mobile/src/app/(tabs)/learn/index.test.tsx` | Radical count card |
| `mobile/src/app/(tabs)/learn/[level].test.tsx` | Radical navigation + dependency links |

**Reuse without modification (initially):**

| Path | Notes |
| --- | --- |
| `components/common/MnemonicImage.tsx` | Pass `className` for taller detail layout only |
| `data/curriculum/radicalRepository.ts` | Keep for any legacy callers; list uses `listItemsByLevelAndType` |
| `utils/mnemonicAccessibilityLabel.ts` | Do not duplicate label logic |

**Do NOT create in 4.2:**

| Path | Deferred to |
| --- | --- |
| `core/content/dependencyGraph.ts` | Story 4.7 |
| Kanji readings / synonyms UI | Story 4.3 |
| `data/user/mnemonicRepository.ts` usage | Story 4.8 |
| Lock/unlock badges on rows | Story 4.7 |
| Reverse lookup “kanji using this radical” on detail | Optional polish; not in epics AC |

### UX references (must follow)

- **UX-DR33 / line ~1311:** Mnemonic images need meaningful `accessibilityLabel` (full mnemonic description).
- **Drill-down (Learn):** Stack list → detail, max depth 2; Back returns to list.
- **Typography:** Radical glyph `text-display text-primary`; meaning `text-body`; mnemonic text `text-body text-secondary`.
- **Review vs detail:** Rich mnemonic content belongs on detail screens, not review loop (UX clutter rule).
- **Touch targets:** 44px minimum on Back and dependency link chips.
- **Offline:** Cached `MnemonicImage` works offline after first load (FR49).

### Database schema reference

```sql
-- items (radical rows)
visual_mnemonic_url TEXT,  -- HTTPS R2 URL for radicals
mnemonic_text TEXT,        -- e.g. "Radical one (一)"

-- item_relationships
parent_item_id → radical, child_item_id → kanji, relationship_type = 'requires'
```

**Verify dependency test data:** Pick a kanji from N5 seed with known `requires` edges in `curriculum/dependencies/graph.json` (e.g. kanji built from number radicals). Use its `id` in repository and navigation tests.

### Previous story intelligence (4.1)

**Critical learnings from Story 4.1 implementation and code review:**

1. **Routes belong under `(tabs)/learn/`** — not root `learn/` stack. Tab bar must stay visible on level list and detail.
2. **Back affordance required** on drill-down screens (`learn-level-back` pattern).
3. **URL param sync** — `useEffect` to sync `itemType` from `params.type` when using query params.
4. **COUNT queries for hub** — already include `radical` in `countItemsByLevel`; hub card is data-ready.
5. **List rows were intentionally non-tappable** in 4.1 — 4.2 adds press handling for radicals (and dependency links on kanji).
6. **`CalibrationItemTypePicker` with `allowedTypes`** — extend allowed list to include `radical`.
7. **All 250+ tests passing** after 4.1 — avoid regressions to hub/level screens.

**Story 1.7:** `MnemonicImage` + `useRadicals` powered the old Learn tab verification list. 4.1 removed that UI but kept components. **Reuse `MnemonicImage` on detail** — do not reintroduce the full radical scroll list on the hub index.

### Git intelligence summary

Latest Epic 4 commit:
- `3ec6801` — Story 4.1: JLPT Learn hub, per-type lists, COUNT queries, `(tabs)/learn/` stack

Build directly on 4.1 file paths. Do not resurrect root `_layout.tsx` `learn` screen registration (removed in 4.1 review).

### Scope boundaries

**In scope:**
- Radical browse (hub card + level list)
- Radical detail with `MnemonicImage` + text mnemonic
- Shared `item/[id]` route with non-radical placeholder
- `getItemById` + `getRequiredParentsForItems`
- Tappable radical dependency links on kanji learn list
- Repository + screen tests

**Out of scope (defer):**
- Full kanji/vocabulary/grammar detail content — Stories 4.3–4.5
- `dependencyGraph.ts` unlock logic — Story 4.7
- Personal mnemonics editor — Story 4.8
- Stroke count field / kanji stroke diagrams — no schema support
- “Kanji that use this radical” reverse section on radical detail — polish only
- Study status editing from Learn lists — Epic 4+ beyond 4.1 note
- Making vocabulary/grammar rows tappable — 4.3–4.5

### Latest tech information

- **Expo SDK 55** + **expo-router** nested Stack under tab — add `item/[id]` as sibling of `[level]` in `learn/_layout.tsx`.
- **expo-image** `cachePolicy="disk"` — established in 1.7; no API changes expected.
- **expo-sqlite** sync API — `getFirstSync` for `getItemById`.
- **@testing-library/react-native** — mock `expo-router` `router.push` / `useLocalSearchParams` like existing Learn tests.

No new npm dependencies expected.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4, Story 4.2 AC]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR4, FR4b, FR27, FR49, NFR2, NFR20]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — `itemRepository.ts`, `learn/item/[id].tsx` (adapt path to tab stack)]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Drill-down depth, mnemonic a11y, typography]
- [Source: `_bmad-output/implementation-artifacts/4-1-jlpt-learn-hub-and-per-type-item-lists.md` — Tab stack routes, review fixes]
- [Source: `_bmad-output/implementation-artifacts/1-7-cached-radical-mnemonic-images-and-maintainer-r2-workflow.md` — `MnemonicImage` contract]
- [Source: `mobile/src/components/common/MnemonicImage.tsx` — Reuse as-is]
- [Source: `mobile/src/data/curriculum/itemRepository.ts` — Extend with detail + parent ID queries]
- [Source: `mobile/src/app/onboarding/calibrate.tsx` — Dependency hints pattern]
- [Source: `scripts/curriculum-schema.ts` — No stroke_count column]
- [Source: `curriculum/radicals/n5.json` — Seed radical shape]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

- Extended expo-sqlite mock to support `WHERE id = ?` lookups and parent `id`/`item_type` in relationship JOINs.

### Completion Notes List

- Added radical browse on Learn hub and level list with tappable rows navigating to `/learn/item/[id]`.
- Implemented shared item detail route with `RadicalDetail` (glyph, meaning, text mnemonic, `MnemonicImage` at `h-48`), Back affordance, and placeholder for other item types.
- Added `getItemById`, `getRequiredParentsForItems`; refactored `getRequiredParentLabelsForItems` to compose from parents query.
- Kanji list shows tappable radical dependency links via `KanjiDependencyHints`.
- All 261 mobile tests pass; lint and typecheck clean.
- Code review fixes: avoid duplicate mnemonic text on image fallback; 44×44 dependency link touch targets; hub radical card navigation test.

### File List

- _bmad-output/implementation-artifacts/sprint-status.yaml (modified)

- mobile/__mocks__/expo-sqlite.ts (modified)
- mobile/src/app/(tabs)/learn/_layout.tsx (modified)
- mobile/src/app/(tabs)/learn/index.tsx (modified)
- mobile/src/app/(tabs)/learn/index.test.tsx (modified)
- mobile/src/app/(tabs)/learn/[level].tsx (modified)
- mobile/src/app/(tabs)/learn/[level].test.tsx (modified)
- mobile/src/app/(tabs)/learn/item/[id].tsx (new)
- mobile/src/app/(tabs)/learn/item/[id].test.tsx (new)
- mobile/src/components/common/MnemonicImage.tsx (modified)
- mobile/src/components/learn/KanjiDependencyHints.tsx (new)
- mobile/src/components/learn/LearnItemRow.tsx (modified)
- mobile/src/components/learn/RadicalDetail.tsx (new)
- mobile/src/data/curriculum/itemRepository.ts (modified)
- mobile/src/data/curriculum/itemRepository.test.ts (modified)
- mobile/src/data/hooks/useItemDetail.ts (new)

### Change Log

- 2026-06-14: Story 4.2 — radical detail with mnemonic image, item detail route, dependency links on kanji list.
- 2026-06-14: Code review — fixed duplicate mnemonic text on fallback, dependency link touch targets, added hub radical navigation test; story approved.

## Senior Developer Review (AI)

_Reviewer: Riyaz on 2026-06-14_

**Outcome:** Approved after fixes

**Findings addressed:**
- Duplicate `mnemonicText` when image URL missing or load fails — `RadicalDetail` shows standalone text only when image displays; `MnemonicImage` exposes optional `onLoadError`.
- Dependency link touch targets below 44px width — added `min-w-[44px] px-2` on `KanjiDependencyHints` pressables.
- Story File List missing `sprint-status.yaml` — documented.

**Verification:** `npm run lint`, `npm run typecheck`, `npm test` pass (261 tests).
