# Development

How to set up, build and run PakaPaka. For how to contribute, see [CONTRIBUTING.md](../CONTRIBUTING.md).

## Tech stack

- [Expo](https://expo.dev/) SDK 55 (React Native, New Architecture) with Expo Router
- TypeScript, [NativeWind](https://www.nativewind.dev/) for styling
- Two SQLite databases (`expo-sqlite`): a read-only `curriculum.db` and a `user.db` for progress
- [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) for scheduling, [WanaKana](https://wanakana.com/) for kana input
- [react-native-executorch](https://github.com/software-mansion/react-native-executorch) for on-device speech
- Jest for tests

## Repository layout

| Path | What it holds |
| --- | --- |
| `mobile/` | The Expo app |
| `curriculum/` | Curriculum sources (JSON) and the content generation tools |
| `scripts/` | Schema validation and the curriculum compiler |
| `web/` | Curriculum Studio, a local browser and editor for the curriculum ([web/README.md](../web/README.md)) |
| `website/` | Landing page |
| `docs/` | Working docs ([docs/README.md](README.md)) |
| `_bmad-output/` | PRD, architecture and story files ([_bmad-output/README.md](../_bmad-output/README.md)) |

## Prerequisites

- **Node.js:** an Active LTS version that Expo SDK 55 supports (CI uses **22.13.0**; **20.x** also works — see [Expo prerequisites](https://docs.expo.dev/get-started/installation/)).
- **Git LFS:** the compiled curriculum database is stored with [Git LFS](https://git-lfs.com/).
- **iOS:** Xcode and a simulator.
- **Android:** Android Studio, the SDK and an emulator.

The app supports **iOS 17+** and **Android 13+ (API 33)**.

## Quick start

```bash
git clone https://github.com/riyaz942/pakapaka.git
cd pakapaka
git lfs install
git lfs pull
cd mobile
npm install
npx expo run:ios       # or: npx expo run:android
```

If you skip `git lfs pull`, `mobile/assets/curriculum-seed/curriculum.db` is only a small pointer file and the app fails on first launch. Run `git lfs pull` to fix it.

## Daily commands (same as CI)

Run from `mobile/`:

```bash
npm run lint
npm run typecheck   # tsc --noEmit
npm test
npm start           # Expo dev server
```

## Curriculum pipeline (repo root)

The curriculum sources are JSON files in `curriculum/`. Validate and compile them before you commit an updated database:

```bash
npm ci
npm run validate-schema
npm run compile-curriculum
```

The CI workflow `.github/workflows/compile-curriculum.yml` runs the same steps when `curriculum/**`, `scripts/**` or the root `package.json` change. It writes `dist/curriculum.db` as an artifact. Maintainers still commit `mobile/assets/curriculum-seed/curriculum.db` when content changes.

To browse and edit the curriculum in a UI with the same validate/compile checks, run `npm run studio` — see [web/README.md](../web/README.md).

## Running the app

The app uses **`expo-notifications`**, so it needs a **development build**. Since Expo SDK 53, [Expo Go does not support it on Android](https://docs.expo.dev/develop/development-builds/introduction/) (importing the module throws). Use one of the options below.

<details>
<summary><strong>Option A — Simulator or emulator</strong> (fastest, local machine only)</summary>

Needs Xcode (iOS) or Android Studio and the SDK (Android).

```bash
cd mobile
npx expo run:ios       # builds and launches on the iOS Simulator
npx expo run:android   # builds and launches on the Android Emulator
```

This builds a local development client and installs it on the running simulator or emulator. Native projects go in `mobile/ios` and `mobile/android` (gitignored).

</details>

<details>
<summary><strong>Option B — Physical device over USB</strong> (local build, no EAS account)</summary>

1. Turn on developer mode and USB debugging (Android), or trust the computer (iOS). Connect the device with USB.
2. Make sure the device is detected:

   ```bash
   adb devices                  # Android
   xcrun xctrace list devices   # iOS
   ```

3. From `mobile/`, run the same commands as Option A. Expo CLI finds the device and offers to install there:

   ```bash
   npx expo run:android
   npx expo run:ios
   ```

</details>

<details>
<summary><strong>Option C — Physical device over Wi-Fi with EAS Build</strong> (no Xcode or Android Studio needed)</summary>

1. Install the EAS CLI and log in (one time):

   ```bash
   cd mobile
   npx eas-cli login
   npx eas-cli init    # links this project to your Expo account, if not linked yet
   ```

2. Build in the cloud (the flags map to `mobile/eas.json`):

   ```bash
   npx eas-cli build --profile development --platform android
   ```

   **`--profile`** (from `mobile/eas.json` → `build`):

   | Value | What it does |
   | --- | --- |
   | `development` | Dev client build (`developmentClient: true`, `distribution: internal`). Install it from a link or QR code. Use it with `npx expo start --dev-client` for live JS reload. Use this for Option C. |
   | `preview` | Standalone app for internal testing (`distribution: internal`). Not a dev client, so no Metro connection. Good for sharing a near-release build with testers outside the stores. |
   | `production` | Store-ready release build (default EAS production settings). Use before App Store / Play Store submit (`eas submit` uses the matching `submit.production` profile). |

   **`--platform`:**

   | Value | What it does |
   | --- | --- |
   | `android` | Build an Android APK/AAB only. |
   | `ios` | Build an iOS app only (needs an Apple Developer account for device or internal installs). |
   | `all` | Build for Android and iOS in one command. |

   When the build finishes, EAS shows an install link and a QR code.

3. On the device, open the link (or scan the QR code) to install the build. For iOS, the device UDID must be registered with your Apple Developer account for internal distribution. EAS asks for this during the build if needed.

4. Start Metro in **dev-client mode** (plain `expo start` uses Expo Go):

   ```bash
   npx expo start --dev-client
   ```

5. Open the installed dev-client app (not Expo Go) on the device. Scan the QR code from Metro, or enter the `exp://<ip>:8081` URL.

   - The device and your computer must be on the **same Wi-Fi network**. If they cannot connect (guest network, VPN, firewall), use a tunnel:

     ```bash
     npx expo start --dev-client --tunnel
     ```

</details>

<details>
<summary><strong>Option D — Expo Go</strong> (quick UI work, no custom native modules)</summary>

```bash
cd mobile
npx expo start
```

Scan the QR code with Expo Go (iOS) or the Camera app (Android). This is fine for UI and logic that do not use `expo-notifications` or other custom native modules. On Android, screens that import `src/config/notifications.ts` (for example Settings) crash in Expo Go. Use Options A–C for those.

</details>

<details>
<summary><strong>Recreate the app from the Expo template</strong> (optional)</summary>

The repo already has the generated tree. To recreate it:

```bash
npx create-expo-app@latest mobile --template default@sdk-55 --yes
```

Use a **new directory name** if `mobile/` already exists.

</details>

## Over-the-air (OTA) updates

The app uses **`expo-updates`** for **JavaScript-only** fixes between store releases (PRD FR51). **Changes to native code or native dependencies need a new store build**, and usually a bump to **`runtimeVersion`** (see [Runtime versions](https://docs.expo.dev/eas-update/runtime-versions/)).

- **`runtimeVersion`** in `mobile/app.json` uses the **`appVersion`** policy, so it follows the Expo `version` field.
- **`mobile/eas.json`** has placeholder EAS Build profiles (`development`, `preview`, `production`). Run **`eas update:configure`** (or `eas init`) when you are ready to connect the EAS Update URL to your Expo project.
- In development, Updates is usually off. The app reads metadata such as `Updates.runtimeVersion` through `src/lib/safe-updates-metadata.ts`, so a missing OTA payload does not crash it.

The curriculum database has its own OTA path: manifest semver check → download → SHA-256 check → atomic replace (`curriculumUpdate.ts`).

## CI

GitHub Actions:

- **`.github/workflows/ci.yml`** — `mobile/` install, **lint**, **`tsc --noEmit`**, **Jest**
- **`.github/workflows/compile-curriculum.yml`** — root `npm ci`, **validate-schema**, **compile-curriculum** when curriculum sources change
