# SRS system vs. WaniKani

Reference note on how this app's spaced-repetition system works and how it compares to
WaniKani's. Written 2026-08-24 from a codebase audit; not a plan, not tracked in
[working-history.md](./working-history.md).

## This app's SRS system

Built on **FSRS** (via the `ts-fsrs` library), with a 5-stage label system layered on top,
modeled on WaniKani. Config: `mobile/src/core/srs/fsrsScheduler.ts`.

**Review priority** (queue ordering, not stage timing) is:

```
priority = 0.7 × FSRS urgency + 0.3 × weakness score
```

- FSRS urgency: how overdue an item is, normalized to `[0,1]` over a 7-day window
  (`mobile/src/core/srs/weaknessEngine.ts`).
- Weakness score: wrong-answer rate, only counted once an item has 3+ reviews
  (typos excluded from the miss count).

### Stages

Defined by FSRS "stability" (days until ~90% recall), not by a fixed timer:

| Stage | Stability range | Typical time to reach it |
| --- | --- | --- |
| Apprentice | New/Learning, or Review with stability < 7 days | Starting stage. One 10-min learning step, then first real interval |
| Guru | 7 – 21 days | ~1–3 weeks in, after 2–3 correct reviews |
| Master | 21 – 120 days | ~1–4 months in |
| Enlightened | 120 – 365 days | ~4–12 months in |
| Burned | ≥ 365 days | ~1 year+ (sticky — once burned, stays burned even if stability is later recalculated lower) |

A wrong answer resets stability downward (FSRS `Again`/`Hard` grades), so real time to
level up varies with how often an item is missed. There's no fixed day-count per stage —
FSRS grows the interval from the item's own recall history.

### What each stage gates

- **Guru+** → item counts as "known" for kanji; contributes to the ≥90% Guru+ coverage
  needed to unlock a reading passage (`mobile/src/core/content/passageUnlock.ts`)
- **Master+** → vocab furigana auto-hides
- **Enlightened+** → English hints removed in grammar drills (`mobile/src/core/grammar/inputMode.ts`)

### Source references

- `mobile/src/core/srs/fsrsScheduler.ts` — FSRS config, stage-boundary constants, stage mapping
- `mobile/src/core/srs/weaknessEngine.ts` — priority formula, weakness score
- `mobile/src/core/srs/queueBuilder.ts` — priority applied to queue sort
- `mobile/src/core/import/fsrsConverter.ts` — WaniKani/Bunpro/Anki stage import mapping
- `mobile/src/data/user/masteryRepository.ts` — `KNOWN_SRS_STAGES`, `MASTERED_SRS_STAGES`
- `docs/feedback/01-srs-scheduling-correctness.md` — design rationale, names the app "a WaniKani-style app"
- `docs/feedback/08-grammar-stage-ladder.md` — input-mode ladder by stage
- `CLAUDE.md`, `docs/app-overview.md` — one-line summaries of the formula and Guru+ unlock rule

### Item-level, not account-level

There is no single WaniKani-style account "level" number that gates content unlocking
across the whole user. Each item (radical/kanji/vocab/grammar) has its own FSRS stability
value and a derived stage label. A "level progress bar" on Home
(`docs/app-overview.md`) is a separate curriculum-progress concept, not an SRS stage.

## WaniKani's levels and timing

WaniKani has 9 SRS stages per item, each with a **fixed** wait time (not adaptive):

| Stage | Wait until next review |
| --- | --- |
| Apprentice 1 | 4 hours |
| Apprentice 2 | 8 hours |
| Apprentice 3 | ~1 day |
| Apprentice 4 | ~2 days |
| Guru 1 | ~1 week |
| Guru 2 | ~2 weeks |
| Master | ~1 month |
| Enlightened | ~4 months |
| Burned | final — no more reviews |

WaniKani also has **60 account levels**. A user levels up once enough kanji at their
current level reach Guru 1.

- Minimum possible time per level (perfect answers, instant reviews): ~3 days 5 hours
- Typical real-world pace: ~7–10 days per level
- Full 60-level run: ~14–18 months average for consistent daily users; under a year for
  speed-runners; 2–3+ years for casual learners

## Key difference

WaniKani's stage timers are fixed regardless of how well an item is known. This app's
stages are driven by FSRS stability, so a well-known item can advance faster and a shaky
one gets held back — closer to true spaced repetition than WaniKani's lockstep ladder.
