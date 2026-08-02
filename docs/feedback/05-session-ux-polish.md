# Plan 05 — Session UX polish

**Priority:** P2. Four self-contained UI changes with no shared dependencies. Each can ship on its own.

**Feedback addressed:**
> Add an animation like Duolingo where after the first lesson or review it shows a streak fire animation.

> Remove the "8 min across separate apps" after finishing lesson/review.

> Add ability to go back and forth during a lesson. Currently it just shows "Got it — next" and there's no way to check the previous lesson.

> Currently on review or lesson the mnemonic and input is just out there — maybe hide it behind an icon.

---

## 5.1 — Remove the time-compression comparison

`TimeCompressionSummary` (`mobile/src/components/engagement/TimeCompressionSummary.tsx:87`) renders:

```
3 min ≈ ~8 min across separate apps
```

plus a "How is this calculated?" disclosure explaining the estimate is *"deliberately conservative"* — which is itself a tell that the number isn't defensible. The estimate comes from `estimateMultiAppMinutes` (`mobile/src/utils/timeFormat.ts:28`): per-item second-counts from `TIME_COMPRESSION_PER_ITEM_SECONDS`, plus a flat `TIME_COMPRESSION_SESSION_OVERHEAD_MINUTES` when ≥2 domains were touched. It is a made-up number in a fixed ratio to the real one, and it appears at the exact moment the user wants to feel done.

This traces to a PRD-level pillar ("time compression display"), so **confirm the removal with the product owner before deleting.** The feedback is unambiguous, but this is a documented differentiator, not an accident.

**Fix.**

- Delete the `hasSavings` branch and its `estimatedMinutes` / `savedMinutes` copy. Keep the `{actualMinutes} min studied` line, which is true and useful.
- Keep the domain-count chips (Kanji 4 · Vocab 6 · Grammar 1). Those are real.
- Delete `METHODOLOGY_TEXT` and the disclosure `Pressable`.
- `computeTimeCompression` still returns `estimatedMinutes` / `savedMinutes` / `hasSavings`. Check `PostSessionShareCard` and `ShadowModeComparison` before ripping them out of `timeFormat.ts` — the share card may embed the claim too, in which case it goes as well.
- Rename the component. `TimeCompressionSummary` will no longer summarise time compression; it is a `SessionSummaryCard`.

Verify no `_bmad-output/` acceptance criteria assert on the removed string before deleting the assertions in `TimeCompressionSummary.test.tsx`.

---

## 5.2 — Streak animation after a session

`lesson/complete.tsx:32` already animates a `🌱` emblem with `ZoomIn.springify()` and respects `useReducedMotion()`. `StreakCounter` (`mobile/src/components/engagement/StreakCounter.tsx`) already renders `active` / `at-risk` / `broken` states and is already mounted on the home tab (`(tabs)/index.tsx:212`). `recordReviewAndUpdateStreak` already fires on the first graded item of a session (`ReviewSessionProvider.tsx:190`).

Everything exists except the moment of celebration. The pieces are there; they are just never composed.

**Fix.** A `StreakCelebration` component shown once per day, on the first completed session — lesson *or* review.

- `streakRepository` needs to report whether *this* session was the one that incremented the streak. `recordReviewAndUpdateStreak` currently returns a `Result` but the caller ignores the payload. Have it return `{ currentStreak, didIncrementToday }` and thread it onto `sessionSummary`.
- `lesson/complete.tsx` has no streak write at all — a lesson-only day never credits a streak. Decide whether finishing a lesson earns streak credit (recommend: yes, it's study) and call the same repository function from `startLessonItems`' success path.
- Render on `review/summary.tsx` and `lesson/complete.tsx`: a fire emblem scaling in, the streak count counting up from `n-1` to `n`, then the rest of the summary fading in behind it.
- Reanimated is already a dependency and already used here. `ZoomIn` + a `withSequence` scale pulse + `withTiming` opacity is sufficient; no new library.
- **Honour `useReducedMotion()`**, as `lesson/complete.tsx:29` already does. The reduced-motion path shows the same emblem and count, statically.
- Announce via `AccessibilityInfo.announceForAccessibility` — *"3 day streak"* — the pattern `review/index.tsx:174` already uses.
- Show it **once per day.** Persist `last_celebrated_date` (the `streak` table from migration 009 is the natural home). Firing on every session would make it noise by Wednesday.

---

## 5.3 — Navigate backwards during a lesson

`lesson/index.tsx:28`'s `handleNext` only ever increments, and the sole control is one button labelled `'Got it — next'` / `'Finish lesson'`. Once you tap past the radical, you cannot look at it again without abandoning the lesson — and `handleNext` on the last card is what commits the whole batch, so abandoning costs the entire session. The comment at `lesson/index.tsx:17` states this as a feature ("leaving mid-lesson costs nothing"), which is true, and also means there is no way to peek backwards without losing everything.

**Fix.**

- Add a `Back` control, disabled at `index === 0`. `setIndex(i => i - 1)` — nothing is committed until the final card, so backward navigation is free and needs no new state.
- `FadeSlideIn` is keyed on `current.id` (`lesson/index.tsx:99`) so it re-animates on any index change. It animates in one direction only; either accept that or pass a direction prop.
- The progress bar (`lesson/index.tsx:83`) already derives from `index`, so it tracks backwards for free.
- Consider a horizontal swipe (`react-native-gesture-handler` is already present via Expo Router) — but keep the explicit buttons. Swipe-only navigation is undiscoverable, and this screen is also used by screen-reader users.
- The `Back` button must not collide with the `✕` close control at `lesson/index.tsx:74`. Put `Back` in the footer beside `Next`, not in the header.
- Accessibility: both buttons need ≥44pt touch targets (the close button already declares `min-h-[44px] min-w-[44px]`) and `accessibilityState={{ disabled }}` when at the first card. `eslint-plugin-react-native-a11y` gates merge on this.

---

## 5.4 — Collapse the mnemonic behind a disclosure

Two different screens, two different problems, one shared complaint.

**In lessons**, `LessonItemView` composes the full `KanjiDetail` / `RadicalDetail` / etc., each of which renders `mnemonicText` unconditionally (`KanjiDetail.tsx:97`, `RadicalDetail.tsx:38`). Everything is on screen at once: form, meaning, readings, mnemonic, dependencies.

**In reviews**, `ReviewCard`'s prompting state (`ReviewCard.tsx:126`) shows form, mode label, and stage indicator — no mnemonic. Only grammar items get a `ProgressiveHint`. So on the review screen, the complaint is really about the **input field and the "Don't know" affordance** sitting permanently below the card (`review/index.tsx:370`), which crowds the focal character.

Treat them separately.

**Lessons.** Wrap the mnemonic in a collapsible disclosure — collapsed by default, chevron + "Mnemonic" label, tap to expand. Use `mobile/src/components/common/Disclosure.tsx` (the Design System v2 disclosure); the Expo-template `ui/collapsible.tsx` this note originally pointed at was deleted in the v2 restyle. Expanding it once should be remembered for the session (not persisted) so a user who wants mnemonics doesn't tap four times per lesson. Radicals are the exception: `RadicalDetail` pairs the mnemonic with its `MnemonicImage`, and the image *is* the mnemonic for radicals — keep that visible.

Note this interacts with **Plan 03 §3.5** (full item detail on the incorrect reveal). That reveal will reuse these same detail components. Decide the disclosure default once: recommend **collapsed in lessons** (the user is reading, not recalling) and **expanded on an incorrect reveal** (the user just failed and needs the hook). Same component, different default via prop.

**Reviews.** Give the input a resting state and a focused state rather than hiding it — an always-visible input the user cannot type into is worse than one that expands. Tighten the layout instead: reduce the input's visual weight when `cardState !== 'prompting'`, and move "Don't know" behind a subtler affordance. Do **not** hide the input behind a tap. `review/index.tsx:129` autofocuses it on every card precisely so the review loop stays keyboard-driven and hits the <100ms feel target; a tap-to-reveal input would add a tap per item.

---

## Acceptance criteria

- No session summary anywhere in the app renders a comparison against "separate apps."
- Completing the first lesson **or** review of a day plays a streak animation exactly once; the second session that day does not.
- The streak animation respects `useReducedMotion()` and announces to screen readers.
- Finishing a lesson credits the daily streak.
- A lesson can be navigated backwards to the first item and forwards again without committing or losing progress.
- The `Back` control is disabled and correctly labelled at the first item.
- Mnemonics are collapsed by default in lessons and expanded by default on an incorrect review reveal.
- The review input remains focused and typable on card entry; no added taps per item.
- `npm run lint` (a11y rules) and `npm run check-contrast` pass.

## Files touched

- `mobile/src/components/engagement/TimeCompressionSummary.tsx` → `SessionSummaryCard.tsx`
- `mobile/src/components/engagement/PostSessionShareCard.tsx`
- `mobile/src/components/engagement/StreakCelebration.tsx` *(new)*
- `mobile/src/components/engagement/StreakCounter.tsx`
- `mobile/src/utils/timeFormat.ts`
- `mobile/src/data/user/streakRepository.ts`
- `mobile/src/data/user/lessonProgressRepository.ts`
- `mobile/src/app/lesson/index.tsx`
- `mobile/src/app/lesson/complete.tsx`
- `mobile/src/app/review/summary.tsx`
- `mobile/src/app/review/index.tsx`
- `mobile/src/components/learn/KanjiDetail.tsx`, `RadicalDetail.tsx`, `VocabularyDetail.tsx`, `GrammarDetail.tsx`
- `mobile/src/components/common/Disclosure.tsx`
