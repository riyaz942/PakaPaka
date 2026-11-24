# -*- coding: utf-8 -*-
"""Mnemonics that do not build on the items the ladder teaches first.

Three checks, each a list of slugs. They match names as text, so a few results
can be wrong either way; a person reads each flagged mnemonic.

- `radicals_with_later_part`: a radical mnemonic built from a part (`<part
  form="X">`) that is a radical taught at a later level.
- `kanji_with_unknown_radical`: a kanji mnemonic that names a radical
  (`<radical form="X">name</radical>`; the form decides when it is given, else
  the name) that no radical is called, or that is taught at a later level than
  the kanji.
- `vocab_missing_kanji`: a word mnemonic that names fewer kanji than the word
  has (`<kanji form="X">` or a tag text that matches the kanji's meaning).
"""

import re
from collections import defaultdict

RADICAL_TAG = re.compile(r'<radical(?:\s+form="([^"]*)")?[^>]*>(.*?)</radical>')
PART_TAG = re.compile(r'<part\s+form="([^"]*)"[^>]*>')
KANJI_TAG = re.compile(r'<kanji(?:\s+form="([^"]*)")?[^>]*>(.*?)</kanji>')
SPLIT = re.compile(r"[/,;()]")


def meaning_names(item):
    """Lowercase names an item answers to: its meaning, each part of it and every
    accepted meaning answer."""
    texts = [item["meaning"]] + [a["answer_text"] for a in item.get("accepted_answers", [])
                                 if a.get("answer_type", "meaning") == "meaning"]
    names = set()
    for text in texts:
        names.add(text.lower())
        names.update(p.strip().lower() for p in SPLIT.split(text) if p.strip())
    return names


def level(ladder, kind, slug):
    return ladder[kind][slug]["level"]


def radicals_with_later_part(ladder, radical_items, radical_mnemonics):
    by_form = defaultdict(set)
    for r in radical_items:
        by_form[r["primary_form"]].add(r["slug"])
    found = []
    for slug, entry in radical_mnemonics.items():
        if slug not in ladder["radical"]:
            continue
        own = level(ladder, "radical", slug)
        for form in PART_TAG.findall(entry.get("mnemonic_text") or ""):
            parts = by_form.get(form, set()) - {slug}
            if parts and min(level(ladder, "radical", p) for p in parts) > own:
                found.append(slug)
                break
    return found


def kanji_with_unknown_radical(ladder, radical_items, kanji_mnemonics):
    by_name = defaultdict(set)
    by_form = defaultdict(set)
    for r in radical_items:
        by_form[r["primary_form"]].add(r["slug"])
        for name in meaning_names(r):
            by_name[name].add(r["slug"])
    found = []
    for slug, entry in kanji_mnemonics.items():
        if slug not in ladder["kanji"]:
            continue
        own = level(ladder, "kanji", slug)
        for form, name in RADICAL_TAG.findall(entry.get("meaning_mnemonic") or ""):
            radicals = by_form.get(form) if form in by_form else by_name.get(name.lower(), set())
            if not radicals or min(level(ladder, "radical", r) for r in radicals) > own:
                found.append(slug)
                break
    return found


def kanji_stems(kanji_item):
    """Short stems of the kanji's meanings, to match a tag text such as `Peaceful`
    against `cheap / peaceful`."""
    stems = set()
    for name in meaning_names(kanji_item):
        if len(name) >= 3:
            stems.add(name[:max(3, len(name) - 2)])
    return stems


def vocab_missing_kanji(ladder, kanji_items, vocab_items, vocab_mnemonics):
    kanji = {k["primary_form"]: k for k in kanji_items}
    words = {v["slug"]: v for v in vocab_items}
    found = []
    for slug, entry in vocab_mnemonics.items():
        word = words.get(slug)
        if word is None or slug not in ladder["vocabulary"]:
            continue
        chars = [c for c in word["primary_form"] if c in kanji]
        if not chars:
            continue
        tags = KANJI_TAG.findall(entry.get("meaning_mnemonic") or "")
        forms = {form for form, _ in tags if form}
        texts = " ".join(text.lower() for _, text in tags)
        if any(c not in forms and not any(s in texts for s in kanji_stems(kanji[c]))
               for c in chars):
            found.append(slug)
    return found
