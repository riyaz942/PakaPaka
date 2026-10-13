# -*- coding: utf-8 -*-
"""What the current levels break (level-agnostic curriculum plan, phase 4).

Run it after a move in `_build/levels.json` and the regenerate steps in
`curriculum/README.md`. It reads the generated curriculum JSON and lists every
place an item leans on an item taught at a *later* level:

  * Sentences: a vocabulary or grammar example, a grammar use, a
    passage body or question whose text uses a word taught later. The check is
    `level_check`, the same tokenizer gate content generation uses.
  * Links: an example's or grammar point's `vocabulary_slugs`, a lesson's
    `related_grammar_slugs`, a passage's `vocabulary_slugs` / `grammar_slugs`
    that name a later item.
  * Edges: a `dependencies/graph.json` edge whose prerequisite is taught later
    (a kanji before one of its radicals). `dependency_order.py` reports edge
    order in full.
  * Words written with a later kanji: they lose their reading prompt until the
    kanji reaches guru. A count per level, and the words of each kanji that
    levels.json moves.
  * Reading seeds: `reading_seeds.ladder_errors` / `grammar_coverage_errors`,
    and a `CORE_SEED_SLUGS` word that is no longer at its level.

It only reports, and it always exits 0. What to fix after a move is the
maintainer's call. Words inside one level are not checked here: the
generation gates (`validate_examples`, `validate_readings`)
own the position windows.

Writes curriculum/_build/reports/level-report.md. Run (from anywhere):
    curriculum/_build/.venv/bin/python curriculum/_build/reports/level_report.py
"""

import json
import os
import sys

REPORTS_DIR = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR = os.path.dirname(REPORTS_DIR)
CURRICULUM_DIR = os.path.dirname(BUILD_DIR)

sys.path.insert(0, BUILD_DIR)

from generate_content import context, level_check, reading_seeds  # noqa: E402
from levels import LEVEL_ORDER, LEVELS_PATH  # noqa: E402


#: item_type -> the folder its level files live in.
KIND_DIRS = {
    "radical": "radicals",
    "kanji": "kanji",
    "vocabulary": "vocabulary",
    "grammar": "grammar",
}


def load_level(folder, level):
    path = os.path.join(CURRICULUM_DIR, folder, f"{level}.json")
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return data.get("items", data.get("passages", []))


def load_curriculum():
    """({item_type: {level: [item]}}, {level: [passage]}, {(type, slug): level})."""
    items = {kind: {level: load_level(folder, level) for level in LEVEL_ORDER}
             for kind, folder in KIND_DIRS.items()}
    passages = {level: load_level("readings", level) for level in LEVEL_ORDER}
    level_of = {(kind, item["slug"]): level
                for kind, by_level in items.items()
                for level, entries in by_level.items()
                for item in entries}
    return items, passages, level_of


def later(level, other):
    return other is not None and LEVEL_ORDER.index(other) > LEVEL_ORDER.index(level)


class SentenceCheck:
    """Finds words in a sentence that are taught after the sentence's level."""

    def __init__(self, items):
        vocab = items["vocabulary"]
        self.index_at = {level: level_check.build_allowed_index(vocab[level])
                         for level in LEVEL_ORDER}
        self.allowed = {}
        self.patterns = {}
        allowed, grammar = set(), []
        for level in LEVEL_ORDER:
            allowed |= self.index_at[level]
            grammar += items["grammar"][level]
            self.allowed[level] = set(allowed)
            # A grammar point's own machinery (すぎる, しれる) is not vocabulary.
            self.patterns[level] = level_check.pattern_words(grammar)

    def later_words(self, text, level):
        found = []
        for violation in level_check.find_violations(
                text, self.allowed[level], self.patterns[level]):
            surface, _, base = violation.rpartition(" (")
            keys = {surface, base.rstrip(")")}
            for other in LEVEL_ORDER[LEVEL_ORDER.index(level) + 1:]:
                if keys & self.index_at[other]:
                    found.append(f"{surface} ({other.upper()})")
                    break
        return found


def sentences(items, passages):
    """(level, owner label, text) for every sentence the app shows."""
    for level in LEVEL_ORDER:
        for v in items["vocabulary"][level]:
            for s in v.get("example_sentences", []):
                yield level, f"vocabulary {v['slug']}", s["japanese"]
        for g in items["grammar"][level]:
            for s in g.get("example_sentences", []):
                yield level, f"grammar {g['slug']}", s["japanese"]
            for use in g.get("uses", []):
                yield level, f"grammar {g['slug']} use", use["japanese"]
        for p in passages[level]:
            yield level, f"passage {p['slug']}", p["body"]
            for q in p.get("questions", []):
                yield level, f"passage {p['slug']} question", q["prompt"]


def link_problems(items, passages, level_of):
    """Links from an item to a later item."""
    problems = []

    def check(level, owner, kind, slugs):
        for slug in slugs:
            other = level_of.get((kind, slug))
            if later(level, other):
                problems.append((level, f"{owner} links {kind} `{slug}` ({other.upper()})"))

    for level in LEVEL_ORDER:
        for v in items["vocabulary"][level]:
            for s in v.get("example_sentences", []):
                check(level, f"vocabulary `{v['slug']}` example", "vocabulary",
                      s.get("vocabulary_slugs", []))
        for g in items["grammar"][level]:
            owner = f"grammar `{g['slug']}`"
            check(level, owner, "vocabulary", g.get("vocabulary_slugs", []))
            for s in g.get("example_sentences", []):
                check(level, f"{owner} example", "vocabulary", s.get("vocabulary_slugs", []))
            check(level, f"{owner} lesson", "grammar", g.get("related_grammar_slugs", []))
        for p in passages[level]:
            owner = f"passage `{p['slug']}`"
            check(level, owner, "vocabulary", p.get("vocabulary_slugs", []))
            check(level, owner, "grammar", p.get("grammar_slugs", []))
    return problems


def edge_problems(level_of):
    with open(os.path.join(CURRICULUM_DIR, "dependencies", "graph.json"),
              encoding="utf-8") as f:
        edges = json.load(f)["edges"]
    problems = []
    for e in edges:
        if e["relationship_type"] not in ("builds_on", "requires"):
            continue
        if e["relationship_type"] == "builds_on" and e["from_type"] != "radical":
            continue  # kanji -> word builds_on is the out-of-band reading gate, by design
        source = level_of.get((e["from_type"], e["from_slug"]))
        target = level_of.get((e["to_type"], e["to_slug"]))
        if target and later(target, source):
            problems.append((
                target,
                f"{e['to_type']} `{e['to_slug']}` ({target.upper()}) {e['relationship_type']} "
                f"{e['from_type']} `{e['from_slug']}` ({source.upper()})",
            ))
    return problems


def waiting_words(level_of, moved):
    """({word level: count}, problems) for words written with a later kanji.

    Such a word is still taught, but `generate_deps.py` gives the kanji a
    `builds_on` edge instead of `requires`, so the word is asked for its meaning
    only until the kanji reaches guru. That is by design for about 2,000 words,
    so only the count per level is shown, plus the words of each kanji that
    levels.json moves."""
    with open(os.path.join(CURRICULUM_DIR, "dependencies", "graph.json"),
              encoding="utf-8") as f:
        edges = json.load(f)["edges"]
    words = {level: set() for level in LEVEL_ORDER}
    by_kanji = {}
    for e in edges:
        if (e["from_type"], e["to_type"], e["relationship_type"]) != (
                "kanji", "vocabulary", "builds_on"):
            continue
        level = level_of[("vocabulary", e["to_slug"])]
        words[level].add(e["to_slug"])
        by_kanji.setdefault(e["from_slug"], []).append((level, e["to_slug"]))
    problems = []
    for key, level in moved.items():
        kind, _, slug = key.partition(":")
        if kind == "kanji" and by_kanji.get(slug):
            for word_level, word in sorted(by_kanji[slug]):
                problems.append((word_level, f"vocabulary `{word}` waits for kanji "
                                             f"`{slug}` ({level.upper()})"))
    return {level: len(slugs) for level, slugs in words.items()}, problems


def seed_problems(level_of):
    problems = []
    for level in reading_seeds.SEEDS:
        for error in (reading_seeds.ladder_errors(level)
                      + reading_seeds.grammar_coverage_errors(level)):
            problems.append((level, error))
        for slug in context.CORE_SEED_SLUGS.get(level, []):
            other = level_of.get(("vocabulary", slug))
            if other != level:
                problems.append((
                    level,
                    f"CORE_SEED_SLUGS[{level!r}] word `{slug}` is "
                    f"{other.upper() if other else 'not in the curriculum'}",
                ))
    return problems


def overrides():
    with open(LEVELS_PATH, encoding="utf-8") as f:
        return {k: v for k, v in json.load(f).items() if not k.startswith("_")}


def render(sections, moved, waiting):
    out = ["# Level report\n",
           "Generated by `curriculum/_build/reports/level_report.py`. Do not edit by hand.\n",
           "Places where an item leans on an item taught at a later level. The build "
           "does not fail on these; decide what to fix after a move. Some were there "
           "before any move, so read `git diff` of this file to see what a move "
           "added.\n",
           "## Overrides in `levels.json`\n"]
    out += [f"- `{key}`: {level.upper()}" for key, level in moved.items()] or ["None."]
    out.append("")
    out.append("## Words that wait for a later kanji\n")
    out.append("Taught on schedule, but asked for the meaning only until the later "
               "kanji reaches guru. By design; a move changes the counts.\n")
    out.append("| Word level | Words |")
    out.append("| --- | ---: |")
    out += [f"| {level.upper()} | {waiting[level]} |" for level in LEVEL_ORDER]
    out.append("")
    for title, problems in sections:
        out.append(f"## {title} ({len(problems)})\n")
        if not problems:
            out.append("None.\n")
            continue
        for level, text in sorted(problems, key=lambda p: (LEVEL_ORDER.index(p[0]), p[1])):
            out.append(f"- {level.upper()}: {text}")
        out.append("")
    return "\n".join(out)


def main():
    items, passages, level_of = load_curriculum()
    check = SentenceCheck(items)
    sentence_problems = []
    for level, owner, text in sentences(items, passages):
        words = check.later_words(text, level)
        if words:
            sentence_problems.append((level, f"{owner}: {', '.join(words)} — {text}"))
    moved = overrides()
    waiting, waiting_problems = waiting_words(level_of, moved)
    sections = [
        ("Sentences that use a later word", sentence_problems),
        ("Links to a later item", link_problems(items, passages, level_of)),
        ("Edges from a later prerequisite", edge_problems(level_of)),
        ("Words written with a kanji that levels.json moved later", waiting_problems),
        ("Reading seeds", seed_problems(level_of)),
    ]
    with open(os.path.join(REPORTS_DIR, "level-report.md"), "w", encoding="utf-8") as f:
        f.write(render(sections, moved, waiting))
    for title, problems in sections:
        print(f"  {title}: {len(problems)}")
    print("Wrote reports/level-report.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
