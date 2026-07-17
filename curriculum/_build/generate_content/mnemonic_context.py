# -*- coding: utf-8 -*-
"""Curriculum context for Phase 2b kanji + radical mnemonic generation.

Loads the *generated* curriculum JSON (curriculum/{kanji,radicals}/<level>.json,
the canonical output of generate.py) and derives the per-item inputs the
generator prompt and the mechanical gate both need:

  * kanji: primary reading target (the reading the mnemonic must contain),
    onyomi/kunyomi, meaning + accepted meanings, and the **taught
    decomposition** — the radicals that build_on the kanji per
    dependencies/graph.json, in *our* taught radical names. That graph (not
    KRADFILE) is the app's truth for kanji -> radical; a mnemonic must reference
    exactly those components and never a component the learner was not taught
    (docs/content-pipeline-plan.md 2b).
  * radical: form + meaning (its own accepted meanings) — the mnemonic is one
    vivid concrete image, no decomposition.

Cast lore for the kanji's readings is attached here so the generator and any
re-derivation share one code path.
"""

import json
import os

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CURRICULUM_DIR = os.path.dirname(BUILD_DIR)

from generate_content import cast as cast_lib  # noqa: E402

GRAPH_PATH = os.path.join(CURRICULUM_DIR, "dependencies", "graph.json")


def _load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_items(kind, level):
    path = os.path.join(CURRICULUM_DIR, kind, f"{level}.json")
    return _load_json(path)["items"]


def _by_slug(items):
    return {it["slug"]: it for it in items}


def _reading_answers(item):
    return [
        a["answer_text"]
        for a in item.get("accepted_answers", [])
        if a.get("answer_type") == "reading"
    ]


def _meaning_answers(item):
    return [
        a["answer_text"]
        for a in item.get("accepted_answers", [])
        if a.get("answer_type") == "meaning"
    ]


def _kanji_readings(item):
    """(onyomi_list, kunyomi_list) from the item's readings array."""
    onyomi = [r["reading"] for r in item.get("readings", []) if r["reading_type"] == "onyomi"]
    kunyomi = [r["reading"] for r in item.get("readings", []) if r["reading_type"] == "kunyomi"]
    return onyomi, kunyomi


def _primary_reading(item):
    """The reading used as the accepted `reading` answer (generate.py: first
    non-empty of onyomi then kunyomi). This is the mnemonic's required reading."""
    answers = _reading_answers(item)
    return answers[0] if answers else None


def decomposition_edges(level):
    """{kanji_slug: [radical_slug, ...]} for builds_on edges radical -> kanji at
    this level. Self/kanji-kanji edges are ignored: mnemonics decompose into
    taught *radicals* only."""
    graph = _load_json(GRAPH_PATH)
    out = {}
    for e in graph["edges"]:
        if (
            e.get("relationship_type") == "builds_on"
            and e.get("from_type") == "radical"
            and e.get("to_type") == "kanji"
            and e.get("to_slug", "").startswith(f"{level}-")
        ):
            out.setdefault(e["to_slug"], []).append(e["from_slug"])
    return out


def kanji_context(level, slug, cast=None):
    kanji = _by_slug(load_items("kanji", level))
    radicals = _by_slug(load_items("radicals", level))
    # Radicals from lower levels can also be components; include them all.
    for lower in ("n5",) if level == "n4" else ():
        radicals.update(_by_slug(load_items("radicals", lower)))
    if slug not in kanji:
        raise KeyError(f"unknown kanji slug {slug!r} in level {level}")
    item = kanji[slug]

    onyomi, kunyomi = _kanji_readings(item)
    primary = _primary_reading(item)
    comp_slugs = decomposition_edges(level).get(slug, [])
    components = []
    for rslug in comp_slugs:
        r = radicals.get(rslug)
        if not r:
            continue
        components.append({
            "slug": rslug,
            "form": r["primary_form"],
            "meaning": r["meaning"],
            "meaning_synonyms": _meaning_answers(r) or [r["meaning"]],
            "mnemonic_text": r.get("mnemonic_text", ""),
        })

    cast = cast or cast_lib.load_cast()
    reading_lore = cast_lib.lore_for_readings(onyomi + kunyomi, cast)

    return {
        "type": "kanji",
        "slug": slug,
        "char": item["primary_form"],
        "meaning": item["meaning"],
        "meaning_synonyms": _meaning_answers(item) or [item["meaning"]],
        "onyomi": onyomi,
        "kunyomi": kunyomi,
        "primary_reading": primary,
        "components": components,
        "reading_lore": reading_lore,
        "cast": cast,
    }


def radical_context(level, slug):
    radicals = _by_slug(load_items("radicals", level))
    if slug not in radicals:
        raise KeyError(f"unknown radical slug {slug!r} in level {level}")
    item = radicals[slug]
    return {
        "type": "radical",
        "slug": slug,
        "form": item["primary_form"],
        "meaning": item["meaning"],
        "meaning_synonyms": _meaning_answers(item) or [item["meaning"]],
        "existing_mnemonic": item.get("mnemonic_text", ""),
    }


def all_slugs(level, kind):
    """Slugs for a level in curriculum (sort) order."""
    return [it["slug"] for it in load_items(kind, level)]


def format_components(components):
    if not components:
        return ("(none taught — this kanji is not built from taught radicals; "
                "use a single vivid pictograph of the whole character instead, "
                "and do NOT name any component the learner has not been taught)")
    lines = []
    for c in components:
        syn = " / ".join(dict.fromkeys(c["meaning_synonyms"]))
        lines.append(f"- {c['form']} — “{syn}” (as we teach it: {c['mnemonic_text']})")
    return "\n".join(lines)
