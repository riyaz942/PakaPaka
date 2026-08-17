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

### Phase B — app rules

All four rules. Under pull-forward every kanji is already taught before its word,
so **rules 1–4 are no-ops on landing** — they can ship and be tested safely
before Phase C activates them.

1. `promptResolver` takes the learned-kanji set and withholds reading prompts
   → verify: unit test — a word with an un-guru kanji resolves to `meaning`
2. `queueBuilder` emits vocabulary as one or two cards on the same flag
   → verify: unit test — two cards once every kanji is guru, one before
3. Master cap in the scheduler; interval clamped, reason surfaced on the item
   → verify: unit test — a capped item's next interval never crosses 120 days
4. Furigana threshold to master + reading-live; `knownKanji` sourced from learned
   kanji items, not `getKnownVocabularyCharacters`
   → verify: existing `FuriganaText` and `useFuriganaPreference` tests updated
5. `ReviewCard.tsx:176` renders prompts as bare `<Text>`. A meaning prompt on
   untaught kanji is unreadable without furigana
   → verify: a meaning prompt on 写真 shows 写[しゃ]真[しん]
6. Stats note for the capped population
   → verify: "% burned" no longer reads as stalled

### Phase C — drop pull-forward, band-gate edges

One commit. See [the sequencing constraint](#the-sequencing-constraint-inverted).

1. `generate_deps.py` emits `requires` only from same-or-earlier-band kanji;
   out-of-band kanji get a non-gating edge
   → verify: 0 items permanently locked for a fresh N5 profile
2. `listLessonCandidatePool` reverts to a per-level pool
   → verify: an N5 profile's pool contains N5 items only
3. Rework `dependency_order.py` severity for the new model
   → verify: 0 errors, 0 warnings
4. → verify: `npm test` in `mobile/`; a fresh N5 profile meets no prose-less card
   in the first 200 non-grammar cards

### Phase D — skeleton to full scale

Machine-generated. No prose.

1. ~~`build_skeleton.py` to 2,000 kanji and ~240 radicals~~ — **done in Phase A**
   (2,000 kanji, 238 radicals). 8 kanji still have no radical parent, unchanged
   from before the rebuild.
2. N3/N2/N1 **vocabulary** skeleton — ~8,500 words from JMdict + JmdictFurigana,
   frequency-ranked
   → verify: `npm run validate-schema` clean; furigana present on every entry
3. Browse filter or marker for prose-less items
   → verify: ~9,700 skeleton items do not read as a half-built app

v1 Phase 2 refused N3+ vocabulary because it "would drag in its own untaught
kanji and restart the problem one level up". **That objection is dead** — untaught
kanji no longer gate anything.

Database: 3.1 MB today for 2,315 items; expect **10–14 MB** at ~12,400, mostly
prose-less. Acceptable for a bundled asset, and it is already Git LFS.

### Phase E — author

Two independent tracks, neither blocking the other.

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

## Interaction with the mnemonic pipeline

`reading_regularity()` (`generate_content/mnemonic_context.py`) calls a reading
regular only when **every kanji is taught**. Under v2 most jukugo have an
untaught kanji, so they fall to the "write a full reading story" branch — the
opposite of what is wanted.

**It must judge against KANJIDIC dictionary readings instead of taught-status.**
v1 listed this as an optional interim rule, only needed if authoring slipped. It
is now mandatory.

Re-judging the 430 story-bearing words:

| Count | Bucket | Treatment |
| ---: | --- | --- |
| 157 | pure on'yomi jukugo (写真, 番号, 勉強) | one-line note |
| 222 | single kanji, kun reading (秋, 危ない) | keep the story |
| 29 | mixed regular (場所, 茶色) | one-line note |
| 20 | genuinely irregular (明日, 部屋) | keep the story |

The one-liner, for existing and future generations: *"This is a jukugo word,
which usually takes the on'yomi readings of its kanji. Learn the kanji readings
and you will know how to read this."*

## Out of scope

- N3+ grammar, example sentences, mnemonics, reading passages
- Any change to FSRS scheduling beyond the master cap
- Re-ordering within N5/N4 beyond v1 Phase 1's six cases
- Exam-alignment claims beyond "sized to the JLPT ladder"

## Reproducing the numbers

```bash
python3 curriculum/_build/import/build_skeleton.py      # needs EDRDG archives
python3 curriculum/_build/reports/kanji_bands.py        # bands -> _build/bands.json
python3 curriculum/_build/reports/kanji_priority.py     # authoring queue
python3 curriculum/_build/reports/dependency_order.py   # ordering + coverage
curriculum/_build/.venv/bin/python curriculum/_build/generate.py --level n5
curriculum/_build/.venv/bin/python curriculum/_build/generate.py --level n4
curriculum/_build/.venv/bin/python curriculum/_build/generate.py --bands
curriculum/_build/.venv/bin/python curriculum/_build/generate_deps.py
```

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
