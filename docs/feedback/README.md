# User feedback → focused plans

Analysis of the 13 feedback items from playtesting, grouped into five plans. Each plan is grounded in the actual code as of this branch (file:line references throughout) and lists concrete changes, acceptance criteria, and files touched.

The headline finding: the SRS engine has a real correctness bug (learning-step index is discarded on every review), which explains *both* the "same items every 10 minutes" complaint *and* the "everything is stuck at Apprentice" complaint. That is Plan 01 and everything else waits behind it.

## Plans

| # | Plan | Priority | Feedback items |
|---|------|----------|----------------|
| [01](01-srs-scheduling-correctness.md) | SRS scheduling correctness | **P0** | Intervals never grow; stage never upgrades |
| [02](02-review-session-mechanics.md) | Review session mechanics | P1 | Re-ask wrong items until correct; show stage transition |
| [03](03-answer-validation-and-feedback.md) | Answer validation & feedback | P1 | Full detail on wrong answer; no reading for kana vocab; wrong-script hint; multiple meanings; user-added answers |
| [04](04-lesson-pacing-and-grammar-coverage.md) | Lesson pacing & grammar coverage | P1 | Daily lesson cap; no grammar lessons/SRS |
| [05](05-session-ux-polish.md) | Session UX polish | P2 | Streak animation; remove "8 min across apps"; lesson back/forward; hide mnemonic |

## Suggested sequencing

1. **Plan 01** — nothing about the SRS or stage feedback is testable until this lands. Do it first, alone.
2. **Plan 04 §4.1** (grammar starvation) — a one-file, high-impact fix; land it early and independently.
3. **Plan 03** — the validation cluster; §3.1/§3.2/§3.4 are quick wins, §3.3/§3.5 are larger.
4. **Plan 02** — the in-session re-queue; builds on Plan 01's now-working stage transitions.
5. **Plan 04 §4.2** (daily cap) and **Plan 05** — polish, parallelizable, each item ships alone.

## Two decisions that need the product owner

- **Plan 02 Q1** — one FSRS card per item, or one per (item, prompt type)? The WaniKani "meaning *and* reading" model the feedback describes needs the split. Recommended as a follow-on story, not a blocker.
- **Plan 05 §5.1** — removing the time-compression display deletes a documented PRD differentiator. The feedback is clear, but confirm before deleting.

## Not yet reconciled with BMAD

These plans describe changes to code that already exists but is ahead of `CLAUDE.md`'s status table and `_bmad-output/sprint-status.yaml` (Epics 5/6 are marked backlog there but are substantially implemented on this branch). If this work goes through the BMAD story pipeline, these plans are the raw material for `correct-course` / new story files, not a replacement for them.
