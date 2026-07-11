# Plan 06 — UI navigation & polish

Six UI/UX feedback points from playtesting, grouped because they all touch the
same shell surfaces (headers, tab bar, detail screens, the mnemonic editor).
Each item below is grounded in the current code (file:line references) and lists
the concrete change, acceptance criteria, and files touched.

Two of these are correctness/usability bugs that can strand the user:

- **§6.4** the "Save" button uses an undefined color token (`text-on-primary`),
  so its label falls back to the platform default (black) — invisible/low-contrast
  on the blue button.
- **§6.5** the Learn item detail screen renders long content in a plain `View`
  with no scroll container, so the bottom of tall kanji/grammar items is
  unreachable.

## Feedback items

| # | Item | Priority |
|---|------|----------|
| [6.1](#61--coloured-nav-header--status-bar-visibility) | Coloured nav header so header + notification-bar contents are visible | P1 |
| [6.2](#62--replace-back-text-with-an-icon) | Replace the "Back" text with an icon | P2 |
| [6.3](#63--keyboard-overlaps-the-mnemonic-input) | Keyboard covers the mnemonic input on tap | P1 |
| [6.4](#64--save-button-contrast-undefined-token) | "Save" button label has no contrast (undefined token) | **P0** |
| [6.5](#65--learn-detail-screens-cannot-scroll) | Learn kanji/grammar detail can't scroll to the bottom | **P0** |
| [6.6](#66--auto-hidereveal-chrome-on-scroll-low) | Auto-hide header + tab bar on scroll down, reveal on scroll up | P3 (low) |

## Current state (shared context)

- The tab shell hides the native header entirely: `headerShown: false` in
  `mobile/src/app/(tabs)/_layout.tsx:25`. The root stack also hides headers for
  `(tabs)`, `onboarding`, `review`, `lesson`
  (`mobile/src/app/_layout.tsx:44-55`).
- There is **no** `StatusBar` / `expo-status-bar` usage anywhere in `src`
  (grep for `StatusBar` returns nothing), so the OS status-bar icon color is
  never set to match the theme.
- Screens draw their own top inset with `SafeAreaView edges={['top','left','right']}`
  over `bg-background` (e.g. `learn/item/[id].tsx:31-38`,
  `learn/[level].tsx:70-77`), which is why the status-bar strip visually blends
  into the page background.
- Design tokens: `feedback-info` = `#4488ee` (dark) / `#2d6fc9` (light) and
  `primary` = `#eeeef0` (dark) / `#1a1a2e` (light), defined in
  `mobile/src/constants/design-tokens.js:22-34` and mirrored in
  `mobile/src/global.css` + `mobile/tailwind.config.js`. There is **no**
  `on-primary` color token in any of those files.

---

## 6.1 — Coloured nav header + status-bar visibility

**Problem.** With `headerShown: false` and no `StatusBar` config, the OS
status-bar strip (clock, battery, notification icons) sits directly on
`bg-background` with no dedicated surface, so its contents are hard to see and
there's no visual "header" separating chrome from content.

**Approach (recommended: lightweight, no native headers).** Keep the custom
per-screen layout but give the top a real, coloured surface + correct status-bar
icon color:

1. Add `expo-status-bar` at the root. In `RootLayoutContent`
   (`mobile/src/app/_layout.tsx:33-59`) render `<StatusBar style={isDark ? 'light' : 'dark'} />`
   so the OS icons contrast against the app background. `isDark` is already
   computed at line 35.
2. Introduce a reusable `ScreenHeader` component
   (`mobile/src/components/common/ScreenHeader.tsx`) that renders a coloured bar
   (`bg-surface` with a `border-b border-border`) spanning into the top safe-area
   inset, containing the back affordance (§6.2) + optional title. Back it with
   `useSafeAreaInsets()` so the coloured fill extends *behind* the status bar
   rather than starting below it.
3. Adopt `ScreenHeader` on the stack-style detail screens
   (`learn/item/[id].tsx`, `learn/[level].tsx`, `read/[id].tsx`) in place of the
   hand-rolled back `Pressable`.

**Alternative (native headers).** Flip `headerShown: true` on the `learn`/`read`
inner stacks and set `headerStyle.backgroundColor = colors.surface`,
`headerTintColor = colors.primary`. Lower effort but loses the shared
`MaxContentWidth` centering pattern and the custom back styling, and changes the
tab screens' layout math — hence the custom-header approach is recommended.

**Acceptance criteria.**
- Status-bar icons are clearly visible in both light and dark themes on every
  top-level tab and detail screen.
- Detail screens show a visually distinct coloured header bar separated from the
  scroll content by a border.
- Contrast of header text/icons on the header surface passes `npm run check-contrast`.

**Files touched.** `mobile/src/app/_layout.tsx`,
`mobile/src/components/common/ScreenHeader.tsx` (new),
`mobile/src/app/(tabs)/learn/item/[id].tsx`,
`mobile/src/app/(tabs)/learn/[level].tsx`,
`mobile/src/app/(tabs)/read/[id].tsx`, `package.json` (`expo-status-bar` is
usually already an Expo dependency; add if missing).

---

## 6.2 — Replace "Back" text with an icon

**Problem.** Detail screens use a text label "Back":
`learn/item/[id].tsx:39-46`, `learn/[level].tsx:78-85`, `read/[id].tsx:41-45`.

**Change.** Swap the `<Text>Back</Text>` for a `MaterialIcons` chevron/arrow
(`MaterialIcons` is already the icon set used by the tab bar —
`(tabs)/_layout.tsx:1`). Use `name="arrow-back"` (or `chevron-left`), `size≈24`,
`color={colors.feedbackInfo}` (or header tint). This is naturally absorbed into
the `ScreenHeader` component from §6.1.

**Accessibility (must preserve).** Keep `accessibilityRole="button"`, keep a
meaningful `accessibilityLabel` (existing labels: "Back", "Back to Learn hub"),
and keep the ≥44px touch target (currently `min-h-[44px]`). An icon-only button
**must** keep its label or `eslint-plugin-react-native-a11y` / the CI a11y gate
will flag it.

**Acceptance criteria.**
- All three detail screens show a back icon instead of the word "Back".
- Screen-reader announces the same back affordance; touch target stays ≥44px.
- `npm run lint` (a11y rules) passes.

**Files touched.** `mobile/src/components/common/ScreenHeader.tsx` (new, from §6.1)
or the three screens directly if §6.1 is deferred.

---

## 6.3 — Keyboard overlaps the mnemonic input

**Problem.** The personal-mnemonic editor (`PersonalMnemonicEditor.tsx`, a
`TextInput` + Save button) is rendered near the bottom of the item detail screen,
which currently has **no scroll container and no keyboard avoidance**
(`learn/item/[id].tsx:29-84` is a plain `View` → `SafeAreaView`). On focus the
soft keyboard covers the field.

**Change (folds into §6.5's scroll fix).**
1. Wrap the detail content in a `ScrollView` (see §6.5) with
   `keyboardShouldPersistTaps="handled"` and generous
   `contentContainerStyle` bottom padding.
2. Wrap that in a `KeyboardAvoidingView` (`behavior={Platform.OS === 'ios' ? 'padding' : undefined}`),
   or use `react-native-keyboard-aware-scroll-view` / the scroll view's
   `automaticallyAdjustKeyboardInsets` (iOS) so the focused input scrolls above
   the keyboard.

**Acceptance criteria.**
- Focusing the personal-mnemonic input keeps the full input and the Save button
  visible above the keyboard on both iOS and Android.
- Tapping elsewhere / the Save button while the keyboard is open works
  (no swallowed first tap).

**Files touched.** `mobile/src/app/(tabs)/learn/item/[id].tsx`. Possibly a new
dependency if we choose the keyboard-aware scroll view.

---

## 6.4 — Save button contrast (undefined token)

**Problem (root cause).** In `PersonalMnemonicEditor.tsx:44-45` the Save button
label uses `text-on-primary`:

```44:45:mobile/src/components/learn/PersonalMnemonicEditor.tsx
        className="mt-3 min-h-[44px] items-center justify-center rounded-radius-md bg-feedback-info px-space-md py-2">
        <Text className="text-body font-semibold text-on-primary">Save</Text>
```

`on-primary` is **not defined** as a color in `tailwind.config.js`, `global.css`,
or `design-tokens.js`. NativeWind therefore drops the class and the `<Text>`
falls back to the platform default color (black), which is why the label looks
black/invisible on the button. The same dead token is used in
`UserSynonymEditor.tsx` and `read/PassageQuestion.tsx` — fix all three.

**Change — pick one:**
- **Option A (define the token, recommended):** add `--color-on-primary` to
  `global.css` (both `:root` dark and the light media block), add
  `'on-primary': 'var(--color-on-primary)'` to `tailwind.config.js` colors, and
  add `onPrimary` to `design-tokens.js` (+ `design-tokens.d.ts`). Choose a value
  with ≥4.5:1 contrast against `feedback-info` (`#4488ee` / `#2d6fc9`) — white
  (`#ffffff`) passes for both. This makes the token real for future use.
- **Option B (quick fix):** replace `text-on-primary` with an existing
  high-contrast token, e.g. `text-background` (light-on-dark button) verified
  against the button fill.

Either way, verify with `npm run check-contrast` and, if Option A, add the new
pair to the contrast pairing manifest.

**Acceptance criteria.**
- The "Save" label is clearly legible on the button in light and dark themes.
- `npm run check-contrast` passes with the Save-button pair at ≥4.5:1.
- No remaining live references to `text-on-primary` resolve to an undefined token.

**Files touched.** `mobile/src/components/learn/PersonalMnemonicEditor.tsx`,
`mobile/src/components/learn/UserSynonymEditor.tsx`,
`mobile/src/components/read/PassageQuestion.tsx`, and (Option A)
`mobile/src/global.css`, `mobile/tailwind.config.js`,
`mobile/src/constants/design-tokens.js`,
`mobile/src/constants/design-tokens.d.ts`, plus the contrast manifest.

---

## 6.5 — Learn detail screens cannot scroll

**Problem (root cause).** `learn/item/[id].tsx` renders the detail component
directly inside a `SafeAreaView` with **no scroll view**:

```29:84:mobile/src/app/(tabs)/learn/item/[id].tsx
  return (
    <View className="flex-1 bg-background">
      <SafeAreaView
        edges={['top', 'left', 'right']}
        className="flex-1 px-space-lg pt-space-md"
        ...>
        <Pressable ...>Back</Pressable>
        {loading ? ... : (
          <KanjiDetail ... /> | <GrammarDetail ... /> | ...
        )}
      </SafeAreaView>
    </View>
  );
```

`KanjiDetail` / `GrammarDetail` / `VocabularyDetail` render meanings, readings,
mnemonics, example sentences, and the mnemonic editor as a tall column; anything
past the viewport height is clipped and unreachable. (The `[level].tsx` list
screen is fine — it uses a `FlatList`, `[level].tsx:103`.)

**Change.** Put the detail content inside a `ScrollView`:
- Keep the back affordance / header outside the scroll region (fixed header from
  §6.1), scroll only the body.
- `ScrollView` with `className="flex-1"`, `contentContainerStyle` bottom padding
  (so the last element — the mnemonic Save button — clears the tab bar and the
  keyboard, dovetailing with §6.3), `keyboardShouldPersistTaps="handled"`,
  `showsVerticalScrollIndicator`.
- Preserve the `MaxContentWidth` centering (`item/[id].tsx:34-38`).

**Acceptance criteria.**
- A kanji and a grammar item whose content exceeds the screen height can be
  scrolled fully to the last element (personal-mnemonic Save button reachable).
- No regression to the `[level].tsx` list or the max-width centering.
- Existing tests in `learn/item/[id].test.tsx` still pass (adjust queries if the
  container changes).

**Files touched.** `mobile/src/app/(tabs)/learn/item/[id].tsx`
(and `learn/item/[id].test.tsx` if selectors need updating).

---

## 6.6 — Auto-hide/reveal chrome on scroll (low)

**Goal.** Hide the header (and bottom tab bar) when scrolling down, reveal on
scroll up, across all scrollable sections.

**Is there a "native" way?** Partially.
- **Tab bar:** React Navigation's bottom tabs do not auto-hide on scroll out of
  the box. The supported approach is to animate `tabBarStyle` (e.g.
  translateY / display) in response to scroll — there is no zero-config flag.
  This means every scrollable screen must report scroll direction up to a shared
  controller.
- **Header:** since headers here are custom (`headerShown: false`), the same
  shared scroll-direction signal drives an animated translate on `ScreenHeader`.

**Approach if pursued.** Add a small `useScrollDirection` hook (tracks
`onScroll` delta with a hysteresis threshold) + a context that toggles a shared
`Animated`/`Reanimated` value; `ScreenHeader` and a `tabBarStyle` override
subscribe to it. Wire the shared `onScroll` into each scroll surface
(`(tabs)/index.tsx`, `stats.tsx`, `settings.tsx`, `read/[id].tsx`, and the new
`learn/item/[id].tsx` ScrollView from §6.5).

**Recommendation.** Defer until §6.1/§6.5 land (they establish the header
component and the missing scroll container this feature depends on). Marked P3 /
low by the reporter; scope it as its own follow-up story.

**Acceptance criteria (when built).**
- Scrolling down past a threshold hides header + tab bar with animation; scrolling
  up reveals them; reaching the top always shows chrome.
- Behaviour is consistent across all scrollable sections; reduced-motion users
  get an instant (non-animated) toggle.

**Files touched (est.).** `mobile/src/hooks/useScrollDirection.ts` (new), a
chrome-visibility provider, `mobile/src/components/common/ScreenHeader.tsx`,
`mobile/src/app/(tabs)/_layout.tsx`, and each scrollable screen.

---

## Suggested sequencing

1. **§6.4** (P0, isolated one-token fix) and **§6.5** (P0, unblocks §6.3) —
   land first, each ships alone.
2. **§6.3** — folds into the §6.5 scroll container.
3. **§6.1** + **§6.2** — the shared `ScreenHeader` + status-bar work; do together.
4. **§6.6** — deferred follow-up, built on top of §6.1/§6.5.

## Verification (all items)

- `npm run lint` and `npm run typecheck` (from `mobile/`).
- `npm test` (from `mobile/`) — update `learn/item/[id].test.tsx` selectors if the
  scroll container changes.
- `npm run check-contrast` (repo root) for §6.1 and §6.4 token/contrast changes.
- Manual device check on iOS + Android for keyboard avoidance (§6.3), scroll
  reachability (§6.5), and status-bar legibility (§6.1) in both themes.
