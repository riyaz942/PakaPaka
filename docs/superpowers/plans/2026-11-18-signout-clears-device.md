# Sign-out Clears the Device — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in user who signs out gets a clean device: the app syncs first, erases local data, and leaves the app (web: landing page; phone: a new start screen). A device whose session ends elsewhere erases itself when nothing is unsynced, else asks. Delete account also erases this device. After a sign-in on a device without finished onboarding, the app waits for the first sync and then opens the dashboard or onboarding.

**Architecture:** `SyncProvider` gets two new results it already computes internally: the outcome of the first run after sign-in (`firstRun`) and a sync used by sign-out (`syncBeforeSignOut`). The sign-out sheet becomes one confirm step plus a "sync did not finish" step. `OnboardingRedirect` holds its redirect while a new full-screen wait (`SignInSyncWait`) is up. Users who never sign in see no change.

**Tech Stack:** Expo 55 / RN 0.83, expo-router, NativeWind tokens, Jest (jest-expo) + @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-11-04-web-app-accounts-sync-design.md` ("Account settings"). This plan **changes** the spec line "Sign out keeps local progress…" and the Delete account line "Local progress on the device stays." (operator decisions, 2026-11-18); Task 7 edits the spec. Where this plan says nothing, the spec and the Part 3 plan (`docs/superpowers/plans/2026-11-16-web-app-part3-progress-sync.md`) still apply.

**Branch:** `part3-sync` (no new branch). Do not commit `.DS_Store`. Do not push. Do not open a PR.

## Operator decisions this plan is built on (2026-11-18)

1. A signed-in sign-out always syncs first, then erases this device's data, then leaves the app. The "Sign out, keep my data" choice is removed. This applies to "Sign out" and "Sign out everywhere" on this device.
2. If that sync fails (offline, server error), nothing is signed out or erased. The sheet shows the error with "Try again", "Erase anyway" (with a loss warning) and "Cancel".
3. ~~A sign-out the user did not start on this device keeps the data.~~ **Changed by the operator (2026-11-18, second answer):** when a device finds that its session ended without the user (another device's "Sign out everywhere", "Remove device", "Delete account", an expired session), it checks for unsynced progress. Nothing unsynced → it erases and leaves with no question (no loss: the server has it all). Unsynced progress → a full-screen "You were signed out" screen with "Sign in to sync it" and "Erase anyway"; the data stays until the user presses one. (Task 6.)
4. Web leaves to the landing page `/` (already built: `leaveAfterErase()`, commit `6cd577cd`). ~~The phone leaves to `/onboarding/welcome`.~~ **Changed by the operator:** the phone leaves to a new landing screen `/start` with "Start learning" and "Log in" (Task 5). The onboarding welcome screen still gets its "Sign in to restore your progress" button (Task 4) for fresh installs.
5. After a sign-in on a device whose onboarding is not completed, a full-screen wait shows until the first sync ends, then the app opens the dashboard (onboarding completed after the sync) or stays in onboarding. On failure: the sync error with "Try again" and "Start without sync".
6. Users who never sign in: no change anywhere.
7. **Delete account (operator, 2026-11-18):** works like "Sign out everywhere", but also deletes the server data and the account. No sync first (the server data is deleted anyway). Flow: confirm → server delete → on success erase this device and leave. If the server delete fails, nothing is erased. Other devices follow decision 3.
8. **Remove on the row marked "This device"** (controller ruling): it is a sign-out started on this device, so it opens the same sign-out sheet as "Sign out" (sync, sign out, erase, leave).
9. Sign-in with local progress on the device (check the account, merge, conflict dialog): already built per the spec section "First sign-in on a device". No change.

## Global Constraints

- Sync must NEVER silently lose reviews or progress. An erase happens only after a sync that ended `up_to_date`, `pushed`, `pulled` or `merged`, or after the user pressed "Erase anyway".
- A signed-out user makes zero `/api/*` requests and sees no change (no new spinner beyond the existing account-status read, no new text).
- No silent fallbacks, no silent retries. Every "go on without sync" path is a button the user presses.
- Never log tokens, ID tokens, request bodies or auth headers.
- `Result<T, AppError>`; semantic NativeWind tokens only (no raw hex); capability checks (`isWeb()`, `supportsNativeGoogleSignIn()`), not try/catch, for platform differences. Async SQLite API only in sync code.
- Sync must NEVER silently lose reviews or progress. An erase happens only after a sync that ended `up_to_date`, `pushed`, `pulled` or `merged`, after a check that found nothing unsynced (Task 6), after a successful server delete (Delete account), or after the user pressed "Erase anyway".
- Existing tests stay unchanged except the edits this plan names (Task 1: the new fields in the `syncState()` mock of `AccountSettingsSection.test.tsx`; Task 2: the six old sign-out tests in `AccountSettingsSection.test.tsx`, the two in `SignOutSheet.test.tsx`, the Delete account copy test (`Delete account asks first, with the exact copy`) and the `Remove calls removeDevice with that id` test only if it uses the current device's row; Task 4: the `useAccount` mock added to `src/app/onboarding/welcome.test.tsx`; Task 5: the native target in `leaveAfterErase.test.ts`; Task 6: new fields added to `useAccount` / `useSync` mocks only where typecheck needs them).
- Typecheck the CI way: `mv .expo/types /tmp/expo-types-aside && npm run typecheck; mv /tmp/expo-types-aside .expo/types` (local generated route types lack `/converse`).
- Commit after each task with the trailers from the session's attribution reminder. Stage files by explicit path.
- `npm run deploy:web` and every remote command need the operator's approval (Task 7).

## Review Focus

1. **Offline sign-out.** The final sync fails with `network` → no sign-out call, no erase; the sheet shows the error and "Erase anyway". (Task 2 test `a failed sync shows the sync-failed step and never signs out or erases`.)
2. **Conflict during the final sync.** The conflict dialog opens over the sign-out sheet; sign-out waits for the choice, then goes on. Nothing is erased before the choice. (Task 1 test `syncBeforeSignOut waits for the conflict choice and resolves true after it`.)
3. **Web sign-out call fails after a good sync** (cookie session, server 500) → user stays signed in, nothing erased. (Task 2 test `a failed sign-out never erases`.)
4. **Signed-out cold start** → no wait screen text, no `/api` call, redirect exactly as today. (Task 3 test `signed out: no wait` plus the unchanged old `useOnboardingRedirect` tests; Task 1 test `firstRun is none when signed out` asserts zero API calls.)
5. **Stalled account loading** (slow `getAccount`) → spinner with no text; after 10 s "Start without sync" shows. (Task 3 test `after 10 s of waiting, Start without sync shows`.)
6. **Session ended elsewhere with unsynced progress** → nothing erased until the user presses "Erase anyway"; a read error also asks. (Task 6 tests `a session that ends with unsynced changes sets sessionEnd to ask`, `a read error sets sessionEnd to ask`, `ask shows the screen and erases nothing until a press`.)
7. **Delete account fails on the server** → nothing erased. (Task 2 test `a failed Delete account never erases`.)

---

### Task 1: SyncProvider — first-run outcome and the sign-out sync

**Files:**
- Modify: `mobile/src/providers/SyncProvider.tsx`
- Test: `mobile/src/providers/SyncProvider.test.tsx`

**Interfaces:**
- Consumes: `SyncRunResult` from `@/core/sync/syncRunner` (`status: 'skipped' | 'up_to_date' | 'pushed' | 'pulled' | 'merged' | 'deferred' | 'error'`).
- Produces (added to `SyncContextValue`):
  - `firstRun: 'none' | 'running' | 'ok' | 'failed'` — `'none'` while the account is not `signed_in`; set to `'running'` in the signed-in effect **before** `run('open')` starts; `'ok'` when that run ends with status `up_to_date | pushed | pulled | merged`; `'failed'` for any other status. Reset to `'none'` on sign-out (part of `INITIAL_STATE`).
  - `retryFirstRun(): Promise<void>` — sets `'running'`, runs `'manual'`, sets `'ok' | 'failed'` by the same rule.
  - `syncBeforeSignOut(): Promise<boolean>` — runs `'manual'`; `true` only for `up_to_date | pushed | pulled | merged`.
- Internal: `runTrigger` returns `Promise<SyncRunResult | null>` (`null` when it returned early: signed out, unmounted, or the base clear failed); `run()` returns the same promise. `syncNow` keeps its `Promise<void>` signature.

- [x] **Step 1: Write the failing tests** (in the existing `describe` of `SyncProvider.test.tsx`, with its existing fakes):
  - `firstRun is running during the open run and ok after it` — signed in, fake API returns 204: `firstRun` is `'running'` before the run resolves and `'ok'` after.
  - `firstRun is failed when the open run fails, and retryFirstRun runs again` — first `GET` rejects with a network error: `'failed'`; second call succeeds; after `retryFirstRun()` it is `'ok'`, and the API got two `GET /api/sync` calls.
  - `firstRun is none when signed out` — signed out: `'none'`, zero API calls.
  - `syncBeforeSignOut resolves true after a pushed run and false after an error`.
  - `syncBeforeSignOut waits for the conflict choice and resolves true after it` — local and remote changed the same row: `conflicts` becomes non-null and the promise stays pending; after `chooseConflict('local')` it resolves `true` (the dialog has no close button, so a conflict always ends with a choice).
- [x] **Step 2: Run** `cd mobile && npx jest src/providers/SyncProvider.test.tsx` → the five new tests FAIL (`firstRun` is undefined / `syncBeforeSignOut is not a function`).
- [x] **Step 3: Implement** the interfaces above. Keep one helper `isGoodRun(result: SyncRunResult | null): boolean` (`result !== null && ['up_to_date','pushed','pulled','merged'].includes(result.status)`).
- [x] **Step 4: Run** the same command → all tests PASS (old and new).
- [x] **Step 5: Commit** `feat(sync): first-run outcome and a sync for sign-out`.

### Task 2: Sign-out syncs, erases and leaves

**Files:**
- Modify: `mobile/src/components/settings/SignOutSheet.tsx`, `mobile/src/components/settings/AccountSettingsSection.tsx`, `mobile/src/providers/AccountProvider.tsx` (`deleteAccount` returns `Promise<boolean>`)
- Test: `mobile/src/components/settings/SignOutSheet.test.tsx`, `mobile/src/components/settings/AccountSettingsSection.test.tsx`, `mobile/src/providers/AccountProvider.test.tsx`
- No change: `mobile/src/app/(tabs)/settings/index.tsx` (already passes `onEraseLocalData={handleEraseLocalData}`, which erases and calls `leaveAfterErase()`).

**Interfaces:**
- Consumes: `syncBeforeSignOut()` and `error` from `useSync()` (Task 1); `signOut()` / `signOutEverywhere()` from `useAccount()` (resolve `true` when this device ended signed out).
- Produces: `SignOutSheet` props:
  ```ts
  type SignOutSheetProps = {
    visible: boolean;
    everywhere: boolean;
    step: 'confirm' | 'sync_failed';
    busy: boolean;                 // disables the buttons while the sync or sign-out runs
    syncError: string | null;      // shown on the sync_failed step
    onConfirm: () => void;         // "Sync and sign out" and "Try again"
    onEraseAnyway: () => void;
    onCancel: () => void;
  };
  ```

**Exact copy (operator: "update and continue"; the controller wrote the everywhere and delete lines to match decisions 3 and 7; the operator sees them in the final report):**
- confirm step — title `Sign out?` / `Sign out everywhere?`; body `Your progress syncs first. Then it is erased from this device. Sign in again to get it back.`; with `everywhere`, a second paragraph `Your other devices are signed out too. Each one erases its progress. If a device has progress that is not synced, it asks first.`; buttons `Sync and sign out` (destructive), `Cancel` (ghost). While `busy`: the first button label is `Syncing…` and both are disabled.
- sync_failed step — title `Sync did not finish`; body `{syncError ?? 'The sync did not finish.'} If you erase now, progress that is not synced yet is lost.`; buttons `Try again` (primary), `Erase anyway` (destructive), `Cancel` (ghost).

**Flow in `AccountSettingsSection`:** confirm → `busy` → `syncBeforeSignOut()`; `false` → step `sync_failed` (no sign-out call); `true` → `signOut()` / `signOutEverywhere()`; resolves `true` → `onEraseLocalData()`. "Erase anyway" → sign-out call → `true` → `onEraseLocalData()` (no sync). "Cancel" closes and resets the step to `confirm`. A failed sign-out call never erases (unchanged rule).

**Delete account (decision 7):** `useAccount().deleteAccount()` changes to `Promise<boolean>` — `true` only when the server delete succeeded (it then signs out as today); the `session_ended` and other failure paths stay as they are and resolve `false`. Flow: the existing inline confirm → `deleteAccount()` → `true` → `onEraseLocalData()`. No sync first. `false` → nothing is erased. `DELETE_ACCOUNT_CONFIRM_COPY` becomes `This deletes your account and your progress on our server. All your devices are signed out, and this device is erased. This cannot be undone.`

**Remove on "This device" (decision 8):** the Remove button on the row with `device.current` opens the sign-out sheet with `everywhere = false` (same flow as "Sign out"); it does not call `removeDevice`. Rows of other devices are unchanged.

- [x] **Step 1: Replace the old sheet tests** in `SignOutSheet.test.tsx` (`erase step shows the exact copy`, `sign-out step says the synced copy stays on the server`) with: `confirm step shows the exact copy`, `confirm step for everywhere adds the other-devices paragraph`, `sync failed step shows the error and the exact copy`, `buttons are disabled and the label is Syncing… while busy`.
- [x] **Step 2: Replace the six old flow tests** in `AccountSettingsSection.test.tsx` (`Sign out, keep my data signs out and does not erase`, `Sign out everywhere asks first and keeps the data when asked`, `erase warns that nothing is on the server, and Go back signs nothing out`, `Erase and sign out erases after the sign-out worked`, `a failed sign-out never erases`, `Sign out everywhere can erase too`) with:
  - `Sign out syncs first, then signs out, then erases` (call order asserted: `syncBeforeSignOut` → `signOut` → `onErase`)
  - `a failed sync shows the sync-failed step and never signs out or erases`
  - `Try again syncs again and signs out on success`
  - `Erase anyway signs out and erases without a sync`
  - `a failed sign-out never erases` (sync `true`, `signOut` resolves `false` → `onErase` not called)
  - `Sign out everywhere syncs first, then erases`
  - `Cancel signs nothing out and erases nothing`
  - `a sign-out the server ends never erases` (status goes `signed_in` → `signed_out` with `error: 'You were signed out. Sign in again to sync.'` and no sheet action → `onErase` not called, the error text shows)
  The file's `useSync` mock gains `syncBeforeSignOut: jest.fn()`.
  Also: replace `Delete account asks first, with the exact copy` (its assertion on the old copy) with `Delete account asks first, with the exact copy` asserting the new copy, and add `Delete account erases this device after the server delete worked`, `a failed Delete account never erases`, `Remove on this device opens the sign-out sheet and calls no removeDevice`. In `src/providers/AccountProvider.test.tsx` add `deleteAccount resolves true only when the server delete worked`.
- [x] **Step 3: Run** `cd mobile && npx jest src/components/settings/SignOutSheet.test.tsx src/components/settings/AccountSettingsSection.test.tsx src/providers/AccountProvider.test.tsx` → new tests FAIL.
- [x] **Step 4: Implement** the props and flow above. Remove the old two-step "erase?" state and its copy.
- [x] **Step 5: Run** the same command, plus `npx jest --runTestsByPath "src/app/(tabs)/settings/index.test.tsx"` → all PASS.
- [x] **Step 6: Commit** `feat(account): sign-out syncs, erases this device and leaves`.

### Task 3: Wait for the first sync after a sign-in

**Files:**
- Create: `mobile/src/hooks/useSignInSyncWait.ts`, `mobile/src/components/sync/SignInSyncWait.tsx`
- Modify: `mobile/src/hooks/useOnboardingRedirect.ts`, `mobile/src/providers/OnboardingRedirect.tsx`, `mobile/src/app/_layout.tsx` (move `<OnboardingRedirect />` to after the `<View>` that holds the `<Stack>`, so its overlay draws above the screens; `SyncConflictDialog` is a `Modal` and still draws above it)
- Test: `mobile/src/hooks/useSignInSyncWait.test.tsx`, `mobile/src/components/sync/SignInSyncWait.test.tsx`, `mobile/src/hooks/useOnboardingRedirect.test.tsx` (new tests only)

**Interfaces:**
- Consumes: `firstRun`, `retryFirstRun`, `error`, `appliedVersion` (Task 1); `status` from `useAccount()`; `isOnboardingCompleted(userDb)`.
- Produces:
  - `useSignInSyncWait(): { wait: 'none' | 'loading' | 'syncing' | 'failed'; startWithoutSync(): void }`. Rules, in order: onboarding completed (re-read when `appliedVersion` changes) → `'none'`; `startWithoutSync()` pressed → `'none'`; account `signed_out` → `'none'`; account `loading` → `'loading'`; signed in and `firstRun` is `'none'` or `'running'` → `'syncing'`; `'failed'` → `'failed'`; `'ok'` → `'none'`.
  - `useOnboardingRedirect(appliedVersion = 0, hold = false): void` — while `hold` is true it does nothing. When `hold` goes from `true` to `false` and onboarding is completed, it calls `router.replace('/dashboard')` once (this covers the web return to `/settings?signin=ok`). All other behaviour unchanged.
  - `SignInSyncWait({ wait, onRetry, onStartWithoutSync })`: renders nothing for `'none'`; otherwise an absolute full-screen `View` with `bg-background`, `testID="signin-sync-wait"`. `'loading'`: `ActivityIndicator` only (accessibility label `Loading`), no text. `'syncing'`: spinner + `Getting your progress…`. `'failed'`: the sync error text (or `Sync did not finish.`), buttons `Try again` → `onRetry`, `Start without sync` → `onStartWithoutSync`. In `'loading'`/`'syncing'`, after `START_WITHOUT_SYNC_AFTER_MS = 10_000` a `Start without sync` button also shows.
  - `OnboardingRedirect` = `const w = useSignInSyncWait(); useOnboardingRedirect(appliedVersion, w.wait !== 'none'); return <SignInSyncWait … />`.

- [x] **Step 1: Write the failing tests.**
  - `useSignInSyncWait.test.tsx`: `signed out: no wait`, `onboarding completed: no wait even while the first run is running`, `signed in with onboarding not completed: syncing until the first run ends`, `account loading: loading`, `first run failed: failed`, `Start without sync ends the wait`.
  - `SignInSyncWait.test.tsx`: `loading shows a spinner and no text`, `syncing shows Getting your progress…`, `failed shows the error and both buttons call their handlers`, `after 10 s of waiting, Start without sync shows` (fake timers).
  - `useOnboardingRedirect.test.tsx` (add only; the old tests run with `hold` omitted and must still pass unchanged): `holds every redirect while hold is true`, `opens the dashboard when the hold ends and onboarding is completed`.
- [x] **Step 2: Run** `cd mobile && npx jest src/hooks/useSignInSyncWait.test.tsx src/components/sync/SignInSyncWait.test.tsx src/hooks/useOnboardingRedirect.test.tsx` → new tests FAIL (modules missing / no hold).
- [x] **Step 3: Implement** the interfaces above.
- [x] **Step 4: Run** the same command → all PASS.
- [x] **Step 5: Commit** `feat(sync): wait for the first sync after a sign-in`.

### Task 4: "Sign in" on the onboarding welcome screen

**Files:**
- Modify: `mobile/src/app/onboarding/welcome.tsx`
- Test: `mobile/src/app/onboarding/welcome.test.tsx` (add a `jest.mock('@/providers/AccountProvider', …)` with `status` and `signIn`; old tests otherwise unchanged)

**Interfaces:**
- Consumes: `useAccount()` → `status`, `signIn()`, `error`.
- Produces: a `Button` with `variant="ghost"`, label `Sign in to restore your progress`, `testID="welcome-sign-in"`, below the three path cards and above the kana note; shown only when `status === 'signed_out'`. Press → `signIn()`. `error` (if any) shows under it with `text-caption font-ui-medium text-feedback-incorrect-deep`, `testID="welcome-sign-in-error"`. On all platforms (web sign-in leaves to `/auth/signin`; native uses the Google sheet; Task 3's wait takes over after it).

- [x] **Step 1: Write the failing tests** in `welcome.test.tsx`: `signed out shows Sign in to restore your progress and it calls signIn`, `signed in or loading hides the sign-in button`, `a sign-in error shows under the button`.
- [x] **Step 2: Run** `cd mobile && npx jest --runTestsByPath src/app/onboarding/welcome.test.tsx` → new tests FAIL.
- [x] **Step 3: Implement.**
- [x] **Step 4: Run** the same command → all PASS.
- [x] **Step 5: Commit** `feat(onboarding): sign in from the welcome screen`.

### Task 5: Phone landing screen `/start` (decision 4, added 2026-11-18)

**Files:**
- Create: `mobile/src/app/start.tsx`
- Modify: `mobile/src/components/settings/leaveAfterErase.ts` (native: `router.replace('/start')`; web unchanged), `mobile/src/app/_layout.tsx` (`<Stack.Screen name="start" options={{ headerShown: false }} />`), `mobile/src/hooks/useOnboardingRedirect.ts` (`start` segment)
- Test: `mobile/src/app/start.test.tsx`, `mobile/src/components/settings/leaveAfterErase.test.ts` (native target edit only), `mobile/src/hooks/useOnboardingRedirect.test.tsx` (new tests only)

**Interfaces:**
- Consumes: `useAccount()` → `status`, `signIn()`, `error`.
- Produces: `StartScreen` (default export of `start.tsx`): full screen, `bg-background`, safe-area padded, `testID="start-screen"`. Content: title `PakaPaka`; line `Learn Japanese with one connected story.` (same words as the web landing title); `Button` primary `Start learning` (`testID="start-begin"`) → `router.replace('/onboarding/welcome')`; `Button` secondary `Log in` (`testID="start-login"`), disabled unless `status === 'signed_out'` → `signIn()`; `error` (if any) under it with `text-caption font-ui-medium text-feedback-incorrect-deep`, `testID="start-login-error"`. When `status` becomes `signed_in`, the screen calls `router.replace('/onboarding/welcome')` once: Task 3's wait covers the screen and its held redirect then opens the dashboard (onboarding completed by the sync) or leaves the user in onboarding. Existing typography/spacing tokens only (copy the classes `welcome.tsx` uses for its title and body).
- `useOnboardingRedirect`: a `start` first segment is treated like `onboarding` — no redirect while onboarding is not completed; `router.replace('/dashboard')` when completed (and not held).
- Fresh installs are unchanged: `/` → `/dashboard` → redirect to `/onboarding/welcome`. Only `leaveAfterErase()` on the phone opens `/start`.

- [x] **Step 1: Write the failing tests.** `start.test.tsx`: `shows the title, the line and both buttons`, `Start learning opens the onboarding welcome`, `Log in calls signIn and is disabled unless signed out`, `a sign-in error shows under Log in`, `signed in opens the onboarding welcome`. `useOnboardingRedirect.test.tsx`: `stays on start while onboarding is not completed`, `opens the dashboard from start when onboarding is completed`. `leaveAfterErase.test.ts`: the native expectation changes to `/start`.
- [x] **Step 2: Run** `cd mobile && npx jest --runTestsByPath src/app/start.test.tsx src/hooks/useOnboardingRedirect.test.tsx src/components/settings/leaveAfterErase.test.ts` → new tests FAIL.
- [x] **Step 3: Implement.**
- [x] **Step 4: Run** the same command → all PASS.
- [x] **Step 5: Commit** `feat(app): phone landing screen after sign-out`.

### Task 6: A session that ends elsewhere erases this device when nothing is unsynced (decision 3, added 2026-11-18)

**Files:**
- Create: `mobile/src/core/sync/hasUnsyncedChanges.ts`, `mobile/src/components/sync/SessionEndedHost.tsx`
- Modify: `mobile/src/providers/AccountProvider.tsx`, `mobile/src/providers/SyncProvider.tsx`, `mobile/src/app/_layout.tsx` (mount `<SessionEndedHost />` right after `<OnboardingRedirect />`)
- Test: `mobile/src/core/sync/hasUnsyncedChanges.test.ts`, `mobile/src/components/sync/SessionEndedHost.test.tsx`, `mobile/src/providers/AccountProvider.test.tsx`, `mobile/src/providers/SyncProvider.test.tsx` (new tests only)

**Interfaces:**
- `hasUnsyncedChanges(local: BackupData, base: SyncBase | null, known: KnownContent): boolean` (pure) — `base === null` → `!isEmptyProgress(local)`; `base.pendingReplace` → `true`; otherwise `!sameSyncData(withCarriedRows(local, base.data, known, base.carried), base.data)` (the same rule the runner uses for its `up_to_date` shortcut).
- `AccountContextValue` gains `sessionEnded: boolean` — `true` when the last move to `signed_out` came from a `session_ended` error (the `fail()` path, and Delete account's `session_ended` path); `false` after any other sign-out and after a sign-in.
- `SyncContextValue` gains `sessionEnd: 'none' | 'erase' | 'ask'` (in `State`, `'none'` in `INITIAL_STATE`). In the `signed_out` branch, inside the existing `hold(...)` and **before** `clearSyncBase`: when `account.sessionEnded` is true, read the snapshot (`readSyncSnapshot`) and the base (`readSyncBase`); both ok and `!hasUnsyncedChanges(snapshot.data, base, snapshot.lookup.known)` → `'erase'`; unsynced changes or a read error → `'ask'`. Then clear the base as today. A user-started sign-out leaves `'none'`. No `/api` call.
- `SessionEndedHost` (reads `useSync().sessionEnd`, `useAccount()`, `useDatabase().userDb`): `'none'` → renders nothing. `'erase'` → once: `eraseLocalData(userDb)`; ok → `leaveAfterErase()`; error → shows the `'ask'` screen with the error text. `'ask'` → absolute full-screen `View`, `bg-background`, `testID="session-ended"`: title `You were signed out`; body `This device has progress that is not synced yet. Sign in again to sync it, or erase it from this device.`; buttons `Sign in to sync it` (primary) → `signIn()`, `Erase anyway` (destructive) → `eraseLocalData` + `leaveAfterErase()`; account `error` under the buttons. After a sign-in, `sessionEnd` returns to `'none'` (set in the `signed_in` branch) and the screen goes away.

- [ ] **Step 1: Write the failing tests.** `hasUnsyncedChanges.test.ts`: `no base and empty progress: nothing unsynced`, `no base and progress: unsynced`, `pending replace: unsynced`, `local equals the base: nothing unsynced`, `a changed row: unsynced`, `a carried row that local lacks: nothing unsynced`. `AccountProvider.test.tsx`: `sessionEnded is true after a session_ended error and false after signOut`. `SyncProvider.test.tsx`: `a session that ends with nothing unsynced sets sessionEnd to erase`, `a session that ends with unsynced changes sets sessionEnd to ask`, `a user sign-out leaves sessionEnd none`, `a read error sets sessionEnd to ask`. `SessionEndedHost.test.tsx`: `none renders nothing`, `erase erases and leaves without a question`, `ask shows the screen and erases nothing until a press`, `Erase anyway erases and leaves`, `Sign in to sync it calls signIn`, `a failed erase shows the ask screen with the error`.
- [ ] **Step 2: Run** `cd mobile && npx jest src/core/sync/hasUnsyncedChanges.test.ts src/components/sync/SessionEndedHost.test.tsx src/providers/AccountProvider.test.tsx src/providers/SyncProvider.test.tsx` → new tests FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command → all PASS.
- [ ] **Step 5: Commit** `feat(sync): a session that ends elsewhere erases this device when all is synced`.

### Task 7: Docs, full checks, deploy, live check

**Files:**
- Modify: `docs/superpowers/specs/2026-11-04-web-app-accounts-sync-design.md` ("Account settings"): the line "**Sign out** keeps local progress…" → `**Sign out** (signed in, started on this device) syncs first, then erases this device's data and leaves the app (web: landing page; apps: the start screen). If the sync fails, nothing is erased unless the user chooses "Erase anyway". A device whose session ends without the user (another device's "Sign out everywhere", a removed device, Delete account, an expired session) erases its data and leaves when it has nothing unsynced; otherwise it asks ("Sign in to sync it" / "Erase anyway"). Changed 2026-11-18 by the operator.`; and the Delete account line "Local progress on the device stays." → `It also signs out every device and erases this device (no sync first); other devices follow the session-ended rule. Changed 2026-11-18 by the operator.`
- Modify: `CLAUDE.md` (Sync bullet: add `sign-out syncs, then erases the device; a session that ends elsewhere erases only when nothing is unsynced, else asks`), `docs/working-history.md` (status line for this plan), `docs/design/backup-and-web-plan.md` only if it states the old sign-out or delete rule (`grep -n -i "sign out\|sign-out\|delete account" docs/design/backup-and-web-plan.md`).

- [ ] **Step 1:** Edit the docs above.
- [ ] **Step 2:** Full checks: `cd mobile && npm test -- --ci` (all pass; count = before + new), CI-way typecheck, `npm run lint` (0 errors); repo root `npm run check-contrast`.
- [ ] **Step 3: Commit** `docs: sign-out clears the device`.
- [ ] **Step 4 (operator approves):** `cd mobile && npm run deploy:web`.
- [ ] **Step 5 (operator, live web):** (a) signed in → Sign out → "Sync and sign out" → landing page opens; Settings data is gone on reopen. (b) DevTools offline → Sign out → "Sync did not finish" with "Erase anyway"; Cancel keeps everything. (c) Landing → Log in → wait screen "Getting your progress…" → dashboard with the data. (d) Never-signed-in browser profile: onboarding exactly as before, Network panel has no `/api/*` call. (e) Two browser profiles signed in to one account, both synced: profile A → Sign out everywhere → profile B, on reload, erases and opens the landing page. (f) Same, but profile B made a review it did not sync (offline, then back online before the reload): B shows "You were signed out" with "Sign in to sync it" / "Erase anyway"; nothing erased until a press. (g) Delete account → landing page; the other profile erases on reload (if all synced).
- [ ] **Step 6:** Phone checks join Part 3 Task 14 Step 4 (dev-client rebuild): Sign out → start screen with no data; start "Log in" → wait → dashboard; welcome "Sign in" → wait → dashboard; session ended elsewhere → erase or ask.

## After this plan

Continue Part 3 Task 14 at Step 4 (phone builds), then Steps 5–7. The Part 3 plan's uncommitted notes (Task 12 Step 3 skipped; Task 14 Steps 1–2 ticked) go into the Task 14 Step 7 commit.
