# Story 1.2: NativeWind design tokens and global styling

Status: review

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a **learner**,
I want **consistent NativeWind/Tailwind tokens for colors, type, spacing, and radius**,
So that **later screens match the UX spec without ad-hoc styles (UX-DR1–UX-DR3)**.

## Acceptance Criteria

1. **NativeWind pipeline (UX-DR1)**

   **Given** the `mobile/` Expo SDK 55 app from Story 1.1  
   **When** dependencies and bundler config are added per architecture versions  
   **Then** `nativewind` and `tailwindcss` (dev) are installed and Metro/Babel are configured so utility `className` on React Native primitives compiles without red screen  
   **And** a CSS entry file contains Tailwind directives (`@tailwind base;` / `components` / `utilities`) and is imported exactly once from the **root** Expo Router layout (`mobile/src/app/_layout.tsx`) so the review hot path does not pay duplicate CSS import cost  

2. **Design tokens in `tailwind.config.js` (epics + UX-DR2)**

   **Given** `mobile/tailwind.config.js` extends `nativewind/preset`  
   **When** developers inspect the theme extension  
   **Then** the following semantic groups exist as **Tailwind colors** using the `colors.<token>` naming scheme so consumer classes read cleanly (e.g. `bg-background`, `text-primary`, `bg-srs-apprentice` — no double-prefix like `text-text-primary`):

   **Surfaces (dark-first defaults / `light:` overrides):**

   | Token | Dark hex | Light hex |
   | --- | --- | --- |
   | `background` | `#0A0A0F` | `#F8F8FA` |
   | `surface` | `#141420` | `#FFFFFF` |
   | `surface-elevated` | `#1E1E2E` | `#F0F0F4` |
   | `surface-hover` | `#252538` | `#E8E8EE` |
   | `border` | `#2A2A3C` | `#D8D8E0` |

   **Text (dark-first defaults / `light:` overrides):**

   | Token | Dark hex | Light hex |
   | --- | --- | --- |
   | `primary` | `#EEEEF0` | `#1A1A2E` |
   | `secondary` | `#9898A8` | `#686878` |
   | `muted` | `#5C5C6E` | `#9898A8` |

   **SRS stages (shared across themes):**

   | Token | Hex |
   | --- | --- |
   | `srs-apprentice` | `#DD4488` |
   | `srs-guru` | `#8844CC` |
   | `srs-master` | `#3388DD` |
   | `srs-enlightened` | `#00AADD` |
   | `srs-burned` | `#CCAA00` |

   **Feedback (shared across themes):**

   | Token | Hex |
   | --- | --- |
   | `feedback-correct` | `#22CC88` |
   | `feedback-incorrect` | `#EE4466` |
   | `feedback-warning` | `#EEAA22` |
   | `feedback-info` | `#4488EE` |

   **Cognitive load ring gradient stops (shared):**

   | Token | Hex | Range |
   | --- | --- | --- |
   | `ring-start` | `#22CC88` | 0–40% (green, fresh capacity) |
   | `ring-mid` | `#EECC44` | 40–70% (yellow, building) |
   | `ring-end` | `#EE8833` | 70–90% (orange, approaching threshold) |
   | `ring-complete` | `#44BBEE` | 90–100% (cyan glow, goal reached) |

   **Content-type accents (shared):**

   | Token | Hex |
   | --- | --- |
   | `content-radical` | `#44AAEE` |
   | `content-kanji` | `#EE4488` |
   | `content-vocabulary` | `#AA44DD` |
   | `content-grammar` | `#22BBAA` |
   | `content-reading` | `#EEAA22` |

   **Reinforcement (shared):**

   | Token | Hex |
   | --- | --- |
   | `reinforcement-text` | `#6688BB` |
   | `reinforcement-bg` | `#1A2233` |

   **And** no production UI introduces **raw hex/rgb** in `className` or inline `style={{ color: '...' }}` for these concerns — tokens only ([Source: `_bmad-output/planning-artifacts/architecture.md` — NativeWind / Tailwind Conventions, Enforcement Guidelines])  

3. **Typography, spacing, radius (UX-DR3)**

   **Given** the UX typography scale  
   **When** components use spacing and type utilities  
   **Then** `tailwind.config.js` defines **fontSize** entries (each as `[size, { lineHeight, fontWeight }]`):

   | Token | Size | Weight | Line height |
   | --- | --- | --- | --- |
   | `display` | 48px | 700 | 1.1 |
   | `title-lg` | 28px | 700 | 1.2 |
   | `title` | 22px | 600 | 1.3 |
   | `body-lg` | 18px | 400 | 1.5 |
   | `body` | 16px | 400 | 1.5 |
   | `body-sm` | 14px | 400 | 1.4 |
   | `caption` | 12px | 500 | 1.3 |
   | `overline` | 11px | 600 | 1.2 |

   **And** spacing scale tokens exist as extended `spacing` keys (base unit 4px):

   | Token | Value |
   | --- | --- |
   | `space-xs` | 4px |
   | `space-sm` | 8px |
   | `space-md` | 16px |
   | `space-lg` | 24px |
   | `space-xl` | 32px |
   | `space-2xl` | 48px |

   **And** radius tokens exist via `borderRadius` extension:

   | Token | Value |
   | --- | --- |
   | `radius-sm` | 6px |
   | `radius-md` | 12px |
   | `radius-lg` | 20px |
   | `radius-full` | 9999px |  

4. **Light/dark behavior**

   **Given** the device or web color scheme toggles  
   **When** screens use semantic token utilities for backgrounds and text  
   **Then** colors track **dark-first** architecture: default utilities resolve to dark palette, with `light:` variants for light mode ([Source: `_bmad-output/planning-artifacts/architecture.md` — Dark mode row])  
   **And** integration with the existing `useColorScheme` / navigation theme is **defined and implemented** (e.g. root `View` + `className`, or NativeWind color scheme API) so toggling does not leave stale colors  

5. **Regression / cleanup**

   **Given** template code under `mobile/src/constants/theme.ts`, `themed-text.tsx`, `themed-view.tsx`, and hooks still use hex and `StyleSheet`-style patterns  
   **When** this story completes  
   **Then** the following cleanup is applied:  
   - Remove `import '@/global.css'` from `theme.ts` (the single import lives in `_layout.tsx` now)  
   - Add a deprecation comment to the `Colors` object in `theme.ts` pointing to Tailwind tokens as source of truth (e.g. `/** @deprecated Use NativeWind tokens from tailwind.config.js — bg-background, text-primary, etc. */`)  
   - Keep `Fonts`, `Spacing`, `BottomTabInset`, `MaxContentWidth` exports temporarily — later stories will consume these via tokens  
   - Do NOT delete `ThemedText`, `ThemedView`, or `Colors` yet — other template code still imports them; full migration is a future story concern  
   **And** `npm run lint`, `npm run typecheck`, and `npm test` pass in `mobile/` the same way CI runs them  

## Tasks / Subtasks

- [x] **AC1 — Install & wire NativeWind**
  - [x] Add `nativewind@^4.1.23` and `tailwindcss@^3.4.17` (architecture-pinned; verify lockfile) plus any peer deps the official [NativeWind Expo setup](https://www.nativewind.dev/) requires for v4.
  - [x] Add `mobile/babel.config.js` (or extend existing) with `nativewind/babel` per current docs.
  - [x] Add `mobile/metro.config.js` using `withNativeWind` from `nativewind/metro`; set `input` to the CSS file path you standardize on (`./src/global.css` recommended to match existing file).
  - [x] Replace contents of `mobile/src/global.css` with Tailwind directives; add any `:root` font variables to `@layer base` or keep separate web font rules without breaking RN.
  - [x] Import global CSS from `mobile/src/app/_layout.tsx` once; remove redundant import from `theme.ts` if still present.

- [x] **AC2–AC3 — `tailwind.config.js`**
  - [x] `content` globs cover `./src/**/*.{ts,tsx}` (and other roots if needed).
  - [x] Implement all token groups listed in AC2 and AC3; comment each group with `// UX-DR2` / `// UX-DR3` for traceability.
  - [x] Add `nativewind/preset` to `presets`.
  - [x] Create `mobile/src/utils/cn.ts` — export `cn(...inputs)` wrapping `clsx` + `twMerge` per architecture component pattern. Install `clsx` and `tailwind-merge`.
  - [x] Create `mobile/nativewind-env.d.ts` — reference triple-slash directive for NativeWind `className` augmentation.

- [x] **AC4 — Color scheme**
  - [x] Set `darkMode: 'media'` in `tailwind.config.js` — follows system color scheme automatically via `useColorScheme`. Dark is the default; use `light:` prefix for light overrides (architecture: "Dark-first — base classes are dark theme, `light:` prefix for light theme").
  - [x] Ensure first-run screens (index / tabs shell) use token classes for background + text on at least one screen to prove toggling works.

- [x] **AC5 — Template cleanup**
  - [x] Remove `import '@/global.css'` from `theme.ts` (single import now in `_layout.tsx`).
  - [x] Add `@deprecated` JSDoc comment to the `Colors` object pointing to Tailwind tokens.
  - [x] Keep `Fonts`, `Spacing`, `BottomTabInset`, `MaxContentWidth` exports untouched for now.
  - [x] Run `npm run lint`, `npm run typecheck`, `npm test` locally; fix any ESLint/TypeScript issues from `className` typings.

## Dev Notes

### Epic context (Epic 1)

Epic 1 builds the installable shell: dual SQLite (1.3), tabs (1.4), curriculum pipeline, OTA. **This story owns styling foundation only** — no SQLite, no curriculum compile, no new routes beyond what is needed to validate tokens.

### Technical requirements (must follow)

- **Monorepo path:** All new/modified config lives under **`mobile/`** (Story 1.1 established the app root). Architecture diagrams showing repo-root `tailwind.config.js` apply **logically**; physical paths are `mobile/tailwind.config.js`, `mobile/metro.config.js`, etc.
- **Token-only UI rule:** Architecture enforcement #6: always NativeWind tokens — no raw colors, no inline `style={{}}` for layout/color typography ([Source: `_bmad-output/planning-artifacts/architecture.md` — Enforcement Guidelines, anti-pattern table]).
- **Class ordering:** Layout → Sizing → Spacing → Typography → Color → Effects ([Source: same — NativeWind / Tailwind Conventions]).
- **Named exports:** Prefer named exports for new components; Expo Router route files may remain default export where the framework requires ([Source: Story 1.1 dev notes — template exception]).
- **Performance (UX-DR1):** Prefer compile-time Tailwind/NativeWind; avoid dynamic style generation on every keystroke in future review work — this story should not introduce runtime style objects in hot paths.

### Architecture compliance

- Align with **Implementation Sequence** step after bootstrap: NativeWind + tokens before heavy UI ([Source: `_bmad-output/planning-artifacts/architecture.md` — Project init bullet, directory structure around `tailwind.config.js`, `global.css`, `babel.config.js`, `metro.config.js`]).
- **`global.css` path:** Architecture diagram shows `global.css` at the mobile app root, but Story 1.1 established it at `mobile/src/global.css` and `theme.ts` already imports from `@/global.css`. Keep the `src/global.css` location — this is a deliberate deviation from the architecture diagram to match existing code and import alias.
- **`cn.ts` utility:** Architecture defines `src/utils/cn.ts` (clsx + tailwind-merge). Create this file in 1.2 since AC4 requires applying conditional token classes to prove toggling works, and the architecture component pattern uses `cn()`. Install `clsx` and `tailwind-merge` as dependencies.
- **Default exports in route files:** `_layout.tsx` uses `export default` — this is required by Expo Router. Do NOT convert to named export.

### Library / framework requirements

| Package | Version guidance | Notes |
| --- | --- | --- |
| `nativewind` | ^4.1.23 | Architecture validation table |
| `tailwindcss` | ^3.4.17 | Required NativeWind v4 peer |
| `clsx` | latest | Conditional className construction (used by `cn.ts`) |
| `tailwind-merge` | latest | Deduplicates conflicting Tailwind classes (used by `cn.ts`) |
| `expo` / `react-native` | Already pinned in Story 1.1 | Do not downgrade SDK 55 |

### File structure requirements

| Path | Action |
| --- | --- |
| `mobile/tailwind.config.js` | Create — token source of truth |
| `mobile/babel.config.js` | Create — NativeWind Babel |
| `mobile/metro.config.js` | Create — `withNativeWind` |
| `mobile/src/global.css` | Update — Tailwind directives |
| `mobile/src/app/_layout.tsx` | Update — import `global.css`; root wrapper for scheme if needed |
| `mobile/src/constants/theme.ts` | Refactor — remove CSS import, deprecate `Colors` with JSDoc |
| `mobile/nativewind-env.d.ts` | Create — required for TypeScript `className` module augmentation on RN primitives |
| `mobile/src/utils/cn.ts` | Create — `clsx` + `tailwind-merge` wrapper per architecture pattern |

### Testing requirements

- **Automated:** Existing Jest smoke tests must pass; add a **small** test only if valuable (e.g. pure token map snapshot) — do not block on RNTL for this story unless already set up.
- **Manual:** Launch app (Android per team norm); toggle system light/dark; confirm background/text tokens switch; no Metro “cannot find module” for CSS.

### Previous story intelligence (Story 1.1)

- App lives in **`mobile/`**; CI runs from repo root workflow targeting `mobile/`.
- **`readUpdatesRuntimeMetadata`** and Expo Updates wiring must keep working after layout edits.
- Template **`ThemedText` / `ThemedView` / `Colors`** are Expo defaults — expect migration touchpoints; do not delete tabs shell behavior.
- **`theme.ts` currently imports `@/global.css`** but file lacked full Tailwind stack — this story resolves that inconsistency.
- Maintainer verified **Android** native run; iOS still documented for others.

### Git intelligence summary

Recent commits established Expo SDK 55 baseline, CI, OTA hooks, and `safe-updates-metadata`. This story is the first styling-focused change: expect `package.json`, `package-lock.json`, layout, and theme files in the diff.

### Latest technical information

- NativeWind **v4.1.x** remains the architecture-approved line; **v5** is a different major line (Tailwind v4) — **do not adopt v5** unless architecture is explicitly updated ([NativeWind v5 migration note](https://www.nativewind.dev/v5/guides/migrate-from-v4)).
- Official platform guide: [NativeWind — Expo](https://www.nativewind.dev/) — use `withNativeWind`, `nativewind/babel`, and `presets: [require("nativewind/preset")]`.
- Metro `input` must point at the same file you import in JS (typically `./src/global.css`).

### Project context reference

No `project-context.md` in repo — use this story + `_bmad-output/planning-artifacts/architecture.md` + `epics.md` + `ux-design-specification.md`.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.2]
- [Source: `_bmad-output/planning-artifacts/epics.md` — UX Design Requirements UX-DR1, UX-DR2, UX-DR3]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Starter stack table, NativeWind conventions, Enforcement Guidelines, Project Structure]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Visual Design: NativeWind, dark-first palette, token philosophy]
- [Source: `_bmad-output/implementation-artifacts/1-1-bootstrap-expo-sdk-55-app-with-ci-and-ota-hooks.md`]

## Dev Agent Record

### Agent Model Used

Composer (Cursor)

### Debug Log References

- Jest failed until `nativewind/babel` was moved from `plugins` to `presets` (it returns a preset-shaped config via `react-native-css-interop/babel`).

### Completion Notes List

- Wired NativeWind v4 (`babel-preset-expo` + `nativewind/babel` preset, `withNativeWind` Metro, `tailwind.config.js` with `nativewind/preset`, semantic tokens UX-DR2/UX-DR3).
- Dark-first surfaces/text use CSS custom properties in `global.css` with `@media (prefers-color-scheme: light)`; Tailwind `light:` variant plugin added for future conditional utilities.
- Single `import '@/global.css'` from `src/app/_layout.tsx`; root `View` uses `bg-background`. Home and Explore use token `className`s for primary backgrounds/text where specified.
- Added `cn` helper (`clsx` + `tailwind-merge`) and Jest coverage for merge behavior.
- Deprecated `Colors` in `theme.ts` with JSDoc; aligned legacy palette to UX hex for `Themed*` / tabs until full migration.

### File List

- `mobile/package.json`
- `mobile/package-lock.json`
- `mobile/babel.config.js`
- `mobile/metro.config.js`
- `mobile/tailwind.config.js`
- `mobile/nativewind-env.d.ts`
- `mobile/tsconfig.json`
- `mobile/src/global.css`
- `mobile/src/app/_layout.tsx`
- `mobile/src/app/index.tsx`
- `mobile/src/app/explore.tsx`
- `mobile/src/constants/theme.ts`
- `mobile/src/components/themed-text.tsx`
- `mobile/src/utils/cn.ts`
- `mobile/src/utils/cn.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/1-2-nativewind-design-tokens-and-global-styling.md`

## Change Log

- **2026-05-17:** Story created via `create-story` workflow — status **ready-for-dev**.
- **2026-05-18:** Implemented NativeWind pipeline, design tokens, `cn`, layout/CSS import cleanup, tests — status **review**.
