# Plan 12 — Android playtest round 2 (Pixel 10)

Feedback from the 2026-07-27 playtest on a Pixel 10 (Android 16), plus follow-on
issues found while grounding each report in the code. Items **12.1–12.7** are the
reported bugs/improvements; **12.8–12.10** are additional defects found during
analysis — each has repro steps so they can be verified on-device before fixing.

| # | Item | Priority | Status |
|---|------|----------|--------|
| [12.1](#121--status-bar-unreadable-white-on-white) | Status bar unreadable (white on white) | **P0** | Reported; root cause has 2 candidates |
| [12.2](#122--do-a-small-revision-opens-no-reviews-due) | "Do a small revision" opens "No Reviews Due" | **P0** | Reported; **root cause confirmed in code** |
| [12.3](#123--prompt-disappears-after-a-correct-answer) | Prompt disappears after a correct answer | P1 | **Done** |
| [12.4](#124--prompt-disappears-on-try-again-nudges) | Prompt disappears on "Try again" nudges | P1 | **Done** |
| [12.5](#125--abrupt-feedback--add-a-transition) | Abrupt feedback — add a transition | P2 | **Done** |
| [12.6](#126--review-forecast-needs-more-detail) | Review forecast needs more detail | P2 | **Done** — option 1 (week total + today split) |
| [12.7](#127--remove-the-min-in-separate-apps-message) | Remove the "min in separate apps" message | P2 | **Done** — post-session sharing removed too |
| [12.8](#128--found-home-review-count-can-overstate-the-queue) | Home review count can overstate the queue | P2 | **Done** — counts now run the queue's eligibility filters |
| [12.9](#129--found-priority-hint-cleared-on-an-empty-build) | Priority hint cleared on an empty build | P3 | Found in analysis (folds into 12.2) |
| [12.10](#1210--found-at-risk-list-can-include-items-with-no-srs-row) | At-risk list can include items with no SRS row | P3 | **Done** — candidates now require an SRS row |

---

## 12.1 — Status bar unreadable (white on white)

> I can't read the status bar, the background is white and the text color and
> icon color is also white, make it black (Pixel 10).

**Current code.** `mobile/src/app/_layout.tsx:40` renders
`<StatusBar style={isDark ? 'light' : 'dark'} />` (expo-status-bar), where
`isDark` comes from `resolveColorScheme(useColorScheme())`. Intent is correct:
dark icons on the light theme. Two independent things can break it:

1. **Theme-resolution mismatch.** `resolveColorScheme`
   (`mobile/src/utils/resolve-color-scheme.ts:4`) is dark-first: it returns
   `'dark'` whenever React Native reports `null`/unknown. But the actual colors
   come from NativeWind with `darkMode: 'media'`
   (`mobile/tailwind.config.js:5`) + a light-mode media override in
   `mobile/src/global.css:50`, which resolves **light-first** through a
   different path. If `useColorScheme()` ever returns `null` while the media
   query resolves light (seen on Android during startup/activity recreation),
   the app paints a near-white background (`#f8f8fa`) while the status bar is
   told `style="light"` → white icons on white. Exactly the reported symptom.
2. **Edge-to-edge on Android 16.** Pixel 10 enforces edge-to-edge; the status
   bar is transparent and the app's background shows through. If
   expo-status-bar's `setStatusBarStyle` isn't taking effect on this
   SDK 55 / RN 0.83 / New Architecture combo, icons stay light regardless of
   the `style` prop.

**Diagnosis step (do first).** Temporarily hardcode `<StatusBar style="dark" />`
in `_layout.tsx`, rebuild, launch with the phone in light theme:

- Icons turn black → cause 1 (resolution mismatch). Fix: derive `isDark` from
  the same source that picks the CSS palette (NativeWind's color-scheme hook),
  not from raw `useColorScheme()` with a dark fallback — the status bar must
  follow the theme actually painted.
- Icons stay white → cause 2. Fix: drive the bar via `SystemBars` from
  `react-native-edge-to-edge` (the library Expo delegates to), keeping the
  light/dark switch.

**Repro.** Phone in **light** system theme → open the app → look at the
clock/battery icons: unreadable. Switch the phone to dark theme → icons should
be (and probably are) fine.

**Acceptance.** Status bar icons are black on the light theme and white on the
dark theme, on Android and iOS, on every screen (Home, review full-screen
modal, lesson, onboarding). No flash of wrong-colored icons on cold start.

**Files.** `mobile/src/app/_layout.tsx`, `mobile/src/utils/resolve-color-scheme.ts`
(and its callers — the same dark-first fallback also feeds the navigation
`ThemeProvider`, so the mismatch can theme navigation chrome wrong too).

---

## 12.2 — "Do a small revision" opens "No Reviews Due"

> I see a section 1 item ready for a refresher, but when I click "Do a small
> revision" I get "No Reviews Due".

**Root cause — confirmed.** The refresher pipeline deliberately lets
**not-yet-due** weak items into the session, but the final queue builder throws
them back out:

1. Home ranks weak items regardless of due date (`useAtRiskItems.ts`,
   `atRiskSelector.ts`) and hands their IDs to the review screen via
   `setReviewPriority` (`(tabs)/index.tsx:199`).
2. `useReviewQueue.ts` honors the hint: it fetches SRS states for the preferred
   IDs and merges them with the due set — the `applyReviewPriority` doc comment
   says *"not-yet-due preferred items can still enter a refresher"*
   (`reviewPriorityStore.ts`).
3. But `buildReviewQueue` then re-filters every candidate with
   `if (item.srsState.dueDate > nowIso) return false;`
   (`mobile/src/core/srs/queueBuilder.ts:83`) — dropping exactly the
   not-yet-due items step 2 admitted.

So the refresher only works when the weak item happens to already be due. With
0 due reviews and 1 not-yet-due weak item: queue = empty → `totalItems === 0` →
the "No Reviews Due" screen (`review/index.tsx:437`).

**Repro.** Answer some item wrong a few times over multiple sessions (enough to
earn a weakness score), then clear all due reviews. Home shows the at-risk
section ("N items ready for a refresher") while the Review card says "All
caught up". Tap "Do a small revision" → "No Reviews Due".

**Fix.** Thread the priority exemption into the builder: pass the preferred IDs
in `QueueBuildOptions` (e.g. `dueExemptItemIds: Set<string>`) and skip the
due-date check for those IDs only. Keep the burned / `'known'` / unlock filters
— they should still apply to a refresher. Cover with a `queueBuilder.test.ts`
case: not-yet-due item + exemption ⇒ in queue; without exemption ⇒ out.

**Also while here (12.9).** `useReviewQueue.ts` clears the priority hint on the
*empty* result path, though its own comment says the hint is "cleared only after
the queue successfully materializes so a failed build can retry the same hint".
After the fix an empty refresher build should be near-impossible, but align the
code with the comment either way.

**Acceptance.** With ≥1 at-risk item and 0 due reviews, "Do a small revision"
starts a session containing the at-risk item(s), capped at `AT_RISK_TOP_N` (8).
The plain Review button behavior is unchanged.

**Files.** `mobile/src/core/srs/queueBuilder.ts`, `mobile/src/core/srs/srs.types.ts`
(`QueueBuildOptions`), `mobile/src/data/hooks/useReviewQueue.ts`, tests.

---

## 12.3 — Prompt disappears after a correct answer

> Don't make the radical / kanji / grammar disappear after answering correctly.

**Current code.** `ReviewCard`'s `correct` branch
(`mobile/src/components/review/ReviewCard.tsx:146-164`) renders "✓ Correct",
the stage badge, and the answer panel — but **not** the prompt
(`grammarPrompt` / `primaryForm`). The `incorrect` branch does keep it
(`IncorrectReveal.tsx` shows `item.primaryForm`).

**Repro.** Any review card → answer correctly → the character/sentence you were
asked about vanishes; only "✓ Correct" + the reveal panel remain.

**Fix.** Render the mode label + prompt (same `grammarPrompt` element as the
prompting state) above "✓ Correct" in the correct branch. For grammar cloze,
show the sentence with the blank filled (the `resolveCompletedSentence` helper
in `core/grammar/nearMiss` already exists for this).

**Acceptance.** After a correct answer, the item's prompt is still visible
alongside the feedback, for all four item types, until Continue/Return advances.

**Files.** `mobile/src/components/review/ReviewCard.tsx`, `ReviewCard.test.tsx`.

---

## 12.4 — Prompt disappears on "Try again" nudges

> When I encounter a nudge, it says try again but the
> radical/kanji/vocabulary/grammar it was showing disappears — I can't refer to
> the original question.

**Current code.** Three non-terminal nudge states, inconsistent:

- `typo` (`ReviewCard.tsx:199-209`): renders **only** "~ Close! Try again." —
  the prompt, mode label, and stage indicator all vanish. This is the reported
  case.
- `wrong_script` / `wrong_reading_type` (`ReviewCard.tsx:183-197`): keep the
  prompt but drop the mode label and stage indicator.
- Related gap: on a terminal **incorrect** for grammar cloze,
  `IncorrectReveal.tsx:87` shows the bare `primaryForm` — the original cloze
  *sentence* is gone, so you can't see what the blank was.

**Repro.** Answer a reading prompt with a one-kana slip (e.g. しゅう for しゅ)
→ "Close! Try again." shows on an otherwise empty card.

**Fix.** All three nudge states render the full prompting layout (mode label +
prompt + stage indicator) with the nudge line added beneath — i.e. fall through
to the prompting branch and append the nudge, rather than replacing the card.
For the grammar incorrect reveal, show the original cloze sentence (or the
completed one) above the answer.

**Acceptance.** During typo / wrong-script / wrong-reading nudges the original
question stays fully visible; the nudge is additive. Grammar incorrect reveal
shows the sentence the blank came from.

**Files.** `mobile/src/components/review/ReviewCard.tsx`,
`mobile/src/components/review/IncorrectReveal.tsx`, tests.

---

## 12.5 — Abrupt feedback — add a transition

> Animate or add a transition when answering correctly/incorrectly — the
> message shows up quite abruptly.

**Current code.** Card states swap with no animation, and the `evaluating`
state returns `null` (`ReviewCard.tsx:142-144`) — a blank flash between submit
and result that makes the swap feel even harsher.

**Fix.**

- Animate the feedback block in with reanimated (already a dependency) — e.g.
  `FadeInDown` ~200ms on the "✓ Correct" / "✗ Incorrect" / nudge block, in the
  spirit of the existing `FadeSlideIn` (`components/common/FadeSlideIn.tsx`).
- Once 12.3/12.4 keep the prompt mounted across states, the prompt itself no
  longer unmounts, so only the feedback block needs an entrance — and the
  `evaluating` blank frame can render the prompt instead of `null`.
- **Honour `useReducedMotion()`** (pattern already in `FadeSlideIn`) and keep
  it fast: NFR1's <100ms feedback budget means the *information* must land
  immediately; the animation is decoration on top, never a delay gate on input.

**Acceptance.** Correct/incorrect/nudge feedback fades/slides in smoothly; no
blank frame between submit and feedback; reduced-motion shows instant static
feedback; Lightning Mode auto-advance timing unchanged.

**Files.** `mobile/src/components/review/ReviewCard.tsx`.

---

## 12.6 — Review forecast needs more detail

> On the forecast it needs a little more detail.

**Current code.** `ReviewForecast.tsx` shows 7 day-cells with a bare count +
weekday, plus a wall-day note only when a spike hits ≥30 due
(`FORECAST_WALL_MIN_DUE`). Data comes from due-date strings only
(`useReviewForecast.ts` → `buildReviewForecast.ts`).

**Decision (2026-07-27): option 1.** Week total + today split, per the
recommendation below. Options 2 and 3 stay listed as future candidates only.

1. **Week total + today split** *(chosen)*: a summary line — e.g.
   "42 this week · 5 due now, 3 more later today". Today's cell currently
   mixes overdue-now with due-tonight; splitting it answers "what happens if I
   review now". Data already available (due timestamps).
2. **Per-type breakdown on tap**: tap a day → radical/kanji/vocab/grammar
   counts. Needs a join against curriculum item types — new query, modest cost.
3. **Hour-level today view**: "next batch at 14:00". Cheap (timestamps exist)
   but only matters for same-day cadence.

**Acceptance.** The summary line renders ("N this week · X due now, Y more
later today") and today's "due now" number always matches the Home Review card
count.

**Implemented (2026-07-27).** `buildReviewForecast` now also returns
`dueNowCount` (due timestamp ≤ now, i.e. overdue + already-due today — the same
filter as `countDueSrsStates`, so Home's "N items ready" agrees) and
`laterTodayCount` (today's bucket minus that). `ReviewForecast` renders the
summary line under the "This week" header; the "…, Y more later today" clause is
dropped when nothing else lands today.

**Files.** `mobile/src/components/engagement/ReviewForecast.tsx`,
`mobile/src/core/engagement/reviewForecast.ts`.

---

## 12.7 — Remove the "min in separate apps" message

> Remove the "1 min on this app = 18 min on other apps" content message.

**History.** This exact feedback was accepted in **plan 05 §5.1** ("Remove the
time-compression comparison"). The component was renamed to
`SessionSummaryCard`, but the claim itself survived: when the estimate beats
actual time it still renders as the **centerpiece**. Second report of the same
issue — remove it fully this time.

**Where it still renders:**

- `mobile/src/components/engagement/SessionSummaryCard.tsx:46-57` — the
  `time-compression-block` ("X min here — ~Y min in separate apps" + the
  "deliberately conservative" caption).
- `mobile/src/components/engagement/PostSessionShareCard.tsx:46` — the
  "~Y min in separate apps" line, and `:67` inside `buildShareMessage` (the
  text sent through the OS share sheet).
- Feeder: `estimateMultiAppMinutes` / `hasSavings` in
  `mobile/src/utils/timeFormat.ts:21-42` and the `estimatedMinutes` computation
  in `mobile/src/app/review/summary.tsx:27-28`.

**Fix (decision 2026-07-27: full removal, share message included).** Delete
the comparison block and caption from `SessionSummaryCard` (keep "X min
studied", date, domain chips, goal line). Remove the estimate line from
`PostSessionShareCard` **and** from `buildShareMessage`, then delete the
now-dead `estimateMultiAppMinutes` / `hasSavings` + `TIME_COMPRESSION_*`
constants. Update the four tests currently asserting the string.

**Acceptance.** No "separate apps" phrasing anywhere in the summary screen or
the share message; `grep -r "separate apps" mobile/src` returns only removed
tests' updates (i.e. nothing).

**Follow-on decision (2026-07-27): post-session sharing removed entirely.** On
review of the fix, sharing session stats out to other apps was deemed unwanted
for now, so the whole feature went with it — `PostSessionShareCard.tsx` (+ test)
deleted, `buildShareMessage` and the RN `Share.share` call removed, and the
`Share` button / `onShare` prop dropped from `SessionSummaryCard`. The summary
screen now shows only the share-free `SessionSummaryCard` (date, domain chips,
"X min studied", goal line), first-try accuracy, and shadow-mode comparison.
This also resolves the "X min studied" duplication the share card caused.
Supersedes UX-DR10 / UX-DR12's share affordance — treat re-adding sharing as a
new product decision, not a regression.

**Files.** `SessionSummaryCard.tsx`, `PostSessionShareCard.tsx` *(deleted)*,
`components/engagement/index.ts`, `review/summary.tsx`,
`mobile/src/utils/timeFormat.ts`, `mobile/src/config/constants.ts`, 3 test files
(1 deleted).

---

## 12.8 — (Found) Home review count can overstate the queue

**Not reported — found in analysis; verify before fixing.** The Home Review
card's "N items ready" uses `countDueSrsStates`
(`srsStateRepository.ts:105`) — a raw count of non-burned due rows. The actual
queue then drops items that are: missing a curriculum row, locked (parent not
started), or study-status `'known'` (`useReviewQueue.ts` + `queueBuilder.ts:79-85`).
So Home can say "3 items ready" while the session serves fewer — the same
count-vs-queue divergence family as 12.2, in the opposite direction. Most
likely after a partial import or a curriculum OTA that removed items.

**Repro attempt.** After a WaniKani/Anki import, compare the Home count with
the session's "x of y" header total. Mismatch confirms it. If it never
mismatches in practice, park this.

**Fix sketch (if confirmed).** Either count through the same eligibility
filters, or accept the cheap count but derive the Home label from the built
queue length when a session starts.

**Fix (2026-07-27): count through the same filters.** Rather than wait for a
device repro, the divergence was closed at the source — one shared filter now
backs every "how many reviews" number on Home.

- New `mobile/src/data/reviewEligibility.ts` — `filterServableItemIds` applies
  the queue's three drops (missing curriculum row, locked parent, study status
  `known`), reusing `isItemUnlocked` so the unlock rule stays single-sourced.
  `countServableDueItems` is the Home count built on it.
- `srsStateRepository`: `countDueSrsStates` → `getDueItemIds` (ids, not a raw
  count) and `getUpcomingDueDates` → `getUpcomingDueItems` (ids + due dates),
  since both counts now need ids to filter on.
- The 7-day forecast filters through the same set, so its "N now" split and
  Home's "N items ready" still agree — 12.6 tied them together deliberately.

**Not changed.** Home stays uncapped while a session fetches at most
`QUEUE_FETCH_LIMIT` (100) items; a >100 backlog still shows the true total on
Home by design.

**Files.** `data/reviewEligibility.ts` *(new, + test)*,
`data/user/srsStateRepository.ts`, `data/hooks/useReviewForecast.ts`,
`app/(tabs)/index.tsx`, 2 test files.

---

## 12.9 — (Found) Priority hint cleared on an empty build

Covered inside 12.2 — `useReviewQueue.ts` clears the one-shot priority hint on
the empty-queue path, contradicting its own retry comment. Fold into the 12.2
change.

---

## 12.10 — (Found) At-risk list can include items with no SRS row

**Not reported — found in analysis; low likelihood, verify.**
`useAtRiskItems.ts:56-63` admits candidates whose SRS state is entirely missing
(`dueDate: null`, `isBurned` defaulting false). Weakness rows normally imply an
SRS row, but if one is ever orphaned (failed write, import edge), the item
counts toward "N items ready for a refresher" yet can never be served — even
after the 12.2 fix, since the queue's preferred-state fetch drops IDs with no
SRS row. Cheap hardening: require an SRS state when building at-risk candidates
(one-line filter), which also makes the at-risk count honest.

**Done.** `useAtRiskItems.ts` now drops a scored item when `getSrsStatesForItems`
returns no row for it (same pass that drops burned items), so the "N items ready
for a refresher" count and the revision handoff only contain items a session can
actually serve. New `useAtRiskItems.test.tsx` covers both exclusions.

---

## Suggested sequencing

1. **12.2** (+12.9) — confirmed root cause, isolated to the queue path,
   testable in `queueBuilder.test.ts`. Highest user-visible payoff.
2. **12.1** — run the diagnosis step first; the fix is small either way.
3. **12.3 + 12.4 + 12.5** — one cluster, all inside `ReviewCard`/`IncorrectReveal`;
   do together so the animation lands on the final layout.
4. **12.7** — mechanical removal; independent.
5. **12.6** — week total + today split (option 1); independent.
6. **12.8** *(done)* **/ 12.10** *(done)* — verify on-device first; fix only if confirmed.
