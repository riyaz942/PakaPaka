# User feedback → focused plans

Analysis of playtest feedback and follow-on design sessions, grouped into focused plans. Each plan is grounded in the actual code and lists concrete changes, acceptance criteria, and files touched.

**Status of these plans lives in [../working-history.md](../working-history.md)**, not here — this page is the index and sequencing.

Plans **01–06** came from the first playtest pass. Plans **07–10** came from the [2026-07-11 grammar review brainstorm](../../_bmad-output/brainstorming/brainstorming-session-2026-07-11-1800.md). Their cloze review was replaced on 2026-10-13 by [Grammar Read + Build SRS](../superpowers/specs/2026-10-13-grammar-read-build-srs-design.md), so they are in [../archive/](../archive/README.md).

## Plans

| # | Plan | Priority | Feedback / source |
|---|------|----------|-------------------|
| [01](01-srs-scheduling-correctness.md) | SRS scheduling correctness | **P0** | Intervals never grow; stage never upgrades |
| [02](02-review-session-mechanics.md) | Review session mechanics | P1 | Re-ask wrong items until correct; show stage transition |
| [03](03-answer-validation-and-feedback.md) | Answer validation & feedback | P1 | Full detail on wrong answer; no reading for kana vocab; wrong-script hint; multiple meanings; user-added answers |
| [04](04-lesson-pacing-and-grammar-coverage.md) | Lesson pacing & grammar coverage | P1 | Daily lesson cap; no grammar lessons/SRS |
| [05](05-session-ux-polish.md) | Session UX polish | P2 | Streak animation; remove "8 min across apps"; lesson back/forward; hide mnemonic |
| [06](06-ui-navigation-and-polish.md) | UI navigation & polish | P0–P3 | Coloured nav header + status bar; back icon; keyboard covers mnemonic input; Save button contrast; Learn detail can't scroll; auto-hide chrome on scroll |
| 07–10 | Grammar cloze review (archived) | — | Replaced by [Grammar Read + Build SRS](../superpowers/specs/2026-10-13-grammar-read-build-srs-design.md). Plans: [07 overview](../archive/07-grammar-review-overview.md) · [07](../archive/07-grammar-cloze-contract.md) · [08](../archive/08-grammar-stage-ladder.md) · [09](../archive/09-grammar-cloze-curriculum.md) · [10](../archive/10-grammar-hints-and-nearmiss.md) |
| [11](11-lesson-content-order-navigation-and-grammar-furigana.md) | Lesson content order, navigation & grammar furigana | P0–P2 | Content order; duplicate radical mnemonic; swipe between cards; word lookup; detail pages must stack; grammar review furigana |
| [12](12-android-playtest-round-2.md) | Android playtest round 2 | P0–P3 | Status bar unreadable; refresher opens "No Reviews Due"; prompt disappears on correct/typo; abrupt feedback; forecast detail; remove "separate apps" claim |
| [13](13-vacation-mode.md) | Vacation mode | — | WaniKani-style pause; due dates shift forward on resume; closes goal-ring O4 |
| [14](14-conjugated-form-linking-and-furigana-gesture.md) | Conjugated-form linking & furigana gesture | — | 来ます should link to 来る (hero note + conjugated-forms section); tap = details, long-press = hide/show furigana |
| [15](15-chatbubble-word-linking-and-furigana-toggle.md) | ChatBubble word linking & furigana toggle | — | Split out of 14: per-word linking + gesture split for AI chat replies (Talk tab) — **done**, boundaries come from the reply's own furigana brackets |

## Suggested sequencing

### Playtest cluster (01–06)

1. **Plan 01** — nothing about the SRS or stage feedback is testable until this lands. Do it first, alone.
2. **Plan 04 §4.1** (grammar starvation) — a one-file, high-impact fix; land it early and independently.
3. **Plan 03** — the validation cluster; §3.1/§3.2/§3.4 are quick wins, §3.3/§3.5 are larger.
4. **Plan 02** — the in-session re-queue; builds on Plan 01's now-working stage transitions.
5. **Plan 04 §4.2** (daily cap) and **Plan 05** — polish, parallelizable, each item ships alone.

## Decisions — all resolved

- **Plan 14** (2026-08-10) — expand passage `vocabulary_slugs` to include conjugation-only words, accepting the ≥90% Guru+ unlock bar moving on affected passages. Shipped. ChatBubble per-word linking/furigana toggle was split out into [Plan 15](15-chatbubble-word-linking-and-furigana-toggle.md), also shipped.
- **Plan 05 §5.1** — resolved: the time-compression display was removed, along with post-session sharing (see [Plan 12.7](12-android-playtest-round-2.md)).
- **Plan 02 Q1** — one FSRS card per item, or one per (item, prompt type)? Closed without the DB split: two-card kanji grading (worst-of-both) delivered the WaniKani "meaning *and* reading" behaviour without splitting `srs_states`.

The brainstorm's grammar matrix (cloze, MC → type-in ladder, hints) is retired. Grammar review decisions now live in the [Read + Build spec](../superpowers/specs/2026-10-13-grammar-read-build-srs-design.md).

## Relationship to BMAD

Plans 01–15 came from playtesting, ahead of the BMAD story pipeline. Most have since been absorbed by
wave-2 stories (see [`_bmad-output/README.md`](../../_bmad-output/README.md)). All of them are done;
status is in [../working-history.md](../working-history.md).
