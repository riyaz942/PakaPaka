#!/usr/bin/env python3
"""One-time migration: take the level out of every slug, and merge the ten
approved N4 grammar duplicates into their N5 points
(docs/design/level-agnostic-curriculum-plan.md, phase 2).

`slug-renames.json` drives it. A key is `"<kind>:<old>"` and its value is
`"<kind>:<new>"`; two old keys with one new key are a merge. Run it once from
the repo root, then regenerate and compile:

    python3 curriculum/_build/rename_slugs.py --dry-run
    python3 curriculum/_build/rename_slugs.py

It edits source text in place and never touches generated JSON; generate.py
and generate_deps.py rebuild those from the renamed sources.
"""

import argparse
import ast
import json
import os
import re
import subprocess
import sys

BUILD = os.path.dirname(os.path.abspath(__file__))
CURRICULUM = os.path.dirname(BUILD)
ROOT = os.path.dirname(CURRICULUM)
CONTENT = os.path.join(BUILD, "generate_content")
LESSONS = os.path.join(CURRICULUM, "grammar", "lessons")

sys.path.insert(0, BUILD)
sys.path.insert(0, CONTENT)
from frontmatter import parse  # noqa: E402

with open(os.path.join(BUILD, "slug-renames.json"), encoding="utf-8") as f:
    RENAMES = json.load(f)

# {kind: {old: new}} without the identity entries that mark a merge target.
BY_KIND = {}
for old_key, new_key in RENAMES.items():
    kind, old = old_key.split(":", 1)
    if old_key != new_key:
        BY_KIND.setdefault(kind, {})[old] = new_key.split(":", 1)[1]

# {n4 source slug: n5 target slug}
MERGES = {}
for new_key in set(RENAMES.values()):
    olds = [k for k, v in RENAMES.items() if v == new_key]
    if len(olds) > 1:
        target = new_key.split(":", 1)[1]
        for k in olds:
            if k != new_key:
                MERGES[k.split(":", 1)[1]] = target

# The two merges where the N5 lesson is the longer one (maintainer-approved);
# every other merged point takes its N4 lesson.
KEEP_N5_LESSON = {"te-wa-ikenai", "te-mo-ii"}

# Generated from the sources below; regenerate instead of rewriting them. The
# reports here mix kanji and grammar slugs, so a bare `n4-ba` in them has no
# kind this script could read off the file.
GENERATED = re.compile(
    r"^curriculum/(kanji|grammar|radicals|vocabulary|readings)/n[1-5]\.json$"
    r"|^curriculum/dependencies/graph\.json$"
    r"|^curriculum/_build/reports/(content-audit-n[45]\.(md|json)"
    r"|dependency-order\.(md|json)|allowed-vocab-spotcheck\.md)$"
)
SKIP = {"curriculum/_build/slug-renames.json", "curriculum/_build/rename_slugs.py",
        "curriculum/id-registry.json"}


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def write(path, text, dry):
    if not dry:
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)


# --- grammar merges ---------------------------------------------------------

def block_span(src, slug):
    i = src.index(f'        "slug": "{slug}",\n')
    start = src.rfind("\n    {\n", 0, i) + 1
    end = src.index("\n    },\n", i) + len("\n    },\n")
    return start, end


def list_lines(block, field):
    """(start, end, lines) of a multi-line list field inside one entry."""
    head = f'        "{field}": [\n'
    start = block.index(head) + len(head)
    end = block.index("        ],\n", start)
    lines = block[start:end].splitlines(keepends=True)
    for line in lines:
        assert line.startswith("            ") and line.rstrip().endswith(","), line
    return start, end, lines


def string_list(block, field):
    m = re.search(rf'^        "{field}": (\[.*?\]),\n', block, re.M | re.S)
    assert m, field
    return m, ast.literal_eval(m.group(1))


def union(a, b):
    return list(dict.fromkeys(a + b))


def merge_entry(n5_block, n4_block, target):
    for field in ("accepted_forms", "vocabulary_slugs"):
        m5, v5 = string_list(n5_block, field)
        _, v4 = string_list(n4_block, field)
        merged = union(v5, v4)
        if "\n" in m5.group(1):
            items = ", ".join(json.dumps(s, ensure_ascii=False) for s in merged)
            text = f"[\n            {items},\n        ]"
        else:
            text = json.dumps(merged, ensure_ascii=False)
        n5_block = n5_block[:m5.start(1)] + text + n5_block[m5.end(1):]

    def ex_jp(line):
        return eval(line.strip().rstrip(","), {"ex": lambda jp, *_: jp})

    def cloze_key(line):
        c = ast.literal_eval(line.strip().rstrip(","))
        return c["jp_cloze"], c["answer"]

    for field, key in (("examples", ex_jp), ("cloze_variants", cloze_key)):
        s5, e5, l5 = list_lines(n5_block, field)
        _, _, l4 = list_lines(n4_block, field)
        seen = {key(line) for line in l5}
        extra = [line for line in l4 if key(line) not in seen]
        n5_block = n5_block[:e5] + "".join(extra) + n5_block[e5:]

    if '"uses": [' in n4_block and '"uses": [' not in n5_block:
        start = n4_block.index('        "uses": [\n')
        end = n4_block.index("\n        ],\n", start) + len("\n        ],\n")
        close = n5_block.rindex("    },\n")
        n5_block = n5_block[:close] + n4_block[start:end] + n5_block[close:]
    return n5_block


RELATED_RE = re.compile(r"^related_grammar_slugs:\n(?:  - .*\n)*", re.M)


def set_related(text, slugs):
    block = "".join(
        ["related_grammar_slugs:\n"] + [f"  - {json.dumps(s)}\n" for s in slugs]
    ) if slugs else ""
    if RELATED_RE.search(text):
        return RELATED_RE.sub(block, text, count=1)
    close = text.index("\n---\n", 3) + 1
    return text[:close] + block + text[close:]


def merge_grammar(dry, log):
    from n4_grammar import N4_GRAMMAR
    from n5_grammar import N5_GRAMMAR

    n5_slugs = {g["slug"] for g in N5_GRAMMAR}
    n4_order = [g["slug"] for g in N4_GRAMMAR]
    p5 = os.path.join(BUILD, "n5_grammar.py")
    p4 = os.path.join(BUILD, "n4_grammar.py")
    src5, src4 = read(p5), read(p4)
    grammar_map = BY_KIND["grammar"]

    for source, target in sorted(MERGES.items()):
        s4, e4 = block_span(src4, source)
        s5, e5 = block_span(src5, target)
        src5 = src5[:s5] + merge_entry(src5[s5:e5], src4[s4:e4], target) + src5[e5:]
        src4 = src4[:s4] + src4[e4:]

        l5 = os.path.join(LESSONS, "n5", f"{target}.md")
        l4 = os.path.join(LESSONS, "n4", f"{source}.md")
        t5, t4 = read(l5), read(l4)
        kept, other = (t5, t4) if target in KEEP_N5_LESSON else (t4, t5)
        related = union(parse(kept)[0].get("related_grammar_slugs", []),
                        parse(other)[0].get("related_grammar_slugs", []))
        mapped = [grammar_map.get(s, s) for s in related]
        keep = [s for s in dict.fromkeys(mapped) if s in n5_slugs and s != target]
        dropped = [s for s in dict.fromkeys(mapped) if s not in n5_slugs]
        write(l5, set_related(kept, keep), dry)
        if not dry:
            os.remove(l4)
        log.append(
            f"merge {source} -> {target}: lesson from "
            f"{'n5' if target in KEEP_N5_LESSON else 'n4'}; related {keep}"
            + (f"; dropped non-N5 related {dropped}" if dropped else "")
        )

    write(p5, src5, dry)
    write(p4, src4, dry)
    return n4_order


def fix_n4_seeds(n4_order, dry, log):
    """Merged points leave N4, so no N4 seed may require them, and each
    `grammar_cutoff` counts the points that remain among the ones it opened."""
    path = os.path.join(CONTENT, "reading_seeds.py")
    text = read(path)
    start = text.index("N4_SEEDS = [")
    head, n4 = text[:start], text[start:]

    def cutoff(m):
        old = int(m.group(1))
        new = sum(1 for s in n4_order[:old] if s not in MERGES)
        return f'"grammar_cutoff": {new},'

    n4 = re.sub(r'"grammar_cutoff": (\d+),', cutoff, n4)

    def required(m):
        items = ast.literal_eval(m.group(1))
        kept = [s for s in items if s not in MERGES]
        if kept == items:
            return m.group(0)
        log.append(f"seed required_grammar {items} -> {kept}")
        return f'"required_grammar": {json.dumps(kept)}'

    n4 = re.sub(r'"required_grammar": (\[.*?\])', required, n4, flags=re.S)
    write(path, head + n4, dry)


# --- kanji datasets ---------------------------------------------------------

def kanji_datasets(dry):
    kanji_map = BY_KIND["kanji"]
    for level in ("n5", "n4"):
        path = os.path.join(BUILD, f"{level}_kanji.py")

        def slug(m):
            return f'"slug": "{kanji_map[f"{level}-{m.group(1)}"]}"'

        write(path, re.sub(r'"suffix": "([a-z0-9-]+)"', slug, read(path)), dry)


# --- token pass ---------------------------------------------------------------

OLD_KINDS = {}
for kind, mapping in BY_KIND.items():
    for old in mapping:
        OLD_KINDS.setdefault(old, set()).add(kind)
AMBIGUOUS = {old for old, kinds in OLD_KINDS.items() if len(kinds) > 1}
TYPED_RE = re.compile(
    r"\b(radical|kanji|vocabulary|grammar):([a-z0-9-]+)"
)
BARE_RE = re.compile(r"(?<![A-Za-z0-9_-])((?:n[45]|k)-[a-z0-9]+(?:-[a-z0-9]+)*)(?![A-Za-z0-9_-])")


def file_kind(rel):
    """Which kind a bare slug in AMBIGUOUS (a kanji and an N4 grammar point
    both had it) means in this file."""
    name = os.path.basename(rel)
    if ("/kanji/" in rel or "kanji" in name or "radicals" in rel
            or name in {"bands.json", "skeleton.json", "decomposition.json",
                        "visually_similar.py", "audit_facts.py", "audit_shipped.py",
                        "derive_visually_similar.py", "fact-audit.md",
                        "visually-similar-candidates.md"}):
        return "kanji"
    if any(part in rel for part in ("grammar", "reading", "passage", "lessons",
                                    "drafts/n4")):
        return "grammar"
    return None


def rename_text(rel, text, unresolved):
    def typed(m):
        kind, slug = m.group(1), m.group(2)
        new = BY_KIND.get(kind, {}).get(slug)
        return f"{kind}:{new}" if new else m.group(0)

    text = TYPED_RE.sub(typed, text)
    hint = file_kind(rel)

    def bare(m):
        old = m.group(1)
        kinds = OLD_KINDS.get(old)
        if not kinds:
            return old
        if old in AMBIGUOUS:
            if hint not in kinds:
                unresolved.append(f"{rel}: {old}")
                return old
            return BY_KIND[hint][old]
        return BY_KIND[next(iter(kinds))][old]

    return BARE_RE.sub(bare, text)


def tracked_files():
    out = subprocess.run(
        ["git", "ls-files", "curriculum", "docs/workflows"],
        cwd=ROOT, capture_output=True, text=True, check=True,
    ).stdout.split("\n")
    return [p for p in out if p and p not in SKIP and not GENERATED.match(p)]


def draft_files():
    out = []
    for folder in ("drafts", "web"):
        base = os.path.join(CONTENT, folder)
        for dirpath, _, names in os.walk(base):
            for name in names:
                out.append(os.path.relpath(os.path.join(dirpath, name), ROOT))
    return out


def token_pass(dry, log):
    unresolved = []
    changed = 0
    for rel in tracked_files() + draft_files():
        path = os.path.join(ROOT, rel)
        if not os.path.isfile(path):
            continue
        try:
            text = read(path)
        except UnicodeDecodeError:
            continue
        new = rename_text(rel, text, unresolved)
        if new != text:
            changed += 1
            write(path, new, dry)
    log.append(f"token pass: {changed} files changed")
    return unresolved


def rename_files(dry, log):
    moves = []
    grammar_map = BY_KIND["grammar"]
    for name in sorted(os.listdir(os.path.join(LESSONS, "n4"))):
        stem = name[:-3]
        if stem in grammar_map and stem not in MERGES:
            moves.append((os.path.join(LESSONS, "n4", name),
                          os.path.join(LESSONS, "n4", grammar_map[stem] + ".md")))
    for rel in draft_files():
        stem, _, ext = os.path.basename(rel).partition(".")
        kind = file_kind(rel)
        new = BY_KIND.get(kind, {}).get(stem) if kind else None
        if new:
            src = os.path.join(ROOT, rel)
            moves.append((src, os.path.join(os.path.dirname(src), f"{new}.{ext}")))
    for src, dst in moves:
        if os.path.exists(dst):
            log.append(f"skip rename, target exists: {os.path.relpath(dst, ROOT)}")
            continue
        if not dry:
            os.rename(src, dst)
    log.append(f"file renames: {len(moves)}")


# --- id registry --------------------------------------------------------------

def rename_registry(dry, log):
    path = os.path.join(CURRICULUM, "id-registry.json")
    registry = json.loads(read(path))
    items = registry["items"]
    ids, retired = {}, dict(items["retired"])
    merged_away = {f"grammar:{s}" for s in MERGES}
    for key, item_id in items["ids"].items():
        if key in merged_away:
            retired[key] = item_id
            continue
        new_key = RENAMES.get(key, key)
        assert new_key not in ids, new_key
        ids[new_key] = item_id
    items["ids"] = dict(sorted(ids.items(), key=lambda kv: kv[1]))
    items["retired"] = dict(sorted(retired.items(), key=lambda kv: kv[1]))
    write(path, json.dumps(registry, indent=2, ensure_ascii=False) + "\n", dry)
    log.append(f"registry: {len(ids)} ids, {len(retired)} retired")


# --- passage grammar lists ------------------------------------------------------

def sort_grammar_slugs(dry, log):
    """A merged N4 slug becomes its N5 point, which the list may already hold."""
    for rel in ("curriculum/_build/n4_readings.py",
                "curriculum/_build/generate_content/passages/n4.json"):
        path = os.path.join(ROOT, rel)
        text = read(path)

        def fix(m):
            indent, body, close = m.group(1), m.group(2), m.group(3)
            items = json.loads("[" + body + "]")
            clean = sorted(set(items))
            if clean == items:
                return m.group(0)
            inner = ",\n".join(f"{indent}{json.dumps(s, ensure_ascii=False)}" for s in clean)
            return f'"grammar_slugs": [\n{inner}\n{close}]'

        new = re.sub(r'"grammar_slugs": \[\n( +)(.*?)\n( *)\]', fix, text, flags=re.S)
        if new != text:
            log.append(f"deduped grammar_slugs in {rel}")
            write(path, new, dry)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    dry = ap.parse_args().dry_run
    log = []
    n4_order = merge_grammar(dry, log)
    fix_n4_seeds(n4_order, dry, log)
    kanji_datasets(dry)
    unresolved = token_pass(dry, log)
    if unresolved:
        print("Unresolved kind for an ambiguous slug:", *unresolved, sep="\n  ")
        if not dry:
            sys.exit(1)
    if not dry:
        rename_files(dry, log)
        rename_registry(dry, log)
        sort_grammar_slugs(dry, log)
    print("\n".join(log))


if __name__ == "__main__":
    main()
