# -*- coding: utf-8 -*-
"""Tokenizer level-check for generated Japanese (Phase 2 validation gate #2).

Uses the same fugashi/unidic tagger as furigana.py (one tokenizer, not two —
docs/content/content-pipeline-plan.md Phase 1). A sentence passes when every *content*
token resolves to an allowed vocabulary item or to the exception policy below.

## Exception policy (decided up front, not per-failure)

* **Function words by POS** — particles (助詞), auxiliaries (助動詞), prefixes/
  suffixes, conjunctions, interjections, symbols, punctuation, and pronouns/
  demonstratives (代名詞, 連体詞) are grammatical machinery, not vocabulary.
* **Numbers** (数詞) and **proper nouns** (固有名詞 — the escape hatch for
  people/place names in scenarios) always pass.
* **FUNCTION_WORD_ALLOWLIST** — lexical items that tag as content words but are
  pattern machinery (する, いる, こと, ほう, …).
* **COLLOQUIAL_BASE** — casual contractions mapped to the neutral form they
  contract from (わかんない → わかる). unidic won't lemmatize these cleanly, and
  the plan explicitly wants natural casual examples; a token whose surface (or
  base) appears here passes, since every mapping target is either grammatical
  machinery or checked against the allowed set.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import furigana as furigana_lib  # noqa: E402

#: pos1 values that make a token a "content word" subject to the vocab check.
CONTENT_POS = {"名詞", "動詞", "形容詞", "形状詞", "副詞"}

#: pos2 values (within 名詞) that always pass.
EXEMPT_NOUN_SUBTYPES = {"数詞", "固有名詞"}

#: Lexical allowlist — content-tagged tokens that are pattern machinery.
#: Keyed by any of: surface, orthBase (dictionary form, written script), lemma.
FUNCTION_WORD_ALLOWLIST = {
    # light verbs / existence / auxiliaries that tag as 動詞
    "する", "為る", "いる", "居る", "ある", "有る", "なる", "成る",
    "くださる", "下さる", "ください", "下さい", "いたす", "致す",
    "いただく", "頂く", "もらう", "貰う", "あげる", "上げる", "くれる", "呉れる",
    # formal nouns that carry grammar patterns
    "こと", "事", "もの", "物", "とき", "時", "ほう", "方", "ところ", "所",
    "ため", "為", "つもり", "はず", "筈", "よう", "様", "ん", "の", "うち", "内",
    "まま", "儘",
    # everyday grammatical adverbs
    "とても", "少し", "ちょっと", "もう", "まだ", "よく", "たくさん", "沢山",
    "こう", "そう", "ああ", "どう",
    # machinery of taught patterns that is not itself a vocabulary entry:
    # しれる only ever surfaces inside かもしれない (an N5 grammar point), and
    # ごろ is the time approximator ("十一時ごろ"), the noun-side twin of ぐらい,
    # which passes already as a particle. Both are absent from N5 *and* N4
    # vocabulary, so without these the gate rejects the patterns we teach.
    "しれる", "知れる", "ごろ", "頃",
    # bare evaluatives/negation that surface inside patterns (てもいい, ない形)
    "いい", "良い", "よい", "ない", "無い",
    # name suffixes
    "さん", "ちゃん", "くん", "君", "さま",
}

#: Casual contraction → the neutral form it contracts from. Presence in this
#: map is sufficient to pass (targets are machinery or independently taught).
COLLOQUIAL_BASE = {
    "わかんない": "わかる",
    "わかん": "わかる",
    "じゃ": "では",
    "じゃあ": "では",
    "ちゃ": "ては",
    "ちゃう": "てしまう",
    "じゃう": "でしまう",
    "なきゃ": "なければ",
    "なくちゃ": "なくては",
    "てる": "ている",
    "でる": "でいる",
    "とく": "ておく",
    "どく": "でおく",
    "って": "という",
}


def _feature(token, name):
    value = getattr(token.feature, name, None)
    return None if value in (None, "*", "") else value


def build_allowed_index(allowed_vocab):
    """Match keys for the allowed vocabulary: written form, kana reading, the
    noun stem of する-verbs (勉強する → 勉強), and — because the checker works
    token by token — each content token of multi-token forms as segmented by
    the same tagger (一緒に → 一緒, お金 → 金, 朝ご飯 → ご飯). Without the
    decomposition, an item's own linked vocab can fail its own check (pilot
    run 1: 一緒に is masen-ka's linked vocab, but the tagger emits 一緒)."""
    tagger = furigana_lib.get_tagger()
    index = set()
    for v in allowed_vocab:
        form = v["primary_form"]
        index.add(form)
        for answer in v.get("accepted_answers", []):
            if answer.get("answer_type") == "reading":
                index.add(answer["answer_text"])
        if form.endswith("する") and len(form) > 2:
            index.add(form[:-2])
        for token in tagger(form):
            if _feature(token, "pos1") in CONTENT_POS:
                index.add(token.surface)
                orth_base = _feature(token, "orthBase")
                if orth_base:
                    index.add(orth_base)
    return index


def pattern_words(grammar_items):
    """The content-tagged tokens inside a grammar point's own `accepted_forms`.

    A pattern's machinery is not vocabulary: 限り, 以来, 反面, わけ, 対する
    appear in no level's word list, so a passage that uses a point it was
    taught fails this check on the point itself. `FUNCTION_WORD_ALLOWLIST`
    covers the same problem globally for しれる and ごろ; this derives it per
    caller instead, so the words are accepted exactly where the grammar that
    carries them is allowed (see `reading_context.seed_context`).
    """
    tagger = furigana_lib.get_tagger()
    words = set()
    for item in grammar_items:
        for form in item.get("accepted_forms", []):
            for token in tagger(form.replace("〜", "")):
                if _feature(token, "pos1") not in CONTENT_POS:
                    continue
                words.add(token.surface)
                orth_base = _feature(token, "orthBase")
                if orth_base:
                    words.add(orth_base)
    return words


def _kanji_stem(surface):
    stem = ""
    for ch in surface:
        if furigana_lib.is_kanji(ch):
            stem += ch
        else:
            break
    return stem


def find_violations(text, allowed_index, extra_allowed=()):
    """Out-of-level content words in `text`, as "surface (dictionary form)"
    strings. `extra_allowed` holds per-item exceptions (the grammar point's
    accepted_forms, sibling primary_forms quoted in contrast sections)."""
    tagger = furigana_lib.get_tagger()
    extra = set(extra_allowed)
    violations = []
    for token in tagger(text):
        pos1 = _feature(token, "pos1")
        if pos1 not in CONTENT_POS:
            continue
        pos2 = _feature(token, "pos2")
        if pos1 == "名詞" and pos2 in EXEMPT_NOUN_SUBTYPES:
            continue

        surface = token.surface
        orth_base = _feature(token, "orthBase")
        lemma = _feature(token, "lemma")
        kana_bases = [
            furigana_lib.katakana_to_hiragana(k)
            for k in (_feature(token, "pronBase"), _feature(token, "lForm"))
            if k
        ]
        candidates = {surface, orth_base, lemma, *kana_bases} - {None}

        if candidates & allowed_index:
            continue
        if candidates & FUNCTION_WORD_ALLOWLIST:
            continue
        if candidates & set(COLLOQUIAL_BASE):
            continue
        if candidates & extra or any(surface in form for form in extra):
            continue
        # Kanji-stem fallback for verbs/adjectives: conjugated surfaces can
        # lemmatize to a homograph (行って → 行う instead of 行く) and lessons
        # legitimately display near-miss/wrong conjugations when teaching
        # them. If an allowed form starts with the token's kanji stem, treat
        # the token as in-level.
        if pos1 in ("動詞", "形容詞"):
            stem = _kanji_stem(surface)
            if stem and any(entry.startswith(stem) for entry in allowed_index):
                continue
        violations.append(f"{surface} ({orth_base or lemma or surface})")
    return violations
