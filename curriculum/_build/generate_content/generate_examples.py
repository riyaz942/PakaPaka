# -*- coding: utf-8 -*-
"""Phase 2c example-sentence generator for kanji + vocab
(docs/content/content-pipeline-plan.md 2c).

Build-time generation on the maintainer machine, mirroring the 2a/2b pipelines:
one Message Batches request per item (50% cost, latency irrelevant), structured
output via a single forced tool call, drafts written under
generate_content/drafts/examples/, and — only after passing the mechanical gate
(validate_examples.py) — assembled into sidecars that generate.py inlines into
the shipped kanji/vocab JSON. Vocab is unbanded, so its sidecar is named by
level; kanji is banded (reports/kanji_bands.py) and a band mixes source
datasets, so its sidecar is named by *source dataset* instead (see
BANDED_KINDS below — mirrors generate_mnemonics.py):

    curriculum/kanji/examples/<source>.json      # source: n5, n4 or k
    curriculum/vocabulary/examples/<level>.json

Both carry `_meta` (generator_model, prompt_version, review_status: draft) per
item, so compile-curriculum warns on unreviewed prose and nothing ships
silently. Nothing here writes shipped JSON directly.

Per the 2c lane decisions: in-level Tatoeba sentences appear in the prompt as
*style anchors only* (never shipped or adapted — ground rule 2), and furigana
is added by the tokenizer at generate.py time, never by the LLM. The gate
rejects any sentence the tokenizer cannot fully annotate.

Failed drafts are auto-requeued with the gate errors appended to the prompt,
capped at MAX_ATTEMPTS, then recorded `review_status: flagged_for_rewrite`.

Usage (from curriculum/_build, venv with `anthropic` installed):
    .venv/bin/python -m generate_content.generate_examples requests --type vocab
    .venv/bin/python -m generate_content.generate_examples run --type kanji     # needs API credentials
    .venv/bin/python -m generate_content.generate_examples assemble --type vocab
    .venv/bin/python -m generate_content.generate_examples collect --type kanji --batch-id msgbatch_...

The no-API web-chat lane (webprompts/ingest) mirrors 2a/2b for the cost swap.
"""

import argparse
import json
import os
import sys
import time

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BUILD_DIR)

from generate_content import context as grammar_context  # noqa: E402
from generate_content import example_context as ec  # noqa: E402
from generate_content import tatoeba  # noqa: E402
from generate_content.validate_examples import validate_draft  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
PROMPTS_DIR = os.path.join(HERE, "prompts")
DRAFTS_DIR = os.path.join(HERE, "drafts", "examples")
WEB_DIR = os.path.join(HERE, "web", "examples")

MODEL = "claude-opus-4-8"
#: Bump together with the example prompts and persona.md.
PROMPT_VERSION = 1
MAX_ATTEMPTS = 3
MAX_TOKENS = 1500
POLL_SECONDS = 30
POLL_TIMEOUT_SECONDS = 90 * 60

SUBMIT_TOOL = {
    "name": "submit_example_sentences",
    "description": (
        "Submit the completed example sentences for one item. Call exactly once."
    ),
    "strict": True,
    "input_schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["example_sentences"],
        "properties": {
            "example_sentences": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["japanese", "english", "vocabulary_slugs"],
                    "properties": {
                        "japanese": {"type": "string"},
                        "english": {"type": "string"},
                        "vocabulary_slugs": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                    },
                },
            },
        },
    },
}

PROMPT_FILES = {"kanji": "kanji-examples.md", "vocab": "vocab-examples.md"}


def _read_prompt(name):
    with open(os.path.join(PROMPTS_DIR, name), encoding="utf-8") as f:
        return f.read()


def _feedback_block(validator_errors):
    if not validator_errors:
        return ""
    return (
        "\n## An earlier draft failed mechanical validation\n\n"
        "An earlier draft was rejected by the automated gate for the failures "
        "below. Write your sentences so none of them recur:\n"
        + "\n".join(f"- {e}" for e in validator_errors)
    )


def build_user_prompt(kind, ctx, validator_errors=None):
    template = _read_prompt(PROMPT_FILES[kind])
    subs = {
        "{{LEVEL}}": ctx["level"].upper(),
        "{{ALLOWED_VOCAB}}": grammar_context.format_vocab_list(ctx["allowed"]),
        "{{STYLE_ANCHORS}}": tatoeba.format_anchors(ctx["anchors"]),
        "{{VALIDATOR_FEEDBACK}}": _feedback_block(validator_errors),
    }
    if kind == "kanji":
        subs.update({
            "{{CHAR}}": ctx["char"],
            "{{MEANING}}": ctx["meaning"],
            "{{READINGS}}": "、".join(ctx["readings"]) or "(none)",
            "{{TARGET_WORDS}}": ec.format_target_words(ctx["target_words"]),
        })
    else:
        kana_line = (
            f"\n- Reading: **{ctx['reading']}**"
            if ctx["reading"] and ctx["reading"] != ctx["form"] else ""
        )
        subs.update({
            "{{FORM}}": ctx["form"],
            "{{KANA_LINE}}": kana_line,
            "{{MEANING}}": ctx["meaning"],
        })
    for token, value in subs.items():
        template = template.replace(token, value)
    return template


def build_request(level, kind, slug, attempt, ctx, validator_errors=None):
    return {
        "custom_id": f"{level}--{kind}--{slug}--attempt{attempt}",
        "params": {
            "model": MODEL,
            "max_tokens": MAX_TOKENS,
            "system": _read_prompt("persona.md"),
            "tools": [SUBMIT_TOOL],
            "tool_choice": {"type": "tool", "name": SUBMIT_TOOL["name"]},
            "messages": [
                {"role": "user", "content": build_user_prompt(kind, ctx, validator_errors)},
            ],
        },
    }


# --- draft persistence -----------------------------------------------------

def _draft_path(level, kind, slug):
    return os.path.join(DRAFTS_DIR, level, kind, f"{slug}.json")


def _load_draft(level, kind, slug):
    path = _draft_path(level, kind, slug)
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return {"slug": slug, "level": level, "kind": kind, "attempts": [],
            "status": "pending", "tool_input": None}


def _save_draft(record):
    path = _draft_path(record["level"], record["kind"], record["slug"])
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=2)
        f.write("\n")


# --- batch plumbing --------------------------------------------------------

def _extract_tool_input(message):
    for block in message.content:
        if block.type == "tool_use" and block.name == SUBMIT_TOOL["name"]:
            return block.input
    return None


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


def _submit_and_collect(client, requests):
    batch = client.messages.batches.create(requests=requests)
    print(f"submitted batch {batch.id} ({len(requests)} requests)")
    deadline = time.time() + POLL_TIMEOUT_SECONDS
    while True:
        batch = client.messages.batches.retrieve(batch.id)
        if batch.processing_status == "ended":
            break
        if time.time() > deadline:
            raise SystemExit(
                f"batch {batch.id} did not finish within the poll timeout; collect "
                f"it later with: generate_examples collect --batch-id {batch.id} "
                f"--type <kind>"
            )
        counts = batch.request_counts
        print(f"  …{batch.processing_status} (processing={counts.processing} "
              f"succeeded={counts.succeeded} errored={counts.errored})")
        time.sleep(POLL_SECONDS)
    return _batch_outcomes(client, batch.id)


def _split_custom_id(custom_id):
    level, kind, slug, attempt_part = custom_id.split("--")
    return level, kind, slug, int(attempt_part.removeprefix("attempt"))


def _process_outcomes(level, kind, contexts, records, outcomes):
    """Validate + persist batch outcomes; returns {slug: errors} still failing."""
    next_pending = {}
    for custom_id, outcome in outcomes.items():
        _, _, slug, attempt = _split_custom_id(custom_id)
        record = records.setdefault(slug, _load_draft(level, kind, slug))
        ctx = contexts.setdefault(slug, ec.item_context(level, kind, slug))
        if "error" in outcome:
            record["attempts"].append({"attempt": attempt, "errors": [outcome["error"]]})
            next_pending[slug] = [outcome["error"]]
            print(f"[attempt {attempt}] {slug}: API-level failure: {outcome['error']}")
            _save_draft(record)
            continue
        tool_input = outcome["tool_input"]
        errors = validate_draft(level, kind, slug, tool_input, ctx)
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


# --- commands --------------------------------------------------------------

def cmd_requests(args):
    contexts = {slug: ec.item_context(args.level, args.kind, slug) for slug in args.slugs}
    requests = [build_request(args.level, args.kind, slug, 1, contexts[slug]) for slug in args.slugs]
    out = os.path.join(DRAFTS_DIR, args.level, args.kind, "requests-preview.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(requests, f, ensure_ascii=False, indent=2)
    total_chars = sum(len(r["params"]["messages"][0]["content"]) for r in requests)
    print(f"wrote {len(requests)} request payloads to {out} (~{total_chars} prompt chars)")


def cmd_run(args):
    import anthropic

    client = anthropic.Anthropic()
    contexts = {slug: ec.item_context(args.level, args.kind, slug) for slug in args.slugs}
    records = {slug: _load_draft(args.level, args.kind, slug) for slug in args.slugs}

    # Resumable: re-validate stored output against the *current* gate first.
    pending = {}
    for slug in args.slugs:
        record = records[slug]
        if record["tool_input"] is not None:
            errors = validate_draft(args.level, args.kind, slug, record["tool_input"], contexts[slug])
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
            build_request(args.level, args.kind, slug, attempt, contexts[slug], errors)
            for slug, errors in pending.items()
        ]
        outcomes = _submit_and_collect(client, requests)
        pending = _process_outcomes(args.level, args.kind, contexts, records, outcomes)

    for slug in pending:
        records[slug]["status"] = "flagged_for_rewrite"
        _save_draft(records[slug])
        print(f"{slug}: still failing after {MAX_ATTEMPTS} attempts — flagged_for_rewrite")

    write_sidecar(args.level, args.kind)


def cmd_collect(args):
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
    pending = _process_outcomes(
        args.level, args.kind, {}, {}, _batch_outcomes(client, args.batch_id)
    )
    write_sidecar(args.level, args.kind)
    if pending:
        print("still failing the gate — rerun `run` to requeue with feedback: "
              + ", ".join(sorted(pending)))


def cmd_assemble(args):
    write_sidecar(args.level, args.kind)


# --- assembly into sidecars generate.py inlines ----------------------------

SIDECAR_KIND_DIR = {"kanji": "kanji", "vocab": "vocabulary"}

#: Vocab is still authored per level, so its sidecar is still named by one.
#: Kanji is banded (reports/kanji_bands.py) and a band mixes source datasets,
#: so its sidecar is named by the *source dataset* — the thing that stays put
#: when the band moves. generate.py reads it back the same way. Mirrors
#: BANDED_KINDS in generate_mnemonics.py (which covers kanji + radical; there
#: is no radical kind here since radicals get no example sentences).
BANDED_KINDS = ("kanji",)


def _source_map():
    """{slug: source} from bands.json, for kanji."""
    with open(os.path.join(grammar_context.BUILD_DIR, "bands.json"), encoding="utf-8") as f:
        bands = json.load(f)
    return {slug: entry["source"] for slug, entry in bands["kanji"].items()}


def sidecar_path(name, kind):
    """`name` is a level for vocab, a source for kanji."""
    return os.path.join(
        grammar_context.CURRICULUM_DIR, SIDECAR_KIND_DIR[kind], "examples", f"{name}.json"
    )


def write_sidecar(level, kind, only_slugs=None):
    """Rebuild the per-level sidecar from gate-passing drafts on disk. The
    sidecar is keyed by slug; generate.py inlines it into the kanji/vocab
    JSON (adding tokenizer furigana). Idempotent — re-running reconstructs
    from the drafts.

    With `only_slugs=None` (the batch/API lane's usage — cmd_run, cmd_collect,
    cmd_assemble), this reconstructs the WHOLE sidecar from every draft file on
    disk. That is only safe when the on-disk drafts are the sidecar's sole
    source of truth for every slug in this level+kind.

    With `only_slugs` given (the ingest lane's usage — cmd_ingest), only those
    slugs' entries are (re)written; every other slug's existing entry in the
    on-disk sidecar is carried through untouched. This is required because a
    human reviewer may promote a sidecar entry's `review_status` to `reviewed`
    without that change ever being written back to the (gitignored) per-slug
    draft file — a full rebuild would silently drop that review work for every
    slug not just ingested."""
    level_dir = os.path.join(DRAFTS_DIR, level, kind)
    # One level's drafts can land in more than one sidecar: a band mixes source
    # datasets, and the sidecar follows the source. Vocab is unbanded, so its
    # "source" is the level itself.
    source_by_slug = _source_map() if kind in BANDED_KINDS else {}
    drafted = {}

    only_slugs = set(only_slugs) if only_slugs is not None else None
    if os.path.isdir(level_dir):
        for name in sorted(os.listdir(level_dir)):
            if not name.endswith(".json") or name == "requests-preview.json":
                continue
            with open(os.path.join(level_dir, name), encoding="utf-8") as f:
                record = json.load(f)
            if not isinstance(record, dict) or record.get("status") != "draft":
                continue
            if not record.get("tool_input"):
                continue
            if only_slugs is not None and record["slug"] not in only_slugs:
                continue
            meta = {
                "generator_model": record.get("generator_model", MODEL),
                # sidecarMeta.prompt_version is a string in the schema.
                "prompt_version": str(record.get("prompt_version", PROMPT_VERSION)),
                "review_status": "draft",
            }
            source = source_by_slug.get(record["slug"], level)
            drafted.setdefault(source, {})[record["slug"]] = {
                **record["tool_input"], "_meta": meta,
            }

    # A full rebuild of an unbanded kind still rewrites the level's sidecar
    # from scratch, drafts being its sole source of truth. A banded sidecar is
    # shared by every level that draws on that source, so a rebuild driven by
    # one level's drafts must merge — rewriting it would drop the other
    # levels' entries, which no draft of *this* level can restore.
    banded = kind in BANDED_KINDS
    sources = set(drafted) if banded or only_slugs is not None else {level}
    paths = []
    for source in sorted(sources):
        path = sidecar_path(source, kind)
        entries = {}
        if (banded or only_slugs is not None) and os.path.exists(path):
            with open(path, encoding="utf-8") as f:
                entries = json.load(f)
        entries.update(drafted.get(source, {}))
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(entries, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"wrote {len(entries)} {kind} example set(s) to {path}")
        paths.append(path)
    print("run generate.py "
          + ("--bands" if kind in BANDED_KINDS else f"--level {level}")
          + ", then validate-schema + compile-curriculum from the repo root.")
    return paths[0] if len(paths) == 1 else paths


# --- web-chat (no-API) lane, mirroring 2a/2b --------------------------------

WEB_TOOL_LINE = "Call the `submit_example_sentences` tool exactly once with"
WEB_OUTPUT_INSTRUCTION = (
    "Reply with **exactly one** fenced ```json code block and nothing after it. "
    "Do not call any tools, and do not add any commentary outside the block. "
    "The JSON object must use these exact key names, with"
)
WEB_SKELETON = (
    '```json\n{\n  "example_sentences": [\n    {\n      "japanese": "...",\n'
    '      "english": "...",\n      "vocabulary_slugs": ["..."]\n    }\n  ]\n}\n```'
)


def _first_json_object(text):
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
    raise SystemExit("no parseable JSON object found in the reply")


def _web_prompt_text(level, kind, ctx, validator_errors=None):
    persona = _read_prompt("persona.md")
    body = build_user_prompt(kind, ctx, validator_errors)
    body = body.replace(WEB_TOOL_LINE, WEB_OUTPUT_INSTRUCTION)
    header = (
        f"<!-- Paste EVERYTHING below this line into a fresh Claude or Gemini chat.\n"
        f"     Save the reply to web/examples/{level}/{kind}/{ctx['slug']}.reply.md, then run:\n"
        f"       .venv/bin/python -m generate_content.generate_examples ingest \\\n"
        f"         --type {kind} --level {level} --slug {ctx['slug']} --model <claude-web|gemini-web>\n"
        f"-->\n\n"
    )
    return (
        header
        + "# Teaching voice — follow this in everything you write below\n\n"
        + persona.strip() + "\n\n---\n\n" + body.strip() + "\n\n"
        + "For reference the JSON has this shape (keep the key names exactly):\n\n"
        + WEB_SKELETON
        + "\n\nWrite all Japanese plain. Output only the single JSON block.\n"
    )


def _remove_staging_files(*paths):
    """Delete the paste-ready prompt/reply files once a slug has been ingested
    successfully — their content now lives in the draft + sidecar, so leaving
    them behind just litters web/examples/<level>/<kind>/."""
    for path in paths:
        if path and os.path.exists(path):
            os.remove(path)


def cmd_webprompts(args):
    out_dir = os.path.join(WEB_DIR, args.level, args.kind)
    os.makedirs(out_dir, exist_ok=True)
    for slug in args.slugs:
        ctx = ec.item_context(args.level, args.kind, slug)
        path = os.path.join(out_dir, f"{slug}.prompt.md")
        with open(path, "w", encoding="utf-8") as f:
            f.write(_web_prompt_text(args.level, args.kind, ctx))
        print(f"wrote {path}")


def cmd_ingest(args):
    if not args.slug:
        raise SystemExit("ingest requires --slug")
    reply_path = args.from_path or os.path.join(
        WEB_DIR, args.level, args.kind, f"{args.slug}.reply.md")
    if not os.path.exists(reply_path):
        raise SystemExit(f"no reply at {reply_path} — paste the model's answer there first")
    with open(reply_path, encoding="utf-8") as f:
        tool_input = _first_json_object(f.read())

    ctx = ec.item_context(args.level, args.kind, args.slug)
    errors = validate_draft(args.level, args.kind, args.slug, tool_input, ctx)
    record = _load_draft(args.level, args.kind, args.slug)
    record["tool_input"] = tool_input
    record["generator_model"] = args.model
    record["prompt_version"] = PROMPT_VERSION
    record["attempts"].append({"attempt": len(record["attempts"]) + 1, "errors": errors})
    record["status"] = "draft" if not errors else "failed_validation"
    _save_draft(record)

    if errors:
        prompt_path = os.path.join(WEB_DIR, args.level, args.kind, f"{args.slug}.prompt.md")
        os.makedirs(os.path.dirname(prompt_path), exist_ok=True)
        with open(prompt_path, "w", encoding="utf-8") as f:
            f.write(_web_prompt_text(args.level, args.kind, ctx, errors))
        print(f"{args.slug}: {len(errors)} gate failure(s) — NOT assembled:")
        for e in errors:
            print(f"  - {e}")
        raise SystemExit(1)

    write_sidecar(args.level, args.kind, only_slugs=[args.slug])
    prompt_path = os.path.join(WEB_DIR, args.level, args.kind, f"{args.slug}.prompt.md")
    _remove_staging_files(reply_path, prompt_path)
    print(f"{args.slug}: PASS — merged into the {args.kind} examples sidecar")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command",
                        choices=["requests", "run", "assemble", "collect",
                                 "webprompts", "ingest"])
    parser.add_argument("--type", dest="kind", choices=["kanji", "vocab"], required=True)
    parser.add_argument("--level", default="n5")
    parser.add_argument("--slugs", default=None,
                        help="comma-separated slugs (default: every item of the type)")
    parser.add_argument("--slug", default=None, help="ingest only: single slug")
    parser.add_argument("--from", dest="from_path", default=None,
                        help="ingest only: path to the pasted reply")
    parser.add_argument("--model", default="web-chat",
                        help="ingest only: provenance recorded in the sidecar _meta")
    parser.add_argument("--batch-id", default=None,
                        help="collect only: the msgbatch_... id to fetch results from")
    args = parser.parse_args()
    if args.slugs:
        args.slugs = [s for s in args.slugs.split(",") if s]
    else:
        args.slugs = ec.all_slugs(args.level, args.kind)

    {"requests": cmd_requests, "run": cmd_run, "assemble": cmd_assemble,
     "collect": cmd_collect, "webprompts": cmd_webprompts,
     "ingest": cmd_ingest}[args.command](args)


if __name__ == "__main__":
    main()
