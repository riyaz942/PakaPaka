"""How many items a single-session lane still has to do at one level.

Prints one integer. `scripts/run-content-lane.sh` skips a level when it is 0.
Each count is the same selection as Step 1 of the lane's prompt in
docs/workflows/<workflow>-single-session-workflow-automation-prompt.md;
change both together.

    .venv/bin/python -m generate_content.lane_remaining --workflow <name> --level N [--type T]
"""
import argparse
import json
import os
import sys

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BUILD_DIR)

from generate_content.context import level_dir  # noqa: E402


def _draft_names(path):
    if not os.path.isdir(path):
        return set()
    return {n[:-5] for n in os.listdir(path) if n.endswith(".json")} - {"requests-preview"}


def mnemonics(level, kind):
    from generate_content.generate_mnemonics import default_slugs
    return len(default_slugs(kind, [level]))


def grammar_pool(level, _kind):
    from generate_content import check_grammar_pool as pool_check
    return len(pool_check.failing_slugs([level]))


def build_answers(level, _kind):
    import generate
    from generate_content import build_answers as ba
    return len(ba.select_slugs([level], None, generate.load_pool_sidecar()))


def reading_passages(level, _kind):
    from generate_content import reading_seeds
    drafts_dir = os.path.join(BUILD_DIR, "generate_content/drafts/readings", level_dir(level))
    done = set()
    for slug in _draft_names(drafts_dir):
        with open(os.path.join(drafts_dir, slug + ".json"), encoding="utf-8") as f:
            if json.load(f).get("status") == "draft":
                done.add(slug)
    try:
        slugs = reading_seeds.all_slugs(level)
    except KeyError as error:
        raise SystemExit(error.args[0])
    return len([s for s in slugs if s not in done])


def example_sentences(level, kind):
    from generate_content import example_context as ec
    path = os.path.join(BUILD_DIR, "../vocabulary/examples.json")
    entries = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
    generated = {s for s, e in entries.items() if e.get("example_sentences")}
    drafted = _draft_names(os.path.join(BUILD_DIR, "generate_content/drafts/examples",
                                        level_dir(level), kind))
    return len([s for s in ec.all_slugs(level, kind) if s not in generated | drafted])


COUNTERS = {
    "radical-kanji-vocab-mnemonic": mnemonics,
    "grammar-pool": grammar_pool,
    "build-answers": build_answers,
    "reading-passages": reading_passages,
    "example-sentences": example_sentences,
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workflow", required=True, choices=sorted(COUNTERS))
    parser.add_argument("--level", required=True, type=int)
    parser.add_argument("--type", help="radical | kanji | vocab | grammar (mnemonic and example lanes)")
    args = parser.parse_args()
    if args.workflow == "radical-kanji-vocab-mnemonic" and not args.type:
        raise SystemExit("--type is required for radical-kanji-vocab-mnemonic")
    print(COUNTERS[args.workflow](args.level, args.type or "vocab"))


if __name__ == "__main__":
    main()
