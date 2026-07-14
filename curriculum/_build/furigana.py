# -*- coding: utf-8 -*-
"""Furigana generation: JmdictFurigana bracket-notation annotation.

Converts plain Japanese strings into the JmdictFurigana bracket format
(`私[わたし]は学生[がくせい]です。`) used throughout the app — see
docs/furigana-support-plan.md ground rule 1.

Two entry points:
  annotate_word(form, reading)   -- exact dictionary lookup, for vocabulary
                                     primary_form (reading is already known).
  annotate_sentence(text)        -- tokenizes with fugashi/unidic and looks
                                     up (or falls back for) each token, for
                                     example sentences and reading passages.

Both return None (never raise, never guess wrong) when an annotation can't
be produced or would fail the round-trip invariant that stripping the
brackets must reproduce the input exactly.
"""

import functools
import os
import re

BUILD_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(BUILD_DIR, "data", "JmdictFurigana.txt")

_KANJI_RE = re.compile(r"[一-鿿]")
_KANA_RE = re.compile(r"[぀-ヿ]")


def is_kanji(ch):
    return bool(_KANJI_RE.match(ch))


def is_kana(ch):
    return bool(_KANA_RE.match(ch))


def katakana_to_hiragana(text):
    out = []
    for ch in text:
        code = ord(ch)
        if 0x30A1 <= code <= 0x30F6:
            out.append(chr(code - 0x60))
        else:
            out.append(ch)
    return "".join(out)


def strip_furigana(annotated):
    """Mirrors scripts/validate-schema.ts stripFurigana — must stay in sync."""
    return re.sub(r"\[[^\[\]]*]", "", annotated)


def _parse_segments(segments):
    spans = []
    for part in segments.split(";"):
        if not part:
            continue
        idx_part, kana = part.split(":", 1)
        if "-" in idx_part:
            start_s, end_s = idx_part.split("-")
            start, end = int(start_s), int(end_s)
        else:
            start = end = int(idx_part)
        spans.append((start, end, kana))
    spans.sort(key=lambda s: s[0])
    return spans


def _to_bracket_notation(word, spans):
    result = []
    pos = 0
    for start, end, kana in spans:
        result.append(word[pos:start])
        result.append(word[start:end + 1])
        result.append(f"[{kana}]")
        pos = end + 1
    result.append(word[pos:])
    return "".join(result)


@functools.lru_cache(maxsize=1)
def _load_dataset():
    by_word_reading = {}
    by_word = {}
    if not os.path.exists(DATASET_PATH):
        raise FileNotFoundError(
            f"JmdictFurigana dataset not found at {DATASET_PATH}. "
            "Run curriculum/_build/fetch_furigana_dataset.sh first."
        )
    with open(DATASET_PATH, "r", encoding="utf-8-sig") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line or "|" not in line:
                continue
            parts = line.split("|")
            if len(parts) != 3:
                continue
            word, reading, segments = parts
            spans = _parse_segments(segments)
            notation = _to_bracket_notation(word, spans)
            key = (word, reading)
            if key not in by_word_reading:
                by_word_reading[key] = notation
            if word not in by_word:
                by_word[word] = notation
    return by_word_reading, by_word


def annotate_word(form, reading):
    """Exact (form, reading) lookup for vocabulary primary_form, falling back
    to tokenized annotation for compound/conjugated forms not in the
    dictionary as a whole string (e.g. suru-verbs like 勉強する, potential
    forms like 買える) — each piece (勉強, する) is looked up individually,
    same as annotate_sentence. No further guessing: a wrong reading is worse
    than no furigana for a curated word list."""
    if not reading:
        return None
    by_word_reading, _by_word = _load_dataset()
    notation = by_word_reading.get((form, reading))
    if notation is not None and strip_furigana(notation) == form:
        return notation
    return annotate_sentence(form, {form: reading})


_TAGGER = None


def get_tagger():
    """Public accessor for the shared fugashi/unidic tagger. Phase 2 tooling
    (generate_content/level_check.py) must level-check with the *same*
    tokenizer that produces shipped furigana — see the "one tokenizer, not
    two" rule in docs/content-pipeline-plan.md."""
    return _get_tagger()


def _get_tagger():
    global _TAGGER
    if _TAGGER is None:
        import fugashi

        _TAGGER = fugashi.Tagger()
    return _TAGGER


def _token_reading(token):
    feature = token.feature
    kana = getattr(feature, "kana", None) or getattr(feature, "pron", None)
    if not kana or kana == "*":
        return None
    return katakana_to_hiragana(kana)


def _fallback_annotate_token(surface, reading):
    """No dataset entry for this exact surface. Strip the trailing kana
    okurigana common to both surface and reading, then wrap the remaining
    kanji-only prefix in a single bracket (kinsoku-safe, round-trips)."""
    i = 0
    while (
        i < len(surface)
        and i < len(reading)
        and surface[-(i + 1)] == reading[-(i + 1)]
        and is_kana(surface[-(i + 1)])
    ):
        i += 1

    prefix = surface[: len(surface) - i] if i else surface
    suffix = surface[len(surface) - i :] if i else ""
    prefix_reading = reading[: len(reading) - i] if i else reading

    if not prefix:
        return surface
    if not any(is_kanji(ch) for ch in prefix):
        return surface
    return f"{prefix}[{prefix_reading}]{suffix}"


def annotate_sentence(text, known_readings=None):
    """Tokenizes `text` and annotates each kanji-bearing token, falling back
    to the tokenizer's own reading when a token isn't in the dataset. Returns
    None (never a wrong/partial result) if the round-trip invariant fails.

    `known_readings` is an optional {surface: reading} map (built from the
    curriculum's own vocab list — see generate.py) checked before the
    tokenizer's guess: unidic's default reading for a word in isolation
    (e.g. 私 -> わたくし) can differ from the reading the curriculum actually
    teaches for it (わたし), even when both are valid dictionary readings.
    """
    by_word_reading, by_word = _load_dataset()
    tagger = _get_tagger()
    known_readings = known_readings or {}

    pieces = []
    for token in tagger(text):
        surface = token.surface
        if not any(is_kanji(ch) for ch in surface):
            pieces.append(surface)
            continue

        reading = _token_reading(token)
        if reading is None:
            pieces.append(surface)
            continue

        # Prefer the curriculum's own reading, then the token's actual
        # (contextual) reading — many kanji are homographs (本 "ほん"/"もと",
        # 彼 "かれ"/"あれ") and by_word alone (first entry in file order)
        # picks whichever reading happens to sort first, right or wrong.
        candidate_readings = [known_readings.get(surface), reading]
        dataset_notation = None
        for candidate in candidate_readings:
            if candidate is None:
                continue
            dataset_notation = by_word_reading.get((surface, candidate))
            if dataset_notation is not None:
                break
        if dataset_notation is None:
            dataset_notation = by_word.get(surface)

        if dataset_notation is not None:
            pieces.append(dataset_notation)
            continue

        pieces.append(_fallback_annotate_token(surface, known_readings.get(surface) or reading))

    annotated = "".join(pieces)
    if strip_furigana(annotated) != text:
        return None
    return annotated
