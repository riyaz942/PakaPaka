# -*- coding: utf-8 -*-
"""R1.5 nudge gate over the *shipped* grammar JSON.

validate_drafts.py only sees generated drafts; the cloze variants that actually
ship are hand-authored in `_build/n5_grammar.py` (docs/feedback 09 Wave A), so
they need the same check. Run after `generate.py`:

    .venv/bin/python -m generate_content.check_nudges
    .venv/bin/python -m generate_content.check_nudges --level n5
"""

import argparse
import os
import sys

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BUILD_DIR)

from generate_content import context, validate_drafts  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--level", action="append", dest="levels",
                        help="repeatable; defaults to every level")
    args = parser.parse_args()

    failed = 0
    for level in args.levels or context.LEVEL_ORDER:
        checked = 0
        for item in context.load_grammar(level):
            seen = set()
            for i, cloze in enumerate(item.get("cloze_variants") or []):
                checked += 1
                nudge = (cloze.get("nudge") or "").strip()
                errors = validate_drafts.nudge_errors(nudge, cloze.get("answer"), item)
                if nudge and nudge in seen:
                    errors.append("nudge repeats an earlier variant's nudge")
                seen.add(nudge)
                for error in errors:
                    print(f"FAIL {level} {item['slug']} cloze_variants[{i}]: {error}")
                failed += bool(errors)
        print(f"{level}: {checked} nudge(s) checked")
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    main()
