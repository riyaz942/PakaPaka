# Kanji coverage & dependency order — plan

Goal: make the app's core promise literally true — **every kanji in a word is taught
before the word is**. Today it is not, for 55% of the vocabulary we ship.

Analysis date: **2026-08-16**, against `curriculum/` at commit `3927a8d`.

## The problem

`isItemUnlocked` (`mobile/src/core/content/dependencyGraph.ts:3`) is correct: an item
unlocks only when every parent is `known` or `in_progress`. The break is upstream —
`generate_deps.py` creates kanji→vocabulary edges by scanning vocab `primary_form` for
kanji **that exist in the curriculum**. A kanji we never authored produces no edge, and a
word with no parents is unlocked by definition.

写真 (N5 vocabulary) is the worked example: neither 写 nor 真 is authored, so the word has
zero parents and reaches the learner with no chain behind it.

### Measured

| | Count |
| --- | ---: |
| Kanji authored (N5 106 + N4 86) | 192 |
| N5+N4 vocabulary items | 1,247 |
| …with every kanji taught | 562 (45%) |
| …with at least one untaught kanji | 685 (55%) |
| Distinct kanji needed but not authored | 554 |
| Words whose kanji *are* authored, but at a later level | 81 |

The 554 missing kanji, by KANJIDIC difficulty (old JLPT tag, 4 = easiest):

| Difficulty | Count |
| --- | ---: |
| ≈N4 or easier (tags 4, 3) | 104 |
| ≈N2 (tag 2) | 356 |
| ≈N1 (tag 1) | 73 |
| Untagged | 21 |

### Why this is structural

JLPT vocabulary lists routinely use kanji far above their own level — 写真, 病院, 勉強,
便利 are all N5/N4 words built from ≈N3–N2 kanji. **JLPT-level ordering and
radical→kanji→vocabulary ordering cannot both be the gate.** WaniKani avoids the
collision by discarding JLPT levels entirely and inventing its own 60.

## Decision

Dependency order wins. JLPT level stays as a **label and filter**, not a gate.

When a word needs a kanji from a higher level, that kanji is pulled forward into the
lesson sequence immediately before the word, still tagged with its true JLPT level
everywhere it is displayed (Browse, filters, item detail).

Rejected alternatives:

- *Restrict vocabulary to same-level kanji* — guts the N5/N4 word lists; the learner
  never meets 写真.
- *Keep the status quo* — the radical→kanji→vocabulary promise is false for 55% of words,
  silently.

## Critical sequencing constraint

**Authoring N3+ kanji makes the app worse until the planner change lands.**

`useLessonPlan.ts:150` scopes lesson candidates to one JLPT level, advancing only when
that level is exhausted. The moment 写 exists as an N3 item, `generate_deps.py` emits
写→写真, and an N5 learner can never satisfy that parent — the planner will not offer them
an N3 kanji. Those 685 words go from *unlocked with no chain* to **permanently locked**.

So: ship the skeleton with kanji→vocabulary edges **held**, or ship it together with the
pull-forward planner change. Never the skeleton with edges on and the old planner.

## Phases

### Phase 1 — same-curriculum ordering (no new content) — **done 2026-08-16**

81 words whose kanji are already authored, just at a later level.

1. Report the 81 pairs and pick per word: move the kanji earlier, or move the word later
   → verify: report committed under `curriculum/_build/reports/`
2. Apply the `sort_order` / level moves in `curriculum/**/*.json`
   → verify: `npm run validate-schema` clean; re-running the report yields 0 pairs
3. Rebuild the graph and compile
   → verify: `npm run compile-curriculum`; no new orphan edges

**Outcome.** `curriculum/_build/reports/dependency_order.py` is the checked-in generator;
it writes `dependency-order.md` / `.json` next to itself. Measured against the real graph,
the 81 pairs are two different populations:

| | Count | Severity |
| --- | ---: | --- |
| N5 words gated by an N4 kanji | 115 words / 71 kanji | unreachable for all of N5 |
| Words gated by a kanji later in the *same* level | 6 | deferred only, self-heals |

Only `requires` (kanji → vocabulary) edges gate a lesson — `useLessonPlan.ts` reads
`getRequiredParentsForItems`. `builds_on` and `reinforces` are shown but never block, so
their ordering is reported as INFO.

The 6 same-level cases are fixed: 彼女, 何時, 経済, 説明, 習慣, 親 (and 社会, displaced by
the others) moved to a later group whose theme still fits, always *after* the kanji they
are written with. The moves are in `n5_vocab.py` / `n4_vocab.py`, so a regeneration keeps
them.

The 115 cross-level words are **deliberately left alone**. Both available moves lie about
JLPT level — relabelling 71 of N4's 86 kanji as N5, or relabelling 115 common N5 words as
N4 — and Phase 3's pull-forward planner has to solve the same problem for the 553 untaught
kanji anyway. The report keeps them as ERROR until then; that is the expected state.

### Phase 2 — N3/N2/N1 skeleton, edges held — **done 2026-08-16**

Item lists only — slug, `primary_form`, `meaning`, `accepted_answers`, `sort_order`. No
mnemonics, no examples, no passages.

1. Generate N3–N1 radical / kanji / vocabulary item lists into `curriculum/`
   → verify: `npm run validate-schema` clean
2. Radicals need `visual_mnemonic_url` — it is required by
   `curriculum/schema/curriculum.schema.json:46`, the only mnemonic-adjacent field that
   is. Either author the art or make the field optional for skeleton levels first
   → verify: schema validation passes without placeholder URLs pointing at missing files
3. Hand-curate the radical→kanji decomposition map for the new levels in
   `generate_deps.py` (the `N5_DECOMPOSITION` pattern). **This is the real labour of the
   skeleton** — kanji→vocabulary is automatic, radical→kanji is not
   → verify: every new kanji has ≥1 radical parent; no edge names an unknown slug
4. Suppress kanji→vocabulary edges from skeleton-level kanji until Phase 3
   → verify: unlocked-item count for a fresh N5 profile is unchanged from today

Kanji and vocabulary mnemonics are genuinely optional — the schema does not require them,
`compile-curriculum` writes them as null, and the app renders around absence
(`hasCurriculumMnemonic`). Skeleton radicals are the only item type that costs art.

**Outcome.** `curriculum/_build/import/build_skeleton.py` derives the dataset from
KANJIDIC2 + KRADFILE and writes `curriculum/_build/skeleton.json`, which is checked in so
`generate.py --level n3|n2|n1` and `generate_deps.py` never need the source archives.
Coverage is now **100%**: every kanji in every shipped N5/N4 word is taught somewhere.

| | N3 | N2 | N1 | Total |
| --- | ---: | ---: | ---: | ---: |
| Skeleton kanji | 104 | 356 | 93 | 553 |
| New radicals | 4 | 6 | 0 | 10 |
| `builds_on` edges | 257 | 1,038 | 294 | 1,589 |

Decisions taken against the four steps:

- **Scope** — the 553 kanji shipped vocabulary actually needs, nothing else. N3+ vocabulary
  would drag in its own untaught kanji and restart the problem one level up.
- **Level** — KANJIDIC2's old-JLPT tag (4/3 → N3, 2 → N2, 1 and untagged → N1). Six kanji
  carry tag 4 — 何 空 父 母 友 魚. Those are **gaps in the shipped N5/N4 kanji lists**, not
  N3 content; they sit at N3 with the rest until Phase 4 authors them properly.
- **Art** — `visual_mnemonic_url` is no longer required by the schema (open decision 3).
  Skeleton radicals carry neither it nor `mnemonic_text`, rather than naming a `.webp`
  nobody has drawn. All 122 authored radicals still ship theirs.
- **Decomposition** — machine-derived from KRADFILE rather than hand-curated. A skeleton
  kanji has no mnemonic for a curated decomposition to agree with, so KRADFILE *is* the
  right source; Phase 4 curates per kanji as it authors one. Only 10 new radicals were
  needed: 553 minus the 543 that the 122 already-taught radicals decompose. `build_skeleton.py`
  fails the build if a future kanji has no taught component, rather than shipping it parentless.
- **Held edges** — `generate_deps.py` emits **zero** `requires` edges from skeleton kanji.
  The `requires` and `reinforces` edge sets are byte-identical to before the skeleton, so no
  item's unlocked state moved; only `builds_on` grew (325 → 1,914).

`generate_content/audit_shipped.py` skips skeleton levels by default — every content check
it runs would fire on all 553 by design. `--level n3` still audits one on purpose. Its
`discover_levels()` now globs every item kind, not radicals alone: N1 teaches kanji whose
components are all already taught, so it ships no radicals file and was invisible to the
`content_counts` cross-check.

**Known, deliberate: three WARNINGs about 方.** It is the one new radical that an authored
kanji also uses — 方 (`n4-hou`) itself, 遊 and 族. `katahen` sits at N3, where the skeleton
kanji 旅 needs it, so those three N4 kanji get no edge to it and 方's own kanji still ships
with no component chip. The alternatives were both worse: an entry in
`DECOMPOSITION_EXCEPTIONS`, whose contract is "KRADFILE and pedagogy genuinely disagree",
not "we haven't got to it"; or promoting 方 to an N4 radical now, which puts a
mnemonic-less, art-less card into a lesson a learner reaches today. Phase 4 resolves it by
authoring 方 properly. Nothing about the N4 chips changed — the warnings are newly *visible*,
not newly true.

### Phase 3 — planner pull-forward, JLPT as label

1. Lesson candidate pool becomes *current level's items + their transitive unmet parents*,
   in dependency order (`useLessonPlan.ts`, `lessonPlanner.ts`)
   → verify: new unit test — an N5 profile is offered 写 and 真 before 写真
2. Pulled-forward items keep their true JLPT level in Browse, filters, and item detail
   → verify: 写 renders as N3 in Browse while appearing in an N5 lesson
3. Turn on kanji→vocabulary edges for skeleton-level kanji — delete the
   `skeleton_kanji_slugs` skip in `generate_deps.py`'s `requires` loop. 479 kanji-bearing
   words currently have no `requires` parent and gain one
   → verify: 0 vocabulary items reachable with unmet parents; no item permanently locked
4. Existing planner tests still pass
   → verify: `npm test` in `mobile/`

### Phase 4 — author kanji by reuse count

Order the 554 by how many words each unblocks; flip edges on as coverage lands.

| Kanji authored | N5+N4 vocab with a full chain |
| ---: | ---: |
| today (192) | 45% |
| +100 | 61% |
| +200 | 74% |
| +300 | 81% |
| +554 | 100% |

Each kanji pulled into an N5/N4 lesson needs its mnemonic **at that moment** — the
"skeleton has no mnemonics" rule holds only for the tail nobody reaches yet. Realistically
most of the 554 need full content.

## Interaction with the mnemonic pipeline

`reading_regularity()` (`curriculum/_build/generate_content/mnemonic_context.py`) classifies
a reading as regular only when every kanji is *taught*, so untaught kanji force the
"write a full reading story" branch. Re-judging the 430 story-bearing words against
KANJIDIC:

| Count | Bucket | Example |
| ---: | --- | --- |
| 157 | pure on'yomi jukugo | 写真, 番号, 勉強, 便利 |
| 222 | single kanji, kun reading | 秋, 危ない, 明るい |
| 29 | mixed regular | 場所, 茶色 |
| 20 | genuinely irregular | 明日, 部屋, 明後日 |

~390 words carry a reading story for a reading that is not actually irregular. **Phase 4
fixes this at the root** — as kanji coverage lands, those words reclassify to `regular` and
earn the existing one-line derivation note with no rule change. An interim rule that
relaxes the regularity check is only worth building if Phase 4 is deferred.

## Open decisions

1. **Interim regularity rule** — add a fifth kind for dictionary-regular readings whose
   kanji are untaught (short note for the 157 jukugo, keep stories for the 222 kun words)?
   Only needed if Phase 4 slips.
2. **Vocabulary meaning length** — current prompt targets 180–330 chars, actual median 315,
   WaniKani reference ~124. Options: (A) tighten the rule and regenerate all 754,
   discarding the 709 reviewed N5 entries; (B) apply to the 45 drafts and new levels only;
   (C) length-only trim, regenerate all.
3. ~~**Skeleton radical art**~~ — resolved in Phase 2: `visual_mnemonic_url` is optional and
   skeleton radicals omit it. The 10 new radicals owe art at the moment Phase 3 first pulls
   one into an N5/N4 lesson, not before.

## Out of scope

- N3+ mnemonics, example sentences, grammar lessons, reading passages
- Any change to FSRS scheduling or the review queue
- Re-ordering within N5/N4 beyond the 81 Phase 1 cases

## Reproducing the numbers

Coverage and ordering (this document's first two tables):

```bash
python3 curriculum/_build/reports/dependency_order.py
```

It exits 1 while any cross-level gate remains, and writes
`curriculum/_build/reports/dependency-order.md` / `.json`. Its coverage table counts
kana-only words as a full chain, which is how the 45% above was measured.

Rebuilding the skeleton after the shipped vocabulary changes (needs the EDRDG archives from
`curriculum/_build/import/fetch_sources.sh`):

```bash
python3 curriculum/_build/import/build_skeleton.py
python3 curriculum/_build/generate.py --level n3   # and n2, n1
python3 curriculum/_build/generate_deps.py
```

The KANJIDIC difficulty split and the reading-story buckets are still ad-hoc, over
`curriculum/_build/generate_content/mnemonic_context.py` and
`curriculum/_build/data/kanjidic2.xml.gz`.
