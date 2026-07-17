# -*- coding: utf-8 -*-
"""Phase 2a grammar lesson generator (docs/content/content-pipeline-plan.md).

Build-time generation on the maintainer machine: one Message Batches request
per grammar point (50% cost, latency irrelevant), structured output via a
single forced tool call, drafts written under generate_content/drafts/ and —
only after passing the mechanical gate — assembled into
curriculum/grammar/lessons/<level>/<slug>.md with `review_status: draft`
frontmatter. Nothing here writes shipped JSON directly; generate.py inlines
lesson files at build time.

Failed drafts are auto-requeued with the validator errors appended to the
prompt, capped at MAX_ATTEMPTS, then recorded with
`review_status: flagged_for_rewrite` for manual handling.

Usage (from curriculum/_build, venv with `anthropic` installed):
    .venv/bin/python -m generate_content.generate_grammar_lessons requests   # dry run: write request payloads
    .venv/bin/python -m generate_content.generate_grammar_lessons run        # full pipeline (needs API credentials)
    .venv/bin/python -m generate_content.generate_grammar_lessons assemble   # re-assemble passing drafts

Scope guard: this is the 10-point N5 pilot. Batching the rest of N5+N4 is
step 4 of the execution table and gated on the pilot's go/no-go read.
"""

import argparse
import json
import os
import sys
import time

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BUILD_DIR)

from generate_content import assemble, context, tatoeba  # noqa: E402
from generate_content.validate_drafts import item_context, validate_draft  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
PROMPTS_DIR = os.path.join(HERE, "prompts")
DRAFTS_DIR = os.path.join(HERE, "drafts")
#: Paste-ready prompts + pasted replies for the web-chat (no-API) workflow —
#: docs/content/content-pipeline-plan.md step 4 alternative. See docs/workflows/grammar-web-chat-workflow.md.
WEB_DIR = os.path.join(HERE, "web")

MODEL = "claude-opus-4-8"
#: Bump together with prompts/grammar-lesson.md and prompts/persona.md.
PROMPT_VERSION = 2
MAX_ATTEMPTS = 3
MAX_TOKENS = 16000
POLL_SECONDS = 30
POLL_TIMEOUT_SECONDS = 90 * 60

#: The step-3 pilot: 10 N5 points chosen for coverage of families and for
#: built-in contrast pairs (は/が, てもいい/てはいけない, から/ので).
PILOT_SLUGS = [
    "wa-topic", "ga",
    "masen-ka",
    "te-form", "te-mo-ii", "te-wa-ikenai",
    "kara-because", "node-because",
    "ta-koto-ga-aru", "hou-ga-ii",
]

SUBMIT_TOOL = {
    "name": "submit_grammar_lesson",
    "description": (
        "Submit the completed grammar lesson. Call exactly once with the full "
        "lesson body and its structured companions."
    ),
    "strict": True,
    "input_schema": {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "lesson_markdown", "example_sentences", "caution_notes",
            "related_grammar_slugs", "cloze_variants",
        ],
        "properties": {
            "lesson_markdown": {"type": "string"},
            "example_sentences": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["japanese", "english", "vocabulary_slugs"],
                    "properties": {
                        "japanese": {"type": "string"},
                        "english": {"type": "string"},
                        "vocabulary_slugs": {"type": "array", "items": {"type": "string"}},
                    },
                },
            },
            "caution_notes": {"type": "array", "items": {"type": "string"}},
            "related_grammar_slugs": {"type": "array", "items": {"type": "string"}},
            "cloze_variants": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["jp_cloze", "english", "answer", "nudge"],
                    "properties": {
                        "jp_cloze": {"type": "string"},
                        "english": {"type": "string"},
                        "answer": {"type": "string"},
                        "nudge": {"type": "string"},
                    },
                },
            },
        },
    },
}


def _read_prompt(name):
    with open(os.path.join(PROMPTS_DIR, name), encoding="utf-8") as f:
        return f.read()


def build_user_prompt(level, slug, ctx, validator_errors=None):
    item = ctx["item"]
    anchors = tatoeba.style_anchors(
        item["accepted_forms"], ctx["allowed_index"], ctx["extra_allowed"]
    )
    feedback = ""
    if validator_errors:
        feedback = (
            "## An earlier draft failed mechanical validation\n\n"
            "An earlier draft of this lesson was rejected by the automated "
            "gate for the failures below. Write your lesson so none of them "
            "recur (usually: avoid the flagged out-of-level words entirely, "
            "keep fence lines and example entries one-to-one, and keep the "
            "pattern present in most examples):\n"
            + "\n".join(f"- {e}" for e in validator_errors)
        )
    template = _read_prompt("grammar-lesson.md")
    substitutions = {
        "{{LEVEL}}": level.upper(),
        "{{PRIMARY_FORM}}": item["primary_form"],
        "{{MEANING}}": item["meaning"],
        "{{STRUCTURE}}": item["structure"],
        "{{CONJUGATION_RULES}}": json.dumps(item["conjugation_rules"], ensure_ascii=False),
        "{{ACCEPTED_FORMS}}": "、".join(item["accepted_forms"]),
        "{{TAUGHT_SIBLINGS}}": context.format_grammar_list(ctx["taught"]),
        "{{UPCOMING_RELATED}}": context.format_grammar_list(ctx["upcoming"]),
        "{{ALLOWED_VOCAB}}": context.format_vocab_list(ctx["allowed"]),
        "{{STYLE_ANCHORS}}": tatoeba.format_anchors(anchors),
        "{{VALIDATOR_FEEDBACK}}": feedback,
    }
    for token, value in substitutions.items():
        template = template.replace(token, value)
    return template


def build_request(level, slug, attempt, ctx, validator_errors=None):
    return {
        "custom_id": f"{level}--{slug}--attempt{attempt}",
        "params": {
            "model": MODEL,
            "max_tokens": MAX_TOKENS,
            "system": _read_prompt("persona.md"),
            "tools": [SUBMIT_TOOL],
            "tool_choice": {"type": "tool", "name": "submit_grammar_lesson"},
            "messages": [
                {"role": "user", "content": build_user_prompt(level, slug, ctx, validator_errors)},
            ],
        },
    }


def _draft_path(level, slug):
    return os.path.join(DRAFTS_DIR, level, f"{slug}.json")


def _load_draft(level, slug):
    path = _draft_path(level, slug)
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return {"slug": slug, "level": level, "attempts": [], "status": "pending",
            "tool_input": None}


def _save_draft(record):
    path = _draft_path(record["level"], record["slug"])
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=2)
        f.write("\n")


def _extract_tool_input(message):
    for block in message.content:
        if block.type == "tool_use" and block.name == SUBMIT_TOOL["name"]:
            return block.input
    return None


def _submit_and_collect(client, requests):
    """Submit one batch, poll to completion, return {custom_id: outcome}.

    outcome is {"tool_input": ...} on success or {"error": "..."} otherwise.
    """
    batch = client.messages.batches.create(requests=requests)
    print(f"submitted batch {batch.id} ({len(requests)} requests)")
    deadline = time.time() + POLL_TIMEOUT_SECONDS
    while True:
        batch = client.messages.batches.retrieve(batch.id)
        if batch.processing_status == "ended":
            break
        if time.time() > deadline:
            raise SystemExit(
                f"batch {batch.id} did not finish within the poll timeout; the "
                "batch keeps processing server-side — collect it later with: "
                f"generate_grammar_lessons collect --batch-id {batch.id}"
            )
        counts = batch.request_counts
        print(f"  …{batch.processing_status} (processing={counts.processing} "
              f"succeeded={counts.succeeded} errored={counts.errored})")
        time.sleep(POLL_SECONDS)

    return _batch_outcomes(client, batch.id)


def _batch_outcomes(client, batch_id):
    outcomes = {}
    for result in client.messages.batches.results(batch_id):
        entry = result.result
        if entry.type == "succeeded":
            message = entry.message
            if message.stop_reason == "refusal":
                outcomes[result.custom_id] = {"error": "model refusal"}
                continue
            tool_input = _extract_tool_input(message)
            if tool_input is None:
                outcomes[result.custom_id] = {
                    "error": f"no tool call in response (stop_reason={message.stop_reason})"
                }
            else:
                outcomes[result.custom_id] = {"tool_input": tool_input}
        else:
            outcomes[result.custom_id] = {"error": f"batch result type {entry.type}"}
    return outcomes


# ---------------------------------------------------------------------------
# Web-chat (no-API) workflow: same context + same mechanical gate, but the
# prompt is pasted into Claude/Gemini by hand and the reply is fed back through
# `ingest`. Costs nothing beyond a chat subscription; see the workflow doc.
# ---------------------------------------------------------------------------

WEB_TOOL_LINE = "Call the `submit_grammar_lesson` tool exactly once with:"

WEB_OUTPUT_INSTRUCTION = (
    "Reply with **exactly one** fenced ```json code block and nothing after it. "
    "Do not call any tools, and do not add any commentary outside the block. "
    "The JSON object must use these exact key names:"
)

WEB_JSON_SKELETON = """
For reference, the JSON has this shape (keep the key names exactly; fill in real content):

```json
{
  "lesson_markdown": "the full lesson body as one markdown string",
  "example_sentences": [
    {"japanese": "one sentence, one fence line", "english": "translation", "vocabulary_slugs": ["slug"]}
  ],
  "caution_notes": ["one-sentence warning"],
  "related_grammar_slugs": ["slug-you-contrasted-or-teased"],
  "cloze_variants": [
    {"jp_cloze": "…＿＿＿…", "english": "translation", "answer": "removed text", "nudge": "one-line hint"}
  ]
}
```
"""


def _web_prompt_text(level, slug, ctx, validator_errors=None):
    """One fully self-contained block to paste into a fresh web chat: the
    persona (system prompt has no equivalent in a chat), the per-point lesson
    prompt with the tool-call instruction swapped for a JSON-block contract,
    plus a JSON skeleton and plain-Japanese reminder."""
    persona = _read_prompt("persona.md")
    body = build_user_prompt(level, slug, ctx, validator_errors)
    body = body.replace(WEB_TOOL_LINE, WEB_OUTPUT_INSTRUCTION)
    header = (
        f"<!-- Paste EVERYTHING below this line into a fresh Claude or Gemini chat.\n"
        f"     Save the model's reply to web/{level}/{slug}.reply.md, then run:\n"
        f"       .venv/bin/python -m generate_content.generate_grammar_lessons \\\n"
        f"         ingest --level {level} --slug {slug} --model <claude-web|gemini-web>\n"
        f"     See docs/workflows/grammar-web-chat-workflow.md. -->\n\n"
    )
    return (
        header
        + "# Teaching voice — follow this in everything you write below\n\n"
        + persona.strip()
        + "\n\n---\n\n"
        + body.strip()
        + "\n"
        + WEB_JSON_SKELETON
        + "\nWrite all Japanese plain — no furigana brackets, no romaji. "
        "The build pipeline adds furigana mechanically. Output only the single "
        "JSON block.\n"
    )


def cmd_webprompts(args):
    """Write one paste-ready prompt file per slug under web/<level>/."""
    out_dir = os.path.join(WEB_DIR, args.level)
    os.makedirs(out_dir, exist_ok=True)
    for slug in args.slugs:
        ctx = item_context(args.level, slug)
        path = os.path.join(out_dir, f"{slug}.prompt.md")
        with open(path, "w", encoding="utf-8") as f:
            f.write(_web_prompt_text(args.level, slug, ctx))
        print(f"wrote {path}")
    print(f"\n{len(args.slugs)} prompt file(s) in {out_dir}. Paste each into a web "
          "chat, save the reply next to it as <slug>.reply.md, then `ingest`.")


def _first_json_object(text):
    """Parse the first complete JSON object in `text`, tolerant of surrounding
    prose and ```json fences. Quote/escape-aware so backticks and braces inside
    lesson_markdown (```jp fences, prose) don't confuse the brace matching."""
    start = text.find("{")
    while start != -1:
        depth, in_str, esc = 0, False, False
        for i in range(start, len(text)):
            c = text[i]
            if in_str:
                if esc:
                    esc = False
                elif c == "\\":
                    esc = True
                elif c == '"':
                    in_str = False
            elif c == '"':
                in_str = True
            elif c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[start:i + 1])
                    except json.JSONDecodeError:
                        break
        start = text.find("{", start + 1)
    raise SystemExit(
        "no parseable JSON object found in the reply — make sure you pasted the "
        "model's full ```json block (or the raw JSON object) into the reply file"
    )


def cmd_ingest(args):
    """Ingest one pasted web-chat reply: parse JSON, run the mechanical gate,
    and assemble the lesson file on pass. On failure, rewrite the prompt with
    the gate errors appended so you can re-roll in the chat."""
    if not args.slug:
        raise SystemExit("ingest requires --slug <grammar-slug>")
    reply_path = args.from_path or os.path.join(WEB_DIR, args.level, f"{args.slug}.reply.md")
    if not os.path.exists(reply_path):
        raise SystemExit(
            f"no reply at {reply_path} — paste the model's answer there first "
            f"(or pass --from <path>)"
        )
    with open(reply_path, encoding="utf-8") as f:
        tool_input = _first_json_object(f.read())

    ctx = item_context(args.level, args.slug)
    errors = validate_draft(args.level, args.slug, tool_input, ctx)
    record = _load_draft(args.level, args.slug)
    record["tool_input"] = tool_input
    record["generator_model"] = args.model
    record["prompt_version"] = PROMPT_VERSION
    record["attempts"].append({"attempt": len(record["attempts"]) + 1, "errors": errors})
    record["status"] = "draft" if not errors else "failed_validation"
    _save_draft(record)

    if errors:
        prompt_path = os.path.join(WEB_DIR, args.level, f"{args.slug}.prompt.md")
        os.makedirs(os.path.dirname(prompt_path), exist_ok=True)
        with open(prompt_path, "w", encoding="utf-8") as f:
            f.write(_web_prompt_text(args.level, args.slug, ctx, errors))
        print(f"{args.slug}: {len(errors)} gate failure(s) — NOT assembled:")
        for e in errors:
            print(f"  - {e}")
        print(f"\nRe-rolled prompt (with these errors appended) rewritten to "
              f"{prompt_path}.\nPaste it into a fresh chat, save the new reply over "
              f"{reply_path}, and run ingest again.")
        raise SystemExit(1)

    assemble.write_lesson_file(args.level, args.slug, tool_input, args.model, PROMPT_VERSION)
    assemble.write_cloze_candidates(args.level, args.slug, tool_input)
    print(f"{args.slug}: PASS — assembled curriculum/grammar/lessons/{args.level}/{args.slug}.md")
    print("When a batch of lessons is in, run generate.py --level "
          f"{args.level}, then validate-schema + compile-curriculum from the repo root.")


def cmd_requests(args):
    """Dry run: write the exact batch payloads for inspection, no API calls."""
    contexts = {slug: item_context(args.level, slug) for slug in args.slugs}
    requests = [build_request(args.level, slug, 1, contexts[slug]) for slug in args.slugs]
    out = os.path.join(DRAFTS_DIR, args.level, "requests-preview.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(requests, f, ensure_ascii=False, indent=2)
    total_chars = sum(len(r["params"]["messages"][0]["content"]) for r in requests)
    print(f"wrote {len(requests)} request payloads to {out} (~{total_chars} prompt chars)")


def cmd_run(args):
    import anthropic

    client = anthropic.Anthropic()
    if not tatoeba.available():
        print("note: Tatoeba exports not found under _build/data — generating "
              "without style anchors (fetch with import/fetch_sources.sh --tatoeba)")

    contexts = {slug: item_context(args.level, slug) for slug in args.slugs}
    records = {slug: _load_draft(args.level, slug) for slug in args.slugs}
    # Resumable: re-validate any stored output against the *current* gate
    # first — a draft collected under an older (stricter/buggier) gate may
    # pass now, and a failing one seeds its first new prompt with current,
    # non-stale feedback.
    pending = {}
    for slug in args.slugs:
        record = records[slug]
        if record["tool_input"] is not None:
            errors = validate_draft(args.level, slug, record["tool_input"], contexts[slug])
            if not errors:
                if record["status"] != "draft":
                    record["status"] = "draft"
                    _save_draft(record)
                print(f"{slug}: stored draft passes the current gate — skipping generation")
                continue
            pending[slug] = errors
        else:
            pending[slug] = None

    for attempt in range(1, MAX_ATTEMPTS + 1):
        if not pending:
            break
        requests = [
            build_request(args.level, slug, attempt, contexts[slug], errors)
            for slug, errors in pending.items()
        ]
        outcomes = _submit_and_collect(client, requests)
        pending = _process_outcomes(args.level, contexts, records, outcomes)

    for slug in pending:
        records[slug]["status"] = "flagged_for_rewrite"
        _save_draft(records[slug])
        print(f"{slug}: still failing after {MAX_ATTEMPTS} attempts — flagged_for_rewrite")

    _assemble(args.level, records.values())


def _process_outcomes(level, contexts, records, outcomes):
    """Validate + persist batch outcomes; returns {slug: errors} still failing.

    custom_ids look like `<level>--<slug>--attempt<N>`.
    """
    next_pending = {}
    for custom_id, outcome in outcomes.items():
        _, slug, attempt_part = custom_id.split("--")
        attempt = int(attempt_part.removeprefix("attempt"))
        record = records.setdefault(slug, _load_draft(level, slug))
        ctx = contexts.setdefault(slug, item_context(level, slug))
        if "error" in outcome:
            record["attempts"].append({"attempt": attempt, "errors": [outcome["error"]]})
            next_pending[slug] = [outcome["error"]]
            print(f"[attempt {attempt}] {slug}: API-level failure: {outcome['error']}")
            _save_draft(record)
            continue
        tool_input = outcome["tool_input"]
        errors = validate_draft(level, slug, tool_input, ctx)
        record["attempts"].append({"attempt": attempt, "errors": errors})
        record["tool_input"] = tool_input
        record["generator_model"] = MODEL
        record["prompt_version"] = PROMPT_VERSION
        if errors:
            next_pending[slug] = errors
            record["status"] = "failed_validation"
            print(f"[attempt {attempt}] {slug}: {len(errors)} gate failure(s)")
            for e in errors:
                print(f"    - {e}")
        else:
            record["status"] = "draft"
            print(f"[attempt {attempt}] {slug}: PASS")
        _save_draft(record)
    return next_pending


def cmd_collect(args):
    """Collect an already-submitted batch by id (e.g. after the polling
    process died with the laptop): validate the results, persist drafts, and
    assemble the passers. Failures stay recorded; rerun `run` to requeue them
    with feedback."""
    import anthropic

    if not args.batch_id:
        raise SystemExit("collect requires --batch-id msgbatch_...")
    client = anthropic.Anthropic()
    batch = client.messages.batches.retrieve(args.batch_id)
    if batch.processing_status != "ended":
        counts = batch.request_counts
        raise SystemExit(
            f"batch {args.batch_id} is still {batch.processing_status} "
            f"(processing={counts.processing}); try again later"
        )
    contexts, records = {}, {}
    pending = _process_outcomes(args.level, contexts, records, _batch_outcomes(client, args.batch_id))
    _assemble(args.level, records.values())
    if pending:
        print("still failing the gate — rerun `run` to requeue with feedback: "
              + ", ".join(sorted(pending)))


def cmd_assemble(args):
    records = []
    level_dir = os.path.join(DRAFTS_DIR, args.level)
    for slug in args.slugs:
        record = _load_draft(args.level, slug)
        if record["tool_input"] is not None:
            records.append(record)
    if not records:
        raise SystemExit(f"no collected drafts under {level_dir}")
    _assemble(args.level, records)


def _assemble(level, records):
    written = 0
    for record in records:
        if record["status"] != "draft" or not record["tool_input"]:
            continue
        path = assemble.write_lesson_file(
            level, record["slug"], record["tool_input"],
            record.get("generator_model", MODEL),
            record.get("prompt_version", PROMPT_VERSION),
        )
        assemble.write_cloze_candidates(level, record["slug"], record["tool_input"])
        written += 1
        print(f"assembled {path}")
    print(f"{written} lesson file(s) written; run generate.py --level {level}, "
          "then validate-schema + compile-curriculum from the repo root.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command",
                        choices=["requests", "run", "assemble", "collect",
                                 "webprompts", "ingest"])
    parser.add_argument("--level", default="n5")
    parser.add_argument("--slugs", default=",".join(PILOT_SLUGS),
                        help="comma-separated grammar slugs (default: the 10-point pilot)")
    parser.add_argument("--slug", default=None,
                        help="ingest only: the single grammar slug to ingest")
    parser.add_argument("--from", dest="from_path", default=None,
                        help="ingest only: path to the pasted reply "
                             "(default: web/<level>/<slug>.reply.md)")
    parser.add_argument("--model", default="web-chat",
                        help="ingest only: provenance recorded in the lesson "
                             "frontmatter, e.g. claude-web or gemini-web")
    parser.add_argument("--batch-id", default=None,
                        help="collect only: the msgbatch_... id to fetch results from")
    args = parser.parse_args()
    args.slugs = [s for s in args.slugs.split(",") if s]

    {"requests": cmd_requests, "run": cmd_run, "assemble": cmd_assemble,
     "collect": cmd_collect, "webprompts": cmd_webprompts,
     "ingest": cmd_ingest}[args.command](args)


if __name__ == "__main__":
    main()
