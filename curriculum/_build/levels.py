# -*- coding: utf-8 -*-
"""The level-override file, `curriculum/_build/levels.json`.

Every item has a default level: the dataset that defines it (`n5_vocab.py`,
`n4_grammar.py`, …), the frequency rank `vocab_skeleton.json` gives a derived
word, or the band `reports/kanji_bands.py` assigns a kanji or radical. One line
in levels.json — `"<kind>:<slug>": "<level>"` — moves the item, and the override
always wins. Nothing else has to change: the slug, the id in `id-registry.json`
and the content sidecars are keyed by slug and name no level.

A move can break the ladder (an N5 sentence now uses an N4 word). The build
does not stop for that; `reports/level_report.py` lists it.
"""

import json
import os

BUILD_DIR = os.path.dirname(os.path.abspath(__file__))
LEVELS_PATH = os.path.join(BUILD_DIR, "levels.json")

LEVEL_ORDER = ["n5", "n4", "n3", "n2", "n1"]

#: The levels each kind ships at. Grammar and passages exist at N5/N4 only, so
#: an override that names N3 for one is an error, not a new level file.
KIND_LEVELS = {
    "radical": LEVEL_ORDER,
    "kanji": LEVEL_ORDER,
    "vocabulary": LEVEL_ORDER,
    "grammar": ["n5", "n4"],
    "passage": ["n5", "n4"],
}


def load_overrides(kind):
    """{slug: level} for one kind. Keys that start with `_` are notes."""
    with open(LEVELS_PATH, encoding="utf-8") as f:
        data = json.load(f)
    overrides = {}
    for key, level in data.items():
        if key.startswith("_"):
            continue
        key_kind, sep, slug = key.partition(":")
        if not sep or not slug or key_kind not in KIND_LEVELS:
            raise ValueError(
                f"levels.json: bad key {key!r}; expected '<kind>:<slug>' with kind "
                f"one of {', '.join(KIND_LEVELS)}"
            )
        if level not in KIND_LEVELS[key_kind]:
            raise ValueError(
                f"levels.json: {key} -> {level!r}; a {key_kind} can only be "
                f"{', '.join(KIND_LEVELS[key_kind])}"
            )
        if key_kind == kind:
            overrides[slug] = level
    return overrides


def place(kind, sources):
    """{level: [entry]} for one kind, from `[(default level, entries)]`.

    `sources` comes in level order. An entry keeps its default level unless
    levels.json names it. Inside a level, entries keep the global order (default
    level, then position in the source), so an item moved one level later is
    taught first there and an item moved earlier is taught last. A slug the
    sources do not define is an error, not a silent no-op."""
    overrides = load_overrides(kind)
    placed = {level: [] for level in KIND_LEVELS[kind]}
    known = set()
    for default, entries in sorted(sources, key=lambda s: LEVEL_ORDER.index(s[0])):
        for entry in entries:
            known.add(entry["slug"])
            placed[overrides.get(entry["slug"], default)].append(entry)
    unknown = sorted(set(overrides) - known)
    if unknown:
        raise ValueError(f"levels.json names unknown {kind} slug(s): {', '.join(unknown)}")
    return placed
