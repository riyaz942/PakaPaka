# -*- coding: utf-8 -*-
"""Dependency-order report (docs/content/kanji-coverage-and-dependency-order-plan.md).

Answers three questions the plan measures per phase:

  1. Coverage  — how many vocabulary items have every one of their kanji taught
                 somewhere in the curriculum.
  2. Reading   — how many are asked for their *reading*, not their meaning only:
                 every kanji in the word banded at or before the word's level.
  3. Ordering  — how many gating parents are scheduled *after* the child that
                 needs them.

Only `requires` edges gate lessons: `useLessonPlan.ts` asks
`getRequiredParentsForItems`, which filters to that relationship type.
`builds_on` and `reinforces` (grammar -> vocabulary) are displayed in the app
but never block an item, so their ordering is reported as INFO only.

Since plan v2 Phase C, `builds_on` carries two different edges. Radical ->
kanji is the decomposition. Kanji -> vocabulary is the *out-of-band* half of
`generate_deps.py`'s band gate: a kanji banded later than the word it is
written in. That word is taught on schedule and asked for its meaning until the
kanji reaches guru, so the edge describes a reading gate, not a lesson gate.

Severity turns on whether the learner can actually satisfy the parent. The
lesson pool is one level (`listLessonCandidatePool`), and placement marks every
earlier level known, so a parent is satisfiable exactly when it is banded at or
before the child's level:

  ERROR   the child is permanently locked — the edge dangles, the `requires`
          chain above it never bottoms out, or a `requires` parent is banded in
          a *later* level than the child, which the pool will never offer.
          Band-gating in `generate_deps.py` is what keeps this section empty.
  WARNING parent sits later in the *same* level — the child is deferred until
          the parent is learned. Order intent is broken; reachability is not.
          Nothing reorders within a level, so this still costs.
  INFO    the edge does not gate at all.

Study order is approximated as (level, sort_order). `sort_order` restarts per
item type, so comparing a kanji's against a word's only works because
`ROUND_QUOTAS` in `lessonPlanner.ts` gives radicals, kanji and vocabulary two
slots each per round — the three buckets advance at the same rate. A change to
those quotas invalidates the same-level comparison here.

Reads only. Writes curriculum/_build/reports/dependency-order.{md,json} and
exits 1 if any ERROR was found — the same contract as
`generate_content/audit_shipped.py`.

Run (from anywhere):
    python3 curriculum/_build/reports/dependency_order.py
"""

import json
import os
import sys
from collections import defaultdict

REPORTS_DIR = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR = os.path.dirname(REPORTS_DIR)
CURRICULUM_DIR = os.path.dirname(BUILD_DIR)
sys.path.insert(0, BUILD_DIR)

import jlpt_groups  # noqa: E402

LEVELS = ["n5", "n4", "n3", "n2", "n1"]
KINDS = [
    ("radicals", "radical"),
    ("kanji", "kanji"),
    ("vocabulary", "vocabulary"),
    ("grammar", "grammar"),
]


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_edges():
    return load(os.path.join(CURRICULUM_DIR, "dependencies", "graph.json"))["edges"]


def is_kanji_char(ch):
    return "一" <= ch <= "鿿"


def load_items():
    """(item_type, slug) -> item dict, plus the level each item lives in."""
    items = {}
    for level in LEVELS:
        for kind, item_type in KINDS:
            for item in jlpt_groups.load_items(kind, level):
                items[(item_type, item["slug"])] = dict(item, _level=level)
    return items


def study_position(item):
    """Order the planner offers items in: level first, then sort_order."""
    return (LEVELS.index(item["_level"]), item.get("sort_order", 0))


def coverage(items):
    """Vocabulary items whose kanji are all taught, per level."""
    taught_chars = {
        item["primary_form"]: item
        for (item_type, _), item in items.items()
        if item_type == "kanji"
    }
    per_level = {}
    untaught_uses = defaultdict(list)
    for (item_type, slug), item in items.items():
        if item_type != "vocabulary":
            continue
        level = item["_level"]
        stats = per_level.setdefault(level, {"total": 0, "full": 0, "partial": 0, "kana": 0})
        stats["total"] += 1
        chars = [ch for ch in item["primary_form"] if is_kanji_char(ch)]
        if not chars:
            # Kana-only words have nothing to teach first, so they count as a
            # full chain — the plan's 45% is measured the same way.
            stats["kana"] += 1
            stats["full"] += 1
            continue
        missing = [ch for ch in dict.fromkeys(chars) if ch not in taught_chars]
        for ch in missing:
            untaught_uses[ch].append(slug)
        if missing:
            stats["partial"] += 1
        else:
            stats["full"] += 1
    return per_level, untaught_uses


def reading_gate(items):
    """Words held to a meaning-only prompt, per level (plan v2 rule 1).

    A non-gating kanji -> vocabulary edge is a kanji banded later than the word
    it is written in. The word ships on schedule; its reading card stays dark
    until that kanji reaches guru. This is the honest reading of the plan's
    coverage figure — how much of a level a learner can actually *read* by the
    end of it — as against `coverage()`, which asks only whether the kanji is
    authored anywhere at all."""
    gated_parents = defaultdict(list)
    for edge in load_edges():
        if edge["relationship_type"] == "builds_on" and edge["from_type"] == "kanji":
            gated_parents[(edge["to_type"], edge["to_slug"])].append(edge["from_slug"])

    per_level = {}
    blocking = defaultdict(list)
    for key, item in items.items():
        if key[0] != "vocabulary":
            continue
        stats = per_level.setdefault(item["_level"], {"total": 0, "readable": 0, "gated": 0})
        stats["total"] += 1
        parents = gated_parents.get(key, [])
        if parents:
            stats["gated"] += 1
            for parent in parents:
                blocking[parent].append(item["slug"])
        else:
            stats["readable"] += 1
    return per_level, blocking


def ordering_violations(items):
    """Edges whose parent is studied after its child, split by relationship."""
    edges = load_edges()
    findings = []
    for edge in edges:
        parent = items.get((edge["from_type"], edge["from_slug"]))
        child = items.get((edge["to_type"], edge["to_slug"]))
        # A dangling edge means the graph is stale; generate_deps.py should have
        # raised. Report it rather than crashing on a partial rebuild.
        if parent is None or child is None:
            findings.append({
                "kind": "dangling",
                "severity": "ERROR",
                "relationship": edge["relationship_type"],
                "parent": edge["from_slug"],
                "child": edge["to_slug"],
            })
            continue
        parent_pos = study_position(parent)
        child_pos = study_position(child)
        if parent_pos <= child_pos:
            continue
        gates = edge["relationship_type"] == "requires"
        cross_level = parent_pos[0] > child_pos[0]
        # A gating parent in a later level is a lock nothing opens: the lesson
        # pool never leaves the level being studied. Same-level ones are a real
        # deferral but reachable — nothing reorders inside a level.
        if gates:
            severity = "ERROR" if cross_level else "WARNING"
        else:
            severity = "INFO"
        findings.append({
            "kind": "cross-level" if cross_level else "same-level",
            "severity": severity,
            "relationship": edge["relationship_type"],
            "parent": edge["from_slug"],
            "parent_type": edge["from_type"],
            "parent_form": parent["primary_form"],
            "parent_level": parent["_level"],
            "parent_sort_order": parent.get("sort_order", 0),
            "child": edge["to_slug"],
            "child_type": edge["to_type"],
            "child_form": child["primary_form"],
            "child_level": child["_level"],
            "child_sort_order": child.get("sort_order", 0),
        })
    return findings


def unreachable_items(items):
    """Items whose `requires` chain never bottoms out.

    Every gating parent must itself be reachable. A cycle, or a chain that only
    ever leads back into locked items, means the learner can never open the
    gate no matter how long they study. Level plays no part here — the level a
    gating parent sits at is checked in `ordering_violations` — so the only
    question left is whether the chain terminates."""
    parents_by_child = defaultdict(list)
    for edge in load_edges():
        if edge["relationship_type"] == "requires":
            parents_by_child[(edge["to_type"], edge["to_slug"])].append(
                (edge["from_type"], edge["from_slug"])
            )

    # An item is reachable when every parent is reachable; items with no parents
    # are reachable by definition. Iterate to a fixpoint rather than recursing,
    # so a cycle simply never becomes reachable instead of blowing the stack.
    reachable = {key for key in items if not parents_by_child[key]}
    changed = True
    while changed:
        changed = False
        for key in items:
            if key in reachable:
                continue
            if all(parent in reachable for parent in parents_by_child[key]):
                reachable.add(key)
                changed = True

    findings = []
    for key in sorted(items.keys() - reachable):
        item = items[key]
        findings.append({
            "kind": "unreachable",
            "severity": "ERROR",
            "relationship": "requires",
            "child": item["slug"],
            "child_type": key[0],
            "child_form": item["primary_form"],
            "child_level": item["_level"],
            "child_sort_order": item.get("sort_order", 0),
            "parents": [slug for _type, slug in parents_by_child[key]],
        })
    return findings


def group_by_child(findings):
    """One row per blocked child, listing every parent that is scheduled late."""
    by_child = {}
    for finding in findings:
        key = (finding["child_type"], finding["child"])
        row = by_child.setdefault(key, {
            "child": finding["child"],
            "child_form": finding["child_form"],
            "child_level": finding["child_level"],
            "child_sort_order": finding["child_sort_order"],
            "parents": [],
        })
        row["parents"].append(finding)
    return sorted(
        by_child.values(),
        key=lambda row: (LEVELS.index(row["child_level"]), row["child_sort_order"]),
    )


def render_markdown(per_level, untaught_uses, reading_per_level, blocking, findings):
    errors = [f for f in findings if f["severity"] == "ERROR"]
    warnings = [f for f in findings if f["severity"] == "WARNING"]
    infos = [f for f in findings if f["severity"] == "INFO"]

    lines = ["# Dependency order — kanji coverage and study order", ""]
    lines.append(
        "Generated by `curriculum/_build/reports/dependency_order.py` "
        "(plan: `docs/content/kanji-coverage-and-dependency-order-plan.md`)."
    )
    lines.append("")
    lines.append(
        f"**Totals: {len(errors)} error(s), {len(warnings)} warning(s), {len(infos)} info.**"
    )
    lines.append("")

    lines += ["## Coverage — vocabulary with every kanji taught", ""]
    lines += ["| Level | Vocabulary | Every kanji taught | Some kanji untaught | (kana only) |",
              "| --- | ---: | ---: | ---: | ---: |"]
    totals = defaultdict(int)
    for level in LEVELS:
        stats = per_level.get(level)
        if not stats:
            continue
        for key, value in stats.items():
            totals[key] += value
        pct = f" ({stats['full'] * 100 // stats['total']}%)" if stats["total"] else ""
        lines.append(
            f"| {level.upper()} | {stats['total']} | {stats['full']}{pct} "
            f"| {stats['partial']} | {stats['kana']} |"
        )
    pct = f" ({totals['full'] * 100 // totals['total']}%)" if totals["total"] else ""
    lines.append(
        f"| **All** | {totals['total']} | {totals['full']}{pct} "
        f"| {totals['partial']} | {totals['kana']} |"
    )
    lines.append("")
    if untaught_uses:
        lines.append(
            f"{len(untaught_uses)} distinct kanji are used by taught vocabulary but "
            "authored nowhere. Top 30 by how many words each unblocks:"
        )
        lines.append("")
        ranked = sorted(untaught_uses.items(), key=lambda kv: (-len(kv[1]), kv[0]))
        for char, slugs in ranked[:30]:
            sample = ", ".join(slugs[:5]) + (" …" if len(slugs) > 5 else "")
            lines.append(f"- {char} — {len(slugs)} word(s): {sample}")
    else:
        lines.append(
            "Every kanji any taught word is written with is on the ladder. Word "
            "selection enforces it: `build_vocab_skeleton.py` drops a candidate "
            "written with a kanji outside the 2,000."
        )
    lines.append("")

    lines += ["## Reading gate — words asked for meaning only", ""]
    lines.append(
        "A word with a kanji banded later than itself is taught on schedule, shown with "
        "furigana, and asked for its **meaning** until every kanji in it reaches guru "
        "(plan v2 rule 1) — 写真 is an N5 word written with two N3 kanji. `readable` is what "
        "a learner who finishes the level can be asked to read; it is the honest form of the "
        "coverage figure above, which only asks whether the kanji is authored somewhere."
    )
    lines.append("")
    lines += ["| Level | Vocabulary | Reading live at level end | Meaning only |",
              "| --- | ---: | ---: | ---: |"]
    reading_totals = defaultdict(int)
    for level in LEVELS:
        stats = reading_per_level.get(level)
        if not stats:
            continue
        for key, value in stats.items():
            reading_totals[key] += value
        pct = f" ({stats['readable'] * 100 // stats['total']}%)" if stats["total"] else ""
        lines.append(
            f"| {level.upper()} | {stats['total']} | {stats['readable']}{pct} "
            f"| {stats['gated']} |"
        )
    pct = (
        f" ({reading_totals['readable'] * 100 // reading_totals['total']}%)"
        if reading_totals["total"] else ""
    )
    lines.append(
        f"| **All** | {reading_totals['total']} | {reading_totals['readable']}{pct} "
        f"| {reading_totals['gated']} |"
    )
    lines.append("")
    if blocking:
        lines.append(
            f"{len(blocking)} out-of-band kanji hold a reading back. Top 30 by how many "
            "words each would release:"
        )
        lines.append("")
        ranked = sorted(blocking.items(), key=lambda kv: (-len(kv[1]), kv[0]))
        for slug, slugs in ranked[:30]:
            sample = ", ".join(slugs[:5]) + (" …" if len(slugs) > 5 else "")
            lines.append(f"- `{slug}` — {len(slugs)} word(s): {sample}")
    else:
        lines.append("(no word is reading-gated)")
    lines.append("")

    lines += ["## ERROR — permanently locked items", ""]
    lines.append(
        "An item no amount of study unlocks: a dangling edge, a `requires` chain that never "
        "bottoms out, or a `requires` parent banded in a later level than the child — the "
        "lesson pool is one level, so it would never be offered. Band-gating in "
        "`generate_deps.py` is what keeps this section clean; it is the Phase C check."
    )
    lines.append("")
    dangling = [f for f in findings if f["kind"] == "dangling"]
    unreachable = [f for f in findings if f["kind"] == "unreachable"]
    out_of_band = [f for f in errors if f["kind"] == "cross-level"]
    if dangling or unreachable or out_of_band:
        for finding in dangling:
            lines.append(
                f"- **ERROR** dangling {finding['relationship']} edge "
                f"`{finding['parent']}` -> `{finding['child']}`"
            )
        for finding in unreachable:
            lines.append(
                f"- **ERROR** {finding['child_form']} `{finding['child']}` "
                f"({finding['child_level'].upper()}) is never reachable; parents: "
                f"{', '.join(f'`{p}`' for p in finding['parents'])}"
            )
        for finding in out_of_band:
            lines.append(
                f"- **ERROR** {finding['child_form']} `{finding['child']}` "
                f"({finding['child_level'].upper()}) is gated by {finding['parent_form']} "
                f"`{finding['parent']}`, banded at {finding['parent_level'].upper()}"
            )
    else:
        lines.append("(clean)")
    lines.append("")

    lines += ["## WARNING — gated by a kanji taught later in the same level", ""]
    lines.append(
        "The word is deferred until its kanji is learned, which happens inside the same "
        "level. Reachable, but the authored sequence does not match the dependency."
    )
    lines.append("")
    rows = group_by_child(warnings)
    if rows:
        lines += ["| Word | Level | sort_order | Kanji taught later |",
                  "| --- | --- | ---: | --- |"]
        for row in rows:
            parents = ", ".join(
                f"{p['parent_form']} (`{p['parent']}` @{p['parent_sort_order']})"
                for p in sorted(row["parents"], key=lambda p: p["parent_sort_order"])
            )
            lines.append(
                f"| {row['child_form']} `{row['child']}` | {row['child_level'].upper()} "
                f"| {row['child_sort_order']} | {parents} |"
            )
    else:
        lines.append("(clean)")
    lines.append("")

    lines += ["## INFO — non-gating edges out of order", ""]
    lines.append(
        "`builds_on` (radical -> kanji, and out-of-band kanji -> vocabulary) and `reinforces` "
        "(grammar -> vocabulary) are shown as component chips but never block an item, so a "
        "late parent costs nothing but presentation order. The kanji -> vocabulary ones are "
        "the reading gate, counted word-by-word in the section above."
    )
    lines.append("")
    counts = defaultdict(int)
    for finding in infos:
        counts[(finding["parent_type"], finding["relationship"], finding["kind"])] += 1
    for (parent_type, relationship, kind), count in sorted(counts.items()):
        lines.append(f"- **INFO** {count} {parent_type} {relationship} edge(s), {kind}")
    if not counts:
        lines.append("(clean)")
    lines.append("")

    return "\n".join(lines) + "\n"


def main():
    items = load_items()
    per_level, untaught_uses = coverage(items)
    reading_per_level, blocking = reading_gate(items)
    findings = unreachable_items(items) + ordering_violations(items)

    md_path = os.path.join(REPORTS_DIR, "dependency-order.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(
            render_markdown(per_level, untaught_uses, reading_per_level, blocking, findings)
        )

    json_path = os.path.join(REPORTS_DIR, "dependency-order.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "coverage": per_level,
                "reading_gate": reading_per_level,
                "untaught_kanji": {
                    char: slugs
                    for char, slugs in sorted(
                        untaught_uses.items(), key=lambda kv: (-len(kv[1]), kv[0])
                    )
                },
                "reading_gated_by": {
                    slug: slugs
                    for slug, slugs in sorted(
                        blocking.items(), key=lambda kv: (-len(kv[1]), kv[0])
                    )
                },
                "findings": findings,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )
        f.write("\n")

    errors = [f for f in findings if f["severity"] == "ERROR"]
    warnings = [f for f in findings if f["severity"] == "WARNING"]
    print(
        f"Wrote {os.path.relpath(md_path, CURRICULUM_DIR)}: "
        f"{len(errors)} error(s), {len(warnings)} warning(s)."
    )
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
