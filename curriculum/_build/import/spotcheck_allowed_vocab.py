# -*- coding: utf-8 -*-
"""Spot-check the allowed-vocab derivation for grammar points (Phase 1,
docs/content/content-pipeline-plan.md).

Phase 2 grammar lesson generation constrains example sentences to "allowed
vocabulary: the slugs unlocked at this point in the curriculum order
(derivable from sort_order + the dependency graph)". This script derives that
set the same way the app actually sequences content, then checks it is sane:

  1. Ports mobile/src/core/lesson/lessonPlanner.ts::planLesson (floor pass +
     weighted round-robin, quotas radical 2 / kanji 2 / vocab 2 / grammar 1)
     and simulates lessons the way useLessonPlan does: every lesson re-scans
     levels from the first and draws from the first level with plannable
     items, gating on `requires` edges from dependencies/graph.json — the
     only relationship type the app's isItemUnlocked path queries.
  2. For every grammar point, allowed vocab = vocab planned strictly before
     it. Flags any of the grammar point's own vocabulary_slugs that are NOT
     yet unlocked when the grammar point is taught.
  3. Flags N5 items deferred past the start of N4 study (a `requires` parent
     is an N4 kanji), and items that never unlock at all.

Writes curriculum/_build/reports/allowed-vocab-spotcheck.md.
"""

import json
import os

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CURRICULUM_DIR = os.path.dirname(BUILD_DIR)
REPORTS_DIR = os.path.join(BUILD_DIR, "reports")

LEVELS = ["n5", "n4"]
# Mirrors lessonPlanner.ts ROUND_QUOTAS (order matters: radicals lead).
ROUND_QUOTAS = [("radical", 2), ("kanji", 2), ("vocabulary", 2), ("grammar", 1)]
LESSON_SIZES = {"relaxed": 5, "intense": 10}
# Grammar points to detail in the report, per level: first, early, middle, last.
SAMPLE_POSITIONS = [0, 4, "mid", -1]


def load_items(kind, level):
    path = os.path.join(CURRICULUM_DIR, kind, f"{level}.json")
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        return json.load(f)["items"]


def load_requires_parents():
    """{child_slug: [parent_slug, ...]} for relationship_type == 'requires'."""
    with open(os.path.join(CURRICULUM_DIR, "dependencies", "graph.json"), encoding="utf-8") as f:
        edges = json.load(f)["edges"]
    parents = {}
    for e in edges:
        if e["relationship_type"] == "requires":
            parents.setdefault(e["to_slug"], []).append(e["from_slug"])
    return parents


def plan_lesson(candidates, started, parents_by_slug, learned, size):
    """Faithful port of lessonPlanner.ts::planLesson.

    `learned` stands in for parentStatuses (known/in_progress both satisfy);
    statuses are fixed for the whole call, exactly like the app.
    """
    if size <= 0:
        return []

    buckets = {item_type: [] for item_type, _quota in ROUND_QUOTAS}
    for c in candidates:
        if c["slug"] in started:
            continue
        parents = parents_by_slug.get(c["slug"], [])
        if any(p not in learned for p in parents):
            continue
        buckets[c["type"]].append(c)
    for bucket in buckets.values():
        bucket.sort(key=lambda c: c["sort_order"])

    result = []
    indices = {item_type: 0 for item_type, _quota in ROUND_QUOTAS}

    # Floor pass: one slot per type that has candidates.
    for item_type, _quota in ROUND_QUOTAS:
        if len(result) >= size:
            break
        bucket = buckets[item_type]
        if bucket:
            result.append(bucket[0])
            indices[item_type] = 1

    first_round = True
    progressed = True
    while progressed and len(result) < size:
        progressed = False
        for item_type, quota in ROUND_QUOTAS:
            bucket = buckets[item_type]
            start = indices[item_type]
            round_base = 0 if first_round else start
            end = min(round_base + quota, len(bucket))
            i = start
            while i < end and len(result) < size:
                result.append(bucket[i])
                indices[item_type] = i + 1
                progressed = True
                i += 1
            if len(result) >= size:
                break
        if first_round:
            progressed = True
        first_round = False

    return result


def simulate(lesson_size):
    """Simulates the full curriculum in planner order.

    Like useLessonPlan, each lesson re-scans levels from the first and draws
    from the first level that yields a non-empty plan — so an N5 item locked
    behind an N4 kanji is picked up again once that kanji is started.

    Returns (order, deferred, stuck):
      order    — flat list of candidates in the sequence they are taught
      deferred — N5 items first taught only after N4 study began
      stuck    — items never taught even after both levels are exhausted
    """
    parents_by_slug = load_requires_parents()
    candidates_by_level = {}
    for level in LEVELS:
        candidates = []
        for kind, item_type in [
            ("radicals", "radical"),
            ("kanji", "kanji"),
            ("vocabulary", "vocabulary"),
            ("grammar", "grammar"),
        ]:
            for item in load_items(kind, level):
                candidates.append({
                    "slug": item["slug"],
                    "type": item_type,
                    "sort_order": item["sort_order"],
                    "primary_form": item["primary_form"],
                    "level": level,
                })
        candidates_by_level[level] = candidates

    learned = set()
    started = set()
    order = []
    deferred = []
    n4_started = False

    while True:
        lesson = []
        for level in LEVELS:
            lesson = plan_lesson(
                candidates_by_level[level], started, parents_by_slug, learned, lesson_size
            )
            if lesson:
                break
        if not lesson:
            break
        for c in lesson:
            if c["level"] == "n4":
                n4_started = True
            elif n4_started:
                missing_at_n5 = [
                    p for p in parents_by_slug.get(c["slug"], []) if p.startswith("n4-")
                ]
                deferred.append({**c, "n4_parents": missing_at_n5})
            order.append(c)
            started.add(c["slug"])
            learned.add(c["slug"])

    stuck = []
    for level in LEVELS:
        for c in candidates_by_level[level]:
            if c["slug"] not in started:
                missing = [p for p in parents_by_slug.get(c["slug"], []) if p not in learned]
                stuck.append({**c, "missing_parents": missing})

    return order, deferred, stuck


def check_grammar_points(order):
    """For each grammar point, verify its vocabulary_slugs are unlocked first."""
    position = {c["slug"]: i for i, c in enumerate(order)}
    vocab_before = []
    seen_vocab = set()
    for c in order:
        vocab_before.append(set(seen_vocab))
        if c["type"] == "vocabulary":
            seen_vocab.add(c["slug"])

    results = []
    for level in LEVELS:
        for g in load_items("grammar", level):
            slug = g["slug"]
            if slug not in position:
                continue  # reported separately as stuck
            pos = position[slug]
            allowed = vocab_before[pos]
            linked = g.get("vocabulary_slugs", [])
            missing = [v for v in linked if v not in allowed]
            results.append({
                "level": level,
                "slug": slug,
                "form": g["primary_form"],
                "position": pos,
                "allowed_count": len(allowed),
                "linked_count": len(linked),
                "missing": missing,
            })
    return results


def main():
    os.makedirs(REPORTS_DIR, exist_ok=True)
    lines = ["# Allowed-vocab spot-check — planner-order derivation", ""]
    lines.append(
        "Generated by `curriculum/_build/import/spotcheck_allowed_vocab.py`. "
        "Simulates the app's lesson planner (quotas radical 2 / kanji 2 / vocab 2 / "
        "grammar 1, `requires`-edge gating, levels re-scanned N5-first each lesson "
        "like useLessonPlan) and checks each grammar point's linked vocabulary is "
        "unlocked before the point is taught."
    )
    lines.append("")

    exit_bad = False
    for intensity, size in LESSON_SIZES.items():
        order, deferred, stuck = simulate(size)
        results = check_grammar_points(order)
        violations = [r for r in results if r["missing"]]

        lines.append(f"## Lesson size {size} ({intensity})")
        lines.append("")
        lines.append(
            f"Simulated {len(order)} items across {LEVELS}; "
            f"{len(results)} grammar points checked; "
            f"**{len(violations)} taught before some of their linked vocab**; "
            f"**{len(deferred)} N5 items deferred into N4 study**; "
            f"**{len(stuck)} items never unlock**."
        )
        lines.append("")

        if stuck:
            exit_bad = True
            lines.append("### Items that never unlock")
            lines.append("")
            for s in stuck:
                lines.append(
                    f"- **{s['slug']}** ({s['primary_form']}, {s['type']}, {s['level']}): "
                    f"missing parents {', '.join(s['missing_parents']) or '—'}"
                )
            lines.append("")

        if deferred:
            lines.append("### N5 items deferred until N4 kanji unlock them")
            lines.append("")
            lines.append(
                "These N5 items have a `requires` parent that is an N4 kanji "
                "(generate_deps.py links every kanji to every vocab containing its "
                "character, across levels), so they are only taught after that "
                "kanji is started in N4:"
            )
            lines.append("")
            compact = ", ".join(
                f"{d['slug']} ({d['primary_form']})" for d in deferred
            )
            lines.append(compact)
            lines.append("")

        if violations:
            lines.append("### Grammar points taught before their linked vocab")
            lines.append("")
            for r in violations:
                lines.append(
                    f"- **{r['slug']}** ({r['form']}, {r['level']}, planner position "
                    f"{r['position']}, {r['allowed_count']} vocab unlocked): "
                    f"locked linked vocab: {', '.join(r['missing'])}"
                )
            lines.append("")

        lines.append("### Sample grammar points")
        lines.append("")
        lines.append("| grammar point | level | planner position | vocab unlocked before it | linked vocab | linked-but-locked |")
        lines.append("|---|---|---|---|---|---|")
        by_level = {}
        for r in results:
            by_level.setdefault(r["level"], []).append(r)
        for level, rs in by_level.items():
            picks = []
            for p in SAMPLE_POSITIONS:
                idx = len(rs) // 2 if p == "mid" else p
                if -len(rs) <= idx < len(rs):
                    picks.append(rs[idx])
            seen = set()
            for r in picks:
                if r["slug"] in seen:
                    continue
                seen.add(r["slug"])
                lines.append(
                    f"| {r['slug']} ({r['form']}) | {r['level']} | {r['position']} "
                    f"| {r['allowed_count']} | {r['linked_count']} | {len(r['missing'])} |"
                )
        lines.append("")

    out = os.path.join(REPORTS_DIR, "allowed-vocab-spotcheck.md")
    with open(out, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(f"Wrote {out}")
    if exit_bad:
        print("Spot-check found hard failures (items that never unlock) — see report.")
        raise SystemExit(1)
    print("No hard failures; see report for ordering findings.")


if __name__ == "__main__":
    main()
