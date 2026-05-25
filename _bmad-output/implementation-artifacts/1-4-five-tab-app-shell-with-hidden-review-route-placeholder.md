# Story 1.4: Five-tab app shell with hidden review route placeholder

Status: in-progress

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a **learner**,
I want **Home, Learn, Read, Stats, and Settings tabs using Expo Router**,
So that **navigation matches the UX model before features land (UX-DR18 skeleton)**.

## Acceptance Criteria

1. **Five-tab shell (UX-DR18 skeleton)**

   **Given** the app uses the architecture routing layout  
   **When** I open the app  
   **Then** a bottom tab bar shows exactly five tabs: **Home**, **Learn**, **Read**, **Stats**, **Settings**  
   **And** each tab navigates to a dedicated placeholder screen showing that tab’s title in `text-title` / `text-primary` on `bg-background`  
   **And** the legacy template **Explore** tab and `src/app/explore.tsx` are removed (no duplicate routes)

2. **Architecture-aligned route tree**

   **Given** Expo Router file-based routing under `mobile/src/app/`  
   **When** the route tree is inspected  
   **Then** it matches the architecture pattern:

   - Root `mobile/src/app/_layout.tsx` — providers (`global.css`, `ThemeProvider`, `DatabaseProvider`) + **root `Stack`** (not tabs at root)
   - `mobile/src/app/(tabs)/_layout.tsx` — **Native Tabs** layout with five `NativeTabs.Trigger` entries
   - `mobile/src/app/(tabs)/index.tsx` — Home placeholder
   - `mobile/src/app/(tabs)/learn.tsx`, `read.tsx`, `stats.tsx`, `settings.tsx` — placeholders
   - `mobile/src/app/review/_layout.tsx` + `review/index.tsx` — review placeholder **outside** `(tabs)` (no tab bar item)

   **And** navigating to `/review` (e.g. dev-only button on Home) opens the review placeholder **without** showing the bottom tab bar ([Source: architecture.md — modal review context; UX-DR18 hidden during review])

3. **Safe areas**

   **Given** any tab placeholder screen  
   **When** rendered on iOS or Android  
   **Then** content respects safe areas (notch, home indicator, status bar) via `SafeAreaView` from `react-native-safe-area-context` or equivalent insets  
   **And** tab bar inset is accounted for on scrollable content (`BottomTabInset` from `theme.ts` is acceptable until full token migration)

4. **Portrait orientation lock on phones (UX-DR28)**

   **Given** the app runs on a **phone**  
   **When** the root layout mounts  
   **Then** `expo-screen-orientation` locks orientation to portrait (`OrientationLock.PORTRAIT_UP` or `PORTRAIT`)  
   **And** `app.json` retains `"orientation": "portrait"` as baseline

   **Given** the app runs on a **tablet**  
   **When** orientation policy is applied  
   **Then** portrait lock is **not** forced — allow default / all orientations per UX spec (landscape on tablets only; post-MVP landscape layouts are out of scope)  
   **And** tablet detection uses `expo-device` (`Device.deviceType === Device.DeviceType.TABLET`) — do not use screen width heuristics alone

5. **Regression / provider order**

   **Given** Stories 1.2–1.3 are complete  
   **When** this story’s layout refactor lands  
   **Then** `import '@/global.css'` remains **once** in root `_layout.tsx`  
   **And** `DatabaseProvider` still wraps navigable content (inside `ThemeProvider`)  
   **And** `readUpdatesRuntimeMetadata()` still runs on mount — do not remove  
   **And** `npm run lint`, `npm run typecheck`, and `npm test` pass in `mobile/`

## Tasks / Subtasks

- [x] **AC1 — Restructure Expo Router tree**
  - [x] Move tab screens from flat `src/app/index.tsx` / `explore.tsx` into `src/app/(tabs)/`.
  - [x] Convert root `src/app/_layout.tsx` to **Stack** navigator: `(tabs)` (header hidden) + `review` (modal or fullScreenModal, header hidden).
  - [x] Delete `src/app/explore.tsx` and root-level tab files after migration.
  - [x] Ensure initial route is `(tabs)` → Home (`index`).

- [x] **AC1 — Native Tabs layout (5 triggers)**
  - [x] Implement `src/app/(tabs)/_layout.tsx` with `NativeTabs` from `expo-router/unstable-native-tabs` (SDK 55 compound API: `NativeTabs.Trigger.Icon`, `NativeTabs.Trigger.Label`).
  - [x] Add triggers: `index` (Home), `learn`, `read`, `stats`, `settings` — **exact route names**, including `(tabs)` group semantics per Expo docs.
  - [x] Use **SF Symbols + Material (`sf` / `md` props)** for tab icons (preferred over adding 15 new PNGs). Example mapping:
    - Home: `house.fill` / `home`
    - Learn: `book.fill` / `menu_book`
    - Read: `text.book.closed` / `auto_stories`
    - Stats: `chart.bar.fill` / `bar_chart`
    - Settings: `gear` / `settings`
  - [x] Style tab bar with NativeWind-aligned colors via `resolveColorScheme()` + semantic hex from `design-tokens.js` (or NativeTabs theme props) — **stop using deprecated `Colors` for new tab chrome** where feasible.
  - [x] Refactor or remove `src/components/app-tabs.tsx` — prefer layout-native `NativeTabs` in `(tabs)/_layout.tsx` (architecture target). Update `app-tabs.web.tsx` for five web tabs if root layout no longer imports `AppTabs`.

- [x] **AC2 — Review route placeholder (hidden from tab bar)**
  - [x] Create `src/app/review/_layout.tsx` (Stack, `headerShown: false`).
  - [x] Create `src/app/review/index.tsx` — placeholder: title “Review”, short copy that full session UI is Epic 5, **Back** or close navigates to tabs.
  - [x] Register `review` on root Stack with `presentation: 'modal'` or `'fullScreenModal'` so tab bar is not visible.
  - [x] Add **temporary** dev affordance on Home placeholder: `Pressable` “Open review placeholder” → `router.push('/review')` (remove or gate behind `__DEV__` if preferred).

- [x] **AC3 — Placeholder screen component**
  - [x] Create `src/components/common/TabPlaceholderScreen.tsx` (or `screens/TabPlaceholder.tsx`) — reusable: `title`, optional `children`, `SafeAreaView`, token classes (`bg-background`, `text-title`, `text-secondary`).
  - [x] Use on all five tab routes for consistent layout and safe areas.

- [x] **AC4 — Portrait lock**
  - [x] `npx expo install expo-screen-orientation` (SDK 55 compatible).
  - [x] Add `expo-screen-orientation` config plugin to `app.json` if needed for iOS full-screen lock (`requireFullScreen` per docs).
  - [x] Create `src/hooks/usePortraitOrientationLock.ts` — lock portrait on phone mount, unlock/default on tablet; cleanup on unmount if needed.
  - [x] Call hook from root `_layout.tsx` once.

- [x] **AC3/AC5 — Web + regression**
  - [x] Update `app-tabs.web.tsx` / web routing so five tabs work on web (Expo Router UI tabs pattern already in repo).
  - [x] Run `npm run lint`, `npm run typecheck`, `npm test`.
  - [ ] Manual: Android — tap all 5 tabs; open review placeholder; rotate phone (should stay portrait); verify DB init still works (no redbox on launch).

## Dev Notes

### Epic context (Epic 1)

Epic 1 delivers the installable shell. **Stories 1.1–1.3** established Expo SDK 55, CI/OTA, NativeWind tokens, and dual SQLite. **This story (1.4)** is the **navigation skeleton**: five tabs + review route outside tabs. It unblocks Epic 2 onboarding routes and Epic 4–5 feature screens.

**Out of scope for 1.4 (do not implement):**

| Story / Epic | Scope |
| --- | --- |
| 1.5 | Curriculum compile, real seed |
| 1.6 | Curriculum OTA swap |
| 2.x | Onboarding flow screens (`onboarding/`) |
| 4.x | Learn drill-down (`learn/[level].tsx`, item detail) |
| 5.x | `ReviewCard`, `ReviewSessionProvider`, session UI, tab bar hide via live session |
| UX-DR18 (full) | Home tab **badge** for pending reviews — defer until queue exists (Epic 5) |
| UX-DR19 | Real Home screen (ring, Review/Learn buttons) |
| Custom `TabBar` component | Native system tab bar is sufficient for skeleton; bespoke `TabBar.tsx` is Phase 2 per UX doc |

### Technical requirements (must follow)

- **Monorepo path:** All code under **`mobile/`**.
- **Routing:** Must match architecture tree — root Stack + `(tabs)` Native Tabs + sibling `review/` ([Source: architecture.md — Project Structure `src/app/`]).
- **Native Tabs constraints (SDK 55):**
  - **Max 5 tabs on Android** — exactly five triggers, no more.
  - **Triggers must be static** — do not add/remove triggers at runtime (remounts navigator, loses state).
  - **Trigger `name` must match route file name** (e.g. `learn` → `learn.tsx`).
  - Do **not** add a `NativeTabs.Trigger` for `review` — review is a Stack screen, not a tab.
- **Token-only placeholders:** Use NativeWind classes on new UI; no new raw hex in placeholders.
- **Named exports:** New components/hooks use named exports; route files keep `default` export per Expo Router.
- **DatabaseProvider gate:** If `DatabaseProvider` shows loading/error UI, tab shell must still mount after ready — do not block router registration on DB (provider already handles loading).

### Architecture compliance

| Requirement | Implementation |
| --- | --- |
| 5-tab navigation (Home, Learn, Read, Stats, Settings) | `(tabs)/_layout.tsx` + five screens |
| Review modal context, tab bar hidden | Root Stack `review` screen, no tab trigger |
| `expo-screen-orientation` on phones | `usePortraitOrientationLock` in root layout |
| Safe areas | `SafeAreaView` on placeholders |
| Preserve 1.3 providers | Root `_layout.tsx` provider order unchanged |

**Current codebase delta (critical):**

- Today, `mobile/src/app/_layout.tsx` **incorrectly** renders `AppTabs` at root with only **Home + Explore** (`index`, `explore`). This story **replaces** that pattern with architecture’s `(tabs)` + `review` split.
- `mobile/src/components/app-tabs.tsx` uses deprecated `Colors` and template icons — refactor or inline into `(tabs)/_layout.tsx`.

### Library / framework requirements

| Package | Version guidance | Notes |
| --- | --- | --- |
| `expo-router` | ~55.0.14 (pinned) | Root `Stack`, `(tabs)` group, typed routes |
| `expo-router/unstable-native-tabs` | SDK 55 | Alpha API — use SDK 55 compound `NativeTabs.Trigger.*` |
| `expo-screen-orientation` | SDK 55 (`npx expo install`) | Portrait lock phones |
| `expo-device` | Already in project | Tablet vs phone |
| `react-native-safe-area-context` | Already in project | Safe areas |
| `expo` / `react-native` | Pinned in Story 1.1 | Do not change SDK |

**Expo Router patterns:**

- Root stack ([Expo Router — Stack](https://docs.expo.dev/router/advanced/stack/)):

```tsx
<Stack>
  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
  <Stack.Screen
    name="review"
    options={{ headerShown: false, presentation: 'fullScreenModal' }}
  />
</Stack>
```

- Native tabs ([Native tabs — Expo](https://docs.expo.dev/router/advanced/native-tabs/)): triggers declared in `(tabs)/_layout.tsx`, not auto-discovered.
- Per-screen orientation alternative: `Stack.Screen options={{ orientation: 'portrait' }}` on review stack — optional supplement to `lockAsync` for review-only portrait later (Epic 5).

### File structure requirements

| Path | Action |
| --- | --- |
| `mobile/src/app/_layout.tsx` | Refactor — Stack + providers; remove direct `AppTabs` |
| `mobile/src/app/(tabs)/_layout.tsx` | Create — NativeTabs + 5 triggers |
| `mobile/src/app/(tabs)/index.tsx` | Create/move — Home placeholder |
| `mobile/src/app/(tabs)/learn.tsx` | Create |
| `mobile/src/app/(tabs)/read.tsx` | Create |
| `mobile/src/app/(tabs)/stats.tsx` | Create |
| `mobile/src/app/(tabs)/settings.tsx` | Create |
| `mobile/src/app/review/_layout.tsx` | Create |
| `mobile/src/app/review/index.tsx` | Create — review placeholder |
| `mobile/src/app/index.tsx` | Delete (moved to `(tabs)/index.tsx`) |
| `mobile/src/app/explore.tsx` | Delete |
| `mobile/src/components/app-tabs.tsx` | Refactor or delete |
| `mobile/src/components/app-tabs.web.tsx` | Update for 5 tabs + root layout change |
| `mobile/src/components/common/TabPlaceholderScreen.tsx` | Create (recommended) |
| `mobile/src/hooks/usePortraitOrientationLock.ts` | Create |
| `mobile/package.json` | Add `expo-screen-orientation` |
| `mobile/app.json` | Add plugin if required |

**Do not create yet:** `onboarding/*`, `learn/[level].tsx`, `ReviewSessionProvider`, `components/review/*`, custom `TabBar.tsx`.

### Testing requirements

- **Automated:** Existing Jest suite must pass; optional small test for `usePortraitOrientationLock` (mock `expo-screen-orientation` + `expo-device`) — not required if timeboxed.
- **Manual (Android primary):** All 5 tabs switch; review opens without tab bar; portrait lock on phone; cold start still initializes DB; light/dark tokens visible on placeholders.
- **No** RNTL navigation integration tests required this story.

### Previous story intelligence (Story 1.3)

- `DatabaseProvider` wraps app in `_layout.tsx` inside `ThemeProvider` — **keep this order** when introducing Stack.
- Dev-only logs for curriculum version / migration count — preserve.
- `resolveColorScheme()` is the dark-first source of truth for JS theme — use for tab bar styling if needed.
- CI commands: `npm run lint`, `typecheck`, `test` from `mobile/`.
- Android is maintainer’s primary device; iOS optional.

### Previous story intelligence (Story 1.2)

- NativeWind tokens: `bg-background`, `text-primary`, `text-title`, `text-secondary`, spacing tokens.
- `BottomTabInset`, `MaxContentWidth` in `theme.ts` still used by template — OK for tab content padding.
- Jest: `nativewind/babel` stays in **presets**, not plugins.

### Git intelligence summary

Recent commits completed dual SQLite (1.3) and NativeWind (1.2). This story is the first **routing restructure**: expect large diff under `src/app/`, changes to `app-tabs*`, new `(tabs)/` and `review/` folders, and `expo-screen-orientation` dependency.

### Latest technical information

- **Native Tabs (SDK 55):** Alpha API; use compound `NativeTabs.Trigger.Icon/Label`; Android max **5** tabs; avoid dynamic tab visibility toggles while navigator is visible ([Native tabs docs](https://docs.expo.dev/router/advanced/native-tabs/)).
- **Hiding tab bar in review:** Achieved by placing `review/` **outside** `(tabs)` on root Stack — not by `hidden` on a sixth trigger.
- **expo-screen-orientation:** `lockAsync(PORTRAIT_UP)` on phones; use `expo-device` for tablet exception ([Screen Orientation SDK 55](https://docs.expo.dev/versions/latest/sdk/screen-orientation/)).
- **Known SDK 55 issue:** Tab switch jank with dev client + react-native-screens — if seen, note in PR; not a blocker for skeleton.

### Project context reference

No `project-context.md` in repo — use this story + `_bmad-output/planning-artifacts/architecture.md` + `epics.md` + `ux-design-specification.md`.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.4, UX-DR18, UX-DR28]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Routing & Navigation, Project Structure, Screen Lock table]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — TabBar component, Navigation Patterns, Responsive / orientation]
- [Source: `_bmad-output/implementation-artifacts/1-3-dual-sqlite-databases-on-first-launch.md`]
- [Source: `_bmad-output/implementation-artifacts/1-2-nativewind-design-tokens-and-global-styling.md`]
- [Expo Native tabs](https://docs.expo.dev/router/advanced/native-tabs/)
- [Expo Screen Orientation](https://docs.expo.dev/versions/latest/sdk/screen-orientation/)

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

- `npm run lint`, `npm run typecheck`, `npm test` — all pass in `mobile/`

### Completion Notes List

- Replaced root `AppTabs` with architecture-aligned root `Stack` + `(tabs)` Native Tabs group + sibling `review` fullScreenModal.
- Five tab placeholders use `TabPlaceholderScreen` with safe areas and semantic NativeWind tokens.
- Tab bar styling uses `getSemanticColors()` (mirrors `global.css`) instead of deprecated `Colors`.
- Web uses `(tabs)/_layout.web.tsx` with five `expo-router/ui` tab triggers; removed `app-tabs.tsx` / `app-tabs.web.tsx`.
- Portrait lock via `usePortraitOrientationLock` + `expo-screen-orientation` plugin; tablets exempt per `expo-device` device type.
- Home dev-only control opens `/review` for manual verification of hidden tab bar.

### Senior Developer Review (AI)

**Reviewer:** Riyaz (AI code review) — **2026-05-24**

**Outcome:** Changes requested → fixes applied. Story remains **in-progress** until manual Android checklist completes.

**Fixes applied (code review):**

- `app.json` `orientation` set to `default` so tablets can rotate; phones still locked via `usePortraitOrientationLock`.
- Portrait hook skips `web` platform (`Platform.OS === 'web'`).
- Semantic palette centralized in `design-tokens.js`; `semantic-colors.ts` re-exports; parity test added.
- Web tab bar migrated from `ThemedView`/`ThemedText` to NativeWind semantic classes.
- Removed unused direct `@react-navigation/bottom-tabs` dependency.

### File List

- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `mobile/app.json` (modified — `expo-screen-orientation` plugin, `orientation: default`)
- `mobile/package.json` (modified — `expo-screen-orientation` dependency)
- `mobile/package-lock.json` (modified)
- `mobile/src/app/_layout.tsx` (modified)
- `mobile/src/app/(tabs)/_layout.tsx` (new)
- `mobile/src/app/(tabs)/_layout.web.tsx` (new)
- `mobile/src/app/(tabs)/index.tsx` (new)
- `mobile/src/app/(tabs)/learn.tsx` (new)
- `mobile/src/app/(tabs)/read.tsx` (new)
- `mobile/src/app/(tabs)/stats.tsx` (new)
- `mobile/src/app/(tabs)/settings.tsx` (new)
- `mobile/src/app/review/_layout.tsx` (new)
- `mobile/src/app/review/index.tsx` (new)
- `mobile/src/app/index.tsx` (deleted)
- `mobile/src/app/explore.tsx` (deleted)
- `mobile/src/components/app-tabs.tsx` (deleted)
- `mobile/src/components/app-tabs.web.tsx` (deleted)
- `mobile/src/components/common/TabPlaceholderScreen.tsx` (new)
- `mobile/src/constants/design-tokens.js` (modified — semantic palette source of truth)
- `mobile/src/constants/design-tokens.d.ts` (modified)
- `mobile/src/constants/semantic-colors.ts` (new)
- `mobile/src/constants/semantic-colors.test.ts` (new)
- `mobile/src/hooks/usePortraitOrientationLock.ts` (new)
- `mobile/src/hooks/usePortraitOrientationLock.test.ts` (new)

## Change Log

- **2026-05-24:** Story created via `create-story` workflow — status **ready-for-dev**.
- **2026-05-24:** Implemented five-tab shell, review placeholder route, portrait lock, web tabs — status **review**.
- **2026-05-24:** Code review fixes (tablet orientation, semantic token SSOT, web tab tokens, web hook guard) — status **in-progress**.
