# -*- coding: utf-8 -*-
"""Give every radical, kanji, word, grammar point and passage a level 1..60.

Writes `_build/ladder.json` (read through `levels.load_ladder()`). Rules
(docs/superpowers/specs/2026-11-18-level-ladder-design.md §7.2):

1. Kanji go greedily: the next kanji completes the most still-waiting words (a
   word waits until all its kanji are placed); ties: the number of waiting words
   it appears in, then the frequency rank of the first word it appears in, then
   slug. The order is cut by KANJI_PER_LEVEL. A kanji override takes its slot at
   its level ahead of the greedy pick.
2. A radical files at the lowest level of a kanji that uses it.
3. A word's level is the later of its last kanji and its frequency slot:
   authored words spread over levels 1-20 in list order, derived words over
   21-60 by rank. Kana-only words use the slot.
4. Grammar keeps its teaching order: core (N5+N4) over 1-20, N3 over 21-25.
5. A passage files at the highest level of its words and grammar.
6. `levels.json` overrides win for every kind. A kanji before one of its
   radicals, or a word before one of its kanji, is a breach; main() exits 1.

`jlpt_equivalence` is display only (§7.5): the first level at which 90% of a
JLPT list's kanji, words and grammar (each separately) sit at or below it.

Run (from anywhere):
    curriculum/_build/.venv/bin/python curriculum/_build/ladder.py
"""

import json
import os
import sys
from collections import defaultdict

BUILD_DIR = os.path.dirname(os.path.abspath(__file__))
CURRICULUM_DIR = os.path.dirname(BUILD_DIR)
sys.path.insert(0, BUILD_DIR)

from levels import KINDS, LADDER_PATH, MAX_LEVEL, load_overrides  # noqa: E402

#: Kanji per level: 18, 24, 28, then 30 up to level 20, then the rest of the
#: 2,000-kanji corpus over levels 21-60 (1,420 = 20 x 36 + 20 x 35).
KANJI_PER_LEVEL = [18, 24, 28] + [30] * 17 + [36] * 20 + [35] * 20

#: (first, last) level each spread covers.
AUTHORED_WORD_LEVELS = (1, 20)
DERIVED_WORD_LEVELS = (21, MAX_LEVEL)
GRAMMAR_LEVELS = {"core": (1, 20), "n3": (21, 25)}


def spread(n, first, last):
    """Level of each of n items in order: first + floor(i * span / n)."""
    span = last - first + 1
    return [first + i * span // n for i in range(n)]


def order_kanji(kanji, words, overrides):
    """{slug: level} and the pick order, greedy per rule 1."""
    sizes = KANJI_PER_LEVEL
    if sum(sizes) != len(kanji):
        raise ValueError(f"KANJI_PER_LEVEL sums to {sum(sizes)}; the corpus has "
                         f"{len(kanji)} kanji")
    remaining = {}  # word slug -> its kanji not placed yet
    words_of = defaultdict(list)
    first_rank = {}
    for rank, w in enumerate(words):
        ks = set(w["kanji"])
        if not ks:
            continue
        remaining[w["slug"]] = ks
        for k in ks:
            words_of[k].append(w["slug"])
            first_rank.setdefault(k, rank)
    # A word that waits on k cannot complete before k is placed, so the
    # waiting count of an unplaced kanji never changes; only completes does.
    waiting = {k["slug"]: len(words_of[k["slug"]]) for k in kanji}
    completes = defaultdict(int)
    for ks in remaining.values():
        if len(ks) == 1:
            completes[next(iter(ks))] += 1

    unplaced = {k["slug"] for k in kanji}
    level_of, picks = {}, []

    def place(slug, level):
        unplaced.discard(slug)
        level_of[slug] = level
        picks.append(slug)
        for w in words_of[slug]:
            ks = remaining[w]
            ks.discard(slug)
            if len(ks) == 1:
                completes[next(iter(ks))] += 1

    for level, size in enumerate(sizes, start=1):
        pinned = sorted(s for s, lv in overrides.items() if lv == level)
        for slug in pinned:
            place(slug, level)
        for _ in range(size - len(pinned)):
            pool = unplaced - set(overrides)
            if not pool:
                break
            place(min(pool, key=lambda s: (-completes[s], -waiting[s],
                                           first_rank.get(s, len(words)), s)), level)
    return level_of, picks


def build_ladder(kanji, words, grammar, passages, overrides, reference):
    """The ladder: {kind: {slug: {level, sort_order}}}, jlpt_equivalence, breaches.

    `reference` is `jlpt_reference.json`: {"N5"|"N4": {kind: [slug]}}."""
    for kind, items in (("kanji", kanji), ("vocabulary", words),
                        ("grammar", grammar), ("passage", passages)):
        unknown = sorted(set(overrides.get(kind, {})) - {i["slug"] for i in items})
        if unknown:
            raise ValueError(f"levels.json names unknown {kind}: {', '.join(unknown)}")
    radical_slugs = {r for k in kanji for r in k["radicals"]}
    unknown = sorted(set(overrides.get("radical", {})) - radical_slugs)
    if unknown:
        raise ValueError(f"levels.json names unknown radical: {', '.join(unknown)}")

    kanji_level, picks = order_kanji(kanji, words, overrides.get("kanji", {}))
    radicals_of = {k["slug"]: k["radicals"] for k in kanji}

    # (level, sort key) per slug; sort_order is the rank of the key in its level.
    keyed = {kind: {} for kind in KINDS}
    for i, slug in enumerate(picks):
        keyed["kanji"][slug] = (kanji_level[slug], i)
        for j, r in enumerate(radicals_of[slug]):
            if r not in keyed["radical"]:
                keyed["radical"][r] = (kanji_level[slug], (i, j))

    authored = [w for w in words if w["authored"]]
    derived = [w for w in words if not w["authored"]]
    slots = (spread(len(authored), *AUTHORED_WORD_LEVELS)
             + spread(len(derived), *DERIVED_WORD_LEVELS))
    for i, (w, slot) in enumerate(zip(authored + derived, slots)):
        level = max([slot] + [kanji_level[k] for k in w["kanji"]])
        keyed["vocabulary"][w["slug"]] = (level, i)

    for tier, (first, last) in GRAMMAR_LEVELS.items():
        points = [(i, g) for i, g in enumerate(grammar) if g["tier"] == tier]
        for (i, g), level in zip(points, spread(len(points), first, last)):
            keyed["grammar"][g["slug"]] = (level, i)

    for kind in ("radical", "kanji", "vocabulary", "grammar"):
        for slug, level in overrides.get(kind, {}).items():
            keyed[kind][slug] = (level, keyed[kind][slug][1])

    def level(kind, slug):
        return keyed[kind][slug][0]

    for i, p in enumerate(passages):
        keyed["passage"][p["slug"]] = (max(
            [level("vocabulary", s) for s in p["vocabulary"]]
            + [level("grammar", s) for s in p["grammar"]]
        ), i)
    for slug, lv in overrides.get("passage", {}).items():
        keyed["passage"][slug] = (lv, keyed["passage"][slug][1])

    breaches = []
    for slug in picks:
        for r in radicals_of[slug]:
            if level("kanji", slug) < level("radical", r):
                breaches.append(f"kanji {slug} (level {level('kanji', slug)}) comes "
                                f"before its radical {r} (level {level('radical', r)})")
    for w in words:
        for k in w["kanji"]:
            if level("vocabulary", w["slug"]) < level("kanji", k):
                breaches.append(f"vocabulary {w['slug']} (level "
                                f"{level('vocabulary', w['slug'])}) comes before its "
                                f"kanji {k} (level {level('kanji', k)})")

    result = {}
    for kind in KINDS:
        entries = keyed[kind]
        ranked = sorted(entries, key=lambda s: entries[s])
        result[kind] = {}
        count = defaultdict(int)
        for slug in ranked:
            count[entries[slug][0]] += 1
            result[kind][slug] = {"level": entries[slug][0],
                                  "sort_order": count[entries[slug][0]]}

    def level_at_90_percent(kind, slugs):
        levels = sorted(result[kind][s]["level"] for s in slugs)
        return levels[-(-len(levels) * 9 // 10) - 1]  # ceil(90%) at or below

    equivalence = []
    first = 1
    for jlpt in ("N5", "N4"):
        last = max(level_at_90_percent(kind, slugs)
                   for kind, slugs in reference[jlpt].items())
        equivalence.append({"jlpt": jlpt, "first_level": first, "last_level": last})
        first = last + 1
    result["jlpt_equivalence"] = equivalence
    result["breaches"] = breaches
    return result


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_kanji():
    """Every kanji (the N5/N4 datasets, then the derived skeleton) with its
    radical slugs from the KanjiVG decomposition, keyed by form."""
    from n4_kanji import N4_KANJI
    from n4_radicals import N4_RADICALS
    from n5_kanji import N5_KANJI
    from n5_radicals import N5_RADICALS

    decomposition = load(os.path.join(BUILD_DIR, "decomposition.json"))
    by_form = {r["form"]: r["slug"] for r in decomposition["radicals"]}
    for r in list(N5_RADICALS) + list(N4_RADICALS):
        by_form.setdefault(r["form"], r["slug"])
    skeleton = load(os.path.join(BUILD_DIR, "skeleton.json"))
    return [
        {"slug": k["slug"], "form": k["char"],
         "radicals": list(dict.fromkeys(
             by_form[f] for f in decomposition["decomposition"][k["char"]]))}
        for k in list(N5_KANJI) + list(N4_KANJI) + skeleton["kanji"]
    ]


def load_words(kanji):
    """The authored N5 list, then N4, then the derived words by rank (the
    order `generate._vocab_sources()` gives)."""
    from n4_vocab import N4_VOCAB
    from n5_vocab import N5_VOCAB

    slug_of = {k["form"]: k["slug"] for k in kanji}
    derived = load(os.path.join(BUILD_DIR, "vocab_skeleton.json"))["words"]
    sources = [(True, N5_VOCAB), (True, N4_VOCAB)] + [
        (False, [w for w in derived if w["level"] == level])
        for level in ("n3", "n2", "n1")
    ]
    return [
        {"slug": w["slug"], "authored": authored,
         "kanji": list(dict.fromkeys(slug_of[ch] for ch in w["form"] if ch in slug_of))}
        for authored, entries in sources for w in entries
    ]


def main():
    from n4_readings import N4_READINGS
    from n5_readings import N5_READINGS

    reference = load(os.path.join(BUILD_DIR, "jlpt_reference.json"))
    pool = load(os.path.join(CURRICULUM_DIR, "grammar", "pool.json"))
    grammar = [
        {"slug": slug, "tier": tier,
         "examples": [s["vocabulary_slugs"] for s in pool.get(slug, {}).get("sentences", [])]}
        for tier, lists in (("core", ("N5", "N4")), ("n3", ("N3",)))
        for jlpt in lists for slug in reference[jlpt]["grammar"]
    ]
    passages = [
        {"slug": p["slug"], "vocabulary": p["vocabulary_slugs"], "grammar": p["grammar_slugs"]}
        for p in list(N5_READINGS) + list(N4_READINGS)
    ]
    kanji = load_kanji()
    result = build_ladder(
        kanji, load_words(kanji), grammar, passages,
        {kind: load_overrides(kind) for kind in KINDS},
        {jlpt: reference[jlpt] for jlpt in ("N5", "N4")},
    )
    with open(LADDER_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
        f.write("\n")

    counts = defaultdict(int)
    for entry in result["kanji"].values():
        counts[entry["level"]] += 1
    for level in range(1, MAX_LEVEL + 1):
        print(f"  level {level}: {counts[level]} kanji")
    for row in result["jlpt_equivalence"]:
        print(f"  {row['jlpt']}: levels {row['first_level']}-{row['last_level']}")
    for breach in result["breaches"]:
        print(f"  breach: {breach}")
    print(f"Wrote {os.path.relpath(LADDER_PATH, CURRICULUM_DIR)}")
    return 1 if result["breaches"] else 0


if __name__ == "__main__":
    sys.exit(main())
