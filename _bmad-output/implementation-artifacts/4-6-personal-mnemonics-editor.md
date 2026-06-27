---
baseline_commit: b5aea81
---

# Story 4.6: Personal mnemonics editor

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **learner**,
I want **to add or edit personal mnemonics per item**,
so that **I can reinforce memory my way (FR26b)**.

## Acceptance Criteria

1. **Editable personal mnemonic on kanji, vocabulary, and grammar detail screens**

   **Given** I am on `/learn/item/[id]` for a **kanji**, **vocabulary**, or **grammar** item
   **When** the detail screen renders
   **Then** a "Your mnemonic" editor section appears (in addition to the read-only curriculum "Mnemonic" text when one exists)
   **And** the editor shows my previously saved personal mnemonic if one exists, otherwise an empty input with placeholder guidance
   **And** **radical** detail screens show **no** personal mnemonic editor (radicals use visual mnemonic images only — FR26b covers kanji/vocab/grammar only)

2. **Saving persists to `user.db` and survives curriculum updates**

   **Given** I type personal mnemonic text and tap Save
   **When** the save completes
   **Then** the text is written to the `personal_mnemonics` table in `user.db` (never `curriculum.db`)
   **And** re-opening the same item detail shows my saved text (persisted across navigation and app restarts)
   **And** because personal mnemonics live in `user.db`, they survive a `curriculum.db` swap/OTA update without data loss (NFR10)

3. **Empty personal mnemonic removes the override without deleting curriculum text**

   **Given** I have a saved personal mnemonic
   **When** I clear the input to empty (or whitespace-only) and tap Save
   **Then** the `personal_mnemonics` row for that item is **deleted** from `user.db`
   **And** the curriculum mnemonic text (from read-only `curriculum.db`) still renders unchanged
   **And** the editor returns to its empty/placeholder state

4. **Whitespace handling and idempotency**

   **Given** any save operation
   **Then** leading/trailing whitespace is trimmed before persisting
   **And** saving the same text twice produces one row (upsert by `item_id`, not duplicate rows)
   **And** `updated_at` is refreshed on each successful upsert

5. **Dual-DB separation and sync API**

   **Given** the editor reads and writes mnemonics
   **Then** all reads/writes use `userDb` only — `curriculum.db` is never written
   **And** all DB access uses the synchronous API (`getFirstSync` / `runSync`) consistent with existing repositories
   **And** an item with no `personal_mnemonics` row reads back as `null` (no error)

6. **Tests and CI**

   **Given** implementation is complete
   **When** CI runs in `mobile/`
   **Then** `npm run lint`, `npm run typecheck`, and `npm test` pass
   **And** `mnemonicRepository.test.ts` covers: read-missing → null; set → read back; empty/whitespace set → row deleted; upsert idempotency; trim behavior
   **And** `[id].test.tsx` covers: editor renders for kanji/vocab/grammar; NOT for radical; type + save persists; clear + save removes override while curriculum text remains
   **And** existing tests for Stories 4.1–4.5 remain green

## Tasks / Subtasks

- [x] **AC2/AC5 — Migration 005: `personal_mnemonics` table** (user.db)
  - [x] Create `mobile/src/data/migrations/005_personal_mnemonics.ts` (version 5) — see DDL in Dev Notes
  - [x] Register `migration005PersonalMnemonics` in `mobile/src/data/migrations/index.ts` (append to `migrations` array — auto-applied by `database.ts:121`)

- [x] **AC2/AC3/AC4/AC5 — `mnemonicRepository.ts`** (architecture-specified name)
  - [x] Create `mobile/src/data/user/mnemonicRepository.ts` with `getPersonalMnemonic`, `setPersonalMnemonic`, `clearPersonalMnemonic`
  - [x] `setPersonalMnemonic` trims input; if empty after trim → delegates to `clearPersonalMnemonic` (DELETE); else upsert `ON CONFLICT(item_id)`
  - [x] Reuse the `parseItemId` / `Number(itemId)` coercion pattern from sibling repositories

- [x] **AC1/AC2/AC3 — `PersonalMnemonicEditor` component**
  - [x] Create `mobile/src/components/learn/PersonalMnemonicEditor.tsx` — self-manages read/write via `useDatabase()` (mirrors `PassageQuestion` self-management pattern)
  - [x] Props: `{ itemId: string }`. Renders a "Your mnemonic" label, a multiline `TextInput`, and a Save control
  - [x] On mount / when `itemId` changes, load saved text via `getPersonalMnemonic`; reset local state (stale-flush pattern)

- [x] **AC1 — Wire editor into detail components**
  - [x] `mobile/src/components/learn/KanjiDetail.tsx` — render `<PersonalMnemonicEditor itemId={item.id} />` below the existing curriculum mnemonic block
  - [x] `mobile/src/components/learn/VocabularyDetail.tsx` — same placement (below curriculum mnemonic, above Examples)
  - [x] `mobile/src/components/learn/GrammarDetail.tsx` — same placement (below curriculum mnemonic, above Examples)
  - [x] `RadicalDetail.tsx` — **NO change** (no personal mnemonic for radicals)

- [x] **AC6 — Mock support for `personal_mnemonics`**
  - [x] `mobile/__mocks__/expo-sqlite.ts` — add INSERT-ON-CONFLICT upsert handler, DELETE handler, and `SELECT FROM personal_mnemonics` query handler; add `__mockSetPersonalMnemonics(databaseName, rows)` helper

- [x] **AC6 — Tests**
  - [x] `mobile/src/data/user/mnemonicRepository.test.ts` (new) — mirror `passagePracticeRepository.test.ts` structure
  - [x] `mobile/src/app/(tabs)/learn/item/[id].test.tsx` — add editor render/save/clear cases for kanji/vocab/grammar and absence for radical
  - [x] Run full CI: `npm run lint && npm run typecheck && npm test`

### Review Findings

- [x] [Review][Defer] No error handling in `useEffect` / `handleSave` for DB or `parseItemId` exceptions [PersonalMnemonicEditor.tsx:19,22] — deferred, pre-existing pattern across all user repos and PassageQuestion
- [x] [Review][Defer] `clearPersonalMnemonic` has no direct unit test [mnemonicRepository.test.ts] — deferred, AC6 required test cases all covered; direct clear test not spec-required
- [x] [Review][Defer] Migration 005 has no `down` path [005_personal_mnemonics.ts] — deferred, pre-existing pattern across all migrations
- [x] [Review][Defer] `updated_at` column lacks `CHECK` constraint enforcing ISO format [005_personal_mnemonics.ts:9] — deferred, pre-existing; no existing migration enforces format constraints
- [x] [Review][Defer] `parseItemId` error message doesn't distinguish non-integer vs non-positive [mnemonicRepository.ts:7] — deferred, same as sibling repositories
- [x] [Review][Defer] Mock `INSERT INTO personal_mnemonics` handler mutates array reference before re-setting [__mocks__/expo-sqlite.ts] — deferred, pre-existing pattern in `passage_practice_results` handler
- [x] [Review][Defer] `withTransactionSync` mock rollback snapshot omits `personal_mnemonics` table [__mocks__/expo-sqlite.ts] — deferred, single-statement migration; no test exercises rollback of migration 005
- [x] [Review][Defer] `runSync` mock always returns `{ changes: 1 }` regardless of actual rows affected [__mocks__/expo-sqlite.ts] — deferred, pre-existing mock behavior across all table handlers
- [x] [Review][Defer] One-render stale text visible when `itemId` prop changes before `useEffect` fires [PersonalMnemonicEditor.tsx:16] — deferred, accepted pattern; same as PassageQuestion
- [x] [Review][Defer] `parseItemId` admits scientific-notation integers (`1e20` passes `Number.isInteger`) [mnemonicRepository.ts:4] — deferred, hypothetical; item IDs from curriculum DB are bounded integers
- [x] [Review][Defer] `mnemonicRepository.test.ts` runs migration 005 in isolation, skipping schema versions 1-4 [mnemonicRepository.test.ts:18] — deferred, consistent with `passagePracticeRepository.test.ts` pattern
- [x] [Review][Defer] "persists personal mnemonic text after save" test asserts local state, not DB round-trip [mobile/src/app/(tabs)/learn/item/[id].test.tsx:334] — deferred, DB persistence covered in mnemonicRepository.test.ts; read-back path exercised by "clears personal override" test

## Dev Notes

### Scope at a glance

This is a **self-contained, additive** story — no changes to existing query logic, no Epic 5 dependencies. You are adding: one migration, one repository, one component, three one-line wires into existing detail components, and mock + test support. The personal mnemonic is stored in `user.db`; the curriculum mnemonic in `curriculum.db` is read-only and never touched, which is what satisfies AC3's "without deleting curriculum text" by construction.

### What already exists — REUSE, do not rebuild

| Asset | Location | Role in this story |
| --- | --- | --- |
| Migration runner + numbered migrations | `src/data/migrations/` (latest = `004`) | Add `005`; auto-applied via `database.ts:121` `runMigrations(userDb, migrations)` |
| `migrations/index.ts` `migrations` array | `src/data/migrations/index.ts` | Append `migration005PersonalMnemonics` |
| `Migration` type | `src/data/migrations/migrations.types.ts` | `{ version, name, up: (db) => void }` |
| `passagePracticeRepository.ts` | `src/data/user/passagePracticeRepository.ts` | **Closest template** — upsert via `ON CONFLICT`, `Number(id)` coercion, row→domain mapper |
| `itemStudyStatusRepository.ts` | `src/data/user/itemStudyStatusRepository.ts` | `parseItemId` validation + `clearX`/`setX` (empty → DELETE) pattern — mirror exactly for "empty removes override" |
| `PassageQuestion.tsx` | `src/components/read/PassageQuestion.tsx` | **UI template** — `TextInput` + Save `Pressable`, self-manages via `useDatabase()`, stale-flush `useEffect` on id change |
| `useDatabase()` | `src/data/hooks/useDatabase.ts` | Provides `{ curriculumDb, userDb }`; throws if not ready |
| Detail components | `KanjiDetail.tsx`, `VocabularyDetail.tsx`, `GrammarDetail.tsx` | Already render `{item.mnemonicText ? ... : null}` block — insert editor right after it |
| `item.id` (string), `item.mnemonicText` (`string \| null`) | `CurriculumItemDetail` in `itemRepository.ts:30` | `id` is already a `String(...)`; pass straight to editor |
| Mock helpers `__mockSet*` + INSERT/DELETE/SELECT handlers | `__mocks__/expo-sqlite.ts` | Copy the `passage_practice_results` handler trio + helper exactly |

### New migration: `005_personal_mnemonics.ts`

```ts
// mobile/src/data/migrations/005_personal_mnemonics.ts
import type { Migration } from '@/data/migrations/migrations.types';

export const migration005PersonalMnemonics: Migration = {
  version: 5,
  name: '005_personal_mnemonics',
  up: (db) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS personal_mnemonics (
        item_id INTEGER PRIMARY KEY NOT NULL,
        mnemonic_text TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  },
};
```

Then in `index.ts`:
```ts
import { migration005PersonalMnemonics } from '@/data/migrations/005_personal_mnemonics';
// ...
export const migrations: Migration[] = [
  migration001Initial,
  migration002ItemStudyStatus,
  migration003SrsStatesAndImportMetadata,
  migration004PassagePracticeResults,
  migration005PersonalMnemonics,
];
```

> `item_id` is `INTEGER PRIMARY KEY` to match the seed's numeric item IDs and the established pattern in `srs_states` / `item_study_status`. The `personal_mnemonics` table holds **only** items with a non-empty personal mnemonic (empty = no row), so PK-presence == "has override".

### New repository: `mnemonicRepository.ts`

Architecture mandates this exact filename/location: `data/user/mnemonicRepository.ts` ([Source: architecture.md:813, :911, :1016]).

```ts
// mobile/src/data/user/mnemonicRepository.ts
import type { SQLiteDatabase } from 'expo-sqlite';

function parseItemId(itemId: string): number {
  const parsed = Number(itemId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid item id: ${itemId}`);
  }
  return parsed;
}

export function getPersonalMnemonic(
  userDb: SQLiteDatabase,
  itemId: string,
): string | null {
  const row = userDb.getFirstSync<{ mnemonic_text: string }>(
    'SELECT mnemonic_text FROM personal_mnemonics WHERE item_id = ?',
    parseItemId(itemId),
  );
  return row?.mnemonic_text ?? null;
}

export function clearPersonalMnemonic(userDb: SQLiteDatabase, itemId: string): void {
  userDb.runSync('DELETE FROM personal_mnemonics WHERE item_id = ?', parseItemId(itemId));
}

export function setPersonalMnemonic(
  userDb: SQLiteDatabase,
  itemId: string,
  text: string,
): void {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    clearPersonalMnemonic(userDb, itemId);
    return;
  }
  const updatedAt = new Date().toISOString();
  userDb.runSync(
    `INSERT INTO personal_mnemonics (item_id, mnemonic_text, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(item_id) DO UPDATE SET mnemonic_text = excluded.mnemonic_text, updated_at = excluded.updated_at`,
    parseItemId(itemId),
    trimmed,
    updatedAt,
  );
}
```

This mirrors `setStudyStatus` (empty → `clearStudyStatus` → DELETE) and `upsertPassagePracticeResult` (`ON CONFLICT` upsert) exactly — AC3 ("empty removes override") and AC4 (trim + idempotent upsert) fall out of this pattern.

### New component: `PersonalMnemonicEditor.tsx`

Self-managing component (same approach as `PassageQuestion` — reads/writes directly via `useDatabase()`, no new hook needed). Place under `components/learn/`.

```tsx
// mobile/src/components/learn/PersonalMnemonicEditor.tsx
import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useDatabase } from '@/data/hooks/useDatabase';
import {
  getPersonalMnemonic,
  setPersonalMnemonic,
} from '@/data/user/mnemonicRepository';

type PersonalMnemonicEditorProps = {
  itemId: string;
};

export function PersonalMnemonicEditor({ itemId }: PersonalMnemonicEditorProps) {
  const { userDb } = useDatabase();
  const [text, setText] = useState('');

  // Stale-flush on itemId change (mirrors PassageQuestion / useItemDetail)
  useEffect(() => {
    setText(getPersonalMnemonic(userDb, itemId) ?? '');
  }, [userDb, itemId]);

  const handleSave = () => {
    setPersonalMnemonic(userDb, itemId, text);
    setText(text.trim());
  };

  return (
    <View className="mt-4" testID="personal-mnemonic-editor">
      <Text className="text-body-sm uppercase text-secondary">Your mnemonic</Text>
      <TextInput
        accessibilityLabel="Your personal mnemonic"
        multiline
        onChangeText={setText}
        placeholder="Add your own mnemonic…"
        testID="personal-mnemonic-input"
        value={text}
        className="mt-2 min-h-[44px] rounded-radius-md border border-border bg-surface px-space-md py-2 text-body text-primary"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save personal mnemonic"
        onPress={handleSave}
        testID="personal-mnemonic-save"
        className="mt-3 min-h-[44px] items-center justify-center rounded-radius-md bg-feedback-info px-space-md py-2">
        <Text className="text-body font-semibold text-on-primary">Save</Text>
      </Pressable>
    </View>
  );
}
```

**Display contract (so behavior is unambiguous):**
- The existing read-only curriculum block (`{item.mnemonicText ? <…"Mnemonic"…> : null}`) stays exactly as-is in each detail component.
- The editor is a **separate** "Your mnemonic" section rendered immediately after it.
- Personal mnemonic is **additive/override**: present text is shown in the input; clearing + Save removes it. Curriculum text is independent and never altered (it lives in read-only `curriculum.db`).
- Save is always enabled (empty Save is a valid "remove override" action, unlike `PassageQuestion` which disables empty submit). Do **not** copy `PassageQuestion`'s `canSubmit`/disabled logic here.

### Wiring into detail components (one insertion each)

In `KanjiDetail.tsx`, `VocabularyDetail.tsx`, `GrammarDetail.tsx`, add the import and render the editor right after the existing curriculum mnemonic block:

```tsx
// after the {item.mnemonicText ? (...) : null} block
<PersonalMnemonicEditor itemId={item.id} />
```

- `KanjiDetail.tsx` — insert after line ~91 (the mnemonic block), before the closing `</View>`.
- `VocabularyDetail.tsx` — insert after the mnemonic block (~line 78), before the Examples block.
- `GrammarDetail.tsx` — insert after the mnemonic block (~line 90), before the Examples block.
- **`RadicalDetail.tsx` — DO NOT add the editor** (FR26b is kanji/vocab/grammar only; radicals use visual images).

### Mock extensions — `__mocks__/expo-sqlite.ts`

The mock dispatches per-table by regex. Copy the `passage_practice_results` trio and adapt. Add:

1. **Upsert handler** in `applySql` (near line ~293, the passage upsert):
```ts
if (/^INSERT INTO personal_mnemonics/i.test(trimmed) && trimmed.includes('ON CONFLICT')) {
  const [itemId, mnemonicText, updatedAt] = params;
  const rows = state.tables.get('personal_mnemonics') ?? [];
  const idx = rows.findIndex((row) => row.item_id === itemId);
  const next = { item_id: itemId, mnemonic_text: mnemonicText, updated_at: updatedAt };
  if (idx >= 0) rows[idx] = next; else rows.push(next);
  state.tables.set('personal_mnemonics', rows);
  return;
}
```
2. **Delete handler** (near the `DELETE FROM item_study_status` handler ~line 284):
```ts
if (/^DELETE FROM personal_mnemonics/i.test(trimmed)) {
  const rows = state.tables.get('personal_mnemonics') ?? [];
  state.tables.set(
    'personal_mnemonics',
    rows.filter((row) => row.item_id !== params[0]),
  );
  return;
}
```
3. **Select handler** in `queryRows` (near `FROM passage_practice_results` ~line 506):
```ts
if (/FROM personal_mnemonics/i.test(trimmed)) {
  let rows = [...(state.tables.get('personal_mnemonics') ?? [])];
  if (/WHERE item_id = \?/i.test(trimmed)) {
    rows = rows.filter((row) => row.item_id === params[0]);
  }
  return rows;
}
```
4. **Helper** (near `__mockSetItemStudyStatuses` ~line 690):
```ts
export function __mockSetPersonalMnemonics(
  databaseName: string,
  rows: Array<{ item_id: number; mnemonic_text: string; updated_at: string }>,
) {
  const state = getDatabaseState(databaseName);
  state.tables.set('personal_mnemonics', rows.map((row) => ({ ...row })));
}
```

> **Param type note:** `runSync` is called with `parseItemId(...)` → a **number**. The mock compares `row.item_id === params[0]` by strict equality, so seed `__mockSetPersonalMnemonics` rows with `item_id` as a **number** (not string) to match. This is the same number-vs-string caveat flagged in 4.5's deferred work — keep IDs numeric in mock seeds and the comparisons line up.

### Test guidance

**`mnemonicRepository.test.ts`** — mirror `passagePracticeRepository.test.ts` (reset mock, `runMigrations(userDb, [migration005PersonalMnemonics])`):
- read missing → `null`
- `setPersonalMnemonic` then `getPersonalMnemonic` → returns saved text
- `setPersonalMnemonic` with `'   '` (whitespace) → `getPersonalMnemonic` → `null` (row deleted)
- set, then set empty → row removed (override cleared)
- set twice with different text → second value wins, single row (idempotent upsert)
- leading/trailing whitespace trimmed on save

**`[id].test.tsx`** additions (existing fixtures already include kanji id 2, vocab id 3, grammar id 4, radical id 1):
- kanji/vocab/grammar detail → `getByTestId('personal-mnemonic-editor')` present
- radical detail (id 1) → `queryByTestId('personal-mnemonic-editor')` is `null`
- type into `personal-mnemonic-input` + press `personal-mnemonic-save` → re-render/re-query shows persisted text (seed via the editor then assert, or assert the `personal_mnemonics` table state)
- with a seeded personal mnemonic, clear input + Save → curriculum "Mnemonic" text still present, editor input empty

### Technical requirements (must follow)

- **Dual-DB separation**: personal mnemonics are `user.db` only; never write `curriculum.db`. [architecture.md:236-244]
- **Sync API only**: `getFirstSync` / `runSync` — no async data access, no `Result` wrapper here (matches every sibling repo). [4.5 notes; passagePracticeRepository]
- **NativeWind token-only styling**: `border-border`, `bg-surface`, `text-primary`, `text-secondary`, `bg-feedback-info`, `text-on-primary`, `rounded-radius-md`, `px-space-md`, `mt-4`. No raw hex. [CLAUDE.md styling]
- **44px touch targets**: `TextInput` and Save `Pressable` both `min-h-[44px]`. [UX-DR; 4.4 review fix]
- **Named exports** for repo functions and the component; **default export** only for route files.
- **No new npm dependencies** — `TextInput` from `react-native` (already used in `PassageQuestion`).
- **Migration is additive** — `CREATE TABLE IF NOT EXISTS`, idempotent, version 5.

### Architecture compliance

| Requirement | Implementation |
| --- | --- |
| `data/user/mnemonicRepository.ts` (named in arch) | Created with get/set/clear |
| Personal mnemonics persist across curriculum swap (NFR10) | Stored in `user.db`, never replaced |
| `src/app/learn/item/[id].tsx` is the surface (FR26b-28 table) | Editor mounts inside the detail components rendered by `[id].tsx` |
| No SRS/weakness coupling | Out of scope — Epic 5/6 |
| `<100ms` reads | Single PK lookup on `personal_mnemonics` |

### File structure guidance

**Create:**

| Path | Purpose |
| --- | --- |
| `mobile/src/data/migrations/005_personal_mnemonics.ts` | `personal_mnemonics` table migration |
| `mobile/src/data/user/mnemonicRepository.ts` | get/set/clear personal mnemonic |
| `mobile/src/data/user/mnemonicRepository.test.ts` | Repo unit tests |
| `mobile/src/components/learn/PersonalMnemonicEditor.tsx` | The editor UI |

**Modify:**

| Path | Change |
| --- | --- |
| `mobile/src/data/migrations/index.ts` | Append `migration005PersonalMnemonics` |
| `mobile/src/components/learn/KanjiDetail.tsx` | Render `<PersonalMnemonicEditor itemId={item.id} />` after mnemonic block |
| `mobile/src/components/learn/VocabularyDetail.tsx` | Same |
| `mobile/src/components/learn/GrammarDetail.tsx` | Same |
| `mobile/__mocks__/expo-sqlite.ts` | Add personal_mnemonics insert/delete/select handlers + `__mockSetPersonalMnemonics` |
| `mobile/src/app/(tabs)/learn/item/[id].test.tsx` | Editor render/save/clear tests |

**Do NOT create/modify:**

| Path | Reason |
| --- | --- |
| `RadicalDetail.tsx` | No personal mnemonic for radicals (FR26b scope) |
| `useItemDetail.ts` / `itemRepository.ts` | Curriculum reads unchanged; editor reads user.db itself |
| Any `curriculum/` source or compiler | Personal mnemonics are not curriculum content |
| `core/content/*` | No pure-logic module needed; trim/empty rules live in the repo |

### Previous story intelligence (4.5 and earlier)

1. **Empty-value-deletes pattern** is established in `setStudyStatus` (`status === 'not_started'` → `clearStudyStatus`). Reuse the identical shape for `setPersonalMnemonic` empty → `clearPersonalMnemonic`. This is exactly AC3.
2. **Upsert pattern** (`ON CONFLICT(...) DO UPDATE SET ... = excluded....`) is in both `setStudyStatus` and `upsertPassagePracticeResult` — copy it.
3. **Stale-flush on id change**: `useItemDetail` and `PassageQuestion` reset local state in a `useEffect` keyed on the id. The editor must do the same so navigating between items doesn't show a stale mnemonic.
4. **Mock number-vs-string item_id** (4.5 deferred item): seed mock rows with numeric `item_id` because `runSync` passes `parseItemId` (a number) and the mock uses strict `===`.
5. **Self-managing component over a hook**: `PassageQuestion` reads/writes via `useDatabase()` directly rather than introducing a data hook. Follow that — no new `usePersonalMnemonic` hook is required for this story.
6. **44px targets** (4.4 review fix): keep both interactive elements `min-h-[44px]`.
7. **`TextInput` styling** is already solved in `PassageQuestion` (`rounded-radius-md border border-border bg-surface px-space-md py-2 text-body text-primary`) — reuse those tokens; add `multiline` for mnemonics.

### Git intelligence

Latest relevant commits:
- `b5aea81` — Story 4.5: dependency graph visibility, review findings (current baseline)
- `67f1714` — Story 4.5 base: item dependency management
- `7c6b1bc` — Story 4.4: Read tab, `passageRepository`, `evaluatePassageAnswer`, **migration 004**, `PassageQuestion` (the `TextInput` + upsert template you'll mirror)
- `7cd29eb` — Story 4.3: `KanjiDetail`/`VocabularyDetail`/`GrammarDetail`/`RadicalDetail` (the components you'll wire into)

This story is a thin enhancement on the 4.3 detail screens + the 4.4 user-write/`TextInput` infrastructure. Every pattern needed already shipped.

### Latest tech information

- **Expo SDK 55 / expo-sqlite** — sync API (`getFirstSync`, `runSync`, `withTransactionSync`) is the established access mode; no async needed.
- **NativeWind v4** — all tokens used here (`bg-surface`, `border-border`, `rounded-radius-md`, `space-md`, `feedback-info`, `on-primary`) are defined in `tailwind.config.js`.
- **React Native `TextInput`** — `multiline` for multi-line mnemonics; `placeholder` for guidance; pair with `accessibilityLabel`. No `KeyboardAvoidingView` needed (matches `PassageQuestion`); add later only if keyboard overlap is observed.
- **No new npm dependencies.**

### Scope boundaries

**In scope:**
- `personal_mnemonics` table (migration 005)
- `mnemonicRepository.ts` (get/set/clear, empty-removes-override, trim, upsert)
- `PersonalMnemonicEditor` component on kanji/vocab/grammar detail
- Mock + repo + detail-screen tests

**Out of scope (defer):**
- Radical personal mnemonics (FR26b excludes radicals)
- Personal mnemonics in the review loop / reinforcement display (Epic 5)
- Rich text / formatting / images in personal mnemonics (plain text only)
- Sync/export/backup of personal mnemonics (offline-only, on-device per product brief)
- A `usePersonalMnemonic` data hook (component self-manages; add only if a second consumer appears)
- Showing personal mnemonic on list rows or hub (detail screen only)

### References

- [Source: `_bmad-output/planning-artifacts/epics.md:752-763` — Epic 4, Story 4.6 AC]
- [Source: `_bmad-output/planning-artifacts/prd.md:597` — FR26b: personal mnemonics for kanji/vocab/grammar, on-device]
- [Source: `_bmad-output/planning-artifacts/architecture.md:239` — `user.db` Personal mnemonics (`item_id`, user text)]
- [Source: `_bmad-output/planning-artifacts/architecture.md:160` — NFR10: user progress (incl. personal mnemonics) survives updates]
- [Source: `_bmad-output/planning-artifacts/architecture.md:813,911,1016` — `data/user/mnemonicRepository.ts`, surface `src/app/learn/item/[id].tsx`]
- [Source: `mobile/src/data/migrations/004_passage_practice_results.ts` + `index.ts` — migration shape and registration]
- [Source: `mobile/src/data/migrations/migrationRunner.ts`, `mobile/src/data/database.ts:121` — migrations auto-run on user.db]
- [Source: `mobile/src/data/user/passagePracticeRepository.ts` — upsert/`Number(id)`/mapper template]
- [Source: `mobile/src/data/user/itemStudyStatusRepository.ts:38-71` — `parseItemId`, empty-value → DELETE pattern]
- [Source: `mobile/src/components/read/PassageQuestion.tsx` — `TextInput` + Save + `useDatabase()` self-management + stale-flush]
- [Source: `mobile/src/components/learn/KanjiDetail.tsx:86-91`, `VocabularyDetail.tsx:73-78`, `GrammarDetail.tsx:85-90` — curriculum mnemonic blocks to insert after]
- [Source: `mobile/src/data/curriculum/itemRepository.ts:30-37` — `CurriculumItemDetail` (`id: string`, `mnemonicText: string | null`)]
- [Source: `mobile/__mocks__/expo-sqlite.ts:284-298,506-507,690-695` — INSERT/DELETE/SELECT handler + `__mockSet*` helper patterns]
- [Source: `mobile/src/app/(tabs)/learn/item/[id].test.tsx` — detail screen test harness + fixtures (kanji 2, vocab 3, grammar 4, radical 1)]
- [Source: `mobile/src/data/user/passagePracticeRepository.test.ts` — repo test harness to mirror]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

- Fixed detail component unit tests (KanjiDetail, VocabularyDetail, GrammarDetail) by mocking `useDatabase` — editor now renders inside those components.
- Updated `database.test.ts` migration count expectation from 4 → 5 for new migration.

### Completion Notes List

- Added migration 005 (`personal_mnemonics` table) to `user.db` with `item_id` PK, `mnemonic_text`, and `updated_at`.
- Implemented `mnemonicRepository.ts` with get/set/clear; empty/whitespace saves delete the row; trim + upsert idempotency.
- Built `PersonalMnemonicEditor` component (self-managing via `useDatabase`, stale-flush on `itemId` change).
- Wired editor into KanjiDetail, VocabularyDetail, and GrammarDetail below curriculum mnemonic blocks; RadicalDetail unchanged.
- Extended expo-sqlite mock with personal_mnemonics INSERT/DELETE/SELECT handlers and `__mockSetPersonalMnemonics` helper.
- Added `mnemonicRepository.test.ts` (6 cases) and 4 integration tests in `[id].test.tsx`.
- All CI checks pass: lint, typecheck, 322 tests green.

### File List

- `mobile/src/data/migrations/005_personal_mnemonics.ts` (new)
- `mobile/src/data/migrations/index.ts` (modified)
- `mobile/src/data/user/mnemonicRepository.ts` (new)
- `mobile/src/data/user/mnemonicRepository.test.ts` (new)
- `mobile/src/components/learn/PersonalMnemonicEditor.tsx` (new)
- `mobile/src/components/learn/KanjiDetail.tsx` (modified)
- `mobile/src/components/learn/VocabularyDetail.tsx` (modified)
- `mobile/src/components/learn/GrammarDetail.tsx` (modified)
- `mobile/__mocks__/expo-sqlite.ts` (modified)
- `mobile/src/app/(tabs)/learn/item/[id].test.tsx` (modified)
- `mobile/src/components/learn/KanjiDetail.test.tsx` (modified)
- `mobile/src/components/learn/VocabularyDetail.test.tsx` (modified)
- `mobile/src/components/learn/GrammarDetail.test.tsx` (modified)
- `mobile/src/data/database.test.ts` (modified)

### Change Log

- 2026-06-27: Story 4.6 drafted — personal mnemonics editor (migration 005, mnemonicRepository, PersonalMnemonicEditor on kanji/vocab/grammar detail).
- 2026-06-27: Story 4.6 implemented — personal mnemonics editor with user.db persistence, detail screen wiring, mock support, and full test coverage.
