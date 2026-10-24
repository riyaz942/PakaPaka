# Lesson mix — WaniKani-style waves, weights and a grammar brake

**Date:** 2026-10-24
**Status:** Code done; in-app check pending ([plan](../plans/2026-10-24-lesson-mix.md))
**Scope:** Which new items a lesson picks, and in what mix. Lesson planner, lesson-only readiness gates, grammar pacing, the "waiting" state on Lesson / Home / goal ring. Reviews are not changed.

---

## 1. Problem and intent

The learner's words:

> Whenever I start learning from the lessons, I get one grammar, one radical, one kanji, and one vocabulary, or two vocabularies if I choose five at a time.

> Initially, radicals should come more, and then the kanji, and then vocabulary and grammar. Grammar can be on later days because it's a little bit heavier.

> It's not like one whole session is just radicals or kanjis, etc. It is a mix, but they have it sweetly proportioned. … it's not fixed. It should be variable.

> The grammar reviews seem to be a little heavier for me. Whenever I try to learn, I get grammar each time, which makes my review even heavier.

> I also don't want it to be like the first 3-4 days are just radicals only. … some of the radicals should come first for 2-3 days before showing kanji and vocabulary and grammar.

> The user can configure how much they want to learn from the settings page … Based on that, keep it dynamic as well.

Two problems, one change:

1. **Existing learner:** every lesson has grammar, so grammar reviews (Read + Build, the heaviest cards) pile up.
2. **New learner:** day 1 is already a mix of all four types. There is no radical-first ramp.

**Success:** a fresh N5 learner gets about 2 days of radicals, then kanji, then vocabulary, then grammar. After that, the mix changes from lesson to lesson (`RRKVV`, `RKVVV`, `GRKVV`) and moves over weeks from radical-heavy to vocabulary-heavy. Grammar comes in at a steady, small daily rate. The rate grows with the daily setting, and new grammar pauses only when many recent grammar items are failing.

---

## 2. What the review found

### 2.1 Why every lesson is "one of each"

`mobile/src/core/lesson/lessonPlanner.ts`:

- **Floor pass** (`:94`) — every type that has a candidate gets one slot before anything else. Plan 04 added it so grammar would not starve (`docs/feedback/04-lesson-pacing-and-grammar-coverage.md` §4.1). With 5 slots and 4 types, 4 slots are fixed: R + K + V + G + 1 extra. This is the user's exact complaint.
- **Fixed round quotas** (`ROUND_QUOTAS`, `:41`) — 2/2/2/1, the same every lesson.

### 2.2 Why there is no radical-first ramp

- **Radicals never gate kanji.** In `curriculum.db`, every radical → kanji edge is `builds_on` (4,172 edges). `builds_on` means "is a component of, never gates" (`docs/content/kanji-coverage-and-dependency-order-plan.md`, Phase C). So all 150 N5 kanji are open on day 1.
- **Vocabulary gates open on *started*, not on *known*.** `isItemUnlocked` (`mobile/src/core/content/dependencyGraph.ts:13`) passes when the parent is `in_progress` or `known`. A word opens the moment its kanji is in a lesson.
- **381 of 718 N5 words have no gate at all**: 126 are kana-only, and 255 use only kanji from a later band (`builds_on`, not `requires`). They are open from minute one.
- **Grammar has no gate** (only outgoing `reinforces` edges).

### 2.3 Facts the design depends on

| Fact | Where | Why it matters |
| --- | --- | --- |
| A new item's first correct answer jumps straight to Review, stability 2.31 d, next due in 2 d. The second correct answer gives stability 10.96 d, which is **Guru** (≥ 7) | `fsrsScheduler.ts` with ts-fsrs 5.4 defaults, `learning_steps: ['10m']` — simulated | "Radicals at Guru" = about **day 2** after the lesson. That is the 2-day radical ramp the user asked for. "Passed first review" is only minutes after the lesson, so it gives **no** ramp |
| N5 radicals are ordered by the first kanji that uses them (145 of 148, 0 inversions) | `items.sort_order` | Learning radicals in order opens kanji in order |
| No radical → kanji edge points from a later band to an earlier one (0 rows) | `item_relationships` | A Guru gate on radicals cannot lock an N5 learner forever |
| 144 N4 kanji use N5 radicals | `item_relationships` | A learner who **starts** at N4 never gets N5 radicals → see D3 |
| Reviews filter on `isItemUnlocked` (started rule) | `queueBuilder.ts:79`, `reviewEligibility.ts:44`, `useReviewQueue.ts:249` | The new gate must be **lesson-only** and **stricter** than the review rule, so that everything a lesson gives is also reviewable. `isItemUnlocked` must not change |
| The level advances when the current level's plan is empty | `useLessonPlan.ts` (loop over `JLPT_LEVELS`) | With Guru gates, "nothing ready now" ≠ "level finished". Without a fix, a waiting N5 learner would jump to N4 → see D11 |
| Goal-ring target = full lesson allowance + reviews | `goalRingRepository.ts`, `thresholdCalculator.ts` | On a "waiting" day the ring cannot reach 100% → see D12 |
| Grammar = 2 cards (Read + Build sentence typing), worst-of-both | `docs/superpowers/specs/2026-10-13-grammar-read-build-srs-design.md` D1 | Grammar is the heaviest item in reviews |
| Weight signals in `curriculum.db`: kanji radical-component count (1: 46, 2: 87, 3: 14, 4: 3 in N5); vocab `reading_composition` (Kun'yomi, Jukugo, Kana only, On'yomi, Irregular, Mixed) and `word_type` | `items`, `item_relationships` | The data for light/heavy is already there. No new curriculum column is needed |
| Settings: `getDailyLessonItems` (intensity preset: 8 / 15 / 21 / 28 / 40) and `getLessonItemCount` (default 5) | `preferencesRepository.ts`, `constants.ts:56` | Every number below scales from these two |

### 2.4 Simulation

A throwaway simulator (real N5 data, all answers correct, Guru = +2 days) ran the rules below. Relaxed (15/day, 5 per lesson):

| Day | R | K | V | G |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 15 | 0 | 0 | 0 |
| 2 | 15 | 0 | 0 | 0 |
| 3 | 9 | 6 | 0 | 0 |
| 4 | 6 | 2 | 7 | 0 |
| 5 | 5 | 2 | 7 | 1 |
| 10 | 4 | 3 | 7 | 1 |
| 30 | 4 | 2 | 8 | 1 |
| 60 | 0 | 2 | 12 | 1 |

Sample lessons from days 5–9: `RKVVV GRRVV RRKVV GRRVV RRKVV RKVVV GRKVV`. Light (8/day): grammar from day 7. Immersive (40/day, 10 per lesson): radicals-only days 1–2, then about 8 R / 8 K / 22 V / 3 G.

Two rejected variants: **per-lesson rounding** gave the same `RKVVV` every lesson (fixed again); **a pure random draw per slot** gave swings like 1 R / 10 V in one day.

---

## 3. Goals, non-goals, anti-goals

**Goals**
- Radical-first ramp for a new learner, about 2 days, then a natural wave: radicals → kanji → vocabulary → grammar.
- A mix that changes from lesson to lesson, with proportions that move over weeks.
- Grammar at a small daily rate that grows with the daily setting; a high brake for when grammar is failing.
- Light items first; heavy items spread out, never several in one lesson.
- Everything scales from the two existing Settings values.

**Non-goals**
- No change to reviews: queue, interleave weights, FSRS, card types.
- No change to `curriculum.db`, the content graph, or the compile pipeline.
- No new Settings control (the user did not ask for one; the two existing settings drive everything).
- No change to the Browse / item-detail "locked" display (§9.2).

**Anti-goals** (a failure even if it "works")
- Grammar every lesson again, or grammar that never comes back.
- Every lesson looking the same.
- A learner sent to the next JLPT level only because items are waiting for Guru.
- A learner held in a level only because grammar is not finished (D17).
- Lessons that offer an item that reviews then filter out.
- A hidden fallback that quietly breaks a rule. Each rule is one path; if it blocks, the UI says so.

---

## 4. Decisions

"User" = the user decided it in the brainstorm. "Mine" = my call, open to change.

| # | Decision | Choice | Who |
| --- | --- | --- | --- |
| D1 | Unlock waves | Unlock on knowing, not on starting: lesson readiness needs parents at **Guru+** (or `known`) | User (accepted recommendation) |
| D2 | Kanji gate | A kanji is ready when **every radical component** (`builds_on` radical parent) is Guru+ or `known` | User / mine (Guru, not "first review": §2.3 shows "first review" is minutes after the lesson and gives no ramp) |
| D3 | Lower-level parts, just in time | Lessons come from the active level only; started lower-level items keep their reviews; unstarted lower-level items are skipped. **Exception:** when an active-level kanji or word needs a lower-level radical or kanji that is not started and not `known`, that part is offered in lessons (with its own parts, by the same gates) before the item that needs it. Nothing else from the lower level comes back. Covers placement gaps, a mid-level switch on the Levels screen, and import (144 N4 kanji use N5 radicals; 154 N4 words `require` N5 kanji) | User |
| D4 | Vocabulary gate | A word with `requires` kanji is ready when **every `requires` kanji** is Guru+ or `known`. A word with no `requires` kanji (kana-only, or later-band kanji only) is ready once the learner has **started ≥ 5 kanji** | Mine (the threshold) |
| D5 | Grammar opens | Grammar is ready once the learner has **started ≥ 10 vocabulary items** | User ("grammar on later days") / mine (the threshold) |
| D6 | Grammar daily cap | `max(1, round(dailyLessonItems / 15))` new grammar per day → light 1, relaxed 1, steady 1, intense 2, immersive 3. At most **1 per lesson** | User ("dynamic") / mine (the formula) |
| D7 | Grammar brake (pile limit) | New grammar waits while **≥ 10 × the D6 daily cap** grammar items (10 / 10 / 10 / 20 / 30) that were **started in the last 14 days** are still at Apprentice. Older stuck items do not count, so a few hard points cannot block grammar forever. A normal day has about 2 × cap at Apprentice (≈ 2 days each), so the brake trips only when most recent grammar is failing. Grammar **reviews** are never held back | User (pile limit, "really high") / mine (10 × cap, 14 days — a fixed 10 would trip at Immersive after one missed review) |
| D8 | Type mix | Shares for radical / kanji / vocabulary ∝ `lead × remaining`, where remaining = unstarted items of that type in the current level, and lead = radical 4, kanji 2, vocabulary 1. Only types with ready items take part | Mine |
| D9 | Variation | **Randomized rounding**: each type gets the floor of its share; only the leftover slots are drawn at random, weighted by the fractional parts. A lesson moves ±1 per type, not more | Mine |
| D10 | Light / heavy | Heavy items are capped at `max(1, round(size / 5))` per lesson, **grammar counts as heavy**. A skipped heavy item stays at the front of its type and goes into a later lesson, so heavies are spread out, never starved | User (weighted, light first, heavy in between) / mine (cap and tiers, §6) |
| D11 | Level advance | Radicals, kanji and vocabulary advance to the next level only when the current level has **no unstarted radical, kanji or word that passes the old started rule**. If items exist but none is ready → **waiting** state, not advance. Grammar does not hold the level (D17) | Mine (needed by D1) |
| D17 | Grammar is its own track | Grammar draws from the **lowest level at or above the starting level that still has unstarted grammar**, independent of the radical/kanji/vocabulary level. When a level's radicals, kanji and words are done first, the learner moves on and grammar keeps its D6 rate. Grammar can fall behind (for example, N4 grammar while learning N3 words); that is accepted | User |
| D12 | Waiting state | Lesson empty state and Home lesson card say new items unlock as reviews level up. The goal ring's lesson part is capped to what can actually be learned today | Mine (needed by D1) |
| D13 | Opt-in items | Items the learner opted in to keep **today's rule** (started parents), go first in the lesson, and take slots before shares are applied. The learner asked for them | Mine |
| D14 | Determinism | The random draw is seeded by `todayKey()` + items started today, so the same lesson comes back after a re-mount and after the clamped re-plan | Mine |
| D15 | Presentation order | Inside a lesson: opted-in, then radicals, kanji, vocabulary, grammar; curriculum order inside each type | Mine |
| D16 | Daily allowance | `computeDailyAllowance` and the backlog throttle are unchanged. Shares apply to the clamped size | Mine |

---

## 5. Algorithm

`planLesson` stays pure (no DB). The hook collects the inputs.

**Inputs** (adds to today's `LessonPlanInput`):
- per candidate: `weight: 'light' | 'normal' | 'heavy'` (§6), the existing fields;
- per candidate: readiness parents: radical components (kanji), `requires` kanji (vocabulary);
- `parentStages: Map<id, SRSStageLabel>` and existing `parentStatuses`;
- lower-level parts for D3: unstarted, not-`known` radicals / kanji below the active level that an active-level candidate needs (walk `builds_on` radical edges and `requires` kanji edges), added to the candidate pool;
- learner counts: `kanjiStarted`, `vocabStarted`, `grammarStartedToday`, `recentGrammarApprentice`;
- `remainingByType` in the current level; `dailyLessonItems`; `size`; `rng`.

**Steps**

1. **Filter** — drop known / in_progress / already-started (unchanged).
2. **Readiness** — keep candidates that pass D2–D5 (opt-ins: D13, today's rule).
3. **Opt-ins first** — take opted-in candidates up to `size` (D13).
4. **Grammar slot** — if grammar is ready, `grammarStartedToday < cap` (D6) and `recentGrammarApprentice < 10 × cap` (D7): take 1 grammar.
5. **Shares** — for the remaining `n` slots: share by D8 over the types with ready items; give each type `floor(n × share)`, capped at its ready count; draw each leftover slot by D9; repeat until `n` is filled or no type has ready items left.
6. **Fill each type** — walk the type's ready list in order (opted-in first, then `sort_order`). Take light and normal items. Take a heavy item only while the lesson's heavy count (grammar included) is under the D10 cap; otherwise skip it and look up to **10** items further for a non-heavy one. If none is found, the slot goes back to step 5 for the other types.
7. **Order** by D15.

**Hook / level** (`useLessonPlan`)
- Build the radical/kanji/vocabulary inputs per level. To decide D11, run the old started-rule check for "any unstarted radical, kanji or word left".
- Build the grammar candidates from the D17 grammar level, which is resolved separately.
- Result: `items`, `level` (radical/kanji/vocabulary level), `grammarLevel` (new), `waiting: boolean` (new), existing `allowance`, `capReached`.
- `waiting` is about radicals, kanji and vocabulary only. Grammar held by D6 or D7 does not make a lesson "waiting"; it only means no grammar slot in that lesson.

---

## 6. Weights

Computed at runtime from columns already in `curriculum.db` (one pure function in `core/lesson/`, inputs added to the candidate-pool query).

| Type | Light | Normal | Heavy |
| --- | --- | --- | --- |
| Radical | always | — | — |
| Kanji | 1 radical component | 2 components | 3+ components |
| Vocabulary | `Kana only` | `Kun'yomi`, `On'yomi`, `Jukugo` (non-verb) | `Irregular`, `Mixed`, or a verb with `Jukugo` reading |
| Grammar | — | — | always (and its own D6/D7 rules) |

`reading_composition` is free text that starts with the category (`"Kun'yomi — 私（わたし）."`); parse the leading token. A missing or unknown value → normal.

Light vs normal does not change selection today. It is kept so the presentation or a later tuning can use it. **(Builder: if this looks speculative, fold it into two tiers. Mine either way.)**

---

## 7. Constants

All in `mobile/src/config/constants.ts`, each with a one-line comment in the file's style.

| Name | Value |
| --- | --- |
| `LESSON_TYPE_LEAD` | `{ radical: 4, kanji: 2, vocabulary: 1 }` |
| `LESSON_VOCAB_OPEN_MIN_KANJI` | 5 |
| `LESSON_GRAMMAR_OPEN_MIN_VOCAB` | 10 |
| `LESSON_GRAMMAR_DAILY_PER_ITEMS` | 15 |
| `LESSON_GRAMMAR_PILE_LIMIT_PER_DAILY_CAP` | 10 (limit = 10 × D6 cap) |
| `LESSON_GRAMMAR_PILE_WINDOW_DAYS` | 14 |
| `LESSON_HEAVY_PER_ITEMS` | 5 |
| `LESSON_HEAVY_LOOKAHEAD` | 10 |

Remove `ROUND_QUOTAS` and the floor pass. Plan 04's starvation test ("≥1 grammar whenever grammar exists") is replaced by D5–D7 tests.

---

## 8. Change list

| Area | File | Change |
| --- | --- | --- |
| Planner | `mobile/src/core/lesson/lessonPlanner.ts` | Rewrite per §5. Readiness lives here as a lesson-only helper; `isItemUnlocked` is untouched |
| Weights | `mobile/src/core/lesson/lessonWeight.ts` (new) | §6 |
| Constants | `mobile/src/config/constants.ts` | §7 |
| Pool query | `mobile/src/data/curriculum/itemRepository.ts` | Candidate rows add `reading_composition`, `word_type`; new batch query for radical components of kanji (`builds_on`, parent type radical) |
| Learner counts | `mobile/src/data/user/*` | Kanji / vocab started counts; grammar started today; recent grammar Apprentice count; parent SRS stages (stored `srs_stage_label`) |
| Hook | `mobile/src/data/hooks/useLessonPlan.ts` | Collect inputs, seeded rng (D14), D11 level rule, `waiting` flag. Pull the body out into a plain function so D12 can reuse it |
| Lesson screen | `mobile/src/app/lesson/index.tsx` | Waiting empty state, separate from "capReached" and "nothing left" |
| Home | `mobile/src/app/(tabs)/index.tsx` | Lesson card copy when waiting |
| Goal ring | `mobile/src/data/user/goalRingRepository.ts` | Lesson part = `min(allowance.total, startedToday + readyNow)` |
| Docs | `docs/working-history.md` | Add this spec's row; update on status change |

**"Started today" / "started in the last 14 days" for grammar:** no table stores the start time per item today. `item_study_status.updated_at` is written when `startLessonItems` sets `in_progress` — use it if no other path rewrites that row for an in-progress item; otherwise add a migration (`022_…`) with a per-item `started_at`. **(Builder verifies; mine.)**

---

## 9. Found outside this scope (mentioned, not fixed)

1. ~~N4+ starters: 154 N4 words never unlock~~ — **moved into scope as D3.** Onboarding placement already marks every level below the lowest tested level `known`, so the plain N4 start is fine; the gap is a placement over N5–N4 with N5 items marked not known, a mid-level switch on the Levels screen, or import.
2. **Browse shows "unlocked" by the started rule.** After this change, Browse can show a kanji as unlocked while lessons wait for its radicals to reach Guru. Follow-up: a "ready to learn when 口 reaches Guru" line on the detail page.
3. **More reading cards per word.** With D4, a word's in-band kanji are at Guru when the word is learned, so its reading card (rule 1) is live from the first review. Today many words start meaning-only. That is more vocabulary cards per word; the grammar brake removes more load than this adds for the existing learner, but watch the forecast.
4. **Grammar lag (accepted, D17).** At 1 grammar/day, N4's 87 points take 87 days while N4 radicals, kanji and words take about 58 days at Relaxed, about 39 at Steady. N3+ has no grammar, so the grammar track then catches up while the learner is in N3.
5. **Existing learners on rollout:** the gates apply at once. Kanji with Apprentice radicals and words with Apprentice kanji wait; new grammar drops to the daily cap. That is the intended fix, not a migration.

---

## 10. Verification

**Unit tests (`lessonPlanner.test.ts`, `lessonWeight.test.ts`)**
- Kanji with an Apprentice radical is not offered; at Guru it is.
- D3: active level N4, an N4 word needs an unstarted N5 kanji → that kanji (and its unstarted radicals) is offered first; other unstarted N5 items are not offered; `known` N5 items are not offered.
- Word with Apprentice `requires` kanji is not offered; ungated word waits for 5 started kanji.
- Grammar: not before 10 started words; ≤ 1 per lesson; daily cap per D6 for each preset; blocked at 10 × cap recent Apprentice, not by the same number of old ones.
- Heavy cap: never more than the cap; a skipped heavy item comes in the next lesson.
- Same seed → same lesson; different seeds → different mixes within ±1 per type.
- Opt-ins first and gated by the old rule.
- Everything the planner returns passes `isItemUnlocked` (review safety).

**Hook tests (`useLessonPlan`)**
- Waiting (items gated, none ready) → `waiting: true`, level does **not** advance.
- Level finished → advances, as today.
- Radicals, kanji and words of N5 done, N5 grammar left → the level advances to N4 and grammar still comes from N5.

**Simulation (acceptance)**
- A script drives the **real** planner over the seed `curriculum.db` for 30 days, all answers correct, Guru = +2 days, for light / relaxed / immersive. Pass:
  - days 1–2: radicals only;
  - kanji by day 3, vocabulary by day 4, grammar by day 7 at the latest;
  - grammar per day ≤ the D6 cap every day;
  - no two consecutive lessons identical for at least 80% of lessons after day 4;
  - radicals' daily share falls and vocabulary's rises from week 1 to week 4.
- A second run with **20% wrong answers** (a wrong answer resets that item to Apprentice) at every preset: the D7 brake must not stop new grammar on more than 1 day in 10.

**Gates:** `npm test` and `npm run lint` in `mobile/`; typecheck clean.

---

## 11. Left to the builder

- Exact query shapes and where the learner counts live (§8).
- Whether `item_study_status.updated_at` is safe as the grammar start time, or a migration is needed.
- The waiting-state copy (short, plain; it must not read as "cap reached" or "nothing left").
- The simulator's location and language (root has `tsx` + `better-sqlite3`; the planner must be the real one, not a copy).
- Tuning the §7 constants if the simulation misses a pass line. Record any change here.
