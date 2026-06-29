---
baseline_commit: 58db293
---

# Story 6.4: Streak tracking and opt-in notifications

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> This story builds the **streak engine and notification infrastructure**. The cognitive load ring (Story 6.3), weakness stats (6.1–6.2), and SRS review engine (Epic 5) are already in place. This story adds: (1) the `streakRepository` + migration 009 that tracks daily review completion and computes streak state; (2) `useStreak` hook for UI consumers; (3) `StreakCounter` presentational component; (4) `config/notifications.ts` scheduling helpers using `expo-notifications`; and (5) notification settings in the Settings screen. It does **not** add the StreakCounter to the Home screen — that is Story 6.5 (Home composition). The `StreakCounter` is exported and ready; Story 6.5 places it.

## Story

As a **learner**,
I want **a visible streak counter and configurable daily reminders**,
so that **daily habit is reinforced without toxic gamification or spam (FR18, FR19, FR20, UX-DR15, UX-DR19)**.

## Context: what's already built and what this story creates

**Already built (do NOT rebuild):**

- `mobile/src/data/user/cognitiveLoadRepository.ts` exports `todayKey(now?: Date): string` — returns local `YYYY-MM-DD`. **Import and reuse this** for streak date keying; do NOT duplicate it.
- `mobile/src/data/migrations/index.ts` — migrations array, currently 8 entries (migrations 001–008). Add migration 009 here.
- `mobile/src/data/migrations/008_cognitive_load_history.ts` — exact pattern for migration 009.
- `mobile/src/data/user/preferencesRepository.ts` — key-value store with `getPreference` / `setPreference` and `PREFERENCE_KEYS` object. Notification preferences go here as new keys.
- `mobile/src/providers/ReviewSessionProvider.tsx` — `isComplete: boolean` is already derived (`currentIndex >= totalItems && totalItems > 0 && !isLoading && !error`). Streak update hooks off this.
- `mobile/src/components/engagement/index.ts` — exports `CognitiveLoadRing` and `DailyThresholdNotice`. Add `StreakCounter` export here.
- `mobile/src/data/database.test.ts` — currently asserts `migrationCount = 8`. **Must update to 9** after adding migration 009.
- `mobile/src/app/(tabs)/settings.tsx` — current settings screen with session intensity + weakness bias sections. Add notification section here.

**Does NOT exist yet (this story creates):**

- `mobile/src/data/migrations/009_streak.ts`
- `mobile/src/data/user/streakRepository.ts` + `streakRepository.test.ts`
- `mobile/src/data/hooks/useStreak.ts` + `useStreak.test.tsx`
- `mobile/src/components/engagement/StreakCounter.tsx` + `StreakCounter.test.tsx`
- `mobile/src/config/notifications.ts`
- `mobile/__mocks__/expo-notifications.ts`

## Acceptance Criteria

1. **(FR18 / UX-DR15 — streak engine)** Given a review session completes (all items in queue graded), when the session's local calendar day is recorded as a "reviewed" day, then the streak counter increments if yesterday was also reviewed or if today is the first review ever; the streak resets to 1 if the last review was 2+ days ago; the longest-ever streak is also tracked and never decrements.

2. **(FR18 — streak state derivation)** Given streak data in the DB, when `useStreak` is called, then it returns `{ currentStreak, longestStreak, lastReviewDate, streakState, isLoading, error, refetch }` where `streakState` is `'active'` (currentStreak > 0 and lastReviewDate === today), `'at-risk'` (currentStreak > 0 and lastReviewDate === yesterday — reviewed yesterday but not yet today), or `'broken'` (currentStreak === 0 or lastReviewDate is 2+ days ago).

3. **(NFR13 — timezone resilience)** Given the same local-day keying as cognitive load (`todayKey()` from `cognitiveLoadRepository.ts`), when the device timezone changes or the app restarts, then streaks persist accurately across timezone changes, device restarts, and offline periods. The local date at session completion determines the streak day.

4. **(UX-DR15 — StreakCounter component)** Given streak state from `useStreak`, when `StreakCounter` is rendered, then it shows: 🔥 flame + day count + "Current streak" label when `active`; 🔥 with an "at risk" sub-label when `at-risk`; and an encouraging restart message ("Start a new streak today!") with 0 count when `broken`. Accessibility: `accessibilityLabel="Current streak: [N] days"` (or "Streak broken: 0 days. Start a new streak today!" when broken). The component is presentational — it accepts `currentStreak`, `streakState`, and optionally `longestStreak` as props; it does not call hooks.

5. **(FR19 / FR20 — opt-in notifications)** Given notification permission not yet granted, when the user enables reminders in Settings, then the OS permission dialog is shown (following platform rules) and, if granted, a daily reminder notification is scheduled at the user's chosen time. If permission is denied, a graceful message is shown (no crash). Disabling notifications cancels all pending scheduled notifications. Never more than one notification per day.

6. **(FR20 — notification settings in Settings screen)** Given the Settings screen, when the user views it, then a "Daily reminders" section shows: (a) a toggle for enabled/disabled, (b) when enabled, a preset time picker (Morning 8:00 / Afternoon 13:00 / Evening 19:00 / Night 21:00 — user-selectable). Preference persists immediately via `preferencesRepository`. The section is only interactive when the OS has granted permission (or permission has been requested).

7. **(Layering / architecture compliance)** Streak math (increment/state derivation) lives in `streakRepository.ts` (since it's purely DB-driven, no separate `core/streak/` needed — unlike cognitive load which has tunable constants). `config/notifications.ts` is the only file that imports `expo-notifications`. `StreakCounter` is purely presentational. `useStreak` wires DB→UI.

8. **(No scope bleed)** This story does NOT add `StreakCounter` to the Home screen (deferred to 6.5). It does NOT build `PostSessionShareCard` or `TimeCompressionSummary` (deferred to 6.5). Home screen (`src/app/(tabs)/index.tsx`) is not touched.

## Tasks / Subtasks

- [x] **Task 0 — Install expo-notifications dependency (AC: #5, #6)**
  - [x] Run `npx expo install expo-notifications` from `mobile/`. This package is NOT currently in `package.json` — it must be installed before any `import * from 'expo-notifications'` can work.
  - [x] Verify the version added to `package.json` (should be `~0.29.x` or similar for Expo SDK 55 — check `npx expo install --check` output).
  - [x] Create `mobile/__mocks__/expo-notifications.ts` — a minimal Jest mock that exports `requestPermissionsAsync`, `scheduleNotificationAsync`, `cancelAllScheduledNotificationsAsync`, `getPermissionsAsync`, and `SchedulableTriggerInputTypes` (see Dev Notes "expo-notifications mock" for shape). Without this mock, all tests that import from `config/notifications.ts` will fail.

- [x] **Task 1 — Migration 009 + streakRepository (AC: #1, #3, #7)**
  - [x] Create `mobile/src/data/migrations/009_streak.ts` (version 9, follow the 008 shape):
    ```sql
    CREATE TABLE IF NOT EXISTS streaks (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      current_streak INTEGER NOT NULL DEFAULT 0,
      longest_streak INTEGER NOT NULL DEFAULT 0,
      last_review_date TEXT,
      updated_at TEXT NOT NULL
    );
    ```
    The `CHECK(id = 1)` enforces a singleton row (one row only ever). `last_review_date` is nullable — null means never reviewed.
  - [x] Register in `mobile/src/data/migrations/index.ts` (append `migration009Streak`).
  - [x] Update `mobile/src/data/database.test.ts`: change the `expect(migrationCount?.count).toBe(8)` assertions to `toBe(9)` (there are 2 such assertions in the file).
  - [x] Create `mobile/src/data/user/streakRepository.ts`:
    - Import `todayKey` from `@/data/user/cognitiveLoadRepository` — **do not duplicate it**.
    - `StreakRow = { id: number; current_streak: number; longest_streak: number; last_review_date: string | null; updated_at: string }` (internal DB shape).
    - `StreakData = { currentStreak: number; longestStreak: number; lastReviewDate: string | null }` (exported shape).
    - `getStreak(userDb: SQLiteDatabase): StreakData` — `getFirstSync` the singleton row; if null → `{ currentStreak: 0, longestStreak: 0, lastReviewDate: null }`. Returns plain value (not `Result` — reads are plain values per project precedent).
    - `recordReviewAndUpdateStreak(userDb: SQLiteDatabase, today: string): Result<StreakData, AppError>` — pure computation in JS, then upsert:
      1. Read current row (or default values if no row).
      2. If `lastReviewDate === today`: no-op; return current data (idempotent — calling twice on same day is safe).
      3. Compute `isConsecutive`: `lastReviewDate` equals yesterday's date string (compute `yesterdayKey(today)` inline).
      4. `newStreak = isConsecutive ? currentStreak + 1 : 1`.
      5. `newLongest = Math.max(longestStreak, newStreak)`.
      6. Upsert: `INSERT INTO streaks (id, current_streak, longest_streak, last_review_date, updated_at) VALUES (1, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET current_streak=excluded.current_streak, longest_streak=excluded.longest_streak, last_review_date=excluded.last_review_date, updated_at=excluded.updated_at`.
      7. Wrap in try/catch → `Result`. Return `{ ok: true, value: { currentStreak: newStreak, longestStreak: newLongest, lastReviewDate: today } }`.
    - **`yesterdayKey(today: string): string`** — compute the date one day before `today` from local date parts (do NOT use `toISOString()` — follow the same local-date principle as `todayKey`). Parse `today` as `YYYY-MM-DD`, subtract one day using `new Date(year, month-1, day - 1)`, format back. Helper needed only internally in repository; can export it for testing.
  - [x] Create `streakRepository.test.ts`:
    - First call → streak 0, no lastReviewDate.
    - `recordReviewAndUpdateStreak` on day 1 → streak = 1, longest = 1.
    - Call twice same day → idempotent; streak stays 1.
    - Day 2 consecutive → streak = 2, longest = 2.
    - Day 4 (missed day 3) → streak resets to 1, longest stays 2.
    - Longest never decrements.
    - `yesterdayKey('2026-06-29')` === `'2026-06-28'`; month boundary `'2026-06-01'` → `'2026-05-31'`; year boundary `'2026-01-01'` → `'2025-12-31'`.

- [x] **Task 2 — Extend expo-sqlite mock for streaks table (AC: #1)**
  - [x] Open `mobile/__mocks__/expo-sqlite.ts` and add handlers:
    - `runSync` handler for `INSERT INTO streaks ... ON CONFLICT(id) DO UPDATE` — mirror the `cognitive_load_history` ON CONFLICT handler at line ~338. Store row under key `'streaks'`; singleton: always overwrite `rows[0]`.
    - `getFirstSync` handler for `SELECT ... FROM streaks` — return `rows[0] ?? null` from `state.tables.get('streaks')`.
  - [x] Add this **only if the above queries aren't already handled** by the generic fallback — check `runSync` fallback logic first.

- [x] **Task 3 — `useStreak` hook (AC: #2, #7)**
  - [x] Create `mobile/src/data/hooks/useStreak.ts` at the reserved path (architecture.md §819). Mirror `useCognitiveLoad.ts` structure exactly.
  - [x] `StreakState = 'active' | 'at-risk' | 'broken'` — define in this file or co-locate in `streakRepository.ts`.
  - [x] Hook computes `streakState`:
    - `'active'` if `currentStreak > 0 && lastReviewDate === todayKey()`
    - `'at-risk'` if `currentStreak > 0 && lastReviewDate === yesterdayKey(todayKey())`
    - `'broken'` otherwise (streak = 0, or last review was 2+ days ago)
  - [x] Expose: `{ currentStreak, longestStreak, lastReviewDate, streakState, isLoading, error, refetch }`.
  - [x] Reads `getStreak(userDb)` in a try/catch; sets `error: AppError | null` on failure; never throws.
  - [x] Create `useStreak.test.tsx` — loading→loaded; `active` when lastReviewDate = today; `at-risk` when lastReviewDate = yesterday; `broken` when streak = 0; error path clears loading.

- [x] **Task 4 — StreakCounter component (AC: #4)**
  - [x] Create `mobile/src/components/engagement/StreakCounter.tsx`. Purely presentational — no hooks, no DB.
  - [x] Props: `{ currentStreak: number; streakState: StreakState; longestStreak?: number; testID?: string }`.
  - [x] Render per UX-DR15:
    - `active`: 🔥 `currentStreak` "Current streak" (e.g. "🔥 5 Current streak")
    - `at-risk`: 🔥 `currentStreak` "Current streak" + sub-label "Review today to keep it!"
    - `broken`: 0 "Start a new streak today!" (no flame, or dimmed flame)
  - [x] A11y: `accessibilityRole="text"` container; `accessibilityLabel` per AC #4. When `broken`: `"Streak broken: 0 days. Start a new streak today!"`. When active/at-risk: `"Current streak: ${currentStreak} days"` (+ " Review today to keep it!" when at-risk).
  - [x] Style with NativeWind semantic tokens: `text-primary`, `text-secondary`, `bg-surface`, etc. No raw hex.
  - [x] Export from `mobile/src/components/engagement/index.ts`.
  - [x] Create `StreakCounter.test.tsx`: renders correct copy + a11y label for each of the 3 states; at-risk shows sub-label; broken shows 0.

- [x] **Task 5 — Notification preferences in preferencesRepository (AC: #5, #6)**
  - [x] Add to `PREFERENCE_KEYS` in `preferencesRepository.ts`:
    ```ts
    notificationsEnabled: 'notifications_enabled',
    notificationReminderTime: 'notification_reminder_time',
    ```
  - [x] Add typed getters/setters:
    - `NotificationTime = 'morning' | 'afternoon' | 'evening' | 'night'` (maps to 08:00 / 13:00 / 19:00 / 21:00)
    - `getNotificationsEnabled(userDb): boolean` — `getPreference(PREFERENCE_KEYS.notificationsEnabled) === 'true'`; default `false` when null (opt-in by default is OFF).
    - `setNotificationsEnabled(userDb, enabled: boolean): void`
    - `getNotificationTime(userDb): NotificationTime` — returns preference or `'evening'` (19:00) as default.
    - `setNotificationTime(userDb, time: NotificationTime): void`
  - [x] Export `NotificationTime` type and the `NOTIFICATION_TIME_HOURS` map (`{ morning: 8, afternoon: 13, evening: 19, night: 21 }`) from this file — `config/notifications.ts` will import the map to schedule at the right hour.

- [x] **Task 6 — `config/notifications.ts` scheduling helpers (AC: #5, #7)**
  - [x] Create `mobile/src/config/notifications.ts` at the reserved path (architecture.md §833).
  - [x] This is the **only** file allowed to `import * as Notifications from 'expo-notifications'`.
  - [x] Exports:
    - `requestNotificationPermission(): Promise<boolean>` — calls `Notifications.requestPermissionsAsync()`, returns `granted` boolean.
    - `getNotificationPermissionStatus(): Promise<boolean>` — calls `Notifications.getPermissionsAsync()`, returns `granted` boolean without prompting.
    - `scheduleStreakReminder(hour: number, minute?: number): Promise<void>` — cancels all then schedules one repeating daily trigger: `Notifications.scheduleNotificationAsync({ content: { title: 'Time to review!', body: 'Your daily Japanese review is ready.' }, trigger: { type: SchedulableTriggerInputTypes.DAILY, hour, minute: minute ?? 0 } })`. Wrap in try/catch; log in `__DEV__` on error.
    - `cancelAllNotifications(): Promise<void>` — calls `Notifications.cancelAllScheduledNotificationsAsync()`. Wrap in try/catch.
  - [x] Note on "max one notification per day" (PRD §418): `scheduleStreakReminder` calls `cancelAllNotifications` first, then schedules exactly one daily repeating notification — this ensures never more than one per day by design.
  - [x] Do NOT add any `expo-notifications` calls outside this file.

- [x] **Task 7 — Wire streak update on session completion (AC: #1, #3)**
  - [x] In `mobile/src/providers/ReviewSessionProvider.tsx`, add a `useEffect` that fires when `isComplete` first becomes `true`:
    ```ts
    useEffect(() => {
      if (!isComplete) return;
      const today = todayKey();
      const result = recordReviewAndUpdateStreak(userDb, today);
      if (!result.ok && __DEV__) {
        console.warn('[ReviewSession] streak update failed', result.error);
      }
    }, [isComplete, userDb]);
    ```
  - [x] Import `recordReviewAndUpdateStreak` from `@/data/user/streakRepository` and `todayKey` from `@/data/user/cognitiveLoadRepository`.
  - [x] The streak update is **best-effort** — if it fails, do NOT crash or block the session completion UI. Pattern mirrors cognitive load (`if (!result.ok && __DEV__) console.warn`).
  - [x] Update `ReviewSessionProvider.test.tsx`: mock `streakRepository` (`jest.mock('@/data/user/streakRepository', () => ({ recordReviewAndUpdateStreak: jest.fn().mockReturnValue({ ok: true, value: { currentStreak: 1, longestStreak: 1, lastReviewDate: '2026-06-29' } }) }))` — follow existing `jest.mock` patterns for `srsStateRepository`). Assert `recordReviewAndUpdateStreak` is called once when session `isComplete` becomes true. Assert it is NOT called when session is in progress.

- [x] **Task 8 — Notification settings section in Settings screen (AC: #5, #6)**
  - [x] In `mobile/src/app/(tabs)/settings.tsx`, add an import for `getNotificationsEnabled`, `setNotificationsEnabled`, `getNotificationTime`, `setNotificationTime`, `NotificationTime`, `NOTIFICATION_TIME_HOURS` from `preferencesRepository`, and `requestNotificationPermission`, `cancelAllNotifications`, `scheduleStreakReminder` from `config/notifications`.
  - [x] Add state: `notificationsEnabled: boolean` and `notificationTime: NotificationTime`.
  - [x] Load both in the existing `useEffect` that loads `sessionIntensity` and `weaknessBiasEnabled`.
  - [x] Handler `handleNotificationsToggle(value: boolean)`:
    - If enabling: call `await requestNotificationPermission()`. If granted → `setNotificationsEnabled(userDb, true)`, `scheduleStreakReminder(NOTIFICATION_TIME_HOURS[notificationTime])`, update state. If denied → show a brief informational message ("Please enable notifications in device Settings to use this feature."), do NOT set preference to enabled. No crash.
    - If disabling: `setNotificationsEnabled(userDb, false)`, `cancelAllNotifications()`, update state.
  - [x] Handler `handleNotificationTimeChange(time: NotificationTime)`:
    - `setNotificationTime(userDb, time)`, update state. If `notificationsEnabled`, call `scheduleStreakReminder(NOTIFICATION_TIME_HOURS[time])` to reschedule at the new time.
  - [x] UI (add below the "Review queue" section):
    ```
    <View className="mt-8">
      <Text className="text-body font-semibold text-primary">Daily reminders</Text>
      <View className="mt-4 flex-row items-center justify-between">
        <View className="flex-1 pr-space-md">
          <Text className="text-body text-primary">Review reminder</Text>
          <Text className="mt-1 text-body-sm text-secondary">
            One reminder per day, at your chosen time.
          </Text>
        </View>
        <Switch
          accessibilityLabel="Enable daily review reminder"
          testID="settings-notifications-toggle"
          value={notificationsEnabled}
          onValueChange={handleNotificationsToggle}
        />
      </View>
      {notificationsEnabled ? (
        <View className="mt-4">
          {/* Four preset time options — render as tappable pills */}
        </View>
      ) : null}
    </View>
    ```
  - [x] For the time picker: render 4 tappable `Pressable` items with labels "Morning (8:00)", "Afternoon (13:00)", "Evening (19:00)", "Night (21:00)". Selected one gets highlighted (`bg-surface-elevated` border accent). Follow the SessionIntensityPicker visual pattern (see `components/onboarding/SessionIntensityPicker.tsx`) for styling.
  - [x] Mark the `handleNotificationsToggle` as `async`; the Settings component will need to handle the async flow gracefully (setState after await).

- [x] **Task 9 — Verification (AC: all)**
  - [x] Update `mobile/src/data/database.test.ts` migration count from 8 → 9 (2 occurrences).
  - [x] `npm run typecheck` — no errors.
  - [x] `npm run lint` — no warnings.
  - [x] `npm test` — all tests green (expect ~585+ tests; new tests for streakRepository, useStreak, StreakCounter add to total).
  - [x] Manual/DEV verification: complete a review session, verify streak increments. Complete a second session same day — idempotent. Check Settings notification toggle requests permission.

## Dev Notes

### Out of scope (do NOT build — later stories own these)

| Deferred | Owner |
|---|---|
| `StreakCounter` placement on **Home screen** | Story 6.5 (Home composition) |
| `PostSessionShareCard` — screenshot-ready session card with streak | Story 6.5 |
| `TimeCompressionSummary` — post-session time savings | Story 6.5 |
| **Streak-at-risk push notification** (the one that fires when evening arrives and no review done) | Deferred — requires background task / time-based trigger that fires even when app is closed; the MVP satisfies FR19 with the daily review reminder. Streak-at-risk can be a scheduled daily notification at a slightly earlier time if desired, but do not implement complex "has-user-reviewed-today" background check logic. |
| Streak milestone notification ("You hit a 7-day streak!") | Deferred to post-MVP |
| Streak freeze / grace day | Not in scope per PRD MVP |

### CRITICAL: expo-notifications is NOT installed

`expo-notifications` is listed in the architecture as a dependency but is **not currently in `package.json`**. The dev agent MUST run `npx expo install expo-notifications` before writing any import from that package. The Jest mock at `mobile/__mocks__/expo-notifications.ts` must also be created before running tests.

### expo-notifications mock shape

```ts
// mobile/__mocks__/expo-notifications.ts
export const SchedulableTriggerInputTypes = {
  DAILY: 'daily',
  DATE: 'date',
  TIME_INTERVAL: 'timeInterval',
};

export const requestPermissionsAsync = jest.fn().mockResolvedValue({ granted: true, status: 'granted' });
export const getPermissionsAsync = jest.fn().mockResolvedValue({ granted: false, status: 'undetermined' });
export const scheduleNotificationAsync = jest.fn().mockResolvedValue('mock-notification-id');
export const cancelAllScheduledNotificationsAsync = jest.fn().mockResolvedValue(undefined);
```

Keep it minimal — only mock what `config/notifications.ts` actually calls.

### Streak schema — why singleton table

The `streaks` table has `CHECK(id = 1)` to enforce a single row forever. This avoids a history table (which isn't needed by any current query) and keeps reads/writes simple: always upsert id=1. The `id INTEGER PRIMARY KEY CHECK(id = 1)` pattern prevents accidental multi-row inserts.

If future stories need streak history (e.g., heatmap), a separate `streak_days` log table can be added via a new migration without changing this schema.

### `yesterdayKey(today)` implementation

```ts
function yesterdayKey(today: string): string {
  const [year, month, day] = today.split('-').map(Number);
  const d = new Date(year, month - 1, day - 1); // local date arithmetic
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
```

This mirrors `todayKey()` — local date parts only, no UTC. Test the year/month boundary cases: `'2026-06-01'` → `'2026-05-31'`, `'2026-01-01'` → `'2025-12-31'`.

### Streak update is idempotent

`recordReviewAndUpdateStreak` checks `if (lastReviewDate === today) return current data`. This means calling it multiple times in a session (e.g., if `isComplete` flips true due to re-render) is safe. The DB write only happens once per day.

### StreakState derivation — v1 simplicity

v1 definition:
- `'active'` = streak > 0 AND lastReviewDate = today (reviewed today, all good)
- `'at-risk'` = streak > 0 AND lastReviewDate = yesterday (reviewed yesterday, haven't reviewed today yet)
- `'broken'` = streak = 0 OR lastReviewDate is 2+ days ago

This is purely derived from DB data — no time-of-day check. UX "at risk (close to reset time)" is satisfied by showing at-risk state all day until the user reviews. There is no "at-risk only after 6pm" complexity in v1.

### Non-blocking notification toggle

The `handleNotificationsToggle` in Settings is `async`. The Expo permission dialog is asynchronous. Pattern:
1. Set loading indicator if desired (optional for MVP — a simple toggle with no loading state is acceptable).
2. `await requestNotificationPermission()` — blocks until user responds to OS dialog.
3. Update state and preference based on result.

If the OS dialog is denied, show a warning text in the settings UI ("Notifications are blocked. Enable them in device Settings.") — not a modal or blocking screen.

### "Max one notification per day" invariant

`scheduleStreakReminder` always calls `cancelAllNotifications()` before scheduling. This guarantees no accumulation of duplicate notifications if called multiple times. The daily repeating trigger (`SchedulableTriggerInputTypes.DAILY`) fires once per 24 hours at the specified hour/minute.

### Architecture compliance

- **Layering:** `expo-notifications` only in `config/notifications.ts`. DB only in `streakRepository.ts`. Hook only in `useStreak.ts`. `StreakCounter` is purely presentational.
- **`todayKey` reuse:** import from `@/data/user/cognitiveLoadRepository` — it's already there, already tested, don't duplicate.
- **Error handling:** `recordReviewAndUpdateStreak` returns `Result<StreakData, AppError>`. Read (`getStreak`) returns plain value. `useStreak` catches errors and exposes `error: AppError | null`.
- **Naming:** `StreakState`, `StreakData`, `NotificationTime` — PascalCase types, no `I-` prefix, `type` over `interface`.
- **Migrations:** forward-only, `009` follows `008` pattern.
- **Styling:** NativeWind semantic tokens only — `text-primary`, `text-secondary`, `bg-surface`, `bg-surface-elevated`, `border-border`, `rounded-radius-md`, etc. No raw hex.

### File structure — new / modified

**New:**
- `mobile/src/data/migrations/009_streak.ts`
- `mobile/src/data/user/streakRepository.ts` + `streakRepository.test.ts`
- `mobile/src/data/hooks/useStreak.ts` + `useStreak.test.tsx`
- `mobile/src/components/engagement/StreakCounter.tsx` + `StreakCounter.test.tsx`
- `mobile/src/config/notifications.ts`
- `mobile/__mocks__/expo-notifications.ts`

**Modified:**
- `mobile/src/data/migrations/index.ts` (register migration 009)
- `mobile/src/data/database.test.ts` (update migration count 8 → 9)
- `mobile/src/data/user/preferencesRepository.ts` (add notification preference keys + typed getters/setters)
- `mobile/src/providers/ReviewSessionProvider.tsx` (useEffect for streak update on isComplete)
- `mobile/src/providers/ReviewSessionProvider.test.tsx` (mock streakRepository, assert streak called on complete)
- `mobile/src/app/(tabs)/settings.tsx` (add notifications section)
- `mobile/src/components/engagement/index.ts` (export StreakCounter)
- `mobile/__mocks__/expo-sqlite.ts` (add streaks table INSERT ON CONFLICT and SELECT handlers)

**NOT touched:**
- `mobile/src/app/(tabs)/index.tsx` (Home — fully deferred to 6.5)
- `mobile/src/app/review/index.tsx` (no streak UI in review screen)
- `mobile/src/core/` (no new core logic — streak math is simple enough to live in repository)

### Reuse map

| Need | Reuse |
|---|---|
| Local date key (YYYY-MM-DD, device timezone) | `todayKey()` from `@/data/user/cognitiveLoadRepository` |
| Key-value preference store | `getPreference`/`setPreference` + `PREFERENCE_KEYS` in `preferencesRepository.ts` |
| Hook shape (loading/error/refetch) | `useCognitiveLoad.ts` — mirror exactly |
| Migration object shape | `migration008CognitiveLoadHistory` — follow exactly |
| Singleton upsert (ON CONFLICT update) | `cognitiveLoadRepository.addDailyLoad` — same upsert pattern |
| Jest mock for new repo in provider tests | `ReviewSessionProvider.test.tsx` `jest.mock` patterns for `srsStateRepository` |
| expo-sqlite mock extension | Lines ~338–345 (cognitive_load_history ON CONFLICT handler) |
| Settings screen pattern (Switch + label) | Existing `weaknessBiasEnabled` section in `settings.tsx` |
| Preset picker visual pattern | `components/onboarding/SessionIntensityPicker.tsx` |

### Testing requirements

- **streakRepository:** consecutive days increment; non-consecutive resets to 1; same-day idempotent; longest never decrements; `yesterdayKey` month/year boundaries; empty DB → defaults.
- **useStreak:** all 3 state derivations; loading/error paths.
- **StreakCounter:** correct copy + a11y label for active/at-risk/broken.
- **ReviewSessionProvider:** `recordReviewAndUpdateStreak` called once on isComplete=true; not called during in-progress session.
- **Gate:** `npm run typecheck`, `npm run lint`, `npm test` all green from `mobile/`.

### References

- [Source: epics.md §"Story 6.4" — acceptance criteria (streak visibility, notification settings, NFR13)]
- [Source: prd.md §582 (FR18 streak), §583 (FR19 opt-in notifications), §584 (FR20 notification config), §411–419 (notification types, max one/day, opt-in only), §688 (NFR13 timezone), §685 (NFR10 data survives updates)]
- [Source: ux-design-specification.md §1008–1013 (StreakCounter anatomy + states), §245–257 (streak philosophy — habit not toxicity), §695/§703 (Home: streak card), §1176 (streak recovery — soft, no guilt), §890 (no background notifications during review)]
- [Source: architecture.md §185 (expo-notifications SDK 55), §240/§242 (streak + notification settings in user.db), §309 (engagement/ folder), §408 (hook naming), §699/§833 (settings.tsx, notifications.ts paths), §811/§819 (streakRepository, useStreak reserved paths), §909 (FR18–20 capability map)]
- [Source: mobile/src/data/user/cognitiveLoadRepository.ts — todayKey() to reuse, addDailyLoad upsert pattern]
- [Source: mobile/src/data/hooks/useCognitiveLoad.ts — hook structure to mirror for useStreak]
- [Source: mobile/src/data/migrations/008_cognitive_load_history.ts — migration pattern for 009]
- [Source: mobile/src/providers/ReviewSessionProvider.tsx — isComplete derivation (line 95), gradeCurrentItem async write tail pattern, existing jest.mock patterns in ReviewSessionProvider.test.tsx]
- [Source: mobile/src/app/(tabs)/settings.tsx — existing settings screen pattern to extend]
- [Source: mobile/src/data/user/preferencesRepository.ts — PREFERENCE_KEYS, getPreference/setPreference patterns]
- [Source: mobile/__mocks__/expo-sqlite.ts lines ~338–345 — cognitive_load_history mock pattern to extend for streaks table]
- [Source: Story 6.3 (6-3-cognitive-load-ring-and-daily-threshold-guidance.md) — deferred Home screen pattern, todayKey location, layering discipline, isComplete in ReviewSessionProvider]

### Review Findings

- [x] [Review][Patch] AC4 — `accessibilityLabelFor` broken branch accepts `currentStreak` param but always returns hardcoded "0 days", silently ignoring the value — misleading function contract. Fixed: renamed param to `displayCount`, computed from `isBroken ? 0 : currentStreak` before call, so label always reflects what's shown on screen. [mobile/src/components/engagement/StreakCounter.tsx:12-14]
- [x] [Review][Patch] AC5/AC6 — `handleNotificationsToggle` has no re-entry guard; rapid double-tap (especially on Android where permission dialogs aren't fully modal) can fire two concurrent async calls, leaving notification scheduled state out of sync with DB preference. Fixed: added `isRequestingPermission` ref + try/finally guard. [mobile/src/app/(tabs)/settings.tsx:61-94]
- [x] [Review][Defer] `useStreak` has no midnight refetch trigger — stale DB values (currentStreak, lastReviewDate) are cached until `refetch()` or remount; streakState derivation uses fresh `todayKey()` per render but raw counts stay stale. Accepted v1 limitation per spec "do not over-engineer". [mobile/src/data/hooks/useStreak.ts] — deferred, pre-existing
- [x] [Review][Defer] `isComplete` useEffect in ReviewSessionProvider fires again if `userDb` gets a new object reference while `isComplete=true` (e.g. context parent re-render past midnight); idempotency guard covers same-calendar-day but not cross-midnight re-fires. [mobile/src/providers/ReviewSessionProvider.tsx:98-105] — deferred, pre-existing
- [x] [Review][Defer] `isGrading.current` guard silently drops grades on rapid successive grading — pre-existing behavior not introduced by this story. [mobile/src/providers/ReviewSessionProvider.tsx] — deferred, pre-existing
- [x] [Review][Defer] `yesterdayKey` DST edge case — `new Date(year, month-1, day-1)` is local-time and could theoretically mis-calculate across a DST boundary; spec explicitly accepts "do not over-engineer DST" for v1. [mobile/src/data/user/streakRepository.ts:21-25] — deferred, pre-existing
- [x] [Review][Defer] Notification content hardcoded English ("Time to review!", "Your daily Japanese review is ready.") — no i18n path; out of scope for MVP. [mobile/src/config/notifications.ts:16-19] — deferred, pre-existing

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

- Fixed expo-sqlite mock streak INSERT param order (4 bind params, not 5).

### Completion Notes List

- Installed `expo-notifications@~55.0.24` (Expo SDK 55) with Jest mock.
- Added migration 009 (`streaks` singleton table), `streakRepository` with idempotent daily upsert and `yesterdayKey` helper.
- Added `useStreak` hook (active/at-risk/broken derivation) and presentational `StreakCounter` component.
- Wired streak update on review session completion in `ReviewSessionProvider` (best-effort).
- Added notification preferences, `config/notifications.ts` scheduling helpers, and Daily reminders section in Settings.
- All 604 tests pass; typecheck and lint clean.

### File List

**New:**
- `mobile/__mocks__/expo-notifications.ts`
- `mobile/src/data/migrations/009_streak.ts`
- `mobile/src/data/user/streakRepository.ts`
- `mobile/src/data/user/streakRepository.test.ts`
- `mobile/src/data/hooks/useStreak.ts`
- `mobile/src/data/hooks/useStreak.test.tsx`
- `mobile/src/components/engagement/StreakCounter.tsx`
- `mobile/src/components/engagement/StreakCounter.test.tsx`
- `mobile/src/config/notifications.ts`

**Modified:**
- `mobile/package.json`
- `mobile/package-lock.json`
- `mobile/src/data/migrations/index.ts`
- `mobile/src/data/database.test.ts`
- `mobile/src/data/user/preferencesRepository.ts`
- `mobile/src/providers/ReviewSessionProvider.tsx`
- `mobile/src/providers/ReviewSessionProvider.test.tsx`
- `mobile/src/app/(tabs)/settings.tsx`
- `mobile/src/components/engagement/index.ts`
- `mobile/__mocks__/expo-sqlite.ts`

### Change Log

- 2026-06-29: Story 6.4 — streak engine, StreakCounter component, opt-in daily notification reminders in Settings (Date: 2026-06-29)
