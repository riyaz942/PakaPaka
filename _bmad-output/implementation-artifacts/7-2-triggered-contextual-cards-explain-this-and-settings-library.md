---
baseline_commit: 4db88dcb224ae2096266f64c12123d9c49404d12
---

# Story 7.2: Triggered Contextual Cards, Explain-This Affordances & Settings Library

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a learner already using the app,
I want the app's non-obvious behavior explained the moment I actually hit it, plus an "explain this" button wherever that behavior shows up, and a full list in Settings,
so that I understand why the app just did something instead of assuming it's broken or hunting for an explanation.

## Acceptance Criteria

1. **Six new cards, one registry.** `GUIDANCE_CARDS` in `components/onboarding/cardRegistry.ts` grows by six entries — no second list, no new registry file, and no `if (cardId === …)` anywhere outside that file:

   | id | trigger | fires when | also reachable from |
   | --- | --- | --- | --- |
   | `first-miss` | `contextual` | the first review answer graded incorrect | Settings library |
   | `spaced-repetition` | `contextual` | the first review card whose item has been graded before | SRS stage affordance + Settings library |
   | `passage-locks` | `contextual` | Browse first renders a locked passage row | Settings library |
   | `goal-overshoot` | `contextual` | Home's goal ring first renders above 100% | Home goal-card affordance + Settings library |
   | `furigana-auto-hide` | `contextual` | a vocabulary detail first renders a mastered word with furigana auto-hidden | furigana-control affordance + Settings library |
   | `two-card-kanji` | `library-only` | never fires unprompted | review card header affordance + Settings library |

   The two `'onboarding-deck'` cards from Story 7.1 keep their ids, titles, order and trigger. `day-one.tsx` filters on `trigger === 'onboarding-deck'`, so it must keep working with **zero** changes.

2. **Cards may name the thing that triggered them.** `Render` widens from `ComponentType` to `ComponentType<GuidanceCardProps>` where `GuidanceCardProps = { subject?: string }`. `spaced-repetition` is the only card that reads it: given `subject`, it names that item ("You saw 水 a few days ago…"); with no subject — the Settings library — it renders the same explanation without the example line. This is two authored modes, not a degraded one: nothing is missing when `subject` is absent, and no substitute item is invented.

3. **Each contextual card fires at most once, unprompted.** Firing is gated by a new hook `data/hooks/useGuidanceCard.ts`:
   ```ts
   useGuidanceCard(cardId: GuidanceCardId, active: boolean): { visible: boolean; dismiss: () => void }
   ```
   - The first time `active` is true on a mounted surface, the hook reads `isCardSeen`. Unseen → `markCardSeen` **and** show. Already seen → never show.
   - Seen is written the moment the card becomes visible, not on dismiss (Story 7.1 AC #8, `useKanjiReadingPrimer.ts:56`).
   - Each mounted surface decides once: after it has decided, a later `active` swing never re-fires it, so a session that produces ten wrong answers shows `first-miss` once.
   - `active` going false hides the card (the review notice must not sit over the next prompt).
   - `dismiss()` hides it and it stays hidden.

4. **Auto-fired cards render inline; tapped cards open the sheet.** One rule, applied everywhere:
   - **Fired by a trigger** → a new `components/common/GuidanceCardNotice.tsx` renders the card inline at the surface that triggered it, with a dismiss control. Non-blocking: it never gates the action that triggered it, never steals focus, and is always dismissable in one tap. Precedent for auto-appearing guidance being inline rather than modal: `DailyThresholdNotice` (the only thing that auto-appears on the review screen today) and `KanjiReadingPrimer` ("deliberately *not* a wall in front of the lesson"). A `Modal` auto-opening over the review screen would fight the incorrect-reveal's `continueButtonRef.current?.focus()` / `focusScreenReaderOn(resultRef)` choreography at `app/review/index.tsx:205-232`.
   - **Tapped by the learner** (every "explain this" affordance, every Settings library row) → the existing `ExplainerSheet`. No second sheet or modal primitive is created.

5. **`ExplainerSheet` gains a card mode without changing its FR73 API.** Props become a discriminated union — either `{ topic: ExplainerTopic }` (unchanged; `SectionHeading.tsx:53` must not be touched) or `{ title: string; children: ReactNode }`. Same `Modal`, same chrome, same close button, same a11y labels. No `any`, no non-null assertions, no separate copy of the sheet markup.

6. **Explain-this affordances.** A new `components/common/GuidanceInfoButton.tsx` — the registry-card twin of `SectionHeading`'s `infoTopic` wiring (`SectionHeading.tsx:44-60`): an `Icon name="info"` `Pressable`, `accessibilityRole="button"`, `accessibilityLabel={`Explain: ${card.title}`}`, `min-h-[44px] min-w-[44px]`, opening `ExplainerSheet` on the matching registry card. Placed at exactly four surfaces:
   - Home's goal card, beside "Today's goal" → `goal-overshoot`
   - `SRSStageIndicator` (new optional `infoCardId` prop, passed only by `ReviewCard`) → `spaced-repetition`
   - `FuriganaOverrideControl`, beside its "Furigana for this word" heading → `furigana-auto-hide`
   - `ReviewCard`'s prompt kicker, **only when `item.isTwoCardItem`** → `two-card-kanji`, opening without leaving the review session

7. **`GoalRing.tsx` and `FuriganaText.tsx` are deliberately not modified.** The epic names them; both are leaf renderers used far beyond the surface the affordance belongs to — `GoalRing` also renders at 32px inside `SessionHeader` (no room for a 44pt button), and `FuriganaText` renders review prompts, passage bodies, browse rows and chat bubbles (an embedded info button would appear in all of them). The affordance goes on the surrounding control instead: Home's goal card and `FuriganaOverrideControl`. Record this in the completion notes, the same way Story 7.1 recorded its two deviations.

8. **Trigger conditions, exactly.**
   - `first-miss`: `app/review/index.tsx`, `active = cardState === 'incorrect'`. Covers both the wrong-answer path and "Don't know" — both set that state. Non-terminal states (`typo`, `wrong_script`, `wrong_reading_type`) are **not** misses and must not fire it.
   - `spaced-repetition`: `app/review/index.tsx`, `active = (currentItem?.srsState.reps ?? 0) >= 1` — the item has been graded before, so this is a genuine repeat. `reps === 0` is the first review after a lesson, which nobody finds surprising.
   - `passage-locks`: `app/(tabs)/browse/index.tsx`, `active = rows.some((row) => row.kind === 'passage' && row.locked)`. Note the discriminant is `kind`, not `rowType` (`browseRepository.ts:54`).
   - `goal-overshoot`: `app/(tabs)/index.tsx`, `active = isOvershoot` from `useCognitiveLoad()` (already computed at `useCognitiveLoad.ts:86` — destructure it, do not recompute `percent > 100`). Suppressed while `onVacation`, matching the ring itself.
   - `furigana-auto-hide`: `components/learn/VocabularyDetail.tsx`, `active = isKnownWord && modeForItem(item.id) === 'auto'` — mastery is what hid the reading, and an explicit per-word override means it was not auto-hidden.

9. **Settings "How this works".** A new section in `app/(tabs)/settings.tsx`, above the `__DEV__` block, headed by `<SectionHeading label="How this works" />` and listing **every** `GUIDANCE_CARDS` entry in registry order — deck cards included — one tappable row each. Tapping opens `ExplainerSheet` on that card, regardless of seen-state. The library **never writes `card_seen`**: reading the manual does not consume the just-in-time moment. Not `ChoiceCard` — it is a radio (`accessibilityRole="radio"`, required `selected` prop, `ChoiceCard.tsx:36-38`) and nothing here is being selected.

10. **Nothing branches on a card id outside the registry.** Settings renders `GUIDANCE_CARDS` unfiltered; the day-1 deck and contextual triggers filter on `trigger`. Affordances name the one card they explain — that is a reference, not a branch. A seventh card must be one array entry plus (if contextual) one trigger call.

11. **No new migration, no new route, no new table.** `card_seen` and `cardSeenRepository` ship as-is from Story 7.1; the expo-sqlite mock already has both `card_seen` branches. The Settings library is a section, not a screen, so `.expo/types/router.d.ts` needs no regeneration and no `router.push` is added.

12. **Story 7.1's shipped surfaces are untouched.** `app/onboarding/day-one.tsx`, `cards/ThreeScriptsCard.tsx`, `cards/WordSpacingCard.tsx`, `data/migrations/019_card_seen.ts`, `data/user/cardSeenRepository.ts` and their tests must not appear in this story's diff (except `cardRegistry.test.ts`, which gains cases). Likewise `useKanjiReadingPrimer.ts`, `useKanjiReadingPrimer.test.tsx`, `KanjiReadingPrimer.tsx` and `seenKanjiReadingPrimer` (Story 7.1 AC #11 still holds — FR74's in-lesson primer stays exactly as it is).

13. **Verify green.** `npm run lint && npm run typecheck && npm test` in `mobile/`. No new colour tokens, so repo-root `npm run check-contrast` is expected unaffected — run it only if you touch a token.

**Explicitly out of scope (do not implement):**

- **WaniKani-diff deck for importers, glossary card for manual-path learners** (brainstorm SYNTHESIS-6). Raised, not chosen.
- **Trust cards** (who-made-this, no-account-means-no-cloud-backup) — those track `docs/design/backup-and-web-plan.md` / Epic 9.
- **Shareable-image export, replay-count badge, "last card doubles as Start button".**
- **Moving or renaming Story 7.1's files** — `components/onboarding/cardRegistry.ts` and `cards/` now hold app-lifetime cards, which reads oddly, but relocating them would balloon the diff for zero behaviour change. Add the new card bodies alongside the existing two and leave the paths alone.
- **A global touch-target audit.** `deferred-work.md:133` suggests "story 7.2 or a dedicated pass" for `ProgressiveHint` and other non-`Button` controls. Not this story — only the controls you add must clear 44pt.
- **Duplicating FR60's reading-readiness framing.** The `passage-locks` card explains why locks exist; `ReadingReadiness.tsx` already renders the "N items away" destination meter and must not be changed.

## Tasks / Subtasks

- [x] **Task 1 — Registry: six new cards (AC: #1, #2, #10)**
  - [x] `components/onboarding/cardRegistry.ts`: widen `GuidanceCardId` with the six ids from AC #1; add `export type GuidanceCardProps = { subject?: string }`; change `Render` to `ComponentType<GuidanceCardProps>`. Keep the `import type { ComponentType } from 'react'` form already there.
  - [x] Append the six entries after the two deck entries. Titles (use these — they are the Settings library's row labels and the sheet headings): `first-miss` → "Getting it wrong is the point", `spaced-repetition` → "Why items come back", `passage-locks` → "Locked passages are a destination", `goal-overshoot` → "Past 100% is the good part", `furigana-auto-hide` → "Where the readings went", `two-card-kanji` → "Why kanji ask twice".
  - [x] `cardRegistry.test.ts`: keep the three existing cases passing untouched; add — the deck filter still returns exactly `['three-scripts', 'word-spacing']` in order; `'contextual'` returns exactly the five ids from AC #1; `'library-only'` returns exactly `['two-card-kanji']`; every card's `trigger` is one of the three union members.

- [x] **Task 2 — Card bodies (AC: #2)**
  - [x] `components/onboarding/cards/GuidanceCardBody.tsx`: presentational prose renderer, `{ paragraphs: string[] }` → stacked `<Text className="text-body font-ui text-secondary">`, `gap-space-sm`. Same copy shape as `explainerContent.ts` / `KanjiReadingPrimer.tsx`. No title (the notice and the sheet each own the heading).
  - [x] One file per card, each a thin wrapper over `GuidanceCardBody`: `FirstMissCard.tsx`, `PassageLocksCard.tsx`, `GoalOvershootCard.tsx`, `FuriganaAutoHideCard.tsx`, `TwoCardKanjiCard.tsx`.
  - [x] `SpacedRepetitionCard.tsx` takes `{ subject }` (AC #2): with a subject, lead with a line naming it; without, start at the general explanation. No placeholder copy for the absent case.
  - [x] Copy must be true to the shipped mechanics, not aspirational — check each against the code before writing it: `first-miss` (a miss reschedules the item sooner, it is not a strike; `gradeForResult('incorrect')`), `spaced-repetition` (correct answers push the next sighting further out; stage names come from `SRSStageIndicator`), `passage-locks` (a passage opens once ≥90% of its linked vocabulary *and grammar* items are at Guru or above — `core/content/passageUnlock.ts:53`, `PASSAGE_UNLOCK_COVERAGE = 0.9`; the row stays tappable meanwhile — `PassageBrowseRow.tsx:14-19`), `goal-overshoot` (the ring is unclamped, never drops, and rises only by prompt — FR55/FR57, `GoalRing.tsx:31-40`), `furigana-auto-hide` (keyed on **that word's** mastery, never its component kanji — FR78; tap is a stateless peek and Settings holds a persistent per-word override — FR79), `two-card-kanji` (meaning card + on'yomi card, worst-of-both applied once — FR81/FR83; kun'yomi is learned through vocabulary).
  - [x] `GuidanceCardBody.test.tsx`: renders every paragraph. `SpacedRepetitionCard.test.tsx`: with `subject="水"` the rendered text contains 水; without a subject it renders the explanation and no leftover placeholder.

- [x] **Task 3 — Trigger hook (AC: #3)**
  - [x] `data/hooks/useGuidanceCard.ts` exactly as AC #3 specifies. Single effect keyed on `[active, cardId, userDb]`; a `settledRef` so the surface decides once; `setVisible(false)` when `active` is false; `dismiss` a `useCallback`. Reads `useDatabase()` for `userDb`, calls `isCardSeen` / `markCardSeen` from `data/user/cardSeenRepository`.
  - [x] No module-level session latch (unlike `useKanjiReadingPrimer`): `visible` is held in this instance's state and is not re-derived from the flag, so the remount problem the primer's latch solves cannot occur here. Say so in a comment.
  - [x] `useGuidanceCard.test.tsx`: follow `useKanjiReadingPrimer.test.tsx`'s harness (`createUserDb` + `DatabaseContext.Provider` wrapper, `migration001Initial` **plus** `migration019CardSeen`). Cases: inactive → hidden and nothing written; active + unseen → visible and `isCardSeen` reads back true; active + already seen → never visible; active false→true→false→true fires once only; `dismiss()` hides and a later `active` swing does not bring it back.

- [x] **Task 4 — Rendering surfaces (AC: #4, #5, #6)**
  - [x] `components/common/ExplainerSheet.tsx`: props → the AC #5 union. Resolve heading/body from `props.topic ? EXPLAINER_CONTENT[props.topic] : props` and keep every existing class, `testID="explainer-sheet"`, `testID="explainer-sheet-close"` and a11y label string. Do **not** touch `SectionHeading.tsx`.
  - [x] `ExplainerSheet.test.tsx` (**new file** — the component ships untested today; `SectionHeading.test.tsx` is its only current coverage): a topic case asserting title + paragraphs render and Close dismisses, and a `title` + `children` case asserting the heading and child content render and Close still dismisses.
  - [x] `components/common/GuidanceCardNotice.tsx`: `{ card: GuidanceCard; subject?: string; onDismiss: () => void }`. Chrome from `KanjiReadingPrimer.tsx` (`rounded-radius-lg border border-border bg-surface p-space-lg`, `accessibilityRole="header"` title) plus `DailyThresholdNotice`'s dismiss (`Icon name="close"`, `accessibilityLabel="Dismiss"`, `min-h-[44px] min-w-[44px]`, `hitSlop={8}`). `testID="guidance-card-notice"` and `testID={`guidance-card-notice-${card.id}`}`. Renders `card.Render` with `subject`.
  - [x] `components/common/GuidanceInfoButton.tsx`: `{ cardId: GuidanceCardId; testID?: string }`. Looks the card up in `GUIDANCE_CARDS`, holds `sheetVisible` state, renders the info `Pressable` + `ExplainerSheet` exactly as `SectionHeading.tsx:44-60` does. If the id is not in the registry the type system has already failed — no runtime fallback UI.
  - [x] `GuidanceCardNotice.test.tsx` / `GuidanceInfoButton.test.tsx`: notice renders title + body and calls `onDismiss`; button opens the sheet with the card's title and closes again.

- [x] **Task 5 — Review-screen triggers and affordances (AC: #6, #8)**
  - [x] `app/review/index.tsx`: two `useGuidanceCard` calls — `('first-miss', cardState === 'incorrect')` and `('spaced-repetition', (currentItem?.srsState.reps ?? 0) >= 1)`. Both hooks must be called unconditionally at the top of the component (beside `useAnswerCollision()` at `index.tsx:77`), above the `isLoading` / `error` / `totalItems === 0` / `isComplete` / `!currentItem` early returns that start at `index.tsx:408` — a hook after a conditional return is the failure mode here.
  - [x] Render both notices inside the existing `ScrollView` (`testID="review-focal-scroll"`), directly below `<ReviewCard>`, each guarded on its `visible`. Pass `subject={currentItem.primaryForm}` to the `spaced-repetition` notice. Do not touch the bottom action block, the focus effects, or `submitAnswer`.
  - [x] `components/common/SRSStageIndicator.tsx`: add `infoCardId?: GuidanceCardId` to `SRSStageIndicator`'s props only. When set, wrap the existing `<Text>` and a `GuidanceInfoButton` in a `flex-row items-center gap-space-xs` `View`; when unset the output is byte-identical to today. `SRSStagePill`, `SRSStageDot` and `SRSStageTransitionBadge` are unchanged.
  - [x] `components/review/ReviewCard.tsx`: pass `infoCardId="spaced-repetition"` at `ReviewCard.tsx:253`. Wrap the mode-label kicker (`ReviewCard.tsx:247-249`) in a `flex-row items-center gap-space-xs` `View` and render `<GuidanceInfoButton cardId="two-card-kanji" />` beside it **only when `item.isTwoCardItem`**. Keep `MODE_LABEL_CLASS[promptType]` on the `Text` — the kicker's hue is load-bearing.
  - [x] Tests: `review/index.test.tsx` — a wrong answer shows the `first-miss` notice once and it is gone after Continue; a second wrong answer in the same session does not re-show it; an item with `reps: 2` shows the `spaced-repetition` notice naming its `primaryForm`; `reps: 0` shows nothing. `ReviewCard.test.tsx` — the two-card affordance renders for `isTwoCardItem: true` and is absent otherwise; existing cases stay green.

- [x] **Task 6 — Home, Browse and vocabulary-detail triggers (AC: #6, #8)**
  - [x] `app/(tabs)/index.tsx`: destructure `isOvershoot` from the existing `useCognitiveLoad()` call (`index.tsx:166-173`); `useGuidanceCard('goal-overshoot', isOvershoot && !onVacation)`. Render the notice directly below the goal-ring hero card (after the `</FadeSlideIn>` closing the block that opens at `index.tsx:366`, before the `GoalRisePrompt` at line 401), and add `<GuidanceInfoButton cardId="goal-overshoot" />` in a row with the "Today's goal" `Text` (`index.tsx:391-393`). The vacation arm keeps its current content.
  - [x] `app/(tabs)/browse/index.tsx`: `useGuidanceCard('passage-locks', rows.some((row) => row.kind === 'passage' && row.locked))`. Render the notice between the result-count `Text` (`browse/index.tsx:193-199`) and the `View` wrapping `BrowseList` — outside the `FlatList`, never as a list row.
  - [x] `components/learn/VocabularyDetail.tsx`: `useGuidanceCard('furigana-auto-hide', isKnownWord && modeForItem(item.id) === 'auto')`, notice rendered directly above `<FuriganaOverrideControl itemId={item.id} />` (`VocabularyDetail.tsx:69`).
  - [x] `components/learn/FuriganaOverrideControl.tsx`: wrap its `<SectionHeading label="Furigana for this word" />` (`FuriganaOverrideControl.tsx:43`) in a `flex-row items-center gap-space-xs` `View` with `<GuidanceInfoButton cardId="furigana-auto-hide" />`. Leave `SegmentedPill`, `choose()` and the override semantics alone.
  - [x] Tests: Home — overshoot percent shows the notice, ≤100% does not, vacation mode does not. Browse — a locked passage row in `rows` shows it, an unlocked-only list does not. `VocabularyDetail.test.tsx` — known word in `auto` shows it; known word with a `'shown'` override does not; unknown word does not.

- [x] **Task 7 — Settings "How this works" library (AC: #9)**
  - [x] `app/(tabs)/settings.tsx`: new section above the `__DEV__` block (`settings.tsx:449`). `<SectionHeading label="How this works" />`, a one-line `text-caption font-ui-medium text-muted` lede matching the other sections' voice, then `GUIDANCE_CARDS.map(...)` inside `SettingsCard` / `CardDivider`.
  - [x] The row is a new local component in this file, beside the existing `SettingsCard` / `CardDivider` helpers (`settings.tsx:80-90`): a `Pressable` with `accessibilityRole="button"`, `accessibilityLabel={`Explain: ${card.title}`}`, `min-h-[44px]`, the title in `text-body font-ui-medium text-primary`, and `testID={`settings-guidance-card-${card.id}`}`. `onPress` sets a local `openCardId` state.
  - [x] One `ExplainerSheet` for the section, driven by `openCardId` — not one sheet per row.
  - [x] `settings.test.tsx`: every registry card has a row (assert against `GUIDANCE_CARDS.length`, not a hardcoded 8); tapping a row opens the sheet with that card's title; the library does not write `card_seen` (assert `isCardSeen` stays false after opening a card).

- [x] **Task 8 — Verify (AC: #11, #12, #13)**
  - [x] `git diff --stat` and confirm the AC #12 files are absent.
  - [x] `npm run lint` — a11y rules block merge; every new `Pressable` carries `accessibilityRole="button"`, a label, and a 44pt target.
  - [x] `npm run typecheck` — clean, with no `any` and no non-null assertion introduced by the `ExplainerSheet` union.
  - [x] `npm test` — full suite. `day-one.test.tsx`, `useKanjiReadingPrimer.test.tsx`, `SectionHeading.test.tsx`, `ThreeScriptsCard.test.tsx` and `WordSpacingCard.test.tsx` must all pass untouched.

### Review Findings

- [x] [Review][Decision→Patch] `spaced-repetition` notice never hid across consecutive repeat items — the AC #8 trigger `(reps ?? 0) >= 1` stays true all session in a mature queue, so the `active → false` hide path was unreachable and the notice sat over subsequent prompts with `subject` silently swapping. Resolved: the screen tracks the item the notice fired for (`srShownItemId`), gates the render on it, and dismisses once the session advances — the notice can never sit over the next prompt. Covered by "hides the repeat notice when the session advances to another repeat item".
- [x] [Review][Decision→Patch] Two notices could stack on the incorrect reveal of a repeat item, with duplicate `guidance-card-notice` / `guidance-card-notice-dismiss` testIDs. Resolved: `spaced-repetition`'s `active` now carries `&& cardState !== 'incorrect'` — first-miss owns the incorrect reveal. Covered by "shows only the miss card when a repeat item is answered incorrectly".
- [x] [Review][Patch] Auto-appearing notices were never announced to screen readers, yet the once-ever seen flag is consumed on mount — added `accessibilityLiveRegion="polite"` to the notice container [mobile/src/components/common/GuidanceCardNotice.tsx:30]
- [x] [Review][Patch] Unguarded sync SQLite in the trigger hook — `settledRef` latched before `isCardSeen`/`markCardSeen`, so a throw both crashed the screen and permanently killed the card for that mount. Now try/caught and fail-closed: a failed read does not settle the surface, so a later `active` swing retries [mobile/src/data/hooks/useGuidanceCard.ts:37-50]
- [x] [Review][Patch] Vacation race fix re-opened on the read-error branch — `catch { paused = false }` still ran `setVacationResolved(true)`, letting `goal-overshoot` fire and mark seen for a learner who is actually paused. `setVacationResolved(true)` now runs only on a successful read [mobile/src/app/(tabs)/index.tsx:283-291]
- [x] [Review][Defer] `passage-locks` fires on fail-closed placeholder locks — when `listPassageUnlockStates` throws, every passage row maps `locked: true` and the card consumes its once-ever flag over a broken list [mobile/src/app/(tabs)/browse/index.tsx:76-79] — deferred, pre-existing fail-closed pattern in useBrowseItems; fixing needs unlock-load-state plumbing beyond this story's scope

## Dev Notes

### What this story actually is

Story 7.1 built the registry and proved it with two cards on one screen. This story is the payoff: the same array now feeds five just-in-time triggers, four "ask me" affordances and a Settings index — **three surfaces, one list**, which was the whole point of the structure. The code you write is mostly small: one hook, two presentational components, six prose files, and a three-to-six-line addition at each of seven call sites. If any single file grows large, you have taken a wrong turn.

The failure mode to avoid is the opposite of 7.1's: not under-structuring, but over-plumbing. There is no trigger registry, no event bus, no provider. Each surface already knows its own condition; it calls one hook with a boolean.

### Why inline for triggers and a sheet for taps

This is the one design decision in the story worth understanding rather than following.

The review screen runs a careful focus dance on every answer (`app/review/index.tsx:196-232`): on `incorrect` it focuses the Continue button for sighted users and `focusScreenReaderOn(resultRef)` for VoiceOver/TalkBack, then re-focuses the input for non-terminal states. An RN `Modal` opening in that window takes focus away and hands it back somewhere unpredictable on dismiss — and the keyboard is still up. The codebase already resolved this tension once: the only thing that auto-appears during a review is `DailyThresholdNotice`, an inline banner; the two modals on that screen (`SessionExitSheet`, and the nested detail sheets) are both user-initiated. `KanjiReadingPrimer` made the same call for lessons, in its own words "deliberately *not* a wall in front of the lesson".

So: **the app explains itself in place, and you can also ask.** Triggered → inline. Tapped → sheet. Applying that rule uniformly (including on Home and Browse, where a modal would technically have worked) is what keeps it a rule rather than a per-surface judgement call.

This does not violate the epic's "reuses the existing `ExplainerSheet` … no new sheet/modal primitive": that clause governs the explain-this affordances, which do use `ExplainerSheet`. `GuidanceCardNotice` is not a sheet or a modal.

### Reuse map — do not rebuild any of these

| Need | Use | Where |
| --- | --- | --- |
| Bottom-sheet chrome for a tapped card | `ExplainerSheet` (extended, not replaced) | `components/common/ExplainerSheet.tsx` |
| Info-button → sheet wiring to copy verbatim | `SectionHeading`'s `infoTopic` branch | `components/common/SectionHeading.tsx:44-60` |
| Inline card chrome (border, surface, header) | `KanjiReadingPrimer` | `components/lesson/KanjiReadingPrimer.tsx:16-30` — read it, then leave the file alone |
| Inline dismiss control (icon, hitSlop, 44pt) | `DailyThresholdNotice` | `components/engagement/DailyThresholdNotice.tsx:37-48` |
| Seen-state read/write | `isCardSeen` / `markCardSeen` | `data/user/cardSeenRepository.ts` — already shipped, already mocked |
| "Mark seen the moment it is visible" reasoning | `useKanjiReadingPrimer.ts:56` | read it for the rule, do not import or edit it |
| Settings section shell and card chrome | `SettingsCard` / `CardDivider` | `app/(tabs)/settings.tsx:80-90` (local helpers; the library row is a third one beside them) |
| Info icon | `Icon name="info"` | `components/common/Icon.tsx:133` |
| Whether the ring is past goal | `isOvershoot` from `useCognitiveLoad()` | `data/hooks/useCognitiveLoad.ts:86` — already returned, currently unused by Home |
| Whether this word is mastered | `useIsKnownWord` | `data/hooks/useIsKnownWord.ts` — already called in `VocabularyDetail` |
| Effective furigana mode for one word | `modeForItem` | `data/hooks/useFuriganaPreference.ts:73` — already called in `VocabularyDetail` |

Every one of the trigger conditions is computed from state the target file **already has in scope**. If you find yourself adding a query, a repository function or a new hook call to get a trigger condition, re-read the file — the value is already there.

### Files being changed — current state and what must survive

**`components/common/ExplainerSheet.tsx` (UPDATE).** One caller today: `SectionHeading`, passing `topic`. The union must keep that call compiling and rendering identically — `EXPLAINER_CONTENT[topic]` supplies both the title and the paragraph styling (first paragraph has no top margin, the rest get `mt-space-md`). In card mode the children own their own spacing; keep them inside the same `ScrollView`.

**`components/common/SRSStageIndicator.tsx` (UPDATE).** Four exports; only `SRSStageIndicator` (the plain text one at the bottom, used solely by `ReviewCard.tsx:253`) gains a prop. `SRSStageDot` is on every Browse row and `SRSStagePill` on every detail header — an info button there would be noise, and neither is in scope.

**`components/review/ReviewCard.tsx` (UPDATE).** Two touch points: the kicker `Text` at line 247 and the `SRSStageIndicator` at line 253. Note the early return for `state === 'incorrect'` at line 181 — it renders `IncorrectReveal` and never reaches the kicker, so the stage affordance is naturally absent on the miss reveal. That is correct; do not "fix" it by adding one to `IncorrectReveal`.

**`app/review/index.tsx` (UPDATE).** 665 lines with five early returns. Add the two hook calls in the top block near the other hooks (after `useAnswerCollision()`, line 77) and the two notices inside the `ScrollView` that starts at line 516. Nothing else. In particular: `submitAnswer`'s dependency array, `flushPendingGrade`, `usePreventRemove` and the `useFocusEffect` back-handler are all load-bearing and unrelated.

**`app/(tabs)/index.tsx` (UPDATE).** The goal card sits in the `else` arm of the `onVacation` ternary that opens at line 366 (ring at line 390, "Today's goal" at 391-393). The vacation arm renders 休 and a Settings link — the overshoot notice must not appear there, which is why `active` carries `&& !onVacation`.

**`app/(tabs)/browse/index.tsx` (UPDATE).** `rows` comes from `useBrowseItems()` and is filtered/paged, so "renders a locked passage" genuinely means "a locked passage is in the current result set". A filter that excludes passages simply makes `active` false; that is the intended reading of the AC, not a bug to work around.

**`components/learn/VocabularyDetail.tsx` (UPDATE).** `isKnownWord` and `modeForItem` are already destructured at lines 49-50. One hook call, one notice.

**`components/learn/FuriganaOverrideControl.tsx` (UPDATE).** 50 lines. The `SectionHeading` line only. Do not fold the affordance into `SectionHeading`'s `infoTopic` — that prop is typed to `ExplainerTopic`, and widening it would put guidance-card copy into `explainerContent.ts`, i.e. a second list.

**`app/(tabs)/settings.tsx` (UPDATE).** 467 lines, sections separated by `<View className="mt-space-lg">`. `SettingsCard` and `CardDivider` are local helpers (lines 80-90). The new section follows the same shape. `handleResetOnboarding` (`settings.tsx:215`) clears `onboarding_completed` and not `card_seen` — unchanged and out of scope, but worth knowing: replaying onboarding does not resurrect the deck, and the library is how those two cards stay reachable.

**READ ONLY — do not edit:** `app/onboarding/day-one.tsx` (proves the deck filter still works), `components/common/SectionHeading.tsx` (the pattern you copy), `components/lesson/KanjiReadingPrimer.tsx`, `data/hooks/useKanjiReadingPrimer.ts`, `data/user/cardSeenRepository.ts`, `components/engagement/ReadingReadiness.tsx`, `components/browse/PassageBrowseRow.tsx`, `components/engagement/GoalRing.tsx`, `components/common/FuriganaText.tsx`.

### Writing the copy

Six cards of prose is the largest authored surface in this story, and wrong copy is worse than no copy — a card that misdescribes the mechanism teaches the learner to distrust the app. Rules:

- **Check the mechanic before you describe it.** Each card's bullet in Task 2 names the code that implements it. Read it. The `passage-locks` copy in particular must reflect what `core/content/passageUnlock.ts` actually computes — 90% of the passage's linked items (vocabulary *and* grammar) at Guru or above — not a vague "study more items".
- **Two to three short paragraphs.** These render inside a review card and a bottom sheet on a phone. `explainerContent.ts` is the length target.
- **Second person, present tense, no exclamation marks.** Match the existing voice: "Burned does not mean forgotten-proof." / "You don't need to memorise which is which up front."
- **Never blame or congratulate.** `first-miss` reframes, it does not console. `goal-overshoot` confirms, it does not cheer.
- **No forward promises.** Describe only what ships today.

### Testing

- **Screen tests** follow `intensity.test.tsx` / `day-one.test.tsx`: `__mockResetSqlite()`, `openDatabaseAsync`, `runMigrations(db, [migration001Initial, …, migration019CardSeen])`, render inside `SafeAreaProvider` (with `initialMetrics`) + `DatabaseContext.Provider`. **Every screen test that renders a surface with a trigger now needs migration 019 in its list** — a `SELECT … FROM card_seen` against a database without the table throws on device. The mock hides this (see below), so a missing migration will not fail locally; add it anyway.
- **Hook test** follows `useKanjiReadingPrimer.test.tsx`'s `renderHook` + wrapper harness (`data/hooks/useKanjiReadingPrimer.test.tsx:21-48`).
- **Component tests** follow `SectionHeading.test.tsx` / `ExplainerSheet.test.tsx`: no curriculum dependency, assert on rendered copy and on the sheet opening.
- **Assert seen-state through `isCardSeen`**, never by asserting that a component called `markCardSeen`. Story 7.1's dev notes flag this as the single most likely way the work ships broken.
- **The one mock trap left for this story:** `mobile/__mocks__/expo-sqlite.ts` returns `[]` for `FROM card_seen` whether or not the table exists (`deferred-work.md:6`), so a screen test that forgets migration 019 stays green while the device path throws. Nothing to fix here — just do not let it lull you.

### Previous-story intelligence (7.1, done 2026-08-08)

- The registry landed at `components/onboarding/cardRegistry.ts`, **not** `core/onboarding/` as the epic sketched, because `Render` is a `React.ComponentType` and `src/core/` holds no JSX and no `@/components` imports. That constraint still binds: `useGuidanceCard` goes in `data/hooks/` (it touches `user.db`), and nothing card-shaped goes in `core/`.
- The migration is `019_card_seen.ts`, not `019_card_registry.ts`. If you find yourself looking for the latter, that is why.
- 7.1's code review patched four double-tap/double-fire bugs on `day-one.tsx`. The equivalent risk here is a notice that re-fires: cover it with the "active false→true→false→true fires once" test in Task 3 rather than by adding guards you cannot exercise.
- 7.1's dev agent stopped rather than editing files outside its declared set, and that was the right call — except where a change *invalidated* an existing assertion (018's "registered last" test), which it fixed and documented. Same rule here: if adding cards breaks a count assertion in an existing test, fix the assertion and say so; do not widen the diff for anything else.
- `React.ComponentType` without a React import compiles only via the UMD global; 7.1's review changed it to `import type { ComponentType } from 'react'`. Keep that form when you widen it to `ComponentType<GuidanceCardProps>`.

### Recent commit context

`4db88dc` (finalize card registry and day-1 deck) is the baseline — the two commits before it are 7.1's implementation and its review patches, so `git show 4db88dc` and `251714e` are the closest possible reference for how this epic's code is expected to look. Nothing in this story touches `curriculum/**` or the compiled `curriculum.db`.

### Project Structure Notes

Declared file set for this story:

**New**
- `mobile/src/components/common/ExplainerSheet.test.tsx` (the component has no test file today)
- `mobile/src/data/hooks/useGuidanceCard.ts` + `.test.tsx`
- `mobile/src/components/common/GuidanceCardNotice.tsx` + `.test.tsx`
- `mobile/src/components/common/GuidanceInfoButton.tsx` + `.test.tsx`
- `mobile/src/components/onboarding/cards/GuidanceCardBody.tsx` + `.test.tsx`
- `mobile/src/components/onboarding/cards/FirstMissCard.tsx`
- `mobile/src/components/onboarding/cards/SpacedRepetitionCard.tsx` + `.test.tsx`
- `mobile/src/components/onboarding/cards/PassageLocksCard.tsx`
- `mobile/src/components/onboarding/cards/GoalOvershootCard.tsx`
- `mobile/src/components/onboarding/cards/FuriganaAutoHideCard.tsx`
- `mobile/src/components/onboarding/cards/TwoCardKanjiCard.tsx`

**Modified**
- `mobile/src/components/onboarding/cardRegistry.ts` + `.test.ts`
- `mobile/src/components/common/ExplainerSheet.tsx`
- `mobile/src/components/common/SRSStageIndicator.tsx` + `.test.tsx`
- `mobile/src/components/review/ReviewCard.tsx` + `.test.tsx`
- `mobile/src/app/review/index.tsx` + `.test.tsx`
- `mobile/src/app/(tabs)/index.tsx` + `.test.tsx`
- `mobile/src/app/(tabs)/browse/index.tsx` + `.test.tsx`
- `mobile/src/app/(tabs)/settings.tsx` + `.test.tsx`
- `mobile/src/components/learn/VocabularyDetail.tsx` + `.test.tsx`
- `mobile/src/components/learn/FuriganaOverrideControl.tsx` + `.test.tsx`

**Must not appear in the diff:** `useKanjiReadingPrimer.ts`, `useKanjiReadingPrimer.test.tsx`, `KanjiReadingPrimer.tsx`, `preferencesRepository.ts`, `cardSeenRepository.ts`, `019_card_seen.ts`, `data/migrations/index.ts`, `app/onboarding/day-one.tsx`, `cards/ThreeScriptsCard.tsx`, `cards/WordSpacingCard.tsx`, `components/common/SectionHeading.tsx`, `components/learn/explainerContent.ts`, `components/engagement/GoalRing.tsx`, `components/common/FuriganaText.tsx`, `mobile/__mocks__/expo-sqlite.ts`, `.expo/types/router.d.ts`.

Naming conventions in play (architecture.md § Naming Patterns): components `PascalCase.tsx`, named export matching the filename, no default export — except `src/app/` screens, which are expo-router defaults. Hooks and logic `camelCase.ts`. Tests co-located. Semantic NativeWind tokens only, no raw hex, no `Colors` from `constants/theme.ts`. Repositories are the only SQLite accessors and UI reaches them through hooks (§ Architectural Boundaries) — `useGuidanceCard` is that hook; no component calls `isCardSeen` directly.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.2: Triggered Contextual Cards, Explain-This Affordances & Settings Library] — the five triggers, the affordance list, the Settings library, the closed trigger set
- [Source: _bmad-output/planning-artifacts/epics.md#Dev Notes — Epic 7] — file inventory, `ExplainerSheet`/`SectionHeading` reuse mandate, sync-repository convention, out-of-scope list
- [Source: _bmad-output/implementation-artifacts/7-1-card-registry-and-day-1-beginner-deck.md] — registry shape, the two accepted deviations, the mock pitfall, mark-seen-on-visible rule
- [Source: _bmad-output/planning-artifacts/epics.md#Requirements Inventory] — FR55/FR57 (unclamped rising goal), FR60 (locks as destination), FR73 (heading info → sheet), FR78/FR79 (vocabulary-mastery auto-hide, peek + overrides), FR81/FR83 (two-card kanji, worst-of-both)
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Patterns] and [#Structure Patterns] and [#Architectural Boundaries]
- [Source: mobile/src/components/common/SectionHeading.tsx:44] — the info-affordance wiring to replicate
- [Source: mobile/src/components/engagement/DailyThresholdNotice.tsx] — the auto-appearing, inline, dismissable precedent on the review screen
- [Source: mobile/src/app/review/index.tsx:196] — the focus choreography a modal would break
- [Source: mobile/src/data/hooks/useCognitiveLoad.ts:86] — `isOvershoot`, already computed
- [Source: mobile/src/data/curriculum/browseRepository.ts:54] — `BrowsePassageRow.kind` / `locked`
- [Source: _bmad-output/implementation-artifacts/deferred-work.md:6] — the `card_seen` mock blind spot
- [Source: CLAUDE.md#Hard conventions] — dual DB, semantic tokens, offline-first, surgical changes

## Dev Agent Record

### Agent Model Used

claude-opus-5 (Claude Code, bmad-dev-story workflow)

### Debug Log References

- `npm run typecheck` — clean, no `any` and no non-null assertion added. The `ExplainerSheet` union discriminates on `props.topic !== undefined` (optional-`never` members), which narrows without a cast.
- `npm run lint` — 0 errors. The single remaining warning (`browse/passage/[id].test.tsx:35`, `require()` style import) is pre-existing and outside this story's diff.
- `npm test` — 223 suites / 1919 tests passing.
- `npm run check-contrast` (repo root) — 152 pairs pass. Run for confirmation only; no token was touched.
- One real defect found and fixed during Task 6, not worked around in the test: Home's `onVacation` starts `false` and is only resolved inside the focus effect, so `goal-overshoot` fired (and wrote `card_seen`) for a paused learner on the first commit. Added a `vacationResolved` flag so the trigger waits for the answer instead of firing on the default.

### Completion Notes List

**Registry and cards (AC #1, #2, #10).** `GUIDANCE_CARDS` grew from two entries to eight — no second list, no new registry file, and no `if (cardId === …)` outside `cardRegistry.ts`. `Render` widened to `ComponentType<GuidanceCardProps>`; `SpacedRepetitionCard` is the only card that reads `subject`, and it ships two authored modes (named example / general explanation) rather than one degraded one. The two deck cards keep their ids, titles, order and trigger, and `day-one.tsx` was not touched — `day-one.test.tsx` passes unchanged.

**One addition beyond the story's literal file list:** `GUIDANCE_CARD_BY_ID`, a derived by-id view of the same array (`Object.fromEntries` + one cast, inside the registry). Without it, each of the six surfaces that render a *named* card would carry its own `GUIDANCE_CARDS.find(...)` plus an undefined guard — six duplicated lookups and six dead branches. It is derived, not authored, so it cannot drift; `cardRegistry.test.ts` asserts it covers every card and nothing more. This keeps `GuidanceCardNotice`'s prop shape exactly as specified (`{ card, subject, onDismiss }`) and lets `GuidanceInfoButton` avoid a non-null assertion and a fallback UI branch.

**Trigger hook (AC #3).** `useGuidanceCard(cardId, active)` marks seen the moment the card becomes visible, decides once per mounted surface via `settledRef`, hides on `active → false`, and stays hidden after `dismiss()`. No module-level session latch — the reason the primer needs one does not apply here, and that is stated in the file. The `false → true → false → true` case is covered by test rather than by extra guards, per the story's note on 7.1's double-fire patches.

**Inline vs sheet (AC #4, #5).** Triggered → `GuidanceCardNotice` inline at the triggering surface; tapped → the existing `ExplainerSheet`, extended to a discriminated union with no change to the FR73 `topic` API. `SectionHeading.tsx` was not touched and its test passes unchanged. `ExplainerSheet` had no test file before this story; it has one now covering both modes.

**Deviations recorded per AC #7.** `GoalRing.tsx` and `FuriganaText.tsx` were deliberately **not** modified. `GoalRing` also renders at 32px inside `SessionHeader`, where a 44pt info button does not fit; `FuriganaText` renders review prompts, passage bodies, browse rows and chat bubbles, so an embedded affordance would appear in all of them. The affordances went on the surrounding controls instead — Home's goal card and `FuriganaOverrideControl` — exactly as the story directs.

**Trigger placement (AC #8).** Both review-screen hooks are called unconditionally above all five early returns (placed just after the `useState` block, since `first-miss` keys on `cardState`). Non-terminal states (`typo`, `wrong_script`, `wrong_reading_type`) do not fire `first-miss` — covered by test. Browse discriminates on `kind`, not `rowType`. Home destructures the already-computed `isOvershoot` rather than recomputing `percent > 100`.

**Settings library (AC #9).** A section, not a screen — no new route, no migration, no table. Lists all eight cards in registry order behind one shared sheet, and never writes `card_seen`; the test asserts that through seen-state, not through a spy on `markCardSeen`.

**Testing note.** The hook's own test uses the real harness the story specifies (`createUserDb` + `DatabaseContext.Provider`, `migration001Initial` **plus** `migration019CardSeen`). The five screen/component suites already mock `useDatabase` with plain objects rather than a real SQLite handle, so converting them to the migration harness would have meant rewriting suites this story has no business touching. They instead get a `Set`-backed in-memory stand-in for `cardSeenRepository` — real repository semantics, and seen-state is still asserted through state rather than through call spies, which was the actual rule 7.1's notes flagged.

**Untouched, as required (AC #11, #12).** `git status` confirms none of `day-one.tsx`, `ThreeScriptsCard.tsx`, `WordSpacingCard.tsx`, `019_card_seen.ts`, `cardSeenRepository.ts`, `useKanjiReadingPrimer.*`, `KanjiReadingPrimer.tsx`, `SectionHeading.tsx`, `explainerContent.ts`, `GoalRing.tsx`, `FuriganaText.tsx`, `__mocks__/expo-sqlite.ts` or `.expo/types/router.d.ts` appears in the diff. No existing assertion needed changing — `cardRegistry.test.ts` gained cases without any of its three original ones being edited.

### File List

**New**

- `mobile/src/components/common/ExplainerSheet.test.tsx`
- `mobile/src/components/common/GuidanceCardNotice.tsx`
- `mobile/src/components/common/GuidanceCardNotice.test.tsx`
- `mobile/src/components/common/GuidanceInfoButton.tsx`
- `mobile/src/components/common/GuidanceInfoButton.test.tsx`
- `mobile/src/components/onboarding/cards/GuidanceCardBody.tsx`
- `mobile/src/components/onboarding/cards/GuidanceCardBody.test.tsx`
- `mobile/src/components/onboarding/cards/FirstMissCard.tsx`
- `mobile/src/components/onboarding/cards/SpacedRepetitionCard.tsx`
- `mobile/src/components/onboarding/cards/SpacedRepetitionCard.test.tsx`
- `mobile/src/components/onboarding/cards/PassageLocksCard.tsx`
- `mobile/src/components/onboarding/cards/GoalOvershootCard.tsx`
- `mobile/src/components/onboarding/cards/FuriganaAutoHideCard.tsx`
- `mobile/src/components/onboarding/cards/TwoCardKanjiCard.tsx`
- `mobile/src/data/hooks/useGuidanceCard.ts`
- `mobile/src/data/hooks/useGuidanceCard.test.tsx`

**Modified**

- `mobile/src/components/onboarding/cardRegistry.ts`
- `mobile/src/components/onboarding/cardRegistry.test.ts`
- `mobile/src/components/common/ExplainerSheet.tsx`
- `mobile/src/components/common/SRSStageIndicator.tsx`
- `mobile/src/components/common/SRSStageIndicator.test.tsx`
- `mobile/src/components/review/ReviewCard.tsx`
- `mobile/src/components/review/ReviewCard.test.tsx`
- `mobile/src/components/learn/VocabularyDetail.tsx`
- `mobile/src/components/learn/VocabularyDetail.test.tsx`
- `mobile/src/components/learn/FuriganaOverrideControl.tsx`
- `mobile/src/components/learn/FuriganaOverrideControl.test.tsx`
- `mobile/src/app/review/index.tsx`
- `mobile/src/app/review/index.test.tsx`
- `mobile/src/app/(tabs)/index.tsx`
- `mobile/src/app/(tabs)/index.test.tsx`
- `mobile/src/app/(tabs)/browse/index.tsx`
- `mobile/src/app/(tabs)/browse/index.test.tsx`
- `mobile/src/app/(tabs)/settings.tsx`
- `mobile/src/app/(tabs)/settings.test.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-08-09 — Story created. Status → ready-for-dev.
- 2026-08-09 — Implemented all 8 tasks: six new registry cards, `useGuidanceCard` trigger hook, `GuidanceCardNotice` / `GuidanceInfoButton`, `ExplainerSheet` card mode, five contextual triggers, four explain-this affordances, and the Settings "How this works" library. Fixed a vacation-mode race on Home's overshoot trigger. Lint, typecheck, contrast and the full 1919-test suite pass. Status → review.
