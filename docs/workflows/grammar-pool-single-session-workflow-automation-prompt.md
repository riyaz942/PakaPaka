Task: Write the Grammar Sentence Pool — Single Session, No Subagents

Write the grammar review sentence pool (accepted meanings, ≥ 8 sentences,
Build-card alternates) for the next grammar points **entirely within this
session** — no subagents, no browser, no API credentials. Spec:
`docs/superpowers/specs/2026-10-13-grammar-read-build-srs-design.md` §4.
Run this same prompt again in a fresh session for the next batch.

Levels (ladder levels 1–60; one level such as `6`, or a range such as `1-20`):
<levels = 1-20>
Points this session (each point is ~10 sentences; keep batches small):
<point-count = 4>

Use a strong reasoning model at high effort. Pass this session's model name
as `--model` in Step 4.

---

Work from `curriculum/_build`.

Step 1: Select

.venv/bin/python -m generate_content.generate_pool select --failing --levels <levels> --limit <point-count>

`select --failing` lists the points that fail the pool gate, in ladder order.
This includes a point with no pool entry yet. It runs the same check as
`check_grammar_pool`, so it takes a few minutes for a wide range. Use exactly
the printed slugs. If it prints 0, no point in <levels> fails — the work is
done: stop and report.

To see why a point fails, run the checker for its level (`--level N`, an
integer). It prints one `### <slug>` heading per failing point, with the rules
that fail (rule 3: a word above the point's level; rule 4: fewer than 8 passing
sentences):

.venv/bin/python -m generate_content.check_grammar_pool --level <N>

A sentence may use only words at or below the point's level. The pool gate
needs at least 8 passing sentences per point; the release floor (spec §7.6) is
2 readable sentences, and `reports/ladder-report.md` counts the points below it.

The words linked to a point (its own `vocabulary_slugs` in the grammar source
data) must also be at or below the point's level. Not checked by this gate:
`reports/ladder-report.md` counts the points that break it. This session does
not edit those links.

Step 2: Prompts

.venv/bin/python -m generate_content.generate_pool webprompts --slugs <slugs,comma,no,spaces>

(`webprompts` takes only `--slugs`. The level comes from each point.)

Step 3: Draft every reply yourself

Read each `generate_content/web/pool/<level-dir>/<slug>.prompt.md` (`<level-dir>` is
`level-` and two digits, the point's own level, so level 6 is `level-06`). Everything
below its HTML comment header is the task; ignore the header. Write ONE reply
file per point, `generate_content/web/pool/<level-dir>/<slug>.reply.md`,
containing exactly one fenced ```json block and nothing else:

{"accepted_meanings": ["…"], "sentences": [{"japanese": "…", "english": "…",
  "vocabulary_slugs": ["…"], "form": "…(optional)",
  "alternates": [{"japanese": "…", "kind": "valid"}]}]}

- Keep sentences the prompt marks PASS unless variety forces a change. Ingest
  replaces the point's whole pool entry with your reply, so copy every
  sentence you keep into the reply. The old alternates and the answers-check
  mark are dropped: the build-answers lane picks the point up again
  (`build_answers select`).
- Every word you use is in `vocabulary_slugs`, from that prompt's list.
- Plain Japanese only (no furigana, romaji, markdown, brackets).
- Make each point feel different; give the last point the same care as the
  first.
- Never set `review_status`. Edit only reply files.

Step 4: Ingest and repair, one point at a time

.venv/bin/python -m generate_content.generate_pool ingest --slug <slug> --model <model>

On PASS the point is merged into `curriculum/grammar/pool.json` and its
prompt/reply files are deleted. On failure the prompt is rewritten with the
errors appended: edit only `<slug>.reply.md` to fix every error (smallest
change, keep passing sentences) and ingest again. Budget: 4 attempts per
point; after the 4th failure, record the point as skipped with its latest
errors and move on (it is selected again next session: it still has no pool
entry, or it still fails the checker).

Never edit the validator, the lane code, the prompt template, the allowed
vocabulary, or curriculum source data to make content pass.

Step 5: Regenerate

.venv/bin/python generate.py

(`generate.py` builds every level and takes no level flag. Add `--report-pool`
to print the pool failures and continue, until every point passes.)

Do not run validate-schema or compile-curriculum here; run them once from the
repo root after the last session.

Final report: levels, selected slugs, passed / skipped (with errors), attempts
per point, how many points remain (re-run Step 1, including the checker), and confirmation that
generate.py ran.

---

Last step of every run: commit, then end with the level status

Do this after the workflow above is complete and before you write the final
report. Use `git status --porcelain` to see the changed files.

1. Decide if this run has issues. It has issues if one of these is true:
   - an item (slug, point or seed) was skipped or failed, or still has
     validation errors;
   - a command stopped with an error that you did not resolve (Step 1
     problems included);
   - a file changed outside `curriculum/` (ignore `.DS_Store`).
2. No issues: stage only the changed files under `curriculum/`, by name
   (never `git add -A` or `git add .`), and commit on the current branch.
   Message: `feat(content): <what this run made> for level <level>`, for
   example `feat(content): draft radical mnemonics for level 15`. Do not push.
   If no file changed, do not commit.
3. Issues: do not stage and do not commit. Leave every change in the working
   tree for the maintainer, and name each issue in the final report.
4. Re-run Step 1 for the same level(s). The last line of the final report is
   exactly one of these two lines:

   LEVEL_STATUS: done
   LEVEL_STATUS: more

   `done` means Step 1 now selects nothing. `more` means items are still left.
   `scripts/run-content-lane.sh` reads this line to choose the next run.
