# Task 6c report: content runbooks use ladder levels

Status: DONE_WITH_CONCERNS.

Scope: `docs/workflows/*.md` (all 20 files) and three prompt lines. No tool code, tests, app code,
`docs/content/*`, `docs/design/*` or other READMEs changed. `PROMPT_VERSION` not changed; no draft stamped.

## Inventory (step 1 grep: 97 hits before the work; 5 hit lines remain, all history)

| Files | Hits | Decision | Reason |
| --- | --- | --- | --- |
| `README.md` | 0 hits | Added "Ladder work list" | Brief step 2; no counts copied |
| `grammar-web-chat-workflow.md` | `--level n5/n4`, `level = 'n5'`, `web/grammar/n5/`, `drafts/n5/`, "N5 + N4", "Do N5 before N4" | Changed | Real flags: `webprompts --level N / --levels / --slugs`, `ingest --slug --model`; `level-NN/` paths; list snippet uses `g['level']`; `generate.py` has no level flag |
| `example-sentences-web-chat-workflow.md` | same pattern, `vocabulary/n5.json`, `generate.py --level n5` | Changed | `vocabulary/items.json`; `webprompts` now refuses no selector (old "omit `--slugs` = every item" removed); level run picks only words with no sentences |
| `example-sentences-{web-chat,subagent,single-session}…automation-prompt.md` | `<level = n5/n4>`, `'<level>'`, `--level` on `ingest`/`webprompts`, `generate.py --level` | Changed | `<level = 6>` + `<level-dir>`; snippet uses `level_dir()` and "has example_sentences"; no `--level` on `ingest`; `generate.py` bare |
| `grammar-web-chat…automation-prompt.md`, `grammar-subagent…automation-prompt.md` | `<level = n5/n4>`, "N5 is already fully written", "N4 lessons use all N5 vocabulary", `load_grammar(level)` | Changed | `load_grammar()` takes no argument now; snippets filter on `g['level']`; paths `level-NN` |
| `grammar-pool-single-session…`, `build-answers-single-session…` | `<level = n5>`, `--level` on every subcommand | Changed | Only `select` takes `--level/--levels`; others take `--slugs`/`--slug`. Pool `select` lists only points with no pool entry (today 1), so the runbook now adds the `check_grammar_pool --level N` route for failing points. States that ingest replaces the whole pool entry and the build-answers lane then picks the point up again |
| `radical-kanji-vocab-mnemonic-web-chat-workflow.md` | "N5 set", "extending to N4" | Changed | Wording only (commands were fixed in 6a) |
| `radical-kanji-vocab-mnemonic-web-chat-…automation-prompt.md` | "reviewed N5 radicals", "N5 kanji were generated…", "Two conditions", Final Build "check under generate_content/" | Changed | Wording; one condition left (origins file); Final Build names the real command |
| `radical-kanji-vocab-mnemonic-subagent-…`, `…single-session-…` | `<level = n5/n4>`, `PROMPT_VERSION` auto-select, `--level n5/n4`, "745 of N5+N4's 1,247 words", `generate.py --bands`, `<level>.json` | Changed | Auto-select now matches `default_slugs` (item with no mnemonic); grammar scope text; `level-NN` paths; `curriculum/<type>/items.json`; counts removed; reading-link lane step 6 uses bare `generate.py` |
| `radical-art-web-chat-workflow.md`, `…-automation-prompt.md` | `curriculum/radicals/n5.json`…`n1.json`, `LEVEL='n5'`, band counts table, "`{n1-n5}/{slug}.webp`" | Changed | Those files do not exist; snippets read `radicals/items.json` and filter `level`. Snapshot counts removed. Gate text matches `generate-radical-asset-map.js` (`{slug}.webp`) |
| `reading-passages-{subagent,single-session}…` | `<level = n5/n4>`, "N5 and N4 each have 30", "N3+ have none", `<level>.json`, `vocab_cutoff`…, `curriculum/readings/<level>.json` | Changed | New "What a passage is now: the level test" block; `level_dir()` in snippet; SEED PROBLEM list matches `seed_errors`; shipped data is `curriculum/readings/items.json` and `*_readings.py`; widened-answer requirement added to the writer instructions |
| `reading-passage-naturalness-subagent…` | `<level = n5>`, `web/naturalness/<level>/` | Changed | `level-NN` |
| same file, lines 69-71 | "tearu, N4 grammar, off the list at every N5 seed" | Kept | History: an old outside review of the JLPT-era seed list; I added "(in the JLPT-era seed list)" |
| `semantic-audit-subagent…` | `<level = n5>`, "full N5 run is 60-70 batch files", `content-audit-<level>.md` | Changed | `level-NN`; made-up count removed |
| `prompts/grammar-lesson.md` | "JLPT {{LEVEL}}" | Changed | Fills as "level N" (`generate_grammar_lessons.py`); now "at {{LEVEL}}" |
| `prompts/persona.md` | "the N5 grammar lessons generated … v1" | Changed | "the grammar lessons generated … v1" |
| `prompts/reading-passage.md` | "〜てある is N4 grammar and will not be on your list" | Changed | `tearu` is level 15 on the ladder; it can be on the list. Now "not on your list unless the grammar list names it" |
| `prompts/radical-mnemonic-simplify.md:72`, `prompts/kanji-mnemonic-simplify.md:124` | "the old JLPT folders `n5/` … or the ladder folders" | Kept | Accurate: old drafts can still exist on a machine; 6a wrote this |
| `radical-kanji-vocab-mnemonic-*` PROMPT_VERSION history | "Rev 3 … radicals at 1", "Rev 5/6 vocab re-select" | Reduced | Old re-select paragraphs about stale versions removed with the old snippet (they describe behaviour the tool no longer has) |

Final grep (`JLPT|\bN[1-5]\b|\bn[1-5]\b|--level n|level = n`) in `docs/workflows` + `prompts`: 5 lines
left (3 in the naturalness history note, 2 in the simplify prompts), all history.
`grep -rnE "\-\-level n|level = n|JLPT level" docs/workflows` -> no hit.

## Commands verified

- `/tmp` script read every `-m generate_content.<module> [sub] --flags` line in `docs/workflows/*.md`
  (57 commands), ran each module's `--help` (and the subcommand `--help` for `generate_pool`,
  `build_answers`, `reading_link`) and checked every flag: 57 commands, 0 bad flags.
- Build-answers commands (written without the module prefix) checked by hand against
  `build_answers <sub> --help`: `select --levels`, `checkprompts --slugs`, `checkingest --slug --model`,
  `proposeprompts --slugs`, `judgeprompts --slug`, `ingest --slug --model`, `skip --slug --reason`.
- `generate.py --help` (only `--report-pool`), `reports/ladder_report.py` (no flags; run from
  `curriculum/_build`, output identical to the committed report).
- Python snippets run against the real data: the grammar lesson list (0 left at levels 1-20), the
  example slug selector (level 6), the mnemonic selector for all four kinds (level 6, groups
  logic), the reading seed selector (level 15 prints the real SEED PROBLEM for `conjugation-primer`),
  the radical art Step 0 and the URL map in Step 4, `generate_pool select` and
  `build_answers select` (1 and 0 points), `check_grammar_pool --level 6`.
- Not run (they write files or call models): `ingest`, `webprompts` for other lanes, `cwebp` install.

## Tests

Full suite from `curriculum/_build`:
`unittest discover -s . -p 'test_*.py'` -> Ran 268, OK; `-s import` -> 16 OK; `-s reports` -> 5 OK.

## Concerns

1. **Pool lane `select` finds almost nothing.** `generate_pool select` lists only points with no pool
   entry (today: `conjugation-primer`). The 132 failing points are found with `check_grammar_pool
   --level N`. I wrote that route into the runbook (no tool change). Worth a small tool change for
   Task 7 (a `--failing` selector).
2. **Pool ingest replaces the whole entry.** `merge_into_sidecar` drops old `alternates` and the
   `answers_check` mark. The runbook says so and sends the point back through the build-answers lane.
   This costs work on reviewed points; the operator should know before Task 7.
3. **Reading seeds still JLPT-era.** `reading_seeds.py` holds 60 seeds at levels 13-24 only, so
   `generate_readings --level N` fails for levels 1-12 and 18-19 ("no reading seeds at level N"), and
   the seed check reports `conjugation-primer` unassigned. The runbooks say a level with no seeds stops
   at Step 1; writing seeds is Task 9 Step 1. Not fixed here (tool/data).
4. **Passage rules not checked by script**, marked as such in the runbooks: at least 3 passages per
   level 2-20 (Task 9 adds the `ladder_report` key), widened accepted answers (the gate only needs one
   answer that appears in the body), and the operator review file `reports/passage-answers.md`
   (Task 9 writes it).
5. **Linked `vocabulary_slugs` at or below the level**: not checked by the pool gate; only
   `ladder_report.py` counts the breaks. No runbook edits the links (README says so).
6. **`grammar-lesson.md` header says** "bump the version header AND PROMPT_VERSION together whenever this
   file or persona.md changes". I changed one word in each and did not bump either, as instructed
   (memory: no mass regeneration). The header and constant stay equal.
7. **Radical art lane:** Step 0 prints 0 radicals for level 6 today (24 of 28 reviewed, all 24 have art); that
   is data, not a runbook fault. The art workflow depends on Task 8 mnemonics being reviewed first.
8. `.DS_Store` is modified and was left out of the commit.

## Review fixes (second commit)

1. `prompts/reading-passage.md`: "grammar list below" -> "grammar list above" (the list is the "Grammar you may use" section).
2. Reading subagent and single-session runbooks: check 4 covers the body and `summary_ja`; question prompts are level-checked by `_question_errors`.
3. Mnemonic subagent, single-session and web-chat prompts: "done" now means a non-empty mnemonic in the sidecar entry; an empty `{}` placeholder counts as not done (matches `default_slugs`).
4. `radical-art-web-chat-workflow.md`: "selects nothing" now also covers "every reviewed radical already has art".
5. `README.md` Ladder work list: radical bullet now before the kanji bullet.
