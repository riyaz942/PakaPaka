#!/usr/bin/env python3
"""Merge freshly written radical mnemonics into `radicals/mnemonics/k.json`.

Input is a flat {slug: mnemonic_text} JSON file. `image_prompt` is set to the
same text, which is what the Rev 5 backfill did for every stored radical: the
two fields describe the same picture, and writing a second variant for 108
radicals buys nothing the illustrator does not already have.

Every entry goes through `validate_radical` with the fresh-draft gate on, and a
failure blocks only that entry.

    ingest_radicals.py <file.json> [--dry-run]
"""
import argparse
import json
import os
import sys

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CURRICULUM_DIR = os.path.dirname(BUILD_DIR)
sys.path.insert(0, BUILD_DIR)

from generate_content.validate_mnemonics import validate_radical  # noqa: E402

SIDECAR = os.path.join(CURRICULUM_DIR, "radicals", "mnemonics", "k.json")

parser = argparse.ArgumentParser()
parser.add_argument("path")
parser.add_argument("--dry-run", action="store_true")
args = parser.parse_args()

levels = {}
for level in ("n5", "n4", "n3", "n2", "n1"):
    path = os.path.join(CURRICULUM_DIR, "radicals", f"{level}.json")
    with open(path, encoding="utf-8") as f:
        for item in json.load(f)["items"]:
            levels[item["slug"]] = level

with open(SIDECAR, encoding="utf-8") as f:
    sidecar = json.load(f)

incoming = json.load(open(args.path, encoding="utf-8"))
passed, failed = {}, []
for slug, text in incoming.items():
    if slug not in levels:
        failed.append((slug, ["not a taught radical"]))
        continue
    draft = {"mnemonic_text": text, "image_prompt": text}
    errors = validate_radical(levels[slug], slug, draft, enforce_readability=True)
    if errors:
        failed.append((slug, errors))
        continue
    passed[slug] = draft

if not args.dry_run:
    for slug, draft in passed.items():
        sidecar[slug] = {
            **draft,
            "_meta": {
                "generator_model": "claude-opus-5",
                "prompt_version": "1",
                "review_status": "draft",
            },
        }
    with open(SIDECAR, "w", encoding="utf-8") as f:
        json.dump(sidecar, f, ensure_ascii=False, indent=2)
        f.write("\n")

print(f"PASS {len(passed)}   FAIL {len(failed)}")
for slug, errors in failed:
    print(f"  {slug}:")
    for error in errors:
        print(f"    - {error}")
sys.exit(1 if failed else 0)
