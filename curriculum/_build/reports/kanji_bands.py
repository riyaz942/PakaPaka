# -*- coding: utf-8 -*-
"""Assign every kanji and radical to a level band (plan v2 Phase A).

A band is a **teaching budget**, not a coverage gate: the set of kanji taught at
a level, chosen for how many of that level's own words they unlock. Words
outside the budget are still taught — meaning first — so nothing is withheld by
being out of band.

    | level | kanji added | cumulative |
    | n5    |         150 |        150 |
    | n4    |         150 |        300 |
    | n3    |         400 |        700 |
    | n2    |         300 |      1,000 |
    | n1    |       1,000 |      2,000 |

**Ranking is by corpus reuse, not by the JLPT kanji list.** The exam list is
blind to the word list this app ships, so it spends slots on kanji that unlock
nothing. For each kanji, count the words *of that level* it appears in; take the
top N; tie-break by KANJIDIC grade so equally useful kanji arrive easy-first.
The consequence, accepted deliberately: the level a kanji sits at is this app's
ladder, not the exam's. 百 and 東 are N5 on the exam and unlock two words each
here, so they wait.

N3/N2/N1 have no vocabulary of their own yet (plan Phase D), so nothing can
measure reuse for them. They fall back to KANJIDIC frequency rank — the order a
reader actually meets them in text.

**Sort order inside a band.** Kanji the hand-authored N5/N4 datasets already
place keep their curated order; the plan puts re-ordering N5/N4 out of scope.
An incoming kanji is inserted at the position of the earliest word that needs
it, which is the same first-encounter rule `kanji_priority.py` ranks by. Level
order for N3+ is frequency order.

**Radicals are derived, not chosen.** Each files at the level of the first kanji
that needs it, so the split falls out of the decomposition rather than a list
anybody maintains.

Writes:
  curriculum/_build/bands.json           — read by generate.py
  curriculum/_build/reports/kanji-bands.{md,json}

Reads only checked-in data — no EDRDG archives. Run (from anywhere):
    python3 curriculum/_build/reports/kanji_bands.py
"""

import json
import os
import sys
from collections import defaultdict

REPORTS_DIR = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR = os.path.dirname(REPORTS_DIR)
CURRICULUM_DIR = os.path.dirname(BUILD_DIR)

sys.path.insert(0, BUILD_DIR)

from generate_deps import N4_DECOMPOSITION, N5_DECOMPOSITION  # noqa: E402

#: The ladder. Sums to the 2,000 `import/build_skeleton.py` derives.
BAND_SIZES = {"n5": 150, "n4": 150, "n3": 400, "n2": 300, "n1": 1000}
LEVELS = ["n5", "n4", "n3", "n2", "n1"]

#: Levels with vocabulary of their own, and so the only ones reuse can rank.
VOCAB_LEVELS = ["n5", "n4"]


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_corpus():
    """Every kanji on the ladder: {slug: {char, source, grade, freq, order}}.

    `source` is the dataset that defines it — `n5`/`n4` for the hand-authored
    lists, `k` for the derived corpus. It is not a level and never moves; the
    band is the level.  `order` is the position inside its own source dataset,
    which is the curated teaching order for n5/n4 and frequency order for k."""
    from n4_kanji import N4_KANJI
    from n5_kanji import N5_KANJI

    corpus = {}
    for source, entries in (("n5", N5_KANJI), ("n4", N4_KANJI)):
        for i, k in enumerate(entries, start=1):
            corpus[f"{source}-{k['suffix']}"] = {
                "char": k["char"],
                "meaning": k["meaning"],
                "source": source,
                "order": i,
                "grade": None,
                "freq": None,
            }
    skeleton = load(os.path.join(BUILD_DIR, "skeleton.json"))
    for i, k in enumerate(skeleton["kanji"], start=1):
        corpus[k["slug"]] = {
            "char": k["char"],
            "meaning": k["meaning"],
            "source": "k",
            "order": i,
            "grade": k.get("grade"),
            "freq": k.get("freq"),
        }
    return corpus, skeleton


def load_vocabulary():
    """{level: [(sort_order, primary_form)]} for the levels that have words."""
    words = {}
    for level in VOCAB_LEVELS:
        items = load(os.path.join(CURRICULUM_DIR, "vocabulary", f"{level}.json"))["items"]
        words[level] = [(v["sort_order"], v["primary_form"]) for v in items]
    return words


def reuse_and_encounter(chars, words):
    """(reuse, first_encounter) per char over one level's word list.

    reuse is how many of the level's words the kanji appears in — the number the
    band is ranked on. first_encounter is the sort_order of the earliest of
    them, which is where an incoming kanji has to sit to arrive in time."""
    reuse = defaultdict(int)
    first = {}
    for sort_order, form in words:
        for ch in set(form):
            if ch not in chars:
                continue
            reuse[ch] += 1
            if ch not in first or sort_order < first[ch]:
                first[ch] = sort_order
    return reuse, first


def assign_bands(corpus, words):
    """{slug: level}, plus the per-level reuse map the report prints."""
    remaining = dict(corpus)
    bands = {}
    reuse_by_level = {}
    encounter_by_level = {}
    for level in LEVELS:
        size = BAND_SIZES[level]
        chars = {info["char"]: slug for slug, info in remaining.items()}
        if level in VOCAB_LEVELS:
            reuse, first = reuse_and_encounter(set(chars), words[level])
            ranked = sorted(
                remaining,
                key=lambda s: (
                    -reuse[remaining[s]["char"]],
                    remaining[s]["grade"] or 99,
                    remaining[s]["freq"] or 99999,
                    remaining[s]["char"],
                ),
            )
        else:
            # No words at this level yet, so nothing to rank reuse on. Frequency
            # rank is the honest fallback: the order a reader meets them in.
            reuse, first = defaultdict(int), {}
            ranked = sorted(
                remaining,
                key=lambda s: (
                    remaining[s]["freq"] or 99999,
                    remaining[s]["grade"] or 99,
                    remaining[s]["char"],
                ),
            )
        taken = ranked[:size]
        if len(taken) < size:
            raise SystemExit(
                f"band {level} wants {size} kanji, only {len(taken)} left in the corpus"
            )
        for slug in taken:
            bands[slug] = level
            del remaining[slug]
        reuse_by_level[level] = {s: reuse[corpus[s]["char"]] for s in taken}
        encounter_by_level[level] = {
            s: first.get(corpus[s]["char"]) for s in taken
        }
    if remaining:
        raise SystemExit(f"{len(remaining)} kanji fit no band; BAND_SIZES is short")
    return bands, reuse_by_level, encounter_by_level


def kanji_sort_orders(corpus, bands, encounter_by_level):
    """{slug: sort_order} — 1..N inside each band.

    A kanji whose own dataset already sits at this level keeps its curated
    position. An incoming one is keyed to just before the earliest word that
    needs it, on the same scale: `ROUND_QUOTAS` gives radicals, kanji and
    vocabulary two lesson slots each per round, so kanji #40 and word #40 reach
    the learner at about the same time."""
    order = {}
    for level in LEVELS:
        members = [s for s in bands if bands[s] == level]
        keyed = []
        for slug in members:
            info = corpus[slug]
            if info["source"] == level:
                keyed.append((info["order"], 1, slug))
            else:
                met = encounter_by_level[level].get(slug)
                if met is None:
                    # No word at this level needs it — N3+ bands, and the tail
                    # of an N5/N4 band if vocabulary ever stops covering it.
                    # Frequency order, after everything with a real position.
                    keyed.append((float("inf"), info["order"], slug))
                else:
                    # Half a step ahead of the word, so the component is offered
                    # first when both land in the same round.
                    keyed.append((met - 0.5, 0, slug))
        keyed.sort()
        for i, (_key, _tie, slug) in enumerate(keyed, start=1):
            order[slug] = i
    return order


def load_radicals(skeleton):
    """{slug: {form, meaning, source, order, prose, art}}.

    `prose` is a mnemonic from either the dataset or the sidecar; `art` is the
    bundled image, which only the hand-authored datasets carry. The two are
    separate because a radical with prose and no image renders as text, which is
    a shipped state, not a gap."""
    from n4_radicals import N4_RADICALS
    from n5_radicals import N5_RADICALS

    def sidecar(source):
        path = os.path.join(CURRICULUM_DIR, "radicals", "mnemonics", f"{source}.json")
        return load(path) if os.path.exists(path) else {}

    radicals = {}
    for source, entries in (("n5", N5_RADICALS), ("n4", N4_RADICALS), ("k", None)):
        entries = skeleton["radicals"] if entries is None else entries
        written = sidecar(source)
        for i, r in enumerate(entries, start=1):
            radicals[r["slug"]] = {
                "form": r["form"],
                "meaning": r["meaning"],
                "source": source,
                "order": i,
                "prose": bool(r.get("mnemonic")
                              or written.get(r["slug"], {}).get("mnemonic_text")),
                "art": bool(r.get("mnemonic")),
            }
    return radicals


def decomposition(skeleton):
    """{radical slug: [kanji slug]} over the whole corpus.

    Three sources, one shape: the two curated N5/N4 maps in `generate_deps.py`,
    keyed by kanji suffix, and the derived map in `skeleton.json`, already keyed
    by slug."""
    edges = defaultdict(list)
    for source, curated in (("n5", N5_DECOMPOSITION), ("n4", N4_DECOMPOSITION)):
        for rad_slug, suffixes in curated.items():
            for suffix in suffixes:
                edges[rad_slug].append(f"{source}-{suffix}")
    for rad_slug, kanji_slugs in skeleton["decomposition"].items():
        edges[rad_slug].extend(kanji_slugs)
    return edges


def radical_bands(radicals, edges, bands, kanji_order):
    """A radical files at the level of the first kanji that needs it.

    Derived, not chosen — and it is the one rule that keeps a component from
    being studied after the kanji it builds."""
    rank = {level: i for i, level in enumerate(LEVELS)}
    first = {}
    for rad_slug, kanji_slugs in edges.items():
        if rad_slug not in radicals:
            raise SystemExit(f"decomposition names unknown radical {rad_slug!r}")
        for kanji_slug in kanji_slugs:
            if kanji_slug not in bands:
                raise SystemExit(
                    f"radical {rad_slug!r} builds unknown kanji {kanji_slug!r}"
                )
            key = (rank[bands[kanji_slug]], kanji_order[kanji_slug])
            if rad_slug not in first or key < first[rad_slug][0]:
                first[rad_slug] = (key, kanji_slug)
    levels = {slug: LEVELS[key[0]] for slug, (key, _k) in first.items()}
    keys = {slug: key for slug, (key, _k) in first.items()}
    # Four N5/N4 radicals decompose no kanji at all (bou, hidari, iwaku,
    # koromohen). They predate the decomposition sweep and nothing has claimed
    # them since. With no kanji to file behind, they keep the level whoever
    # wrote them chose, and sort after everything that has a real position.
    for slug, info in radicals.items():
        if slug not in levels:
            if info["source"] not in LEVELS:
                raise SystemExit(f"derived radical {slug!r} builds no kanji")
            levels[slug] = info["source"]
            keys[slug] = (LEVELS.index(info["source"]), float("inf"), info["order"])
    order = {}
    for level in LEVELS:
        members = sorted(
            (s for s in levels if levels[s] == level),
            key=lambda s: (keys[s], s),
        )
        for i, slug in enumerate(members, start=1):
            order[slug] = i
    return levels, order, {s: k for s, (_key, k) in first.items()}


def render_markdown(corpus, bands, kanji_order, reuse_by_level, radicals,
                    radical_levels, radical_order, radical_first, words):
    out = []
    out.append("# Kanji bands (plan v2 Phase A)\n")
    out.append("Generated by `curriculum/_build/reports/kanji_bands.py`. "
               "Do not edit by hand.\n")
    out.append("A band is a teaching budget, not a coverage gate. Kanji outside a "
               "learner's band still appear in words — the word is asked for its "
               "meaning until every kanji in it reaches guru.\n")

    out.append("## Band sizes\n")
    out.append("| Level | Kanji | Cum. | Radicals | Rad. cum. | Reuse floor |")
    out.append("| --- | ---: | ---: | ---: | ---: | ---: |")
    cum = rad_cum = 0
    for level in LEVELS:
        n = sum(1 for s in bands if bands[s] == level)
        r = sum(1 for s in radical_levels if radical_levels[s] == level)
        cum += n
        rad_cum += r
        floor = min(reuse_by_level[level].values()) if reuse_by_level[level] else 0
        out.append(f"| {level.upper()} | {n} | {cum} | {r} | {rad_cum} | {floor} |")
    out.append("")
    out.append("Reuse floor is the fewest same-level words any kanji in the band "
               "appears in. N3+ has no vocabulary yet, so its bands rank on "
               "KANJIDIC frequency and the floor reads 0.\n")

    out.append("## Coverage\n")
    out.append("Words every kanji of which is inside the cumulative band — the "
               "population that gets a reading prompt rather than meaning only.\n")
    banded = set()
    out.append("| After | N5 words | N4 words |")
    out.append("| --- | ---: | ---: |")
    for level in VOCAB_LEVELS:
        banded |= {corpus[s]["char"] for s in bands if bands[s] == level}
        cells = []
        for word_level in VOCAB_LEVELS:
            total = len(words[word_level])
            full = sum(
                1
                for _o, form in words[word_level]
                if all(not is_kanji(ch) or ch in banded for ch in form)
            )
            cells.append(f"{full} ({round(100 * full / total)}%)")
        out.append(f"| {level.upper()} | {cells[0]} | {cells[1]} |")
    out.append("")

    out.append("## Moves\n")
    moved = [s for s in bands if corpus[s]["source"] != bands[s] and corpus[s]["source"] != "k"]
    incoming = [s for s in bands if corpus[s]["source"] == "k" and bands[s] in VOCAB_LEVELS]
    out.append(f"{len(moved)} hand-authored kanji change level; {len(incoming)} derived "
               f"kanji move up into N5/N4.\n")
    out.append("| Kanji | Meaning | Was | Now | Reuse | Prose |")
    out.append("| --- | --- | --- | --- | ---: | --- |")
    for slug in sorted(moved, key=lambda s: (LEVELS.index(bands[s]), kanji_order[s])):
        info = corpus[slug]
        out.append(f"| {info['char']} `{slug}` | {info['meaning']} "
                   f"| {info['source'].upper()} | {bands[slug].upper()} "
                   f"| {reuse_by_level[bands[slug]].get(slug, 0)} | written |")
    out.append("")

    out.append("## Radicals in the N5+N4 band without prose\n")
    in_band = [s for s in radical_levels if radical_levels[s] in VOCAB_LEVELS]
    no_prose = [s for s in in_band if not radicals[s]["prose"]]
    no_art = [s for s in in_band if radicals[s]["prose"] and not radicals[s]["art"]]
    out.append(f"{len(in_band)} radicals file at a level that ships full content. "
               f"{len(no_art)} of them have a mnemonic but no image and render as "
               f"text — a shipped state, not a gap.\n")
    if no_prose:
        out.append("| Radical | Meaning | Level | First needed by |")
        out.append("| --- | --- | --- | --- |")
        for slug in sorted(no_prose, key=lambda s: (LEVELS.index(radical_levels[s]),
                                                    radical_order[s])):
            r = radicals[slug]
            first = corpus[radical_first[slug]]["char"] if slug in radical_first else "—"
            out.append(f"| {r['form']} `{slug}` | {r['meaning']} "
                       f"| {radical_levels[slug].upper()} | {first} |")
    else:
        out.append("Every one of them has a mnemonic.\n")
    out.append("")
    return "\n".join(out)


def is_kanji(ch):
    return "一" <= ch <= "鿿"


def main():
    corpus, skeleton = load_corpus()
    words = load_vocabulary()
    bands, reuse_by_level, encounter_by_level = assign_bands(corpus, words)
    kanji_order = kanji_sort_orders(corpus, bands, encounter_by_level)

    radicals = load_radicals(skeleton)
    edges = decomposition(skeleton)
    radical_levels, radical_order, radical_first = radical_bands(
        radicals, edges, bands, kanji_order
    )

    with open(os.path.join(BUILD_DIR, "bands.json"), "w", encoding="utf-8") as f:
        json.dump({
            "_generated_by": "curriculum/_build/reports/kanji_bands.py",
            "band_sizes": BAND_SIZES,
            # `source` is the dataset that defines the item. It picks the
            # mnemonic sidecar file and the bundled art directory, both of which
            # must stay put when the band moves.
            "kanji": {
                slug: {
                    "level": bands[slug],
                    "sort_order": kanji_order[slug],
                    "source": corpus[slug]["source"],
                }
                for slug in sorted(bands)
            },
            "radicals": {
                slug: {
                    "level": radical_levels[slug],
                    "sort_order": radical_order[slug],
                    "source": radicals[slug]["source"],
                }
                for slug in sorted(radical_levels)
            },
        }, f, ensure_ascii=False, indent=2)
        f.write("\n")

    md = render_markdown(corpus, bands, kanji_order, reuse_by_level, radicals,
                         radical_levels, radical_order, radical_first, words)
    with open(os.path.join(REPORTS_DIR, "kanji-bands.md"), "w", encoding="utf-8") as f:
        f.write(md)
    with open(os.path.join(REPORTS_DIR, "kanji-bands.json"), "w", encoding="utf-8") as f:
        json.dump({
            "band_sizes": BAND_SIZES,
            "kanji": [
                {
                    "slug": slug,
                    "char": corpus[slug]["char"],
                    "meaning": corpus[slug]["meaning"],
                    "source": corpus[slug]["source"],
                    "level": bands[slug],
                    "sort_order": kanji_order[slug],
                    "reuse": reuse_by_level[bands[slug]].get(slug, 0),
                }
                for slug in sorted(bands, key=lambda s: (LEVELS.index(bands[s]),
                                                         kanji_order[s]))
            ],
            "radicals": [
                {
                    "slug": slug,
                    "form": radicals[slug]["form"],
                    "meaning": radicals[slug]["meaning"],
                    "level": radical_levels[slug],
                    "sort_order": radical_order[slug],
                    "first_kanji": (corpus[radical_first[slug]]["char"]
                                    if slug in radical_first else None),
                    "prose": radicals[slug]["prose"],
                    "art": radicals[slug]["art"],
                }
                for slug in sorted(radical_levels,
                                   key=lambda s: (LEVELS.index(radical_levels[s]),
                                                  radical_order[s]))
            ],
        }, f, ensure_ascii=False, indent=2)
        f.write("\n")

    for level in LEVELS:
        n = sum(1 for s in bands if bands[s] == level)
        r = sum(1 for s in radical_levels if radical_levels[s] == level)
        print(f"  {level.upper()}: {n} kanji, {r} radicals")
    print("Wrote bands.json, reports/kanji-bands.md / .json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
