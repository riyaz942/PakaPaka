---
baseline_commit: 4f4986e8cf45ea5eb8bf3fa93da40d12e293768f
---

# Story 7.2: Visual accessibility (contrast, scaling, reduced motion)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> **Consolidates original stories 7.2, 7.3, and 7.6** — all visual accommodation settings. Second story of Epic 7 (Accessible, inclusive experience). Like 7.1, this is an **audit-and-complete** story: contrast, scaling, and motion foundations were declared in the UX spec and largely satisfied by existing components. This story proves them with automation, closes real gaps (focal-zone scaling overflow, a reduced-motion preference), and locks everything with tests. It does **not** rebuild the design system.

## Story

As a **learner with visual or motion sensitivities**,
I want **WCAG AA contrast, scalable text to 200%, and optional reduced motion**,
so that **the app is comfortable for daily use regardless of visual ability (FR53, FR54, NFR14, NFR16, UX-DR30)**.

## Acceptance Criteria

**AC1 — Token contrast is automatically verified (FR53, NFR14, UX-DR2)**
**Given** the color token pairs declared in `tailwind.config.js` / `src/global.css` (dark and light palettes)
**When** an automated contrast check runs as a repeatable script (`npm run` command) or CI step
**Then** every declared text-on-background pairing meets WCAG 2.1 AA — normal text ≥ 4.5:1, large text ≥ 3:1 — including cognitive-load **ring band** color states
**And** any pairing that cannot meet AA is either fixed or explicitly classified as exempt (decorative / disabled / non-text per WCAG), with the team policy documented in-repo (a failing pair blocks merge or is tracked as a defect with a fix path).

**AC2 — Layouts survive 200% text scaling without hiding the primary action (FR54, NFR16, UX spec §Text Scaling)**
**Given** OS text size increased toward 200% (iOS Dynamic Type / Android font scale)
**When** I open the Home and review layouts
**Then** focal/content zones grow and scroll as needed so content is never permanently clipped, and the review **submit/Continue control stays reachable and visible** (the bottom input zone is not pushed off-screen)
**And** Japanese prompt text (48px `display` base → 96px at 200%) scales per the typography tokens and remains legible on the smallest supported phone (320px) without overlapping adjacent text.

**AC3 — Reduced motion is honored and the review loop stays animation-free (NFR5b, UX-DR30)**
**Given** the OS "Reduce Motion" setting is enabled **or** an in-app reduced-motion toggle is on
**When** the cognitive-load ring updates and when the review loop advances between items
**Then** the ring reflects load via stepped/static state changes (no continuous or pulsing animation), and the review loop performs **no inter-item animations**
**And** the in-app reduced-motion preference persists across launches and is exposed in Settings (UX-DR30 "optional disable in accessibility settings"), defaulting to follow the system setting.

## Tasks / Subtasks

- [x] **Task 1 — Token contrast validation script** (AC: 1)
  - [x] Add a pure Node/TS script (no React Native imports) that computes WCAG 2.1 relative-luminance contrast ratios. Place it under the **repo-root `scripts/`** directory alongside the existing curriculum tooling (`scripts/validate-schema.ts`, `scripts/compile-curriculum.ts`) — this is the established home for repo tooling with its own `tsx`/ts-node run pattern and Jest tests. Name it `scripts/check-contrast.ts` with a co-located `scripts/check-contrast.test.ts`.
  - [x] Source the token hex values from a single source of truth. The literal palette lives in `mobile/src/global.css` (`--color-*` for dark **and** the `prefers-color-scheme: light` block) and `mobile/tailwind.config.js` (SRS / feedback / **ring** / content / reinforcement hexes). Read/parse these (or import a shared constant) rather than hard-coding a third copy that can drift.
  - [x] Define the **pairing manifest**: for each foreground token, the background(s) it renders on, and its classification: `normal-text` (≥4.5:1), `large-text` (≥3:1, i.e. ≥18px regular or ≥14px bold), or `exempt` (decorative border, disabled state, non-text). Seed it from the UX spec's validated pairs (ux-design-specification.md lines 658–664) and extend to cover ring band text colors (`ring-start/mid/end/complete`) on `background` and `surface`, feedback colors, SRS stage pills, and the light-theme surfaces/text.
  - [x] The script exits non-zero and prints each failing pair as `fg #hex on bg #hex = X.X:1 (needs Y:1, class)` so the rule name is actionable.
  - [x] Add an `npm run check-contrast` script to the **root** `package.json` (the curriculum-tooling package), matching the `validate-schema` / `compile-curriculum` invocation style.
  - [x] **Fix any failing pair** found in the existing palette, OR record it as `exempt` with a one-line rationale in the manifest. Known watch-points to verify, not assume: light-theme `muted` (#9898a8) on `surface` (#ffffff) is low-contrast — confirm it is only used for disabled/decorative text (exempt) and not for meaningful body copy; `feedback-incorrect` (#ee4466) on `surface` (#141420) sits near the 4.5:1 line (UX spec lists ~5.0:1) — let the computed number decide.
  - [x] Document the team policy in-repo (short section in `CLAUDE.md` under CI, or a `docs/`/`scripts/` note): contrast failures block merge unless reclassified as `exempt` with rationale. Wiring the script into the GitHub Actions workflow is acceptable here but the broader component-level a11y lint step (`react-native-a11y`/Axe) belongs to **Story 7.3** — do not build that here.

- [x] **Task 2 — Audit and fix 200% text scaling** (AC: 2)
  - [x] Verify Home (`src/app/(tabs)/index.tsx`) already tolerates 200% — it wraps content in a `ScrollView` (line 86), so scaled text scrolls. Confirm no fixed-height container clips the ring/buttons/streak; fix any that do.
  - [x] **Review focal zone is the real gap.** In `src/app/review/index.tsx` the prompt renders inside `<View className="flex-1 justify-center px-space-md">` (line 333) with **no internal scroll**. At 200%, long grammar/cloze prompts (`ReviewCard`) can overflow vertically and clip. Make the focal zone scrollable when content exceeds available height (e.g. wrap `ReviewCard` in a `ScrollView` with `contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}`) while keeping the bottom input/Continue zone (the separate `KeyboardAvoidingView`, lines 343–368) fixed and visible. Preserve the existing layout for normal scale (centered focal, full-width input) and the `<100ms` review path — a `ScrollView` wrapper is layout-only, no per-item animation.
  - [x] Do **not** cap font scaling: leave `allowFontScaling` at its default `true` on Japanese prompt and answer text. If any component currently sets `allowFontScaling={false}` or a tight `maxFontSizeMultiplier` in the in-scope flows, justify or remove it.
  - [x] Sanity-check the smallest phone (320px) at 200% for the focal kanji (`display` 48→96px): it must not overlap the type indicator / reading-vs-meaning label (UX-DR34). Record the manual verification in the Dev Agent Record (simulator Dynamic Type / font scale); no device farm required.

- [x] **Task 3 — Reduced-motion preference + honoring** (AC: 3)
  - [x] Add a `reducedMotion` preference following the **exact existing pattern** in `src/data/user/preferencesRepository.ts`: add a key to `PREFERENCE_KEYS`, and `getReducedMotionEnabled` / `setReducedMotionEnabled` getter/setter (mirror `getWeaknessBiasEnabled` / `setWeaknessBiasEnabled`, lines 131–138; values stored as `'true'`/`'false'`). **No new migration** is required — `user_preferences` is a generic key/value table; new keys need no schema change (confirm against the migrations the same way prior preference stories did).
  - [x] Add a hook `useReducedMotion()` under `src/data/hooks/` that returns the **effective** value = in-app toggle OR system `AccessibilityInfo.isReduceMotionEnabled()`. Subscribe to the `reduceMotionChanged` event so system changes propagate (mirror the listener pattern used for screen-reader detection in 7.1's `accessibilityFocus` work). Default the in-app preference to "follow system" (unset → fall back to the live system value).
  - [x] Add a **"Reduce motion"** `Switch` row to `src/app/(tabs)/settings.tsx` under an "Accessibility" or "Display" section, matching the existing toggle rows (label + helper text + `Switch` with `accessibilityLabel`, lines 133–168). Persist via the new setter.
  - [x] **Honor it where motion exists.** Today the `CognitiveLoadRing` (`src/components/engagement/CognitiveLoadRing.tsx`) is already a **static** border + numeric percent (no animation) and the review loop already has **no inter-item animations** (NFR5b satisfied in Epic 5). So this AC is largely *verify + lock + plumb*: do not introduce animation to satisfy a reduced-motion toggle. If you add any ring fill transition, gate it behind `useReducedMotion()` so it renders stepped/static when reduced. Document that the ring and review loop already meet the stepped/static requirement.

- [x] **Task 4 — Tests** (AC: 1, 2, 3)
  - [x] `scripts/check-contrast.test.ts`: unit-test the contrast-ratio math against known WCAG reference values (e.g. #FFFFFF on #000000 = 21:1; a mid pair), assert the manifest is fully covered (every declared token classified), and assert the script fails on a deliberately-failing synthetic pair and passes on the real palette.
  - [x] Review screen / `ReviewCard`: assert the focal zone is scrollable (query the scroll container) so 200%-scaled content is not clipped, and that the bottom input/Continue zone remains rendered (not unmounted) — extend `src/app/review/index.test.tsx` / `ReviewCard.test.tsx` rather than adding a new file. Do not assert pixel heights; assert structure.
  - [x] `preferencesRepository.test.ts`: cover `getReducedMotionEnabled` / `setReducedMotionEnabled` round-trip and the unset→default behavior (mirror the weakness-bias tests).
  - [x] `useReducedMotion` test: mock `AccessibilityInfo.isReduceMotionEnabled` + `addEventListener('reduceMotionChanged')`; assert effective value reflects system when toggle unset, and the toggle override when set.
  - [x] Settings test (`src/app/(tabs)/index.test.tsx` is for Home; settings has no test yet — add `src/app/(tabs)/settings.test.tsx` only if it can follow existing app-route test conventions cleanly, otherwise assert the toggle via a component-level test): the Reduce-motion `Switch` renders with its `accessibilityLabel` and persists on toggle.
  - [x] Run `npm run check-contrast` (root) and, from `mobile/`, `npm run lint`, `npm run typecheck`, `npm test` — all green.

### Review Findings

- [x] [Review][Patch] Reduced-motion effective value does not honor OR semantics in AC3 [mobile/src/data/hooks/useReducedMotion.ts]
- [x] [Review][Patch] Contrast manifest does not include required cognitive-load ring state token checks from AC1 [scripts/check-contrast.ts]
- [x] [Review][Patch] Exempt contrast entries are not validated to include required one-line rationale [scripts/check-contrast.ts]

## Dev Notes

### Scope discipline — audit, automate, and close real gaps (not a redesign)

The visual-accessibility *foundations* already exist and are documented as validated in the UX spec (color contrast table, color-independent communication, 44px touch targets, 200% scaling intent, "zero animations in review loop"; ux-design-specification.md lines 656–688, 1259–1266). 7.1 already shipped screen-reader/keyboard/input a11y. This story's genuine, currently-missing deliverables are:

1. **Automated, repeatable contrast verification** of the token palette (AC1) — today contrast is asserted in prose only; there is no script. This is the headline new artifact.
2. **Review focal-zone scaling fix** (AC2) — the one concrete layout gap: the centered focal `View` has no internal scroll and can clip very large text.
3. **A reduced-motion preference + Settings toggle + effective-value hook** (AC3) — UX-DR30 calls for an "optional disable in accessibility settings"; the plumbing doesn't exist yet. The ring/loop already meet the stepped/static requirement, so this is mostly establishing the preference and locking the no-animation invariant.

Everything else is **verify + regression-test**. Do not churn token values, re-add a11y props that exist, or animate things that are currently static.

### Current state of files being touched (read before editing)

- **`mobile/tailwind.config.js`** — token source of truth for SRS / feedback / **ring** / content / reinforcement hexes (literal). Surface/text tokens are CSS-variable references (`var(--color-*)`). `darkMode: 'media'` — palette switches via `prefers-color-scheme`, so **both** dark and light pairs must be checked.
- **`mobile/src/global.css`** — the literal `--color-*` values for **dark** (`:root`) and **light** (`@media (prefers-color-scheme: light)`). This is where the surface/text hexes the contrast script must read actually live. Dark: bg `#0a0a0f`, surface `#141420`, primary `#eeeef0`, secondary `#9898a8`, muted `#5c5c6e`. Light: bg `#f8f8fa`, surface `#ffffff`, primary `#1a1a2e`, secondary `#686878`, muted `#9898a8`.
- **`mobile/src/components/engagement/CognitiveLoadRing.tsx`** — `ringBandClasses(percent)` maps load to a band color (`ring-start` <40, `ring-mid` 40–69, `ring-end` 70–89, `ring-complete` ≥90) applied to **border + percent text**. Static, no animation, `accessibilityRole="progressbar"` + `accessibilityValue` already present. The band **text** colors are the ones the contrast script must validate as small text. Used on Home (`variant="large"`, line 88) and in `SessionHeader` (`variant="small"`). Leave its behavior as-is unless contrast fails.
- **`mobile/src/app/review/index.tsx`** — review state machine (see 7.1 notes). Focal zone: `<View className="flex-1 justify-center px-space-md">` wrapping `ReviewCard` (line 333) — **no scroll, the AC2 fix target.** Bottom zone: `KeyboardAvoidingView` (lines 343–368) holds the `WanaKanaInput` or incorrect-state `Continue` Button — must stay visible at 200%. Preserve the 7.1 focus-management, submit-guard, auto-advance, and exit-interception logic untouched.
- **`mobile/src/app/(tabs)/index.tsx` (Home)** — already wraps content in `ScrollView` (line 86); largely scale-safe. Audit for any fixed heights.
- **`mobile/src/app/(tabs)/settings.tsx`** — existing toggle rows for weakness-bias and notifications using `Switch` with `accessibilityLabel` + helper `Text` (lines 133–168). Add the Reduce-motion toggle in the same idiom. Note the screen is plain `View` (not a `ScrollView`) — if adding the row pushes content past the viewport at large scale, wrap in a `ScrollView` (consistent with Home).
- **`mobile/src/data/user/preferencesRepository.ts`** — generic `getPreference`/`setPreference` over the `user_preferences` key/value table, plus typed accessors. `PREFERENCE_KEYS` map (lines 12–23). Boolean prefs stored as `'true'`/`'false'` (see `weaknessBiasEnabled`, lines 131–138). **Add `reducedMotion` here** — no migration needed for a new key.

### Key API guidance (React Native 0.83.6 / React 19.2 / Expo SDK 55)

- **WCAG contrast math** (pure, no deps): linearize each sRGB channel — `c/255`, then `c ≤ 0.03928 ? c/12.92 : ((c+0.055)/1.055)**2.4`; relative luminance `L = 0.2126R + 0.7152G + 0.0722B`; ratio `(Lmax + 0.05) / (Lmin + 0.05)`. Thresholds: 4.5:1 normal, 3:1 large (≥18px regular or ≥14px bold) and for non-text UI components (WCAG 1.4.11). Keep this in `scripts/` so it never imports React Native (the root `scripts/` package has its own tsconfig/jest — follow `validate-schema.ts`).
- **Reduced motion**: `AccessibilityInfo.isReduceMotionEnabled(): Promise<boolean>` and `AccessibilityInfo.addEventListener('reduceMotionChanged', cb)` (returns a subscription with `.remove()`). Gate the hook behind it; cache the value in state and update on event. Mirror the 7.1 screen-reader detection idiom (`AccessibilityInfo.isScreenReaderEnabled` + `screenReaderChanged`).
- **Text scaling**: RN `<Text>` scales with OS settings by default (`allowFontScaling` defaults `true`). Do **not** set `maxFontSizeMultiplier` on prompt/answer text. For overflow, prefer making the container scrollable over shrinking text. `ScrollView` `contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}` keeps content centered when short and scrolls when tall.
- **Testing (RNTL 13.3.3)**: query the focal `ScrollView` by `testID`; assert children render. Mock `AccessibilityInfo` via `jest.spyOn(require('react-native').AccessibilityInfo, ...)` per existing conventions. The contrast script test is a plain Jest unit test under root `scripts/` (see `scripts/validate-schema.test.ts` for the root-package Jest setup).

### Out of scope (sibling stories / deferred — do not pull in)

- **Component-level a11y linting in CI** (`react-native-a11y` / Axe step on representative screens) → **Story 7.3**. AC1 here is satisfied by the **token-contrast script + policy doc**; wiring that one script into Actions is fine, but the broader Axe/lint pipeline is 7.3.
- **Screen-reader / keyboard / focus management / converted-kana input** → shipped in **Story 7.1**; do not revisit.
- **A global 44×44 touch-target sweep** — 7.1 deferred "no `min-h-[44px]` on `ProgressiveHint` Pressable and other non-Button controls" and suggested a dedicated pass. Touch-target *sizing* is not in this story's ACs (contrast/scaling/motion). If a contrast or scaling fix happens to touch one of those controls, you may add `min-h-[44px]` opportunistically, but a project-wide target audit stays deferred.
- **High-contrast theme toggle** — UX spec calls it "trivial to add later via token system" (line 1266) but it is **not** in these ACs. Do not build a second theme.
- Read / Stats / onboarding deep audits beyond Home + review (the ACs scope to Home and review layouts). They inherit the same tokens, so the contrast script covers them globally; layout-scale checks focus on Home + review.

### Project Structure Notes

- **Two packages**: the contrast script + its test live in the **repo-root** tooling package (`scripts/`, root `package.json`, root tsconfig/jest) next to curriculum tooling. All app code (settings toggle, preference, hook, review fix, RN component tests) lives in **`mobile/`**. Keep the contrast script free of any `mobile/`/React Native import.
- Tests are **co-located** (`Foo.tsx` → `Foo.test.tsx`) per architecture (architecture.md lines 409, 434, 620); no `__tests__/` dirs for new tests.
- Styling stays in semantic NativeWind tokens (CLAUDE.md / UX-DR2). The contrast script reads token values; it must not introduce raw hex into components.
- `Result<T, AppError>` is the fallible-op contract, but preference getters/setters here follow the existing synchronous `preferencesRepository` style (they don't return `Result` — match the file).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.2 (lines 986–1009)] — user story + ACs (consolidates 7.2 + 7.3 + 7.6).
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR (UX-DR2 line 203 tokens, UX-DR30 line 235 motion/reduced-motion, UX-DR31 line 236 touch targets)].
- [Source: _bmad-output/planning-artifacts/prd.md#Accessibility (FR53 contrast incl. ring, FR54 scalable text, NFR14 contrast, NFR16 text scaling)].
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Accessibility Considerations (lines 656–688)] — validated contrast pairs, color-independent communication, touch targets, text scaling, motion.
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Accessibility Strategy (lines 1259–1266)] — 200% scaling within `KeyboardAvoidingView`, contrast ratios, "high contrast toggle trivial to add later".
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Testing Strategy (lines 1283–1290)] — contrast token validation + 200% scaling test cadence.
- [Source: _bmad-output/implementation-artifacts/7-1-screen-reader-keyboard-and-input-accessibility.md] — prior Epic 7 patterns: `AccessibilityInfo` listener idiom, review-loop file map, NFR5b "no inter-item animations" already satisfied; touch-target sweep deferred to 7.2/dedicated pass.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md (7.1 entry, lines 92–97)] — `min-h-[44px]` sizing deferral note.
- [Source: scripts/validate-schema.ts, scripts/compile-curriculum.ts] — root tooling package conventions for a new `check-contrast.ts` + npm script + co-located Jest test.
- [Source: CLAUDE.md] — dual-DB, NativeWind semantic tokens, curriculum pipeline commands, CI workflows; place contrast policy under CI section.

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

### Completion Notes List

- Added `scripts/check-contrast.ts` with WCAG 2.1 luminance math, a 54-pair manifest (dark + light), and parsing of `mobile/src/global.css` as the single hex source of truth. Moved accent tokens into CSS variables with light-theme overrides; ring percent text now uses `text-primary` for AA contrast. Policy documented in `CLAUDE.md`; CI runs `npm run check-contrast`.
- Review focal zone wrapped in `ScrollView` (`testID="review-focal-scroll"`) so 200% prompts scroll while the input/Continue `KeyboardAvoidingView` stays fixed. Home already used `ScrollView`; no `allowFontScaling={false}` in scope. Settings wrapped in `ScrollView` for large-scale safety.
- Added `reducedMotion` preference (`null` = follow system), `useReducedMotion()` hook with `reduceMotionChanged` listener, and Settings Accessibility toggle. Verified `CognitiveLoadRing` and review loop remain static (no animations to gate).
- Manual 200% check (320pt width, iOS Dynamic Type XXLarge): focal kanji scales in scrollable area; mode label and prompt stack vertically without overlap; submit zone remains visible.
- Tests: root `check-contrast.test.ts`; mobile `preferencesRepository`, `useReducedMotion`, `settings`, `review/index` extensions. All green: root jest (10), mobile lint/typecheck/jest (649).

### File List

- `.github/workflows/ci.yml`
- `CLAUDE.md`
- `package.json`
- `scripts/check-contrast.ts`
- `scripts/check-contrast.test.ts`
- `mobile/src/global.css`
- `mobile/tailwind.config.js`
- `mobile/src/components/engagement/CognitiveLoadRing.tsx`
- `mobile/src/app/review/index.tsx`
- `mobile/src/app/review/index.test.tsx`
- `mobile/src/app/(tabs)/settings.tsx`
- `mobile/src/app/(tabs)/settings.test.tsx`
- `mobile/src/data/user/preferencesRepository.ts`
- `mobile/src/data/user/preferencesRepository.test.ts`
- `mobile/src/data/hooks/useReducedMotion.ts`
- `mobile/src/data/hooks/useReducedMotion.test.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-06-30: Story 7.2 — automated token contrast validation, light-theme palette fixes, review focal scroll for 200% scaling, reduced-motion preference + Settings toggle, regression tests, CI wiring.
