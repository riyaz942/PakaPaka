# japanese-learning

Planning artifacts live under `_bmad-output/`. The **Expo (React Native) app** for this project lives in **`mobile/`**.

## Prerequisites

- **Node.js:** use an **Active LTS** version that satisfies Expo SDK 55 (CI uses **22.13.0**; **20.x** is also supported by Expo—see [Expo prerequisites](https://docs.expo.dev/get-started/installation/)).
- **iOS:** Xcode and a simulator (for `npx expo run:ios`).
- **Android:** Android Studio, SDK, and an emulator (for `npx expo run:android`).

## Bootstrap (clean checkout)

From the repository root:

```bash
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

GitHub Actions workflow **`.github/workflows/ci.yml`** runs on pull requests and on pushes to `main`: install, **lint**, **`tsc --noEmit`**, and **Jest** inside `mobile/`.
