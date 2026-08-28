# -*- coding: utf-8 -*-
"""Mechanical validation gate for generated radical/kanji/vocab prose (2b + 2d).

Run on every batch output before any human sees it
(docs/content/content-pipeline-plan.md, "Mechanical validation gate", adapted
for 2b/2d):

  radical (two texts for one scene: the learner-facing `mnemonic_text`, and
  `image_prompt`, the stroke-walked version the Tier 2 art is drawn from):
    1. mnemonic_text present, non-empty, within length bounds, plain prose
    2. the radical's meaning is recognisable in the image *and wrapped in a
       <radical> tag*, so the word a kanji story will later borrow is the same
       word the learner saw highlighted here
    3. `description` is optional (Rev 3, matching kanji/vocab) and is required
       only when the item has reviewed look-alikes to contrast; when present it
       names every one of them and invents none
    4. image_prompt (Rev 5) is required on freshly generated drafts only —
       stored drafts predate the field, and the backfill copies their
       mnemonic_text in verbatim. It gets the markup/length/tag checks but
       never the readability gate: clause-stacked specification is what an
       illustrator's prompt wants.
  kanji:
    1. both mnemonics present and non-empty, within length bounds (measured on
       the tag-stripped prose); `description` is optional and is required only
       when the item has reviewed look-alikes to contrast
    2. reading_mnemonic literally contains the target reading kana
       (kana-normalised, so コウ satisfies こう) inside a <reading> tag
    3. meaning_mnemonic references the taught decomposition — every taught
       component's meaning is recognisable in the story *and wrapped in a
       <radical> tag* (or, when the kanji has no taught decomposition, the check
       is skipped: it is a whole-character pictograph)
    4. plain prose only — no markdown/HTML beyond the one highlight tag each
       field allows, and none at all in a description
    5. the same look-alike checks as radicals, on the description
  vocabulary (2d):
    1. both mnemonics present, plain prose, within length bounds; `description`
       optional as above
    2. meaning_mnemonic references every taught component kanji's meaning inside
       a <kanji> tag, so the radical -> kanji -> vocabulary chain is literal and
       visible
    3. reading_mnemonic contains the word's reading in a <reading> tag, and its
       *shape* matches the mechanically computed reading regularity: a regular
       or kana-only reading gets a one-line derivation note (bounded short), an
       irregular one gets a full story (bounded long)
    4. the description names no kanji beyond the word and its components

Rev 4 adds a sentence-shape (readability) gate, enforced only when the caller
passes enforce_readability=True — i.e. on freshly generated drafts. Stored
drafts are re-validated without it, so no kept item is ever requeued for a
readability rewrite. Rev 5's radical image_prompt requirement rides the same
flag for the same reason.

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

#: Length guards, per content type, measured on the **tag-stripped** text so the
#: highlight markup never counts toward the budget.
#:
#: Rev 3 calibrates these against the prose the maintainer actually kept, rather
#: than against a target picked in the abstract. The reviewed N5 set lands at:
#:
#:   radical mnemonic_text    144–299 chars (median 214)
#:   kanji   meaning_mnemonic 144–366        (median 256)
#:   kanji   reading_mnemonic 133–272        (median 204)
#:   kanji   description       59–165        (median 104)
#:
#: The prompts aim at the middle of each range; these bounds sit just outside it
#: so an item that genuinely needs more room still passes. Rev 2's floors (300 /
#: 250) were set from the since-discarded long radical descriptions and would
#: have rejected most of the kept content — a band is only worth anything if the
#: prose you like fits inside it.
#: Rev 5 splits the radical contract: mnemonic_text is now the short
#: learner-facing summary (prompt target ~100–180 chars, so its floor drops to
#: 80 — a lower floor can only pass more stored drafts, never fail one), and
#: image_prompt keeps the old stroke-walked size band.
LEN_BOUNDS = {
    "radical": {
        "mnemonic_text": (80, 400),
        "image_prompt": (120, 500),
        "description": (60, 400),
    },
    "kanji": {
        "meaning_mnemonic": (140, 450),
        "reading_mnemonic": (120, 380),
        "description": (50, 400),
    },
    # vocab reading_mnemonic is bounded by the regularity branch below, not here.
    "vocab": {
        "meaning_mnemonic": (140, 450),
        "description": (50, 350),
    },
}

#: A vocab reading the learner can already derive from its kanji gets a one-line
#: note, not a story (docs 2d: "don't pad regular readings into stories"). The
#: regularity is computed mechanically in mnemonic_context, so which bound
#: applies is not the model's choice. The note's ceiling stays well under the
#: story's floor, so "one line" and "a story" cannot blur into each other.
DERIVATION_NOTE_BOUNDS = (30, 220)
READING_STORY_BOUNDS = (120, 380)
_DERIVATION_KINDS = ("regular", "kana_only")

#: Highlight markup (Rev 2). A mnemonic wraps the pieces the learner is meant to
#: connect — the taught components it borrows, and the sound the reading hangs
#: on — so the app can render them in the content accent colours instead of
#: burying them in a wall of prose. Exactly one tag is legal per field, which is
#: what makes "did it actually tag the components" mechanically checkable.
#:
#:   radical mnemonic_text    <radical>mouth</radical>
#:   radical image_prompt     <radical>mouth</radical>  (same word; the image
#:                             pipeline strips the tag before drawing)
#:   kanji  meaning_mnemonic  <radical>ground</radical>
#:   kanji  reading_mnemonic  <reading>いち</reading>
#:   vocab  meaning_mnemonic  <kanji>one</kanji>
#:   vocab  reading_mnemonic  <reading>ひとつ</reading>
#:
#: A radical borrows nothing from below, so the piece it highlights is its own
#: meaning — the word the story lands on, and the exact word a kanji story will
#: later reuse. Tagging it makes the two ends of the chain match visually.
#:
#: Descriptions carry no markup at all: they are reference prose, not a story
#: the learner has to reassemble.
ALLOWED_TAG = {
    ("radical", "mnemonic_text"): "radical",
    ("radical", "image_prompt"): "radical",
    ("kanji", "meaning_mnemonic"): "radical",
    ("kanji", "reading_mnemonic"): "reading",
    ("vocab", "meaning_mnemonic"): "kanji",
    ("vocab", "reading_mnemonic"): "reading",
}

_ANY_TAG_RE = re.compile(r"</?[^<>]*>")

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

#: Sentence-shape guards (Rev 4), measured on the tag-stripped prose; Japanese
#: characters never count as words. The reviewed N5 set averages 21–26 words
#: per sentence with a worst single sentence of 56, and the readability problem
#: lives in that clause-stacking, not in the vocabulary (its long-word rate is
#: lower than WaniKani's). The prompts now ask for most sentences under ~18
#: words and none over 25; these bounds sit just outside that, the same way
#: LEN_BOUNDS sits outside the prompts' character targets. The mean check only
#: applies once a field has enough sentences for a mean to mean anything.
READABILITY_MAX_SENTENCE_WORDS = 35
READABILITY_MAX_MEAN_WORDS = 20
READABILITY_MEAN_MIN_SENTENCES = 3

_SENTENCE_SPLIT_RE = re.compile(r"[.!?]+")
_LATIN_WORD_RE = re.compile(r"[A-Za-z']+")


def _readability_errors(field, text):
    """Sentence-length checks. An em-dash-joined clause chain reads as one long
    breath, so sentences split on terminal punctuation only — that is what makes
    the gate catch the actual failure mode. Messages are written for the
    generator's retry feedback, not for a human report."""
    counts = [
        len(_LATIN_WORD_RE.findall(s))
        for s in _SENTENCE_SPLIT_RE.split(text)
        if s.strip()
    ]
    errors = []
    longest = max(counts, default=0)
    if longest > READABILITY_MAX_SENTENCE_WORDS:
        errors.append(
            f"{field} has a {longest}-word sentence; keep every sentence under "
            f"{READABILITY_MAX_SENTENCE_WORDS} words — split it at the natural "
            "joint into two shorter ones"
        )
    if len(counts) >= READABILITY_MEAN_MIN_SENTENCES:
        mean = sum(counts) / len(counts)
        if mean > READABILITY_MAX_MEAN_WORDS:
            errors.append(
                f"{field} averages {mean:.0f} words per sentence; write shorter "
                "sentences — one idea each, most under 18 words, no clause "
                "stacked on with a dash or an -ing tail"
            )
    return errors


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


def _tag_pattern(tag):
    return re.compile(rf"<{tag}>(.*?)</{tag}>", re.S)


def _tag_errors(field, text, tag):
    """Structural check on the highlight markup: the only tag in this field is
    `tag`, every one opens and closes in order, none nest, none are empty."""
    errors = []
    depth = 0
    for match in _ANY_TAG_RE.finditer(text):
        token = match.group(0)
        if token == f"<{tag}>":
            if depth:
                errors.append(f"{field} nests <{tag}> inside another <{tag}>; tags may not overlap")
            depth += 1
        elif token == f"</{tag}>":
            if depth:
                depth -= 1
            else:
                errors.append(f"{field} closes </{tag}> without opening one")
        else:
            errors.append(
                f"{field} contains {token}; the only markup allowed here is "
                f"<{tag}>...</{tag}>"
            )
    if depth:
        errors.append(f"{field} leaves a <{tag}> tag unclosed")
    if errors:
        return errors
    if any(not inner.strip() for inner in _tag_pattern(tag).findall(text)):
        errors.append(f"{field} has an empty <{tag}></{tag}> pair; tag the words themselves")
    return errors


def _strip_tags(text, tag):
    return _tag_pattern(tag).sub(lambda m: m.group(1), text) if tag else text


def _tagged_spans(text, tag):
    return _tag_pattern(tag).findall(text) if tag else []


def _field_errors(kind, field, text, enforce_readability=False):
    """Markup + length, both measured on the tag-stripped prose. Malformed tags
    short-circuit: stripping them is meaningless until they parse. The Rev 4
    readability gate runs only on freshly generated drafts (see validate_draft),
    never on the re-validation of stored ones."""
    tag = ALLOWED_TAG.get((kind, field))
    if tag:
        tag_errors = _tag_errors(field, text, tag)
        if tag_errors:
            return tag_errors
    plain = _strip_tags(text, tag)
    errors = _markup_errors(field, plain) + _length_errors(
        field, plain, LEN_BOUNDS[kind][field])
    if enforce_readability:
        errors += _readability_errors(field, plain)
    return errors


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


def _component_errors(field, text, tag, components, noun, why):
    """Rev 2: a taught component must be *highlighted* where the story uses it,
    not merely mentioned somewhere in the paragraph. The tag is what lets the
    app colour the borrowed piece, which is the whole point of the chain —
    the learner should see at a glance which words came from below."""
    errors = []
    plain = _strip_tags(text, tag)
    spans = _tagged_spans(text, tag)
    for comp in components:
        words = _meaning_words(comp["meaning_synonyms"])
        if not words:
            continue
        phrase = f"{noun} {comp.get('form') or comp.get('char')} (“{comp['meaning']}”)"
        if not _references(plain, words):
            errors.append(f"{field} never references {phrase}; {why}")
        elif not any(_references(span, words) for span in spans):
            errors.append(
                f"{field} references {phrase} but never wraps it in "
                f"<{tag}>...</{tag}>; highlight the taught meaning where the story uses it"
            )
    return errors


def _reading_errors(field, text, reading):
    """The reading must be present verbatim *and* highlighted — the kana is the
    single thing the learner is trying to pull out of this story."""
    if _hira(reading) not in _hira(_strip_tags(text, "reading")):
        return [f"{field} must contain the target reading 「{reading}」 verbatim"]
    if not any(_hira(reading) in _hira(span) for span in _tagged_spans(text, "reading")):
        return [
            f"{field} does not highlight the reading; wrap it as "
            f"<reading>{reading}</reading> so the sound stands out"
        ]
    return []


def validate_kanji(level, slug, draft, ctx=None, enforce_readability=False):
    ctx = ctx or mnemonic_context.kanji_context(level, slug)
    errors = []

    for field in ("meaning_mnemonic", "reading_mnemonic"):
        value = draft.get(field)
        if not isinstance(value, str) or not value.strip():
            errors.append(f"missing or empty field {field}")
    if errors:
        return errors

    for field in ("meaning_mnemonic", "reading_mnemonic"):
        errors += _field_errors(
            "kanji", field, draft[field], enforce_readability=enforce_readability)

    # 2. reading present and highlighted
    primary = ctx["primary_reading"]
    if primary:
        errors += _reading_errors("reading_mnemonic", draft["reading_mnemonic"], primary)

    # 3. decomposition referenced and highlighted
    errors += _component_errors(
        "meaning_mnemonic", draft["meaning_mnemonic"], "radical", ctx["components"],
        "the taught component",
        "the story must be built from the taught decomposition")

    # 4. description (Rev 2: optional — written only when the item has something
    #    a mnemonic cannot carry). Look-alike contrast prose is exactly that, so
    #    an item with reviewed confusables still owes one.
    description = draft.get("description")
    if isinstance(description, str) and description.strip():
        errors += _field_errors(
            "kanji", "description", description,
            enforce_readability=enforce_readability)
        errors += _look_alike_errors(
            "description", description, ctx, ctx["char"],
            extra_allowed_forms=[c["form"] for c in ctx["components"]])
    elif ctx["look_alikes"]:
        forms = ", ".join(entry["form"] for entry in ctx["look_alikes"])
        errors.append(
            f"description is omitted, but this kanji has reviewed look-alikes ({forms}); "
            "the contrast prose is what saves those reviews, so a description is required here"
        )

    return errors


def validate_radical(level, slug, draft, ctx=None, enforce_readability=False):
    ctx = ctx or mnemonic_context.radical_context(level, slug)
    errors = []

    text = draft.get("mnemonic_text")
    if not isinstance(text, str) or not text.strip():
        return ["missing or empty field mnemonic_text"]

    errors += _field_errors(
        "radical", "mnemonic_text", text, enforce_readability=enforce_readability)

    # Rev 5: image_prompt is the stroke-walked scene the Tier 2 art is drawn
    # from. Only fresh drafts are held to it (same lane as the readability
    # gate): stored drafts predate the field, and the backfill copies their
    # mnemonic_text in verbatim. No readability gate on it — clause-stacked
    # specification is what an illustrator's prompt wants.
    image_prompt = draft.get("image_prompt")
    if isinstance(image_prompt, str) and image_prompt.strip():
        errors += _field_errors("radical", "image_prompt", image_prompt)
    elif enforce_readability:
        errors.append("missing or empty field image_prompt")

    # The meaning must be reached *and* highlighted. A radical has no components
    # to borrow, so the one thing worth colouring is the word the story resolves
    # to — the same word every kanji built on this radical will pull upward.
    words = _meaning_words(ctx["meaning_synonyms"])
    if words:
        plain = _strip_tags(text, "radical")
        spans = _tagged_spans(text, "radical")
        if not _references(plain, words):
            errors.append(
                f"mnemonic_text never lands on the meaning “{ctx['meaning']}”; the image "
                "must resolve to that meaning"
            )
        elif not any(_references(span, words) for span in spans):
            errors.append(
                f"mnemonic_text reaches the meaning “{ctx['meaning']}” but never wraps it in "
                "<radical>...</radical>; highlight the word the picture resolves to"
            )

    # Rev 3: a radical's `description` is optional on the same terms as a
    # kanji's — the mnemonic is what the learner reads, so a description that
    # retells it is noise. Look-alike contrast is the one thing the mnemonic
    # cannot carry (it would have to name a character the story isn't about),
    # so a radical with reviewed confusables still owes one.
    description = draft.get("description")
    if isinstance(description, str) and description.strip():
        errors += _field_errors(
            "radical", "description", description,
            enforce_readability=enforce_readability)
        errors += _look_alike_errors("description", description, ctx, ctx["form"])
    elif ctx["look_alikes"]:
        forms = ", ".join(entry["form"] for entry in ctx["look_alikes"])
        errors.append(
            f"description is omitted, but this radical has reviewed look-alikes ({forms}); "
            "the contrast prose is what saves those reviews, so a description is required here"
        )
    return errors


def validate_vocab(level, slug, draft, ctx=None, enforce_readability=False):
    ctx = ctx or mnemonic_context.vocab_context(level, slug)
    errors = []

    for field in ("meaning_mnemonic", "reading_mnemonic"):
        value = draft.get(field)
        if not isinstance(value, str) or not value.strip():
            errors.append(f"missing or empty field {field}")
    if errors:
        return errors

    # reading_mnemonic's length is bounded by the regularity branch below, not
    # by LEN_BOUNDS, so its markup is checked here rather than via _field_errors.
    reading_text = draft["reading_mnemonic"]
    errors += _field_errors(
        "vocab", "meaning_mnemonic", draft["meaning_mnemonic"],
        enforce_readability=enforce_readability)
    tag_errors = _tag_errors("reading_mnemonic", reading_text, "reading")
    if tag_errors:
        errors += tag_errors
    else:
        errors += _markup_errors("reading_mnemonic", _strip_tags(reading_text, "reading"))

    # 2. the kanji -> vocabulary chain is literal, not name-dropped
    errors += _component_errors(
        "meaning_mnemonic", draft["meaning_mnemonic"], "kanji", ctx["components"],
        "the component kanji",
        "the story must connect its kanji to the word")

    # 3. reading present and highlighted, and shaped by the mechanically
    #    computed regularity
    reading = ctx["reading"]
    if reading:
        errors += _reading_errors("reading_mnemonic", reading_text, reading)
    kind = ctx["regularity"]["kind"]
    reading_plain = _strip_tags(reading_text, "reading")
    if kind in _DERIVATION_KINDS:
        errors += _length_errors(
            "reading_mnemonic (a derivation note — this reading is "
            f"{'kana-only' if kind == 'kana_only' else 'regular'}, so do not "
            "write a story)", reading_plain, DERIVATION_NOTE_BOUNDS)
    else:
        errors += _length_errors(
            "reading_mnemonic (a full story — this reading is a lone kun'yomi "
            "or is not derivable at all)", reading_plain, READING_STORY_BOUNDS)
    if enforce_readability and not tag_errors:
        errors += _readability_errors("reading_mnemonic", reading_plain)

    # 4. description (Rev 2: optional — only when the word carries a nuance the
    #    mnemonics cannot). When present it still names no stray kanji, since it
    #    carries no furigana.
    description = draft.get("description")
    if isinstance(description, str) and description.strip():
        errors += _field_errors(
            "vocab", "description", description,
            enforce_readability=enforce_readability)
        allowed = set(ctx["form"]) | {c["char"] for c in ctx["components"]}
        for ch in dict.fromkeys(mnemonic_context._CJK_RE.findall(description)):
            if ch not in allowed:
                errors.append(
                    f"description names the kanji {ch}, which is neither in this word "
                    "nor one of its taught components; descriptions carry no furigana"
                )

    return errors


def validate_draft(level, kind, slug, draft, ctx=None, enforce_readability=False):
    """`enforce_readability` turns on the Rev 4 sentence-shape gate. Pass it
    only for freshly generated drafts; stored drafts are re-validated without
    it so kept content is never requeued for a readability rewrite."""
    if kind == "kanji":
        return validate_kanji(level, slug, draft, ctx, enforce_readability)
    if kind == "radical":
        return validate_radical(level, slug, draft, ctx, enforce_readability)
    if kind == "vocab":
        return validate_vocab(level, slug, draft, ctx, enforce_readability)
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
