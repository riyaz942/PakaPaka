# -*- coding: utf-8 -*-
"""Curriculum context for Phase 2a grammar lesson generation.

Loads the *generated* curriculum JSON (curriculum/<kind>/items.json — the
canonical output of generate.py, every item carrying its ladder `level` and a
global `sort_order`) and derives the per-grammar-point inputs the generator
prompt needs: allowed vocabulary, taught siblings, and upcoming related points.

## Allowed vocabulary

Allowed vocab for a grammar point = every word at or below the point's ladder
level, which includes the point's own linked `vocabulary_slugs` at or below
its level (a linked word above it is not allowed: the ladder rule is that
grammar sentences teach with learned words only). Plus the function-word /
colloquialism allowlists in level_check.py.

The ladder orders words by frequency, so the survival words the JLPT-era
`CORE_SEED_SLUGS` and proportional cutoff patched in come early on their own.
Deterministic, and it does not consult the dependency graph or the lesson
planner.
"""

import json
import os
import sys

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CURRICULUM_DIR = os.path.dirname(BUILD_DIR)
if BUILD_DIR not in sys.path:
    sys.path.insert(0, BUILD_DIR)

from levels import MAX_LEVEL  # noqa: E402


def level_dir(level):
    """The folder a ladder level's drafts and web staging files live in:
    `level-04`. The old JLPT folders (`n5/` ...) are not read any more; what
    they held is in the committed sidecars."""
    return f"level-{level:02d}"


def parse_levels(text):
    """`4` -> [4]; `1-20` -> [1, ..., 20]. Ladder levels run 1-60."""
    first, sep, last = text.partition("-")
    try:
        levels = list(range(int(first), int(last if sep else first) + 1))
    except ValueError:
        levels = []
    if not levels or levels[0] < 1 or levels[-1] > MAX_LEVEL:
        raise SystemExit(f"bad level {text!r}; give a level 1-{MAX_LEVEL} or a range like 1-20")
    return levels


def parse_level(text):
    """`--level 6` -> [6]; a range belongs to `--levels`."""
    if not text.isdigit():
        raise SystemExit(f"bad level {text!r}; --level takes one level 1-{MAX_LEVEL}")
    return parse_levels(text)


def add_level_args(parser):
    """`--level 6` or `--levels 1-20` (both into `args.levels`), or `--slugs a,b`."""
    pick = parser.add_mutually_exclusive_group()
    pick.add_argument("--level", dest="levels", type=parse_level, help="one ladder level")
    pick.add_argument("--levels", dest="levels", type=parse_levels,
                      help="a range of ladder levels, e.g. 1-20")
    pick.add_argument("--slugs", default=None, help="comma-separated slugs, any level")
    return pick


def load_items(kind):
    """Every item of `curriculum/<kind>/items.json` (for `readings`, the
    passages), in teaching order: by level, then sort_order."""
    key = "passages" if kind == "readings" else "items"
    with open(os.path.join(CURRICULUM_DIR, kind, "items.json"), encoding="utf-8") as f:
        return json.load(f)[key]


def load_vocab():
    return sorted(load_items("vocabulary"), key=lambda v: v["sort_order"])


def load_grammar():
    return sorted(load_items("grammar"), key=lambda g: g["sort_order"])


def grammar_item(slug):
    for g in load_grammar():
        if g["slug"] == slug:
            return g
    raise KeyError(f"unknown grammar slug {slug!r}")


def vocab_through(level):
    """Every word at or below `level`, in ladder order."""
    return [v for v in load_vocab() if v["level"] <= level]


def grammar_through(level):
    """Every grammar point at or below `level`, in ladder order."""
    return [g for g in load_grammar() if g["level"] <= level]


def allowed_vocab_for(slug):
    """Every word at or below the grammar point's level (its own linked words
    at or below the level are among them). Returns vocab items in ladder order."""
    return vocab_through(grammar_item(slug)["level"])


def siblings_for(slug, taught_limit=6, upcoming_limit=3):
    """Same-family grammar around this point: (taught, upcoming).

    "Taught" = same family, earlier sort_order (nearest first flipped back to
    curriculum order); "upcoming" = same family, later sort_order (nearest).
    Used for the contrast section and forward teasers respectively.
    """
    grammar = load_grammar()
    me = grammar_item(slug)
    family = me.get("family")
    taught = [
        g for g in grammar
        if g["slug"] != slug and g.get("family") == family
        and g["sort_order"] < me["sort_order"]
    ]
    upcoming = [
        g for g in grammar
        if g["slug"] != slug and g.get("family") == family
        and g["sort_order"] > me["sort_order"]
    ]
    taught = sorted(taught, key=lambda g: g["sort_order"])[-taught_limit:]
    upcoming = sorted(upcoming, key=lambda g: g["sort_order"])[:upcoming_limit]
    return taught, upcoming


def format_vocab_list(vocab):
    lines = []
    for v in vocab:
        reading = v.get("accepted_answers", [])
        kana = next(
            (a["answer_text"] for a in reading if a.get("answer_type") == "reading"),
            None,
        )
        kana_part = f" ({kana})" if kana and kana != v["primary_form"] else ""
        lines.append(f"- {v['primary_form']}{kana_part} — {v['meaning']} [{v['slug']}]")
    return "\n".join(lines) if lines else "(none yet)"


def format_grammar_list(items):
    if not items:
        return "(none)"
    return "\n".join(
        f"- {g['primary_form']} — {g['meaning']} (structure: {g['structure']}) [{g['slug']}]"
        for g in items
    )
