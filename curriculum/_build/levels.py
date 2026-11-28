# -*- coding: utf-8 -*-
"""The level-override file, `curriculum/_build/levels.json`, and the ladder.

Every item sits on an integer level 1..60. `_build/ladder.json` holds the
computed ladder: `{kind: {slug: {"level": n, "sort_order": n}}}`. One line in
levels.json — `"<kind>:<slug>": <level>` — moves an item, and the override
always wins. Nothing else has to change: the slug, the id in `id-registry.json`
and the content sidecars are keyed by slug and name no level.
"""

import json
import os

BUILD_DIR = os.path.dirname(os.path.abspath(__file__))
LEVELS_PATH = os.path.join(BUILD_DIR, "levels.json")
LADDER_PATH = os.path.join(BUILD_DIR, "ladder.json")

MAX_LEVEL = 60
KINDS = ("radical", "kanji", "vocabulary", "grammar", "passage")


def load_overrides(kind):
    """{slug: level} for one kind. Keys that start with `_` are notes."""
    with open(LEVELS_PATH, encoding="utf-8") as f:
        data = json.load(f)
    overrides = {}
    for key, level in data.items():
        if key.startswith("_"):
            continue
        key_kind, sep, slug = key.partition(":")
        if not sep or not slug or key_kind not in KINDS:
            raise ValueError(
                f"levels.json: bad key {key!r}; expected '<kind>:<slug>' with kind "
                f"one of {', '.join(KINDS)}"
            )
        if isinstance(level, bool) or not isinstance(level, int) or not 1 <= level <= MAX_LEVEL:
            raise ValueError(
                f"levels.json: {key} -> {level!r}; a level is an int from 1 to {MAX_LEVEL}"
            )
        if key_kind == kind:
            overrides[slug] = level
    return overrides


def load_ladder():
    """The ladder `_build/ladder.json` holds: {kind: {slug: {level, sort_order}}}."""
    with open(LADDER_PATH, encoding="utf-8") as f:
        return json.load(f)


def level_of(kind, slug):
    return load_ladder()[kind][slug]["level"]


def slugs_at_or_below(kind, level):
    """Slugs of one kind at `level` or earlier, in ladder sort order."""
    entries = load_ladder()[kind]
    return sorted(
        (slug for slug, e in entries.items() if e["level"] <= level),
        key=lambda slug: entries[slug]["sort_order"],
    )
