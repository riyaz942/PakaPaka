# Grammar Build Accepted Answers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One single-session content workflow that, per grammar point, fixes
pool sentences that break their own lesson and then adds judged accepted
Build answers to `curriculum/grammar/pool.json`.

**Architecture:** A new CLI module `generate_content/build_answers.py`
replaces `particle_alternates.py`. It writes prompt files, validates reply
files, filters candidates mechanically, and merges into `pool.json` only
after `generate.build_grammar_point` + `check_grammar_pool.check_point`
pass. The session proposes candidates; fresh subagents check sentences and
judge candidates. The app does not change.

**Tech Stack:** Python 3 in `curriculum/_build/.venv`, `unittest`, GiNZA
via the existing `spans` / `furigana` modules.

**Spec:** `docs/superpowers/specs/2026-10-21-grammar-build-accepted-answers-design.md`

## Global Constraints

- Work from `curriculum/_build`; run Python as `.venv/bin/python`; tests as
  `.venv/bin/python -m unittest generate_content.<test_module>`.
- No change to app code, `buildEvaluator.ts`, English, lessons, mnemonics,
  vocabulary links, or `review_status`.
- A sentence changes only through a `fix` verdict, and only as much as the
  fix needs. Its English and `vocabulary_slugs` stay the same.
- At most 10 candidates per sentence (`MAX_CANDIDATES = 10`).
- Verdicts: `valid` / `contrast` / `wrong`. Only `valid` is merged.
- Marker: `_meta.answers_check = {"version": "1", "model": <model>}`.
- The proposing session never judges; the sentence check and the judge are
  each a fresh subagent per point.
- Nothing is written to `pool.json` unless the built point passes
  `check_point`.
- Retry budget per step per point: 4 attempts, then the point is skipped and
  reported.

## Review Focus

- A sentence check `fix` that changes the listed words or the register →
  rejected by the gate, prompt rewritten with errors; nothing written.
  (Task 3, `test_fix_that_drops_a_word_is_rejected`.)
- A candidate in all kana or with a listed word swapped out → dropped
  before judging with a reason, so it cannot fail the whole ingest. (A
  swapped or added pronoun, or an added word, is not dropped: the gate only
  checks for missing words, and the judge decides meaning — ruled at the
  final review.)
  (Task 2, `test_filter_drops_gate_failures_with_reason`.)
- A candidate that only differs by punctuation or katakana → dropped as a
  duplicate. (Task 2, `test_filter_drops_normalised_duplicates`.)
- A fixed sentence's old alternates vary the wrong sentence → cleared on
  fix. (Task 2, `test_apply_fixes_replaces_text_and_clears_alternates`.)
- Re-running `ingest` after a PASS (files deleted) → clear error, no
  double merge. (Task 3, `test_ingest_without_reply_files_exits`.)

---

### Task 1: Word gate accepts a split する-verb

**Files:**
- Modify: `curriculum/_build/generate_content/check_grammar_pool.py` (`_alternate_errors`, rule 6 word check, ~L64-68)
- Test: `curriculum/_build/generate_content/test_check_grammar_pool.py`

**Interfaces:**
- Produces: `split_suru_slugs(plain: str, linked: dict[str, str]) -> set[str]` in `check_grammar_pool.py` — the slugs in `linked` whose form ends in する and whose noun (`form[:-2]`) appears in `plain` directly followed by `を` and one of `し す さ せ`.

- [ ] **Step 1: Write the failing tests** in `SentenceRulesTest`:

```python
def test_rule6_suru_verb_may_take_wo(self):
    s = sentence("先生に電話します。",
                 [{"vocabulary_slug": "sensei", "start": 0, "end": 2},
                  {"vocabulary_slug": "denwa-suru", "start": 3, "end": 8, "inflection": "masu"}],
                 None,
                 alts=[{"furigana": "先[せん]生[せい]に電[でん]話[わ]をします。", "kind": "valid"}])
    vocab = {**VOCAB, "sensei": "先生", "denwa-suru": "電話する"}
    errors = pool._alternate_errors(s, item([s]), [], vocab, frozenset())
    self.assertEqual(errors, [])

def test_split_suru_slugs(self):
    linked = {"denwa-suru": "電話する", "bikkuri-suru": "びっくりする", "sensei": "先生"}
    self.assertEqual(pool.split_suru_slugs("先生に電話をしました。", linked), {"denwa-suru"})
    self.assertEqual(pool.split_suru_slugs("電話を見ました。", linked), set())
    self.assertEqual(pool.split_suru_slugs("先生に電話します。", linked), set())
```

- [ ] **Step 2: Run** `.venv/bin/python -m unittest generate_content.test_check_grammar_pool` — expect FAIL (`split_suru_slugs` missing; rule 6 reports `missing words ['denwa-suru']`).
- [ ] **Step 3: Implement `split_suru_slugs`** and use it in rule 6: `found = {derive_spans …} | split_suru_slugs(plain, linked)`. `spans.derive_spans` is not changed.
- [ ] **Step 4: Run** the same command — expect PASS (all existing tests too).
- [ ] **Step 5: Commit** — `git commit -m "Pool gate: a する-verb alternate may take を (電話をします)"`.

### Task 2: Pure helpers of `build_answers.py`

**Files:**
- Create: `curriculum/_build/generate_content/build_answers.py`
- Test: `curriculum/_build/generate_content/test_build_answers.py`

**Interfaces:**
- Produces (module constants): `CHECK_VERSION = "1"`, `VERDICTS = ("valid", "contrast", "wrong")`, `MAX_CANDIDATES = 10`.
- Produces (functions):
  - `normalize(text: str) -> str` — Python port of `normalizeBuildText` in `mobile/src/core/grammar/buildEvaluator.ts` (katakana → hiragana by code point, then remove `[\s、。！？!?,.　「」『』]`).
  - `check_reply_errors(reply: dict, sentences: list[str]) -> list[str]` — reply shape `{"sentences": [{"japanese": str, "verdict": "ok"|"fix"|"unfixable", "fixed": str, "reason": str}]}`; exactly one entry per sentence, `japanese` copied exactly; `fixed` required, non-empty and different from `japanese` only when `verdict == "fix"`. `unfixable` = no correct sentence fits the English with the listed words and grammar point.
  - `apply_fixes(entry: dict, reply: dict) -> tuple[dict, list[dict]]` — deep copy of the pool entry; each `fix` replaces that sentence's `japanese` and sets its `alternates` to `[]`; returns the copy and `[{"old", "new", "reason"}]`, also appended to `copy["_meta"]["sentence_fixes"]`.
  - `propose_reply_errors(reply: dict, sentences: list[str]) -> list[str]` — reply shape `{"answers": [{"japanese": str, "candidates": [str]}]}`; one entry per sentence; each candidate a non-empty string; at most `MAX_CANDIDATES` per sentence.
  - `filter_candidates(candidates: list[str], known: list[str], errors_for: Callable[[str], list[str]]) -> tuple[list[str], list[tuple[str, str]]]` — returns `(kept, dropped)`; drops (with reason) a candidate whose `normalize` equals that of a known answer or an earlier kept candidate, then any for which `errors_for(candidate)` is non-empty (reason = first error).
  - `verdict_errors(reply: dict, candidates: list[tuple[int, str]]) -> list[str]` — same contract as `particle_alternates.reply_errors` (move it, with its tests).
  - `other_grammar_pairs(sentence: str, chunk: str, other_alternates: list[str], valid_alternate: str) -> list[str]` — for each `other_alternates` entry equal to `sentence` with its first `chunk` replaced by some form `f`, return `valid_alternate` with its only occurrence of `chunk` replaced by `f`. If `chunk` occurs zero or several times in `valid_alternate`, return `[]`.
  - `merged_entry(entry: dict, candidates: list[tuple[int, str]], reply: dict, model: str, chunks: dict[int, str]) -> dict` — deep copy; for each `valid` candidate append `{"japanese": c, "kind": "valid"}`, then each `other_grammar_pairs` result not already present as `{"japanese": p, "kind": "other_grammar"}`; set `_meta.answers_check = {"version": CHECK_VERSION, "model": model}`; never touch `review_status`. `chunks` maps sentence index → grammar chunk text.
  - `select_slugs(level: str, limit: int, sidecar: dict) -> list[str]` — like `particle_alternates.select_slugs`, keyed on `answers_check`.

- [ ] **Step 1: Write the failing tests** (`unittest`, fixtures from the spec's cases):
  - `test_normalize` — `normalize("お茶は、熱い　ウチに。") == "お茶は熱いうちに"`.
  - `test_check_reply_good_and_bad` — good reply with one `ok`, one `fix` and one `unfixable` → `[]`; missing sentence, unknown sentence, `fix` without `fixed`, `fixed` equal to original → one error each.
  - `test_apply_fixes_replaces_text_and_clears_alternates` — entry with `会議の間、電話を消した。` (alternate present) and verdict `fix` → `fixed` `会議の間に、電話を消した。`: new text, `alternates == []`, `_meta.sentence_fixes == [{"old": …, "new": …, "reason": …}]`, input untouched.
  - `test_propose_reply_errors` — 11 candidates → error naming the sentence; missing sentence → error.
  - `test_filter_drops_normalised_duplicates` — known `["お茶が熱いうちに飲んだ方がいいですよ。"]`, candidates `["お茶が熱いうちに飲んだ方がいいですよ", "お茶は熱いうちに飲んだ方がいいですよ。"]`, `errors_for=lambda c: []` → kept only the は one; dropped reason contains `duplicate`.
  - `test_filter_drops_gate_failures_with_reason` — `errors_for` returns `["rule 6: missing words ['ocha']"]` for one candidate → it is dropped with that reason.
  - `test_other_grammar_pairs` — `other_grammar_pairs("お茶が熱いうちに飲んだ方がいいですよ。", "うちに", ["お茶が熱い間に飲んだ方がいいですよ。"], "お茶は熱いうちに飲んだ方がいいですよ。") == ["お茶は熱い間に飲んだ方がいいですよ。"]`; and `[]` when the valid alternate lacks the chunk.
  - `test_merge_adds_valid_and_pairs_keeps_status` — `review_status` `"reviewed"` stays; `answers_check == {"version": "1", "model": "m"}`; only valid + pair added.
  - Moved verdict tests from `test_particle_alternates.ReplyTest`, and `SelectTest` keyed on `answers_check`.
- [ ] **Step 2: Run** `.venv/bin/python -m unittest generate_content.test_build_answers` — expect FAIL (module missing).
- [ ] **Step 3: Implement** the functions above in `build_answers.py`, with a module docstring in the style of `particle_alternates.py` (commands, why a model must judge).
- [ ] **Step 4: Run** the same command — expect PASS.
- [ ] **Step 5: Commit** — `git commit -m "build_answers: reply checks, candidate filter, merge"`.

### Task 3: CLI, prompts, and gate wiring

**Files:**
- Modify: `curriculum/_build/generate_content/build_answers.py` (add commands + `main`)
- Create: `curriculum/_build/generate_content/prompts/build-answers-check.md`, `prompts/build-answers-propose.md`, `prompts/build-answers-judge.md`
- Test: `curriculum/_build/generate_content/test_build_answers.py`

**Interfaces:**
- Consumes: Task 2 functions; `generate.load_pool_sidecar()`, `generate.POOL_SIDECAR`, `generate.build_grammar_point(level, slug, entry)`; `check_grammar_pool.check_point(level, item)`, `check_grammar_pool._alternate_errors`, `check_grammar_pool.pronoun_slugs_through(level)`; `grammar_sentences.register_of(text)`; `furigana.annotate_sentence`; `generate_examples._first_json_object`.
- Produces — files under `generate_content/web/answers/<level>/`: `<slug>.check.prompt.md` / `.check.reply.md`, `<slug>.propose.prompt.md` / `.propose.reply.md`, `<slug>.judge.prompt.md` / `.judge.reply.md`. Commands (`python -m generate_content.build_answers …`):
  1. `select --level L --limit N` — prints count and comma-joined slugs.
  2. `checkprompts --level L --slugs a,b` — check prompt per point.
  3. `checkingest --level L --slug S --model M` — validates the check reply, `apply_fixes`, builds and gates the point; on PASS writes `pool.json`, prints each fix `old → new (reason)`, deletes check files; on failure rewrites the check prompt with errors appended and exits 1. Any `unfixable` verdict: print the sentences and reasons, write nothing, exit 2 — the runbook records the point as skipped.
  4. `proposeprompts --level L --slugs a,b` — propose prompt per point (uses the current, possibly fixed, sentences).
  5. `judgeprompts --level L --slug S` — validates the propose reply (on errors: rewrite propose prompt, exit 1), filters candidates, prints dropped ones with reasons, writes the judge prompt. With 0 kept candidates it writes no judge prompt and says so.
  6. `ingest --level L --slug S --model M` — validates the judge reply (no reply needed with 0 candidates), `merged_entry`, builds and gates; on PASS writes `pool.json`, prints valid/contrast/wrong counts and every added answer, deletes the point's propose/judge files; on failure rewrites the judge prompt with errors, exits 1.
- `errors_for(candidate)` for one sentence: `annotate_sentence(candidate, known_readings)` must not be `None`; `register_of(candidate)` must equal the built sentence's `register`; `_alternate_errors` on a copy of the built sentence whose `build_alternates` is `[{"furigana": <annotated>, "kind": "valid"}]` must be empty. `vocab_forms` and pronouns are built as in `check_point`.

Prompt content (each starts with an HTML header comment naming the reply path and next command, like `particle_alternates.prompt_text`; each ends with "Reply with exactly one fenced ```json code block and nothing else."):
- **check:** the point's `primary_form`, `meaning`, `structure`, `caution_notes`; every sentence with English and register. Ask: is the Japanese a correct, natural sentence that uses the point the way its lesson teaches and says what the English says? `ok`; `fix` with the smallest change that keeps every listed word, the register and the English; or `unfixable` when no such sentence exists. Example: 会議の間、電話を消した。 → 会議の間に、電話を消した。 (one action inside the stretch takes 間に).
- **propose:** same point header; per sentence the Japanese, English, register, listed words. Ask for every other answer a teacher would mark fully correct: same words, same grammar point, same register and meaning; particle choices, optional particles (を on a する verb, に after 間), word order, and combinations of these; most likely learner answers first; at most 10; do not vary only punctuation or kana/kanji spelling; do not swap in another grammar point.
- **judge:** the verdict rules of `prompts/particle-alternates.md`, widened from "one particle" to "any difference", plus: an answer that uses another grammar point is `wrong`; a change of tense, politeness or who does what is `wrong`; when unsure, not `valid`.

- [ ] **Step 1: Write the failing tests** (real data, n4):
  - `test_suru_wo_alternate_passes_on_baai` — sidecar entry for `baai` with `{"japanese": "遅れる場合は、先生に電話をします。", "kind": "valid"}` appended to that sentence; `check_point("n4", build_grammar_point("n4", "baai", entry))` returns `[]`.
  - `test_fix_on_aida_passes_the_gate` — `apply_fixes` with 会議の間、電話を消した。 → 会議の間に、電話を消した。; built point passes `check_point`.
  - `test_fix_that_drops_a_word_is_rejected` — fix to `会議の間に、消した。` → `check_point` reports `rule` errors.
  - `test_errors_for_uchi_ni` — on `uchi-ni`, お茶は熱いうちに飲んだ方がいいですよ。 → `[]`; おちゃはあついうちにのんだほうがいいですよ。 → non-empty; お茶は熱いうちに飲んだ方がいいだよ。 (register change) → non-empty.
  - `test_ingest_without_reply_files_exits` — `cmd_ingest` on a slug with candidates and no judge reply raises `SystemExit` with the missing path; `pool.json` unchanged (patch `generate.POOL_SIDECAR` to a temp copy).
- [ ] **Step 2: Run** `.venv/bin/python -m unittest generate_content.test_build_answers` — expect FAIL.
- [ ] **Step 3: Implement** the commands, `errors_for`, prompt rendering, and the three prompt files.
- [ ] **Step 4: Run** the same command — expect PASS. Also run `checkprompts`, `proposeprompts` for `--level n4 --slugs aida` and read both prompt files; then delete them.
- [ ] **Step 5: Commit** — `git commit -m "build_answers: check / propose / judge commands and prompts"`.

### Task 4: Runbook, retire the particle lane, docs

**Files:**
- Create: `docs/workflows/build-answers-single-session-workflow-automation-prompt.md`
- Delete: `curriculum/_build/generate_content/particle_alternates.py`, `test_particle_alternates.py`, `prompts/particle-alternates.md`, `docs/workflows/particle-alternates-single-session-workflow-automation-prompt.md`
- Modify: `docs/workflows/README.md` (replace the particle row), `docs/working-history.md` (add a row for this spec; mark the する-verb plan row "Superseded by …"; point the Read + Build row's particle sentence at the new runbook), `docs/superpowers/plans/2026-10-21-suru-verb-wo-alternates.md` (Status: Superseded)

Runbook steps, in the style of the particle runbook (knobs `<level>`, `<point-count = 6>`, `<check-model>`; rules: never edit the script, prompts, validator or curriculum source to make a point pass; never set `review_status`; never bump `CHECK_VERSION`):
1. `select`. 0 → level done, stop.
2. `checkprompts`; per point spawn **one fresh subagent** that reads `<slug>.check.prompt.md` (below the header) and writes `<slug>.check.reply.md`; wait for it to finish, not for the file; `checkingest`. On failure, a fresh subagent fixes the reply from the rewritten prompt; 4 attempts.
3. `proposeprompts`; **this session** writes each `<slug>.propose.reply.md`.
4. `judgeprompts` per point; per point spawn **one fresh subagent** (never this session) to write `<slug>.judge.reply.md`; then `ingest`. Same retry rules.
5. `.venv/bin/python generate.py --level <level>`.
Final report: level, slugs; per point fixes (old → new, reason), valid/contrast/wrong counts; skipped points with errors; points remaining; a random sample of 10 added answers across the batch (`random.sample` over the printed added answers).

The `particle_check` marker already in `pool.json` (N4 `uchi-ni`) stays; it is not read any more.

- [ ] **Step 1:** Write the runbook; make the doc edits; delete the four files.
- [ ] **Step 2: Run** `grep -rn "particle_alternates\|particle-alternates" --include=*.py --include=*.md . ../../docs` from `curriculum/_build` — expect hits only in `docs/superpowers/specs/2026-10-21-…` and `docs/working-history.md` history text.
- [ ] **Step 3: Run** `.venv/bin/python -m unittest discover -s generate_content -p "test_*.py"` — expect PASS.
- [ ] **Step 4: Commit** — `git commit -m "Build answers runbook; retire the particle-swap lane"`.

### Task 5: Pilot on the three known cases

Run the runbook on `--level n4` with `--slugs uchi-ni,baai,aida` (skip `select`).

- [ ] **Step 1:** Run steps 2–5 of the runbook for the three slugs.
- [ ] **Step 2: Verify** in `curriculum/grammar/n4.json`:
  - `uchi-ni`: お茶が熱いうちに… has a `valid` build alternate whose plain text is お茶は熱いうちに飲んだ方がいいですよ。
  - `baai`: 遅れる場合は、先生に電話します。 has a `valid` alternate 遅れる場合は、先生に電話をします。 (comma optional).
  - `aida`: the sentence reads 会議の間に、電話を消した。
- [ ] **Step 3: Verify** from the repo root: `npm run validate-schema` → pass; `COMPILE_OUTPUT_PATH=$(mktemp -d)/c.db npm run compile-curriculum` → pass. Do not commit `curriculum/metadata.json` from the scratch compile.
- [ ] **Step 4:** `cd mobile && npx jest src/core/grammar` → PASS (guard only).
- [ ] **Step 5:** Update the `docs/working-history.md` row: pilot done, counts added, remaining points per level.
- [ ] **Step 6: Commit** — `git commit -m "Build answers: pilot on uchi-ni, baai, aida"` (`pool.json`, `n4.json`, docs).

Whole-level runs (all remaining N5 and N4 points) are later sessions of the runbook, not part of this plan.
