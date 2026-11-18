# Sign-out Clears the Device — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in user who signs out gets a clean device: the app syncs first, erases local data, and leaves the app (web: landing page; phone: onboarding welcome, which gets a "Sign in" button). After a sign-in on a device without finished onboarding, the app waits for the first sync and then opens the dashboard or onboarding.

**Architecture:** `SyncProvider` gets two new results it already computes internally: the outcome of the first run after sign-in (`firstRun`) and a sync used by sign-out (`syncBeforeSignOut`). The sign-out sheet becomes one confirm step plus a "sync did not finish" step. `OnboardingRedirect` holds its redirect while a new full-screen wait (`SignInSyncWait`) is up. Users who never sign in see no change.

**Tech Stack:** Expo 55 / RN 0.83, expo-router, NativeWind tokens, Jest (jest-expo) + @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-11-04-web-app-accounts-sync-design.md` ("Account settings"). This plan **changes** the spec line "Sign out keeps local progress…" (operator decision, 2026-11-18); Task 5 edits the spec. Where this plan says nothing, the spec and the Part 3 plan (`docs/superpowers/plans/2026-11-16-web-app-part3-progress-sync.md`) still apply.

**Branch:** `part3-sync` (no new branch). Do not commit `.DS_Store`. Do not push. Do not open a PR.

## Operator decisions this plan is built on (2026-11-18)

1. A signed-in sign-out always syncs first, then erases this device's data, then leaves the app. The "Sign out, keep my data" choice is removed. This applies to "Sign out" and "Sign out everywhere" on this device.
2. If that sync fails (offline, server error), nothing is signed out or erased. The sheet shows the error with "Try again", "Erase anyway" (with a loss warning) and "Cancel".
3. A sign-out the user did not start on this device (session ended: "Sign out everywhere" from another device, a removed device, an expired session) **keeps** the data and shows the existing copy "You were signed out. Sign in again to sync." This is today's behaviour; Task 2 adds the test that pins it.
4. Web leaves to the landing page `/` (already built: `leaveAfterErase()`, commit `6cd577cd`). The phone leaves to `/onboarding/welcome`, which gets a "Sign in to restore your progress" button (no new landing screen on the phone).
5. After a sign-in on a device whose onboarding is not completed, a full-screen wait shows until the first sync ends, then the app opens the dashboard (onboarding completed after the sync) or stays in onboarding. On failure: the sync error with "Try again" and "Start without sync".
6. Users who never sign in: no change anywhere.

**Open — confirm with the operator before Task 2:** "Delete account" stays as the spec says (server data deleted, **local progress stays**, the user stays in the app signed out). This plan does not change it.

## Global Constraints

- Sync must NEVER silently lose reviews or progress. An erase happens only after a sync that ended `up_to_date`, `pushed`, `pulled` or `merged`, or after the user pressed "Erase anyway".
- A signed-out user makes zero `/api/*` requests and sees no change (no new spinner beyond the existing account-status read, no new text).
- No silent fallbacks, no silent retries. Every "go on without sync" path is a button the user presses.
- Never log tokens, ID tokens, request bodies or auth headers.
- `Result<T, AppError>`; semantic NativeWind tokens only (no raw hex); capability checks (`isWeb()`, `supportsNativeGoogleSignIn()`), not try/catch, for platform differences. Async SQLite API only in sync code.
- Existing tests stay unchanged except the edits this plan names (Task 2: the six old sign-out tests in `AccountSettingsSection.test.tsx` and the two in `SignOutSheet.test.tsx`; Task 4: the `useAccount` mock added to `src/app/onboarding/welcome.test.tsx`).
- Typecheck the CI way: `mv .expo/types /tmp/expo-types-aside && npm run typecheck; mv /tmp/expo-types-aside .expo/types` (local generated route types lack `/converse`).
- Commit after each task with the trailers from the session's attribution reminder. Stage files by explicit path.
- `npm run deploy:web` and every remote command need the operator's approval (Task 5).

## Review Focus

1. **Offline sign-out.** The final sync fails with `network` → no sign-out call, no erase; the sheet shows the error and "Erase anyway". (Task 2 test `a failed sync shows the sync-failed step and never signs out or erases`.)
2. **Conflict during the final sync.** The conflict dialog opens over the sign-out sheet; sign-out waits for the choice, then goes on. Nothing is erased before the choice. (Task 1 test `syncBeforeSignOut waits for the conflict choice and resolves true after it`.)
3. **Web sign-out call fails after a good sync** (cookie session, server 500) → user stays signed in, nothing erased. (Task 2 test `a failed sign-out never erases`.)
4. **Signed-out cold start** → no wait screen text, no `/api` call, redirect exactly as today. (Task 3 test `signed out: no wait` plus the unchanged old `useOnboardingRedirect` tests; Task 1 test `firstRun is none when signed out` asserts zero API calls.)
5. **Stalled account loading** (slow `getAccount`) → spinner with no text; after 10 s "Start without sync" shows. (Task 3 test `after 10 s of waiting, Start without sync shows`.)

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
- Modify: `mobile/src/components/settings/SignOutSheet.tsx`, `mobile/src/components/settings/AccountSettingsSection.tsx`
- Test: `mobile/src/components/settings/SignOutSheet.test.tsx`, `mobile/src/components/settings/AccountSettingsSection.test.tsx`
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

**Exact copy (operator to confirm wording at review):**
- confirm step — title `Sign out?` / `Sign out everywhere?`; body `Your progress syncs first. Then it is erased from this device. Sign in again to get it back.`; with `everywhere`, a second paragraph `Your other devices are signed out too. They keep their progress until they sign in or sign out.`; buttons `Sync and sign out` (destructive), `Cancel` (ghost). While `busy`: the first button label is `Syncing…` and both are disabled.
- sync_failed step — title `Sync did not finish`; body `{syncError ?? 'The sync did not finish.'} If you erase now, progress that is not synced yet is lost.`; buttons `Try again` (primary), `Erase anyway` (destructive), `Cancel` (ghost).

**Flow in `AccountSettingsSection`:** confirm → `busy` → `syncBeforeSignOut()`; `false` → step `sync_failed` (no sign-out call); `true` → `signOut()` / `signOutEverywhere()`; resolves `true` → `onEraseLocalData()`. "Erase anyway" → sign-out call → `true` → `onEraseLocalData()` (no sync). "Cancel" closes and resets the step to `confirm`. A failed sign-out call never erases (unchanged rule).

- [ ] **Step 1: Replace the old sheet tests** in `SignOutSheet.test.tsx` (`erase step shows the exact copy`, `sign-out step says the synced copy stays on the server`) with: `confirm step shows the exact copy`, `confirm step for everywhere adds the other-devices paragraph`, `sync failed step shows the error and the exact copy`, `buttons are disabled and the label is Syncing… while busy`.
- [ ] **Step 2: Replace the six old flow tests** in `AccountSettingsSection.test.tsx` (`Sign out, keep my data signs out and does not erase`, `Sign out everywhere asks first and keeps the data when asked`, `erase warns that nothing is on the server, and Go back signs nothing out`, `Erase and sign out erases after the sign-out worked`, `a failed sign-out never erases`, `Sign out everywhere can erase too`) with:
  - `Sign out syncs first, then signs out, then erases` (call order asserted: `syncBeforeSignOut` → `signOut` → `onErase`)
  - `a failed sync shows the sync-failed step and never signs out or erases`
  - `Try again syncs again and signs out on success`
  - `Erase anyway signs out and erases without a sync`
  - `a failed sign-out never erases` (sync `true`, `signOut` resolves `false` → `onErase` not called)
  - `Sign out everywhere syncs first, then erases`
  - `Cancel signs nothing out and erases nothing`
  - `a sign-out the server ends never erases` (status goes `signed_in` → `signed_out` with `error: 'You were signed out. Sign in again to sync.'` and no sheet action → `onErase` not called, the error text shows)
  The file's `useSync` mock gains `syncBeforeSignOut: jest.fn()`.
- [ ] **Step 3: Run** `cd mobile && npx jest src/components/settings/SignOutSheet.test.tsx src/components/settings/AccountSettingsSection.test.tsx` → new tests FAIL.
- [ ] **Step 4: Implement** the props and flow above. Remove the old two-step "erase?" state and its copy.
- [ ] **Step 5: Run** the same command, plus `npx jest --runTestsByPath "src/app/(tabs)/settings/index.test.tsx"` → all PASS.
- [ ] **Step 6: Commit** `feat(account): sign-out syncs, erases this device and leaves`.

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

- [ ] **Step 1: Write the failing tests.**
  - `useSignInSyncWait.test.tsx`: `signed out: no wait`, `onboarding completed: no wait even while the first run is running`, `signed in with onboarding not completed: syncing until the first run ends`, `account loading: loading`, `first run failed: failed`, `Start without sync ends the wait`.
  - `SignInSyncWait.test.tsx`: `loading shows a spinner and no text`, `syncing shows Getting your progress…`, `failed shows the error and both buttons call their handlers`, `after 10 s of waiting, Start without sync shows` (fake timers).
  - `useOnboardingRedirect.test.tsx` (add only; the old tests run with `hold` omitted and must still pass unchanged): `holds every redirect while hold is true`, `opens the dashboard when the hold ends and onboarding is completed`.
- [ ] **Step 2: Run** `cd mobile && npx jest src/hooks/useSignInSyncWait.test.tsx src/components/sync/SignInSyncWait.test.tsx src/hooks/useOnboardingRedirect.test.tsx` → new tests FAIL (modules missing / no hold).
- [ ] **Step 3: Implement** the interfaces above.
- [ ] **Step 4: Run** the same command → all PASS.
- [ ] **Step 5: Commit** `feat(sync): wait for the first sync after a sign-in`.

### Task 4: "Sign in" on the onboarding welcome screen

**Files:**
- Modify: `mobile/src/app/onboarding/welcome.tsx`
- Test: `mobile/src/app/onboarding/welcome.test.tsx` (add a `jest.mock('@/providers/AccountProvider', …)` with `status` and `signIn`; old tests otherwise unchanged)

**Interfaces:**
- Consumes: `useAccount()` → `status`, `signIn()`, `error`.
- Produces: a `Button` with `variant="ghost"`, label `Sign in to restore your progress`, `testID="welcome-sign-in"`, below the three path cards and above the kana note; shown only when `status === 'signed_out'`. Press → `signIn()`. `error` (if any) shows under it with `text-caption font-ui-medium text-feedback-incorrect-deep`, `testID="welcome-sign-in-error"`. On all platforms (web sign-in leaves to `/auth/signin`; native uses the Google sheet; Task 3's wait takes over after it).

- [ ] **Step 1: Write the failing tests** in `welcome.test.tsx`: `signed out shows Sign in to restore your progress and it calls signIn`, `signed in or loading hides the sign-in button`, `a sign-in error shows under the button`.
- [ ] **Step 2: Run** `cd mobile && npx jest --runTestsByPath src/app/onboarding/welcome.test.tsx` → new tests FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command → all PASS.
- [ ] **Step 5: Commit** `feat(onboarding): sign in from the welcome screen`.

### Task 5: Docs, full checks, deploy, live check

**Files:**
- Modify: `docs/superpowers/specs/2026-11-04-web-app-accounts-sync-design.md` (line "**Sign out** keeps local progress…" → `**Sign out** (signed in, started on this device) syncs first, then erases this device's data and leaves the app (web: landing page; apps: onboarding welcome). If the sync fails, nothing is erased unless the user chooses "Erase anyway". A session that ends without the user (another device's "Sign out everywhere", a removed device, an expired session) keeps local progress. Changed 2026-11-18 by the operator.`)
- Modify: `CLAUDE.md` (Sync bullet: add `sign-out syncs, then erases the device; a session that ends on its own keeps the data`), `docs/working-history.md` (status line for this plan), `docs/design/backup-and-web-plan.md` only if it states the old sign-out rule (`grep -n -i "sign out\|sign-out" docs/design/backup-and-web-plan.md`).

- [ ] **Step 1:** Edit the docs above.
- [ ] **Step 2:** Full checks: `cd mobile && npm test -- --ci` (all pass; count = before + new), CI-way typecheck, `npm run lint` (0 errors); repo root `npm run check-contrast`.
- [ ] **Step 3: Commit** `docs: sign-out clears the device`.
- [ ] **Step 4 (operator approves):** `cd mobile && npm run deploy:web`.
- [ ] **Step 5 (operator, live web):** (a) signed in → Sign out → "Sync and sign out" → landing page opens; Settings data is gone on reopen. (b) DevTools offline → Sign out → "Sync did not finish" with "Erase anyway"; Cancel keeps everything. (c) Landing → Log in → wait screen "Getting your progress…" → dashboard with the data. (d) Never-signed-in browser profile: onboarding exactly as before, Network panel has no `/api/*` call.
- [ ] **Step 6:** Phone checks join Part 3 Task 14 Step 4 (dev-client rebuild): welcome "Sign in" → wait → dashboard; Sign out → welcome screen with no data.

## After this plan

Continue Part 3 Task 14 at Step 4 (phone builds), then Steps 5–7. The Part 3 plan's uncommitted notes (Task 12 Step 3 skipped; Task 14 Steps 1–2 ticked) go into the Task 14 Step 7 commit.
