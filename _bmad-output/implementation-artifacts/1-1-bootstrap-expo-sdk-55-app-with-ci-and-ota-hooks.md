# Story 1.1: Bootstrap Expo SDK 55 app with CI and OTA hooks

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **maintainer**,
I want **the official Expo SDK 55 default template with TypeScript, Expo Router, and baseline CI**,
So that **the team has a reproducible app entrypoint aligned with architecture (EAS-ready, Expo Updates wired minimally)**.

## Acceptance Criteria

1. **Bootstrap / build**

   **Given** a clean checkout of the repo  
   **When** a developer runs the documented init command (`npx create-expo-app@latest … --template default@sdk-55`) or uses the committed baseline  
   **Then** the app builds for iOS and Android simulators with TypeScript strict and Expo Router resolving `/src/app` routes  
   **And** `.github/workflows/ci.yml` runs lint, typecheck, and tests on PR (stub test OK if none yet) per architecture

2. **Expo Updates / OTA foundation**

   **Given** the project is configured for Expo Updates  
   **When** a release channel build is produced  
   **Then** `expo-updates` can report runtime version metadata (no crash on missing update)  
   **And** documentation states how OTA will be used for JS-only fixes (FR51 foundation)

## Tasks / Subtasks

- [x] **AC1 — Expo SDK 55 baseline**
  - [x] Initialize with `npx create-expo-app@latest japanese-learning --template default@sdk-55` **or** equivalent committed tree if app lives in monorepo root (document chosen layout in `README.md`).
  - [x] Confirm **TypeScript strict** in `tsconfig.json` (no implicit any; align with Expo defaults and fix any template drift).
  - [x] Confirm **Expo Router** uses **`src/app`** (SDK 55 default layout); root `_layout.tsx` loads without route errors on simulators.
  - [x] Verify **Android** native run locally (`npx expo run:android` or documented equivalent) — maintainer confirmed **2026-05-17**; README notes emulator prerequisites.
  - [x] **iOS simulator run (`npx expo run:ios`):** not executed on maintainer machine (disk/space; **Android-only** dev for now). README still documents iOS/Xcode steps for others and for future EAS/App Store builds — accepted to close this story **2026-05-17**.

- [x] **AC1 — CI workflow**
  - [x] Add `.github/workflows/ci.yml` that runs on PR (and optionally push to `main`): install deps, **lint**, **`tsc --noEmit`**, **tests**.
  - [x] Add minimal **Jest** setup if not already present (architecture: Jest for core; stub test e.g. `expect(true).toBe(true)` or smoke import of app config is OK for this story).
  - [x] Ensure CI uses **Node LTS** consistent with Expo SDK 55 requirements (document version in README if pinned).

- [x] **AC2 — Expo Updates hooks**
  - [x] Ensure **`expo-updates`** is installed/configured per SDK 55 (template may include it — verify).
  - [x] Set **`runtimeVersion`** in app config (`app.json` / `app.config.*`) so runtime metadata is defined for EAS Update compatibility ([Expo runtime versions](https://docs.expo.dev/eas-update/runtime-versions/)).
  - [x] At runtime, calling APIs such as `Updates.runtimeVersion` (or equivalent) must not throw when no OTA payload exists — **graceful no-op** in dev and when updates are unavailable.
  - [x] Add **`eas.json`** skeleton if missing (build profiles can be minimal `development` / `preview` / `production` placeholders) so EAS Build/Update has a home.

- [x] **AC2 — Documentation**
  - [x] In `README.md` (or `docs/`), document: OTA is for **JS-only** fixes; native changes require new store build; pointer to **FR51** / PRD OTA expectation.

## Dev Notes

### Epic context (Epic 1)

Epic 1 delivers an installable shell: dual DBs, curriculum pipeline, tabs, OTA — **this story is only the first slice**: reproducible Expo SDK 55 app + CI + minimal Updates wiring. Do **not** implement NativeWind, SQLite, or tab shell here (Stories 1.2–1.4).

### Technical requirements (must follow)

- **Starter:** `create-expo-app` with `default@sdk-55` — official template with Expo Router, `/src` layout, RN 0.83 / React 19.2 per architecture.
- **Structure:** Preserve template `src/app/` routing; future stories add `(tabs)/`, `review/`, `onboarding/` under architecture — **do not invent a different routing scheme**.
- **OTA:** Align with PRD **FR51** and architecture (**Expo Updates** for JS patches). Document limitation: updates cannot change native code — bump **`runtimeVersion`** when native deps change.
- **CI scope:** Lint + typecheck + test on PR matches architecture **`.github/workflows/ci.yml`** expectation (curriculum compile workflow is **Story 1.5**, not here).

### Architecture compliance

- Follow **Implementation Sequence** item 1: project init is prerequisite for everything else ([Source: `_bmad-output/planning-artifacts/architecture.md` — Starter Template Evaluation, Decision Impact Analysis]).
- **Enforcement habits** (apply as tooling allows from day one): run `npx tsc --noEmit` clean before merge; **named exports** preferred per architecture patterns (template default exports in routes are acceptable where Expo Router requires — normalize in later stories if needed).
- **Do not** add Zustand/Redux or backend API layers — local-first SQLite-first architecture applies later.

### Library / framework requirements

| Area | Choice |
| --- | --- |
| App framework | Expo SDK 55 managed workflow |
| Routing | Expo Router v4 (file-based, `src/app`) |
| Updates | `expo-updates` (SDK bundled / configured) |
| CI | GitHub Actions |
| Unit tests (minimal now) | Jest (expand per architecture Testing Strategy) |

Future pinned versions (NativeWind, tailwind, ts-fsrs, etc.) land in **Story 1.2+** per architecture table — **do not install them in 1.1** unless required by template.

### File structure requirements

Target layout after this story should be compatible with architecture **Complete Project Directory Structure** ([Source: `_bmad-output/planning-artifacts/architecture.md` — Project Structure & Boundaries]). Full tree (curriculum, scripts, `eas.json`, `.github/workflows/ci.yml`) may be incremental:

- **Must exist after 1.1:** `package.json`, `tsconfig.json`, `src/app/` with working Router tree, `app.json` or `app.config.*`, `.github/workflows/ci.yml`, documented README bootstrap steps.
- **Optional stub for later:** empty `assets/`, `.eslintrc.js` / Prettier if CI runs ESLint — ensure CI passes.

If the repo root is **not** only the mobile app (e.g. `_bmad-output` coexists), place the app in a single clear directory (e.g. `app/` or `mobile/`) and document paths — **avoid** scattering `src/app` at repo root without documenting where developers `cd`.

### Testing requirements

- **CI:** At least one Jest test passing.
- **Local:** Developer can run the same commands as CI (`npm test` / `yarn test`, `npm run lint`, `npx tsc --noEmit`).
- **Manual:** Launch on a simulator or device and confirm no red screen on startup. **Maintainer (2026-05-17):** Android verified locally; iOS deferred on this workstation — README remains the source for iOS when space or CI/EAS runs it.

### Previous story intelligence

None — first story in Epic 1.

### Git intelligence summary

The **`mobile/`** Expo SDK 55 app, CI workflow, and related root docs are in the repository. Treat this story as the source of truth for what 1.1 delivered; use git history for line-level diffs.

### Latest technical information

- **Expo SDK 55 — Updates:** Configure **`runtimeVersion`** (string or policy) so OTA payloads match native binaries ([Expo Updates SDK 55](https://docs.expo.dev/versions/v55.0.0/sdk/updates/), [Runtime versions](https://docs.expo.dev/eas-update/runtime-versions/)).
- **Dev vs release:** Expo Go / dev client behavior differs from standalone builds with Updates enabled — document how maintainers will test updates (e.g. EAS internal distribution later).

### Project context reference

No `project-context.md` found in repo — rely on this story + `_bmad-output/planning-artifacts/architecture.md` + `_bmad-output/planning-artifacts/epics.md`.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.1]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Starter Template Evaluation, Infrastructure & Deployment, Testing Strategy, Project Structure & Boundaries]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR51 OTA, mobile / EAS expectations]
- [Expo Updates (SDK 55)](https://docs.expo.dev/versions/v55.0.0/sdk/updates/)

## Dev Agent Record

### Agent Model Used

Cursor / Composer (automated dev-story run). **Code review follow-up (2026-05-17):** Composer — aligned task checkboxes with verification reality (Android confirmed by Riyaz), expanded File List, cleared stale “no app code” note. **Closure (2026-05-17):** Story marked **done**; maintainer accepts **Android-only** local dev (disk/space); iOS native run waived for this story with README left for team/EAS.

### Debug Log References

None.

### Completion Notes List

- Added Expo SDK 55 app under `mobile/` using `create-expo-app` template `default@sdk-55` (Expo Router with `src/app/`, TypeScript strict + explicit `noImplicitAny`).
- Installed and wired **`expo-updates`**: `runtimeVersion` policy `appVersion` in `mobile/app.json`; safe metadata reader in `mobile/src/lib/safe-updates-metadata.ts` invoked from root `src/app/_layout.tsx` (no throw when updates disabled / no OTA).
- Added **`mobile/eas.json`** placeholder profiles for EAS Build/Update.
- CI: **`.github/workflows/ci.yml`** runs `npm ci`, lint, `tsc --noEmit`, and Jest in `mobile/` on PR and push to `main` (Node **22.13.0**).
- Tests: Jest + `jest-expo`, smoke test plus `safe-updates-metadata` test; **`moduleNameMapper`** for `@/` paths.
- Fixed template **`tsc`** gap: `mobile/src/types/css-modules.d.ts` for `*.module.css` imports on web.
- Pinned **`@types/jest@29.5.14`** to satisfy `expo-doctor` / Expo SDK 55 dependency alignment.
- Root **`README.md`**: monorepo layout, commands, OTA / FR51 notes, simulator prerequisites; root **`.gitignore`** extended for `node_modules` and `.DS_Store`.
- **Native runs:** **Android** — maintainer verified `npx expo run:android` successfully on **2026-05-17**. **iOS** — not run locally on maintainer machine (space); README documents `npx expo run:ios` for others and release pipelines.

### File List

- `.gitignore`
- `README.md`
- `.github/workflows/ci.yml`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `mobile/app.json`, `mobile/eas.json`, `mobile/tsconfig.json`, `mobile/eslint.config.js`, `mobile/package.json`, `mobile/package-lock.json`
- `mobile/src/app/_layout.tsx`, `mobile/src/app/index.tsx`, `mobile/src/app/explore.tsx`
- `mobile/src/lib/safe-updates-metadata.ts`
- `mobile/src/types/css-modules.d.ts`
- `mobile/src/constants/theme.ts`
- `mobile/src/components/app-tabs.tsx`, `mobile/src/components/app-tabs.web.tsx`, `mobile/src/components/animated-icon.tsx`, `mobile/src/components/animated-icon.web.tsx`, `mobile/src/components/hint-row.tsx`, `mobile/src/components/themed-text.tsx`, `mobile/src/components/themed-view.tsx`, `mobile/src/components/web-badge.tsx`, `mobile/src/components/external-link.tsx`, `mobile/src/components/ui/collapsible.tsx`
- `mobile/src/hooks/use-color-scheme.ts`, `mobile/src/hooks/use-color-scheme.web.ts`, `mobile/src/hooks/use-theme.ts`
- `mobile/__tests__/smoke.test.ts`, `mobile/__tests__/safe-updates-metadata.test.ts`
- Plus template assets, config, and other generated **`mobile/`** files from `default@sdk-55` not named here (see repo tree).

## Change Log

- **2026-05-17 (later):** Story **done** — maintainer Android-only dev (disk/space); iOS simulator task closed with documented waiver; README unchanged as iOS reference; sprint status → **done**.
- **2026-05-17:** Code review (option 1) — Android native run verified by maintainer; split iOS/Android verification tasks; expanded File List; stale git summary removed; status **review → in-progress** until iOS `run:ios` verified for AC1.
- **2026-05-03:** Story 1.1 implemented — Expo app in `mobile/`, GitHub Actions CI, Jest, `expo-updates` + `runtimeVersion`, `eas.json` skeleton, README OTA/FR51 documentation; sprint status → review.
