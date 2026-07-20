---
baseline_commit: 76ddc97
---

# Story 2.2: Home Triage, Post-Session Proof & Days Studied

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a learner,
I want Home to offer today’s work with clear empty states and triage, and Stats to show calm monthly activity,
so that I always know what to do next without streak anxiety or an overdue mountain.

## Acceptance Criteria

1. **Given** I open Home  
   **When** the screen renders  
   **Then** permanent sections are present: greeting (comprehensible sentence + day-1 fallback), goal ring, Learn CTA, Review CTA, one-week forecast with wall annotation on heavy days, reading readiness (FR58, UX-DR4)  
   **And** Home never auto-starts a session — I choose the mode  
   **And** Review is primary and Learn is secondary; reviews-ready count lives on the Review CTA only (UX-DR3)  
   **And** a thin JLPT progress bar may sit under the CTAs  
   **And** no streak flame or streak-at-risk UI appears (R2, UX-DR27)

2. **Given** items are genuinely at risk  
   **When** the at-risk section is shown  
   **Then** I see a count plus top 5–10 items and an inline “do a small revision” CTA (FR59)  
   **And** tapping opens a full list; framing is invitation, never failure

3. **Given** passages remain locked  
   **When** reading readiness is shown  
   **Then** it frames a destination (“N items from unlocking…”) not a dead end (FR60)

4. **Given** I return after an absence with a large backlog  
   **When** welcome-back triage appears  
   **Then** it offers a slice (e.g. “20 of your 340 due”) instead of dumping the full backlog (FR61)

5. **Given** conditional banners apply (curriculum update, import nudge, etc.)  
   **When** they are eligible  
   **Then** they appear as designed empty-state-aware conditionals without blocking the permanent sections (FR58, UX-DR5)

6. **Given** I complete a review session  
   **When** the post-session summary shows  
   **Then** time compression is the centerpiece with domain breakdown and goal-met/overshoot state (FR33b–c, UX-DR12)  
   **And** there is no streak row on the share card

7. **Given** I visit Stats  
   **When** activity is displayed  
   **Then** I see “days studied this month” (calm, no flame) (UX-DR20)  
   **And** streak-at-risk notifications are not sent (FR20 amended)

## Tasks / Subtasks

- [ ] **Task 1 — Remove streak product surfaces (Home + post-session)** (AC: #1, #6, #7)
  - [ ] Remove `StreakCounter` from `app/(tabs)/index.tsx` (and stop fetching `useStreak` solely for Home UI).
  - [ ] Remove streak row from `PostSessionShareCard` + `buildShareMessage` (drop `currentStreak` prop).
  - [ ] Remove `StreakCelebration` from `review/summary.tsx` and `lesson/complete.tsx` (R2 / UX-DR12 / UX-DR27). Keep `streaks` table + `recordReviewAndUpdateStreak` writes for now (data may still feed future Stats polish); do **not** surface flame/at-risk UI.
  - [ ] Confirm notifications: `scheduleStreakReminder` already schedules a generic review nudge (“Time to review!”) — **no streak-at-risk push exists**. Rename to `scheduleReviewReminder` (or keep name with a deprecation comment) so Settings copy is not streak-framed. Do not add streak-at-risk notifications.
  - [ ] Update Home / share-card / summary / Settings tests accordingly.

- [ ] **Task 2 — Home CTA hierarchy + permanent shell** (AC: #1)
  - [ ] Reorder CTAs: **Review first (primary / accent)**, **Learn second (secondary)**. Today Learn is above Review — that violates UX-DR3/UX-DR4.
  - [ ] Review CTA copy: `Review — N ready` when due > 0; calm empty state when 0 (`All caught up` / next-due hint if cheap). Count on CTA only — no tab badge.
  - [ ] Keep Learn allowance subtitle behavior from feedback 04 (remaining / exhausted).
  - [ ] Keep thin `LevelProgressBar` under CTAs when starting JLPT level is set.
  - [ ] Preserve Story 2.1 GoalRing hero + rise/reduction prompts + focus refetch (BUG1). Do not regress goal semantics.
  - [ ] Soft hero: calm surface behind ring is enough — no new illustration assets.

- [ ] **Task 3 — Greeting: comprehensible sentence + day-1 fallback** (AC: #1)
  - [ ] Keep `おかえり！` title.
  - [ ] Subtitle day-1 / empty fallback: calm invitation (existing “Welcome back — here's today at a glance.” or UX mock “Good morning — ready when you are.”).
  - [ ] **Honest scope for I4:** `example_sentences` in `curriculum.db` does **not** store `vocabulary_slugs` (only japanese/furigana/english/tags). Full “every word already learned” filtering is blocked without a curriculum pipeline change.
  - [ ] **Interim:** when the user has ≥1 started vocabulary item with an example sentence, show that sentence’s Japanese (prefer Guru+ if available); otherwise fallback. Document the interim in Completion Notes. Do **not** expand the compile pipeline in this story.

- [ ] **Task 4 — One-week forecast + wall annotation** (AC: #1)
  - [ ] Pure helper in `core/` (e.g. `core/engagement/reviewForecast.ts`): given non-burned `srs_states` with `due_date`, bucket counts into **local calendar days** for today → today+6.
  - [ ] Data: add a cheap repo read (e.g. `getUpcomingDueDates(userDb, untilIso)`) returning due dates only — avoid building the full review queue on Home focus.
  - [ ] UI component `ReviewForecast` (engagement/): seven day cells + counts; designed empty state when all zeros (day 1).
  - [ ] **Wall rule (resolve brainstorm O3):** flag the day with the maximum count when `max >= max(FORECAST_WALL_MIN_DUE, ceil(mean * FORECAST_WALL_RATIO))` with named constants (suggest `FORECAST_WALL_MIN_DUE = 30`, `FORECAST_WALL_RATIO = 1.5`). Annotation copy invitation-style: e.g. “Wall day Wed — 41 due. Go light on lessons.” If no day qualifies, no wall annotation (flat heavy weeks stay quiet).
  - [ ] Co-locate pure tests for bucketing + wall trigger.

- [ ] **Task 5 — Reading readiness (FR60) with shared unlock helper** (AC: #3)
  - [ ] **M1 decision (required):** extract shared unlock math now so Story 3.2 reuses it — do **not** invent interim lock math.
  - [ ] Pure `core/content/passageUnlock.ts` (name flexible):
    - Inputs: linked vocab+grammar item IDs + map of `srs_stage_label` (or equivalent).
    - Unlock when `guruOrAboveCount / linkedCount >= PASSAGE_UNLOCK_COVERAGE` (**0.9**). Empty linked set → treat as locked with N = 0 or hide section (document choice; prefer hide readiness when no passages/links).
    - Guru+ = stage in `guru | master | enlightened | burned` (burned counts as covered).
    - `itemsRemainingToUnlock` = how many more linked items need Guru+ to cross 90% (ceil math — pure + tested).
  - [ ] Curriculum reads: query `passage_vocabulary_links` + `passage_grammar_links` (already compiled). Extend `passageRepository` with link getters + a “next destination” picker (lowest remaining among locked passages at user’s JLPT, else first locked overall).
  - [ ] UI `ReadingReadiness`: destination framing (“N items from unlocking {title}”); empty state for day 1 that is **not** a shame wall (e.g. “Your first passage unlocks as you learn — start a lesson”).
  - [ ] Tap → navigate to Read/Browse passage detail if route exists (`/read/[id]` today); acceptable until Epic 3 Browse lands.

- [ ] **Task 6 — At-risk / refresher section (FR59)** (AC: #2)
  - [ ] Pure ranker in `core/` (e.g. `selectAtRiskItems`): combine **weakness score** (`calculateWeaknessScore`) with **due proximity** (overdue/soonest `due_date`). Require `WEAKNESS_MIN_SAMPLE` met and score > 0 (or a small `AT_RISK_MIN_SCORE` constant). Cap list; expose `totalCount` + `topItems` (5–10).
  - [ ] Wire via `weaknessRepository` + `srsStateRepository` batch reads (chunked `IN` — match existing patterns). Hook e.g. `useAtRiskItems`.
  - [ ] UI: conditional Home section — invitation copy (“N items ready for a refresher”), top 5–10 rows (form/meaning if cheap via curriculum batch), “+N more”, inline CTA “Do a small revision”.
  - [ ] Full list: modal or lightweight route; same CTA.
  - [ ] **Revision session:** memory store (mirror `importPreviewStore`) holding prioritized `itemId[]`. On CTA, set store → `router.push('/review')`. `useReviewQueue` / queue build: if store non-empty, prefer those IDs among due items (or allow due+those IDs), then clear store after queue materializes. Do not invent a second review engine.
  - [ ] Never show section when count = 0.

- [ ] **Task 7 — Welcome-back triage (FR61)** (AC: #4)
  - [ ] Detect absence: no `cognitive_load_history` row (load > 0) for ≥ `WELCOME_BACK_ABSENCE_DAYS` (constant, default **3**) **and** `dueCount >= WELCOME_BACK_MIN_DUE` (default **40**).
  - [ ] Slice size `WELCOME_BACK_SLICE` (default **20**): copy “Ease back in: {slice} of your {due} due”.
  - [ ] CTA starts review with a capped slice (reuse at-risk store or a shared `reviewPriorityStore` with `{ itemIds, limit }` — prefer one store).
  - [ ] Dismiss / “not now” for the visit (and optionally persist dismiss-for-today via prefs). Do not auto-start.
  - [ ] Framing: invitation, never guilt about the missed streak.

- [ ] **Task 8 — Conditional banners priority (AC: #5)** (resolves brainstorm O2)
  - [ ] **Single banner slot** priority (highest wins; show one):
    1. Welcome-back triage  
    2. Curriculum update available / just-updated (reuse `useCurriculumUpdateBanner` / soft Home card — root `Banner` may stay for post-apply toast)  
    3. Import nudge when `countImportMetadataRows(userDb) === 0` and user is past onboarding (deep-link Settings or onboarding import)  
    4. Existing `ShadowModeSwitchPrompt`
  - [ ] At-risk is **not** a banner — it is its own conditional **section** below permanent content (brainstorm).
  - [ ] Goal rise/reduction prompts stay above CTAs (Story 2.1); they are not in the banner slot.
  - [ ] Permanent sections always render; conditionals never replace the ring/CTAs/forecast/readiness.

- [ ] **Task 9 — Post-session proof: restore time compression + goal state** (AC: #6)
  - [ ] **PRD v2 wins over feedback 05 §5.1** for this story: restore multi-app estimate as centerpiece. Playtest removed it; v2 re-requires FR33b–c / UX-DR12.
  - [ ] Restore constants in `config/constants.ts` (from Story 6.5):
    - `TIME_COMPRESSION_PER_ITEM_SECONDS` = `{ radical: 15, kanji: 40, vocabulary: 30, grammar: 50 }`
    - `TIME_COMPRESSION_SESSION_OVERHEAD_MINUTES = 5`
    - `TIME_COMPRESSION_MIN_DOMAINS_FOR_OVERHEAD = 2`
  - [ ] Restore pure `estimateMultiAppMinutes` + `hasSavings` helpers in `utils/timeFormat.ts` (use `Math.round`, not inflate with `ceil`). Co-locate tests.
  - [ ] Evolve `SessionSummaryCard` / summary layout: domain chips + actual minutes + multi-app line when `hasSavings`; methodology disclosure optional/short (“Estimated from separate single-purpose apps — deliberately conservative”).
  - [ ] Surface **goal-met / overshoot** on summary (read `useCognitiveLoad` percent or pass from session): e.g. “Goal met” / “+N% overshoot” — never a streak row.
  - [ ] Update `PostSessionShareCard` similarly (domains, minutes, compression claim, goal line — **no streak**).
  - [ ] Lesson complete may stay lighter (planted items) but must not celebrate streak; optional goal line if cheap.

- [ ] **Task 10 — Stats: DaysStudiedStat** (AC: #7)
  - [ ] Repo helper on `cognitiveLoadRepository`: `countDaysStudiedInMonth(userDb, year, month)` → distinct `date` keys with `load > 0` in that local month.
  - [ ] Component `DaysStudiedStat`: large number + “Days studied this month” + calm subtitle (“Calm activity — not a streak”). No flame.
  - [ ] Mount near top of `stats.tsx` (above or beside SRS stages). Empty/first-run: keep `StatsEmptyState`; when some SRS exists but 0 study days this month, show `0` calmly.
  - [ ] Fix Stats focus refresh if still skipping first focus (mirror Home BUG1 pattern) so returning after a session updates the count.

- [ ] **Task 11 — Verification**
  - [ ] `npm run typecheck`, `npm run lint`, `npm test` green from `mobile/`.
  - [ ] Manual: Home shows Review above Learn; no streak; forecast wall on spiked week; readiness destination copy; at-risk invitation + revision CTA; welcome-back slice after seeded absence; summary shows compression + goal, no streak; Stats shows days studied this month.

## Dev Notes

### Scope boundary (critical)

| In 2.2 | Out |
| --- | --- |
| Home composition v2 (greeting, CTA order, forecast, readiness, conditionals) | Browse tab IA / Read tab removal (Epic 3) |
| Streak UI removal (Home + post-session) | Deleting `streaks` table / celebration migrations |
| At-risk section + mini revision affordance | Full leech management product |
| Welcome-back slice | Auto goal reduction on return (O4 unresolved — do not silent-drop goal) |
| Shared passage unlock helper (≥90% Guru+) | Passage reader long-press, Browse UNION, word spans (3.2) |
| Restore time compression + goal on summary | PNG share / view-shot |
| DaysStudiedStat on Stats | Study calendar heatmap |

Story is **large** (readiness report). Prefer thin presentational components + pure core helpers; keep `index.tsx` as composition. If forced to split mid-flight, cut line is Tasks 1–8 (Home) vs 9–10 (post-session + Stats) — but ship as one story unless blocked.

### Product conflict resolution (do not reopen)

| Conflict | Winner |
| --- | --- |
| Feedback 05 removed multi-app estimate | **PRD v2 / FR33b–c / UX-DR12** — restore |
| Feedback 05 added streak celebration | **R2 / UX-DR12 / UX-DR27** — remove from Home + post-session UI |
| PRD amendment points “days studied” at FR59 | FR59 body = at-risk; days-studied = **UX-DR20 / this story** (no dedicated FR ID) |

### Current state (must read before coding)

| Area | Today | This story changes |
| --- | --- | --- |
| Home CTAs | Learn above Review; Review accent | Review primary first; Learn secondary |
| Home streak | `StreakCounter` mounted | Removed |
| Forecast / readiness / at-risk / welcome-back | Missing | New |
| Post-session | Domains + minutes; **streak row**; no multi-app; no goal line | Compression centerpiece + goal; no streak |
| `timeFormat.ts` | `formatMinutes` + `DomainCounts` only | Restore estimate helpers |
| Stats | SRS + weakness only | + DaysStudiedStat |
| Passage unlock | No coverage query in app | New shared pure helper + link reads |
| Curriculum banner | Root success toast after apply | May also surface as Home conditional |
| Import nudge | None on Home | Conditional when no `import_metadata` |
| Migrations | Latest **015** (goal ring) | Prefer **no** migration; use prefs/memory stores |

### Architecture compliance

- **Three-layer purity:** forecast / unlock / at-risk ranking / time compression math in `core/` or pure `utils/` — zero React, zero `expo-sqlite`. SQL in `data/`. Hooks wire. Components presentational.
- **Result type:** writes → `Result<T, AppError>`; reads → plain values. Never throw across async boundaries.
- **Dual DB:** passage links from `curriculum.db`; SRS/weakness/load from `user.db`. Use ATTACH joins only if already patterned; otherwise two-step fetch is fine for Home.
- **NativeWind:** semantic tokens only. No raw hex / legacy `Colors`.
- **Home never auto-starts** (architecture anti-pattern).
- **Goal ring is not a capacity ceiling** — summary goal line celebrates overshoot; never blocks.

### Anti-patterns (do NOT)

- Do not show streak flame, streak-at-risk banner, or streak row on share card.
- Do not lead Home with raw “340 reviews overdue” as the hero metric — welcome-back uses a **slice**.
- Do not auto-start review/lesson from Home or from triage CTAs without an explicit tap.
- Do not shame-frame at-risk (“items you keep failing”) — invitation only.
- Do not implement Browse shell / delete Read tab here.
- Do not change weekly goal ratchet / sticky goal semantics (Story 2.1).
- Do not add `react-native-svg` solely for forecast sparkline.
- Do not invent a separate unlock table — derived query only (FR68).
- Do not block on compiling `vocabulary_slugs` into `example_sentences` for the greeting.

### Settled constants (put in `config/constants.ts`)

```ts
PASSAGE_UNLOCK_COVERAGE = 0.9
FORECAST_WALL_MIN_DUE = 30
FORECAST_WALL_RATIO = 1.5
AT_RISK_TOP_N = 8 // within 5–10
WELCOME_BACK_ABSENCE_DAYS = 3
WELCOME_BACK_MIN_DUE = 40
WELCOME_BACK_SLICE = 20
// TIME_COMPRESSION_* as in Task 9
```

### Reuse map

| Need | Reuse |
| --- | --- |
| Goal ring / percent / pending prompts | `useCognitiveLoad`, `GoalRing`, `GoalRisePrompt` |
| Due count | `getDueSrsStates` (Home CTA) |
| Upcoming dues for forecast | New thin repo query on `srs_states.due_date` |
| Weakness scores | `weaknessRepository` + `calculateWeaknessScore` |
| Passage links | `passage_vocabulary_links` / `passage_grammar_links` via extended `passageRepository` |
| Days studied ledger | `cognitive_load_history` (`load > 0`) |
| Import detection | `countImportMetadataRows` |
| Curriculum banner | `useCurriculumUpdateBanner` / `CurriculumUpdateContext` |
| Lesson allowance copy | `computeDailyAllowance` + `getLessonItemsStartedOn` |
| JLPT bar | `LevelProgressBar` + `useLevelProgress` |
| Session domains/minutes | `ReviewSessionProvider.sessionSummary` |
| Priority review handoff | New tiny memory store (pattern: `importPreviewStore`) |
| Settings notification toggle | Rename framing away from streak |

### File structure (expected)

**New (typical):**
- `mobile/src/core/engagement/reviewForecast.ts` (+ test)
- `mobile/src/core/content/passageUnlock.ts` (+ test)
- `mobile/src/core/engagement/atRiskSelector.ts` (+ test) — or under `core/srs/`
- `mobile/src/components/engagement/ReviewForecast.tsx`
- `mobile/src/components/engagement/ReadingReadiness.tsx`
- `mobile/src/components/engagement/AtRiskSection.tsx` (+ full-list modal)
- `mobile/src/components/engagement/WelcomeBackCard.tsx`
- `mobile/src/components/engagement/DaysStudiedStat.tsx` (+ test)
- `mobile/src/components/engagement/ImportNudgeCard.tsx` (optional)
- `mobile/src/data/hooks/useAtRiskItems.ts`, `useReviewForecast.ts`, `useReadingReadiness.ts`, `useDaysStudied.ts` (group if cleaner)
- `mobile/src/data/reviewPriorityStore.ts` (memory)

**Update:**
- `app/(tabs)/index.tsx` + `index.test.tsx` — composition
- `app/(tabs)/stats.tsx` (+ test)
- `app/review/summary.tsx` (+ lesson complete streak removal)
- `PostSessionShareCard.tsx`, `SessionSummaryCard.tsx`, `timeFormat.ts`, `constants.ts`
- `passageRepository.ts`, `cognitiveLoadRepository.ts`, `srsStateRepository.ts`
- `useReviewQueue.ts` / queue wiring for priority store
- `config/notifications.ts`, Settings labels if streak-named
- Engagement barrel `index.ts`

**Do not resurrect:** old artifact `_bmad-output/implementation-artifacts/2-2-session-intensity-preference.md` (historical wrong title).

### Testing requirements

- Pure: forecast bucketing + wall; unlock 90% edge (exactly at threshold, single leech cannot block); at-risk ranking; days-in-month count; `estimateMultiAppMinutes` / hasSavings.
- Component: DaysStudiedStat no flame; ShareCard no streak; Home CTA order + no `home-streak-counter`.
- Integration-ish: welcome-back appears only when absence+backlog; at-risk hidden when empty; priority store consumed once by review queue.
- Gate: typecheck, lint, test from `mobile/`.

### Previous story intelligence (2.1)

- Sticky goal lives in `goal_ring_state` (migration 015); `cognitive_load_history` is achievement ledger — **reuse for days-studied**.
- Home already refetches on every focus (BUG1) — extend that path for forecast/readiness/at-risk; do not reintroduce `isInitialFocusRef` skip.
- Goal rise dismiss is visit-scoped (`risePromptHidden`) — mirror for welcome-back dismiss; reset on focus when offer identity changes if needed.
- Review findings still open on 2.1 (miss-week `<=` vs `<`, multi-week gap, etc.) — **out of scope** unless you touch `goalRingRepository`; do not drive-by rewrite.
- Lesson `addDailyLoad` already ships — days studied increments whenever load is written.
- Keep GoalRing hero; 2.2 owns composition around it.

### Git intelligence

Recent commits: GoalRing rename (`76ddc97`), review pacing / two-card work. Patterns: co-located Jest, `Result` writes, `__DEV__` warn on best-effort persist, RNTL Home tests with mocked repos. Mirror those — do not introduce new UI libraries.

### Latest tech notes

- `expo-notifications` daily trigger already used — keep API; only copy/rename.
- No new native modules for share or charts.
- FSRS stages are labels on `srs_states.srs_stage_label` — use them for Guru+ checks; do not re-derive from stability in SQL unless already consistent.

### Project Structure Notes

Aligns with architecture FR58–61 / FR33b–c mapping: `app/(tabs)/index`, `components/engagement`, `core/cognitive-load` (unchanged), new small `core/engagement` + `core/content/passageUnlock`. Stats gains days-studied without becoming a dashboard redesign.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2 Story 2.2 ACs]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR58–61, FR33b–c, FR20 amended, FR68]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Home triage; no auto-start; derived unlock; streak off Home]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — UX-DR3–5, UX-DR12, UX-DR20, UX-DR27, UX-DR30]
- [Source: `_bmad-output/planning-artifacts/.decision-log.md` — R2, UX-U8, UX-U9]
- [Source: `_bmad-output/brainstorming/brainstorming-session-2026-07-18-2244.md` — permanent vs conditional; wall; at-risk; O2–O5]
- [Source: `_bmad-output/brainstorming/brainstorming-session-2026-07-18-2354.md` — 90% unlock + readiness pairing]
- [Source: `_bmad-output/planning-artifacts/implementation-readiness-report-2026-07-20.md` — M1 FR60/FR68; oversized 2.2; FR ID hygiene]
- [Source: `_bmad-output/implementation-artifacts/2-1-adaptive-goal-ring-from-lessons-reviews.md` — prior Epic 2 learnings]
- [Source: `_bmad-output/implementation-artifacts/6-5-post-session-summary-and-home-screen-composition.md` — time compression constants]
- [Source: `docs/feedback/05-session-ux-polish.md` — conflicts superseded by PRD v2 for this story]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-07-20 — Story context created (ready-for-dev). Ultimate context engine analysis completed — comprehensive developer guide created.
