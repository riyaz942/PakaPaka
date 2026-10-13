# curriculum/_build/generate_content/check_grammar_pool.py
# -*- coding: utf-8 -*-
"""Grammar sentence-pool gate (grammar Read + Build cards).

Spec: docs/superpowers/specs/2026-10-13-grammar-read-build-srs-design.md §4.4.
Report-only until Plan 2 finishes the content; then generate/compile run it as
a hard gate. Run after generate.py:

    .venv/bin/python -m generate_content.check_grammar_pool
    .venv/bin/python -m generate_content.check_grammar_pool --level n5 --report reports/grammar-pool-baseline.md
"""

import argparse
import os
import sys

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BUILD_DIR)

import furigana as furigana_lib  # noqa: E402
from generate_content import context, level_check  # noqa: E402
from generate_content import grammar_sentences as gs  # noqa: E402
from generate_content import spans as spans_lib  # noqa: E402

MIN_SENTENCES = 8
MIN_MEANINGS = 3

#: Points whose grammar cannot take ≥ 2 sentence shapes (e.g. a form that is
#: never negative or past). One slug per line, each with a one-line reason.
VARIETY_EXEMPT = set()


def _parse_alternate(furigana):
    """Plain text of a furigana alternate, or None when the brackets don't
    balance (an unclosed 寒[さむ)."""
    if furigana.count("[") != furigana.count("]"):
        return None
    plain = furigana_lib.strip_furigana(furigana)
    return None if "[" in plain or "]" in plain else plain


def _alternate_errors(sentence, item, other_family_forms, vocab_forms):
    errors = []
    span = sentence.get("grammar_span")
    chunk = sentence["japanese"][span["start"]:span["end"]] if span else None
    forms_by_slug = {s: vocab_forms[s] for s in sentence.get("vocabulary_slugs", []) if s in vocab_forms}
    for index, alt in enumerate(sentence.get("build_alternates", [])):
        label = f"rule 6 alternate[{index}]"
        plain = _parse_alternate(alt["furigana"])
        if plain is None:
            errors.append(f"{label}: furigana does not parse: {alt['furigana']!r}")
            continue
        found = {s["vocabulary_slug"] for s in spans_lib.derive_spans(plain, forms_by_slug)}
        missing = sorted(set(forms_by_slug) - found)
        if missing:
            errors.append(f"{label}: missing words {missing} in {plain!r}")
            continue
        if alt["kind"] == "valid" and chunk and chunk not in plain:
            errors.append(f"{label}: valid alternate lacks the grammar {chunk!r}: {plain!r}")
        if alt["kind"] == "other_grammar" and not any(f in plain for f in other_family_forms):
            errors.append(f"{label}: other_grammar alternate has no same-family form: {plain!r}")
    return errors


def sentence_errors(sentence, item, allowed_index, other_family_forms, vocab_forms):
    jp = sentence["japanese"]
    errors = []
    span = sentence.get("grammar_span")
    if not span:
        errors.append("rule 1: no grammar span")
    uncovered = gs.uncovered_content_words(jp, sentence.get("word_spans", []), span)
    if uncovered:
        errors.append(f"rule 2: words with no word span {uncovered}")
    violations = level_check.find_violations(jp, allowed_index, item.get("accepted_forms", []))
    if violations:
        errors.append(f"rule 3: out of range {violations}")
    errors.extend(_alternate_errors(sentence, item, other_family_forms, vocab_forms))
    return [f"{jp} — {e}" for e in errors]


def point_errors(item, allowed_index, other_family_forms, vocab_forms):
    errors = []
    passing = []
    for sentence in item.get("example_sentences", []):
        found = sentence_errors(sentence, item, allowed_index, other_family_forms, vocab_forms)
        errors.extend(found)
        if not found:
            passing.append(sentence)
    if len(passing) < MIN_SENTENCES:
        errors.append(f"rule 4: {len(passing)} passing sentences, need {MIN_SENTENCES}")
    seen = {}
    for sentence in passing:
        key = frozenset(sentence.get("vocabulary_slugs", []))
        if key in seen:
            errors.append(f"rule 5: same words as {seen[key]!r}: {sentence['japanese']!r}")
        else:
            seen[key] = sentence["japanese"]
    shapes = {gs.sentence_shape(s["japanese"]) for s in passing}
    if item["slug"] not in VARIETY_EXEMPT and len(shapes) < 2:
        errors.append(f"rule 5: {len(shapes)} sentence shape(s), need 2 (question/negative/past)")
    meanings = [a for a in item.get("accepted_answers", []) if a["answer_type"] == "meaning"]
    if len(meanings) < MIN_MEANINGS:
        errors.append(f"rule 7: {len(meanings)} accepted meanings, need {MIN_MEANINGS}")
    return errors


def _other_family_forms(item, grammar):
    family = item.get("family")
    return [
        form for other in grammar
        if other["slug"] != item["slug"] and family and other.get("family") == family
        for form in other["accepted_forms"] if "〜" not in form
    ]


def check_level(level):
    """{slug: [errors]} for every grammar point at `level`."""
    grammar = context.load_grammar(level)
    vocab_forms = {
        v["slug"]: v["primary_form"]
        for lower in context.LEVEL_ORDER[: context.LEVEL_ORDER.index(level) + 1]
        for v in context.load_vocab(lower)
    }
    results = {}
    for item in grammar:
        allowed = level_check.build_allowed_index(context.allowed_vocab_for(level, item["slug"]))
        results[item["slug"]] = point_errors(
            item, allowed, _other_family_forms(item, grammar), vocab_forms
        )
    return results


def _report(results_by_level):
    lines = ["# Grammar pool report", ""]
    for level, results in results_by_level.items():
        failing = {slug: errs for slug, errs in results.items() if errs}
        lines += [f"## {level.upper()} — {len(results) - len(failing)}/{len(results)} points pass", ""]
        for slug, errs in failing.items():
            lines.append(f"### {slug}")
            lines += [f"- {e}" for e in errs]
            lines.append("")
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--level", choices=context.LEVEL_ORDER)
    parser.add_argument("--report", help="write the markdown report to this path")
    args = parser.parse_args()
    levels = [args.level] if args.level else context.LEVEL_ORDER
    results = {level: check_level(level) for level in levels}
    report = _report(results)
    if args.report:
        with open(args.report, "w", encoding="utf-8") as f:
            f.write(report)
    print(report)
    failing = sum(1 for r in results.values() for errs in r.values() if errs)
    sys.exit(1 if failing else 0)


if __name__ == "__main__":
    main()
