# Phase 4 — reading-passage tooling (N5)

Status: **tooling built, generation has not run.** No passage has been
generated and no committed passage has been touched. This is the runbook for
the run itself, plus the decisions baked into the tooling.

See [content-pipeline-plan.md](./content-pipeline-plan.md) § Phase 4 and R1.6.

## What exists

All under `curriculum/_build/generate_content/`, mirroring the 2b/2c lanes:

| File | What it is |
|---|---|
| `reading_seeds.py` | The 10 N5 seeds: position, tone tag, word band, question count, topic brief, allowed character names. 6 humorous / 4 neutral = 60%, checked by `tone_mix_errors`. |
| `reading_context.py` | Per-seed allowed vocabulary + grammar (positional cutoff, same option (a) as 2a/2c), the level-check index, and the markable dictionary forms. |
| `prompts/reading-passage.md` | The generation prompt. `persona.md` (v2, comedy register) is the system prompt, as in 2b/2c. |
| `validate_readings.py` | The closed-loop gate, plus the enrichment (`word_spans`, `vocabulary_slugs`, `word_count`) and the fixture self-check. |
| `generate_readings.py` | The driver: `context`, `requests`, `run`, `collect`, `assemble`, and the no-API `webprompts` / `ingest` lane. |
| `fixtures/readings/n5/` | 2 good + 8 bad fixtures, each declaring the error it exists to provoke. |

## Decisions worth knowing before you run it

**The model does not write the enrichment.** It submits `title`, `body`,
`english_translation`, `summary_ja`, `summary_en`, `questions` and
`grammar_slugs`. `word_spans`, `vocabulary_slugs` and `word_count` are derived
by the tokenizer — `compile-curriculum` requires each span's slice to equal the
vocabulary item's `primary_form` exactly, in body order, non-overlapping, at
UTF-16 offsets, which is not something to ask a model for. Same principle as
furigana. The derivation lives in `_build` so a regeneration reproduces it,
which is the generator-drift trap Rev 1 hit.

Spans are built on **token boundaries**, not by substring search: raw matching
marks 「は」+「いつも」 as はい, the 分 of 十分, and the 日 of 日曜日. Bare
numerals and counters bound to a numeral are excluded. Checked against the
shipped set: the derivation reproduces every one of the 10 hand-authored
passages' span slugs and adds more (10–14 per passage vs 3–10 authored).

**The grammar constraint is only half mechanical.** A tokenizer cannot extract
"the grammar points this text uses", so the gate checks the *declared*
`grammar_slugs` against the allowed set and nothing further. Grammar the model
used but did not declare is a human-read concern. Nothing in the tooling
pretends otherwise.

**Humour is planned, not sampled.** Tone is a seed field; the mix is checked
over the level, never per call. Whether a `humorous` passage is actually funny
is a human read.

**`READING_CORE_SLUGS` exists because the vocabulary is ordered thematically.**
名前 is the 488th N5 word, 時 the 567th, 次 the 686th, so a positional cutoff
strands ordinary words and the first passages could not be written at all. This
is the same amendment 2a made with `CORE_SEED_SLUGS`, scoped to this lane so it
cannot drift the others. It holds narrative connective tissue only — position,
sequence, quantity, and the verbs that move a scene along. **Do not add topic
words to it**; move the seed to a later position instead, which is why
`inu-to-reizouko` sits at position 9 (冷蔵庫 is the 634th word) and
`jidouhanbaiki` at 7.

## Running it

From `curriculum/_build`, with the venv from `requirements.txt`:

```bash
# 0. dry run — no API, no network. What one seed resolves to:
.venv/bin/python -m generate_content.generate_readings context --slug neko-to-shukudai
.venv/bin/python -m generate_content.generate_readings context --slug neko-to-shukudai --show-prompt

# and the gate's own self-check:
.venv/bin/python -m generate_content.validate_readings --fixtures

# 1a. API lane (Message Batches, one request per seed, 3 attempts with the
#     gate's errors fed back into the prompt):
.venv/bin/python -m generate_content.generate_readings run                 # all 10 seeds
.venv/bin/python -m generate_content.generate_readings run --slugs neko-to-shukudai
.venv/bin/python -m generate_content.generate_readings collect --batch-id msgbatch_...

# 1b. no-API lane (paste into a web chat, save the reply, ingest):
.venv/bin/python -m generate_content.generate_readings webprompts
.venv/bin/python -m generate_content.generate_readings ingest --slug neko-to-shukudai --model gemini-web

# 1c. subagent lane — same prompts and gate, replies written by in-session
#     subagents instead of a chat. Driven by
#     docs/workflows/reading-passages-subagent-workflow-automation-prompt.md
#     (seed auto-select, 3-attempt repair loop, no shipped-curriculum step).

# 2. re-assemble from whatever passed:
.venv/bin/python -m generate_content.generate_readings assemble
```

Start with **one seed**, read it, then batch — the same pilot-slice rule R1.4
uses. `neko-to-shukudai` (position 2, humorous, tight 239-word allowed set) is
the honest stress test of both the tone tag and the level constraint.

Output lands in `generate_content/passages/n5.json`, a build artifact:
each entry pairs the seed's plan with a schema-shaped passage carrying `_meta`
(`review_status: draft`).

## The step that is deliberately not automated

Nothing writes `curriculum/readings/n5.json`. That file is generated by
`generate.py` from `_build/n5_readings.py`, and its 10 passages are
hand-authored and shipped. Wiring the generated set in means deciding **which
of the 10 survive**, in what order — a content decision, not a script's.

When that decision is made, the wiring is small: `generate.py`'s
`_PASSAGE_AUTHORED_KEYS` already copies `word_count` through (added with this
tooling; a no-op until a generated passage carries one), and the assembled
passage objects validate as a `readingsFile` today.

## Findings from building it

- **5 of the 10 shipped N5 passages would not pass the level check**, on
  genuine vocabulary gaps rather than false positives: よろしく, りんご,
  まっすぐ, 誕生日/プレゼント/ケーキ/楽しみ, and the dog's name ポチ. New
  passages route around this — seeds declare character names in
  `extra_allowed` — but if any of the 10 is kept, its vocabulary is worth a
  look. よろしく and まっすぐ in particular look like words N5 should teach.
- **Two exception-policy gaps were fixed in `level_check.py`**: しれる (only
  ever surfaces inside かもしれない, a taught N5 point) and ごろ (the time
  approximator, twin of ぐらい which already passed as a particle). Neither is
  a vocabulary entry in N5 or N4, so the gate was rejecting patterns the
  curriculum teaches. The change only *adds* exceptions; no existing draft or
  reviewed content is affected.
- **`summary_ja` ships without furigana** — the schema has no field for it and
  `generate.py` does not annotate it — so the gate level-checks it too. Worth
  revisiting on the app side: it is learner-facing Japanese with no readings.
