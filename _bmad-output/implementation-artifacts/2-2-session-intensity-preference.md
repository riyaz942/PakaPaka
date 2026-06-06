# Story 2.2: Session intensity preference

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a **learner**,
I want **to pick relaxed vs intense daily session targets**,
So that **cognitive load defaults match my schedule (FR25)**.

## Acceptance Criteria

1. **Intensity onboarding screen (FR25, UX-DR17, Direction F)**

   **Given** I completed Story 2.1 and land on `/onboarding/intensity`  
   **When** the screen renders  
   **Then** it uses `OnboardingStep` with `stepIndex={2}` and `stepCount={4}` (welcome → intensity → calibration → complete)  
   **And** the heading reads **"How much time can you study?"** with subcopy **"You can change this anytime in Settings."**  
   **And** I see two selectable options (not three — PRD FR25 defines exactly two presets):
   - **Relaxed** — `~15 min/day` — recommended badge optional but encouraged for fresh beginners
   - **Intense** — `~30 min/day`
   **And** options are presented as a **segmented two-choice control** (side-by-side cards per Direction F mockup) — not a dropdown  
   **And** one option must be selected before **Continue** is enabled  
   **And** selected option has visible border/focus state (not color-only); touch targets ≥ 44×44 pt  
   **And** `accessibilityRole="radiogroup"` on the container with each option as `radio` + `accessibilityState={{ selected }}`

2. **Persist intensity and advance onboarding**

   **Given** I selected a valid intensity preset  
   **When** I tap **Continue**  
   **Then** `session_intensity` is written to `user.db` → `user_preferences` via `preferencesRepository`  
   **And** the value is one of the literal strings: `relaxed`, `intense`  
   **And** onboarding navigates forward to `/onboarding/calibrate` (**placeholder** for Story 2.3 — title + "Calibration — coming next" is sufficient)  
   **And** killing and relaunching the app does **not** show `/onboarding/intensity` again once `session_intensity` is set (user lands on calibrate placeholder per redirect rules below)

3. **Cold-start redirect rules (extend Story 2.1 hook)**

   **Given** `starting_jlpt_level` is set, `session_intensity` is **not** set, and `onboarding_completed` is **not** set  
   **When** the app launches  
   **Then** redirect to `/onboarding/intensity` (not welcome, not calibrate, not `(tabs)`)

   **Given** `starting_jlpt_level` and `session_intensity` are both set and `onboarding_completed` is **not** set  
   **When** the app launches from `(tabs)` or root  
   **Then** redirect to `/onboarding/calibrate` (not intensity, not `(tabs)`)

   **Given** neither `starting_jlpt_level` nor `session_intensity` exists  
   **When** the app launches  
   **Then** existing Story 2.1 rule applies: redirect to `/onboarding/welcome`

   **Given** `onboarding_completed` is `true`  
   **When** the app launches  
   **Then** no onboarding redirect (Story 2.5 owns this flag — do not set it in 2.2)

4. **Settings change path (FR25 — stub OK)**

   **Given** I am on `(tabs)/settings` (currently a placeholder tab)  
   **When** I change session intensity using a minimal segmented control reusing the same picker component  
   **Then** `session_intensity` updates in `user_preferences` immediately (no Save button — UX settings pattern)  
   **And** the UI reflects the stored value on next visit  
   **And** no account or network call is required

5. **Epic 6 consumption contract (store only — no ring UI in this story)**

   **Given** intensity is persisted  
   **When** Epic 6 reads preferences later  
   **Then** `getSessionIntensity(userDb)` returns a typed `SessionIntensity | null`  
   **And** app constants document target minutes for downstream cognitive-load logic:
   - `relaxed` → 15 min/day baseline threshold input
   - `intense` → 30 min/day baseline threshold input  
   **And** this story does **not** implement the cognitive load ring, queue sizing, or threshold adaptation (Epics 5–6)

6. **Tests and CI**

   **Given** implementation is complete  
   **When** CI runs in `mobile/`  
   **Then** `npm run lint`, `npm run typecheck`, and `npm test` pass  
   **And** unit tests cover: `preferencesRepository` get/set for `session_intensity`; `isSessionIntensity` validation; intensity screen enables Continue only when selected  
   **And** `useOnboardingRedirect` tests cover: level without intensity → intensity; level + intensity → calibrate; completed → no redirect  
   **And** optional: settings screen reads/writes intensity via repository

## Tasks / Subtasks

- [x] **AC1 — Replace intensity placeholder with real screen**
  - [x] Rewrite `mobile/src/app/onboarding/intensity.tsx` using `OnboardingStep` (mirror `welcome.tsx` structure).
  - [x] Create `mobile/src/components/onboarding/SessionIntensityPicker.tsx` — two-option segmented cards (`Relaxed` / `Intense` with minute sublabels).
  - [x] Default selection: **`relaxed`** pre-selected (matches PRD Yuki persona journey); user may change before Continue.
  - [x] Register `calibrate` screen in `mobile/src/app/onboarding/_layout.tsx`.

- [x] **AC2 — Preferences data layer**
  - [x] Add `SessionIntensity` type: `'relaxed' | 'intense'` in `mobile/src/data/user/sessionIntensity.types.ts` (or co-located types file — keep separate from `JLPTLevel` in curriculum types).
  - [x] Add `isSessionIntensity(value: string): value is SessionIntensity` helper.
  - [x] Extend `PREFERENCE_KEYS` in `preferencesRepository.ts`: `sessionIntensity: 'session_intensity'`.
  - [x] Add `getSessionIntensity(userDb)`, `setSessionIntensity(userDb, intensity)` with validation throw on invalid values.
  - [x] Add `SESSION_INTENSITY_MINUTES` map in `mobile/src/config/constants.ts` for Epic 6 contract (`relaxed: 15`, `intense: 30`).
  - [x] **Do not** add new migration — `user_preferences` KV table from `001_initial` is sufficient.

- [x] **AC2/AC3 — Calibrate placeholder + redirect**
  - [x] Create `mobile/src/app/onboarding/calibrate.tsx` — **placeholder** for Story 2.3 (minimal copy only).
  - [x] Extend `useOnboardingRedirect.ts`: after level check, gate on `getSessionIntensity`; when both set, redirect to `/onboarding/calibrate` if not already in onboarding past intensity.
  - [x] Guard against redirect loops (same pattern as 2.1 — only redirect from `(tabs)`/root, respect current onboarding segment).

- [x] **AC4 — Settings stub**
  - [x] Replace `(tabs)/settings.tsx` placeholder body with a single **Session intensity** row using `SessionIntensityPicker` + immediate `setSessionIntensity` on select.
  - [x] Load current value via `getSessionIntensity` + `useDatabase()` on mount.

- [x] **AC6 — Tests**
  - [x] Extend `preferencesRepository.test.ts` — round-trip `session_intensity`; invalid value rejected.
  - [x] Add `sessionIntensity.types.test.ts` or inline — `isSessionIntensity` boundaries.
  - [x] Extend `useOnboardingRedirect.test.tsx` — level+intensity → calibrate; intensity missing → intensity.
  - [x] Add `SessionIntensityPicker.test.tsx` — radio group semantics, selection callback.

- [x] **Manual verification**
  - [x] Fresh path: welcome → Continue → intensity → pick Intense → Continue → calibrate placeholder → force-quit → relaunch lands on calibrate (not intensity).
  - [x] Settings: change Relaxed ↔ Intense → kill app → value persists.
  - [x] Confirm zero sign-up UI on intensity screen.

## Dev Notes

### Epic context (Epic 2)

Epic 2 delivers the **first-run path without an account**: JLPT starting level (✅ 2.1), session intensity (**this story**), per-item and bulk calibration (2.3–2.4), then handoff to main tabs (2.5).

**Story 2.1 delivered:** onboarding route group, `OnboardingStep`, `Button`, `LevelPathCard`, `JlptLevelPicker`, `starting_jlpt_level` persistence, `useOnboardingRedirect` (welcome ↔ intensity), intensity **placeholder**.

**This story (2.2)** replaces the intensity placeholder, persists `session_intensity`, extends redirect to calibrate placeholder, and adds minimal Settings editing.

**Out of scope for 2.2 (do not implement):**

| Area | Deferred to |
| --- | --- |
| Per-item known / in-progress calibration UI | Story 2.3 |
| Bulk mark known | Story 2.4 |
| `onboarding_completed = true` + skip to `(tabs)` | Story 2.5 |
| Cognitive load ring UI or threshold computation | Epic 6 (Stories 6.5–6.6) |
| Review queue sizing based on intensity | Epic 5 |
| `PreferencesProvider` React context | Optional — direct repository + `useDatabase()` matches 2.1 |
| Third "Standard ~25 min" option from UX flowchart | **Not in PRD** — FR25 specifies two presets only |

### Technical requirements (must follow)

- **Preference storage:** Existing `user_preferences` KV table ([Source: `mobile/src/data/migrations/001_initial.ts`]). New key: `session_intensity`. Values: `relaxed` | `intense` (lowercase literals — stable contract for Epic 6).
- **Layer boundaries:** SQLite in `preferencesRepository.ts`; UI in `app/onboarding/` + `components/onboarding/`; **no** `expo-sqlite` in components.
- **Reuse Story 2.1 patterns:** `OnboardingStep`, `Button`, `useDatabase()`, `router.replace()` for forward nav, NativeWind tokens, 44pt touch targets, a11y roles.
- **Segmented control:** No `@react-native-segmented-control` in repo yet — build with two `Pressable` cards in a row (Direction F mockup). Match `LevelPathCard` border/selected styling for consistency.
- **UX flowchart discrepancy:** `ux-design-specification.md` Flow 1 shows three intensity tiers (Relaxed / Standard / Intensive). **PRD FR25 and epics.md Story 2.2 override:** implement **two** options only (~15 min / ~30 min). Do not add a middle tier without PM approval.

### OnboardingRedirect logic (extend 2.1)

```typescript
// Pseudocode — extend mobile/src/hooks/useOnboardingRedirect.ts
if (!isReady || completed) return;

const level = getStartingJlptLevel(userDb);
const intensity = getSessionIntensity(userDb);
const segmentList = segments as string[];
const inOnboarding = segmentList[0] === 'onboarding';
const onWelcome = inOnboarding && segmentList[1] === 'welcome';
const onIntensity = inOnboarding && segmentList[1] === 'intensity';
const onCalibrate = inOnboarding && segmentList[1] === 'calibrate';

if (!level) {
  if (!inOnboarding) router.replace('/onboarding/welcome');
  return;
}

if (!intensity) {
  if (!onIntensity) router.replace('/onboarding/intensity');
  return;
}

// level + intensity set, not completed — Story 2.3 owns calibrate screen content
if (!onCalibrate && !onWelcome && !onIntensity) {
  // User on tabs or wrong onboarding step → send to calibrate
  if (!inOnboarding || segmentList[1] === 'import') {
    router.replace('/onboarding/calibrate');
  }
}
```

Refine segment checks against Expo Router SDK 55 `useSegments()` output — mirror 2.1 test patterns. Avoid redirecting away from `/onboarding/import` (Epic 3 branch).

### UX compliance (Direction F + UX-DR17)

| Element | Spec |
| --- | --- |
| Heading | "How much time can you study?" — `text-title-lg` |
| Subcopy | `text-secondary` — Settings reassurance |
| Relaxed card | Title + `~15 min/day` sublabel |
| Intense card | Title + `~30 min/day` sublabel |
| Layout | Side-by-side `flex-row gap-3` — equal width cards |
| Selected state | `border-2 border-feedback-info` (same as `LevelPathCard`) |
| Primary CTA | Full-width "Continue" — disabled until selection |
| Progress | Dots — step 2 of 4 |
| Settings | Segmented control per UX spec — immediate save, no Save button |

Reference mockup: `_bmad-output/planning-artifacts/ux-design-directions.html` — Session intensity card block in Direction F (`#dir-f`).

### Architecture compliance

| Requirement | Implementation |
| --- | --- |
| FR25 Session intensity preference | `session_intensity` in `user_preferences` |
| FR26 No account | No auth UI; local SQLite only |
| UX-DR17 OnboardingStep | Reuse `components/common/OnboardingStep.tsx` |
| PreferencesRepository pattern | Extend existing module — no duplicate KV logic |
| Epic 6 consumer contract | Typed getter + `SESSION_INTENSITY_MINUTES` constants |
| NFR10 User data survives curriculum swap | Writes only to `user.db` |

### File structure (this story)

```
mobile/src/
├── app/
│   ├── (tabs)/
│   │   └── settings.tsx               # MODIFY — minimal intensity picker
│   └── onboarding/
│       ├── _layout.tsx                # MODIFY — register calibrate screen
│       ├── intensity.tsx              # MODIFY — replace placeholder
│       └── calibrate.tsx              # NEW — placeholder for 2.3
├── components/
│   └── onboarding/
│       ├── SessionIntensityPicker.tsx # NEW
│       └── SessionIntensityPicker.test.tsx
├── config/
│   └── constants.ts                   # MODIFY — SESSION_INTENSITY_MINUTES
├── data/
│   └── user/
│       ├── sessionIntensity.types.ts  # NEW
│       ├── preferencesRepository.ts   # MODIFY
│       └── preferencesRepository.test.ts  # MODIFY
└── hooks/
    ├── useOnboardingRedirect.ts       # MODIFY
    └── useOnboardingRedirect.test.tsx # MODIFY
```

### Previous story intelligence (Story 2.1)

- **Patterns that work:** `OnboardingStep` + `Button` full-width CTAs; `preferencesRepository` typed getters/setters with validation; `useOnboardingRedirect` with `useSegments()` + `useRootNavigationState()`; hook tests with mocked router + real SQLite mock.
- **Redirect guard:** Do not redirect when already on valid onboarding sub-route (e.g. `import` stub).
- **Placeholder pattern:** Story 2.1 left `intensity.tsx` as minimal placeholder — 2.2 replaces it; follow same placeholder pattern for `calibrate.tsx` for 2.3.
- **Code review notes from 2.1:** Corrupt preference values treated as unset — apply same pattern for invalid `session_intensity` strings.
- **Do not regress:** Welcome flow, JLPT persistence, import stub navigation, `onboarding_completed` early-exit in redirect hook.

### Git intelligence (recent commits)

| Commit | Relevance |
| --- | --- |
| `5b279c9` Onboarding flow for JLPT level | Direct predecessor — reuse all onboarding components and redirect hook |
| `cd3a86b` MnemonicImage + repository tests | Test patterns for typed repository helpers |
| `dd65064` Curriculum OTA | `user.db` preferences isolated from curriculum swap |

### Latest tech notes

- **expo-router ~55.0.14** / Expo SDK 55 — add `calibrate` to onboarding Stack; run app once to refresh generated router types if needed.
- No new npm dependencies expected — custom segmented cards with NativeWind.
- Settings immediate-save pattern: call `setSessionIntensity` in picker `onSelect` callback (no debounce needed for two-state toggle).

### Project context reference

- No `project-context.md` in repo. SSOT: `architecture.md`, `epics.md`, `ux-design-specification.md`, `prd.md`.
- PRD persona Yuki picks **relaxed** ~15 min/day after N5 selection ([Source: `prd.md` — Yuki journey]).
- Epic 6 Story 6.6 reads session intensity for adaptive threshold messaging ([Source: `epics.md` — Story 6.6 AC]).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.2]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR25, Yuki onboarding journey]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — user_preferences, onboarding/intensity.tsx, PreferencesContext future]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Flow 1, OnboardingStep, Settings segmented control]
- [Source: `_bmad-output/planning-artifacts/ux-design-directions.html` — Direction F intensity cards]
- [Source: `_bmad-output/implementation-artifacts/2-1-welcome-and-jlpt-starting-level-without-sign-up.md` — patterns, redirect pseudocode, out-of-scope table]
- [Source: `mobile/src/app/onboarding/welcome.tsx` — OnboardingStep usage reference]
- [Source: `mobile/src/data/user/preferencesRepository.ts` — PREFERENCE_KEYS pattern]
- [Source: `mobile/src/hooks/useOnboardingRedirect.ts` — extend, do not rewrite from scratch]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

- CI: `npm run lint`, `npm run typecheck`, `npm test` — all pass (68 tests)
- Regenerated `mobile/.expo/types/router.d.ts` for `/onboarding/calibrate` typed route (local Expo artifact, gitignored)

### Completion Notes List

- Replaced intensity placeholder with full `OnboardingStep` screen (step 2/4): Relaxed/Intense segmented cards, `relaxed` pre-selected, Continue persists and navigates to calibrate.
- Added `SessionIntensityPicker` reusable component with radiogroup/radio a11y, Direction F styling, and recommended badge on Relaxed.
- Extended `preferencesRepository` with `getSessionIntensity` / `setSessionIntensity`; corrupt values treated as unset (Story 2.1 pattern).
- Added `SESSION_INTENSITY_MINUTES` Epic 6 contract in `config/constants.ts`.
- Extended `useOnboardingRedirect`: level → intensity → calibrate chain; import stub preserved; `onboarding_completed` early exit unchanged.
- Settings tab: immediate-save intensity picker via repository + `useDatabase()`.
- Calibrate placeholder registered for Story 2.3.
- Code review: replaced harness-only `IntensityOnboardingStep.test.tsx` with `intensity.test.tsx` covering real screen — relaxed pre-select, Continue enabled on mount, persist + navigate integration.

### File List

- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/2-2-session-intensity-preference.md
- mobile/src/app/(tabs)/settings.tsx
- mobile/src/app/onboarding/_layout.tsx
- mobile/src/app/onboarding/calibrate.tsx
- mobile/src/app/onboarding/intensity.tsx
- mobile/src/app/onboarding/intensity.test.tsx
- mobile/src/components/onboarding/SessionIntensityPicker.tsx
- mobile/src/components/onboarding/SessionIntensityPicker.test.tsx
- mobile/src/config/constants.ts
- mobile/src/data/user/preferencesRepository.ts
- mobile/src/data/user/preferencesRepository.test.ts
- mobile/src/data/user/sessionIntensity.types.ts
- mobile/src/data/user/sessionIntensity.types.test.ts
- mobile/src/hooks/useOnboardingRedirect.ts
- mobile/src/hooks/useOnboardingRedirect.test.tsx

## Senior Developer Review (AI)

_Reviewer: Riyaz on 2026-06-06_

**Outcome:** Approve (after fixes)

**Findings addressed:**
- Replaced `IntensityOnboardingStep.test.tsx` harness with `intensity.test.tsx` testing the actual `IntensityScreen`
- Added tests: relaxed pre-selected enables Continue on mount; persist + `router.replace('/onboarding/calibrate')` on Continue
- Corrected File List (removed gitignored `.expo/types/router.d.ts`, removed deleted harness test)

**Remaining low-severity notes (deferred):**
- Settings picker brief null flash before `useEffect` loads stored value
- `onWelcome` excluded from calibrate redirect (inherited Story 2.1 edge case)

## Change Log

- 2026-06-06: Story 2.2 — session intensity onboarding, persistence, redirect to calibrate, settings picker, tests (Composer)
- 2026-06-06: Code review fixes — real intensity screen tests, story status → done (Composer)
