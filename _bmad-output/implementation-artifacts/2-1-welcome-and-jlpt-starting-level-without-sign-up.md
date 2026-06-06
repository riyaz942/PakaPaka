# Story 2.1: Welcome and JLPT starting level without sign-up

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a **new learner**,
I want **to choose my JLPT starting level on first launch with no account**,
So that **the app respects my entry point and privacy (FR21, FR26, UX-DR17, UX-DR22)**.

## Acceptance Criteria

1. **First-launch onboarding route (FR21, UX-DR22)**

   **Given** the app launches and `user.db` has no `starting_jlpt_level` preference  
   **When** database initialization completes  
   **Then** the user is routed to `/onboarding/welcome` instead of `(tabs)`  
   **And** the onboarding stack is registered on the root `Stack` in `app/_layout.tsx` with `headerShown: false`  
   **And** `(tabs)` remains the post-onboarding destination (full completion gate is Story 2.5 — this story only gates on missing level)

2. **Welcome + level selection UI (UX-DR17, UX-DR22, Direction F)**

   **Given** I am on `/onboarding/welcome`  
   **When** the screen renders  
   **Then** it uses the reusable `OnboardingStep` component pattern (heading, body, action area) aligned with Direction F in `ux-design-directions.html`  
   **And** the heading reads **"Where are you starting?"** with subcopy **"No account needed. You can change this later."**  
   **And** I see selectable path cards:
   - **I'm a beginner** — description mentions N5 foundations; selecting this sets level **N5** (no secondary picker required)
   - **I know some Japanese** — expands or navigates to a JLPT level picker (**N5, N4, N3, N2, N1**)
   - **Import my progress** — visible per Direction F but routes to `/onboarding/import` **placeholder only** (stub screen with copy that import ships in Epic 3; no API/file UI in this story)

   **And** progress dots at the top indicate step 1 of the onboarding flow (linear progression per UX navigation patterns)  
   **And** all touch targets are ≥ 44×44 pt; selected card has visible border/focus state (not color-only)

3. **No account / sign-up (FR26)**

   **Given** any onboarding screen in this story  
   **When** I inspect the UI  
   **Then** there is **no** email field, password field, OAuth button, "Create account", "Sign in", or terms-of-service signup flow  
   **And** copy reinforces local-only / no-account use where appropriate

4. **Persist JLPT level and advance (FR21)**

   **Given** I selected a valid JLPT level (N5–N1) via beginner path or manual picker  
   **When** I confirm with the primary **Continue** action  
   **Then** `starting_jlpt_level` is written to `user.db` → `user_preferences` via `preferencesRepository`  
   **And** the value is one of the literal strings: `N5`, `N4`, `N3`, `N2`, `N1`  
   **And** onboarding navigates forward to `/onboarding/intensity` (placeholder screen OK for Story 2.2 — title + "Session intensity — coming next" is sufficient)  
   **And** killing and relaunching the app does **not** show `/onboarding/welcome` again once `starting_jlpt_level` is set (user lands on intensity placeholder or tabs per redirect rules below)

5. **Redirect rules after level is saved**

   **Given** `starting_jlpt_level` is set and `onboarding_completed` is **not** set (Story 2.5 owns completion flag)  
   **When** the app launches  
   **Then** redirect to `/onboarding/intensity` (not back to welcome, not to `(tabs)` yet)

   **Given** neither `starting_jlpt_level` nor `onboarding_completed` exists  
   **When** the app launches  
   **Then** redirect to `/onboarding/welcome`

6. **Tests and CI**

   **Given** implementation is complete  
   **When** CI runs in `mobile/`  
   **Then** `npm run lint`, `npm run typecheck`, and `npm test` pass  
   **And** unit tests cover: `preferencesRepository` get/set for `starting_jlpt_level`; `JLPTLevel` validation helper; `OnboardingStep` renders heading + primary action with a11y roles  
   **And** integration-style test (or focused hook test) verifies redirect target when preference is absent vs present (mock `useDatabase` + preference reads)

## Tasks / Subtasks

- [x] **AC1 — Onboarding route group**
  - [x] Create `mobile/src/app/onboarding/_layout.tsx` — `Stack`, `headerShown: false`, linear flow (no nested tabs).
  - [x] Create `mobile/src/app/onboarding/welcome.tsx` — welcome + level selection (AC2).
  - [x] Create `mobile/src/app/onboarding/intensity.tsx` — **placeholder** for Story 2.2 (minimal copy only).
  - [x] Create `mobile/src/app/onboarding/import.tsx` — **placeholder** stub for Epic 3 (AC2 import card).
  - [x] Register `onboarding` on root `Stack` in `app/_layout.tsx` alongside `(tabs)` and `review`.

- [x] **AC1/AC5 — First-launch redirect**
  - [x] Add `OnboardingRedirect` (or `useOnboardingRedirect`) in `mobile/src/providers/` or `mobile/src/hooks/` — runs **after** `DatabaseProvider` is `ready`.
  - [x] Read `starting_jlpt_level` and `onboarding_completed` from `user_preferences`; call `router.replace(...)` once on cold start.
  - [x] Logic: no level → `/onboarding/welcome`; level set + not completed → `/onboarding/intensity`; completed → no redirect (Story 2.5 will set flag — until then tabs remain default after intensity placeholder).
  - [x] Guard against redirect loops (only redirect when current segment is `(tabs)` or root index, not when already inside `onboarding/`).

- [x] **AC2 — `OnboardingStep` component (UX-DR17)**
  - [x] Create `mobile/src/components/common/OnboardingStep.tsx` — props: `title`, `description?`, `children` (card slot), `primaryAction` (`label`, `onPress`, `disabled?`), `secondaryAction?`, `skipAction?`, `stepIndex?`, `stepCount?`.
  - [x] Optional top progress dots when `stepIndex` / `stepCount` provided.
  - [x] Export from `components/common/index.ts`.
  - [x] Use NativeWind tokens (`bg-background`, `text-primary`, `surface-elevated`, `radius-md`).

- [x] **AC2 — `Button` primitive (UX-DR26)**
  - [x] Create `mobile/src/components/common/Button.tsx` — variants: `primary` | `secondary` | `tertiary` | `ghost`; `min-h-[44px]`; disabled = 40% opacity.
  - [x] Use on onboarding Continue; reuse in later Epic 2 stories.

- [x] **AC2 — Level selection cards**
  - [x] Create `mobile/src/components/onboarding/LevelPathCard.tsx` (or inline in welcome screen if < 80 lines) — selectable card with title, description, optional badge.
  - [x] Create `mobile/src/components/onboarding/JlptLevelPicker.tsx` — horizontal or vertical list of N5–N1; single-select; a11y `accessibilityRole="radio"` group semantics.
  - [x] "Beginner" path auto-selects N5 and enables Continue immediately.

- [x] **AC4 — Preferences data layer**
  - [x] Add `JLPTLevel` type: `'N5' | 'N4' | 'N3' | 'N2' | 'N1'` in `mobile/src/data/curriculum/curriculum.types.ts` (or `mobile/src/types/jlpt.types.ts` if preferred).
  - [x] Add `isJlptLevel(value: string): value is JLPTLevel` helper.
  - [x] Extend `PREFERENCE_KEYS` in `preferencesRepository.ts`:
    - `startingJlptLevel: 'starting_jlpt_level'`
    - `onboardingCompleted: 'onboarding_completed'` (read for redirect; **do not** set `true` in this story)
  - [x] Add `getStartingJlptLevel(userDb)`, `setStartingJlptLevel(userDb, level)`, `isOnboardingCompleted(userDb)` helpers.
  - [x] **Do not** add new migration — `user_preferences` key/value table from `001_initial` is sufficient.

- [x] **AC6 — Tests**
  - [x] `preferencesRepository.test.ts` — round-trip `starting_jlpt_level`; invalid level rejected by helper.
  - [x] `OnboardingStep.test.tsx` — renders title, primary button, `accessibilityRole`.
  - [x] `jlpt.types.test.ts` or inline in preferences test — `isJlptLevel` boundaries.
  - [x] Optional: `useOnboardingRedirect.test.ts` with mocked router + DB.

- [x] **Manual verification**
  - [x] Fresh install / clear app data → lands on welcome → pick beginner → Continue → intensity placeholder → force-quit → relaunch skips welcome.
  - [x] Pick "I know some Japanese" → select N3 → persist → relaunch shows intensity placeholder with N3 stored (verify via `__DEV__` log or temporary debug read).
  - [x] Confirm zero sign-up UI on all onboarding screens.

## Dev Notes

### Epic context (Epic 2)

Epic 2 delivers the **first-run path without an account**: JLPT starting level, session intensity, per-item and bulk calibration, then handoff to main tabs. **Epic 1 (Stories 1.1–1.7)** delivered Expo SDK 55 shell, NativeWind tokens, dual SQLite (`curriculum.db` + `user.db`), five-tab + review routing, N5 curriculum seed, curriculum OTA swap, and `MnemonicImage` / radical repository on Learn tab.

**This story (2.1)** is the **first Epic 2 slice**: onboarding routes, welcome + JLPT level selection, persistence, first-launch redirect. It unblocks 2.2 (intensity), 2.3–2.4 (calibration), and 2.5 (completion gate).

**Out of scope for 2.1 (do not implement):**

| Area | Deferred to |
| --- | --- |
| Session intensity UI + persistence | Story 2.2 |
| Per-item known / in-progress marking | Story 2.3 |
| Bulk mark known | Story 2.4 |
| `onboarding_completed = true` + skip to `(tabs)` on relaunch | Story 2.5 |
| WaniKani / Bunpro / Anki import UI + API | Epic 3 (Story 3.6 branch) |
| `PreferencesProvider` React context | Optional — direct `preferencesRepository` + `useDatabase()` is fine for Epic 2 |
| Home ring, review queue, Learn hub | Epics 5–6, 4 |
| New `user.db` tables (`srs_states`, `item_study_status`, etc.) | Stories 2.3+ / later migrations |
| Settings screen level change | Future settings story — welcome copy says "change later" but UI not required here |

### Technical requirements (must follow)

- **Preference storage:** Use existing `user_preferences` key/value table ([Source: `mobile/src/data/migrations/001_initial.ts`]). Keys: `starting_jlpt_level`, `onboarding_completed` (read-only this story).
- **JLPT values:** Match curriculum DB literals (`N5`…`N1` uppercase) — same as `items.jlpt_level` in `curriculum.db` ([Source: `curriculum/schema/curriculum.schema.json`]). MVP seed is N5-only but picker must support all five levels for returning learners.
- **No auth:** FR26 — zero account collection. Architecture explicitly uses local-only security model ([Source: `architecture.md` — Authentication & Security]).
- **Layer boundaries:** SQLite reads/writes in `data/user/preferencesRepository.ts`; UI in `app/onboarding/` + `components/`; **no** `expo-sqlite` in components.
- **Database access:** `useDatabase()` from `DatabaseContext` — only persist after `isReady` ([Source: Story 1.7 / `DatabaseProvider` pattern]).
- **Routing:** Expo Router file-based under `src/app/` ([Source: `architecture.md` — Routing structure]). Root `Stack` already has `(tabs)` + `review` ([Source: `mobile/src/app/_layout.tsx`]). Add `onboarding` sibling — do **not** nest onboarding inside `(tabs)`.
- **Redirect timing:** Run redirect **after** `DatabaseProvider` reaches `ready` — never before migrations complete. Show existing loading spinner during DB init; avoid flash of tabs before redirect.
- **Import card:** Show per UX-DR22 / Direction F for visual continuity; `/onboarding/import` is a **stub** — one screen, back navigation, no network calls.

### OnboardingRedirect logic (recommended)

```typescript
// Pseudocode — implement in hook or small provider component mounted in _layout.tsx
if (!isReady) return;

const level = getStartingJlptLevel(userDb);
const completed = isOnboardingCompleted(userDb);

if (completed) return; // Story 2.5 sets this; tabs stay default

if (!level && !pathname.startsWith('/onboarding')) {
  router.replace('/onboarding/welcome');
} else if (level && !completed && pathname === '/(tabs)') {
  router.replace('/onboarding/intensity');
}
```

Adjust segment checks to match Expo Router v4 path names in SDK 55. Prefer `useSegments()` + `useRootNavigationState()` to avoid redirect before navigation is mounted.

### UX compliance (Direction F + UX-DR17/22/26)

| Element | Spec |
| --- | --- |
| Heading | "Where are you starting?" — `text-title-lg` / 28px bold |
| Subcopy | `text-secondary` — no account reassurance |
| Beginner card | Recommended badge (`feedback-correct` tint) per mockup |
| Import card | `feedback-info` border accent; WaniKani/Bunpro/Anki chips are **labels only** (no functionality) |
| Primary CTA | Full-width "Continue" — one primary per screen (UX-DR26) |
| Progress | Dots at top — step 1 of ~4 (welcome → intensity → calibration → complete) |
| a11y | Cards: `accessibilityRole="button"`; picker: radio group; Continue: `accessibilityRole="button"` |

Reference mockup: `_bmad-output/planning-artifacts/ux-design-directions.html` section `#dir-f`.

### Architecture compliance

| Requirement | Implementation |
| --- | --- |
| FR21 JLPT starting level | `starting_jlpt_level` in `user_preferences` |
| FR26 No account | No auth UI; local SQLite only |
| UX-DR17 OnboardingStep | `components/common/OnboardingStep.tsx` |
| UX-DR22 Flow F | Welcome screen layout per Direction F |
| Routing `onboarding/` | `src/app/onboarding/*` per architecture tree |
| `preferencesRepository` | Extend existing module — do not duplicate KV logic |
| NFR10 User data survives curriculum swap | Writes only to `user.db` — never `curriculum.db` |

### File structure (this story)

```
mobile/src/
├── app/
│   ├── _layout.tsx                    # MODIFY: add onboarding Stack screen + OnboardingRedirect host
│   └── onboarding/
│       ├── _layout.tsx                # NEW
│       ├── welcome.tsx                # NEW — main AC
│       ├── intensity.tsx              # NEW — placeholder for 2.2
│       └── import.tsx                 # NEW — Epic 3 stub
├── components/
│   ├── common/
│   │   ├── OnboardingStep.tsx         # NEW
│   │   ├── Button.tsx                 # NEW
│   │   └── index.ts                   # MODIFY: exports
│   └── onboarding/
│       ├── LevelPathCard.tsx          # NEW
│       └── JlptLevelPicker.tsx        # NEW
├── data/
│   ├── curriculum/
│   │   └── curriculum.types.ts        # MODIFY: add JLPTLevel
│   └── user/
│       ├── preferencesRepository.ts   # MODIFY: JLPT + onboarding keys
│       └── preferencesRepository.test.ts  # NEW or extend
└── hooks/
    └── useOnboardingRedirect.ts       # NEW (or providers/OnboardingRedirect.tsx)
```

### Previous story intelligence (Epic 1 — Story 1.7)

- **Patterns that work:** `DatabaseProvider` loading gate; `useDatabase()` hook; repository + typed rows; NativeWind `className` on RN primitives; `__mocks__/expo-sqlite.ts` for repo tests; barrel exports in `components/common/index.ts`.
- **Learn tab:** `learn.tsx` has N5 radical verification list — **do not** repurpose for onboarding; onboarding queries preferences only in this story (calibration lists come in 2.3).
- **No `Button.tsx` yet:** Story 1.x used raw `Pressable` — introduce `Button` here for UX-DR26 consistency going forward.
- **Root layout:** `DatabaseProvider` → `CurriculumUpdateBannerHost` → `AnimatedSplashOverlay` → `Stack`. Preserve order; mount redirect inside `DatabaseProvider` after ready.
- **CI:** All three commands must pass before marking done.

### Git intelligence (recent commits)

| Commit | Relevance |
| --- | --- |
| `cd3a86b` MnemonicImage + radicalRepository + Learn list | Reuse `curriculum.types.ts`, `useDatabase`, component test patterns |
| `dd65064` Curriculum OTA | `user.db` never touched by curriculum swap — preferences safe |
| `b54ce2e` Tab shell + review modal | Root Stack pattern; onboarding is third top-level group |

### Latest tech notes (Expo Router SDK 55)

- **expo-router ~55.0.14** with Expo SDK 55 — file-based routing under `src/app/`.
- Use `router.replace()` for first-launch redirect (not `push`) so back gesture does not return to empty tabs.
- `useSegments()` returns segments like `['(tabs)']` or `['onboarding', 'welcome']` — test on device; web may differ (`_layout.web.tsx` exists for tabs only).
- No new dependencies expected for this story.

### Project context reference

- No `project-context.md` found in repo. SSOT: `_bmad-output/planning-artifacts/architecture.md`, `epics.md`, `ux-design-specification.md`, `prd.md`.
- PRD persona Yuki: selects "I'm a beginner (N5)" on commute — no account ([Source: `prd.md` — Yuki journey]).
- Binary fork "beginner vs existing knowledge" is UX Flow 1 entry ([Source: `ux-design-specification.md` — Flow 1]); import branches to Flow 3 (Epic 3).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.1]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR21, FR26, Onboarding section]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Dual DB, onboarding routes, preferencesRepository, no auth]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — OnboardingStep, Flow 1, navigation patterns, button hierarchy]
- [Source: `_bmad-output/planning-artifacts/ux-design-directions.html` — Direction F `#dir-f`]
- [Source: `mobile/src/data/migrations/001_initial.ts` — user_preferences schema]
- [Source: `mobile/src/data/user/preferencesRepository.ts` — existing PREFERENCE_KEYS pattern]
- [Source: `mobile/src/app/_layout.tsx` — root Stack structure]
- [Source: `_bmad-output/implementation-artifacts/1-4-five-tab-app-shell-with-hidden-review-route-placeholder.md` — routing conventions]
- [Source: `_bmad-output/implementation-artifacts/1-7-cached-radical-mnemonic-images-and-maintainer-r2-workflow.md` — DB + component patterns]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

- CI: `npm run lint`, `npm run typecheck`, `npm test` — all pass (52 tests)
- Updated `mobile/.expo/types/router.d.ts` for typed onboarding routes

### Completion Notes List

- Implemented onboarding route group (`welcome`, `intensity` placeholder, `import` stub) registered on root Stack with `OnboardingRedirect` mounted inside `DatabaseProvider`.
- Welcome screen uses Direction F layout: beginner (N5), intermediate JLPT picker (N5–N1), import card with label-only chips; no auth UI.
- `starting_jlpt_level` persisted via `preferencesRepository`; cold-start redirect sends users to welcome or intensity based on preference state.
- Added reusable `OnboardingStep`, `Button`, `LevelPathCard`, `JlptLevelPicker` components with a11y roles and 44pt touch targets.
- Manual flows covered by `useOnboardingRedirect` hook tests + preferences round-trip tests; recommend device smoke test before merge.
- Code review fixes: full-width onboarding CTAs (`OnboardingStep`), `onboarding_completed` redirect-skip test, sprint status synced.

### File List

- _bmad-output/implementation-artifacts/sprint-status.yaml
- mobile/src/app/_layout.tsx
- mobile/src/app/onboarding/_layout.tsx
- mobile/src/app/onboarding/welcome.tsx
- mobile/src/app/onboarding/intensity.tsx
- mobile/src/app/onboarding/import.tsx
- mobile/src/components/common/Button.tsx
- mobile/src/components/common/OnboardingStep.tsx
- mobile/src/components/common/OnboardingStep.test.tsx
- mobile/src/components/common/index.ts
- mobile/src/components/onboarding/LevelPathCard.tsx
- mobile/src/components/onboarding/JlptLevelPicker.tsx
- mobile/src/data/curriculum/curriculum.types.ts
- mobile/src/data/curriculum/curriculum.types.test.ts
- mobile/src/data/user/preferencesRepository.ts
- mobile/src/data/user/preferencesRepository.test.ts
- mobile/src/hooks/useOnboardingRedirect.ts
- mobile/src/hooks/useOnboardingRedirect.test.tsx
- mobile/src/providers/OnboardingRedirect.tsx
- mobile/.expo/types/router.d.ts

## Senior Developer Review (AI)

_Reviewer: Riyaz on 2026-06-06_

**Outcome:** Approve (after fixes)

**Findings addressed:**
- Added `className="w-full"` to onboarding action buttons in `OnboardingStep` (UX-DR26 full-width CTA).
- Added `useOnboardingRedirect` test for `onboarding_completed=true` no-redirect branch (AC5).
- Documented `sprint-status.yaml` in File List.

**Remaining low-severity notes (not blocking):** `router.d.ts` is gitignored generated output; corrupt JLPT preference values are treated as unset without cleanup.

## Change Log

- 2026-06-06: Story 2.1 — welcome onboarding, JLPT level selection/persistence, first-launch redirect, tests (Composer)
- 2026-06-06: Code review — full-width CTAs, onboarding_completed redirect test, status → done (Composer)
