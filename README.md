# japanese-learning

Planning artifacts live under `_bmad-output/`. The **Expo (React Native) app** for this project lives in **`mobile/`**.

New here? [**docs/app-overview.md**](docs/app-overview.md) explains what the app is, how a learner moves through it, and what each screen does. The rest of this file is setup and build/run instructions.

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

For a browsable, editable view of the curriculum JSON (with the same validate/compile gates wired into the UI), run `npm run studio` — see [web/README.md](web/README.md).

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

## Running the app

This project uses **`expo-notifications`**, which requires a **development build** — as of Expo SDK 53, [Expo Go no longer supports it on Android](https://docs.expo.dev/develop/development-builds/introduction/) (importing the module alone throws). Use one of the options below instead of plain Expo Go on Android. Expo Go remains usable on iOS and for quick web/Android testing of screens that don't touch notifications.

### Option A — Simulator/emulator (fastest, local machine only)

Requires Xcode (iOS) or Android Studio + SDK (Android) — see [Prerequisites](#prerequisites).

```bash
cd mobile
npx expo run:ios       # builds and launches on the iOS Simulator
npx expo run:android   # builds and launches on the Android Emulator
```

This builds a local development client and installs it directly on the running simulator/emulator — no separate install step needed.

### Option B — Physical device via USB (local build, no EAS account needed)

1. Enable developer mode + USB debugging on the device (Android) or trust the computer (iOS), and connect via USB.
2. Confirm the device is detected:

   ```bash
   adb devices          # Android
   xcrun xctrace list devices   # iOS
   ```

3. From `mobile/`, run the same commands as Option A — Expo CLI will detect the connected device and offer to install there instead of the simulator/emulator:

   ```bash
   npx expo run:android
   npx expo run:ios
   ```

### Option C — Physical device over Wi-Fi via EAS Build (no Mac/Android Studio required on the test device)

Use this when you want to test on a real device without a USB cable, or don't have Xcode/Android Studio installed.

1. Install the EAS CLI and log in (one-time):

   ```bash
   cd mobile
   npx eas-cli login
   npx eas-cli init    # links this project to your Expo account, if not already linked
   ```

2. Build a development client in the cloud:

   ```bash
   npx eas-cli build --profile development --platform android   # or --platform ios
   ```

   This uses the `development` profile in `mobile/eas.json` (`developmentClient: true`, `distribution: internal`). When it finishes, EAS prints an install link and QR code.

3. On the device, open the link (or scan the QR code) to download and install the build. For iOS, the device UDID must be registered with your Apple Developer account for internal distribution — EAS will prompt for this during the build if needed.

4. Start Metro in **dev-client mode** (not plain `expo start`, which defaults to Expo Go):

   ```bash
   npx expo start --dev-client
   ```

5. Open the installed dev-client app (not Expo Go) on the device and scan the QR code Metro prints, or enter the `exp://<ip>:8081` URL manually.

   - The device and your computer must be on the **same Wi-Fi network** for this to work. If they can't reach each other (guest network, VPN, corporate firewall), use a tunnel instead:

     ```bash
     npx expo start --dev-client --tunnel
     ```

### Option D — Expo Go (quick iteration, no native module access)

```bash
cd mobile
npx expo start
```

Scan the QR code with the Expo Go app (iOS) or the Camera app (Android). Fine for iterating on UI/logic that doesn't touch `expo-notifications` or other custom native modules; on Android, screens that import `src/config/notifications.ts` (e.g. Settings) will crash in Expo Go — use Options A–C instead.

## Over-the-air (OTA) updates

This project uses **`expo-updates`** (Expo Updates) for **JavaScript-only** fixes between store releases, aligned with **PRD FR51** and the architecture doc. **Native code or native dependency changes require a new store build** and usually a bump to **`runtimeVersion`** (see [Runtime versions](https://docs.expo.dev/eas-update/runtime-versions/)).

- **`runtimeVersion`** is set in `mobile/app.json` using the **`appVersion`** policy so it tracks the Expo `version` field.
- **`mobile/eas.json`** holds placeholder EAS Build profiles (`development`, `preview`, `production`). Run **`eas update:configure`** (or `eas init`) when you are ready to wire the EAS Update URL to your Expo project.
- In development, Updates is typically disabled; the app reads metadata such as `Updates.runtimeVersion` via `src/lib/safe-updates-metadata.ts` so missing OTA payloads do not cause crashes.

## CI

GitHub Actions:

- **`.github/workflows/ci.yml`** — `mobile/` install, **lint**, **`tsc --noEmit`**, **Jest**
- **`.github/workflows/compile-curriculum.yml`** — root `npm ci`, **validate-schema**, **compile-curriculum** when curriculum sources change
