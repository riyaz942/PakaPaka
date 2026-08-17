# -*- coding: utf-8 -*-
"""Authoring order for the skeleton kanji (plan Phase 4).

The 553 N3/N2/N1 kanji shipped by Phase 2 carry meanings, readings and accepted
answers and nothing else. Phase 3 turned their kanji -> vocabulary edges on and
taught the planner to pull them forward, so a learner now *meets* them inside
N5/N4 lessons with no mnemonic. This report says which one to author next.

**Order is by first encounter, not by reuse count.** The plan's Phase 4 sketch
proposed ranking by "how many words each unblocks", written when the model was
still "flip edges on as coverage lands" — authoring a kanji was what made its
words reachable, so unblocking the most words per kanji was the whole game.
Phase 3 changed that: every edge is already on and coverage is already 100%, so
no kanji unblocks anything. What is missing is prose, and a learner meets the
missing prose in *lesson order*. 私 has a reuse count of 2 and is met in lesson
2; 物 has the highest reuse count in the set (8) and is not met until well after.
Ranking by reuse would author 物 first and leave the lesson-2 learner looking at
an empty mnemonic card.

Reuse count survives as the tie-break — among kanji a learner reaches at the
same moment, the one carrying more of the curriculum is worth more — and the
reuse-ordered coverage curve is still reported, because it is the number the
plan's table quotes.

Encounter position mirrors `listLessonCandidatePool` (`itemRepository.ts`): a
pulled-forward kanji takes the sort position of the earliest item that needs it,
inside the earliest level that needs it. As in `dependency_order.py`, study
order is approximated as (level, sort_order), which compares a kanji's
sort_order against a word's only because `ROUND_QUOTAS` in `lessonPlanner.ts`
gives radicals, kanji and vocabulary two slots each per round.

Skeleton radicals are reported as prerequisites rather than ranked: a kanji
mnemonic continues its components' established images (`mnemonic_context.py`),
so a radical must be authored before any kanji that builds on it.

Reads only. Writes curriculum/_build/reports/kanji-priority.{md,json}.

Run (from anywhere):
    python3 curriculum/_build/reports/kanji_priority.py
"""

import json
import os
import sys
from collections import defaultdict

REPORTS_DIR = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR = os.path.dirname(REPORTS_DIR)
CURRICULUM_DIR = os.path.dirname(BUILD_DIR)

LEVELS = ["n5", "n4", "n3", "n2", "n1"]
#: Levels whose vocabulary is authored. A skeleton kanji is only ever reached
#: through one of these words — N3+ ships no vocabulary of its own.
TAUGHT_VOCAB_LEVELS = ["n5", "n4"]
SKELETON_LEVELS = ["n3", "n2", "n1"]

#: Tranche sizes the plan's coverage table quotes.
CURVE_POINTS = [50, 100, 150, 200, 300, 400, 553]


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_items(kind, level):
    path = os.path.join(CURRICULUM_DIR, kind, f"{level}.json")
    if not os.path.exists(path):
        return []
    return load(path)["items"]


def has_mnemonic(item):
    """Authored prose, by the same fields `generate.py` inlines from the
    sidecars. `mnemonic_text` alone is the pre-2b one-liner and still counts."""
    return any(item.get(f) for f in ("meaning_mnemonic", "reading_mnemonic", "mnemonic_text"))


def collect():
    kanji = {}
    for level in LEVELS:
        for item in load_items("kanji", level):
            kanji[item["slug"]] = {
                "slug": item["slug"],
                "char": item["primary_form"],
                "meaning": item["meaning"],
                "level": level,
                "sort_order": item["sort_order"],
                "readings": [r["reading"] for r in item.get("readings", [])],
                "authored": has_mnemonic(item),
            }
    radicals = {}
    for level in LEVELS:
        for item in load_items("radicals", level):
            radicals[item["slug"]] = {
                "slug": item["slug"],
                "form": item["primary_form"],
                "meaning": item["meaning"],
                "level": level,
                "authored": has_mnemonic(item),
            }
    vocab = {}
    for level in TAUGHT_VOCAB_LEVELS:
        for item in load_items("vocabulary", level):
            vocab[item["slug"]] = {
                "slug": item["slug"],
                "form": item["primary_form"],
                "level": level,
                "sort_order": item["sort_order"],
            }
    return kanji, radicals, vocab


def edges():
    graph = load(os.path.join(CURRICULUM_DIR, "dependencies", "graph.json"))
    requires = defaultdict(list)   # kanji slug -> [vocab slug]
    builds_on = defaultdict(list)  # kanji slug -> [radical slug]
    for e in graph["edges"]:
        rel = e["relationship_type"]
        if rel == "requires" and e["from_type"] == "kanji" and e["to_type"] == "vocabulary":
            requires[e["from_slug"]].append(e["to_slug"])
        elif rel == "builds_on" and e["from_type"] == "radical" and e["to_type"] == "kanji":
            builds_on[e["to_slug"]].append(e["from_slug"])
    return requires, builds_on


def encounter(word_slugs, vocab):
    """Where the planner first offers this kanji: the position of the earliest
    word that requires it. Returns (level_rank, sort_order, level)."""
    best = None
    for slug in word_slugs:
        word = vocab.get(slug)
        if not word:
            continue
        key = (TAUGHT_VOCAB_LEVELS.index(word["level"]), word["sort_order"])
        if best is None or key < best[0]:
            best = (key, word["level"])
    return best


def rank(kanji, radicals, vocab, requires, builds_on):
    rows = []
    for slug, k in kanji.items():
        if k["level"] not in SKELETON_LEVELS:
            continue
        words = sorted(
            (vocab[w] for w in requires.get(slug, []) if w in vocab),
            key=lambda w: (TAUGHT_VOCAB_LEVELS.index(w["level"]), w["sort_order"]),
        )
        met = encounter(requires.get(slug, []), vocab)
        if met is None:
            # Phase 2 built the skeleton from the kanji shipped vocabulary uses,
            # so every one of them is required by a word. A kanji that is not is
            # a build bug, not a low priority.
            raise SystemExit(f"skeleton kanji {slug!r} is required by no shipped word")
        (level_rank, sort_order), met_level = met
        components = [radicals[r] for r in builds_on.get(slug, []) if r in radicals]
        rows.append({
            **k,
            "met_in_level": met_level,
            "met_at_sort_order": sort_order,
            "reuse": len(words),
            "words": [{"slug": w["slug"], "form": w["form"], "level": w["level"]} for w in words],
            "unauthored_components": [
                {"slug": c["slug"], "form": c["form"], "meaning": c["meaning"], "level": c["level"]}
                for c in components if not c["authored"]
            ],
            "_key": (level_rank, sort_order, -len(words), slug),
        })
    rows.sort(key=lambda r: r["_key"])
    for i, row in enumerate(rows, start=1):
        row["priority"] = i
        del row["_key"]
    return rows


def kanji_stream_positions(kanji, rows, requires, vocab):
    """Ordinal of each kanji within the stream of kanji a learner of that level
    sees — the level's own kanji merged with the ones pulled forward into it, in
    effective sort order. `met as N5 kanji #12` is the honest answer to "when",
    where a raw sort_order is not comparable across the two populations."""
    pulled = defaultdict(list)
    for row in rows:
        pulled[row["met_in_level"]].append((row["met_at_sort_order"], row["slug"]))
    positions = {}
    for level in TAUGHT_VOCAB_LEVELS:
        own = [(k["sort_order"], k["slug"]) for k in kanji.values() if k["level"] == level]
        merged = sorted(own + pulled[level])
        for i, (_, slug) in enumerate(merged, start=1):
            if slug not in positions:
                positions[slug] = (level, i, len(merged))
    return positions


def coverage_curve(order, rows_by_slug, vocab, requires):
    """Words whose every skeleton parent is authored, after the first N kanji of
    `order`. The plan's table measures reachability; with every edge on since
    Phase 3 it measures prose completeness instead."""
    skeleton_parents = defaultdict(set)
    for slug in rows_by_slug:
        for word in requires.get(slug, []):
            if word in vocab:
                skeleton_parents[word].add(slug)
    curve = []
    for n in CURVE_POINTS:
        done = set(order[:n])
        covered = sum(1 for w in vocab if skeleton_parents[w] <= done)
        curve.append({"authored": n, "words": covered, "pct": round(100 * covered / len(vocab))})
    return curve, sum(1 for w in vocab if not skeleton_parents[w])


def render_markdown(rows, positions, by_encounter, by_reuse, base_covered, total_words,
                    pending_radicals):
    out = []
    out.append("# Skeleton kanji authoring order (Phase 4)\n")
    out.append("Generated by `curriculum/_build/reports/kanji_priority.py`. "
               "Do not edit by hand.\n")
    unauthored = [r for r in rows if not r["authored"]]
    out.append(f"{len(rows)} skeleton kanji, **{len(unauthored)} still without a mnemonic**. "
               f"Ordered by first encounter under Phase 3 pull-forward, "
               f"reuse count as tie-break.\n")

    out.append("## Prerequisite radicals\n")
    if pending_radicals:
        out.append("A kanji mnemonic continues its components' established images, so these "
                   "radicals must be authored before the kanji listed against them.\n")
        out.append("| Radical | Meaning | Level | First needed by | Kanji waiting |")
        out.append("| --- | --- | --- | ---: | ---: |")
        for r in pending_radicals:
            out.append(f"| {r['form']} `{r['slug']}` | {r['meaning']} | {r['level'].upper()} "
                       f"| #{r['first_priority']} {r['first_char']} | {r['waiting']} |")
    else:
        out.append("None — every component of every skeleton kanji is authored.\n")
    out.append("")

    out.append("## Coverage curve\n")
    out.append(f"Words with a full chain *and* full prose behind it, out of {total_words} "
               f"N5+N4 vocabulary items. {base_covered} need no skeleton kanji at all.\n")
    out.append("| Kanji authored | By encounter order | By reuse order |")
    out.append("| ---: | ---: | ---: |")
    for enc, reu in zip(by_encounter, by_reuse):
        out.append(f"| +{enc['authored']} | {enc['words']} ({enc['pct']}%) "
                   f"| {reu['words']} ({reu['pct']}%) |")
    out.append("\nReuse order finishes any given word sooner, which is what the plan's table "
               "measured. Encounter order reaches the learner sooner, which is what an empty "
               "mnemonic card costs.\n")

    out.append("## Authoring queue\n")
    out.append("| # | Kanji | Meaning | Level | Met as | Reuse | Unblocks |")
    out.append("| ---: | --- | --- | --- | --- | ---: | --- |")
    for row in rows:
        if row["authored"]:
            continue
        level, index, total = positions.get(row["slug"], (row["met_in_level"], 0, 0))
        words = ", ".join(w["form"] for w in row["words"][:4])
        if len(row["words"]) > 4:
            words += f", +{len(row['words']) - 4}"
        out.append(f"| {row['priority']} | {row['char']} `{row['slug']}` | {row['meaning']} "
                   f"| {row['level'].upper()} | {level.upper()} kanji #{index}/{total} "
                   f"| {row['reuse']} | {words} |")
    out.append("")
    return "\n".join(out)


def main():
    kanji, radicals, vocab = collect()
    requires, builds_on = edges()
    rows = rank(kanji, radicals, vocab, requires, builds_on)
    rows_by_slug = {r["slug"]: r for r in rows}
    positions = kanji_stream_positions(kanji, rows, requires, vocab)

    encounter_order = [r["slug"] for r in rows]
    reuse_order = [r["slug"] for r in sorted(rows, key=lambda r: (-r["reuse"], r["priority"]))]
    by_encounter, base_covered = coverage_curve(encounter_order, rows_by_slug, vocab, requires)
    by_reuse, _ = coverage_curve(reuse_order, rows_by_slug, vocab, requires)

    pending = {}
    for row in rows:
        if row["authored"]:
            continue
        for comp in row["unauthored_components"]:
            entry = pending.setdefault(comp["slug"], {
                **comp, "waiting": 0,
                "first_priority": row["priority"], "first_char": row["char"],
            })
            entry["waiting"] += 1
    pending_radicals = sorted(pending.values(), key=lambda r: r["first_priority"])

    md = render_markdown(rows, positions, by_encounter, by_reuse, base_covered,
                         len(vocab), pending_radicals)
    with open(os.path.join(REPORTS_DIR, "kanji-priority.md"), "w", encoding="utf-8") as f:
        f.write(md)
    with open(os.path.join(REPORTS_DIR, "kanji-priority.json"), "w", encoding="utf-8") as f:
        json.dump({
            "total": len(rows),
            "unauthored": sum(1 for r in rows if not r["authored"]),
            "prerequisite_radicals": pending_radicals,
            "coverage_by_encounter_order": by_encounter,
            "coverage_by_reuse_order": by_reuse,
            "queue": rows,
        }, f, ensure_ascii=False, indent=2)
        f.write("\n")

    remaining = sum(1 for r in rows if not r["authored"])
    print(f"{len(rows)} skeleton kanji, {remaining} unauthored, "
          f"{len(pending_radicals)} prerequisite radical(s) pending.")
    print("Wrote kanji-priority.md / .json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
