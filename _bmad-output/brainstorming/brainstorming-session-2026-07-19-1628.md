---
stepsCompleted: [1, 2, 3, 4]
session_active: false
workflow_completed: true
inputDocuments:
  - '_bmad-output/brainstorming/brainstorming-session-2026-07-19-1322.md'
  - '_bmad-output/brainstorming/brainstorming-session-2026-07-19-1322-learn-page.md'
session_topic: 'Review page — post-answer pacing, detail reveal without leaving the session, and kanji on''yomi/kun''yomi prompting'
session_goals: 'Concrete, spec-able changes to the review flow; capture bugs found along the way'
selected_approach: 'ai-recommended'
techniques_used: ['Competitor Teardown (WaniKani)', 'Yes-And Building', 'Solution Matrix']
ideas_generated: []
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Riyaz
**Date:** 2026-07-19

> Third in the page-by-page series. Prior sessions:
> `brainstorming-session-2026-07-19-1322.md` (item details page) and
> `brainstorming-session-2026-07-19-1322-learn-page.md` (learn page).

## Session Overview

**Topic:** The Review page (`mobile/src/app/review/`) — post-answer pacing, detail
reveal without leaving the session, and kanji reading prompts.

**Goals:** Concrete, spec-able changes. Bugs found along the way get captured as
bugs, not ideas.

### Session Setup

Initial thinking brought to the session:

1. **After submitting, it advances too fast.** The user should decide when to move
   on.
2. **After submitting, an icon should reveal full details** of the
   radical/kanji/vocabulary/grammar. Viewing details must not exit the review flow,
   even if it opens a new page pushed onto the navigation history.
3. **Kanji should be asked for both meaning and reading**, and the reading should
   cover both on'yomi and kun'yomi. Kun'yomi should be paired with a word —
   probably vocabulary. Dissect WaniKani's flow.

## Codebase Reality Check (verified before ideating)

### Point 1 — auto-advance

`review/index.tsx:244` — on a **correct** answer only:

```
autoAdvanceTimer = setTimeout(..., REVIEW_CORRECT_AUTO_ADVANCE_MS)  // 800ms
```

- **Correct** → 800ms, then advance. No user control.
- **Incorrect** → already waits for a `Continue` button (`index.tsx:434`).
- **Typo / wrong_script** → re-prompt, no advance.

So the complaint is precisely scoped: the correct path is the only one that moves
without asking. The grade is deferred behind the timer and flushed on unmount
(`flushPendingGrade`), so any pacing change must preserve that flush contract.

### Point 2 — detail reveal

| Path | What shows |
| --- | --- |
| Incorrect | `IncorrectReveal` — meaning, alternates, readings (on'yomi/kun'yomi split), mnemonic, examples behind a "See full details" press |
| Correct | Only `✓ Correct` + one line (`Label: value`), stage badge, reinforcement link |

The detail panel **already exists** — it is just wired to failure only. Data is
prefetched for the current item *and the lookahead buffer*
(`useReviewRevealDetails`), explicitly so the reveal is a pure render with no DB
round-trip. Showing it on the correct path costs no new fetching.

**Navigation finding (the real constraint):** `ReviewSessionProvider` is mounted in
`review/_layout.tsx`. Any route **inside** `review/` keeps the session alive;
navigating to `learn/item/[id]` leaves the layout and **destroys the session**.
Also `usePreventRemove` (`index.tsx:103`) pops the exit sheet on any removal while a
session is active. So "open details without exiting the flow" means either a
modal/sheet or a route nested under `review/`. It cannot be a link to the existing
details page.

### Point 3 — kanji readings

**Confirmed gap, and worse than stated.**

- `resolvePromptType` (`promptResolver.ts:20`) alternates kanji between `reading`
  and `meaning` **by rep parity**. One prompt per review, never both.
- `useReviewQueue.ts:81-84` merges **every** kanji reading into one flat
  `acceptedReadings` array. The evaluator accepts any of them.

**Consequence:** on a kanji reading prompt, typing the on'yomi *or* the kun'yomi is
marked correct. The app never checks which one it asked for, because it never asks
for a specific one.

**Data census (`curriculum/kanji/*.json`, 200 kanji):**

| | Count |
| --- | --- |
| Kanji with both on'yomi and kun'yomi | 181 |
| On'yomi only | 19 |
| Kun'yomi only | 0 |
| `accepted_answers` rows of type `reading` per kanji | exactly 1, always |

`readings[]` carries the typed pairs (`reading_type`, `reading`, `sort_order`);
`accepted_answers` carries a single untyped reading. The typed data ships — the
review flow flattens it away.

## Phase A — Kanji reading model (WaniKani teardown)

Taken first because it is a live bug and because its shape decides points 1 and 2.

### A0. What WaniKani actually does

1. **Meaning and reading are separate cards**, both required before the kanji
   advances.
2. **WK asks one *specific* reading**, not both. A valid-but-not-asked reading gets
   a non-terminal shake — *"WaniKani is looking for the on'yomi reading"* — no
   penalty, retry.
3. **Kun'yomi is never taught on the kanji card.** It arrives through vocabulary:
   山 the kanji teaches さん, 山 the vocabulary word teaches やま.

Point 3 as written contained both halves of a contradiction — "ask both on'yomi and
kun'yomi" (not WK) and "pair kun'yomi with a word" (exactly WK). **Resolved in
favour of the second.**

### A1. Decided — kanji cards ask on'yomi only

| | Decision |
| --- | --- |
| Kanji card asks | Meaning **and** the on'yomi reading, as two cards |
| Prompt labels the reading type | Yes — "Reading — on'yomi" |
| Kun'yomi delivery | Vocabulary pairing, not the kanji card |

**Data supports it.** 79 single-kanji vocabulary items map to a taught kanji, and 51
carry that kanji's kun'yomi. The 28 misses are almost entirely numbers — 一 as いち,
二 as に — which is linguistically correct standalone on'yomi, not a content gap.

### A2. [Bug] Any reading is accepted on a reading prompt

`useReviewQueue.ts:81-84` merges every `readings[]` row into one flat
`acceptedReadings` array. On a kanji reading prompt the learner can type the on'yomi
**or** the kun'yomi and be marked correct. The app never checks which it asked,
because it never asks for a specific one.

**Fix shape — reuse machinery that already exists.** "Valid reading, wrong type" is
structurally identical to `wrong_script` (`index.tsx:263`): non-terminal, no grade,
no weakness signal, nudge and re-prompt. It becomes a third member of that family:

```
feedbackKind: 'wrong_reading_type'  →  "We're looking for the on'yomi reading."
```

This is the cheapest form of the largest teaching win in the session.

### A3. [Already ships] The WaniKani re-queue model

Riyaz asked for "the review doesn't end until every item is answered correctly."
**This is already built** — `ReviewSessionProvider.tsx:101` says so in a comment:

- Wrong answers append to `retryItems` at the **tail**, so the maximum number of
  other items intervene before the re-ask (prevents pattern-matching off the reveal)
- `isComplete` is true only when the working queue **including retries** is exhausted
- Retry cards are pedagogical: they write no grade, no weakness outcome, no load

**Consequence: the work is much narrower than it looked.** The only missing piece is
that one item still emits one card per review — `resolvePromptType`
(`promptResolver.ts:20`) picks meaning *or* reading by rep parity.

Confirmed with Riyaz: only the **failed** card re-queues, not both. WK behaviour.

### A4. [Decided] Two cards, one SRS state — worst-of-both, applied once

Two cards against a single `srs_states` row is the real architectural question.

| Option | Model | Verdict |
| --- | --- | --- |
| A | Grade each card independently as answered | **Rejected.** Meaning-pass-then-reading-fail promotes then demotes; FSRS sees two reviews and the stability math is distorted. |
| B | **Hold both, apply one grade, worst-of-both** | **Chosen.** One FSRS update per item per session. Pairing bookkeeping in the provider, no schema change. |
| C | Separate SRS state per prompt type | **Rejected.** Schema change (`srs_states` keyed on `(item_id, prompt_type)`) for something WK does not actually do. |

_Why B is genuinely WaniKani_: WK shows meaning and reading as separate cards, but
the kanji carries a **single** SRS level that is decremented once based on how many
parts were missed. C resembles WK from the outside and diverges underneath.

### A5. [Accepted cost] Session length roughly doubles

12 kanji becomes 24 cards, and kanji-bearing vocabulary gets the same treatment.
Compounds with Phase B, which removes auto-advance. **Riyaz accepted this
explicitly** — he already works this way in WaniKani.

## Phase B — Post-answer pacing and reveal

Points 1 and 2 are the same moment in the flow, so they were taken together.

### B1. [Decided] Enter advances; auto-advance becomes opt-in

The answer was already written in a comment at `index.tsx:466`:

> _"the input must stay mounted and autofocus-ready so the review loop stays
> keyboard-driven with zero added taps per item."_

The input is mounted and focused while feedback shows. So **Return advances** —
Return to submit, Return again to continue. Zero added taps.

This is WaniKani's default; their auto-advance is opt-in and called Lightning Mode.

| | Decision |
| --- | --- |
| Correct answer | Waits for Return. No timer. |
| `REVIEW_CORRECT_AUTO_ADVANCE_MS` (800ms) | Kept as an opt-in setting, off by default |
| MC grammar cards | Need a visible Continue button — no keyboard to press Return on |

_Why a button was rejected for typed cards_: A5 doubles the card count. A Continue
button costs a real reach-to-screen per card; at 24+ cards that is the difference
between a flow and a chore. Return costs nothing.

**Carry-over constraint:** the grade is currently deferred behind the auto-advance
timer and flushed on unmount (`flushPendingGrade`, `index.tsx:117`). With an
indefinite wait that flush contract must survive, or ending a session on a correct
answer silently loses the grade.

### B2. [Decided] Inline reveal panel — reading and meaning only

`IncorrectReveal` already renders meaning, alternates, on'yomi/kun'yomi split,
mnemonic, and examples, with detail prefetched for the current item *and* the
lookahead buffer (`useReviewRevealDetails`). Showing it on the correct path costs
roughly a prop.

**Riyaz trimmed the scope in both directions:**

- **Correct path** — gains the panel, collapsed behind an icon
- **Panel contents** — **reading and meaning only**. Mnemonic and examples come
  *out*, including from the incorrect path where they render today.
- Anything deeper is a deliberate trip to the details page

_Work_: extract the panel from `IncorrectReveal` into a shared `AnswerReveal`
consumed by both states, and drop the mnemonic and example sections.

**Interaction with A2:** a `wrong_reading_type` nudge can point straight at the
on'yomi/kun'yomi split the panel already renders — the correction and the reference
land in the same place.

### B3. [Decided] Details link on the incorrect path, routed under `review/`

On an incorrect answer only, a link to the full details page.

**Riyaz's question — "doesn't push/back just work?" — checked, and it does not.**
`_layout.tsx:46-52` puts `review` in the root `Stack` as a `fullScreenModal`
**sibling** of `(tabs)`, with `(tabs)` already below it. So `/learn/item/[id]` does
not push a new screen — React Navigation pops back to the `(tabs)` screen already in
the stack, unmounting `review/_layout.tsx` and the session provider with it. And
`usePreventRemove` (`index.tsx:103`) intercepts first, so the user gets an
"End session?" sheet instead of the details page.

Push-then-back works when the target is inside the same stack. It is not.

| Option | Approach | Verdict |
| --- | --- | --- |
| **A** | Mount the detail screen at a route **under `review/`** | **Chosen.** Session survives, back returns to the card, one route file. |
| B | Leave review entirely, restore the session on return | Rejected — needs session state persisted for no gain. |

_Note_: the details-page session already decided to split lesson composition from
details composition. The review-nested detail route becomes a **third** consumer of
those components — worth confirming that split accounts for it.

## Phase C — Session progress and confusion detection

### C1. [Decided] Progress counts cards, not items

`SessionHeader` shows `{displayNumber} of {totalItems}` where `currentIndex` is
`retiredCount` — distinct items answered correctly at least once — and `totalItems`
is `queue.length`.

**The A4 change breaks this.** With two cards per item, an item retires only when
both pass. Since the queue interleaves, the two cards for one item are far apart, so
the counter sits near 0 through the first half of the session and then jumps.

**Decided: count cards.** Cards are the unit of work the user actually experiences.

**How WaniKani avoids the same problem** (asked directly by Riyaz): WK counts
**down** — "42 reviews remaining" — so a subject that stalls until both cards pass
never reads as stuck at zero; the number simply moves less often than expected. The
difference is direction, not unit. This header counts *up* from 0, which is exactly
where the stall becomes visible.

_Honest limit_: no reliable data on whether WK users are actually annoyed by the
stall — the structural difference is the defensible part, the sentiment is not.
A remaining-count would fix the stall equally well if matching WK is preferred later.

### C2. [Decided] Confusion detection links out rather than expanding the panel

Carried from `brainstorming-session-2026-07-19-1322-learn-page.md` (A7): if a wrong
answer exactly matches **another item's** accepted answer, the collision itself
identifies the confusion — no curated lookalike dataset needed. Answer 持 with
"wait" and the app already knows "wait" belongs to 待.

**The conflict:** A7 planned a side-by-side comparison rendered inline on the review
reveal. B2 trimmed that panel to reading and meaning only.

**Riyaz's resolution — the panel stays minimal:**

1. Mark the answer **incorrect** as normal
2. Add one line: what you answered belongs to a different kanji
3. Offer a link to the comparison
4. The link opens the details page **with both items preselected**

_Why this is the right call_: it keeps B2's minimal panel intact, and it gives the
comparison a full screen instead of a cramped inline block — comparison is exactly
the feature that needs room. It also converts a review-page feature into something
that **complements** the details page rather than duplicating it.

**Consequences to carry back to the details-page session:**

- The details page must **accept two items** as input, not one — the Compare picker
  (Feature #2 there) needs to support preselection via route params rather than
  always starting from the user's own search.
- That route must live **under `review/`** when entered from a review (B3), so the
  comparison screen needs to work from two entry points.

## Idea Organization and Prioritization

### Bugs found

| # | Bug | Where |
| --- | --- | --- |
| 1 | **Any kanji reading is accepted on a reading prompt.** All `readings[]` rows are flattened into one `acceptedReadings` array, so on'yomi and kun'yomi are interchangeable. The app never checks which it asked, because it never asks for a specific one. | `useReviewQueue.ts:81-84` |
| 2 | **Progress counter will stall at 0** once A4 lands — items retire only when every card passes, and the queue interleaves them. Not yet broken; broken by the A4 change. | `SessionHeader.tsx:27` |

### Themes

**Theme 1 — The flow already had the model; it just wasn't finished.**
The WaniKani re-queue (A3), the keyboard-driven loop (B1), the reveal panel (B2) and
the prefetch that makes the panel free — all shipping. Three of the session's
decisions were about *connecting* existing pieces, not building new ones. The single
genuinely new mechanic is two cards per item (A4).

**Theme 2 — Typed data flattened at the boundary.**
The curriculum carries `reading_type` on every reading; the queue builder discards it
one function before the evaluator needs it. Same shape as the parallel sessions'
"shipping data with no UI" theme — here it's shipping data destroyed in transit.

**Theme 3 — The reveal is a teaching surface, and space is contested.**
B2 trimmed it to reading and meaning. A2's `wrong_reading_type` nudge and C2's
confusion hit both want to teach at that moment. Resolved consistently: teach in one
line, link out for depth. The panel stays small.

**Theme 4 — Navigation is the binding constraint on the whole page.**
`review` is a `fullScreenModal` sibling of `(tabs)`, so anything that routes to the
tab tree destroys the session. This shaped B3 and C2 and would silently break any
future "just link to it" idea. Worth writing down somewhere more permanent than a
brainstorm.

### Breakthrough concepts

**D1 — The contradiction was in the request, and the data settled it.**
Point 3 asked for on'yomi *and* kun'yomi on the kanji card, and also for kun'yomi to
be paired with vocabulary. Those are incompatible, and WaniKani deliberately chooses
the second. The curriculum already supports it: 51 of 79 single-kanji vocabulary
items carry their kanji's kun'yomi, and the 28 exceptions are numbers, which
genuinely read on'yomi standalone.

**D2 — "Wrong reading type" is a third `wrong_script`.**
The non-terminal feedback family (`typo`, `wrong_script`) already models "you erred
in a way that isn't a knowledge failure" — no grade, no weakness signal, re-prompt
with a nudge. The largest teaching win in the session costs one new member of an
existing family.

**D3 — Return costs nothing; a button costs 24 reaches.**
Removing auto-advance looked like it had to add a tap. The input is already mounted
and focused (a comment at `index.tsx:466` says so explicitly), so Return advances for
free. This only became obvious *after* A5 doubled the card count made the per-card
cost of a button visible.

**D4 — Worst-of-both grading protects the cognitive-load tracker for free.**
Load is computed per graded item (`computeLoadIncrement`). Option A — grading each
card independently — would have doubled daily load increments and tripped the
"enough for today" notice twice as fast. Option B was chosen for FSRS correctness;
it happens to preserve load pacing as well.

### Build order

Ordered by rework avoidance, following the parallel sessions' precedent (Riyaz ships
everything, so ranking by value would be the wrong axis).

| # | Work | Size | Why here |
| --- | --- | --- | --- |
| 1 | **B1** — Return advances; 800ms becomes an opt-in setting; Continue button for MC cards | S | Independent, immediately felt, and preserves `flushPendingGrade` |
| 2 | **B2** — extract `AnswerReveal` from `IncorrectReveal`, trim to reading + meaning, show on the correct path | S | Independent, and C2 needs the extracted component |
| 3 | **A1 + A2** — prompt names the reading type, on'yomi only on kanji cards, `wrong_reading_type` non-terminal state | M | Fixes Bug 1. A2 needs A1: rejecting the wrong type requires having asked for a type. |
| 4 | **A4 + C1** — two cards per item, worst-of-both grading applied once, card-based progress | L | The structural change. C1 must ship with it or Bug 2 goes live. |
| 5 | **B3** — details route mounted under `review/` | M | Blocked on the details-page session's component split (#3 there) |
| 6 | **C2** — confusion detection + comparison deep-link with two preselected items | L | Blocked on the comparison component (#7 in the details-page session) |

**Cross-session dependencies:** items 5 and 6 are gated by the details-page session's
build order, not by anything here. Items 1–4 are self-contained and can start
immediately.

## Session Summary and Insights

**Key achievements**

- One live bug found and specified: any kanji reading accepted on a reading prompt
- One latent bug caught before it shipped: the progress counter stalling under A4
- A contradiction inside the original request surfaced and resolved against real
  curriculum data rather than preference
- The largest requested feature — "the review doesn't end until everything is
  correct" — found **already shipping**, shrinking the work substantially
- Every decision that wanted screen space in the reveal was resolved the same way:
  one line of teaching, link out for depth

**Session reflections**

- **Checking the code changed the conclusion three times**, consistent with both
  parallel sessions: the re-queue model already existed, the navigation assumption
  was wrong, and the auto-advance concern was one branch rather than the whole flow.
- **The user's instinct was right and his stated requirement was wrong**, in the same
  message (D1). Pairing kun'yomi with vocabulary was correct; asking both readings on
  the kanji card contradicted it. Worth listening for that pattern again.
- **A facilitation failure worth recording:** responses ran long enough that Riyaz
  stopped the session to call it out — the fourth time across sessions, with the
  preference already in memory. The correction that stuck: depth belongs in this
  file, and the chat message carries only the recommendation and the question.
- **Riyaz's corrections were again scope-narrowing** — reading and meaning only in
  the panel, link out instead of expanding, no mnemonic or examples. Same instinct as
  both prior sessions, and it was right every time.
</content>
