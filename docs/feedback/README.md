# User feedback → focused plans

Analysis of playtest feedback and follow-on design sessions, grouped into focused plans. Each plan is grounded in the actual code and lists concrete changes, acceptance criteria, and files touched.

Plans **01–06** came from the first playtest pass. Plans **07–10** come from the [2026-07-11 grammar review brainstorm](../../_bmad-output/brainstorming/brainstorming-session-2026-07-11-1800.md) — see the [grammar review overview](07-grammar-review-overview.md).

## Plans

| # | Plan | Priority | Feedback / source |
|---|------|----------|-------------------|
| [01](01-srs-scheduling-correctness.md) | SRS scheduling correctness | **P0** | Intervals never grow; stage never upgrades |
| [02](02-review-session-mechanics.md) | Review session mechanics | P1 | Re-ask wrong items until correct; show stage transition |
| [03](03-answer-validation-and-feedback.md) | Answer validation & feedback | P1 | Full detail on wrong answer; no reading for kana vocab; wrong-script hint; multiple meanings; user-added answers |
| [04](04-lesson-pacing-and-grammar-coverage.md) | Lesson pacing & grammar coverage | P1 | Daily lesson cap; no grammar lessons/SRS |
| [05](05-session-ux-polish.md) | Session UX polish | P2 | Streak animation; remove "8 min across apps"; lesson back/forward; hide mnemonic |
| [06](06-ui-navigation-and-polish.md) | UI navigation & polish | P0–P3 | Coloured nav header + status bar; back icon; keyboard covers mnemonic input; Save button contrast; Learn detail can't scroll; auto-hide chrome on scroll |
| [07 overview](07-grammar-review-overview.md) | Grammar review redesign | — | Index for 07–10; locked cloze matrix |
| [07](07-grammar-cloze-contract.md) | Grammar cloze contract | **P0** | Kill は→は; universal JP cloze |
| [08](08-grammar-stage-ladder.md) | Grammar stage ladder | P1 | MC → type-in; Enlightened no-English |
| [09](09-grammar-cloze-curriculum.md) | Cloze variants & families | P2 | Schema, 5 variants, family distractors |
| [10](10-grammar-hints-and-nearmiss.md) | Grammar hints & near-miss | P1 | Nudge→EN hints; incomplete = incorrect |

## Suggested sequencing

### Playtest cluster (01–06)

1. **Plan 01** — nothing about the SRS or stage feedback is testable until this lands. Do it first, alone.
2. **Plan 04 §4.1** (grammar starvation) — a one-file, high-impact fix; land it early and independently.
3. **Plan 03** — the validation cluster; §3.1/§3.2/§3.4 are quick wins, §3.3/§3.5 are larger.
4. **Plan 02** — the in-session re-queue; builds on Plan 01's now-working stage transitions.
5. **Plan 04 §4.2** (daily cap) and **Plan 05** — polish, parallelizable, each item ships alone.

### Grammar review cluster (07–10)

1. **Plan 07** — cloze contract (stop tautological particle prompts).
2. **Plan 08 + Plan 10** in parallel — stage input modes and hint/near-miss UX.
3. **Plan 09** in parallel for schema + Wave A content; swap interim cloze derivation when variants ship.

## Two decisions that need the product owner

- **Plan 02 Q1** — one FSRS card per item, or one per (item, prompt type)? The WaniKani "meaning *and* reading" model the feedback describes needs the split. Recommended as a follow-on story, not a blocker.
- **Plan 05 §5.1** — removing the time-compression display deletes a documented PRD differentiator. The feedback is clear, but confirm before deleting.

Grammar matrix decisions from the brainstorm are **locked** (see overview); reopen only with a fresh stress-test.

## Not yet reconciled with BMAD

These plans describe changes to code that already exists but is ahead of `CLAUDE.md`'s status table and `_bmad-output/sprint-status.yaml` (Epics 5/6 are marked backlog there but are substantially implemented on this branch). If this work goes through the BMAD story pipeline, these plans are the raw material for `correct-course` / new story files, not a replacement for them.
