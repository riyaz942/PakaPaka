# -*- coding: utf-8 -*-
"""Promote drafted cloze candidates into the shipped `_build/<n5|n4>_grammar.py`.

The grammar-lesson lane already writes cloze candidates per point
(`drafts/<level>/<slug>-cloze-candidates.json`, see assemble.py), but nothing
promoted them: the shipped source is the `cloze_variants` key in the dataset
module, and `curriculum/grammar/<level>.json` is generated from that. This is
the missing step between the two.

Every candidate is put through the same gate `check_cloze` runs on shipped
variants — blank present, `answer` ∈ `accepted_forms`, filled sentence in
level and annotatable, nudge gives nothing away, no two nudges alike. Only
passing candidates are written, so promotion can never lower the shipped bar.
A point whose surviving candidates fall below `--min-variants` is left
untouched and reported, because a two-variant point barely rotates.

Run after the drafts exist, one batch at a time:

    .venv/bin/python -m generate_content.promote_cloze --level n4 --dry-run
    .venv/bin/python -m generate_content.promote_cloze --level n4 --limit 8
    .venv/bin/python -m generate_content.promote_cloze --level n4 --slugs node-because,hazu

Then regenerate and re-gate from `curriculum/_build`:

    .venv/bin/python generate.py --level n4
    .venv/bin/python -m generate_content.check_cloze --level n4
"""

import argparse
import json
import os
import re
import sys

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BUILD_DIR)

from generate_content import check_cloze, context, validate_drafts  # noqa: E402

DRAFTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "drafts")
MAX_VARIANTS = 6


def candidates_path(level, slug):
    return os.path.join(DRAFTS_DIR, level, f"{slug}-cloze-candidates.json")


#: Every grammar dataset. A point is written into the file that defines it,
#: which is not its shipped level when `_build/levels.json` moved it.
DATASET_PATHS = [os.path.join(BUILD_DIR, f"{level}_grammar.py") for level in ("n5", "n4")]


def surviving_variants(level, item, known_readings):
    """(kept, rejections) for one point's drafted candidates."""
    path = candidates_path(level, item["slug"])
    if not os.path.exists(path):
        return [], [("-", ["no cloze candidate draft"])]
    with open(path, encoding="utf-8") as f:
        candidates = json.load(f)

    ctx = validate_drafts.item_context(level, item["slug"])
    kept, rejections, seen = [], [], set()
    for index, cloze in enumerate(candidates):
        errors = check_cloze.variant_errors(cloze, item, ctx, known_readings)
        nudge = (cloze.get("nudge") or "").strip()
        if nudge and nudge in seen:
            errors.append("nudge repeats an earlier variant's nudge")
        if errors:
            rejections.append((index, errors))
            continue
        seen.add(nudge)
        kept.append(cloze)
        if len(kept) == MAX_VARIANTS:
            break
    return kept, rejections


def render_block(variants):
    """The `cloze_variants` source block, one variant per line like n5_grammar.py."""
    lines = ['        "cloze_variants": [']
    for variant in variants:
        fields = ", ".join(
            f'"{key}": {json.dumps(variant[key], ensure_ascii=False)}'
            for key in ("jp_cloze", "english", "answer", "nudge")
        )
        lines.append(f"            {{{fields}}},")
    lines.append("        ],")
    return "\n".join(lines) + "\n"


def insert_into_dataset(source, slug, block):
    """Adds `block` as the last key of `slug`'s dict literal.

    Anchors on the point's own `"slug": "<slug>",` line and the first
    `vocabulary_slugs` line after it, which every entry ends with. Returns the
    new source, or None when the anchor is missing or the point already has
    cloze variants."""
    start = source.find(f'        "slug": "{slug}",\n')
    if start == -1:
        return None
    end = source.find("\n    },\n", start)
    if end == -1:
        return None
    # +1 keeps the last key's own newline inside the slice, which the anchor matches on.
    entry = source[start:end + 1]
    if '"cloze_variants"' in entry:
        return None
    anchor = re.search(r'^        "vocabulary_slugs": \[[^\]]*\],\n', entry, re.M)
    if not anchor:
        return None
    cut = start + anchor.end()
    return source[:cut] + block + source[cut:]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--level", required=True, help="n5, n4, …")
    parser.add_argument("--slugs", help="comma-separated; defaults to every point without variants")
    parser.add_argument("--limit", type=int, help="promote at most this many points this run")
    parser.add_argument("--min-variants", type=int, default=4,
                        help="skip a point with fewer surviving candidates (default 4)")
    parser.add_argument("--dry-run", action="store_true", help="report only, write nothing")
    args = parser.parse_args()

    level = args.level
    sources = {}
    for path in DATASET_PATHS:
        with open(path, encoding="utf-8") as f:
            sources[path] = f.read()
    written = set()

    items = {item["slug"]: item for item in context.load_grammar(level)}
    if args.slugs:
        slugs = [s.strip() for s in args.slugs.split(",") if s.strip()]
        unknown = [s for s in slugs if s not in items]
        if unknown:
            raise SystemExit(f"unknown {level} slug(s): {', '.join(unknown)}")
    else:
        slugs = [s for s, item in items.items() if not item.get("cloze_variants")]

    known_readings = validate_drafts._known_readings(level)
    promoted, skipped = [], []
    for slug in slugs:
        if args.limit and len(promoted) >= args.limit:
            break
        kept, rejections = surviving_variants(level, items[slug], known_readings)
        if len(kept) < args.min_variants:
            skipped.append((slug, len(kept), rejections))
            continue
        for path, source in sources.items():
            updated = insert_into_dataset(source, slug, render_block(kept))
            if updated is not None:
                sources[path] = updated
                written.add(path)
                break
        else:
            skipped.append((slug, len(kept), [("-", ["already has cloze_variants / no anchor"])]))
            continue
        promoted.append((slug, len(kept), len(rejections)))

    for slug, kept, dropped in promoted:
        print(f"PROMOTE {slug}: {kept} variant(s)" + (f", {dropped} rejected" if dropped else ""))
    for slug, kept, rejections in skipped:
        print(f"SKIP    {slug}: only {kept} passing")
        for index, errors in rejections:
            for error in errors:
                print(f"          [{index}] {error}")

    if args.dry_run:
        print("\ndry run — no dataset written")
    elif promoted:
        for path in sorted(written):
            with open(path, "w", encoding="utf-8") as f:
                f.write(sources[path])
        names = ", ".join(os.path.relpath(path, BUILD_DIR) for path in sorted(written))
        print(f"\nwrote {len(promoted)} point(s) into {names}")
    print(f"{len(promoted)} promoted, {len(skipped)} skipped")


if __name__ == "__main__":
    main()
