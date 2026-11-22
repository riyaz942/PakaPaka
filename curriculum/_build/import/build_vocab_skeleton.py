# -*- coding: utf-8 -*-
"""Build the derived N3/N2/N1 vocabulary corpus (plan v2 Phase D).

The curriculum ships ~10,000 words. 1,247 are hand-authored in `n5_vocab.py` /
`n4_vocab.py`; the 8,500 behind them are derived here from JMdict and written to
`curriculum/_build/vocab_skeleton.json`, which `generate.py` reads.

Skeleton, not content: slug, form, reading, meaning, accepted answers. No
mnemonics and no example sentences — a mnemonic is owed when a learner *reaches*
an item, never because it exists.

**Selection is by frequency alone.** Not by which kanji are in band: constraining
words to in-band kanji would reinstate the coverage gate plan v2 removes. A word
whose kanji are untaught is still taught — asked for its meaning, shown with
furigana, until every kanji in it reaches guru.

The frequency signal is JMdict's `nfXX` priority tag: rank buckets of 500 words
from the Mainichi Shimbun corpus, nf01 the most frequent. 22,433 entries carry
one, so the 8,500 taken here run to about nf18.

**Levels are the split, in frequency order:** 2,250 N3, 2,250 N2, 4,000 N1, the
"added" column of the plan's ladder. Fixed counts, so Phase E's N5/N4 top-up
does not renumber the skeleton.

Unlike the kanji skeleton, the level *is* assigned here. A kanji's level is a
band ranked by reuse across a level's words, which mixes every source dataset
and so belongs in `reports/kanji_bands.py`; a word's level is its own frequency
rank and nothing else.

Sources (EDRDG, CC BY-SA 4.0; see repo-root NOTICE):
  - JMdict          — headwords, readings, glosses, priority tags
  - JmdictFurigana  — the reading-to-kanji alignment every entry must have

The output is checked in, so a rebuild never needs the source archives. Re-run
after the shipped N5/N4 vocabulary changes:

    python3 curriculum/_build/import/build_vocab_skeleton.py
"""

import json
import os
import re
import sys
from collections import Counter

IMPORT_DIR = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR = os.path.dirname(IMPORT_DIR)
CURRICULUM_DIR = os.path.dirname(BUILD_DIR)

sys.path.insert(0, IMPORT_DIR)
sys.path.insert(0, BUILD_DIR)

import furigana as furigana_lib  # noqa: E402
import sources  # noqa: E402


#: The skeleton levels and their word counts — the "vocabulary added" column of
#: the plan's ladder, less the two levels above.
LEVEL_SIZES = [("n3", 2250), ("n2", 2250), ("n1", 4000)]

#: Slug prefix for every derived word, as `k-` is for derived kanji. It names
#: the dataset that wrote the entry, never a level, and it keeps a derived word
#: from colliding with a hand-authored slug.
SLUG_PREFIX = "v"

#: Sense tags that mean "a reader will not meet this word", and name tags, which
#: JMdict carries for the handful of proper nouns it keeps alongside JMnedict.
#: Judged on the *first* sense only: JMdict orders senses by prominence, so an
#: archaic sense further down does not make the word archaic.
EXCLUDED_MISC = {
    "archaic",
    "obsolete term",
    "obscure term",
    "rare term",
    "historical term",
    "company name",
    "organization name",
    "place name",
    "product name",
    "family or surname",
    "given name or forename, gender not specified",
    "full name of a particular person",
    "work of art, literature, music, etc. name",
    "station name",
    "unclassified name",
}

#: A word JMdict marks "usually kana" is taught in kana: 綺麗 is written きれい
#: in everything a learner will read, and teaching the kanji form would ask for
#: a reading nobody writes.
KANA_ONLY_MISC = "word usually written using kana alone"

#: Headword tags that disqualify a spelling or a reading from being the one
#: taught. Not every tag does: "ateji (phonetic) reading" is how 時計, 試合 and
#: 支払う are all written, and rejecting it dropped them to their bare kana. What
#: is rejected is a spelling nobody uses (search-only, rarely used, out-dated,
#: irregular) — for a reading, likewise, except that a jukujikun reading is kept,
#: since 明日 -> あす is the reading the word has.
REJECTED_KANJI_INF = {
    "search-only kanji form",
    "rarely used kanji form",
    "irregular okurigana usage",
    "word containing irregular kanji usage",
    "word containing out-dated kanji or kanji usage",
    "word containing irregular kana usage",
}
REJECTED_READING_INF = {
    "search-only kana form",
    "rarely used kana form",
    "out-dated or obsolete kana usage",
    "word containing irregular kana usage",
}

#: JMdict lists the digit spelling of a numeral as a headword of its own (４０
#: alongside 四十, １月 alongside 一月), and it sorts first. A card that asks for
#: the reading of "４０" teaches nothing, so a digit-bearing spelling is passed
#: over for the next one.
_DIGITS_RE = re.compile(r"[0-9０-９]")

#: Parts of speech the curriculum teaches elsewhere: a particle or an auxiliary
#: is a grammar point, not a vocabulary card, and a bare affix or counter is
#: taught with the word it attaches to.
#:
#: `numeric` is here for the same reason: 四十 is 四 and 十, and JMdict spells the
#: common ones ４０ anyway.
#:
#: A word is dropped only when *every* part of speech on its first sense is one
#: of these. "noun, used as a suffix" is an ordinary noun that also suffixes
#: (中, 屋), and JMdict tags it alongside `noun`, so a substring match here would
#: quietly delete a thousand teachable words.
EXCLUDED_POS = {
    "particle",
    "auxiliary",
    "auxiliary verb",
    "auxiliary adjective",
    "copula",
    "prefix",
    "suffix",
    "counter",
    "numeric",
}

#: Glosses past the first are extra accepted answers, on the same terms as the
#: kanji skeleton's: a plain short synonym, never a parenthetical note.
_MAX_EXTRA_MEANING_LEN = 24
_MAX_EXTRA_MEANINGS = 2

#: Glosses shown as the item's meaning. Three is enough to disambiguate a word
#: without turning the review prompt into a dictionary entry.
_MAX_MEANING_GLOSSES = 3

_ROMAJI = {
    "きゃ": "kya", "きゅ": "kyu", "きょ": "kyo", "しゃ": "sha", "しゅ": "shu",
    "しょ": "sho", "ちゃ": "cha", "ちゅ": "chu", "ちょ": "cho", "にゃ": "nya",
    "にゅ": "nyu", "にょ": "nyo", "ひゃ": "hya", "ひゅ": "hyu", "ひょ": "hyo",
    "みゃ": "mya", "みゅ": "myu", "みょ": "myo", "りゃ": "rya", "りゅ": "ryu",
    "りょ": "ryo", "ぎゃ": "gya", "ぎゅ": "gyu", "ぎょ": "gyo", "じゃ": "ja",
    "じゅ": "ju", "じょ": "jo", "ぢゃ": "ja", "ぢゅ": "ju", "ぢょ": "jo",
    "びゃ": "bya", "びゅ": "byu", "びょ": "byo", "ぴゃ": "pya", "ぴゅ": "pyu",
    "ぴょ": "pyo", "ふぁ": "fa", "ふぃ": "fi", "ふぇ": "fe", "ふぉ": "fo",
    "うぃ": "wi", "うぇ": "we", "てぃ": "ti", "でぃ": "di", "とぅ": "tu",
    "どぅ": "du", "しぇ": "she", "じぇ": "je", "ちぇ": "che", "つぁ": "tsa",
    "つぃ": "tsi", "つぇ": "tse", "つぉ": "tso", "ゔぁ": "va", "ゔぃ": "vi",
    "ゔぇ": "ve", "ゔぉ": "vo",
    "あ": "a", "い": "i", "う": "u", "え": "e", "お": "o",
    "か": "ka", "き": "ki", "く": "ku", "け": "ke", "こ": "ko",
    "さ": "sa", "し": "shi", "す": "su", "せ": "se", "そ": "so",
    "た": "ta", "ち": "chi", "つ": "tsu", "て": "te", "と": "to",
    "な": "na", "に": "ni", "ぬ": "nu", "ね": "ne", "の": "no",
    "は": "ha", "ひ": "hi", "ふ": "fu", "へ": "he", "ほ": "ho",
    "ま": "ma", "み": "mi", "む": "mu", "め": "me", "も": "mo",
    "や": "ya", "ゆ": "yu", "よ": "yo",
    "ら": "ra", "り": "ri", "る": "ru", "れ": "re", "ろ": "ro",
    "わ": "wa", "ゐ": "wi", "ゑ": "we", "を": "wo", "ん": "n",
    "が": "ga", "ぎ": "gi", "ぐ": "gu", "げ": "ge", "ご": "go",
    "ざ": "za", "じ": "ji", "ず": "zu", "ぜ": "ze", "ぞ": "zo",
    "だ": "da", "ぢ": "ji", "づ": "zu", "で": "de", "ど": "do",
    "ば": "ba", "び": "bi", "ぶ": "bu", "べ": "be", "ぼ": "bo",
    "ぱ": "pa", "ぴ": "pi", "ぷ": "pu", "ぺ": "pe", "ぽ": "po",
    "ゔ": "vu",
    "ぁ": "a", "ぃ": "i", "ぅ": "u", "ぇ": "e", "ぉ": "o",
    "ゃ": "ya", "ゅ": "yu", "ょ": "yo", "ゕ": "ka", "ゖ": "ke", "ゎ": "wa",
}


def romaji(reading):
    """Hepburn-ish romaji for a kana reading, for the slug.

    The shipped N5/N4 slugs are romaji readings (`watashi`, `tomodachi`), so the
    derived ones are too. Not a transliteration anybody reads — it is an ASCII
    identity for a word, and it only has to be stable and legible."""
    kana = sources.katakana_to_hiragana(reading)
    out = []
    i = 0
    while i < len(kana):
        pair = kana[i:i + 2]
        if pair in _ROMAJI:
            out.append(_ROMAJI[pair])
            i += 2
            continue
        ch = kana[i]
        if ch == "っ":
            # Small tsu doubles the consonant that follows it (きって -> kitte).
            nxt = _ROMAJI.get(kana[i + 1:i + 3]) or _ROMAJI.get(kana[i + 1:i + 2], "")
            out.append(nxt[0] if nxt else "")
        elif ch == "ー":
            # Long-vowel mark: repeat the vowel it lengthens (コーヒー -> koohii).
            tail = "".join(out)
            out.append(tail[-1] if tail and tail[-1] in "aiueo" else "")
        else:
            out.append(_ROMAJI.get(ch, ""))
        i += 1
    return re.sub(r"[^a-z]+", "", "".join(out))


def authored_vocab():
    """The hand-authored words (`n5_vocab.py`, `n4_vocab.py`). They are excluded
    from the corpus: a word is taught once, by whoever wrote it first."""
    from n4_vocab import N4_VOCAB
    from n5_vocab import N5_VOCAB

    return list(N5_VOCAB) + list(N4_VOCAB)


def corpus_chars():
    """Every kanji the ladder teaches — the 2,000 `build_skeleton.py` selects.

    A word written with a kanji outside it could never satisfy plan v2's
    promise: its reading card would go live at the end of N1 having never
    taught 琵 or 椿. Dropping the word is the honest half of the trade, and at
    0.5% of the corpus the next word down the frequency list replaces it."""
    from n4_kanji import N4_KANJI
    from n5_kanji import N5_KANJI

    with open(os.path.join(BUILD_DIR, "skeleton.json"), encoding="utf-8") as f:
        skeleton = json.load(f)["kanji"]
    return ({k["char"] for k in N5_KANJI} | {k["char"] for k in N4_KANJI}
            | {k["char"] for k in skeleton})


def authored_forms():
    """Every written form the hand-authored levels already teach."""
    return {v["form"] for v in authored_vocab()}


def is_kanji_char(ch):
    return "一" <= ch <= "鿿"


def frequency_rank(entry):
    """The best `nfXX` bucket on any of the entry's headwords, or None.

    JMdict hangs priority tags off the individual keb/reb, so a word that is
    common in one spelling and rare in another is ranked on the common one."""
    ranks = [
        int(tag[2:])
        for group in ("kanji", "readings")
        for headword in entry[group]
        for tag in headword["pri"]
        if tag.startswith("nf")
    ]
    return min(ranks) if ranks else None


def headword(entry):
    """(form, reading) the curriculum should teach this entry as, or None.

    The written form is the first kanji headword whose JMdict tags do not
    disqualify it (see REJECTED_KANJI_INF). A "usually kana" entry, or one with
    no kanji headword left, is taught in kana."""
    sense = entry["senses"][0]
    kanji_forms = [
        k for k in entry["kanji"]
        if not (set(k["inf"]) & REJECTED_KANJI_INF)
        and not _DIGITS_RE.search(k["form"])
    ]
    readings = [
        r for r in entry["readings"] if not (set(r["inf"]) & REJECTED_READING_INF)
    ]
    if not readings:
        return None
    if KANA_ONLY_MISC in sense["misc"] or not kanji_forms:
        form = readings[0]["form"]
        return form, form
    form = kanji_forms[0]["form"]
    # A reading may be restricted to some spellings only (JMdict re_restr); the
    # one taught has to be a reading of the spelling taught.
    reading = next(
        (r["form"] for r in readings if not r["restr"] or form in r["restr"]), None
    )
    return (form, reading) if reading else None


def select_words(entries, shipped, taught_kanji):
    """The frequency-ranked corpus, most frequent first.

    Four filters, each of which drops a word that cannot be taught rather than
    one that is merely awkward:
      - no `nfXX` tag, so no frequency to rank on;
      - a first sense that is archaic, rare or a proper noun;
      - a first sense that is nothing but a particle, auxiliary or affix;
      - no JmdictFurigana alignment for (form, reading), so the word cannot be
        shown with furigana — and under plan v2 furigana is what lets an
        out-of-band kanji be displayed at all;
      - a kanji the ladder never teaches (see `corpus_chars`).
    """
    seen = set(shipped)
    dropped = Counter()
    selected = []
    for entry in sorted(entries, key=lambda e: (frequency_rank(e) or 99, e["seq"])):
        rank = frequency_rank(entry)
        if rank is None:
            continue
        sense = entry["senses"][0]
        if any(m in EXCLUDED_MISC for m in sense["misc"]):
            dropped["excluded sense"] += 1
            continue
        if sense["pos"] and all(p in EXCLUDED_POS for p in sense["pos"]):
            dropped["taught as grammar"] += 1
            continue
        if not sense["glosses"]:
            dropped["no English gloss"] += 1
            continue
        pair = headword(entry)
        if pair is None:
            dropped["no teachable headword"] += 1
            continue
        form, reading = pair
        if form in seen:
            dropped["already taught"] += 1
            continue
        if any(is_kanji_char(ch) for ch in form) and not furigana_lib.has_alignment(
            form, reading
        ):
            dropped["no furigana alignment"] += 1
            continue
        if any(is_kanji_char(ch) and ch not in taught_kanji for ch in form):
            dropped["kanji off the ladder"] += 1
            continue
        seen.add(form)
        selected.append({
            "form": form,
            "reading": reading,
            "meaning": " / ".join(sense["glosses"][:_MAX_MEANING_GLOSSES]),
            "extra_meanings": [
                g
                for g in sense["glosses"][_MAX_MEANING_GLOSSES:]
                if len(g) <= _MAX_EXTRA_MEANING_LEN and "(" not in g
            ][:_MAX_EXTRA_MEANINGS],
            "freq": rank,
            "seq": entry["seq"],
        })
    return selected, dropped


def load_previous_slugs():
    """{form: slug} from the checked-in vocab_skeleton.json.

    A slug is an identity — `user.db` rows and any mnemonic sidecar are keyed by
    it — so a word that already has one keeps it, and only new entries mint
    one."""
    path = os.path.join(BUILD_DIR, "vocab_skeleton.json")
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as f:
        return {w["form"]: w["slug"] for w in json.load(f)["words"]}


def assign_slugs(words, taken):
    """`v-<romaji reading>`, disambiguated by a counter.

    Homophones are ordinary in Japanese (公園 and 講演 are both こうえん), so a
    reading is not unique on its own; the numeric tail is minted in frequency
    order, which is the order this list is built in."""
    previous = load_previous_slugs()
    taken = set(taken) | set(previous.values())
    counts = Counter()
    for word in words:
        slug = previous.get(word["form"])
        if not slug:
            stem = romaji(word["reading"])
            if not stem:
                raise SystemExit(
                    f"no romaji for reading {word['reading']!r} ({word['form']}); "
                    "add the kana to _ROMAJI"
                )
            slug = f"{SLUG_PREFIX}-{stem}"
            while slug in taken:
                counts[stem] += 1
                slug = f"{SLUG_PREFIX}-{stem}-{counts[stem] + 1}"
        taken.add(slug)
        word["slug"] = slug


def assign_levels(words):
    """The frequency-ordered list cut into the three skeleton levels."""
    start = 0
    for level, size in LEVEL_SIZES:
        for word in words[start:start + size]:
            word["level"] = level
        start += size
    return words[:start]


def main():
    print("Loading JMdict and JmdictFurigana…")
    entries = sources.load_jmdict_entries()

    shipped = authored_forms()
    authored_slugs = {v["slug"] for v in authored_vocab()}

    selected, dropped = select_words(entries, shipped, corpus_chars())
    wanted = sum(size for _level, size in LEVEL_SIZES)
    if len(selected) < wanted:
        raise SystemExit(
            f"only {len(selected)} words pass selection but the ladder wants {wanted}; "
            "loosen a filter or shrink LEVEL_SIZES."
        )
    words = assign_levels(selected)
    assign_slugs(words, authored_slugs)

    out = {
        "_generated_by": "curriculum/_build/import/build_vocab_skeleton.py",
        "level_sizes": dict(LEVEL_SIZES),
        "words": [
            {
                "slug": w["slug"],
                "level": w["level"],
                "form": w["form"],
                "reading": w["reading"],
                "meaning": w["meaning"],
                "extra_meanings": w["extra_meanings"],
                "freq": w["freq"],
                "seq": w["seq"],
            }
            for w in words
        ],
    }
    path = os.path.join(BUILD_DIR, "vocab_skeleton.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2, sort_keys=False)
        f.write("\n")

    counts = Counter(w["level"] for w in words)
    print(f"Wrote {os.path.relpath(path, CURRICULUM_DIR)}: {len(words)} words "
          + ", ".join(f"{lvl.upper()} {counts[lvl]}" for lvl, _s in LEVEL_SIZES)
          + f"; frequency buckets nf{words[0]['freq']:02d}–nf{words[-1]['freq']:02d}.")
    print("  dropped: " + ", ".join(f"{k} {v}" for k, v in dropped.most_common()))


if __name__ == "__main__":
    main()
