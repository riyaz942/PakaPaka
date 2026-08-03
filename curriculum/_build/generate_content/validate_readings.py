# -*- coding: utf-8 -*-
"""Mechanical validation gate for generated reading passages (Phase 4).

This is step 3 of the plan's Phase 4 — the closed loop. Run on every batch
output before any human reads it; failures are fed back into the prompt and
retried (`generate_readings.py`), capped at 3 attempts.

## The passage contract

The model submits only what a model can be trusted with:

    title, body, english_translation, summary_ja, summary_en,
    questions[{prompt, accepted_answers[]}], grammar_slugs[]

Everything positional or phonetic is **derived here**, never asked for:

  * `word_spans` — literal, non-overlapping occurrences of allowed vocabulary
    dictionary forms in the body. `compile-curriculum` requires
    `body.slice(start, end) === primary_form` and spans in body order with no
    overlap; an LLM counting UTF-16 offsets would fail that on most passages.
  * `vocabulary_slugs` — the unique slugs of those spans, which is the
    convention the shipped passages already follow (conjugated usage is not
    marked).
  * `word_count` — tokenizer token count, punctuation excluded.
  * `body_furigana` / `prompt_furigana` — bracket annotations from the same
    fugashi tagger as everything else. Never asked of the model: it writes
    plain prose (the same rule the grammar-lesson lane follows), and check 5
    below rejects a body the tagger cannot round-trip, so the annotation
    `enrich()` stores is one the gate already proved. `generate.py` derives the
    identical strings at build time, which keeps the wire-in a no-op.

`enrich()` is what produces the derived fields, and the assembled draft carries
them, so the enrichment lives in `_build` where regeneration reproduces it (the
generator-drift trap Rev 1 hit when passage enrichment existed only in the
shipped JSON).

## Checks

  1. structural — required fields, single-line plain-prose body, length bounds
  2. questions — the seed's question count, non-empty accepted answers, and at
     least one accepted answer that actually occurs in the body
  3. word count inside the seed's target band
  4. tokenizer level-check on the body and every question prompt: no
     out-of-level content words (`level_check` exception policy + the seed's
     `extra_allowed` names)
  5. furigana annotation succeeds — `annotate_sentence` returning None is a
     REJECTION for generated content, not silent no-furigana
  6. declared `grammar_slugs` exist and are inside the seed's allowed set
  7. derived spans satisfy the compile-time contract (in range, ordered,
     non-overlapping, surface equals primary_form)

**Not checked, by design:** whether the passage actually *uses* only allowed
grammar (a tokenizer cannot extract grammar points — see `reading_context`),
and whether a `humorous` seed produced something funny. Both are human-read
concerns; the humour *mix* is checked at the seed level instead
(`reading_seeds.tone_mix_errors`).

Standalone usage:
    .venv/bin/python -m generate_content.validate_readings --level n5
    .venv/bin/python -m generate_content.validate_readings --fixtures
"""

import argparse
import json
import os
import re
import sys

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BUILD_DIR)

import furigana as furigana_lib  # noqa: E402
from generate_content import level_check, reading_context, reading_seeds  # noqa: E402
from generate_content.validate_drafts import _known_readings  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
DRAFTS_DIR = os.path.join(HERE, "drafts", "readings")
FIXTURES_DIR = os.path.join(HERE, "fixtures", "readings")

TITLE_LEN_BOUNDS = (2, 20)
SUMMARY_JA_LEN_BOUNDS = (8, 60)
SUMMARY_EN_LEN_BOUNDS = (20, 160)
TRANSLATION_LEN_RATIO = (1.0, 4.0)  # english chars per japanese char
QUESTION_PROMPT_LEN_BOUNDS = (4, 40)

#: Tokens that are not words: punctuation, symbols, whitespace.
NON_WORD_POS1 = {"補助記号", "空白", "記号"}

#: Markup we never want stored raw in a passage string (mirrors
#: validate_examples._MARKUP_RE: markdown, HTML, and furigana brackets).
_MARKUP_RE = re.compile(r"[*_`#|<>]|\]\(|[ぁ-ヿ㐀-䶿一-鿿々〆ー]\[")

REQUIRED_TEXT_FIELDS = (
    "title", "body", "english_translation", "summary_ja", "summary_en",
)


# --- derived fields --------------------------------------------------------

def word_count(text):
    """Tokenizer word count — the same fugashi tagger, punctuation excluded."""
    tagger = furigana_lib.get_tagger()
    return sum(
        1 for token in tagger(text)
        if getattr(token.feature, "pos1", None) not in NON_WORD_POS1
    )


#: Longest vocabulary entry, in tokens, a span may cover (朝ご飯 → 朝/ご飯,
#: 日本語 → 日本/語, 一緒に → 一緒/に).
MAX_SPAN_TOKENS = 4


def _tokens_with_offsets(body):
    tokens = []
    cursor = 0
    for token in furigana_lib.get_tagger()(body):
        start = body.index(token.surface, cursor)
        cursor = start + len(token.surface)
        tokens.append({
            "surface": token.surface,
            "start": start,
            "end": cursor,
            "pos1": getattr(token.feature, "pos1", None),
            "pos2": getattr(token.feature, "pos2", None),
        })
    return tokens


def _span_may_start_at(tokens, i, run_length):
    """Whether a token run is a word the reader should be able to tap.

    Spans are built on *token* boundaries rather than by substring search,
    because raw string matching marks things that are not words: 「は」+「いつも」
    contains はい, 十分 contains 分, 日曜日 contains 日. Three exclusions on top
    of that, all of them matching the convention the shipped passages follow:

      * a run may not begin at a suffix (接尾辞) — 二つ**目**, 一**匹**. Prefixes
        are *not* excluded: they head their own word (お茶, お願いします), and a
        bare prefix never matches a dictionary form anyway.
      * a bare numeral is not a tappable word (十, 百), though a multi-token
        entry that starts with one is (二つ)
      * a counter bound to a numeral is part of the number, not a word on its
        own — the 分 of 十分, the 円 of 百円, the 時 of 十一時
    """
    head = tokens[i]
    if head["pos1"] == "接尾辞":
        return False
    if run_length == 1 and head["pos2"] == "数詞":
        return False
    if i > 0 and tokens[i - 1]["pos2"] == "数詞":
        return False
    return True


def build_word_spans(body, span_forms):
    """Vocabulary occurrences in `body` as token-aligned, non-overlapping spans.

    Scans left to right; at each token the longest run of consecutive tokens
    whose surface is an allowed dictionary form wins, and the scan resumes
    after it. Spans therefore come out in body order and cannot overlap —
    exactly what `compile-curriculum` requires.
    """
    tokens = _tokens_with_offsets(body)
    spans = []
    i = 0
    while i < len(tokens):
        for length in range(min(MAX_SPAN_TOKENS, len(tokens) - i), 0, -1):
            start = tokens[i]["start"]
            end = tokens[i + length - 1]["end"]
            slug = span_forms.get(body[start:end])
            if slug and _span_may_start_at(tokens, i, length):
                spans.append({"vocabulary_slug": slug, "start": start, "end": end})
                i += length
                break
        else:
            i += 1
    return spans


def _annotated(text, known_readings):
    """Bracket-annotated `text`, or None when there is nothing to annotate.

    Kanji-free text gets no field at all rather than a copy of itself, matching
    `generate.py`. Annotation *failure* cannot reach here: check 5 of the gate
    rejects a body the tagger cannot round-trip, so by the time `enrich` runs
    the only None left is "no kanji"."""
    if not any(furigana_lib.is_kanji(ch) for ch in text):
        return None
    return furigana_lib.annotate_sentence(text, known_readings)


def _enriched_question(question, known_readings):
    out = {
        "prompt": question["prompt"].strip(),
        "accepted_answers": list(question["accepted_answers"]),
    }
    prompt_furigana = _annotated(out["prompt"], known_readings)
    if prompt_furigana:
        out["prompt_furigana"] = prompt_furigana
    return out


def enrich(draft, ctx):
    """The model's submission plus every derived field.

    The result is shaped like a `readingPassage` in the curriculum schema (bar
    `slug` and `sort_order`), so wiring the generated set into the shipped
    readings is a lift, not a translation.

    Furigana is derived here, from the same fugashi tagger as everything else —
    the model writes plain prose and never authors brackets. `generate.py`
    annotates identically at build time, so an artifact that already carries
    readings survives the wire-in unchanged; deriving it here is what makes the
    artifact reviewable *with* readings, the way the app will show it."""
    body = draft["body"].strip()
    spans = build_word_spans(body, ctx["span_forms"])
    known_readings = _known_readings(ctx["level"])
    passage = {
        "title": draft["title"].strip(),
        "body": body,
        "questions": [
            _enriched_question(q, known_readings) for q in draft.get("questions", [])
        ],
        "english_translation": draft["english_translation"].strip(),
        "summary_ja": draft["summary_ja"].strip(),
        "summary_en": draft["summary_en"].strip(),
        "grammar_slugs": list(draft.get("grammar_slugs", [])),
        "vocabulary_slugs": sorted({s["vocabulary_slug"] for s in spans}),
        "word_spans": spans,
        "word_count": word_count(body),
    }
    body_furigana = _annotated(body, known_readings)
    if body_furigana:
        passage["body_furigana"] = body_furigana
    return passage


# --- gate ------------------------------------------------------------------

def _text_field_errors(draft):
    errors = []
    for field in REQUIRED_TEXT_FIELDS:
        value = draft.get(field)
        if not isinstance(value, str) or not value.strip():
            errors.append(f"{field} is missing or empty")
    if errors:
        return errors

    body = draft["body"].strip()
    if "\n" in body:
        errors.append("body must be a single line (paragraph breaks are not rendered)")
    for ch in body + draft["title"]:
        if ord(ch) > 0xFFFF:
            errors.append(
                f"body/title contains the non-BMP character {ch!r}; word span offsets "
                "are UTF-16 indices and would not survive compilation"
            )
            break
    for field, (lo, hi) in (
        ("title", TITLE_LEN_BOUNDS),
        ("summary_ja", SUMMARY_JA_LEN_BOUNDS),
        ("summary_en", SUMMARY_EN_LEN_BOUNDS),
    ):
        n = len(draft[field].strip())
        if n < lo:
            errors.append(f"{field} is too short ({n} chars; need >= {lo})")
        if n > hi:
            errors.append(f"{field} is too long ({n} chars; keep <= {hi})")

    ratio = len(draft["english_translation"].strip()) / max(len(body), 1)
    lo, hi = TRANSLATION_LEN_RATIO
    if not lo <= ratio <= hi:
        errors.append(
            f"english_translation is {ratio:.1f}x the body length (expected "
            f"{lo}–{hi}x) — it must translate the whole passage, no more, no less"
        )

    for field in REQUIRED_TEXT_FIELDS:
        if _MARKUP_RE.search(draft[field]):
            errors.append(
                f"{field} contains markup (markdown/HTML/furigana brackets); passages "
                "are plain prose — the pipeline adds furigana itself"
            )
    return errors


def _question_errors(draft, ctx, known_readings):
    errors = []
    questions = draft.get("questions")
    if not isinstance(questions, list) or not questions:
        return ["missing or empty field questions"]
    if len(questions) != ctx["question_count"]:
        errors.append(
            f"expected {ctx['question_count']} comprehension questions "
            f"(the seed's question_count), got {len(questions)}"
        )
    body = draft.get("body", "")
    for i, q in enumerate(questions):
        if not isinstance(q, dict):
            errors.append(f"questions[{i}] is not an object")
            continue
        prompt = q.get("prompt")
        answers = q.get("accepted_answers")
        if not isinstance(prompt, str) or not prompt.strip():
            errors.append(f"questions[{i}].prompt is missing or empty")
            prompt = None
        if not isinstance(answers, list) or not answers or not all(
            isinstance(a, str) and a.strip() for a in answers
        ):
            errors.append(f"questions[{i}].accepted_answers must be a non-empty string list")
            answers = None
        if prompt is None or answers is None:
            continue

        prompt = prompt.strip()
        lo, hi = QUESTION_PROMPT_LEN_BOUNDS
        if not lo <= len(prompt) <= hi:
            errors.append(
                f"questions[{i}].prompt is {len(prompt)} chars (expected {lo}–{hi})"
            )
        if _MARKUP_RE.search(prompt):
            errors.append(f"questions[{i}].prompt contains markup; keep it plain prose")

        # Answerable from the passage: the passage is the only thing the learner
        # has, so at least one accepted answer has to be readable off it.
        if not any(a.strip() in body for a in answers):
            errors.append(
                f"questions[{i}] ({prompt}): no accepted answer occurs in the passage "
                f"— {answers} cannot be answered by reading it"
            )
        violations = level_check.find_violations(
            prompt, ctx["allowed_index"], ctx["extra_allowed"]
        )
        if violations:
            errors.append(
                f"questions[{i}] ({prompt}): out-of-level words: {', '.join(violations)}"
            )
        if any(furigana_lib.is_kanji(ch) for ch in prompt):
            if furigana_lib.annotate_sentence(prompt, known_readings) is None:
                errors.append(
                    f"questions[{i}] ({prompt}): furigana annotation failed "
                    "(tokenizer round-trip)"
                )
    return errors


def _span_errors(spans, body, ctx):
    """Re-checks the compile-time span contract over the derived spans. They
    hold by construction; this catches a regression in the builder before it
    reaches `compile-curriculum`, where the same violation is a hard throw."""
    errors = []
    if not spans:
        errors.append(
            "no allowed vocabulary appears in the passage in its dictionary form, so "
            "the reader has nothing to tap — rewrite around words the learner knows"
        )
    forms_by_slug = {slug: form for form, slug in ctx["span_forms"].items()}
    previous_end = 0
    for span in spans:
        label = span["vocabulary_slug"]
        if not 0 <= span["start"] < span["end"] <= len(body):
            errors.append(f"span {label} [{span['start']}, {span['end']}) is out of range")
            continue
        if span["start"] < previous_end:
            errors.append(
                f"span {label} starts at {span['start']} before the previous span ends "
                f"at {previous_end}"
            )
        previous_end = span["end"]
        surface = body[span["start"]:span["end"]]
        if surface != forms_by_slug.get(label):
            errors.append(
                f"span {label} surface {surface!r} != primary_form "
                f"{forms_by_slug.get(label)!r}"
            )
    return errors


def validate_draft(level, slug, draft, ctx=None):
    """List of error strings; empty means the draft passes the gate."""
    ctx = ctx or reading_context.seed_context(level, slug)
    if not isinstance(draft, dict):
        return ["draft is not an object"]

    errors = _text_field_errors(draft)
    if errors:
        return errors

    known_readings = _known_readings(level)
    body = draft["body"].strip()

    # 3. length band, on words rather than characters
    count = word_count(body)
    lo, hi = ctx["target_words"]
    if not lo <= count <= hi:
        errors.append(
            f"passage is {count} words; the seed asks for {lo}–{hi} "
            f"(word count excludes punctuation)"
        )

    # 4. level-check the body and the Japanese summary. `summary_ja` is
    # learner-facing and, unlike the body, ships *without* furigana (the schema
    # has no field for it), so an out-of-level word there is worse, not better.
    for label, text in (("body", body), ("summary_ja", draft["summary_ja"].strip())):
        violations = level_check.find_violations(
            text, ctx["allowed_index"], ctx["extra_allowed"]
        )
        if violations:
            errors.append(f"{label}: out-of-level words: {', '.join(violations)}")

    # 5. furigana must annotate cleanly — a rejection, not a pass-through
    if any(furigana_lib.is_kanji(ch) for ch in body):
        if furigana_lib.annotate_sentence(body, known_readings) is None:
            errors.append("body: furigana annotation failed (tokenizer round-trip)")

    # 6. declared grammar
    grammar_slugs = draft.get("grammar_slugs")
    if not isinstance(grammar_slugs, list) or not grammar_slugs:
        errors.append("missing or empty field grammar_slugs")
    else:
        if len(set(grammar_slugs)) != len(grammar_slugs):
            errors.append(f"grammar_slugs contains duplicates: {grammar_slugs}")
        unknown = [s for s in grammar_slugs if s not in ctx["allowed_grammar_slugs"]]
        if unknown:
            errors.append(
                f"grammar_slugs outside the allowed set (not taught by this point, or "
                f"not a real slug): {unknown}"
            )

    errors += _question_errors(draft, ctx, known_readings)
    errors += _span_errors(build_word_spans(body, ctx["span_forms"]), body, ctx)
    return errors


# --- fixtures --------------------------------------------------------------

def _fixture_files():
    for root, _dirs, names in sorted(os.walk(FIXTURES_DIR)):
        for name in sorted(names):
            if name.endswith(".json"):
                yield os.path.join(root, name)


def run_fixtures():
    """Gate self-check: good fixtures must pass, bad ones must fail with the
    error they were written to provoke. No API, no network — this is the test
    the Phase 4 gate has instead of a test runner the repo does not have for
    Python."""
    if not os.path.isdir(FIXTURES_DIR):
        raise SystemExit(f"no fixtures at {FIXTURES_DIR}")
    failures = 0
    total = 0
    for path in _fixture_files():
        with open(path, encoding="utf-8") as f:
            fixture = json.load(f)
        total += 1
        rel = os.path.relpath(path, FIXTURES_DIR)
        level = fixture["level"]
        errors = validate_draft(level, fixture["seed"], fixture["passage"])
        expect = fixture["expect"]
        if expect == "pass":
            ok = not errors
        else:
            ok = all(
                any(needle in e for e in errors) for needle in expect
            ) and bool(errors)
        print(f"{'ok  ' if ok else 'FAIL'} {rel} — {fixture['note']}")
        if not ok:
            failures += 1
            if expect == "pass":
                for e in errors:
                    print(f"       unexpected: {e}")
            else:
                print(f"       expected error containing: {expect}")
                for e in errors or ["(no errors at all)"]:
                    print(f"       got: {e}")
    print(f"\n{total - failures}/{total} fixtures behaved as declared")
    return failures


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--level", default="n5")
    parser.add_argument("--fixtures", action="store_true",
                        help="run the gate's own good/bad fixtures instead of drafts")
    args = parser.parse_args()

    if args.fixtures:
        raise SystemExit(1 if run_fixtures() else 0)

    seed_problems = reading_seeds.seed_errors(args.level)
    for problem in seed_problems:
        print(f"SEED  {problem}")

    level_dir = os.path.join(DRAFTS_DIR, args.level)
    if not os.path.isdir(level_dir):
        raise SystemExit(
            f"no drafts at {level_dir}" + (" (and the seed list has problems)"
                                           if seed_problems else "")
        )
    failed = 0
    for name in sorted(os.listdir(level_dir)):
        if not name.endswith(".json") or name == "requests-preview.json":
            continue
        with open(os.path.join(level_dir, name), encoding="utf-8") as f:
            record = json.load(f)
        if not isinstance(record, dict) or not record.get("tool_input"):
            continue
        errors = validate_draft(args.level, record["slug"], record["tool_input"])
        print(f"{'PASS' if not errors else 'FAIL'} {record['slug']}")
        for e in errors:
            print(f"  - {e}")
        failed += bool(errors)
    raise SystemExit(1 if failed or seed_problems else 0)


if __name__ == "__main__":
    main()
