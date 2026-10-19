<p align="center">
  <img src="mobile/assets/images/icon.png" alt="NihongoCore app icon" width="120" />
</p>

<h1 align="center">NihongoCore</h1>

<p align="center">
  <strong>Kanji, vocabulary, grammar and reading in one app. Free, open source, and fully offline.</strong>
</p>

<p align="center">
  <img alt="Platforms: iOS 17+ and Android 13+" src="https://img.shields.io/badge/platforms-iOS%2017%2B%20%7C%20Android%2013%2B-blue" />
  <img alt="License: MIT (code)" src="https://img.shields.io/badge/code-MIT-green" />
  <img alt="Content license: CC BY-SA 4.0" src="https://img.shields.io/badge/content-CC%20BY--SA%204.0-lightgrey" />
  <img alt="Built with Expo" src="https://img.shields.io/badge/built%20with-Expo-000020" />
</p>

---

Most learners pay for three apps: one for kanji, one for grammar, and a flashcard deck for everything else. None of them share what you know.

NihongoCore puts it all in one place. Radicals, kanji, vocabulary, grammar and reading passages sit in one dependency graph and go through one review queue. The queue learns where you make mistakes and shows you those items first.

**No accounts. No subscriptions. No ads. Your progress never leaves your phone.**

<!-- Screenshots: add images here, for example
<p align="center">
  <img src="docs/screenshots/home.png" width="230" />
  <img src="docs/screenshots/review.png" width="230" />
  <img src="docs/screenshots/browse.png" width="230" />
  <img src="docs/screenshots/talk.png" width="230" />
</p>
-->

## Why NihongoCore

- **One path, in the right order.** Radicals unlock kanji. Kanji unlock vocabulary. Vocabulary and grammar unlock reading. You never study a word before its parts.
- **Reviews that find your weak points.** Scheduling uses [FSRS](https://github.com/open-spaced-repetition/ts-fsrs), blended with a weakness score from your real mistakes (`0.7 × FSRS + 0.3 × weakness`).
- **You type the answer.** No multiple choice. Type the meaning or the reading. Romaji turns into kana as you type, and the app helps with typos and wrong-script answers.
- **Bring your history.** Import progress from WaniKani, Bunpro or Anki (`.apkg`), so you do not start again from zero.
- **Works offline.** Lessons, reviews, Browse and Stats work in airplane mode. Only the optional AI chat needs a network.
- **Free and open.** The app, the curriculum and the build pipeline are all in this repository.

## Features

### Lessons
New items come one card at a time, in short paced sections. You choose how many new items you get each day. Nothing saves until the last card, so if you stop halfway, you lose nothing. When you finish, "Quiz me now" starts a review of the new items immediately.

### Reviews
- **Kanji** use two cards: meaning and on'yomi. The worse of the two answers sets the grade. You learn kun'yomi through vocabulary.
- **Vocabulary** gets a reading card only after you know every kanji in the word.
- **Grammar** uses two cards per point. **Read**: see a Japanese sentence and type what the grammar means. **Build**: see an English sentence and type the full Japanese sentence.
- If your answer matches a *different* item, a compare screen shows the difference without leaving the session.
- Optional Lightning Mode moves to the next card automatically after a correct answer.

### Browse
One search screen for radicals, kanji, vocabulary, grammar and reading passages, with filters for type, level and status. Each detail page shows mnemonics, readings, example sentences, related items and look-alikes. You can add your own mnemonics and synonyms.

### Reading passages
Graded passages unlock when you know at least 90% of their words (Guru or higher). Furigana hides automatically for words you know. You can override it for each word.

### Talk (AI conversation)
Practice conversation with an AI partner. Use your own API key (OpenAI-compatible or Anthropic). Replies stay at your level and use furigana. Known words link to their detail pages. Voice input and output use on-device speech models. Your key stays in secure storage and your chats stay on your phone.

### Home and Stats
A daily goal ring shows today's lessons and reviews. You can reorder or hide the Home sections. Vacation mode stops new reviews from piling up while you are away. Stats shows days studied, SRS stages and the patterns you get wrong most.

### Your data
Export your progress to a backup file and restore it on any device. You can also run NihongoCore in "shadow mode" next to the tools you use now, and compare before you change.

## What is in the curriculum

| | Count |
| --- | --- |
| Radicals | 817 |
| Kanji | 2,000 |
| Vocabulary | 9,747 |
| Grammar points | 161 |
| Reading passages | 60 |

**N5 and N4 are complete:** mnemonics, example sentences, grammar and reading passages.
**N3, N2 and N1 are a first version:** kanji, radicals and about 8,500 words with readings, meanings and furigana. Mnemonics, examples, grammar and passages for these levels are not written yet. This is a good place to contribute.

## Status

NihongoCore is in active development and is not in the App Store or Google Play yet. To try it now, build it from source (see [Development](#development)). For the full list of what is done and what is left, see [docs/working-history.md](docs/working-history.md).

## Contributing

Contributions are welcome: code, curriculum content, mnemonics and bug reports.

1. Read [docs/app-overview.md](docs/app-overview.md) to learn how the app works.
2. Check [docs/working-history.md](docs/working-history.md) and [docs/known-issues.md](docs/known-issues.md) before you start, so you do not repeat work.
3. Open an issue to discuss large changes before you send a pull request.
4. Make sure `npm run lint`, `npm run typecheck` and `npm test` pass in `mobile/`. If you change curriculum JSON, run `npm run validate-schema` at the repo root.

Some rules for the codebase:

- Functions that can fail return `Result<T, AppError>` (`mobile/src/types/result.types.ts`). They do not throw across async boundaries.
- `curriculum.db` is read-only. Learner data goes in `user.db`. Change the schema only with a numbered migration in `mobile/src/data/migrations/`.
- Use the semantic NativeWind tokens (`bg-background`, `text-primary`, …). Do not use raw hex colors.
- Do not add a feature that needs a network, except in the Talk tab.

## Development

### Tech stack

- [Expo](https://expo.dev/) SDK 55 (React Native, New Architecture) with Expo Router
- TypeScript, [NativeWind](https://www.nativewind.dev/) for styling
- Two SQLite databases (`expo-sqlite`): a read-only `curriculum.db` and a `user.db` for progress
- [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) for scheduling, [WanaKana](https://wanakana.com/) for kana input
- [react-native-executorch](https://github.com/software-mansion/react-native-executorch) for on-device speech
- Jest for tests

### Repository layout

| Path | What it holds |
| --- | --- |
| `mobile/` | The Expo app |
| `curriculum/` | Curriculum sources (JSON) and the content generation tools |
| `scripts/` | Schema validation and the curriculum compiler |
| `web/` | Curriculum Studio, a local browser and editor for the curriculum ([web/README.md](web/README.md)) |
| `website/` | Landing page |
| `docs/` | Working docs ([docs/README.md](docs/README.md)) |
| `_bmad-output/` | PRD, architecture and story files ([_bmad-output/README.md](_bmad-output/README.md)) |

### Prerequisites

- **Node.js:** an Active LTS version that Expo SDK 55 supports (CI uses **22.13.0**; **20.x** also works — see [Expo prerequisites](https://docs.expo.dev/get-started/installation/)).
- **Git LFS:** the compiled curriculum database is stored with [Git LFS](https://git-lfs.com/).
- **iOS:** Xcode and a simulator.
- **Android:** Android Studio, the SDK and an emulator.

The app supports **iOS 17+** and **Android 13+ (API 33)**.

### Quick start

```bash
git clone https://github.com/riyaz942/nihongo-core.git
cd nihongo-core
git lfs install
git lfs pull
cd mobile
npm install
npx expo run:ios       # or: npx expo run:android
```

If you skip `git lfs pull`, `mobile/assets/curriculum-seed/curriculum.db` is only a small pointer file and the app fails on first launch. Run `git lfs pull` to fix it.

### Daily commands (same as CI)

Run from `mobile/`:

```bash
npm run lint
npm run typecheck   # tsc --noEmit
npm test
npm start           # Expo dev server
```

### Curriculum pipeline (repo root)

The curriculum sources are JSON files in `curriculum/`. Validate and compile them before you commit an updated database:

```bash
npm ci
npm run validate-schema
npm run compile-curriculum
```

The CI workflow `.github/workflows/compile-curriculum.yml` runs the same steps when `curriculum/**`, `scripts/**` or the root `package.json` change. It writes `dist/curriculum.db` as an artifact. Maintainers still commit `mobile/assets/curriculum-seed/curriculum.db` when content changes.

To browse and edit the curriculum in a UI with the same validate/compile checks, run `npm run studio` — see [web/README.md](web/README.md).

### Running the app

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

### Over-the-air (OTA) updates

The app uses **`expo-updates`** for **JavaScript-only** fixes between store releases (PRD FR51). **Changes to native code or native dependencies need a new store build**, and usually a bump to **`runtimeVersion`** (see [Runtime versions](https://docs.expo.dev/eas-update/runtime-versions/)).

- **`runtimeVersion`** in `mobile/app.json` uses the **`appVersion`** policy, so it follows the Expo `version` field.
- **`mobile/eas.json`** has placeholder EAS Build profiles (`development`, `preview`, `production`). Run **`eas update:configure`** (or `eas init`) when you are ready to connect the EAS Update URL to your Expo project.
- In development, Updates is usually off. The app reads metadata such as `Updates.runtimeVersion` through `src/lib/safe-updates-metadata.ts`, so a missing OTA payload does not crash it.

The curriculum database has its own OTA path: manifest semver check → download → SHA-256 check → atomic replace (`curriculumUpdate.ts`).

### CI

GitHub Actions:

- **`.github/workflows/ci.yml`** — `mobile/` install, **lint**, **`tsc --noEmit`**, **Jest**
- **`.github/workflows/compile-curriculum.yml`** — root `npm ci`, **validate-schema**, **compile-curriculum** when curriculum sources change

## Documentation

- [docs/app-overview.md](docs/app-overview.md) — what the app is, how a learner moves through it, what each screen does
- [docs/working-history.md](docs/working-history.md) — status of every plan: what is done and what is left
- [docs/srs-system-vs-wanikani.md](docs/srs-system-vs-wanikani.md) — how SRS stages work
- [docs/README.md](docs/README.md) — index of all working docs

## License

- **Code** is licensed under the [MIT License](LICENSE).
- **Curriculum content** (`curriculum/` and the compiled `curriculum.db`) contains data derived from JMdict, KANJIDIC2, KRADFILE and JmdictFurigana, and is licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- **Stroke-order data and kanji/radical images** are derived from [KanjiVG](https://kanjivg.tagaini.net/) and are licensed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).

See [NOTICE](NOTICE) for the full third-party attributions.

## Acknowledgements

Thank you to the [EDRDG](https://www.edrdg.org/) (JMdict, KANJIDIC2, KRADFILE), [JmdictFurigana](https://github.com/Doublevil/JmdictFurigana), [KanjiVG](https://kanjivg.tagaini.net/), [Tatoeba](https://tatoeba.org/) and the [open-spaced-repetition](https://github.com/open-spaced-repetition) project. This app would not exist without their work.
