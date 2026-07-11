# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Offline-first Expo (React Native) Japanese learning app for Android & iOS. Dual SQLite databases, no accounts, no subscriptions. Content model: radical → kanji → vocabulary dependency graph plus structured grammar; SRS via FSRS with weakness biasing.

- Active follow-ups / playtest work: `docs/feedback/` (see also `docs/working-history.md`)
- Historical planning artifacts (PRD, architecture, epics): `_bmad-output/` — reference only, not an active tracker

## Hard conventions

- **Result type** — Fallible operations return `Result<T, AppError>` from `src/types/result.types.ts`. Never throw across async boundaries; propagate the result.
- **Dual DB** — `curriculum.db` is read-only content; `user.db` is mutable user state. Never write to `curriculum.db`.
- **Styling** — Use semantic NativeWind tokens (`bg-background`, `text-primary`, SRS/content accents, etc.). Do not use the deprecated `Colors` object in `src/constants/theme.ts` or raw hex in new code.
- **Path alias** — `@/*` → `mobile/src/*`; `@/assets/*` → `mobile/assets/*`.
- **Do not** treat `_bmad-output/` as backlog; check `docs/feedback/` before assuming a gap is intentional.

## Repository layout

```
curriculum/          # JSON source content (validated & compiled to SQLite)
scripts/             # Node/TypeScript curriculum tooling (validate-schema, compile-curriculum)
mobile/              # Expo (React Native) app — all app code lives here
  src/
    app/             # Expo Router file-based routes
    components/      # UI components grouped by feature (common/, learn/, lesson/, review/, read/, onboarding/, engagement/, import/, stats/)
    core/            # Pure business logic (answer evaluation, import mappers, FSRS)
    data/            # Database access: repositories, hooks, migrations, import clients
    providers/       # React context providers (DatabaseProvider, CurriculumUpdateContext)
    constants/       # Design tokens, theme, semantic colors
    hooks/           # App-level hooks (onboarding redirect, orientation lock)
    utils/           # Pure utilities (cn, color scheme resolution)
    lib/             # Thin wrappers around Expo APIs (safe-updates-metadata)
docs/                # Working docs, design notes, and playtest feedback plans
_bmad-output/        # Historical planning artifacts (PRD, architecture, epics)
```

## Commands

### Curriculum pipeline (repo root)
```bash
npm ci
npm run validate-schema      # validate curriculum JSON against schema
npm run compile-curriculum   # compile to mobile/assets/curriculum-seed/curriculum.db
```
Set `COMPILE_OUTPUT_PATH` to write elsewhere (CI uses `dist/curriculum.db`).

### Mobile app (run from `mobile/`)
```bash
npm install
npm run lint          # expo lint (eslint)
npm run typecheck     # tsc --noEmit
npm test              # jest
npm start             # Expo dev server

npx expo run:ios      # iOS simulator (requires Xcode)
npx expo run:android  # Android emulator (requires Android Studio + SDK)
```

### Run a single test
```bash
# from mobile/
npx jest src/path/to/file.test.ts
npx jest --testPathPattern="itemRepository"
```

## Architecture

### Dual-database design
The app maintains two fully isolated SQLite databases via `expo-sqlite`:
- **`curriculum.db`** — read-only curriculum content (radicals, kanji, vocabulary, grammar, readings, dependency graph). Bundled as an asset and imported on first launch. Can be swapped atomically via OTA manifest update without touching user data.
- **`user.db`** — mutable user state (preferences, study status, SRS states, import metadata, passage practice results). Versioned with numbered migrations in `src/data/migrations/`.

Both handles are initialized in `src/data/database.ts::initializeDatabases()` and distributed via `DatabaseProvider` → `DatabaseContext`. Consumers call `useDatabase()` which throws if called before ready. `curriculum.db` is attached to the `user.db` handle via SQLite `ATTACH DATABASE` (see `database.ts`, `CURRICULUM_ATTACH_ALIAS`) so the review queue builder can join user SRS state against curriculum content in a single query.

### Curriculum OTA updates
`src/data/curriculum/curriculumUpdate.ts` fetches a remote manifest (URL from `EXPO_PUBLIC_CURRICULUM_MANIFEST_URL` or `app.json` extra), compares semver, downloads the new DB to a `.download` staging file, verifies SHA-256, then atomically moves it to replace `curriculum.db`. In `__DEV__`, the bundled mock manifest/fixture under `mobile/assets/curriculum-manifest/` is used.

### Routing (Expo Router)
- `(tabs)/` — bottom-tab shell: Home, Learn, Read, Stats, Settings
- `onboarding/` — linear flow gated by `useOnboardingRedirect` (welcome → intensity → calibrate/bulk → complete, with optional import branch)
- `lesson/` — full-screen auto-planned lesson session, ending in a completion screen that seeds SRS state
- `review/` — full-screen SRS review session
- `OnboardingRedirect` provider reads `user.db` preferences and redirects to the correct onboarding step on every navigation state change.

### Styling (NativeWind v4)
Semantic Tailwind tokens live in `tailwind.config.js`: `bg-background`, `text-primary`, `text-secondary`, `border-border`, `text-feedback-info`, SRS stage colors `srs-apprentice` / `srs-guru` / `srs-master` / `srs-enlightened` / `srs-burned`, content-type accents `content-radical` / `content-kanji` / `content-vocabulary` / `content-grammar`.

Typography: `text-display`, `text-title-lg`, `text-title`, `text-body-lg`, `text-body`, `text-body-sm`, `text-caption`, `text-overline`.
Spacing: `space-xs` (4px) through `space-2xl` (48px). Radii: `radius-sm` / `radius-md` / `radius-lg`.

### Data layer patterns
- Repositories live under `src/data/curriculum/` (curriculum reads) and `src/data/user/` (user writes).
- React hooks under `src/data/hooks/` wrap repositories and manage loading state for UI consumers.
- `src/core/import/` contains pure mappers (WaniKani, Bunpro, Anki) that convert external SRS history to FSRS format. `src/data/import/` contains the network/file-system clients that feed them.

### SRS review engine
Queue builder: `src/core/srs/queueBuilder.ts`, `src/data/hooks/useReviewQueue.ts` — FSRS scheduling, weakness biasing (`0.7 × fsrs + 0.3 × weakness`), content-type interleaving, cognitive-load weighting. Reinforcement: `src/core/content/reinforcementResolver.ts`. Session orchestration: `src/providers/ReviewSessionProvider.tsx`. Answer evaluation: `src/core/answer/`. FSRS grading: `src/core/srs/fsrsScheduler.ts`.

## Testing

Tests live alongside source files (`.test.ts` / `.test.tsx`) and in `mobile/__tests__/`. Expo modules are mocked in `mobile/__mocks__/` — `expo-sqlite`, `expo-file-system`, `expo-network`, `expo-crypto`, `expo-secure-store`, `expo-asset`, `expo-image`, `expo-document-picker`.

## Git LFS

`mobile/assets/curriculum-seed/curriculum.db` is tracked with Git LFS. Run `git lfs install && git lfs pull` after a fresh clone.

## CI policy

- `npm run check-contrast` (repo root) — WCAG 2.1 AA token contrast. Failing pairs block merge unless reclassified as `exempt` in the pairing manifest with a one-line rationale (decorative, disabled, or non-text per WCAG).
- `npm run lint` (`mobile/`) — enforces `eslint-plugin-react-native-a11y` cross-platform (`basic`) rules. Failing rules block merge; suppress only with a one-line rationale comment.
