# -*- coding: utf-8 -*-
"""Naturalness review for generated reading passages (Phase 4, after the gate).

`validate_readings.py` checks mechanics: level, length, grammar coverage, span
integrity, furigana. It cannot check whether the Japanese reads like Japanese.
That gap is documented as cause 6 in docs/content/
reading-passage-minna-no-nihongo-alignment.md, and every naturalness defect
found so far reached a human with the whole gate green:

    箱が先月から待っています   — a box does not wait
    角に持っていきました        — that is carrying, not putting down
    「明日も来ます」と話しました — 話す does not carry a quotation
    お茶は辛いです              — 辛い is spicy, the tea was salty

This module is the missing pass. It reads a **gate-passing draft** and asks a
fresh model whether a Japanese reader would object to any sentence in it, then
applies the sentence rewrites it returns and puts the result back through the
same gate.

## Why the reviewer is given the allowed lists

The obvious way to build this is to hand a passage to a model and ask "is this
natural?". That produces suggestions the level cannot use. Real example, from an
outside review of seed 12: the reviewer was right that 箱が待っています is wrong,
and proposed 置いてあります — which is `tearu`, N4 grammar, off the list at
every N5 seed. It also proposed the counter 二着, which is in neither level.

So the prompt carries the seed's **whole allowed vocabulary and grammar window**,
and the contract asks for a replacement written inside it. A reviewer that cannot
see the window cannot propose a fix, only a complaint.

## Applying the fixes

Findings are per-sentence and exact: `original` must be one of the body's
sentences, copied character for character. `ingest` swaps each flagged sentence
for its `replacement`, applies the reply's `english_translation` (required
whenever anything changed — a rewritten sentence makes the old translation
wrong), and re-runs `validate_draft` on the whole corrected passage.

**A correction that fails the gate is rejected, not merged.** The draft on disk
keeps its original body, the gate errors are appended to the prompt file for a
repair round, and the command exits non-zero. There is no path where a rewrite
lands without passing the same checks the generation lane passes.

No-API subagent lane, mirroring audit_semantic.py and generate_readings.py:

Run (from curriculum/_build):
    .venv/bin/python -m generate_content.naturalness_check webprompts --level n5
    .venv/bin/python -m generate_content.naturalness_check ingest --level n5 \
        --slug hako-no-naka-no-fuyu --model opus-5
    .venv/bin/python -m generate_content.naturalness_check --selftest

See docs/workflows/reading-passages-naturalness-subagent-workflow-automation-prompt.md
for the run procedure.
"""

import argparse
import json
import os
import re
import sys

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BUILD_DIR)

from generate_content import context as grammar_context  # noqa: E402
from generate_content import reading_context as rc  # noqa: E402
from generate_content import reading_seeds  # noqa: E402
from generate_content.validate_readings import validate_draft  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
DRAFTS_DIR = os.path.join(HERE, "drafts", "readings")
WEB_DIR = os.path.join(HERE, "web", "naturalness")

#: Bump with the reviewer prompt below. A draft records the version it was
#: reviewed under, so a bump re-opens every draft for review without
#: invalidating what an earlier version already fixed.
#: 2 — "this is a teaching text, not literature". Version 1 cleared seed 12's
#: 箱が先月から待っています as "a deliberate literary device signalled by the
#: title 箱の冬" — the defect an outside review had already reported. A reviewer
#: allowed to read a sentence as intentional style can clear anything.
REVIEW_VERSION = 2

SYSTEM_PROMPT = """\
You are a Japanese native speaker reading a graded-reader passage written for a
learner. Your one job is to find sentences a Japanese person would not write.

You are looking for Japanese that is **wrong**, not Japanese that is simple:

- a verb that does not take that noun — 薬を食べる, 写真を取る
- a word used outside its meaning — 冷たい for cold weather
- an inanimate subject given a verb that needs a person — 窓が外を見ています
- a counter the object does not take — 犬が二枚
- a tense that contradicts the time word — 先週は忙しいです
- a particle that changes who did what to whom — 友達を会いました
- a sentence that is grammatical and says nothing a person would mean

Those are the *kinds* of error, with examples chosen from outside this passage.
Judge what is actually on the page; do not go looking for these seven.

You are **not** looking for:

- short sentences, plain vocabulary, or a simple structure. This passage is
  written for a beginner and is *supposed* to be plain.
- a more elegant way to say the same correct thing. If the sentence is right, it
  is not a finding.
- repetition, pacing, or how interesting the passage is.

**This is a teaching text, not literature.** Do not clear a sentence by reading
it as a deliberate device — personification, irony, or a joke that only works if
the reader recognises it as a joke. The learner reads every sentence here as a
model of ordinary Japanese and will copy it. A sentence that is correct *only*
when read as a device is a finding, and the title is not a licence: 箱の冬 does
not make 箱が待っています something to write.

The passage is written inside a fixed teaching window, and **your replacement
must stay inside it**. The exact vocabulary and grammar the learner has met are
listed below. A correction built from anything else is worse than no correction:
it will be rejected by the build, and the sentence you objected to will stay.

If a sentence is wrong and the window gives you no way to say it correctly, say
so in the `issue` and write a `replacement` that drops the idea and keeps the
passage coherent. Losing a detail is the correct answer here.

Most passages have nothing wrong with them. An empty findings list is the
expected result, not a failure to look hard enough.\
"""

REPLY_CONTRACT = """\
Reply with **exactly one** fenced ```json code block and nothing else — no
commentary before or after it, and do not call any tools. The JSON object must
have these keys:

- `"sentences_checked"`: the integer **{count}** — the number of numbered
  sentences above. You must judge every one of them.
- `"findings"`: an array, one entry per sentence a Japanese reader would object
  to. Sentences with nothing wrong must not appear; an empty array is the
  expected, common result. Each entry is:
  - `"original"`: the sentence, **copied character for character** from the
    numbered list above, including its 。 — not retyped, not abbreviated, and
    never a fragment of a sentence.
  - `"issue"`: one sentence naming what is wrong. Say what the Japanese
    currently means, not only that it is unnatural.
  - `"replacement"`: the corrected sentence, built only from the allowed
    vocabulary and grammar above, ending in 。 — plain Japanese, one line, no
    furigana, no brackets, no romaji.
- `"english_translation"`: **required whenever `findings` is not empty** — the
  full English translation of the corrected passage, one English sentence per
  Japanese sentence, in the same order. Omit this key only when `findings` is
  empty.

Three keys are optional, and you include one only if your rewrite made the
shipped version wrong:

- `"summary_ja"` — replace it if a rewritten sentence changed what the passage
  says. It is level-checked too, so keep it inside the same window.
- `"summary_en"` — the English of the same.
- `"questions"` — the **whole** questions array, in the passage's format. You
  need this when a sentence you rewrote contained a question's answer: every
  question must still have at least one accepted answer that appears in the
  corrected body **exactly as written there**.\
"""

WEB_SKELETON = (
    '```json\n{\n  "sentences_checked": 0,\n  "findings": [\n'
    '    {"original": "...", "issue": "...", "replacement": "..."}\n  ],\n'
    '  "english_translation": "..."\n}\n```'
)

FENCE_RE = re.compile(r"```json\s*(.*?)```", re.DOTALL)


# --- the body as sentences ---------------------------------------------------

def split_sentences(body):
    """The body's sentences, each keeping its 。

    Split on 。 at quote depth zero. A passage with dialogue writes the spoken
    line inside 「」 and closes the sentence outside it, so a naive split on 。
    is right almost always — but 「もう帰ります。」と言いました would break into
    a fragment that no `original` could ever match, and a finding that cannot be
    matched is reported to the operator as malformed rather than applied. The
    depth counter costs six lines and removes that failure.
    """
    sentences, start, depth = [], 0, 0
    for i, ch in enumerate(body):
        if ch in "「『":
            depth += 1
        elif ch in "」』":
            depth = max(0, depth - 1)
        elif ch == "。" and depth == 0:
            sentences.append(body[start:i + 1])
            start = i + 1
    tail = body[start:].strip()
    if tail:
        sentences.append(tail)
    return sentences


# --- prompt construction -----------------------------------------------------

def _passage_block(draft):
    sentences = split_sentences(draft["body"].strip())
    numbered = "\n".join(f"{i + 1}. {s}" for i, s in enumerate(sentences))
    questions = json.dumps(
        draft.get("questions") or [], ensure_ascii=False, indent=2
    )
    return sentences, (
        f"## The passage\n\n"
        f"**Title:** {draft['title']}\n\n"
        f"The body, one numbered sentence per line. Copy from here when you "
        f"fill in `original`:\n\n"
        f"{numbered}\n\n"
        f"**The whole body as one paragraph:**\n\n{draft['body'].strip()}\n\n"
        f"**English translation shipped with it:**\n\n"
        f"{draft['english_translation'].strip()}\n\n"
        f"**Japanese summary:** {draft['summary_ja'].strip()}\n\n"
        f"**English summary:** {draft['summary_en'].strip()}\n\n"
        f"**Comprehension questions** (each needs an accepted answer that "
        f"appears in the body exactly as written there):\n\n"
        f"```json\n{questions}\n```"
    )


def _window_block(ctx):
    """The seed's whole window. This is what separates a usable correction from
    a complaint — see the module docstring."""
    names = sorted(ctx["seed"].get("extra_allowed", []))
    names_line = (
        "\n\n### Names\n\nThese names exist for this passage: "
        + "、".join(names)
        + ". Do not introduce others."
    ) if names else ""
    return (
        "## The window this passage is written inside\n\n"
        "The learner has met exactly the words and patterns below and nothing "
        "else. **Every replacement you write must come from these lists** — a "
        "correction that reaches outside them is rejected by the build and the "
        "sentence you objected to stays as it is.\n\n"
        "### Vocabulary\n\n"
        + grammar_context.format_vocab_list(ctx["allowed"])
        + names_line
        + "\n\n### Grammar\n\n"
        + rc.format_grammar_list(ctx["allowed_grammar"])
    )


def build_prompt(level, slug, ctx, draft, gate_errors=None):
    sentences, passage = _passage_block(draft)
    header = (
        f"<!-- Paste EVERYTHING below this line into a fresh chat, or hand this "
        f"file to a fresh subagent.\n"
        f"     Save the reply to web/naturalness/{level}/{slug}.reply.md, then run:\n"
        f"       .venv/bin/python -m generate_content.naturalness_check ingest \\\n"
        f"         --level {level} --slug {slug} --model <model-name>\n"
        f"     Read files and write only your reply file; never edit curriculum, "
        f"drafts, validators or prompts.\n"
        f"-->\n\n"
    )
    parts = [
        SYSTEM_PROMPT.strip(),
        passage,
        _window_block(ctx),
        REPLY_CONTRACT.format(count=len(sentences)).strip(),
        "For reference the JSON has this shape (keep the key names exactly):\n\n"
        + WEB_SKELETON,
    ]
    if gate_errors:
        parts.append(
            "## Your last correction was rejected\n\n"
            "The corrected passage was put back through the build's mechanical "
            "gate and failed on the points below. The draft still has its "
            "original body. Review it again and write corrections that do not "
            "cause these:\n\n"
            + "\n".join(f"- {e}" for e in gate_errors)
        )
    return header + "\n\n---\n\n".join(parts) + "\n"


# --- reply contract ----------------------------------------------------------

class ReplyError(ValueError):
    """The reply does not meet the contract. Never silently tolerated: the
    operator sees it and the draft is left alone."""


def extract_json_block(text):
    matches = FENCE_RE.findall(text)
    if len(matches) != 1:
        raise ReplyError(
            f"expected exactly one fenced ```json block, found {len(matches)}"
        )
    try:
        return json.loads(matches[0].strip())
    except json.JSONDecodeError as exc:
        raise ReplyError(f"invalid JSON in fenced block: {exc}") from exc


def validate_reply(obj, sentences):
    """Check the reply against the contract; return its findings.

    Every rule here exists to make the rewrite *applicable*. A finding whose
    `original` is retyped rather than copied, or is half a sentence, cannot be
    swapped into the body unambiguously — so it is a malformed reply, not a
    finding to apply approximately.
    """
    if not isinstance(obj, dict):
        raise ReplyError("reply is not a JSON object")

    allowed_keys = {
        "sentences_checked", "findings", "english_translation",
        "summary_ja", "summary_en", "questions",
    }
    unknown = sorted(set(obj) - allowed_keys)
    if unknown:
        raise ReplyError(f"unknown key(s) in reply: {', '.join(unknown)}")

    for key in ("sentences_checked", "findings"):
        if key not in obj:
            raise ReplyError(f"reply is missing {key!r}")

    checked = obj["sentences_checked"]
    if not isinstance(checked, int) or isinstance(checked, bool):
        raise ReplyError("'sentences_checked' must be an integer")
    if checked != len(sentences):
        raise ReplyError(
            f"'sentences_checked' is {checked}, but the passage has "
            f"{len(sentences)} sentence(s) — every sentence must be judged"
        )

    findings = obj["findings"]
    if not isinstance(findings, list):
        raise ReplyError("'findings' must be an array")

    by_sentence = {}
    for finding in findings:
        if not isinstance(finding, dict):
            raise ReplyError("each finding must be an object")
        missing = [k for k in ("original", "issue", "replacement") if k not in finding]
        if missing:
            raise ReplyError(f"finding is missing {', '.join(missing)}")
        original = finding["original"]
        if original not in sentences:
            raise ReplyError(
                f"finding 'original' is not one of the passage's sentences, "
                f"copied exactly: {original!r}"
            )
        if original in by_sentence:
            raise ReplyError(f"two findings target the same sentence: {original!r}")
        replacement = finding["replacement"]
        if not isinstance(replacement, str) or not replacement.strip():
            raise ReplyError(f"finding {original!r} has an empty replacement")
        if "\n" in replacement:
            raise ReplyError(f"finding {original!r} replacement spans lines")
        if "[" in replacement or "]" in replacement:
            raise ReplyError(
                f"finding {original!r} replacement contains furigana brackets; "
                "the build adds readings with a tokenizer"
            )
        if not replacement.strip().endswith("。"):
            raise ReplyError(f"finding {original!r} replacement does not end in 。")
        if replacement.strip() == original.strip():
            raise ReplyError(
                f"finding {original!r} replacement is identical to the original"
            )
        issue = finding["issue"]
        if not isinstance(issue, str) or not issue.strip():
            raise ReplyError(f"finding {original!r} has an empty issue")
        by_sentence[original] = finding

    if findings and not obj.get("english_translation", "").strip():
        raise ReplyError(
            "findings were reported but 'english_translation' is missing — a "
            "rewritten sentence makes the shipped translation wrong"
        )
    if not findings and "english_translation" in obj:
        raise ReplyError(
            "'english_translation' was supplied with no findings; omit it when "
            "the passage needs no correction"
        )
    return findings


def apply_findings(draft, findings, reply):
    """The corrected draft. Pure — the caller decides whether it survives the
    gate before anything is written to disk."""
    corrected = json.loads(json.dumps(draft))
    body = corrected["body"].strip()
    for finding in findings:
        body = body.replace(finding["original"], finding["replacement"].strip(), 1)
    corrected["body"] = body
    for key in ("english_translation", "summary_ja", "summary_en", "questions"):
        if reply.get(key):
            corrected[key] = reply[key]
    return corrected


# --- draft records -----------------------------------------------------------

def _draft_path(level, slug):
    return os.path.join(DRAFTS_DIR, level, f"{slug}.json")


def load_draft(level, slug):
    path = _draft_path(level, slug)
    if not os.path.exists(path):
        raise SystemExit(f"no draft at {path}")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_draft(record):
    path = _draft_path(record["level"], record["slug"])
    with open(path, "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=2)
        f.write("\n")


def reviewable_slugs(level, slugs, recheck):
    """Gate-passing drafts only. A passage that cannot pass the mechanical gate
    is not ready for an opinion about its Japanese — fix the mechanics first."""
    out = []
    for slug in slugs:
        path = _draft_path(level, slug)
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as f:
            record = json.load(f)
        if record.get("status") != "draft" or not record.get("tool_input"):
            continue
        reviewed = record.get("naturalness") or {}
        if not recheck and reviewed.get("review_version") == REVIEW_VERSION:
            continue
        out.append(slug)
    return out


# --- commands ----------------------------------------------------------------

def cmd_webprompts(args):
    slugs = reviewable_slugs(args.level, args.slugs, args.recheck)
    if not slugs:
        raise SystemExit(
            f"nothing to review for {args.level} — no gate-passing draft is "
            f"unreviewed at review_version {REVIEW_VERSION} (--recheck forces)"
        )
    out_dir = os.path.join(WEB_DIR, args.level)
    os.makedirs(out_dir, exist_ok=True)
    for slug in slugs:
        record = load_draft(args.level, slug)
        ctx = rc.seed_context(args.level, slug)
        path = os.path.join(out_dir, f"{slug}.prompt.md")
        with open(path, "w", encoding="utf-8") as f:
            f.write(build_prompt(args.level, slug, ctx, record["tool_input"]))
        print(f"wrote {path}")
    print(f"{len(slugs)} passage(s) to review")


def cmd_ingest(args):
    if not args.slug:
        raise SystemExit("ingest requires --slug")
    level, slug = args.level, args.slug
    out_dir = os.path.join(WEB_DIR, level)
    reply_path = args.from_path or os.path.join(out_dir, f"{slug}.reply.md")
    if not os.path.exists(reply_path):
        raise SystemExit(f"no reply at {reply_path} — write the review there first")

    record = load_draft(level, slug)
    if record.get("status") != "draft":
        raise SystemExit(
            f"{slug}: draft status is {record.get('status')!r}; only a "
            "gate-passing draft can be reviewed"
        )
    draft = record["tool_input"]
    ctx = rc.seed_context(level, slug)
    sentences = split_sentences(draft["body"].strip())

    with open(reply_path, encoding="utf-8") as f:
        reply = extract_json_block(f.read())
    findings = validate_reply(reply, sentences)

    prompt_path = os.path.join(out_dir, f"{slug}.prompt.md")
    review = {
        "review_version": REVIEW_VERSION,
        "reviewer_model": args.model,
        "findings": [
            {k: f[k] for k in ("original", "issue", "replacement")} for f in findings
        ],
    }

    if not findings:
        review["verdict"] = "natural"
        record["naturalness"] = review
        save_draft(record)
        _remove(reply_path, prompt_path)
        print(f"{slug}: natural — no sentence flagged, body unchanged")
        return

    corrected = apply_findings(draft, findings, reply)
    errors = validate_draft(level, slug, corrected, ctx)
    if errors:
        # The correction is discarded whole. Merging the part that passed would
        # leave a body nobody wrote and nobody reviewed.
        review["verdict"] = "rejected"
        review["gate_errors"] = errors
        record["naturalness"] = review
        save_draft(record)
        os.makedirs(out_dir, exist_ok=True)
        with open(prompt_path, "w", encoding="utf-8") as f:
            f.write(build_prompt(level, slug, ctx, draft, gate_errors=errors))
        # Delete the rejected reply. Leaving it is how a repair round silently
        # re-ingests the reply that was just rejected: the caller waits for the
        # reply file to appear, and it never went away. The prompt now carries
        # the gate errors, so the next reviewer has everything it needs.
        _remove(reply_path)
        print(f"{slug}: {len(findings)} finding(s), but the corrected passage "
              f"FAILS the gate — draft body left unchanged:")
        for e in errors:
            print(f"  - {e}")
        raise SystemExit(1)

    review["verdict"] = "corrected"
    review["original_body"] = draft["body"]
    record["tool_input"] = corrected
    record["naturalness"] = review
    save_draft(record)

    from generate_content.generate_readings import write_dataset
    write_dataset(level)
    _remove(reply_path, prompt_path)
    print(f"{slug}: {len(findings)} sentence(s) corrected and re-gated:")
    for finding in findings:
        print(f"  - {finding['issue']}")
        print(f"      {finding['original']}")
        print(f"   -> {finding['replacement']}")


def _remove(*paths):
    for path in paths:
        if path and os.path.exists(path):
            os.remove(path)


# --- selftest ----------------------------------------------------------------

SELFTEST_SENTENCES = [
    "私の部屋の角で、箱が先月から待っています。",
    "「もう帰ります。」と言いました。",
    "今日はとても暑いです。",
]

SELFTEST_CASES = [
    ("clean reply, no findings",
     {"sentences_checked": 3, "findings": []}, None),
    ("one applicable finding",
     {"sentences_checked": 3,
      "findings": [{"original": SELFTEST_SENTENCES[0],
                    "issue": "A box cannot wait.",
                    "replacement": "箱は先月から部屋の角にあります。"}],
      "english_translation": "A box has been in the corner since last month."},
     None),
    ("sentence count short of the passage",
     {"sentences_checked": 2, "findings": []},
     "every sentence must be judged"),
    ("original retyped rather than copied",
     {"sentences_checked": 3,
      "findings": [{"original": "箱が先月から待っています。",
                    "issue": "A box cannot wait.",
                    "replacement": "箱は角にあります。"}],
      "english_translation": "x"},
     "not one of the passage's sentences"),
    ("findings without a new translation",
     {"sentences_checked": 3,
      "findings": [{"original": SELFTEST_SENTENCES[2],
                    "issue": "Wrong tense.",
                    "replacement": "今日はとても暑かったです。"}]},
     "english_translation' is missing"),
    ("replacement carries furigana brackets",
     {"sentences_checked": 3,
      "findings": [{"original": SELFTEST_SENTENCES[2],
                    "issue": "Wrong tense.",
                    "replacement": "今日[きょう]は暑かったです。"}],
      "english_translation": "x"},
     "furigana brackets"),
    ("replacement does not end a sentence",
     {"sentences_checked": 3,
      "findings": [{"original": SELFTEST_SENTENCES[2],
                    "issue": "Wrong tense.",
                    "replacement": "今日はとても暑かったです"}],
      "english_translation": "x"},
     "does not end in 。"),
    ("two findings on one sentence",
     {"sentences_checked": 3,
      "findings": [{"original": SELFTEST_SENTENCES[2], "issue": "a",
                    "replacement": "今日は暑かったです。"},
                   {"original": SELFTEST_SENTENCES[2], "issue": "b",
                    "replacement": "今日は寒かったです。"}],
      "english_translation": "x"},
     "target the same sentence"),
    ("a key the contract does not define",
     {"sentences_checked": 3, "findings": [], "confidence": "high"},
     "unknown key(s) in reply: confidence"),
]


def run_selftest():
    """The contract rules, each against the reply that breaks it. Cheap enough
    to run on every change, and it needs no model call."""
    failures = 0
    print("--- reply contract ---")
    for label, reply, expected in SELFTEST_CASES:
        try:
            validate_reply(reply, SELFTEST_SENTENCES)
            actual = None
        except ReplyError as exc:
            actual = str(exc)
        ok = (expected is None and actual is None) or (
            expected is not None and actual is not None and expected in actual
        )
        failures += not ok
        print(f"{'ok  ' if ok else 'FAIL'} {label}"
              + ("" if ok else f"\n       expected {expected!r}, got {actual!r}"))

    print("\n--- sentence splitting ---")
    split_cases = [
        ("私は学生です。毎日学校へ行きます。",
         ["私は学生です。", "毎日学校へ行きます。"]),
        ("「もう帰ります。」と言いました。ドアを閉めました。",
         ["「もう帰ります。」と言いました。", "ドアを閉めました。"]),
        ("一つだけです。", ["一つだけです。"]),
    ]
    for body, expected in split_cases:
        actual = split_sentences(body)
        ok = actual == expected
        failures += not ok
        print(f"{'ok  ' if ok else 'FAIL'} {body}"
              + ("" if ok else f"\n       expected {expected}, got {actual}"))

    print("\n--- applying a finding ---")
    draft = {
        "body": "".join(SELFTEST_SENTENCES),
        "english_translation": "old",
        "summary_ja": "s", "summary_en": "s", "title": "t", "questions": [],
    }
    reply = {
        "sentences_checked": 3,
        "findings": [{"original": SELFTEST_SENTENCES[0], "issue": "i",
                      "replacement": "箱は先月から部屋の角にあります。"}],
        "english_translation": "new",
    }
    corrected = apply_findings(draft, reply["findings"], reply)
    checks = [
        ("flagged sentence replaced",
         corrected["body"].startswith("箱は先月から部屋の角にあります。")),
        ("unflagged sentences untouched",
         corrected["body"].endswith(SELFTEST_SENTENCES[1] + SELFTEST_SENTENCES[2])),
        ("translation replaced", corrected["english_translation"] == "new"),
        ("original draft not mutated", draft["english_translation"] == "old"),
    ]
    for label, ok in checks:
        failures += not ok
        print(f"{'ok  ' if ok else 'FAIL'} {label}")

    total = len(SELFTEST_CASES) + len(split_cases) + len(checks)
    print(f"\n{total - failures}/{total} checks hold")
    return 1 if failures else 0


# --- entry point -------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", nargs="?", choices=["webprompts", "ingest"])
    parser.add_argument("--level", default="n5")
    parser.add_argument("--slugs", default=None,
                        help="comma-separated seed slugs (default: every seed)")
    parser.add_argument("--slug", default=None, help="ingest only: single seed slug")
    parser.add_argument("--from", dest="from_path", default=None,
                        help="ingest only: path to the review reply")
    parser.add_argument("--model", default="subagent",
                        help="ingest only: reviewer provenance, recorded on the draft")
    parser.add_argument("--recheck", action="store_true",
                        help="webprompts only: re-review drafts already reviewed "
                             f"at review_version {REVIEW_VERSION}")
    parser.add_argument("--selftest", action="store_true",
                        help="check the reply contract against known-bad replies")
    args = parser.parse_args()

    if args.selftest:
        raise SystemExit(run_selftest())
    if not args.command:
        parser.error("a command is required unless --selftest is given")
    if args.slugs:
        args.slugs = [s for s in args.slugs.split(",") if s]
    elif args.slug:
        args.slugs = [args.slug]
    else:
        args.slugs = reading_seeds.all_slugs(args.level)

    {"webprompts": cmd_webprompts, "ingest": cmd_ingest}[args.command](args)


if __name__ == "__main__":
    main()
