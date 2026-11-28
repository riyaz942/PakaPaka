# -*- coding: utf-8 -*-
"""The ladder report: what `_build/ladder.json` puts at each level, and what
content the ladder breaks (docs/superpowers/specs/2026-11-18-level-ladder-design.md
§7.6, §7.7).

It prints level 1's radicals and kanji, the size of every level, the JLPT rows,
the rule-2 breaches (must be zero), the radicals no kanji uses, and the
`content_breaks` counts with the first examples of each. Later tasks read
`content_breaks` as their "done" check.

A sentence is "above level" when one of its `vocabulary_slugs` sits at a level
after its owner's. `vocab_mnemonics_without_kanji` counts the words whose mnemonic does not name
every kanji of the word; `kanji_mnemonics_radical_mismatch` the kanji whose
mnemonic names a radical nobody teaches by that name, or teaches later; and
`radical_mnemonics_part_later` the radicals built from a part taught later
(`mnemonic_gaps.py`; names are matched as text). A point with no pool sentences (the conjugation primer)
is not counted as under 2 readable.

`grammar_points_failing_pool` is every point `check_grammar_pool` fails.
`grammar_mnemonics_above_level` is every grammar mnemonic whose Japanese example
uses a word above the point's level (the check `validate_grammar` runs on a new
mnemonic). Both run the tokenizer, so the report takes a few minutes.

Also writes `ladder-worklist.json`: the full slug list of each content area, from
the same lists as the counts above. The content lanes take their slugs from it.
It is computed on every run and holds no marks.

Reads only; always exits 0. Writes curriculum/_build/reports/ladder-report.md and
ladder-worklist.json.
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
#: Levels 2 to TARGET_LEVEL need this many reading passages each.
PASSAGES_PER_LEVEL = 3
EXAMPLES = 10

#: content_breaks key -> (type, what breaks, when): the spec §7.6 columns.
BREAKS = {
    "grammar_sentences_above_level": (
        "Grammar", "Example sentences that use a word above the point's level "
        "(`grammar/pool.json`)", "Before release"),
    "grammar_points_under_2_readable": (
        "Grammar", "Points with fewer than 2 example sentences that use only words at or "
        "below the point's level", "Before release"),
    "grammar_points_failing_pool": (
        "Grammar", "Points that fail the sentence pool gate (`check_grammar_pool`)",
        "Before release"),
    "grammar_points_linked_above_level": (
        "Grammar", "Points whose linked words (`vocabulary_slugs`) include a word above "
        "the point's level", "Before release"),
    "grammar_mnemonics_above_level": (
        "Grammar", "Mnemonics whose Japanese example uses a word above the point's level "
        "(`grammar/mnemonics.json`)", "Before release"),
    "vocab_sentences_above_level": (
        "Vocabulary", "Example sentences that use a word above the word's level "
        "(`vocabulary/examples.json`)", "Later phase"),
    "vocab_mnemonics_without_kanji": (
        "Vocabulary", "Mnemonics that do not name every kanji of the word", "Later phase"),
    "kanji_mnemonics_radical_mismatch": (
        "Kanji", "Mnemonics that name a radical no radical is called, or one taught at a "
        "later level than the kanji", "Before release"),
    "radical_mnemonics_part_later": (
        "Radicals", "Mnemonics built from a part radical taught at a later level",
        "Before release"),
    "kanji_1_20_without_mnemonic": (
        "Kanji", "Kanji in levels 1-20 with no mnemonic", "Before release"),
    "radicals_1_20_without_mnemonic": (
        "Radicals", "Radicals in levels 1-20 with no mnemonic", "Before release"),
    "reading_levels_short": (
        "Passages", f"Levels 2-{TARGET_LEVEL} with fewer than {PASSAGES_PER_LEVEL} passages",
        "Before release"),
    "passages_above_target": (
        "Passages", "Passages above level 20", "Before release"),
}


def short_levels(ladder):
    """[(level, passages missing)] for levels 2 to TARGET_LEVEL with fewer than
    PASSAGES_PER_LEVEL passages."""
    counts = defaultdict(int)
    for entry in ladder["passage"].values():
        counts[entry["level"]] += 1
    return [(n, PASSAGES_PER_LEVEL - counts[n]) for n in range(2, TARGET_LEVEL + 1)
            if counts[n] < PASSAGES_PER_LEVEL]


def break_lists(ladder, sidecars):
    """{content_breaks key: [(owner level, owner slug, text)]}, sorted."""
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
                    found[key].append((n, slug, f"{slug}: {s['japanese']} — {', '.join(words)}"))
                else:
                    readable += 1
            if kind == "grammar" and readable < 2:
                found["grammar_points_under_2_readable"].append(
                    (n, slug, f"{slug}: {readable} of {len(entry[field])} readable"))

    sentences("grammar_sentences_above_level", "grammar", sidecars["grammar_pool"], "sentences")
    sentences("vocab_sentences_above_level", "vocabulary", sidecars["vocab_examples"],
              "example_sentences")
    for slug, slugs in sidecars["grammar_links"].items():
        words = later_words(slugs, level("grammar", slug))
        if words:
            found["grammar_points_linked_above_level"].append(
                (level("grammar", slug), slug, f"{slug}: {', '.join(words)}"))
    for slug in sidecars["grammar_pool_failing"]:
        found["grammar_points_failing_pool"].append((level("grammar", slug), slug, slug))
    for slug, words in sidecars["grammar_mnemonics_above"].items():
        found["grammar_mnemonics_above_level"].append(
            (level("grammar", slug), slug, f"{slug}: {', '.join(words)}"))
    for n, missing in short_levels(ladder):
        found["reading_levels_short"].append((n, str(n), f"{missing} of {PASSAGES_PER_LEVEL} missing"))
    for key, kind, sidecar in (("vocab_mnemonics_without_kanji", "vocabulary", "vocab_kanji_unnamed"),
                               ("kanji_mnemonics_radical_mismatch", "kanji", "kanji_radical_mismatch"),
                               ("radical_mnemonics_part_later", "radical", "radical_part_later")):
        for slug in sidecars[sidecar]:
            found[key].append((level(kind, slug), slug, slug))
    for key, kind, mnemonics in (("kanji_1_20_without_mnemonic", "kanji", "kanji_mnemonics"),
                                 ("radicals_1_20_without_mnemonic", "radical",
                                  "radical_mnemonics")):
        for slug, entry in ladder[kind].items():
            if entry["level"] <= TARGET_LEVEL and not sidecars[mnemonics].get(slug):
                found[key].append((entry["level"], slug, slug))
    for slug, entry in ladder["passage"].items():
        if entry["level"] > TARGET_LEVEL:
            found["passages_above_target"].append((entry["level"], slug, slug))
    return {key: sorted(items) for key, items in found.items()}


def content_breaks(ladder, sidecars):
    """{key: count} for every key in BREAKS."""
    return {key: len(items) for key, items in break_lists(ladder, sidecars).items()}


#: worklist area -> the content_breaks key whose owners it lists.
WORKLIST = {
    "radical_mnemonics": "radicals_1_20_without_mnemonic",
    "kanji_mnemonics": "kanji_1_20_without_mnemonic",
    "radical_mnemonics_part_later": "radical_mnemonics_part_later",
    "kanji_mnemonics_radical_mismatch": "kanji_mnemonics_radical_mismatch",
    "grammar_pool_points": "grammar_points_failing_pool",
    "grammar_links_above_level": "grammar_points_linked_above_level",
    "grammar_mnemonics_above_level": "grammar_mnemonics_above_level",
    "reading_passages": "reading_levels_short",
    "vocab_examples_above_level": "vocab_sentences_above_level",
    "vocab_mnemonics_pending": "vocab_mnemonics_without_kanji",
}


def worklist(ladder, sidecars):
    """{area: [slug]} (reading_passages: [{level, missing}]), every owner once,
    in level order. The count of an area equals its content_breaks count, except
    vocab_examples_above_level: the report counts sentences, this lists words."""
    lists = break_lists(ladder, sidecars)
    work = {}
    for area, key in WORKLIST.items():
        work[area] = list(dict.fromkeys(slug for _, slug, _ in lists[key]))
    work["reading_passages"] = [{"level": n, "missing": missing}
                                for n, missing in short_levels(ladder)]
    return work


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def grammar_mnemonics_above(mnemonics_path):
    """{slug: words above the point's level} for the stored grammar mnemonics."""
    from generate_content import validate_mnemonics

    found = {}
    for slug, entry in load(mnemonics_path).items():
        words = validate_mnemonics.grammar_example_violations(slug, entry.get("mnemonic_text"))
        if words:
            found[slug] = words
    return found


def load_sidecars():
    import mnemonic_gaps
    from n4_grammar import N4_GRAMMAR
    from n5_grammar import N5_GRAMMAR
    from generate_content import check_grammar_pool as pool_check

    def path(*parts):
        return os.path.join(CURRICULUM_DIR, *parts)

    ladder = load_ladder()
    radical_items = load(path("radicals", "items.json"))["items"]
    vocab_items = load(path("vocabulary", "items.json"))["items"]
    vocab_mnemonics = load(path("vocabulary", "mnemonics.json"))
    kanji_mnemonics = load(path("kanji", "mnemonics.json"))
    radical_mnemonics = load(path("radicals", "mnemonics.json"))
    return {
        "grammar_pool": load(path("grammar", "pool.json")),
        "grammar_links": {g["slug"]: g["vocabulary_slugs"] for g in N5_GRAMMAR + N4_GRAMMAR},
        "vocab_examples": load(path("vocabulary", "examples.json")),
        "vocab_mnemonics": vocab_mnemonics,
        "kanji_mnemonics": kanji_mnemonics,
        "radical_mnemonics": radical_mnemonics,
        "grammar_mnemonics": load(path("grammar", "mnemonics.json")),
        "radical_part_later": mnemonic_gaps.radicals_with_later_part(
            ladder, radical_items, radical_mnemonics),
        "kanji_radical_mismatch": mnemonic_gaps.kanji_with_unknown_radical(
            ladder, radical_items, kanji_mnemonics),
        "vocab_kanji_unnamed": mnemonic_gaps.vocab_missing_kanji(
            ladder, load(path("kanji", "items.json"))["items"], vocab_items, vocab_mnemonics),
        "grammar_pool_failing": pool_check.failing_slugs(),
        "grammar_mnemonics_above": grammar_mnemonics_above(path("grammar", "mnemonics.json")),
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
    out += ["## Work lists\n",
            "The full lists are in `ladder-worklist.json`. "
            "`vocab_examples_above_level` counts words; the Content breaks table "
            "counts sentences.\n",
            "| Area | Count |", "| --- | ---: |"]
    out += [f"| `{area}` | {len(slugs)} |" for area, slugs in worklist(ladder, sidecars).items()]
    out.append("")
    for key, items in lists.items():
        out.append(f"### `{key}` ({len(items)})\n")
        if not items:
            out.append("None.\n")
            continue
        out += [f"- level {n}: {text}" for n, _, text in items[:EXAMPLES]]
        if len(items) > EXAMPLES:
            out.append(f"- … and {len(items) - EXAMPLES} more")
        out.append("")
    return "\n".join(out)


def main():
    ladder = load_ladder()
    sidecars = load_sidecars()
    with open(os.path.join(REPORTS_DIR, "ladder-report.md"), "w", encoding="utf-8") as f:
        f.write(render(ladder, sidecars, load_names()))
    with open(os.path.join(REPORTS_DIR, "ladder-worklist.json"), "w", encoding="utf-8") as f:
        json.dump(worklist(ladder, sidecars), f, ensure_ascii=False, indent=2)
        f.write("\n")
    for key, count in content_breaks(ladder, sidecars).items():
        print(f"  {key}: {count}")
    print("Wrote reports/ladder-report.md and reports/ladder-worklist.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
