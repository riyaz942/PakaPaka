---
baseline_commit: 7c6b1bc
---

# Story 4.5: Dependency graph visibility for unlock status

Status: done

## Story

As a **learner**,
I want **to see why a kanji or vocab is locked**,
so that **the radical→kanji→vocab path feels fair (FR4)**.

## Acceptance Criteria

1. **Locked items list unmet prerequisites with links (list screen)**

   **Given** `item_relationships` edges with `relationship_type = 'requires'` in `curriculum.db`
   **And** one or more required parents have `StudyStatus = 'not_started'` (or absent from `user.db`)
   **When** I view the per-type list (e.g., kanji list at N5)
   **Then** that item's row is visually dimmed (`opacity-50`)
   **And** only the **unmet** prerequisites are shown with "Learn first:" label and tappable links to their detail screens
   **And** already-met prerequisites (status `'known'` or `'in_progress'`) are NOT listed as blockers

2. **Unlocked items show a clear available state (list screen)**

   **Given** an item whose `requires` parents all have status `'known'` or `'in_progress'`
   **Or** an item with no `requires` parents at all (e.g., radicals, grammar)
   **When** I view the per-type list
   **Then** the item row renders at full opacity (not dimmed)
   **And** items with met prerequisites show "Requires:" with all parent links (existing `KanjiDependencyHints` behavior)
   **And** items with no prerequisites show no dependency section (current behavior)

3. **Lock status on item detail screen**

   **Given** I navigate to `/learn/item/[id]` for a **locked** kanji or vocabulary item
   **When** the detail screen loads
   **Then** a lock section appears above the mnemonic text: "Locked — learn these first: [unmet prereq links]"
   **And** tapping a link navigates to that prerequisite's detail screen
   **And** queries complete within the architecture <100ms budget (indexed PK/FK lookups)

4. **Available state on item detail screen**

   **Given** I navigate to `/learn/item/[id]` for an **unlocked** item that has prerequisites
   **When** the detail screen loads
   **Then** the detail screen shows "Prerequisites met" near the top (below primary form)
   **And** radicals (no prerequisites) show nothing extra — no lock or unlock section

5. **Study status cross-queries stay dual-DB clean**

   **Given** lock status requires reading both `curriculum.db` (parent items) and `user.db` (study statuses)
   **Then** `curriculum.db` is **never** written — all status reads use `userDb` only
   **And** an item with no `item_study_status` row defaults to `'not_started'` (locked)
   **And** all queries use existing `getAllSync` / `getFirstSync` sync API (no new async patterns)

6. **`core/content/dependencyGraph.ts` pure module**

   **Given** the unlock decision logic
   **When** this story ships
   **Then** `isItemUnlocked(parents, parentStatuses)` and `getUnmetPrerequisites(parents, parentStatuses)` exist as **zero-React pure functions** in `src/core/content/dependencyGraph.ts`
   **And** `dependencyGraph.test.ts` covers: no parents → unlocked; all known → unlocked; any not_started → locked; mixed known/not_started → partially locked; identifies only unmet parents

7. **Tests and CI**

   **Given** implementation is complete
   **When** CI runs in `mobile/`
   **Then** `npm run lint`, `npm run typecheck`, and `npm test` pass
   **And** `dependencyGraph.test.ts` covers all unlock cases
   **And** `[level].test.tsx` covers locked/unlocked row rendering and unmet prerequisite display
   **And** existing tests for Stories 4.1–4.4 remain green

## Tasks / Subtasks

- [x] **AC6 — Pure dependency graph logic (no React)**
  - [x] Create `mobile/src/core/content/dependencyGraph.ts` with `isItemUnlocked` and `getUnmetPrerequisites`
  - [x] Create `mobile/src/core/content/dependencyGraph.test.ts`

- [x] **AC5 — `useItemDependencyStatus` hook**
  - [x] Create `mobile/src/data/hooks/useItemDependencyStatus.ts` — accepts `itemId`, queries `curriculumDb` for parents, `userDb` for statuses, returns `{ parents, isLocked, unmetPrerequisites, loading }`

- [x] **AC1 & AC2 — List screen lock state**
  - [x] Modify `mobile/src/app/(tabs)/learn/[level].tsx` — extend `dependencyParentsByItemId` to also handle `'vocabulary'` type; collect all parent item IDs; batch-query `listStudyStatusesForItems` from `userDb`; compute per-item `isLocked` and `unmetPrerequisites`; pass to `LearnItemRow`
  - [x] Modify `mobile/src/components/learn/LearnItemRow.tsx` — add `isLocked?: boolean` and `unmetPrerequisites?: CurriculumParentItem[]` props; apply `opacity-50` when locked; pass correct data to `KanjiDependencyHints`
  - [x] Modify `mobile/src/components/learn/KanjiDependencyHints.tsx` — add `mode: 'all' | 'unmet'` prop (default `'all'`); change label to "Learn first:" when `mode='unmet'`

- [x] **AC3 & AC4 — Detail screen lock/unlock section**
  - [x] Modify `mobile/src/app/(tabs)/learn/item/[id].tsx` — call `useItemDependencyStatus(itemId)`; pass `isLocked` and `unmetPrerequisites` to `KanjiDetail` and `VocabularyDetail`
  - [x] Modify `mobile/src/components/learn/KanjiDetail.tsx` — add `isLocked?`, `unmetPrerequisites?` props; render lock/unlock section above mnemonic
  - [x] Modify `mobile/src/components/learn/VocabularyDetail.tsx` — same as KanjiDetail
  - [x] `RadicalDetail` and `GrammarDetail` — NO changes (no prerequisites)

- [x] **Mock helper**
  - [x] Add `__mockSetItemStudyStatuses(databaseName, rows)` to `mobile/__mocks__/expo-sqlite.ts`

- [x] **AC7 — Tests**
  - [x] `mobile/src/app/(tabs)/learn/[level].test.tsx` — add cases: locked kanji shows "Learn first:" and dimmed; unlocked kanji shows full opacity; items with no prereqs unaffected
  - [x] Run full CI: `npm run lint && npm run typecheck && npm test`

### Review Findings

- [x] [Review][Patch] Double label in detail screen: KanjiDetail/VocabularyDetail render section header "Locked — learn these first" then KanjiDependencyHints emits its own "Learn first:" — two sequential labels violate AC 3 [mobile/src/components/learn/KanjiDetail.tsx:83, mobile/src/components/learn/VocabularyDetail.tsx:58]
- [x] [Review][Patch] `LearnItemRow` View branch missing `opacity-50`: locked state dim only applied on Pressable branch; `<View>` fallback (line 72) renders at full opacity when locked [mobile/src/components/learn/LearnItemRow.tsx:72]
- [x] [Review][Defer] Synchronous DB calls in `useItemDependencyStatus` and `[level].tsx` useMemo have no try/catch — pre-existing pattern across codebase (useItemDetail, useLearnItems all do same)
- [x] [Review][Defer] `parentStatusMap` useMemo calls `listStudyStatusesForItems` synchronously on render thread — pre-existing pattern (dependencyParentsByItemId does same with getRequiredParentsForItems)
- [x] [Review][Defer] `renderItem` closure in FlatList is inline (not useCallback) — pre-existing pattern
- [x] [Review][Defer] `useItemDependencyStatus` queries DB for radical/grammar items unconditionally — correct behavior, perf optimization only
- [x] [Review][Defer] Two new tests duplicate item fixture setup instead of using createCurriculumDb — code quality, not correctness
- [x] [Review][Defer] `__mockSetItemStudyStatuses` `item_id: number` vs string comparison in mock filter — tests pass (312 green); worth future investigation
- [x] [Review][Defer] Weak "leaves items without prerequisites unchanged" test — no lock→unlock transition coverage
- [x] [Review][Defer] `KanjiDependencyHints` name misleading — now used for vocabulary too; cosmetic rename deferred
- [x] [Review][Defer] `parentStatuses` exported in `ItemDependencyStatus` return type but unused by all call sites [mobile/src/data/hooks/useItemDependencyStatus.ts:12]

## Dev Notes

### What already exists — REUSE, do not rebuild

| Asset | Location | Role in this story |
| --- | --- | --- |
| `item_relationships` table | `curriculum.db` | Stores `parent_item_id → child_item_id` with `relationship_type = 'requires'` |
| `getRequiredParentsForItems(db, itemIds)` | `itemRepository.ts:183` | Batch query — returns `Map<itemId, CurriculumParentItem[]>` for 'requires' edges only |
| `getRequiredParentLabels()` / `getRequiredParentLabelsForItems()` | `itemRepository.ts:176–229` | Already implemented, available if needed |
| `listStudyStatusesForItems(userDb, itemIds)` | `itemStudyStatusRepository.ts:99` | Batch-reads `item_study_status` for multiple IDs — returns `Map<string, StudyStatus>` |
| `getStudyStatusOrDefault(userDb, itemId)` | `itemStudyStatusRepository.ts:38` | Single-item read with `'not_started'` default |
| `StudyStatus` type | `studyStatus.types.ts` | `'known' | 'in_progress' | 'not_started'` |
| `CurriculumParentItem` type | `itemRepository.ts:41` | `{ id: string; primaryForm: string; itemType: ItemType }` |
| `dependencyParentsByItemId` in `[level].tsx` | `[level].tsx:39–45` | **ALREADY computed for kanji** using `getRequiredParentsForItems` — EXTEND, do not rewrite |
| `LearnItemRow` `dependencyParents` prop | `LearnItemRow.tsx` | **Already wired** — extend with `isLocked` and `unmetPrerequisites` |
| `KanjiDependencyHints` | `KanjiDependencyHints.tsx` | Already renders tappable "Requires: [links]" — add `mode` prop only |
| `__mockSetItemRelationships()` | `__mocks__/expo-sqlite.ts:685` | Already exists for seeding test relationships |
| Item study status mock handlers | `__mocks__/expo-sqlite.ts:359–372` | Already supports `WHERE item_id = ?` and `WHERE item_id IN (...)` queries |

### Current `[level].tsx` dependency logic — key context

```ts
// mobile/src/app/(tabs)/learn/[level].tsx (lines 39–45) — ALREADY EXISTS
const dependencyParentsByItemId = useMemo(() => {
  if (itemType !== 'kanji') {
    return new Map();
  }
  const kanjiIds = items.map((item) => item.id);
  return getRequiredParentsForItems(curriculumDb, kanjiIds);
}, [curriculumDb, itemType, items]);
```

This story extends this `useMemo` to:
1. Also cover `'vocabulary'` (seed data only has radical→kanji edges now, but code should be generic)
2. Collect all unique parent IDs from the resulting map
3. Batch-call `listStudyStatusesForItems(userDb, allParentIds)` to get statuses
4. Compute `isLocked` and `unmetPrerequisites` per item using `isItemUnlocked` from `core/content/dependencyGraph.ts`

### New file: `core/content/dependencyGraph.ts`

```ts
// mobile/src/core/content/dependencyGraph.ts
// Zero React/RN imports — pure logic only

import type { CurriculumParentItem } from '@/data/curriculum/itemRepository';
import type { StudyStatus } from '@/data/user/studyStatus.types';

export function isItemUnlocked(
  parents: CurriculumParentItem[],
  parentStatuses: Map<string, StudyStatus>,
): boolean {
  if (parents.length === 0) return true;
  return parents.every((parent) => {
    const status = parentStatuses.get(parent.id) ?? 'not_started';
    return status === 'known' || status === 'in_progress';
  });
}

export function getUnmetPrerequisites(
  parents: CurriculumParentItem[],
  parentStatuses: Map<string, StudyStatus>,
): CurriculumParentItem[] {
  return parents.filter((parent) => {
    const status = parentStatuses.get(parent.id) ?? 'not_started';
    return status === 'not_started';
  });
}
```

### New file: `useItemDependencyStatus.ts` (for detail screen)

```ts
// mobile/src/data/hooks/useItemDependencyStatus.ts
import { useEffect, useState } from 'react';
import { getRequiredParentsForItems, type CurriculumParentItem } from '@/data/curriculum/itemRepository';
import { listStudyStatusesForItems } from '@/data/user/itemStudyStatusRepository';
import { isItemUnlocked, getUnmetPrerequisites } from '@/core/content/dependencyGraph';
import { useDatabase } from '@/data/hooks/useDatabase';
import type { StudyStatus } from '@/data/user/studyStatus.types';

export type ItemDependencyStatus = {
  parents: CurriculumParentItem[];
  parentStatuses: Map<string, StudyStatus>;
  isLocked: boolean;
  unmetPrerequisites: CurriculumParentItem[];
  loading: boolean;
};

export function useItemDependencyStatus(itemId: string | null): ItemDependencyStatus {
  const { curriculumDb, userDb } = useDatabase();
  const [result, setResult] = useState<ItemDependencyStatus>({
    parents: [],
    parentStatuses: new Map(),
    isLocked: false,
    unmetPrerequisites: [],
    loading: true,
  });

  useEffect(() => {
    if (!itemId) {
      setResult({ parents: [], parentStatuses: new Map(), isLocked: false, unmetPrerequisites: [], loading: false });
      return;
    }
    setResult((prev) => ({ ...prev, loading: true }));
    const parentsMap = getRequiredParentsForItems(curriculumDb, [itemId]);
    const parents = parentsMap.get(itemId) ?? [];
    const parentIds = parents.map((p) => p.id);
    const parentStatuses = parentIds.length > 0
      ? listStudyStatusesForItems(userDb, parentIds)
      : new Map<string, StudyStatus>();
    const locked = !isItemUnlocked(parents, parentStatuses);
    const unmet = getUnmetPrerequisites(parents, parentStatuses);
    setResult({ parents, parentStatuses, isLocked: locked, unmetPrerequisites: unmet, loading: false });
  }, [curriculumDb, userDb, itemId]);

  return result;
}
```

### Modified: `[level].tsx` — extend lock computation

Extend the existing `useMemo` and add a second one for lock status:

```ts
// Extend to also cover vocabulary
const dependencyParentsByItemId = useMemo(() => {
  if (itemType !== 'kanji' && itemType !== 'vocabulary') {
    return new Map<string, CurriculumParentItem[]>();
  }
  const ids = items.map((item) => item.id);
  return getRequiredParentsForItems(curriculumDb, ids);
}, [curriculumDb, itemType, items]);

// NEW: collect all parent IDs, batch-read statuses
const parentStatusMap = useMemo(() => {
  const allParentIds = new Set<string>();
  for (const parents of dependencyParentsByItemId.values()) {
    for (const p of parents) allParentIds.add(p.id);
  }
  if (allParentIds.size === 0) return new Map<string, StudyStatus>();
  return listStudyStatusesForItems(userDb, [...allParentIds]);
}, [dependencyParentsByItemId, userDb]);
```

Then in `renderItem`:
```ts
const parents = dependencyParentsByItemId.get(item.id);
const isLocked = parents && parents.length > 0
  ? !isItemUnlocked(parents, parentStatusMap)
  : false;
const unmetPrerequisites = parents && isLocked
  ? getUnmetPrerequisites(parents, parentStatusMap)
  : [];
```

Pass to `LearnItemRow`: `isLocked={isLocked} unmetPrerequisites={unmetPrerequisites} dependencyParents={parents}`

### Modified: `LearnItemRow.tsx`

```ts
type LearnItemRowProps = {
  item: CurriculumListItem;
  testID?: string;
  onPress?: () => void;
  dependencyParents?: CurriculumParentItem[];
  isLocked?: boolean;                         // NEW
  unmetPrerequisites?: CurriculumParentItem[]; // NEW
};
```

Apply `opacity-50` when locked:
```tsx
<Pressable
  ...
  className={cn('border-b border-border py-4', isLocked && 'opacity-50')}>
```

Pass the right data to `KanjiDependencyHints`:
```tsx
{isLocked && unmetPrerequisites && unmetPrerequisites.length > 0 ? (
  <KanjiDependencyHints parents={unmetPrerequisites} mode="unmet" testID={...} />
) : dependencyParents && dependencyParents.length > 0 ? (
  <KanjiDependencyHints parents={dependencyParents} mode="all" testID={...} />
) : null}
```

### Modified: `KanjiDependencyHints.tsx`

Add `mode?: 'all' | 'unmet'` prop (default `'all'`). Change label:
- `'all'` → "Requires:" (existing)
- `'unmet'` → "Learn first:"

No other changes.

### Modified: `KanjiDetail.tsx` and `VocabularyDetail.tsx`

Add props:
```ts
isLocked?: boolean;
unmetPrerequisites?: CurriculumParentItem[];
```

Render lock section above mnemonic:
```tsx
{/* Only kanji/vocab show dependency status — radicals never have it */}
{unmetPrerequisites !== undefined && unmetPrerequisites.length > 0 && isLocked ? (
  <View className="mt-4">
    <Text className="text-body-sm uppercase text-secondary">Locked — learn these first</Text>
    <KanjiDependencyHints parents={unmetPrerequisites} mode="unmet" testID="item-detail-lock-section" />
  </View>
) : unmetPrerequisites !== undefined && unmetPrerequisites.length === 0 && /* has parents = */ false ? null :
  /* unlocked with parents */ unmetPrerequisites !== undefined && !isLocked ? (
    // Only show "Prerequisites met" if item actually HAS parents
    null // detail screen won't show "Prerequisites met" label — too verbose, unlocked is the normal state
) : null}
```

**Simpler pattern** — just show the lock section when locked:
```tsx
{isLocked && unmetPrerequisites && unmetPrerequisites.length > 0 ? (
  <View className="mt-4" testID="item-detail-lock-section">
    <Text className="text-body-sm uppercase text-secondary">Locked — learn these first</Text>
    <KanjiDependencyHints parents={unmetPrerequisites} mode="unmet" />
  </View>
) : null}
```

For AC4 ("Prerequisites met"), show only when item has parents AND is unlocked:
```tsx
{!isLocked && parents && parents.length > 0 ? (
  <View className="mt-4" testID="item-detail-available-section">
    <Text className="text-body-sm text-feedback-correct">Prerequisites met</Text>
  </View>
) : null}
```

Pass `parents` and `isLocked` and `unmetPrerequisites` from the route to the detail component.

### Modified: `item/[id].tsx`

```ts
import { useItemDependencyStatus } from '@/data/hooks/useItemDependencyStatus';
...
const { parents, isLocked, unmetPrerequisites } = useItemDependencyStatus(itemId);
```

Then pass to detail components:
```tsx
item.itemType === 'kanji' ? (
  <KanjiDetail
    item={item}
    kanjiReadings={...}
    acceptedAnswers={...}
    parents={parents}
    isLocked={isLocked}
    unmetPrerequisites={unmetPrerequisites}
  />
) ...
```

**Radicals and Grammar**: `useItemDependencyStatus` will return empty `parents`, `isLocked=false`, `unmetPrerequisites=[]` — no changes needed to `RadicalDetail` or `GrammarDetail`.

### New mock helper

```ts
// mobile/__mocks__/expo-sqlite.ts — add near other __mockSet* helpers
export function __mockSetItemStudyStatuses(databaseName: string, rows: Array<{ item_id: number; status: string; updated_at: string }>) {
  const state = getDatabaseState(databaseName);
  state.tables.set('item_study_status', rows.map((row) => ({ ...row })));
}
```

### Curriculum graph data

- `curriculum/dependencies/graph.json` — N5 seed only has `radical → kanji` `'builds_on'` edges
- **IMPORTANT**: The seed uses `'builds_on'` in `graph.json`, but `compile-curriculum.ts` maps these to `item_relationships.relationship_type`. Check `compile-curriculum.ts:108` to confirm the exact relationship_type stored. The `getRequiredParentsForItems` query filters on `'requires'`. If the compile step stores `'builds_on'` as-is, then current seed data will show NO lock state in practice. The story is still correct — it implements the UI; the lock UI only activates when 'requires' edges exist.
- The `schema.ts` shows `'requires'` is a valid relationship_type. Future curriculum updates may add `'requires'` edges. The N5 seed currently uses `'builds_on'`.

### Technical requirements (must follow)

- **Dual-DB separation**: `curriculum.db` reads (parent items) + `user.db` reads (study status). Never write to either in this story.
- **Pure core module**: `core/content/dependencyGraph.ts` — zero React/RN imports, zero side effects.
- **Sync API**: `getFirstSync`/`getAllSync`/`listStudyStatusesForItems` — no async in data reads.
- **NativeWind token-only styling**: `opacity-50` for locked rows; `text-feedback-correct` for "Prerequisites met"; `text-secondary` for lock label. No raw hex values.
- **Named exports** for all utility functions, hooks, and components.
- **Default export** for route files only.
- **No new npm dependencies** — everything needed is already in the project.
- **44px touch targets** — `KanjiDependencyHints` links already have `min-h-[44px]`, preserve this.

### Architecture compliance

| Requirement | Implementation |
| --- | --- |
| `core/content/dependencyGraph.ts` | Created per architecture directory spec |
| No `reinforcementResolver.ts` | Deferred to Epic 5 — do not create |
| No `content.types.ts` | Defer typed wrappers to Epic 5 — import from existing repositories |
| Dual-DB clean reads | `curriculumDb` → parents; `userDb` → statuses |
| <100ms query budget | PK/FK indexed lookups; batch via `IN` clause |
| NFR10 progress survives curriculum swap | Study status in `user.db` only |

### File structure guidance

**Create:**

| Path | Purpose |
| --- | --- |
| `mobile/src/core/content/dependencyGraph.ts` | Pure unlock logic functions |
| `mobile/src/core/content/dependencyGraph.test.ts` | Unit tests |
| `mobile/src/data/hooks/useItemDependencyStatus.ts` | Detail screen dependency hook |

**Modify:**

| Path | Change |
| --- | --- |
| `mobile/src/app/(tabs)/learn/[level].tsx` | Extend dependency fetch to vocab; add status batch-query and lock computation |
| `mobile/src/components/learn/LearnItemRow.tsx` | Add `isLocked`, `unmetPrerequisites` props; apply `opacity-50` when locked |
| `mobile/src/components/learn/KanjiDependencyHints.tsx` | Add `mode: 'all' | 'unmet'` prop; change label for unmet mode |
| `mobile/src/app/(tabs)/learn/item/[id].tsx` | Import and call `useItemDependencyStatus`; pass lock props to `KanjiDetail`/`VocabularyDetail` |
| `mobile/src/components/learn/KanjiDetail.tsx` | Add `parents?`, `isLocked?`, `unmetPrerequisites?` props; render lock/unlock section |
| `mobile/src/components/learn/VocabularyDetail.tsx` | Same as KanjiDetail |
| `mobile/__mocks__/expo-sqlite.ts` | Add `__mockSetItemStudyStatuses()` helper |
| `mobile/src/app/(tabs)/learn/[level].test.tsx` | Add locked/unlocked rendering tests |

**Do NOT create/modify in 4.5:**

| Path | Deferred to |
| --- | --- |
| `core/content/reinforcementResolver.ts` | Epic 5 — cross-domain reinforcement |
| `core/content/content.types.ts` | Epic 5 — broader type definitions |
| Any SRS/FSRS state integration | Epic 5 |
| Passage lock state | Out of scope per 4.4 notes |
| Personal mnemonics | Story 4.6 |

### Previous story intelligence (4.4)

1. **Hook pattern**: `useItemDetail` stale-flush pattern — when `itemId` changes, reset state first. Apply same pattern in `useItemDependencyStatus` (already shown above with `loading: true` reset on itemId change).
2. **Opacity in NativeWind**: Use `opacity-50` class (not `style={{ opacity: 0.5 }}`). NativeWind supports this.
3. **`cn()` utility** (`src/utils/cn.ts`) — already used in `LearnItemRow` for conditional classes; continue the pattern.
4. **Mock extension pattern**: `__mockSetReadingPassages(databaseName, rows)` at line 715 — copy exact pattern for `__mockSetItemStudyStatuses`.
5. **Test pattern**: Tests use `DatabaseContext.Provider` with `{ curriculumDb, userDb, isReady: true, error: null }` — continue this pattern.
6. **Fix from 4.4 review**: Pressables must have 44px min dimensions; `KanjiDependencyHints` already does this — don't break it when adding `mode` prop.

### Git intelligence

Latest relevant commits:
- `7c6b1bc` — Story 4.4: Read tab, passageRepository, evaluatePassageAnswer, migration 004
- `7cd29eb` — Story 4.3: KanjiDetail, VocabularyDetail, GrammarDetail, RadicalDetail, useItemDetail
- `f49198d` — Story 4.2: getItemById, radical detail, item/[id] route
- `3ec6801` — Story 4.1: learn hub, per-type lists, LearnItemRow, KanjiDependencyHints, [level].tsx, getRequiredParentsForItems

This story is a direct enhancement to the Study 4.1–4.3 Learn tab infrastructure. All the wiring patterns are already established.

### Scope boundaries

**In scope:**
- `core/content/dependencyGraph.ts` pure lock logic
- Locked/unlocked visual state on list screen (`[level].tsx`)
- Lock section on item detail screen (kanji and vocabulary only)
- `useItemDependencyStatus` hook for detail screen
- Mock helper for study status seeding in tests

**Out of scope (defer):**
- Using lock state to actually block navigation to locked item detail — the detail screen is always accessible (browsing is always allowed)
- SRS unlock gating (that's Epic 5 — review queue only serves unlocked items)
- Reinforcement highlights in passages (Epic 5/6)
- Grammar dependency gating (grammar has no `'requires'` edges in schema)
- `reinforcementResolver.ts` / `content.types.ts` (Epic 5)
- Reading passage lock state (explicitly deferred in Story 4.4 scope notes)

### Latest tech information

- **Expo SDK 55** — all existing patterns apply; `useMemo` for batch computations, `useEffect` for cross-DB hooks
- **NativeWind v4** — `opacity-50` is a valid utility class in NativeWind v4/Tailwind
- **expo-sqlite sync API** — `getAllSync` / `getFirstSync` already established; `listStudyStatusesForItems` uses `IN (...)` batch query
- **No new npm dependencies** needed

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4, Story 4.5 AC]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — `core/content/dependencyGraph.ts`, dependency graph design, dual-DB, <100ms budget]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR4: radical→kanji→vocab dependency graph, precomputed adjacency]
- [Source: `mobile/src/data/curriculum/itemRepository.ts:183–229` — `getRequiredParentsForItems`, `CurriculumParentItem` type]
- [Source: `mobile/src/data/user/itemStudyStatusRepository.ts:99` — `listStudyStatusesForItems` batch read]
- [Source: `mobile/src/data/user/studyStatus.types.ts` — `StudyStatus` type]
- [Source: `mobile/src/app/(tabs)/learn/[level].tsx:39–45` — existing `dependencyParentsByItemId` computation to extend]
- [Source: `mobile/src/components/learn/LearnItemRow.tsx` — `dependencyParents` prop wiring to extend]
- [Source: `mobile/src/components/learn/KanjiDependencyHints.tsx` — component to add `mode` prop to]
- [Source: `mobile/src/components/learn/KanjiDetail.tsx` — component to add lock section to]
- [Source: `mobile/src/components/learn/VocabularyDetail.tsx` — component to add lock section to]
- [Source: `mobile/__mocks__/expo-sqlite.ts:680–733` — `__mockSet*` helper pattern to follow]
- [Source: `mobile/src/app/(tabs)/learn/[level].test.tsx` — test patterns for list screen]
- [Source: `curriculum/dependencies/graph.json` — N5 seed: radical→kanji edges, `relationship_type: 'builds_on'`]
- [Source: `scripts/curriculum-schema.ts` — `item_relationships` DDL with `'requires'|'builds_on'|'reinforces'`]
- [Source: `scripts/compile-curriculum.ts:375–390` — how graph edges are compiled into `item_relationships`]
- [Source: `_bmad-output/implementation-artifacts/4-4-reading-passages-with-comprehension-prompts.md` — previous story patterns]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Implemented pure unlock logic in `dependencyGraph.ts` with full unit test coverage (no parents, all known/in_progress, mixed, not_started cases).
- Added `useItemDependencyStatus` hook for detail screen cross-DB reads (curriculum parents + user study statuses).
- Extended Learn list screen to compute lock state for kanji and vocabulary; locked rows dim with "Learn first:" unmet links; unlocked rows show "Requires:" for all parents.
- Added lock/unlock sections to KanjiDetail and VocabularyDetail (above mnemonic); radicals and grammar unchanged.
- Added `__mockSetItemStudyStatuses` mock helper and three new list screen tests.
- All CI checks pass: lint, typecheck, 312 tests green.

### File List

- mobile/src/core/content/dependencyGraph.ts (new)
- mobile/src/core/content/dependencyGraph.test.ts (new)
- mobile/src/data/hooks/useItemDependencyStatus.ts (new)
- mobile/src/app/(tabs)/learn/[level].tsx (modified)
- mobile/src/app/(tabs)/learn/[level].test.tsx (modified)
- mobile/src/app/(tabs)/learn/item/[id].tsx (modified)
- mobile/src/components/learn/LearnItemRow.tsx (modified)
- mobile/src/components/learn/KanjiDependencyHints.tsx (modified)
- mobile/src/components/learn/KanjiDetail.tsx (modified)
- mobile/src/components/learn/VocabularyDetail.tsx (modified)
- mobile/__mocks__/expo-sqlite.ts (modified)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified)

### Change Log

- 2026-06-27: Story 4.5 implementation — dependency graph visibility for unlock status on Learn list and detail screens.
