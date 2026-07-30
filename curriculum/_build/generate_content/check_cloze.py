# -*- coding: utf-8 -*-
"""Cloze-variant gate over the *shipped* grammar JSON.

validate_drafts.py only sees generated drafts; the cloze variants that actually
ship are authored in `_build/<level>_grammar.py`, so they need the same bar the
example sentences already clear. Checks each shipped variant for:

  1. the ＿＿＿ blank (docs/feedback 09 §67)
  2. `answer` ∈ `accepted_forms` — the app grades a grammar answer against
     `accepted_forms` alone (`core/grammar/answerEvaluator`), so a variant that
     blanks a whole word ("読みました" where the pattern is "ました") marks a
     correct learner wrong (docs/feedback 09 §68)
  3. the filled sentence stays in level and annotates with furigana, the same
     two checks the draft gate runs on example sentences
  4. nudges that give nothing away (R1.5), no two alike within a point

Run after `generate.py`:

    .venv/bin/python -m generate_content.check_cloze
    .venv/bin/python -m generate_content.check_cloze --level n5
"""

import argparse
import os
import sys

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BUILD_DIR)

from generate_content import context, level_check, validate_drafts  # noqa: E402

BLANK = "＿＿＿"


def variant_errors(cloze, item, ctx, known_readings):
    """List of error strings for one shipped cloze variant; empty means it passes."""
    errors = []
    jp = cloze.get("jp_cloze") or ""
    answer = cloze.get("answer") or ""

    if BLANK not in jp:
        errors.append("jp_cloze has no ＿＿＿ blank")
    if answer and answer not in item["accepted_forms"] and answer != item["primary_form"]:
        errors.append(
            f"answer {answer!r} is not an accepted form of {item['primary_form']} "
            f"({', '.join(item['accepted_forms'])}) — the evaluator would reject it"
        )

    filled = jp.replace(BLANK, answer)
    # A variant lifted from the item's own example sentences is already curated
    # content; the vocabulary cutoff is there to catch newly authored Japanese,
    # not to re-judge a sentence that ships on the lesson screen either way.
    if filled not in {e["japanese"] for e in item.get("example_sentences") or []}:
        violations = level_check.find_violations(filled, ctx["allowed_index"], ctx["extra_allowed"])
        if violations:
            errors.append(f"filled sentence {filled!r}: out-of-level words: {', '.join(violations)}")
    if not validate_drafts.furigana_ok(filled, known_readings):
        errors.append(f"filled sentence {filled!r}: furigana annotation failed")

    errors.extend(validate_drafts.nudge_errors(cloze.get("nudge"), answer, item))
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--level", action="append", dest="levels",
                        help="repeatable; defaults to every level")
    args = parser.parse_args()

    failed = 0
    for level in args.levels or context.LEVEL_ORDER:
        known_readings = validate_drafts._known_readings(level)
        checked = 0
        for item in context.load_grammar(level):
            variants = item.get("cloze_variants") or []
            if not variants:
                continue
            ctx = validate_drafts.item_context(level, item["slug"])
            seen = set()
            for i, cloze in enumerate(variants):
                checked += 1
                errors = variant_errors(cloze, item, ctx, known_readings)
                nudge = (cloze.get("nudge") or "").strip()
                if nudge and nudge in seen:
                    errors.append("nudge repeats an earlier variant's nudge")
                seen.add(nudge)
                for error in errors:
                    print(f"FAIL {level} {item['slug']} cloze_variants[{i}]: {error}")
                failed += bool(errors)
        print(f"{level}: {checked} cloze variant(s) checked")
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    main()
