# Level ladder — design

Design date: **2026-11-18**. Status: **approved by the operator, 2026-11-22.**

Replaces the JLPT-level structure of the curriculum with this app's own numbered levels, in the
style of WaniKani. Supersedes the band model of
[kanji-coverage-and-dependency-order-plan.md](../../content/kanji-coverage-and-dependency-order-plan.md)
(v2, "a band is a teaching budget, not a coverage gate") and makes most of
[untaught-kanji-in-vocabulary-mnemonics-plan.md](../../content/untaught-kanji-in-vocabulary-mnemonics-plan.md)
unnecessary. Both earlier plans rejected this ladder because "an N5 learner needs 昨日". The
operator now accepts that cost (decision 2026-11-18).

## 1. Why

Today a word is taught at its JLPT level, even when its kanji come later. 630 of the 1,249
N5+N4 words contain a kanji from a later band (`_build/reports/level-report.md`). The app shows those words with
furigana, asks for the meaning only, and writes mnemonics that cannot name the missing kanji.
The learner meets 写真 before 写.

The operator wants the WaniKani order: a radical before its kanji, a kanji before its words. And
the operator wants a **level-up moment**: a clear point where a level is complete and the next one
opens, for the sense of achievement.

## 2. Goals

1. Every radical, kanji, word, grammar point and reading passage has one **level** (1–60).
2. A kanji is never at a level before one of its radicals. A word is never at a level before one
   of its kanji.
3. **Level-up gate:** level N is complete when 90% of its kanji are at Guru or higher. For levels
   2–20 the learner must also pass the level test (2 reading passages, §7.4). The learner can
   skip forward, and can go back only to a level that is not complete.
4. **JLPT is display only.** No app logic reads a JLPT value. The app shows a table such as
   "Levels 1–12 ≈ N5", calculated by the build.
5. Progress in `user.db` is kept for every user. Nothing a learner has learned is lost.

## 3. Non-goals

- No new words or kanji. The corpus stays at 817 radicals, 2,000 kanji, ~9,750 words, 160
  grammar points.
- No full content for levels 21–60. They stay a skeleton (readings, meanings, furigana; no
  mnemonics, examples or passages), as N3–N1 are today.
- No change to reviewed content that the restructure does not break. Content that it breaks is
  regenerated (§7.6); the operator approved this regeneration on 2026-11-18, as an exception to
  the standing "no mass regeneration of reviewed mnemonics" rule.
- No change to the SRS (FSRS, stages, weakness bias, two-card kanji, worst-of-both grades).
- No change to the goal ring definition or to the intensity presets.

## 4. Anti-goals (a failure even if it works)

- A JLPT value anywhere in app logic: a query, a filter, a gate or a stored preference.
- A level gate that makes a learner wait with no explanation. When lessons stop, Home must say
  why and what is left.
- A learner who loses progress or a completed level. A completed level is never undone.
- Level 1 that feels heavy. WaniKani level 1 has 25 radicals and 18 kanji; ours must be similar.

## 5. Constraints

- Hard conventions in `CLAUDE.md`: `Result` type, dual database (never write `curriculum.db`),
  migrations in `src/data/migrations/`, sync rules (merge on row content, pure merge functions in
  `src/core/sync/`, new data in `BackupData` and `SYNC_TABLES`).
- Slugs and item ids do not change (`id-registry.json`). `user.db` is keyed by id, mnemonic
  sidecars by slug.
- The web app is live (paka-paka.app) with real `user.db` data. Mobile ships too. Over-the-air
  curriculum updates went live on 2026-11-20/21 (Part 4). Each app reads only the manifest for
  its own schema: `/api/curriculum/s${REQUIRED_CURRICULUM_SCHEMA_VERSION}/manifest.json`
  (`mobile/src/data/curriculum/curriculumConfig.ts`). The ladder changes the curriculum DDL
  (`items.level`), so the build raises `CURRICULUM_SCHEMA_VERSION` and
  `REQUIRED_CURRICULUM_SCHEMA_VERSION` from 1 to 2 together. The ladder `curriculum.db` goes to
  `s2/`. An old app keeps reading `s1` and never gets the new curriculum.
- **The `s1` release path stays working after the switch.** The operator can still publish content
  fixes to `s1` for old store apps (the runbook is `docs/curriculum-releases.md`). The build must
  not delete or break it.
- Work happens on branch `docs/level-ladder-plan` (operator decision, 2026-11-22). Do not create a
  new branch. Commit at each task checkpoint, when the tests are green.
- The current JLPT app is released for feedback while this work continues. Merge `main` into this
  branch often (about weekly). Generated files (`items.json`, `curriculum.db`) are rebuilt after a
  merge, never merged by hand.
- Shipped passages live in `_build/n5_readings.py` / `n4_readings.py`; ingest rebuilds them from
  drafts (memory: passage edit ship path).
- WaniKani data (`curriculum/_build/data/ref_subjects.json`) is a private reference. No WaniKani
  text or level assignment ships.

## 6. Approaches

### 6.1 How to switch — chosen: **one switch**

| | One switch (chosen) | Two steps |
| --- | --- | --- |
| What | Build gives every item a level and drops `jlpt_level`; app moves to levels and the gate in the same branch | Ship `level` next to `jlpt_level`, move screens one at a time, drop `jlpt_level` last |
| Gain | One data model, no dual code | Safe when curriculum updates reach installed apps |
| Cost | One large change | Two fields and two code paths for a period |

The two-step safety buys nothing, because old apps never receive the ladder curriculum. Each app
reads the manifest for its own schema (`s1` or `s2`, §5), so an old app keeps its JLPT
`curriculum.db` and a new app gets the ladder one. There is no period where an app holds a
database that its code cannot read. Operator chose one switch (2026-11-18).

### 6.2 Where the order comes from — chosen: **our own order**

| | Our own order (chosen) | WaniKani's level per kanji |
| --- | --- | --- |
| What | Kanji that complete the most common words go first, ~30 per level | Copy the level WaniKani gives each kanji |
| Measured (old N5 word list, level 10) | 84% of N5 kanji words readable | 60% |
| Cost | Our order is untested by real learners | Built for their word list, not ours; it is their designed work |

Operator chose our own order (2026-11-18).

### 6.3 Gate — chosen: **WaniKani gate**

No gate (lessons flow at intensity pace) was the other option. Operator chose the gate for the
level-up moment (2026-11-18).

## 7. The design

### 7.1 Level sizes

Measured on the real corpus with a test ordering (2026-11-17). Final numbers come from the build
report (§7.7).

| Level | Radicals | Kanji | Words |
| ---: | ---: | ---: | ---: |
| 1 | ~19 | 18 | ~47 |
| 2 | ~30 | 24 | ~42 |
| 3 | ~38 | 28 | ~35 |
| 4–10 | 14–38 | 30 each | 40–95 |
| 11–20 | 10–20 | 30 each | 20–80 |
| 21–60 | 4–16 | ~34 each | 100–290 |

- Levels 1–10: ~238 radicals, 280 kanji, ~557 words.
- Levels 11–20: ~158 radicals, 300 kanji, ~570 words.
- Levels 21–60: the rest of the 2,000 kanji and ~9,750 words. Exact per-level sizes are the
  builder's call (§8); 60 levels is the target.

Level 1 kanji in the test: 一二三四七九十人日月本見分時上下手間今.

### 7.2 Ordering rules (build)

1. **Kanji order.** Inside the build, kanji are ranked greedily: the next kanji is the one that
   completes the most still-waiting common words (a word is complete when all its kanji are
   placed), ties broken by the number of waiting words it appears in. "Common" uses the current
   word order: the authored N5 list, then N4, then the derived words by frequency rank. These lists
   are build input only.
2. **Kanji per level.** 18, 24, 28, then 30 up to level 20, then ~34.
3. **Radicals** file at the level of the first kanji that uses them. The build may move a radical
   one level earlier to keep radical counts even (levels 3–4 measured 38 each); it may never move
   one later than its first kanji.
4. **Words.** A word's level is the later of (a) the level of its last kanji and (b) its frequency
   slot. The frequency slot spreads the word list across the levels in frequency order, so a rare
   word does not land at level 2 only because its kanji are there. Kana-only words (275) use the
   frequency slot alone.
5. **Grammar.** Grammar points keep their current teaching order (N5 list, then N4, then N3). The
   126 N5+N4 points spread over levels 1–20, about 6 per level; the 34 N3 points over levels
   21–25. A point never sits at a level where fewer than 2 of its example sentences use only words
   at or below that level. The measured fit: most N5 grammar is ready by levels 5–9 and most N4
   grammar by 5–14, so the spread is the binding rule, and examples are rewritten where a point's
   slot comes before its examples are readable (§7.6).
6. **Passages.** A passage's level is the highest level of any word or grammar point in it.
7. **Manual moves.** `_build/levels.json` keeps its job with integer levels:
   `"<kind>:<slug>": <level>`. An override wins, but the build fails if it breaks rule 2 (radical
   before kanji, kanji before word). This is how the operator moves items, as WaniKani does.
   The current JLPT entries in `levels.json` (`kanji:private → n5`, the grammar moves to n4/n3)
   are removed; the grammar order they encoded is kept by the grammar teaching order (rule 5).

### 7.3 Data

- **Source files.** The per-JLPT files (`curriculum/kanji/n5.json` …) are replaced by one generated
  file per item type with a `level` integer on each item (builder's call on exact file names). The
  hand-authored dataset files under `_build/` (`n5_vocab.py` …) stay as build input; their names
  name the source dataset, not a level.
- **`curriculum.db`.** `items.jlpt_level TEXT` → `items.level INTEGER NOT NULL`, indexed.
  `reading_passages.jlpt_level` → `reading_passages.level`. New table `level_jlpt_equivalence`
  (§7.5). `curriculum_metadata.jlpt_levels` is removed.
- **Dependency graph.** Rule 2 makes every kanji → word edge `requires` (the kanji is never at a
  later level). Cross-band `builds_on` edges for kanji → word disappear. Radical → kanji edges stay
  `builds_on`.
- **Ids.** Unchanged. A level move never changes an id.

### 7.4 The gate and the learner's level (app)

- **Gate:** level N is **completed** when at least 90% of the kanji in level N are Guru or
  higher, or marked known (bulk mark-known, import). Guru is the existing stage label
  (stability ≥ 7 days, `fsrsScheduler.ts`). Radicals, words and grammar do not count toward the
  kanji gate, as in WaniKani. **For levels 2–20 the learner must also pass the level test**
  (below); the kanji gate alone is not enough.
- **Level test** (operator decision 2026-11-22). Levels 2–20 only.
  - The test is: pass **2 passages** of that level. The learner chooses which, from the level's
    passages (3–4 per level, §7.6).
  - A passage is **passed** when every question is answered correctly, in one or more tries.
  - A passage **can be taken as a test** when (a) the kanji gate of its level passes AND (b)
    every word in the passage has had its lesson (started or known, any stage). The existing
    ≥ 90% Guru+ coverage unlock (§7.8 Reading) does not apply to the test. Furigana follows the
    existing per-word rule.
  - **A wrong answer is never revealed.** The app says only that it is not correct; the passage
    stays open; retries are unlimited, with no penalty and no SRS effect. Answer matching is
    tolerant: kana or kanji form, with or without です, punctuation ignored. A wrong answer is
    not stored; a correct answer is never overwritten by a wrong one in test mode.
  - **No test (kanji gate only):** level 1; levels 21–60; and any level that is completed by
    bulk mark-known (`markLevelsKnown`), placement, import, or the one-time conversion of
    existing users (§7.9). Skip forward completes nothing, so it has nothing to test. A skipped
    level that the learner goes back to uses the normal path, so it has a test.
  - **Where the result lives.** `passage_practice_results` is already in `SYNC_TABLES`
    (`passagePracticeResults`, kind `passage`, one row per passage and question with
    `is_correct`), so no new store is needed. A passage is passed when every one of its questions
    has a correct row. The result syncs with the existing table. `completed_levels` stays the
    sorted union: once the level completes, the level is in the set and stays there, so a later
    change in the practice rows never undoes it.
- **A completed level stays completed.** If its kanji drop below Guru later, it is still
  completed.
- **Each level has one state** (operator decision 2026-11-18):

  | State | Meaning | Can the learner pick it? |
  | --- | --- | --- |
  | Active | The one level lessons come from now | — |
  | Completed | Gate (and, for levels 2–20, the test) passed at some time | **No** |
  | Skipped | Below the active level (or below a level the learner jumped to), not completed | **Yes**, to go back and complete it |
  | Not started | Above the active level | **Yes**, to skip forward |

- **Skip forward.** The learner can pick any level above the active level. The levels between
  become skipped (not completed). Bulk mark-known for those levels completes them instead.
- **Go back.** The learner can pick a lower level only when it is not completed. Completed levels
  cannot be picked again.
- **After a level is completed,** the active level moves to the lowest level above it that is not
  completed. Example: a learner jumps to 15, goes back to 5, completes 5 → the active level is 6
  (skipped). The learner can jump forward again at any time.
- **Stored values.** Two new preferences: `active_level` (integer) and `completed_levels` (a JSON
  integer list). Both sync. Merge rules (pure functions in `src/core/sync/`):
  `completed_levels` is the sorted union of both sides, never a conflict (same rule as
  `seen_unlocked_passage_ids`); `active_level` is a normal three-way preference merge. After a
  merge, if the active level is completed, it moves forward by the rule above.
- **What opens.** The lesson pool is every item at a level ≤ the active level. Inside that pool:
  - radicals open at once;
  - a kanji opens when its radicals are Guru (existing `gateParentIds`);
  - a word opens when its kanji are Guru (existing `requires` gate);
  - grammar is paced by the grammar pace rules (D17).
  Nothing above the active level opens, even if its parts are Guru (except opt-ins, below). When
  a learner goes back to a skipped level, items of higher levels that are already started stay in
  reviews; only new lessons come from the lower pool.
- **Lesson planner.** `listLessonCandidatePool(level)` returns levels ≤ the given level. The D11 rule
  ("advance when the level has nothing startable left") is replaced by the gate. Lower-level parts
  (D3) and learner opt-ins keep working: an opt-in item and everything it is built from may be
  learned ahead of the gate, because the learner asked for it.
- **When the gate blocks.** Home shows the level progress instead of a lesson button: "Level 4 —
  22 of 30 kanji at Guru. 5 more to level up." The goal ring's lesson part counts only lessons that
  are available today, so a blocked day can still reach 100% from reviews. (Builder: the allowance
  is `min(intensity allowance, startable items)`.)
- **When the test is open.** When the kanji gate of the active level passes and the test is not
  passed, Home shows a **"Level test" card next to the Learn button**. The lessons of the level
  continue. Copy example: "Level 4 test — pass 2 of these 3 passages. 1 passed." The next level's
  lessons stay closed until the test is passed. If nothing of the level is startable, the lesson
  button is replaced by the test card, with the same copy.
- **Level-up moment.** When a level is completed, the next Home visit shows one full-screen card:
  "Level 5 complete", the counts of the next level's of new radicals, kanji, words and grammar, and — when the level crosses a
  JLPT row of §7.5 — "You have passed the N5 range". One card per level; it is not shown again
  after it is dismissed (a device-only preference is enough, it does not need to sync).

### 7.5 JLPT as display only

- The build calculates `level_jlpt_equivalence`: for each JLPT level, the first level at which a
  learner who has completed all earlier levels knows at least 90% of that JLPT level's kanji, words
  and grammar (each measured separately; the latest of the three wins). The JLPT reference lists
  are the hand-authored N5 and N4 datasets (kanji, words, grammar), used only here.
- **Only N5 and N4 rows exist** (my call, 2026-11-18). There are no reliable N3–N1 lists in the
  repo: derived words carry frequency bands, KANJIDIC2 uses the old 4-level JLPT, and there is no
  N2/N1 grammar. Levels after the N4 row show "Beyond N4". More rows can come later with a real
  reference list.
- The app shows it as text: Home level card ("Level 8 · N5 range"), the level list screen
  (`app/levels/`), Browse level filter labels, onboarding start-level choices, Stats.
- No query, gate, filter or stored value uses it. Browse filters by **level range** (1–10, 11–20 …)
  with the JLPT label as a caption.

### 7.6 Content work

**Rule (operator decision 2026-11-18):** grammar example sentences and passages must use only
words at or below their level before release, because they teach. Vocabulary example sentences
and vocabulary mnemonics may use later words at release (furigana shows the reading); the build
lists them, and they are regenerated in a later phase of the same plan. The operator accepts
regeneration of everything the restructure breaks.

Measured from the build, 2026-11-22. `curriculum/_build/reports/ladder-report.md` prints the
current counts (`content_breaks`).

| Type | What breaks | Count | When |
| --- | --- | ---: | --- |
| Grammar | Example sentences that use a word above the point's level (`grammar/pool.json`; the lesson shows the same sentences) | 717 of 1,510, in 132 of 159 points | Before release |
| Grammar | Points with fewer than 2 example sentences that use only learned words | 41 of 159 | Before release (minimum fix) |
| Grammar | Points whose linked words (`vocabulary_slugs`) include a word above the point's level | 93 of 160 | Before release (relink or regenerate) |
| Grammar | Mnemonics with a Japanese example inside | 159 to check | Before release (check by hand) |
| Vocabulary | Example sentences that use a word above the word's level (`vocabulary/examples.json`) | 1,430 of 3,751, in 777 of 1,249 words | Later phase |
| Vocabulary | Mnemonics written without naming a kanji that was untaught then and is now taught first (old `builds_on` words, e.g. 昨日) | 630 of 1,249 | Later phase |
| Vocabulary | Words in levels 1–20 with no content | 0 (all 1,127 have examples and mnemonics) | — |
| Kanji | Kanji in levels 1–20 with no mnemonic (new writing) | 184 of 580 | Before release |
| Kanji | Mnemonics that break (they name only radicals, and radicals now always come first) | 0 | — |
| Radicals | Radicals in levels 1–20 with no mnemonic (new writing) | 4 of 403 | Before release |
| Radicals | Mnemonics that break (they name nothing else) | 0 | — |
| Passages | All passages | 60 rewritten, about 3 per level over levels 2–20 (level 1 has no passage; decision 2026-11-22). Today 37 of 60 sit above level 20. Passages are now **gate content** (the level test, §7.4): every level 2–20 needs at least 3 passages | Before release |

Radicals without art still render as text; that does not change.

**Passages are gate content (2026-11-22).** A level cannot be completed without 2 passed passages,
so each level 2–20 needs at least 3 (the learner picks 2, and a passage with a word the learner
has not learned yet is closed). The build report lists every level 2–20 with fewer than 3
passages (must be zero). Because a wrong answer is never shown, the accepted answers of every
passage question are widened (kana and kanji form, with or without です) and the operator reviews
them before release.

Existing mnemonic and example generation (`generate_content/`) is reused with the level as the
cutoff in place of the JLPT level. Existing memory rules apply (grammar pool span pitfalls,
passage word band, example literal forms).

### 7.7 Build reports

`kanji_bands.py` and `level_report.py` are replaced by one ladder report that prints, per level:
radicals, kanji, words, grammar points, passages, items with no mnemonic, and the
`level_jlpt_equivalence` table. It also lists every rule-2 breach (must be zero) and every example
sentence or passage that uses a word above its level.

### 7.8 App screens that change

About 40 non-test files under `mobile/src` refer to JLPT today. They move to the level number:

- **Onboarding.** Welcome asks "new to Japanese" (start at level 1) or "I know some" (placement).
  Placement (`core/placement/placementEngine.ts`) samples items by **level range** (1–10, 11–20 …)
  and suggests a start level; it does not read the JLPT table (my call). The suggestion is shown
  with its JLPT label. Bulk mark-known works on level
  ranges. Import (WaniKani, Anki, Bunpro) is unchanged; after an import the app suggests a start
  level from what was imported.
- **Home.** Level card and gate progress (§7.4); level test card; level-up card.
- **Browse.** Level range filter (§7.5).
- **Levels screen** (`mobile/src/app/levels/`, `mobile/src/app/(tabs)/learn/[level].tsx`). One
  row per level with its state (§7.4) and progress. Completed levels cannot be picked; skipped and
  not-started levels can. This replaces "Pick any level to make it your active level".
- **Reading.** Passage unlock (≥ 90% Guru+ coverage) does not change. "At your level" means the
  passage level ≤ current level.
- **Level test screen** (operator decision 2026-11-22). Built from the passage practice screen
  (`components/read/PassageQuestion.tsx` and the screen that hosts it), in a test mode: a wrong
  answer shows only "not correct"; the correct answer is not shown; retries are unlimited; no SRS
  effect; only correct answers are stored. It lists the level's passages, shows which can be
  taken (§7.4) and which are passed, and tells the learner why a passage is closed ("Learn these
  words first"). It opens from the Home level test card.
- **Talk.** The turn budget and curriculum words use the current level, not the JLPT level.
- **Item detail.** Header shows "Level 7"; the JLPT value disappears.

### 7.9 Existing users (web and mobile)

A numbered migration cannot do this work: `initializeDatabases` (`mobile/src/data/database.ts`)
runs migrations before `curriculum.db` is attached, and the work needs item levels. So it is a
**one-time step after the attach**, guarded by a device preference so it runs once:

- `starting_jlpt_level` → `starting_level`, using the first level of that JLPT row in §7.5
  (N5 → 1).
- `completed_levels` is calculated once from the user's SRS states: every level whose kanji gate
  passes (no level test for these levels, §7.4). `active_level` is the lowest level at or above the old start level that is not
  completed. Levels below the old start level that are not completed are skipped.
- SRS rows, study statuses and opt-ins are kept as they are. A word that the user already studies
  but whose kanji is now at a later level keeps its rows. The existing rule "ask the reading only
  when every kanji is Guru" stays in the app, so these words keep working with no special case.
- The sync file format gets the new preferences. A device on the old app version cannot sync with
  the new file shape. The ladder switch **bumps `BACKUP_FORMAT_VERSION` from 1 to 2**
  (`mobile/src/core/backup/backupSerializer.ts`). The current app already refuses a file with a
  different format version (`BACKUP_VERSION_UNSUPPORTED`), and sync turns that into
  `sync_update_required` ("Update the app to sync", `syncCodec.ts`). So an old app cannot read or
  overwrite the new file. The new app reads versions 1 and 2 (old backups and an old remote file
  still restore, then the conversion above runs) and writes version 2.
- **Accepted: practice results restart.** `passage_practice_results` is keyed by `passage_id`. All
  60 passages are rewritten with new ids (Task 9), so old results no longer count. The operator
  accepts this.
- **Harmless: sentence rotation restarts.** `grammar_sentence_history.sentence_keys` goes stale
  after the grammar regeneration (§7.6). A stale key matches no sentence, so the rotation starts
  again.

## 8. Left to the builder

Decided, not left: the sync format version is bumped (§7.9).

- Exact kanji counts per level after 20, and the exact frequency-slot curve for words, inside the
  limits of §7.1 and §7.2.
- File names and layout of the generated per-type source files.
- Visual design of the gate progress card and the level-up card, inside the existing NativeWind
  tokens.
- The order of tasks inside the plan, as long as the build report (§7.7) comes before any app
  change.

## 9. How we know it works

- Ladder report: zero rule-2 breaches; level 1 ≤ 25 radicals and ≤ 20 kanji; levels 1–20 sizes
  inside §7.1.
- Every grammar point in levels 1–20 has at least 2 example sentences that use only words at or
  below its level. Every passage passes the existing passage validation at its level.
- `grep -rn "jlpt" mobile/src` finds only display code (the equivalence table and its labels).
- Unit tests: gate (89% / 90%, known items count, a completed level stays completed); level
  picking (skip forward, go back only to a level that is not completed, active level after a
  completion skips completed levels); planner pool by level; sync merge (`completed_levels`
  union, active level moved forward if completed); migration of a web user with N5 progress.
- Level test: kanji gate passes but the test is not passed → level not complete; 2 passages
  passed → complete; 1 passed → not complete; a passage with a word the learner has not learned
  cannot be taken; a wrong answer is not stored and not revealed; `markLevelsKnown` completes
  levels 2–20 with no test; level 1 completes on the kanji gate alone. The build report shows
  at least 3 passages for every level 2–20.
- Lesson order with real ladder data: a kanji never appears in a lesson while one of its radicals
  is below Guru, and a word never appears while one of its kanji is below Guru.
- Before release: the ladder report shows zero grammar example sentences above their point's level
  and every grammar point with at least 2 examples; the later-phase vocabulary counts are listed.
- `scripts/simulate-lessons.ts` runs a perfect learner to level 10 and reports the days per level.
  The simulated learner passes each level test on the day it opens. Target: about 8–9 days per
  level (about 7 for the kanji gate, plus the test). If the mean is above 14 days, stop and report
  before tuning.
- Existing CI: `validate-schema`, `compile-curriculum`, `check-contrast`, mobile lint, typecheck,
  Jest.
