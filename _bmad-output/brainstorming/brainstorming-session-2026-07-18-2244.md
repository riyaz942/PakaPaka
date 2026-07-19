---
stepsCompleted: [1]
inputDocuments: []
session_topic: 'Home screen redesign — information architecture, goal ring, entry points, history & forecast sections'
session_goals: 'Pressure-test and expand the initial six-point list; generate new ideas; leave with refined per-section direction rather than a flat feature list. Bugs captured, not fixed.'
selected_approach: 'AI-Recommended'
techniques_used: []
ideas_generated: []
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Riyaz
**Date:** 2026-07-18

## Session Overview

**Topic:** Home screen (`mobile/src/app/(tabs)/index.tsx`) redesign. First in a planned per-page series.

**Goals:** Interrogate and expand the initial six-point list; surface ideas not yet had; produce refined direction per section. Bug capture is in scope; bug fixing is not.

### Codebase Grounding

Established before ideation began:

- **The "activity circle" is not a progress ring.** `CognitiveLoadRing.tsx` renders a full circular *border* whose colour shifts by band (start/mid/end/complete) with a `%` in the centre. No arc, no sweep, no fill. Hard-clamped to 100 in three places: `loadTracker.ts:computeLoadPercent`, `CognitiveLoadRing.tsx:22`, `CognitiveLoadRing.tsx:36`. `accessibilityRole="progressbar"` with `max: 100`.
- **Current framing is a ceiling, not a goal.** Copy reads "Today's load — your study capacity for today." Fitness rings are a *goal* metaphor. Overshoot only makes sense in the goal framing. → **Resolved in favour of goal framing.**
- **The reframe is nearly free at the data layer.** `computeLoadPercent(load, threshold)` already computes "effort done today ÷ today's adaptive goal". Same numerator, same denominator — opposite story.
- **Adaptive goal logic already exists.** `thresholdCalculator.ts`: `adapted = 0.65 × base + 0.35 × rollingAvg`, clamped to `[COGNITIVE_LOAD_THRESHOLD_MIN=20, COGNITIVE_LOAD_THRESHOLD_MAX=90]`, over a rolling window of prior daily loads.
- **Lessons contribute zero to the ring.** `addDailyLoad` is called from exactly one site — `ReviewSessionProvider.tsx:283`. Nothing in the lesson flow touches it. Ten lessons and no reviews currently leaves the ring at 0%.

### Session Setup

Approach: **AI-Recommended techniques**. Planned sequence, chosen to jump creative domains and avoid semantic clustering:

1. **Assumption Reversal** *(deep)* — invert the hidden premise of each of the six list items before adding to the list.
2. **Analogical Thinking** *(creative)* — mine fitness apps plus non-obvious donors (weather forecasts, calendars, cockpits, Git contribution graphs).
3. **Persona Journey** *(theatrical)* — day-1, day-40, day-400-returning-after-a-month. Home screens fail at empty state and at saturation.
4. **Anti-Solution** *(wild)* — design the maximally demotivating home screen to surface streak anxiety, guilt loops, forecast dread.

---

## Decisions Made

| # | Decision | Rationale |
|---|---|---|
| D1 | **Ring reframes from capacity/ceiling → goal.** | Overshoot is only coherent under a goal metaphor. Fitness-app mental model is what the user wants. |
| D2 | **Ring fills from lessons *and* reviews.** | User intent: "fills up as you study/do review". Requires a new `addDailyLoad` call site in the lesson flow. |
| D3 | **Ring may overshoot past 100%.** | Requires removing three clamp sites and revising a11y semantics away from `progressbar`/`max:100`. |
| D4 | **Adaptive goal: weekly cadence, ratchet-biased, with an explicit prompt.** | Market scan (below): nobody silently moves a goal daily except Garmin Auto Goal, the one users disable. Goal should rise readily, fall slowly and only after sustained absence, and be *announced* rather than moved underneath the user. **Confirmed after pressure-testing.** |
| D5 | **Remove `COGNITIVE_LOAD_THRESHOLD_MAX` — the goal has no ceiling.** Goal auto-adjusts per D4, and is **user-configurable in Settings** with no upper bound. | Surfaced by the Taro persona: `MAX = 90` meant a committed user sits at 300% permanently, turning the ring from a goal into a participation trophy. The ceiling was sane under the *capacity* framing (don't tell someone their safe capacity is unbounded) but is actively harmful under the *goal* framing (D1). Users may set the bar well beyond what they think they're capable of. |

### Reference: how fitness apps set goals

Recalled, directionally right rather than spec-accurate — these UIs churn.

| App | Model |
|---|---|
| Apple Fitness | User sets Move goal. Since watchOS 9/10 suggests a new one weekly from last week's data, but **prompts to accept or edit**. Never silently changes. |
| Garmin | "Auto Goal" adapts daily, up *and* down. Most-complained-about, most-disabled. |
| Fitbit / Google Fit | Manual targets, sensible defaults (10k steps, 30 heart points). Essentially non-adaptive. |
| Whoop / Oura | Fully adaptive daily targets from a physiological model. Not configurable by design — the model *is* the product. |

**Pattern to steal:** nobody silently moves your goal daily. Adapt on a weekly cadence with an explicit prompt. Note the app sits closer to Whoop in *spirit* (a real cognitive-load model — a genuine differentiator most learning apps lack) but closer to Apple in *use case* (daily motivation).

---

## Bug & Defect Log

| ID | Severity | Description | Lead |
|---|---|---|---|
| B1 | Open | Home screen metrics do not refresh after completing a lesson or review. Navigating to another tab and back updates them. | `index.tsx:153-159` deliberately skips the *first* focus event via `isInitialFocusRef`, with the mount effect at `:139` covering initial load. If home never blurs when `/lesson` pushes over it — or is remounted on return — the skip lands on the wrong event, producing exactly this symptom. |
| B2 | Open | Ring shows 0% for a user who completes lessons but no reviews. | `addDailyLoad` has a single call site, `ReviewSessionProvider.tsx:283`. Lesson flow never records load. Overlaps with D2. |

---

## Design Principles

| # | Principle | Origin |
|---|---|---|
| P1 | **User agency over lesson-vs-review is non-negotiable.** The user decides the mode; the system does not decide for them. | Defended twice under Assumption Reversal (inversions 3 and 4). The app is already paternalistic — throttles lessons by backlog, caps daily items — so removing mode choice is one paternalism too many. |
| P2 | **The home screen offers, it never starts.** No autoplay, no inline answering, no "here's your next card". | Corollary of P1. Rules out a class of nudge patterns by default. |
| P3 | **Home is forward-looking.** Every element answers "what do I do now", not "what did I do". Backward-looking content belongs in Stats. | Emerged from inversion 5 — the weakness of "recently learned" was tense, not position. |
| P4 | **Intrinsic motivation only.** Offline-first, no accounts, no subscriptions eliminates every social motivator — leaderboards, friends, comparison, sharing. | Existing product constraints. |

---

## Technique 1 — Assumption Reversal

Six list items, premises inverted. Outcomes:

| # | Item | Inversion proposed | Outcome |
|---|---|---|---|
| 1 | Streak | Don't show a streak; show accumulating "days studied this month" instead of fragile consecutive days | **Accepted.** Streak removed from home entirely. Days-this-month moves to Stats/Analytics. Rationale: streak motivation runs on loss aversion and is a leading cause of language-app churn. |
| 2 | Activity ring | Ring should not be the hero | **Rejected.** Ring stays hero, shrunk somewhat. CTAs sit directly below it and remain visible. Cheap to do — `CognitiveLoadRing` already takes a `variant`; tune `hero: 144`. |
| 3 | Learn button | Single "Study" button; planner decides the mix | **Rejected → became P1.** Fails the real case: "I don't want new material today, just clear my backlog." |
| 4 | Review button | Reviews come to you — first card inline, answering starts the session | **Rejected → became P2.** User control over whether to engage at all. |
| 5 | Recently learned | History doesn't belong on home | **Reframed, not relocated.** The problem was tense, not position (→ P3). Recast from *recent* → **at-risk**: "these items keep tripping you up." Same data, same list UI, same tap-through, now forward-looking and actionable. |
| 6 | Forecast | Show only tomorrow, not five days | **Rejected — user's reasoning was stronger.** Extended to a **full week**, WaniKani-style. A week enables planning and, critically, exposes "the wall" — the day a spike lands — which is actionable because you can go light on lessons now to soften it. |

---

## Home Screen Composition (settled)

A structural distinction surfaced mid-session: the accepted ideas are not all the same *kind* of thing. Home is **not a list of sections** — it is a set of permanent sections plus conditional content that surfaces only when relevant.

This explains why `ShadowModeSwitchPrompt` (`index.tsx:282`) currently feels bolted on: it is a conditional living inside a permanent list.

A third category — *threshold-gated* sections that appear once enough data accrues — was proposed and **rejected** in favour of permanent sections with **designed empty states**. Simpler, and it means the screen's shape never changes underneath the user.

### Permanent sections

Always rendered, including day 1, with a deliberate empty state where data is absent.

| Section | Notes |
|---|---|
| **Header greeting** | `おかえり！` retained. Subtitle replaced with a **fully-comprehensible sentence** (I4). Zero new real estate; the greeting starts doing work. |
| **Goal ring** | Reframed per D1–D5. Shrunk from current `hero: 144`. |
| **Learn CTA** | Retained per P1. |
| **Review CTA** | Retained per P1. Later gains paragraph-reading once grammar/vocab coverage allows. |
| **Forecast** | One week. Wall warning folded in as an annotation on the heavy day (I1), not a separate section. Empty state required for day 1. |
| **Reading readiness** | I9. Empty state required for day 1. |

### Conditional content

| Item | Appears when |
|---|---|
| **At-risk / leeches** | Items are actually at risk. Substantial section (list + CTA), not a banner — does not compete for the banner slot. |
| Welcome-back triage (I7) | Returning after an absence. |
| Curriculum update banner (I13) | An OTA update is available. |
| Shadow-mode switch prompt | Existing logic. |
| Import nudge (I14) | User hasn't imported WaniKani/Bunpro history. |

### At-risk section — settled design

- Show the **count** plus the **top 5–10** items, then an ellipsis / "+N more".
- Tapping the section opens a **modal or dedicated page** with the full list.
- A CTA — *"Do a small revision of these items"* — appears both in that view **and** inline in the home section, so the user can act without drilling in.
- **Selection rule:** combine **worst-performing** and **closest to dropping a stage**. Show both signals rather than picking one.

---

## Ideas Generated

Fourteen candidates offered under "what else could go on the home screen", spanning deliberately orthogonal domains.

| ID | Idea | Status |
|---|---|---|
| I1 | **Wall warning** — forecast flags the spike day with advice: *"Thursday is heavy — 180 due. Go light on lessons today."* Turns information into advice. | **Accepted** — folds into Forecast as an annotation, not its own section. |
| I2 | **Next unlock** — *"3 more kanji to Guru and 見る unlocks."* Leverages the `curriculum.db` dependency graph; almost no competitor can show this. | Open — flagged as a significantly underused asset. |
| I3 | Time-to-next-level estimate on the existing `LevelProgressBar`. | Open. |
| I4 | **A sentence you can now read** — assembled so that *every* word is already learned. | **Accepted, relocated to header subtitle.** See analysis below. |
| I5 | Word of the day drawn from the user's own learned set (passive recall, not new noise). | Open. |
| I6 | Coverage stat — *"you now know 41% of the kanji in a typical news article."* | Open. |
| I7 | **Welcome-back triage** — after an absence, *"Ease back in: 20 of your 340 due"* rather than dumping a full backlog on someone already feeling guilty. Where most SRS apps lose people permanently. | **Accepted** — conditional slot. |
| I8 | **Leech surfacing** — *"5 items keep tripping you up"* → targeted mini-session. Queue builder already computes weakness bias; this exposes it. | **Accepted** — merged with the at-risk section. |
| I9 | **Reading-readiness meter** — *"You're 4 kanji from unlocking this passage."* | **Accepted.** See framing note below. |
| I10 | Passage teaser — first line of the next passage to unlock. | Open. |
| I11 | Time-budget entry — *"I have 5 minutes / 20 minutes"* sizes the session; ties into existing intensity setting. | Open. |
| I12 | Resume card for an interrupted session. | Open. |
| I13 | Curriculum update banner — OTA flow exists but has no home surface. | Open — conditional slot. |
| I14 | Import nudge for users who haven't imported WaniKani/Bunpro history. | Open — conditional slot. |

### I4 — why it survives despite overlapping with reviews

Challenged on the grounds that example sentences already appear during reviews. Inspection of `curriculum/vocabulary/examples/n5.json` shows every sentence carries the full list of vocabulary it uses:

```json
{"japanese": "この道は危ないです。",
 "english": "This road is dangerous.",
 "vocabulary_slugs": ["kono", "michi-v", "abunai"]}
```

Those `vocabulary_slugs` make it queryable for sentences where **every slug is already learned**. The distinction that justifies the feature:

- **During review:** the sentence is attached to the item under review and may contain words the user has never seen. It is a *study aid*.
- **On home:** filtered so nothing in it is unknown — read completely, unaided, no gaps. It is *proof of capability*.

Different experiences. But it does not warrant a permanent section — hence the move to the header subtitle.

### I9 — gate vs. destination

The paragraph-reading requirements were framed as a **gate**. Reframed as a **destination**: a readiness meter converts the same mechanic from a locked door into a progress bar — identical logic, opposite emotional valence. Given requirement-gated passages are already planned, this is plausibly the highest-leverage idea in the list.

_Open question carried forward: does this change how the requirements themselves should be specified?_

---

## Technique 2 — Persona Journey

Three users open the composed screen. Same design, wildly different data.

### Kenji, day 1 (post-onboarding)

Five of seven sections were empty or demoralising. Header sentence **cannot render** — no sentence exists where every word is known. At-risk cannot render. Forecast shows seven empty days. Reading readiness renders as *"47 kanji from your first passage"* — a wall, not a target.

→ Resolved by the permanent-with-empty-states decision plus moving at-risk to conditional. Day 1 is effectively **a ring and one button**, which is likely correct — but now by design rather than by accident.

### Aiko, day 40 (steady state)

Everything populates. Composition holds. This is the design target.

### Taro, day 400 (power user, never misses)

- **63 leeches, not 5** → drove the at-risk count + top-N + ellipsis design.
- **Forecast is flat at ~200/day — there is no wall.** The wall warning never fires for the user carrying the heaviest load. _Unresolved._
- **Ring permanently maxed** → drove D5.

### Yuki, day 400, returning after a month away

**Finding — the ratchet is already half-implemented, by accident of the schema.** `getRecentDailyLoads` queries `WHERE date < ? ORDER BY date DESC LIMIT n`, and `addDailyLoad` only inserts rows for days with *activity*. Absent days create no rows, so the rolling average is computed over her last *active* days — not over a month of zeros.

**Her goal does not collapse while she is away.** D4's "doesn't fall off a cliff" behaviour is free; only the rise cadence and the prompt need building.

Flip side: she returns to a goal calibrated to her pre-absence self, which may now be punishing — and a month of decay means her at-risk list is enormous. Handled by welcome-back triage (I7), but the interaction between triage and a stale-but-high goal is _unresolved_.

---

## Open Items

| ID | Item |
|---|---|
| O1 | **Day-1 header fallback.** Header is permanent, but the fully-comprehensible sentence (I4) cannot render until enough vocabulary is learned. Needs a fallback — likely the current "Welcome back — here's today at a glance." |
| O2 | **Conditional priority rule.** What wins when several banner-slot conditionals are pending simultaneously (welcome-back triage, curriculum update, shadow-mode prompt, import nudge)? |
| O3 | **Wall warning never fires for heavy users** (Taro). A flat 200/day week has no spike to flag. Does the warning need a relative rather than absolute trigger? |
| O4 | **Returning user's stale goal.** Yuki's goal stays high across an absence (good for the ratchet) but may be punishing on return. Interaction with welcome-back triage undefined. |
| O5 | **Empty-state copy** for Forecast and Reading Readiness on day 1. Reading readiness in particular must avoid reading as a wall. |
| O6 | **Rejected ideas** — I2, I3, I5, I6, I10, I11, I12 ruled out by the user; scope deliberately held to the accepted set. |
| ~~O7~~ | **RESOLVED — active days.** Goal average divides by days with recorded activity, not calendar days. Falls out of the existing schema for free: `addDailyLoad` inserts rows only for active days, so `getRecentDailyLoads` already returns exactly this. Consequence: rest days show a visibly unfinished ring, accepted as the honest signal. |
| ~~O8~~ | **RESOLVED — prompt on increase, never auto-drop.** "Goal = last week's average" would otherwise fall as fast as it rises, contradicting D4's ratchet, and the congratulatory modal has no good downward form. Hold the goal on a down week. After two or three consecutive weeks of misses, *offer* a reduction as a kindness — "Been a tough stretch? You can lower your goal" — framed as the user's choice, never the system's verdict. Every downward move stays opt-in, the same principle that makes the upward prompt work. |
| O9 | **Small-sample guard on the weekly recalculation.** Active-days averaging (O7) plus never-auto-drop (O8) interact badly at low sample sizes: a user with a single heavy active day gets a goal equal to that day, then must match their heaviest-ever session on every future active day — and O8 prevents the goal from correcting downward. Suggested guard: require a minimum number of active days (2–3) in the week before recalculating; otherwise carry the existing goal forward. The O8 reduction offer is the backstop if it still goes wrong. |

---

## Technique 3 — Anti-Solution

Designed the maximally demotivating home screen, then checked proximity:

1. Lead with debt — largest number on screen is what you owe.
2. A goal that rises every time you hit it, so you never win.
3. List the user's failures prominently, by name.
4. A seven-day calendar of unavoidable obligations.
5. Greet a returning user with everything they lost.
6. Day-1 empty boxes reading "nothing here yet."

### Risk 1 — D4 + D5 combine into a treadmill → **resolved**

Ratcheting goal (D4) with no ceiling (D5) means the goal always rises to meet the user: overshoot to 300%, goal rises, back to 100%, repeat. **Overshoot becomes structurally unsustainable — neutralising the exact feature that motivated the session.**

**Resolution — weekly-average goal.** Setting the goal to the user's weekly *average* dissolves this by construction: a user is above their own mean roughly half the days, so **overshoot stays permanently reachable**. No rate cap needed. (Goal = *best* day would be a treadmill; goal = *mean* is self-correcting.) The D4 prompt reinforces it — an accepted raise reads as promotion, not a moving bar.

### Risk 2 — at-risk section as shame wall → **resolved**

"Here are 63 items you keep failing" is anti-pattern 3 nearly verbatim. Same data, same UI — framing does all the work. **Settled on invitation over diagnosis: "5 items ready for a refresher"**, not "5 items keep tripping you up." Consistent with P3.

### Not at risk

Removing the streak (inversion 1) eliminated the biggest guilt lever. Welcome-back triage (I7) directly counters anti-pattern 5.

---

## Goal Adaptation — settled mechanic

- Recalculated **weekly**.
- New goal = **average daily achievement over the past week, divided by active days only** (O7). Rest days are excluded from the average; they show as an unfinished ring.
- Subject to a **minimum active-days sample** before recalculating (O9) — otherwise carry the current goal forward.
- **Rises only.** Surfaced via a **congratulatory prompt**: "Congratulations, you've reached a new goal", which also offers *"Do you want to change the goal?"*
- **Never auto-drops** (O8). Held flat on a down week. After 2–3 consecutive weeks of misses, offers an opt-in reduction.
- **No maximum** (D5). User-configurable in Settings, unbounded.

This mechanic is internally consistent: the mean keeps overshoot reachable (Anti-Solution Risk 1), the prompt makes rises feel earned, and the never-auto-drop rule means the goal is never lowered without the user's consent.

---

## Scope Note

The ring work is the largest piece in this session and is **not really a home-screen change**. It touches `core/cognitive-load/thresholdCalculator.ts`, `core/cognitive-load/loadTracker.ts`, a new `addDailyLoad` call site in the lesson flow, a Settings surface for the manual goal, and a new weekly-prompt surface. Size it separately from the section work when this becomes stories.
