# -*- coding: utf-8 -*-
"""Mechanical validation gate for generated radical/kanji/vocab prose (2b + 2d).

Run on every batch output before any human sees it
(docs/content/content-pipeline-plan.md, "Mechanical validation gate", adapted
for 2b/2d under Rev 1 `prompt_version: 2`):

  radical (no mnemonic — a `description` that is also the Tier 2 image prompt):
    1. description present, non-empty, story-paragraph length, plain prose
    2. the radical's meaning is recognisable in the image
    3. look-alikes: every reviewed confusable is named, and no unreviewed
       character is presented as one
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
    5. the same look-alike checks as radicals, on the description
  vocabulary (2d):
    1. all three fields present, plain prose, within length bounds
    2. meaning_mnemonic references every taught component kanji's meaning, so
       the radical -> kanji -> vocabulary chain is literal
    3. reading_mnemonic contains the word's reading, and its *shape* matches the
       mechanically computed reading regularity: a regular or kana-only reading
       gets a one-line derivation note (bounded short), an irregular one gets a
       full story (bounded long)
    4. the description names no kanji beyond the word and its components

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

#: Length guards, per content type. Rev 1 (`prompt_version: 2`) raises these to
#: a WaniKani-style story-paragraph range: the v1 floors produced 2–4 sentence
#: mnemonics, which is the depth gap the revision exists to close. The ceilings
#: still matter — a learner rereads these dozens of times.
LEN_BOUNDS = {
    "radical": {"description": (150, 900)},
    "kanji": {
        "meaning_mnemonic": (200, 1100),
        "reading_mnemonic": (150, 900),
        "description": (120, 900),
    },
    "vocab": {
        "meaning_mnemonic": (150, 1000),
        "reading_mnemonic": (30, 900),
        "description": (60, 500),
    },
}

#: A vocab reading the learner can already derive from its kanji gets a one-line
#: note, not a story (docs 2d: "don't pad regular readings into stories"). The
#: regularity is computed mechanically in mnemonic_context, so which bound
#: applies is not the model's choice.
DERIVATION_NOTE_BOUNDS = (30, 320)
READING_STORY_BOUNDS = (150, 900)
_DERIVATION_KINDS = ("regular", "kana_only")

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


def _length_errors(field, text, bounds):
    lo, hi = bounds
    n = len(text.strip())
    if n < lo:
        return [f"{field} is too short ({n} chars; need >= {lo})"]
    if n > hi:
        return [f"{field} is too long ({n} chars; keep <= {hi})"]
    return []


def _field_errors(kind, field, text):
    return _markup_errors(field, text) + _length_errors(
        field, text, LEN_BOUNDS[kind][field])


def _look_alike_errors(field, text, ctx, own_form, extra_allowed_forms=()):
    """Rev 1 confusable checks: the reviewed look-alikes (and only those) are
    what a description may present as easily-mixed-up characters.

    Two directions, both mechanical:
      * every look-alike in the reviewed pair dataset is actually named
      * no *other* kanji/radical character appears in the prose — the model must
        not invent a confusable, and descriptions carry no furigana, so stray
        Japanese in them would render unreadable anyway.
    """
    errors = []
    allowed = {own_form} | set(extra_allowed_forms)
    for entry in ctx["look_alikes"]:
        allowed.add(entry["form"])
        if entry["form"] not in text:
            errors.append(
                f"{field} never mentions the look-alike {entry['form']} "
                f"(“{entry['meaning']}”); spell out how to tell them apart"
            )
    for ch in dict.fromkeys(mnemonic_context._CJK_RE.findall(text)):
        if ch not in allowed:
            errors.append(
                f"{field} names the character {ch}, which is not a reviewed "
                "look-alike for this item; never invent confusables, and keep "
                "other Japanese out of the description"
            )
    return errors


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
        errors += _field_errors("kanji", field, draft[field])

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

    # 5. look-alikes (Rev 1): named exactly, invented never
    errors += _look_alike_errors(
        "description", draft["description"], ctx, ctx["char"],
        extra_allowed_forms=[c["form"] for c in ctx["components"]])

    return errors


def validate_radical(level, slug, draft, ctx=None):
    ctx = ctx or mnemonic_context.radical_context(level, slug)
    errors = []

    text = draft.get("description")
    if not isinstance(text, str) or not text.strip():
        return ["missing or empty field description"]

    errors += _field_errors("radical", "description", text)

    words = _meaning_words(ctx["meaning_synonyms"])
    if words and not _references(text, words):
        errors.append(
            f"description never lands on the meaning “{ctx['meaning']}”; the image "
            "must resolve to that meaning"
        )
    errors += _look_alike_errors("description", text, ctx, ctx["form"])
    return errors


def validate_vocab(level, slug, draft, ctx=None):
    ctx = ctx or mnemonic_context.vocab_context(level, slug)
    errors = []

    for field in ("meaning_mnemonic", "reading_mnemonic", "description"):
        value = draft.get(field)
        if not isinstance(value, str) or not value.strip():
            errors.append(f"missing or empty field {field}")
    if errors:
        return errors

    errors += _markup_errors("meaning_mnemonic", draft["meaning_mnemonic"])
    errors += _markup_errors("reading_mnemonic", draft["reading_mnemonic"])
    errors += _field_errors("vocab", "meaning_mnemonic", draft["meaning_mnemonic"])
    errors += _field_errors("vocab", "description", draft["description"])

    # 2. the kanji -> vocabulary chain is literal, not name-dropped
    for comp in ctx["components"]:
        words = _meaning_words(comp["meaning_synonyms"])
        if words and not _references(draft["meaning_mnemonic"], words):
            errors.append(
                f"meaning_mnemonic never references the component kanji {comp['char']} "
                f"(“{comp['meaning']}”); the story must connect its kanji to the word"
            )

    # 3. reading present, and shaped by the mechanically computed regularity
    reading = ctx["reading"]
    reading_text = draft["reading_mnemonic"]
    if reading and _hira(reading) not in _hira(reading_text):
        errors.append(
            f"reading_mnemonic must contain the reading 「{reading}」 verbatim"
        )
    kind = ctx["regularity"]["kind"]
    if kind in _DERIVATION_KINDS:
        errors += _length_errors(
            "reading_mnemonic (a derivation note — this reading is "
            f"{'kana-only' if kind == 'kana_only' else 'regular'}, so do not "
            "write a story)", reading_text, DERIVATION_NOTE_BOUNDS)
    else:
        errors += _length_errors(
            "reading_mnemonic (a full story — this reading is not derivable "
            "from the taught readings)", reading_text, READING_STORY_BOUNDS)

    # 4. no stray kanji in the description (it carries no furigana)
    allowed = set(ctx["form"]) | {c["char"] for c in ctx["components"]}
    for ch in dict.fromkeys(mnemonic_context._CJK_RE.findall(draft["description"])):
        if ch not in allowed:
            errors.append(
                f"description names the kanji {ch}, which is neither in this word "
                "nor one of its taught components; descriptions carry no furigana"
            )

    return errors


def validate_draft(level, kind, slug, draft, ctx=None):
    if kind == "kanji":
        return validate_kanji(level, slug, draft, ctx)
    if kind == "radical":
        return validate_radical(level, slug, draft, ctx)
    if kind == "vocab":
        return validate_vocab(level, slug, draft, ctx)
    raise ValueError(f"unknown mnemonic type {kind!r}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--level", default="n5")
    parser.add_argument("--type", dest="kind", choices=["kanji", "radical", "vocab"],
                        required=True)
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
