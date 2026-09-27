# Level-agnostic curriculum plan

**Status:** Phase 0 done 2026-09-27 (see "Phase 0 results"). Phase 1 not started. No code or
content has changed yet.

**Goal:** a radical, kanji, word, grammar point or passage can move to a different JLPT level by a
one-line edit, and the move does not change its slug, its item id, its content files or the
learner's progress.

The app has no public users yet, so slugs and item ids can change **one time** now. After this plan
lands, they never change again.

## Read first

- `CLAUDE.md`: hard conventions (Result type, dual DB, never write `curriculum.db` by hand).
- [`curriculum-schema-migration-plan.md`](./curriculum-schema-migration-plan.md): Phase A of that
  plan (frozen item ids, `curriculum/id-registry.json`) **is** phase 1 of this plan. Use its design.
  Do not make a second registry.
- `docs/working-history.md`: update the row for this plan when a phase status changes.

## Decisions (made by the maintainer, 2026-09-27)

| Question | Decision |
| --- | --- |
| Slug style for kanji | English meaning, for example `private`. About 90% of kanji already use this style (the `k-` ones). Not the character itself. |
| N5/N4 grammar points that teach the same thing | **Merge** each pair into one item. |
| Content sidecar layout | **One file for each kind**, keyed by slug. Not one file for each item. |
| Radical art | **Move** to one folder, `mobile/assets/radicals/<slug>.webp`. |
| Old backups | **Rewrite the maintainer's backup file one time** to the new slugs. The app does **not** keep old-slug aliases for restore. |
| Phase order | 0 → 1 → 2 → 3 → 4 → 5. |

## Why the current layout is a problem

### 1. "n5" in a file name means two different things

| File | What `n5` / `n4` / `k` means |
| --- | --- |
| `kanji/n5.json`, `radicals/n5.json` (shipped) | The level the item is taught at. `_build/bands.json` sets it. |
| `kanji/mnemonics/{n5,n4,k}.json`, `radicals/mnemonics/{n5,n4,k}.json` | The source file that first defined the item: `n5_kanji.py`, `n4_kanji.py`, or `k` (the derived KANJIDIC list). This never changes. |
| `vocabulary/mnemonics/n5.json`, `vocabulary/examples/n5.json` | The level again, because vocabulary has no bands. |

So a kanji in `kanji/mnemonics/k.json` can ship in `kanji/n5.json`. The build handles this
(`generate.py`, `generate_mnemonics.py`), but a person who reads the files cannot see it.

### 2. Moving an item is hard

- Kanji and radicals from `n5_kanji.py` / `n4_kanji.py` are locked to that file's level
  (`curriculum/_build/reports/kanji_bands.py`, near `bands.update(PINNED_DERIVED)`). To move one, you
  must cut it out of one `.py` file and paste it into the other. Only derived (`k`) items can move,
  through `PINNED_DERIVED`.
- To move a word, you edit 3 files: the `n5_vocab.py` / `n4_vocab.py` source, the mnemonic sidecar
  and the examples sidecar.
- Radical art has the same problem: `mobile/assets/radicals/{n5,n4,k}/`.

### 3. Item ids are positional

`assignItemIds` in `scripts/compile-curriculum.ts` sorts items by `(jlpt_level, item_type, slug)`
and assigns `index + 1`. Reading passage ids are the insert order. `user.db` stores progress by these
integers. If one item moves or is added, most ids change, and progress points at the wrong items.
See Defect 2 in the schema migration plan.

### 4. Slugs carry a level

| Kind | Slugs with a level | Example |
| --- | --- | --- |
| Kanji | all 2,000: 1,808 derived (`k-`), 192 hand-written (`n5-`, `n4-`) | `n5-aka`, `k-private` |
| Grammar | 97 N4 points (`n4-`) | `n4-node` |
| Radicals, vocabulary | none | `aka`, `ginkou` |

If you only delete the prefix, these problems occur. The counts come from the 2026-09-27
investigation. **Measure them again in phase 0.**

| Problem | Count |
| --- | --- |
| Two kanji get the same name: `n5-go` / `k-go`, `n4-ri` / `k-ri` | 2 pairs |
| A kanji gets the same name as a radical (`aka`, `add`, …). `visually_similar_slugs` does not say which kind it points at. | 364 |
| Grammar lesson files are stored by level (`grammar/lessons/n4/n4-ageku.md`) | 97 |
| N5 and N4 grammar points that teach the same thing | 9 found, more are possible |

The 9 grammar pairs found so far:

| N5 | N4 |
| --- | --- |
| `node-because` | `n4-node` |
| `te-iru` | `n4-teiru-progressive` |
| `te-wa-ikenai` | `n4-tewaikenai` |
| `nakutemo-ii` | `n4-nakutemoii` |
| `nakereba-naranai` | `n4-nakerebanaranai` |
| `te-mo-ii` | `n4-temoii` |
| `sugiru` | `n4-sugiru` |
| `deshou` | `n4-deshou` |
| `kamoshirenai` | `n4-kamoshirenai` |

`n4-node-vs-kara` is a contrast point, not a duplicate. Do not merge it. `n4-teiru-result` is a
different use of ている. Do not merge it with `te-iru` unless the audit shows the same content.

---

## Phase 0: Baseline

### Work

1. The working tree has uncommitted changes in `curriculum/radicals/`. Ask the maintainer to commit
   or stash them. Do not start before the tree is clean.
2. Run `npm ci && npm run validate-schema && npm run compile-curriculum` at the repo root.
3. Save a copy of these outside the repo (for example `/tmp/level-agnostic-baseline/`):
   - every shipped `curriculum/{radicals,kanji,vocabulary,grammar,readings}/n*.json`
   - the compiled `curriculum.db`
   - `SELECT item_type, slug, id, jlpt_level, sort_order FROM items` as CSV
4. Measure the counts in "Slugs carry a level" again and record the results in this file.

### Verify

- Compile, `validate-schema` and the repo-root tests pass. `npm test` and `npm run lint` pass in
  `mobile/`.

### Phase 0 results (2026-09-27)

**Baseline:** `/tmp/level-agnostic-baseline/`, built from commit `c6dbd76`. It holds the shipped
`n*.json` files, `curriculum.db` (curriculum version **22**, SHA-256 `b9d407f0…aa263e`),
`metadata.json`, `items.csv` (12,735 rows) and `git-head.txt`. `/tmp` is not permanent. Make the
copy again if it is gone before phase 2 ends.

**Checks:** `validate-schema` passes (21 files, warnings only). Compile passes. Repo-root tests:
62 pass. `mobile/` tests: 2,216 pass in 250 suites. `mobile/` lint: 0 errors, 1 warning that was
there before. There are no Python tests in `curriculum/_build/`.

**Items in the build:**

| Kind | N5 | N4 | N3 | N2 | N1 | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Radical | 148 | 107 | 180 | 105 | 277 | 817 |
| Kanji | 150 | 175 | 375 | 300 | 1,000 | 2,000 |
| Vocabulary | 718 | 529 | 2,250 | 2,250 | 4,000 | 9,747 |
| Grammar | 74 | 97 | — | — | — | 171 |

Reading passages: 60. Passage questions: 213.

**Slug counts, measured again:**

| Problem | Plan said | Measured |
| --- | ---: | ---: |
| Kanji slugs with a level: `k-` / `n5-` / `n4-` | 1,808 / 192 | 1,808 / 106 / 86 (192 hand-written) |
| Grammar slugs with a level (`n4-`) | 97 | 97 |
| Radical or vocabulary slugs with a level | 0 | 0 |
| Two kanji get the same name (`n5-go` / `k-go`, `n4-ri` / `k-ri`) | 2 pairs | 2 pairs, the same ones |
| A kanji gets the same name as a radical | 364 | 364 |
| A kanji gets the same name as a vocabulary word | not measured | **61** |
| Two grammar points get the same name (`deshou`, `kamoshirenai`, `sugiru`) | not measured | 3 |
| Grammar lesson files stored by level | 97 | **171** (97 in `lessons/n4/`, 74 in `lessons/n5/`) |
| Known N5/N4 duplicate grammar pairs | 9 | 9 (a form screen finds all 9) |

**New facts for later phases:**

- Phase 2, cross-references: 61 kanji share a name with a vocabulary word, not only with a radical.
  A kind-tagged reference must also tell kanji and vocabulary apart.
- Phase 2, grammar audit. A screen by shared form (`primary_form`, `accepted_forms`) and by meaning
  found these candidates in addition to the 9 known pairs. Put them in the side-by-side table:
  - `ta-koto-ga-aru` / `n4-koto-ga-aru`: the same structure (Verb-た + ことがある). The first N4
    example teaches experience, the same as N5. **Strong candidate.**
  - `no-nominalizer` / `n4-noda`: both accept のです / んです (explanatory). Partial overlap.
  - `darou` / `n4-deshou`: `n4-deshou` accepts だろう, so it overlaps two N5 points (`deshou` and
    `darou`). Decide the merge for all three together.
  - Different uses, probably not duplicates: `to-and` / `n4-to-conditional`, `kara-from` and
    `kara-because` / `n4-node-vs-kara`, `gurai` / `n4-kurai-degree`, `demo-suggestion` /
    `n4-temo`, `tame-ni` / `n4-tame`, `te-iru` / `n4-teiru-result`, `dake` / `n4-bakari`.
- Phase 3: grammar lessons for both levels move, so the lesson move touches 171 files, not 97.
- `curriculum/metadata.json` `content_counts.radicals` says 238, but the build has 817 radicals.
  The other counts agree. This plan does not fix it. Tell the maintainer.
- Each compile raises `metadata.json` `version` by 1. The phase 1 registry seed uses the phase 0
  build (version 22), not version 21.

---

## Phase 1: Permanent item ids

Implement **Phase A of the schema migration plan** as written, with these changes:

- Seed `curriculum/id-registry.json` from the phase 0 build. The plan text says `1.13.1`, which is
  out of date. The curriculum is now at version 21.
- Reading passages also get a slug and a registry entry (`passage:<slug>`). Their id comes from the
  registry, not from the insert order. `passage_questions` ids must be stable too. Key them as
  `<passage-slug>#<n>` or a similar key.
- Phase 2 renames slugs. It **rewrites the registry keys** and keeps the ids. Do not use the
  registry's `aliases` field for this one-time rename, because there are no public users. The
  `aliases` field is for renames after launch.

### Verify

- Add one N5 item in the middle of the sort order and compile again. Only the new row gets a new id.
- Move one item to a different level and compile again. No id changes.
- A compile that meets an unknown key without `--update-registry` fails.

---

## Phase 2: Remove levels from slugs, and merge duplicate grammar

### Work

1. **One rename map:** `curriculum/_build/slug-renames.json`. It maps `"<kind>:<old-slug>"` to
   `"<kind>:<new-slug>"`. A merge is two old keys that map to one new key. Phase 2 and phase 5 both
   read this file. Keep the file after phase 5, because it records the migration.
2. **Kanji:**
   - Remove `k-` from the derived kanji.
   - Give the 192 hand-written kanji an English-meaning slug, in the style the derived kanji use.
   - Give the colliding pairs (`n5-go` / `k-go`, `n4-ri` / `k-ri`) different slugs based on meaning.
     The maintainer's backup has data on `n5-go`, `k-go` and `n4-ri`, so check these entries by hand.
3. **Grammar:**
   - Remove `n4-` from the N4 slugs.
   - Do a full audit for duplicate pairs: compare `meaning`, `structure` and `primary_form`, not only
     the slug.
   - **Before you merge anything, show the maintainer a side-by-side table** of each pair (meaning,
     structure, explanation length, number of examples and cloze variants) and get approval.
   - Default rule: the merged item stays at **N5**. It keeps the better explanation. It gets the
     examples and cloze variants of both versions, without duplicates.
   - The reading-passage grammar coverage invariant (`reading_seeds.grammar_coverage_errors`)
     assigns every grammar slug of a level to exactly one seed. When an N4 point is merged away,
     every N4 seed whose `required_grammar` lists it must change, and the coverage check must pass
     again.
4. **Cross-references record their kind.** `visually_similar_slugs`, graph edges, `requires` /
   `builds_on` and any other slug list must say which kind a slug is, so that a kanji and a radical
   can share a name. Find every such field. Do not assume the list below is complete.
5. **One script does the rename.** It reads `slug-renames.json` and rewrites every source and every
   reference, including:
   - `_build/*.py` sources (`n5_kanji.py`, `n4_kanji.py`, `n4_grammar.py`, …), `bands.json`,
     `decomposition.json`, `visually_similar.py`, `graph.json`
   - the mnemonic and example sidecars
   - `generate_content/` (`grammar_detect.py` rules keyed by slug, `reading_seeds.py`, `MANUAL_SLUGS`,
     the drafts and passages artifacts)
   - `id-registry.json` keys (the ids do not change)
   - mobile tests and fixtures that use real slugs
   - `web/` (Curriculum Studio) if it uses slugs
6. **Validator rule:** `validate-schema` rejects a slug that matches `^(n[1-5]|k)-`.

### Verify

- Do a search for `\b(n[1-5]|k)-[a-z]` in `curriculum/`, `scripts/`, `mobile/src/` and `web/`. The
  only results must be in `slug-renames.json` and in text that is not a slug.
- Compare the compiled `items` table with the baseline CSV. Each row is the same except for the slug
  text, and the merged grammar rows are gone. Merged-away ids go to `retired` in the registry.
- All tests from phase 0 pass.

---

## Phase 3: One content file for each kind

### Work

1. Merge the per-level sidecars into one file for each kind, keyed by slug:
   - `curriculum/radicals/mnemonics.json`
   - `curriculum/kanji/mnemonics.json`
   - `curriculum/vocabulary/mnemonics.json`
   - `curriculum/vocabulary/examples.json`

   The 2026-09-27 check found 0 slug collisions across the sidecars of each kind. Check again after
   phase 2.
2. Move grammar lessons to `curriculum/grammar/lessons/<slug>.md`.
3. Move radical art to `mobile/assets/radicals/<slug>.webp`. Update the code that maps a slug to an
   image (find it with a search for `assets/radicals`). Also update the art workflow docs and
   prompts in `curriculum/_build/generate_content/web/radical-art/`.
4. Update every reader and writer of these files: `generate.py`, `generate_mnemonics.py`,
   `generate_examples.py`, the validators and audits, and the docs and workflow runbooks in
   `docs/workflows/` that name the old paths.

### Verify

- The shipped `n1`–`n5.json` files are **byte-identical** to the phase 2 output.
- Every radical that had art before still has art. Count the files before and after.

---

## Phase 4: One file sets every level

### Work

1. Add one level-override file, for example `curriculum/_build/levels.json`:
   `{ "kanji:private": "n5", "vocabulary:ginkou": "n4", "grammar:node-because": "n5", … }`.
   It replaces `PINNED_DERIVED` and works for every kind, including hand-written items. Hand-written
   items are no longer locked to the level of their `.py` file.
2. The build prints what a move breaks. Use the existing `level_check`. Examples:
   - an N5 example sentence that now uses an N4 word
   - a kanji whose `requires` edges now point at a later level
   - a reading seed whose window no longer contains a word or grammar point it needs

   Show these as a report. Do not fail the build on them. The maintainer decides what to fix.
3. Update `kanji_bands.py` so that bands still set the default level and the override file wins.

### Verify

- Move one word from N5 to N4. Only `levels.json` changes. After compile, the word ships in
  `vocabulary/n4.json`, with the same slug, the same id and the same mnemonic and examples. The
  report lists the N5 sentences that use it.
- Move one hand-written kanji the same way, with the same result.

---

## Phase 5: Rewrite the maintainer's backup and restore it

### Facts about the backup

- File: `~/Downloads/kizamu-backup-2026-09-27T11-07-01-869Z.json.gz`, `formatVersion 1`,
  `schemaVersion 20`, `curriculumVersion "19"`.
- Rows store items as `{ itemType, slug }`, not as numeric ids (`mobile/src/core/backup/`).
  So phase 1 does not affect the file, but phase 2 does.
- Restore (`mobile/src/data/user/restoreBackup.ts`) **skips** any row whose slug is not in the
  installed curriculum. Without a rewrite, every kanji row (425) and every N4 grammar row (59) is
  lost.
- Item refs by table: `itemStudyStatus` 1,271, `relatedItemBoosts` 314, `srsStates` 53,
  `weaknessStats` 53, `userSynonyms` 10, `furiganaOverrides` 1. `passagePracticeResults` and
  `aiSessions` are empty.
- The phone has curriculum v19. The repo seed is v21. The phone's `user.db` numeric ids therefore
  do not match the new build. **The phone must get a fresh install and a restore.**

### Work

1. Write `scripts/rewrite-backup-slugs.ts` (or `.py` next to the other `_build` tools, to match the
   pipeline). It reads a `.json.gz` backup and `slug-renames.json`, and writes
   `<original-name>-migrated.json.gz` next to the input. **Never overwrite the input.**
2. Rewrite every `ItemRef`: the `item` field of each row, `aiSessions.topicItem`,
   `aiSessions.topicItems`, and `wordsMet[].item` inside `aiSessions.summaryJson`.
3. When two old slugs map to one new slug, the restore would write two rows for one item. The script
   must keep one row for each item in each table:

   | Table | Rule |
   | --- | --- |
   | `itemStudyStatus` | Keep the more advanced status (`known` > `in_progress` > `not_started`). |
   | `srsStates` | Keep the row with the later `lastReviewedAt`. If they are equal, keep the higher `stability`. |
   | `weaknessStats` | Add the counts together. Keep the later `lastErrorAt` and its `lastErrorType`. |
   | `relatedItemBoosts` | Keep the higher `boost`. |
   | `userSynonyms` | Keep both. Remove exact duplicates. |
   | `personalMnemonics`, `furiganaOverrides` | Keep the row with the later `updatedAt`. |

4. **Dry run:** the script checks the output against the new compiled `curriculum.db` and prints row
   counts for each table, before and after. It must report **0 unmatched slugs**.
5. `~/Downloads` is outside the workspace. The sandbox blocks writes there, so ask for permission
   before you run the script on the real file.

### Steps for the maintainer on the phone

1. Just before you install the new build, export a new backup from the app. Today's file is out of
   date if you study again after 2026-09-27.
2. Run the script on that new backup.
3. Uninstall the app (or clear its data), install the new build, and restore the `-migrated` file.

### Verify

- A unit test for the script: a small fixture with one renamed kanji, one merged grammar pair
  (progress on both sides) and one unchanged vocabulary item.
- The restore preview on the phone shows 0 unmatched items. Spot-check `n5-go`, `k-go` and `n4-ri`
  (under their new slugs) in Browse.

---

## When all phases are done

- Update `docs/working-history.md` (this plan's row, and the Phase A note on the schema migration
  plan's row).
- Update `curriculum/README.md` and the workflow runbooks in `docs/workflows/` with the new file
  layout and the rule: **to move an item, edit `levels.json` only**.
- In the schema migration plan, mark Phase A as done by this plan.

## Rules for the agent that runs this plan

- Do one phase at a time. At the end of each phase, run its checks and tell the maintainer the
  result before you start the next phase.
- Do not change content text (mnemonics, examples, explanations) except for the approved grammar
  merges.
- Do not edit `curriculum.db` or the seed by hand. Compile it.
- Communicate in ASD-STE-100 (see `CLAUDE.md`).
