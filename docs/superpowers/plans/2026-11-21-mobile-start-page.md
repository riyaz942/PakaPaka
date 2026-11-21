# Phone Start Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fresh install or a signed-out phone opens a redesigned start page (look A2) with "Start without logging in" and "Log in with Google" fixed at the bottom; the onboarding welcome screen loses its sign-in button.

**Architecture:** Three small changes in `mobile/`: the redirect hook sends "no starting level" to `/start` on native only; the welcome screen drops its sign-in block; `src/app/start.tsx` is rebuilt as a scroll view with a fixed bottom bar. One new bundled font family (Fraunces) for the serif headline.

**Tech Stack:** Expo Router, React Native, NativeWind tokens, `react-native-reanimated` (through `FadeSlideIn`), Jest + React Native Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-21-mobile-start-page-design.md` (exact copy, sketch, and the builder calls 1–9).

## Global Constraints

- Work directly on `main` in the main checkout (operator decision 2026-11-21): no branch, no worktree. Another agent may work in the same checkout, so stage only the files each task lists (explicit paths, never `git add -A` or `git add .`), and do not change, stash or revert files you did not touch.
- Web behaviour must not change: on web, "no starting level" still goes to `/onboarding/welcome`.
- Semantic NativeWind tokens only; no raw hex; no `Colors` from `src/constants/theme.ts`.
- Every font is a bundled asset (offline-first); nothing fetched at runtime.
- Keep the existing test IDs `start-screen`, `start-begin`, `start-login`, `start-login-error`.
- Copy is fixed by the spec's "Exact copy" section; use it character for character.
- `npm run lint` in `mobile/` must pass (a11y rules block merge).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Small phone (iPhone SE, 375×667) with large text:** the content scrolls fully under the fixed bar; the last fact card is not hidden behind the buttons. → Task 3, Step 7 (device check) and the bottom-padding test in Step 1.
2. **Dark mode:** every colour on the page is a token, so the page reads in dark mode. → Task 3, Step 7.
3. **App killed on the welcome screen before a level is picked:** reopening shows the start page again, not a blank or a loop. → Task 1 test `redirects to start on native when starting level is absent`.
4. **Sign-in that finishes while the page is open:** the page leaves once (to `/onboarding/welcome`), and the sync wait / redirect takes over as today. → Task 3 keeps the existing `signed in opens the onboarding welcome` test.
5. **Reduced motion:** no entrance animation; content is shown at once. `FadeSlideIn` already handles it; Task 3 uses only `FadeSlideIn`. → Task 3, Step 7.

---

### Task 1: Fresh install opens `/start` on native

**Files:**
- Modify: `mobile/src/hooks/useOnboardingRedirect.ts` (the `if (!level)` branch)
- Test: `mobile/src/hooks/useOnboardingRedirect.test.tsx`

**Interfaces:**
- Consumes: `isWeb(): boolean` from `@/platform/capabilities`.
- Produces: nothing new; `useOnboardingRedirect(appliedVersion?, hold?)` keeps its signature.

- [ ] **Step 1: Write the failing tests**

At the top of the test file, mock the capability with a variable:

```tsx
let mockIsWeb = false;
jest.mock('@/platform/capabilities', () => ({
  ...jest.requireActual('@/platform/capabilities'),
  isWeb: () => mockIsWeb,
}));
```

Reset `mockIsWeb = false` in `beforeEach`. Replace the test `redirects to welcome when starting level is absent` with two tests (same setup as the old one: user on `['(tabs)']`, no starting level):

- `redirects to start on native when starting level is absent` → `expect(mockReplace).toHaveBeenCalledWith('/start')`.
- `redirects to welcome on web when starting level is absent` → set `mockIsWeb = true`; `expect(mockReplace).toHaveBeenCalledWith('/onboarding/welcome')`.

If the test `does not redirect away from welcome when import branch is pending` or any other test expects `/onboarding/welcome` from the `!level` branch while outside onboarding, update it to `/start` (native default).

- [ ] **Step 2: Run the tests to see the native one fail**

Run: `cd mobile && npx jest src/hooks/useOnboardingRedirect.test.tsx`
Expected: `redirects to start on native…` FAILS (received `/onboarding/welcome`); the web test PASSES.

- [ ] **Step 3: Change the `!level` branch**

`router.replace(isWeb() ? '/onboarding/welcome' : '/start')`. Add one comment line: the phone's first screen is the start page; the web has its own landing page.

- [ ] **Step 4: Run the tests**

Run: `cd mobile && npx jest src/hooks/useOnboardingRedirect.test.tsx`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/hooks/useOnboardingRedirect.ts mobile/src/hooks/useOnboardingRedirect.test.tsx
git commit -m "feat(onboarding): a fresh install opens the start page on the phone"
```

---

### Task 2: Remove the sign-in button from the welcome screen

**Files:**
- Modify: `mobile/src/app/onboarding/welcome.tsx`
- Test: `mobile/src/app/onboarding/welcome.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Change the tests**

Delete the three tests `signed out shows Sign in to restore your progress and it calls signIn`, `signed in or loading hides the sign-in button`, `a sign-in error shows under the button`. Add:

- `has no sign-in button` → with `mockAccount.status = 'signed_out'`: `expect(screen.queryByTestId('welcome-sign-in')).toBeNull()` and `expect(screen.queryByText('Sign in to restore your progress')).toBeNull()`.

- [ ] **Step 2: Run it to see it fail**

Run: `cd mobile && npx jest src/app/onboarding/welcome.test.tsx`
Expected: `has no sign-in button` FAILS.

- [ ] **Step 3: Remove the block**

In `welcome.tsx`, delete the `account.status === 'signed_out' ? (<FadeSlideIn index={3}>…</FadeSlideIn>) : null` block, the `useAccount` import and the `const account = useAccount();` line. Change the kana note's `FadeSlideIn index={4}` to `index={3}` so the stagger has no gap. If the test file's `@/providers/AccountProvider` mock and `mockAccount` / `mockSignIn` are now unused, remove them too.

- [ ] **Step 4: Run the tests**

Run: `cd mobile && npx jest src/app/onboarding/welcome.test.tsx`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/app/onboarding/welcome.tsx mobile/src/app/onboarding/welcome.test.tsx
git commit -m "feat(onboarding): sign-in moves to the start page"
```

---

### Task 3: Redesign the start page (look A2)

**Files:**
- Modify: `mobile/package.json`, `mobile/package-lock.json` (new dependency)
- Modify: `mobile/src/constants/fonts.ts` (add two faces)
- Modify: `mobile/tailwind.config.js` (`fontFamily` block)
- Modify: `mobile/src/app/start.tsx` (rewrite)
- Test: `mobile/src/app/start.test.tsx`

**Interfaces:**
- Consumes: `useAccount()` (`status`, `error`, `signIn`); `Button` (`label`, `onPress`, `variant`, `disabled`, `className`, `testID`); `FadeSlideIn` (`index`); `getRadicalImage(ref)` from `@/utils/radicalImages`; `require('@/assets/images/mascot/alpi-yay.png')`.
- Produces: NativeWind font utilities `font-display` (Fraunces 500) and `font-display-italic` (Fraunces 500 italic).

- [ ] **Step 1: Write the failing tests** (in `start.test.tsx`; keep its existing mocks and `renderStart()`)

Replace `shows the title, the line and both buttons` with:

- `shows the hero, the chain, the facts and both buttons` → `getByText('PakaPaka')`, `getByText('A FREE, OPEN-SOURCE JAPANESE COURSE')`, `getByText(/Every kanji is a story/)`, `getByText('you already know.')`, `getByText('One story, three steps')`, `getByText('士')`, `getByText('冖')`, `getByText('儿')`, `getByText('売')`, `getByText('売る')`, `getByText('Yours, with no strings')`, `getByText('Start without logging in')`, `getByText('Log in with Google')`.
- `the buttons sit outside the scroll view` → `within(screen.getByTestId('start-scroll')).queryByTestId('start-begin')` is `null`, same for `start-login`; `screen.getByTestId('start-actions')` contains both (`within(...).getByTestId(...)`).
- `the scroll content leaves room for the fixed bar` → fire `layout` on `start-actions` with `{ nativeEvent: { layout: { height: 160 } } }`; then the `start-scroll` prop `contentContainerStyle` has `paddingBottom` ≥ 160.

In the other existing tests, change `'Start learning'` → `'Start without logging in'` and `'Log in'` → `'Log in with Google'` where they look up text; IDs stay. Keep `Log in calls signIn and is disabled unless signed out`, `a sign-in error shows under Log in`, `signed in opens the onboarding welcome`.

- [ ] **Step 2: Run them to see them fail**

Run: `cd mobile && npx jest src/app/start.test.tsx`
Expected: the new tests FAIL (text and test IDs not found).

- [ ] **Step 3: Add the Fraunces font**

`cd mobile && npx expo install @expo-google-fonts/fraunces`. Check the package's exported names for weight 500 regular and 500 italic (expected `Fraunces_500Medium`, `Fraunces_500Medium_Italic`); add both to `appFonts` in `src/constants/fonts.ts` and add one line to the doc comment (`Fraunces (font-display*) — the start page headline`). In `tailwind.config.js` `fontFamily`, add `display: ['Fraunces_500Medium']` and `'display-italic': ['Fraunces_500Medium_Italic']` (use the real export names).

- [ ] **Step 4: Rewrite `StartScreen` in `src/app/start.tsx`**

Default export `StartScreen()`; keep the doc comment (update it: fresh install and sign-out both open this page) and the `useEffect` that replaces to `/onboarding/welcome` once on `signed_in`.

Structure:
- Root `View testID="start-screen" className="flex-1 bg-background"`.
- `ScrollView testID="start-scroll"`, `contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: barHeight + 24, paddingHorizontal: 24 }}`. `barHeight` is state, set from `onLayout` of the bar.
- Decorative practice square, absolutely placed top-right inside the scroll content, partly off-screen (about 230×230 at `right: -34`): `border-2 border-primary/10`, two 1px centre lines `bg-primary/5`, and `話` in `font-jp-hero-bold text-primary/5` sized to fill it. `accessible={false}`, `importantForAccessibility="no-hide-descendants"`.
- Hero, `FadeSlideIn index={0}`: brand line `PakaPaka` (`font-ui-extrabold text-brand-text`); mascot `Image` 150×150 `resizeMode="contain"` `accessible={false}`; kicker (`text-overline font-ui-bold text-brand-text`); headline `Text accessibilityRole="header" className="font-display text-primary"` (about 34 px, line height about 1.1) with a nested `Text className="font-display-italic text-brand-text"` for `you already know.`; lede (`text-body font-ui text-secondary`).
- Chain section, `FadeSlideIn index={1}`: section title in `font-display`; a row of three radical cards (`bg-surface border border-border rounded-radius-md`), each with the image from `getRadicalImage(...)` (44×44, decorative), the glyph (`font-jp-hero-bold text-content-radical-deep`) and the name (`text-caption text-muted`); a `↓` between rows; kanji tile and vocabulary tile per spec builder call 8 (soft fill, deep text, left accent bar in `bg-content-kanji` / `bg-content-vocabulary`), glyph in `font-jp-hero-bold`, meaning in `font-ui-bold`, story line in `text-caption`.
- Facts section, `FadeSlideIn index={2}`: title in `font-display`; three cards (`bg-surface border border-border rounded-radius-md`), each a `Text` with a nested bold `Text` for the lead words.
- Fixed bar: `View testID="start-actions"`, `absolute bottom-0 left-0 right-0 bg-background border-t border-border px-6 pt-4 gap-space-sm`, `style={{ paddingBottom: insets.bottom + 16 }}`, `onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}`. Inside: primary `Button` `Start without logging in` (`testID="start-begin"`, `onPress={() => router.replace('/onboarding/welcome')}`); secondary `Button` `Log in with Google` (`testID="start-login"`, same `onPress`/`disabled` as today); the error `Text` as today (`testID="start-login-error"`).

Use the existing text-size and radius tokens from `tailwind.config.js`; an arbitrary size (e.g. `text-[34px]`) only where no token fits.

- [ ] **Step 5: Run the tests**

Run: `cd mobile && npx jest src/app/start.test.tsx src/app/onboarding src/hooks/useOnboardingRedirect.test.tsx`
Expected: all PASS.

- [ ] **Step 6: Lint, typecheck, contrast**

Run: `cd mobile && npm run lint && npm run typecheck` then `cd .. && npm run check-contrast`
Expected: lint clean; typecheck shows only the 5 known `(tabs)/converse` typed-route errors (see `docs/working-history.md`), nothing new; contrast check passes.

- [ ] **Step 7: Check on a device or simulator (operator or agent)**

Build a dev client (`npx expo run:ios` / `run:android`; the new font needs a native rebuild). Uninstall first, so it is a fresh install. Check:
1. Fresh install opens the start page, not onboarding.
2. Scroll to the end: the last fact card is fully visible above the bar; the bar never moves.
3. iPhone SE size (or the smallest Android emulator) with the largest system text size: same as 2.
4. Dark mode: all text readable; faint 話 and square still faint.
5. Reduced motion on: no entrance animation.
6. "Start without logging in" → onboarding welcome, which has no sign-in button.
7. Settings → Sign out and erase my data → the start page.

Write down what was checked and on which device.

- [ ] **Step 8: Commit**

```bash
git add mobile/package.json mobile/package-lock.json mobile/src/constants/fonts.ts mobile/tailwind.config.js mobile/src/app/start.tsx mobile/src/app/start.test.tsx
git commit -m "feat(start): redesigned phone start page with fixed log-in buttons"
```

---

### Task 4: Record the status

**Files:**
- Modify: `docs/working-history.md`

- [ ] **Step 1: Add a row** for this plan (link to the spec and this plan): built date, branch, what Task 3 Step 7 checked and on which device, and "not done" for any check that did not run. Note the iOS Apple sign-in release blocker still applies.

- [ ] **Step 2: Commit**

```bash
git add docs/working-history.md
git commit -m "docs: phone start page status"
```
