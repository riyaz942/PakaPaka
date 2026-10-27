# curriculum/_build/generate_content/answer_units.py
# -*- coding: utf-8 -*-
"""Cuts one accepted Build answer into word / particle / other units, for the
on-device explanation of a wrong Build answer.

Offsets follow generate_content/spans.py: Python string indices into the text.
"""

import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import furigana as furigana_lib  # noqa: E402
from generate_content import spans as spans_lib  # noqa: E402

_SYMBOL_POS = {"補助記号", "空白"}
#: Tokens that never stand alone: ます/た/ない endings and 〜的 style suffixes.
_TAIL_POS = {"助動詞", "接尾辞"}


def _joins_previous(token):
    if token["pos1"] in _TAIL_POS:
        return True
    return (token["pos1"] == "助詞" and token["pos2"] == "接続助詞"
            and token["surface"] in ("て", "で"))


def answer_units(text, furigana, forms_by_slug, grammar_span):
    """`text` cut into units: {surface, reading, role, vocabulary_slug, in_grammar}.

    Word spans are cut the same way as the pool sentence's `word_spans`
    (generate._grammar_example); `grammar_span` is {start, end} or None.
    Readings come from `furigana` (the answer's bracket notation, which the
    Build grader accepts), not from the tokenizer: 私[わたし] reads わたし.
    Raises ValueError when a unit edge cuts a furigana group (the reading
    cannot be split safely; the build reports it so the sentence is fixed)."""
    word_spans = spans_lib.merge_spans(
        spans_lib.derive_spans(text, forms_by_slug),
        spans_lib.build_stem_spans(text, forms_by_slug),
    )
    tokens = spans_lib.tokens_with_offsets(text)
    gs, ge = (grammar_span["start"], grammar_span["end"]) if grammar_span else (0, 0)

    units = []  # each carries start/end while cutting; dropped at the end
    for token in tokens:
        if token["pos1"] in _SYMBOL_POS:
            continue
        start, end = token["start"], token["end"]
        in_gram = start < ge and gs < end
        prev = units[-1] if units else None
        prev_in_grammar = bool(prev) and prev["_start"] < ge and gs < prev["_end"]
        span = next((s for s in word_spans if s["start"] <= start and end <= s["end"]), None)
        if span and span["start"] == start:
            units.append(_new("word", token, span["vocabulary_slug"]))
        elif prev and (span or _joins_previous(token)):
            _extend(prev, token)
        elif token["pos1"] == "助詞" and not in_gram:
            units.append(_new("particle", token, None))
        elif prev and prev["role"] == "other" and prev_in_grammar == in_gram:
            _extend(prev, token)
        else:
            units.append(_new("other", token, None))

    groups = _furigana_groups(furigana, text)
    reading_at = list(text)  # per character; a group's reading sits on its first kanji
    for start, end, kana in groups:
        reading_at[start:end] = [kana] + [""] * (end - start - 1)
    for unit in units:
        unit["in_grammar"] = unit["_start"] < ge and gs < unit["_end"]
        chars = [i for start, end in unit["_ranges"] for i in range(start, end)]
        for start, end, _ in groups:
            covered = sum(start <= i < end for i in chars)
            if 0 < covered < end - start:
                raise ValueError(f"answer unit {unit['surface']!r} cuts furigana group "
                                 f"{text[start:end]!r} in {furigana!r}")
        unit["reading"] = "".join(reading_at[i] for i in chars)
        del unit["_start"], unit["_end"], unit["_ranges"]
    return units


_BRACKET_RE = re.compile(r"\[([^\[\]]*)]")


def _is_group_kanji(ch):
    """Kanji for furigana grouping: the app's parseFurigana also takes 々 into the run."""
    return ch == "々" or furigana_lib.is_kanji(ch)


def _furigana_groups(furigana, text):
    """(start, end, reading) of each furigana group, as offsets into `text`. A
    reading belongs to the maximal kanji run before it, as in parseFurigana."""
    if furigana_lib.strip_furigana(furigana) != text:
        raise ValueError(f"furigana {furigana!r} does not spell {text!r}")
    groups = []
    cursor = 0  # furigana index already read
    plain = 0  # text offset of `cursor`
    for match in _BRACKET_RE.finditer(furigana):
        run = match.start()
        while run > cursor and _is_group_kanji(furigana[run - 1]):
            run -= 1
        plain += run - cursor
        if match.start() > run:
            groups.append((plain, plain + match.start() - run, match.group(1)))
        plain += match.start() - run
        cursor = match.end()
    return groups


def _new(role, token, slug):
    return {"surface": token["surface"], "reading": "", "role": role,
            "vocabulary_slug": slug, "_start": token["start"], "_end": token["end"],
            "_ranges": [(token["start"], token["end"])]}


def _extend(unit, token):
    unit["surface"] += token["surface"]
    unit["_end"] = token["end"]
    unit["_ranges"].append((token["start"], token["end"]))
