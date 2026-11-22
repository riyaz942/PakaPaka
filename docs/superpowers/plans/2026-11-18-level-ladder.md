# Level Ladder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the JLPT-level structure with 60 numbered levels (radical → kanji → word order, grammar and passages inside levels), a WaniKani-style level gate, and JLPT shown only as a display table.

**Architecture:** A new pure build step (`curriculum/_build/ladder.py`) gives every item a level and writes the checked-in `_build/ladder.json`. `generate.py` writes one file per item type with a `level` on each item; compile writes `items.level INTEGER` and a `level_jlpt_equivalence` table. In the app, pure level rules live in `core/level/`, the gate and the one-time preference conversion in `data/level/`, and every screen that reads a JLPT value moves to the level number.

**Tech Stack:** Python 3.12 build (`unittest`, fugashi), TypeScript compile scripts (Jest, better-sqlite3, ajv), Expo / React Native app (Jest, expo-sqlite, NativeWind).

**Spec:** `docs/superpowers/specs/2026-11-18-level-ladder-design.md` (read it first; section numbers below refer to it).

## Global Constraints

- **Branch and commits.** Work on `docs/level-ladder-plan` (operator decision, 2026-11-22). Do not create a branch. Commit at each task checkpoint, when the tests are green (one commit per task, `git add` only the files of the task).
- **Merge `main` often** (about weekly): the JLPT app is released for feedback while this work continues. After a merge, rebuild the generated files (`items.json`, `curriculum.db`, `ladder.json` outputs); never merge them by hand.
- **Over-the-air.** The ladder `curriculum.db` is `schema` 2: raise `CURRICULUM_SCHEMA_VERSION` (`scripts/curriculum-schema.ts`) and `REQUIRED_CURRICULUM_SCHEMA_VERSION` (`mobile/src/data/curriculum/curriculumConfig.ts`) together in Task 5. Keep the `s1` release path working (`scripts/release-curriculum.ts`, `docs/curriculum-releases.md`) for content fixes to old store apps.
- **Level 1 has no reading passage.** 60 passages, about 3 per level, levels 2–20.
- Levels are integers 1–60. Every level has at least 1 kanji.
- Kanji per level: 18, 24, 28, then 30 for levels 4–20; the rest split evenly over levels 21–60.
- Gate: a level is complete when ≥ 90% of its kanji are Guru or higher, or marked known (`LEVEL_GATE_RATIO = 0.9`). Only kanji count.
- **Level test (operator decision 2026-11-22, spec §7.4).** Levels 2–20 are complete only when the kanji gate passes AND the learner has passed 2 of the level's passages (`LEVEL_TEST_PASSAGES = 2`). A passage is passed when every question has a correct row in `passage_practice_results` (already in `SYNC_TABLES`; no new store). A passage can be taken only when the level's kanji gate passes and every word in it is started or known. A wrong answer is never revealed, never stored, retries unlimited, no SRS effect. No test for level 1, levels 21–60, and levels completed by `markLevelsKnown`, placement, import or the one-time conversion. Home shows a "Level test" card next to Learn.
- A completed level stays completed. A completed level cannot be picked. Any other level can be picked.
- After a level completes, the active level becomes the lowest level above it that is not completed.
- No JLPT value in app logic (queries, filters, gates, stored preferences). JLPT appears only through `level_jlpt_equivalence` as display text. Only N5 and N4 rows; later levels show "Beyond N4".
- Item ids and slugs never change (`curriculum/id-registry.json`).
- Hard conventions in `CLAUDE.md`: `Result<T, AppError>`, never write `curriculum.db`, sync merge rules are pure functions in `src/core/sync/`, NativeWind semantic tokens only.
- Python tests: `curriculum/_build/.venv/bin/python -m unittest discover -s curriculum/_build -p 'test_*.py'`. Root TS tests: `npm test`. App: `cd mobile && npx jest <path>`, `npm run lint`, `npx tsc --noEmit` (5 known errors in `(tabs)/converse` typed routes are older than this work).
- Content lanes follow the memory rules: Gemini web driven by the agent, prompt header comment stripped, dry-run validate before ingest, grammar pool span pitfalls, literal じる forms.

## Review Focus

1. **An old backup file or an old-shape sync file** (has `starting_jlpt_level`, no `active_level`) is restored or pulled → the app converts it and opens at the right level; it does not crash or reset to level 1 (test in Task 12).
2. **Sync makes the active level a completed level** (device A completes level 5 while device B is active on 5) → after the merge, the active level moves forward; `completed_levels` is the union (test in Task 12).
3. **Kanji fall below Guru after a level completes** → the level stays completed and is still not pickable (test in Task 11).
4. **The learner completes level 60** → no next level; active stays 60 and Home says every level is complete instead of showing a gate card (test in Task 11 and Task 15).
5. **A level whose kanji are all marked known by import or bulk mark-known** → it completes at once, the level-up card shows once, and the active level moves on (test in Task 13).
6. **Kanji gate passes but the level test is not passed** (levels 2–20) → the level is not complete; Home shows the "Level test" card next to Learn; the next level's lessons stay closed; passing the 2nd passage completes the level and the level-up card shows once (tests in Tasks 11, 13, 15).

---

## Phase 1 — Build the ladder

### Task 1: Integer levels in `levels.py` and `levels.json`

**Files:**
- Modify: `curriculum/_build/levels.py`
- Modify: `curriculum/_build/levels.json` (remove every current entry; keep `_about`, reworded for integer levels)
- Create: `curriculum/_build/jlpt_reference.json` (one-time snapshot, Step 0)
- Test: `curriculum/_build/test_levels.py` (create)

**Interfaces:**
- Produces:
  - `MAX_LEVEL = 60`
  - `KINDS = ("radical", "kanji", "vocabulary", "grammar", "passage")`
  - `load_overrides(kind: str) -> dict[str, int]` — raises `ValueError` for a bad key, an unknown kind, or a level that is not an int in 1..60.
  - `load_ladder() -> dict` — reads `_build/ladder.json` (Task 2 writes it).
  - `level_of(kind: str, slug: str) -> int` and `slugs_at_or_below(kind: str, level: int) -> list[str]` (ladder sort order) — read `load_ladder()`.
  - `place()` and `LEVEL_ORDER` / `KIND_LEVELS` are removed.
  - `jlpt_reference.json`: `{"N5": {"kanji": [...], "vocabulary": [...], "grammar": [...]}, "N4": {...same...}, "N3": {"grammar": [...]}}` — slugs; grammar lists in today's generated `sort_order`. Build input for Task 2 (grammar tiers and teaching order, the display table) only.

- [ ] **Step 0: Snapshot `jlpt_reference.json` before changing anything**, with a throwaway command (do not keep a script): kanji from KANJIDIC2 old-JLPT tag 4 (N5) and 3 (N4), read as `reports/kanji_bands.py` reads it; vocabulary from `n5_vocab.py` / `n4_vocab.py`; grammar from today's `curriculum/grammar/n5.json`, `n4.json`, `n3.json` (these already include the `levels.json` grammar moves, which Step 3 deletes).
- [ ] **Step 1: Write failing tests** in `test_levels.py` (patch `LEVELS_PATH` / the ladder path to temp files):
  - `test_override_int_level_loads`: `{"kanji:one": 3}` → `load_overrides("kanji") == {"one": 3}`.
  - `test_override_rejects_string_level`: `{"kanji:one": "n5"}` → `ValueError`.
  - `test_override_rejects_level_61` and `test_override_rejects_level_0` → `ValueError`.
  - `test_slugs_at_or_below_keeps_sort_order`: ladder `{"vocabulary": {"b": {"level": 1, "sort_order": 2}, "a": {"level": 1, "sort_order": 1}, "c": {"level": 2, "sort_order": 1}}}` → `slugs_at_or_below("vocabulary", 1) == ["a", "b"]`.
- [ ] **Step 2: Run** `curriculum/_build/.venv/bin/python -m unittest curriculum/_build/test_levels.py` → FAIL.
- [ ] **Step 3: Implement** the interfaces above. Remove the JLPT entries from `levels.json`; the grammar order they encoded is kept by the grammar teaching order in Task 2 (spec §7.2 rule 7).
- [ ] **Step 4: Run** the same command → PASS.
- [ ] **Step 5: Checkpoint** (tests green, then commit the task). `generate.py` still imports `place`; it is fixed in Task 4, so do not run the full build yet.

### Task 2: `ladder.py` — assign every item a level

**Files:**
- Create: `curriculum/_build/ladder.py`
- Create (generated, checked in): `curriculum/_build/ladder.json`
- Test: `curriculum/_build/test_ladder.py`

**Interfaces:**
- Consumes: `levels.load_overrides`, `levels.MAX_LEVEL` (Task 1).
- Produces:
  - `KANJI_PER_LEVEL: list[int]` — 60 entries per Global Constraints.
  - `build_ladder(kanji, words, grammar, passages, overrides) -> dict` (pure). Inputs:
    - `kanji: list[{"slug", "form", "radicals": list[str]}]`
    - `words: list[{"slug", "kanji": list[str] (kanji slugs), "authored": bool}]` in frequency order (authored N5 list, then N4, then derived by rank)
    - `grammar: list[{"slug", "tier": "core" | "n3", "examples": list[list[str]] (vocab slugs per sentence)}]` in teaching order
    - `passages: list[{"slug", "vocabulary": list[str], "grammar": list[str]}]`
    - `overrides: dict[str, dict[str, int]]` (kind → slug → level)
  - Output: `{"radical"|"kanji"|"vocabulary"|"grammar"|"passage": {slug: {"level": int, "sort_order": int}}, "jlpt_equivalence": [{"jlpt": "N5", "first_level": 1, "last_level": int}, {"jlpt": "N4", ...}], "breaches": list[str]}`
  - `main()` — loads the real datasets, calls `build_ladder`, writes `ladder.json`, exits 1 if `breaches` is not empty.

Rules (spec §7.2):
1. Kanji order: greedy. The next kanji completes the most still-waiting words (a word waits until all its kanji are placed); ties: the number of waiting words it appears in, then the frequency rank of the first word it appears in, then slug.
2. Cut the order by `KANJI_PER_LEVEL`. A kanji override takes its slot at the named level ahead of the greedy pick.
3. A radical's level = the lowest level of a kanji that uses it.
4. Frequency slot: authored words spread evenly over levels 1–20 in list order; derived words over levels 21–60 by rank. A word's level = max(level of its last kanji, its slot). Kana-only words use the slot.
5. Grammar: `core` points (N5+N4, 126) over levels 1–20 and `n3` points (34) over 21–25: `level = first + floor(i * span / n)`.
6. Passage level = max level of its words and grammar.
7. Overrides win for every kind. A result where a kanji's level < one of its radicals', or a word's level < one of its kanji's, is added to `breaches` (message names both slugs).
8. `sort_order` inside a level, simpler first (operator decision 2026-11-22): radicals and kanji by stroke count (KANJIDIC2, else the KanjiVG glyph, else a table in `ladder.py`), ties in pick order; words by the position, in the level's new kanji order, of their last kanji at that level (0 when none is: kana-only words, or kanji from earlier levels), then frequency order; grammar in teaching order; passages in dataset order. Levels do not change.
9. `jlpt_equivalence`: for N5 then N4, `last_level` = the first level at which ≥ 90% of that JLPT list's kanji, words and grammar (each separately) sit at or below it; `first_level` = 1 for N5, N5's `last_level + 1` for N4.

- [ ] **Step 1: Write failing tests** with a tiny fixture (5 kanji, 3 radicals, 8 words, 4 grammar points) and a patched `KANJI_PER_LEVEL = [2, 2, 1, ...]`:
  - `test_kanji_that_completes_most_words_goes_first`
  - `test_radical_level_is_first_kanji_level`
  - `test_word_waits_for_last_kanji` (word with kanji at levels 1 and 2 → level ≥ 2)
  - `test_word_waits_for_frequency_slot` (word whose kanji are at level 1 but slot is 3 → 3)
  - `test_kana_only_word_uses_slot`
  - `test_grammar_spread_in_teaching_order` (levels non-decreasing, first point at level 1)
  - `test_override_wins_and_breach_is_reported` (`{"vocabulary": {"w1": 1}}` where `w1`'s kanji is level 2 → `breaches` has one entry naming `w1`)
  - `test_every_level_has_a_kanji` (on `KANJI_PER_LEVEL` itself: 60 entries, all ≥ 1, `KANJI_PER_LEVEL[:3] == [18, 24, 28]`, `KANJI_PER_LEVEL[3:20] == [30] * 17`)
  - `test_jlpt_equivalence_last_level_at_90_percent`
- [ ] **Step 2: Run** `curriculum/_build/.venv/bin/python -m unittest curriculum/_build/test_ladder.py` → FAIL.
- [ ] **Step 3: Implement** `build_ladder` and `main()`. `main()` reads kanji and radical edges from `skeleton.json` + `decomposition.json` + the hand-authored kanji datasets (as `generate_bands()` does), words from `_vocab_sources()` order, grammar from `jlpt_reference.json` (`core` = N5 list then N4 list, `n3` = N3 list, each in its stored order), passages from `n5_readings.py` / `n4_readings.py`.
- [ ] **Step 4: Run** the tests → PASS. Run `curriculum/_build/.venv/bin/python curriculum/_build/ladder.py` → writes `ladder.json`, exit 0, prints per-level kanji counts matching `KANJI_PER_LEVEL`.
- [ ] **Step 5: Checkpoint** (tests green, then commit the task).

### Task 3: Ladder report (replaces the band and level reports) — operator checkpoint

**Files:**
- Create: `curriculum/_build/reports/ladder_report.py`, output `curriculum/_build/reports/ladder-report.md`
- Delete: `reports/kanji_bands.py`, `reports/kanji-bands.md`, `reports/kanji-bands.json`, `reports/level_report.py`, `reports/level-report.md`, `_build/bands.json` (check for other importers with `grep -rn "kanji_bands\|level_report\|bands.json" curriculum scripts .github`, and move what they still need onto `ladder.json`)
- Test: `curriculum/_build/reports/test_ladder_report.py`

**Interfaces:**
- Consumes: `levels.load_ladder()`; content sidecars (`grammar/pool.json`, `vocabulary/examples.json`, `vocabulary/mnemonics.json`, `kanji/mnemonics.json`, `radicals/mnemonics.json`, `grammar/mnemonics.json`).
- Produces: `content_breaks(ladder, sidecars) -> dict[str, int]` (pure) with exactly these keys, which later tasks read as their "done" check:
  `grammar_sentences_above_level`, `grammar_points_under_2_readable`, `grammar_points_linked_above_level`, `vocab_sentences_above_level`, `vocab_mnemonics_without_kanji`, `kanji_1_20_without_mnemonic`, `radicals_1_20_without_mnemonic`, `passages_above_target`.
  - A sentence is "above level" when one of its `vocabulary_slugs` has a level > the owner's level.
  - `vocab_mnemonics_without_kanji` = words whose mnemonic was written when a kanji of the word was a `builds_on` (untaught) kanji. Snapshot that slug list from today's `dependencies/graph.json` into `_build/regen_vocab_mnemonics.json` before Task 4 rebuilds the graph; the count drops as Task 19 regenerates them (the list records each regenerated slug as done).
  - `passages_above_target` = passages whose level > 20.

The report prints: the per-level table (radicals, kanji, words, grammar, passages, items with no mnemonic), the `jlpt_equivalence` rows, `breaches`, and the `content_breaks` table with the spec §7.6 columns.

- [ ] **Step 1: Write failing tests**: `test_sentence_with_later_word_counts`, `test_point_with_one_readable_example_counts`, `test_kanji_without_mnemonic_only_counts_levels_1_to_20`.
- [ ] **Step 2: Run** `.venv/bin/python -m unittest curriculum/_build/reports/test_ladder_report.py` → FAIL.
- [ ] **Step 3: Implement** and run `curriculum/_build/.venv/bin/python curriculum/_build/reports/ladder_report.py`.
- [ ] **Step 4: Run** the tests → PASS.
- [ ] **Step 5: Replace the estimate table in spec §7.6** with the report's numbers (one-line note: "Measured from the build, <date>").
- [ ] **Step 6: Operator checkpoint.** Stop and show the operator `ladder-report.md`: level 1 radicals/kanji, levels 1–20 sizes, the JLPT rows, the break counts. Continue only after the operator accepts the ladder. Moves the operator asks for go into `levels.json`; re-run Tasks 2–3.

### Task 4: `generate.py` and `generate_deps.py` write the ladder

**Files:**
- Modify: `curriculum/_build/generate.py`, `curriculum/_build/generate_deps.py`
- Delete: `curriculum/{radicals,kanji,vocabulary,grammar,readings}/n{1..5}.json`
- Create (generated): `curriculum/{radicals,kanji,vocabulary,grammar,readings}/items.json`
- Modify: `.github/workflows/compile-curriculum.yml` (regenerate step), `curriculum/README.md` (Layout, Bands → Levels, Moving an item, Regenerating)
- Test: `curriculum/_build/generate_content/test_generate_grammar_level.py` (update), `curriculum/_build/test_generate_ladder.py` (create)

**Interfaces:**
- Consumes: `levels.load_ladder()`, `levels.level_of`.
- Produces:
  - File shape for every kind: `{"items": [{..., "level": int, "sort_order": int}]}`; readings `{"passages": [{..., "level": int, "sort_order": int}]}`. `sort_order` is global inside the file: by level, then the ladder `sort_order`.
  - CLI: `generate.py` with no arguments writes all five files. `--level` and `--bands` are removed.
  - `build_grammar_point(slug, pool_entry)` (level argument removed; the content lane calls it).
  - Known words for a level = `slugs_at_or_below("vocabulary", level)`; this replaces the JLPT `known` set for furigana reading overrides and passage word links.
  - `generate_deps.py`: every kanji → word edge is `requires`; radical → kanji stays `builds_on`; `reinforces` unchanged.
  - Grammar pool gate: `generate.py --report-pool` prints pool failures and continues; without the flag a failure exits 1 (today's behaviour). The flag exists only until Task 7, which removes it.

- [ ] **Step 1: Write failing tests** in `test_generate_ladder.py`: `test_items_file_has_level_on_every_item` (run the writer on a 3-item fixture ladder), `test_sort_order_follows_level_then_ladder_order`, `test_all_kanji_word_edges_are_requires` (run `generate_deps` edge builder on a fixture).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Update the existing generator tests for the new signatures.
- [ ] **Step 4: Run** the full Python suite → PASS. Run `generate.py --report-pool` and `generate_deps.py` → exit 0.
- [ ] **Step 5: Checkpoint** (tests green, then commit the task). CI regenerate step: `python curriculum/_build/ladder.py && python curriculum/_build/generate.py && python curriculum/_build/generate_deps.py` (until Task 7, CI uses `--report-pool`).

### Task 5: Schema, validation and compile

**Files:**
- Modify: `curriculum/schema/curriculum.schema.json`, `curriculum/metadata.json` (`jlpt_levels` removed, description rewritten for levels)
- Modify: `scripts/validate-schema.ts`, `scripts/compile-curriculum.ts`, `scripts/curriculum-schema.ts`, `scripts/seed-id-registry.ts`, `scripts/simulate-lessons.ts` (compile only; behaviour changes in Task 17)
- Test: `scripts/validate-schema.test.ts`, `scripts/compile-curriculum.test.ts`

**Interfaces:**
- Produces (`curriculum.db`):
  - `items.level INTEGER NOT NULL`, index `idx_items_level`; `items.jlpt_level` removed.
  - `reading_passages.level INTEGER NOT NULL`; `jlpt_level` removed.
  - `CREATE TABLE level_jlpt_equivalence (jlpt TEXT PRIMARY KEY, first_level INTEGER NOT NULL, last_level INTEGER NOT NULL)` — rows from `ladder.json` `jlpt_equivalence`. Compile reads `_build/ladder.json` for this table only.
  - `curriculum_metadata` has no `jlpt_levels`.
- `assignItemIds` sorts new keys by `level` (number), then type, then slug.
- `CURRICULUM_SCHEMA_VERSION` and `REQUIRED_CURRICULUM_SCHEMA_VERSION` go from 1 to 2 together (the root test `scripts/curriculum-schema-sync.test.ts` checks they match). The `s1` release path keeps working; `release-curriculum.ts` still accepts schema 1 for old-app fixes. Update `docs/curriculum-releases.md` and `mobile/assets/curriculum-manifest/README.md` for the second schema, and swap the bundled seed manifest to schema 2.

- [ ] **Step 1: Write failing tests**: validate rejects an item without `level`, a `level` of 0 or 61, and a file with a `jlpt_level` key; compile writes `items.level` as an integer and two `level_jlpt_equivalence` rows; ids of existing keys do not change after a level move (fixture registry).
- [ ] **Step 2: Run** `npm test -- scripts/validate-schema.test.ts scripts/compile-curriculum.test.ts` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests → PASS. Run `npm run validate-schema && npm run compile-curriculum` → exit 0, no `--update-registry` needed (no key added or removed). `sqlite3 mobile/assets/curriculum-seed/curriculum.db "SELECT MIN(level), MAX(level), COUNT(*) FROM items"` → `1|60|12726`.
- [ ] **Step 5: Checkpoint** (tests green, then commit the task). The app is broken against this database until Task 10; do not run the app in between.

## Phase 2 — Content tools and content

### Task 6: Content tools read ladder levels

**Files:**
- Modify: `curriculum/_build/generate_content/` — `context.py`, `example_context.py`, `reading_context.py`, `mnemonic_context.py`, `check_grammar_pool.py`, `generate_examples.py`, `generate_grammar_lessons.py`, `generate_mnemonics.py`, `generate_pool.py`, `generate_readings.py`, `reading_seeds.py`, `validate_examples.py`, `validate_mnemonics.py`, `validate_readings.py`, `validate_drafts.py`, `build_answers.py`, `audit_shipped.py`, `audit_semantic.py`, `naturalness_check.py`, `grammar_detect.py`, `reading_link.py`; and `import/*.py` / `reports/dependency_order.py` / `reports/kanji_priority.py` only where they import a removed name (`LEVEL_ORDER`, `place`, `n*.json` paths)
- Test: the existing `generate_content/test_*.py` (update fixtures to integer levels)

**Interfaces:**
- Consumes: `levels.level_of`, `levels.slugs_at_or_below`, the `items.json` files (Task 4).
- Produces:
  - `context.load_items(kind) -> list[dict]` (all levels, `items.json`).
  - `context.allowed_vocab_for(slug: str) -> list[dict]` for a grammar point: every word at or below the point's level, plus the point's own linked words that are at or below its level. The proportional same-level cutoff and `CORE_SEED_SLUGS` per JLPT level go away.
  - The CLIs take a slug or `--level <int>` (a range `--levels 1-20` where a lane batches) instead of `n5` / `n4`.
  - `mnemonic_context.vocab_context(slug)`: the kanji a word's story may name are its kanji at or below the word's level (with rule 2 that is all of them). `taught_levels` goes away.
- [ ] **Step 1: Update the tests** to integer-level fixtures; add `test_allowed_vocab_is_words_at_or_below_point_level` in `test_check_grammar_pool.py`.
- [ ] **Step 2: Run** the full Python suite → the updated tests FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the full Python suite → PASS. `grep -rn "\"n5\"\|'n5'\|LEVEL_ORDER\|ALL_LEVELS" curriculum/_build --include='*.py' | grep -v test_ | grep -v jlpt_reference` → only dataset file names (`n5_vocab.py` imports) remain.
- [ ] **Step 5: Checkpoint** (tests green, then commit the task).

### Task 7: Grammar content (before release)

**Files:**
- Modify: `curriculum/grammar/pool.json` (via the pool lane), `curriculum/_build/n5_grammar.py` / `n4_grammar.py` (linked `vocabulary_slugs`), `curriculum/grammar/mnemonics.json` (only mnemonics whose Japanese example uses a word above the point's level), `curriculum/_build/generate.py` (remove `--report-pool`), `.github/workflows/compile-curriculum.yml`

**Interfaces:**
- Consumes: Task 6 tools; Task 3 `content_breaks`.
- Produces: `grammar_sentences_above_level == 0`, `grammar_points_under_2_readable == 0`, `grammar_points_linked_above_level == 0` in `ladder-report.md`.

- [ ] **Step 1: Relink** each point's `vocabulary_slugs` to words at or below its level (drop a later word; add a same-meaning word at or below the level if the point had only one link).
- [ ] **Step 2: Regenerate pool sentences** that are above level, in batches of 10 levels, with the `grammar-pool.md` prompt and `allowed_vocab_for` (Task 6). Dry-run `check_point` on every draft before ingest (memory: grammar pool span pitfalls). Keep sentences that already pass.
- [ ] **Step 3: Check the 159 grammar mnemonics** by script (tokenize the Japanese example, compare with `slugs_at_or_below`), regenerate only those that fail, with `grammar-mnemonic.md`.
- [ ] **Step 4: Remove `--report-pool`** from `generate.py` and CI. Run `generate.py` → exit 0 (pool gate strict again).
- [ ] **Step 5: Run** `ladder_report.py` → the three counts are 0. Run the full Python suite → PASS.
- [ ] **Step 6: Checkpoint** (tests green, then commit the task).

### Task 8: New kanji and radical mnemonics (before release)

**Files:**
- Modify: `curriculum/kanji/mnemonics.json`, `curriculum/radicals/mnemonics.json` (via the mnemonic lanes)

**Interfaces:**
- Consumes: Task 6 `mnemonic_context`; Task 3 `content_breaks`.
- Produces: `kanji_1_20_without_mnemonic == 0`, `radicals_1_20_without_mnemonic == 0`.

- [ ] **Step 1: Generate** the radical mnemonics (3) and then the kanji mnemonics (~186) for levels 1–20, in level order, with `radical-mnemonic.md` / `kanji-mnemonic.md`. Follow the memory rules (radical style, identical-radical one-liner via `identical_radical()`). New drafts only; do not touch reviewed mnemonics.
- [ ] **Step 2: Run** `validate_mnemonics.py` on the new drafts → no errors; ingest.
- [ ] **Step 3: Run** `generate.py` and `ladder_report.py` → both counts are 0.
- [ ] **Step 4: Operator review** of the new mnemonics (review_status stays `draft` until the operator marks them).
- [ ] **Step 5: Checkpoint** (tests green, then commit the task).

### Task 9: Reading passages (before release)

**Files:**
- Modify: `curriculum/_build/generate_content/reading_seeds.py` (seeds per level), `curriculum/_build/n5_readings.py`, `n4_readings.py` (shipped passages; memory: passage edit ship path) — or merge them into one `readings.py` dataset if the ingest allows it (builder's call)
- Modify: `curriculum/_build/generate_content/passages/*.json` drafts

**Interfaces:**
- Consumes: Task 6 `reading_context.seed_context(level, slug)` with an integer level.
- Produces: 60 passages, about 3 per level over levels 2–20 (`passages_above_target == 0`), **at least 3 passages for every level 2–20** (gate content, spec §7.6); each passes `validate_readings.py` at its level. A new `content_breaks` key `levels_2_20_with_fewer_than_3_passages == 0` (added to `ladder_report.py` and its test in this task). Accepted answers of every passage question are widened (kana and kanji form, with or without です) and the operator reviews them (Step 5).

- [ ] **Step 1: Rewrite the seeds**: 60 seeds, levels 2–20 (at least 3 seeds per level), each with `required_grammar` from grammar at or below its level and every core grammar point of levels 1–20 in at least one seed (the existing seed coverage check, now by level).
- [ ] **Step 2: Draft** with `reading-passage.md`; word-band pre-check before ingest (memory: ~0.57 tokenizer words per Japanese character, aim mid-band); probe causative forms with `grammar_detect` (memory).
- [ ] **Step 3: Run** `validate_readings.py` on each draft → pass; ingest; run `generate.py` and `ladder_report.py` → `passages_above_target == 0`. Run `npm run validate-schema && npm run compile-curriculum` — the passage set changed, so add `-- --update-registry` and check that old passage ids move to `retired` and question ids too (the registry rule: an id never goes to a different key).
- [ ] **Step 4: Widen the accepted answers** of every question in the 60 passages (kana and kanji form, with or without です; the app also ignores punctuation, Task 15). The test never reveals a wrong answer, so a missing valid form blocks the learner. Write the list of accepted answers per question to `reports/passage-answers.md` for the operator.
- [ ] **Step 5: Operator review** of `passage-answers.md` before release.
- [ ] **Step 6: Checkpoint** (tests green, then commit the task).

## Phase 3 — App

### Task 10: Curriculum data layer uses `level`

**Files:**
- Modify: `mobile/src/data/curriculum/curriculum.types.ts`, `itemRepository.ts`, `passageRepository.ts`, `radicalRepository.ts`, `browseRepository.ts`, `curriculumVersion.ts`
- Create: `mobile/src/data/curriculum/levelRepository.ts`
- Modify: the seed `curriculum.db` fixtures used by tests (`mobile/__mocks__/` / test helpers that build a curriculum schema)
- Test: `itemRepository.test.ts`, `passageRepository.test.ts`, `levelRepository.test.ts` (create)

**Interfaces:**
- Produces:
  - `JLPTLevel`, `JLPT_LEVELS`, `isJlptLevel` are deleted. Item and passage rows carry `level: number`.
  - `listItemsByLevelAndType(db, level: number, itemType): CurriculumListItem[]`
  - `listLessonCandidatePool(db, activeLevel: number): CurriculumListItem[]` — every item with `level <= activeLevel`.
  - `levelRepository.ts`: `getMaxLevel(db): number`; `listKanjiIdsByLevel(db, level: number): string[]`; `countItemsByLevel(db): Map<number, Record<ItemType, number>>`; `getJlptEquivalence(db): JlptEquivalenceRow[]` with `type JlptEquivalenceRow = { jlpt: 'N5' | 'N4'; firstLevel: number; lastLevel: number }` (a display type, never used in a condition outside `core/level/jlptLabel.ts`).
- [ ] **Step 1: Write failing tests**: `listLessonCandidatePool(db, 2)` returns level 1 and 2 items and no level 3 item; `getJlptEquivalence` returns the two rows in N5, N4 order; `listKanjiIdsByLevel` returns only kanji.
- [ ] **Step 2: Run** `cd mobile && npx jest src/data/curriculum` → FAIL.
- [ ] **Step 3: Implement.** `npx tsc --noEmit` now lists every caller that still uses JLPT types; Tasks 11–16 fix them.
- [ ] **Step 4: Run** the tests → PASS.
- [ ] **Step 5: Checkpoint** (tests green, then commit the task).

### Task 11: Pure level rules

**Files:**
- Create: `mobile/src/core/level/levelState.ts`, `mobile/src/core/level/jlptLabel.ts`
- Test: `mobile/src/core/level/levelState.test.ts`, `jlptLabel.test.ts`

**Interfaces:**
- Produces:
  - `LEVEL_GATE_RATIO = 0.9`
  - `isLevelComplete(kanjiIds: readonly string[], isPassed: (id: string) => boolean): boolean` — `isPassed` is true for Guru+ or known. A level with no kanji is not complete (the ladder guarantees ≥ 1; this keeps a bad file from skipping levels).
  - `nextActiveLevel(fromLevel: number, completed: ReadonlySet<number>, maxLevel: number): number` — lowest level > `fromLevel` not in `completed`; `maxLevel` when none is left.
  - `canPickLevel(level: number, completed: ReadonlySet<number>, maxLevel: number): boolean` — `1 <= level <= maxLevel` and not completed.
  - `type LevelState = 'active' | 'completed' | 'skipped' | 'not_started'`; `levelState(level, activeLevel, completed): LevelState` — skipped = below the active level and not completed (plan simplification of spec §7.4: a level above the active one shows "not started" even if the learner was on it before; both are pickable, so only the label differs).
  - `allLevelsComplete(completed: ReadonlySet<number>, maxLevel: number): boolean`
  - `jlptLabelForLevel(rows: readonly JlptEquivalenceRow[], level: number): string` — `"N5 range"`, `"N4 range"`, or `"Beyond N4"`.
  - `LEVEL_TEST_PASSAGES = 2`; `levelNeedsTest(level: number): boolean` — true for levels 2–20 only (`LEVEL_TEST_FIRST = 2`, `LEVEL_TEST_LAST = 20`).
  - `isLevelTestPassed(passedPassageCount: number): boolean` — `>= LEVEL_TEST_PASSAGES`.
  - `canTakePassageAsTest(kanjiGatePassed: boolean, passageWordIds: readonly string[], isLearned: (id: string) => boolean): boolean` — gate passed AND every word learned (started or known, any stage); a passage with no words is takeable only when the gate passed.
- [ ] **Step 1: Write failing tests**:
  - `isLevelComplete`: 27 of 30 passed → true; 26 of 30 → false; 0 kanji → false.
  - `nextActiveLevel(5, {6, 7}, 60) === 8`; `nextActiveLevel(60, {}, 60) === 60`.
  - `canPickLevel(4, {4}, 60) === false`; `canPickLevel(3, {4}, 60) === true`; `canPickLevel(61, {}, 60) === false`.
  - Review Focus 3: `levelState(4, 6, new Set([4])) === 'completed'` regardless of current stages (completion is read from the set, not recomputed).
  - Review Focus 4: `allLevelsComplete(set of 1..60, 60) === true`.
  - Level test: `levelNeedsTest(1) === false`, `levelNeedsTest(2) === true`, `levelNeedsTest(20) === true`, `levelNeedsTest(21) === false`; `isLevelTestPassed(1) === false`, `isLevelTestPassed(2) === true`.
  - `canTakePassageAsTest(true, ['a','b'], id => id === 'a') === false` (a word not learned); `canTakePassageAsTest(false, ['a'], () => true) === false` (gate not passed); both true → `true`.
  - `jlptLabelForLevel([{jlpt:'N5',firstLevel:1,lastLevel:12},{jlpt:'N4',firstLevel:13,lastLevel:21}], 22) === 'Beyond N4'`.
- [ ] **Step 2: Run** `npx jest src/core/level` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Checkpoint** (tests green, then commit the task).

### Task 12: Level preferences, one-time conversion and sync

**Files:**
- Modify: `mobile/src/data/user/preferencesRepository.ts`, `mobile/src/core/sync/mergeSpecial.ts`, `mobile/src/core/sync/syncTables.ts`, `mobile/src/data/database.ts`, `mobile/src/data/user/restoreBackup.ts`, the sync apply step in `mobile/src/data/sync/` (where merged rows are written)
- Create: `mobile/src/data/level/convertJlptPreference.ts`
- Test: `preferencesRepository.test.ts`, `mergeSpecial.test.ts`, `convertJlptPreference.test.ts` (create), `restoreBackup.test.ts`

**Interfaces:**
- Consumes: `levelRepository.getJlptEquivalence`, `getMaxLevel`, `listKanjiIdsByLevel` (Task 10); `isLevelComplete`, `nextActiveLevel` (Task 11).
- Produces:
  - `PREFERENCE_KEYS.activeLevel = 'active_level'`, `completedLevels = 'completed_levels'` (synced), `lastLevelCardShown = 'last_level_card_shown'` (added to `NEVER_SYNCED_PREFERENCE_KEYS`). `startingJlptLevel` stays only as a constant read by the conversion; nothing writes it.
  - `getActiveLevel(userDb): number | null`, `setActiveLevel(userDb, level: number): void`, `getCompletedLevels(userDb): number[]` (sorted, a bad value reads as `[]`), `addCompletedLevels(userDb, levels: number[]): void`.
  - `convertJlptPreference(curriculumDb, userDb): Result<void, AppError>` — idempotent. When `active_level` is missing: `completed_levels` = every level whose gate passes now; start = the N5/N4 row's `firstLevel` for a stored `starting_jlpt_level` of N5/N4, the last N4 level + 1 for N3–N1, 1 when none; `active_level` = start if not completed, else `nextActiveLevel(start, …)`. Deletes `starting_jlpt_level`. When `active_level` exists but is completed: moves it with `nextActiveLevel`.
  - Called (a) in `initializeDatabases` after `attachCurriculumForQuery`, (b) after a backup restore, (c) after a sync apply.
  - `BACKUP_FORMAT_VERSION` 1 → 2 (`core/backup/backupSerializer.ts`). Decode accepts 1 and 2 and writes 2; a version above 2 stays `BACKUP_VERSION_UNSUPPORTED` (→ `sync_update_required`). Spec §7.9.
  - `mergePreferences`: `completed_levels` changed on both sides → sorted numeric union (same pattern as `seen_unlocked_passage_ids`, a parser for a JSON integer list); a value that is not an integer list is a normal conflict.
- [ ] **Step 1: Write failing tests**:
  - Conversion: a web user with `starting_jlpt_level = 'N5'` and Guru+ on 27 of the 30 level-1 kanji → `completed_levels = [1]`, `active_level = 2`, `starting_jlpt_level` gone. Run twice → same result.
  - Conversion: `'N4'` → `active_level` = the N4 row's `firstLevel` (level not completed).
  - Review Focus 1: restore a backup file with `starting_jlpt_level` and no `active_level` → after restore, `active_level` is set and not 1 for an N4 user.
  - Review Focus 2: merge local `completed_levels [1,2]` and remote `[1,3]` from base `[1]` → `[1,2,3]`; then conversion on `active_level = 3` → moves to 4.
  - `getCompletedLevels` with stored `"nonsense"` → `[]`.
  - Backup format: a version 1 file decodes and restores; a file made by the new app has `formatVersion` 2; a version 3 file → `BACKUP_VERSION_UNSUPPORTED`.
- [ ] **Step 2: Run** `npx jest src/data/level src/core/sync src/data/user` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS, including the existing sync suites.
- [ ] **Step 5: Checkpoint** (tests green, then commit the task).

### Task 13: Gate refresh and level picking

**Files:**
- Create: `mobile/src/data/level/levelGate.ts`
- Modify: the review session end hook (`ReviewSessionProvider`) and the Home focus effect (`app/(tabs)/dashboard.tsx`) to call the refresh; `mobile/src/data/user/placementRepository.ts` (bulk mark-known by level range)
- Test: `mobile/src/data/level/levelGate.test.ts`, `placementRepository.test.ts`

**Interfaces:**
- Consumes: Tasks 10–12.
- Produces:
  - `refreshLevelProgress(curriculumDb, userDb, options?: { testRequired?: boolean }): Result<{ newlyCompleted: number[]; activeLevel: number }, AppError>` — checks every level that is not completed and has at least one started or known kanji; adds the ones that pass; if the active level completed, sets `active_level` with `nextActiveLevel`. `testRequired` defaults to `true`: for a level with `levelNeedsTest`, the level also needs `isLevelTestPassed(getPassedPassageCount(level))`. The no-test paths (`markLevelsKnown`, placement apply, import, `convertJlptPreference`) call it with `{ testRequired: false }`.
  - `getPassedPassageCount(curriculumDb, userDb, level: number): number` — passages of the level whose every question has a correct row in `passage_practice_results` (reads `passage_questions`; uses `passagePracticeRepository`).
  - `getLevelTestProgress(curriculumDb, userDb, level: number): { passed: number; needed: 2; kanjiGatePassed: boolean; passages: { passageId: string; passed: boolean; canTake: boolean }[] }` — Home uses it for "Level 4 test — pass 2 of these 3 passages. 1 passed."
  - `recordTestAnswer(userDb, passageId, questionId, userAnswer, isCorrect)` — writes only a correct answer (never a wrong one, never over a correct row); the test screen calls it.
  - `pickActiveLevel(curriculumDb, userDb, level: number): Result<void, AppError>` — error `level_not_pickable` when `canPickLevel` is false.
  - `markLevelsKnown(curriculumDb, userDb, fromLevel: number, toLevel: number): Result<void, AppError>` — replaces the JLPT `levelsBelow` bulk mark-known; marks every item in the range known, then runs `refreshLevelProgress(…, { testRequired: false })` (no level test for these levels).
  - `getLevelGateProgress(curriculumDb, userDb, level: number): { passed: number; total: number; needed: number }` — `needed = max(0, ceil(total * LEVEL_GATE_RATIO) - passed)`; Home uses it for "22 of 30 kanji at Guru. 5 more to level up."
- [ ] **Step 1: Write failing tests**:
  - Level 1: 27 of 30 kanji at Guru → `newlyCompleted = [1]`, active moves on (no test).
  - Level 4 (needs a test): 27 of 30 kanji at Guru, test not passed → `newlyCompleted = []`, active stays 4. One passage passed (every question correct) → still not complete. Two passed → `newlyCompleted = [4]`, active moves on.
  - A passage with a word not started or known → `getLevelTestProgress(...).passages[i].canTake === false`.
  - `recordTestAnswer` with a wrong answer writes nothing; a correct answer is not overwritten by a later wrong one.
  - A level 21 level (needs no test) completes on the kanji gate alone.
  - A skipped level (below active) whose kanji pass and whose test is passed → it is added to `completed_levels`; active does not change. Without the test passed → not added.
  - Review Focus 5: `markLevelsKnown(1, 3)` on a new user → levels 1–3 completed with no test (levels 2 and 3 included), active = 4, `newlyCompleted = [1, 2, 3]`.
  - `pickActiveLevel` on a completed level → `{ ok: false, error.code: 'level_not_pickable' }`; on level 15 → active 15.
  - `getLevelGateProgress` with 22 of 30 → `{ passed: 22, total: 30, needed: 5 }`.
- [ ] **Step 2: Run** `npx jest src/data/level src/data/user/placementRepository.test.ts` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Checkpoint** (tests green, then commit the task).

### Task 14: Lesson planner on the active level

**Files:**
- Modify: `mobile/src/data/lessonPlan.ts`, `mobile/src/core/lesson/lessonAllowance.ts`, `mobile/src/data/hooks/useLessonOptIn.ts`
- Test: `mobile/src/data/lessonPlan.test.ts`, `mobile/src/core/lesson/lessonAllowance.test.ts`

**Interfaces:**
- Consumes: `getActiveLevel`, `listLessonCandidatePool(db, activeLevel)`, `getLevelGateProgress`.
- Produces:
  - `LessonPlan.level: number` (the active level); `grammarLevel` is removed; new `gateBlocked: boolean` and `gateReason: 'kanji' | 'test' | null` — blocked when the pool has no startable item and the active level is not complete.
  - The JLPT loop and D11 ("advance when nothing startable") are removed; grammar comes from the same `≤ activeLevel` pool, paced by the existing grammar pace rules (D17 track resolution removed).
  - `computeDailyAllowance` gains `startableCount: number`; `total` and `remaining` are capped at it, so the goal ring's lesson part counts only lessons available today (spec §7.4).
  - Lower-level parts (D3) and opt-ins keep working unchanged; `useLessonOptIn` compares item `level` with the active level.
- [ ] **Step 1: Write failing tests**:
  - Active level 2 → plan items all have level ≤ 2.
  - All level ≤ 2 items started, level 2 not complete → `gateBlocked === true`, `items.length === 0`.
  - An opted-in level-9 word and its kanji and radicals are in the plan while active is 2.
  - Allowance: `dailyLessonItems 15, startableCount 4` → `total 4`.
  - `gateBlocked` is accompanied by `gateReason: 'kanji' | 'test'`: `'test'` when the level's kanji gate passes and the level test is not passed (next level's lessons stay closed; level's own lessons continue while startable).
  - **Real ladder data** (uses the compiled `curriculum.db`, not a fixture): simulate a learner who starts every lesson offered, with a stage rule that only lets an item reach Guru when asked; a kanji never appears in a lesson plan while one of its radicals is below Guru, and a word never appears while one of its kanji is below Guru. Check levels 1–5.
- [ ] **Step 2: Run** `npx jest src/data/lessonPlan.test.ts src/core/lesson` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Checkpoint** (tests green, then commit the task).

### Task 15: Home, level-up card and Levels screen

**Files:**
- Modify: `mobile/src/app/(tabs)/dashboard.tsx`, `components/engagement/LevelOverviewCard.tsx`, `LevelProgressBar.tsx`, `homeLayoutPreviewData.ts`, `data/hooks/useLevelProgress.ts`, `useAllLevelsProgress.ts`, `levelProgressShared.ts`, `useItemCountsByLevel.ts`, `app/levels/index.tsx`, `app/(tabs)/learn/[level].tsx`, `data/hooks/useLearnItems.ts`
- Create: `mobile/src/components/engagement/LevelTestCard.tsx`, `mobile/src/app/level-test/[level].tsx`, `mobile/src/core/level/testAnswer.ts` (+ test), `mobile/src/components/engagement/LevelUpCard.tsx`, `mobile/src/components/common/LevelPicker.tsx` (replaces both `JlptLevelPicker.tsx` files, which are deleted)
- Test: co-located `*.test.tsx` for each changed screen/component

**Interfaces:**
- Consumes: Tasks 10–14.
- Produces (copy is fixed by the spec):
  - **Level test card** (Home, next to the Learn button): when the active level needs a test, its kanji gate passes and the test is not passed: `Level {n} test — pass 2 of these {k} passages. {p} passed.` Lessons stay available next to it. It opens the level test screen.
  - **Level test screen** (`mobile/src/app/level-test/[level].tsx`, built from the passage practice screen and `components/read/PassageQuestion.tsx`, a `testMode` prop): lists the level's passages, closed ones say `Learn these words first`; an open passage asks its questions; a wrong answer shows `Not correct. Try again.` and nothing else (no correct answer, no hint); retries unlimited; matching ignores punctuation, accepts kana or kanji form, with or without です (a pure function `core/level/testAnswer.ts` `isAcceptedAnswer(answer, accepted[])`, with tests); a correct answer calls `recordTestAnswer`; when the passage is passed it shows `Passed` and the progress `{p} of 2`; at 2 it calls `refreshLevelProgress` and goes back to Home.
  - Home level card: `Level {n} · {jlptLabelForLevel}`; when `gateBlocked`: `Level {n} — {passed} of {total} kanji at Guru. {needed} more to level up.`; when `allLevelsComplete`: `Every level is complete.`
  - `LevelUpCard`: full screen on the next Home visit after a completion; `Level {n} complete`, counts of the next level's new radicals, kanji, words and grammar; when the completed level is a row's `lastLevel`: `You have passed the N5 range` (or N4). Shown once per completed level: `last_level_card_shown` stores the highest level whose card was shown.
  - Levels screen: title `Levels`; one row per level with state (`levelState`) and progress; completed rows are not pressable (`accessibilityState={{ disabled: true }}`); pressing another row calls `pickActiveLevel`. The text "Pick any level to make it your active level" is replaced by `Pick a level that is not complete. Completed levels stay completed.`
- [ ] **Step 1: Write failing tests**: Home shows the gate copy with 22/30/5; the level-up card shows once and not again after dismiss; a completed Levels row is disabled and a skipped row calls `pickActiveLevel`; Review Focus 4: all 60 complete → `Every level is complete.` and no gate card. Review Focus 6: gate passes, test not passed → the test card shows next to Learn with `1 passed` copy; a wrong answer on the test screen shows `Not correct. Try again.` and never the answer; `isAcceptedAnswer` accepts `がっこう`, `学校`, `学校です` and `学校。`.
- [ ] **Step 2: Run** `npx jest src/app/\(tabs\)/dashboard src/app/levels src/components/engagement` → FAIL.
- [ ] **Step 3: Implement** with semantic NativeWind tokens only; a11y labels on every pressable (lint blocks merge).
- [ ] **Step 4: Run** the tests and `npm run lint` → PASS.
- [ ] **Step 5: Checkpoint** (tests green, then commit the task).

### Task 16: Remaining JLPT readers — onboarding, placement, Browse, detail, Talk, reading

**Files:**
- Modify: `app/onboarding/welcome.tsx`, `placement.tsx`, `import.tsx`, `import-summary.tsx`, `hooks/useOnboardingRedirect.ts`, `core/placement/placementEngine.ts`, `app/(tabs)/browse/index.tsx`, `components/browse/BrowseList.tsx`, `core/browse/browseFilters.ts`, `components/learn/ItemDetailHeaderBar.tsx`, `data/hooks/useItemHeaderMeta.ts`, `components/common/CompareView.tsx`, `components/learn/explainerContent.ts`, `core/ai/turnBudget.ts`, `data/hooks/useAiConversation.ts`, `data/hooks/useReadingReadiness.ts`, `data/hooks/usePassagesByLevel.ts`, `data/hooks/useRadicals.ts`
- Test: the co-located tests of each file

**Interfaces:**
- Consumes: Tasks 10–13.
- Produces:
  - Onboarding: welcome offers `New to Japanese` (active level 1) and `I know some Japanese` (placement). `useOnboardingRedirect` checks `active_level`, not `starting_jlpt_level`.
  - `placementEngine`: samples by level range `[1–10, 11–20, 21–30, …]` (`PLACEMENT_SAMPLE_SIZE_PER_LEVEL` becomes per range); the outcome is a suggested start level; the screen shows it with `jlptLabelForLevel`. Applying it calls `markLevelsKnown(1, start - 1)` for passed ranges and `setActiveLevel(start)`.
  - Import summary suggests a start level: the lowest level that is not complete after the import's `refreshLevelProgress`.
  - Browse: facet `levels` values are ranges `1–10`, `11–20`, … with the JLPT label as a caption; the query filters `level BETWEEN`.
  - Item detail header: `Level {n}`.
  - `computeTurnBudget(activeLevel: number, stats)`: today's N5 budget for levels 1–10, N4's for 11–20, N3's for 21–35, N2's for 36–45, N1's for 46–60 (a number table in `turnBudget.ts`, not JLPT types).
  - Reading readiness: `atUserLevel` = passage `level <= activeLevel`; the ≥ 90% Guru+ unlock does not change.
- [ ] **Step 1: Update and add tests**: welcome → `New to Japanese` sets active 1; placement passing range 1–10 suggests 11 and completes levels 1–10; Browse range `11–20` filter returns only levels 11–20; `computeTurnBudget(12, …)` equals today's N4 value.
- [ ] **Step 2: Run** the touched suites → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `cd mobile && npx jest && npm run lint && npx tsc --noEmit` → PASS (only the 5 known converse errors). `grep -rniE "jlpt" mobile/src --include='*.ts' --include='*.tsx' | grep -v -E '\.test\.'` → only `levelRepository.ts` (equivalence query), `core/level/jlptLabel.ts`, `convertJlptPreference.ts` / the `startingJlptLevel` constant, and display copy.
- [ ] **Step 5: Checkpoint** (tests green, then commit the task).

### Task 17: Pace check with the real scheduler

**Files:**
- Modify: `scripts/simulate-lessons.ts`

**Interfaces:**
- Consumes: `buildLessonPlan`, `refreshLevelProgress`, the real FSRS scheduler in `mobile/src/core/srs/fsrsScheduler.ts`.
- Produces: `--ladder` mode: a perfect learner (every answer correct, every due review done the day it is due, **and every level test passed on the day it opens**) at the `relaxed` preset from level 1; prints days per level for levels 1–10 and the mean.

- [ ] **Step 1: Implement** `--ladder` (grade reviews through the scheduler instead of the `GURU_AFTER_DAYS` shortcut).
- [ ] **Step 2: Run** `npx tsx --tsconfig mobile/tsconfig.json scripts/simulate-lessons.ts --ladder`. Target: mean about 8–9 days per level (the kanji gate about 7, plus the level test). If the mean is above 14 days, **stop and report to the operator** with the table (spec §9); do not tune the scheduler or the gate.
- [ ] **Step 3: Checkpoint** (tests green, then commit the task). Record the table in `docs/working-history.md` (Task 18).

### Task 18: Docs and status

**Files:**
- Modify: `docs/working-history.md` (new row for this design and plan, status per phase), `curriculum/README.md` (finish what Task 4 started: Levels, Moving an item with integer `levels.json`, Authoring queue from `ladder-report.md`), `docs/content/kanji-coverage-and-dependency-order-plan.md` and `docs/content/untaught-kanji-in-vocabulary-mnemonics-plan.md` (one line at the top: "Superseded 2026-11-18 by docs/superpowers/specs/2026-11-18-level-ladder-design.md"), `docs/srs-system-vs-wanikani.md` (§ "Item-level, not account-level" now has a level gate)

- [ ] **Step 1: Write** the updates. State measured numbers from `ladder-report.md` and Task 17, not the spec estimates.
- [ ] **Step 2: Checkpoint** (tests green, then commit the task). Tell the operator the before-release work is complete and list the commits.

## Phase 4 — Later (after release)

### Task 19: Vocabulary examples and mnemonics

**Files:**
- Modify: `curriculum/vocabulary/examples.json`, `curriculum/vocabulary/mnemonics.json` (via the example and mnemonic lanes), `curriculum/_build/regen_vocab_mnemonics.json` (mark each regenerated slug done)

**Interfaces:**
- Consumes: Task 6 tools; Task 3 `content_breaks`.
- Produces: `vocab_sentences_above_level == 0` and `vocab_mnemonics_without_kanji == 0`.

- [ ] **Step 1: Regenerate example sentences** that use a later word, in level order (levels 1–20 first), with `vocab-examples.md`; dry-run `validate_examples.py`; write じる / ご覧になる forms literally (memory).
- [ ] **Step 2: Regenerate the vocabulary mnemonics** listed in `regen_vocab_mnemonics.json` with `vocab-mnemonic.md`; the story may now name every kanji of the word. Operator approved this regeneration (spec §3).
- [ ] **Step 3: Run** `validate_mnemonics.py`, `generate.py`, `ladder_report.py` → both counts are 0; full Python suite → PASS.
- [ ] **Step 4: Checkpoint** (tests green, then commit the task). Update `docs/working-history.md`.
