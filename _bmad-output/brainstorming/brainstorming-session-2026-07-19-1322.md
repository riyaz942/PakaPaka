---
stepsCompleted: [1, 2, 3, 4]
session_active: false
workflow_completed: true
inputDocuments: ['_bmad-output/brainstorming/brainstorming-session-2026-07-19-1322-learn-page.md']
session_topic: 'Item details page (radical / kanji / vocabulary / grammar) — improvements'
session_goals: 'Decide concrete changes to the details page: hide accepted answers behind a disclosure, add type-appropriate cross-reference sections, and establish what content/data actually exists vs needs creating'
selected_approach: 'ai-recommended'
techniques_used: ['Question Storming', 'Role Playing', 'Solution Matrix']
ideas_generated: []
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Riyaz
**Date:** 2026-07-19

## Session Overview

**Topic:** Item details page (`mobile/src/app/(tabs)/learn/item/[id].tsx`) — going page by page through the app to improve it.

**Goals:** Land on concrete, spec-able changes to the details page across all four content types.

### Session Setup

Initial thinking brought to the session:

1. Details page shows full detail for Radical / Kanji / Vocabulary / Grammar. Passages keep their own separate page (`read/[id]`) — out of scope.
2. Custom accepted answers should be hidden behind an accordion/disclosure rather than shown inline.
3. Each type should show type-appropriate related content:
   - **Radical** → similar-looking radicals + example kanji that use it
   - **Kanji** → vocabulary containing it + similar-looking kanji + example sentences
   - **Vocabulary** → component kanji (inverted) + usage examples
   - **Grammar** → considered already well covered (story + examples)

### Codebase Reality Check (verified before ideating)

| Idea | Status |
| --- | --- |
| Accepted answers surfaced | **Partial.** Non-primary *meaning* answers render as a flat "Synonyms" line on Kanji/Vocab/Grammar (`KanjiDetail.tsx:75`). Radicals show none. *Reading* answers are fetched but never displayed. Accordion is new work. Note `UserSynonymEditor` (user's own synonyms) already occupies the page — naming/UX collision to resolve. |
| Similar-looking radicals / kanji | **No data, no schema slot.** `item_relationships` permits only `requires` / `builds_on` / `reinforces`. Needs schema change + content generation (~150 radicals + kanji) + UI. Most expensive item by a wide margin. |
| Radical → example kanji | **Data ships, UI absent.** 153 `radical→kanji` `builds_on` edges. `RadicalDetail` renders nothing but glyph + mnemonic (57 lines — thinnest of the four). |
| Kanji → vocabulary using it | **Data ships, UI absent.** 745 `kanji→vocabulary` `requires` edges. |
| Vocabulary → component kanji | **Data fetched, UI collapses it.** `useItemDependencyStatus` returns `parents`; rendered as a single green "Prerequisites met" line instead of a browsable list. |
| Example sentences (kanji + vocab) | **Shipped and rendering.** |
| Grammar detail | **Richest of the four** (175 lines: markdown explanation, conjugation table, related grammar, examples). Leave as is. |
| Passages | Separate route `read/[id]`. Out of scope — agreed. |

**Headline:** three of the four ideas are UI-only work on data that already ships. Similar-looking is a content project wearing a UI costume.

Supporting fact: `getRelatedItemsForItems` (children traversal) already exists in `itemRepository.ts:617` but is wired only into the review queue — not the details page.

Dependency graph edge census (`curriculum/dependencies/graph.json`, 1,356 edges):
- `radical → kanji` (builds_on): 153
- `kanji → vocabulary` (requires): 745
- `grammar → vocabulary` (reinforces): 458

## Technique Selection

**Approach:** AI-Recommended

- **Question Storming** (deep) — the initial list is a set of *answers*; map the question space first so we solve the right problem.
- **Role Playing** (collaborative) — the page renders identically for four very different arrivals (post-review failure, curious browser, first lesson encounter, bulk importer). Richest vein.
- **Solution Matrix** (structured) — grid ideas against content-cost vs learner-value so "similar-looking kanji" gets an honest verdict rather than sharing a bucket with free wins.

**AI Rationale:** Topic is concrete and the user knows the domain deeply — creative/wild techniques would add noise. What's needed is surfacing implicit assumptions, pressure-testing them against real user arrivals, then ranking against verified cost data.

## Phase 1 — Question Storming

**Outcome: technique abandoned early — poor fit.** Riyaz answered the facilitator's questions rather than generating his own, then redirected to concrete design. Saved as a durable facilitation preference. The technique still produced two structural findings before being dropped.

### Finding 1 — The lesson page IS the details page

`LessonItemView.tsx:44` renders the same four components as `learn/item/[id].tsx`. The only differences are `size="lg"` and `mnemonicCollapsible`. Consequence: **any section added lands in both screens.** Showing "vocabulary using this kanji" would surface unlearned words during a first encounter; showing similar-looking kanji (土 / 士) at first encounter is arguably the worst possible moment to introduce confusion.

### Finding 2 — Cross-references are reference features on a study page

Riyaz's answers framed the page as a *study* page, revealed gradually. But every cross-reference on the original list (component kanji, vocab using this kanji, similar-looking) only makes sense **after** the item is known. That tension is what the three-section idea below resolves.

### Answers captured

1. **Entry points:** only one — the Learn tab. Nothing routes here from a failed review.
2. **Study or reference:** study page, revealed gradually.
3. **Lesson vs details:** the lesson is effectively a scrollable details page today, and that's acceptable.
4. **Why RadicalDetail is thinnest:** partly deliberate (a radical is the smallest building block), partly a gap — more content and images are coming via the content pipeline.

## Phase 1.5 — The Three-Section Lesson (user-originated)

**[Structure #1]: WaniKani-style paged lesson**
_Concept_: Split each item's lesson into three sequential sections advanced by a Continue button — (1) **Introduction**: details of the radical/kanji/grammar, with the radical's image; (2) **Mnemonic**: how to memorise it; (3) **Examples & links**: where the item is used, related items, example sentences. Complete all three sections for an item, then advance to the next item. Passages are exempt — they stay a single page with questions.
_Novelty_: Resolves the lesson/details fork without prop-gating. Lesson becomes paged, details stays a single scroll — same content, genuinely different presentation, so splitting the components is now justified rather than duplication.

**Key consequence — paging earns the right to show forward-references.** Showing 山田 at the *top* of a 山 lesson is noise; showing it on page 3, after the mnemonic has landed, is a payoff ("here's where you'll meet this"). The paging idea and the cross-reference idea are therefore the same project — section 3 gives the links a home that doesn't clutter the intro.

**Mapping to what exists:**

| Section | Contents | Status |
| --- | --- | --- |
| 1. Introduction | glyph, meaning, readings, radical image | ships today |
| 2. Mnemonic | `MnemonicSection` + `PersonalMnemonicEditor` | ships; `mnemonicCollapsible` becomes redundant — paging replaces it |
| 3. Examples & links | example sentences, cross-references | sentences ship; cross-refs are the new work |

**Open caution:** three pages × every item means a 12-item lesson becomes 36 taps. Worth testing whether radicals need all three sections.

### Scope clarification (explicit)

The three-section paging applies to the **learn/lesson page only**. The **details page stays a single vertical scroll** — no left-to-right paging. Its sections may be collapsed behind accordions so the user can jump to what they came for, but the page remains one scrollable surface.

_Watch item:_ this yields three presentation patterns across the app — paged (lesson), accordion (details), flat scroll (elsewhere). The reasoning is sound (details is jump-to-section, lessons are sequential), but the visual language should stay consistent enough that they read as one app.

## Phase 2 — Role Playing

### Scenario 1 — the returning learner who keeps confusing two kanji

_Setup: opens 持 from the Learn tab because he keeps getting it wrong._

**Riyaz's answer:** "I would want to look at comparisons of the shape of the kanji, so I see the kanji itself, and then would move to meaning or reading just to confirm or re-learn."

**Implication — the page order is inverted for this user.** Today: glyph → meaning → synonyms → readings → mnemonic → examples, cross-references nowhere. The returning learner wants shape comparison *high*, with meaning/readings as the confirmation step below it.

**[Feature #2]: Compare — a picker, not a section**
_Concept_: A Compare button on the details page opens a searchable comparison tool. Derived look-alike suggestions sit at the top of the list; below them, the full searchable set of kanji/radicals. The user chooses what to compare against. Comparison itself renders in a modal/route, not inline.
_Novelty_: Reframes similarity from **authored content** to **user-driven tool**. A static "similar-looking" section makes a claim the app must stand behind, requiring curated and reviewed content. As the seed list of a picker, a mediocre suggestion costs one tap — so the noisy shared-radical proxy becomes good enough to ship, and the content project largely disappears. Also resolves the ordering tension without reordering the page: the button sits high, the content stays put.

**Derivable-similarity analysis (from `curriculum/dependencies/graph.json`):**
- 127 kanji have radical parents; 38 radicals are shared by 2+ kanji.
- Free true positives: 白/百 (`shiro`), 十/千 (`juu`).
- **Limit 1 — shallow decomposition:** 105 of 127 kanji list only one radical parent, so 待/持 (both containing 寺) is unreachable; 寺 isn't a radical in the data. Those pairs depend on search alone.
- **Limit 2 — precision:** `ki` is shared by 本, 休, 東, 木, 校, 親. 木/本 is real confusion; 木/親 is noise.
- **Mitigation:** a "shares 白" chip on each suggestion frames it as a *reason*, not a claim — which is what makes shipping the noisy proxy acceptable.

**[UI #3]: Side-by-side comparison layout (mocked and approved)**
_Concept_: Glyphs side by side at ~150pt each — they're square, so two fit comfortably in 390pt. Short attributes (meaning, on'yomi, kun'yomi) columnize cleanly because Japanese values are short. Prose (mnemonics, example sentences) stacks full width below; at half width it wraps into unreadable ribbons. Glyph row stays sticky while scrolling.
_Novelty_: Rejects the obvious flip/toggle between items — it reads as elegant and destroys the feature, since shape comparison needs both glyphs in the eye simultaneously.

**[UI #4]: Component chips with the shared part dimmed**
_Concept_: Beneath each glyph, render its radical components as chips; dim the shared ones to ~45% and light the differing one in `content-radical` blue. 百 shows 一 lit / 白 dimmed; 白 shows 白 dimmed.
_Novelty_: You can't dim part of a single Unicode glyph, so this is the implementable form of "highlight the difference." It does the spotting *for* the user rather than asking them to find it — and it falls straight out of existing radical edges. Progressive enhancement: absent where decomposition data is missing.

**Open item:** the mock shows stroke counts, but the `items` table has no stroke-count column. Add to schema or drop the row.

**Reuse note:** nothing in this flow is kanji-specific — the same picker and comparison view serve radicals, where look-alike confusion arguably starts and where the details page is currently thinnest.

**Mock:** https://claude.ai/code/artifact/acea048e-9c5d-4457-ac93-81dc5d3f5ad5 — approved by Riyaz.

### Scenario 2 — the curious browser

_Setup: two weeks in, still on N5 radicals, taps into a locked kanji (校) well past current progress._

**Riyaz's answer:** show the full page — no gating, no withholding. Add a passive info banner at the top noting the item hasn't been studied yet. Explicitly *not* a warning ("too strong"), explicitly *not* a block, and explicitly **no "Start lesson" action** — learning happens through the SRS flow, and the details page must not become a second entry point.

**[Feature #5]: Study-status info banner**
_Concept_: A passive, non-blocking info banner at the top of the details page reflecting the user's relationship to the item. Content stays fully visible in every state.
_Novelty_: Rejects the conventional "lock it until earned" instinct. Curiosity is treated as legitimate — the banner orients rather than gates.

**Data check — already available, never queried.** `item_study_status` tracks `not_started` / `in_progress` / `known`, and `getStudyStatusOrDefault()` exists in `data/user/itemStudyStatusRepository.ts`. The details page simply never calls it. No `useItemStudyStatus` hook exists yet; it would be thin.

**Side benefit — fixes a weak existing state.** The page currently has only two: locked (`KanjiDependencyHints` lists what's missing) and a green "Prerequisites met" line. That green line tells a user who deliberately navigated here almost nothing. Combining lock state with study status yields four honest states:

| State | Banner |
| --- | --- |
| Locked | You need 木 and 交 first |
| Prereqs met, not started | You haven't studied this yet |
| In progress | _(nothing — user is mid-flight)_ |
| Known | _(nothing)_ |

### Scenario 3 — the bulk importer

_Setup: imported 2,000 WaniKani items at onboarding, marked `known`, never saw a lesson in this app — so has never read one of its mnemonics. A review fails; they open the details page and find an unfamiliar mnemonic for something they already know._

**Riyaz's answer:** not a real problem. The content pipeline supplies quality mnemonics, and `PersonalMnemonicEditor` already lets the user write and refer to their own. No blocker.

**Outcome: scenario closed with no new work identified.** Correct call — the escape hatch already ships on all three item types. Noted here so the ground is known to have been covered rather than missed.

## Phase 3 — Solution Matrix

### Carry-backs from the parallel Learn-page session

Source: `brainstorming-session-2026-07-19-1322-learn-page.md`. Four items landed here and changed this session's conclusions.

**1. B1 — answer collision replaces curated similarity data.** Detecting confusion from *answer collisions* (a reverse lookup on `accepted_answers`: "wait" belongs to 待) needs no curated lookalike dataset. This is a better similarity source than the shared-radical proxy developed in Scenario 1 — precise rather than noisy, and it fires at the moment confusion actually happens rather than while browsing. **Consequence:** the details-page picker is no longer the primary surface for comparison; the review reveal is. The picker becomes a browsing entry point to a component built elsewhere.

**2. The comparison component is shared — build it once, in the review-reveal work.** The mock produced in Scenario 1 stands as its layout spec (sticky glyphs, columnized short values, stacked prose, dimmed shared components). The details page *consumes* it rather than specifying it.

**3. Mnemonic decisions land on the details page.** One mnemonic per item; read-view with pencil + trash icons; delete prompts for confirmation; Save disabled when the field is empty. Density matters here specifically because the details page is a single scroll — the lesson page solves the same problem with paging, so collapse is a details-page concern only.

**4. Grammar → vocabulary is real** — corrects this session's earlier acceptance that grammar was "already covered."

**Also inherited:** furigana now keys on **vocabulary**, not kanji (`getKnownKanjiCharacters` is the wrong unit — clearing 平 tells you nothing about 平行). The details page renders `FuriganaText`, so it inherits that fix without doing the work.

### Correction — grammar was not "already covered"

The session initially accepted that `GrammarDetail` was complete because it is the richest of the four components. Rich is not complete. Verified:

`grammar_vocabulary_links` is queried **in one direction only**:

```
getGrammarLinksForVocab(vocabItemId)   WHERE gvl.vocabulary_item_id = ?
```

So a **vocabulary** page shows the grammar points that use the word (`VocabularyDetail.tsx:118`). There is no mirror — nothing queries `WHERE gvl.grammar_item_id = ?`. A **grammar** page shows related *grammar* (`getRelatedGrammarItems`, a different table: `grammar_related_links`) but never the vocabulary that uses the pattern.

Concrete: です in `curriculum/grammar/n5.json` carries `vocabulary_slugs: ["watashi", "gakusei", "kore", "hon"]` — 私, 学生, これ, 本. These compile into the links table. The learner cannot see them.

**[Feature #6]: Grammar → vocabulary section**
_Concept_: Mirror `getGrammarLinksForVocab` with the WHERE column flipped, then render the chip row `VocabularyDetail` already uses.
_Novelty_: The smallest item on the entire board — roughly half an hour — and it completes the cross-reference symmetry across all four content types.

**Cleanup while in there:** `GrammarVocabLink.vocabularyPrimaryForm` is misnamed. The SQL joins on `grammar_item_id`, so the field holds the *grammar* form. It renders correctly but will mislead whoever writes the mirror.

### Scope decision

**Riyaz: ship all of it before public release — targeting quality, not triage.** The matrix therefore ranks by *rework avoidance*, not by what to cut.

### The dominating dependency

**Do the component split before adding sections.** Every cross-reference section lands in `KanjiDetail` / `VocabularyDetail` / `RadicalDetail` / `GrammarDetail`, which the lesson and details screens currently share (`LessonItemView.tsx:44`). Add sections first and each file is touched twice — once to add, once to split. Split first and each section is written once, into the right place.

### Build order (approved)

| # | Work | Size | Why here |
| --- | --- | --- | --- |
| 1 | C3 — furigana keys on vocabulary, not kanji | S | Live bug; details page inherits it through `FuriganaText` |
| 2 | `SectionHeading` + optional `infoTopic` | S | 4× duplication in `KanjiDetail` alone; every section below consumes it |
| 3 | **Split lesson composition from details composition** | M | The rework-avoidance step — everything after this depends on it |
| 4 | Cross-reference sections ×4 — radical→kanji, kanji→vocab, vocab→kanji, grammar→vocab | M | All free data; written once into the split |
| 5 | Study-status banner + accepted-answers accordion + mnemonic read-view | M | Details-page density pass; resolves the `UserSynonymEditor` naming collision (A1.5) |
| 6 | Lesson paging (three sections) | M | Now a presentation change rather than a restructure |
| 7 | Confusion detection + comparison component | L | Highest novelty; builds the shared component |
| 8 | Details-page Compare entry point | S | Reuses #7 |

## Idea Organization and Prioritization

### Themes

**Theme 1 — Shipping data with no UI.** Radical→kanji (153 edges), kanji→vocab (745), grammar→vocab (458 + `vocabulary_slugs`), vocab→kanji (fetched, then discarded into a green "Prerequisites met" line). 1,356 edges exist; the app renders almost none. Cheapest value on the board, and it is the bulk of the original request.

**Theme 2 — The page has no model of who is looking.** One rendering serves the first encounter, the re-read, the locked browse, and the post-failure check. Scenario 1 wants comparison high; Scenario 2 wants orientation without gating; the lesson wants none of it. Resolved by splitting compositions (#3) and adding the study-status banner (#5).

**Theme 3 — Forms occupying a study page.** `PersonalMnemonicEditor` and `UserSynonymEditor` render unconditionally. Resolved differently per surface: paging on the lesson, disclosure on the details page.

**Theme 4 — Right feature, wrong surface.** Comparison belongs primarily to the review reveal, where confusion actually occurs; the details page is the browsing entry point. Similarity belongs to answer collisions, not curated visual data.

### Breakthrough concepts

**The picker reframe (Feature #2).** Turning similarity from authored content into a user-driven tool dropped the cost of the session's most expensive item. A static "similar-looking" section makes a claim the app must stand behind; as the seed list of a picker, a wrong suggestion costs one tap. This made the noisy shared-radical proxy shippable — and then B1 from the parallel session made even that proxy secondary.

**Paging earns the right to show cross-references.** Forward references are noise at first encounter and payoff after the mnemonic lands. Section 3 gives them a home, merging two separate ideas into one project.

**Component chips with the shared part dimmed (Feature #4).** You cannot dim part of a single Unicode glyph; rendering the decomposition as chips and dimming the shared ones is the implementable form. It does the spotting for the user instead of asking them to find it, and falls straight out of existing radical edges.

### Resolved from the original four points

| Original idea | Outcome |
| --- | --- |
| Accepted answers behind an accordion | Confirmed, folded into #5 with the `UserSynonymEditor` naming collision |
| Similar-looking radicals / kanji | **Reframed.** Curated dataset dropped; becomes answer-collision detection (#7) plus a browsing picker (#8) |
| Type-appropriate cross-references | Confirmed and extended to grammar (#4) |
| Grammar and passages left alone | **Half wrong.** Passages stay out of scope; grammar gains the missing vocabulary link |

### Open items

- **Stroke counts** — shown in the mock, but `items` has no such column. Add to the curriculum schema or drop the row from the comparison view.
- **36-tap concern** — three sections × 12 items. Playtest before committing to paging; radicals may warrant two sections rather than three (A6.4 in the parallel session).
- **Deeper kanji decomposition** — deferred. Would reach 待/持, which shared-radical data cannot. Revisit only if search and answer-collision both prove insufficient.
- **`vocabularyPrimaryForm` misnaming** — fix alongside #4.

## Session Summary and Insights

**Key achievements**

- Verified every assumption against the codebase before ideating; three of the four opening ideas turned out to be UI-only work on data that already ships.
- One cost model overturned: the "similar-looking" content project was reframed into a tool and then largely absorbed by the parallel session's answer-collision insight.
- One shipped gap found that neither party expected — grammar→vocabulary links, queried in one direction only.
- A layout spec produced and approved as a mock, now serving as the contract for a component built in a different work stream.
- A build order whose ordering rationale is rework avoidance rather than value ranking, because the user chose to ship everything.

**Session reflections**

- **Question Storming failed here**, as it did in the parallel session the same day. Riyaz answered the facilitator's questions rather than generating his own, then redirected to concrete design. Saved as a durable facilitation preference; Role Playing and structured grids both worked well.
- **Checking the code repeatedly changed the conclusion.** It corrected the facilitator on grammar coverage, revealed that lesson and details are literally the same components, and turned "similar-looking needs a content project" into "partly derivable today, with measurable limits."
- **The user's corrections were consistently scope-narrowing and structural** — the passive banner over an actionable one, the picker over a static section, and the clarification that paging belongs to the lesson while the details page stays a single scroll. That instinct was reliable enough to trust earlier.
- **Two parallel sessions on adjacent pages produced genuinely complementary results.** The cross-pollination (B1 in particular) changed conclusions in both directions rather than duplicating work.
