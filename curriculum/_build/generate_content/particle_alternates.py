# curriculum/_build/generate_content/particle_alternates.py
# -*- coding: utf-8 -*-
"""Particle-swap Build alternates (single-session runbook:
docs/workflows/particle-alternates-single-session.md).

    .venv/bin/python -m generate_content.particle_alternates select --level n4 --limit 4
    .venv/bin/python -m generate_content.particle_alternates webprompts --level n4 --slugs a,b
    .venv/bin/python -m generate_content.particle_alternates ingest --level n4 --slug a --model <model>

The script only proposes candidates: one particle swapped, never inside the
grammar span. The reply judges each one, and only "valid" verdicts are merged
into pool.json as alternates. A parser cannot do the judging: GiNZA kept
子供は寝ているうちに… (the child now eats) and rejected the correct お茶は熱いうちに….
Run generate.py first so the level JSON carries the current grammar spans.
"""

import argparse
import json
import os
import sys

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BUILD_DIR)

import generate  # noqa: E402
from generate_content import check_grammar_pool as pool_check  # noqa: E402
from generate_content import context  # noqa: E402
from generate_content import spans  # noqa: E402
from generate_content.generate_examples import _first_json_object  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.join(HERE, "web", "particles")
PROMPTS_DIR = os.path.join(HERE, "prompts")
CHECK_VERSION = "1"
VERDICTS = ("valid", "contrast", "wrong")
SWAPS = {"が": ("は",), "は": ("が",), "を": ("は",), "に": ("には",), "で": ("では",)}


def particle_swap_candidates(japanese, span, known=()):
    """Every sentence that differs from `japanese` by one particle swap.

    Skips particles inside `span` (the grammar under review) and particles
    next to another particle (には, では: swapping half of one gives にが)."""
    tokens = spans.tokens_with_offsets(japanese)
    out = []
    for i, t in enumerate(tokens):
        if t["pos1"] != "助詞" or t["surface"] not in SWAPS:
            continue
        if span and span["start"] <= t["start"] < span["end"]:
            continue
        neighbours = tokens[i - 1:i] + tokens[i + 1:i + 2]
        if any(n["pos1"] == "助詞" for n in neighbours):
            continue
        for new in SWAPS[t["surface"]]:
            candidate = japanese[:t["start"]] + new + japanese[t["end"]:]
            if candidate not in known and candidate not in out:
                out.append(candidate)
    return out


def point_candidates(level, slug, entry):
    """[(sentence index, candidate)] for one pool entry."""
    shipped = {s["japanese"]: s for s in context.grammar_item(level, slug)["example_sentences"]}
    out = []
    for i, s in enumerate(entry["sentences"]):
        if s["japanese"] not in shipped:
            raise SystemExit(f"{slug}: {s['japanese']} is not in the {level} JSON — "
                             f"run generate.py --level {level} first")
        known = {s["japanese"]} | {a["japanese"] for a in s.get("alternates", [])}
        span = shipped[s["japanese"]].get("grammar_span")
        out += [(i, c) for c in particle_swap_candidates(s["japanese"], span, known)]
    return out


def reply_errors(reply, candidates):
    verdicts = reply.get("verdicts")
    if not isinstance(verdicts, list):
        return ["verdicts must be a list"]
    errors = []
    expected = [c for _, c in candidates]
    seen = []
    for j, v in enumerate(verdicts):
        if not isinstance(v, dict):
            errors.append(f"verdicts[{j}]: must be an object")
            continue
        if v.get("candidate") not in expected:
            errors.append(f"verdicts[{j}]: {v.get('candidate')!r} is not a listed candidate")
        if v.get("verdict") not in VERDICTS:
            errors.append(f"verdicts[{j}]: verdict must be one of {VERDICTS}")
        seen.append(v.get("candidate"))
    for c in expected:
        if seen.count(c) != 1:
            errors.append(f"{c}: needs exactly one verdict (has {seen.count(c)})")
    return errors


def merged_entry(entry, candidates, reply, model):
    """A copy of `entry` with the valid candidates added and the point back in draft."""
    entry = json.loads(json.dumps(entry))
    valid = {v["candidate"] for v in reply["verdicts"] if v["verdict"] == "valid"}
    for i, candidate in candidates:
        if candidate in valid:
            entry["sentences"][i].setdefault("alternates", []).append(
                {"japanese": candidate, "kind": "valid"})
    meta = entry.setdefault("_meta", {})
    if valid:
        meta["review_status"] = "draft"
    meta["particle_check"] = {"version": CHECK_VERSION, "model": model}
    return entry


def select_slugs(level, limit, sidecar):
    return [g["slug"] for g in context.load_grammar(level)
            if g["slug"] in sidecar
            and sidecar[g["slug"]].get("_meta", {}).get("particle_check", {}).get("version")
            != CHECK_VERSION][:limit]


def _read(name):
    with open(os.path.join(PROMPTS_DIR, name), encoding="utf-8") as f:
        return f.read()


def prompt_text(level, slug, entry, candidates, validator_errors=None):
    item = context.grammar_item(level, slug)
    lines = []
    for i, s in enumerate(entry["sentences"]):
        own = [c for k, c in candidates if k == i]
        if not own:
            continue
        lines.append(f"- {s['japanese']} — {s['english']}")
        lines += [f"  - {c}" for c in own]
    feedback = ""
    if validator_errors:
        feedback = ("\n## Fix these errors from the last attempt\n\n"
                    + "\n".join(f"- {e}" for e in validator_errors) + "\n")
    body = (_read("particle-alternates.md")
            .replace("{{LEVEL}}", level.upper())
            .replace("{{FORM}}", item["primary_form"])
            .replace("{{MEANING}}", item["meaning"])
            .replace("{{CANDIDATES}}", "\n".join(lines))
            .replace("{{VALIDATOR_FEEDBACK}}", feedback))
    header = (f"<!-- Particle alternates prompt for {level}/{slug}. Write the reply to "
              f"web/particles/{level}/{slug}.reply.md, then run:\n"
              f"  .venv/bin/python -m generate_content.particle_alternates ingest "
              f"--level {level} --slug {slug} --model <model>\n-->\n\n")
    return header + body.strip() + "\n\nReply with exactly one fenced ```json code block and nothing else.\n"


def _paths(level, slug):
    base = os.path.join(WEB_DIR, level)
    return os.path.join(base, f"{slug}.prompt.md"), os.path.join(base, f"{slug}.reply.md")


def _write_sidecar(entries):
    with open(generate.POOL_SIDECAR, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)
        f.write("\n")


def cmd_select(args):
    slugs = select_slugs(args.level, args.limit, generate.load_pool_sidecar())
    print(f"{len(slugs)} point(s) selected:")
    print(",".join(slugs))


def cmd_webprompts(args):
    sidecar = generate.load_pool_sidecar()
    for slug in args.slugs.split(","):
        candidates = point_candidates(args.level, slug, sidecar[slug])
        prompt_path, _ = _paths(args.level, slug)
        os.makedirs(os.path.dirname(prompt_path), exist_ok=True)
        with open(prompt_path, "w", encoding="utf-8") as f:
            f.write(prompt_text(args.level, slug, sidecar[slug], candidates))
        print(f"wrote {prompt_path} ({len(candidates)} candidate(s))")


def cmd_ingest(args):
    sidecar = generate.load_pool_sidecar()
    entry = sidecar[args.slug]
    candidates = point_candidates(args.level, args.slug, entry)
    prompt_path, reply_path = _paths(args.level, args.slug)
    if candidates:
        if not os.path.exists(reply_path):
            raise SystemExit(f"no reply at {reply_path}")
        with open(reply_path, encoding="utf-8") as f:
            reply = _first_json_object(f.read())
    else:
        reply = {"verdicts": []}
    errors = reply_errors(reply, candidates)
    if not errors:
        updated = merged_entry(entry, candidates, reply, args.model)
        try:
            item = generate.build_grammar_point(args.level, args.slug, updated)
            errors = pool_check.check_point(args.level, item)
        except (ValueError, KeyError) as error:
            errors = [str(error)]
    if errors:
        with open(prompt_path, "w", encoding="utf-8") as f:
            f.write(prompt_text(args.level, args.slug, entry, candidates, errors))
        print(f"{args.slug}: {len(errors)} error(s) — NOT written:")
        for e in errors:
            print(f"  - {e}")
        raise SystemExit(1)
    sidecar[args.slug] = updated
    _write_sidecar(sidecar)
    for path in (prompt_path, reply_path):
        if os.path.exists(path):
            os.remove(path)
    counts = {k: sum(v["verdict"] == k for v in reply["verdicts"]) for k in VERDICTS}
    print(f"{args.slug}: PASS — {counts['valid']} valid added, "
          f"{counts['contrast']} contrast, {counts['wrong']} wrong")


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("select")
    p.add_argument("--level", required=True, choices=context.LEVEL_ORDER)
    p.add_argument("--limit", type=int, default=4)
    p.set_defaults(func=cmd_select)
    p = sub.add_parser("webprompts")
    p.add_argument("--level", required=True, choices=context.LEVEL_ORDER)
    p.add_argument("--slugs", required=True)
    p.set_defaults(func=cmd_webprompts)
    p = sub.add_parser("ingest")
    p.add_argument("--level", required=True, choices=context.LEVEL_ORDER)
    p.add_argument("--slug", required=True)
    p.add_argument("--model", required=True)
    p.set_defaults(func=cmd_ingest)
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
