# -*- coding: utf-8 -*-
"""Mechanical validation gate for generated reading passages (Phase 4).

This is step 3 of the plan's Phase 4 — the closed loop. Run on every batch
output before any human reads it; failures are fed back into the prompt and
retried (`generate_readings.py`), capped at 3 attempts.

## The passage contract

The model submits only what a model can be trusted with:

    title, body, english_translation, summary_ja, summary_en,
    questions[{prompt, accepted_answers[]}]

Everything positional or phonetic is **derived here**, never asked for:

  * `grammar_slugs` — the points `grammar_detect.py` finds in the body. The
    model used to declare this list about its own work, which made the seed's
    `required_grammar` unenforceable and let out-of-level grammar through
    unmentioned. Detection is calibrated at 98.8% recall against the reviewed
    declarations (docs/content/reading-passage-expansion-plan.md § 4).

  * `word_spans` — non-overlapping occurrences of allowed vocabulary in the
    body: the dictionary form (来る), plus the taught inflections of any allowed
    word (来ます, 開けました — see `generate_content/spans.py`).
    `compile-curriculum` requires
    `body.slice(start, end) === span.surface_form ?? primary_form` and spans in
    body order with no overlap; an LLM counting UTF-16 offsets would fail that
    on most passages.
  * `vocabulary_slugs` — the unique slugs of *all* the spans, dictionary and
    inflected alike. A word the passage only ever conjugates (食べます in a
    passage that never writes 食べる) is a word the learner has to know to read
    it, so it is linked like any other and counts toward the ≥90% Guru+ unlock
    bar.
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
  6. grammar detected in the body is inside the seed's allowed set, and every
     point in the seed's `required_grammar` is actually there
  7. derived spans satisfy the compile-time contract (in range, ordered,
     non-overlapping, surface equals the span's own claimed form) and the
     inflection contract (a taught family, a surface that really is a form of
     the word, and every taught-inflected occurrence of an allowed word spanned)

**Not checked, by design:** whether a `humorous` seed produced something funny.
That is a human-read concern; the humour *mix* is checked at the seed level
instead (`reading_seeds.tone_mix_errors`).

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
from generate_content import (  # noqa: E402
    grammar_detect, level_check, reading_context, reading_seeds, spans,
)
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


#: Span derivation lives in `generate_content/spans.py` — the readings lane and
#: the example-sentence lane build the same spans from the same tokenizer.
build_word_spans = spans.build_word_spans


def build_passage_spans(body, span_forms):
    """The passage's dictionary spans plus the taught inflections of every word
    allowed at this point (see the `word_spans` note in the module docstring)."""
    dictionary_spans = spans.build_word_spans(body, span_forms)
    forms_by_slug = {slug: form for form, slug in span_forms.items()}
    return spans.merge_spans(
        dictionary_spans, spans.build_inflected_spans(body, forms_by_slug)
    )


def detect_grammar(body, level):
    """The body's grammar points, from the tokenizer (`grammar_detect`).

    This is the derived `grammar_slugs`: `enrich` stores it and check 6 gates
    on it. Ambiguous matches are kept — ません is `masu` and `masen` and the
    detector cannot say which the writer meant, so both are linked, which is
    the recall-first trade `grammar_detect` documents."""
    return grammar_detect.detect(body, level)


def _grammar_errors(result, body, ctx):
    """Check 6, over detected grammar rather than declared.

    A surface with several readings (ません is `masu` and `masen`; れる is
    `n4-potential` and `n4-passive`) is out of level only when **every** reading
    is: the passage cannot be blamed for an interpretation it did not intend
    when a taught one fits the same characters. `grammar_detect.MANUAL_SLUGS`
    never reach `matches`, so a point no rule can separate from another is not
    grounds for rejection here either."""
    errors = []
    by_span = {}
    for match in result["matches"]:
        by_span.setdefault((match["start"], match["end"]), []).append(match["slug"])

    violations = {}
    for (start, end), slugs in sorted(by_span.items()):
        if any(slug in ctx["allowed_grammar_slugs"] for slug in slugs):
            continue
        key = tuple(sorted(set(slugs)))
        violations.setdefault(key, []).append((start, end))
    for slugs, spots in violations.items():
        start, end = spots[0]
        errors.append(
            f"grammar not taught by this point: {' / '.join(slugs)} — "
            f"{body[start:end]!r} in ...{body[max(0, start - 10):end + 10]}... "
            f"({len(spots)}x). Rewrite the sentence using the allowed patterns."
        )

    found = set(result["slugs"])
    missing = [s for s in ctx["required_grammar_slugs"] if s not in found]
    if missing:
        errors.append(
            f"required grammar missing from the passage: {', '.join(missing)} — "
            f"this passage is the only one in the level assigned these points, so "
            f"it has to use each of them at least once"
        )
    return errors


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
    word_spans = build_passage_spans(body, ctx["span_forms"])
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
        "grammar_slugs": detect_grammar(body, ctx["level"])["slugs"],
        "vocabulary_slugs": sorted({s["vocabulary_slug"] for s in word_spans}),
        "word_spans": word_spans,
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


def _span_errors(word_spans, body, ctx):
    """Re-checks the compile-time span contract over the derived spans. They
    hold by construction; this catches a regression in the builder before it
    reaches `compile-curriculum`, where the same violation is a hard throw."""
    errors = []
    if not any("inflection" not in s for s in word_spans):
        errors.append(
            "no allowed vocabulary appears in the passage in its dictionary form — "
            "rewrite around words the learner knows"
        )
    forms_by_slug = {slug: form for form, slug in ctx["span_forms"].items()}
    previous_end = 0
    for span in word_spans:
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
        expected = span.get("surface_form", forms_by_slug.get(label))
        if surface != expected:
            errors.append(f"span {label} surface {surface!r} != {expected!r}")
        errors += _inflected_span_errors(span, forms_by_slug)

    # Completeness: an inflected occurrence of an allowed word that carries no
    # span is a word the learner has been taught and cannot tap.
    derived = {
        (s["start"], s["end"]) for s in build_passage_spans(body, ctx["span_forms"])
    }
    for start, end in sorted(derived - {(s["start"], s["end"]) for s in word_spans}):
        errors.append(
            f"unspanned taught-inflected occurrence {body[start:end]!r} at "
            f"[{start}, {end}) — every inflected use of an allowed word is tappable"
        )
    return errors


def _inflected_span_errors(span, forms_by_slug):
    """The inflection contract on one span: a taught family and a surface that
    is really a form of the word it names.

    "The passage links the word" is not checked here any more:
    `vocabulary_slugs` is derived *from* the spans (`enrich`), so an inflected
    span naming a word that appears only conjugated is the intended outcome,
    not a violation."""
    inflection = span.get("inflection")
    label = span["vocabulary_slug"]
    if inflection is None:
        return (
            []
            if "surface_form" not in span
            else [f"span {label} carries surface_form without an inflection"]
        )
    errors = []
    if inflection not in spans.TAUGHT_INFLECTIONS:
        errors.append(
            f"span {label} inflection {inflection!r} is not taught "
            f"(expected one of {', '.join(spans.TAUGHT_INFLECTIONS)})"
        )
    primary_form = forms_by_slug.get(label)
    surface = span.get("surface_form", "")
    stem = spans.inflection_stem(primary_form) if primary_form else None
    if stem is not None and (surface == primary_form or not surface.startswith(stem)):
        errors.append(
            f"span {label} surface {surface!r} is not an inflection of "
            f"primary_form {primary_form!r}"
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

    # 6. grammar the body actually uses
    errors += _grammar_errors(detect_grammar(body, level), body, ctx)

    errors += _question_errors(draft, ctx, known_readings)
    errors += _span_errors(build_passage_spans(body, ctx["span_forms"]), body, ctx)
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
