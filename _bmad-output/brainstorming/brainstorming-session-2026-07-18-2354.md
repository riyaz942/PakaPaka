---
stepsCompleted: [1, 2, 3, 4]
ideas_generated: 12
gaps_found: 8
workflow_completed: true
session_active: false
inputDocuments: []
session_topic: 'Redesign Browse/Search into a unified discovery surface (search + multi-select type pills + JLPT accordion), folding reading passages in with lock/readable/completed states driven by SRS progress'
session_goals: 'Wide field of ideas for the page interaction model and information architecture, plus surfacing latent bugs and gaps along the way'
selected_approach: 'progressive-flow'
techniques_used:
  ['What If Scenarios', 'Morphological Analysis', 'SCAMPER Method', 'Solution Matrix']
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Riyaz
**Date:** 2026-07-18

## Session Overview

**Topic:** Redesign the Browse/Search page into a single unified discovery surface — search input, multi-select content-type pills, JLPT-level accordion — and fold reading passages into it with lock / readable / completed states driven by SRS progress.

**Goals:** Generate a wide field of ideas for the page's interaction model and information architecture, while surfacing latent bugs and gaps in the existing implementation.

### Context Guidance

No context file supplied. Session grounded directly in the codebase.

**Codebase reality check (established before ideation):**

| User's stated intent | Current state in code |
| --- | --- |
| Search input | **Does not exist** — no search surface anywhere in the app |
| Multi-select type pills | **Single-select only** — `CalibrationItemTypePicker`, `learn/[level].tsx:85` |
| JLPT accordion grouping | **Does not exist** — level picked on hub (`learn/index.tsx:139`), pushes to a separate per-level screen |
| Reading in the pill set | **Excluded** — `LEARN_ITEM_TYPES` (`learn/[level].tsx:23`) is radical/kanji/vocab/grammar; passages live in a separate Read tab |
| Locked until prerequisites met | **Exists for kanji/vocab** via `dependencyGraph` (`isItemUnlocked`, `getUnmetPrerequisites`) — but **not for passages** |
| Passage readable/answered highlight | **Does not exist** — `PassageListRow.tsx` renders title, question count, static "Reading" badge only |
| Storing passage answers | **Already stored** — `migration004PassagePracticeResults` creates `passage_practice_results` (`user_answer`, `is_correct`, `answered_at`, PK `(passage_id, question_id)`); `upsertPassagePracticeResult` upserts on re-answer |

**Key insight:** the persistence layer for passage answers is already built. The gap is that **nothing reads it back** — no UI consumes `getPassagePracticeResults` to drive completed state or to disable inputs on correct answers.

### Session Setup

Approach selected: **Progressive Technique Flow** — systematic movement from divergent exploration to actionable implementation planning.

## Technique Selection

**Approach:** Progressive Technique Flow
**Journey Design:** Systematic development from exploration to action

**Progressive Techniques:**

- **Phase 1 — Exploration:** What If Scenarios (opened with Question Storming) for maximum idea generation
- **Phase 2 — Pattern Recognition:** Morphological Analysis for organizing insights across IA parameters
- **Phase 3 — Development:** SCAMPER Method for refining the chosen concept
- **Phase 4 — Action Planning:** Solution Matrix for impact/effort mapping into implementable work

**Journey Rationale:** The topic carries two intertwined threads — an open-ended IA question ("what should this page *be*?") and a set of concrete state/bug details. Progressive flow keeps the IA question open long enough to find a non-obvious answer, while a running **gaps ledger** captures bugs and missing behaviour as they surface in any phase, so they aren't lost to the creative mode.

### Gaps Ledger

_Running list of bugs, missing behaviour, and open questions surfaced during the session._

- **G1** — `passage_practice_results` is written but never read back; no UI consumes `getPassagePracticeResults`. Completed-state highlight and input-disabling on correct answers are both unimplemented.
- **G2** — "Burned" is not a stored status. `StudyStatus` is only `'known' | 'in_progress' | 'not_started'`. Burned must be derived from `srs_states` (stability threshold), like the existing SRS stage colors.
- **G3** — `items.item_type` CHECK excludes `reading` (`curriculum-schema.ts:18`). Passages live in a separate `reading_passages` table with a different shape (`english_translation`, `word_count`, linked questions). A unified list must UNION two differently-shaped sources. **This is the structural reason Read is still an isolated tab.**
- **G5** — No passage gating exists. `read/index.tsx:52` renders every passage as tappable regardless of progress.
- **G6** — No `passage_kanji_links` table exists. Resolved: kanji gating is not required; vocabulary + grammar links are sufficient.
- **G7** — Passage text has no word boundaries. `parseFurigana` yields **kanji-run** boundaries, not word boundaries: kanji runs group (学生), but all other text splits one character per segment (`parseFurigana.ts:96-98`, `:104-106`). Verbs split apart (食べる → `食`[た] + `べ` + `る`) and kana-only words (ある, する, これ) get no grouping at all. Long-press-for-details therefore requires word boundaries authored in the content pipeline.
- **G8** — `learn/[level].tsx:105-110` applies dependency-graph locking to kanji/vocab rows in the browse list. Per **[Gating #11]** this must be removed from browse (it stays in the lesson planner). Browsing should never block viewing.
- **G4** — Passages have no summary field. Search can currently only reach a passage's title. Requires schema + validator + compile-step changes, plus authoring a JA/EN summary for every existing passage.

## Phase 1 — Expansive Exploration (What If Scenarios)

### Ideas Generated

**[IA #1]: Flat Paginated List over Nested Accordion**
_Concept:_ Drop the JLPT accordion as the primary structure. One flat, virtualized, paginated list; level becomes a filter alongside type rather than a container.
_Novelty:_ Level stops being a navigational hierarchy and becomes an attribute, so "N5 + N4 grammar" becomes expressible — impossible with per-level screens.
_Technical backing:_ Accordions require nested scroll containers, which break RN virtualization (every expanded level renders all rows). A flat list keeps virtualization. `SectionList` can restore visual level grouping later without the cost.

**[IA #2]: Smart Lists over State Pills** _(superseded by IA #3)_
_Concept:_ Progress-state as named entry points with live counts rather than filter pills.
_Outcome:_ Superseded — the faceted-drawer design solves the empty-state problem more capably. Retained because the "ambient count" idea may still have value.

**[IA #3]: Live-Count Apply Button**
_Concept:_ Five facet pills (Level, Type, Performance, SRS stage, Lock), each opening a multi-select drawer. The drawer's Apply button shows the pending result count — "Apply (23)" — updating live as options toggle. Disabled at zero.
_Novelty:_ The user learns a combination is empty *before* committing, while still holding the controls that caused it. More capable than preventing empty states outright, and it teaches how facets interact.
_Engineering note:_ Must be a real `COUNT(*)`, not fetch-rows-and-measure.

**[IA #4]: Self-Summarizing Pills**
_Concept:_ A pill with active selections expands to show them inline — Level pill reads `N5, N4` rather than `Level (2)`.
_Novelty:_ Filter state is readable without opening anything; the page never misrepresents what is being shown.

**[Search #5]: Fan-Out Query, Not Conversion-and-Replace**
_Concept:_ Romaji input converts to kana, but the converted string does not replace the query. Raw and converted forms run in parallel `OR` branches: raw → `meaning`; converted kana → `furigana` and `kanji_readings.reading`; raw → `primary_form`.
_Novelty:_ Nothing has to guess "is this romaji or English?" up front — an unreliable guess, since `kite` is both valid romaji (きて) and an English word.
_Free win:_ `accepted_answers` already stores curated synonyms per item (built for answer-checking), so `eat` and `to eat` both hit with no new synonym infrastructure.
_Watch out:_ Partial input — `tab` leaves an orphan consonant that converts to nothing. Keep the untranslatable tail as a prefix wildcard or search-as-you-type breaks every other keystroke.

**[Content #6]: Bilingual Passage Summary**
_Concept:_ Each passage gains a one-line summary in Japanese and English; search covers both.
_Novelty:_ Gives passages something to match on beyond their title, and gives the list row something worth displaying (currently just title + question count).
_Cost:_ Schema + validator + compile changes are small; authoring summaries for all existing passages is the real work.

### Decisions Made

- **Passages become first-class rows in the unified list (Option A)**, not a mode-switch. Rationale: a mode-switch reproduces the separation that already exists — passages are already isolated in the Read tab, so Option B would rebuild the status quo with better styling.
- **Rejected: progressive/streaming search results.** Proposed as showing each query's results as it completes. Rejected because this codebase uses synchronous SQLite (`getAllSync`, `runSync`), so the queries neither are slow (~ms on a local bundled DB) nor run concurrently — they execute serially on the JS thread regardless. Progressive rendering would hide an imperceptible delay while introducing layout shift (list reorders under the user's finger) and forfeiting relevance ranking (cannot rank results not yet received).
- **Adopted instead:** one ranked query with `OR` branches, ~200ms debounce on typing, loader only for the initial page load. If search ever becomes slow, add indexes on searched columns and measure before restructuring.
- **Revisit if:** search later computes expensive per-item derived state (SRS status, lock status, leech counts) across thousands of rows.

## Phase 1 (cont.) — Passage Gating & Reader

**[Gating #7]: 90% Coverage Unlock, Not All-or-Nothing**
_Concept:_ A passage unlocks when **any 90%** of its linked vocabulary and grammar reach Guru or above — not all of them. Which specific items are covered does not matter.
_Novelty:_ Under an all-must-be-Guru rule, the unlock date is set by the learner's **worst** item, not their average. One leech word holds a fully readable passage shut indefinitely — and leeches are universal in SRS, so the passages most likely to stay permanently locked are those that happen to contain an unlucky word, which is unrelated to actual readability.
_Pedagogy backing:_ Fluent reading needs roughly 95% word coverage, not 100%. Reading slightly above level is how vocabulary consolidates, so a 100%-at-Guru gate blocks the very activity that makes the words stick.
_Tradeoff accepted:_ All-or-nothing is more legible ("learn these 15 words"). 90% invites "which 90%?" and can feel arbitrary. Reliability of access was judged more important than legibility of the rule.

**[Reader #8]: Long-Press a Word for Details**
_Concept:_ Long-pressing any word in a passage opens its meaning, reading, and details in place. Applies anywhere words are rendered, not only passages.
_Novelty:_ **This is not a separate feature from [Gating #7] — it is what makes the 90% rule safe.** The 90% rule deliberately admits learners into passages containing up to 10% unlearned words. Without long-press that 10% is a wall; with it, the 10% becomes the part where new vocabulary is acquired from context. The two should be built as one piece of work.

**Long-press implementation path (decided):**

- **Rejected — Option 3 (reuse existing furigana markup):** investigated and ruled out. `parseFurigana` provides kanji-run boundaries, not word boundaries. See **G7**.
- **Rejected — Option 2 (match linked vocab against text at render time):** breaks on conjugation (食べます in text vs 食べる entry) and mis-matches short words nested inside longer ones.
- **Adopted — Option 1 (author word boundaries in the content pipeline).**
- **Refinement:** the word marker should carry the **item id** of the linked vocabulary, not merely the boundary. Long-press then becomes a direct lookup and conjugation stops mattering — 食べます can point straight at the 食べる entry.

**[Gating #9]: Passage Answer Locking (confirmed as originally specified)**
_Concept:_ Correct answer → field locks permanently. Wrong answer → field stays open for a later attempt.
_Rationale:_ Passages are **practice/test content, not SRS items**. Repetition is not absent — it lives outside this page: a completed passage reappears in reviews (or on the home page) at intervals until every question is answered correctly. See separate session for that mechanism.
_Why locking is correct:_ The lock is not sealing content away from practice — it marks a question as **satisfied**, so the reappearance logic knows which questions remain outstanding. Editing a known-correct answer serves no purpose.
_An earlier objection ("passage questions would be the only content with no repetition") was withdrawn — it assumed answer-once-and-done was the whole lifecycle._

**Open risk — brute-forced correct answers:** with an open field, instant right/wrong feedback, and unlimited attempts, guessing reaches green. Because the lock now does scheduling work, a guessed answer both locks permanently *and* removes that question as a reason for the passage to reappear — so it exits the practice loop looking identical to genuine knowledge. Unresolved; judged possibly not worth solving (self-directed study app). Cheap mitigations if wanted: suppress instant correctness feedback on a wrong attempt, or don't let a second attempt count until the passage next comes around.

**[IA #10]: Remove the Read tab** — _decided._
_Concept:_ Once passages are first-class rows in the unified Browse/Search list, the separate Read tab is deleted. Passages are reached through Browse.
_Rationale:_ Browse gives passages better search and filtering than the Read tab has. Keeping both leaves two routes to the same content, with the worse one occupying a bottom-tab slot.
_Follow-ups:_ frees a tab slot; `read/index.tsx` is removed; `read/[id].tsx` (the reader) stays as a destination; `usePassagesByLevel` is superseded by the unified list query.

**[Gating #11]: Two Different Meanings of "Locked"** — _decided._
_Concept:_ Split the single word "locked" into two unrelated mechanics.

| | Applies to | Means | Where it acts |
| --- | --- | --- | --- |
| **Can't study yet** | kanji, vocabulary, grammar | not eligible for a lesson | lesson planner only |
| **Can't view** | passages only | cannot open the passage | Browse list |

_Consequence:_ In Browse, **kanji, vocabulary and grammar are always viewable** — a learner can open the detail page for anything, including items they cannot yet study. Only passages are ever blocked from viewing.
_Conflicts with current code:_ `learn/[level].tsx:105-110` currently applies dependency-graph locking to kanji/vocab rows in browse. That locking stays in the lesson planner but must be removed from the browse list. → **G8**.
_Novelty:_ "Locked" was doing two jobs under one name. Separating them means browsing never blocks curiosity, while lesson ordering keeps its integrity.

**[Gating #12]: Tapping a Locked Passage Shows Its Requirements**
_Concept:_ Tapping a locked passage opens the list of vocabulary and grammar it still needs.
_Novelty:_ Converts the lock from a dead end into a to-do list — "you need these 4 words and 1 grammar point." Pairs with the readiness meter: the meter shows *how far*, the tap shows *what exactly*.
_Day-one value:_ This is what makes Browse worth opening with zero progress. A beginner sees locked passages, taps one, and gets a concrete goal instead of an empty screen.

**Day-one / zero-progress decisions:**

- **Show locked passages, don't hide them.** Seeing unreachable content signals there is more in the app to explore, which motivates doing reviews. An empty list signals nothing.
- **Passages being locked at zero progress is accepted** — the readiness meter plus the requirements list make it a target rather than a wall.

### Cross-session link — locked-state presentation

From `brainstorming-session-2026-07-18-2244.md:158,184` (**already accepted**): locked passages present a **reading-readiness meter** ("You're 4 kanji from unlocking this passage"), not a lock icon — reframing the gate from a locked door into a progress bar. Identical logic, opposite emotional valence.

**Apply here:** a locked passage row reads "13 of 15 words · 2 to go", not 🔒.

**Convergence worth noting:** that session flagged the meter's failure mode at `:196` — for a beginner it renders as *"47 kanji from your first passage"*, "a wall, not a target." **[Gating #7]'s 90% rule directly reduces that wall**: it lowers the remaining count on every passage and removes the case where the final blocker is an immovable leech. The two decisions were reached independently and fix each other — the meter makes the gate feel like a destination, the 90% rule makes the destination reachable. Carry them forward as a pair.

**What already exists in the app's favour:**

- Per-unit touch handling is built: `FuriganaText.tsx:130` already wraps each annotated segment in a `Pressable` (tap toggles that reading). Long-press coexists — **tap toggles furigana, long-press opens details**.
- The bracket notation is already parsed, compile-time validated, and degrades safely on malformed input (`parseFurigana.ts:78-80`). Adding a word-boundary marker extends a tested format rather than introducing a new one.

## Idea Organization and Prioritization

### Thematic Organization

**Theme 1 — The list**
Flat paginated list ([IA #1]), passages as first-class rows (Option A), Read tab deleted ([IA #10]).
_Pattern:_ collapse two separate browsing surfaces into one.

**Theme 2 — Filters**
Five facet pills with multi-select drawers, live-count Apply ([IA #3]), self-summarizing pills ([IA #4]).
_Pattern:_ show consequences before commitment; keep filter state always readable.

**Theme 3 — Search**
Fan-out query rather than convert-and-replace ([Search #5]), romaji→kana, bilingual passage summaries ([Content #6]).
_Pattern:_ accept the learner's input in whatever form it arrives; never guess its type.

**Theme 4 — Passages**
90% coverage unlock ([Gating #7]), readiness meter (cross-session), requirements list on tap ([Gating #12]), answer locking ([Gating #9]), two meanings of "locked" ([Gating #11]), long-press for details ([Reader #8]).
_Pattern:_ gates reframed as destinations; blocking reserved for passages only.

### Breakthrough Connections

- **[Gating #7] + [Reader #8] are one feature.** The 90% rule deliberately admits learners into passages with up to 10% unknown words. Long-press is what turns that 10% from a wall into the part where learning happens. Build together.
- **[Gating #7] + the readiness meter fix each other**, though decided in separate sessions. The meter reframes the gate as a destination; the 90% rule makes the destination reachable and removes the immovable-leech case.
- **[Gating #11] resolved a hidden ambiguity.** "Locked" was doing two unrelated jobs under one name — lesson eligibility and view permission. Separating them means browsing never blocks curiosity.

### Build Order

**Start first (long pole, runs in parallel):** content pipeline work — passage summaries (**G4**) and word boundaries carrying item ids (**G7**). Both need content authored, nothing else waits on them.

**Then, in code:**

1. **Unified list query** (**G3**) — UNION `items` + `reading_passages`. Foundation for everything else.
2. **Filters** — facet pills and drawers.
3. **Search** — fan-out query with debounce.
4. **Passage states** — 90% rule, readiness meter, requirements list, read back `passage_practice_results` (**G1**).
5. **Long-press details** — depends on pipeline work completing.
6. **Delete the Read tab** — last, once Browse fully replaces it.

**Independent quick wins:**

- **G1** — passage answers are stored but never read back. Fixable on the existing Read screen today, ahead of any redesign.
- **G8** — remove dependency-graph locking from the browse list.

## Session Summary and Insights

**Key achievements:**

- Every point in the original notes now has a decision recorded against it.
- Eight implementation gaps surfaced that were not known at the session start — most significantly **G3** (passages live in a separate table, which is the structural reason the Read tab is still isolated) and **G7** (no word boundaries exist in passage text).
- One question from the original notes was answered outright: passage answers **are** already stored; the gap is that nothing reads them back.

**Decisions reversed or refined during the session:**

- Accordion → flat paginated list, on virtualization grounds.
- Facilitator's "15 pills" objection was **wrong** — the design was faceted pills (5), not one pill per value. The faceted drawer with a live count also solved the empty-combination problem more capably than the smart-lists alternative proposed against it.
- Facilitator's objection to answer-locking was **withdrawn** — it assumed answer-once-and-done was the whole lifecycle, when passage repetition is handled outside this page.
- Progressive/streaming search results proposed and rejected on evidence (synchronous SQLite; queries neither slow nor concurrent).

**Open risk carried forward:** brute-forced correct answers lock permanently and remove a question from the passage-reappearance logic, making a guessed answer indistinguishable from knowledge. Judged possibly not worth solving.
