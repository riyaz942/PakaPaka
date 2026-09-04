# -*- coding: utf-8 -*-
"""Build the vocabulary word-type map `curriculum/_build/vocab_word_types.json`.

WaniKani names a word's part of speech next to its meaning — "い adjective",
"noun, の adjective", "ichidan verb, transitive verb" — and its meaning mnemonic
leans on it ("Words that end with い are often adjectives"). Our vocabulary
carries no such field: the hand-authored lists in `n5_vocab.py` / `n4_vocab.py`
are slug/form/reading/meaning, and the derived corpus is the same shape.

JMdict has it, so this distills it once and checks the result in, the way
`build_kanjidic_readings.py` distills KANJIDIC. `generate.py` inlines the labels
into the shipped vocabulary items, and `generate_content/mnemonic_context.py`
puts them in the mnemonic prompt.

Unlike the kanji reading map this one **is** keyed to the words we teach, not to
all of JMdict: the key is our slug, and a map of every JMdict headword would be
333,000 pairs and ~13 MB. The staleness that buys is visible rather than silent —
a word added after the last run has no word type at all, which the prompt says
out loud and the app renders as an absent row. Re-run it after
`build_vocab_skeleton.py` or a hand edit to the N5/N4 lists.

Three ways a word gets its type, in order:

  1. **JMdict `seq`** — the derived corpus records the entry it came from, so
     those 8,500 words match exactly.
  2. **(form, reading)** — the hand-authored N5/N4 words, matched against every
     headword/reading pair in JMdict.
  3. **`X する`** — 勉強する is not a JMdict headword; 勉強 is, tagged "takes the
     aux. verb suru". Strip the する, look the noun up, and the word is a する
     verb.

Anything still unmatched gets **no entry**, deliberately. The residue is the
compound forms the curriculum teaches as grammar — て-form auxiliaries
(教えてもらう), potential/passive/causative (書ける, 叱られる) and set phrases
(どうしましたか) — and the honest label for those is silence, not a guess that
puts "ichidan verb" under 書ける.

Source: JMdict (EDRDG, CC BY-SA 4.0; see repo-root NOTICE).
Run: `curriculum/_build/.venv/bin/python curriculum/_build/import/build_vocab_word_types.py`
"""

import json
import os
import sys

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CURRICULUM_DIR = os.path.dirname(BUILD_DIR)
IMPORT_DIR = os.path.dirname(os.path.abspath(__file__))
for path in (IMPORT_DIR, BUILD_DIR):
    if path not in sys.path:
        sys.path.insert(0, path)

import sources  # noqa: E402

#: JMdict part-of-speech text -> the label we teach. The parser expands JMdict's
#: entities to their descriptive text, so these are the long forms.
#:
#: Verb-class labels ("godan verb", "ichidan verb") are kept because that is the
#: fact a learner needs to conjugate the word, and transitivity is kept because
#: Japanese teaches transitive/intransitive pairs together. Everything narrower
#: than that — which godan ending, which special class — collapses: a learner
#: reading a mnemonic does not need "Godan verb with 'tsu' ending".
_POS_LABEL = {
    "adjective (keiyoushi)": "い adjective",
    "adjective (keiyoushi) - yoi/ii class": "い adjective",
    "adjectival nouns or quasi-adjectives (keiyodoshi)": "な adjective",
    "nouns which may take the genitive case particle 'no'": "の adjective",
    "pre-noun adjectival (rentaishi)": "adjectival",
    "noun (common) (futsuumeishi)": "noun",
    "noun, used as a suffix": "noun",
    "noun, used as a prefix": "noun",
    "noun or verb acting prenominally": "noun",
    "noun or participle which takes the aux. verb suru": "noun",
    "adverb (fukushi)": "adverb",
    "adverb taking the 'to' particle": "adverb",
    "pronoun": "pronoun",
    "expressions (phrases, clauses, etc.)": "expression",
    "interjection (kandoushi)": "interjection",
    "conjunction": "conjunction",
    "counter": "counter",
    "numeric": "numeral",
    "prefix": "prefix",
    "suffix": "suffix",
    "particle": "particle",
    "Ichidan verb": "ichidan verb",
    "Ichidan verb - kureru special class": "ichidan verb",
    "Ichidan verb - zuru verb (alternative form of -jiru verbs)": "ichidan verb",
    "Kuru verb - special class": "irregular verb",
    "suru verb - included": "する verb",
    "suru verb - special class": "する verb",
    "transitive verb": "transitive verb",
    "intransitive verb": "intransitive verb",
}

#: Every "Godan verb …" variant collapses to one label; there are 30-odd of them
#: and the ending is spelled out in the word itself.
_GODAN_PREFIX = "Godan verb"

#: The tag that makes a noun able to take する. `X する` is looked up as `X`, so
#: this is what proves the compound is real rather than a coincidence.
_SURU_NOUN_POS = "noun or participle which takes the aux. verb suru"

#: Display order, following WaniKani's own: the fact that changes how you *use*
#: the word leads, and the weaker claim trails — "adverb, noun" for ゆっくり,
#: "noun, の adjective" for 太字, never the reverse. Fixed order also makes the
#: artifact stable across runs.
_LABEL_ORDER = [
    "い adjective",
    "な adjective",
    "adjectival",
    "godan verb",
    "ichidan verb",
    "する verb",
    "irregular verb",
    "transitive verb",
    "intransitive verb",
    "pronoun",
    "adverb",
    "conjunction",
    "interjection",
    "counter",
    "numeral",
    "prefix",
    "suffix",
    "particle",
    "noun",
    # Trails "noun" because it is a note *about* the noun: 太字 is a noun that
    # may also modify with の, which is how WaniKani orders the pair.
    "の adjective",
    "expression",
]

#: Labels a `X する` compound must not inherit from its base noun. 勉強 is a
#: noun; 勉強する is not, and printing "する verb, noun" under it would teach the
#: learner that the compound can head a noun phrase.
_SURU_DROPPED = {"noun", "の adjective", "adjectival"}

#: Transitivity is a fact about a verb, and JMdict hangs it on する-nouns too:
#: 勉強 is tagged noun + takes-する + transitive, which describes 勉強する, not
#: 勉強. Without a conjugation class beside it the label reads as a claim that
#: the noun is a verb, so it is dropped unless one of these is present.
_VERB_CLASSES = {"godan verb", "ichidan verb", "する verb", "irregular verb"}
_TRANSITIVITY = {"transitive verb", "intransitive verb"}

#: A word type is only worth showing if it says something. "noun" alongside
#: "の adjective" is informative; "expression" alongside nothing is not, and
#: neither is a bare "noun" on 人口 — but WaniKani prints that one anyway, and
#: consistency beats cleverness here, so nothing is dropped for being obvious.
_LABEL_RANK = {label: i for i, label in enumerate(_LABEL_ORDER)}


def _labels(pos_list, is_suru_compound=False):
    """The teachable labels for one JMdict sense's part-of-speech tags."""
    out = set()
    for pos in pos_list:
        if pos.startswith(_GODAN_PREFIX):
            out.add("godan verb")
        elif pos in _POS_LABEL:
            out.add(_POS_LABEL[pos])
    if is_suru_compound:
        out -= _SURU_DROPPED
    if not out & _VERB_CLASSES:
        out -= _TRANSITIVITY
    # When a word is both a な adjective and a noun JMdict tags both, and both
    # are worth showing (WaniKani prints "な adjective, noun"). Nothing else is
    # suppressed, only ordered.
    return sorted(out, key=lambda label: _LABEL_RANK[label])


def _jmdict_indexes():
    """(by_seq, by_pair, suru_nouns) over JMdict's first sense of each entry.

    The first sense is the one the rest of the pipeline already teaches from:
    `build_vocab_skeleton.py` selects and glosses on `senses[0]`, so the word
    type has to describe that same sense or it would contradict the meaning
    shown on the card.
    """
    by_seq, by_pair, suru_nouns = {}, {}, set()
    for entry in sources.load_jmdict_entries():
        if not entry["senses"]:
            continue
        pos = entry["senses"][0]["pos"]
        by_seq[entry["seq"]] = pos
        kanji_forms = [k["form"] for k in entry["kanji"]]
        readings = [r["form"] for r in entry["readings"]]
        for reading in readings:
            # A kana-only word is its own written form, so it is keyed on
            # (reading, reading) as well — that is how `どれ` is looked up.
            for form in kanji_forms or [reading]:
                by_pair.setdefault((form, reading), pos)
            by_pair.setdefault((reading, reading), pos)
        if _SURU_NOUN_POS in pos:
            suru_nouns.update(kanji_forms)
            suru_nouns.update(readings)
    return by_seq, by_pair, suru_nouns


def _curriculum_words():
    """(slug, form, reading, seq) for every word the curriculum teaches.

    Read from the same three sources `generate.py` builds vocabulary from, not
    from the shipped JSON: the shipped files are this script's *downstream*, and
    reading them would make the artifact depend on its own output.
    """
    from n4_vocab import N4_VOCAB
    from n5_vocab import N5_VOCAB

    words = []
    for entries in (N5_VOCAB, N4_VOCAB):
        for v in entries:
            words.append((v["slug"], v["form"], v["reading"], None))
    skeleton_path = os.path.join(BUILD_DIR, "vocab_skeleton.json")
    with open(skeleton_path, encoding="utf-8") as f:
        for w in json.load(f)["words"]:
            words.append((w["slug"], w["form"], w["reading"], w.get("seq")))
    return words


def main():
    by_seq, by_pair, suru_nouns = _jmdict_indexes()
    out = {}
    matched = {"seq": 0, "pair": 0, "suru": 0}
    unmatched = []

    for slug, form, reading, seq in _curriculum_words():
        pos, how = None, None
        if seq is not None and seq in by_seq:
            pos, how = by_seq[seq], "seq"
        elif (form, reading) in by_pair:
            pos, how = by_pair[(form, reading)], "pair"
        elif form.endswith("する") and form[:-2] in suru_nouns:
            # 勉強する: the noun carries the tags, the compound is the する verb.
            pos = by_pair.get((form[:-2], reading[:-2]), []) + ["suru verb - included"]
            how = "suru"
        if pos is None:
            unmatched.append(slug)
            continue
        labels = _labels(pos, is_suru_compound=how == "suru")
        if not labels:
            unmatched.append(slug)
            continue
        out[slug] = labels
        matched[how] += 1

    path = os.path.join(BUILD_DIR, "vocab_word_types.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, sort_keys=True, indent=0)
        f.write("\n")

    total = len(out) + len(unmatched)
    print(
        f"Wrote {os.path.relpath(path, CURRICULUM_DIR)}: {len(out)} of {total} words "
        f"({matched['seq']} by seq, {matched['pair']} by form+reading, "
        f"{matched['suru']} as する verbs), {os.path.getsize(path) // 1024} KB."
    )
    print(
        f"{len(unmatched)} word(s) carry no word type — compound and derived forms "
        "the curriculum teaches as grammar. They ship without the field."
    )


if __name__ == "__main__":
    main()
