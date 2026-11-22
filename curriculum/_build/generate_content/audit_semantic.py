# -*- coding: utf-8 -*-
"""Tier-2 semantic pass (docs/content/content-audit-plan.md, "Tier 2").

The one layer of the content audit that needs a model: whether the English
actually says what the Japanese says. Everything deterministic lives in
`audit_shipped.py` (tiers 0-1); this file only covers what that pass cannot
judge:

  - example-sentence translation fidelity (kanji, vocabulary, grammar)
  - passage `english_translation` faithfulness
  - passage `summary_ja` / `summary_en` faithfulness to the body
  - comprehension questions: answerable from the body, accepted answers right

Findings are **advisory**. A flag is a prompt for a human to read the item, not
proof of an error, so nothing here is graded ERROR/WARNING and the exit code is
0 whether or not anything was flagged. This module never edits curriculum JSON,
drafts, or sidecars — its only write is the "Semantic (advisory)" section it
appends to curriculum/_build/reports/content-audit-<level>.md.

Scope defaults to items whose `_meta.review_status` is `draft` (or absent —
n4 items and every passage carry no `_meta` at all, and unreviewed is exactly
what this pass is for); `--all` audits everything, reviewed items included.

No-API web-chat / subagent lane (mirrors generate_examples.py's webprompts/
ingest split): a `webprompts` pass writes one prompt file per batch — a chunk
of example-sentence pairs, or one reading passage — to
generate_content/web/semantic/<level>/. A fresh subagent (or a pasted web-chat
reply) answers each prompt in place with a `.reply.md`. An `ingest` pass reads
every reply, validates it against the reply contract (every finding id known
to that batch, `evaluated` matching the batch size exactly, a fenced JSON
block and nothing else), and rebuilds the whole advisory section from the
clean replies. See docs/workflows/semantic-audit-subagent-workflow-automation-
prompt.md for the run procedure.

Run (from curriculum/_build):
    .venv/bin/python -m generate_content.audit_semantic webprompts --level n5
    .venv/bin/python -m generate_content.audit_semantic webprompts --level n5 --all --batch-size 40
    .venv/bin/python -m generate_content.audit_semantic ingest --level n5 --model claude-sonnet-5
"""

import argparse
import json
import os
import re
import sys

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMPORT_DIR = os.path.join(BUILD_DIR, "import")
sys.path.insert(0, BUILD_DIR)
sys.path.insert(0, IMPORT_DIR)

import jlpt_groups  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.join(HERE, "web", "semantic")

REPORTS_DIR = os.path.join(BUILD_DIR, "reports")
SECTION_TITLE = "## Semantic (advisory)"

DEFAULT_BATCH_SIZE = 40

SYSTEM_PROMPT = (
    "You check Japanese-language teaching material for meaning errors. The "
    "Japanese is authoritative: you are judging whether the English (or the "
    "summary, or the question) is faithful to it.\n\n"
    "Flag only real mismatches — wrong meaning, a mistranslated word, content "
    "present in one side and missing from the other, a politeness or tense "
    "difference that changes what is being said, a claim the source does not "
    "support. Do not flag a natural, non-literal rendering that preserves the "
    "meaning, a stylistic preference, or a translation you would merely have "
    "worded differently. When in doubt, do not flag.\n\n"
    "Return one finding per problem item, echoing that item's id exactly, with "
    "a single sentence naming the problem. Items with no problem must not "
    "appear. An empty findings list is the expected result for clean material."
)


# --- scope selection ---------------------------------------------------------

def is_in_scope(item, include_all):
    """Draft-only by default. Items with no `_meta` (every n4 item, every
    passage) have never been through review either, so they count as draft."""
    if include_all:
        return True
    return (item.get("_meta") or {}).get("review_status", "draft") == "draft"


def sentence_pairs(level, include_all):
    """Every (japanese, english) example-sentence pair in scope, in teaching
    order, each with a report-readable id the model echoes back."""
    pairs = []
    for kind, kind_dir in (("kanji", "kanji"), ("vocab", "vocabulary"), ("grammar", "grammar")):
        for item in jlpt_groups.load_items(kind_dir, level):
            if not is_in_scope(item, include_all):
                continue
            for i, sentence in enumerate(item.get("example_sentences") or []):
                pairs.append({
                    "id": f"{kind}/{item['slug']}/example[{i}]",
                    "japanese": sentence["japanese"],
                    "english": sentence["english"],
                })
    return pairs


def passages_in_scope(level, include_all):
    return [
        p for p in jlpt_groups.load_items("readings", level)
        if is_in_scope(p, include_all)
    ]


# --- request construction ----------------------------------------------------

def sentence_request(pairs):
    return (
        "Each item below is a Japanese example sentence from a JLPT learning app "
        "and the English translation shipped with it. For each pair: does the "
        "English faithfully translate the Japanese?\n\n"
        + json.dumps(pairs, ensure_ascii=False, indent=2)
    )


def passage_checks(passage):
    """The four things a passage claims about itself, as one checkable list."""
    label = f"passage[sort_order={passage['sort_order']}]"
    checks = [
        {
            "id": f"{label}/english_translation",
            "check": "Does this English faithfully translate the whole Japanese body?",
            "text": passage["english_translation"],
        },
        {
            "id": f"{label}/summary_ja",
            "check": "Is this Japanese summary accurate and fully supported by the body?",
            "text": passage["summary_ja"],
        },
        {
            "id": f"{label}/summary_en",
            "check": "Is this English summary accurate and fully supported by the body?",
            "text": passage["summary_en"],
        },
    ]
    for i, question in enumerate(passage.get("questions") or []):
        checks.append({
            "id": f"{label}/question[{i}]",
            "check": (
                "Is this comprehension question answerable from the body alone, "
                "and is every accepted answer a correct answer to it?"
            ),
            "prompt": question["prompt"],
            "accepted_answers": question.get("accepted_answers") or [],
        })
    return checks


def passage_request(passage):
    payload = {
        "title": passage["title"],
        "body": passage["body"],
        "checks": passage_checks(passage),
    }
    return (
        "A reading passage from a JLPT learning app, followed by the derived text "
        "shipped with it. The Japanese body is authoritative. Run each check "
        "against the body.\n\n"
        + json.dumps(payload, ensure_ascii=False, indent=2)
    )


def build_requests(level, include_all, batch_size):
    """(label, user_prompt) per model call: batched sentence pairs first, then
    one call per passage — a passage carries its whole body, so batching several
    into one call would push a single request past useful attention."""
    requests = []
    pairs = sentence_pairs(level, include_all)
    for start in range(0, len(pairs), batch_size):
        batch = pairs[start:start + batch_size]
        requests.append((
            f"sentences[{start}:{start + len(batch)}]", sentence_request(batch)
        ))
    passages = passages_in_scope(level, include_all)
    for passage in passages:
        requests.append((
            f"passage[sort_order={passage['sort_order']}]", passage_request(passage)
        ))
    return requests, len(pairs), len(passages)


def request_id_sets(level, include_all, batch_size):
    """label -> set of item ids in that batch, computed independently of
    build_requests (same iteration/chunking, so labels line up) so ingest can
    rebuild the known-id set for a batch without trusting the reply itself."""
    id_sets = {}
    pairs = sentence_pairs(level, include_all)
    for start in range(0, len(pairs), batch_size):
        batch = pairs[start:start + batch_size]
        label = f"sentences[{start}:{start + len(batch)}]"
        id_sets[label] = {p["id"] for p in batch}
    for passage in passages_in_scope(level, include_all):
        label = f"passage[sort_order={passage['sort_order']}]"
        id_sets[label] = {c["id"] for c in passage_checks(passage)}
    return id_sets


# --- report ------------------------------------------------------------------

def section_lines(model, scope, counts, findings, failures):
    lines = [
        SECTION_TITLE,
        "",
        "Generated by `curriculum/_build/generate_content/audit_semantic.py` "
        "(docs/content/content-audit-plan.md, tier 2). **Advisory only** — every "
        "line below is a model's opinion that a human should check, not a "
        "verified defect, and nothing here has been changed in the curriculum.",
        "",
        f"Model: `{model}`. Scope: {scope}.",
        f"Checked {counts['pairs']} example sentence(s) and {counts['passages']} "
        f"passage(s) over {counts['requests']} model call(s).",
        "",
        f"**{len(findings)} advisory finding(s).**",
        "",
    ]
    if findings:
        for finding in sorted(findings, key=lambda f: f["id"]):
            lines.append(f"- **{finding['id']}** — {finding['issue']}")
    else:
        lines.append("(clean)")
    lines.append("")
    if failures:
        lines.append(f"### Failed calls ({len(failures)})")
        lines.append("")
        lines.append(
            "These items were **not** checked — rerun to cover them."
        )
        lines.append("")
        for label, reason in failures:
            lines.append(f"- `{label}`: {reason}")
        lines.append("")
    return lines


def write_section(level, lines):
    """Append the section to the tier-0/1 report, replacing an earlier run's.

    `audit_shipped.py` rewrites the whole file from scratch, so this section is
    always last; truncating at its heading is enough to make reruns idempotent.
    """
    path = os.path.join(REPORTS_DIR, f"content-audit-{level}.md")
    if not os.path.exists(path):
        raise SystemExit(
            f"{path} does not exist — run `python -m generate_content.audit_shipped "
            f"--level {level}` first; tier 2 is only worth paying for once tiers 0-1 "
            "are green."
        )
    with open(path, encoding="utf-8") as f:
        existing = f.read()
    marker = existing.find(SECTION_TITLE)
    if marker != -1:
        existing = existing[:marker]
    with open(path, "w", encoding="utf-8") as f:
        f.write(existing.rstrip("\n") + "\n\n" + "\n".join(lines).rstrip("\n") + "\n")
    return path


# --- web-chat / subagent (no-API) lane ----------------------------------------

FENCE_RE = re.compile(r"```json\s*(.*?)```", re.DOTALL)

REPLY_CONTRACT_TEMPLATE = (
    'Reply with **exactly one** fenced ```json code block and nothing else — no '
    "commentary before or after it, and do not call any tools. The JSON object "
    "must have exactly these two keys:\n\n"
    '- `"evaluated"`: the integer **{count}** — the number of items in the '
    "payload above. Judge every item; this must equal {count} exactly (a reply "
    "that only judged some of the items is malformed).\n"
    '- `"findings"`: an array, one entry per item with a real problem, each '
    '`{{"id": "<the item\'s id, copied exactly>", "issue": "<one sentence '
    'naming the problem>"}}`. Items with no problem must not appear — an empty '
    "array is the expected, common result for clean material.\n\n"
    "Every `id` you use must be copied exactly from one of the items above — do "
    "not invent, abbreviate, or alter an id."
)

WEB_SKELETON = (
    '```json\n{\n  "evaluated": 0,\n  "findings": [\n    {"id": "...", "issue": "..."}\n'
    '  ]\n}\n```'
)


def _slugify(label):
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", label).strip("-").lower()
    return slug or "batch"


def extract_json_block(text):
    """The reply contract's single fenced ```json block, parsed."""
    matches = FENCE_RE.findall(text)
    if len(matches) != 1:
        raise ValueError(
            f"expected exactly one fenced ```json block, found {len(matches)}"
        )
    try:
        return json.loads(matches[0].strip())
    except json.JSONDecodeError as exc:
        raise ValueError(f"invalid JSON in fenced block: {exc}") from exc


def validate_reply(obj, known_ids, expected_count):
    """Reply-contract rules: every finding id known to this batch, a
    non-empty single-sentence issue, and `evaluated` matching the batch size
    exactly. Returns the findings list on success."""
    if not isinstance(obj, dict):
        raise ValueError("reply is not a JSON object")
    if "evaluated" not in obj or "findings" not in obj:
        raise ValueError("reply is missing 'evaluated' or 'findings'")
    evaluated = obj["evaluated"]
    if not isinstance(evaluated, int) or isinstance(evaluated, bool):
        raise ValueError("'evaluated' must be an integer")
    if evaluated != expected_count:
        raise ValueError(f"'evaluated' is {evaluated}, expected {expected_count}")
    findings = obj["findings"]
    if not isinstance(findings, list):
        raise ValueError("'findings' must be an array")
    for finding in findings:
        if not isinstance(finding, dict) or "id" not in finding or "issue" not in finding:
            raise ValueError("each finding needs 'id' and 'issue'")
        if finding["id"] not in known_ids:
            raise ValueError(f"finding id {finding['id']!r} is not in this batch")
        issue = finding["issue"]
        if not isinstance(issue, str) or not issue.strip():
            raise ValueError(f"finding {finding['id']!r} has an empty issue")
        if "\n" in issue.strip():
            raise ValueError(
                f"finding {finding['id']!r} issue must be a single sentence (no newlines)"
            )
    return findings


def _web_prompt_text(level, fname, prompt_body, count):
    header = (
        "<!-- Paste EVERYTHING below this line into a fresh Claude or Gemini chat "
        "(or hand it to a fresh subagent).\n"
        f"     Save the reply to generate_content/web/semantic/{level}/{fname}.reply.md, "
        "then run:\n"
        "       .venv/bin/python -m generate_content.audit_semantic ingest "
        f"--level {level} --model <model-name>\n"
        "     Read files and write only your reply file; never edit curriculum, "
        "validators, or reports.\n"
        "-->\n\n"
    )
    return (
        header
        + SYSTEM_PROMPT.strip() + "\n\n---\n\n"
        + prompt_body.strip() + "\n\n---\n\n"
        + REPLY_CONTRACT_TEMPLATE.format(count=count) + "\n\n"
        + "For reference the JSON has this shape (keep the key names exactly):\n\n"
        + WEB_SKELETON + "\n"
    )


def _reply_is_valid(reply_path, known_ids):
    if not os.path.exists(reply_path):
        return False
    try:
        with open(reply_path, encoding="utf-8") as f:
            obj = extract_json_block(f.read())
        validate_reply(obj, known_ids, len(known_ids))
        return True
    except ValueError:
        return False


def cmd_webprompts(args):
    requests, n_pairs, n_passages = build_requests(
        args.level, args.include_all, args.batch_size
    )
    id_sets = request_id_sets(args.level, args.include_all, args.batch_size)
    scope = "every item" if args.include_all else "review_status: draft (or unset) only"
    if not requests:
        raise SystemExit(f"nothing in scope for {args.level} ({scope}) — nothing to write")

    out_dir = os.path.join(WEB_DIR, args.level)
    os.makedirs(out_dir, exist_ok=True)
    print(f"{args.level}: {n_pairs} sentence pair(s) + {n_passages} passage(s) "
          f"-> {len(requests)} batch(es) [{scope}]")

    written, skipped, total_chars = 0, 0, 0
    for i, (label, prompt) in enumerate(requests, 1):
        fname = f"{i:03d}-{_slugify(label)}"
        known_ids = id_sets[label]
        text = _web_prompt_text(args.level, fname, prompt, len(known_ids))
        total_chars += len(text)
        reply_path = os.path.join(out_dir, f"{fname}.reply.md")
        if _reply_is_valid(reply_path, known_ids):
            skipped += 1
            print(f"  [{i}/{len(requests)}] {fname}: skip (valid reply present)")
            continue
        prompt_path = os.path.join(out_dir, f"{fname}.prompt.md")
        with open(prompt_path, "w", encoding="utf-8") as f:
            f.write(text)
        written += 1
        print(f"  [{i}/{len(requests)}] {fname}: wrote")

    avg_chars = total_chars // len(requests)
    print(f"{written} batch prompt(s) written, {skipped} skipped (valid reply already present)")
    print(f"~{avg_chars} chars/batch (~{avg_chars // 4} tokens/batch, rough) for calibration")


def cmd_ingest(args):
    if not args.model:
        raise SystemExit("ingest requires --model (recorded in the report for provenance)")

    requests, n_pairs, n_passages = build_requests(
        args.level, args.include_all, args.batch_size
    )
    id_sets = request_id_sets(args.level, args.include_all, args.batch_size)
    scope = "every item" if args.include_all else "review_status: draft (or unset) only"
    if not requests:
        raise SystemExit(f"nothing in scope for {args.level} ({scope}) — nothing to ingest")

    out_dir = os.path.join(WEB_DIR, args.level)
    findings, failures = [], []
    for i, (label, _prompt) in enumerate(requests, 1):
        fname = f"{i:03d}-{_slugify(label)}"
        known_ids = id_sets[label]
        reply_path = os.path.join(out_dir, f"{fname}.reply.md")
        if not os.path.exists(reply_path):
            failures.append((label, "no reply file — not yet generated"))
            print(f"  [{i}/{len(requests)}] {fname}: NOT CHECKED — no reply file")
            continue
        try:
            with open(reply_path, encoding="utf-8") as f:
                obj = extract_json_block(f.read())
            batch_findings = validate_reply(obj, known_ids, len(known_ids))
        except ValueError as exc:
            failures.append((label, str(exc)))
            print(f"  [{i}/{len(requests)}] {fname}: MALFORMED — {exc}")
            continue
        findings.extend(batch_findings)
        print(f"  [{i}/{len(requests)}] {fname}: {len(batch_findings)} finding(s)")
        # Ingested successfully and folded into the report below — the staged
        # prompt/reply have done their job, so don't leave them under web/semantic/.
        prompt_path = os.path.join(out_dir, f"{fname}.prompt.md")
        for staged in (reply_path, prompt_path):
            if os.path.exists(staged):
                os.remove(staged)

    counts = {"pairs": n_pairs, "passages": n_passages, "requests": len(requests)}
    out_path = write_section(
        args.level, section_lines(args.model, scope, counts, findings, failures)
    )
    print(f"Wrote {out_path}: {len(findings)} advisory finding(s), "
          f"{len(failures)} batch(es) not checked.")


# --- entry point -------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["webprompts", "ingest"])
    parser.add_argument("--level", default="n5", help="single level to audit (default: n5)")
    parser.add_argument("--all", action="store_true", dest="include_all",
                        help="audit every item, not just review_status: draft")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE,
                        help=f"sentence pairs per batch (default: {DEFAULT_BATCH_SIZE}); "
                             "must match between webprompts and ingest")
    parser.add_argument("--model", default=None,
                        help="ingest only: provenance recorded in the report")
    args = parser.parse_args()

    {"webprompts": cmd_webprompts, "ingest": cmd_ingest}[args.command](args)


if __name__ == "__main__":
    main()
