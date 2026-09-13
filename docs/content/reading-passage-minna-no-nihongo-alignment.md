# Reading passages — match the Minna no Nihongo shape

Status: **items 1–3 built 2026-09-12; item 4 was replaced by a step at
position 6 (see the item).** Items 5, 6 and 8 are not built — the maintainer
deferred all three. **The first regenerated batch (all 8 existing N5 drafts)
ran 2026-09-12 — see § Verification.** Item 7 is judged not needed yet from
that batch, but see the caveat there before deciding to skip it for good.

Companion to [reading-passage-expansion-plan.md](./reading-passage-expansion-plan.md),
which built the 30-seed ladder for N5 and N4. That plan is about grammar
*coverage*. This one is about how the passage **reads**: our generated drafts
are half the length of a Minna no Nihongo passage and are built from short,
unconnected sentences.

Source of the comparison: five 読み物 passages from Minna no Nihongo I (photos
supplied by the maintainer, 2026-09-12), transcribed in
[§ Reference texts](#reference-texts) so no one needs the photos again.

Prerequisite: nothing. Every change below is in the curriculum build lane.
Only item 8 touches the app.

---

## The measurements

Word counts are the build's own tokenizer (`validate_readings.word_count`, the
same fugashi tagger, punctuation excluded), so the bands below are directly
comparable to `target_words` in `reading_seeds.py`.

| Passage | words | chars | sentences | avg sentence | sentences joining 2 clauses |
|---|---:|---:|---:|---:|---:|
| MnN L4 ミラーさんの毎日 | 97 | 172 | 14 | 12.3 | 0 |
| MnN L7 土曜日と日曜日 | 63 | 117 | 9 | 13.0 | 0 |
| MnN L8 ワット先生 | 73 | 147 | 8 | 18.4 | **3** |
| MnN L9 山田さんとダンス | 67 | 130 | 7 | 18.6 | **1** |
| MnN L10 わたしのうち | 97 | 177 | 11 | 16.1 | **1** |
| our draft 1 `hajimete-no-jikoshoukai` | 37 | 64 | 8 | 8.0 | 0 |
| our draft 2 `mainichi-onaji` | 41 | 64 | 7 | 9.1 | 0 |
| our draft 3 `nanimo-nai-nichiyoubi` | 43 | 70 | 5 | 14.0 | 0 |
| our draft 4 `dare-no-heya` | 46 | 80 | 5 | 16.0 | 0 |
| our draft 5 `sasoi-ga-fueru` | 49 | 83 | 7 | 11.9 | 0 |
| our draft 6 `zenbu-sukoshi-itai` | 51 | 93 | 8 | 11.6 | 0 |
| our draft 7 `neko-to-shukudai` | 55 | 89 | 7 | 12.7 | 0 |
| our draft 8 `shio-to-satou` | 58 | 96 | 8 | 12.0 | 2 |

Two things fall out.

**MnN's early readings are also choppy.** L4 and L7 join no clauses at all.
Linking starts at L8, which is the lesson that teaches contrastive が, and grows
at L9 with から. So "short sentences early, linked sentences later" is the
correct target, not "long sentences everywhere".

**Our passages are about half the size.** MnN's *shortest* reading is 63 words.
Our `target_words` ladder does not reach 63 until seed 9.

---

## Findings

### 1. The prompt never asks for linked sentences, and the drafts never write them

`prompts/reading-passage.md` line 67 is the only instruction about sentence
shape: *"Vary sentence length."* That is too weak to produce MnN's L8 register.

The grammar is already available and going unused:

| seed | `grammar_cutoff` | linkers in window | linked sentences written |
|---:|---:|---|---:|
| 1–5 | 10–20 | none | 0 |
| 6 | 22 | `kara-because` (21), `node-because` (22) | 0 |
| 7 | 24 | same | 0 |
| 8 | 26 | same | 2 |
| 9+ | 29+ | + `te-form` (27) | not generated yet |

Seeds 6 and 7 could have joined clauses and did not. Seed 8 did — because its
`required_grammar` forced `kara-because` and `node-because`. So the generator
writes a linker only when the coverage gate demands one.

**This is the highest-leverage fix and it costs nothing but prompt text.**

### 2. The connective vocabulary is locked until seed 26

In `curriculum/_build/n5_vocab.py` the conjunctions and frequency adverbs sit in
the last thematic band:

| word | sort_order (of 722) | first seed whose `vocab_cutoff` reaches it |
|---|---:|---:|
| だから | 571 | 27 |
| でも | 572 | 27 |
| そして | 573 | 27 |
| それから | 574 | 27 |
| それで | 575 | 27 |
| しかし | 576 | 27 |
| とても | 549 | 26 |
| いつも | 552 | 26 |
| 時々 | 553 | 26 |

`context.CORE_SEED_SLUGS["n5"]` (65 slugs, `context.py:54`) holds verbs, nouns
and adjectives, and **no conjunction and no frequency adverb**.

So seeds 1–25 may not write そして, それから, でも, いつも or 時々 at all.
MnN uses それから in L6, そして and いつも in L8, 時々 in L10. Three of the five
reference passages open a sentence with one of these.

Note that the ten *shipped* N5 passages do use それから and とても — they were
generated under the retired proportional window. The new ladder is stricter, so
the regenerated set will read worse than what shipped unless this is fixed.

### 3. `target_words` starts too low

`reading_seeds.py`, N5 ladder: `(30, 40)` at seed 1 rising to `(98, 126)` at
seed 30. Seeds 1–8 are all below MnN's shortest reading.

MnN does not ramp across L5–L10. It starts at its target band and stays there.

### 4. Seed 1 sits too early on the vocabulary ladder

Seed 1 has `vocab_cutoff: 71` — the pronoun and numeral band — plus the 65 core
slugs. There is not enough there to write prose, and the output shows it:

> 私はリサです。学生です。先生ではありません。友達が来ました。彼は学生です。今日は暑いです。窓を開けました。私たちは本を読みます。

Eight facts, no connection. The prompt already forbids this shape (line 65–66:
*"A passage that is five unrelated sentences is not a reading; it is an
example-sentence list"*) and the gate passed it anyway, because nothing checks
it.

MnN starts its readings at chapter 5, after four lessons — past tense, the
place and time particles, and several hundred words. That is roughly our seed
8–9 window.

### 5. We introduce a new topic every sentence; MnN reuses an old one

Sentence-initial topics, in order:

| | topics |
|---|---|
| MnN L8 | ワットさん → ∅ → さくら大学 → ワットさん → 食堂 → 食堂の食べ物 → ∅ → 大学の仕事 |
| our draft 1 | 私 → ∅ → 先生 → 友達 → 彼 → 今日 → ∅ → 私たち |
| our draft 3 | これ → 月曜日 → 日曜日 → 猫 → ゼロ |

Every MnN topic after the first is a noun an earlier sentence already put on the
page (大学 → さくら大学, 食堂 → 食堂の食べ物). Ours are six unrelated nouns.
This lexical chaining — not sentence length — is what makes a text read as prose
instead of a list.

### 6. MnN drops the subject; we restate it

Sentences that state a topic, out of the total:

| MnN L4 | MnN L7 | MnN L10 | draft 1 | draft 3 | draft 8 |
|---:|---:|---:|---:|---:|---:|
| 5/14 | 2/9 | 3/11 | 6/8 | 5/5 | 6/8 |

MnN L4 names ミラーさん once and then writes thirteen subjectless sentences.

MnN can do this because each passage is about a **named third person** —
ミラーさん, ワットさん, 山田さん, 太郎ちゃん — reused across the whole book, so
the reader never loses the referent. We write in first person 私 with a
different one-off name per seed, declared in each seed's `extra_allowed`.
`prompts/cast-bible.md` exists but is mnemonics-only; `generate_readings.py`
never reads it.

### 7. N5 has no contrastive が

`n5_grammar.py` lists 74 points and none of them is 〜が / 〜けど ("but"). Point
10 `ga` is the subject particle, and `grammar_detect.py:245` matches it only as
`格助詞`. A contrastive が is tagged `接続助詞`, so it matches nothing, produces
no gate error, and would ship as an untaught pattern in a passage.

This is MnN's L8 sentence engine:

> さくら大学は大きい大学では**ありませんが**、いい大学です。
> 山田さんは上手では**ありませんが**、きれいな先生に習い**ますから**、毎日楽しいです。

### 8. No paragraph breaks

MnN passages are two blocks: weekdays / weekend (L4), today / tomorrow (L7).

`validate_readings.py:257` rejects any newline in `body`, because
`mobile/src/components/read/PassageBody.tsx:59` renders the whole body as one
`flex-row flex-wrap` of word chunks. We cannot ship that shape today.

---

## Changes, in priority order

Items 1–4 produce most of the effect. Items 5–8 are optional and independent.

### 1. Add a sentence-craft block to the passage prompt

**Built 2026-09-12.** `prompts/reading-passage.md` gained a *How the sentences
hold together* section carrying the five rules below, and
`generate_readings.PROMPT_VERSION` went 2 → 3. The linker rule is phrased
conditionally, so positions 1–5 — whose window holds no linker at all — are
told to keep every sentence to one clause instead. One deviation from the
wording below: そして and それから are named in the *chaining* rule, not the
clause-joining one. They open a new sentence; they do not join two clauses
inside one, and item 2 makes them available at every position, which would
have made the conditional clause-joining rule unconditional by accident.

File: `curriculum/_build/generate_content/prompts/reading-passage.md`

Replace the single line *"Vary sentence length. A wall of identical 〜です
sentences…"* with rules the model can act on:

- Name the subject in the first sentence. Leave it out of the following
  sentences until the subject changes.
- Start each sentence from something the previous sentence already introduced.
  A sentence that introduces a new topic and drops the old one reads as a list.
- Open some sentences with a time or a place instead of a subject
  (毎朝, 午後, 電車で, 公園の前に).
- When the window allows a clause linker (〜から、 / 〜ので、 / 〜て、 /
  そして / それから), join two clauses in at least **two** sentences.
- Build longer noun phrases with stacked の — 母の誕生日のプレゼント,
  さくら大学の英語の先生 — rather than longer verbs.

Keep the existing "one situation" rule. Bump `prompt_version` for the readings
lane if that lane carries one.

Do **not** add these rules to the first few seeds' output as a hard requirement:
seeds 1–5 have no linker in their window (see § Finding 1) and MnN's own L4 and
L7 join no clauses either. Phrase the linker rule as conditional on the window,
exactly as written above.

### 2. Unlock the connectives for every seed

**Built 2026-09-12.** The seven slugs below are in `CORE_SEED_SLUGS["n5"]`, so
every seed of both levels carries them. Their real positions are 669–694 of
718, not the 549–576 this document first measured off `n5_vocab.py` — so
before the change とても was reachable only at position 30, not 26. The core
set is 65 → 72 slugs. N4 inherits them, and the grammar-lesson and
kanji-example lanes widen by the same seven words, which can only reduce their
gate failures.

File: `curriculum/_build/generate_content/context.py`, `CORE_SEED_SLUGS["n5"]`

Add a `# connectives and frequency` group:

```
"soshite", "sorekara", "demo", "dakara", "totemo", "itsumo", "tokidoki",
```

`allowed_vocab_for` raises on an unknown slug, so a typo fails loudly. Confirm
each slug against `n5_vocab.py` before adding.

Alternative if the core set is meant to stay small: put the same slugs in
`pull_forward` on every N5 seed from position 5 up. The core set is simpler and
is the same mechanism that already pulls the survival verbs forward.

Consider whether N4 needs the same treatment — N4 inherits N5's vocabulary, so
its seeds get these for free once they are in the core set.

### 3. Raise `target_words`

**Built 2026-09-12, as a step rather than a lift of the whole ladder** — see
item 4 for why positions 1–5 keep their old bands.

File: `curriculum/_build/generate_content/reading_seeds.py`, `N5_SEEDS`

| seeds | before | after |
|---|---|---|
| 1–5 | (30, 40) → (38, 50) | unchanged |
| 6 | (40, 53) | **(63, 78)** — MnN's shortest 読み物 is 63 words |
| 7 | (41, 55) | (64, 80) |
| 30 | (98, 126) | unchanged |

Positions 6–30 interpolate linearly between (63, 78) and (98, 126). N4's
ladder starts at (90, 112) and was left alone: every N4 band already clears
63 words.

### 4. Start the N5 ladder later — superseded by a step at position 6

**Decided 2026-09-12 by the maintainer, and built.** This item originally
asked for seed 1 to open at `vocab_cutoff: 190` / `grammar_cutoff: 24`, which
means the level has no beginner passage at all. Rejected: reading starts at
the first passage, and the MnN register arrives later.

What was built instead:

- **Positions 1–5 are untouched** — window *and* word band. They are the
  pre-linker set: their `grammar_cutoff` (10 → 20) stops short of から (point
  21) and ので (22), so they *cannot* join two clauses, and MnN's own L4 and L7
  join none either. Short and choppy is the correct shape there, and § Finding
  1's own table is the evidence.
- **From position 6 the cutoff ladder runs one seed ahead**: position 6 carries
  what position 7 used to (`vocab_cutoff` 176 → 190, `grammar_cutoff` 22 → 24),
  position 7 what 8 used to, and so on to position 29, which reaches 718 / 74.
  Position 30 is unchanged. Every passage from 6 on therefore has one extra
  thematic band of nouns to chain sentences out of, and each seed's topic still
  sits inside the band its own cutoff opens.
- Position 6 is also exactly where から and ので enter the window, so the
  prompt's conditional linker rule (item 1) switches on at the same passage the
  word band steps at. Nothing had to be tuned to make those two line up.

Fallout, all mechanical and all fixed in the same change:

- `pull_forward` lost four words the raised cutoffs swallowed (`tsukue` at
  position 10, `sagasu` at 22, `kotoba` and `imi` at 23) — `ladder_errors`
  rejects a pull-forward that is already inside the cutoff.
- Position 17 dropped `pull_forward_grammar`: its `grammar_cutoff` is now 50,
  which contains `_ADJECTIVE_POINTS` (47–50) outright. Positions 1–16 still
  carry the block, so the constant's rule is unchanged.
- `required_grammar` needed no reassignment. Coverage is still 74/74 with one
  owner each, because a cutoff only ever rose and a point already inside a
  window stays inside a wider one.
- The fixture pins held: position 7 is at `grammar_cutoff` 26 (must be < 29,
  its bad fixture being ている at point 29) and position 9 at 32 (must be ≥ 28).
  Their `target_words` moved, so the three length-sensitive fixture bodies were
  rewritten — see § Verification.

### 5. Give the readings a cast — optional

**Deferred 2026-09-12** — not built; the maintainer kept this pass to items
1–4.

New file, or a readings section in `prompts/cast-bible.md`, wired into
`reading_context.py` so every seed's prompt carries it.

Three or four named people reused across the level, third person, so that
Finding 6's subject-dropping becomes possible. Today's per-seed `extra_allowed`
names (リサ, ユキ, タマ) become the cast list instead.

This is a content decision, not a mechanical one — confirm the cast with the
maintainer before writing 30 passages against it.

### 6. Add a contrastive が point — optional, has a renumbering cost

**Deferred 2026-09-12** — not built. Note that the step at 6 did not touch
`sort_order`, so the +1 review this item costs is the same size as before.

`generate.py:503` assigns `sort_order` from list position, so inserting
`ga-contrast` next to `kara-because` shifts points 21–74 to 22–75, and every N5
seed's `grammar_cutoff` needs a +1 review. Appending it at position 75 avoids
the shift but puts it after the whole level, where no passage can use it.

Only do this if the maintainer wants the MnN L8 register. から, ので and て
already cover clause linking from seed 6 on, which is enough for item 1 to work.

If it goes ahead it needs: a full entry in `n5_grammar.py` (examples,
`accepted_forms`, `cloze_variants`, `family: "connectors"`), a `接続助詞` rule
in `grammar_detect.py` next to line 245, a grammar lesson, and a
`required_grammar` assignment on one seed.

### 7. Give the gate teeth — optional

**Waiting on the first regenerated batch 2026-09-12**, as this item asks.

File: `curriculum/_build/generate_content/validate_readings.py`

Only worth building if item 1's prompt text does not hold across a full
regeneration. Judge that from the first batch of 8, not in advance.

- A minimum count of clause-joining sentences, from a new seed field, checked
  only when the seed's window contains a linker.
- A lexical-chain check: every sentence after the first shares a content word
  with an earlier sentence.

### 8. Paragraph support — optional, touches the app

**Deferred 2026-09-12** — not built; no app code was touched by this work.

- `mobile/src/components/read/PassageBody.tsx` — render one `flex-row
  flex-wrap` per paragraph inside a column, instead of one for the whole body.
- `mobile/src/core/content/passageBodyParts.ts` — split the body on `\n` before
  chunking; keep the word-span offsets correct across the split.
- `validate_readings.py:257` — allow a single `\n`, keep rejecting the rest.
- `prompts/reading-passage.md` — say when to break (a time shift or a place
  shift, at most one break).

Word spans are UTF-16 offsets into `body`, so the newline must be counted in
them. Check `passageRepository.ts` and the `PassageBody` tests.

---

## Verification

Run from `curriculum/_build/` with the checked-in venv.

```bash
.venv/bin/python -c "from generate_content import reading_seeds as r; print(r.seed_errors('n5'))"
.venv/bin/python -m generate_content.validate_readings --fixtures
.venv/bin/python -m generate_content.generate_readings context --level n5 --slugs <seed> --show-prompt
```

**Run 2026-09-12, after items 1–4:**

- `seed_errors('n5')` and `seed_errors('n4')` — both clean.
- `validate_readings --fixtures` — **11/11**. Three fixture bodies had to be
  rewritten for the new bands: the two `expect: pass` ones (`neko-to-shukudai`
  43 → 77 words, `eki-made-no-michi` 62 → 77) and `bad/too-long` (76 → 100,
  its `expect` string now reads `the seed asks for 64–80`). The six other bad
  fixtures are mutations of those two bodies and were re-derived from the new
  ones, so each still isolates exactly one failure. The rewritten good bodies
  are written to the item-1 rules — subject named once then dropped, one から
  join, sentences opening on でも and それから — so the fixture set now shows
  the register it gates.
- All 30 N5 prompts and all 30 N4 prompts build (`generate_readings context`).
- `grammar_detect --selftest` 37/37, `--calibrate` 98.9% — untouched, as the
  scope guard requires.
- `validate_readings --level n5` on the 8 existing drafts: positions 1–5 still
  pass, positions 6, 7 and 8 now fail on the word band alone (51/55/58 words
  against 63–78, 64–80, 66–82). That is the intended verdict — those three are
  regenerated, not repaired.
- The 10 shipped N5 passages, which `audit_shipped` re-validates against the
  seed at the same position, are 40–110 words; they were written at MnN scale
  under the retired window. The new bands move nine of them *closer*, and
  position 6 (69 words) now passes a band it previously failed.

**Run 2026-09-12, first regenerated batch (all 8 existing N5 drafts):**

All 8 drafts were set to `status: "failed_validation"` and regenerated through
[the subagent workflow](../workflows/reading-passages-subagent-workflow-automation-prompt.md)
(opus-5, batch-size 1). Every seed passed on the first ingestion attempt — no
repairs, no fourth-attempt fallbacks.

| Passage | words | chars | sentences | avg sentence | sentences joining 2 clauses |
|---|---:|---:|---:|---:|---:|
| our draft 1 `hajimete-no-jikoshoukai` | 36 | 70 | 8 | 8.8 | 0 |
| our draft 2 `mainichi-onaji` | 43 | 79 | 8 | 9.9 | 0 |
| our draft 3 `nanimo-nai-nichiyoubi` | 43 | 72 | 5 | 14.4 | 0 |
| our draft 4 `dare-no-heya` | 46 | 79 | 6 | 13.2 | 0 |
| our draft 5 `sasoi-ga-fueru` | 47 | 82 | 6 | 13.7 | 0 |
| our draft 6 `zenbu-sukoshi-itai` | 74 | 125 | 7 | 17.9 | 2 |
| our draft 7 `neko-to-shukudai` | 76 | 125 | 8 | 15.6 | 2 |
| our draft 8 `shio-to-satou` | 78 | 135 | 6 | 22.5 | 4 |

**Positions 1–5** — judged on subject-dropping and lexical chaining, not
length or linkers (item 4): every draft names its subject once and drops it
for the following sentence or two, and each chains through a reused noun
rather than jumping topics — draft 1 runs ここ→学校→部屋→窓→友達, draft 4
reuses 部屋 across the family's room, the narrator's room and the cat's room,
draft 3 threads 日曜日 through a diary conceit. 0/8 sentences join two clauses
at every position, as designed: the window has no linker until position 6.

**Positions 6–8** — all land inside their target band (63–78 / 64–80 / 66–82)
and all clear "at least 2" clause-joining sentences (2, 2, 4). Both also read
as single scenes with a callback, not a list of facts: draft 7 closes on the
cat still asleep on the homework it opened on, draft 8 closes on the friend
asking for the mixed-up bento again. `body_furigana` is present on all 8 and
no question is missing `prompt_furigana` where its prompt has kanji.

**Corrections on 2026-09-13, after an outside read of the batch.** Two drafts
were wrong in ways the gate does not catch. Both are re-ingested above and the
table reflects the corrected text.

- **Draft 2** said `昨日はこれです` — a past time word with a present copula.
  Corrected to `昨日はこれでした`, and `猫が待ちます` to `猫が私を待ちます`.
  The gate checks level, not tense agreement.
- **Draft 3** said `私の本の月曜日` — "my book's Monday", which is not
  Japanese. The cause is the seed, not the generator: the topic asks for the
  writer's *calendar*, but at `vocab_cutoff: 118` no writing surface is
  reachable — ノート is `sort_order` 265, 紙 is 238, and カレンダー is not in
  N5 at all. 本 was the nearest allowed noun. Fixed by adding `nooto` to that
  seed's `pull_forward`, which is what the field is for.

### The seed sweep the draft-3 failure asked for

Draft 3 was not a one-off. **When a seed topic names a concrete object, that
object has to be checked against the seed's own `vocab_cutoff`** — nothing in
the loop does it, the generator substitutes the nearest in-level noun, and the
passage clears every gate while saying something no one would write. All 60
seeds were swept on 2026-09-13. Two classes came out.

**Reachable, fixed** — the word is in the level but past the cutoff, so
`pull_forward` covers it. Seven seeds, all corrected:

| seed | word | sort_order | cutoff | missed by |
|---|---|---:|---:|---:|
| n5-20 `dekiru-hito` | 歌う | 444 | 440 | 4 |
| n5-12 `hako-no-naka-no-fuyu` | 冬 | 292 | 284 | 8 |
| n5-16 `ichido-dake-shita-koto` | 有名 | 365 | 356 | 9 |
| n5-19 `junban-ga-okashii` | 試験 | 483 | 420 | 63 |
| n5-15 `motte-ikanakereba` | 旅行する | 474 | 340 | 134 |
| n5-11 `kagi-wa-doko` | 外 / 引き出し | 521 / 635 | 270 | 251 / 365 |
| n4-4 `souji-no-nikki` | 日記 | 519 | 60 | 459 |

Three of those miss by under ten places, which is why the failure is easy to
ship: the window is *almost* right. `dekiru-hito`'s topic is "the older
brother can sing" and 歌う sits four words past its cutoff.

**Not reachable at all** — absent from n5 and n4 both, so `pull_forward`
cannot help. These need the topic rewritten or the word added to the level,
and they are still open:

`ポスター`, `規則`, `ボタン`, `押す`, `屋根`, `建物`, `訓練`, `誕生日`,
`カード`, `玄関`, `葉`, `まっすぐ`

Three seeds are named for a word the curriculum does not contain:
`posutaa-no-yakusoku` (no ポスター), `nazo-no-bukatsu` (no カード), and
`setsumeisho-doori`, whose whole topic is "press this button" with neither
ボタン nor 押す in reach.

### Furigana: round-tripping is not correctness

Also found from this batch and now fixed at the cause. `曜日` rendered as
`曜[よう]日[ひ]`; the reading is び. unidic splits 月曜日 into 月曜 + 日 and
reads that 日 from its own lemma. The right reading was in JmdictFurigana the
whole time — nothing consulted it for a noun+noun pair.
`furigana._suffix_compound_notation` already did this repair, but only when
the second token is tagged 接尾辞, and here it is 名詞.

`furigana._split_compound_notation` now covers the noun+noun case. Three
guards, in the order they matter:

1. **Every token in the span carries kanji**, so a following particle cannot
   be swallowed — 今日 + は is not the greeting こんにちは.
2. **The dictionary lists exactly one reading** for the compound. This is the
   load-bearing guard. 三分 is both さんぷん (three minutes) and さんぶん (a
   third); its primary is さんぶん, so forcing that onto a passage about three
   minutes swaps one wrong reading for another. 十分, 三十分, 四時, 日本人,
   一昨日 and 二十歳 are held back the same way.
3. **Either the span is solid kanji, or the readings differ only by voicing.**
   One reading and no okurigana is already strong evidence of a broken
   compound, which is what lets the counters through. The voicing test
   additionally admits the rare compound that does carry kana — without
   admitting 日待ち, whose reading here (かまち) is a different mora, not a
   sound change, because the text is 日 + 待ち and 日待ち is an unrelated word
   that happens to match the surface.

Repaired: 曜日 ×7, 九時 くじ, 七時 しちじ, 二日 ふつか, 四日 よっか, 七日
なのか, 八日 ようか, 四人 よにん, 一匹 いっぴき, 一本 いっぽん, 一回 いっかい,
一週間 いっしゅうかん, 一ヶ月 いっかげつ, 外国人 がいこくじん, 世界中
せかいじゅう, 三本 さんぼん, 二本 にほん, 昼頃 ひるごろ.

`furigana.suspect_compound_readings` is the detector for what the repair
deliberately will not touch, and `validate_readings` step 5b fails a passage
on it. Round-tripping only proves the brackets strip back to the input, which
is consistency and not correctness. The detector consults **both** repair
paths before reporting: 日本人 has two dictionary readings so the split repair
holds off, but `_suffix_compound_notation` already gets it right, and flagging
it would fail a passage with nothing wrong.

Verified: 3,962 sentences across the whole shipped curriculum re-annotated
with zero round-trip failures and zero nulls, 11/11 gate fixtures, all 8 N5
drafts still pass, seed/ladder/coverage/tone clean on both levels, and
`passages/n5.json` reassembled so the stored furigana carries the fix.

**Still open.** Seven compounds remain, and the detector reports rather than
repairs them because the reading the dictionary prefers is not certainly the
one the sentence means: 一昨日 (いっさくひ ×3, いっさくにち ×1), 三十分 ×2,
四時 ×2, 十分 ×1, 三分 ×1. Plus `日待ち` ×9, the known false positive above.
All of them sit in shipped `vocabulary/`, `kanji/`, `grammar/` and `readings/`
JSON, which is reviewed content and is deliberately left alone — a future
regeneration picks up the repair for everything the annotator now handles.

**Item 7 (validator teeth): not needed yet, with a caveat.** Item 1's prompt
text held across the full batch with zero repairs — the prompt-alone
mechanism works. But positions 6–8 were generated with an explicit "use at
least 2 linked sentences" reminder added on top of the base prompt, not from
the prompt file alone, so this batch is not a clean test of the prompt text
in isolation. A future batch (seeds 9–12, next in the ladder) generated
*without* that extra reminder — subagents told to follow the prompt file only
— would be the clean signal. If that batch still lands ≥2 joins per passage
unprompted, item 7 can stay unbuilt for good; if it doesn't, that is the
trigger to add the gate check.

22 of 30 N5 seeds remain unregenerated (the auto-select in Step 1a of the
subagent workflow picks up wherever this run left off).

## Scope guards

- Do not rewrite the ten shipped N5 passages by hand. The expansion plan already
  replaces all of them by generation.
- Do not change the question format. MnN uses ○/× true-false plus a picture
  pick; ours are open questions with `accepted_answers`, and the app's answer
  path depends on that. It is a separate decision, not part of this work.
- Do not touch `grammar_detect.py` recall calibration. It is at 98.8% and the
  only change proposed here is one added rule under item 6.

---

## Reference texts

The five Minna no Nihongo I 読み物 passages used for every measurement above.
Transcribed from the photos; furigana and the printed word spacing are dropped.

**L4 ミラーさんの毎日** — 97 words, 172 chars

> ミラーさんは毎朝7時に起きます。朝ごはんはいつもパンとコーヒーです。電車で会社へ行きます。会社は9時から5時までです。7時にうちへ帰ります。7時半に晩ごはんを食べます。それからテレビを見ます。英語の新聞を読みます。夜12時に寝ます。
>
> 土曜日と日曜日会社は休みです。土曜日の朝図書館へ行きます。午後テニスをします。日曜日どこも行きません。休みます。

**L7 土曜日と日曜日** — 63 words, 117 chars

> けさ図書館へ行きました。図書館で太郎ちゃんに会いました。太郎ちゃんといっしょにビデオを見ました。わたしは旅行の本を借りました。
>
> あしたは日曜日です。朝旅行の本を読みます。午後デパートへ行きます。花を買います。母の誕生日のプレゼントです。

**L8 ワット先生** — 73 words, 147 chars

> ワットさんはさくら大学の英語の先生です。毎日赤い車で大学へ行きます。さくら大学は大きい大学ではありませんが、いい大学です。ワットさんはいつも食堂で昼ごはんを食べます。食堂は12時から1時までとてもにぎやかです。食堂の食べ物はおいしいです。そして、安いです。大学の仕事は忙しいですが、楽しいです。

**L9 山田さんとダンス** — 67 words, 130 chars

> 山田さんはダンスが好きです。毎晩ダンスの学校へ行きます。ダンスの先生はきれいな人です。山田さんは上手ではありませんが、きれいな先生に習いますから、毎日楽しいです。先生の誕生日にコンサートのチケットをあげました。先生は友達と行きました。山田さんはとても残念です。

**L10 わたしのうち** — 97 words, 177 chars

> わたしの新しいうちは静かな所にあります。うちの隣にきれいな公園があります。公園の前に図書館と喫茶店があります。わたしは図書館で本を借ります。そして、公園で読みます。時々喫茶店で読みます。喫茶店のコーヒーはおいしいです。うちの近くに郵便局と銀行があります。郵便局と銀行の間にスーパーがあります。スーパーの中に花屋やおいしいパン屋があります。とても便利です。
