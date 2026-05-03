# Story 1.1: Bootstrap Expo SDK 55 app with CI and OTA hooks

Status: ready-for-dev

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

- [ ] **AC1 — Expo SDK 55 baseline**
  - [ ] Initialize with `npx create-expo-app@latest japanese-learning --template default@sdk-55` **or** equivalent committed tree if app lives in monorepo root (document chosen layout in `README.md`).
  - [ ] Confirm **TypeScript strict** in `tsconfig.json` (no implicit any; align with Expo defaults and fix any template drift).
  - [ ] Confirm **Expo Router** uses **`src/app`** (SDK 55 default layout); root `_layout.tsx` loads without route errors on simulators.
  - [ ] Verify **iOS + Android** builds locally (`npx expo run:ios` / `npx expo run:android` or documented Expo-equivalent) — note any emulator prerequisites in README.

- [ ] **AC1 — CI workflow**
  - [ ] Add `.github/workflows/ci.yml` that runs on PR (and optionally push to `main`): install deps, **lint**, **`tsc --noEmit`**, **tests**.
  - [ ] Add minimal **Jest** setup if not already present (architecture: Jest for core; stub test e.g. `expect(true).toBe(true)` or smoke import of app config is OK for this story).
  - [ ] Ensure CI uses **Node LTS** consistent with Expo SDK 55 requirements (document version in README if pinned).

- [ ] **AC2 — Expo Updates hooks**
  - [ ] Ensure **`expo-updates`** is installed/configured per SDK 55 (template may include it — verify).
  - [ ] Set **`runtimeVersion`** in app config (`app.json` / `app.config.*`) so runtime metadata is defined for EAS Update compatibility ([Expo runtime versions](https://docs.expo.dev/eas-update/runtime-versions/)).
  - [ ] At runtime, calling APIs such as `Updates.runtimeVersion` (or equivalent) must not throw when no OTA payload exists — **graceful no-op** in dev and when updates are unavailable.
  - [ ] Add **`eas.json`** skeleton if missing (build profiles can be minimal `development` / `preview` / `production` placeholders) so EAS Build/Update has a home.

- [ ] **AC2 — Documentation**
  - [ ] In `README.md` (or `docs/`), document: OTA is for **JS-only** fixes; native changes require new store build; pointer to **FR51** / PRD OTA expectation.

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
- **Manual:** Launch app on iOS + Android simulators; confirm no red screen on startup.

### Previous story intelligence

None — first story in Epic 1.

### Git intelligence summary

Recent commits are planning artifacts (epics, architecture, sprint status). **No application code yet** — this story establishes the initial mobile codebase and CI.

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

(To be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List

---

**Story completion:** Ultimate context engine analysis completed — comprehensive developer guide created.
