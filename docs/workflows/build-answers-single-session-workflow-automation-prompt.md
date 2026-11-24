Task: Grammar Build Accepted Answers — Single Session

For a batch of grammar points, fix the pool sentences that break their own
lesson, then add every other answer a teacher would mark fully correct on a
grammar Build card (お茶は熱いうちに… for お茶が熱いうちに…, 電話をします for
電話します) to `curriculum/grammar/pool.json`. This session proposes the
answers; **fresh subagents** check the sentences and judge the answers,
because a model reviewing its own output clears its own choices. No browser,
no API credentials. Run this same prompt again in a fresh session for the
next batch.

Spec: `docs/superpowers/specs/2026-10-21-grammar-build-accepted-answers-design.md`

Levels (ladder levels 1–60; one level such as `6`, or a range such as `1-20`): <levels = 1-20>
Points this session: <point-count = 6>
Check and judge model: <check-model = opus>

Use a strong reasoning model at high effort. Pass `claude-code` as `--model`
in Steps 2 and 4.

---

Work from `curriculum/_build`. Every command below is
`.venv/bin/python -m generate_content.build_answers …`. Only `select` takes
`--level` / `--levels`; every other command takes `--slugs` or `--slug`. The
staging folder is `<level-dir>`: `level-` and two digits, the point's own
level (level 6 is `level-06`).

A sentence may use only words at or below the point's level.

Step 1: Select

select --levels <levels> --limit <point-count>

`select` lists the points that have a pool entry but no answers check at the
current `CHECK_VERSION`, in ladder order. A point whose pool entry was
rewritten by the pool lane comes back here. Use exactly the printed slugs. If
it prints 0, the levels are done — stop and report.

Step 2: Check the sentences

checkprompts --slugs <slugs,comma,no,spaces>

For each point, spawn **one fresh subagent** (model `<check-model>`, never
this session, never shared across points) that reads
`generate_content/web/answers/<level-dir>/<slug>.check.prompt.md` — everything
below its HTML comment header is the task — and writes
`<slug>.check.reply.md` with exactly one fenced ```json block. Wait for the
subagent to **finish**, not for the file to appear. Then:

checkingest --slug <slug> --model claude-code

- PASS: fixes (if any) are written to `pool.json` and printed. Keep the
  printed lines for the report.
- Exit 1: the prompt is rewritten with the errors; spawn a fresh subagent on
  it. Budget: 4 attempts, then run
  `skip --slug <slug> --reason "<last errors>"` and drop the
  point from this run.
- Exit 2 (`unfixable`): the point is already recorded as skipped in
  `pool.json` with the printed reason; drop it from this run.

Step 3: Propose answers (this session)

proposeprompts --slugs <remaining slugs>

Read each `<slug>.propose.prompt.md` (below the header) and write
`<slug>.propose.reply.md` yourself: exactly one fenced ```json block.

Step 4: Judge and ingest, one point at a time

judgeprompts --slug <slug>

- Exit 1: your proposal has errors; fix only `<slug>.propose.reply.md` from
  the rewritten prompt and run `judgeprompts` again.
- "0 candidates": go straight to `ingest`.
- Otherwise spawn **one fresh subagent** (model `<check-model>`, never this
  session) that reads `<slug>.judge.prompt.md` and writes
  `<slug>.judge.reply.md`; wait for it to finish. Then:

ingest --slug <slug> --model claude-code

On PASS the valid answers and their `other_grammar` pairs are added, the
point gets `_meta.answers_check`, and its files are deleted; keep the printed
`+` lines for the report. On failure the judge prompt is rewritten with the
errors: spawn a fresh subagent on it. Budget: 4 attempts per point, then
run `skip --slug <slug> --reason "<last errors>"`.

A skipped point carries `_meta.answers_check.skipped`, so `select` moves past
it; the reason is in `pool.json` for the maintainer.

Rules:

- Never judge your own proposals, and never hand-edit a check or judge reply.
- Never edit the script, the prompts, the validator, or curriculum source
  data to make a point pass.
- Never set `review_status` and never bump `CHECK_VERSION`.

Step 5: Regenerate

.venv/bin/python generate.py

Final report:

- levels and selected slugs;
- every sentence fix: old → new, with the reason;
- per point the valid / contrast / wrong counts;
- skipped points with their errors or unfixable reasons;
- how many points remain (re-run Step 1);
- a random sample of 10 added answers across the batch (all of them when
  fewer), for the maintainer to read.

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
