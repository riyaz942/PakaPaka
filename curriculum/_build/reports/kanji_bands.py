# -*- coding: utf-8 -*-
"""Assign every kanji and radical to a level band (plan v2 Phase A).

A band is a **teaching budget**, not a coverage gate: the set of kanji taught at
a level, chosen for how many of that level's own words they unlock. Words
outside the budget are still taught — meaning first — so nothing is withheld by
being out of band.

    | level | kanji added | cumulative |
    | n5    |         150 |        150 |
    | n4    |         175 |        325 |
    | n3    |         375 |        700 |
    | n2    |         300 |      1,000 |
    | n1    |       1,000 |      2,000 |

N4 holds 175 rather than 150 so that all 181 kanji the JLPT tests at N4 fit
inside the N5+N4 bands. The 25 slots come out of N3, which the same shift
relieves, and the ladder still totals 2,000.

**Hand-authored kanji are pinned to their dataset's level.** The N5/N4 curated
lists are the real exam list for those 192 kanji, and a learner expects 水 and
川 at N5 because that is where every course and exam puts them — so `source`
(which dataset defines the kanji: `n5`/`n4`/`k`) doubles as its band for those
two sources; it is never reranked out. This does mean a low-reuse authored
kanji occupies a budget slot a higher-reuse derived kanji could have filled,
which is accepted deliberately: matching the exam's placement matters more
than squeezing every slot for reuse.

**A named handful of derived kanji are pinned the same way.** `PINNED_DERIVED`
below lists personal pronouns (私/僕/君/彼/誰) — real KANJIDIC school grades of
6, 8, or a grade 3 that still loses the reuse race, none of which match where
every JLPT course actually teaches them (N5, day one). Same mechanism as the
authored pin, just keyed by slug instead of by whole dataset.

**The derived (`k`-sourced) corpus ranks by JLPT level first, reuse second.**
Each band's authored count is subtracted from its budget; the remainder is
filled from the still-unplaced derived corpus, sorted by the old-JLPT level
KANJIDIC2 tags (4 easiest, 1 hardest, untagged last), which the skeleton
carries as `jlpt`. Inside one JLPT level the simple kanji go first — school
grade 1-3, see SIMPLE_GRADE — then reuse count, then grade, then frequency.

**Two corrections sit on top of that rank**, because a JLPT tag alone reads
wrong in two directions. `RESERVED_BY_REUSE` hands the first few slots of a
band to the kanji that band's own words lean on hardest, which is how 番 gets
to N5: six N5 words are written with it and the exam still grades it late.
`SIMPLE_GRADE` is the other direction — 雲 皿 貝 虫 丸 黄 才 泳 are grade 1-3
kanji this curriculum writes one word each with, so pure reuse buried them at
N2 behind kanji twice their stroke count. Both corrections act *inside* the
JLPT rank and never across it: no kanji the exam tests at N4 is displaced.

The rank used to be school grade first. Grade is the order Japanese *schooling*
teaches in, and this app teaches to the JLPT, so the two disagree in both
directions: grade-first spent 38 of the 64 derived N4 slots on early-school
kanji no N4 word uses (麦 羽 矢 貝 黄 …) while 58 kanji the JLPT tests at N4
(勉 医 病 薬 銀 館 英 飯 …) were pushed out to N3 and N2. Grade survives as a
tiebreaker, where 犬 and 雪 still beat an equally-JLPT-ranked rarity.

Every level has vocabulary since Phase D, so every band's derived fill can
break ties on reuse. The frequency-rank fallback below stays for the case of
a level whose word list is missing, which is a build in progress rather than
a shipped state.

**Sort order inside a band.** Kanji the hand-authored N5/N4 datasets already
place keep their curated order; the plan puts re-ordering N5/N4 out of scope.
An incoming kanji is inserted at the position of the earliest word that needs
it, which is the same first-encounter rule `kanji_priority.py` ranks by, and a
kanji no word at this level needs sorts after them in frequency order.

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

# Curated N5/N4 decomposition maps are no longer read here; see load_decomposition.

#: The ladder. Sums to the 2,000 `import/build_skeleton.py` derives.
BAND_SIZES = {"n5": 150, "n4": 175, "n3": 375, "n2": 300, "n1": 1000}
LEVELS = ["n5", "n4", "n3", "n2", "n1"]

#: Levels that ship hand-authored prose. The report calls out prose-less items
#: landing in these, because that is the queue Phase E authors against.
AUTHORED_LEVELS = ["n5", "n4"]

#: Levels with vocabulary of their own, and so the only ones reuse can rank.
#: Every level, since plan v2 Phase D derived N3/N2/N1 vocabulary. A word's
#: level is its frequency rank and is decided without reference to kanji, so
#: ranking a band on that level's words is not circular.
VOCAB_LEVELS = LEVELS

#: Derived-corpus kanji pinned to a level by name, ahead of jlpt/reuse
#: ranking. Personal pronouns: every JLPT course teaches them as some of the
#: first N5 words, but KANJIDIC tags them old-JLPT 3 (私), 2 (君/彼), 1 (僕) or
#: nothing at all (誰) — none of which reads as N5. JLPT-first ranking is right
#: for the derived corpus in general; this is the deliberately named exception
#: for words no JLPT course defers.
#: Slots each band fills by its own words' reuse *before* the JLPT rank runs.
#: JLPT rank is right about the exam and blind to this app's word list, so a
#: kanji the exam grades late but N5 leans on hard — 番, which 6 of N5's own
#: words are written with (一番, 番号, 交番, 電話番号 …) — loses to every
#: better-graded kanji and files at N2. The lane is small on purpose: it is a
#: correction for the handful of kanji this curriculum uses far more than the
#: exam expects, not a second ranking.
RESERVED_BY_REUSE = {"n5": 10, "n4": 6}

#: KANJIDIC school grade at or below which a kanji counts as *simple*, and so
#: sorts ahead of the rest of its JLPT tier. Grade 1-3 is the first three years
#: of elementary school: 雲 皿 貝 虫 丸 黄 才 泳 are all in it. Ranking a tier
#: on reuse alone buried them at N2 behind kanji twice their stroke count,
#: because this curriculum happens to write only one word each with them.
#: Simplicity is not a strong enough signal to outrank the exam — it sits
#: *inside* a JLPT tier, never across tiers.
SIMPLE_GRADE = 3

PINNED_DERIVED = {
    "private": "n5",  # 私 watashi — N5 vocabulary word #1 ("I / me")
    "me": "n5",  # 僕 boku — N5 vocabulary word #3
    "mister": "n5",  # 君 kimi — N5 vocabulary word #5
    "he": "n5",  # 彼 kare — N5 vocabulary word #6
    "who": "n5",  # 誰 dare — N5 vocabulary word #27
}


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
            corpus[k["slug"]] = {
                "char": k["char"],
                "meaning": k["meaning"],
                "source": source,
                "order": i,
                "jlpt": None,
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
            "jlpt": k.get("jlpt"),
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


def jlpt_rank(info):
    """0-3 easiest-first from the old-JLPT level, 4 for untagged.

    KANJIDIC2 tags the pre-2010 four-level exam, where 4 is the easiest paper.
    The new ladder is close enough to read straight across at the two ends this
    band ranking cares about: old 4 is today's N5 (103 kanji) and old 3 is
    today's N4 (181). Old 2 splits across N3/N2 and old 1 is N1, which is why
    this is a rank input rather than the level itself."""
    level = info.get("jlpt")
    return 4 - level if level else 4


def reserved_by_reuse(level, remaining, reuse):
    """The slugs this band takes on its own words' reuse, ahead of JLPT rank.

    Only kanji at least one of the level's words is written with are eligible,
    ordered by how many of them, then by JLPT rank so an exam-early kanji wins
    a tie it would have won anyway. Returns at most RESERVED_BY_REUSE[level]."""
    size = RESERVED_BY_REUSE.get(level, 0)
    if not size:
        return []
    eligible = (s for s in remaining if reuse[remaining[s]["char"]])
    return sorted(
        eligible,
        key=lambda s: (
            -reuse[remaining[s]["char"]],
            jlpt_rank(remaining[s]),
            remaining[s]["grade"] or 99,
            remaining[s]["freq"] or 99999,
            remaining[s]["char"],
        ),
    )[:size]


def assign_bands(corpus, words):
    """{slug: level}, plus the per-level reuse map the report prints.

    Hand-authored kanji (`source` in LEVELS) are pinned to their dataset's
    level up front, outside the ranking loop entirely — they never compete for
    a slot and never lose one. PINNED_DERIVED pins a few named derived-corpus
    exceptions the same way. Everything else in the derived corpus is ranked
    by JLPT level then reuse, filling whatever each band's budget has left
    after the pinned count is subtracted — except for the RESERVED_BY_REUSE
    slots at the front, which this level's own words claim outright."""
    bands = {slug: info["source"] for slug, info in corpus.items()
              if info["source"] in LEVELS}
    bands.update(PINNED_DERIVED)
    remaining = {slug: info for slug, info in corpus.items()
                 if slug not in bands}
    reuse_by_level = {}
    encounter_by_level = {}
    for level in LEVELS:
        authored = sum(1 for s in bands if bands[s] == level)
        size = BAND_SIZES[level] - authored
        if size < 0:
            raise SystemExit(
                f"band {level} has {authored} authored kanji, over its "
                f"{BAND_SIZES[level]}-kanji budget"
            )
        chars = {info["char"]: slug for slug, info in remaining.items()}
        if level in VOCAB_LEVELS:
            reuse, first = reuse_and_encounter(set(chars), words[level])
            reserved = reserved_by_reuse(level, remaining, reuse)
            ranked = reserved + [
                s
                for s in sorted(
                    remaining,
                    key=lambda s: (
                        jlpt_rank(remaining[s]),
                        0 if (remaining[s]["grade"] or 99) <= SIMPLE_GRADE else 1,
                        -reuse[remaining[s]["char"]],
                        remaining[s]["grade"] or 99,
                        remaining[s]["freq"] or 99999,
                        remaining[s]["char"],
                    ),
                )
                if s not in reserved
            ]
        else:
            # No words at this level yet, so nothing to rank reuse on. Frequency
            # rank is the honest fallback: the order a reader meets them in.
            reuse, first = defaultdict(int), {}
            ranked = sorted(
                remaining,
                key=lambda s: (
                    jlpt_rank(remaining[s]),
                    remaining[s]["freq"] or 99999,
                    remaining[s]["grade"] or 99,
                    remaining[s]["char"],
                ),
            )
        taken = ranked[:size]
        if len(taken) < size:
            raise SystemExit(
                f"band {level} wants {size} derived kanji, only {len(taken)} "
                f"left in the corpus"
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
    for slug, level in PINNED_DERIVED.items():
        # Never entered the ranking loop, so kanji_sort_orders below would
        # otherwise sort it last (no first-encounter data) instead of at the
        # position its own pinning was meant to fix.
        char = corpus[slug]["char"]
        _, first = reuse_and_encounter({char}, words[level])
        if char in first:
            encounter_by_level[level][slug] = first[char]
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


def load_decomposition():
    """The KanjiVG decomposition: its radical inventory and its kanji map."""
    return load(os.path.join(BUILD_DIR, "decomposition.json"))


def load_radicals(decomposition):
    """{slug: {form, meaning, source, order, prose, art}}.

    `prose` is a mnemonic from either the dataset or the sidecar; `art` is the
    bundled image, which only the hand-authored datasets carry. The two are
    separate because a radical with prose and no image renders as text, which is
    a shipped state, not a gap."""
    from n4_radicals import N4_RADICALS
    from n5_radicals import N5_RADICALS

    sidecar_path = os.path.join(CURRICULUM_DIR, "radicals", "mnemonics.json")
    written = load(sidecar_path) if os.path.exists(sidecar_path) else {}

    radicals = {}
    for source, entries in (("n5", N5_RADICALS), ("n4", N4_RADICALS), ("k", None)):
        entries = decomposition["radicals"] if entries is None else entries
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


def decomposition(decomposition_data, corpus):
    """{radical slug: [kanji slug]} over the whole corpus.

    One source since the KanjiVG switch. `decomposition.json` is keyed by kanji
    *form*, so the corpus supplies the form -> slug join."""
    by_form = {r["form"]: r["slug"] for r in decomposition_data["radicals"]}
    from n4_radicals import N4_RADICALS
    from n5_radicals import N5_RADICALS
    for r in list(N5_RADICALS) + list(N4_RADICALS):
        by_form.setdefault(r["form"], r["slug"])

    edges = defaultdict(list)
    for kanji_slug, info in corpus.items():
        for form in decomposition_data["decomposition"].get(info["char"], ()):
            edges[by_form[form]].append(kanji_slug)
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
               "appears in. A floor of 0 means the band ran out of kanji that "
               "any of its own words use and fell back to frequency rank.\n")

    out.append("## Coverage\n")
    out.append("Words every kanji of which is inside the cumulative band — the "
               "population that gets a reading prompt rather than meaning only.\n")
    banded = set()
    out.append("| After | " + " | ".join(f"{l.upper()} words" for l in VOCAB_LEVELS) + " |")
    out.append("| --- |" + " ---: |" * len(VOCAB_LEVELS))
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
        out.append(f"| {level.upper()} | " + " | ".join(cells) + " |")
    out.append("")

    out.append("## Moves\n")
    moved = [s for s in bands if corpus[s]["source"] != bands[s] and corpus[s]["source"] != "k"]
    incoming = [s for s in bands if corpus[s]["source"] == "k"
                and bands[s] in AUTHORED_LEVELS]
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
    in_band = [s for s in radical_levels if radical_levels[s] in AUTHORED_LEVELS]
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

    decomposition_data = load_decomposition()
    radicals = load_radicals(decomposition_data)
    edges = decomposition(decomposition_data, corpus)
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
