# -*- coding: utf-8 -*-
"""Mechanical validation gate for generated kanji/radical mnemonics (Phase 2b).

Run on every batch output before any human sees it
(docs/content-pipeline-plan.md, "Mechanical validation gate", adapted for 2b):

  kanji:
    1. all three fields present and non-empty (meaning/reading mnemonic +
       description), within length bounds
    2. reading_mnemonic literally contains the target reading kana
       (kana-normalised, so コウ satisfies こう)
    3. meaning_mnemonic references the taught decomposition — every taught
       component's meaning is recognisable in the story (or, when the kanji has
       no taught decomposition, the check is skipped: it is a whole-character
       pictograph)
    4. plain prose only — no markdown/HTML the storage layer would ship raw
  radical:
    1. mnemonic_text present, non-empty, within length bounds, plain prose
    2. the radical's meaning is recognisable in the image

This gate is a floor: the cast-coherence pass and "does it actually help you
remember" judgement are human review (Phase 5). `validate-schema` after assembly
is the pipeline's final backstop.

Standalone usage (re-check collected drafts):
    .venv/bin/python -m generate_content.validate_mnemonics --level n5 --type kanji
"""

import argparse
import json
import os
import re
import sys

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BUILD_DIR)

import furigana as furigana_lib  # noqa: E402
from generate_content import mnemonic_context  # noqa: E402

DRAFTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "drafts", "mnemonics")

#: Length guards — mnemonics are reread dozens of times, so keep them tight, but
#: long enough to actually tell a story.
LEN_BOUNDS = {
    "meaning_mnemonic": (20, 700),
    "reading_mnemonic": (12, 600),
    "description": (10, 320),
    "mnemonic_text": (12, 500),
}

#: Structural markdown/markup we never want stored raw in a mnemonic string.
_MARKUP_CHECKS = [
    (re.compile(r"(^|\n)\s{0,3}#{1,6}\s"), "a markdown heading"),
    (re.compile(r"(^|\n)\s{0,3}[-*]\s"), "a markdown list item"),
    (re.compile(r"\*\*"), "bold (**) markers"),
    (re.compile(r"(^|[^\w])_[^_]+_([^\w]|$)"), "underscore emphasis"),
    (re.compile(r"\]\("), "a markdown link"),
    (re.compile(r"</?[a-zA-Z][^>]*>"), "an HTML tag"),
    (re.compile(r"`"), "a backtick"),
    (re.compile(r"\|"), "a table pipe"),
    (re.compile(r"[ぁ-ヿ㐀-䶿一-鿿々〆ー]\["), "furigana brackets"),
]

_WORD_SPLIT_RE = re.compile(r"[a-z]+")


def _hira(text):
    return furigana_lib.katakana_to_hiragana(text)


def _markup_errors(field, text):
    errors = []
    for pattern, label in _MARKUP_CHECKS:
        if pattern.search(text):
            errors.append(f"{field} contains {label}; mnemonics must be plain prose")
    return errors


def _length_errors(field, text):
    lo, hi = LEN_BOUNDS[field]
    n = len(text.strip())
    if n < lo:
        return [f"{field} is too short ({n} chars; need >= {lo})"]
    if n > hi:
        return [f"{field} is too long ({n} chars; keep <= {hi})"]
    return []


def _meaning_words(synonyms):
    """Lowercase content words drawn from a component/kanji's meaning synonyms,
    with parenthetical position qualifiers (e.g. "(left)") dropped. A component
    counts as referenced if ANY of these words appears in the story."""
    words = set()
    for syn in synonyms:
        syn = re.sub(r"\([^)]*\)", " ", syn).lower()
        for w in _WORD_SPLIT_RE.findall(syn):
            if len(w) >= 2:
                words.add(w)
    return words


def _references(text, words):
    lowered = text.lower()
    return any(re.search(rf"\b{re.escape(w)}", lowered) for w in words)


def validate_kanji(level, slug, draft, ctx=None):
    ctx = ctx or mnemonic_context.kanji_context(level, slug)
    errors = []

    for field in ("meaning_mnemonic", "reading_mnemonic", "description"):
        value = draft.get(field)
        if not isinstance(value, str) or not value.strip():
            errors.append(f"missing or empty field {field}")
    if errors:
        return errors

    for field in ("meaning_mnemonic", "reading_mnemonic", "description"):
        text = draft[field]
        errors += _markup_errors(field, text)
        errors += _length_errors(field, text)

    # 2. reading present
    primary = ctx["primary_reading"]
    if primary:
        if _hira(primary) not in _hira(draft["reading_mnemonic"]):
            errors.append(
                f"reading_mnemonic must contain the target reading 「{primary}」 verbatim"
            )

    # 3. decomposition referenced
    meaning_text = draft["meaning_mnemonic"]
    for comp in ctx["components"]:
        words = _meaning_words(comp["meaning_synonyms"])
        if words and not _references(meaning_text, words):
            errors.append(
                f"meaning_mnemonic never references the taught component {comp['form']} "
                f"(“{comp['meaning']}”); the story must be built from the taught decomposition"
            )

    return errors


def validate_radical(level, slug, draft, ctx=None):
    ctx = ctx or mnemonic_context.radical_context(level, slug)
    errors = []

    text = draft.get("mnemonic_text")
    if not isinstance(text, str) or not text.strip():
        return ["missing or empty field mnemonic_text"]

    errors += _markup_errors("mnemonic_text", text)
    errors += _length_errors("mnemonic_text", text)

    words = _meaning_words(ctx["meaning_synonyms"])
    if words and not _references(text, words):
        errors.append(
            f"mnemonic_text never lands on the meaning “{ctx['meaning']}”; the image "
            "must resolve to that meaning"
        )
    return errors


def validate_draft(level, kind, slug, draft, ctx=None):
    if kind == "kanji":
        return validate_kanji(level, slug, draft, ctx)
    if kind == "radical":
        return validate_radical(level, slug, draft, ctx)
    raise ValueError(f"unknown mnemonic type {kind!r}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--level", default="n5")
    parser.add_argument("--type", dest="kind", choices=["kanji", "radical"], required=True)
    args = parser.parse_args()

    level_dir = os.path.join(DRAFTS_DIR, args.level, args.kind)
    if not os.path.isdir(level_dir):
        raise SystemExit(f"no drafts at {level_dir}")
    failed = 0
    for name in sorted(os.listdir(level_dir)):
        if not name.endswith(".json"):
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
