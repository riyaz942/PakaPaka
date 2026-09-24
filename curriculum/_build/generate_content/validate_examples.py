# -*- coding: utf-8 -*-
"""Mechanical validation gate for generated example sentences (Phase 2c).

Run on every batch output before any human sees it
(docs/content/content-pipeline-plan.md, "Mechanical validation gate", adapted for 2c):

  1. structural: 2-4 sentences, each with non-empty japanese + english, single
     line, plain prose (no markdown/furigana brackets), length bounds
  2. target presence — every sentence actually uses the item: a vocab item's
     dictionary form must appear (verbatim or as a token's lemma, so natural
     conjugations pass)
  3. every referenced vocabulary_slugs is in the item's allowed set
  4. tokenizer level-check: no out-of-level content words
  5. furigana annotation succeeds — annotate_sentence returning None is a
     REJECTION for generated content, not silent no-furigana

`validate-schema` after assembly is the pipeline's final backstop; this gate
catches everything that can be checked per-draft.

Standalone usage (re-check collected drafts):
    .venv/bin/python -m generate_content.validate_examples --level n5 --type vocab
"""

import argparse
import json
import os
import re
import sys

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BUILD_DIR)

import furigana as furigana_lib  # noqa: E402
from generate_content import example_context, level_check  # noqa: E402
from generate_content.validate_drafts import _known_readings  # noqa: E402

DRAFTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "drafts", "examples")

#: Example sentences are displayed on the item detail card; keep them short
#: enough to read at a glance but long enough to be a real sentence.
JAPANESE_LEN_BOUNDS = (4, 55)
ENGLISH_LEN_BOUNDS = (4, 160)
SENTENCE_COUNT_BOUNDS = (2, 4)

#: Markup we never want stored raw in a sentence string.
_MARKUP_RE = re.compile(r"[*_`#|<>]|\]\(|[ぁ-ヿ㐀-䶿一-鿿々〆ー]\[")


def _sentence_structural_errors(i, sentence):
    errors = []
    if not isinstance(sentence, dict):
        return [f"example_sentences[{i}] is not an object"]
    jp = sentence.get("japanese")
    en = sentence.get("english")
    if not isinstance(jp, str) or not jp.strip():
        errors.append(f"example_sentences[{i}].japanese is missing or empty")
    if not isinstance(en, str) or not en.strip():
        errors.append(f"example_sentences[{i}].english is missing or empty")
    if errors:
        return errors
    if "\n" in jp.strip():
        errors.append(f"example_sentences[{i}].japanese must be a single line")
    for label, text, (lo, hi) in (
        ("japanese", jp, JAPANESE_LEN_BOUNDS),
        ("english", en, ENGLISH_LEN_BOUNDS),
    ):
        n = len(text.strip())
        if n < lo:
            errors.append(f"example_sentences[{i}].{label} is too short ({n} chars; need >= {lo})")
        if n > hi:
            errors.append(f"example_sentences[{i}].{label} is too long ({n} chars; keep <= {hi})")
    if _MARKUP_RE.search(jp) or _MARKUP_RE.search(en):
        errors.append(
            f"example_sentences[{i}] contains markup (markdown/HTML/furigana brackets); "
            "sentences must be plain prose — the pipeline adds furigana itself"
        )
    return errors


def _contains_target(text, ctx):
    """Whether the sentence actually uses the item being exemplified."""
    if any(form in text for form in ctx["target_forms"]):
        return True
    # Conjugated usage: any token whose dictionary form is the target passes
    # (食べました exemplifies 食べる).
    tagger = furigana_lib.get_tagger()
    targets = set(ctx["target_forms"])
    for token in tagger(text):
        candidates = {token.surface}
        for feat in ("orthBase", "lemma", "pronBase", "lForm"):
            value = getattr(token.feature, feat, None)
            if value and value != "*":
                candidates.add(value)
                candidates.add(furigana_lib.katakana_to_hiragana(value))
        if candidates & targets:
            return True
    return False


def validate_draft(level, kind, slug, draft, ctx=None):
    """List of error strings; empty means the draft passes the gate."""
    ctx = ctx or example_context.item_context(level, kind, slug)

    sentences = draft.get("example_sentences")
    if not isinstance(sentences, list) or not sentences:
        return ["missing or empty field example_sentences"]

    errors = []
    lo, hi = SENTENCE_COUNT_BOUNDS
    if not lo <= len(sentences) <= hi:
        errors.append(f"expected {lo}-{hi} example sentences, got {len(sentences)}")

    known_readings = _known_readings(level)
    target_label = ctx["form"]

    for i, sentence in enumerate(sentences):
        structural = _sentence_structural_errors(i, sentence)
        errors += structural
        if structural:
            continue
        jp = sentence["japanese"].strip()

        # 2. target presence
        if not _contains_target(jp, ctx):
            errors.append(
                f"example_sentences[{i}] never uses the target 「{target_label}」"
            )

        # 3. slug references
        unknown = [s for s in sentence.get("vocabulary_slugs", [])
                   if s not in ctx["allowed_slugs"]]
        if unknown:
            errors.append(
                f"example_sentences[{i}] references vocab outside the allowed list: {unknown}"
            )

        # 4. level-check
        violations = level_check.find_violations(jp, ctx["allowed_index"], ctx["extra_allowed"])
        if violations:
            errors.append(
                f"example_sentences[{i}] ({jp}): out-of-level words: {', '.join(violations)}"
            )

        # 5. furigana must annotate cleanly — a rejection, not a pass-through
        if any(furigana_lib.is_kanji(ch) for ch in jp):
            if furigana_lib.annotate_sentence(jp, known_readings) is None:
                errors.append(
                    f"example_sentences[{i}] ({jp}): furigana annotation failed "
                    "(tokenizer round-trip)"
                )

    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--level", default="n5")
    parser.add_argument("--type", dest="kind", choices=["vocab"], required=True)
    args = parser.parse_args()

    level_dir = os.path.join(DRAFTS_DIR, args.level, args.kind)
    if not os.path.isdir(level_dir):
        raise SystemExit(f"no drafts at {level_dir}")
    failed = 0
    for name in sorted(os.listdir(level_dir)):
        if not name.endswith(".json") or name == "requests-preview.json":
            continue
        with open(os.path.join(level_dir, name), encoding="utf-8") as f:
            record = json.load(f)
        if not isinstance(record, dict) or not record.get("tool_input"):
            continue
        errors = validate_draft(args.level, args.kind, record["slug"], record["tool_input"])
        print(f"{'PASS' if not errors else 'FAIL'} {record['slug']}")
        for e in errors:
            print(f"  - {e}")
        failed += bool(errors)
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    main()
