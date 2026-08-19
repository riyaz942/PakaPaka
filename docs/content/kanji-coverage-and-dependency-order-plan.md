# Kanji coverage & dependency order — plan v2

Superseded design date: **2026-08-17**. v1 (2026-08-16) is preserved in
[History](#history) at the bottom; read it before changing anything it built,
because most of it stays.

## The promise, restated

v1's goal was *every kanji in a word is taught before the word is*. It is
achievable, and v1 achieved it — by pulling out-of-level kanji forward into the
lesson sequence. The cost is that half the corpus is out of level, so the pull
dragged 624 unauthored kanji into N5 and N4 lessons. A fresh N5 learner met the
first prose-less card in **lesson 2**.

v2 narrows the promise to one that is honest and cheap to enforce:

> **You are never asked to read a kanji you have not learned.**

Words are not withheld and not rewritten. Every word is shown in full, with
furigana, from the first lesson. What changes is the *question*, not the
*display*: a word whose kanji are untaught is asked for its meaning only.

## The ladder

Kanji bands are a **teaching budget**, not a coverage gate. A band is the set of
kanji taught at that level, chosen for how many of that level's own words they
unlock. Words outside the budget are still taught — meaning first.

Counts match the JLPT working figures so the level names mean what learners
expect. The exam publishes no official list; these are the community figures
reconstructed from past exams.

| Level | Radicals | Kanji added | Kanji cum. | Vocabulary added | Vocab cum. | Grammar |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| N5 | ~100 | 150 | 150 | ~800 | ~800 | 74 |
| N4 | ~35 | 150 | 300 | ~700 | ~1,500 | 97 |
| N3 | ~45 | 400 | 700 | ~2,250 | ~3,750 | — |
| N2 | ~35 | 300 | 1,000 | ~2,250 | ~6,000 | — |
| N1 | ~25 | 1,000 | 2,000 | ~4,000 | ~10,000 | — |
| **Total** | **~240** | | **2,000** | | **~10,000** | **171** |

Notes on each column:

- **Radicals** are derived, not chosen. A radical files at the level of the first
  kanji that needs it, so the split falls out of the rebuild. 241 distinct
  KRADFILE components cover the 2,136 jōyō kanji; maximal-component pruning
  (`build_skeleton.py:240`) trims that, so expect **200–240**, against 152 today.
  Every radical the 300-kanji N5+N4 band needs **already exists** — no new radical
  art for the levels that ship content. About 45 of them sit at N3/N2 today and
  re-file upward.
- **Kanji** N5 runs 150 rather than the exam's ~100. The reuse curve says the
  extra 50 buy a disproportionate number of words. Teaching above the exam never
  costs the learner anything.
- **Vocabulary** N5 and N4 are full-content levels. N3–N1 ship as skeleton.
- **Grammar** N3+ grammar is **not in this plan.** It needs its own, and nothing
  here blocks it. Reading passages are the same: N5 has 10, N4 has 9, N3+ none.

Total shipped items: **~12,400**, against 2,315 today.

### Why these numbers

- 10,000 words is the ~98% text-coverage mark — comfortable reading. 6,000 is
  ~95%, or one unknown word in twenty, which is not comfortable.
- 2,000 kanji against 10,000 words is 5 words per kanji, in the same band as
  WaniKani's 2,000 / 6,000.
- Matching the JLPT scale means the level names carry no false promise. The claim
  the app may make is **"sized to the JLPT ladder"** — not "pass N3 with this".
  Which specific words sit in each band is a reconstruction, and grammar and
  listening are separate axes.

### Band assignment

Rank by **corpus reuse**: for each kanji, how many of that level's own words it
appears in. Take the top N. Tie-break by KANJIDIC grade so equally useful kanji
arrive easy-first.

Not the JLPT kanji list — it is blind to the word list you ship, so it spends
slots on kanji that unlock nothing. Reuse ranking is what makes the coverage
numbers real: the best 150 kanji make 417 of N5's 718 words fully readable (58%);
a reuse-ranked 300 reaches 65% across N5+N4.

Vocabulary is selected by **frequency alone**, not by which kanji are in band.
Constraining words to in-band kanji would reinstate the coverage gate this plan
removes.

**Overflow moves up a level.** A kanji that does not fit its band is filed one
level later. 48 currently-authored N5/N4 kanji fall outside a reuse-ranked 300;
their prose is already written and is not lost, it simply waits. The consequence,
accepted deliberately: **the level a kanji sits at is this app's ladder, not the
exam's**, and Browse shows it that way. One field, no second label.

## The four rules

Everything the app must change reduces to these.

**1. Reading prompts are gated.** A vocabulary item is asked for its reading only
once **every kanji in it has reached guru**. Guru, not lesson-completed: the two
cards share one FSRS schedule, so a newly-activated reading card lands at the
word's current interval. A kanji met in a lesson yesterday cannot answer a
question due in four months.

**2. Vocabulary becomes two-card, mirroring kanji.** Kanji already ship as a
meaning card and a reading card from one item, spaced apart, folded into one
grade by `combinePairGrades` (worst of the two). Vocabulary does the same:

| State | Cards emitted |
| --- | --- |
| any kanji below guru | meaning only |
| all kanji at guru+ | meaning + reading, worst-of-both |

The second card is **reading only**. The meaning card is already in the session;
asking twice costs time and returns no signal. This deletes the rep-parity
alternation at `promptResolver.ts:24` — vocabulary stops flipping its question by
rep count.

Accepted cost: on the day the reading card first appears, a wrong answer drags
the whole word back through worst-of-both. No grace pass and no interval reset.
It is honest — the learner has genuinely not been tested on that reading — and it
costs a few redundant meaning reps. A grace rule would be a hidden special case.

**3. A meaning-only word is capped at master.** It cannot become enlightened or
burned until its reading is live. You cannot burn a word you cannot read.

Stage boundaries are stability in days (`fsrsScheduler.ts:97`): apprentice < 7,
guru 7–21, master 21–120, enlightened 120–365, burned 365+.

Three requirements:

- **Clamp the interval, not just the label.** If only the displayed stage is
  capped, the item silently accrues a two-year interval and stops returning —
  the opposite of the intent. The next interval must not cross the master
  ceiling.
- **Show the reason on the item.** *"Master until you learn 写 and 真."* A word
  frozen with no explanation reads as a bug.
- **Stats needs a line.** Any "% burned" figure now contains a population that
  cannot be burned yet. Without a note it reads as stalled progress.

Master, not guru. A guru cap holds the interval under 21 days, which at full
ladder scale is roughly **100 stuck reviews a day**. A master cap is ~18.

**4. Furigana hides at master, once the reading card is live.** Today it hides at
**guru — 7 days** (`masteryRepository.ts:7`), which is far too early under this
design: a meaning-only word would lose its furigana while its kanji are untaught,
leaving the learner unable to read it at all.

The condition is not an exception. "The learner knows this word" always had two
halves; the split card separated them. Hiding the reading requires having learned
the reading. It also costs nothing to build — *reading card active* is the same
boolean rule 2 needs to decide one card or two.

Hiding stays **per word**. No per-kanji drain. The kanji's own two-card item
carries the reading burden, so a learner leaning on furigana in vocabulary is not
skipping the kanji work.

The same threshold moves for embedded text — passages, example sentences, chat
replies — through `getKnownVocabularyCharacters`. One threshold everywhere; a
learner who wants furigana gone already has the global Settings switch. The
explicit `known` bulk-mark keeps hiding furigana: that is the learner saying so
directly, not an SRS inference.

## What is reverted

**v1 Phase 3 (pull-forward) is reverted in full.** With reading prompts gated, a
word no longer needs its kanji taught first, so there is nothing to pull.

| Reverted | Where |
| --- | --- |
| `listLessonCandidatePool` transitive parent walk → back to a per-level pool | `itemRepository.ts` |
| `requires` edges emitted from every kanji regardless of level | `generate_deps.py` |
| `builds_on` pull-forward of skeleton radicals at child-position-minus-half | `itemRepository.ts` |
| `dependency_order.py` severity model built around pull-forward | `reports/dependency_order.py` |

**Kept, do not revert:**

- The `getParentsByRelationshipType` chunking fix. It is a real SQLite
  999-parameter bug, unrelated to pull-forward.
- v1 Phase 1's six same-level vocabulary moves (彼女, 何時, 経済, 説明, 習慣, 親).
- v1 Phase 2's skeleton, `build_skeleton.py`, and `visual_mnemonic_url` being
  optional.
- v1 Phase 4 tranche 1 — 30 authored kanji and 30 skeleton radicals, plus the
  three fixes underneath them (20 added radicals, maximal-component pruning, the
  灬/杰 and chevron KRADFILE mapping bugs).

### The sequencing constraint, inverted

v1 warned: never ship the skeleton with `requires` edges on and the old planner,
or 685 words lock permanently. The revert re-creates exactly that hazard from the
other side.

**Dropping pull-forward while `requires` edges still come from out-of-band kanji
locks those words permanently.** The planner will never offer an N2 kanji to an
N5 learner, so the word can never unlock.

So `requires` must become band-aware in the same commit as the revert: emitted
only from same-or-earlier-band kanji. Out-of-band kanji keep a **non-gating**
edge, which is what rule 1 reads to decide whether the reading prompt is live.
The edge survives; only its power to gate is removed.

## Phases

Start at **Phase A**. Each phase is shippable on its own.

### Phase A — reband — **done 2026-08-17**

Content only. Reversible. Everything downstream depends on the bands existing.

1. ~~Extend `reports/kanji_priority.py` (or a sibling) to emit the reuse ranking
   per level and the resulting band assignment~~ — sibling
   `reports/kanji_bands.py`, writing the checked-in `_build/bands.json` and
   `reports/kanji-bands.md`
2. ~~Move kanji between `curriculum/kanji/n*.json` to match the bands~~ — bands
   are 150 / 300 / 700 / 1000 / 2000 cumulative, `validate-schema` clean
3. ~~Re-file radicals to the level of their first kanji~~ — 238 radicals,
   122 / 40 / 42 / 15 / 19; no radical files at a later level than a kanji that
   needs it
4. ~~Rebuild and compile~~ — 3,656 items, 8,059 edges, 3.6 MB

**Phase D step 1 landed here.** A band size is a count, and N2/N1 cumulative are
1,000 and 2,000, so the corpus had to reach 2,000 kanji before the bands could
be assigned at all. `build_skeleton.py` now derives the whole corpus rather than
only the kanji shipped words need.

**Overflow does not move one level up.** It falls out of the 300-band into
whichever band frequency puts it in, which for the 53 authored kanji that
overflowed is N3 or later. "One level later" was written before the tail bands
existed.

Two things the plan got wrong, corrected by the build:

- **48 authored kanji fall outside a reuse-ranked 300** — it is 53.
- **"Every radical the 300-kanji N5+N4 band needs already exists"** — false. The
  jōyō corpus needs 86 radicals nothing taught, and 24 of them file into N5/N4
  with no mnemonic. They are in the Phase E queue. Art is still not needed:
  a radical without an image renders as text.

A slug does not follow its band. It names the source dataset — `n5`/`n4`
hand-authored, `k` derived — and is frozen, because the mnemonic sidecars, the
bundled radical art and `user.db` are all keyed by it.

Pull-forward is still on through this phase, so nothing locks and nothing
regresses. It simply has less to do.

**Open risk this phase makes acute, not new:** `compile-curriculum` assigns
`items.id` by (level, type, slug) and `user.db` stores progress against those
integers. Rebanding renumbers nearly the whole corpus, so an installed profile
would map onto the wrong items after an OTA swap. Nothing remaps them today.

### Phase B — app rules — **done 2026-08-17**

All four rules. Under pull-forward every kanji is already taught before its word,
so **no word is permanently locked** — they ship and are tested safely before
Phase C activates them at scale.

1. ~~`promptResolver` takes the learned-kanji set and withholds reading
   prompts~~ — `isVocabularyReadingUnlocked` in `promptResolver.ts`, fed by
   `getUnlearnedKanjiForItems` (`masteryRepository.ts`). Rep parity is deleted:
   `resolvePromptType` now takes the item type alone
2. ~~`queueBuilder` emits vocabulary as one or two cards on the same flag~~ —
   the kanji pair path generalized to `isTwoCardInput`; `KANJI_PAIR_MIN_GAP`
   is now `PAIR_MIN_GAP`
3. ~~Master cap in the scheduler; interval clamped, reason surfaced on the
   item~~ — `gradeItem(..., { capAtMaster })` clamps stability *and* due date
   under the enlightened boundary; the review card carries
   *"Master until you learn 写 and 真"*
4. ~~Furigana threshold to master + reading-live~~ — in `masteryRepository`, so
   every surface moves at once
5. ~~Annotated meaning prompt~~ — only on a **reading-locked** word. On a word
   that also gets a reading card, printing the reading in the meaning prompt
   would hand over that card's answer
6. ~~Stats note for the capped population~~ — under the SRS stage breakdown

Two things the plan got wrong, corrected by the build:

- **`knownKanji` was to be sourced from learned kanji items rather than
  `getKnownVocabularyCharacters`.** Not done: it contradicts this rule's own
  body ("hiding stays per word") and would reverse the FR78/BUG6 fix — knowing
  一 and 人 does not mean you can read 一人 (ひとり). The unit stays the word,
  now at master+ **and** reading-live. An explicit `known` bulk-mark still hides
  furigana on its own.
- **"Rules 1–4 are no-ops on landing"** — not quite. Rule 1 gates on *guru*,
  not on lesson-completed, so a word learned today is meaning-only for about a
  week while its kanji climb. That is the rule working, not a regression.

Not built, and not required by this phase: the two-card explainer covers kanji
only, so a vocabulary pair shows no guidance card (the kanji copy would misname
what is on screen), and the reason line for rule 3 appears on the review card,
not on the Browse detail header.

### Phase C — drop pull-forward, band-gate edges — **done 2026-08-17**

One commit. See [the sequencing constraint](#the-sequencing-constraint-inverted).

1. ~~`generate_deps.py` emits `requires` only from same-or-earlier-band kanji;
   out-of-band kanji get a non-gating edge~~ — 1,607 `requires` split into
   **1,023 gating + 584 non-gating**; total edges unchanged at 8,059
2. ~~`listLessonCandidatePool` reverts to a per-level pool~~ — the transitive
   walk and the `builds_on` component pass are both gone
3. ~~Rework `dependency_order.py` severity for the new model~~ — a `requires`
   parent banded later than its child is now an **ERROR** (the pool never
   leaves the level), and the pull-forward section is replaced by a reading-gate
   table
4. ~~Verify~~ — 0 errors; `npm test` 2,145 passing in `mobile/`, 62 at root;
   lint and typecheck clean; a fresh N5 profile meets its first prose-less card
   at **205**, past the 200-card bar

**The non-gating edge is `builds_on`, not a fourth relationship type.** The
schema enum, the DB CHECK constraint and both apps' types are untouched.
`builds_on` already means *is a component of, never gates*, which is exactly
the edge wanted; Phase B's `masteryRepository` was written reading both types,
so rule 1's reading gate needed no change at all.

Two display surfaces did need widening, because an out-of-band kanji stopped
being a `requires` parent: the component chips on a word
(`getComponentParentsForItem`) and "vocabulary using this kanji" on a kanji
(`useRelatedItems`). Both now read either edge — the question they ask is what a
word is written with, not what gates it. Without that, 写真 would show no
component chips at all.

**Not `0 warnings`, as step 3 asked.** 11 same-level ordering WARNINGs stand,
unchanged and pre-existing: Phase A's reband left 11 words (彼, 世界, 政治 …)
sorted just ahead of a kanji they need at the same level, so each waits one
lesson. Fixing them means re-ordering inside a level, which this plan puts
[out of scope](#out-of-scope).

**Reading-gate coverage, measured:** 727 of 1,247 words (58%) have a live
reading card by the end of their level — N5 **407 of 718 (56%)**, N4 320 of 529
(60%). The plan predicted 417 at N5 (58%) and 65% across N5+N4, so the real
figure is a few points below the estimate. 520 words are meaning-only, held by
501 out-of-band kanji.

A learner who starts above N5 is unaffected: placement marks every earlier level
known, so an earlier-band `requires` parent is already satisfied.

### Phase D — skeleton to full scale — **done 2026-08-17**

Machine-generated. No prose.

1. ~~`build_skeleton.py` to 2,000 kanji and ~240 radicals~~ — **done in Phase A**
   (2,000 kanji, 238 radicals). 8 kanji still have no radical parent, unchanged
   from before the rebuild.
2. ~~N3/N2/N1 **vocabulary** skeleton — ~8,500 words from JMdict +
   JmdictFurigana, frequency-ranked~~ — `import/build_vocab_skeleton.py` writes
   the checked-in `_build/vocab_skeleton.json`; `generate.py --level n3|n2|n1`
   emits the three vocabulary files. 8,500 words, **2,250 / 2,250 / 4,000**,
   ranked on JMdict's `nfXX` buckets and running to nf19. `validate-schema`
   clean, and every entry carries furigana — selection *requires* a
   JmdictFurigana alignment for (form, reading), so a word whose reading nobody
   has aligned is dropped rather than shipped bare
3. ~~Browse filter or marker for prose-less items~~ — a marker: the Browse row
   carries a **"No mnemonic"** pill, from a `has_mnemonic` column on the item
   branch of the browse query. Grammar is exempt — its prose lives in
   `explanation_markdown`, not in a mnemonic column

v1 Phase 2 refused N3+ vocabulary because it "would drag in its own untaught
kanji and restart the problem one level up". **That objection is dead** — untaught
kanji no longer gate anything.

Database: **6.5 MB** for 12,156 items and 25,124 edges, against the 10–14 MB
estimate.

Three things the plan got wrong, corrected by the build:

- **Every band ranks on reuse now, not just N5/N4.** `kanji_bands.py` fell back
  to KANJIDIC frequency at N3+ only because those levels had no words; Phase D
  is what removes the excuse. A word's level is its own frequency rank, decided
  without reference to kanji, so ranking a band on that level's words is not
  circular. It moved 492 kanji between the N3/N2/N1 bands — N5 and N4 are
  untouched, because they are assigned first from their own words — and it is
  what makes the tail levels readable: **78% of N3's own words have a live
  reading card by the end of N3, 85% at N2, 100% at N1**, against 21% / 18% /
  18% under frequency ranking. Overall 8,422 of 9,747 words (86%).
- **Word selection is constrained by the kanji corpus after all.** Not by band —
  that is the coverage gate this plan deleted — but a word written with a kanji
  outside the 2,000 can never be read, however long the learner studies, so its
  reading card would go live at the end of N1 having never taught 琵 or 椿. 556
  candidates are dropped for it, and coverage is now 100% at every level.
- **A JMdict `ateji` tag is not a reason to reject a spelling.** 時計, 試合,
  支払う and 拠出 are all tagged ateji and are all the normal way to write those
  words; rejecting the tag wholesale taught them as bare kana. What is rejected
  is a spelling nobody uses — search-only, rarely used, out-dated, irregular —
  plus JMdict's digit headwords (４０ beside 四十), particles, auxiliaries, bare
  affixes and numerals, which the curriculum teaches elsewhere or not at all.

**The renumbering risk Phase A raised is now larger, not different.** Adding
8,500 words and rebanding N3+ renumbers `items.id` across the corpus again.
Still nothing remaps an installed `user.db`.

### Phase E — author — **track 1 done 2026-08-17; track 2 in progress**

~~Two independent tracks, neither blocking the other.~~ **Track 1 gates most of
track 2, measured 2026-08-17.** A vocabulary meaning story chains from its
component kanji's `meaning_mnemonic`, so `format_vocab_components` raises
`component kanji <slug> has no meaning_mnemonic yet` and the prompt never builds.
**345 of the 1,247 N5+N4 words are unreachable** until the 173 band kanji have
prose — including 132 of the 205 words failing the gate on their meaning
mnemonic, and 66 of the 208 waiting to be re-shaped. Track 2's *prerequisite* and
its pilot were genuinely independent; its bulk is not. **Do track 1 first.**

1. **Kanji prose** — the **173 kanji and 24 radicals** inside the N5+N4 band
   that have no mnemonic, in band order (which is first-encounter order). Down
   from 523 under v1, because a band kanji is the only kind a learner now meets.
   The queue is `reports/kanji-priority.md`. Radicals go first inside each
   level: a kanji mnemonic continues its components' images, so a component with
   no story is a story the kanji cannot tell.
2. **Vocabulary top-up** — ~80 words to bring N5 to ~800 and ~700 to bring N4 to
   ~1,500. These are **full-content** levels: meaning mnemonic, reading mnemonic,
   example sentences, review. This is the only part of the whole plan that costs
   real writing at scale, and it deserves its own phase rather than being bundled
   into Phase A.

The prose debt does not scale with the skeleton. A mnemonic is owed when a
learner *reaches* an item, never because it exists.

**Track 1 progress.** The 14 N5 radicals are authored and ingested — subagent
lane, `sonnet-5`, four groups of ≤4, every slug passing the gate on attempt 1
with no repair. The 10 N4 radicals followed the same way, also 10/10 on attempt
1. All 238 radicals are now authored.

**The Step 1a auto-select fix, applied 2026-08-17.** The runbook's snippet now
reads "done" from the per-source sidecar (`curriculum/{radicals,kanji}/mnemonics/<source>.json`,
band-mapped via `bands.json`) instead of `generate_content/drafts/mnemonics/<level>/<type>/`.
Verified against the sidecar directly before trusting it: the fixed script
selected exactly 10 N4 radicals, 55 N5 kanji, 118 N4 kanji — matching the counts
this phase's queue predicted.

The 55 N5 kanji are authored and ingested next — 14 subagent groups, `sonnet-5`,
54/55 slugs passed the gate on attempt 1; `k-storey`'s `description` named an
unlisted look-alike (二) on attempt 1 and passed on the repair attempt (2 of 3).
`generate.py --bands` + `validate-schema` + `compile-curriculum` ran clean after
both the radical and the kanji layer.

The last slice of track 1's 173-kanji debt — the **118 N4 kanji** — is authored
and ingested the same way: 30 subagent groups, `sonnet-5`, 116/118 on attempt 1;
`k-have-the`'s `description` named an unlisted look-alike (上, inside the
compound 申し上げる) and passed on the repair attempt, the same failure shape as
`k-storey`. `generate.py --bands` + `validate-schema` + `compile-curriculum` ran
clean, and the sidecar-based auto-select confirms **0 remaining** across all four
layers (N5 radicals, N4 radicals, N5 kanji, N4 kanji).

**Track 1 is done.** All 238 radicals and all 300 N5+N4 band kanji are authored,
ingested, and compiled. 197 of those items are net-new this phase — the 24
radicals (14 N5 + 10 N4) and 173 kanji (55 N5 + 118 N4) named at the top of this
section as track 1's queue; the rest were already authored before Phase E
started. Two slugs needed one repair each
(`k-storey`, `k-have-the`), both the same gate error: a `description` naming a
Japanese character not on the item's reviewed look-alike list. Every other slug
passed the gate on the subagent's first attempt — a materially higher first-pass
rate than track 2's pilot, plausibly because kanji/radical prompts carry a
tighter, more mechanical contract (component + reading only, no reading-
regularity judgment call) than vocabulary's.

**(Historical, fixed above.)** The runbook's Step 1a auto-select did not survive
the reband: it called a slug done when a draft sat in
`drafts/mnemonics/<level>/<type>/`, but drafts are filed under the level an item
had when *written*, while `all_slugs` reads the rebanded level file — run as
originally written it would have selected 91 N5 kanji instead of 55 and
regenerated ~200 authored items over reviewed prose. The fix (see above) reads
the checked-in sidecar instead, which is band-aware already and does not drift.
The runbook doc (`docs/workflows/radical-kanji-vocab-mnemonic-subagent-workflow-automation-prompt.md`)
is updated in place with the corrected Step 1a snippet.

**Track 2 progress.** The prerequisite is done — see [Interaction with the
mnemonic pipeline](#interaction-with-the-mnemonic-pipeline--done-2026-08-17).
The N5 half of the re-authoring queue is done (pilot 12 + batch 1 50 +
batch 2 36 + batch 3 36 + batch 4's 57 regularity = 191 of 191). Batch 4
also started the meaning-mnemonic pass (43 words). The N4 regularity
slice (29) is next. The real sizes, against the ladder's cumulative
~1,500:

| | Shipped | Target | New words |
| --- | ---: | ---: | ---: |
| N5 | 718 | ~800 | **+82** |
| N4 | 529 | ~700 | **+171** |

Plus the fix's own **220-word re-authoring queue** on words already written.

**188 of those 220 are `review_status: reviewed`, not draft.** The shipped
`vocabulary/n5.json` says draft for all 718 words, which is `_merge_sidecar_meta`
working as documented — a word carries both a mnemonic sidecar and an examples
sidecar, all 718 example sets are draft, and the least-reviewed status wins. The
per-mnemonic truth is in `vocabulary/mnemonics/<level>.json`. **Read the sidecar,
not the shipped file, before deciding anything about vocabulary review status.**

**Pilot, 12 words, 2026-08-17 — 12/12 pass.** Both directions, so the two can be
judged against what they replaced: 8 `regular` (晩, 毎朝, 何時, 家族, 四日, 六日,
七日, 九日 — a ~250-char story becomes a ~120-char derivation note) and 4
`kun_word` (人, 水, 今, 口 — a ~85-char note becomes a ~260-char story). Run as a
**seed-and-repair**, not fresh generation: each reply file was seeded with the
word's current prose, so `ingest` reported exactly what the new contract rejects
and a per-slug repair subagent changed only that. Every meaning mnemonic not
named in an error came out byte-identical. Attempt 1 is the mechanical seed, so
all 12 cleared on attempt 2 with no second repair.

**Batch 1, 50 N5 words, 2026-08-18 — 50/50 pass.** Continued straight from the
pilot's remaining queue (curriculum order, next 50 of the 179 N5 words still
failing the gate after the pilot's 12). Same seed-and-repair method, run at
subagent scale: `webprompts` built all 50 prompt files in one call, a script
seeded each `reply.md` mechanically from the shipped sidecar prose (no model
call — attempt 1 is a deterministic copy, not a generation), `ingest` reported
each slug's exact gate errors, then 7 parallel repair subagents (`sonnet-5`,
groups of 8, one subagent per group, each touching only its own group's reply
files) fixed what was flagged. 30 of the 50 needed only a reading_mnemonic
reshape (13 note→story, 17 story→note); 20 also carried the separate
meaning-component gap described below and got both fixes in the same pass,
grafting the missing kanji reference into the existing scene rather than
rewriting it — the same pattern 家族 set in the pilot. 49/50 cleared on the
first repair attempt; `kyoudai`'s graft pushed `meaning_mnemonic` 51 characters
over the 450 cap, trimmed by hand (not a subagent — a mechanical cut, no prose
change) and passed on the second attempt. `generate.py --level n5` +
`validate-schema` + `compile-curriculum` ran clean; the shipped N5 vocab gate
error count dropped from 413 to 333 lines (all 50 batch slugs now gate-clean).
129 N5 words remain in the regularity queue, plus N4's smaller slice (29 words,
per the live gate re-run — see below). Every touched word reverted to
`review_status: draft`; nothing here marks anything reviewed.

**Batch 2, 36 N5 words, 2026-08-18 — 36/36 pass.** Next 36 of the 129 remaining
after batch 1, still curriculum order. Same seed-and-repair method: `webprompts`
for all 36, a script seeded each `reply.md` from the sidecar, `ingest` reported
gate errors, then 5 parallel repair subagents (`claude-sonnet-5-low` — the
available sonnet-5 slug; high-effort sonnet-5 is not in this environment's model
list), groups of ≤8, one subagent per group. 29 of the 36 needed only a
reading_mnemonic reshape (22 note→story, 7 story→note); 7 also carried a
meaning-component gap and got both fixes in the same pass, grafting into the
existing scene (`doubutsu`, `chairo`, `shinsetsu`, `benri`, `fuben`,
`daijoubu`, `taihen`). All 36 cleared on the first repair attempt — no second
repair, no hand trim. `generate.py --level n5` + `validate-schema` +
`compile-curriculum` ran clean; the shipped N5 vocab gate error count dropped
from 333 to 288 lines (all 36 batch slugs now gate-clean). **93 N5 words remain
in the regularity queue**, plus N4's 29. Every touched word reverted to
`review_status: draft`.

**Batch 3, 36 N5 words, 2026-08-18 — 36/36 pass.** Next 36 of the 93 remaining
after batch 2, still curriculum order. Same seed-and-repair method: `webprompts`
for all 36, a script seeded each `reply.md` from the sidecar, `ingest` reported
gate errors, then 9 parallel repair subagents (`cursor-grok-4.6-high`), groups
of ≤4, one subagent per group. 24 of the 36 needed only a reading_mnemonic
reshape (19 note→story, 5 story→note); 12 also carried a meaning-component gap
and got both fixes in the same pass, grafting into the existing scene
(`benkyou-suru`, `shitsumon-suru`, `kaimono-suru`, `sanpo-suru`, `ryouri-suru`,
`shigoto`, `shukudai`, `imi`, `kaigi`, `yakusoku`, `ongaku`, `eiga`). All 36
cleared on the first repair attempt — no second repair, no hand trim.
`generate.py --level n5` + `validate-schema` + `compile-curriculum` ran clean;
the shipped N5 vocab gate error count dropped from 288 to 243 lines (all 36
batch slugs now gate-clean). **57 N5 words remain in the regularity queue**,
plus N4's 29. Every touched word reverted to `review_status: draft`.

**Batch 4, 100 N5 words, 2026-08-18 — 100/100 pass.** Finished the remaining 57
of the N5 regularity queue and filled to 100 from the meaning-only pass
(next 43 in curriculum order). Same seed-and-repair method: `webprompts` for
all 100, a script seeded each `reply.md` from the sidecar, `ingest` reported
gate errors, then 25 parallel repair subagents (`cursor-grok-4.6-high`), groups
of ≤4, one subagent per group, launched in three waves. Of the 57 regularity
words, 27 needed only a reading_mnemonic reshape (4 note→story: `minami-v`,
`higashi-v`, `nishi-v`, `ittekimasu`; 23 story→note) and 30 also carried a
meaning-component gap and got both fixes in the same pass. The other 43 were
meaning-only wraps/grafts with reading left byte-identical. All 100 cleared
on the first repair attempt — no second repair, no hand trim.
`generate.py --level n5` + `validate-schema` + `compile-curriculum` ran clean;
the shipped N5 vocab gate error count dropped from 243 to 89 lines (all 100
batch slugs now gate-clean). **N5 regularity is done (0 remaining).** N4's 29
regularity words remain, plus **73 N5 + 1 N4** meaning-only fails. Every
touched word reverted to `review_status: draft`.

**Batch 5, 100 words, 2026-08-19 — 100/100 pass.** Finished the re-authoring
queue: all 73 remaining N5 meaning-only words, plus the first 27 of N4's 30
remaining words (regularity reshapes and meaning grafts, curriculum order),
leaving 3 N4 words for the next batch. Same seed-and-repair method as
batches 1–4: `webprompts` built all 100 prompt files, a script seeded each
`reply.md` mechanically from the shipped sidecar prose (deterministic copy,
no model call), `ingest` reported each slug's exact gate errors — 100/100
failed attempt 1, exactly reproducing the pre-batch gate state — then 26
parallel repair subagents (`sonnet-5`, general-purpose, groups of ≤4, three
waves) fixed what was flagged, each touching only its own group's reply
files. Unlike batches 1–4, the N4 half of this batch carried **two** error
kinds per item, not one: a meaning-mnemonic component graft/tag (same as
N5) *and* a reading-mnemonic reshape, because N4's regularity fix had never
been applied to these words before — every regular-reading N4 story in this
batch was replaced with a one-sentence derivation note built from the
prompt's own KANJIDIC segment breakdown (e.g. 世(せ)＋界(かい)), and the one
kun'yomi-only word (`oya`) got its under-length note grown into a full cast
story instead. All 100 cleared on the first repair attempt — no second
repair, no hand trim. `generate.py --level n5` + `generate.py --level n4` +
`validate-schema` + `compile-curriculum` ran clean; a direct
`validate_mnemonics.validate_draft` re-check of all 100 shipped items
confirms 0 gate failures. **The re-authoring queue is down to 3 N4 words**
(`setsumei`, `keizai`, `shuukan-custom`). Every touched word reverted to
`review_status: draft`.

**Found while scoping this batch, not previously tracked here: N4's bulk
vocabulary authoring has barely started.** Only 36 of N4's 529 shipped words
have ever had a mnemonic generated through this pipeline — the other 493
ship with empty `meaning_mnemonic`/`reading_mnemonic` fields entirely (not a
gate-reshape problem; nothing to seed-and-repair). This is a materially
larger task than the 103-word re-authoring queue this section has been
tracking, uses the standard fresh-generation runbook rather than
seed-and-repair, and is separate from the +171-word N4 top-up (which adds
words beyond the 529, rather than authoring the 529 that already shipped).
Not yet scheduled; flagged here so it isn't mistaken for done because the
words are "shipped."

**Separately: the meaning-mnemonic queue.** The errors are "never references
the component kanji X" and "references X but never wraps it in `<kanji>`".
This is not from the regularity fix; the likely cause is Phase A's reband
moving kanji into a word's taught window after its story was written. Live
gate after batch 4: **73 N5 + 1 N4** remaining (down from 116 N5 other-fails
before this batch; the 209 figure earlier in this phase included overlap
with the regularity queue, which N5 no longer has). 家族's repair in the
pilot had to extend a reviewed meaning story to reach 家 — the same graft
pattern this batch used on the 73 meaning fixes (30 overlapping regularity
+ 43 meaning-only).

**The top-up words are not in `vocab_skeleton.json`.** The skeleton is ranked on
newspaper frequency and its N3 head is 安保, 加盟, 欧州 — right for N3, wrong for
N4. Completing N5/N4 means completing the *JLPT lists* those two hand-authored
datasets already claim to be, which is a source this repo does not hold. Whatever
list is used, every candidate is checkable against JMdict for form, reading and
gloss, against JmdictFurigana for an alignment, and against the shipped 1,247 for
duplicates — the same four tests `build_vocab_skeleton.py` already applies.

**Adding words re-ranks the bands.** A band is ranked on how many of its level's
words a kanji unlocks ("Vocabulary comes before bands"), so `kanji_bands.py` must
re-run after the top-up, and a reband renumbers `items.id` — the open risk Phase A
already names. Sequence it as one reband, after all 253 words land, not per batch.

## Interaction with the mnemonic pipeline — **done 2026-08-17**

`reading_regularity()` (`generate_content/mnemonic_context.py`) called a reading
regular only when **every kanji is taught**. Under v2 most jukugo have an
untaught kanji, so they fell to the "write a full reading story" branch — the
opposite of what is wanted.

~~**It must judge against KANJIDIC dictionary readings instead of
taught-status.**~~ It does. Taught-status was also the wrong *question*: a
reading card is withheld until the word's kanji are learned (Phase B rule 1), so
by the time the learner reads the note, the readings it points at are known.

KANJIDIC2 is not committed (`_build/data/` is gitignored), so
`import/build_kanjidic_readings.py` distills it to the checked-in
`_build/kanjidic_readings.json` — **all 12,356 kanji that carry a reading, not
just the ones the curriculum uses**. Filtering to current usage saves 500 KB and
buys a stale-artifact bug: a top-up word with a new kanji would silently fall
through to "irregular". This is the same failure the runbook's Step 1a auto-select
already has, and it is not worth having twice.

Four kinds, replacing the old `untaught`:

| N5+N4 words | Kind | Treatment |
| ---: | --- | --- |
| 538 | `regular` — assembles from dictionary readings (写真, 番号, 場所, 手紙) | one-line note |
| 459 | `kun_word` — a lone kanji read with its kun'yomi (秋, 危ない, 私) | full story |
| 207 | `kana_only` | one-line note |
| 43 | `irregular` — assembles from nothing (明日, 部屋, 日本) | full story |

**`kun_word` is the rule the old code could not express, and it is why the fix
is not simply "use the dictionary".** 秋 あき is mechanically derivable, but the
kanji card teaches meaning and on'yomi only — kun'yomi comes through vocabulary
— so the word is where that reading is first met and it has nothing to derive
from. Every word this plan named lands in the bucket the plan predicted.

The counts in the table above supersede the v1 estimate of 430 story-bearing
words split 157 / 222 / 29 / 20, which predates Phase A's reband.

**The note is written per word from the computed segments** (写（しゃ）＋真（しん）),
not from the fixed sentence v1 proposed. That sentence asserts on'yomi, and 手紙
てがみ is `regular` on two kun readings; a note that names the actual segments is
both truthful and more use.

**Re-authoring queue: 220 shipped words are now mis-shaped** — 158 stories that
must shrink to notes (130 N5, 28 N4) and 62 notes that must grow into stories
(61 N5, 1 N4). `audit_shipped --level n5` reports all 191 of the N5 half. Every
one is `review_status: draft`, so no reviewed prose is at stake.

`PROMPT_VERSION["vocab"]` **stays at 4 on purpose.** Bumping it marks all 754
authored words stale, and 534 of them still conform. The queue is the gate's
output, not a version sweep.

## Out of scope

- N3+ grammar, example sentences, mnemonics, reading passages
- Any change to FSRS scheduling beyond the master cap
- Re-ordering within N5/N4 beyond v1 Phase 1's six cases
- Exam-alignment claims beyond "sized to the JLPT ladder"

## Reproducing the numbers

```bash
python3 curriculum/_build/import/build_skeleton.py        # needs EDRDG archives
python3 curriculum/_build/import/build_vocab_skeleton.py  # needs EDRDG archives
curriculum/_build/.venv/bin/python curriculum/_build/generate.py --level n5
curriculum/_build/.venv/bin/python curriculum/_build/generate.py --level n4
curriculum/_build/.venv/bin/python curriculum/_build/generate.py --level n3
curriculum/_build/.venv/bin/python curriculum/_build/generate.py --level n2
curriculum/_build/.venv/bin/python curriculum/_build/generate.py --level n1
python3 curriculum/_build/reports/kanji_bands.py        # bands -> _build/bands.json
curriculum/_build/.venv/bin/python curriculum/_build/generate.py --bands
curriculum/_build/.venv/bin/python curriculum/_build/generate_deps.py
python3 curriculum/_build/reports/kanji_priority.py     # authoring queue
python3 curriculum/_build/reports/dependency_order.py   # ordering + coverage
```

**Vocabulary comes before bands.** A band is ranked on how many of its level's
own words each kanji unlocks, so every level's word list has to exist before
`kanji_bands.py` runs. Nothing points the other way: a word's level is its
frequency rank alone.

`--bands` writes radicals and kanji for all five levels at once; they cannot be
written per level, because a band draws from every source dataset.

Archives come from `curriculum/_build/import/fetch_sources.sh` (KANJIDIC2,
JMdict, KRADFILE; `--all` adds Tatoeba and KanjiVG).

Authoring one skeleton item, no API key:

```bash
cd curriculum/_build
.venv/bin/python -m generate_content.generate_mnemonics webprompts \
    --type kanji --level n3 --slugs n3-private
# write generate_content/web/mnemonics/n3/kanji/n3-private.reply.md
.venv/bin/python -m generate_content.generate_mnemonics ingest \
    --type kanji --level n3 --slug n3-private --model claude-opus-5
```

`ingest` validates before it merges and rewrites only that slug's sidecar entry.

---

# History

## v1 — pull-forward (2026-08-16), superseded

v1's decision was that dependency order wins and JLPT level becomes a label: a
word needing a higher-level kanji pulls that kanji forward into the lesson
sequence. Four phases shipped in one day.

**Phase 1 — same-curriculum ordering.** `reports/dependency_order.py` is the
checked-in generator. Six same-level vocabulary items moved to sit after the
kanji they are written with — 彼女, 何時, 経済, 説明, 習慣, 親, plus 社会
displaced by them. The moves live in `n5_vocab.py` / `n4_vocab.py` so a
regeneration keeps them. **Kept in v2.**

**Phase 2 — N3/N2/N1 kanji skeleton.** `build_skeleton.py` derives 553 kanji and
10 new radicals from KANJIDIC2 + KRADFILE into `skeleton.json`, checked in so the
generators never need the source archives. Levels came from KANJIDIC2's old-JLPT
tag. `visual_mnemonic_url` became optional so skeleton radicals need no art.
`requires` edges were held. **Kept and extended by Phase D.**

**Phase 3 — planner pull-forward.** `listLessonCandidatePool` walked `requires`
upward and pulled parents forward at the position of the earliest item needing
them. `requires` edges went from 711 to 1,607; 479 kanji-bearing words gained a
parent; 765 words relied on pull-forward; 624 kanji were pulled. **Reverted by
Phase C.**

**Phase 4 tranche 1 — authoring.** 30 kanji and all 30 skeleton radicals
authored, moving the first prose-less card from lesson 2 to lesson 96. Three
fixes were required first: 20 radicals added to close decompositions a mnemonic
could name, maximal-component pruning in `build_decomposition` (KRADFILE
over-decomposes), and `builds_on` pull-forward so a mnemonic could lean on a
component the learner had met. Two KRADFILE mapping bugs surfaced: 灬 is written
杰, and the chevron is written 乞. **Prose and fixes kept; the `builds_on`
pull-forward is reverted.**

### Why v1 was superseded

Not because it failed — it met its goal, and coverage reached 100%. Because the
goal was too strong. Guaranteeing that every kanji precedes its word means
teaching 742 kanji to finish N4, and pulling 624 unauthored ones into beginner
lessons. Gating the *question* instead of the *display* buys the same protection
for a 180-kanji authoring queue instead of 523, and it lets a beginner meet 写真
in lesson 1 with furigana rather than after two years of kanji.

### Measured against v1's original problem statement

| | v1 measured | v2 |
| --- | --- | --- |
| Words with an untaught kanji | 685 of 1,247 (55%) | unchanged — now shown, asked for meaning |
| Kanji needed to finish N4 | 742 | 300 taught, rest displayed |
| Urgent authoring queue | 523 | ~180 |
| First prose-less card | lesson 96 | never — band kanji are authored |
