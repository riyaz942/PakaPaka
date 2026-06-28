---
baseline_commit: f7e47cd
---

# Story 5.4: Progressive hints, reinforcement, and related-item boosts

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a **learner**,
I want **layered hints on grammar prompts, visible cross-domain reinforcement after I answer, and scheduling boosts that strengthen related items**,
so that **the review loop reveals connections and reinforces related knowledge without cluttering the question (FR12, FR12b, UX-DR7, UX-DR8, UX-DR21)**.

*Consolidates original stories 5.7 (progressive hints) and 5.8 (visible reinforcement + related-item boosts) — both leverage the curriculum relationship graph for cross-item intelligence during review. This is the **final Story of Epic 5**: it layers the "felt intelligence" UX onto the playable review loop that Stories 5.1 (queue/FSRS/prefetch), 5.2 (session shell), and 5.3 (input/validation/result states) already built. Weakness recording, the cognitive-load ring, and the post-session time-compression summary remain Epic 6 — do **not** build them here.*

## Context: this is an additive layer on a working review loop

The review loop is already playable end-to-end. Story 5.4 adds three capabilities **on top of** it, none of which may regress the existing <100ms feedback loop (NFR5b) or the async-grade persistence path:

1. **Progressive hints** — a `Hint` control on **grammar** prompts that reveals stacked context levels on each tap (UX-DR7). The initial grammar question shows **no** reinforcement line (UX-DR21 / UX-DR8 anti-spoiler rule).
2. **Visible reinforcement** — after the answer is graded, the result view may show a `ReinforcementHighlight` ("食べる — you learned this yesterday") when the relationship graph + the learner's SRS state support a cross-domain link (FR12).
3. **Related-item boosts** — answering an item correctly applies a **bounded, capped, idempotent** priority adjustment to graph-related items, persisted to `user.db` and consumed by the **next** queue build (FR12b).

## Acceptance Criteria

1. **Progressive hint control on grammar prompts (FR12, UX-DR7, UX-DR8, UX-DR21)**

   **Given** a `grammar` item in `prompting` state
   **When** the card renders
   **Then** a `Hint` button appears (only for grammar prompts — kanji/vocab/radical prompts show no Hint button in this story; see AC8 for the non-grammar contextual annotation)
   **And** the initial question shows **no** cross-domain reinforcement line and **no** answer spoiler (UX-DR21 — reinforcement is gated behind hint taps or the result screen)
   **And** tapping `Hint` reveals **Level 1**; tapping again reveals **Level 2**, then **Level 3**; the button copy updates each tap (e.g. `Hint` → `Hint (1/3)` … → and becomes disabled/hidden once the final level is shown — document the exact copy)
   **And** each newly revealed panel is announced to screen readers via `AccessibilityInfo.announceForAccessibility` and the button announces remaining-hint availability (UX-DR7, UX spec §1249)
   **And** revealed hint panels stack (earlier levels stay visible) and use `reinforcement-*` tokens for the final level's tone (UX spec §705)

2. **Hint level content (UX spec §954, Flow 4 §819–835)**

   **Given** the grammar item's `answerKey.grammar` (`structure`, `conjugationRules`) and its graph relationships
   **When** hint levels are computed
   **Then** **Level 1** = grammar scope / structure (e.g. the `structure` string `"Noun + です"` or a conjugation-category label) — never reveals an accepted form
   **And** **Level 2** = lesson / study-timeline context (e.g. "Grammar point: copula (is/am)" — the item meaning / lesson tie-in)
   **And** **Level 3** = full cross-domain reinforcement (the `ReinforcementHighlight` content from AC3, e.g. a linked vocabulary item the learner has studied)
   **And** if a level has no data (e.g. no linked vocab for Level 3), that level is **skipped or merged** so the user never taps into an empty panel — document the chosen degradation, and the hint count reflects only available levels

3. **`ReinforcementHighlight` on the result view (FR12, UX-DR8, UX spec §958–963, §1091)**

   **Given** an item was just answered **correctly** and the relationship graph + the learner's SRS state yield at least one cross-domain link
   **When** the `correct` result renders
   **Then** a `ReinforcementHighlight` block appears beneath the reveal showing the connected item and a study-recency phrase (e.g. "食べる — you learned this yesterday" / "Uses radical 口 (mouth) — Guru stage")
   **And** reinforcement appears **only on correct answers** (progressive disclosure rewards success, doesn't distract during struggle — UX spec §785) — `incorrect`/`typo` states show **no** reinforcement
   **And** it uses `reinforcement-bg` / `reinforcement-text` tokens with a connecting-arrow affordance, `caption` typography, and an `accessibilityLabel` reading the full reinforcement text, marked as supplementary (UX spec §958–963)
   **And** when no link exists the result view renders exactly as Story 5.3 left it (no empty block, no layout shift)

4. **`reinforcementResolver` — pure cross-domain link finder (architecture `core/content/reinforcementResolver.ts`)**

   **Given** a reviewed item, its graph relationships, and a map of related items' SRS states
   **When** `resolveReinforcement(item, relatedItems, srsStateMap)` runs
   **Then** it returns zero or more `ReinforcementLink` objects `{ relatedItemId, primaryForm, meaning, relationshipType, srsStageLabel, recencyPhrase }`, ranked so the most pedagogically relevant link is first (document the ranking — e.g. prefer items the learner has actually studied / higher SRS stage / most-recently reviewed)
   **And** it is **pure TypeScript with ZERO React/RN and ZERO `expo-sqlite` imports** under `core/content/`, fully unit-tested, deterministic given its inputs
   **And** links to items the learner has **not** studied (no SRS row / `new`) are excluded or de-prioritized so reinforcement never claims "you learned this" for unseen items — document the rule

5. **Related-item boosts: compute + persist (FR12b)**

   **Given** an item answered **correctly** with graph-related items (children via `builds_on`/`requires`, and `reinforces` targets)
   **When** the grade is committed
   **Then** each related item receives a **bounded** priority boost persisted to `user.db` for the **next** queue build (new migration — see Dev Notes "Boost persistence")
   **And** the adjustment is **idempotent per session** and **capped** so a single hot item cannot starve the queue — document the cap (e.g. max cumulative boost per item, boosts decay/clear after being consumed in a build, and re-answering the same source item in the same session does not stack unboundedly)
   **And** boosts are applied **only on `correct`** (not `typo`, not `incorrect`)
   **And** persistence is async / non-blocking exactly like the SRS grade write (must not block advancing to item *n+1*; failure is swallowed/queued, never crashes the session)

6. **Queue builder consumes boosts (FR12b)**

   **Given** persisted related-item boosts from a previous session/build
   **When** `buildReviewQueue` runs
   **Then** an item's effective ordering priority reflects its boost as a **bounded tiebreak/nudge within its due set** — boosted due items sort ahead of equally-due unboosted items **without** pulling not-yet-due items into the queue and **without** mutating FSRS `due_date`/stability/difficulty (boosts affect *ordering*, never the SRS schedule)
   **And** the interleaving policy (weighted round-robin, kanji:2/vocab:2/grammar:1/radical:1) and all Story 5.1 eligibility filters (burned/known/locked/not-due) are preserved
   **And** the boost input threads through `QueueInputItem` (default 0 when absent) so existing call sites and tests that omit it still compile and behave identically — keep `buildReviewQueue` / `mapToReviewItem` pure
   **And** the priority direction is consistent with the documented architecture formula `priority = fsrs × 0.7 + weakness × 0.3` (boosts are a reinforcement nudge, not a weakness term; document where they sit relative to the Epic 6 weakness score so the two compose cleanly later)

7. **Hint usage tempers the correct grade (Story 5.3 explicitly deferred this here)**

   **Given** the AC6/Story-5.3 grade mapping (`correct` → Good(3))
   **When** the learner answered a grammar item correctly **after** revealing one or more hints
   **Then** the committed grade is downgraded to **Hard(2)** (hint-assisted recall is weaker than unaided recall) — document the rule and keep it bounded to grammar/hinted items; unhinted correct answers stay Good(3); `incorrect` stays Again(1); `typo` still does not grade
   **And** the grade mapping stays centralized in `gradeForResult` / the review evaluator (single source of truth — do not scatter grade literals into the screen)
   **And** if implementing the Hard path risks scope/time, it is acceptable to **document and defer** the downgrade to Epic 6 with a tracked note — but the hint **count** must still be threaded to the grade decision point so the wiring exists

8. **Non-grammar contextual reinforcement annotation (UX-DR8, UX spec §467, §416)**

   **Given** a `kanji`, `vocabulary`, or `reading`-type prompt (not grammar)
   **When** the prompt connects to something the learner recently studied (e.g. a radical/kanji component at Guru+)
   **Then** a **subtle** annotation **may** appear beside the prompt (e.g. "Uses radical 口 (mouth) — Guru stage") using the same `reinforcement-*` tone — this is the non-progressive counterpart to the grammar Hint
   **And** it must read as helpful context, not clutter, and must not reveal the answer
   **And** **this clause is the lowest priority in the story** — if seed data or time is thin, it is acceptable to ship grammar Hints (AC1–2) + result-screen reinforcement (AC3) + boosts (AC5–6) and **document the deferral** of the on-prompt non-grammar annotation, provided `reinforcementResolver` is built so it can power this later. Do not block the story on it.

9. **No regression to the review loop / performance (NFR1, NFR5b)**

   **Given** the Story 5.1–5.3 loop with its <100ms tap-to-next budget and `queueBuildMs` instrumentation
   **When** hints, reinforcement, and boosts are added
   **Then** reinforcement/relationship data needed at result time is resolved from data already hydrated for the item (prefetched in `useReviewQueue`) — **no** synchronous DB round-trip on the answer-submit hot path
   **And** boost reads add at most a bounded set of queries to queue build and keep `queueBuildMs` within budget (the `__DEV__` >100ms warn from 5.1 stays; note measured timing in the Dev Agent Record)
   **And** no inter-item animation is introduced; the hint reveal is intra-item and allowed (NFR5b)

10. **Tests and CI**

    **Given** implementation is complete
    **When** CI runs in `mobile/`
    **Then** `npm run lint`, `npm run typecheck`, and `npm test` pass, and **all existing Story 5.1/5.2/5.3 tests remain green**
    **And** new tests cover: `reinforcementResolver` (link found / ranking / studied-vs-unseen exclusion / no-link empty case); the boost engine (boost computed for correct only / capped / idempotent per session / not applied on incorrect-typo); `buildReviewQueue` boost-aware ordering (boosted-due sorts ahead of equal-due unboosted; not-due never pulled in; default-0 backward compat); the boost repository (persist/read/clear migration round-trip); `ProgressiveHint` (level advance + button copy + a11y announce + exhaustion + empty-level skip); `ReinforcementHighlight` (renders link with a11y label; renders nothing when no link); `ReviewCard` correct-state renders reinforcement only when present; and the hint→grade mapping (hinted-correct → Hard if AC7 implemented, else the threaded count is asserted)

## Tasks / Subtasks

- [x] **AC4 — `core/content/reinforcementResolver.ts` (pure)** (AC: 3, 4, 8)
  - [x] Add `ReinforcementLink` and any link-input types to `core/content/content.types.ts` (e.g. `RelatedItem { id; itemType; primaryForm; meaning; relationshipType }`)
  - [x] Implement `resolveReinforcement(item, relatedItems, srsStateMap)` → `ReinforcementLink[]`, ranked; exclude/De-prioritize unstudied (`new`/no SRS row) targets; derive `recencyPhrase` from SRS stage + `updatedAt` (e.g. stage label "Guru stage", or "you learned this yesterday" from `updatedAt` recency — keep the date math pure and injectable via a `now` param)
  - [x] `reinforcementResolver.test.ts` — link found, ranking order, studied-vs-unseen exclusion, empty input → `[]`, deterministic with injected `now`
  - [x] **Zero** React/RN/`expo-sqlite` imports (architecture `core/` hard rule)

- [x] **AC5/AC6 — Boost engine + persistence** (AC: 5, 6)
  - [x] `data/migrations/006_related_item_boosts.ts` — new `related_item_boosts` table (`item_id INTEGER PRIMARY KEY`, `boost REAL NOT NULL DEFAULT 0`, `updated_at TEXT NOT NULL`); register in `data/migrations/index.ts`
  - [x] `data/user/relatedItemBoostRepository.ts` (+ `.test.ts`) — `applyBoosts(userDb, {itemId, delta}[])` (upsert, accumulate, clamp to cap), `getBoosts(userDb, itemIds)` → `Map<string, number>`, `clearBoosts(userDb, itemIds)` (consumed-after-build). All return `Result<…>`; never throw across the async boundary
  - [x] `core/srs/boostEngine.ts` (+ `.test.ts`) **pure** — `computeBoosts(relatedItems, options)` → `{itemId, delta}[]` with the documented cap; correct-only is enforced by the caller, but the cap/idempotence math lives here and is unit-tested
  - [x] Define boost constants in `config/constants.ts` (e.g. `RELATED_ITEM_BOOST_DELTA`, `RELATED_ITEM_BOOST_CAP`) — no magic numbers

- [x] **AC6 — Queue builder boost-aware ordering** (AC: 6)
  - [x] Extend `QueueInputItem` in `queueBuilder.ts` with `boost?: number` (default 0); extend `QueueBuildOptions` only if needed
  - [x] Apply boost as a **bounded within-bucket ordering nudge** (e.g. stable sort by `due_date` then by `boost DESC`, or a small priority offset) — must NOT reorder across the not-due boundary and must NOT mutate `srsState`. Keep `buildReviewQueue`/`mapToReviewItem` pure
  - [x] Extend `queueBuilder.test.ts` — boosted-due ahead of equal-due unboosted; not-due never pulled in; omitted boost (default 0) preserves existing ordering/snapshots

- [x] **AC4/AC5 — Data hydration in `useReviewQueue` + grade wiring** (AC: 3, 5, 6, 9)
  - [x] In `useReviewQueue`, fetch each item's **related items** (new repo function — see below) and attach to the queue input so the resolver/boost engine have inputs **without** a hot-path query at submit time
  - [x] Read persisted boosts (`getBoosts`) for the due item set and thread into `QueueInputItem.boost`; after a successful build, `clearBoosts` for consumed items (document exact consume timing)
  - [x] Wire correct-answer boost application: on `correct` grade commit, call `boostEngine.computeBoosts` → `relatedItemBoostRepository.applyBoosts` **async/non-blocking** (mirror the `pendingWrites`/`Promise.resolve()` pattern in `ReviewSessionProvider.gradeCurrentItem`)

- [x] **NEW curriculum reader — related items** (AC: 3, 4, 5)
  - [x] Add to `data/curriculum/itemRepository.ts`: `getRelatedItemsForItems(db, itemIds)` → `Map<string, RelatedItem[]>` traversing `item_relationships` by `parent_item_id` for `relationship_type IN ('builds_on','reinforces','requires')` (children/targets of the reviewed item), joining `items` for `primary_form`/`meaning`/`item_type`. Mirror the batched-query shape of `getRequiredParentsForItems` (single `IN (...)` query, grouped into a Map). Reuse `grammar_vocabulary_links` via existing `getGrammarLinksForVocab` only if needed for grammar reinforcement
  - [x] `itemRepository.test.ts` — related items returned for a parent; empty for leaf; batched grouping correct

- [x] **AC1/AC2 — `components/review/ProgressiveHint.tsx`** (AC: 1, 2)
  - [x] Build the layered hint component (props: `levels: HintLevel[]`, controlled or self-managed reveal index, `onReveal?`); stacked panels, button copy advancing per tap, disabled/hidden at exhaustion; `announceForAccessibility` per reveal; `reinforcement-*` tokens for final level
  - [x] Compute hint levels for grammar items from `answerKey.grammar.structure` + item meaning + resolver Level-3 link; skip empty levels (AC2)
  - [x] `ProgressiveHint.test.tsx` — advance through levels, button copy, a11y announce, exhaustion, empty-level skip
  - [x] Export from `components/review/index.ts`

- [x] **AC3 — `components/review/ReinforcementHighlight.tsx`** (AC: 3)
  - [x] Build the annotation block (`reinforcement-bg`/`reinforcement-text`, arrow affordance, `caption` type, supplementary `accessibilityLabel`); renders `null` when no link
  - [x] `ReinforcementHighlight.test.tsx` — renders link + a11y label; renders nothing when link absent
  - [x] Export from `components/review/index.ts`

- [x] **AC1/AC3 — Wire into `ReviewCard` + `app/review/index.tsx`** (AC: 1, 3, 7, 9)
  - [x] `ReviewCard`: render `ProgressiveHint` in `prompting` state for grammar items; render `ReinforcementHighlight` in `correct` state when a link is present (none on incorrect/typo)
  - [x] `app/review/index.tsx`: track hint-reveal count per item (reset on item change, like `cardState`); pass the resolved reinforcement link + hint levels down; thread hint count into the grade decision (AC7)
  - [x] Preserve all 5.3 flows (submit state machine, typo re-prompt, incorrect Continue, double-submit ref guard, auto-advance timer cleanup); do not add a second persistence path

- [x] **AC8 — Non-grammar on-prompt annotation (lowest priority / deferrable)** (AC: 8)
  - [x] If shipping: render a subtle `ReinforcementHighlight`-style annotation beside non-grammar prompts when the resolver yields a studied component link; otherwise document the deferral in the Dev Agent Record with `reinforcementResolver` left ready to power it

- [x] **AC10 — CI** (AC: 10)
  - [x] `npm run lint && npm run typecheck && npm test` from `mobile/`; confirm all prior Epic-5 suites green and note new test count + measured timings in the Dev Agent Record

## Dev Notes

### Out of scope (do NOT build — Epic 6 owns these)

| Deferred | Owner |
| --- | --- |
| Weakness recording / per-item error stats / pattern tags / confusion clusters | Epic 6 (Story 6.1) |
| The `weakness` term in `priority = fsrs×0.7 + weakness×0.3` | Epic 6 — boosts here are a separate reinforcement nudge; leave the weakness slot at its current default 0 |
| Cognitive-load ring increment / "enough for today" | Epic 6 (6.3) |
| Post-session `review/summary.tsx`, `TimeCompressionSummary`, `PostSessionShareCard` | Epic 6 (6.5) |
| Configurable auto-advance pause UI | Epic 6 settings — keep the single `REVIEW_CORRECT_AUTO_ADVANCE_MS` constant |
| Home-screen "Review" entry finalization | Epic 6 (6.5) — keep the `__DEV__`/existing entry from 5.1 |

### Build on Stories 5.1–5.3 — do not rebuild engine, shell, or validators

| Asset | Location | Role in 5.4 |
| --- | --- | --- |
| `ReviewSessionProvider` | `providers/ReviewSessionProvider.tsx` | **Extend carefully** — `gradeCurrentItem` is the only grade entry; add async boost write alongside the existing `pendingWrites`/`Promise.resolve()` SRS write. Do not block `setCurrentIndex` |
| `useReviewQueue` | `data/hooks/useReviewQueue.ts` | **Extend** — add related-items + boost reads into `QueueInputItem`; `clearBoosts` after build |
| `queueBuilder` / `QueueInputItem` / `ReviewItem` | `core/srs/queueBuilder.ts`, `srs.types.ts` | **Extend** — `boost` input + ordering nudge; keep pure; keep default-0 backward compat |
| `ReviewCard` | `components/review/ReviewCard.tsx` | **Extend** — add `ProgressiveHint` (prompting, grammar) + `ReinforcementHighlight` (correct). The `prompting`/`correct`/`incorrect`/`typo` branches already exist; only add children |
| `app/review/index.tsx` | review route | **Modify** — hint-count state per item; pass link/levels; thread hint count to grade. Preserve 5.3 submit state machine and guards |
| `resolveCorrectReveal` / `gradeForResult` | `components/review/ReviewCard.tsx`, `core/answer/reviewAnswerEvaluator.ts` | **Reuse / extend** — grade mapping stays centralized (AC7); do not inline grade literals |
| `getRequiredParentsForItems` | `data/curriculum/itemRepository.ts` | **Pattern to mirror** for the new `getRelatedItemsForItems` (batched `IN (...)` → Map) |
| `evaluateReviewAnswer` | `core/answer/reviewAnswerEvaluator.ts` | **Do not change validation** — 5.4 only consumes its `result` |

### Architecture compliance (must follow)

- **Layering (hard rule):** `reinforcementResolver`, `boostEngine`, and any link/ranking logic are **pure TypeScript with ZERO React/RN and ZERO `expo-sqlite` imports**, under `core/content/` and `core/srs/`. DB reads live in `data/` repositories; the hook (`useReviewQueue`) wires them; UI (`ProgressiveHint`, `ReinforcementHighlight`) lives in `components/review/`. [Source: architecture.md — `core/` "Pure TypeScript — ZERO React/RN imports"; component tree §717–727]
- **Canonical file paths** (architecture source tree §717–791): `core/content/reinforcementResolver.ts` + `.test.ts` + `content.types.ts` (`ReinforcementLink`); `components/review/ProgressiveHint.tsx`/`.test.tsx`; `components/review/ReinforcementHighlight.tsx`. Use these exact names/locations — the architecture already reserves them.
- **Cross-database access pattern:** the architecture notes `ATTACH DATABASE` as *available*, but Stories 5.1–5.3 established the **dual-query + merge-in-JS** pattern (curriculum reads from `curriculumDb`, user reads from `userDb`, joined in the hook — see `useReviewQueue` parents/statuses/answerKey hydration). **Follow the dual-query pattern** for consistency; do not introduce `ATTACH` here. The resolver stays pure by receiving both sides as plain inputs. [Source: architecture.md §376 "Reinforcement resolver depends on: dependency graph + user SRS state (cross-database)"; `useReviewQueue.ts` dual-query precedent]
- **Boosts never corrupt FSRS:** related-item boosts affect **queue ordering only**. Never write to `srs_states` (`due_date`/`stability`/`difficulty`) to simulate a boost — that would corrupt the schedule. Boosts live in their own `related_item_boosts` table. [Source: architecture.md — atomic SRS state; FR12b "micro-adjustments"]
- **Styling:** NativeWind semantic tokens only. Reinforcement uses `reinforcement-bg` / `reinforcement-text` (and `feedback-info` for general info). Hint panels use `reinforcement-*` for the final cross-domain level. Feedback/annotation is **never color alone** — include text + (for reinforcement) the arrow affordance. No raw hex. [Source: ux-design-specification.md §541, §572–575, §705, §958–963]
- **Named exports** (`export function …`), **co-located `*.test.ts(x)`** beside each new file. Result type for all fallible repo ops.
- **Performance:** <100ms tap-to-next preserved; hint reveal is intra-item (allowed); **no `LayoutAnimation`/Reanimated/confetti between items** (NFR5b). No synchronous DB read on submit — resolve from prefetched data.

### The relationship graph — what data actually exists (verified against N5 seed)

`item_relationships` (curriculum.db) stores `parent_item_id → child_item_id` with `relationship_type IN ('requires','builds_on','reinforces')`. Verified edge counts in `curriculum/dependencies/graph.json`:

| relationship_type | count | shape | use in 5.4 |
| --- | --- | --- | --- |
| `requires` | 41 | parent → child (radical/kanji → kanji/vocab) | unlock (5.1/4.5) **and** a boost target when a parent is answered correctly |
| `builds_on` | 32 | radical → kanji | boost target (answer radical/kanji correctly → nudge dependent kanji) |
| `reinforces` | 14 | **grammar → vocabulary** | the **cross-domain reinforcement** source — "this grammar uses 食べる, which you studied" |

Plus `grammar_vocabulary_links` (grammar_item_id → vocabulary_item_id, populated from each grammar item's `vocabulary_slugs`) — `getGrammarLinksForVocab` already reads the reverse direction. For grammar reinforcement you can use **either** the `reinforces` edges **or** `grammar_vocabulary_links`; pick one and document it (the `reinforces` edges are the architecture-intended "cross-domain reinforcement" channel — prefer them, fall back to links if a grammar item has none).

**Direction matters:** `getRequiredParentsForItems` queries `WHERE child_item_id IN (...)` (child→parent, for unlock). For **boosts and reinforcement you need the opposite traversal** — given the reviewed item as the **parent/source**, find its children/targets: `WHERE parent_item_id IN (...)`. That is why `getRelatedItemsForItems` is a new function, not a reuse.

**Grammar item shape (for hints):** grammar items carry `structure` (e.g. `"Noun + です"`), `conjugation_rules` (e.g. `{"polite": true}`), `accepted_forms` (e.g. `["です","だ"]`), `meaning` (e.g. `"copula (is/am)"`), and `vocabulary_slugs`/`reinforces` links. Hint Level 1 should use `structure` (and/or a conjugation-category label) — **never** `accepted_forms` (that is the answer). Level 2 = `meaning`/lesson context. Level 3 = the reinforcement link.

### Boost persistence — design (AC5/AC6)

New migration **006** (next after `005_personal_mnemonics`):

```sql
CREATE TABLE IF NOT EXISTS related_item_boosts (
  item_id   INTEGER PRIMARY KEY NOT NULL,
  boost     REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
```

- **Apply (correct answer):** for each related item, `INSERT … ON CONFLICT(item_id) DO UPDATE SET boost = MIN(boost + delta, CAP)`. Clamp to `RELATED_ITEM_BOOST_CAP` so one hot item can't dominate (anti-starvation, AC5).
- **Idempotent per session:** the cap makes accumulation bounded; additionally, re-answering the *same source item* in a session should not stack unboundedly — relying on the cap is acceptable for v1, but document the choice. (No per-session dedupe table is required; keep it simple and capped.)
- **Consume:** `useReviewQueue` reads `getBoosts(dueItemIds)` into `QueueInputItem.boost`, then `clearBoosts(consumedIds)` **after** a successful `buildReviewQueue` so a boost influences exactly one subsequent build (prevents permanent priority inflation). Document the exact consume point (after build, before/after setQueue) and ensure a failed build does not clear boosts.
- **Async write:** mirror `ReviewSessionProvider`'s `Promise.resolve().then(upsert…).catch(queue-for-retry)` — boosts are best-effort; a failed boost write must never crash or block the loop.

### Where boosts sit relative to the Epic 6 priority formula

Architecture: `priority = fsrs_score × 0.7 + weakness_score × 0.3`. In 5.4 the queue still sorts by `due_date` within type buckets (Story 5.1). Implement the boost as a **bounded ordering nudge inside the existing due-set sort** — e.g. stable-sort each bucket by `due_date ASC` then `boost DESC`, or subtract a small bounded epsilon from the effective sort key. Do **not** invent the full weighted formula now (Epic 6 owns the weakness term). Just make sure the boost is structured so Epic 6 can fold it in without a rewrite — keep the per-item numeric boost separate from FSRS, exposed via `QueueInputItem`. Document the exact ordering rule you chose.

### Previous story intelligence (5.1 / 5.2 / 5.3)

- `usePreventRemove` is imported from `@react-navigation/core` (not `@react-navigation/native`) — do not change.
- RNTL v13.x here: `getByRole('progressbar')` is unreliable; use `UNSAFE_getByProps` / `getByLabelText`. Follow the same for the Hint button and reinforcement block queries.
- `gradeCurrentItem` guards double-grade via `isGrading` ref, advances `currentIndex` synchronously, persists async into `pendingWrites` (flushed on unmount). The boost write must **join** this async path, not add a parallel blocking one.
- `app/review/index.tsx` already has `isSubmittingRef` (double-submit guard), `autoAdvanceTimer` cleanup, and resets card state on `currentItem?.itemId` change — extend the **same** reset effect to clear hint-reveal count.
- `ReviewCard` maps `promptType` → mode label/color, hides meanings in `prompting`, and already renders `correct`/`incorrect`/`typo`. 5.4 only injects `ProgressiveHint` (prompting/grammar) and `ReinforcementHighlight` (correct) children.
- 5.3 review-finding patterns to honor: align a11y announcements with on-screen text (a correct-state reinforcement announcement must match what's shown); length/empty guards; no silent navigation; `accessible` grouping on info regions; centralize grade mapping in `gradeForResult` (5.3 specifically fixed scattered grade literals — do not regress this).
- 5.3 widened `AnswerResult` to `'correct'|'incorrect'|'typo'` and centralized `gradeForResult`. AC7's Hard(2) downgrade belongs **in `gradeForResult` (or a thin wrapper that takes `{result, hintsUsed}`)**, not in the screen.

### Git intelligence

| Commit | Relevance |
| --- | --- |
| `f7e47cd` Answer input + validation (5.3) | **Baseline** — playable loop, `gradeForResult`, `resolveCorrectReveal`, `ReviewCard` result states, submit state machine, `reviewAnswerEvaluator` |
| `84e7757` Review session UI + card prompting (5.2) | Shell, `ReviewCard` prompting, `SessionHeader`/`SessionExitSheet` |
| `b5215d3` Review queue + FSRS + prefetch (5.1) | `buildReviewQueue`, `QueueInputItem`, `useReviewQueue` dual-query hydration, async grade persistence, `queueBuildMs` instrumentation |
| `b5aea81` Dependency graph visibility (4.5) | `item_relationships` / `getRequiredParentsForItems` precedent; `reinforcementResolver` explicitly deferred to Epic 5 (this story) |
| `f52ceda` Personal mnemonics | `getPersonalMnemonic` already hydrated per item; `personalMnemonic` may surface beside reinforcement on incorrect/result later (not required) |

### File structure (new / modified)

```
mobile/
  src/
    config/
      constants.ts                       MODIFY — RELATED_ITEM_BOOST_DELTA / _CAP, hint copy constants
    core/
      content/
        content.types.ts                 MODIFY — ReinforcementLink, RelatedItem
        reinforcementResolver.ts         NEW (pure)
        reinforcementResolver.test.ts    NEW
      srs/
        boostEngine.ts                   NEW (pure — computeBoosts + cap)
        boostEngine.test.ts              NEW
        queueBuilder.ts                  MODIFY — boost on QueueInputItem + ordering nudge (pure)
        queueBuilder.test.ts             MODIFY — boost ordering + default-0 compat
        srs.types.ts                     MODIFY only if a shared boost type is needed
    data/
      migrations/
        006_related_item_boosts.ts       NEW
        index.ts                         MODIFY — register migration 006
      user/
        relatedItemBoostRepository.ts    NEW
        relatedItemBoostRepository.test.ts NEW
      curriculum/
        itemRepository.ts                MODIFY — getRelatedItemsForItems (parent→children traversal)
        itemRepository.test.ts           MODIFY — related-items coverage
      hooks/
        useReviewQueue.ts                MODIFY — related-items + boost reads/clear into QueueInputItem
    providers/
      ReviewSessionProvider.tsx          MODIFY — async boost write on correct grade
      ReviewSessionProvider.test.tsx     MODIFY — boost-on-correct, not on incorrect
    components/review/
      ProgressiveHint.tsx                NEW
      ProgressiveHint.test.tsx           NEW
      ReinforcementHighlight.tsx         NEW
      ReinforcementHighlight.test.tsx    NEW
      ReviewCard.tsx                     MODIFY — inject hint (prompting/grammar) + reinforcement (correct)
      ReviewCard.test.tsx                MODIFY — hint + reinforcement render coverage
      index.ts                           MODIFY — export ProgressiveHint, ReinforcementHighlight
    app/review/
      index.tsx                          MODIFY — hint-count state, pass link/levels, thread hint count to grade
    core/answer/
      reviewAnswerEvaluator.ts           MODIFY — gradeForResult accepts hintsUsed (AC7) or thin wrapper
      reviewAnswerEvaluator.test.ts      MODIFY — hinted-correct → Hard(2)
```

**Do not create in 5.4:** `review/summary.tsx`, `TimeCompressionSummary`, `weaknessEngine` wiring, cognitive-load logic.

### Testing requirements

| File | Minimum coverage |
| --- | --- |
| `reinforcementResolver.test.ts` | Link found + ranked; studied target included, `new`/no-SRS target excluded; recency phrase from injected `now`; empty inputs → `[]` |
| `boostEngine.test.ts` | Boost computed for a related set; clamped to cap; multiple sources don't exceed cap; empty related → `[]` |
| `relatedItemBoostRepository.test.ts` | Migration round-trip: apply → get → clear; accumulate + clamp; get for absent items → 0/empty map |
| `queueBuilder.test.ts` (extend) | Boosted-due item sorts ahead of equal-due unboosted; not-due never included; omitted boost (default 0) keeps existing order/snapshots; interleave weights unchanged |
| `itemRepository.test.ts` (extend) | `getRelatedItemsForItems` returns children/targets for a parent; empty for a leaf; batched grouping by id |
| `ProgressiveHint.test.tsx` | Tap advances levels; button copy updates; a11y announce per reveal; disabled/hidden at exhaustion; empty Level-3 skipped |
| `ReinforcementHighlight.test.tsx` | Renders link text + supplementary a11y label; renders nothing when link absent |
| `ReviewCard.test.tsx` (extend) | Grammar prompting shows Hint; non-grammar prompting shows no Hint; `correct` shows reinforcement when present, none when absent; incorrect/typo never show reinforcement |
| `ReviewSessionProvider.test.tsx` (extend) | Correct grade triggers async boost apply; incorrect/typo do not; boost failure doesn't crash/advance-block |
| `reviewAnswerEvaluator.test.ts` (extend) | Hinted correct → Hard(2); unhinted correct → Good(3); incorrect → Again(1); typo → no grade |

Manual QA:
1. Open `/review`; reach a **grammar** prompt — a `Hint` button shows; the question shows no reinforcement line. Tap Hint 1→2→3: panels stack, copy updates, button disables at the end; VoiceOver announces each.
2. Answer that grammar item **correctly after hints** — result shows ✓ and a `ReinforcementHighlight` (linked vocab + recency); confirm the SRS grade reflects Hard (or the documented deferral).
3. Answer a grammar item **correctly with no hints** — Good grade; reinforcement still shows if a link exists.
4. Answer **incorrectly** — no reinforcement block, no layout shift.
5. Answer a **kanji** with related children correctly; end session; start a **new** session and confirm a boosted related item surfaces earlier among equally-due items (and that re-running again without re-answering does not keep it boosted — boost consumed).
6. Confirm no animation flash between items and `queueBuildMs` stays within budget (`__DEV__` warn silent).

Run from `mobile/`: `npm run lint && npm run typecheck && npm test`.

### Project Structure Notes

- New pure logic lands in architecture-canonical `core/content/` (resolver) and `core/srs/` (boost engine) — both already reserved in the source tree. New UI in `components/review/` (`ProgressiveHint`, `ReinforcementHighlight` are named in the architecture component tree §717–727). No structural deviation.
- The one new persisted table (`related_item_boosts`) follows the numbered-migration convention (006) and lives in `user.db` (mutable user state) — correct DB per the dual-database split. It is deliberately separate from `srs_states` so reinforcement nudges never touch the FSRS schedule.
- Cross-database reads continue the **dual-query + merge** precedent from `useReviewQueue` rather than introducing `ATTACH DATABASE`, keeping `core/` pure and consistent with all prior Epic-5 work.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 5, Story 5.4 AC (FR12, FR12b, UX-DR7, UX-DR8, UX-DR21); Epic 5 implementation notes (`ProgressiveHint`, `ReinforcementHighlight`)]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR12 (relationship layer + visible reinforcement), FR12b (micro-adjustments to related items), FR9–FR14, NFR1/NFR5]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — `core/content/reinforcementResolver.ts` + `content.types.ts` (`ReinforcementLink`), `ProgressiveHint`/`ReinforcementHighlight` in component tree (§717–727); `core/` purity rule; cross-component deps §376 (reinforcement resolver ↔ dependency graph + user SRS state); content relationship graph §91, §230; priority formula `fsrs×0.7 + weakness×0.3`]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — `ProgressiveHint` §949–956, `ReinforcementHighlight` §958–963; progressive-disclosure / grammar Hint exception §446, §467, §697, §705; reinforcement only on correct §785; reinforcement tokens §541, §572–575; Flow 4 grammar hints §819–835; feedback table §1091; a11y review announce §1249]
- [Source: `_bmad-output/implementation-artifacts/5-3-answer-input-and-validation.md` — `gradeForResult` centralization, `resolveCorrectReveal`, submit state machine + guards, "Hard/Easy from hint usage is Story 5.4" deferral]
- [Source: `_bmad-output/implementation-artifacts/5-1-review-queue-builder-fsrs-scheduling-and-prefetch.md` — `buildReviewQueue`, `QueueInputItem`, dual-query hydration, async grade persistence, `queueBuildMs`]
- [Source: `_bmad-output/implementation-artifacts/4-5-dependency-graph-visibility-for-unlock-status.md` — `item_relationships` traversal precedent; `reinforcementResolver` deferred to Epic 5]
- [Source: `mobile/src/core/srs/queueBuilder.ts`, `srs.types.ts` — `buildReviewQueue`, `QueueInputItem`, `mapToReviewItem` (extend, keep pure)]
- [Source: `mobile/src/data/hooks/useReviewQueue.ts` — per-item dual-query hydration loop to extend for related-items + boosts]
- [Source: `mobile/src/providers/ReviewSessionProvider.tsx` — `gradeCurrentItem` async persist pattern to mirror for boost writes]
- [Source: `mobile/src/components/review/ReviewCard.tsx` — prompting/correct/incorrect/typo branches to inject hint + reinforcement; `resolveCorrectReveal`]
- [Source: `mobile/src/app/review/index.tsx` — submit state machine, per-item reset effect, double-submit guard, auto-advance timer to preserve]
- [Source: `mobile/src/data/curriculum/itemRepository.ts` — `getRequiredParentsForItems` (mirror for `getRelatedItemsForItems`), `getGrammarLinksForVocab`, `getGrammarRule`, `getKanjiReadings`]
- [Source: `mobile/src/data/user/srsStateRepository.ts` — `getDueSrsStates` (`ORDER BY due_date ASC`), `upsertSrsState` async pattern]
- [Source: `mobile/src/data/migrations/index.ts`, `005_personal_mnemonics.ts` — migration registration pattern for new `006_related_item_boosts.ts`]
- [Source: `mobile/src/config/constants.ts` — existing review/queue constants; add boost constants here]
- [Source: `scripts/curriculum-schema.ts` — `item_relationships` (`requires`|`builds_on`|`reinforces`), `grammar_vocabulary_links`, `grammar_rules`, `example_sentences.reinforcement_tags` DDL]
- [Source: `scripts/compile-curriculum.ts` — relationship + grammar-vocabulary-link population]
- [Source: `curriculum/dependencies/graph.json` — verified edges: 41 `requires`, 32 `builds_on` (radical→kanji), 14 `reinforces` (grammar→vocabulary)]
- [Source: `mobile/tailwind.config.js` — `reinforcement-*`, `feedback-*`, `caption` tokens]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

- Boost ordering rule: within each type bucket, sort `due_date ASC` then `boost DESC` (bounded nudge; does not cross not-due boundary).
- Boost consume timing: `clearBoosts` runs after successful `buildReviewQueue`, before `setQueue`, for all due item IDs with boost > 0.
- Boost apply: JS-side clamp to `RELATED_ITEM_BOOST_CAP` (1.0); delta `RELATED_ITEM_BOOST_DELTA` (0.15) per related item on non-Again grades.
- AC7: `gradeForResult('correct', { hintsUsed })` → Hard(2) when hintsUsed > 0, Good(3) otherwise.
- AC8 deferred: non-grammar on-prompt annotation not rendered; `reinforcementResolver` + prefetched `reinforcementLink` on `ReviewItem` ready for a follow-up.
- Hint button copy: `Hint` → `Hint (n/total)` → hidden at exhaustion.
- CI: 496 tests pass (75 suites); lint clean; typecheck clean.

### Completion Notes List

- Implemented pure `reinforcementResolver` with studied-only filtering, recency phrases (injectable `now`), and ranking (reinforces > stage > recency).
- Added `ProgressiveHint` (grammar-only, stacked levels, a11y announcements) and `ReinforcementHighlight` (correct-state only).
- Added `related_item_boosts` migration 006, repository, and pure `boostEngine`; queue builder applies boost as within-bucket tiebreak.
- Extended `useReviewQueue` dual-query hydration: related items + SRS snapshots + boosts prefetched at build time (no submit hot-path DB).
- Wired async boost persist in `ReviewSessionProvider` alongside existing SRS write path.
- Extended `ReviewAnswerKey.grammar` with `structure` for hint Level 1.

### File List

- mobile/src/config/constants.ts
- mobile/src/core/content/content.types.ts
- mobile/src/core/content/reinforcementResolver.ts
- mobile/src/core/content/reinforcementResolver.test.ts
- mobile/src/core/content/hintLevels.ts
- mobile/src/core/srs/boostEngine.ts
- mobile/src/core/srs/boostEngine.test.ts
- mobile/src/core/srs/queueBuilder.ts
- mobile/src/core/srs/queueBuilder.test.ts
- mobile/src/core/srs/srs.types.ts
- mobile/src/core/answer/reviewAnswerEvaluator.ts
- mobile/src/core/answer/reviewAnswerEvaluator.test.ts
- mobile/src/data/migrations/006_related_item_boosts.ts
- mobile/src/data/migrations/index.ts
- mobile/src/data/user/relatedItemBoostRepository.ts
- mobile/src/data/user/relatedItemBoostRepository.test.ts
- mobile/src/data/user/srsStateRepository.ts
- mobile/src/data/curriculum/itemRepository.ts
- mobile/src/data/curriculum/itemRepository.test.ts
- mobile/src/data/hooks/useReviewQueue.ts
- mobile/src/data/database.test.ts
- mobile/src/providers/ReviewSessionProvider.tsx
- mobile/src/providers/ReviewSessionProvider.test.tsx
- mobile/src/components/review/ProgressiveHint.tsx
- mobile/src/components/review/ProgressiveHint.test.tsx
- mobile/src/components/review/ReinforcementHighlight.tsx
- mobile/src/components/review/ReinforcementHighlight.test.tsx
- mobile/src/components/review/ReviewCard.tsx
- mobile/src/components/review/ReviewCard.test.tsx
- mobile/src/components/review/index.ts
- mobile/src/app/review/index.tsx
- mobile/__mocks__/expo-sqlite.ts

## Review Findings

### Decision Needed

- [x] [Review][Decision] **Cap math location** — RESOLVED: cap stays in `relatedItemBoostRepository.applyBoosts`; update JSDoc in `boostEngine.ts` to state "returns raw delta; cap enforced by `applyBoosts`"; AC10 satisfied by existing `relatedItemBoostRepository.test.ts` cap tests. → Converted to patch P7.
- [x] [Review][Decision] **Hint Level 2 may leak answer on meaning-type grammar prompts** — DISMISSED: grammar prompts are always form/conjugation, never meaning; `buildGrammarHintLevels` is safe as-is.

### Patches

- [x] [Review][Patch] **Inverted recency ranking — older items score higher than recent ones** [`mobile/src/core/content/reinforcementResolver.ts` ~line 74] — Fixed: `recencyBoost = updatedAt - now.getTime()` (negative; closer to zero = more recent = higher rank).

- [x] [Review][Patch] **Boost cleared for items that never entered the queue (locked/filtered out)** [`mobile/src/data/hooks/useReviewQueue.ts` ~line 878] — Fixed: track `queuedItemIds` from items that pass `isItemUnlocked`; derive `consumedBoostIds` from that set.

- [x] [Review][Patch] **`ProgressiveHint` internal `revealedCount` state not reset between items — AC1 violation** [`mobile/src/components/review/ReviewCard.tsx`] — Fixed: added `key={item.itemId}` on `<ProgressiveHint>` to force remount per item; removed dead `hintsRevealed?: number` from `ReviewCardProps`.

- [x] [Review][Patch] **`applyBoosts` issues N SELECT queries inside `withTransactionSync` + duplicate itemIds can exceed cap** [`mobile/src/data/user/relatedItemBoostRepository.ts`] — Fixed: accumulate/deduplicate deltas in-memory first, batch-read current values once outside the transaction, then upsert in a single pass.

- [x] [Review][Patch] **No guard against negative `delta` in `applyBoosts`** [`mobile/src/data/user/relatedItemBoostRepository.ts`] — Fixed: `if (delta <= 0) continue;` in the accumulation loop.

- [x] [Review][Patch] **`itemRepository.test.ts` missing batched multi-parent grouping test — AC10 gap** [`mobile/src/data/curriculum/itemRepository.test.ts`] — Fixed: added "groups related items by parent id when multiple parents are queried" test.

### Deferred

- [x] [Review][Defer] **`clearBoosts` failure silently swallowed in production** [`mobile/src/data/hooks/useReviewQueue.ts` ~line 881] — deferred; best-effort persistence is explicitly spec-designed; only `console.warn` in `__DEV__`; bounded by cap
- [x] [Review][Defer] **O(n²) sort comparator in `resolveReinforcement`** [`mobile/src/core/content/reinforcementResolver.ts` ~line 114] — deferred; `find` inside comparator; negligible at N5 scale (max ~14 edges); pre-existing pattern
- [x] [Review][Defer] **Boost write not retried on `catch` in `ReviewSessionProvider`** [`mobile/src/providers/ReviewSessionProvider.tsx` ~line 1148] — deferred; best-effort by spec; SRS grade path is independent
- [x] [Review][Defer] **Mock `item_id` type divergence risk** [`mobile/__mocks__/expo-sqlite.ts`] — deferred; mock correctly mirrors current integer-ID contract; future risk only
- [x] [Review][Defer] **SQLite `SQLITE_LIMIT_VARIABLE_NUMBER` (999) not chunked** [multiple repositories] — deferred; N5 curriculum is ~100 items; revisit when curriculum grows
- [x] [Review][Defer] **`levels` prop shrinks while `revealedCount > levels.length`** [`mobile/src/components/review/ProgressiveHint.tsx` ~line 50] — deferred; levels is static per item in practice; theoretical only

## Change Log

- 2026-06-28: Story 5.4 drafted — progressive grammar hints (`ProgressiveHint`), result-screen cross-domain reinforcement (`ReinforcementHighlight` + pure `reinforcementResolver`), and bounded/idempotent related-item priority boosts (new `related_item_boosts` migration, `boostEngine`, boost-aware `buildReviewQueue`), plus hint-tempered grading. Status set to ready-for-dev.
- 2026-06-28: Story 5.4 implemented — hints, reinforcement, boosts, hint→Hard grading; AC8 on-prompt non-grammar annotation deferred. Status set to review.
- 2026-06-28: Code review complete — 2 decision-needed, 6 patch, 6 deferred, 5 dismissed. Status set to in-progress.
