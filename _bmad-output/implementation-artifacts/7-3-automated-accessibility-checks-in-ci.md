---
baseline_commit: 5fcb1da
---

# Story 7.3: Automated accessibility checks in CI

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> **Final story of Epic 7** — component-level a11y linting in the CI pipeline. Stories 7.1 (screen reader / keyboard) and 7.2 (contrast, scaling, motion) already baked accessibility *behavior* into components. This story wires **static JSX-level a11y linting** (`eslint-plugin-react-native-a11y`) into `npm run lint` and adds **focused runtime a11y assertions** for representative screens using existing RNTL infrastructure. Both paths already run in CI; no new CI job is required. Scope is tooling + test coverage, not a redesign of any component.

## Story

As a **maintainer**,
I want **CI to run basic accessibility linting on components**,
so that **regressions are caught early (UX-DR35)**.

## Acceptance Criteria

**AC1 — ESLint a11y rules run on every lint pass (UX-DR35)**
**Given** the mobile ESLint configuration (`mobile/eslint.config.js`)
**When** `npm run lint` executes (locally or in CI)
**Then** `eslint-plugin-react-native-a11y` `basic` rules are active and report violations on JSX/TSX files (the plugin has no `recommended` config as of v3.5.1; `basic` is the cross-platform ruleset actually shipped)
**And** every failure prints an actionable ESLint rule name (e.g. `react-native-a11y/has-accessibility-props`, `react-native-a11y/no-nested-touchables`) so the author knows exactly what to fix
**And** `npm run lint` exits non-zero on any unresolved a11y violation (CI gate enforced).

**AC2 — Representative screens pass the a11y lint baseline with no suppressions for substantive issues**
**Given** the newly enabled rules run against all `.tsx` source files
**When** the lint pass completes on the current codebase
**Then** the codebase passes cleanly (zero errors from the a11y plugin)
**And** any inline `eslint-disable` for an a11y rule is accompanied by a one-line comment explaining why (e.g. decorative element, native-handled, third-party component) — suppressing without rationale is not acceptable.

**AC3 — Runtime a11y assertions cover representative screens in Jest**
**Given** the existing RNTL test suite for representative screens (Home, Review, Settings)
**When** `npm test` runs (locally or in CI)
**Then** each representative screen test file contains at least one explicit a11y assertion validating that the primary interactive controls are reachable by label/role (e.g. `getByRole`, `getByLabelText`, `getByAccessibilityValue`)
**And** failures are descriptive enough for the author to find the element (RNTL already prints element queries in failures).

**AC4 — CI documentation updated**
**Given** the `CLAUDE.md` CI section already documents `check-contrast` policy
**When** this story ships
**Then** `CLAUDE.md` is updated to reference the a11y lint rule (`eslint-plugin-react-native-a11y`) as a CI gate, consistent with the existing contrast policy entry.

## Tasks / Subtasks

- [x] **Task 1 — Install and configure `eslint-plugin-react-native-a11y`** (AC: 1, 2)
  - [x] Add `eslint-plugin-react-native-a11y` as a `devDependency` in `mobile/package.json`: `npm install --save-dev eslint-plugin-react-native-a11y`. The current version is **3.x** — pin the caret range (`^3.3.0` or whatever `npm install` resolves to).
  - [x] Update `mobile/eslint.config.js` to spread `reactNativeA11y.configs.recommended` into the config array **after** `expoConfig` (so Expo rules remain in effect):
    ```js
    const { defineConfig } = require('eslint/config');
    const expoConfig = require('eslint-config-expo/flat');
    const reactNativeA11y = require('eslint-plugin-react-native-a11y');

    module.exports = defineConfig([
      expoConfig,
      reactNativeA11y.configs.recommended,
      { ignores: ['dist/*'] },
    ]);
    ```
  - [x] Run `npm run lint` from `mobile/`. If violations are reported, **fix the actual component** — do not suppress unless the element is genuinely decorative, native-handled, or third-party. Add an inline `// eslint-disable-next-line react-native-a11y/<rule> -- <one-line rationale>` only for those edge cases.
  - [ ] Common fix patterns to expect (the codebase is largely compliant from 7.1/7.2, but lint catches JSX attributes not visible to RNTL tests):
    - `react-native-a11y/has-accessibility-props` — a `<TouchableOpacity>` or `<Pressable>` missing both `accessibilityLabel` and `accessibilityRole`. Add the missing prop.
    - `react-native-a11y/touchable-has-accessible` — a touchable without `accessible={true}` **and** no label. If the component is intentionally non-interactive (purely decorative wrapper), add `accessible={false}`.
    - `react-native-a11y/has-valid-accessibility-role` — an invalid string passed to `accessibilityRole`. Fix the string value to a valid RN role.
  - [x] Do **not** extend beyond `recommended`. Do not enable `all` rules — that includes rules for HTML/web that fire false positives in React Native.

- [x] **Task 2 — Representative screen runtime a11y assertions** (AC: 3)
  - [x] **Home screen** (`mobile/src/app/(tabs)/index.test.tsx`): The existing tests already use `getByLabelText` and `getByTestId`. Add (or confirm) assertions for `accessibilityRole` and `accessibilityState` on the Review and Learn buttons using RNTL's `getByRole('button', { name: /review/i })` pattern so the test explicitly exercises the a11y tree, not just `testID`.
  - [x] **Review screen** (`mobile/src/app/review/index.test.tsx`): Extend the existing test with an explicit assertion that the answer input is reachable by its `accessibilityLabel` (`getByLabelText('Type your answer')`) and that the submit/Continue button has `accessibilityRole="button"`. Mirror how 7.1 and 7.2 verified these in dev notes.
  - [x] **Settings screen** (`mobile/src/app/(tabs)/settings.test.tsx`): Already tests `getByLabelText('Reduce motion')` — confirm the test also asserts `accessibilityRole` or `accessibilityState` on the toggle so the a11y tree representation is verified, not only the label.
  - [x] Do **not** write a new top-level a11y test file. Extend the three existing screen test files — co-located with their screens — per the project convention (architecture.md line 409).
  - [x] Do **not** import `jest-axe` or any Axe library. `jest-axe` is a DOM (web) tool and does not apply to React Native; RNTL's accessibility-aware queries cover the runtime a11y tree.

- [x] **Task 3 — Verify CI integration** (AC: 1, 4)
  - [x] Run `npm run lint` (should pass clean after Task 1 fixes).
  - [x] Run `npm test` from `mobile/` (should pass clean with the Task 2 additions).
  - [x] Confirm `.github/workflows/ci.yml` `mobile` job's **Lint** step runs `npm run lint` — it does (line 49–50 of current `ci.yml`). No change to `ci.yml` is needed; the existing `expo lint` command invokes ESLint with the updated config automatically.
  - [x] Update `CLAUDE.md` CI section: add a bullet under the contrast policy entry noting that `npm run lint` (Expo lint) now enforces `eslint-plugin-react-native-a11y` recommended rules and failing rules block merge (same policy as `check-contrast`).

### Review Findings

- [x] [Review][Decision] AC1 said "recommended" rules but implementation uses "basic" (plugin has no `recommended` export) — **Resolved:** accepted `basic` as the permanent ruleset. AC1 and the Dev Notes ("`eslint-plugin-react-native-a11y` flat config — how it works") have been corrected in this story to describe `basic` accurately and cite real rule names (`has-accessibility-props`, `no-nested-touchables`) instead of the nonexistent `touchable-has-accessible`/`no-nested-views-for-screen-reader`.
- [x] [Review][Patch] `npm ci` fails with `ERESOLVE` on a clean install — `eslint-plugin-react-native-a11y@3.5.1`'s `peerDependencies` require `eslint@^3 || ^4 || ^5 || ^6 || ^7 || ^8`, but the project uses `eslint@^9.0.0`. The Dev Agent Record notes local install used `--legacy-peer-deps`, but that flag isn't encoded anywhere the committed lockfile respects on a fresh install — reproduced by running `npm ci` against the exact committed `mobile/package.json` + `mobile/package-lock.json` in an isolated directory, which fails immediately with the ERESOLVE conflict. CI's `mobile` job runs plain `npm ci` (`.github/workflows/ci.yml` lines 23 & 47), so this diff would have broken CI on merge. **Fixed:** added `mobile/.npmrc` with `legacy-peer-deps=true`; re-verified `npm ci` succeeds against the exact committed files in an isolated directory. [mobile/package-lock.json, mobile/package.json, mobile/.npmrc]
- [x] [Review][Patch] No guard against `reactNativeA11y.configs.basic` being undefined — a future plugin version/API change would throw an unguarded `TypeError` at ESLint config load time, breaking `npm run lint` entirely with no actionable message. **Fixed:** added an explicit check that throws a descriptive error if `configs.basic.rules` is missing. [mobile/eslint.config.js:8]
- [x] [Review][Patch] New a11y `plugins`/`rules` block has no `files` glob scoping it to `.tsx`/`.jsx` — Dev Notes assumed the "recommended" flat-config export would carry its own `files` restriction, but the `basic` export used instead is a legacy eslintrc-shaped object with no `files` key, so the block currently applies to every file ESLint lints, not just JSX/TSX. **Fixed:** added `files: ['**/*.jsx', '**/*.tsx']` to the block; `npm run lint` still passes clean. [mobile/eslint.config.js:13-18]
- [x] [Review][Patch] Tautological assertion `expect(toggle.props.accessibilityRole).toBe('switch')` — `toggle` was already retrieved via `screen.getByRole('switch', { name: 'Reduce motion' })`, so this assertion is guaranteed to pass whenever the preceding query succeeds and can never independently fail. **Fixed:** removed the redundant assertion; the `getByRole` query itself and the retained `value` assertion still verify the a11y tree. [mobile/src/app/(tabs)/settings.test.tsx:50]
- [x] [Review][Defer] Unrelated quote-style churn (double→single quotes on pre-existing lines) bundled into the `eslint.config.js` feature diff — deferred, pre-existing diff-hygiene nit, not a defect. [mobile/eslint.config.js]
- [x] [Review][Defer] `eslint-plugin-react-native-a11y` pinned with a caret range (`^3.5.1`) while gating CI merges per the new `CLAUDE.md` policy — deferred, a minor version bump could silently change the enabled rule set and break a future PR's lint step with no code change on that PR's part. [mobile/package.json]
- [x] [Review][Defer] `index.test.tsx` hardcodes `/review 2 items due/i`, coupling an a11y-label assertion to an incidental mock due-count — deferred, pre-existing test-writing convention in this codebase. [mobile/src/app/(tabs)/index.test.tsx]
- [x] [Review][Defer] `settings.test.tsx` asserts a hardcoded `toggle.props.value === false` default with no corresponding "toggled to true" counterpart test — deferred, pre-existing coverage gap. [mobile/src/app/(tabs)/settings.test.tsx]
- [x] [Review][Defer] New review test conflates label-existence and wrong-answer-submission concerns with a weakly-motivated `'wrong'` input value and no assertion on the resulting incorrect-answer state — deferred, test-quality nit not required by AC3. [mobile/src/app/review/index.test.tsx]
- [x] [Review][Defer] `collapsible.tsx` is the only production code change in this diff but has no accompanying test coverage for its new `accessibilityRole`/`accessibilityLabel`/`accessibilityState` props — deferred, out of AC3's explicit Home/Review/Settings scope. [mobile/src/components/ui/collapsible.tsx]
- [x] [Review][Defer] `_bmad-output/implementation-artifacts/sprint-status.yaml` is modified in this diff but not listed in the story's own "File List" section — deferred, bookkeeping gap only. [_bmad-output/implementation-artifacts/sprint-status.yaml]
- [x] [Review][Defer] `delete a11yRules['react-native-a11y/has-accessibility-hint']` silently becomes a no-op if the plugin renames/removes that rule ID in a future version, re-enabling the rule without the intended exemption surfacing — deferred, theoretical future-plugin-upgrade risk. [mobile/eslint.config.js:9]

## Dev Notes

### Scope discipline — tooling wiring, not component redesign

Stories 7.1 and 7.2 already added `accessibilityRole`, `accessibilityLabel`, `accessibilityHint`, `accessibilityValue`, and `accessibilityState` to interactive components. This story's job is:
1. **Enforce those requirements statically** via ESLint so future regressions are caught at `npm run lint` (before tests even run).
2. **Assert the a11y tree structure** in representative screen tests so CI catches runtime-level omissions.

Do **not** audit and re-add a11y props to every file — 7.1/7.2 did that. Fix only what `eslint-plugin-react-native-a11y` flags.

### `eslint-plugin-react-native-a11y` flat config — how it works

**Corrected post-implementation (code review, 2026-07-02):** the plugin exports a `configs` object, but as of the installed v3.5.1 there is **no `configs.recommended`** — only `basic`, `ios`, `android`, and `all` exist. `basic` is a legacy eslintrc-shaped object (`{ parserOptions, plugins: [...], rules: {...} }`), not a flat-config entry with its own `files` glob, so the shipped code spreads `configs.basic.rules` into a flat-config block and declares `plugins` manually:

```js
// mobile/eslint.config.js — shipped form
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const reactNativeA11y = require('eslint-plugin-react-native-a11y');

const a11yRules = { ...reactNativeA11y.configs.basic.rules };
delete a11yRules['react-native-a11y/has-accessibility-hint'];

module.exports = defineConfig([
  expoConfig,
  {
    plugins: { 'react-native-a11y': reactNativeA11y },
    rules: a11yRules,
  },
  {
    ignores: ['dist/*'],
  },
]);
```

The **basic** ruleset includes (subset relevant to this codebase, verified against the installed v3.5.1 rule list):
- `has-accessibility-props` — interactive elements need `accessibilityLabel` or `accessibilityHint`
- `has-valid-accessibility-role` — `accessibilityRole` must be a valid RN role string
- `has-valid-accessibility-descriptors` — flags mismatched/invalid accessibility prop combinations
- `no-nested-touchables` — no nested touchable elements (confuses screen readers about hit targets)

It does **not** include web-only rules from `all` like `no-access-key` (HTML-only) — this is why `basic` is the right choice over `all`. Because `basic` carries no `files` restriction, the block above currently applies to every file ESLint lints, not just `.tsx`/`.jsx` — harmless today since the rules are JSX-node no-ops elsewhere, but worth an explicit `files: ['**/*.tsx', '**/*.jsx']` if tightened later (see Review Findings).

### Likely lint surface after enabling the plugin

The codebase is well-accessibilized but the lint plugin performs **static JSX attribute analysis** not covered by RNTL tests. Possible hits:

- **Pressable/TouchableOpacity wrappers** in common components that wrap already-accessible children may lack `accessibilityLabel` on the outer wrapper even though the inner label exists. Correct fix: mark the outer as `accessible={false}` if the inner element is the accessible one, or consolidate the labels.
- **Icon-only buttons** (if any remain from pre-7.1 work) without `accessibilityLabel`. Fix: add the label.
- **`accessibilityRole` typos** — the plugin validates the exact string against the RN role enum. Fix: correct the string.

If a rule fires on a **third-party component** (e.g. an Expo or RN library component rendered inside a wrapper), disable the rule on that line with a rationale comment:
```tsx
{/* eslint-disable-next-line react-native-a11y/touchable-has-accessible -- expo-image handles its own a11y tree */}
```

### Current state of files being modified

- **`mobile/eslint.config.js`** — currently imports `eslint-config-expo/flat` only; add `eslint-plugin-react-native-a11y` import and spread `reactNativeA11y.configs.recommended`.
- **`mobile/package.json`** — `devDependencies` section; add `eslint-plugin-react-native-a11y` entry.
- **`mobile/src/app/(tabs)/index.test.tsx`** — 84-line test; three `describe` blocks for Home. Add `getByRole('button')` assertions to existing tests (no new `describe` block needed).
- **`mobile/src/app/review/index.test.tsx`** — existing review tests; add a11y assertions for input label and submit button role.
- **`mobile/src/app/(tabs)/settings.test.tsx`** — 58-line test already asserts `getByLabelText('Reduce motion')`; extend with `accessibilityRole` / `accessibilityState` check on the toggle.
- **`CLAUDE.md`** — CI section already documents `npm run check-contrast` policy; add a11y lint policy alongside it.

### Key API — RNTL accessibility queries (RNTL 13.3.3)

RNTL's accessibility-aware queries map the rendered component tree to the accessibility properties:

```ts
// Finds element where accessibilityRole="button" and accessibilityLabel matches
screen.getByRole('button', { name: /start review/i });

// Finds by accessibilityLabel exact or regex
screen.getByLabelText('Type your answer');

// Finds by accessibilityHint
screen.getByA11yHint('Double tap to open');

// Checks accessibilityState
expect(element.props.accessibilityState?.disabled).toBe(true);
```

These already appear in `index.test.tsx` (line 63, 81). Extend that pattern; do not introduce new assertion libraries.

### What NOT to do

- **Do not install `jest-axe`** — it requires a DOM environment (jsdom) and does not work with `jest-expo`'s React Native preset.
- **Do not use `reactNativeA11y.configs.all`** — triggers web-only rules that produce false positives.
- **Do not add a new CI job** — the existing `mobile` job's lint and test steps cover everything.
- **Do not create a new `__tests__/a11y/` directory** — extend co-located test files per project convention.
- **Do not run a full touch-target audit** — that was deferred from 7.1 and is still out of scope.
- **Do not modify any component's visual behavior** — this story is tooling only.

### Project Structure Notes

- **One package touched**: `mobile/` only. No changes to repo-root `scripts/` or `package.json`.
- **Co-located tests**: extend `index.test.tsx`, `review/index.test.tsx`, `settings.test.tsx` — do not create new test files.
- **ESLint flat config**: project uses ESLint v9 flat config (`eslint.config.js`) — use `defineConfig` + spread, not legacy `.eslintrc` objects.
- **Path alias**: `@/*` → `mobile/src/*`. No new aliases needed.
- **No new migrations**: this story touches no DB schema.
- **No Result<T>**: no new fallible operations; no new repositories.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.3 (lines 1011–1023)] — user story + AC (UX-DR35, `react-native-a11y` / Axe, actionable rule names).
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Accessibility Testing (line 1284)] — "Automated a11y audit: `react-native-a11y` / Axe integration — CI every PR."
- [Source: _bmad-output/implementation-artifacts/7-2-visual-accessibility.md#Task 1, line 48] — "the broader component-level a11y lint step (`react-native-a11y`/Axe) belongs to Story 7.3 — do not build that here."
- [Source: _bmad-output/implementation-artifacts/7-1-screen-reader-keyboard-and-input-accessibility.md] — prior a11y prop conventions; what's already on components (AccessibilityInfo, roles, labels).
- [Source: mobile/eslint.config.js] — current flat config structure to extend.
- [Source: mobile/src/app/(tabs)/index.test.tsx] — existing Home test patterns (getByLabelText, accessibilityState).
- [Source: mobile/src/app/(tabs)/settings.test.tsx] — existing Settings test patterns (getByLabelText, getByTestId).
- [Source: mobile/src/app/review/index.test.tsx] — existing Review test; extend with input+button a11y assertions.
- [Source: CLAUDE.md#CI] — existing `check-contrast` policy entry to extend.

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

- Plugin v3.5.1 has no `configs.recommended`; used `configs.basic` rules in ESLint flat config. Omitted `has-accessibility-hint` (would require hints on every labeled element; labels from 7.1/7.2 suffice).
- Installed with `--legacy-peer-deps` due to ESLint 9 peer range on the plugin.

### Completion Notes List

- ✅ Added `eslint-plugin-react-native-a11y@^3.5.1` and wired `basic` rules into `mobile/eslint.config.js` (flat config).
- ✅ Fixed sole substantive lint violation: `collapsible.tsx` Pressable missing a11y descriptors.
- ✅ Extended Home, Review, and Settings co-located tests with `getByRole` / `getByLabelText` a11y tree assertions.
- ✅ Updated `CLAUDE.md` CI policy for a11y lint gate alongside `check-contrast`.
- ✅ `npm run lint` and full `npm test` (651 tests) pass; CI `mobile` job lint step unchanged.

### File List

- mobile/package.json
- mobile/package-lock.json
- mobile/eslint.config.js
- mobile/src/components/ui/collapsible.tsx
- mobile/src/app/(tabs)/index.test.tsx
- mobile/src/app/review/index.test.tsx
- mobile/src/app/(tabs)/settings.test.tsx
- CLAUDE.md

## Change Log

- 2026-06-30: Story 7.3 — ESLint a11y plugin in CI lint gate; runtime a11y assertions on Home, Review, Settings; CLAUDE.md policy update.
