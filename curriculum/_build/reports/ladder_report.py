# -*- coding: utf-8 -*-
"""The ladder report: what `_build/ladder.json` puts at each level, and what
content the ladder breaks (docs/superpowers/specs/2026-11-18-level-ladder-design.md
§7.6, §7.7).

It prints level 1's radicals and kanji, the size of every level, the JLPT rows,
the rule-2 breaches (must be zero), the radicals no kanji uses, and the
`content_breaks` counts with the first examples of each. Later tasks read
`content_breaks` as their "done" check.

A sentence is "above level" when one of its `vocabulary_slugs` sits at a level
after its owner's. `vocab_mnemonics_without_kanji` counts the words in
`_build/regen_vocab_mnemonics.json` "pending" that have a mnemonic: words whose
mnemonic was written while one of their kanji was untaught (`builds_on` in the
graph of 2026-11-22). A point with no pool sentences (the conjugation primer)
is not counted as under 2 readable.

Reads only; always exits 0. Writes curriculum/_build/reports/ladder-report.md.
Run (from anywhere):
    curriculum/_build/.venv/bin/python curriculum/_build/reports/ladder_report.py
"""

import json
import os
import sys
from collections import defaultdict

REPORTS_DIR = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR = os.path.dirname(REPORTS_DIR)
CURRICULUM_DIR = os.path.dirname(BUILD_DIR)
sys.path.insert(0, BUILD_DIR)

from levels import MAX_LEVEL, load_ladder  # noqa: E402

#: Levels the first release ships content for.
TARGET_LEVEL = 20
EXAMPLES = 10

#: content_breaks key -> (type, what breaks, when): the spec §7.6 columns.
BREAKS = {
    "grammar_sentences_above_level": (
        "Grammar", "Example sentences that use a word above the point's level "
        "(`grammar/pool.json`)", "Before release"),
    "grammar_points_under_2_readable": (
        "Grammar", "Points with fewer than 2 example sentences that use only words at or "
        "below the point's level", "Before release"),
    "grammar_points_linked_above_level": (
        "Grammar", "Points whose linked words (`vocabulary_slugs`) include a word above "
        "the point's level", "Before release"),
    "vocab_sentences_above_level": (
        "Vocabulary", "Example sentences that use a word above the word's level "
        "(`vocabulary/examples.json`)", "Later phase"),
    "vocab_mnemonics_without_kanji": (
        "Vocabulary", "Mnemonics written while a kanji of the word was untaught "
        "(`_build/regen_vocab_mnemonics.json` pending)", "Later phase"),
    "kanji_1_20_without_mnemonic": (
        "Kanji", "Kanji in levels 1-20 with no mnemonic", "Before release"),
    "radicals_1_20_without_mnemonic": (
        "Radicals", "Radicals in levels 1-20 with no mnemonic", "Before release"),
    "passages_above_target": (
        "Passages", "Passages above level 20", "Before release"),
}


def break_lists(ladder, sidecars):
    """{content_breaks key: [(owner level, text)]}, sorted."""
    def level(kind, slug):
        return ladder[kind][slug]["level"]

    def later_words(slugs, owner_level):
        return [f"{s} ({level('vocabulary', s)})" for s in slugs
                if level("vocabulary", s) > owner_level]

    found = {key: [] for key in BREAKS}

    def sentences(key, kind, owners, field):
        for slug, entry in owners.items():
            n = level(kind, slug)
            readable = 0
            for s in entry[field]:
                words = later_words(s["vocabulary_slugs"], n)
                if words:
                    found[key].append((n, f"{slug}: {s['japanese']} — {', '.join(words)}"))
                else:
                    readable += 1
            if kind == "grammar" and readable < 2:
                found["grammar_points_under_2_readable"].append(
                    (n, f"{slug}: {readable} of {len(entry[field])} readable"))

    sentences("grammar_sentences_above_level", "grammar", sidecars["grammar_pool"], "sentences")
    sentences("vocab_sentences_above_level", "vocabulary", sidecars["vocab_examples"],
              "example_sentences")
    for slug, slugs in sidecars["grammar_links"].items():
        words = later_words(slugs, level("grammar", slug))
        if words:
            found["grammar_points_linked_above_level"].append(
                (level("grammar", slug), f"{slug}: {', '.join(words)}"))
    for slug in sidecars["regen_vocab_mnemonics"]["pending"]:
        if slug in sidecars["vocab_mnemonics"]:
            found["vocab_mnemonics_without_kanji"].append((level("vocabulary", slug), slug))
    for key, kind, mnemonics in (("kanji_1_20_without_mnemonic", "kanji", "kanji_mnemonics"),
                                 ("radicals_1_20_without_mnemonic", "radical",
                                  "radical_mnemonics")):
        for slug, entry in ladder[kind].items():
            if entry["level"] <= TARGET_LEVEL and not sidecars[mnemonics].get(slug):
                found[key].append((entry["level"], slug))
    for slug, entry in ladder["passage"].items():
        if entry["level"] > TARGET_LEVEL:
            found["passages_above_target"].append((entry["level"], slug))
    return {key: sorted(items) for key, items in found.items()}


def content_breaks(ladder, sidecars):
    """{key: count} for every key in BREAKS."""
    return {key: len(items) for key, items in break_lists(ladder, sidecars).items()}


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_sidecars():
    from n4_grammar import N4_GRAMMAR
    from n5_grammar import N5_GRAMMAR

    def path(*parts):
        return os.path.join(CURRICULUM_DIR, *parts)

    return {
        "grammar_pool": load(path("grammar", "pool.json")),
        "grammar_links": {g["slug"]: g["vocabulary_slugs"] for g in N5_GRAMMAR + N4_GRAMMAR},
        "vocab_examples": load(path("vocabulary", "examples.json")),
        "vocab_mnemonics": load(path("vocabulary", "mnemonics.json")),
        "kanji_mnemonics": load(path("kanji", "mnemonics.json")),
        "radical_mnemonics": load(path("radicals", "mnemonics.json")),
        "grammar_mnemonics": load(path("grammar", "mnemonics.json")),
        "regen_vocab_mnemonics": load(path("_build", "regen_vocab_mnemonics.json")),
    }


def load_names():
    """{(kind, slug): (character, meaning)} for radicals and kanji."""
    from n4_kanji import N4_KANJI
    from n4_radicals import N4_RADICALS
    from n5_kanji import N5_KANJI
    from n5_radicals import N5_RADICALS

    decomposition = load(os.path.join(BUILD_DIR, "decomposition.json"))
    skeleton = load(os.path.join(BUILD_DIR, "skeleton.json"))
    names = {}
    for r in list(N5_RADICALS) + list(N4_RADICALS) + decomposition["radicals"]:
        names.setdefault(("radical", r["slug"]), (r["form"], r["meaning"]))
    for k in list(N5_KANJI) + list(N4_KANJI) + skeleton["kanji"]:
        names.setdefault(("kanji", k["slug"]), (k["char"], k["meaning"]))
    return names


def render(ladder, sidecars, names):
    lists = break_lists(ladder, sidecars)
    out = ["# Ladder report\n",
           "Generated by `curriculum/_build/reports/ladder_report.py` from "
           "`_build/ladder.json`. Do not edit by hand.\n",
           "## Level 1\n"]
    for kind, title in (("radical", "Radicals"), ("kanji", "Kanji")):
        slugs = sorted((s for s, e in ladder[kind].items() if e["level"] == 1),
                       key=lambda s: ladder[kind][s]["sort_order"])
        out.append(f"{title} ({len(slugs)}):\n")
        out += [f"- {names[(kind, s)][0]} {names[(kind, s)][1]} (`{s}`)" for s in slugs]
        out.append("")

    mnemonics = {"radical": "radical_mnemonics", "kanji": "kanji_mnemonics",
                 "vocabulary": "vocab_mnemonics", "grammar": "grammar_mnemonics"}
    sizes = defaultdict(int)
    for kind in ("radical", "kanji", "vocabulary", "grammar", "passage"):
        for slug, entry in ladder[kind].items():
            sizes[(entry["level"], kind)] += 1
            if kind in mnemonics and not sidecars[mnemonics[kind]].get(slug):
                sizes[(entry["level"], "none")] += 1
    out += ["## Level sizes\n",
            "| Level | Radicals | Kanji | Words | Grammar | Passages | No mnemonic |",
            "| ---: | ---: | ---: | ---: | ---: | ---: | ---: |"]
    for n in range(1, MAX_LEVEL + 1):
        out.append(f"| {n} | " + " | ".join(
            str(sizes[(n, kind)]) for kind in
            ("radical", "kanji", "vocabulary", "grammar", "passage", "none")) + " |")
    out.append("")

    out += ["## JLPT equivalence\n", "| JLPT | First level | Last level |", "| --- | ---: | ---: |"]
    out += [f"| {r['jlpt']} | {r['first_level']} | {r['last_level']} |"
            for r in ladder["jlpt_equivalence"]]
    out.append("")
    out.append(f"## Breaches ({len(ladder['breaches'])})\n")
    out += [f"- {b}" for b in ladder["breaches"]] or ["None."]
    out.append("")
    out.append(f"## Unused radicals (level {MAX_LEVEL})\n")
    out += [f"- {names[('radical', s)][0]} {names[('radical', s)][1]} (`{s}`)"
            for s in ladder["unused_radicals"]] or ["None."]
    out.append("")

    out += ["## Content breaks\n",
            "| Type | What breaks | Count | When |", "| --- | --- | ---: | --- |"]
    for key, (kind, what, when) in BREAKS.items():
        out.append(f"| {kind} | {what} (`{key}`) | {len(lists[key])} | {when} |")
    out.append("")
    for key, items in lists.items():
        out.append(f"### `{key}` ({len(items)})\n")
        if not items:
            out.append("None.\n")
            continue
        out += [f"- level {n}: {text}" for n, text in items[:EXAMPLES]]
        if len(items) > EXAMPLES:
            out.append(f"- … and {len(items) - EXAMPLES} more")
        out.append("")
    return "\n".join(out)


def main():
    ladder = load_ladder()
    sidecars = load_sidecars()
    with open(os.path.join(REPORTS_DIR, "ladder-report.md"), "w", encoding="utf-8") as f:
        f.write(render(ladder, sidecars, load_names()))
    for key, count in content_breaks(ladder, sidecars).items():
        print(f"  {key}: {count}")
    print("Wrote reports/ladder-report.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
