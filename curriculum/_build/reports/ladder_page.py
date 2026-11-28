# -*- coding: utf-8 -*-
"""One HTML page of the built ladder: every level with its radicals, kanji, words,
grammar points and passages, and the work still to do.

Reads `_build/ladder.json`, `_build/reports/ladder-worklist.json` and the item files.
Does not run the tokenizer. The marks are only as new as the worklist: run
`ladder_report.py` first (a few minutes) when you need them fresh.

  Solid pink  = work before release (the worklist's pre-release lists, and missing passages).
  Dashed blue = work for the later phase (vocabulary lists).

Run (from anywhere):
    python3 curriculum/_build/reports/ladder_page.py [OUT.html]
Default OUT: docs/design/level-ladder-simulation/level-ladder-current.html
"""

import html
import json
import os
import sys
from collections import defaultdict
from datetime import datetime

REPORTS_DIR = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR = os.path.dirname(REPORTS_DIR)
CURRICULUM_DIR = os.path.dirname(BUILD_DIR)
REPO_DIR = os.path.dirname(CURRICULUM_DIR)
DEFAULT_OUT = os.path.join(REPO_DIR, "docs", "design", "level-ladder-simulation",
                           "level-ladder-current.html")

PASSAGES_PER_LEVEL = 3

#: worklist key -> (content type, reason shown on hover)
PINK = {
    "radical_mnemonics": ("radical", "no mnemonic"),
    "radical_mnemonics_part_later": ("radical", "mnemonic uses a part taught later"),
    "kanji_mnemonics": ("kanji", "no mnemonic"),
    "kanji_mnemonics_radical_mismatch": ("kanji", "mnemonic names an unknown or later radical"),
    "grammar_pool_points": ("grammar", "fails the sentence pool gate"),
    "grammar_links_above_level": ("grammar", "linked word at a later level"),
    "grammar_mnemonics_above_level": ("grammar", "mnemonic example uses a later word"),
}
BLUE = {
    "vocab_examples_above_level": ("vocabulary", "example sentence uses a later word"),
    "vocab_mnemonics_pending": ("vocabulary", "mnemonic waits on its kanji"),
}


def read(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def reasons(worklist, table):
    """{(type, slug): [reason, ...]}"""
    found = defaultdict(list)
    for key, (kind, why) in table.items():
        for slug in worklist.get(key, []):
            found[(kind, slug)].append(why)
    return found


def label(kind, item):
    if kind == "grammar":
        return item["primary_form"] + " " + item["meaning"]
    if kind == "vocabulary":
        return item["primary_form"]
    return item["primary_form"]


def chip(kind, slug, text, pink, blue):
    cls, tip = "chip", [slug]
    if (kind, slug) in pink:
        cls += " pink"
        tip += pink[(kind, slug)]
    elif (kind, slug) in blue:
        cls += " blue"
        tip += blue[(kind, slug)]
    return f'<span class="{cls}" title="{html.escape("; ".join(tip))}">{html.escape(text)}</span>'


def main(out):
    ladder = read(os.path.join(BUILD_DIR, "ladder.json"))
    worklist = read(os.path.join(REPORTS_DIR, "ladder-worklist.json"))
    stamp = datetime.fromtimestamp(os.path.getmtime(
        os.path.join(REPORTS_DIR, "ladder-worklist.json"))).strftime("%d %b %Y %H:%M")
    pink, blue = reasons(worklist, PINK), reasons(worklist, BLUE)

    items = {
        "radical": read(os.path.join(CURRICULUM_DIR, "radicals", "items.json"))["items"],
        "kanji": read(os.path.join(CURRICULUM_DIR, "kanji", "items.json"))["items"],
        "vocabulary": read(os.path.join(CURRICULUM_DIR, "vocabulary", "items.json"))["items"],
        "grammar": read(os.path.join(CURRICULUM_DIR, "grammar", "items.json"))["items"],
    }
    passages = {p["slug"]: p for p in
                read(os.path.join(CURRICULUM_DIR, "readings", "items.json"))["passages"]}

    by_level = {n: defaultdict(list) for n in range(1, 61)}
    for kind, rows in items.items():
        for item in rows:
            entry = ladder[kind][item["slug"]]
            by_level[entry["level"]][kind].append((entry["sort_order"], item))
    for slug, entry in ladder["passage"].items():
        by_level[entry["level"]]["passage"].append((entry["sort_order"], passages[slug]))

    short = {w["level"]: w["missing"] for w in worklist.get("reading_passages", [])}
    jlpt = {}
    for row in ladder["jlpt_equivalence"]:
        for n in range(row["first_level"], row["last_level"] + 1):
            jlpt[n] = row["jlpt"]

    totals = {k: len(v) for k, v in ladder.items() if isinstance(v, dict)}
    counts = {"pink": len(pink) + sum(short.values()), "blue": len(blue)}

    parts = [f"""<!doctype html><meta charset="utf-8"><title>Level ladder</title>
<style>
body{{font:15px/1.5 system-ui,sans-serif;margin:2rem auto;max-width:1100px;padding:0 1rem;color:#222}}
h1{{margin-bottom:.2rem}} .sub{{color:#666;margin-bottom:1rem}}
.level{{border:1px solid #ddd;border-radius:8px;margin:.8rem 0;padding:.6rem 1rem}}
.level h2{{margin:.1rem 0;font-size:1.1rem}} .level h2 small{{color:#888;font-weight:400}}
h3{{margin:.6rem 0 .2rem;font-size:.85rem;color:#555;text-transform:uppercase}}
.chip{{display:inline-block;margin:2px;padding:1px 7px;border:1px solid #ccc;border-radius:5px;
background:#fafafa}} .pink{{background:#ffd6e0;border:1px solid #e0446d}}
.blue{{border:1px dashed #2f6fdd;background:#eef4ff}}
.slot{{display:inline-block;margin:2px;padding:1px 7px;border:1px solid #e0446d;border-radius:5px;
background:#ffd6e0;font-style:italic}} summary{{cursor:pointer;color:#555}}
nav a{{margin-right:.4rem}}
</style>
<h1>Level ladder</h1>
<div class="sub">Built ladder: {totals['radical']} radicals, {totals['kanji']} kanji,
{totals['vocabulary']} words, {totals['grammar']} grammar points, {totals['passage']} passages.
Marks come from the worklist of {stamp}.<br>
<span class="chip pink">solid pink</span> {counts['pink']} things to do before release
&nbsp; <span class="chip blue">dashed blue</span> {counts['blue']} for the later phase.
Hover a mark to see why.</div>"""]

    for n in range(1, 61):
        lv = by_level[n]
        head = f"Level {n}" + (f' <small>{jlpt[n]}</small>' if n in jlpt else "")
        parts.append(f'<div class="level" id="l{n}"><h2>{head} <small>'
                     f'{len(lv["radical"])} radicals · {len(lv["kanji"])} kanji · '
                     f'{len(lv["vocabulary"])} words · {len(lv["grammar"])} grammar · '
                     f'{len(lv["passage"])} passages</small></h2>')
        for kind, title in (("radical", "Radicals"), ("kanji", "Kanji"), ("grammar", "Grammar")):
            if lv[kind]:
                parts.append(f"<h3>{title}</h3>" + "".join(
                    chip(kind, i["slug"], label(kind, i), pink, blue)
                    for _, i in sorted(lv[kind], key=lambda x: x[0])))
        if lv["vocabulary"]:
            parts.append(f'<h3>Words</h3><details><summary>show {len(lv["vocabulary"])} words'
                         "</summary>" + "".join(
                             chip("vocabulary", i["slug"], label("vocabulary", i), pink, blue)
                             for _, i in sorted(lv["vocabulary"], key=lambda x: x[0]))
                         + "</details>")
        if lv["passage"] or short.get(n):
            parts.append("<h3>Passages</h3>" + "".join(
                f'<span class="chip" title="{html.escape(p["slug"])}">{html.escape(p["title"])}</span>'
                for _, p in sorted(lv["passage"], key=lambda x: x[0])) +
                '<span class="slot" title="passage not written">empty slot</span>' * short.get(n, 0))
        parts.append("</div>")

    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        f.write("\n".join(parts))
    print(f"wrote {out}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_OUT)
