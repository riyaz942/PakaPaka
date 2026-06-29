---
baseline_commit: 797c24444f2dcfe6b5354aa99e804b9ffbd74c8a
---

# Story 7.1: Screen reader, keyboard, and input accessibility

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> **Consolidates original stories 7.1 and 7.4** — both navigation/input accessibility for assisted users. First story of Epic 7 (Accessible, inclusive experience). Epic 7 cross-cuts the shipped product slices (Epics 1–6); this story audits and completes accessibility on flows that already exist.

## Story

As a **learner using assistive technology**,
I want **meaningful screen reader semantics, keyboard navigation, and accessible input methods**,
so that **I can complete core flows with VoiceOver/TalkBack or external keyboards (FR52, FR54, NFR15, NFR17)**.

## Acceptance Criteria

**AC1 — Screen reader semantics across core flows (FR52, NFR15)**
**Given** VoiceOver (iOS) or TalkBack (Android) enabled
**When** I traverse Home, Learn (hub + per-type item list), and a full review item cycle (prompt → submit → result → next)
**Then** each interactive control announces its purpose and state — tabs, buttons, the answer input, hint controls, and result states
**And** dynamic results and hint reveals are announced politely without stealing or losing the user's place (UX-DR32, UX-DR34).

**AC2 — Focus management in the review loop (UX-DR32, NFR15)**
**Given** a screen reader is enabled during a review session
**When** I submit an answer
**Then** the result (correct / incorrect / typo) is announced and screen-reader focus lands on the result region
**And** when the loop advances to the next prompt (auto-advance on correct, or "Continue" on incorrect), focus returns to the answer input (or the primary actionable control) so I never lose my place.

**AC3 — Hardware keyboard operates the full review loop (NFR17)**
**Given** a Bluetooth/external keyboard is connected
**When** I focus the answer field and press Enter
**Then** the answer submits and the input retains a usable state (does not blur into an unreachable state)
**And** on an incorrect result, advancing to the next item is operable from the keyboard (the "Continue" control is reachable/auto-focused and Enter/Space activates it).

**AC4 — No gesture-only affordances (NFR17)**
**Given** any interactive affordance in Home, Learn, and the review session (including session exit)
**When** I rely only on tap targets and an external keyboard (no swipe)
**Then** every action has an on-screen, focusable control alternative (e.g., session exit is reachable via the on-screen ✕ button, not only swipe-down), and all touch targets meet the ≥44×44pt minimum.

**AC5 — Accessible Japanese input announces converted kana (UX-DR6, NFR15)**
**Given** a reading/production prompt with the WanaKana input
**When** I type in romaji with a screen reader enabled and submit
**Then** the input is labelled with its mode/purpose and the announced/submitted value is the converted kana, not raw romaji (existing behavior — verify and lock with a regression test).

## Tasks / Subtasks

- [x] **Task 1 — Accessibility audit pass of in-scope flows** (AC: 1, 4)
  - [x] Walk Home (`src/app/(tabs)/index.tsx`), Learn hub (`src/app/(tabs)/learn/index.tsx`), Learn per-type list (`src/app/(tabs)/learn/[level].tsx` + `src/components/learn/LearnItemRow.tsx`), and the full review loop, cataloguing each interactive element's current `accessibilityRole` / `accessibilityLabel` / `accessibilityState`.
  - [x] Record findings (table of element → current a11y → gap → fix) in the Dev Agent Record. Most controls already ship a11y props — this story closes the remaining gaps, it does not re-do what exists.
  - [x] Confirm the native tab bar (`src/app/(tabs)/_layout.tsx`, `NativeTabs`) exposes label + selected state via OS semantics; no custom role wiring needed (document the rationale rather than adding redundant props).
- [x] **Task 2 — Implement focus management in the review loop** (AC: 1, 2)
  - [x] In `src/app/review/index.tsx`, after `setCardState('correct'|'incorrect'|'typo')`, move screen-reader focus to the result region using `findNodeHandle` + `AccessibilityInfo.setAccessibilityFocus` on a ref attached to the `ReviewCard` result view (guard with `AccessibilityInfo.isScreenReaderEnabled()` so sighted/keyboard-only flow is untouched).
  - [x] On advance to the next item (the `currentItem?.itemId` reset effect) and on the typo re-prompt, ensure focus returns to the `WanaKanaInput`. Keep the existing `requestAnimationFrame(() => inputRef.current?.focus())` pattern; extend `WanaKanaInputRef`/`SessionHeader`/`ReviewCard` with a focus-target ref where needed.
  - [x] Preserve the existing `AccessibilityInfo.announceForAccessibility` calls (correct/incorrect/typo, converted-kana, daily-threshold) — focus management is additive, announcements stay. Do not double-announce: a `setAccessibilityFocus` on a labelled region will re-read it, so reconcile to avoid the result being spoken twice.
- [x] **Task 3 — Add polite live regions to dynamic review content** (AC: 1)
  - [x] Add `accessibilityLiveRegion="polite"` (Android) to the dynamic result/typo region in `ReviewCard.tsx` and the revealed-hint panels in `ProgressiveHint.tsx`, complementing the iOS `announceForAccessibility` path. (`accessibilityLiveRegion` is Android-only and a no-op on iOS — that is expected.)
  - [x] Verify the `correct`/`incorrect`/`typo` result `View`s keep `accessible` + a labelled string that matches the spoken announcement (they currently do — keep them in sync).
- [x] **Task 4 — Hardware keyboard operability** (AC: 3)
  - [x] On `WanaKanaInput`'s `TextInput`, set `submitBehavior="submit"` so a hardware Enter fires `onSubmitEditing` **without** blurring the field (RN 0.83 replaced `blurOnSubmit` with `submitBehavior`; default for single-line is `blurAndSubmit`). Confirm the existing soft-keyboard "done" submit still works.
  - [x] On the incorrect-state "Continue" `Button` in `src/app/review/index.tsx`, ensure it is reachable and activatable from a keyboard — give it focus when the incorrect state renders (mirror the result-focus pattern) so Enter/Space advances without a swipe or pointer.
  - [x] Verify the auto-advance-on-correct path (`REVIEW_CORRECT_AUTO_ADVANCE_MS`) needs no keyboard interaction (it advances itself) and does not trap focus.
- [x] **Task 5 — Verify session exit is non-gesture-operable** (AC: 4)
  - [x] Confirm `SessionExitSheet` is reachable via the on-screen ✕ in `SessionHeader` (already wired) and that both "End session" / "Keep going" are focusable `Button`s. Confirm the `Modal`'s `onRequestClose` (Android back) maps to keep-going. No swipe-only path may be the sole exit.
- [x] **Task 6 — Tests** (AC: 1, 2, 3, 4, 5)
  - [x] `WanaKanaInput.test.tsx`: assert `submitBehavior="submit"`, the mode-specific `accessibilityLabel`, and that `onSubmitEditing` triggers `onSubmit` (keyboard-Enter path). Lock the converted-kana announcement contract (AC5).
  - [x] `ReviewCard.test.tsx`: assert result/typo regions carry `accessible`, the matching `accessibilityLabel`, and `accessibilityLiveRegion="polite"`.
  - [x] `ProgressiveHint.test.tsx`: assert revealed hint panel carries `accessibilityLiveRegion="polite"` and that `AccessibilityInfo.announceForAccessibility` is still called (extend existing tests; mock `AccessibilityInfo`).
  - [x] Review screen test (`src/app/review/index.test.tsx`, create if absent following existing app-route test patterns): with `AccessibilityInfo.isScreenReaderEnabled` mocked true, assert `setAccessibilityFocus` is invoked on submit (result) and on advance (input). Mock `findNodeHandle`/`AccessibilityInfo` as in other tests.
  - [x] Run `npm run lint`, `npm run typecheck`, `npm test` from `mobile/` — all green.

## Dev Notes

### Scope discipline — this is an audit-and-complete story, not a rewrite

Accessibility was **baked in from day one** per the UX spec ("Not retrofitted — every component ships with `accessibilityRole`/`Label`/`Hint`/`Value`", UX spec §Implementation Guidelines line 1306–1311). A grep confirms ~45 source files already carry a11y props. **Do not re-add or churn props that already exist.** The genuine, currently-missing capabilities this story delivers are:

1. **Programmatic screen-reader focus management in the review loop** — today the loop *announces* results via `AccessibilityInfo.announceForAccessibility` but never *moves* screen-reader focus to the result, nor deterministically returns it to the input on advance. UX-DR32 and the implementation guideline (line 1309) require: "after submission → focus result area. After advance → focus prompt. Screen reader users never lose place in review loop." This is the headline new code.
2. **Polite live regions** on dynamic review content (Android complement to the iOS announce path) — UX spec line 1308.
3. **Hardware-keyboard full-loop operability** — Enter submits without blurring; the incorrect-state "Continue" is keyboard-activatable (NFR17, UX spec line 1256 "External keyboard: Tab focuses input, Enter submits — full review loop via keyboard").
4. **A formal no-gesture-only audit** + regression tests locking it all in.

### Current state of files being modified (read before editing)

- **`src/app/review/index.tsx`** — Owns the review state machine: `cardState` ∈ `prompting | evaluating | correct | incorrect | typo`. `handleSubmit` already calls `announceForAccessibility` for converted answer, correct (`Correct, {label}: {value}`), and incorrect (`Incorrect, correct answer is {answer}`). Typo path clears input, sets `isSubmittingRef=false`, and refocuses input via `requestAnimationFrame`. Correct path sets an auto-advance timer (`REVIEW_CORRECT_AUTO_ADVANCE_MS`); incorrect path renders a "Continue" `Button` (`handleContinueIncorrect`). The `currentItem?.itemId` effect resets all per-item state. **Preserve**: the submit-guard (`isSubmittingRef`), `usePreventRemove`/`BackHandler` exit interception, auto-advance timer cleanup, daily-threshold announcement. **Add**: focus moves on result and on advance; keyboard focus to "Continue".
- **`src/components/review/WanaKanaInput.tsx`** — `forwardRef` exposing `{ focus }`. Synchronous `wanakana.toKana(text,{IMEMode:true})` per keystroke (NFR5 — do not introduce an async boundary). `accessibilityLabel` is mode-aware. `onSubmitEditing={onSubmit}`, `returnKeyType="done"`. **No `submitBehavior` set today → hardware Enter blurs.** Add `submitBehavior="submit"`.
- **`src/components/review/ReviewCard.tsx`** — Renders result/typo states as `accessible` `View`s with `accessibilityLabel` that mirrors the spoken text (`resolveCorrectReveal` keeps display + announcement in agreement — keep this invariant). Renders `ProgressiveHint` for grammar. Add the `accessibilityLiveRegion="polite"` + a forwardable ref for focus targeting.
- **`src/components/review/ProgressiveHint.tsx`** — State machine `revealedCount` 0…N; already calls `announceForAccessibility(level.content)` + remaining-count on reveal; button label via `hintButtonLabel`. Add `accessibilityLiveRegion="polite"` on the revealed panel container.
- **`src/components/review/SessionHeader.tsx`** — Header container is `accessible` with composite label; ✕ exit is a `Pressable` with `accessibilityRole="button"`, label "End session", 44×44 min. Good — leave as-is (reference for AC4).
- **`src/components/review/SessionExitSheet.tsx`** — `Modal` with two `Button`s; `onRequestClose={onKeepGoing}`. On-screen alternative to swipe exists. Verify only.
- **`src/app/(tabs)/index.tsx` (Home)**, **`src/app/(tabs)/learn/index.tsx` (Learn hub)** — Buttons/cards already labelled (`accessibilityLabel`, `accessibilityRole="button"`, 44px min). Audit only; fix any gap found.
- **`src/components/common/Button.tsx`** — Already sets `accessibilityRole="button"`, `accessibilityState={{disabled}}`, label fallback, 44px min. The shared primitive — most on-screen alternatives route through it.

### Key API guidance (React Native 0.83.6 / React 19.2 / Expo SDK 55)

- **Focus management**: `import { AccessibilityInfo, findNodeHandle } from 'react-native'`. Pattern:
  ```ts
  const tag = findNodeHandle(resultRef.current);
  if (tag != null) AccessibilityInfo.setAccessibilityFocus(tag);
  ```
  Gate behind `await AccessibilityInfo.isScreenReaderEnabled()` (or cache via the `screenReaderChanged` listener) so keyboard-only/sighted users are unaffected. `setAccessibilityFocus` re-reads the focused element's label — so if you also `announceForAccessibility` the same string you will double-speak. Prefer **one** mechanism per transition (focus-the-labelled-region OR announce), not both for the same content.
- **`submitBehavior`** (TextInput): RN 0.73+ replaced the boolean `blurOnSubmit` with `submitBehavior: 'submit' | 'blurAndSubmit' | 'newline'`. Single-line default is `'blurAndSubmit'`. Use `'submit'` to fire `onSubmitEditing` and keep focus — required for the keyboard loop where the same field is reused/cleared.
- **`accessibilityLiveRegion`**: Android-only (`'none' | 'polite' | 'assertive'`), no-op on iOS. iOS dynamic announcements come from `AccessibilityInfo.announceForAccessibility(...)` (already in place). Use both for cross-platform parity.
- **Testing (RNTL 13.3.3)**: jest-native matchers are bundled (`toHaveAccessibilityValue`, `toBeDisabled`, etc.). Query by `getByRole`, `getByLabelText`. Mock `AccessibilityInfo`/`findNodeHandle` via `jest.spyOn(require('react-native'), ...)` or a module mock following existing test conventions (see `ProgressiveHint.test.tsx` for the `AccessibilityInfo` mock pattern, `SessionHeader.test.tsx` for label queries).

### Out of scope (belongs to sibling stories — do not pull in)

- Color contrast, 200% text scaling, reduced-motion → **Story 7.2** (`tailwind.config.js` token audit, `KeyboardAvoidingView` scaling, ring animation disable). NFR5b "no inter-item animations" is already satisfied by the existing loop; don't add animations.
- CI a11y linting (`react-native-a11y`/Axe step) → **Story 7.3**.
- Read tab, Stats tab, Settings, onboarding flows are **not** named in the ACs (which scope to Home, Learn, review cycle, results). They already carry a11y props; leave them unless the audit reveals a defect that breaks the review entry path.

### Project Structure Notes

- Components live under `src/components/review/` and `src/components/common/`; routes under `src/app/`. Tests are **co-located** (`Foo.tsx` → `Foo.test.tsx`) per architecture (architecture.md lines 409, 434, 620). No `__tests__/` directory for new tests.
- Styling stays in semantic NativeWind tokens (CLAUDE.md / UX-DR2); accessibility props are JS props, not styles — no token changes expected in this story.
- `core/` purity is irrelevant here (no business-logic changes); all work is in UI components/routes.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.1 (lines 966–984)] — user story + ACs (consolidates 7.1 + 7.4).
- [Source: _bmad-output/planning-artifacts/prd.md#Accessibility (FR52–FR54 lines 134–138; NFR14–NFR17 lines 165–170)].
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Accessibility Strategy (lines 1235–1266)] — screen reader flow, keyboard/input, no gesture-only.
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Implementation Guidelines (lines 1306–1311)] — live regions, focus management, converted-kana announce.
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md (UX-DR6 line 208, UX-DR32 line 234)] via epics.md — input a11y + review focus management.
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Form & Input Patterns (lines 1113–1121)] — submit via Enter / re-prompt refocus.
- [Source: _bmad-output/planning-artifacts/architecture.md (lines 52, 346, 409, 434, 620)] — a11y baked into component architecture; RNTL for component tests; co-located test convention.
- [Source: CLAUDE.md] — dual-DB, NativeWind semantic tokens, `Result<T>` (not needed here), Expo Router structure.

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

### Completion Notes List

- **Audit (Task 1):** Home/Learn/review flows already had comprehensive a11y props. No gaps found requiring prop churn on Home, Learn hub, Learn lists, or `LearnItemRow`. Native tab bar (`NativeTabs` + `Trigger.Label`) delegates selected state to OS tab semantics — no redundant `accessibilityRole`/`accessibilityState` added.
- **Review loop focus (Task 2):** Added `focusScreenReaderOn` util + `resultRef` on `ReviewCard`; SR users get programmatic focus on result states; converted-kana + daily-threshold announcements preserved; correct/incorrect result announcements removed to avoid double-speak with labelled focus targets.
- **Live regions (Task 3):** `accessibilityLiveRegion="polite"` on `ReviewCard` result/typo views and `ProgressiveHint` revealed panels.
- **Keyboard (Task 4):** `submitBehavior="submit"` on `WanaKanaInput`; `Button` forwardRef for Continue auto-focus when SR off.
- **Session exit (Task 5):** Verified — ✕ button, modal buttons, `onRequestClose` all operable; no changes needed.
- **Tests (Task 6):** Extended component tests + new `review/index.test.tsx`; 639 tests green; lint + typecheck pass.

#### Audit findings (element → current a11y → gap → fix)

| Flow / element | Current a11y | Gap | Fix |
|---|---|---|---|
| Home Review/Learn buttons | `accessibilityLabel`, `Button` role, 44px min | None | — |
| Learn hub level cards | `accessibilityRole="button"`, count label | None | — |
| Learn list rows | `accessibilityRole="button"`, form+meaning label | None | — |
| Learn back button | `accessibilityRole="button"`, "Back to Learn hub" | None | — |
| Native tab bar | OS `NativeTabs.Trigger.Label` per tab | None (OS handles selected) | Document only |
| Review result states | `accessible` + `accessibilityLabel` | No SR focus move; no Android live region | `resultRef` + `focusScreenReaderOn`; `accessibilityLiveRegion="polite"` |
| Review answer input | Mode label; `onSubmitEditing` | Hardware Enter blurs field | `submitBehavior="submit"` |
| Incorrect Continue | `Button` a11y | Not auto-focused for keyboard | `forwardRef` + focus when SR off |
| Hint reveals | `announceForAccessibility` on iOS | No Android live region | `accessibilityLiveRegion="polite"` on panel |
| Session exit ✕ / sheet | Button roles, labels, `onRequestClose` | None | Verified only |

### File List

- `mobile/src/app/review/index.tsx` (modified)
- `mobile/src/app/review/index.test.tsx` (added)
- `mobile/src/components/review/ReviewCard.tsx` (modified)
- `mobile/src/components/review/ReviewCard.test.tsx` (modified)
- `mobile/src/components/review/ProgressiveHint.tsx` (modified)
- `mobile/src/components/review/ProgressiveHint.test.tsx` (modified)
- `mobile/src/components/review/WanaKanaInput.tsx` (modified)
- `mobile/src/components/review/WanaKanaInput.test.tsx` (modified)
- `mobile/src/components/common/Button.tsx` (modified)
- `mobile/src/utils/accessibilityFocus.ts` (added)

### Review Findings

- [x] [Review][Decision] Double-announcement: `accessibilityLiveRegion="polite"` + `setAccessibilityFocus` on same result View — resolved: removed `accessibilityLiveRegion` from result Views, keeping `setAccessibilityFocus` as the sole mechanism. [ReviewCard.tsx + index.tsx:149]
- [x] [Review][Patch] Missing cancellation flag in focus-management effect — fixed: added `let cancelled = false` guard checked after each async boundary. [index.tsx:135-165]
- [x] [Review][Patch] `View.focus()` unreliable cross-platform for Continue button — fixed: added `focusable` prop to `Button`'s `Pressable`. [Button.tsx]
- [x] [Review][Patch] `testID="revealed-hint-panel"` duplicated across mapped hint items — fixed: test uses `getAllByTestId` instead of `getByTestId`. [ProgressiveHint.test.tsx]
- [x] [Review][Patch] No screen-reader focus return on `currentItem?.itemId` advance — resolved: `TextInput.focus()` (called via `WanaKanaInputRef.focus()`) moves both DOM and VoiceOver/TalkBack focus on all platforms, unlike `View.focus()`. No additional `setAccessibilityFocus` needed for TextInput. [index.tsx:122-133]
- [x] [Review][Patch] No test asserting Continue button receives keyboard focus — fixed: added assertion that `focusScreenReaderOn` is not called when SR off, plus new test for SR focus on incorrect submit. [index.test.tsx]
- [x] [Review][Defer] No test coverage for cleanup/rapid-state-transition paths — deferred, pre-existing test architecture gap
- [x] [Review][Defer] Typo state a11y label `"Close, try again"` gives no context about what was wrong — deferred, UX decision for future story
- [x] [Review][Defer] No `min-h-[44px]` on ProgressiveHint Pressable and other non-Button controls — deferred, pre-existing sizing across multiple components
- [x] [Review][Defer] AC5 regression test doesn't prove end-to-end romaji→kana→evaluator path — deferred, test architecture choice

### Change Log

- 2026-06-30: Story 7.1 — screen reader focus management in review loop, polite live regions, hardware keyboard operability, audit + regression tests (Epic 7)
