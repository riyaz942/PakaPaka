# -*- coding: utf-8 -*-
"""Parsers for the open-licensed source datasets fetched by fetch_sources.sh.

All parsers read from curriculum/_build/data/ and return plain dicts, so the
audit and (later) merge tooling never touch raw XML/EUC-JP themselves.
Sources and licenses (see repo-root NOTICE):
  - KANJIDIC2, JMdict, KRADFILE — EDRDG, CC BY-SA 4.0
"""

import gzip
import os
import xml.etree.ElementTree as ET

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")


def _data_path(name):
    path = os.path.join(DATA_DIR, name)
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"{path} not found — run curriculum/_build/import/fetch_sources.sh first"
        )
    return path


def katakana_to_hiragana(s):
    return "".join(
        chr(ord(ch) - 0x60) if "ァ" <= ch <= "ヶ" else ch for ch in s
    )


def load_kanjidic2():
    """Returns {literal: {meanings, onyomi, kunyomi, jlpt, grade, freq,
    stroke_count}}.

    onyomi is converted to hiragana; kunyomi keeps KANJIDIC2's '.' okurigana
    separator and '-' prefix/suffix markers so callers can match either way.
    """
    kanji = {}
    with gzip.open(_data_path("kanjidic2.xml.gz"), "rb") as f:
        for _event, elem in ET.iterparse(f, events=("end",)):
            if elem.tag != "character":
                continue
            literal = elem.findtext("literal")
            misc = elem.find("misc")
            entry = {
                "meanings": [
                    m.text
                    for m in elem.iter("meaning")
                    if not m.attrib.get("m_lang")  # English only
                ],
                "onyomi": [
                    katakana_to_hiragana(r.text)
                    for r in elem.iter("reading")
                    if r.attrib.get("r_type") == "ja_on"
                ],
                "kunyomi": [
                    r.text for r in elem.iter("reading") if r.attrib.get("r_type") == "ja_kun"
                ],
                "jlpt": misc.findtext("jlpt") if misc is not None else None,
                "grade": misc.findtext("grade") if misc is not None else None,
                "freq": misc.findtext("freq") if misc is not None else None,
                "stroke_count": misc.findtext("stroke_count") if misc is not None else None,
            }
            kanji[literal] = entry
            elem.clear()
    return kanji


def load_kradfile():
    """Returns {kanji_char: [component_char, ...]} from KRADFILE (EUC-JP)."""
    decomposition = {}
    with gzip.open(_data_path("kradfile.gz"), "rt", encoding="euc-jp") as f:
        for line in f:
            if line.startswith("#") or " : " not in line:
                continue
            char, comps = line.rstrip("\n").split(" : ", 1)
            decomposition[char] = comps.split()
    return decomposition


def load_jmdict_entries():
    """Returns [entry, ...] in JMdict order, keeping the element structure.

    `load_jmdict` below flattens an entry into one bag of kebs, rebs and
    glosses, which is all the audits need. Frequency-ranked selection
    (import/build_vocab_skeleton.py) needs the structure instead: the priority
    tags belong to a *particular* headword, a reading may be restricted to some
    of them, and "usually kana" is a sense-level tag.

    Each entry is {seq, kanji, readings, senses}:
      seq      JMdict's ent_seq, a stable id across releases
      kanji    [{form, pri, inf}]   — pri is ke_pri (ichi1, news1, nf12, …)
      readings [{form, pri, restr}] — restr is the kebs the reading applies to
      senses   [{glosses, pos, misc}]

    XML entities are expanded to their descriptive text by the parser, so a
    tag reads "word usually written using kana alone" rather than "uk".
    """
    entries = []
    with gzip.open(_data_path("JMdict_e.gz"), "rb") as f:
        for _event, elem in ET.iterparse(f, events=("end",)):
            if elem.tag != "entry":
                continue
            entries.append({
                "seq": int(elem.findtext("ent_seq")),
                "kanji": [
                    {
                        "form": k.findtext("keb"),
                        "pri": [p.text for p in k.iter("ke_pri")],
                        "inf": [i.text for i in k.iter("ke_inf")],
                    }
                    for k in elem.iter("k_ele")
                ],
                "readings": [
                    {
                        "form": r.findtext("reb"),
                        "pri": [p.text for p in r.iter("re_pri")],
                        "restr": [x.text for x in r.iter("re_restr")],
                        "inf": [i.text for i in r.iter("re_inf")],
                    }
                    for r in elem.iter("r_ele")
                ],
                "senses": [
                    {
                        "glosses": [
                            g.text for g in s.iter("gloss")
                            if g.text and not g.attrib.get("g_type")
                        ],
                        "pos": [p.text for p in s.iter("pos")],
                        "misc": [m.text for m in s.iter("misc")],
                    }
                    for s in elem.iter("sense")
                ],
            })
            elem.clear()
    return entries


def load_jmdict():
    """Returns {written_form: [entry, ...]} where entry is
    {kebs, rebs, glosses, pos, common}.

    Indexed by every keb *and* every reb, so vocab whose primary_form is kana
    (これ, コーヒー) resolves even when JMdict's headword is a rarely-used
    kanji form (此れ, 珈琲). `common` reflects ke_pri/re_pri priority tags.
    """
    index = {}
    with gzip.open(_data_path("JMdict_e.gz"), "rb") as f:
        for _event, elem in ET.iterparse(f, events=("end",)):
            if elem.tag != "entry":
                continue
            kebs = [k.text for k in elem.iter("keb")]
            rebs = [r.text for r in elem.iter("reb")]
            glosses = [g.text for g in elem.iter("gloss") if g.text]
            pos = sorted({p.text for p in elem.iter("pos") if p.text})
            common = any(True for _p in elem.iter("ke_pri")) or any(
                True for _p in elem.iter("re_pri")
            )
            entry = {
                "kebs": kebs,
                "rebs": rebs,
                "glosses": glosses,
                "pos": pos,
                "common": common,
            }
            for form in dict.fromkeys(kebs + rebs):
                index.setdefault(form, []).append(entry)
            elem.clear()
    return index
