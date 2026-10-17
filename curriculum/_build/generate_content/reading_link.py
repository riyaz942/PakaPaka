# -*- coding: utf-8 -*-
"""Reading-link fix lane
(docs/superpowers/specs/2026-10-17-reading-mnemonic-meaning-link-design.md).

Stored N5 + N4 reading mnemonics whose scene does not continue the meaning
mnemonic's scene get a new `reading_mnemonic`. Whether a scene connects is a
judgment, so triage and rewrite are the agent's work
(prompts/reading-link-triage.md, prompts/reading-link-rewrite.md). This module
does the mechanical steps around them:

    select      write reports/reading-link-candidates.json
    check-list  check reports/reading-link-list.json against the candidates
    apply       gate reports/reading-link-rewrites.json and write the passing
                readings into the sidecars (--dry-run: gate only)
    verify      compare the sidecars with a git ref: only marked readings moved

Usage (from curriculum/_build):
    .venv/bin/python -m generate_content.reading_link select
    .venv/bin/python -m generate_content.reading_link check-list
    .venv/bin/python -m generate_content.reading_link apply --model <model> [--dry-run]
    .venv/bin/python -m generate_content.reading_link verify --base <git-ref>
"""

import argparse
import json
import os
import subprocess
import sys

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BUILD_DIR)

from generate_content import cast as cast_lib  # noqa: E402
from generate_content import mnemonic_context as mc  # noqa: E402
from generate_content.validate_mnemonics import validate_draft  # noqa: E402

LEVELS = ("n5", "n4")
KINDS = ("kanji", "vocab")
ITEM_DIR = {"kanji": "kanji", "vocab": "vocabulary"}
SIDECAR = {kind: os.path.join(mc.CURRICULUM_DIR, ITEM_DIR[kind], "mnemonics.json")
           for kind in KINDS}
REPORTS_DIR = os.path.join(BUILD_DIR, "reports")
CANDIDATES_PATH = os.path.join(REPORTS_DIR, "reading-link-candidates.json")
CALIBRATION_PATH = os.path.join(REPORTS_DIR, "reading-link-calibration.json")
LIST_PATH = os.path.join(REPORTS_DIR, "reading-link-list.json")
REWRITES_PATH = os.path.join(REPORTS_DIR, "reading-link-rewrites.json")
MAX_REASON_WORDS = 12


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def dump_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def levels_by_slug(kind, levels=LEVELS):
    return {it["slug"]: lvl for lvl in levels
            for it in mc.load_items(ITEM_DIR[kind], lvl)}


def select_candidates(sidecars, levels=LEVELS):
    """Every N5 + N4 item whose reading mnemonic triage must judge: reviewed
    kanji, and vocabulary whose reading is a story — a word with no reading
    mnemonic, or one pointing back at the earlier word that taught the sound,
    has no scene to connect."""
    cast = cast_lib.load_cast()
    teachers = mc._reading_teachers()
    out = []
    for kind in KINDS:
        for slug, level in levels_by_slug(kind, levels).items():
            entry = sidecars[kind].get(slug) or {}
            reading_mnemonic = entry.get("reading_mnemonic")
            if not reading_mnemonic:
                continue
            if kind == "kanji" and entry.get("_meta", {}).get("review_status") != "reviewed":
                continue
            if kind == "vocab" and teachers.get(slug):
                continue
            if kind == "kanji":
                ctx = mc.kanji_context(level, slug, cast=cast)
                form, reading = ctx["char"], ctx["primary_reading"]
            else:
                ctx = mc.vocab_context(level, slug, cast=cast)
                form, reading = ctx["form"], ctx["reading"]
            out.append({
                "kind": kind,
                "slug": slug,
                "level": level,
                "form": form,
                "meaning": ctx["meaning"],
                "reading": reading,
                "cast": [f"{lore['reading']}: {lore['character']}"
                         for lore in ctx["reading_lore"]],
                "meaning_mnemonic": entry.get("meaning_mnemonic", ""),
                "reading_mnemonic": reading_mnemonic,
            })
    return out


def list_errors(candidates, listing):
    """Every candidate exactly once in `marked` or `kept`, a short reason on
    every marked row, and stats that match."""
    want = {(c["kind"], c["slug"]) for c in candidates}
    seen = {}
    errors = []
    for bucket in ("marked", "kept"):
        for row in listing.get(bucket, []):
            key = (row.get("kind"), row.get("slug"))
            name = f"{key[0]}/{key[1]}"
            if key not in want:
                errors.append(f"{bucket}: {name} is not a candidate")
            elif key in seen:
                errors.append(f"{name} appears twice ({seen[key]} and {bucket})")
            seen.setdefault(key, bucket)
            if bucket == "marked":
                words = (row.get("reason") or "").split()
                if not words:
                    errors.append(f"marked: {name} has no reason")
                elif len(words) > MAX_REASON_WORDS:
                    errors.append(f"marked: {name} reason is {len(words)} words; "
                                  f"keep it to {MAX_REASON_WORDS}")
    for kind, slug in sorted(want - set(seen)):
        errors.append(f"{kind}/{slug} is in neither marked nor kept")
    stats = listing.get("stats", {})
    if stats.get("total") != len(candidates):
        errors.append(f"stats.total is {stats.get('total')}; there are {len(candidates)} candidates")
    if stats.get("marked") != len(listing.get("marked", [])):
        errors.append(f"stats.marked is {stats.get('marked')}; "
                      f"marked has {len(listing.get('marked', []))} rows")
    return errors


EDITED_SINCE_SELECT = "reading_mnemonic changed since select (a Studio edit?); not overwritten"


def apply_rewrites(sidecars, listing, rewrites, model, candidates, levels=LEVELS):
    """Gate each rewrite and return (updated sidecars, failures). Only the
    `reading_mnemonic` errors count: a stored meaning mnemonic predates the
    fresh-draft rules, and this lane does not touch it. A rewrite for an item
    triage did not mark is refused. A row whose text is already stored is
    skipped, so a re-run keeps its review status; a stored reading that is
    neither the row nor the one select saw was edited after the rewrite and
    is refused."""
    marked = {(row["kind"], row["slug"]) for row in listing.get("marked", [])}
    selected = {(c["kind"], c["slug"]): c["reading_mnemonic"] for c in candidates}
    level_of = {kind: levels_by_slug(kind, levels) for kind in KINDS}
    updated = {kind: dict(entries) for kind, entries in sidecars.items()}
    failures = {}
    for row in rewrites:
        kind, slug, text = row["kind"], row["slug"], row["reading_mnemonic"]
        name = f"{kind}/{slug}"
        if (kind, slug) not in marked:
            failures[name] = ["not in the marked list"]
            continue
        entry = updated[kind][slug]
        if entry.get("reading_mnemonic") == text:
            continue
        if entry.get("reading_mnemonic") != selected.get((kind, slug)):
            failures[name] = [EDITED_SINCE_SELECT]
            continue
        draft = {k: v for k, v in entry.items() if k != "_meta"}
        draft["reading_mnemonic"] = text
        errors = [e for e in validate_draft(level_of[kind][slug], kind, slug, draft,
                                            enforce_readability=True)
                  if e.startswith("reading_mnemonic")]
        if errors:
            failures[name] = errors
            continue
        updated[kind][slug] = {
            **entry,
            "reading_mnemonic": text,
            "_meta": {**entry.get("_meta", {}), "generator_model": model,
                      "review_status": "draft"},
        }
    return updated, failures


def untouched_errors(base, current, listing):
    """Unmarked entries byte-identical; on marked entries only
    `reading_mnemonic` and `_meta` (minus prompt_version) may differ."""
    marked = {(row["kind"], row["slug"]) for row in listing.get("marked", [])}
    errors = []
    for kind in KINDS:
        b, c = base[kind], current[kind]
        if set(b) != set(c):
            errors.append(f"{kind}: slug set changed")
        for slug in sorted(set(b) & set(c)):
            if (kind, slug) not in marked:
                if b[slug] != c[slug]:
                    errors.append(f"{kind}/{slug} changed but is not marked")
                continue
            for field in sorted(set(b[slug]) | set(c[slug])):
                if field in ("reading_mnemonic", "_meta"):
                    continue
                if b[slug].get(field) != c[slug].get(field):
                    errors.append(f"{kind}/{slug} {field} changed")
            if (b[slug].get("_meta", {}).get("prompt_version")
                    != c[slug].get("_meta", {}).get("prompt_version")):
                errors.append(f"{kind}/{slug} _meta.prompt_version changed")
    return errors


def _git_sidecars(ref):
    repo = os.path.dirname(mc.CURRICULUM_DIR)
    out = {}
    for kind in KINDS:
        rel = os.path.relpath(SIDECAR[kind], repo)
        text = subprocess.run(["git", "show", f"{ref}:{rel}"], cwd=repo, check=True,
                              capture_output=True, text=True).stdout
        out[kind] = json.loads(text)
    return out


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("select")
    sub.add_parser("check-list")
    apply_p = sub.add_parser("apply")
    apply_p.add_argument("--model", required=True,
                         help="provenance recorded in _meta.generator_model")
    apply_p.add_argument("--dry-run", action="store_true", help="gate only, write nothing")
    verify_p = sub.add_parser("verify")
    verify_p.add_argument("--base", required=True,
                          help="git ref holding the sidecars before the rewrite")
    args = parser.parse_args(argv)

    sidecars = {kind: load_json(SIDECAR[kind]) for kind in KINDS}
    if args.cmd == "select":
        candidates = select_candidates(sidecars)
        dump_json(CANDIDATES_PATH, candidates)
        counts = {kind: sum(c["kind"] == kind for c in candidates) for kind in KINDS}
        print(f"wrote {len(candidates)} candidate(s) to {CANDIDATES_PATH} "
              f"({counts['kanji']} kanji, {counts['vocab']} vocab)")
        return 0
    if args.cmd == "check-list":
        errors = list_errors(load_json(CANDIDATES_PATH), load_json(LIST_PATH))
        for e in errors:
            print(f"  - {e}")
        print("list OK" if not errors else f"{len(errors)} list error(s)")
        return 1 if errors else 0
    if args.cmd == "apply":
        rewrites = load_json(REWRITES_PATH)
        updated, failures = apply_rewrites(sidecars, load_json(LIST_PATH), rewrites, args.model,
                                           load_json(CANDIDATES_PATH))
        for name, errors in failures.items():
            print(f"FAIL {name}")
            for e in errors:
                print(f"  - {e}")
        if not args.dry_run:
            for kind in KINDS:
                if updated[kind] != sidecars[kind]:
                    dump_json(SIDECAR[kind], updated[kind])
        verb = "checked" if args.dry_run else "applied"
        print(f"{verb} {len(rewrites) - len(failures)} of {len(rewrites)} rewrite(s); "
              f"{len(failures)} failing")
        return 1 if failures else 0
    if args.cmd == "verify":
        errors = untouched_errors(_git_sidecars(args.base), sidecars, load_json(LIST_PATH))
        for e in errors:
            print(f"  - {e}")
        print("verify OK" if not errors else f"{len(errors)} unexpected change(s)")
        return 1 if errors else 0
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
