# する-Verb を Alternates Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A grammar Build card accepts the を form of a する verb (電話をします)
when the sentence uses the plain form (電話します), and the reverse is not
changed. The fix is build-time content: no app or evaluator change.

**Status:** Not started (2026-10-21).

## Why

A learner typed 遅れる場合は先生に電話をします for 遅れる場合は、先生に電話します。
(`baai`, N4). Both are correct. The review marked it wrong.

The Build card grades by stored answers only
(`mobile/src/core/grammar/buildEvaluator.ts`): the sentence, its `valid`
alternates (`build_alternates`), and the learner's own saved answers. Matching
ignores punctuation, spaces and kanji/kana spelling per word. It has no other
tolerance. A missing correct version is always a missing list entry.

Today most sentences have one accepted answer:

| | N5 | N4 |
|---|---:|---:|
| Sentences | 705 | 824 |
| Only the main sentence accepted | 561 (80%) | 753 (91%) |

The particle-swap lane (`generate_content/particle_alternates.py`) does not
cover this case: it only changes a particle that is already in the sentence.
It never adds を.

## The rule

For a sentence (or a `valid` alternate) that:

1. has a word span whose vocabulary slug is on the **approved list** below, and
2. writes that word as noun + a form of する (し / す / さ / せ directly after
   the noun, e.g. 電話します, 心配しないで, 練習すれば), and
3. contains **no other を** anywhere (日本語を勉強します must not become
   日本語を勉強をします — a double を is wrong),

add one `valid` alternate with を inserted between the noun and する:
電話します → 電話をします.

One alternate per approved verb in the sentence. Skip an alternate that
already exists.

Adding を does not change the meaning, so no judge step is needed, unlike
the particle-swap lane.

## Approved list (needs maintainer review)

Not every する verb takes を. びっくりする (びっくりをする is wrong), 拝見する (humble)
and 失礼する are examples. So the rule uses an explicit list, not a pattern.

These are the 15 verbs that the rule would touch today, with the sentence
count (N5 + N4 = 56 sentences). Proposed: approve all 15.

| Slug | Verb | Sentences | を form |
|---|---|---:|---|
| renshuu-suru | 練習する | 9 | 練習をする ✅ |
| benkyou-suru | 勉強する | 7 | 勉強をする ✅ |
| denwa-suru | 電話する | 7 | 電話をする ✅ |
| sanpo-suru | 散歩する | 6 | 散歩をする ✅ |
| kekkon-suru | 結婚する | 5 | 結婚をする ✅ |
| setsumei-suru | 説明する | 4 | 説明をする ✅ |
| chikoku-suru | 遅刻する | 3 | 遅刻をする ✅ |
| goukaku-suru | 合格する | 3 | 合格をする ✅ (less common, still correct) |
| shinpai-suru | 心配する | 2 | 心配をする ✅ |
| souji-suru | 掃除する | 2 | 掃除をする ✅ |
| ryokou-suru | 旅行する | 2 | 旅行をする ✅ |
| shitsumon-suru | 質問する | 2 | 質問をする ✅ |
| shusseki-suru | 出席する | 2 | 出席をする ✅ |
| yoyaku-suru | 予約する | 1 | 予約をする ✅ |
| sotsugyou-suru | 卒業する | 1 | 卒業をする ✅ |

Other する verbs in the vocabulary (66 in total) are not on the list until
a sentence uses them and someone approves them. Never approve: びっくりする,
拝見する, 失礼する, 承知する, the one-kanji verbs (愛する, 察する, …), and する itself.

## Out of scope

- **The reverse case** (sentence has 宿題をします, learner types 宿題します):
  12 sentences, mostly 宿題をする / 料理をする. 宿題する is informal, so removing を
  is not always right. Decide separately.
- Any change to the app or `buildEvaluator.ts`.
- Changes to `pool.json`: the alternates are made at build time, so the
  pool stays the authored source.

---

### Task 1: Approved list

**Files:**
- Create: `curriculum/_build/suru_wo_verbs.json` — a sorted JSON list of the
  approved vocabulary slugs (the table above, after review).

- [ ] Maintainer reviews the table and confirms or removes entries.
- [ ] Write the file with the approved slugs.

### Task 2: Pure helper + tests

**Files:**
- Modify: `curriculum/_build/generate_content/grammar_sentences.py` — add
  `wo_suru_alternates(japanese, word_spans, vocab_forms, approved) -> list[str]`.
- Test: `curriculum/_build/generate_content/test_grammar_sentences.py`.

- [ ] Write failing tests:
  - 遅れる場合は、先生に電話します。 → `["遅れる場合は、先生に電話をします。"]`
  - 心配しないでください。 → `["心配をしないでください。"]`
  - 毎日練習すれば、上手になります。 → `["毎日練習をすれば、上手になります。"]`
  - A sentence that already has を → `[]`.
  - A verb not on the approved list → `[]`.
  - びっくりしました (not approved) → `[]`.
  - Span that is the noun alone (電話 as a noun, no する after it) → `[]`.
- [ ] Implement: for each span whose slug is in `approved`, take the noun
  (`vocab_forms[slug][:-2]`), check that the text at `span.start` starts
  with the noun and the next character is し/す/さ/せ, and insert を after
  the noun. Return `[]` when `"を" in japanese`.
- [ ] Run: `.venv/bin/python -m unittest generate_content.test_grammar_sentences`
  from `curriculum/_build` → PASS.

### Task 3: Wire into the build

**Files:**
- Modify: `curriculum/_build/generate.py` — `_grammar_example` (the
  `alternates` loop, ~L641–650), and load `suru_wo_verbs.json` once next to
  the other build inputs.
- Test: `curriculum/_build/generate_content/test_generate_grammar_level.py`.

- [ ] Write a failing test: building `baai` gives a `build_alternates` entry
  with furigana `遅[おく]れる場[ば]合[あい]は、先[せん]生[せい]に電[でん]話[わ]をします。`
  and `kind: "valid"`.
- [ ] After the authored alternates, add the generated ones for the
  sentence and for each authored `valid` alternate. Annotate with
  `furigana_lib.annotate_sentence` like the authored ones. Skip duplicates.
- [ ] Run the grammar build tests → PASS.

### Task 4: Regenerate and verify

- [ ] From `curriculum/_build`: `.venv/bin/python generate.py --level n5`
  and `--level n4`.
- [ ] `git diff curriculum/grammar/` shows only new `build_alternates`
  entries: about 6 (N5) + 50 (N4). No other change.
- [ ] `generate.py` still passes its `check_grammar_pool` gate (alternates
  keep every listed word).
- [ ] From the repo root: `npm run validate-schema` and
  `COMPILE_OUTPUT_PATH=<scratch>/c.db npm run compile-curriculum` → pass.
  Do not commit `curriculum/metadata.json` from a scratch compile.
- [ ] Spot-check 10 generated alternates by reading them.
- [ ] `cd mobile && npx jest src/core/grammar` → PASS (no app change, guard
  only).

### Task 5: Docs

- [ ] `docs/working-history.md`: set this plan to Done, with the count of
  alternates added.

## Done when

- 遅れる場合は先生に電話をします grades as correct on the `baai` Build card
  after a curriculum compile.
- Every approved する verb in a no-を sentence has its を alternate.
- No sentence with another を gets one.
