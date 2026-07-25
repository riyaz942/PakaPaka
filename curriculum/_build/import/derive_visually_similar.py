# -*- coding: utf-8 -*-
"""Rev 1 look-alike pair derivation (docs/content/content-pipeline-plan.md R1.3).

Surfaces candidate visually-confusable pairs within the taught N5+N4
radical/kanji set from three sources:

  seed   — curated list of the classic traps (人/入, 大/太, 白/百, …),
           kept here as character pairs and resolved against the taught set
  graph  — kanji sharing most of their taught components
           (dependencies/graph.json builds_on edges)
  kanjivg — near-identical KanjiVG stroke skeletons: the ordered sequence of
           per-stroke kvg:type classes, pairs within edit distance 1
           (requires data/kanjivg-main.zip; fetch_sources.sh --kanjivg)

Writes curriculum/_build/reports/visually-similar-candidates.md for human
review. Reviewed pairs land in curriculum/_build/visually_similar.py
(VISUALLY_SIMILAR_PAIRS), which generate.py emits as
`visually_similar_slugs`; the report flags dataset pairs no source surfaces
so curated additions stay visible.

Run: .venv/bin/python import/derive_visually_similar.py   (from curriculum/_build)
"""

import json
import os
import re
import sys
import zipfile

IMPORT_DIR = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR = os.path.dirname(IMPORT_DIR)
CURRICULUM_DIR = os.path.dirname(BUILD_DIR)

sys.path.insert(0, IMPORT_DIR)
sys.path.insert(0, BUILD_DIR)

import sources  # noqa: E402
from visually_similar import VISUALLY_SIMILAR_PAIRS  # noqa: E402

REPORT_PATH = os.path.join(BUILD_DIR, "reports", "visually-similar-candidates.md")
KANJIVG_ZIP = os.path.join(BUILD_DIR, "data", "kanjivg-main.zip")

#: Curated seed list: the classic visual traps. Character pairs; each side is
#: resolved against the taught radical/kanji sets below (pairs whose
#: characters are not taught are reported, not emitted).
SEED_CHAR_PAIRS = [
    ("人", "入"),
    ("大", "太"),
    ("太", "犬"),
    ("大", "天"),
    ("大", "犬"),
    ("土", "士"),
    ("千", "干"),
    ("未", "末"),
    ("白", "百"),
    ("白", "自"),
    ("目", "自"),
    ("日", "曰"),
    ("日", "目"),
    ("木", "本"),
    ("石", "右"),
    ("右", "左"),
    ("午", "牛"),
    ("万", "方"),
    ("九", "力"),
    ("刀", "力"),
    ("間", "聞"),
    ("名", "多"),
    ("貝", "見"),
    ("冂", "冖"),
    ("冂", "囗"),
    ("尸", "戸"),
    ("广", "疒"),
    ("王", "主"),
    ("半", "羊"),
    ("心", "必"),
    ("今", "会"),
    ("小", "少"),
    ("米", "来"),
]

_KVG_TYPE_RE = re.compile(r'kvg:type="(.)')


def load_taught_items():
    """[{slug, char, type, level, meaning}] for all taught radicals + kanji.

    A few kanji are re-taught at N4 under a second slug; only the first-taught
    occurrence of a character is kept, matching the dataset policy that pairs
    attach to the N5 slug."""
    from n5_radicals import N5_RADICALS
    from n4_radicals import N4_RADICALS
    from n5_kanji import N5_KANJI
    from n4_kanji import N4_KANJI

    items = []
    seen = set()
    for level, radicals in (("n5", N5_RADICALS), ("n4", N4_RADICALS)):
        for r in radicals:
            items.append({"slug": r["slug"], "char": r["form"], "type": "radical",
                          "level": level, "meaning": r["meaning"]})
    for level, kanji in (("n5", N5_KANJI), ("n4", N4_KANJI)):
        for k in kanji:
            if k["char"] in seen:
                continue
            seen.add(k["char"])
            items.append({"slug": f"{level}-{k['suffix']}", "char": k["char"],
                          "type": "kanji", "level": level, "meaning": k["meaning"]})
    return items


def kanji_components():
    """{kanji_slug: frozenset(radical_slug)} from graph.json builds_on edges."""
    with open(os.path.join(CURRICULUM_DIR, "dependencies", "graph.json"),
              encoding="utf-8") as f:
        edges = json.load(f)["edges"]
    comps = {}
    for e in edges:
        if e["relationship_type"] == "builds_on" and e["from_type"] == "radical":
            comps.setdefault(e["to_slug"], set()).add(e["from_slug"])
    return {slug: frozenset(c) for slug, c in comps.items()}


def kanjivg_skeletons(chars):
    """{char: (stroke_type, ...)} — ordered per-stroke kvg:type classes.

    Reads straight from the release zip; characters without a KanjiVG file
    (or without typed strokes) are omitted."""
    skeletons = {}
    with zipfile.ZipFile(KANJIVG_ZIP) as z:
        names = set(z.namelist())
        for ch in chars:
            name = f"kanji/{ord(ch):05x}.svg"
            if name not in names:
                continue
            svg = z.read(name).decode("utf-8")
            types = _KVG_TYPE_RE.findall(svg)
            if types:
                skeletons[ch] = tuple(types)
    return skeletons


def edit_distance(a, b):
    if abs(len(a) - len(b)) > 1:
        return 2  # caller only distinguishes <=1
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1,
                           prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def seed_candidates(items):
    """Resolve seed char pairs to same-type slug pairs (cross-type only when
    the two characters are taught as different types). Returns
    (candidates, unresolved) where unresolved lists pairs with an untaught side."""
    # First taught occurrence wins (a few kanji are re-taught at N4 under a
    # second slug; pairs attach to the N5 item).
    by_char_type = {}
    for it in items:
        by_char_type.setdefault((it["char"], it["type"]), it)
    taught_chars = {it["char"] for it in items}

    candidates = []
    unresolved = []
    for a, b in SEED_CHAR_PAIRS:
        if a not in taught_chars or b not in taught_chars:
            missing = [ch for ch in (a, b) if ch not in taught_chars]
            unresolved.append((a, b, missing))
            continue
        resolved = []
        for item_type in ("radical", "kanji"):
            ia = by_char_type.get((a, item_type))
            ib = by_char_type.get((b, item_type))
            if ia and ib:
                resolved.append((ia, ib))
        if not resolved:
            # Taught as different types only (e.g. kanji 午 vs radical 牛).
            ia = by_char_type.get((a, "radical")) or by_char_type[(a, "kanji")]
            ib = by_char_type.get((b, "radical")) or by_char_type[(b, "kanji")]
            resolved.append((ia, ib))
        for ia, ib in resolved:
            candidates.append({"a": ia, "b": ib, "source": "seed"})
    return candidates, unresolved


def graph_candidates(items, stroke_counts):
    """Kanji pairs sharing most taught components: >=2 shared components, or
    identical non-empty component sets; stroke counts within 2 when known."""
    comps = kanji_components()
    kanji = [it for it in items if it["type"] == "kanji" and it["slug"] in comps]
    candidates = []
    for i, ia in enumerate(kanji):
        for ib in kanji[i + 1:]:
            if ia["char"] == ib["char"]:
                continue  # same kanji re-taught at N4 under a second slug
            ca, cb = comps[ia["slug"]], comps[ib["slug"]]
            shared = ca & cb
            if not (len(shared) >= 2 or (shared and ca == cb)):
                continue
            sa = stroke_counts.get(ia["char"])
            sb = stroke_counts.get(ib["char"])
            if sa and sb and abs(sa - sb) > 2:
                continue
            candidates.append({
                "a": ia, "b": ib, "source": "graph",
                "detail": "shared components: " + " ".join(sorted(shared)),
            })
    return candidates


def kanjivg_candidates(items):
    """Same-type pairs whose stroke-type sequences are within edit distance 1."""
    if not os.path.exists(KANJIVG_ZIP):
        return None
    skeletons = kanjivg_skeletons({it["char"] for it in items})
    typed = [it for it in items if it["char"] in skeletons]
    candidates = []
    for i, ia in enumerate(typed):
        for ib in typed[i + 1:]:
            if ia["type"] != ib["type"] or ia["char"] == ib["char"]:
                continue
            ska, skb = skeletons[ia["char"]], skeletons[ib["char"]]
            if len(ska) < 2 and len(skb) < 2:
                continue  # single-stroke items pair with everything
            if edit_distance(ska, skb) <= 1:
                candidates.append({
                    "a": ia, "b": ib, "source": "kanjivg",
                    "detail": f"strokes {len(ska)}/{len(skb)}",
                })
    return candidates


def _pair_key(a, b):
    return tuple(sorted((a["slug"], b["slug"])))


def _fmt(it):
    return f"{it['char']} `{it['slug']}` ({it['meaning']})"


def main():
    items = load_taught_items()
    kanjidic = sources.load_kanjidic2()
    stroke_counts = {ch: int(kanjidic[ch]["stroke_count"])
                     for ch in {it["char"] for it in items}
                     if kanjidic.get(ch, {}).get("stroke_count")}

    seeds, unresolved = seed_candidates(items)
    graphs = graph_candidates(items, stroke_counts)
    kvg = kanjivg_candidates(items)

    merged = {}
    for cand in seeds + graphs + (kvg or []):
        key = _pair_key(cand["a"], cand["b"])
        entry = merged.setdefault(key, {"a": cand["a"], "b": cand["b"],
                                        "sources": [], "details": []})
        entry["sources"].append(cand["source"])
        if cand.get("detail"):
            entry["details"].append(cand["detail"])

    reviewed = {tuple(sorted(p)) for p in VISUALLY_SIMILAR_PAIRS}
    by_slug = {it["slug"]: it for it in items}

    lines = ["# Visually similar pair candidates (Rev 1, R1.3)", ""]
    lines.append("Generated by import/derive_visually_similar.py. Review each "
                 "candidate and promote confirmed pairs into "
                 "_build/visually_similar.py.")
    lines.append("")
    if kvg is None:
        lines.append("**KanjiVG data missing** — skeleton candidates were NOT "
                     "derived. Run import/fetch_sources.sh --kanjivg and re-run.")
        lines.append("")

    lines.append(f"## Candidates ({len(merged)})")
    lines.append("")
    lines.append("| In dataset | Pair | Sources | Detail |")
    lines.append("|---|---|---|---|")
    for key in sorted(merged, key=lambda k: (merged[k]["a"]["type"], k)):
        e = merged[key]
        mark = "x" if key in reviewed else " "
        lines.append(f"| [{mark}] | {_fmt(e['a'])} ↔ {_fmt(e['b'])} "
                     f"| {', '.join(sorted(set(e['sources'])))} "
                     f"| {'; '.join(e['details'])} |")
    lines.append("")

    curated_only = sorted(reviewed - set(merged))
    lines.append(f"## Dataset pairs no source surfaces ({len(curated_only)})")
    lines.append("")
    if curated_only:
        lines.append("Curated additions — confirm they are intentional:")
        lines.append("")
        for a, b in curated_only:
            fa = _fmt(by_slug[a]) if a in by_slug else f"`{a}` (UNKNOWN SLUG)"
            fb = _fmt(by_slug[b]) if b in by_slug else f"`{b}` (UNKNOWN SLUG)"
            lines.append(f"- {fa} ↔ {fb}")
    else:
        lines.append("None.")
    lines.append("")

    lines.append(f"## Seed pairs outside the taught set ({len(unresolved)})")
    lines.append("")
    for a, b, missing in unresolved:
        lines.append(f"- {a}/{b} — not taught: {' '.join(missing)}")
    if not unresolved:
        lines.append("None.")
    lines.append("")

    os.makedirs(os.path.dirname(REPORT_PATH), exist_ok=True)
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    in_dataset = sum(1 for k in merged if k in reviewed)
    print(f"{len(merged)} candidates ({in_dataset} already in dataset), "
          f"{len(curated_only)} curated-only pairs, "
          f"{len(unresolved)} seed pairs outside taught set")
    print(f"wrote {os.path.relpath(REPORT_PATH, CURRICULUM_DIR)}")


if __name__ == "__main__":
    main()
