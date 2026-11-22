# -*- coding: utf-8 -*-
"""Tokenizer-backed grammar detection for reading passages.

Answers "which grammar points does this text actually use?" from the text
itself, so `grammar_slugs` can stop being a field the model declares about its
own work. `reading_context.py` names the gap this closes: until now the gate
compared the model's *declared* list against the allowed set and nothing more,
so a passage could use out-of-level grammar and simply not mention it.

Uses the same fugashi/unidic tagger as `furigana.py` and `level_check.py` — one
tokenizer, not three (docs/content/content-pipeline-plan.md Phase 1).

## How a slug is detected

Every grammar item already carries `accepted_forms`, a **human-reviewed** list
of the surfaces that count as that point. Three passes read them:

1. **Longest form wins.** A greedy left-to-right scan over the text. At each
   character the longest matching form is taken and its characters are
   consumed, so ではありません is `dewa-arimasen` and not also `desu`, and
   ています is `te-iru` and not bare `masu`.
2. **One-character forms get a part-of-speech rule, never a substring match.**
   は is `wa-topic` only as 係助詞 — never the は inside はじめて. These forms
   are removed from the substring table by `FORM_OVERRIDES` and decided by
   `POS_RULES` over tokens the scan did not consume.
3. **`A〜B` forms are sentence-scoped.** しか〜ない needs both halves, in
   order, in one sentence.

## Voicing

て-form voicing breaks a literal match: 住んでいます holds でいます, not
ています. unidic lemmatizes the voiced particle/auxiliary back (で → て, だ →
た), and every such pair is the same length, so the text is normalised
character-for-character before the scan and every offset still points at the
original text.

## What it refuses to decide

`MANUAL_SLUGS` are points whose forms are indistinguishable from another
point's by any mechanical rule — `node-vs-kara` is から, the same から as
`kara-because`. They are reported in `manual`, never silently counted.

A form shared by several slugs (ません is both `masu` and `masen`; れる is both
`potential` and `passive`) yields a match per slug, each flagged
`ambiguous`. Recall is the point here; the extras are a review list, not a
verdict.

## Calibration

    .venv/bin/python -m generate_content.grammar_detect --calibrate

Runs the detector over the shipped, human-reviewed passages and reports recall
against their declared `grammar_slugs`, plus every slug found that was never
declared.
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import furigana as furigana_lib  # noqa: E402
from levels import MAX_LEVEL  # noqa: E402

from generate_content import context  # noqa: E402


#: Points no mechanical rule can separate from another point. Reported, never
#: counted: `node-vs-kara` is the N5 から taught again as formal reason, so
#: nothing in the text distinguishes it from `kara-because`.
MANUAL_SLUGS = {"node-vs-kara"}

#: Forms pulled out of the substring table because a POS rule decides them
#: instead — every one-character form, plus forms that are another point's
#: whole surface (`adj-na-conjugation` is です/でした, which is `desu`).
#: A slug listed with `"*"` loses all its forms and is POS-only.
FORM_OVERRIDES = {
    "wa-topic": "*",
    "wo": "*",
    "ga": "*",
    "he-direction": "*",
    "de-location": "*",
    "to-and": "*",
    "mo-also": "*",
    "ka-question": "*",
    "ni-direction": "*",
    "ni-indirect": "*",
    "no-possessive": "*",
    "te-form": "*",
    "ta-form": "*",
    "adj-i-conjugation": "*",
    "adj-na-conjugation": "*",
    "adj-i-adverb": "*",
    "adj-na-adverb": "*",
    "toki": "*",
    "goro": "*",
    "to-conditional": "*",
    "ba": "*",
    "aida": "*",
    "demo-suggestion": "*",
    "temo": "*",
    "kara-from": "*",
    "kara-because": {"から"},
    "node-vs-kara": "*",
    "ya-among": {"や"},
    "ne-tag": {"ね"},
    "yo-emphasis": {"よ"},
    "nai-form": {"ない"},
    "no-nominalizer": {"の"},
    #: 前に is the temporal "before" only after a verb; 駅の前に is a place and
    #: its に is a direction. Matching the text alone gets both wrong at once.
    "mae-ni": {"前に", "まえに"},
    #: に行く is "go in order to", which needs a purpose in front of it. Left
    #: as text, に来る swallows the plain destination of 日本に来ました.
    "ni-iku": "*",
    #: でも tokenizes as で + も, so there is nothing for the text to match.
    "demo-suggestion": "*",
    #: ではありません belongs to `dewa-arimasen`; だ is decided by POS so the
    #: adnominal な of a な-adjective does not read as the copula.
    "desu": {"だ", "ではありません"},
}

#: Lemmas that make a preceding に an indirect object rather than a direction —
#: giving, telling, showing. Everything else keeps the broad `ni-direction`,
#: which is how the level teaches it.
_GIVE_TELL_LEMMAS = {
    "上げる", "呉れる", "貰う", "言う", "話す", "聞く", "教える", "見せる",
    "送る", "書く", "渡す", "返す", "出す", "電話", "頼む", "伝える",
}

_SENTENCE_ENDS = "。！？!?\n"


def _f(token, name):
    value = getattr(token.feature, name, None)
    return None if value in (None, "*", "") else value


def _tokenize(text):
    """Tokens as plain dicts, each carrying its character span in `text` and a
    `norm` surface with て-form voicing undone (で → て, だ → た, だり → たり).

    Every voicing pair is the same length, so `norm` is character-aligned with
    the original and a match offset needs no translation back.
    """
    tagger = furigana_lib.get_tagger()
    tokens = []
    cursor = 0
    for token in tagger(text):
        surface = token.surface
        start = text.find(surface, cursor)
        if start < 0:  # defensive: tagger normalised something away
            start = cursor
        cursor = start + len(surface)
        lemma = _f(token, "lemma")
        norm = surface
        #: ないで is not a voiced て — unidic tags its で with lemma て anyway,
        #: which would otherwise turn ないでください into ないてください before
        #: naide-kudasai's accepted form ever gets to match. There is no
        #: standard "ないて"; the connector after 助動詞-ナイ is always で.
        after_nai = tokens and tokens[-1]["c_type"] == "助動詞-ナイ"
        if (
            _f(token, "pos1") in ("助詞", "助動詞")
            and surface[:1] in "でだど"
            and lemma
            and lemma[:1] in "てたと"
            and not after_nai
        ):
            norm = lemma[0] + surface[1:]
        tokens.append(
            {
                "surface": surface,
                "norm": norm,
                "start": start,
                "end": cursor,
                "pos1": _f(token, "pos1"),
                "pos2": _f(token, "pos2"),
                "pos3": _f(token, "pos3"),
                "lemma": lemma,
                "orth_base": _f(token, "orthBase"),
                "c_type": _f(token, "cType"),
                "c_form": _f(token, "cForm"),
            }
        )
    return tokens


def _normalised_text(text, tokens):
    chars = list(text)
    for t in tokens:
        if t["norm"] != t["surface"]:
            chars[t["start"]] = t["norm"][0]
    return "".join(chars)


#: The only auxiliaries worth putting back in citation form. Everything else
#: loses the very characters a pattern is spelled with: unidic reads the に of
#: ようになる as the copula だ, the たら of あったら as た, and the く of
#: 広くなった as 広い — so ようになる, たら and くなる all vanish.
_CITED_AUX_TYPES = {"助動詞-レル", "助動詞-サセル"}


def _dictionary_form(token):
    pos1 = token["pos1"]
    base = token["orth_base"] or token["lemma"] or token["surface"]
    if pos1 == "助詞":
        return token["norm"]
    if pos1 == "助動詞":
        return base if token["c_type"] in _CITED_AUX_TYPES else token["norm"]
    if pos1 == "形容詞":
        # 連用形 is the adverbial く, which is part of くなる / くない / くて.
        return token["surface"] if (token["c_form"] or "").startswith("連用形") else base
    if pos1 in ("動詞", "形状詞"):
        return base
    return token["surface"]


def _dictionary_text(tokens):
    """The text again, with every inflecting word put back in dictionary form,
    plus a map from each of its characters to the original.

    `accepted_forms` spells a pattern by its citation form — てしまう, になる,
    と思う — but a passage inflects it: 食べてしまった, 上手になった,
    と思いました. None of those hold the literal form, so the surface scan
    alone misses the point entirely. Here 食べてしまった reads 食べるてしまうた
    and てしまう matches.

    Offsets no longer line up (しまっ is 3 characters, しまう is 3 but 思い → 思う
    need not be), hence the index map: `index_map[i]` is the character of the
    original that dictionary character `i` came from.
    """
    out, index_map, boundaries = [], [], {0}
    for t in tokens:
        piece = _dictionary_form(t)
        out.append(piece)
        index_map.extend([t["start"]] * (len(piece) - 1) + [t["end"] - 1])
        boundaries.add(len(index_map))
    return "".join(out), index_map, boundaries


# --------------------------------------------------------------------------
# POS rules — one per slug whose forms are too short or too shared to match as
# text. Each takes (tokens, i) and answers whether tokens[i] *is* that point.
# --------------------------------------------------------------------------

#: slug -> (normalised surface, pos1, allowed pos2 values)
_PARTICLE_RULES = {
    "wa-topic": ("は", "助詞", {"係助詞"}),
    "wo": ("を", "助詞", {"格助詞"}),
    "ga": ("が", "助詞", {"格助詞"}),
    "he-direction": ("へ", "助詞", {"格助詞"}),
    "de-location": ("で", "助詞", {"格助詞"}),
    "to-and": ("と", "助詞", {"格助詞"}),
    "ya-among": ("や", "助詞", {"副助詞", "接続助詞", "並立助詞"}),
    "mo-also": ("も", "助詞", {"係助詞"}),
    "ka-question": ("か", "助詞", {"終助詞"}),
    "ne-tag": ("ね", "助詞", {"終助詞"}),
    "yo-emphasis": ("よ", "助詞", {"終助詞"}),
    "te-form": ("て", "助詞", {"接続助詞"}),
    "to-conditional": ("と", "助詞", {"接続助詞"}),
    "ba": ("ば", "助詞", {"接続助詞"}),
}

#: Lemmas that make a preceding に行く / に来る a purpose rather than a
#: destination, and verbs that can close the pattern.
_NI_IKU_VERBS = {"行く", "来る", "帰る"}

#: What a でも suggestion runs into: コーヒーでもどうですか / 飲みませんか.
_SUGGESTION_TAILS = ("どうですか", "いかがですか", "ませんか", "ましょう", "いい")


def _prev(tokens, i):
    return tokens[i - 1] if i > 0 else None


def _next(tokens, i):
    return tokens[i + 1] if i + 1 < len(tokens) else None


def _is_adnominal(token):
    """Whether this token closes a clause that can modify a noun — what tells
    the とき of 行くとき from the 時 of 時間, and 食べるのが from 私の本."""
    if token is None:
        return False
    if token["pos1"] in ("動詞", "形容詞", "助動詞"):
        return (token["c_form"] or "").startswith(("連体形", "終止形"))
    return False


def _rule_ta_form(tokens, i):
    return tokens[i]["c_type"] == "助動詞-タ"


def _rule_nai_form(tokens, i):
    t = tokens[i]
    if t["c_type"] == "助動詞-ナイ":
        return True
    return t["pos1"] == "形容詞" and t["lemma"] in ("無い", "ない")


def _rule_desu(tokens, i):
    t = tokens[i]
    return (
        t["c_type"] == "助動詞-ダ"
        and t["norm"] == "だ"
        and (t["c_form"] or "").startswith("終止形")
    )


def _rule_no_possessive(tokens, i):
    t = tokens[i]
    if t["norm"] != "の" or t["pos2"] != "格助詞":
        return False
    nxt = _next(tokens, i)
    return nxt is not None and nxt["pos1"] in ("名詞", "代名詞", "接頭辞")


def _rule_no_nominalizer(tokens, i):
    t = tokens[i]
    if t["norm"] != "の" or t["pos1"] != "助詞":
        return False
    if t["pos2"] == "準体助詞":
        return True
    return t["pos2"] == "格助詞" and _is_adnominal(_prev(tokens, i))


def _rule_adj_na_adverb(tokens, i):
    """Fires on the な-adjective itself, not on the に that follows it, so
    になりました can be `naru-become` without hiding 賑やかに."""
    nxt = _next(tokens, i)
    return (
        tokens[i]["pos1"] == "形状詞"
        # 助動詞語幹 is the よう of ようにする and the そう of 降りそうです —
        # pattern machinery wearing a な-adjective's part of speech.
        and tokens[i]["pos2"] != "助動詞語幹"
        and nxt is not None
        and nxt["norm"] == "に"
    )


def _ni_particle(tokens, i):
    t = tokens[i]
    prev = _prev(tokens, i)
    return (
        t["norm"] == "に"
        and t["pos1"] == "助詞"
        and t["pos2"] == "格助詞"
        and (prev is None or prev["pos1"] != "形状詞")
    )


def _rule_ni_indirect(tokens, i):
    """に is an indirect object when a giving or telling verb closes the clause.

    The verb can be a long way off — 女の人に「郵便局はどちらですか。」と聞き
    ました — so the search runs to the end of the sentence and steps over
    quoted speech, whose own 。 is not the end of anything.
    """
    if not _ni_particle(tokens, i):
        return False
    depth = 0
    for t in tokens[i + 1 :]:
        surface = t["surface"]
        if surface and surface[0] in "「『":
            depth += 1
        elif surface and surface[0] in "」』":
            depth = max(0, depth - 1)
        elif depth == 0 and surface and surface[0] in _SENTENCE_ENDS:
            break
        if t["lemma"] in _GIVE_TELL_LEMMAS:
            return True
    return False


def _rule_ni_direction(tokens, i):
    """The broad default — destination, time, location. Only the two narrower
    readings are carved out of it."""
    return (
        _ni_particle(tokens, i)
        and not _rule_ni_indirect(tokens, i)
        and not _rule_ni_iku(tokens, i)
    )


def _adjective_i(token):
    return token["pos1"] == "形容詞" and token["c_type"] == "形容詞"


def _rule_adj_i_adverb(tokens, i):
    """Only the adverbial く — 早く, 強く. 青かっ is 連用形 too, but it is the
    past tense and belongs to the conjugation point."""
    return _adjective_i(tokens[i]) and tokens[i]["surface"].endswith("く")


def _rule_adj_i_conjugation(tokens, i):
    return _adjective_i(tokens[i]) and not _rule_adj_i_adverb(tokens, i)


def _rule_adj_na_conjugation(tokens, i):
    return tokens[i]["pos1"] == "形状詞" and tokens[i]["pos2"] != "助動詞語幹"


def _rule_toki(tokens, i):
    t = tokens[i]
    if t["lemma"] not in ("時",) and t["surface"] not in ("とき", "時"):
        return False
    return _is_adnominal(_prev(tokens, i))


def _rule_goro(tokens, i):
    t = tokens[i]
    return t["surface"] in ("ごろ", "頃") and t["pos1"] in ("接尾辞", "名詞")


def _rule_n4_aida(tokens, i):
    t = tokens[i]
    if t["surface"] != "間" or t["pos1"] != "名詞":
        return False
    prev = _prev(tokens, i)
    return _is_adnominal(prev) or (prev is not None and prev["norm"] == "の")


def _rule_mae_ni(tokens, i):
    t = tokens[i]
    if t["surface"] not in ("前", "まえ"):
        return False
    nxt = _next(tokens, i)
    return (
        nxt is not None and nxt["norm"] == "に" and _is_adnominal(_prev(tokens, i))
    )


def _rule_ni_iku(tokens, i):
    """に行く needs a purpose in front: 買い物に行く, 映画を見に行く. A bare
    destination (日本に来ました, 家に帰って) is `ni-direction`."""
    if not _ni_particle(tokens, i):
        return False
    nxt = _next(tokens, i)
    if nxt is None or nxt["lemma"] not in _NI_IKU_VERBS:
        return False
    prev = _prev(tokens, i)
    if prev is None:
        return False
    if prev["pos1"] == "動詞" and (prev["c_form"] or "").startswith("連用形"):
        return True
    return prev["pos1"] == "名詞" and prev["pos3"] == "サ変可能"


def _demo_pair(tokens, i):
    """Whether tokens[i] is the で of a で + も pair."""
    t, nxt = tokens[i], _next(tokens, i)
    return (
        t["norm"] == "で"
        and t["pos1"] == "助詞"
        and nxt is not None
        and nxt["norm"] == "も"
        and nxt["pos1"] == "助詞"
    )


def _conjunctive_demo(tokens, i):
    """Whether tokens[i] starts a sentence-initial でも — the conjunction "but".

    unidic splits でも into 格助詞 で + 係助詞 も wherever it stands, so at the
    head of a sentence both particle rules fire on a word that is neither a
    location nor an "also"."""
    if not _demo_pair(tokens, i):
        return False
    prev = _prev(tokens, i)
    return prev is None or prev["surface"][:1] in _SENTENCE_ENDS


def _rule_demo_suggestion(tokens, i):
    """The で of a でも suggestion. Fires on で + も only when the sentence goes
    on to make the offer — otherwise で + も is a location that also applies
    (公園でも遊びます), and nothing in the pair itself tells them apart."""
    if not _demo_pair(tokens, i) or _conjunctive_demo(tokens, i):
        return False
    tail = "".join(x["norm"] for x in tokens[i + 2 :])
    head = tail.split("。")[0]
    return any(word in head for word in _SUGGESTION_TAILS)


def _rule_n4_temo(tokens, i):
    """The て of a ても / でも concessive: 降っても, 高くても, 読んでも.

    ても is never one token — unidic splits it into 接続助詞 て + 係助詞 も, the
    same split that forced `demo-suggestion` into a two-token rule. Only the
    連用形-attaching で counts, so 日曜日でも (格助詞 で) stays a location that
    also applies rather than a concessive.
    """
    t, nxt = tokens[i], _next(tokens, i)
    return (
        t["norm"] in ("て", "で")
        and t["pos1"] == "助詞"
        and t["pos2"] == "接続助詞"
        and nxt is not None
        and nxt["norm"] == "も"
        and nxt["pos1"] == "助詞"
        and nxt["pos2"] == "係助詞"
    )


def _kara_particle(tokens, i):
    t = tokens[i]
    return t["norm"] == "から" and t["pos1"] == "助詞"


def _rule_kara_because(tokens, i):
    """から after a clause is a reason; から after a bare noun is a source."""
    return _kara_particle(tokens, i) and _is_adnominal(_prev(tokens, i))


def _rule_kara_from(tokens, i):
    return _kara_particle(tokens, i) and not _rule_kara_because(tokens, i)


POS_RULES = {
    "ta-form": _rule_ta_form,
    "nai-form": _rule_nai_form,
    "desu": _rule_desu,
    "no-possessive": _rule_no_possessive,
    "no-nominalizer": _rule_no_nominalizer,
    "ni-direction": _rule_ni_direction,
    "ni-indirect": _rule_ni_indirect,
    "adj-i-conjugation": _rule_adj_i_conjugation,
    "adj-i-adverb": _rule_adj_i_adverb,
    "adj-na-conjugation": _rule_adj_na_conjugation,
    "adj-na-adverb": _rule_adj_na_adverb,
    "toki": _rule_toki,
    "goro": _rule_goro,
    "aida": _rule_n4_aida,
    "kara-from": _rule_kara_from,
    "kara-because": _rule_kara_because,
    "mae-ni": _rule_mae_ni,
    "ni-iku": _rule_ni_iku,
    "demo-suggestion": _rule_demo_suggestion,
    "temo": _rule_n4_temo,
}

#: Rules describing the *word's own* form, not a pattern built on it. They run
#: even over characters a form match consumed, because 賑やかになりました is
#: `naru-become` and a な-adjective in adverbial form at the same time.
_UNSUPPRESSED = {
    "adj-i-conjugation",
    "adj-i-adverb",
    "adj-na-conjugation",
    "adj-na-adverb",
}

for _slug, (_surface, _pos1, _pos2set) in _PARTICLE_RULES.items():
    def _make(surface=_surface, pos1=_pos1, pos2set=_pos2set):
        def rule(tokens, i):
            t = tokens[i]
            return t["norm"] == surface and t["pos1"] == pos1 and t["pos2"] in pos2set
        return rule

    POS_RULES[_slug] = _make()
del _slug, _surface, _pos1, _pos2set

#: The two halves of a sentence-initial でも, subtracted from the generic
#: particle rules above — see `_conjunctive_demo`.
_de_location, _mo_also = POS_RULES["de-location"], POS_RULES["mo-also"]
POS_RULES["de-location"] = lambda tokens, i: (
    _de_location(tokens, i) and not _conjunctive_demo(tokens, i)
)
POS_RULES["mo-also"] = lambda tokens, i: (
    _mo_also(tokens, i) and not (i > 0 and _conjunctive_demo(tokens, i - 1))
)

#: The same subtraction for a ても concessive: its て is not the connective
#: te-form and its も is not "also", so neither generic rule may claim a half.
_te_form = POS_RULES["te-form"]
POS_RULES["te-form"] = lambda tokens, i: (
    _te_form(tokens, i) and not _rule_n4_temo(tokens, i)
)
_mo_also_2 = POS_RULES["mo-also"]
POS_RULES["mo-also"] = lambda tokens, i: (
    _mo_also_2(tokens, i) and not (i > 0 and _rule_n4_temo(tokens, i - 1))
)


# --------------------------------------------------------------------------
# Form tables
# --------------------------------------------------------------------------


def level_slugs(level):
    """Every grammar slug a passage at ladder `level` may legitimately use."""
    return [g["slug"] for g in context.grammar_through(level)]


def _forms_for(level):
    """(single-part table, multi-part table) for `level` and every level below.

    Single-part: {form: [slug, ...]} for the greedy scan.
    Multi-part:  [(slug, [part, ...])] for `A〜B` forms, checked per sentence.
    """
    single, multi = {}, []
    for item in context.grammar_through(level):
        slug = item["slug"]
        if slug in MANUAL_SLUGS:
            continue
        dropped = FORM_OVERRIDES.get(slug, set())
        for form in item.get("accepted_forms", []):
            if dropped == "*" or form in dropped:
                continue
            if "〜" in form:
                parts = [p for p in form.split("〜") if p]
                if len(parts) > 1:
                    multi.append((slug, parts))
                continue
            single.setdefault(form, []).append(slug)
    return single, multi


# --------------------------------------------------------------------------
# Detection
# --------------------------------------------------------------------------


#: Forms that legitimately begin inside a token, because the token owns their
#: first character: 広くなった is 広く + なる, and the く of くなる is the
#: adjective's. Every other form must start on a token boundary — without that,
#: たい matches inside 冷たい and ても eats the て of てもらいました.
_SUFFIX_FORMS = {
    "くなる", "くなりました", "くない", "くなかった", "える", "にくい", "やすい",
}


def _scan(haystack, boundaries, by_length):
    """Greedy longest-form-wins scan. Returns (form, start, end) triples in
    `haystack` coordinates; matched characters are consumed."""
    hits = []
    i = 0
    while i < len(haystack):
        hit = None
        for form in by_length:
            if i not in boundaries and form not in _SUFFIX_FORMS:
                continue
            if i + len(form) in boundaries and haystack.startswith(form, i):
                hit = form
                break
        if hit is None:
            i += 1
            continue
        hits.append((hit, i, i + len(hit)))
        i += len(hit)
    return hits


def detect(text, level):
    """Grammar points used in `text`.

    Returns `{"slugs": [...], "matches": [...], "manual": [...]}`. `matches`
    carries one entry per hit — slug, the form or rule that fired, its span in
    `text`, and `ambiguous` when the same surface belongs to several points.
    """
    tokens = _tokenize(text)
    norm = _normalised_text(text, tokens)
    dict_text, index_map, dict_boundaries = _dictionary_text(tokens)
    single, multi = _forms_for(level)
    boundaries = {t["end"] for t in tokens} | {0}
    by_length = sorted(single, key=len, reverse=True)

    matches = []
    #: character -> length of the pass-1 form that claimed it, so pass 1b can
    #: tell a genuinely longer pattern from one it has already beaten.
    consumed = {}

    # Pass 1 — surface forms: ました, てください, ではありません.
    for form, start, end in _scan(norm, boundaries, by_length):
        slugs = single[form]
        for slug in slugs:
            matches.append(
                {
                    "slug": slug,
                    "form": form,
                    "start": start,
                    "end": end,
                    "rule": "form",
                    "ambiguous": len(slugs) > 1,
                }
            )
        for pos in range(start, end):
            consumed[pos] = max(consumed.get(pos, 0), len(form))

    # Pass 1b — the same forms over dictionary-form text, which is the only
    # way an inflected pattern (食べてしまった, 上手になった) is seen at all.
    # Longest-form-wins still holds across the two: a dictionary hit is dropped
    # where pass 1 already claimed those characters for a form at least as
    # long, so the ます inside ています stays quiet — but ようにする still beats
    # the ように that pass 1 could see.
    seen = {(m["slug"], m["start"]) for m in matches}
    for form, start, end in _scan(dict_text, dict_boundaries, by_length):
        origin, origin_end = index_map[start], index_map[end - 1] + 1
        if all(
            consumed.get(pos, 0) >= len(form) for pos in range(origin, origin_end)
        ):
            continue
        for slug in single[form]:
            if (slug, origin) in seen:
                continue
            matches.append(
                {
                    "slug": slug,
                    "form": form,
                    "start": origin,
                    "end": origin_end,
                    "rule": "lemma",
                    "ambiguous": len(single[form]) > 1,
                }
            )

    # Pass 2 — POS rules, over tokens pass 1 left alone.
    in_scope = set(level_slugs(level))
    for idx, token in enumerate(tokens):
        taken = any(pos in consumed for pos in range(token["start"], token["end"]))
        for slug, rule in POS_RULES.items():
            if slug not in in_scope or slug in MANUAL_SLUGS:
                continue
            if taken and slug not in _UNSUPPRESSED:
                continue
            if rule(tokens, idx):
                matches.append(
                    {
                        "slug": slug,
                        "form": token["surface"],
                        "start": token["start"],
                        "end": token["end"],
                        "rule": "pos",
                        "ambiguous": False,
                    }
                )

    # Pass 3 — A〜B forms, both halves in one sentence, in order.
    for slug, parts in multi:
        if slug not in in_scope:
            continue
        for start, sentence in _sentences(norm):
            at = _ordered_parts(sentence, parts)
            if at is None:
                continue
            matches.append(
                {
                    "slug": slug,
                    "form": "〜".join(parts),
                    "start": start + at[0],
                    "end": start + at[1],
                    "rule": "sentence",
                    "ambiguous": False,
                }
            )
            break

    matches.sort(key=lambda m: (m["start"], m["slug"]))
    found = {m["slug"] for m in matches}
    manual = sorted(
        slug
        for slug in MANUAL_SLUGS & in_scope
        if any(form in norm for form in _manual_forms(slug))
    )
    return {"slugs": sorted(found), "matches": matches, "manual": manual}


def _manual_forms(slug):
    for item in context.load_grammar():
        if item["slug"] == slug:
            return item.get("accepted_forms", [])
    return []


def _sentences(text):
    out, start = [], 0
    for idx, ch in enumerate(text):
        if ch in _SENTENCE_ENDS:
            out.append((start, text[start : idx + 1]))
            start = idx + 1
    if start < len(text):
        out.append((start, text[start:]))
    return out


def _ordered_parts(sentence, parts):
    at = 0
    first = None
    for part in parts:
        found = sentence.find(part, at)
        if found < 0:
            return None
        if first is None:
            first = found
        at = found + len(part)
    return (first, at)


# --------------------------------------------------------------------------
# Calibration
# --------------------------------------------------------------------------


def calibrate(verbose=False):
    """Recall against the human-reviewed `grammar_slugs` of shipped passages.

    Those declarations are the only labelled set there is. The plan's pass
    condition is recall >= 95%; extra slugs the detector finds are declaration
    bugs in the passages, not detector faults, and are printed as such.
    """
    total_declared = total_hit = 0
    ok = True
    passages_by_level = {}
    for passage in context.load_items("readings"):
        passages_by_level.setdefault(passage["level"], []).append(passage)
    for level, passages in sorted(passages_by_level.items()):
        declared_n = hit_n = 0
        extras, misses = {}, {}
        for passage in passages:
            declared = set(passage.get("grammar_slugs", []))
            result = detect(passage["body"], level)
            found = set(result["slugs"])
            declared_n += len(declared)
            hit_n += len(declared & found)
            for slug in sorted(declared - found):
                misses.setdefault(slug, []).append(passage["title"])
            for slug in sorted(found - declared):
                extras.setdefault(slug, []).append(passage["title"])
            if verbose:
                print(f"  {passage['title']}")
                print(f"    declared: {' '.join(sorted(declared))}")
                print(f"    detected: {' '.join(sorted(found))}")
                if result["manual"]:
                    print(f"    manual:   {' '.join(result['manual'])}")

        recall = hit_n / declared_n if declared_n else 1.0
        total_declared += declared_n
        total_hit += hit_n
        mark = "PASS" if recall >= 0.95 else "FAIL"
        ok = ok and recall >= 0.95
        print(f"\nlevel {level}: recall {hit_n}/{declared_n} = {recall:.1%}  [{mark}]")
        if misses:
            print("  missed (recall loss):")
            for slug, titles in sorted(misses.items()):
                print(f"    {slug} — {len(titles)}x: {', '.join(titles)}")
        if extras:
            print("  found but never declared (declaration bugs to review):")
            for slug, titles in sorted(extras.items()):
                print(f"    {slug} — {len(titles)}x")

    overall = total_hit / total_declared if total_declared else 1.0
    print(f"\noverall: {total_hit}/{total_declared} = {overall:.1%}")
    return ok


#: (ladder level, text, must detect, must not detect). Level 20 is every N5
#: and N4 point. Calibration measures the
#: corpus; these pin the individual discriminations that were hard to get
#: right, so an edit that regresses one is caught without a corpus run. Same
#: role as `validate_readings.py --fixtures`, which is the nearest thing this
#: repo has to a Python test runner.
SELFTEST = [
    (20, "学校の近くに住んでいます。", ["te-iru"], ["masu"]),
    (20, "日本人ではありません。", ["dewa-arimasen"], ["desu"]),
    (20, "はじめて日本に来ました。", ["ni-direction"], ["wa-topic"]),
    (20, "冷たいお茶を飲みました。", ["adj-i-conjugation"], ["tai"]),
    (20, "先生に本を読んでもらいました。", ["moraru-ageru-kureru"], []),
    (20, "駅の前にあります。", ["ni-direction"], ["mae-ni"]),
    (20, "ご飯を食べる前に手を洗います。", ["mae-ni"], []),
    (20, "学校に行くとき、傘を持ちます。", ["toki"], []),
    (20, "時間がありません。", [], ["toki"]),
    (20, "学校から帰りました。", ["kara-from"], ["kara-because"]),
    (20, "寒いから帰りました。", ["kara-because"], ["kara-from"]),
    (20, "私の本です。", ["no-possessive"], ["no-nominalizer"]),
    (20, "食べるのが好きです。", ["no-nominalizer"], ["no-possessive"]),
    (20, "静かな部屋です。", ["adj-na-conjugation"], []),
    (20, "空は青かったです。", ["adj-i-conjugation"], ["adj-i-adverb"]),
    (20, "朝早く起きて、駅まで歩きました。", ["adj-i-adverb"], ["adj-i-conjugation"]),
    (20, "教室は賑やかになりました。", ["naru-become", "adj-na-adverb"], []),
    (20, "部屋が広くなったので、うれしいです。", ["naru-become", "adj-i-adverb"], []),
    (20, "明日、映画を見ますか。", ["ka-question"], []),
    (20, "何か食べましょう。", ["mashou"], ["ka-question"]),
    (20, "コーヒーでもどうですか。", ["demo-suggestion", "dou-desu-ka"], []),
    (20, "宿題をしました。でも、出しません。", [],
     ["de-location", "mo-also", "demo-suggestion"]),
    (20, "公園でも遊びます。", ["de-location", "mo-also"], []),
    (20, "ケーキを全部食べてしまった。", ["teshimau"], []),
    (20, "「いつから働けますか」と聞かれました。", ["passive", "potential"], []),
    (20, "毎朝走るようにしています。", ["youni-suru"], []),
    (20, "日本語が話せるようになりました。", ["youninaru"], []),
    (20, "時間があったら、電話します。", ["tara"], []),
    (20, "女の人に「郵便局はどちらですか。」と聞きました。", ["ni-indirect"], []),
    (20, "駅から近いです。", ["kara-from"], ["node-vs-kara"]),
    (20, "お金は千円しかありません。", ["shika-nai"], []),
    (20, "宿題はまだ終わっていません。", ["mada-teinai"], []),
    (20, "雨が降っても、公園に行きます。", ["temo"], ["te-form", "mo-also"]),
    (20, "高くても、買います。", ["temo"], ["te-form", "mo-also"]),
    (20, "日曜日でも働きます。", ["de-location", "mo-also"], ["temo"]),
    (20, "友達に手伝ってもらいました。", ["moraru-ageru-kureru"], ["temo"]),
    (20, "写真を撮ってもいいですか。", ["te-mo-ii"], ["temo"]),
]


def selftest():
    failures = 0
    for level, text, wanted, unwanted in SELFTEST:
        found = set(detect(text, level)["slugs"])
        missing = [s for s in wanted if s not in found]
        present = [s for s in unwanted if s in found]
        ok = not missing and not present
        print(f"{'ok  ' if ok else 'FAIL'} [{level}] {text}")
        if not ok:
            failures += 1
            if missing:
                print(f"       not detected: {' '.join(missing)}")
            if present:
                print(f"       wrongly detected: {' '.join(present)}")
            print(f"       got: {' '.join(sorted(found))}")
    print(f"\n{len(SELFTEST) - failures}/{len(SELFTEST)} discriminations hold")
    return failures == 0


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--calibrate", action="store_true")
    parser.add_argument("--selftest", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--level", type=int, default=MAX_LEVEL,
                        help="detect the grammar at or below this ladder level")
    parser.add_argument("--text", help="detect over one string and print matches")
    args = parser.parse_args(argv)

    if args.text:
        result = detect(args.text, args.level)
        for match in result["matches"]:
            flag = " (ambiguous)" if match["ambiguous"] else ""
            print(
                f"{match['start']:>3}-{match['end']:<3} {match['slug']:<28}"
                f" {match['form']} [{match['rule']}]{flag}"
            )
        if result["manual"]:
            print("manual:", " ".join(result["manual"]))
        return 0

    if args.selftest:
        return 0 if selftest() else 1

    if args.calibrate:
        return 0 if calibrate(verbose=args.verbose) else 1

    parser.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
