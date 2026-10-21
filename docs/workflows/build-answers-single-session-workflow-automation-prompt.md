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

Level (one per run): <level = n5>
Points this session: <point-count = 6>
Check and judge model: <check-model = opus>

Use a strong reasoning model at high effort. Pass `claude-code` as `--model`
in Steps 2 and 4.

---

Work from `curriculum/_build`. Every command below is
`.venv/bin/python -m generate_content.build_answers …`.

Step 1: Select

select --level <level> --limit <point-count>

Use exactly the printed slugs. If it prints 0, the level is done — stop and
report.

Step 2: Check the sentences

checkprompts --level <level> --slugs <slugs,comma,no,spaces>

For each point, spawn **one fresh subagent** (model `<check-model>`, never
this session, never shared across points) that reads
`generate_content/web/answers/<level>/<slug>.check.prompt.md` — everything
below its HTML comment header is the task — and writes
`<slug>.check.reply.md` with exactly one fenced ```json block. Wait for the
subagent to **finish**, not for the file to appear. Then:

checkingest --level <level> --slug <slug> --model claude-code

- PASS: fixes (if any) are written to `pool.json` and printed. Keep the
  printed lines for the report.
- Exit 1: the prompt is rewritten with the errors; spawn a fresh subagent on
  it. Budget: 4 attempts, then record the point as skipped and drop it from
  this run.
- Exit 2 (`unfixable`): record the point as skipped with the printed
  sentences and reasons, and drop it from this run.

Step 3: Propose answers (this session)

proposeprompts --level <level> --slugs <remaining slugs>

Read each `<slug>.propose.prompt.md` (below the header) and write
`<slug>.propose.reply.md` yourself: exactly one fenced ```json block.

Step 4: Judge and ingest, one point at a time

judgeprompts --level <level> --slug <slug>

- Exit 1: your proposal has errors; fix only `<slug>.propose.reply.md` from
  the rewritten prompt and run `judgeprompts` again.
- "0 candidates": go straight to `ingest`.
- Otherwise spawn **one fresh subagent** (model `<check-model>`, never this
  session) that reads `<slug>.judge.prompt.md` and writes
  `<slug>.judge.reply.md`; wait for it to finish. Then:

ingest --level <level> --slug <slug> --model claude-code

On PASS the valid answers and their `other_grammar` pairs are added, the
point gets `_meta.answers_check`, and its files are deleted; keep the printed
`+` lines for the report. On failure the judge prompt is rewritten with the
errors: spawn a fresh subagent on it. Budget: 4 attempts per point, then
skip it.

Rules:

- Never judge your own proposals, and never hand-edit a check or judge reply.
- Never edit the script, the prompts, the validator, or curriculum source
  data to make a point pass.
- Never set `review_status` and never bump `CHECK_VERSION`.

Step 5: Regenerate

.venv/bin/python generate.py --level <level>

Final report:

- level and selected slugs;
- every sentence fix: old → new, with the reason;
- per point the valid / contrast / wrong counts;
- skipped points with their errors or unfixable reasons;
- how many points remain (re-run Step 1);
- a random sample of 10 added answers across the batch (all of them when
  fewer), for the maintainer to read.
