---
stepsCompleted: [1, 2, 3, 4]
session_active: false
workflow_completed: true
inputDocuments: []
session_topic: 'Learn page — mnemonic/answer UI density, on''yomi–kun''yomi teaching for beginners, and furigana behavior consistency'
session_goals: 'Concrete, implementable UI and content changes; resolve open questions about the furigana state model and beginner-only content gating'
selected_approach: 'ai-recommended'
techniques_used: ['Question Storming', 'Persona Journey', 'Morphological Analysis']
ideas_generated: []
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Riyaz
**Date:** 2026-07-19

> **Note:** A parallel brainstorming session is running against
> `brainstorming-session-2026-07-19-1322.md` (topic: item details page).
> This file is deliberately separate to avoid collision.

## Session Overview

**Topic:** The Learn page — going page by page through the app to improve it.

**Goals:** Land on concrete, spec-able changes covering UI density, beginner-facing kanji-reading education, and a coherent furigana model.

### Session Setup

Initial thinking brought to the session:

1. **Mnemonic + accepted-answer inputs are always-open and eat vertical space.** They should collapse behind icons; tapping an icon reveals the input. User-added mnemonics should render below the default mnemonic, where the default one lives.
2. **Add a lesson description explaining on'yomi and kun'yomi** before the first kanji lesson. Not part of SRS — a pre-lesson primer.
3. **Add an info icon beside the on'yomi / kun'yomi headings** on both the kanji learn and detail pages, opening that same explainer. The pre-lesson primer should be gated to absolute beginners — hidden when onboarding indicated existing kanji knowledge or a completed level.
4. **Grammar vocabulary should follow the furigana rule** — show furigana, tap the kanji to toggle its reading.
5. **Open question:** is furigana visibility tracked app-wide? If a word's furigana is disabled during a review, does that carry to the passage page or the Learn page example?

### Codebase Reality Check (verified before ideating)

**Furigana has two independent mechanisms, and only one is tracked:**

| Mechanism | Scope | Persisted? | Where |
| --- | --- | --- | --- |
| **Preference mode** (`shown` / `hidden` / `auto`) | Global | Yes, in `user.db` | `useFuriganaPreference.ts`, `preferencesRepository` |
| **Mastery-driven hiding** (`auto` mode only) | Global, per-kanji | Yes — derived from SRS state | `masteryRepository.getKnownKanjiCharacters()` |
| **Tap-to-toggle** | Single component instance, single run | **No** | `FuriganaText.tsx:74` — plain `useState`, reset by `useEffect` on `text` change |

- In `auto` mode, a run's furigana hides only once **every** kanji in it is known — where "known" = `item_study_status = 'known'` OR SRS stage in guru/master/enlightened/burned.
- **Answer to the open question: no.** Tapping 食べます in a review does not carry to the passage page or a Learn example. The toggle doesn't even survive that same component re-rendering with different `text`.
- `GrammarDetail.tsx` **already** routes its lesson body (`LessonMarkdown`) and example sentences through `FuriganaText` (lines 81, 142). So idea #4 may be narrower than assumed, or refers to a vocabulary list not yet located.

## Technique Selection

**Approach:** AI-Recommended

- **Question Storming** (deep) — the input mixes settled decisions with unstated rules ("selects that he already knows some kanji" — which signal exactly?). Surface the decisions this redesign rests on before answering them.
- **Persona Journey** (theatrical) — nearly every idea is conditional on *who is looking*. Playing those learners generates the gating rules rather than guessing them.
- **Morphological Analysis** (deep) — the furigana model is a system, not a screen. Map it as scope × persistence × trigger × surface to find the coherent designs.

**AI Rationale:** Three different kinds of problem in one input — UI density (decided), content design (open), and state architecture (genuinely unknown). Sequencing question-first prevents locking in a furigana model that contradicts itself across surfaces.

## Phase 1 — Question Storming

**Outcome: abandoned immediately — poor fit.** Riyaz rejected the technique before
engaging with it. He thinks by building on concrete proposals, not by opening the
question space. Switched to Yes-And Building. (Same finding as the parallel
details-page session; now saved as a durable facilitation preference.)

## Phase A — Yes, And Building

### A1. Collapse the mnemonic + accepted-answer inputs

_Current state_: `KanjiDetail.tsx:113-114` renders `PersonalMnemonicEditor` and
`UserSynonymEditor` unconditionally — each a label, a multiline `TextInput`, and a
Save button. ~200px of empty form on every kanji.

**[Idea A1.1]** Reuse the existing disclosure idiom from `MnemonicSection`
(`▸/▾`, `accessibilityState={{ expanded }}`, 44px target) rather than inventing a
second collapse pattern.

**[Idea A1.2] — user-originated, supersedes the "stateful icon" proposal.**
One mnemonic per item. Once saved, the input disappears and the saved text renders
in its place with an edit (pencil) icon at the end; tapping it restores the input.
Three states, each one row tall when idle:
- **empty** → muted "+ Add your own mnemonic" line (not a full TextInput)
- **saved** → mnemonic text + pencil icon
- **editing** → input + save

_Already supported_: `mnemonicRepository.setPersonalMnemonic(userDb, itemId, text)`
is keyed by `itemId`, so one-per-item needs no schema work.

**[Idea A1.3]** Personal mnemonic is *content, not a form field* — render it
directly below `MnemonicSection`'s text, styled as a mnemonic with a "yours"
marker. Fixes information architecture and density together.

**[Decided A1.4] — mnemonic delete flow.** `handleSave` currently writes empty
strings, storing `''` and rendering an empty mnemonic block. Resolved:
- Saved state shows **two** icons — edit (pencil) and delete (trash).
- Delete prompts first: "Are you sure you want to delete? Yes / No" — guards against
  a mis-tap.
- In edit mode, clearing the field **disables Save**. Deletion has exactly one path.

_Why this is the right call_: it removes the empty-save ambiguity at the source
rather than interpreting it. There is no state where the app has to guess whether
an empty string meant "delete" or "mistake".

**[Open decision A1.5]** Naming collision: `UserSynonymEditor` (the user's own
synonyms) sits adjacent to a "Synonyms" section showing *curriculum* accepted
answers (`KanjiDetail.tsx:75`). Same word, two meanings, same screen.

### A2. Pre-lesson on'yomi / kun'yomi primer

_Current state_: no explanation exists anywhere. `KanjiDetail.tsx:83-97` prints the
headings and a comma-joined list of readings. A learner who doesn't know the terms
gets nothing.

**[Idea A2.1]** The gating signal already exists — `getOnboardingPath()` returns
`'beginner' | 'manual' | 'import'`. Show unprompted for `beginner`; skip for the
other two. No new onboarding question.

**[Idea A2.2]** Use *two* flags, not one: onboarding path decides whether it is
shown unprompted; a new `seenKanjiReadingPrimer` preference stops it repeating.

**[Idea A2.3]** Not a wall of text before lesson one — an interstitial at the first
kanji that actually has both reading types, so the explanation lands on a concrete
example. (Later refined: this becomes section-1 content — see A6.)

### A3. Info icon beside the reading headings

**[Idea A3.1]** This is what rescues the gating problem — the importer who declared
"I know kanji" but has never heard the term keeps a permanent doorway.

**[Idea A3.2]** One source of content, two presentations: a single markdown doc
rendered full-screen pre-lesson and as a bottom sheet from the icon. Not two
explainers that drift.

**[Idea A3.3]** Extract a shared `SectionHeading` component with an optional
`infoTopic` prop. The `text-body-sm uppercase text-secondary` heading is duplicated
four times in `KanjiDetail` alone.

**[Idea A3.4]** This generalizes — once a heading can carry an explainer, "what is a
radical", "what does burned mean", "what's a transitive verb" become content rather
than code.

### A4. Furigana in grammar vocabulary

**Correction to the premise**: `GrammarDetail.tsx` *already* routes its lesson body
(line 81) and example sentences (line 142) through `FuriganaText`, which is
tappable per run. That rule is already followed there.

**[Idea A4.1]** The real gaps are elsewhere: `grammarRule.structure` (line 91),
`acceptedForms` (line 99), `conjugationRules` (line 108) and the "Synonyms" line in
every detail component all render as bare `<Text>` — kanji with no furigana.

**[Idea A4.2]** This is a *data* problem before a UI one. `FuriganaText` needs
bracket-annotated input and falls back to plain text otherwise. Conjugation rules
and accepted forms are almost certainly unannotated in the curriculum JSON. Work
order: annotate content → swap component.

**[Resolved A4.3] — grammar → vocabulary is real, shipping data with no UI.**
The facilitator's initial doubt was wrong. Verified:
- Grammar items carry a **`vocabulary_slugs`** field (`curriculum/grammar/n4.json`).
- The dependency graph holds **458 `grammar → vocabulary` `reinforces` edges**.
- Nothing in the app renders them.

**What connects to grammar, ranked by what exists:**

| Connection | Data | UI |
| --- | --- | --- |
| Vocabulary used by this grammar point | 458 edges + `vocabulary_slugs` | **Missing — the idea** |
| Related grammar | ships | renders (related-grammar chips) |
| Example sentences | ships | renders |
| Passages using this grammar | **none** — passages have only `title`, `body`, `body_furigana`, `questions`; no grammar/vocab linkage | n/a — would need schema work |

**[Idea A4.4]** Passage ↔ grammar linking is a new content project of the same class
as "similar-looking kanji" from the parallel session. Not free UI work.

**[Idea A4.5]** This slots straight into the three-section lesson: grammar's
section 3 ("Examples & links") = example sentences **+ the vocabulary that uses this
pattern**. Gives grammar the same cross-reference treatment kanji gets.

### A5. Furigana tracking

Deferred to Phase C (Morphological Analysis) — it's a system, not a screen.

### A6. Three-section lesson (pulled in from the parallel details-page session)

Source: `brainstorming-session-2026-07-19-1322.md` Phase 1.5. Lesson pages split
into **1) Introduction → 2) Mnemonic → 3) Examples & links**, advanced by a
Continue button. Details page stays a single vertical scroll.

**[Idea A6.1] — this resolves most of A1 by structure rather than disclosure.**
On the lesson page, section 2 *is* the mnemonic — nothing competes for the screen,
so nothing needs collapsing. `mnemonicCollapsible` becomes dead code.

**[Idea A6.2] A1 therefore splits in two:**

| Surface | Mnemonic behavior |
| --- | --- |
| Lesson page (paged) | No collapse. Section 2 gives it a full screen; personal mnemonic below default, edit icon inline. |
| Details page (single scroll) | Collapse still needed — this is where the always-open editors genuinely eat space. |

Same component, two behaviors — now with a principled reason instead of a prop flag.

**[Idea A6.3]** The primer (A2/A3) lands cleanly as **section 1 content on the first
kanji lesson** — not a wall before the lesson, but the Introduction page of the item
where readings first appear. The heading info icon then serves the details page and
every later encounter.

**[Caution A6.4]** Three pages × 12 items = 36 taps. Proposal: radicals collapse to
two sections — a radical's "examples & links" is the kanji that use it, which is
arguably Introduction material for a building block. Worth playtesting.

### A7. Confusion detection on wrong answers (user-originated)

_Concept_: When a user answers 持 with "wait" — which is 待's meaning — don't just
mark it wrong. Detect that the answer belongs to a **different, similar item** and
show a side-by-side comparison of the two so the user learns to tell them apart.

**[Idea A7.1] — the detection needs no similar-looking dataset.** The parallel
session priced "similar-looking kanji" as the most expensive item on the board
(schema change + ~150 curated items). For *this* use case that cost disappears: if
the user's answer exactly matches **another item's accepted answer**, the collision
itself is the signal. A reverse lookup on `accepted_answers` finds 待 from "wait".
Data already ships.

**[Idea A7.2] — the architecture already has this pattern.** `EvaluationResult`
carries `feedbackKind: 'incomplete'` — a non-terminal classification that stays
incorrect for SRS but is flagged so the reveal can teach rather than flatly reject
(`reviewAnswerEvaluator.ts:70`). `wrong_script` is the same shape. Confusion
detection is a third member of that family:
`feedbackKind: 'confused_with'` + the collided item's id, so the reveal can render a
comparison. Total work: reverse lookup + one `feedbackKind` + a comparison component.

**[Idea A7.3] — meaning and reading are NOT symmetric.**
- **Meaning:** collisions are rare and diagnostic. "wait" maps to essentially one
  N5 kanji. High signal.
- **Reading:** collisions are the norm and nearly meaningless. こう is shared by
  dozens of kanji; しん, か, せい likewise. "You may be confusing this with one of
  30 kanji" teaches nothing.

**[Idea A7.4] — filters that make reading viable**, cheapest first:
1. **Only flag if the collided item is one the user has studied.** Free —
   `item_study_status` + `srs_states` already exist. Cuts the crowd to plausible
   confusions.
2. **Only flag on a single unambiguous hit.** More than one studied match → stay
   silent. Cheap and conservative.
3. **Only flag if the two are also visually similar** — where a curated lookalike
   dataset would finally earn its cost, now as a *precision filter on a working
   feature* rather than a prerequisite for one.

_Recommendation_: ship 1+2 for both prompt types. Feature works day one with zero
new content; the lookalike dataset becomes a later upgrade, not a blocker.

**[Open decision A7.5] — does a confusion hit affect SRS?** Precedent says no
special treatment: `typo`/`wrong_script` are non-terminal, but `incomplete` stays
incorrect. Confusion is a real miss → grade `Again`, teach better on reveal.
Counter-argument: if the user repeatedly answers 持 with 待's meaning, **待** is
arguably the weak item, and the weakness-biasing engine may want that signal.

**[Idea A7.6]** This connects back to A6 — the comparison component built for the
review reveal is the same component a "similar-looking" section would use on the
details page. Build it once for the high-value moment (being wrong), reuse it for
browsing.

## Phase C — Furigana state model

Surfaces in play: **Learn, Lesson, Read**. `ReviewCard.tsx` does not use
`FuriganaText` — review prompts show no furigana, which is correct (it would give
away a reading answer).

### C1. What ships today — two mechanisms that disagree

| Mechanism | Scope | Persistence | Coherent? |
| --- | --- | --- | --- |
| Preference mode (`shown`/`hidden`/`auto`) | global | permanent | yes |
| Mastery-derived (`auto`) | per-kanji | permanent | yes, but wrong unit — see C3 |
| **Tap toggle** | run instance | **none** | no model behind it |

### C2. A tap means two different things depending on direction

- **Tap to hide** = "I know this, stop helping me" → a mastery claim → should persist.
- **Tap to reveal** = "I'm stuck, let me peek" → a momentary request → should not persist.

Current code treats both as one symmetric toggle with no persistence. The bug is a
*conflated* feature, not a missing one.

**Superseded.** The facilitator proposed asymmetric persistence (tap-to-hide saves,
tap-to-reveal doesn't). Riyaz replaced it with something simpler — see C2b.

### C2b. Decided model — SRS decides, taps peek, Settings overrides

| Layer | Role | Persistence |
| --- | --- | --- |
| **SRS** | Decides furigana visibility by default — vocabulary at guru+ (see C3) | permanent |
| **Tap** | A quick peek, either direction. Also lets the user self-test on a word they've already cleared. | none — never saves |
| **Settings** | Manual per-word override of the SRS decision, show or hide | permanent |

_Why this is better than the asymmetric proposal_: taps stay stateless, so current
`FuriganaText` behavior needs no change at all. Control is consolidated in one
visible place instead of being scattered across invisible inline gestures — a user
can see and undo every override they've made. Riyaz's framing: the user should have
control over the app, but that control shouldn't be something you trigger by accident.

**Work:**
- Settings screen: list of furigana overrides, with per-word show/hide and a reset
- Storage: migration `015_furigana_overrides` — `(word, mode, created_at)`
- Deliberately *not* `item_study_status = 'known'`, which also feeds lesson planning
  and the SRS queue; tidying a reading view must not alter the study schedule
- Resolution order: Settings override → SRS default → global preference mode

### C3. Mastery unit is vocabulary, not kanji (user-originated — corrects current code)

`getKnownKanjiCharacters()` checks **kanji characters**. That is the wrong unit.

_Riyaz's counterexample_: clearing 平 does not tell you 平行 is へいこう. Readings
belong to words, not characters. You will meet 行 separately later, and the
vocabulary using it later still — until you clear **that vocabulary item**, the
furigana should stay.

**Decided rule:** hide a word's furigana when that **vocabulary item** reaches
guru+ (or `item_study_status = 'known'`). Never infer it from component kanji.

**Work:**
- Replace `getKnownKanjiCharacters` with a vocabulary-based lookup
- `auto` mode matches on the word, not its characters

### C4. Rejected combinations

- **Any persistence on tap** — a tap is a peek or a self-test, not a statement.
  Saving it would silently change the app from an accidental gesture.
- **Kanji-scope hiding** — overreaches; see C3.
- **Session-scoped persistence** — a mastery claim isn't session-shaped.
- **Feeding taps back into SRS** — same trap as A7.5; a tap is weak evidence.

### C5. Resolved

Escape hatch confirmed: Settings holds the override list, with reset. This became
the whole override mechanism (C2b) rather than just a cleanup tool.

## Idea Organization and Prioritization

### Themes

**Theme 1 — Density: forms should not occupy a study page**
A1.2, A1.3, A1.4, A6.1, A6.2. Every always-open editor competes with content the
user actually came for. Resolved two ways depending on surface: paging on the
lesson, disclosure on the details page.

**Theme 2 — Teach the vocabulary of learning, not just the items**
A2.1–A2.3, A3.1–A3.4, A6.3. The app names things (on'yomi, radical, burned) it has
never explained. Fix: one markdown source per concept, shown unprompted to
beginners and reachable forever via heading info icons.

**Theme 3 — Shipping data with no UI**
A4.3, A4.5, and the parallel session's radical→kanji and kanji→vocabulary edges.
1,356 dependency edges exist; the app renders almost none of them. Cheapest value
in the whole backlog.

**Theme 4 — Getting the unit of knowledge right**
C3, A7.3. Two independent findings, same shape: the app models knowledge at the
wrong granularity. Furigana keys on kanji when readings belong to words. Confusion
detection would key on readings where collisions are meaningless.

### Breakthrough concepts

**B1 — Answer collision replaces curated similarity data (A7.1).**
The parallel session priced "similar-looking kanji" as its most expensive item
because it needed ~150 curated entries before shipping anything. Detecting
confusion from *answer collisions* needs no curation at all — the accepted-answers
table already knows that "wait" belongs to 待. The curated dataset drops from
prerequisite to optional precision filter. **This changes the cost ranking in the
parallel details-page session and should be carried back there.**

**B2 — Paging earns the right to show cross-references (A6, from parallel session).**
Cross-references are noise at first encounter and payoff after the mnemonic lands.
Section 3 gives them a home, which turns two separate ideas into one project.

**B3 — The furigana bug is a conflated feature, not a missing one (C2).**
Nothing needed adding. A single toggle was doing two unrelated jobs.

### Priority

**Quick wins — UI only, data already ships**

| Item | Work |
| --- | --- |
| C3 — furigana keys on vocabulary, not kanji | Replace `getKnownKanjiCharacters` with a vocab lookup. Bug fix. |
| A4.3 — grammar → vocabulary list | 458 edges + `vocabulary_slugs` ship today; render them. |
| A1.2/A1.4 — mnemonic read-view, edit + delete with confirm | `mnemonicRepository` already keyed by `itemId`. |
| A3.3 — `SectionHeading` with optional `infoTopic` | Removes 4× duplication in `KanjiDetail` alone; unlocks Theme 2. |

**Medium — new content or new screens**

| Item | Work |
| --- | --- |
| A2 — on'yomi/kun'yomi primer | Write the markdown; gate on `getOnboardingPath()` + new `seenKanjiReadingPrimer`. |
| C2b — furigana overrides in Settings | Migration `015_furigana_overrides` + settings screen. |
| A4.1/A4.2 — annotate `structure`, `acceptedForms`, `conjugationRules` | Content pass first, then swap in `FuriganaText`. |

**Larger — structural**

| Item | Work |
| --- | --- |
| A6 — three-section lesson paging | Splits lesson from details for real; makes `mnemonicCollapsible` dead code. Playtest A6.4 (36-tap concern) first. |
| A7 — confusion detection | Reverse lookup + `feedbackKind: 'confused_with'` + comparison component. Ship filters 1+2; skip lookalike data. |

### Suggested sequence

1. **C3** — it's a live bug, and it's small.
2. **A3.3** — unlocks Theme 2 and pays for itself in deleted duplication.
3. **A1.2/A1.4 + A4.3** — visible wins on data that ships.
4. **Playtest A6.4** before committing to paging.
5. **A7** — highest novelty; do it after B1 is carried back to the parallel session.

## Session Summary and Insights

**Key achievements**

- Five loose proposals consolidated into four themes with a build order
- Two live bugs found: furigana keyed on the wrong unit (C3), tap toggle
  conflating peek with mastery claim (C2)
- One doubted idea vindicated by data — grammar→vocabulary is 458 shipping edges (A4.3)
- One cost model overturned (B1), with consequences for a parallel session

**Session reflections**

- Question Storming failed twice in one day with this user. He builds on concrete
  proposals rather than opening question space. Yes-And and structured grids both
  worked well; recorded as a durable facilitation preference.
- Checking the codebase before ideating repeatedly changed the conclusion — it
  corrected the facilitator on A4.3, and corrected the shipped implementation on C3.
- The user's own corrections were consistently *simplifications* (C2b replaced an
  asymmetric-persistence design with SRS + peek + Settings). Worth trusting that
  instinct earlier next time.
