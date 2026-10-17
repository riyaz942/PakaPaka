# Level-agnostic curriculum plan

**Status:** Phase 0 done 2026-09-27 (see "Phase 0 results"). Phase 1 done 2026-09-27 (see
"Phase 1 results"). Phase 2 done 2026-09-27 (see "Phase 2 results"). Phase 3 done 2026-09-27 (see
"Phase 3 results"). Phase 4 done 2026-10-11 (see "Phase 4 results"). Phase 5 done
2026-10-17 (see "Phase 5 results"): script written 2026-10-11, restore on the phone checked
2026-10-17. All phases are done.

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

### Phase 1 results (2026-09-27)

**What changed:**

- `curriculum/id-registry.json` has **3 sections**, one for each id space that `user.db` stores:
  `items` (`<type>:<slug>`), `passages` (`passage:<slug>`) and `passage_questions`
  (`<passage-slug>#<question index>`). Each section has the Phase A shape (`next_id`, `ids`,
  `retired`, `aliases`). This is one registry with sections, not a second registry.
- `scripts/seed-id-registry.ts` (one-off) created the registry from the phase 0 build (version 22):
  12,735 items (`next_id` 12736), 60 passages (61), 213 questions (214).
- `scripts/id-registry.ts` holds the id logic. `assignItemIds` in `compile-curriculum.ts` uses it,
  and passages and questions now get their ids from it too (before, they got insert-order ids).
- Without `--update-registry`, the compile fails on a key with no id **and** on a registry key that
  is not in the build. With the flag, a new key gets `next_id`, a removed key moves to `retired`, a
  retired key that comes back gets its old id, and the registry is written after a successful
  compile. `validate-schema` checks the registry shape.
- Every passage has a permanent `slug`: its existing seed slug from
  `generate_content/passages/<level>.json`. It is in `n5_readings.py` / `n4_readings.py`,
  `generate.py` emits it, and the schema now requires it. The wire-in runbook
  (`docs/content/phase-4-reading-passage-tooling.md`) no longer strips it.
- `curriculum.db` DDL did not change. The shipped `readings/*.json` changed by the 60 slug lines
  only.

**Checks:**

- The compiled seed (version **23**) compared with the phase 0 baseline: every item id, level and
  `sort_order` is the same, every passage id and question id is the same, and the link tables
  (relationships, look-alikes, examples, spans, passage links) are identical.
- On a copy of `curriculum/`: an N5 radical added in the middle of the sort order changed 0 ids,
  and only the new row got a new id (12736). Moving `vocabulary:watashi` and the hand-written
  `kanji:n5-ichi` to N4 changed 0 ids and needed no flag. A compile with an unknown key and no
  flag failed.
- Repo-root tests: 73 pass. `validate-schema` passes (22 files). The generator reproduces the
  committed JSON. `mobile/` tests: 2,216 pass in 250 suites. `mobile/` lint: 0 errors, the same 1
  warning as before.

**For later phases:**

- Phase 2 rewrites the `items` keys in `id-registry.json` and keeps the ids, as planned.
- Curriculum Studio (`web/`) runs `compile-curriculum` without the flag, so a Studio compile fails
  after it adds an item. Run the compile with `--update-registry` from the terminal for that.
- Backups still store passage and question results by raw id (`backup.types.ts`). The ids are now
  stable, so this is safe. Phase 5 does not need to change it.

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

### Phase 2 results (2026-09-27)

**What changed:**

- `curriculum/_build/slug-renames.json` has 2,107 entries: all 2,000 kanji, the 97 N4 grammar
  points, and an identity entry for each of the 10 N5 merge targets (so that each merge is two old
  keys with one new key).
  - The derived kanji lose `k-`. The 192 hand-written kanji get the first word or two of their
    meaning. The maintainer approved 29 slugs picked by hand for clashes, for example `n5-go` →
    `five`, `k-go` → `go-game`, `n4-ri` → `reason`, `k-ri` → `hamlet`.
  - 87 N4 grammar points lose `n4-`. 10 merge into their N5 point.
- `curriculum/_build/rename_slugs.py` (one-time) did the rename from the map. It edits sources
  only: the kanji datasets (`suffix` → `slug`), grammar datasets and lessons, `bands.json`,
  `skeleton.json`, `visually_similar.py`, sidecars, `generate_content/` (seeds, passages, drafts),
  reports, and the registry. Then `generate.py` and `generate_deps.py` rebuilt the shipped JSON.
- **Kind in refs.** `visually_similar_slugs` is the only shipped list that can name two kinds. It now
  holds `"radical:<slug>"` / `"kanji:<slug>"` refs (schema pattern), compile resolves each ref by
  kind and slug, and Curriculum Studio links each chip to its own kind. Graph edges already carried
  `from_type` / `to_type`. Python tables that mixed kinds are now keyed by kind. 396 kanji now share
  a slug with a radical. The app always looks up an item by type and slug.
- **Grammar merges** (approved): `node`, `teiru-progressive`, `tewaikenai`, `nakutemoii`,
  `nakerebanaranai`, `temoii`, `sugiru`, `deshou`, `kamoshirenai` and `koto-ga-aru` merged into
  `node-because`, `te-iru`, `te-wa-ikenai`, `nakutemo-ii`, `nakereba-naranai`, `te-mo-ii`, `sugiru`,
  `deshou`, `kamoshirenai` and `ta-koto-ga-aru`.
  - The merged item keeps the N5 form, meaning, structure and mnemonic. It gets the union of
    `accepted_forms` and `vocabulary_slugs`, and the N4 examples and cloze variants that are not
    duplicates. `ta-koto-ga-aru` takes the 2 N4 `uses`.
  - The longer lesson stays, with its caution notes: N5 for `te-wa-ikenai` and `te-mo-ii`, N4 for
    the other 8.
  - N4 has 87 points and N5 has 74. The registry keeps every id, and the 10 merged-away keys are
    in `items.retired` under their old keys.
- **Reading seeds.** The merged points are removed from 7 N4 seeds' `required_grammar`, and each N4
  `grammar_cutoff` is recounted. `ladder_errors` does not let an N4 seed require an N5 point, so
  the N5 slug does not replace them. `reizouko-no-ruuru` now requires no N4 point.
- `validate-schema` rejects a slug that matches `^(n[1-5]|k)-` (items and passages).

**Checks:**

- Search for `\b(n[1-5]|k)-[a-z]` in tracked files under `curriculum/`, `scripts/`, `mobile/src/`
  and `web/`. Results are only in `slug-renames.json` (excluded from the search), the 10 retired
  keys in `id-registry.json`, the new level-prefix tests, and text that is not a slug (`k-car` in a
  meaning, "n1-n5" in a runbook).
- The compiled seed (version 26) compared by id with the phase 0 baseline: 12,725 of 12,735 rows
  are the same except for the slug. The 10 merged N4 rows are gone. All 87 N4 grammar rows have a
  new `sort_order`, because the first N4 point (`node`) merged. The other tables change only for
  the 10 merged items (example and span rows compared through their sentence text).
- `graph.json` mapped through the rename map: the same edges, less 1 (`ta-koto-ga-aru` →
  `sushi`, see below).
- Repo-root tests: 79 pass (6 new). `validate-schema` passes. `mobile/` tests: 2,216 pass in 250
  suites. `mobile/` lint: 0 errors, the same 1 warning. `web/` lint and type check pass.
- `grammar_detect` self-test 37/37 and calibration 100%. N5 and N4 seeds pass `ladder_errors` and
  `grammar_coverage_errors`. `validate_readings` passes (drafts and fixtures).

**For the maintainer:**

- **Cloze variants removed (maintainer decision).** After the merge, `check_cloze` failed 25
  variants (it had 0 failures before). 21 were N4 cloze variants merged into N5 items: they used
  N4-window words at an N5 position. 4 were N4 cloze variants of `kagirazu` and `nikanshite`: the
  proportional vocabulary window of a point shrank when the points before it merged. All 25 are
  removed, and `check_cloze` passes again (N5 404 variants, N4 453). The compiled seed is version 26.
- An N5 lesson may link only N5 points, so the merged lessons lost their links to N4-only points
  (for example `te-iru` lost `rashii`, `youda`, `mitai`, `teiru-result`).
- `ta-koto-ga-aru`: `chikoku-suru` and `sushi` are N4 words, so they are removed from its
  vocabulary lists. The example text did not change.
- Old drift, not fixed: `kanji_bands.py` was not run, because a rerun moves radicals `nine` and
  `the-latter` and changes 58 radical `sort_order` values. `metadata.json` `content_counts` for
  radicals, total items and dependency edges were already wrong. Only `grammar` (161) is updated.
- Local, gitignored drafts keep some old names that are not in the map (batch request ids such as
  `n5-yon--attempt1`, and old `n2-*` prompt files).
- `mobile/assets/curriculum-manifest/curriculum-mock-update.db` (a test mock) still has old slugs.

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

### Phase 3 results (2026-09-27)

**What changed:**

- **Sidecars.** The 10 per-level or per-dataset files are now 4 files, keyed by slug and sorted by
  slug: `radicals/mnemonics.json` (303 entries), `kanji/mnemonics.json` (469),
  `vocabulary/mnemonics.json` (1,247), `vocabulary/examples.json` (1,028). Before the merge, 0 slugs
  collided in each kind. The entries did not change.
- **Lessons.** All 161 lessons moved from `grammar/lessons/{n5,n4}/` to `grammar/lessons/<slug>.md`
  (`git mv`, so history follows them).
- **Radical art.** All 290 files moved from `mobile/assets/radicals/{n5,n4,k}/` to
  `mobile/assets/radicals/<slug>.webp`. `generate.py` now writes `visual_mnemonic_url` as
  `radicals/<slug>.webp`, and the schema pattern is `^radicals/[a-z0-9-]+\.webp$`. The asset-map
  script reads one folder and rejects a subfolder. `radicalImages.ts` is regenerated.
- **Readers and writers.** `generate.py`, `generate_mnemonics.py`, `generate_examples.py`,
  `assemble.py` / `generate_grammar_lessons.py`, `reports/kanji_bands.py` (radical prose check)
  and `audit_shipped.py` (level discovery now globs `n[1-5].json`). `validate-schema`,
  `compile-curriculum` and the Studio loader skip a file named `mnemonics.json` or
  `examples.json` (`SIDECAR_FILE_NAMES`). The Studio write-back (`web/server/curriculum/sidecar.ts`)
  no longer looks up a source in `bands.json`, and its functions no longer take a level.
- **Writer behavior.** `write_sidecar` (mnemonics and examples) now always merges one level's
  drafts into the shared file. Before, a full rebuild of vocabulary rewrote its level file from
  the drafts alone. That is not safe when the file holds every level. Result: an entry with no
  draft stays in the file, it is not removed.
- **Docs.** The workflow runbooks in `docs/workflows/`, the 4 triage and simplify prompts, the
  Studio guide text and README, `curriculum/README.md` and
  `docs/content/radical-mnemonic-images.md`. The runbook "done" snippets that imported the removed
  `_source_map` now read the one sidecar. The kanji and radical triage outputs no longer carry a
  `dataset` field (it only named the sidecar file), and `kanji-chain-check.json` is now one map
  keyed by slug.

**Checks:**

- Shipped JSON compared with the phase 2 output (`/tmp/level-agnostic-phase2/`): 14 of 19 files
  are byte-identical. The 5 `radicals/n*.json` files differ only in 296 `visual_mnemonic_url`
  lines, and each new value is the old value without its level folder. This difference is
  necessary: the plan moves the art, and the ref names the art path.
- The compiled seed (version **27**) compared table by table with the phase 2 seed (version 26):
  every table is identical except `items.visual_mnemonic_url` (the same 296 values) and
  `curriculum_metadata` (version, date, hash). `id-registry.json` did not change.
- Art: 290 files before and after. 285 radicals had a ref to an existing file before, and the
  same 285 have one after (0 lost, 0 gained).
- `validate-schema` passes (22 files, the sidecars are skipped). Repo-root tests: 81 pass (2 new:
  a level folder in `visual_mnemonic_url` fails, and a `mnemonics.json` next to the level files
  is skipped). `mobile/` tests: 2,216 pass in 250 suites. `mobile/` lint: 0 errors, the same
  1 warning. `web/` lint and type check pass.
- On a temporary folder, both `write_sidecar` functions merge a new draft and keep an existing
  reviewed entry. `kanji_bands.load_radicals` finds the same 296 radicals with prose as the old
  layout. The rewritten kanji triage snippet runs.

**For the maintainer:**

- Old drift, not fixed: 11 radicals have a `visual_mnemonic_url` but no art file, and 5 art files
  are not named by any radical. The counts are the same as before the move.
- `curriculum/_build/rename_slugs.py` (phase 2, one-time) still names the old sidecar paths. It is
  a record of the phase 2 rename and must not run again.
- `curriculum/_build/reports/kanji-simplify-list.json` is from an older triage run. Its 395 marks
  still have a `dataset` field. No code reads that field, and the next triage run writes the new
  shape. The committed `kanji-chain-check.json` is an empty map. A run of the new snippet on the
  current sidecar marks 37 slugs (the file was not written).
- Local, gitignored staging under `generate_content/web/` and `drafts/` is still per level. That
  is correct: it is working state, not content.

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

### Phase 4 results (2026-10-11)

**What changed:**

- **Band rerun first, in its own commit.** `kanji_bands.py` ran on the phase 3 state before any
  code change (the maintainer accepted the drift). No kanji changed. Radical `nine` moved N4 → N5,
  `the-latter` moved N5 → N3, and 58 radical `sort_order` values changed.
- **`curriculum/_build/levels.json`** maps `"<kind>:<slug>"` to a level. Kinds: radical, kanji,
  vocabulary, grammar, passage. Grammar and passages can only be N5 or N4 (no N3+ files exist for
  them). Keys that start with `_` are notes. It holds the 5 pronoun kanji that `PINNED_DERIVED`
  held. `PINNED_DERIVED` is gone.
- **`curriculum/_build/levels.py`** loads and checks the file. A bad key, a bad level or an
  unknown slug stops the build with a clear message. `place()` puts each item at its override
  level or its default level. Inside a level, items keep the global teaching order (default level,
  then source position). So an item that moves one level later is taught first there, and an item
  that moves earlier is taught last.
- **`generate.py`.** `--level` reads every vocabulary, grammar and passage dataset and takes its
  level's items from `place()`. Furigana `known_readings` and the passage span words are the words
  at this level and all earlier levels. A link to an item at another level is checked for
  existence only. Before, an N5 example that linked an N4 word stopped the build. Now the report
  lists it. The per-level builder functions (`build_n5_vocab`, …) are removed.
- **`kanji_bands.py`.** A kanji in `levels.json` takes its slot before the ranking, the same way a
  hand-written kanji does, and wins over the dataset level. The band keeps its size: move a kanji
  out of N5 and N5 ranks one more derived kanji in. A radical in `levels.json` files at that level,
  just before the first kanji there that needs it.
- **`reports/level_report.py`** writes `reports/level-report.md`. It lists sentences (examples,
  grammar uses, cloze, passages) that use a word from a later level (`level_check`), links to a
  later item, edges from a later prerequisite, reading seed errors (`ladder_errors`,
  `grammar_coverage_errors`, `CORE_SEED_SLUGS`), and the words that wait for a kanji that
  `levels.json` moved. It never fails. It runs in about 2 seconds.
- **`promote_cloze.py`** writes a cloze into the dataset file that defines the point, not into
  `<level>_grammar.py`, because a moved point is not in its level's file.
- **Regenerate order** (`curriculum/README.md`): `--level` for all 5 levels, then
  `kanji_bands.py` (it ranks on the generated words), then `--bands`, `generate_deps.py` and
  `level_report.py`.

**Checks:**

- With only the 5 pronoun pins, every generated file is byte-identical to the output before the
  change.
- **Word:** `"vocabulary:ginkou": "n4"` was the only source change. 銀行 ships in
  `vocabulary/n4.json` at sort 1, with the same id (437), the same mnemonic, answers and 3
  examples. No other item changed level or id. The compile needed no `--update-registry`. The
  report listed the 8 N5 example sentences and the N5 passage that use 銀行, 9 links, and 2 N5
  seeds whose `vocab_cutoff` (718) is now past the end of N5.
- **Hand-written kanji:** `"kanji:five": "n4"`. 五 ships at N4 with the same id (210) and content.
  Two other items moved, as designed: kanji `character` (字) N4 → N5 (it fills the N5 slot), and
  radical `five` N5 → N4 (it follows its first kanji). The report listed the 3 N5 words that now
  wait for 五.
- **Grammar and passage:** `grammar:te-iru` and `passage:saigo-no-hi` to N4. Ids 1077 and 60 did
  not change. The report listed 10 links and 34 seed errors.
- A bad level for a kind, an unknown slug and a bad key each stop the build with a message.
- Before any move, the report has 41 sentence lines: hand-written N5/N4 grammar examples that use a
  later word (for example 「疲れたので」 at N5 uses N4 疲れる). Links, edges and seeds are clean.
- The new seed (version **28**) compared with the version 27 seed: the same ids; only the 2 radical
  levels and 58 radical `sort_order` values changed.
- `validate-schema` passes. Repo-root tests: 83 pass. `mobile/` tests: 2,216 pass in 250 suites.
  `mobile/` lint: 0 errors, the same 1 warning. `web/` lint and type check pass.

**Earlier-phase leftovers (fixed in the same branch):**

- `metadata.json` `content_counts`: compile now writes them from what it compiled (radicals 817,
  total items 12,725, edges 23,290). 2 new repo-root tests.
- Curriculum Studio compiles with `--update-registry`. The terminal compile stays strict.
- `curriculum-mock-update.db`: 17 kanji slugs mapped through `slug-renames.json`. 39 slugs are older
  than the map (for example `n5-gakkou`) and stay. No script made this file; tests read only its
  bytes.
- Radical art: not changed. The 11 refs with no file are the art queue by design
  (`docs/workflows/radical-art-web-chat-workflow.md` finds radicals that need art by the ref). The
  5 files that no radical named (`bou-stick`, `no-slide`, `first-time`, `kau-buy`, `stop`, about
  62 KB) were KRADFILE-era radicals that the KanjiVG switch (`ffd42ab`, 2026-09-01) removed. They
  are deleted, with their 5 entries in `radicals/mnemonics.json` (maintainer decision). `bou.webp`
  and `slash.webp` already draw the same shapes as `bou-stick` and `no-slide`. Seed v29.

**For the maintainer:**

- CI `generator-drift` runs `--level` only. It does not run `kanji_bands.py`, `--bands` or
  `generate_deps.py`, so a kanji or radical move that is not regenerated is not caught.
- There are still no Python tests in `curriculum/_build/`. The checks above were run by hand.

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


### Phase 5 results (2026-10-11)

**What changed:**

- **`scripts/rewrite-backup-slugs.ts`** (TypeScript, next to the compile scripts, so it can use
  `better-sqlite3` and the repo-root Jest tests). Usage:
  `npx tsx scripts/rewrite-backup-slugs.ts <backup.json.gz> [--dry-run] [--db path]`.
  - It reads `curriculum/_build/slug-renames.json` and rewrites the `item` of each row,
    `aiSessions.topicItem`, `aiSessions.topicItems` (duplicates removed) and
    `wordsMet[].item` in `aiSessions.summaryJson`.
  - It applies the merge rules in the table above. `weaknessStats` also keeps the later
    `updatedAt`. `userSynonyms` removes only rows with the same item, answer type and answer text
    (the `user_synonyms` primary key).
  - It checks every ref against `items` in `curriculum.db` (default:
    `mobile/assets/curriculum-seed/curriculum.db`) and prints the row count of each table, before
    and after.
  - It writes `<name>-migrated.json.gz` next to the input only if 0 refs are unmatched. It opens the
    output with the `wx` flag, so it never overwrites a file. `--dry-run` writes nothing.
- 11 Jest tests in `scripts/rewrite-backup-slugs.test.ts`: the fixture has 1 renamed kanji
  (`k-go` → `go-game`), 1 merged grammar pair with progress on both sides (`sugiru` /
  `n4-sugiru`) and 1 unchanged word (`ginkou`).

**The maintainer's backup:**

- Input: `~/Downloads/kizamu-backup-2026-10-11T07-11-51-305Z.json.gz` (`schemaVersion 20`,
  `curriculumVersion "19"`). Output: `~/Downloads/kizamu-backup-2026-10-11T07-11-51-305Z-migrated.json.gz`.
  The input did not change.
- Against seed v29: **0 unmatched slugs**. 571 refs renamed.
- Row counts: `itemStudyStatus` 1,300 → 1,294. Every other table keeps its count
  (`relatedItemBoosts` 563, `srsStates` 82, `weaknessStats` 82, `userSynonyms` 19,
  `furiganaOverrides` 1). `aiSessions`, `personalMnemonics` and `passagePracticeResults` are empty.
- The 6 merges are the N5/N4 pairs `nakereba-naranai`, `nakutemo-ii`, `node-because`, `te-iru`,
  `te-mo-ii` and `te-wa-ikenai`. Both sides were `known`.
- Spot-check: `n5-go` → `five` (known), `n4-ri` → `reason` (known), `k-go` → `go-game` (a related
  boost). The backup has no `k-ri` row.
- Every output row is an input row with only its item ref renamed. The envelope did not change.

**Checks:** repo-root tests 94 pass (11 new). `tsc --noEmit` passes.

**Restore on the phone (2026-10-17):** the maintainer installed the new build and restored the
migrated backup. The restore worked: reviews and lessons are available. The maintainer did not
record the restore preview count or the Browse spot-checks (`five`, `go-game`, `reason`), so
those two checks are not recorded here.

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
