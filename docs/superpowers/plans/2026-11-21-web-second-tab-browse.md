# Web second tab: browse-only + "Use here" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the web, a second tab opens in browse-only mode on an in-memory copy of the owner tab's databases, explains why in a modal and a banner, and can take over with "Use here".

**Architecture:** A Web Lock (`pakapaka-db`) decides the owner tab. A non-owner tab asks the owner on a `BroadcastChannel` for `serializeAsync()` copies of `curriculum.db` and `user.db`, and opens them in memory. "Use here" asks the owner to close its databases, stop the SQLite worker and drop the lock; the new tab then reloads as owner. Two patches to expo-sqlite's web worker make this possible.

**Tech Stack:** Expo (web), expo-sqlite 55 web worker (wa-sqlite, `AccessHandlePoolVFS`, `MemoryVFS`), patch-package, Web Locks API, BroadcastChannel, Jest + @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-11-21-web-second-tab-browse-design.md`

## Global Constraints

- Web only. Native behaviour does not change: every new branch is behind `isWeb()` (`src/platform/capabilities.ts`).
- Lock name and channel name: `pakapaka-db`.
- Timeout for the snapshot answer and for a "Use here" release: `5000` ms.
- No fallback to the bundled curriculum when the owner does not answer (spec anti-goal; "no hidden fallback" rule).
- Browse-only tab never runs: migrations, seed import, curriculum update check, sync, the session-ended erase, `requestPersistentStorage`.
- Fallible app functions return `Result<T, AppError>` (`src/types/result.types.ts`); do not throw across async boundaries.
- Styling: semantic NativeWind tokens only, no raw hex. Accessibility lint must pass (`npm run lint` in `mobile/`).
- Copy is fixed by the spec (exact strings in Tasks 5–6).

## Review Focus

1. **Owner tab mid-review gets "release".** The answer already given stays saved; the tab shows the "moved" screen and does not reopen by itself. → Task 4 test `owner release closes both handles before dropping the lock`.
2. **Owner tab closes (not hand-off) while tab B browses.** "Use here" in tab B must still work (lock free, nobody answers `release`). → Task 3 test `useHere succeeds when no owner exists`.
3. **Two browse-only tabs at once.** Each gets its own snapshot; a snapshot for another tab's request is ignored. → Task 3 test `requestSnapshot ignores answers for other request ids`.
4. **Deep link in tab B to a blocked route** (`/review`, `/lesson/...`, `/settings/about`). Shows the blocked screen, not the route. → Task 6 tests on `isBlockedInBrowseOnly`.
5. **Owner tab frozen/discarded by the browser.** Tab B shows the "did not answer" screen after 5 s for both Browse and Use here; no spinner forever. → Task 4 test `shows not-responding screen when the snapshot times out` and `... when the release times out`.

---

## File map

| File | Responsibility |
|---|---|
| `mobile/patches/expo-sqlite+55.0.17.patch` (modify, regenerate) | Lazy pool VFS; `deserializeInto` worker op; stop-worker event |
| `mobile/src/platform/web/dbLock.ts` (create) | Web Lock lease |
| `mobile/src/platform/web/tabChannel.ts` (create) | BroadcastChannel messages: snapshot request/answer, release |
| `mobile/src/data/snapshotDatabases.ts` (create) | Serialize owner DBs; open a snapshot in memory with the curriculum attached |
| `mobile/src/providers/TabModeContext.tsx` (create) | `browseOnly` flag + `useHere()` for the UI |
| `mobile/src/providers/DatabaseProvider.tsx` (modify) | Web tab state machine (owner / choose / browse-only / moving / moved / not-responding) |
| `mobile/src/components/tabs/BrowseOnlyIntroModal.tsx` (create) | First modal |
| `mobile/src/components/tabs/TabStatusScreens.tsx` (create) | Moving, Moved, Not-responding full screens |
| `mobile/src/components/tabs/BrowseOnlyBanner.tsx` (create) | Banner |
| `mobile/src/components/tabs/BrowseOnlyBlockedScreen.tsx` (create) | Blocked-route screen |
| `mobile/src/core/tabs/browseOnlyRoutes.ts` (create) | `isBlockedInBrowseOnly(pathname)` |
| `mobile/src/data/account/browseOnlySession.ts` (create) | Inert `AccountSession` (signed out, no network) |
| `mobile/src/app/_layout.tsx` (modify) | Inert session, banner, route guard in browse-only mode |

---

### Task 1: Patch expo-sqlite's web worker + browser spike

The rest of the plan depends on this. Prove it in a browser before Task 2.

**Files:**
- Modify: `mobile/node_modules/expo-sqlite/web/worker.ts`, `.../web/SQLiteModule.ts`, `.../web/web.types.ts`
- Regenerate: `mobile/patches/expo-sqlite+55.0.17.patch`
- Throwaway (delete before commit): `mobile/src/app/dev-snapshot-spike.tsx`

**Interfaces:**
- Produces:
  - Worker op `deserializeInto` `{ nativeDatabaseId: number; schemaName: string; serializedData: Uint8Array }` → `void`; runs `sqlite3.deserialize(pointer, schemaName, serializedData)`.
  - `NativeDatabase.deserializeIntoAsync(schemaName: string, data: Uint8Array): Promise<void>` on the web `NativeDatabase` class (reached from app code as `db.nativeDatabase`).
  - The worker is stopped when `window` gets the event `'expo-sqlite:stop-worker'` (same code as the existing `pagehide` handler; both listeners registered in `getWorker()`).
  - `maybeInitAsync()` no longer creates `AccessHandlePoolVFS`. New `maybeInitPoolAsync()` creates and registers it (default VFS) on first need; `openDatabase` (non-`:memory:`, non-serialized path), `deleteDatabase`, `importAssetDatabase`, `backupDatabase` and every other caller that uses `vfs` call it.

- [ ] **Step 1: Edit the three files in `node_modules/expo-sqlite/web/`** as in Interfaces. Add a `DeserializeIntoMessage` type and `deserializeInto: void` result entry to `web.types.ts`.

- [ ] **Step 2: Regenerate the patch**

Run: `cd mobile && npx patch-package expo-sqlite`
Expected: `Created file patches/expo-sqlite+55.0.17.patch`; `git diff patches/` keeps the two existing hunks (pagehide, sync buffers) and adds the new ones.

- [ ] **Step 3: Write the throwaway spike route `src/app/dev-snapshot-spike.tsx`**

It must not open any persistent database. It: opens `:memory:` db X, creates `items(id)` with one row, `serializeAsync()`; opens `:memory:` db Y, creates `srs(item_id)` with one row, `serializeAsync()`; then `deserializeDatabaseAsync(yBytes)` as U, `U.execSync("ATTACH ':memory:' AS curriculum")`, `await U.nativeDatabase.deserializeIntoAsync('curriculum', xBytes)`, and renders the result of `SELECT COUNT(*) FROM srs JOIN curriculum.items ON items.id = srs.item_id` using `getFirstSync`.

- [ ] **Step 4: Browser check with two tabs**

Run: `cd mobile && BROWSER=none npx expo start --web` (see memory: the auto-opened tab holds OPFS). Tab 1: open `/dashboard` (holds the lock on the files). Tab 2: open `/dev-snapshot-spike`.
Expected: tab 2 renders count `1`, and its console has no `NoModificationAllowedError` / `Access Handle` error. Tab 1 still works.

- [ ] **Step 5: Check `serializeAsync` on the real curriculum**

In tab 1 a 12 MB `serializeAsync` must work over the async worker path. Temporarily log `(await curriculumDb.serializeAsync()).byteLength` in `DatabaseProvider` after init (remove after).
Expected: about 12 000 000 bytes, no error.

If Step 4 or 5 fails, stop and report to the operator before Task 2.

- [ ] **Step 6: Delete the spike route and the temporary log; run tests**

Run: `cd mobile && npm test -- src/data src/providers`
Expected: PASS (unchanged; the Jest mock does not use the worker).

- [ ] **Step 7: Commit**

```bash
git add mobile/patches/expo-sqlite+55.0.17.patch
git commit -m "fix(web): expo-sqlite worker opens in-memory copies without the OPFS pool"
```

---

### Task 2: Snapshot databases (serialize + open in memory)

**Files:**
- Create: `mobile/src/data/snapshotDatabases.ts`
- Test: `mobile/src/data/snapshotDatabases.test.ts`
- Modify: `mobile/__mocks__/expo-sqlite.ts` (add `deserializeDatabaseAsync`, `serializeAsync`, `nativeDatabase.deserializeIntoAsync` to the mock if missing)

**Interfaces:**
- Consumes: `deserializeIntoAsync` (Task 1); `DatabaseHandles`, `CURRICULUM_ATTACH_ALIAS` from `src/data/database.ts`.
- Produces:
  - `export type DbSnapshot = { curriculum: Uint8Array; user: Uint8Array }`
  - `serializeDatabases(handles: DatabaseHandles): Promise<Result<DbSnapshot, AppError>>` — `serializeAsync('main')` on each.
  - `openSnapshotDatabases(snapshot: DbSnapshot): Promise<Result<DatabaseHandles, AppError>>` — `deserializeDatabaseAsync` both; on the user copy `PRAGMA foreign_keys = ON`, `ATTACH ':memory:' AS curriculum`, `deserializeIntoAsync('curriculum', snapshot.curriculum)`. Error code `'DB_SNAPSHOT_OPEN_ERROR'`; closes whatever opened on failure.

- [ ] **Step 1: Write failing tests**

```ts
it('serializeDatabases returns both byte arrays', ...) // expect value.curriculum / value.user to equal the mock's serialize output
it('openSnapshotDatabases attaches the curriculum copy to the user copy', ...)
  // expect userDb.execSync toHaveBeenCalledWith("ATTACH ':memory:' AS curriculum")
  // expect userDb.nativeDatabase.deserializeIntoAsync toHaveBeenCalledWith('curriculum', snapshot.curriculum)
it('openSnapshotDatabases closes both copies and returns DB_SNAPSHOT_OPEN_ERROR when attach fails', ...)
it('openSnapshotDatabases never opens a database by file name', ...) // openDatabaseAsync not called
```

- [ ] **Step 2: Run, expect FAIL** — `cd mobile && npx jest src/data/snapshotDatabases.test.ts` → "Cannot find module".
- [ ] **Step 3: Implement `src/data/snapshotDatabases.ts`.**
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `feat(web): open an in-memory copy of both databases`

---

### Task 3: Web Lock lease and tab channel

**Files:**
- Create: `mobile/src/platform/web/dbLock.ts`, `mobile/src/platform/web/tabChannel.ts`
- Test: `mobile/src/platform/web/dbLock.test.ts`, `mobile/src/platform/web/tabChannel.test.ts` (fakes for `navigator.locks` and `BroadcastChannel`; a fake that delivers to other instances with the same name, not to the sender, like the browser)

**Interfaces:**
- Consumes: `DbSnapshot` (Task 2).
- Produces:
  - `export const TAB_COORDINATION_NAME = 'pakapaka-db'`
  - `export const TAB_ANSWER_TIMEOUT_MS = 5000`
  - `export type DbLease = { release(): void }`
  - `tryAcquireDbLock(): Promise<DbLease | null>` — `ifAvailable: true`; holds the lock on a promise that `release()` resolves.
  - `waitForDbLock(timeoutMs: number): Promise<Result<DbLease, AppError>>` — queued request with an `AbortSignal`; timeout → `{ code: 'TAB_NOT_RESPONDING' }`.
  - `type TabMessage = { type: 'snapshot-request'; requestId: string } | { type: 'snapshot'; requestId: string; snapshot: DbSnapshot } | { type: 'release' }`
  - `serveOwnerTab(opts: { getSnapshot(): Promise<Result<DbSnapshot, AppError>>; onRelease(): void }): () => void` — answers each request; returns unsubscribe (closes channel). A failed `getSnapshot` sends nothing.
  - `requestSnapshot(timeoutMs: number): Promise<Result<DbSnapshot, AppError>>` — random `requestId`; timeout → `'TAB_NOT_RESPONDING'`.
  - `useHere(timeoutMs: number): Promise<Result<void, AppError>>` — starts `waitForDbLock`, then posts `release`; on lock grant releases it and returns ok (caller reloads).

- [ ] **Step 1: Write failing tests**

```ts
// dbLock
it('tryAcquireDbLock returns a lease when the lock is free and null when held')
it('release lets a waiting waitForDbLock resolve ok')
it('waitForDbLock returns TAB_NOT_RESPONDING after the timeout and aborts the request')
// tabChannel
it('serveOwnerTab answers a snapshot-request with the same requestId')
it('requestSnapshot ignores answers for other request ids')          // Review Focus 3
it('requestSnapshot returns TAB_NOT_RESPONDING after 5000 ms')       // fake timers
it('serveOwnerTab calls onRelease on a release message')
it('useHere succeeds when no owner exists')                          // Review Focus 2
it('useHere returns TAB_NOT_RESPONDING when the owner keeps the lock')
```

- [ ] **Step 2: Run, expect FAIL** — `cd mobile && npx jest src/platform/web`.
- [ ] **Step 3: Implement both files.**
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `feat(web): tab lock and channel for a second tab`

---

### Task 4: DatabaseProvider web tab modes + TabModeContext

**Files:**
- Create: `mobile/src/providers/TabModeContext.tsx`, `mobile/src/components/tabs/TabStatusScreens.tsx`
- Modify: `mobile/src/providers/DatabaseProvider.tsx`
- Test: `mobile/src/providers/DatabaseProvider.test.tsx` (mock `@/platform/web/dbLock`, `@/platform/web/tabChannel`, `@/data/snapshotDatabases`)

**Interfaces:**
- Consumes: Tasks 2–3; `BrowseOnlyIntroModal` from Task 5 (stub it in this task as a component that renders two buttons `Browse` / `Use here`; Task 5 replaces the body).
- Produces:
  - `export type TabModeValue = { browseOnly: boolean; useHere(): void }`
  - `TabModeContext` (default `{ browseOnly: false, useHere: () => {} }`) and `useTabMode(): TabModeValue`.
  - Provider state adds: `{ status: 'choose' }`, `{ status: 'moving' }`, `{ status: 'moved' }`; `ready` gets `browseOnly: boolean`; error code `'TAB_NOT_RESPONDING'` gets its own screen.
- Flow (web only; native path unchanged):
  - `tryAcquireDbLock()` → lease: today's init; then `serveOwnerTab({ getSnapshot: () => serializeDatabases(handles), onRelease })`. `onRelease`: set `moved`, close both handles, `window.dispatchEvent(new Event('expo-sqlite:stop-worker'))`, `lease.release()`, stop serving.
  - No lease → `choose` (renders `BrowseOnlyIntroModal`) and starts `requestSnapshot(TAB_ANSWER_TIMEOUT_MS)` at once. **Browse**: await that result → `openSnapshotDatabases` → `ready` with `browseOnly: true`, without the curriculum update and `requestPersistentStorage`.
  - **Use here** (modal, banner, blocked screen, moved screen): `moving` → `useHere(TAB_ANSWER_TIMEOUT_MS)` → ok: `window.location.reload()`; error: not-responding screen. In owner/browse tabs, close own handles before reload.
- Copy (`TabStatusScreens.tsx`):
  - Moving: "Moving PakaPaka to this tab…"
  - Moved: title "PakaPaka is open in another tab", body "You moved PakaPaka to another tab. Your answers up to now are saved.", button "Use here".
  - Not responding: title "The other PakaPaka tab did not answer", body "Open that tab once, then reload this page.", button "Reload".

- [ ] **Step 1: Write failing tests**

```ts
it('web: takes the owner path when the lock is free and serves snapshots')
it('web: shows the intro modal when the lock is held, and asks for a snapshot at once')
it('web: Browse opens the snapshot and renders children with browseOnly true')
it('web: browse-only skips the curriculum update and persistent storage')
it('web: shows not-responding screen when the snapshot times out')      // Review Focus 5
it('web: shows not-responding screen when the release times out')       // Review Focus 5
it('web: Use here reloads after the lock is granted')
it('owner release closes both handles before dropping the lock')        // Review Focus 1; then the moved screen shows
it('native: never touches the lock or channel')
```

- [ ] **Step 2: Run, expect FAIL** — `cd mobile && npx jest src/providers/DatabaseProvider.test.tsx`.
- [ ] **Step 3: Implement.** Keep the existing `DB_LOCKED_BY_OTHER_TAB` screen (owner got the lock but the files are still held, e.g. back/forward cache).
- [ ] **Step 4: Run, expect PASS** (old tests too).
- [ ] **Step 5: Commit** — `feat(web): second tab opens browse-only from the owner's copy`

---

### Task 5: Intro modal and banner

**Files:**
- Create: `mobile/src/components/tabs/BrowseOnlyIntroModal.tsx`, `mobile/src/components/tabs/BrowseOnlyBanner.tsx`
- Test: `mobile/src/components/tabs/BrowseOnlyIntroModal.test.tsx`, `mobile/src/components/tabs/BrowseOnlyBanner.test.tsx`

**Interfaces:**
- Produces:
  - `BrowseOnlyIntroModal({ browsePending, onBrowse, onUseHere }: { browsePending: boolean; onBrowse(): void; onUseHere(): void })`
  - `BrowseOnlyBanner()` — reads `useTabMode()`; renders nothing when `browseOnly` is false.
- Exact copy (modal; no close button, no dismiss on backdrop or Escape):
  - Title: "PakaPaka is already open in another tab"
  - "Only one tab can save your progress. So this tab cannot run reviews or lessons right now."
  - "Browse" / "Look up kanji, words and passages in this tab. Your review in the other tab keeps going. Progress here is from when this tab opened."
  - "Use here" / "Move PakaPaka to this tab. The other tab stops. Answers you gave there are saved."
  - Buttons: "Browse" (shows a spinner and is disabled while `browsePending`), "Use here".
- Banner copy: "Browse only. Reviews and lessons run in your other tab." + button "Use here".

- [ ] **Step 1: Write failing tests** — renders the exact strings; `onBrowse` / `onUseHere` fire; Browse disabled while `browsePending`; no close control (`queryByLabelText(/close/i)` is null); banner hidden when `browseOnly` false, its button calls `useHere`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** with existing `Button` and semantic tokens; wire the modal into Task 4's `choose` state (replace the stub).
- [ ] **Step 4: Run, expect PASS; `npm run lint` clean.**
- [ ] **Step 5: Commit** — `feat(web): explain browse-only mode with a modal and a banner`

---

### Task 6: Route guard, inert account session, root layout

**Files:**
- Create: `mobile/src/core/tabs/browseOnlyRoutes.ts`, `mobile/src/components/tabs/BrowseOnlyBlockedScreen.tsx`, `mobile/src/data/account/browseOnlySession.ts`
- Modify: `mobile/src/app/_layout.tsx`
- Test: `mobile/src/core/tabs/browseOnlyRoutes.test.ts`, `mobile/src/components/tabs/BrowseOnlyBlockedScreen.test.tsx`, `mobile/src/data/account/browseOnlySession.test.ts`

**Interfaces:**
- Consumes: `useTabMode()` (Task 4), `BrowseOnlyBanner` (Task 5).
- Produces:
  - `isBlockedInBrowseOnly(pathname: string): boolean` — true for `/review`, `/lesson`, `/settings`, `/converse`, `/onboarding`, `/levels`, `/start`, `/learn` and anything under them; false for `/`, `/dashboard`, `/browse...`, `/stats`, `/read...`.
  - `browseOnlySession: AccountSession` — `isSignedIn()` resolves `false`; every other method resolves `{ ok: false, error: { code: 'BROWSE_ONLY', ... } }`; makes no network call.
  - `BrowseOnlyBlockedScreen()` — title "Reviews and lessons run in the other tab", body "Only one tab can save your progress. This tab is for browsing. To study here, move PakaPaka to this tab.", buttons "Use here" (`useHere`) and "Back to Browse" (`router.replace('/browse')`).
- Root layout: when `browseOnly`, pass `session={browseOnlySession}` to `AccountProvider` (so sync never runs and no sign-out or erase can happen), render `BrowseOnlyBanner` above the content frame, and render `BrowseOnlyBlockedScreen` in place of the `Stack` when `isBlockedInBrowseOnly(usePathname())`. `AccountProvider` sits inside `DatabaseProvider`, so the mode is known before it mounts.

- [ ] **Step 1: Write failing tests**

```ts
it.each(['/review', '/review/item/k1', '/lesson', '/lesson/preview', '/settings', '/settings/about',
         '/onboarding/welcome', '/levels', '/start', '/learn', '/converse'])('%s is blocked')   // Review Focus 4
it.each(['/', '/dashboard', '/browse', '/browse/item/k1', '/browse/passage/p1', '/stats', '/read'])('%s is open')
it('/reviews-history is not blocked by prefix accident')   // segment match, not startsWith
it('browseOnlySession reports signed out and never calls fetch')
it('blocked screen: Use here calls useHere; Back to Browse replaces to /browse')
```

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement and wire `_layout.tsx`.**
- [ ] **Step 4: Run, expect PASS** — `cd mobile && npm test && npm run typecheck && npm run lint`.
- [ ] **Step 5: Commit** — `feat(web): block study screens in a browse-only tab`

---

### Task 7: Two-tab browser check + docs

**Files:**
- Modify: `docs/working-history.md` (add this plan with its status), `docs/known-issues.md` only if a check below fails and is not fixed.

- [ ] **Step 1: Run** `cd mobile && BROWSER=none npx expo start --web`; use Claude in Chrome.
- [ ] **Step 2: Check each, record pass/fail:**
  1. Tab A `/dashboard`, start a review, answer one card. Open tab B → modal with exact copy, no close button.
  2. Tab B **Browse** → banner; Browse search, a kanji detail and an unlocked passage show the same progress as tab A. A locked passage stays locked.
  3. Tab B: click Home's review button, and open `/settings` by URL → blocked screen both times.
  4. Tab A: answer the next card → works (review not interrupted).
  5. Tab B **Use here** → tab A shows the moved screen; tab B reloads as the normal app, with the answers from step 1 and 4 in Stats/Home.
  6. Tab A **Use here** → moves back.
  7. Close the owner tab; in the remaining browse-only tab press **Use here** → becomes owner.
- [ ] **Step 3: Update `docs/working-history.md`; commit** — `docs: record the browse-only second tab`

---

## Calls made in this plan (beyond the spec)

- Tab B uses an inert account session, so it looks signed out. Settings is blocked there, so this shows only in places like Home's sync status, if any.
- `/start`, `/learn`, `/levels` and onboarding are blocked (they can write).
- `/read` (legacy passages) stays open; it only reads.
