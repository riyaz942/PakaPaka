# -*- coding: utf-8 -*-
"""The per-JLPT item lists the content tools read until they take ladder levels.

The per-JLPT files (`curriculum/<kind>/n5.json` ...) are gone: generate.py
writes one `<kind>/items.json` per kind. The content tools, audits and import
scripts still ask for "the n4 grammar" or "the n5 words"; until Task 6 of
docs/superpowers/plans/2026-11-18-level-ladder.md moves them to ladder levels,
they get the same slugs as before from `jlpt_groups.json`, a one-time snapshot
of the removed files. Task 6 deletes this module and the snapshot.
"""

import json
import os

BUILD_DIR = os.path.dirname(os.path.abspath(__file__))
CURRICULUM_DIR = os.path.dirname(BUILD_DIR)
GROUPS_PATH = os.path.join(BUILD_DIR, "jlpt_groups.json")

JLPT_LEVELS = ("n5", "n4", "n3", "n2", "n1")


def _groups(kind):
    with open(GROUPS_PATH, encoding="utf-8") as f:
        return json.load(f)[kind]


def levels(kind):
    """The levels that had a `<kind>/<level>.json`, in teaching order."""
    groups = _groups(kind)
    return [level for level in JLPT_LEVELS if level in groups]


def load_items(kind, level):
    """What the removed `curriculum/<kind>/<level>.json` held: the items (for
    `readings`, the passages) of `<kind>/items.json` it listed, in its order,
    with its `sort_order` 1..N. A level that had no file (grammar n2) gives [],
    as a missing file did; a level that is not n5..n1 raises, and so does a
    snapshot slug items.json does not hold."""
    if level not in JLPT_LEVELS:
        raise ValueError(f"unknown level {level!r}")
    slugs = _groups(kind).get(level, [])
    key = "passages" if kind == "readings" else "items"
    with open(os.path.join(CURRICULUM_DIR, kind, "items.json"), encoding="utf-8") as f:
        by_slug = {item["slug"]: item for item in json.load(f)[key]}
    missing = [slug for slug in slugs if slug not in by_slug]
    if missing:
        raise ValueError(f"jlpt_groups.json {kind} {level} names slugs {kind}/items.json "
                         f"does not hold: {', '.join(missing)}")
    return [{**by_slug[slug], "sort_order": n} for n, slug in enumerate(slugs, start=1)]
