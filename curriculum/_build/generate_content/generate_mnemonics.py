# -*- coding: utf-8 -*-
"""Phase 2b/2d radical, kanji + vocabulary prose generator
(docs/content/content-pipeline-plan.md).

Build-time generation on the maintainer machine, mirroring the 2a grammar
pipeline (generate_grammar_lessons.py): one Message Batches request per item
(50% cost, latency irrelevant), structured output via a single forced tool
call, drafts written under generate_content/drafts/mnemonics/, and — only after
passing the mechanical gate (validate_mnemonics.py) — assembled into per-level
sidecars that generate.py inlines into the shipped JSON:

    curriculum/radicals/mnemonics/<level>.json    (mnemonic + image prompt + optional description)
    curriculum/kanji/mnemonics/<level>.json       (meaning/reading mnemonic + optional description)
    curriculum/vocabulary/mnemonics/<level>.json  (meaning/reading mnemonic + optional description)

All three carry `_meta` (generator_model, prompt_version, review_status: draft)
per item, so compile-curriculum warns on unreviewed prose and nothing ships
silently. Nothing here writes shipped JSON directly.

**Generation order is radicals -> kanji -> vocabulary** (Rev 1): each layer's
prompt is built from the layer below it — a kanji story continues its radicals'
established images, a vocabulary story hooks into its kanji's meaning stories —
so regenerating out of order chains onto stale prose.

Per-item injection (docs 2b/2d): the taught decomposition from
dependencies/graph.json in our radical names — never an untaught component; the
reviewed look-alike pairs from _build/visually_similar.py — never a model-invented
confusable; the reading's fixed cast character from the cast bible, since batch
calls are independent and a static style sheet alone won't keep the cast
coherent; and, for vocabulary, the mechanically computed reading regularity that
decides whether the reading gets a story, a one-sentence pointer at the word
that already taught it, or no reading mnemonic at all.

Failed drafts are auto-requeued with the gate errors appended to the prompt,
capped at MAX_ATTEMPTS, then recorded `review_status: flagged_for_rewrite`.
Drafts generated under an older PROMPT_VERSION are regenerated wholesale rather
than patched.

Usage (from curriculum/_build, venv with `anthropic` installed):
    .venv/bin/python -m generate_content.generate_mnemonics requests --type radical
    .venv/bin/python -m generate_content.generate_mnemonics run --type kanji     # needs API credentials
    .venv/bin/python -m generate_content.generate_mnemonics assemble --type kanji
    .venv/bin/python -m generate_content.generate_mnemonics collect --type kanji --batch-id msgbatch_...

The no-API web-chat lane (webprompts/ingest) mirrors 2a for the cost swap.
"""

import argparse
import json
import os
import sys
import time

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BUILD_DIR)

from generate_content import cast as cast_lib  # noqa: E402
from generate_content import mnemonic_context as mc  # noqa: E402
from generate_content.validate_mnemonics import validate_draft  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
PROMPTS_DIR = os.path.join(HERE, "prompts")
DRAFTS_DIR = os.path.join(HERE, "drafts", "mnemonics")
WEB_DIR = os.path.join(HERE, "web", "mnemonics")

MODEL = "claude-opus-4-8"
#: Bump the entry for a type together with that type's prompt, persona.md, or
#: cast-bible.md. Versioned per type because the three prompts move
#: independently, and a draft under an older version is regenerated wholesale.
#: 1 = original (single mnemonic_text per item)
#: 2 = Rev 1 (story-depth mnemonics, radical description replaces the radical
#:     mnemonic, look-alike prose, vocabulary mnemonics)
#: 3 = Rev 2, kanji/vocab only (highlight tags on the borrowed components and
#:     the reading, description optional)
#: 4 = Rev 3, kanji/vocab (length band recalibrated to the reviewed N5 sizes)
#:
#: Rev 4 (sentence-shape guidance in all three prompts + the readability gate
#: in validate_mnemonics) deliberately bumps NOTHING. The maintainer's call:
#: no existing item is rewritten for readability. The gate therefore runs only
#: on freshly generated drafts (_process_outcomes, cmd_ingest); the stored-draft
#: re-validation in cmd_run skips it, so a re-run of a finished level never
#: requeues kept items for sentence length. New slugs get the new prompt and
#: the new gate; old slugs keep their prose.
#:
#: Rev 5 (radicals only: the contract splits into two fields — image_prompt,
#: the stroke-walked scene the Tier 2 art is drawn from, and mnemonic_text,
#: the shorter learner-facing summary of the same scene) also bumps NOTHING.
#: The backfill (prompts/radical-mnemonic-triage.md + radical-mnemonic-
#: simplify.md) copies each kept mnemonic verbatim into image_prompt, so every
#: existing radical already conforms; the gate requires image_prompt only on
#: freshly generated drafts, the same lane as the Rev 4 readability gate.
#:
#: Rev 6 (kanji only, and only the meaning mnemonic: 120–220 characters of plain
#: English in one cause-and-effect chain, the <kanji> landing tag added to the
#: generation prompt, LEN_BOUNDS refitted to 100–260) also bumps NOTHING, for the
#: same reason as Rev 4. All 469 stored kanji are stamped 4 and 351 of them are
#: human-reviewed; numbering this 5 would mark every one of them stale and let
#: the next `run` overwrite reviewed prose to change its house style. Requeue the
#: items you actually want restyled by slug (`--slugs`) instead. New slugs get the
#: new prompt and the new band; old slugs keep their prose until asked.
#:
#: Rev 7 (kanji only: a kanji that *is* a taught radical — same character, same
#: meaning, 山 over the 山 radical — states that instead of inventing a scene;
#: mnemonic_context.identical_radical detects them, the prompt's IDENTITY_NOTE
#: block instructs, and LEN_BOUNDS drops to IDENTITY_MEANING_BOUNDS for them)
#: also bumps NOTHING, same reasoning again. 116 kanji are in the class, 70 of
#: them already have stored prose, and a bump would silently requeue every one.
#: The detector is mechanical, so `--slugs` over that list is the way to restyle
#: them deliberately — which is what the Rev 6/7 sweep did.
#:
#: Rev 9 (kanji only, and only the reading mnemonic: one sentence or two short
#: ones, 90–200 characters, in which the phonetic hook and the kanji's taught
#: meaning are the same joke, with the meaning wrapped in the `<kanji>` tag the
#: meaning mnemonic already uses) also bumps NOTHING, for the same reason as
#: Rev 4/6/7. Every stored reading mnemonic predates the rule — the three-
#: sentence scene with no meaning in it is exactly what the old contract asked
#: for — and the maintainer keeps them. The sentence cap, the tighter band
#: (READING_FRESH_BOUNDS) and the required `<kanji>` tag therefore all ride the
#: enforce_readability lane, and LEN_BOUNDS' stored band only had its floor
#: lowered (120 -> 90), which can pass more stored drafts but never fail one.
#: Restyle by slug (`--slugs`) if you ever do want the old readings redone.
#:
#: After that sweep all 469 stored kanji pass the current meaning gate, so the
#: number 4 is once again an honest "conforms to contract 4". Do not read that
#: as licence to bump: `cmd_run` regenerates any stored draft stamped with an
#: older version, so a bump would throw the sweep away to re-derive what is
#: already there.
#:
#: Radicals go **back to 1**, and that is deliberate rather than a typo: Rev 3
#: reverts the radical contract to the original shape and size — a mnemonic_text
#: of ~150–300 characters, with the description demoted to optional — so the
#: reviewed N5 radicals are exactly what the current prompt asks for. Numbering
#: them 5 would mark 76 kept items stale and regenerate them for nothing.
#:
#: Radicals stay at 1 through the Rev 3 highlight-tag change as well. The tag
#: was added to the existing N5 prose mechanically (nothing was rewritten), so
#: every kept radical already satisfies the current prompt.
#:
#: The number means "conforms to contract N", not "was produced by prompt N".
#: The N5 kanji were generated under 1 and 2 and then brought up to 4 in place,
#: so they are stamped 4 — leaving them behind the current number would mark
#: 106 reviewed items stale and let the next `run` overwrite them.
#:
#: Vocab moves 4 -> 5 for the Rev 5 contract, and here the staleness is the
#: point: the change is a real rewrite, not a retag. Rev 5 cuts the meaning
#: mnemonic to one or two sentences (the cut Rev 8 made to kanji), names the
#: word's part of speech where it teaches a rule, spells out the reading's
#: derivation in the words a course uses — jukugo, on'yomi, kun'yomi, rendaku —
#: and adds the `<vocabulary>` self-tag that a stored Rev 4 draft cannot have,
#: because the tag did not exist. Every N5 word is correctly marked stale by
#: this; nothing is deleted, and stale prose keeps shipping until it is
#: rewritten.
#:
#: Vocab moves 5 -> 6 before a single word was generated under 5, which is what
#: makes the second bump free. Rev 6 takes the derivation *back out* of the
#: prose: naming jukugo/on'yomi/kun'yomi/rendaku was the right information in
#: the wrong place, since `reading_regularity` computes all of it exactly, so it
#: now ships as the `reading_composition` field. Two consequences the contract
#: turns on: a `regular` or `kana_only` word writes **no** `reading_mnemonic` at
#: all (745 of N5+N4's 1,247 words), and a word whose reading an earlier word
#: already taught — 答え after 答える, 書ける after 書く, 90 words at N5+N4 —
#: writes one sentence pointing back at that word instead of a rival hook.
#:
#: Rev 6 later split `kana_only` back out of that pair, in place rather than as
#: a Rev 7. Dropping the reading mnemonic was right for both kinds — neither
#: reading needs *decoding* — but a kanji word's sound still rides its kanji,
#: and a kana word's rode nothing at all, so どれ shipped a scene about
#: identical onigiri with its sound nowhere on the page. A kana word still
#: writes no `reading_mnemonic`; its meaning mnemonic now carries the sound hook
#: instead, which is the only field it has.
#:
#: This rides Rev 6 rather than bumping to 7 because the amendment reaches only
#: the ~200 kana words of N5+N4: a bump would requeue all 861 vocab drafts,
#: including reviewed kanji-word prose the new rule cannot change. The kana
#: drafts already written under Rev 6 were instead stamped back to 5 by hand, so
#: the staleness check below picks up exactly them and nothing else.
#:
#: The untaught-component amendment rides Rev 6 the same way, for the same
#: reason. A word may be written with a kanji banded above its own level — 昨 in
#: N5's 昨日 — and until now the prompt named only the kanji the level teaches,
#: so the story explained half a word while the app rendered a chip for the other
#: half. `vocab_context` now also returns the `builds_on` kanji, meaning-only and
#: minus the ones that merely restate the word, and the prompt asks for them. It
#: reaches ~800 of the 9,474 kanji words; a version bump would requeue every
#: reviewed draft to no purpose, so the affected drafts are stamped back to 5 by
#: hand instead.
PROMPT_VERSION = {"radical": 1, "kanji": 4, "vocab": 6}
MAX_ATTEMPTS = 3
MAX_TOKENS = 3000
POLL_SECONDS = 30
POLL_TIMEOUT_SECONDS = 90 * 60

SUBMIT_TOOLS = {
    "kanji": {
        "name": "submit_kanji_mnemonic",
        "description": (
            "Submit the completed mnemonics for one kanji. Call exactly once."
        ),
        "strict": True,
        "input_schema": {
            "type": "object",
            "additionalProperties": False,
            # Rev 2: `description` is optional — omit it unless this item has a
            # nuance the two mnemonics cannot carry (reviewed look-alikes to
            # contrast, an odd register, a usage trap).
            "required": ["meaning_mnemonic", "reading_mnemonic"],
            "properties": {
                "meaning_mnemonic": {"type": "string"},
                "reading_mnemonic": {"type": "string"},
                "description": {"type": "string"},
            },
        },
    },
    "radical": {
        "name": "submit_radical_mnemonic",
        "description": (
            "Submit the completed mnemonic for one radical. Call exactly once."
        ),
        "strict": True,
        "input_schema": {
            "type": "object",
            "additionalProperties": False,
            # Rev 5: two texts for one scene — `image_prompt` is the
            # stroke-walked prompt the Tier 2 art is drawn from (illustrator
            # only), `mnemonic_text` the shorter learner-facing summary of it.
            # Rev 3: `description` is optional here too — omit it unless the
            # radical has reviewed look-alikes to contrast or a nuance the
            # mnemonic cannot carry.
            "required": ["mnemonic_text", "image_prompt"],
            "properties": {
                "mnemonic_text": {"type": "string"},
                "image_prompt": {"type": "string"},
                "description": {"type": "string"},
            },
        },
    },
    "vocab": {
        "name": "submit_vocab_mnemonic",
        "description": (
            "Submit the completed mnemonics for one vocabulary word. Call exactly once."
        ),
        "strict": True,
        "input_schema": {
            "type": "object",
            "additionalProperties": False,
            # Rev 2: `description` is optional — omit it unless this item has a
            # nuance the two mnemonics cannot carry (reviewed look-alikes to
            # contrast, an odd register, a usage trap).
            #
            # Rev 6: `reading_mnemonic` is optional too, because for a word whose
            # reading is simply what its kanji say the honest answer is to write
            # none — the shipped `reading_composition` field says it better. Only
            # the gate can tell which words those are (it is a property of the
            # segmentation, not of the request), so the schema allows the absence
            # and `validate_vocab` decides whether it was correct.
            "required": ["meaning_mnemonic"],
            "properties": {
                "meaning_mnemonic": {"type": "string"},
                "reading_mnemonic": {"type": "string"},
                "description": {"type": "string"},
            },
        },
    },
}

PROMPT_FILES = {
    "kanji": "kanji-mnemonic.md",
    "radical": "radical-mnemonic.md",
    "vocab": "vocab-mnemonic.md",
}

#: Curriculum directory each type's items and sidecar live under.
KIND_DIR = {"kanji": "kanji", "radical": "radicals", "vocab": "vocabulary"}


def _read_prompt(name):
    with open(os.path.join(PROMPTS_DIR, name), encoding="utf-8") as f:
        return f.read()


def _feedback_block(validator_errors):
    if not validator_errors:
        return ""
    return (
        "\n## An earlier draft failed mechanical validation\n\n"
        "An earlier draft was rejected by the automated gate for the failures "
        "below. Write your mnemonic(s) so none of them recur:\n"
        + "\n".join(f"- {e}" for e in validator_errors)
    )


def build_user_prompt(kind, ctx, validator_errors=None):
    template = _read_prompt(PROMPT_FILES[kind])
    if kind == "kanji":
        subs = {
            "{{LEVEL}}": ctx["level"].upper(),
            "{{CHAR}}": ctx["char"],
            "{{MEANING}}": ctx["meaning"],
            "{{MEANING_SYNONYMS}}": ", ".join(dict.fromkeys(ctx["meaning_synonyms"])),
            "{{ONYOMI}}": "、".join(ctx["onyomi"]) or "(none)",
            "{{KUNYOMI}}": "、".join(ctx["kunyomi"]) or "(none)",
            "{{PRIMARY_READING}}": ctx["primary_reading"] or "(none)",
            "{{COMPONENTS}}": mc.format_components(ctx["components"]),
            "{{IDENTITY_NOTE}}": mc.format_identity(ctx),
            "{{LOOK_ALIKES}}": mc.format_look_alikes(ctx["look_alikes"]),
            "{{CAST_BLOCK}}": cast_lib.format_cast_block(ctx["reading_lore"], ctx["cast"]),
            "{{VALIDATOR_FEEDBACK}}": _feedback_block(validator_errors),
        }
    elif kind == "vocab":
        subs = {
            "{{LEVEL}}": ctx["level"].upper(),
            "{{FORM}}": ctx["form"],
            "{{READING}}": ctx["reading"],
            "{{MEANING}}": ctx["meaning"],
            "{{MEANING_SYNONYMS}}": ", ".join(dict.fromkeys(ctx["meaning_synonyms"])),
            "{{WORD_TYPE}}": mc.format_word_type(ctx["word_type"]),
            "{{COMPONENTS}}": mc.format_vocab_components(ctx),
            "{{IDENTITY_NOTE}}": mc.format_vocab_identity(
                ctx["identical_kanji"], ctx["meaning"], ctx["form"]),
            "{{REGULARITY}}": mc.format_regularity(ctx),
            "{{READING_COMPOSITION}}": ctx["reading_composition"],
            "{{CAST_BLOCK}}": cast_lib.format_cast_block(
                ctx["reading_lore"], ctx["cast"], subject="this word"),
            "{{VALIDATOR_FEEDBACK}}": _feedback_block(validator_errors),
        }
    else:
        subs = {
            "{{LEVEL}}": ctx["level"].upper(),
            "{{FORM}}": ctx["form"],
            "{{MEANING}}": ctx["meaning"],
            "{{MEANING_SYNONYMS}}": ", ".join(dict.fromkeys(ctx["meaning_synonyms"])),
            "{{LOOK_ALIKES}}": mc.format_look_alikes(ctx["look_alikes"]),
            "{{VALIDATOR_FEEDBACK}}": _feedback_block(validator_errors),
        }
    for token, value in subs.items():
        template = template.replace(token, value)
    return template


def _context_for(level, kind, slug):
    builder = {"kanji": mc.kanji_context, "radical": mc.radical_context,
               "vocab": mc.vocab_context}[kind]
    return builder(level, slug)


def build_request(level, kind, slug, attempt, ctx, validator_errors=None):
    tool = SUBMIT_TOOLS[kind]
    return {
        "custom_id": f"{level}--{kind}--{slug}--attempt{attempt}",
        "params": {
            "model": MODEL,
            "max_tokens": MAX_TOKENS,
            "system": _read_prompt("persona.md"),
            "tools": [tool],
            "tool_choice": {"type": "tool", "name": tool["name"]},
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

def _extract_tool_input(message, tool_name):
    for block in message.content:
        if block.type == "tool_use" and block.name == tool_name:
            return block.input
    return None


def _batch_outcomes(client, batch_id, tool_name):
    outcomes = {}
    for result in client.messages.batches.results(batch_id):
        entry = result.result
        if entry.type == "succeeded":
            message = entry.message
            if message.stop_reason == "refusal":
                outcomes[result.custom_id] = {"error": "model refusal"}
                continue
            tool_input = _extract_tool_input(message, tool_name)
            if tool_input is None:
                outcomes[result.custom_id] = {
                    "error": f"no tool call in response (stop_reason={message.stop_reason})"
                }
            else:
                outcomes[result.custom_id] = {"tool_input": tool_input}
        else:
            outcomes[result.custom_id] = {"error": f"batch result type {entry.type}"}
    return outcomes


def _submit_and_collect(client, requests, tool_name):
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
                f"it later with: generate_mnemonics collect --batch-id {batch.id} "
                f"--type <kind>"
            )
        counts = batch.request_counts
        print(f"  …{batch.processing_status} (processing={counts.processing} "
              f"succeeded={counts.succeeded} errored={counts.errored})")
        time.sleep(POLL_SECONDS)
    return _batch_outcomes(client, batch.id, tool_name)


def _split_custom_id(custom_id):
    level, kind, slug, attempt_part = custom_id.split("--")
    return level, kind, slug, int(attempt_part.removeprefix("attempt"))


def _process_outcomes(level, kind, contexts, records, outcomes):
    """Validate + persist batch outcomes; returns {slug: errors} still failing."""
    next_pending = {}
    for custom_id, outcome in outcomes.items():
        _, _, slug, attempt = _split_custom_id(custom_id)
        record = records.setdefault(slug, _load_draft(level, kind, slug))
        ctx = contexts.setdefault(slug, _context_for(level, kind, slug))
        if "error" in outcome:
            record["attempts"].append({"attempt": attempt, "errors": [outcome["error"]]})
            next_pending[slug] = [outcome["error"]]
            print(f"[attempt {attempt}] {slug}: API-level failure: {outcome['error']}")
            _save_draft(record)
            continue
        tool_input = outcome["tool_input"]
        # Freshly generated output faces the Rev 4 readability gate; stored
        # drafts re-validated in cmd_run do not (see PROMPT_VERSION).
        errors = validate_draft(level, kind, slug, tool_input, ctx,
                                enforce_readability=True)
        record["attempts"].append({"attempt": attempt, "errors": errors})
        record["tool_input"] = tool_input
        record["generator_model"] = MODEL
        record["prompt_version"] = PROMPT_VERSION[kind]
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

def _default_slugs(level, kind):
    return mc.all_slugs(level, KIND_DIR[kind])


def cmd_requests(args):
    contexts = {slug: _context_for(args.level, args.kind, slug) for slug in args.slugs}
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
    tool_name = SUBMIT_TOOLS[args.kind]["name"]
    contexts = {slug: _context_for(args.level, args.kind, slug) for slug in args.slugs}
    records = {slug: _load_draft(args.level, args.kind, slug) for slug in args.slugs}

    # Resumable: re-validate stored output against the *current* gate first.
    # A draft from an older prompt version is regenerated wholesale, not
    # patched (docs Rev 1: "regenerate wholesale under prompt_version: 2").
    pending = {}
    for slug in args.slugs:
        record = records[slug]
        if record.get("prompt_version") not in (None, PROMPT_VERSION[args.kind]):
            print(f"{slug}: draft was generated under prompt_version "
                  f"{record['prompt_version']} — regenerating")
            pending[slug] = None
        elif record["tool_input"] is not None:
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
        outcomes = _submit_and_collect(client, requests, tool_name)
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
    tool_name = SUBMIT_TOOLS[args.kind]["name"]
    pending = _process_outcomes(
        args.level, args.kind, {}, {}, _batch_outcomes(client, args.batch_id, tool_name)
    )
    write_sidecar(args.level, args.kind)
    if pending:
        print("still failing the gate — rerun `run` to requeue with feedback: "
              + ", ".join(sorted(pending)))


def cmd_assemble(args):
    write_sidecar(args.level, args.kind)


# --- assembly into sidecars generate.py inlines ----------------------------

#: Vocabulary is still authored per level, so its sidecar is still named by
#: one. Radicals and kanji are banded (reports/kanji_bands.py) and a band mixes
#: sources, so their sidecar is named by the *source dataset* — the thing that
#: stays put when the band moves. generate.py reads them back the same way.
BANDED_KINDS = ("kanji", "radical")


def _source_map(kind):
    """{slug: source} from bands.json, for the kinds a band can move."""
    with open(os.path.join(mc.BUILD_DIR, "bands.json"), encoding="utf-8") as f:
        bands = json.load(f)
    return {slug: entry["source"]
            for slug, entry in bands["radicals" if kind == "radical" else "kanji"].items()}


def sidecar_path(name, kind):
    """`name` is a level for vocabulary, a source for radicals and kanji."""
    return os.path.join(mc.CURRICULUM_DIR, KIND_DIR[kind], "mnemonics", f"{name}.json")


def write_sidecar(level, kind, only_slugs=None):
    """Rebuild the per-level sidecar from gate-passing drafts on disk. The
    sidecar is keyed by slug; generate.py inlines it into the kanji/radical
    JSON.

    With `only_slugs=None` (the batch/API lane's usage — cmd_run, cmd_collect,
    cmd_assemble), this reconstructs the WHOLE sidecar from every draft file on
    disk, as before. That is only safe when the on-disk drafts are the sidecar's
    sole source of truth for every slug in this level+kind.

    With `only_slugs` given (the ingest lane's usage — cmd_ingest), only those
    slugs' entries are (re)written; every other slug's existing entry in the
    on-disk sidecar is carried through untouched. This is required because a
    human reviewer may promote a sidecar entry's `review_status` to `reviewed`
    or add a `description` directly in the sidecar, without that change ever
    being written back to the (gitignored) per-slug draft file — a full rebuild
    would silently drop that review work for every slug not just ingested."""
    level_dir = os.path.join(DRAFTS_DIR, level, kind)
    # One level's drafts can land in more than one sidecar: a band mixes source
    # datasets, and the sidecar follows the source. Vocabulary is unbanded, so
    # its "source" is the level itself.
    source_by_slug = _source_map(kind) if kind in BANDED_KINDS else {}
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
                # sidecarMeta.prompt_version is a string in the schema (matches
                # the grammar lesson frontmatter, which stores scalars as text).
                "prompt_version": str(record.get("prompt_version", PROMPT_VERSION[kind])),
                "review_status": "draft",
            }
            source = source_by_slug.get(record["slug"], level)
            drafted.setdefault(source, {})[record["slug"]] = {
                **record["tool_input"], "_meta": meta,
            }

    # A full rebuild of an unbanded kind still rewrites the level's sidecar from
    # scratch, drafts being its sole source of truth. A banded sidecar is shared
    # by every level that draws on that source, so a rebuild driven by one
    # level's drafts must merge — rewriting it would drop the other levels'
    # entries, which no draft of *this* level can restore.
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
        print(f"wrote {len(entries)} {kind} mnemonic(s) to {path}")
        paths.append(path)
    print("run generate.py "
          + ("--bands" if kind in BANDED_KINDS else f"--level {level}")
          + ", then validate-schema + compile-curriculum from the repo root.")
    return paths[0] if len(paths) == 1 else paths


# --- web-chat (no-API) lane, mirroring 2a ----------------------------------

WEB_TOOL_LINE = {
    kind: f"Call the `{tool['name']}` tool exactly once with:"
    for kind, tool in SUBMIT_TOOLS.items()
}
WEB_OUTPUT_INSTRUCTION = (
    "Reply with **exactly one** fenced ```json code block and nothing after it. "
    "Do not call any tools, and do not add any commentary outside the block. "
    "The JSON object must use these exact key names:"
)
_OPTIONAL_DESCRIPTION_LINE = (
    "\n\nand, only when this item needs one, with `description` added:\n\n")
_SPLIT_SKELETON = ('```json\n{\n  "meaning_mnemonic": "...",\n  '
                   '"reading_mnemonic": "..."\n}\n```'
                   + _OPTIONAL_DESCRIPTION_LINE +
                   '```json\n{\n  "meaning_mnemonic": "...",\n  '
                   '"reading_mnemonic": "...",\n  "description": "..."\n}\n```')
#: Rev 6: a vocabulary word whose reading is simply what its kanji say writes no
#: `reading_mnemonic` at all — the reading section of the prompt says which words
#: those are — so the vocab skeleton has to show that key as droppable. The kanji
#: lane keeps `_SPLIT_SKELETON`, where both mnemonics are always required.
_VOCAB_SKELETON = (
    '```json\n{\n  "meaning_mnemonic": "...",\n  "reading_mnemonic": "..."\n}\n```'
    "\n\nDrop `reading_mnemonic` entirely when the reading section above says "
    "this word gets none, and add `description` only when this word needs one:"
    "\n\n"
    '```json\n{\n  "meaning_mnemonic": "...",\n  "description": "..."\n}\n```'
)
WEB_SKELETON = {
    "kanji": _SPLIT_SKELETON,
    "vocab": _VOCAB_SKELETON,
    "radical": ('```json\n{\n  "mnemonic_text": "...",\n  "image_prompt": "..."\n}\n```'
                + _OPTIONAL_DESCRIPTION_LINE +
                '```json\n{\n  "mnemonic_text": "...",\n  "image_prompt": "...",\n  '
                '"description": "..."\n}\n```'),
}


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
    body = body.replace(WEB_TOOL_LINE[kind], WEB_OUTPUT_INSTRUCTION)
    header = (
        f"<!-- Paste EVERYTHING below this line into a fresh Claude or Gemini chat.\n"
        f"     Save the reply to web/mnemonics/{level}/{kind}/{ctx['slug']}.reply.md, then run:\n"
        f"       .venv/bin/python -m generate_content.generate_mnemonics ingest \\\n"
        f"         --type {kind} --level {level} --slug {ctx['slug']} --model <claude-web|gemini-web>\n"
        f"-->\n\n"
    )
    return (
        header
        + "# Teaching voice — follow this in everything you write below\n\n"
        + persona.strip() + "\n\n---\n\n" + body.strip() + "\n\n"
        + "For reference the JSON has this shape (keep the key names exactly):\n\n"
        + WEB_SKELETON[kind]
        + "\n\nWrite all Japanese plain. Output only the single JSON block.\n"
    )


def _remove_staging_files(*paths):
    """Delete the paste-ready prompt/reply files once a slug has been ingested
    successfully — their content now lives in the draft + sidecar, so leaving
    them behind just litters web/mnemonics/<level>/<kind>/."""
    for path in paths:
        if path and os.path.exists(path):
            os.remove(path)


def cmd_webprompts(args):
    out_dir = os.path.join(WEB_DIR, args.level, args.kind)
    os.makedirs(out_dir, exist_ok=True)
    for slug in args.slugs:
        ctx = _context_for(args.level, args.kind, slug)
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

    ctx = _context_for(args.level, args.kind, args.slug)
    # The web lane generates new content, so the Rev 4 readability gate applies.
    errors = validate_draft(args.level, args.kind, args.slug, tool_input, ctx,
                            enforce_readability=True)
    record = _load_draft(args.level, args.kind, args.slug)
    record["tool_input"] = tool_input
    record["generator_model"] = args.model
    record["prompt_version"] = PROMPT_VERSION[args.kind]
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
    print(f"{args.slug}: PASS — merged into the {args.kind} sidecar")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command",
                        choices=["requests", "run", "assemble", "collect",
                                 "webprompts", "ingest"])
    parser.add_argument("--type", dest="kind", choices=["kanji", "radical", "vocab"],
                        required=True)
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
        args.slugs = _default_slugs(args.level, args.kind)

    {"requests": cmd_requests, "run": cmd_run, "assemble": cmd_assemble,
     "collect": cmd_collect, "webprompts": cmd_webprompts,
     "ingest": cmd_ingest}[args.command](args)


if __name__ == "__main__":
    main()
