# curriculum/_build/generate_content/answer_units.py
# -*- coding: utf-8 -*-
"""Cuts one accepted Build answer into word / particle / other units, for the
on-device explanation of a wrong Build answer.

Offsets follow generate_content/spans.py: Python string indices into the text.
"""

import os
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


def answer_units(text, forms_by_slug, grammar_span):
    """`text` cut into units: {surface, reading, role, vocabulary_slug, in_grammar}.

    Word spans are cut the same way as the pool sentence's `word_spans`
    (generate._grammar_example); `grammar_span` is {start, end} or None."""
    word_spans = spans_lib.merge_spans(
        spans_lib.derive_spans(text, forms_by_slug),
        spans_lib.build_stem_spans(text, forms_by_slug),
    )
    tagger_tokens = list(furigana_lib.get_tagger()(text))
    tokens = spans_lib.tokens_with_offsets(text)
    gs, ge = (grammar_span["start"], grammar_span["end"]) if grammar_span else (0, 0)

    units = []  # each carries start/end while cutting; dropped at the end
    for token, raw in zip(tokens, tagger_tokens):
        if token["pos1"] in _SYMBOL_POS:
            continue
        reading = furigana_lib._token_reading(raw) or token["surface"]
        start, end = token["start"], token["end"]
        in_gram = start < ge and gs < end
        prev = units[-1] if units else None
        prev_in_grammar = bool(prev) and prev["_start"] < ge and gs < prev["_end"]
        span = next((s for s in word_spans if s["start"] <= start and end <= s["end"]), None)
        if span and span["start"] == start:
            units.append(_new("word", token, reading, span["vocabulary_slug"]))
        elif prev and (span or _joins_previous(token)):
            _extend(prev, token, reading)
        elif token["pos1"] == "助詞" and not in_gram:
            units.append(_new("particle", token, reading, None))
        elif prev and prev["role"] == "other" and prev_in_grammar == in_gram:
            _extend(prev, token, reading)
        else:
            units.append(_new("other", token, reading, None))

    for unit in units:
        unit["in_grammar"] = unit["_start"] < ge and gs < unit["_end"]
        del unit["_start"], unit["_end"]
    return units


def _new(role, token, reading, slug):
    return {"surface": token["surface"], "reading": reading, "role": role,
            "vocabulary_slug": slug, "_start": token["start"], "_end": token["end"]}


def _extend(unit, token, reading):
    unit["surface"] += token["surface"]
    unit["reading"] += reading
    unit["_end"] = token["end"]
