# curriculum/_build/generate_content/generate_pool.py
# -*- coding: utf-8 -*-
"""Grammar sentence pool content lane (single-session runbook:
docs/workflows/grammar-pool-single-session-workflow-automation-prompt.md).

    .venv/bin/python -m generate_content.generate_pool select --level n5 --limit 4
    .venv/bin/python -m generate_content.generate_pool webprompts --level n5 --slugs a,b
    .venv/bin/python -m generate_content.generate_pool ingest --level n5 --slug a --model <model>

Ingest builds the point exactly as generate.py would with the reply in the
sidecar, runs check_grammar_pool on it, and only then writes the sidecar.
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
from generate_content.generate_examples import _first_json_object  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.join(HERE, "web", "pool")
PROMPTS_DIR = os.path.join(HERE, "prompts")
PROMPT_VERSION = 1
KINDS = ("valid", "other_grammar")


def select_slugs(level, limit, sidecar):
    return [g["slug"] for g in context.load_grammar(level) if g["slug"] not in sidecar][:limit]


def reply_errors(reply):
    errors = []
    meanings = reply.get("accepted_meanings")
    if not (isinstance(meanings, list) and all(isinstance(m, str) and m for m in meanings)):
        errors.append("accepted_meanings must be a list of non-empty strings")
    sentences = reply.get("sentences")
    if not isinstance(sentences, list) or not sentences:
        return errors + ["sentences must be a non-empty list"]
    for i, s in enumerate(sentences):
        label = f"sentences[{i}]"
        if not isinstance(s, dict):
            errors.append(f"{label}: must be an object")
            continue
        for key in ("japanese", "english"):
            if not isinstance(s.get(key), str) or not s.get(key):
                errors.append(f"{label}: {key} must be a non-empty string")
        slugs = s.get("vocabulary_slugs")
        if not (isinstance(slugs, list) and all(isinstance(v, str) and v for v in slugs)):
            errors.append(f"{label}: vocabulary_slugs must be a list of non-empty strings")
        if "form" in s and not (isinstance(s["form"], str) and s["form"]):
            errors.append(f"{label}: form must be a non-empty string when present")
        alternates = s.get("alternates", [])
        if not isinstance(alternates, list):
            errors.append(f"{label}: alternates must be a list when present")
            alternates = []
        for j, alt in enumerate(alternates):
            if not isinstance(alt, dict):
                errors.append(f"{label}.alternates[{j}]: must be an object")
                continue
            if not isinstance(alt.get("japanese"), str) or not alt.get("japanese"):
                errors.append(f"{label}.alternates[{j}]: japanese must be a non-empty string")
            if alt.get("kind") not in KINDS:
                errors.append(f"{label}.alternates[{j}]: kind must be one of {KINDS}")
    return errors


def merge_into_sidecar(path, slug, reply, model):
    entries = {}
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            entries = json.load(f)
    entries[slug] = {
        "accepted_meanings": reply["accepted_meanings"],
        "sentences": reply["sentences"],
        "_meta": {"generator_model": model, "prompt_version": str(PROMPT_VERSION),
                  "review_status": "draft"},
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)
        f.write("\n")


def _read(name):
    with open(os.path.join(PROMPTS_DIR, name), encoding="utf-8") as f:
        return f.read()


def _current_sentences(level, item):
    errors = pool_check.check_point(level, item)
    lines = []
    for s in item.get("example_sentences", []):
        own = [e for e in errors if e.startswith(s["japanese"] + " — ")]
        status = "FAIL: " + "; ".join(e.split(" — ", 1)[1] for e in own) if own else "PASS"
        lines.append(f"- {s['japanese']} — {s['english']} [{status}]")
    point = [e for e in errors if " — " not in e]
    return "\n".join(lines + [f"- (point) {e}" for e in point]) or "(none)"


def prompt_text(level, slug, validator_errors=None):
    grammar = context.load_grammar(level)
    item = next(g for g in grammar if g["slug"] == slug)
    family = [g for g in pool_check.grammar_through(level)
              if g["slug"] != slug and item.get("family") and g.get("family") == item.get("family")]
    earlier = [g for g in pool_check.grammar_through(level)
               if g["slug"] != slug and (g["sort_order"] < item["sort_order"] or g not in grammar)]
    feedback = ""
    if validator_errors:
        feedback = ("\n## Fix these errors from the last attempt\n\n"
                    + "\n".join(f"- {e}" for e in validator_errors) + "\n")
    body = (_read("grammar-pool.md")
            .replace("{{LEVEL}}", level.upper())
            .replace("{{FORM}}", item["primary_form"])
            .replace("{{MEANING}}", item["meaning"])
            .replace("{{STRUCTURE}}", item["structure"])
            .replace("{{ACCEPTED_FORMS}}", "、".join(item["accepted_forms"]))
            .replace("{{FAMILY}}", item.get("family") or "(none)")
            .replace("{{FAMILY_POINTS}}", context.format_grammar_list(family))
            .replace("{{CURRENT_SENTENCES}}", _current_sentences(level, item))
            .replace("{{ALLOWED_VOCAB}}",
                     context.format_vocab_list(context.allowed_vocab_for(level, slug)))
            .replace("{{EARLIER_GRAMMAR}}", context.format_grammar_list(earlier))
            .replace("{{VALIDATOR_FEEDBACK}}", feedback))
    header = (f"<!-- Grammar pool prompt for {level}/{slug}. Write the reply to "
              f"web/pool/{level}/{slug}.reply.md, then run:\n"
              f"  .venv/bin/python -m generate_content.generate_pool ingest "
              f"--level {level} --slug {slug} --model <model>\n-->\n\n")
    return (header + "# Teaching voice — follow this in everything you write below\n\n"
            + _read("persona.md").strip() + "\n\n---\n\n" + body.strip()
            + "\n\nReply with exactly one fenced ```json code block and nothing else.\n")


def _paths(level, slug):
    base = os.path.join(WEB_DIR, level)
    return os.path.join(base, f"{slug}.prompt.md"), os.path.join(base, f"{slug}.reply.md")


def cmd_select(args):
    slugs = select_slugs(args.level, args.limit, generate.load_pool_sidecar())
    print(f"{len(slugs)} point(s) selected:")
    print(",".join(slugs))


def cmd_webprompts(args):
    for slug in args.slugs.split(","):
        prompt_path, _ = _paths(args.level, slug)
        os.makedirs(os.path.dirname(prompt_path), exist_ok=True)
        with open(prompt_path, "w", encoding="utf-8") as f:
            f.write(prompt_text(args.level, slug))
        print(f"wrote {prompt_path}")


def cmd_ingest(args):
    prompt_path, reply_path = _paths(args.level, args.slug)
    if not os.path.exists(reply_path):
        raise SystemExit(f"no reply at {reply_path}")
    with open(reply_path, encoding="utf-8") as f:
        reply = _first_json_object(f.read())
    errors = reply_errors(reply)
    if not errors:
        pool_entry = {"accepted_meanings": reply["accepted_meanings"],
                      "sentences": reply["sentences"]}
        try:
            item = generate.build_grammar_point(args.level, args.slug, pool_entry)
            errors = pool_check.check_point(args.level, item)
        except (ValueError, KeyError) as error:
            errors = [str(error)]
    if errors:
        with open(prompt_path, "w", encoding="utf-8") as f:
            f.write(prompt_text(args.level, args.slug, errors))
        print(f"{args.slug}: {len(errors)} error(s) — NOT written:")
        for e in errors:
            print(f"  - {e}")
        raise SystemExit(1)
    merge_into_sidecar(generate.POOL_SIDECAR, args.slug, reply, args.model)
    for path in (prompt_path, reply_path):
        os.remove(path)
    print(f"{args.slug}: PASS — merged into {generate.POOL_SIDECAR}")


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
