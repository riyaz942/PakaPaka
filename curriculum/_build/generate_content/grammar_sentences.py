# curriculum/_build/generate_content/grammar_sentences.py
# -*- coding: utf-8 -*-
"""Derived fields for the grammar sentence pool (grammar Read + Build cards).

Spec: docs/superpowers/specs/2026-10-13-grammar-read-build-srs-design.md §4.2.
Everything here is derived from the sentence text — nothing is authored except
an optional `form` (which occurrence of the grammar to highlight).

Offsets follow generate_content/spans.py: Python string indices into the
`japanese` string, re-checked by compile-curriculum by slicing.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from generate_content import spans as spans_lib  # noqa: E402

CLOZE_BLANK = "＿＿＿"

#: POS that make a token a word the learner must be given on the Build card.
#: Wider than level_check.CONTENT_POS on purpose: pronouns (私) and adnominals
#: (この) are "function words" for the level check but still words a learner
#: has to know to write the sentence.
BUILD_CONTENT_POS = frozenset({"名詞", "動詞", "形容詞", "形状詞", "副詞", "代名詞", "連体詞"})

_POLITE_AUX = {"です", "ます"}
_NEGATIVE_AUX = {"ない", "ず"}
_SYMBOL_POS = {"補助記号", "空白"}


def grammar_span(japanese, accepted_forms, form=None):
    """Where the grammar sits in `japanese`, for the Read-card highlight.

    `form` is the authored chunk (a cloze answer, or a disambiguating chunk
    like 今日は); when given it must be present. Otherwise the longest
    contiguous accepted form wins, first occurrence. Forms containing 〜 are
    discontinuous and never matched literally."""
    if form is not None:
        start = japanese.find(form)
        if start < 0:
            raise ValueError(f"grammar form {form!r} not found in {japanese!r}")
        return {"start": start, "end": start + len(form)}
    candidates = sorted(
        (f for f in accepted_forms if f and "〜" not in f), key=len, reverse=True
    )
    for candidate in candidates:
        start = japanese.find(candidate)
        if start >= 0:
            return {"start": start, "end": start + len(candidate)}
    return None


def _tokens(japanese):
    return spans_lib.tokens_with_offsets(japanese)


def register_of(japanese):
    """'polite' when a です/ます auxiliary follows the last content word."""
    tokens = [t for t in _tokens(japanese) if t["pos1"] not in _SYMBOL_POS]
    last_content = -1
    for i, token in enumerate(tokens):
        if token["pos1"] in BUILD_CONTENT_POS:
            last_content = i
    tail = tokens[last_content + 1 :]
    if any(t["pos1"] == "助動詞" and t["lemma"] in _POLITE_AUX for t in tail):
        return "polite"
    return "plain"


def sentence_shape(japanese):
    """(question, negative, past) — the variety rule's sentence types."""
    tokens = _tokens(japanese)
    words = [t for t in tokens if t["pos1"] not in _SYMBOL_POS]
    question = "？" in japanese or "?" in japanese or (
        bool(words) and words[-1]["pos1"] == "助詞" and words[-1]["surface"] == "か"
    )
    negative = any(
        (t["pos1"] == "助動詞" and t["lemma"] in _NEGATIVE_AUX)
        or (t["pos1"] == "形容詞" and t["lemma"] == "無い")
        for t in tokens
    )
    past = any(t["pos1"] == "助動詞" and t["lemma"] == "た" for t in tokens)
    return (question, negative, past)


def fill_cloze(jp_cloze, answer):
    if CLOZE_BLANK not in jp_cloze or not answer:
        return None
    return jp_cloze.replace(CLOZE_BLANK, answer, 1)


def cloze_examples(cloze_variants, existing_japanese):
    """Filled cloze variants as example dicts, skipping any sentence already
    present (in `existing_japanese` or earlier in the list)."""
    seen = set(existing_japanese)
    out = []
    for variant in cloze_variants:
        jp = fill_cloze(variant["jp_cloze"], variant["answer"])
        if jp is None or jp in seen:
            continue
        seen.add(jp)
        out.append({"jp": jp, "en": variant["english"], "form": variant["answer"]})
    return out


def _inside(token, span):
    return span["start"] <= token["start"] and token["end"] <= span["end"]


def uncovered_content_words(japanese, word_spans, span):
    """Content tokens outside the grammar span and outside every word span —
    words a Build-card learner would have to produce without being shown."""
    covers = list(word_spans) + ([span] if span else [])
    return [
        t["surface"]
        for t in _tokens(japanese)
        if t["pos1"] in BUILD_CONTENT_POS and not any(_inside(t, c) for c in covers)
    ]
