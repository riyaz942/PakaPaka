#!/usr/bin/env python3
"""Batch check for a restyle file: the mechanical gate, plus the two defects the
gate provably cannot catch.

The gate accepts any *accepted answer* inside `<kanji>`, so it cannot tell that
米 landing on "USA" is wrong; and it strips tags before measuring prose, so it
cannot see that `<radical>corpse / body</radical>` reads as broken English. Both
slipped through the Rev 6 draft pass and had to be repaired by hand afterwards.

    check.py restyle/out/batch-01.json [...]
"""
import glob
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from generate_content import mnemonic_context as mc
from generate_content.validate_mnemonics import validate_kanji, _meaning_words

STRIP = re.compile(r"</?[^<>]*>")
TAGGED = re.compile(r"<(radical|kanji)>(.*?)</\1>")

LEVELS = {}
for _lvl in mc.ALL_LEVELS:
    for _it in mc.load_items("kanji", _lvl):
        LEVELS[_it["slug"]] = _lvl

STORED = {}
for _p in glob.glob(os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "kanji", "mnemonics", "*.json")):
    for _s, _e in json.load(open(_p)).items():
        if isinstance(_e, dict) and not _s.startswith("_"):
            STORED[_s] = _e


def check(slug, text):
    level = LEVELS[slug]
    ctx = mc.kanji_context(level, slug)
    entry = {k: v for k, v in STORED[slug].items() if k != "_meta"}
    baseline = set(validate_kanji(level, slug, entry, ctx=ctx, enforce_readability=True))
    entry["meaning_mnemonic"] = text
    errors = [e for e in validate_kanji(level, slug, entry, ctx=ctx,
                                        enforce_readability=True)
              if e not in baseline or e.startswith("meaning_mnemonic")]

    spans = TAGGED.findall(text)
    kanji_spans = [s for tag, s in spans if tag == "kanji"]
    if not kanji_spans:
        errors.append("no <kanji> landing tag")
    else:
        # The learner is quizzed on `meaning`; an accepted answer is not good
        # enough as the word the story ends on.
        primary = _meaning_words([ctx["meaning"]])
        if not any(re.search(rf"\b{re.escape(w)}", s.lower())
                   for s in kanji_spans for w in primary):
            errors.append(
                f"lands on {kanji_spans!r} instead of the taught meaning "
                f"{ctx['meaning']!r}")
        if len(kanji_spans) > 1:
            errors.append(f"{len(kanji_spans)} <kanji> tags; wrap the meaning once")
    for tag, span in spans:
        if "/" in span:
            errors.append(f"<{tag}> wraps a joint phrase {span!r}; tag one word")
    return len(STRIP.sub("", text)), errors


def main(paths):
    total = fails = 0
    lengths = []
    for path in paths:
        for slug, text in json.load(open(path)).items():
            total += 1
            n, errors = check(slug, text)
            lengths.append(n)
            if errors:
                fails += 1
                print(f"FAIL {slug} ({n}):")
                for e in errors:
                    print(f"    - {e}")
    lengths.sort()
    print(f"\n{total - fails}/{total} pass"
          + (f"   len {lengths[0]}/{lengths[len(lengths)//2]}/{lengths[-1]}"
             if lengths else ""))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:] or sorted(glob.glob(
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "out", "*.json")))))
