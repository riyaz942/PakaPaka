Task: Judge Particle-Swap Build Alternates — Single Session, No Subagents

Add the particle-swap answers a learner can correctly type on a grammar Build
card (お茶は熱いうちに… for お茶が熱いうちに…) to `curriculum/grammar/pool.json`,
**entirely within this session** — no subagents, no browser, no API
credentials. The script proposes the candidates; you judge them. Run this same
prompt again in a fresh session for the next batch.

Level (one per run): <level = n5>
Points this session: <point-count = 6>

Use a strong reasoning model at high effort. Pass `claude-code` as `--model`
in Step 4.

---

Work from `curriculum/_build`. Run `.venv/bin/python generate.py --level <level>`
first if `pool.json` changed since the level JSON was last generated.

Step 1: Select

.venv/bin/python -m generate_content.particle_alternates select --level <level> --limit <point-count>

Use exactly the printed slugs. If it prints 0, the level is done — stop and
report.

Step 2: Prompts

.venv/bin/python -m generate_content.particle_alternates webprompts --level <level> --slugs <slugs,comma,no,spaces>

Step 3: Judge every candidate yourself

Read each `generate_content/web/particles/<level>/<slug>.prompt.md`.
Everything below its HTML comment header is the task; ignore the header. Write
ONE reply file per point, `generate_content/web/particles/<level>/<slug>.reply.md`,
containing exactly one fenced ```json block and nothing else:

{"verdicts": [{"candidate": "…", "verdict": "valid", "reason": "…"}]}

- One verdict per candidate, the candidate copied exactly.
- `valid` only when a teacher would mark the answer fully correct for that
  English sentence. A contrastive は the English does not have is `contrast`,
  not `valid`. When unsure, do not choose `valid`.
- A point with 0 candidates needs no reply file.
- Never set `review_status`. Edit only reply files.

Step 4: Ingest, one point at a time

.venv/bin/python -m generate_content.particle_alternates ingest --level <level> --slug <slug> --model claude-code

On PASS the valid answers are added as alternates, the point is marked
checked (and set back to `draft` when anything was added), and its
prompt/reply files are deleted. On failure the prompt is rewritten with the
errors appended: fix only `<slug>.reply.md` and ingest again. Budget: 4
attempts per point; after that, record the point as skipped and move on.

Never edit the script, the prompt template, the validator, or curriculum
source data to make a point pass.

Step 5: Regenerate

.venv/bin/python generate.py --level <level>

Final report: level, selected slugs, per point the valid / contrast / wrong
counts and every valid answer added (the maintainer reviews these), skipped
points with errors, and how many points remain (re-run Step 1).
