# -*- coding: utf-8 -*-
"""Furigana generation: JmdictFurigana bracket-notation annotation.

Converts plain Japanese strings into the JmdictFurigana bracket format
(`私[わたし]は学生[がくせい]です。`) used throughout the app — see
docs/content/furigana-support-plan.md ground rule 1.

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
    """Two indexes over JmdictFurigana.

    `by_word_reading` — {(word, reading): notation}, and the only one the
    annotator's main path uses. A reading is settled from context first and
    then looked up, because JmdictFurigana lists *every* reading a word has:
    a surface-keyed lookup resolves to whichever line sorts first rather than
    the one this sentence means (来 → 来[らい], never 来[き]).

    `primary_by_word` — {word: notation} for the first line per word, which is
    JMdict's primary reading. Safe only where context has already been shown
    to produce a reading that cannot be right; its single caller is
    `_numeral_compound_notation`.
    """
    by_word_reading = {}
    primary_by_word = {}
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
            if word not in primary_by_word:
                primary_by_word[word] = notation
    return by_word_reading, primary_by_word


def annotate_word(form, reading):
    """Exact (form, reading) lookup for vocabulary primary_form, falling back
    to tokenized annotation for compound/conjugated forms not in the
    dictionary as a whole string (e.g. suru-verbs like 勉強する, potential
    forms like 買える) — each piece (勉強, する) is looked up individually,
    same as annotate_sentence. No further guessing: a wrong reading is worse
    than no furigana for a curated word list."""
    if not reading:
        return None
    by_word_reading, _primary = _load_dataset()
    notation = by_word_reading.get((form, reading))
    if notation is not None and strip_furigana(notation) == form:
        return notation
    return annotate_sentence(form, {form: reading})


_TAGGER = None


def get_tagger():
    """Public accessor for the shared fugashi/unidic tagger. Phase 2 tooling
    (generate_content/level_check.py) must level-check with the *same*
    tokenizer that produces shipped furigana — see the "one tokenizer, not
    two" rule in docs/content/content-pipeline-plan.md."""
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


def _fused_to_previous(tokens, i, primary_by_word):
    """Whether `tokens[i]` is a suffix genuinely bound to the token before it.

    unidic tags a suffix from its own lemma rather than from context, so an
    ordinary noun gets mislabelled when it happens to follow a counter: in
    三回犬と歩きます it calls 犬 a suffix and reads it けん. Requiring the pair
    to be a compound the dictionary actually knows keeps the real cases
    (日本人, 三人, 何冊) and drops the accidents — 回犬 is not a word.
    """
    if i == 0 or getattr(tokens[i].feature, "pos1", None) != "接尾辞":
        return False
    return (tokens[i - 1].surface + tokens[i].surface) in primary_by_word


def _known_reading(tokens, i, known_readings, primary_by_word):
    """The curriculum's own reading for this token, where it legitimately wins.

    `known_readings` is keyed by surface alone, so left unchecked it hijacks
    any token that looks like a vocabulary entry regardless of what the token
    actually is. Two exclusions keep it to the case it exists for — 私 → わたし
    rather than unidic's isolated-form わたくし — and leave the rest to the
    tokenizer, which reads its tokens in context:

      * a suffix fused into a compound is not the word the curriculum teaches
        (the 人 of 日本人 is じん, not the noun ひと)
      * either half of a numeral compound is read as part of that compound,
        and those readings are irregular: 三日 is みっか, not the taught
        さん + ひ; the 日 of 一日中 is にち; 十日 とおか; 一本 いっぽん
    """
    feature = tokens[i].feature
    if _fused_to_previous(tokens, i, primary_by_word):
        return None
    if getattr(feature, "pos2", None) == "数詞" and i + 1 < len(tokens):
        if getattr(tokens[i + 1].feature, "pos1", None) == "接尾辞":
            return None
    if i > 0 and getattr(tokens[i - 1].feature, "pos2", None) == "数詞":
        return None
    return known_readings.get(tokens[i].surface)


def _suffix_compound_notation(tokens, i, by_word_reading, primary_by_word):
    """Notation for a word fused to a suffix, where the tokenizer can't win.

    unidic reads a host and its suffix as two independent lemmas and does not
    model the sound change between them: 一 + 本 comes back イチ + ポン though
    一本 is いっぽん, 四 + つ comes back ヨン + ツ though 四つ is よっつ, and
    日本 + 人 comes back ニッポン + ニン though 日本人 is にほんじん. Neither
    `pron` nor `kanaBase` carries the fused form, so there is nothing better
    to read off the tokens themselves.

    The tell is that the composed reading is not one JmdictFurigana lists for
    the compound at all — the tokenizer glued two readings together and made a
    non-word. Only then is the dictionary's primary reading taken for the
    pair, which also gets the segmentation right (一[いっ]本[ぽん]).

    Returns None whenever the composed reading *is* a real reading of the
    compound, so anything genuinely ambiguous keeps what context chose. The
    lexicalised compounds never reach here at all — unidic emits 一人 and 二人
    as single tokens.
    """
    if i + 1 >= len(tokens):
        return None
    host, suffix = tokens[i], tokens[i + 1]
    if getattr(suffix.feature, "pos1", None) != "接尾辞":
        return None
    # A host already bound to a numeral belongs to the larger compound, so
    # pairing it rightwards would annotate a word that isn't there: the 日中
    # of 一日中 is not にっちゅう.
    if i > 0 and getattr(tokens[i - 1].feature, "pos2", None) == "数詞":
        return None

    host_reading = _token_reading(host)
    suffix_reading = _token_reading(suffix)
    if host_reading is None or suffix_reading is None:
        return None

    compound = host.surface + suffix.surface
    if (compound, host_reading + suffix_reading) in by_word_reading:
        return None

    notation = primary_by_word.get(compound)
    if notation is None or strip_furigana(notation) != compound:
        return None
    return notation


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
    See `_known_reading` for where that override stops applying.
    """
    by_word_reading, primary_by_word = _load_dataset()
    tagger = _get_tagger()
    known_readings = known_readings or {}

    tokens = list(tagger(text))
    pieces = []
    i = 0
    while i < len(tokens):
        token = tokens[i]
        surface = token.surface

        compound = _suffix_compound_notation(
            tokens, i, by_word_reading, primary_by_word
        )
        if compound is not None:
            pieces.append(compound)
            i += 2
            continue

        index = i
        i += 1

        if not any(is_kanji(ch) for ch in surface):
            pieces.append(surface)
            continue

        reading = _token_reading(token)
        if reading is None:
            pieces.append(surface)
            continue

        # The reading is settled first, from context, and only then looked up:
        # many kanji are homographs (本 "ほん"/"もと", 彼 "かれ"/"あれ", 来
        # "らい"/"き"), so a surface-keyed lookup cannot be the tiebreaker.
        # The curriculum's own reading wins where it applies, otherwise the
        # tokenizer's reading of this token in this sentence.
        chosen = _known_reading(tokens, index, known_readings, primary_by_word) or reading

        # The dataset is consulted only for its *segmentation* (大[だい]学[がく]
        # rather than 大学[だいがく]); a miss costs granularity, not accuracy,
        # so the fallback keeps the same reading in one bracket.
        dataset_notation = by_word_reading.get((surface, chosen))
        if dataset_notation is not None:
            pieces.append(dataset_notation)
            continue

        pieces.append(_fallback_annotate_token(surface, chosen))

    annotated = "".join(pieces)
    if strip_furigana(annotated) != text:
        return None
    return annotated
