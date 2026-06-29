# Story 6.5: Post-session summary and home screen composition

Status: done

---
baseline_commit: 22aa053e105eb4c51d9e86f907c68f62da5ef466
---

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **learner**,
I want **a screenshot-friendly session summary with time savings and a Home screen with ring, actions, streak, and progress**,
so that **I feel the value every session and know what to do next at a glance (FR33b, FR33c, UX-DR9, UX-DR10, UX-DR12, UX-DR19, UX-DR26)**.

## Context: what's already built and what this story creates

This is the **final composition story of Epic 6** and the last MVP story before accessibility (Epic 7). Every data source it needs already exists — **this story is overwhelmingly UI composition plus one pure util and one read-only hook. No new migration, no new SQLite table.** Session-summary stats are ephemeral (held in `ReviewSessionProvider` memory for the lifetime of the review stack); they are not persisted.

**Already built and directly reused (do NOT rebuild):**
- `ReviewSessionProvider` (`mobile/src/providers/ReviewSessionProvider.tsx`) — owns the active session. Already exposes `currentItem`, `totalItems`, `currentIndex`, `isComplete`, `cognitiveLoadPercent`, `cognitiveLoadComplete`, `gradeCurrentItem`. **You will extend it** to also track per-domain counts + session duration and expose a `sessionSummary` object.
- `CognitiveLoadRing` (`mobile/src/components/engagement/CognitiveLoadRing.tsx`) — `variant: 'small' | 'large'`, `percent`. Use `variant="large"` on Home.
- `StreakCounter` (`mobile/src/components/engagement/StreakCounter.tsx`) — props `{ currentStreak, streakState, longestStreak?, testID? }`.
- `useStreak` (`mobile/src/data/hooks/useStreak.ts`) → `{ currentStreak, streakState, isLoading, error, refetch }`.
- `useCognitiveLoad` (`mobile/src/data/hooks/useCognitiveLoad.ts`) → `{ percent, isComplete, isLoading, error, refetch }`.
- `useItemCountsByLevel` (`mobile/src/data/hooks/useItemCountsByLevel.ts`) → total curriculum counts per type for a level.
- `getStartingJlptLevel` (`mobile/src/data/user/preferencesRepository.ts`) → the user's level for the Home progress bar.
- `Button` (`mobile/src/components/common/Button.tsx`) — variants `primary | secondary | tertiary | ghost | destructive`; props `{ label, onPress, variant, accessibilityLabel, ... }`.
- `listItemsByLevelAndType`, `countItemsByLevel` (`mobile/src/data/curriculum/itemRepository.ts`).
- `SrsStageBreakdown` already lives on the **Stats** tab (`mobile/src/app/(tabs)/stats.tsx`) — **SRS stage counts must NOT appear on Home** (UX-DR19).

**This story creates:**
- `mobile/src/utils/timeFormat.ts` — pure time-compression calculation (FR33b/FR33c).
- `mobile/src/components/engagement/TimeCompressionSummary.tsx` — post-session domain breakdown + minutes + conservative multi-app estimate + methodology disclosure.
- `mobile/src/components/engagement/PostSessionShareCard.tsx` — screenshot-optimized high-contrast card + native share.
- `mobile/src/components/engagement/LevelProgressBar.tsx` — compact JLPT progress (thin bar + Kanji/Grammar/Vocab counts).
- `mobile/src/data/hooks/useLevelProgress.ts` — items started/total per domain for the level.
- `mobile/src/app/review/summary.tsx` — the post-session summary route.
- Compose `mobile/src/app/(tabs)/index.tsx` — the real Home screen (replaces the dev placeholder).

## Acceptance Criteria

**AC1 — Time compression summary on session end (FR33b, FR33c, UX-DR10)**
Given a completed **or user-ended** session
When I reach the summary route
Then `TimeCompressionSummary` shows the domains reviewed (Kanji / Grammar / Vocab counts), minutes studied this session, and a **conservative** multi-app equivalent estimate (e.g. "18 min ≈ ~35 min across separate apps")
And a methodology disclosure (tappable tooltip/expandable note or settings link) explains how the estimate is derived (FR33c)
And an optional Share action renders `PostSessionShareCard` and opens the native share sheet (UX-DR10).

**AC2 — Both completion paths reach the summary**
Given the review session ends because items are exhausted/ring is full (`isComplete`) **or** because I end it early via the exit sheet
When the session terminates
Then I am routed to `/review/summary` (not popped straight back to Home), and the summary reflects only the items I actually reviewed this session
And tapping **Done** on the summary returns me to the Home tab.

**AC3 — Conservative, credible estimate (FR33c)**
Given the session's per-domain item counts and elapsed minutes
When the multi-app estimate is computed
Then it uses documented, tunable lower-bound per-item times and a documented session overhead, is **never** presented as larger than reality would plausibly justify, and when the estimate does not exceed actual minutes the UI shows neutral framing (no fake savings).

**AC4 — Home screen composition (UX-DR9, UX-DR12, UX-DR26)**
Given the Home tab after onboarding
When I open the app
Then the screen shows, top-to-bottom: a **large** `CognitiveLoadRing` (today's load %), a **primary Review** button and a **secondary Learn** button (button hierarchy per UX-DR26), a `StreakCounter`, and a `LevelProgressBar` visible on first view below the streak
And SRS stage counts are **absent** from Home (they live on Stats — UX-DR19).

**AC5 — Review button reflects availability without "terror backlog" copy (UX-DR20 philosophy)**
Given pending reviews exist or none are due
When Home renders the Review button
Then the button reflects availability (enabled with a count when items are due; a calm "All caught up" / disabled affordance when none are due) without alarming overdue-count copy.

**AC6 — Level progress bar (UX-DR12)**
Given the user's starting JLPT level
When Home renders `LevelProgressBar`
Then it shows the level label, a thin fill bar (overall % started), and compact domain counts (Kanji X/Y, Grammar X/Y, Vocab X/Y) sourced from curriculum totals and the user's started items
And it exposes `accessibilityRole="progressbar"` with an `accessibilityValue` reporting overall percentage.

**AC7 — Accessibility & non-blocking**
Given any new component
Then every interactive control has `accessibilityRole` + `accessibilityLabel`; numeric summaries announce full context (e.g. "Kanji: 8 items reviewed"); and summary computation never blocks the <100ms answer path (it runs only at session end, off the grading hot path).

## Tasks / Subtasks

- [x] **Task 1 — Time-compression pure util + constants (AC: 1, 3)**
  - [x] Add time-compression constants to `mobile/src/config/constants.ts` (see Dev Notes "Time compression methodology" for exact values): `TIME_COMPRESSION_PER_ITEM_SECONDS` (per item type, conservative lower bounds), `TIME_COMPRESSION_SESSION_OVERHEAD_MINUTES`, and `TIME_COMPRESSION_MIN_DOMAINS_FOR_OVERHEAD`.
  - [x] Create `mobile/src/utils/timeFormat.ts` exporting:
    - `formatMinutes(ms: number): number` — elapsed ms → whole minutes, floor with a **minimum of 1**.
    - `estimateMultiAppMinutes(counts: Record<'radical'|'kanji'|'vocabulary'|'grammar', number>): number` — sum(perItemSeconds × count)/60, plus session overhead only when ≥ `TIME_COMPRESSION_MIN_DOMAINS_FOR_OVERHEAD` distinct domains had counts > 0; `Math.ceil` the result.
    - `computeTimeCompression(input): { actualMinutes; estimatedMinutes; savedMinutes; hasSavings }` — `hasSavings = estimatedMinutes > actualMinutes`; `savedMinutes = max(0, estimated − actual)`.
  - [x] Zero React/RN imports in this file — it lives in `utils/` and must stay pure. Unit-test it (`timeFormat.test.ts`): zero items, single domain (no overhead), multi-domain (overhead applied), `hasSavings=false` when actual ≥ estimate, minute flooring/min-1.

- [x] **Task 2 — Track per-session stats in ReviewSessionProvider (AC: 1, 2, 7)**
  - [x] Add a `sessionStartRef` (a `number` epoch ms) set once when the queue first becomes available (alongside the existing `loadInitialized` effect, gated the same way). Reset it in the queue-change effect.
  - [x] Add per-domain counters. Increment in `gradeCurrentItem` **only for terminal grades** (i.e. where the item actually advances) by `currentItem.itemType`. Do **not** count typos (typos re-prompt and never call `gradeCurrentItem`). An incorrect answer (grade 1) still counts as a reviewed item. Keep increments on the existing async tail — never add work before `setCurrentIndex`.
  - [x] Expose a `sessionSummary` object on the context: `{ domainCounts: Record<ItemType, number>; itemsReviewed: number; durationMs: number }`. Compute `durationMs` lazily (`Date.now() - sessionStartRef.current`) when read by the summary, or snapshot it when `isComplete` flips — snapshot is preferred so the number is stable across summary re-renders.
  - [x] Update `ReviewSessionProvider.test.tsx`: assert domain counters increment per `gradeCurrentItem` by item type, do not increment on `recordTypoForCurrentItem`, and that `sessionSummary.itemsReviewed` equals the number of graded items.

- [x] **Task 3 — Route both completion paths to the summary (AC: 2)**
  - [x] Create `mobile/src/app/review/summary.tsx`. It reads `useReviewSession().sessionSummary`, computes compression via `timeFormat.ts`, and renders `TimeCompressionSummary`. A **Done** button calls `router.dismissAll()` (returns to the Home tab; the review stack is presented over the tabs). Guard `usePreventRemove`/back-handling is NOT needed here (session already over).
  - [x] In `mobile/src/app/review/index.tsx`: when `isComplete` (or `totalItems === 0`), **replace the inline "Session Complete" block** with a navigation to the summary — `router.replace('/review/summary')` inside an effect (guard against double-nav with a ref). For the `totalItems === 0` "nothing due" case, keep a lightweight inline message OR route to summary showing an empty/zero state — pick the empty inline message to avoid a meaningless summary; document the choice.
  - [x] Wire the early-end path: `handleEndSession` currently calls `router.back()`. Change it to `router.replace('/review/summary')` so a user-ended session also reaches the summary (AC2). Ensure `isEndingRef`/`usePreventRemove` still allow the navigation (the prevent-remove guard keys off `isEndingRef.current`; set it before navigating, as today).
  - [x] Confirm `review/_layout.tsx` (which wraps the stack in `ReviewSessionProvider`) makes `summary.tsx` a sibling route under the same provider instance — so `sessionSummary` survives navigation. No layout change should be required beyond the new route file being picked up by the file-based router.

- [x] **Task 4 — TimeCompressionSummary component (AC: 1, 3, 7)**
  - [x] Create `mobile/src/components/engagement/TimeCompressionSummary.tsx`. Props: `{ domainCounts; actualMinutes; estimatedMinutes; savedMinutes; hasSavings; onShare?; sessionDate?: Date }`.
  - [x] Anatomy (UX): domain breakdown row (Kanji N | Grammar N | Vocab N; show Radical N only when > 0), minutes studied, compression comparison line ("18 min ≈ ~35 min across separate apps") when `hasSavings`, neutral copy otherwise, and the session date.
  - [x] Methodology disclosure: a tappable "How is this calculated?" that reveals a short inline note (the documented basis from Dev Notes). Keep it self-contained — no external nav required (a settings link is acceptable but inline expandable is simpler and offline-safe).
  - [x] Accessibility: each number carries an `accessibilityLabel` with full context ("Kanji: 8 items reviewed"); the comparison line announces actual vs estimated.
  - [x] Tests (`TimeCompressionSummary.test.tsx`): renders counts; shows savings line only when `hasSavings`; hides radical row when 0; methodology toggle reveals/hides; `onShare` fires.

- [x] **Task 5 — PostSessionShareCard + native share (AC: 1)**
  - [x] Create `mobile/src/components/engagement/PostSessionShareCard.tsx` — a high-contrast, screenshot-optimized card (app name/branding text + domain stats + time compression + streak count). Single render state.
  - [x] Share action: use **React Native's built-in `Share` API** (`import { Share } from 'react-native'; Share.share({ message })`). Build a concise text summary (domains, minutes, estimate, streak). **Do NOT add `expo-sharing`, `react-native-view-shot`, or any image-capture/native dependency** — none are installed and adding them forces a native rebuild that is out of scope (see Dev Notes "Sharing scope"). The card is the screenshot-worthy visual; the share button shares text.
  - [x] Wire `TimeCompressionSummary`'s `onShare` (or the summary screen) to render `PostSessionShareCard` and trigger `Share.share`. Guard `Share.share` in try/catch — a dismissed/failed share must never crash or block.
  - [x] Tests: mock `react-native`'s `Share`, assert `share` is called with a message containing the domain counts and minutes; assert a thrown/rejected share is swallowed.

- [x] **Task 6 — useLevelProgress hook + started-items count helper (AC: 6)**
  - [x] Add `countStartedItemsByIds(userDb, itemIds: string[]): number` to `mobile/src/data/user/srsStateRepository.ts` — `SELECT COUNT(*) FROM srs_states WHERE item_id IN (...)`. Follow the existing `parseItemId` + placeholder pattern in that file (e.g. `getSrsStatesForItems`). Return 0 for empty input. ("Started" = has an SRS row; burned/known imports already have rows, so this is the credible "in the learning system" measure — see Dev Notes.)
  - [x] Create `mobile/src/data/hooks/useLevelProgress.ts`. For the given level: get totals via `countItemsByLevel` (curriculum.db); for each of kanji/vocabulary/grammar, get item IDs via `listItemsByLevelAndType` then `countStartedItemsByIds` (user.db). Return `{ level, perType: Record<'kanji'|'vocabulary'|'grammar', { started: number; total: number }>, overallPercent: number, isLoading, error }`. Compute `overallPercent = round(100 × sumStarted / sumTotal)` guarding divide-by-zero (0 total → 0%).
  - [x] Two-query cross-DB pattern (no ATTACH yet) mirrors `useItemDependencyStatus`. Wrap reads defensively; on throw set `error` and return zeros (match the try/catch shape of `useStreak`/`useCognitiveLoad`).
  - [x] Tests (`useLevelProgress.test.tsx`): totals + started → correct per-type and overall %; zero-total level → 0% no crash; error path sets `error`.

- [x] **Task 7 — LevelProgressBar component (AC: 6, 7)**
  - [x] Create `mobile/src/components/engagement/LevelProgressBar.tsx`. Props: `{ level: JLPTLevel; perType; overallPercent }`. Anatomy: level label ("N5 Progress"), thin fill bar (`overallPercent`), domain counts row (Kanji X/Y, Grammar X/Y, Vocab X/Y).
  - [x] Accessibility: `accessibilityRole="progressbar"`, `accessibilityValue={{ min:0, max:100, now: overallPercent }}`, label summarizing per-domain counts. Never color-only — counts are always text.
  - [x] Use NativeWind semantic tokens only (`bg-surface`, `text-primary`, `text-secondary`, content-type accents `content-kanji`/`content-vocabulary`/`content-grammar` for the counts if desired, `radius-*`, `space-*`). No raw hex.
  - [x] Tests: renders counts/percent; progressbar a11y value matches `overallPercent`.

- [x] **Task 8 — Compose the Home screen (AC: 4, 5, 7)**
  - [x] Replace the placeholder body of `mobile/src/app/(tabs)/index.tsx` with the composed Home screen. Use `useCognitiveLoad` (large ring), `useStreak` + `StreakCounter`, `getStartingJlptLevel` + `useLevelProgress` + `LevelProgressBar`, and `useReviewQueue` (or a lightweight due-count read) for the Review button availability.
  - [x] Layout top→bottom: large `CognitiveLoadRing` (with hero spacing per UX-DR9 — a calm header zone is enough; do NOT build new illustration assets), primary **Review** button (`variant="primary"`), secondary **Learn** button (`variant="secondary"`, `onPress` → `router.push('/(tabs)/learn')`), `StreakCounter`, `LevelProgressBar`. SRS stage counts must NOT appear (UX-DR19).
  - [x] Review button behavior (AC5): when due items exist → enabled, label reflects availability (e.g. "Review" with count); when none due → calm disabled affordance ("All caught up") — no overdue-terror copy. Reuse `useReviewQueue` for the count, or read due count cheaply; avoid building a full queue just for the badge if a count query is simpler (document the choice).
  - [x] Use `useFocusEffect` to refetch streak/load/progress/due-count when Home regains focus (mirror the Stats screen's `useFocusEffect` refetch-on-refocus pattern, including the `isInitialFocusRef` skip-first guard) so values update after a session.
  - [x] Keep the layout container pattern consistent with other tabs: `MaxContentWidth` + `BottomTabInset` + `SafeAreaView` (`mobile/src/constants/theme.ts`).
  - [x] Preserve onboarding gating — Home is only reachable post-onboarding via `OnboardingRedirect`; do not add onboarding logic here.
  - [x] Add/extend `mobile/src/app/(tabs)/index.test.tsx`: ring renders, Review + Learn buttons present, streak + progress bar render, **no SRS stage breakdown present**, Review button disabled state when zero due.

- [x] **Task 9 — Test mocks + full verification (AC: all)**
  - [x] Extend `mobile/__mocks__/expo-sqlite.ts` if needed so `countStartedItemsByIds` (`SELECT COUNT(*) ... WHERE item_id IN (...)`) returns a controllable value (follow the existing GROUP BY / COUNT handler patterns added in stories 6-2/6-3 — see Dev Notes).
  - [x] Export new engagement components from `mobile/src/components/engagement/index.ts`.
  - [x] Run `npm run lint`, `npm run typecheck`, `npm test` from `mobile/` — all green. Run `npx jest src/utils/timeFormat.test.ts` and the new component/hook tests specifically.

## Dev Notes

### Out of scope (do NOT build — later stories / never)
- **No image-capture sharing.** No `expo-sharing`, no `react-native-view-shot`, no camera-roll save. Text share via RN `Share` only. (UX-DR10 "native share sheet" is satisfied by `Share.share`.)
- **No new migration / no new SQLite table.** Session summary stats are ephemeral provider state. The only DB addition is a read-only `COUNT` helper.
- **No SRS stage counts on Home** (UX-DR19) — they already live on Stats; leave them there.
- **No new illustration/hero image assets.** UX-DR9 "subtle hero graphics" → satisfy with calm spacing/layout around the ring; do not block on asset creation.
- **No level-up animation** for the progress bar (UX-DR12 mentions it as a future nicety) — static fill is sufficient for v1.
- Shadow-mode comparison stats (FR33j-PM) are Epic 8.

### Time compression methodology (FR33b/FR33c) — exact, conservative model
The estimate must be **defensible and conservative** (credibility is the whole point — FR33c). Model the multi-app stack as: per-item review time in a *separate, single-domain tool* (no cross-domain mixing) plus a fixed session overhead for juggling ≥2 separate tools (separate logins, separate review queues, context switching).

Put these in `config/constants.ts` (tunable):
```ts
// Conservative lower-bound seconds to review one item in a separate single-domain tool.
export const TIME_COMPRESSION_PER_ITEM_SECONDS: Record<
  'radical' | 'kanji' | 'vocabulary' | 'grammar', number
> = { radical: 15, kanji: 40, vocabulary: 30, grammar: 50 };
// Fixed minutes added for operating ≥2 separate tools in one study block.
export const TIME_COMPRESSION_SESSION_OVERHEAD_MINUTES = 5;
// Overhead only applies when the session actually spanned multiple domains.
export const TIME_COMPRESSION_MIN_DOMAINS_FOR_OVERHEAD = 2;
```
`estimateMultiAppMinutes(counts)` = `ceil( Σ(perItemSeconds[type] × counts[type]) / 60 + (distinctDomains ≥ 2 ? overhead : 0) )`.
`hasSavings = estimatedMinutes > actualMinutes`. When false, the UI shows neutral copy ("Nice focused session — N min") and **no** fabricated savings number. The methodology disclosure text should state plainly: "Estimated from typical per-item review times in separate single-purpose apps, plus time lost switching between them. Deliberately conservative." These constants are the single source of truth — cite them in the disclosure indirectly (don't hardcode the numbers in copy).

### Why "started" = has an `srs_states` row (LevelProgressBar)
The app has no single "learned" flag. Options considered: `item_study_status='known'` (set during onboarding/bulk-mark and mirrored from burned items) vs presence of an `srs_states` row (created when an item enters the SRS system, including via import seeding and `seedMissingSrsStatesForInProgress`). **Use `srs_states` presence** — it is the most faithful "this item is in my learning system" signal and is already the source of truth the review loop and Stats SRS breakdown use. `countStartedItemsByIds` counts these. (If a future story wants "mastered vs in-progress" granularity, that's a Stats concern, not Home.)

### Session-summary lifetime & both-paths routing
`review/_layout.tsx` wraps the **whole** review Stack in one `ReviewSessionProvider`. So `index.tsx` and the new `summary.tsx` share the same provider instance and the same `sessionSummary` — navigating index→summary preserves the counts. Snapshot `durationMs` when `isComplete` first flips (store in a ref/state) so the displayed minutes don't tick upward while the user reads the summary.

Two completion paths both land on summary (AC2):
1. **Natural completion** — `isComplete` becomes true in `index.tsx` → effect `router.replace('/review/summary')` (one-shot, ref-guarded).
2. **User-ended early** — `handleEndSession` (today `router.back()`) → change to `router.replace('/review/summary')`. The `usePreventRemove` guard already keys off `isEndingRef.current`; set `isEndingRef.current = true` before navigating (as it does now) so the prevent-remove dialog doesn't fire.

Edge case — **nothing due** (`totalItems === 0`): keep the existing lightweight inline "No items due for review right now" message in `index.tsx` rather than routing to a zero-item summary (a summary with 0 items and a time-compression claim would be nonsensical). Document this in code.

Edge case — user ends **before grading any item**: `sessionSummary.itemsReviewed === 0`. The summary should show a gentle zero state (no compression claim). Reuse the `hasSavings=false` neutral path.

### ReviewSessionProvider changes — keep the hot path clean (NFR1)
The <100ms answer path must not regress (AC7). Domain-count increments go on the **existing async tail** inside `gradeCurrentItem` (the `Promise.resolve().then(...)` block), or simply increment a `useRef` counter synchronously right where `setCurrentIndex` is called — a ref increment is O(1) and not a render. Prefer a ref-backed `domainCountsRef` plus a state mirror only if the summary needs reactivity (the summary mounts after the session, so a ref read at mount is fine — you likely don't need state for counts at all). Do not add DB writes for session stats.

### Sharing scope (UX-DR10)
`import { Share } from 'react-native'` is always available (no install). `Share.share({ message })` opens the OS share sheet on iOS/Android. That satisfies "native share sheet". The `PostSessionShareCard` is the on-screen screenshot-worthy artifact (the user screenshots it manually — the classic virality loop). Adding `react-native-view-shot`/`expo-sharing` to share a rendered PNG is a **native dependency** requiring a dev-client/rebuild and is explicitly out of scope. If product later wants PNG export, that's a follow-up story.

### Home screen — button hierarchy (UX-DR26) and "no terror backlog" (UX-DR20)
- Primary = Review (`variant="primary"`, solid `feedback-info` blue per the UX Button table). Secondary = Learn (`variant="secondary"`, teal). One primary per screen.
- Review availability copy is calm: enabled "Review" (optionally "Review (N)") when due > 0; disabled/calm "All caught up" when 0. **Never** "127 reviews overdue!!"-style copy.
- Use `useReviewQueue` only if you need the exact ordered queue; for a Home badge a cheaper due-count is fine. `getDueSrsStates(userDb).length` (already in `srsStateRepository.ts`) gives a due count without building the full weighted queue — prefer that for the Home button to avoid the queue-build cost on every Home focus. Document whichever you choose.

### Architecture compliance
- `utils/timeFormat.ts` is **pure** (zero React/RN) — matches `architecture.md` FR33b/FR33c mapping (`utils/timeFormat.ts` + `components/engagement/TimeCompressionSummary.tsx`).
- New visual components live in `components/engagement/` and export through its `index.ts` (matches existing `CognitiveLoadRing`/`StreakCounter`/`DailyThresholdNotice`).
- Hook in `data/hooks/`, repo helper in `data/user/srsStateRepository.ts`.
- Routes are file-based under `src/app/review/` (`summary.tsx`) and `src/app/(tabs)/index.tsx`.
- All fallible reads use the existing try/catch-in-hook pattern; no throwing across async boundaries. Pure util returns plain values (no Result needed — it can't fail on valid numeric input).
- NativeWind semantic tokens only (`tailwind.config.js`): `bg-background`/`bg-surface`/`bg-surface-elevated`, `text-primary`/`text-secondary`, content accents `content-kanji`/`content-vocabulary`/`content-grammar`, ring tokens already used by `CognitiveLoadRing`, `space-*`, `radius-*`, typography scale. No raw hex; `Colors`/`theme.ts` only for layout constants (`MaxContentWidth`, `BottomTabInset`).

### File structure — new / modified
**New:**
- `mobile/src/utils/timeFormat.ts` (+ `timeFormat.test.ts`)
- `mobile/src/components/engagement/TimeCompressionSummary.tsx` (+ `.test.tsx`)
- `mobile/src/components/engagement/PostSessionShareCard.tsx` (+ `.test.tsx`)
- `mobile/src/components/engagement/LevelProgressBar.tsx` (+ `.test.tsx`)
- `mobile/src/data/hooks/useLevelProgress.ts` (+ `useLevelProgress.test.tsx`)
- `mobile/src/app/review/summary.tsx`

**Modified:**
- `mobile/src/app/(tabs)/index.tsx` (placeholder → composed Home; add `index.test.tsx`)
- `mobile/src/app/review/index.tsx` (route both completion paths to summary; remove inline complete block except zero-due case)
- `mobile/src/providers/ReviewSessionProvider.tsx` (+ test) — session-stats tracking + `sessionSummary`
- `mobile/src/data/user/srsStateRepository.ts` (+ test) — `countStartedItemsByIds`
- `mobile/src/config/constants.ts` — time-compression constants
- `mobile/src/components/engagement/index.ts` — export new components
- `mobile/__mocks__/expo-sqlite.ts` — COUNT-with-IN handler if not already covered

### Reuse map (do NOT reinvent)
| Need | Reuse |
|------|-------|
| Today's load % for Home ring | `useCognitiveLoad` |
| Ring visual | `CognitiveLoadRing variant="large"` |
| Streak number/state | `useStreak` + `StreakCounter` |
| Curriculum totals per type | `countItemsByLevel` / `useItemCountsByLevel` |
| Item IDs by level+type | `listItemsByLevelAndType` |
| Started-item count | NEW `countStartedItemsByIds` (mirror `getSrsStatesForItems` SQL shape) |
| User's level | `getStartingJlptLevel` |
| Due count for Review button | `getDueSrsStates(userDb).length` |
| Buttons | `Button` (`primary`/`secondary`) |
| Refetch-on-refocus pattern | Stats screen `useFocusEffect` + `isInitialFocusRef` |
| Layout container | `MaxContentWidth` + `BottomTabInset` + `SafeAreaView` |
| Provider session ownership | `ReviewSessionProvider` (extend, don't fork) |
| Native share | RN built-in `Share.share` |
| Jest DB mock | `mobile/__mocks__/expo-sqlite.ts` |

### Testing requirements
- Tests co-located (`.test.ts`/`.test.tsx`). Run from `mobile/`: `npm run lint && npm run typecheck && npm test`.
- `timeFormat.test.ts` is pure-function testing — exercise zero/single/multi-domain, overhead boundary, `hasSavings` false, minute flooring/min-1, and that constants drive the math (don't hardcode expected magic numbers — derive from the constants).
- Component tests use the existing RTL + jest setup; mock `react-native`'s `Share`. Provider test extends `ReviewSessionProvider.test.tsx` (follow its `jest.mock` patterns for `srsStateRepository`, `streakRepository`, `weaknessRepository`, `cognitiveLoadRepository`).
- Hook test mocks `expo-sqlite` via the existing manual mock; ensure the COUNT-with-IN path returns a controllable number.
- Home `index.test.tsx`: assert **absence** of SRS stage breakdown (regression guard for UX-DR19) and the disabled Review state at zero due.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.5 (lines 941–958) — AC text, FR/UX-DR refs]
- [Source: _bmad-output/planning-artifacts/prd.md#Time Compression Display (FR33b line 611, FR33c line 612); FR47 offline (line 653)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — TimeCompressionSummary (965–971), PostSessionShareCard (973–978), LevelProgressBar (987–992); Home screen revised Direction C (line 695); Flow 2 Daily Review Loop summary→home (754–786); Button Hierarchy table (1069–1074); Phase 2 roadmap (1055–1060)]
- [Source: _bmad-output/planning-artifacts/architecture.md — file map `review/summary.tsx` (703), engagement components (732–734), `utils/timeFormat.ts` (843), `useLevelProgress.ts` (822); FR33b/FR33c mapping (912); Review session data flow → summary.tsx (953–957)]
- [Source: mobile/src/providers/ReviewSessionProvider.tsx — isComplete derivation (line 96), gradeCurrentItem async tail + setCurrentIndex (112–186), streak-on-complete effect (98–105)]
- [Source: mobile/src/app/review/index.tsx — inline Session Complete block (231–250), handleEndSession router.back (187–192), usePreventRemove/isEndingRef (90–97)]
- [Source: mobile/src/app/review/_layout.tsx — single ReviewSessionProvider wraps the Stack]
- [Source: mobile/src/components/engagement/CognitiveLoadRing.tsx, StreakCounter.tsx, index.ts; mobile/src/data/hooks/useCognitiveLoad.ts, useStreak.ts]
- [Source: mobile/src/data/curriculum/itemRepository.ts — countItemsByLevel (81), listItemsByLevelAndType (107), ItemType (6)]
- [Source: mobile/src/data/user/srsStateRepository.ts — getSrsStatesForItems IN-clause pattern (108–131), getDueSrsStates (82–97), parseItemId (22)]
- [Source: mobile/src/data/user/preferencesRepository.ts — getStartingJlptLevel (67)]
- [Source: mobile/src/app/(tabs)/stats.tsx — useFocusEffect refetch + isInitialFocusRef pattern (29–39); SrsStageBreakdown lives here, NOT Home]
- [Source: mobile/src/components/common/Button.tsx — variants primary/secondary; mobile/src/constants/theme.ts — MaxContentWidth (70), BottomTabInset (69)]
- [Source: mobile/src/config/constants.ts — SESSION_INTENSITY_MINUTES, COGNITIVE_LOAD_* patterns for adding new tunable constants]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md — 6-3/6-4 midnight/DST limitations accepted for v1; same posture here for session-duration wall-clock]

### Project Structure Notes
- All paths align with `architecture.md`'s declared structure (`review/summary.tsx`, `engagement/*`, `utils/timeFormat.ts`, `data/hooks/useLevelProgress.ts`). No variances.
- Cross-DB level progress uses the established two-query pattern (curriculum.db reads + user.db reads) since `ATTACH DATABASE` is still not wired (`database.ts` TODO at line 104). Do not introduce ATTACH for this story.
- `(tabs)/index.tsx` currently uses `TabPlaceholderScreen`; replacing it is expected and is the AC4 deliverable.

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

- Home Review button uses `getDueSrsStates(userDb).length` (cheap due-count) instead of full `useReviewQueue` to avoid queue-build cost on every Home focus.
- Zero-due sessions keep inline message in `review/index.tsx` rather than routing to an empty summary.

### Completion Notes List

- Implemented pure `timeFormat.ts` with conservative multi-app estimate constants and full unit tests.
- Extended `ReviewSessionProvider` with per-domain session counters, duration snapshot, and `sessionSummary` / `snapshotSessionDuration`.
- Both natural completion and early-end paths route to `/review/summary`; Done returns via `router.dismissAll()`.
- Built `TimeCompressionSummary`, `PostSessionShareCard` (text share via RN `Share`), and `LevelProgressBar` engagement components.
- Added `useLevelProgress` hook + `countStartedItemsByIds` repository helper (cross-DB two-query pattern).
- Composed real Home screen: large cognitive load ring, Review/Learn buttons, streak, level progress bar (no SRS breakdown).
- All 631 tests pass; lint and typecheck clean.

### File List

- mobile/src/config/constants.ts
- mobile/src/utils/timeFormat.ts
- mobile/src/utils/timeFormat.test.ts
- mobile/src/providers/ReviewSessionProvider.tsx
- mobile/src/providers/ReviewSessionProvider.test.tsx
- mobile/src/app/review/index.tsx
- mobile/src/app/review/summary.tsx
- mobile/src/app/(tabs)/index.tsx
- mobile/src/app/(tabs)/index.test.tsx
- mobile/src/components/engagement/TimeCompressionSummary.tsx
- mobile/src/components/engagement/TimeCompressionSummary.test.tsx
- mobile/src/components/engagement/PostSessionShareCard.tsx
- mobile/src/components/engagement/PostSessionShareCard.test.tsx
- mobile/src/components/engagement/LevelProgressBar.tsx
- mobile/src/components/engagement/LevelProgressBar.test.tsx
- mobile/src/components/engagement/index.ts
- mobile/src/data/hooks/useLevelProgress.ts
- mobile/src/data/hooks/useLevelProgress.test.tsx
- mobile/src/data/user/srsStateRepository.ts
- mobile/src/data/user/srsStateRepository.test.ts
- mobile/__mocks__/expo-sqlite.ts

### Change Log

- 2026-06-29: Story 6.5 implementation — post-session summary route, time compression util/components, Home screen composition, level progress hook.

### Review Findings

- [x] [Review][Decision] Review button renders disabled during initial dueCount load — resolved: added `dueCountLoading` state, folded into combined `isLoading` guard; Review button now renders inside the loading conditional [mobile/src/app/(tabs)/index.tsx]
- [x] [Review][Patch] Double navigation: `handleEndSession` never sets `navigatedToSummaryRef.current = true`, so if `isComplete` fires in the same tick as the early-end path, both effects call `router.replace('/review/summary')` independently — the two guards are non-overlapping [mobile/src/app/review/index.tsx]
- [x] [Review][Patch] SQL IN overflow: `countStartedItemsByIds` spreads all item IDs as individual bound params via `...numericIds`; SQLite limits `SQLITE_MAX_VARIABLE_NUMBER` to 999, but N2 vocabulary is ~1600 items and N1 is ~3500 — `useLevelProgress` will silently surface an error state for those levels [mobile/src/data/user/srsStateRepository.ts]
- [x] [Review][Patch] Emoji `🔥` in PostSessionShareCard and `buildShareMessage` violates CLAUDE.md ("Only use emojis if the user explicitly requests it") [mobile/src/components/engagement/PostSessionShareCard.tsx]
- [x] [Review][Patch] `sessionDate` defaults to `new Date()` at component render time in both `TimeCompressionSummary` and `PostSessionShareCard` — fixed by adding `sessionEndAt: number` to `SessionSummary` in provider, snapshotting alongside `durationSnapshotRef`, and passing `new Date(sessionSummary.sessionEndAt)` from summary.tsx [mobile/src/providers/ReviewSessionProvider.tsx, mobile/src/app/review/summary.tsx]
- [x] [Review][Patch] `Math.ceil` in `estimateMultiAppMinutes` rounds the result upward, systematically overstating multi-app time — changed to `Math.round` [mobile/src/utils/timeFormat.ts]
- [x] [Review][Patch] `formatMinutes(0)` returns 1 (minimum floor), so a session where `sessionStartRef` was never set will display "1 min studied" as a factual claim; zero-items path in summary.tsx now shows a simple "No items reviewed" message instead of `TimeCompressionSummary` [mobile/src/app/review/summary.tsx]
- [x] [Review][Defer] `useLevelProgress` runs 6+ synchronous DB calls per focus event — pre-existing pattern across `useStreak`, `useCognitiveLoad`; optimize with async if render jank is observed [mobile/src/data/hooks/useLevelProgress.ts] — deferred, pre-existing
- [x] [Review][Defer] `navigatedToSummaryRef` never reset if review component instance is reused — not current Expo Router behavior; revisit if stack keep-alive is enabled [mobile/src/app/review/index.tsx] — deferred, pre-existing
- [x] [Review][Defer] `dueCount` capped at `QUEUE_FETCH_LIMIT` (100) with no visual truncation indicator — pre-existing `getDueSrsStates` behavior, already noted in story 5-1 deferred work [mobile/src/data/user/srsStateRepository.ts] — deferred, pre-existing
- [x] [Review][Defer] `sessionSummary` object allocated on every render with no memoization — correctness unaffected; adds allocations and breaks `useEffect` dep-array stability for any future consumer [mobile/src/providers/ReviewSessionProvider.tsx] — deferred, pre-existing
- [x] [Review][Defer] `level` state not refreshed in `useFocusEffect` — Settings level-change UX not yet built; revisit when Settings allows JLPT level editing [mobile/src/app/(tabs)/index.tsx] — deferred, pre-existing
