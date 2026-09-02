#!/usr/bin/env python3
"""Rev 6 restyle pass: rewrite the meaning mnemonic of every *draft* kanji into
the short, plain, causally-chained house style, leaving reading mnemonics,
descriptions and every reviewed item untouched.

    dump   — write per-batch briefs for the rewrite subagents
    ingest — validate each rewritten meaning through the gate and merge it back

Nothing here touches a reviewed item, and nothing sets review_status.
"""
import argparse
import glob
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from generate_content import mnemonic_context as mc
from generate_content.validate_mnemonics import validate_kanji

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIDECARS = os.path.join(ROOT, "kanji", "mnemonics")
KANJI_JSON = os.path.join(ROOT, "kanji")
WORK = os.path.join(os.path.dirname(os.path.abspath(__file__)), "restyle")
STRIP = re.compile(r"</?[^<>]*>")


def slug_levels():
    """slug -> jlpt level, from the shipped per-level kanji JSON."""
    levels = {}
    for path in glob.glob(os.path.join(KANJI_JSON, "*.json")):
        data = json.load(open(path))
        if "items" not in data:
            continue
        for item in data["items"]:
            levels[item["slug"]] = data["jlpt_level"].lower()
    return levels


def drafts(include_reviewed=False):
    """Every kanji in scope, with the sidecar it lives in.

    Draft-only by default — the Rev 6 pass had no business touching prose a
    human had signed off. `include_reviewed` opens that up for the passes that
    were explicitly asked for; anything rewritten drops back to `draft`, so the
    reviewed flag never outlives the text it was granted to.
    """
    levels = slug_levels()
    out = []
    for path in sorted(glob.glob(os.path.join(SIDECARS, "*.json"))):
        data = json.load(open(path))
        for slug, entry in data.items():
            if slug.startswith("_") or not isinstance(entry, dict):
                continue
            status = entry.get("_meta", {}).get("review_status")
            if status != "draft" and not (include_reviewed and status == "reviewed"):
                continue
            out.append((path, slug, levels[slug], entry))
    return out


def cmd_dump(args):
    os.makedirs(WORK, exist_ok=True)
    for stale in glob.glob(os.path.join(WORK, "batch-*.json")):
        os.remove(stale)

    items = []
    for _, slug, level, entry in drafts(args.include_reviewed):
        ctx = mc.kanji_context(level, slug)
        text = entry["meaning_mnemonic"]
        items.append({
            "slug": slug,
            "level": level,
            "char": ctx["char"],
            "meaning": ctx["meaning"],
            "meaning_synonyms": ctx["meaning_synonyms"],
            "components": [
                {"form": c["form"], "meaning": c["meaning"],
                 "meaning_synonyms": c["meaning_synonyms"]}
                for c in ctx["components"]
            ],
            "current_meaning_mnemonic": text,
            "current_length": len(STRIP.sub("", text)),
            "has_landing_tag": "<kanji>" in text,
        })

    size = args.batch_size
    batches = [items[i:i + size] for i in range(0, len(items), size)]
    for n, batch in enumerate(batches, 1):
        path = os.path.join(WORK, f"batch-{n:02d}.json")
        json.dump(batch, open(path, "w"), ensure_ascii=False, indent=1)
        print(f"{path}  ({len(batch)} items: {', '.join(i['slug'] for i in batch)})")
    print(f"\n{len(items)} drafts in {len(batches)} batches")


def cmd_ingest(args):
    """Merge <slug>.json rewrites from restyle/out/ after re-running the gate."""
    by_slug = {slug: (path, level, entry)
               for path, slug, level, entry in drafts(args.include_reviewed)}
    out_dir = os.path.join(WORK, "out")
    touched, failed = {}, []

    for path in sorted(glob.glob(os.path.join(out_dir, "*.json"))):
        for slug, new_meaning in json.load(open(path)).items():
            if slug not in by_slug:
                failed.append((slug, [f"not a draft kanji (from {os.path.basename(path)})"]))
                continue
            sidecar, level, entry = by_slug[slug]
            baseline = dict(entry)
            baseline.pop("_meta", None)
            candidate = dict(baseline)
            candidate["meaning_mnemonic"] = new_meaning
            # Only *new* failures block the merge. Reviewed prose predates the
            # Rev 4 readability gate and the Rev 6 bands, so its untouched
            # reading mnemonic and description carry violations this pass is not
            # here to fix; holding the rewrite hostage to them would reject good
            # meaning mnemonics for defects in a field it never edited.
            # ...but never forgive an error about `meaning_mnemonic` itself:
            # that is the field being rewritten, so a pre-existing failure there
            # is precisely what this pass owes a fix for.
            was = set(validate_kanji(level, slug, baseline, enforce_readability=True))
            errors = [e for e in validate_kanji(level, slug, candidate,
                                                enforce_readability=True)
                      if e not in was or e.startswith("meaning_mnemonic")]
            if "<kanji>" not in new_meaning:
                errors.append("meaning_mnemonic has no <kanji> landing tag")
            if errors:
                failed.append((slug, errors))
                continue
            touched.setdefault(sidecar, []).append((slug, new_meaning))

    if args.dry_run:
        print(f"would update {sum(len(v) for v in touched.values())} entries")
    else:
        for sidecar, entries in touched.items():
            data = json.load(open(sidecar))
            for slug, new_meaning in entries:
                data[slug]["meaning_mnemonic"] = new_meaning
                data[slug]["_meta"]["review_status"] = "draft"
            # Match generate_mnemonics.write_sidecar byte-for-byte, or every
            # untouched entry shows up as a reformatting diff.
            with open(sidecar, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.write("\n")
            print(f"{os.path.basename(sidecar)}: updated {len(entries)} meaning mnemonic(s)")

    print(f"\nPASS {sum(len(v) for v in touched.values())}   FAIL {len(failed)}")
    for slug, errors in failed:
        print(f"  {slug}:")
        for error in errors:
            print(f"    - {error}")


parser = argparse.ArgumentParser(description=__doc__)
sub = parser.add_subparsers(dest="cmd", required=True)
d = sub.add_parser("dump")
d.add_argument("--batch-size", type=int, default=8)
d.add_argument("--include-reviewed", action="store_true",
               help="also select human-reviewed entries (they drop to draft on ingest)")
d.set_defaults(func=cmd_dump)
i = sub.add_parser("ingest")
i.add_argument("--dry-run", action="store_true")
i.add_argument("--include-reviewed", action="store_true",
               help="allow rewrites to land on human-reviewed entries")
i.set_defaults(func=cmd_ingest)
args = parser.parse_args()
args.func(args)
