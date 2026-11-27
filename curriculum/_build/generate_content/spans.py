# -*- coding: utf-8 -*-
"""Token-aligned vocabulary spans over Japanese text (feedback 14.1a).

Two kinds of span come out of here, both derived — never authored, never asked
of a model — and both measured in UTF-16 offsets so `compile-curriculum` can
slice them straight out of the shipped string:

  * **dictionary spans** — a run of tokens whose surface *is* an allowed
    entry's `primary_form` (来る, 日本語). This is what the shipped passages
    have always carried; `build_word_spans` is that builder, moved here from
    `validate_readings` so the example lane can reuse it.
  * **inflected spans** — a conjugated surface of an allowed entry, limited to
    the four inflection families the N5/N4 grammar curriculum actually teaches
    (ます形, て形, ない形, た形 and their polite/plain maps). 来ます, 開けました,
    走って, 食べなかった.

Recognition is **taught-only** on purpose: an arbitrary unidic lemma match to a
taught word would mark potential/causative/volitional/conditional forms the
learner has never been shown, so those are rejected outright even when the base
word is linked. The four families are exactly the `masu` / `masen` / `mashita`,
`te-form`, `nai-form`, `ta-form` grammar points (plus the い-adjective
くない/かった of `adj-i-conjugation`).

The candidate set is whatever the caller passes, and the two lanes differ on
purpose. An example sentence offers only its own `vocabulary_slugs`, so a span
can never introduce a word the authored links do not list. A passage offers
every word the level teaches, so a word it only ever conjugates (食べます in a
passage that never writes 食べる) gets a span — and is then added to the
passage's `vocabulary_slugs`, which is what the ≥90% Guru+ unlock bar counts.

## The stem invariant

Every span this module emits satisfies

    surface.startswith(inflection_stem(primary_form)) and surface != primary_form

`inflection_stem` is `primary_form` minus its final character (食べる → 食べ,
行く → 行, 高い → 高), or minus する for a する-verb (散歩する → 散歩). That is a
weaker claim than "unidic says so", but it is one `compile-curriculum` can
re-check in TypeScript without a tokenizer, so the compile step verifies the
derivation instead of trusting it. Words whose dictionary form is written in a
different script from their inflected surfaces (分かる vs わからない) fail it and
are skipped rather than shipped unverifiable.
"""

import os
import sys

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BUILD_DIR)

import furigana as furigana_lib  # noqa: E402

#: Longest vocabulary entry, in tokens, a dictionary span may cover (朝ご飯 →
#: 朝/ご飯, 日本語 → 日本/語, 一緒に → 一緒/に).
MAX_SPAN_TOKENS = 4

#: The taught inflection families. Stored on the span (and in curriculum.db) so
#: the app can say "polite ます-form of 来る" without re-deriving anything.
MASU = "masu"
TE = "te"
NAI = "nai"
TA = "ta"
TAUGHT_INFLECTIONS = (MASU, TE, NAI, TA)

#: A conjugated stem whose ending is the grammar point being taught (行き of
#: 行きましょう, 早く of 早く起きる). The span claims only the stem, never a
#: named form; compile stores it with inflection NULL, so the app says "a
#: conjugated form of 行く" instead of naming an untaught pattern.
STEM = "stem"

#: unidic conjugation types for the auxiliaries the four families are built of.
_AUX_MASU = "助動詞-マス"
_AUX_TA = "助動詞-タ"
_AUX_NAI = "助動詞-ナイ"
_AUX_NU = "助動詞-ヌ"     # the ん of ません
_AUX_DESU = "助動詞-デス"  # the でし of ませんでした

_TAUGHT_AUX = {_AUX_MASU: MASU, _AUX_TA: TA, _AUX_NAI: NAI}

#: Forms of a taught auxiliary that belong to an *untaught* pattern: the
#: conditionals (来たら, 来なければ) and the volitionals (行きましょう, 来たろう).
_REJECTED_CFORMS = ("仮定形", "意志推量形")


def _feature(token, name):
    value = getattr(token.feature, name, None)
    return None if value in (None, "*", "") else value


def tokens_with_offsets(text):
    """`text` tokenized by the shared fugashi tagger, with UTF-16 offsets."""
    tokens = []
    cursor = 0
    for token in furigana_lib.get_tagger()(text):
        start = text.index(token.surface, cursor)
        cursor = start + len(token.surface)
        tokens.append({
            "surface": token.surface,
            "start": start,
            "end": cursor,
            "pos1": _feature(token, "pos1"),
            "pos2": _feature(token, "pos2"),
            "ctype": _feature(token, "cType"),
            "cform": _feature(token, "cForm"),
            "orth_base": _feature(token, "orthBase"),
            "lemma": _feature(token, "lemma"),
        })
    return tokens


# --- dictionary-form spans -------------------------------------------------

def _span_may_start_at(tokens, i, run_length):
    """Whether a token run is a word the reader should be able to tap.

    Spans are built on *token* boundaries rather than by substring search,
    because raw string matching marks things that are not words: 「は」+「いつも」
    contains はい, 十分 contains 分, 日曜日 contains 日. Three exclusions on top
    of that, all of them matching the convention the shipped passages follow:

      * a run may not begin at a suffix (接尾辞) — 二つ**目**, 一**匹**. Prefixes
        are *not* excluded: they head their own word (お茶, お願いします), and a
        bare prefix never matches a dictionary form anyway.
      * a bare numeral is not a tappable word (十, 百), though a multi-token
        entry that starts with one is (二つ)
      * a counter bound to a numeral is part of the number, not a word on its
        own — the 分 of 十分, the 円 of 百円, the 時 of 十一時
    """
    head = tokens[i]
    if head["pos1"] == "接尾辞":
        return False
    if run_length == 1 and head["pos2"] == "数詞":
        return False
    if i > 0 and tokens[i - 1]["pos2"] == "数詞":
        return False
    return True


def build_word_spans(body, span_forms, tokens=None):
    """Vocabulary occurrences in `body` as token-aligned, non-overlapping spans.

    Scans left to right; at each token the longest run of consecutive tokens
    whose surface is an allowed dictionary form wins, and the scan resumes
    after it. Spans therefore come out in body order and cannot overlap —
    exactly what `compile-curriculum` requires.
    """
    tokens = tokens if tokens is not None else tokens_with_offsets(body)
    spans = []
    i = 0
    while i < len(tokens):
        for length in range(min(MAX_SPAN_TOKENS, len(tokens) - i), 0, -1):
            start = tokens[i]["start"]
            end = tokens[i + length - 1]["end"]
            slug = span_forms.get(body[start:end])
            if slug and _span_may_start_at(tokens, i, length):
                spans.append({"vocabulary_slug": slug, "start": start, "end": end})
                i += length
                break
        else:
            i += 1
    return spans


# --- taught-inflection spans -----------------------------------------------

def inflection_stem(primary_form):
    """The prefix every taught inflection of `primary_form` keeps.

    Mirrored verbatim in `scripts/compile-curriculum.ts`; changing one without
    the other turns a good span into a compile error (which is the point)."""
    if primary_form.endswith("する"):
        return primary_form[:-2]
    return primary_form[:-1]


def _classify_suffix(tokens, j):
    """`(end_index, inflection)` for the auxiliary run starting at `j`.

    None means the run is not one of the four taught families — a potential
    (られる), a causative (せる), a desiderative (たい), a volitional (ましょう,
    来たろう), a conditional (来たら, 来なければ), a たり listing — or there is no
    auxiliary at all.
    """
    saw = []
    end = j
    while end < len(tokens):
        token = tokens[end]
        pos1 = token["pos1"]
        if pos1 == "助詞" and token["pos2"] == "接続助詞" and token["lemma"] == "て":
            # て/で closes the て形; ている / てください continue past it as
            # their own words and are not part of this span.
            saw.append(TE)
            end += 1
            break
        if pos1 == "助動詞" or (pos1 == "形容詞" and token["orth_base"] == "ない"):
            ctype = token["ctype"]
            if ctype == _AUX_NU and MASU in saw:
                end += 1  # the ん of ません
                continue
            if ctype == _AUX_DESU and MASU in saw:
                end += 1  # the でし of ませんでした
                continue
            kind = _TAUGHT_AUX.get(ctype)
            if kind is None and pos1 == "形容詞":
                kind = NAI  # 高くない / 高くなかった — an adjective, not an auxiliary
            if kind is None:
                # Anything else ends the run. An out-of-scope auxiliary always
                # attaches to the stem directly (食べ+られる, 食べ+たい,
                # 来+させ+ます), so the run is empty and no span comes out;
                # after a taught family it is just a trailing です/だろう.
                break
            if (token["cform"] or "").startswith(_REJECTED_CFORMS):
                # The taught auxiliary in an untaught form: 来たら / 来なければ
                # (conditional), 来たろう / 行きましょう (volitional).
                return None
            saw.append(kind)
            end += 1
            continue
        break
    if not saw:
        return None
    # ます outranks the past it carries (ませんでした is a ます形, not a た形), and
    # the negative outranks the て it can carry (食べなくて is a ない形).
    for kind in (MASU, NAI, TA, TE):
        if kind in saw:
            return end, kind
    return None


def _is_copula_aru(tokens, i):
    """True for the ある of ではありません / じゃありません: the copula's
    negative (grammar), not the verb "to exist"."""
    prev = tokens[i - 1] if i > 0 else None
    if prev and prev["surface"] == "じゃ":
        return True
    return (i > 1 and prev["surface"] == "は"
            and tokens[i - 2]["surface"] == "で")


def build_inflected_spans(text, forms_by_slug, tokens=None):
    """Taught-inflection occurrences of `forms_by_slug` ({slug: primary_form}).

    `forms_by_slug` is the whole candidate set: the sentence's own links for an
    example, the level's vocabulary for a passage (see the module docstring).
    """
    tokens = tokens if tokens is not None else tokens_with_offsets(text)
    slug_by_form = {}
    for slug, form in forms_by_slug.items():
        slug_by_form.setdefault(form, slug)

    spans = []
    for i, token in enumerate(tokens):
        if token["pos1"] not in ("動詞", "形容詞"):
            continue
        base = token["orth_base"] or token["lemma"]
        if not base:
            continue
        if base == "ある" and _is_copula_aru(tokens, i):
            continue

        start = token["start"]
        slug = None
        # する-verbs carry the entry on the noun in front (勉強しました →
        # 勉強する), so the compound is tried before the bare する.
        if base == "する" and i > 0 and tokens[i - 1]["pos1"] == "名詞":
            slug = slug_by_form.get(tokens[i - 1]["surface"] + "する")
            if slug:
                start = tokens[i - 1]["start"]
        if slug is None:
            slug = slug_by_form.get(base)
        if slug is None:
            continue

        classified = _classify_suffix(tokens, i + 1)
        if classified is None:
            continue
        end_index, inflection = classified
        end = tokens[end_index - 1]["end"]

        surface = text[start:end]
        primary_form = forms_by_slug[slug]
        stem = inflection_stem(primary_form)
        if surface == primary_form:
            continue
        if not surface.startswith(stem) or len(surface) <= len(stem):
            continue

        spans.append({
            "vocabulary_slug": slug,
            "start": start,
            "end": end,
            "surface_form": surface,
            "inflection": inflection,
        })
    return spans


def build_stem_spans(text, forms_by_slug, tokens=None):
    """Stem-only spans for linked verbs/adjectives that no taught-inflection
    span covers (grammar pool sentences only). One token per span; the same
    stem invariant as every other inflected span."""
    tokens = tokens if tokens is not None else tokens_with_offsets(text)
    slug_by_form = {}
    for slug, form in forms_by_slug.items():
        slug_by_form.setdefault(form, slug)
    spans = []
    for i, token in enumerate(tokens):
        if token["pos1"] not in ("動詞", "形容詞"):
            continue
        base = token["orth_base"] or token["lemma"]
        if not base:
            continue
        if base == "ある" and _is_copula_aru(tokens, i):
            continue
        start, slug = token["start"], None
        # する-verbs carry the entry on the noun in front (勉強し of
        # 勉強しましょう → 勉強する), as in build_inflected_spans.
        if base == "する" and i > 0 and tokens[i - 1]["pos1"] == "名詞":
            slug = slug_by_form.get(tokens[i - 1]["surface"] + "する")
            if slug:
                start = tokens[i - 1]["start"]
        if slug is None:
            slug = slug_by_form.get(base)
        if slug is None:
            continue
        surface = text[start:token["end"]]
        primary_form = forms_by_slug[slug]
        stem = inflection_stem(primary_form)
        # The stem itself is a valid span (食べ of 食べましょう, 寒 of 寒そう);
        # only the dictionary form is not.
        if surface == primary_form or not surface.startswith(stem):
            continue
        spans.append({
            "vocabulary_slug": slug,
            "start": start,
            "end": token["end"],
            "surface_form": surface,
            "inflection": STEM,
        })
    return spans


def merge_spans(base_spans, extra_spans):
    """`base_spans` plus every `extra_spans` entry that fits between them.

    Dictionary spans are the shipped, already-reviewed layer, so they win any
    overlap (勉強 stays 勉強 even when 勉強する is also linked). The result is in
    text order with no overlap, which is what the compile step requires.
    """
    merged = list(base_spans)
    for span in extra_spans:
        if any(span["start"] < other["end"] and other["start"] < span["end"]
               for other in merged):
            continue
        merged.append(span)
    merged.sort(key=lambda span: span["start"])
    return merged


def derive_spans(text, forms_by_slug, base_spans=None):
    """Every tappable occurrence of `forms_by_slug` ({slug: primary_form}).

    `base_spans` are dictionary spans that already exist (the shipped passage
    `word_spans`); pass None and the dictionary layer is derived here too,
    which is what the example-sentence lane needs — it has no stored spans at
    all today.
    """
    tokens = tokens_with_offsets(text)
    if base_spans is None:
        span_forms = {}
        for slug, form in forms_by_slug.items():
            span_forms.setdefault(form, slug)
        base_spans = build_word_spans(text, span_forms, tokens)
    return merge_spans(base_spans, build_inflected_spans(text, forms_by_slug, tokens))
