# Phase 4 — reading-passage tooling (N5)

Status: **wired in (2026-08-04).** All 10 N5 seeds generated, gate-passed, and
human-reviewed; `curriculum/_build/n5_readings.py` now holds the generated set
and `curriculum/readings/n5.json` / the compiled `curriculum.db` reflect it.
This is the runbook for the run itself, plus the decisions baked into the
tooling.

The N5 replacement decision is settled: the generated set retired all 10
hand-authored passages (see § "The step that is deliberately not automated").

See [content-pipeline-plan.md](./content-pipeline-plan.md) § Phase 4 and R1.6.

## What exists

All under `curriculum/_build/generate_content/`, mirroring the 2b/2c lanes:

| File | What it is |
|---|---|
| `reading_seeds.py` | The N5 seeds: position, tone tag, the authored window (`vocab_cutoff` / `pull_forward` / `grammar_cutoff`), `required_grammar`, word band, question count, topic brief, allowed character names. Checked by `seed_errors` — ladder shape, humour mix, and the level-wide grammar coverage invariant. |
| `reading_context.py` | Per-seed allowed vocabulary + grammar (read from the seed's own ladder), the level-check index, and the markable dictionary forms. |
| `prompts/reading-passage.md` | The generation prompt. `persona.md` (v2, comedy register) is the system prompt, as in 2b/2c. |
| `validate_readings.py` | The closed-loop gate, plus the enrichment (`grammar_slugs`, `word_spans`, `vocabulary_slugs`, `word_count`, `body_furigana`, `prompt_furigana`) and the fixture self-check. |
| `generate_readings.py` | The driver: `context`, `requests`, `run`, `collect`, `assemble`, and the no-API `webprompts` / `ingest` lane. |
| `fixtures/readings/n5/` | 2 good + 9 bad fixtures, each declaring the error it exists to provoke. |

## Decisions worth knowing before you run it

**The model does not write the enrichment.** It submits `title`, `body`,
`english_translation`, `summary_ja`, `summary_en` and `questions`.
`grammar_slugs`, `word_spans`, `vocabulary_slugs`, `word_count`,
`body_furigana` and `prompt_furigana` are all derived by the tokenizer —
`compile-curriculum` requires each span's slice to equal the vocabulary item's
`primary_form` exactly, in body order, non-overlapping, at UTF-16 offsets,
which is not something to ask a model for. The derivation lives in `_build` so
a regeneration reproduces it, which is the generator-drift trap Rev 1 hit.

**Furigana is derived, never authored — and it is derived here, not only at
build time.** The prompt tells the model to write plain prose with no brackets
and the gate rejects markup outright, the same rule the grammar-lesson lane
follows. `enrich()` then runs `annotate_sentence` over the body and every
question prompt, so the artifact carries the readings the app will actually
show. `generate.py` computes the identical strings from the same tagger and
`known_readings` map at wire-in, so this is redundancy on purpose: it makes the
artifact reviewable *as rendered* without changing what ships.

Two consequences worth holding on to:

- **A passage the tagger cannot annotate never reaches the artifact.** Check 5
  of the gate rejects it, so `enrich()` only ever stores an annotation the gate
  already proved. The one `None` it still handles is "body has no kanji", which
  omits the field rather than storing a copy of the plain text.
- **The reader degrades silently without it.** `PassageBody` renders whatever
  `body_furigana` holds and falls back to bare kanji when it is null — no
  error, no warning. That is precisely why the field is derived at both ends
  rather than left to the wire-in step to remember.

Spans are built on **token boundaries**, not by substring search: raw matching
marks 「は」+「いつも」 as はい, the 分 of 十分, and the 日 of 日曜日. Bare
numerals and counters bound to a numeral are excluded. Checked against the
shipped set: the derivation reproduces every one of the 10 hand-authored
passages' span slugs and adds more (10–14 per passage vs 3–10 authored).

**The grammar constraint is mechanical too, since the expansion plan's step 1.**
`grammar_detect.py` extracts the points a body uses from the tokenizer and the
reviewed `accepted_forms`, at 98.8% recall against the shipped declarations.
The gate checks *that* against the allowed set, so grammar the model used and
would not have declared no longer rides on the human read, and `grammar_slugs`
is derived rather than submitted.

**Humour is planned, not sampled.** Tone is a seed field; the mix is checked
over the level, never per call. Whether a `humorous` passage is actually funny
is a human read.

**`pull_forward` exists because the vocabulary is ordered thematically.**
名前 is the 488th N5 word, 時 the 567th, 次 the 686th, and the first verb 行く
the 377th, so a cutoff alone strands ordinary words and the first passages
could not be written at all. It was a flat per-level list (`READING_CORE_SLUGS`)
until the expansion plan replaced it with a per-seed one, which is the same
amendment 2a made with `CORE_SEED_SLUGS` but graded: early seeds pull a few
words forward, later seeds none. It holds narrative connective tissue only —
position, sequence, quantity, and the verbs that move a scene along. **Do not
add topic words to it**; move the seed later in the ladder instead, which is why
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

Nothing in the generation lanes writes `curriculum/readings/n5.json`. The
run ends at the build artifact, on purpose: what gates the wire-in is the
Phase 5 human read, not a script.

**The content decision is made (2026-08-03): none of the 10 hand-authored N5
passages survive.** The generated set replaces the level wholesale, in seed
position order. Nothing needs deciding per passage any more — what remains is
the mechanical swap, and it waits on review, not on a judgement call.

### Wiring a reviewed set in

`curriculum/readings/n5.json` is generated by `generate.py` from the
`N5_READINGS` list in `_build/n5_readings.py`. To ship a level:

1. **Every seed passed the gate.** Re-run the auto-select in the subagent
   workflow (Step 1a); it should report 0 seeds remaining.
2. **Every passage has been read by a human** — coherence, tone, and whether
   the grammar it *used* matches what it *declared*, none of which the gate
   sees. Flip `_meta.review_status` to `reviewed` as you go.
3. Replace `N5_READINGS` with the artifact's passages in seed position order —
   the `passage` object of each entry in `generate_content/passages/n5.json`,
   minus `slug` and `_meta`. The shapes already match; `generate.py` adds
   `sort_order` from list position and re-derives the furigana itself, so
   carrying `body_furigana` through or dropping it makes no difference.
4. Rebuild and compile from the repo root:

   ```bash
   .venv/bin/python generate.py        # from curriculum/_build
   npm run validate-schema && npm run compile-curriculum
   ```

5. Open a passage on device and confirm both reader affordances: readings
   above the kanji (subject to the furigana preference) and underlined
   vocabulary that opens the word sheet. A null `body_furigana` shows as plain
   kanji with no error, so this is a look, not a test run.

`_PASSAGE_AUTHORED_KEYS` in `generate.py` already copies `word_count` through,
and the assembled passage objects validate as a `readingsFile` today.

## Findings from building it

- **5 of the 10 shipped N5 passages would not pass the level check**, on
  genuine vocabulary gaps rather than false positives: よろしく, りんご,
  まっすぐ, 誕生日/プレゼント/ケーキ/楽しみ, and the dog's name ポチ. New
  passages route around this — seeds declare character names in
  `extra_allowed`. Since all 10 are being retired this no longer blocks
  anything, but the gaps it exposed are still real: よろしく and まっすぐ in
  particular look like words N5 should teach.
- **Two exception-policy gaps were fixed in `level_check.py`**: しれる (only
  ever surfaces inside かもしれない, a taught N5 point) and ごろ (the time
  approximator, twin of ぐらい which already passed as a particle). Neither is
  a vocabulary entry in N5 or N4, so the gate was rejecting patterns the
  curriculum teaches. The change only *adds* exceptions; no existing draft or
  reviewed content is affected.
- **`summary_ja` ships without furigana** — the schema has no field for it and
  `generate.py` does not annotate it — so the gate level-checks it too. Worth
  revisiting on the app side: it is learner-facing Japanese with no readings.
