# japanese-learning

Planning artifacts live under `_bmad-output/`. The **Expo (React Native) app** for this project lives in **`mobile/`**.

## Prerequisites

- **Node.js:** use an **Active LTS** version that satisfies Expo SDK 55 (CI uses **22.13.0**; **20.x** is also supported by Expo—see [Expo prerequisites](https://docs.expo.dev/get-started/installation/)).
- **iOS:** Xcode and a simulator (for `npx expo run:ios`).
- **Android:** Android Studio, SDK, and an emulator (for `npx expo run:android`).

## Git LFS (curriculum database)

The compiled N5 seed at `mobile/assets/curriculum-seed/curriculum.db` is a large binary tracked with [Git LFS](https://git-lfs.com/). After clone:

```bash
git lfs install
git lfs pull
```

Without LFS, you may see a tiny pointer file instead of the database; `importDatabaseFromAssetAsync` will fail on first launch. Install Git LFS and run `git lfs pull` to recover.

## Curriculum pipeline (repo root)

JSON sources live under `curriculum/`. Validate and compile before committing an updated bundled DB:

```bash
npm ci
npm run validate-schema
npm run compile-curriculum
```

CI workflow `.github/workflows/compile-curriculum.yml` runs the same steps on changes to `curriculum/**`, `scripts/**`, or root `package.json`. It writes `dist/curriculum.db` as an artifact; maintainers still commit `mobile/assets/curriculum-seed/curriculum.db` when content changes.

## Bootstrap (clean checkout)

From the repository root:

```bash
git lfs install
git lfs pull
cd mobile
npm install
```

To recreate the app from the official template (optional; the repo already contains the generated tree):

```bash
npx create-expo-app@latest mobile --template default@sdk-55 --yes
```

Use a **new directory name** if `mobile/` already exists.

## Daily commands (same as CI)

Run from `mobile/`:

```bash
npm run lint
npm run typecheck   # tsc --noEmit
npm test
npm start           # Expo dev server
```

## Native runs (simulators / devices)

From `mobile/`:

```bash
npx expo run:ios
npx expo run:android
```

These produce dev builds with native projects under `mobile/ios` and `mobile/android` (gitignored). Ensure simulator/emulator prerequisites above are installed.

## Over-the-air (OTA) updates

This project uses **`expo-updates`** (Expo Updates) for **JavaScript-only** fixes between store releases, aligned with **PRD FR51** and the architecture doc. **Native code or native dependency changes require a new store build** and usually a bump to **`runtimeVersion`** (see [Runtime versions](https://docs.expo.dev/eas-update/runtime-versions/)).

- **`runtimeVersion`** is set in `mobile/app.json` using the **`appVersion`** policy so it tracks the Expo `version` field.
- **`mobile/eas.json`** holds placeholder EAS Build profiles (`development`, `preview`, `production`). Run **`eas update:configure`** (or `eas init`) when you are ready to wire the EAS Update URL to your Expo project.
- In development, Updates is typically disabled; the app reads metadata such as `Updates.runtimeVersion` via `src/lib/safe-updates-metadata.ts` so missing OTA payloads do not cause crashes.

## CI

GitHub Actions:

- **`.github/workflows/ci.yml`** — `mobile/` install, **lint**, **`tsc --noEmit`**, **Jest**
- **`.github/workflows/compile-curriculum.yml`** — root `npm ci`, **validate-schema**, **compile-curriculum** when curriculum sources change
