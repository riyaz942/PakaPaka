Task: Write the Grammar Sentence Pool — Single Session, No Subagents

Write the grammar review sentence pool (accepted meanings, ≥ 8 sentences,
Build-card alternates) for the next grammar points **entirely within this
session** — no subagents, no browser, no API credentials. Spec:
`docs/superpowers/specs/2026-10-13-grammar-read-build-srs-design.md` §4.
Run this same prompt again in a fresh session for the next batch.

Level (one per run): <level = n5>
Points this session (each point is ~10 sentences; keep batches small):
<point-count = 4>

Use a strong reasoning model at high effort. Pass this session's model name
as `--model` in Step 4.

---

Work from `curriculum/_build`.

Step 1: Select

.venv/bin/python -m generate_content.generate_pool select --level <level> --limit <point-count>

Use exactly the printed slugs. If it prints 0, the level is done — stop and
report.

Step 2: Prompts

.venv/bin/python -m generate_content.generate_pool webprompts --level <level> --slugs <slugs,comma,no,spaces>

Step 3: Draft every reply yourself

Read each `generate_content/web/pool/<level>/<slug>.prompt.md`. Everything
below its HTML comment header is the task; ignore the header. Write ONE reply
file per point, `generate_content/web/pool/<level>/<slug>.reply.md`,
containing exactly one fenced ```json block and nothing else:

{"accepted_meanings": ["…"], "sentences": [{"japanese": "…", "english": "…",
  "vocabulary_slugs": ["…"], "form": "…(optional)",
  "alternates": [{"japanese": "…", "kind": "valid"}]}]}

- Keep sentences the prompt marks PASS unless variety forces a change.
- Every word you use is in `vocabulary_slugs`, from that prompt's list.
- Plain Japanese only (no furigana, romaji, markdown, brackets).
- Make each point feel different; give the last point the same care as the
  first.
- Never set `review_status`. Edit only reply files.

Step 4: Ingest and repair, one point at a time

.venv/bin/python -m generate_content.generate_pool ingest --level <level> --slug <slug> --model <model>

On PASS the point is merged into `curriculum/grammar/pool.json` and its
prompt/reply files are deleted. On failure the prompt is rewritten with the
errors appended: edit only `<slug>.reply.md` to fix every error (smallest
change, keep passing sentences) and ingest again. Budget: 4 attempts per
point; after the 4th failure, record the point as skipped with its latest
errors and move on (it is selected again next session).

Never edit the validator, the lane code, the prompt template, the allowed
vocabulary, or curriculum source data to make content pass.

Step 5: Regenerate

.venv/bin/python generate.py --level <level>

Do not run validate-schema or compile-curriculum here; run them once from the
repo root after the last session.

Final report: level, selected slugs, passed / skipped (with errors), attempts
per point, how many points remain (re-run Step 1), and confirmation that
generate.py ran.
