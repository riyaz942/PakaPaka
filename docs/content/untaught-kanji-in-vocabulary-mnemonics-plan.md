# Untaught kanji in vocabulary mnemonics — plan

Design date: **2026-09-05**. Not started. Written from a codebase audit in a
session that diagnosed the defect; every number below was computed from the
repo at that date and is reproducible (see [Reproducing the
numbers](#reproducing-the-numbers)).

Read [kanji-coverage-and-dependency-order-plan.md](kanji-coverage-and-dependency-order-plan.md)
first. This plan sits on top of its v2 promise and does not change it.

## The defect

昨日 is an N5 word. 昨 is an N3 kanji. Its meaning mnemonic reads:

> The `<kanji>`day`</kanji>` that already slipped past you, gone before you
> could grab it, is `<vocabulary>`yesterday`</vocabulary>`.

Only 日 is named. 昨 — the character carrying "previous", the half that makes
this word *yesterday* rather than *today* — is absent. Compare 明日:

> The next `<kanji>`day`</kanji>` that hasn't arrived yet is always the one
> everyone calls `<vocabulary>`tomorrow`</vocabulary>`.

Same shape, mirrored. In both, the distinguishing work is done by an English
adverb the learner cannot trace to anything on the page.

This is **not a bug**. `mnemonic_context.vocab_context` deliberately drops it:

```python
# Only kanji the learner has already met may appear in a word's story.
taught_levels = ALL_LEVELS[:ALL_LEVELS.index(level) + 1]
```

and `vocab_component_edges` reads only `requires` edges. The prompt then says
"These are the only kanji you may name", so the model obeyed. The contract is
being met. The contract is what is wrong.

## Why the case exists at all

WaniKani never has this problem, because its dependency runs the other way.

| | WaniKani | This project |
| --- | --- | --- |
| What fixes the list | **Kanji** order (frequency + radical build-up) | **JLPT vocabulary** list per level |
| Vocabulary is | derived from the kanji already taught | given, then matched against kanji bands |
| A word appears | only at/after the level teaching its last kanji | at its JLPT level, kanji or no kanji |

WaniKani enforces it with a hard gate: vocabulary does not unlock until every
component kanji reaches Guru. So 昨日 simply does not exist there before the
level teaching 昨. The price they pay is that their word order is not usable as
a JLPT curriculum — a price this project cannot pay, because an N5 learner
needs 昨日.

**The partial-coverage case is a structural consequence of being JLPT-first.**
It cannot be gated away without either reinstating pull-forward (removed in
Plan v2 Phase C) or deferring the word (breaks JLPT fidelity).

## What already exists

Three pieces of the fix are already built, which is why this is cheap.

**1. The graph already distinguishes the two kinds of kanji-in-a-word.**

```
kinou: [('n5-nichi', 'requires'), ('k-yesterday', 'builds_on')]
sofu:  [('k-father',  'requires'), ('k-ancestor',  'builds_on')]
```

`requires` = taught by this level, gates the lesson. `builds_on` = written with
it, does **not** gate. 2220 such edges exist.

**2. The app already renders the untaught kanji as a chip.**
`itemRepository.getComponentParentsForItem` returns both edge types for
vocabulary. Its own comment (`itemRepository.ts:389`) states the intent: "The
chips answer 'what is this word written with', which does not depend on whether
the kanji gates the word."

> **So the inconsistency is already shipping.** The page shows the learner a 昨
> chip. The mnemonic beside it behaves as if the character is not there.

**3. Decoding is already solved.** `kinou` ships `"furigana": "昨日[きのう]"`,
and furigana auto-hide keys on **vocabulary** mastery, not on component kanji.
A learner who has never met 昨 can already read 昨日 everywhere it appears.

**This plan is therefore not about readability. It is about mnemonic quality
and page honesty.** Weigh cost accordingly.

## Scale

| Level | vocab | kanji words | **partial** | zero taught | all-circular | **would gain** |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| N5 | 718 | 592 | **87** | 255 | 11 | 76 |
| N4 | 529 | 448 | **122** | 166 | 16 | 106 |
| N3 | 2250 | 2237 | **506** | 169 | 95 | 411 |
| N2 | 2250 | 2238 | **487** | 145 | 64 | 423 |
| N1 | 4000 | 3959 | 0 | 0 | 0 | 0 |
| **All** | **9747** | **9474** | **1202** | **735** | **186** | **1016** |

- **partial** — at least one kanji taught, at least one not. The defect class.
- **zero taught** — 735 words where *no* kanji is taught (写真 at N5). Already
  handled: the prompt tells the model to name no kanji and write a standalone
  story. **Out of scope.**
- **all-circular** — 186 words where every untaught kanji merely restates the
  word's meaning. Naming them makes the mnemonic worse. **Must be skipped.**
- **would gain** — **1016 words.** The deliverable.

N1 is zero because the taught window at N1 is every level, so no kanji is
untaught. The problem is entirely N5–N2 and peaks in the middle, where
vocabulary is dense but the kanji bands have not caught up.

### The circular subset

When the untaught kanji's meaning *is* the word's meaning, naming it produces
nonsense:

| Word | Untaught kanji | Result if named |
| --- | --- | --- |
| 昨日 yesterday | 昨 "yesterday" | "The **yesterday** **day** is yesterday." |
| 果物 fruit | 果 "fruit" | circular |
| 椅子 chair | 椅 "chair" | circular |
| 税金 tax | 税 "tax" | circular |

`mnemonic_context._shares_meaning` already computes this test. Reuse it.

> Note for expectation-setting: **昨日, the word that prompted this plan, is in
> the circular set.** It will not improve. The words that gain are the additive
> ones — 祖父 (ancestor + father → grandfather), 会社員, 恋人, 男性, 文化.

## Rejected alternatives

Both were considered and rejected with reasons. Do not re-litigate without new
information.

### Rejected: show kana now, swap to kanji later

Display きのう until 昨 is learned, then swap the word to 昨日 app-wide.

The written form is a **key**, not a display string:

- `example_sentences` carry `word_spans` with character offsets —
  `{"vocabulary_slug": "kinou", "start": 0, "end": 2}`. Swapping the form moves
  every offset in every sentence containing the word.
- `furigana` is `昨日[きのう]`. There is no furigana for a kana form.
- Reading passages resolve vocabulary by form.
- The SRS item's prompt would change mid-history. FSRS stability is a claim
  about *that* card; changing what it shows invalidates it.

It also teaches false orthography — 昨日 is written in kanji in real Japanese.

### Rejected: two entries, kana first, kanji later

A kana item now, a separate kanji item once both kanji are taught. This is
essentially WaniKani's gate rebuilt inside a JLPT curriculum, and it is the
most intellectually honest of the alternatives. The price is still too high:

- **~1202 duplicate SRS items**, ~1000 of them at N3/N2. The learner answers
  "yesterday" to きのう, then answers "yesterday" to 昨日 months later with a
  fresh FSRS state starting from zero.
- **False orthography for most of the set.** Defensible for 果物, 椅子, きのう —
  genuinely often written in kana. Wrong for 会社員, 男性, 文化, 恋人, which are
  essentially never kana. There is no mechanical signal in the data to tell
  them apart; it would require hand-classifying 1202 words.
- **It does not remove the mnemonic work**, it relocates it.

## The plan

Three steps. **Each ships independently and in this order.** Step 1 is the
whole fix; steps 2 and 3 are honesty and agency on top of it.

### Step 1 — content: name the untaught kanji (1016 words)

Feed `builds_on` kanji into the vocab prompt, marked untaught.

**Meaning only — never the untaught kanji's own story.** Two reasons: the
learner has not read that story, so hooking into it teaches nothing; and 17 N5
+ 51 N4 of those kanji have no generated `meaning_mnemonic` at all yet, so
`format_vocab_components` would raise its "regenerate the kanji layer first"
`ValueError`. Meaning-only sidesteps the pipeline ordering constraint entirely.

Files:

| File | Change |
| --- | --- |
| `curriculum/_build/generate_content/mnemonic_context.py` | `vocab_component_edges` also reads `builds_on`; `vocab_context` returns them separately (e.g. `untaught_components`), filtered by `_shares_meaning` against the word's own meaning; `format_vocab_components` renders them meaning-only, in written-form order with the taught ones |
| `curriculum/_build/generate_content/prompts/vocab-mnemonic.md` | Bullet 1 and the components section: the untaught character may be named by meaning and must carry its share of the logic; it is **not** a kanji whose story you may reuse |
| `curriculum/_build/generate_content/validate_mnemonics.py` | `_component_errors` must not *require* untaught components (the model may legitimately fail to place one), but must not forbid them either — today's "never name a kanji not in that list" check has to learn about the second list |

**Do not bump `PROMPT_VERSION`.** Same approach as the kana amendment that
preceded this: a bump requeues all 861 vocab drafts including reviewed prose.
Stamp the affected drafts' `prompt_version` down by hand so the existing
staleness check in `generate_mnemonics.py` (~line 491) picks up exactly them.

**Verify:**
1. `vocab_context('n5','sofu')` returns 祖 as untaught, 父 as taught → check.
2. `vocab_context('n5','kinou')` returns **no** untaught component (circular,
   filtered) → check.
3. Fresh-lane validation accepts a mnemonic naming 祖 and still accepts one
   that does not → check.
4. Stored-lane re-validation of all existing drafts produces the **same 10
   pre-existing failures** and no new ones (dare, nani, nana-v, tomodachi,
   sakana, bungaku, shufu, hosoi-adj, nesshin, rippa) → check.
5. Regenerate N5 + N4 (182 words) and read the output before touching the 834
   at N3/N2.

### Step 2 — app: mark the chip as not-yet-learned

`CurriculumParentItem` currently carries `id`, `primaryForm`, `itemType`,
`meaning` and nothing else, so 日 and 昨 render identically.

| File | Change |
| --- | --- |
| `mobile/src/data/curriculum/itemRepository.ts` | Add `isTaught` (or `gates`) to `CurriculumParentItem`, set from which edge type the row came through in `getComponentParentsForItem` |
| `mobile/src/components/learn/CrossReferenceSection.tsx` | Dim/annotate the chip when not taught |
| `mobile/src/components/learn/ItemCrossReferences.tsx` | Pass it through `toChips` |

Copy, roughly: *"You haven't learned this kanji yet — the word is worth
knowing now; the character comes later."*

**Verify:** 昨日's detail screen shows 日 normal and 昨 dimmed; 写真 (zero
taught) shows both dimmed; an N3 learner viewing 昨日 sees neither dimmed.

### Step 3 — app: opt-in to learn the kanji now

**This is not the pull-forward that Plan v2 Phase C removed.** That was a
curriculum-level, all-learners, automatic walk in `listLessonCandidatePool` —
every N5 learner got 写 and 真 shoved into their queue whether they wanted them
or not. This is per-learner and opt-in: it does not change the level model, the
graph, or anyone else's queue.

`buildPlanForLevel` (`mobile/src/data/hooks/useLessonPlan.ts:42`) maps the pool
into a generic candidate list, and everything downstream — `planLesson`,
prerequisite gating, SRS — takes an arbitrary item set. So this is a `user.db`
table plus a union into that list.

| File | Change |
| --- | --- |
| `mobile/src/data/migrations/` | New numbered migration: opted-in item ids |
| `mobile/src/data/user/` | Repository for it |
| `mobile/src/data/hooks/useLessonPlan.ts` | Union opted-in items **and their transitive required parents** into `candidates` |
| Chip affordance from step 2 | "Learn 昨 now (+3 items)" |

**Show the item count on the button.** The learner has already tuned their goal
ring; a silent +3 is how a queue quietly stops being trustworthy.

#### What an opt-in costs

Cost = the kanji + its radicals that sit above the learner's level.

| Items added | Words |
| ---: | ---: |
| 2 | 26 |
| **3** | **808** |
| 4 | 106 |
| 5 | 54 |
| 6–8 | 22 |

**Median 3, mean 3.26.** Worst case in the entire curriculum is 8. The minimum
is 2, never 1, because Phase A filed each radical at the level of the first
kanji needing it — 昨 is N3, so 昨's radicals are N3 too, and an N5 learner
opting into 昨 always takes them along.

Opt-ins overlap (昨 serves both 昨日 and 一昨日), so the maximalist ceiling is
far below 1016 × 3.26:

| Level | words | distinct extra items | per word |
| --- | ---: | ---: | ---: |
| N5 | 76 | **167** | 2.20 |
| N4 | 106 | **239** | 2.25 |
| N3 | 411 | **592** | 1.44 |
| N2 | 423 | **583** | 1.38 |

A learner who opts into *everything* at N5 adds 167 items to a 592-kanji-word
level — real, bounded, and entirely their own choice. It decays at higher
levels because the same kanji keep recurring.

#### Two frictions to settle before building

- `StudyStatusBanner`'s stated contract is "Informational only: no CTA, no
  lesson entry point... details must never gate reading (BUG7)." A "learn this
  now" button is the first CTA in that surface. Not forbidden — but it is a
  deliberate reversal, so make it on purpose and update that docstring.
- The comment above the `listLessonCandidatePool` call in
  `useLessonPlan.ts:42-45` is **stale**: it still claims "an N5 learner is
  offered 写 and 真 before 写真", which Phase C removed. Pre-existing, unrelated
  to this plan, but it sits exactly where step 3 edits and will mislead.

## Reproducing the numbers

From `curriculum/_build/generate_content/`, with `PYTHONPATH=$PWD`. Build the
`requires` / `builds_on` / radical→kanji edge maps from
`curriculum/dependencies/graph.json`, then for each vocabulary item: take the
kanji characters in `primary_form`, subtract those reachable by `requires` from
a kanji banded at or before the word's level, and classify —

- no kanji chars → kana word (out of scope)
- nothing missing → fully taught (out of scope)
- everything missing → zero-taught (out of scope)
- some missing → **partial**; then partition on whether any missing kanji
  survives `_shares_meaning` against the word's own meaning synonyms.

Both a direct-from-graph script and one routed through `mnemonic_context.vocab_context`
produced identical totals on 2026-09-05.

## Status

| Step | State |
| --- | --- |
| 1 — content | pipeline done 2026-09-05; **the 803 words are not regenerated yet** |
| 2 — app annotation | done 2026-09-05 |
| 3 — opt-in unlock | not started, approved in principle |

Update `docs/working-history.md` when any step lands.

### Two corrections found while building

Both are errors in this document, not in the code that implements it.

- **The scale table is off.** The implementation gains **803** words — 70 N5, 94 N4, 324 N3,
  315 N2, 0 N1 — not 1,016. The partition here counts a larger "partial" class and a much
  smaller circular one; both scripts described under [Reproducing the
  numbers](#reproducing-the-numbers) now agree on 803. 写真 is also **not** zero-taught: 真
  is an N5 kanji holding a `requires` edge to it, so the word is partial, and its untaught
  half 写 "copy" is dropped as circular against "photograph".
- **Step 2's file table and its verification contradict each other.** "an N3 learner viewing
  昨日 sees neither dimmed" cannot be answered from the edge type, which is `builds_on` for
  every learner. The verification won: `useComponentParents` combines the band fact
  (`CurriculumParentItem.inBand`) with `item_study_status`, and a chip is marked only when it
  is both out of band and unstudied.
