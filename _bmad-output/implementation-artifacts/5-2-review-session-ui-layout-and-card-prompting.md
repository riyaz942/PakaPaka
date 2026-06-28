---
baseline_commit: b5215d3
---

# Story 5.2: Review session UI, layout, and card prompting

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a **learner**,
I want **a focused review screen with header context, safe exit, and clear answer-type prompts**,
so that **I stay oriented, never lose progress, and always know what to type (FR9, UX-DR5, UX-DR16, UX-DR20, UX-DR24, UX-DR34)**.

*Consolidates original stories 5.2 and 5.3 from epics — session chrome and card rendering are one unified UI pass. Answer validation and WanaKana ship in Story 5.3.*

## Acceptance Criteria

1. **Direction A compact session layout (UX-DR20)**

   **Given** an active review session on `/review` (modal route outside tabs)
   **When** the session renders with items in queue
   **Then** the screen uses three fixed zones: header (~56px), center-weighted focal (flex), fixed input bottom (~56px + keyboard)
   **And** the focal zone vertically centers the prompt (kanji glyph at `text-display`, grammar sentence at `text-body-lg`)
   **And** layout is safe-area aware (`SafeAreaView` + `KeyboardAvoidingView` on input zone)
   **And** primary chrome shows session progress as `currentIndex + 1 / totalItems` — **not** a raw "287 reviews pending" anxiety counter (UX-DR20 philosophy)

2. **SessionHeader with type badge (UX-DR16, UX-DR18)**

   **Given** an active review session
   **When** the header renders
   **Then** `SessionHeader` shows: small cognitive-load ring slot (32px), progress count (`"18 of 42"` format), and content-type badge (RADICAL / KANJI / VOCABULARY / GRAMMAR)
   **And** type badge uses `content-*` accent tokens with tinted background (e.g. `text-content-kanji` + `bg-content-kanji/15` pattern from Direction A mockup)
   **And** tab bar remains hidden (already satisfied by root `fullScreenModal` presentation — verify no regression)
   **And** header `accessibilityLabel` announces session context on focus: `"Item 12 of 42, cognitive load 0 percent, kanji item"` (ring percent is **0** until Epic 6 wires load tracking)
   **And** a tappable close control (X or "End") in the header triggers exit flow (AC3)

3. **Safe session exit (UX-DR24)**

   **Given** a review session in progress (at least one item shown or graded this session)
   **When** the user taps the header close control, presses Android hardware back, or attempts modal dismiss gesture
   **Then** a bottom-sheet-style confirmation appears: **"End session? Progress is saved."** with actions **"Keep going"** (ghost) and **"End session"** (primary/destructive)
   **And** **"Keep going"** dismisses the sheet and returns to the current item unchanged
   **And** **"End session"** navigates back (`router.back()`) without losing grades already persisted by `ReviewSessionProvider`
   **And** accidental navigation does **not** exit silently — intercept via `BackHandler` (Android) + Expo Router `usePreventRemove` or equivalent
   **And** implement sheet with React Native `Modal` (`animationType="slide"`) — **do not** add `@gorhom/bottom-sheet` in this story

4. **ReviewCard prompting state with answer-mode clarity (UX-DR5, UX-DR34, NFR5b)**

   **Given** an item in `prompting` state
   **When** `ReviewCard` renders
   **Then** an answer-mode label is visible at `text-body-lg` (e.g. **"Reading"**, **"Meaning"**, **"Production"** for grammar cloze) with distinct color token per mode:
   - Reading → `text-content-reading`
   - Meaning → `text-feedback-info`
   - Production (grammar) → `text-content-grammar`
   **And** item-type variant renders correctly:
   - **Radical / Kanji / Vocabulary:** large centered `primaryForm` (`text-display`)
   - **Grammar:** cloze sentence with blank placeholder (use `primaryForm` if curriculum provides cloze; otherwise render `primaryForm` + `text-body-lg` instruction line)
   **And** `SRSStageIndicator` remains visible in focal zone (reuse Story 5.1 component)
   **And** meanings are **hidden** during prompting for reading/production prompts (no spoiler); shown only for meaning prompts if product-appropriate (primary meaning as secondary hint line — match WaniKani: meaning prompt shows kanji, user types English)
   **And** input zone shows a **styled shell** (`TextInput` appearance, full-width, `surface-elevated` bg, mode-appropriate placeholder) — **disabled/readOnly until Story 5.3** wires `WanaKanaInput`
   **And** **no celebratory animations** on prompt render; **no** `LayoutAnimation`, `Reanimated` transitions, or confetti between items (NFR5b)
   **And** Story 5.1 QA grade buttons (Again/Hard/Good/Easy) are **removed** from default UI; optional `__DEV__`-only grade row permitted for engine QA until 5.3 lands

5. **Prompt type resolution on ReviewItem**

   **Given** a `ReviewItem` from the queue
   **When** the session hydrates or advances
   **Then** each item carries a resolved `promptType`: `'reading' | 'meaning' | 'production'`
   **And** resolution is deterministic pure logic in `core/srs/promptResolver.ts` (tested):
   - `radical` → `meaning`
   - `kanji` → `reading` when `srsState.reps % 2 === 0`, else `meaning`
   - `vocabulary` → `reading` when `srsState.reps % 2 === 0`, else `meaning`
   - `grammar` → `production`
   **And** `ReviewItem` type extended in `core/srs/srs.types.ts`; `queueBuilder.mapToReviewItem` calls resolver
   **And** `ReviewCard` reads `promptType` — never infers mode from `itemType` alone

6. **CognitiveLoadRing placeholder (Epic 6 deferral)**

   **Given** `SessionHeader` requires a small ring per UX-DR16
   **When** Epic 6 load tracking is not yet implemented
   **Then** create `CognitiveLoadRing` in `components/engagement/` with `variant="small"` showing **static 0%** (or `itemsAnswered / sessionCap` if cap is trivially readable from `session_intensity` — document choice in Dev Agent Record)
   **And** ring uses `ring-start` token, `accessibilityRole="progressbar"`, numeric percent in label — never color-only
   **And** **no continuous fill animation** in this story (Epic 6 owns stepped/static updates per UX-DR30)

7. **Tests and CI**

   **Given** implementation is complete
   **When** CI runs in `mobile/`
   **Then** `npm run lint`, `npm run typecheck`, and `npm test` pass
   **And** tests cover: `promptResolver` determinism; `SessionHeader` progress + badge + a11y label; `ReviewCard` prompting variants (kanji reading, kanji meaning, grammar); exit sheet confirm/dismiss behavior (RTL)
   **And** existing Story 5.1 tests remain green

## Tasks / Subtasks

- [x] **AC5 — `promptResolver.ts`** (AC: 5)
  - [x] Add `PromptType` union and `resolvePromptType(itemType, srsState)` in `mobile/src/core/srs/promptResolver.ts`
  - [x] Extend `ReviewItem` with `promptType: PromptType`
  - [x] Update `queueBuilder.ts` `mapToReviewItem` to attach `promptType`
  - [x] Co-located `promptResolver.test.ts`

- [x] **AC6 — `CognitiveLoadRing` stub** (AC: 6)
  - [x] Create `mobile/src/components/engagement/CognitiveLoadRing.tsx` — `variant: 'small' | 'large'`, small variant for header (32px)
  - [x] Static 0% display; export from `components/engagement/index.ts`
  - [x] Co-located `CognitiveLoadRing.test.tsx` (progressbar role, percent label)

- [x] **AC2 — `SessionHeader.tsx`** (AC: 2)
  - [x] Create `mobile/src/components/review/SessionHeader.tsx`
  - [x] Props: `currentIndex`, `totalItems`, `itemType`, `cognitiveLoadPercent` (default 0), `onExitPress`
  - [x] Compose small `CognitiveLoadRing`, progress text (`"N of M"`), type badge, close button
  - [x] Reuse `ITEM_TYPE_LABELS` / singular badge labels (KANJI not Kanji — match mockup overline style)
  - [x] Co-located `SessionHeader.test.tsx`

- [x] **AC4 — `ReviewCard.tsx` prompting state** (AC: 4)
  - [x] Create `mobile/src/components/review/ReviewCard.tsx` with `state: 'prompting' | 'evaluating' | 'correct' | 'incorrect' | 'typo'` prop (only `prompting` fully implemented; others render `null` or minimal placeholder for 5.3)
  - [x] Answer-mode label component (inline or `AnswerModeLabel.tsx`)
  - [x] Variants: radical/kanji/vocab focal display; grammar cloze layout
  - [x] Input shell: styled disabled `TextInput` + placeholder map per `promptType`
  - [x] Co-located `ReviewCard.test.tsx`

- [x] **AC3 — `SessionExitSheet.tsx`** (AC: 3)
  - [x] Create `mobile/src/components/review/SessionExitSheet.tsx` using RN `Modal`
  - [x] Copy: title "End session?", body "Progress is saved.", buttons per UX spec
  - [x] Use existing `Button` component (`ghost` + `primary`)
  - [x] Co-located test for visibility + button callbacks

- [x] **AC1/2/3/4 — Refactor `review/index.tsx`** (AC: 1–4)
  - [x] Replace minimal 5.1 layout with Direction A three-zone composition
  - [x] Wire `SessionHeader`, `ReviewCard`, `SessionExitSheet`, `useReviewSession()`
  - [x] Add `KeyboardAvoidingView` (`behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`)
  - [x] Intercept back: `BackHandler` + `usePreventRemove` from `@react-navigation/core`
  - [x] Remove production QA grade buttons; preserve error/loading/complete screens from 5.1
  - [x] Create `mobile/src/components/review/index.ts` re-exports

- [x] **AC7 — CI** (AC: 7)
  - [x] Run `npm run lint && npm run typecheck && npm test` from `mobile/`

### Review Findings

- [x] [Review][Decision] Meanings shown during meaning prompt — resolved: hide meanings entirely during prompting state; meanings revealed in result state (5.3)
- [x] [Review][Decision] reps===0 routes new kanji/vocab to reading first — resolved: keep spec formula (`reps % 2 === 0 → reading`); first review is reading by design
- [x] [Review][Decision] "End session" button lacks destructive visual styling — resolved: added `destructive` variant to `Button` component
- [x] [Review][Patch] Hardware back while exit sheet open pops screen silently — fixed: BackHandler now returns `true` when `exitVisible=true` [mobile/src/app/review/index.tsx]
- [x] [Review][Patch] KeyboardAvoidingView wraps only DevGradeButtons; TextInput inside ReviewCard has no keyboard avoidance — fixed: TextInput moved out of ReviewCard into KAV input zone [mobile/src/app/review/index.tsx, mobile/src/components/review/ReviewCard.tsx]
- [x] [Review][Patch] resolvePromptType has no default case — fixed: switched to if-chain; unknown itemType falls through to `'meaning'` safely [mobile/src/core/srs/promptResolver.ts]
- [x] [Review][Patch] SessionHeader container View missing `accessible={true}` — fixed: info section (ring + progress + badge) wrapped in `accessible={true}` View; close button remains separately focusable [mobile/src/components/review/SessionHeader.tsx]
- [x] [Review][Patch] Double-tap "End session" can fire `router.back()` twice — fixed: `isEndingRef` guard in `handleEndSession` prevents re-entry [mobile/src/app/review/index.tsx]
- [x] [Review][Patch] Negative `srsState.reps` causes JS modulo to return −1 — fixed: `Math.abs(srsState.reps)` before modulo [mobile/src/core/srs/promptResolver.ts]
- [x] [Review][Patch] CognitiveLoadRing `percent` prop unclamped — fixed: clamped to `[0, 100]` before rendering and accessibilityValue [mobile/src/components/engagement/CognitiveLoadRing.tsx]
- [x] [Review][Patch] `handleEndSession` setState/navigation race — fixed: `isEndingRef.current = true` disables `usePreventRemove` before `router.back()` commits [mobile/src/app/review/index.tsx]

## Dev Notes

### Scope at a glance

Story 5.2 delivers the **production review shell** Epic 5 depends on for user-facing sessions: Direction A layout, `SessionHeader`, `ReviewCard` prompting state, answer-mode labeling, and safe exit. It **replaces** the Story 5.1 minimal proof UI (progress text + QA grade buttons) with UX-spec layout while **keeping** `ReviewSessionProvider` / queue engine untouched.

**In scope:** Layout zones, header chrome, prompting card, prompt type resolution, exit confirmation, cognitive load ring **visual stub**.

**Out of scope (do not build):**
| Deferred | Owner |
| --- | --- |
| `WanaKanaInput`, live typing, submit handler | Story 5.3 |
| `readingEvaluator`, `meaningEvaluator`, Levenshtein, conjugation | Story 5.3 |
| Result states (`correct`/`incorrect`/`typo`) with feedback colors + haptics | Story 5.3 |
| `ProgressiveHint`, `ReinforcementHighlight` | Story 5.4 |
| Real cognitive load increment + ring fill logic | Epic 6 |
| Post-session `summary.tsx`, `TimeCompressionSummary` | Epic 6 |
| Home Review CTA | Epic 6 |

### Critical: build on Story 5.1 — do not rebuild engine

| Asset | Location | Role in 5.2 |
| --- | --- | --- |
| `ReviewSessionProvider` | `providers/ReviewSessionProvider.tsx` | **Keep** — provides `currentItem`, `currentIndex`, `totalItems`, `gradeCurrentItem`, prefetch |
| `useReviewQueue` | `data/hooks/useReviewQueue.ts` | **Keep** — no changes unless extending hydration for grammar cloze |
| `SRSStageIndicator` | `components/common/SRSStageIndicator.tsx` | **Reuse** inside `ReviewCard` focal zone |
| `ReviewItem` / queue | `core/srs/srs.types.ts`, `queueBuilder.ts` | **Extend** with `promptType` only |
| Review route modal | `app/_layout.tsx` `presentation: 'fullScreenModal'` | **Keep** — tab bar already hidden (UX-DR18) |
| Error / empty / complete screens | `app/review/index.tsx` | **Preserve** loading, error retry, session complete flows from 5.1 |

### What already exists vs what you build

| Exists (reuse) | Missing (you build) |
| --- | --- |
| `SRSStageIndicator`, `Button`, NativeWind tokens | `components/review/*` (entire folder) |
| `ITEM_TYPE_LABELS` in `itemRepository.ts` | `SessionHeader`, `ReviewCard`, `SessionExitSheet` |
| `ReviewSessionProvider` + minimal `review/index.tsx` | `CognitiveLoadRing` stub in `components/engagement/` |
| `tailwind.config.js` `content-*`, `ring-*` tokens | `core/srs/promptResolver.ts` |

### Architecture compliance (must follow)

- **Layering:** `promptResolver.ts` = pure TS in `core/srs/`, zero React imports. UI in `components/review/`. Orchestration stays in `app/review/index.tsx` + existing provider.
- **No new dependencies:** Use RN `Modal`, `KeyboardAvoidingView`, `BackHandler`. Do **not** add bottom-sheet libraries.
- **Performance:** No animations between items (NFR5b). Prompt → next item must remain instant when 5.3 wires validation.
- **Styling:** NativeWind semantic tokens only — `text-content-kanji`, `bg-surface-elevated`, `text-display`, etc. No raw hex in components.
- **Named exports:** `export function ReviewCard` — not default export (architecture convention).
- **Co-located tests:** `*.test.tsx` beside each new component.

### Direction A layout implementation

```
┌─────────────────────────────────────┐
│ SessionHeader (~56px)               │
│ [ring 32px] 18 of 42  [KANJI]  [X]  │
├─────────────────────────────────────┤
│                                     │
│         FOCAL (flex 1)              │
│         Reading  ← answer mode      │
│              食                     │
│         Apprentice                  │
│                                     │
├─────────────────────────────────────┤
│ INPUT ZONE (fixed bottom)           │
│ [ Type reading in hiragana...    ]  │
└─────────────────────────────────────┘
```

Reference mockup: `_bmad-output/planning-artifacts/ux-design-directions.html` § Direction A.

**Implementation pattern for `review/index.tsx`:**

```tsx
<SafeAreaView className="flex-1 bg-background">
  <SessionHeader ... onExitPress={() => setExitVisible(true)} />
  <View className="flex-1 justify-center px-space-md">
    <ReviewCard item={currentItem} state="prompting" />
  </View>
  <KeyboardAvoidingView ...>
    {/* input shell lives inside ReviewCard or as sibling — keep focal centered */}
  </KeyboardAvoidingView>
  <SessionExitSheet visible={exitVisible} onKeepGoing=... onEndSession=... />
</SafeAreaView>
```

### SessionHeader type badge styling

Match Direction A mockup (`ux-design-directions.html`):

| `itemType` | Text class | Background pattern |
| --- | --- | --- |
| radical | `text-content-radical` | `bg-content-radical/15` |
| kanji | `text-content-kanji` | `bg-content-kanji/15` |
| vocabulary | `text-content-vocabulary` | `bg-content-vocabulary/15` |
| grammar | `text-content-grammar` | `bg-content-grammar/15` |

Badge text: singular uppercase overline (`KANJI`, not `Kanji`).

### ReviewCard prompting variants

| `itemType` + `promptType` | Focal content | Placeholder |
| --- | --- | --- |
| radical + meaning | Large `primaryForm` | `"Type the meaning in English..."` |
| kanji + reading | Large `primaryForm`, hide meanings | `"Type reading in hiragana..."` |
| kanji + meaning | Large `primaryForm` | `"Type the meaning in English..."` |
| vocabulary + reading | Large `primaryForm` | `"Type reading in hiragana..."` |
| vocabulary + meaning | Large `primaryForm` | `"Type the meaning in English..."` |
| grammar + production | Cloze / `primaryForm` sentence | `"Type the conjugated form..."` |

**Grammar cloze:** If `ReviewItem` lacks dedicated cloze field today, render `primaryForm` as the sentence and document in Dev Agent Record whether curriculum `primaryForm` already contains `＿` blank marker. Do **not** block 5.2 on new DB columns — use what `getItemById` returns; extend hydration in `useReviewQueue` only if grammar items need `exampleSentence` from curriculum (check `itemRepository` grammar fields before implementing).

### Exit flow and persisted progress

Grades already persist asynchronously in `ReviewSessionProvider.gradeCurrentItem`. Exiting mid-session:
- Items **already graded** → SRS rows written (or queued in `pendingWrites` — flushed on unmount per 5.1)
- Items **not yet shown** → no state change
- **No** "save session progress" API needed — confirm copy is accurate because graded items are saved

Use `usePreventRemove` from `@react-navigation/native` (already a dependency via expo-router):

```tsx
usePreventRemove(hasActiveSession, ({ data }) => {
  setExitVisible(true);
});
```

On Android, also register `BackHandler` when sheet is closed to show sheet instead of immediate pop.

### QA grade button removal

Story 5.1 shipped Again/Hard/Good/Easy for engine proof. Story 5.2 **removes** them from production layout. If engine QA is still needed before 5.3:

```tsx
{__DEV__ && <DevGradeButtons onGrade={gradeCurrentItem} />}
```

Place at bottom below input shell, not in focal zone.

### `CognitiveLoadRing` stub contract

Epic 6 will pass real `percent` from `useCognitiveLoad`. For 5.2:

```tsx
type CognitiveLoadRingProps = {
  variant: 'small' | 'large';
  percent: number; // 0–100
  accessibilityLabel?: string;
};
```

Small variant: 32×32 SVG or `View` with border arc — static `percent={0}` from `SessionHeader`. Large variant can render placeholder circle (Epic 6 home screen). Use `react-native-svg` only if already in project; otherwise simple `View` border ring is acceptable for stub (check `package.json` — **no** new deps unless `react-native-svg` already present).

### File structure (new / modified)

```
mobile/src/
  core/srs/
    promptResolver.ts          NEW
    promptResolver.test.ts     NEW
    srs.types.ts               MODIFY — add promptType to ReviewItem
    queueBuilder.ts            MODIFY — mapToReviewItem
  components/
    review/
      SessionHeader.tsx        NEW
      SessionHeader.test.tsx   NEW
      ReviewCard.tsx           NEW
      ReviewCard.test.tsx      NEW
      SessionExitSheet.tsx     NEW
      SessionExitSheet.test.tsx NEW
      index.ts                 NEW
    engagement/
      CognitiveLoadRing.tsx    NEW (stub)
      CognitiveLoadRing.test.tsx NEW
      index.ts                 NEW or MODIFY
  app/review/
    index.tsx                  MODIFY — full layout refactor
```

**Do not create in 5.2:** `WanaKanaInput.tsx`, `ProgressiveHint.tsx`, `ReinforcementHighlight.tsx`, `review/summary.tsx`.

### Previous story intelligence (5.1)

- `ReviewSessionProvider` uses `isGrading` ref to prevent double-tap skip — preserve when removing grade buttons.
- `pendingWrites` flushes on unmount — exit via `router.back()` triggers flush; safe.
- `gradeCurrentItem` remains callable from `__DEV__` QA until 5.3 submit path exists.
- Review patches from 5.1 code review: error surfaces, queue seed failures, blank `currentItem` spinner — **do not regress** these states in layout refactor.
- `ts-fsrs` API: `scheduler.next(card, now, grade)` — param order matters (documented in 5.1 Dev Agent Record).

### Git intelligence

| Commit | Relevance |
| --- | --- |
| `b5215d3` Review queue + FSRS + prefetch | Baseline — all engine files to preserve |
| `f52ceda` Personal mnemonics | Optional `personalMnemonic` on `ReviewItem` — may show in result state later, not prompting |
| Epic 4 learn detail components | `KanjiDetail` reading/meaning label patterns for UX-DR34 consistency |

### Latest technical notes

- **Expo Router 55:** `usePreventRemove` from `@react-navigation/native` v7 — compatible with expo-router 55 stack.
- **No `react-native-svg` in package.json** — implement ring stub with `View` + border or add `react-native-svg` only if Epic 6 architecture requires SVG; prefer zero-dep ring stub for 5.2.
- **Modal for exit sheet:** `transparent` + bottom-aligned `View` with `bg-surface-elevated rounded-t-radius-lg` — matches UX "bottom sheet" without new library.
- **Reduced motion:** Ring stub has no animation; satisfies NFR5b for inter-item transitions.

### Testing requirements

| File | Minimum coverage |
| --- | --- |
| `promptResolver.test.ts` | Each item type; kanji/vocab alternation by `reps % 2` |
| `SessionHeader.test.tsx` | Progress text, badge label, close button, a11y label |
| `ReviewCard.test.tsx` | Reading vs meaning labels; grammar production; SRS badge present; input placeholder per mode |
| `SessionExitSheet.test.tsx` | Keep going / end session callbacks |
| `CognitiveLoadRing.test.tsx` | progressbar role, percent text |

Manual QA:
1. Open `/review` via `__DEV__` Home entry → verify three-zone layout
2. Tap X → sheet appears → Keep going → stays on item
3. Tap X → End session → returns to tabs
4. Android hardware back → sheet (not silent exit)
5. Advance items — no animation flash between prompts

Run from `mobile/`: `npm run lint && npm run typecheck && npm test`.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 5, Story 5.2 AC]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — ReviewCard, SessionHeader, layout zones, UX-DR5/16/18/20/24/34]
- [Source: `_bmad-output/planning-artifacts/ux-design-directions.html` — Direction A compact mockup]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — `components/review/` tree, review data flow, NFR5b]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR9, NFR5b]
- [Source: `_bmad-output/implementation-artifacts/5-1-review-queue-builder-fsrs-scheduling-and-prefetch.md` — engine baseline, deferred UI list]
- [Source: `mobile/src/app/review/index.tsx` — current minimal UI to replace]
- [Source: `mobile/src/providers/ReviewSessionProvider.tsx` — session state API]
- [Source: `mobile/tailwind.config.js` — content-type and ring tokens]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `usePreventRemove` is exported from `@react-navigation/core`, not re-exported from `@react-navigation/native` in v7. Imported from core directly.
- `getByRole('progressbar')` does not map correctly in RNTL v13.3 in this project. Tests use `UNSAFE_getByProps({ accessibilityRole: 'progressbar' })` and `getByLabelText` instead.
- `CognitiveLoadRing` implemented with `View` + border (no `react-native-svg` — not in package.json).
- Grammar `promptType: 'meaning'` not added because grammar always resolves to `production`.
- `ReviewSessionProvider.test.tsx` updated to include `promptType: 'reading'` in `makeReviewItem` fixture after extending `ReviewItem`.

### Completion Notes List

- **AC5 (promptResolver):** Pure `resolvePromptType(itemType, srsState)` in `core/srs/promptResolver.ts`. `ReviewItem` extended with `promptType`. `queueBuilder.mapToReviewItem` attaches `promptType` on build. 6 tests cover all item types and kanji/vocab alternation.
- **AC6 (CognitiveLoadRing):** Stub component in `components/engagement/`. Simple `View` ring with border (no SVG dependency). Static `percent` display, `accessibilityRole="progressbar"`, `accessibilityValue` for screen readers. 5 tests pass.
- **AC2 (SessionHeader):** `components/review/SessionHeader.tsx`. `CognitiveLoadRing` small variant, `"N of M"` progress text, uppercase content-type badge with `/15` tinted background, close button with `accessibilityLabel="End session"`. Full a11y label on container. 7 tests pass.
- **AC4 (ReviewCard):** `components/review/ReviewCard.tsx`. Mode label with per-type color token. Large `primaryForm` focal for radical/kanji/vocab; `primaryForm` sentence for grammar. Meanings hidden for reading/production prompts. Disabled `TextInput` shell with placeholder per `promptType`. `SRSStageIndicator` reused. States other than `prompting` render `null` (5.3 placeholder). 13 tests pass.
- **AC3 (SessionExitSheet):** `components/review/SessionExitSheet.tsx` using RN `Modal` with `animationType="slide"` + `transparent`. Title, body, "End session" (primary) + "Keep going" (ghost) buttons. `onRequestClose` routes to `onKeepGoing`. 5 tests pass.
- **AC1/2/3/4 (review/index.tsx):** Direction A three-zone layout: `SessionHeader` (56px) → `flex-1` focal with `ReviewCard` → `KeyboardAvoidingView` input zone. `usePreventRemove` from `@react-navigation/core` blocks navigation while session active. `BackHandler` for Android hardware back. `__DEV__`-only grade buttons preserved below input zone. Error / loading / complete screens from 5.1 preserved intact.
- **AC7 (CI):** `lint` clean, `typecheck` clean, all 416 tests pass (36 new tests across 5 new suites).

### File List

- `mobile/src/core/srs/promptResolver.ts` — NEW
- `mobile/src/core/srs/promptResolver.test.ts` — NEW
- `mobile/src/core/srs/srs.types.ts` — MODIFIED (added `promptType` to `ReviewItem`)
- `mobile/src/core/srs/queueBuilder.ts` — MODIFIED (`mapToReviewItem` attaches `promptType`)
- `mobile/src/components/engagement/CognitiveLoadRing.tsx` — NEW
- `mobile/src/components/engagement/CognitiveLoadRing.test.tsx` — NEW
- `mobile/src/components/engagement/index.ts` — NEW
- `mobile/src/components/review/SessionHeader.tsx` — NEW
- `mobile/src/components/review/SessionHeader.test.tsx` — NEW
- `mobile/src/components/review/ReviewCard.tsx` — NEW
- `mobile/src/components/review/ReviewCard.test.tsx` — NEW
- `mobile/src/components/review/SessionExitSheet.tsx` — NEW
- `mobile/src/components/review/SessionExitSheet.test.tsx` — NEW
- `mobile/src/components/review/index.ts` — NEW
- `mobile/src/app/review/index.tsx` — MODIFIED (full Direction A layout refactor)
- `mobile/src/providers/ReviewSessionProvider.test.tsx` — MODIFIED (added `promptType` to fixture)

## Change Log

- 2026-06-27: Story 5.2 implemented — Direction A review session layout, SessionHeader, ReviewCard prompting state, SessionExitSheet, CognitiveLoadRing stub, promptResolver; 36 new tests; all 416 tests green.
