# Grammar Build — Accepted Answers Lane (design, 2026-10-21)

## Why

A grammar Build card shows an English sentence; the learner types the whole
Japanese sentence. `mobile/src/core/grammar/buildEvaluator.ts` marks it
correct only when it matches a stored answer: the sentence, its `valid`
alternates, or an answer the learner saved with "My answer is correct too".
Matching ignores spaces, sentence punctuation, katakana/hiragana and
kanji/kana spelling per word. It has no other tolerance.

Most sentences have only one stored answer, so correct answers are marked
wrong. Three real cases from the maintainer's reviews:

| Shown sentence | Learner typed | Difference |
|---|---|---|
| お茶**が**熱いうちに飲んだ方がいいですよ。 | お茶**は**熱いうちに… | particle swap |
| 遅れる場合は、先生に電話します。 | …先生に電話**を**します | optional を on a する verb |
| 会議の間、電話を消した。 | 会議の間**に**電話を消した | optional に after 間 |

| | N5 | N4 |
|---|---:|---:|
| Shipped Build sentences | 705 | 824 |
| Only the sentence itself accepted | 561 (80%) | 753 (91%) |

Two narrow fixes exist or were planned: the particle-swap lane
(`generate_content/particle_alternates.py`, run on one point) and the
する-verb を plan (`docs/superpowers/plans/2026-10-21-suru-verb-wo-alternates.md`,
not started). Each covers one type of difference, and the third case above
fits neither. Each new type would need its own lane. This design replaces
both with one workflow that covers every type.

## What it is

One build-time workflow, run in a Claude Code session like the other
single-session workflows. For every sentence in `curriculum/grammar/pool.json`
it does two things, in order:

1. **Check the sentence.** Some failures are not missing answers but wrong
   sentences. The shown 会議の間、電話を消した breaks the reviewed `aida`
   lesson (plain 間 is for an action that fills the whole time; one action
   such as turning off a phone takes 間に), so the learner's 間に answer was
   the correct one. A sentence that is wrong is fixed in place.
2. **Add accepted answers.** A model lists the other answers a teacher would
   mark fully correct for the (fixed) sentence, a second model judges them,
   and the `valid` ones are added to the sentence's `alternates`. `generate.py` then ships them as
`build_alternates` (no change to that path), and they reach the app in
`curriculum.db`.

The app does not change. Grading stays offline, exact and fast; it only
compares against a longer list.

## Goals

- A learner who types a correct answer for the English sentence, using the
  listed words, the grammar point under review and the shown register
  (plain/polite), is marked correct.
- One workflow covers all types of difference, including types not yet seen.
- Every N5 and N4 sentence is checked once.
- The maintainer checks a sample of the added answers, not every one.

## Non-goals

- No change to grammar points, English, lessons, mnemonics, vocabulary
  links or `review_status`. Sentences change only when step 1 finds one
  wrong, and then only as much as the fix needs. Nothing is regenerated.
- No app or `buildEvaluator.ts` change. No looser matching at runtime.
- The "My answer is correct too" button is below the fold on the incorrect
  screen. Moving it up is a separate task, later.
- No regeneration of content when a candidate is rejected.

## Anti-goals (a failure even if it runs)

- **Accepting a wrong answer.** An accepted wrong answer teaches the
  mistake. When unsure, the judge does not choose `valid`; the learner can
  still save their own answer in the app.
- **Accepting an answer that avoids the grammar point.** An answer that uses
  a different grammar point (場合 → たら, うちに → 前に) is not `valid`. Same-
  family swaps are already graded `other_grammar` from authored data; the
  workflow must not turn them into `correct`.
- **Accepting a different meaning.** A contrastive は the English does not
  have, a change of who does what, or a change of tense or politeness is not
  `valid`.
- **Self-approval.** The model that proposes candidates does not judge them.
  The reading-passage naturalness pilot showed that a model reviewing its
  own output clears its own choices.

## How it works (decided)

Per level, per batch of grammar points, in one session:

1. **Select** — the script prints the next points not yet checked at the
   current workflow version.
2. **Check sentences** — the session (not a subagent: the pool lane wrote
   the sentences, so this is not self-approval) reads each sentence with its
   English, register, listed words and the point's lesson (meaning,
   structure, `caution_notes`). It returns `ok`, or `fix` with the smallest
   corrected sentence and a one-line reason. The script applies fixes and
   runs the pool gate on them; a fix that fails the gate goes back with the
   errors, with the same retry budget. The maintainer does not approve
   fixes; the final report lists every one.
3. **Propose** — the session reads one prompt per point (every sentence with
   its English, register, listed words and the grammar span) and writes
   candidate answers per sentence.
4. **Judge** — a fresh subagent, never the proposing session, judges each
   candidate (one subagent may judge up to 3 points, each by its own prompt) `valid` / `contrast` / `wrong` with a one-line reason. The
   verdict set and judging rules carry over from
   `prompts/particle-alternates.md`, widened from "one particle" to "any
   difference".
5. **Ingest** — the script adds the `valid` answers as
   `{"japanese": …, "kind": "valid"}`, then runs
   `generate.build_grammar_point` and `check_grammar_pool.check_point` on
   the result. On failure nothing is merged and the errors go back into the
   prompt; same retry budget as the particle lane (4 attempts, then skip).
6. **Regenerate** — `generate.py --level <level>`.

**Final report:** level, points run, per point the valid / contrast / wrong
counts, every sentence fix (old → new, reason), skipped points with errors,
points remaining, and a random sample of about 10 added answers for the
maintainer to read.

## Constraints

- An alternate must contain every word in the sentence's
  `vocabulary_slugs` (`check_grammar_pool` gate) and be plain Japanese that
  `furigana.annotate_sentence` can annotate (`generate.py` rejects `[`).
- The grammar point's form must stay inside the alternate so `generate.py`
  still finds its grammar span.
- Same register as the sentence (`register_of` must give the same value).
- A candidate that normalises to an existing answer (only punctuation,
  spacing or kana/kanji spelling differs) is dropped by the script before
  judging; the evaluator already accepts it.
- The evaluator matches whole sentences, so two independent differences
  (お茶は… and …電話をします in one sentence) need their combination as its
  own alternate.
- `pool.json` is the authored source; alternates go there, not into the
  generated level JSON.
- Work from `curriculum/_build` with `.venv/bin/python`, like the other
  lanes. No API keys, no browser.

## Builder's calls (made by me, not agreed with the maintainer)

- **Retire the old lanes.** When this workflow works, delete
  `particle_alternates.py`, its test, `prompts/particle-alternates.md`, and
  the particle runbook. Mark the する-verb plan "Superseded" in
  `docs/working-history.md`. Alternates they already added stay.
- **Marker.** A new `_meta.answers_check = {"version", "model"}` per point,
  in place of `particle_check`. Selection uses it. Bumping the version is
  the only way to re-run a level; do not bump it to re-check content the
  maintainer has read.
- **A fixed sentence keeps its English.** If the English itself cannot fit a
  correct Japanese sentence with the listed words and grammar point, the
  point is skipped and reported, not rewritten.
- **The old wrong sentence is not kept as an alternate.**
- **Saved learner answers.** The app keys "My answer is correct too" answers
  and sentence history by the sentence's Japanese text, so answers saved on a
  sentence that gets fixed no longer attach to it. Accepted: fixes are few and
  the fixed sentence plus its new alternates should accept what was saved.
- **Status.** The workflow does not change `review_status` (the particle lane
  sets it to `draft`; that line is not carried over).
- **Cap.** At most 10 candidates per sentence, the most likely learner
  answers first, combinations included.
- **Judge model.** A strong reasoning model at high effort, as in the
  particle runbook.
- **Split する-verbs pass the word gate.** Today rule 6 in
  `check_grammar_pool._alternate_errors` rejects 先生に電話をします for
  `denwa-suru`, because `spans.derive_spans` finds only the unsplit form
  電話します. Change rule 6 only: a する-verb slug also counts as present when
  its noun is followed by を and a form of する. `spans.derive_spans` is not
  changed, so word spans in shipped content do not move. This is a one-time
  builder change; the session running the workflow still never edits the
  validator.
- **Matching `other_grammar` pairs.** When a `valid` alternate is added, the
  script also adds, without a judge, the `other_grammar` version of it for
  each `other_grammar` alternate the sentence already has (same chunk swap,
  applied to the new alternate). Otherwise お茶は熱い間に… would grade
  `incorrect` while お茶が熱い間に… grades `other_grammar`.
  `check_grammar_pool` already accepts such pairs.

## Left to the builder

- Script layout (new module or a rename of `particle_alternates.py`),
  prompt wording, file paths under `generate_content/web/`, and the runbook
  in `docs/workflows/`.
- Batch size per session.
- Tests: pure functions (candidate dedup by normalised text, reply
  validation, merge) get unit tests like `test_particle_alternates.py`.

## Done when

- The three cases in the table above are accepted after a compile (case 3
  by fixing the sentence to 会議の間に、電話を消した。).
- Every N5 and N4 point carries `answers_check` at the current version, or
  is listed as skipped with its errors.
- `generate.py`, `npm run validate-schema` and a scratch
  `compile-curriculum` pass.
- `docs/working-history.md` has a row for this design with its status.
