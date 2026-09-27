# -*- coding: utf-8 -*-
"""Curriculum context for Phase 2b/2d radical, kanji and vocabulary generation.

Loads the *generated* curriculum JSON (curriculum/{kanji,radicals,vocabulary}/
<level>.json, the canonical output of generate.py) and derives the per-item
inputs the generator prompt and the mechanical gate both need:

  * radical: form + meaning (its own accepted meanings) + look-alikes — the
    output is a `mnemonic_text`, one vivid concrete image that doubles as the
    Tier 2 image prompt, plus an optional `description` for contrast/nuance.
  * kanji: primary reading target (the reading the mnemonic must contain),
    onyomi/kunyomi, meaning + accepted meanings, look-alikes, and the **taught
    decomposition** — the radicals that build_on the kanji per
    dependencies/graph.json, in *our* taught radical names, carrying each
    radical's established `mnemonic_text` so the kanji story continues the
    radical's image rather than name-dropping it. That graph (not KRADFILE) is
    the app's truth for kanji -> radical; a mnemonic must reference exactly
    those components and never a component the learner was not taught
    (docs/content/content-pipeline-plan.md 2b).
  * vocabulary (Rev 1, 2d): the component kanji (kanji -> vocabulary `requires`
    edges) with their established meaning mnemonics, the *untaught* kanji the
    word is also written with (`builds_on` edges) carrying their meaning and
    nothing else, plus the **reading
    regularity** of the word — computed mechanically from the word's reading
    against its kanji's KANJIDIC readings, so the "full reading story vs.
    pointer at an earlier word vs. no reading mnemonic at all" choice is
    checkable by the gate rather than left to the model.

Look-alike pairs come from the reviewed R1.3 dataset (_build/visually_similar.py)
— never from the model.

Cast lore for the item's readings is attached here so the generator and any
re-derivation share one code path.
"""

import json
import os
import re
import sys
import textwrap

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CURRICULUM_DIR = os.path.dirname(BUILD_DIR)
if BUILD_DIR not in sys.path:
    sys.path.insert(0, BUILD_DIR)

import furigana as furigana_lib  # noqa: E402
from visually_similar import build_similar_map  # noqa: E402
from generate_content import cast as cast_lib  # noqa: E402

GRAPH_PATH = os.path.join(CURRICULUM_DIR, "dependencies", "graph.json")

#: {kanji: {"on": [...], "kun": [...]}} for all of KANJIDIC2, distilled by
#: `import/build_kanjidic_readings.py` because KANJIDIC2 itself is not committed.
#: Reading regularity is judged against these, not against taught readings.
with open(os.path.join(BUILD_DIR, "kanjidic_readings.json"), encoding="utf-8") as _f:
    KANJIDIC_READINGS = json.load(_f)

#: {vocab slug: ["い adjective"]} from `import/build_vocab_word_types.py`. Not
#: every word has one — the compound forms taught as grammar carry none — and
#: the file is absent until that script is run, so `vocab_context` treats a
#: missing entry as "unknown" and the prompt tells the model to say nothing
#: about word type rather than guess one.
_WORD_TYPES_PATH = os.path.join(BUILD_DIR, "vocab_word_types.json")
if os.path.exists(_WORD_TYPES_PATH):
    with open(_WORD_TYPES_PATH, encoding="utf-8") as _f:
        VOCAB_WORD_TYPES = json.load(_f)
else:
    VOCAB_WORD_TYPES = {}

#: Levels whose radicals/kanji can be components or look-alikes of one another,
#: in teaching order (a learner meets N5 before N4).
#:
#: The skeleton levels are here for the *kanji and radical* layers (plan Phase
#: 4): an N3 kanji is a real generation target with real components and real
#: look-alikes. They deliberately do not move `vocab_context`'s taught-kanji
#: window, which slices this tuple by `index(level)` and so still resolves to
#: ("n5",) / ("n5", "n4") — see the note there.
ALL_LEVELS = ("n5", "n4", "n3", "n2", "n1")

_CJK_RE = re.compile(r"[㐀-䶿一-鿿々]")


def _load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_items(kind, level):
    """Items of one kind at one level, or [] if that level ships none.

    A level legitimately omits a kind: the skeleton levels ship kanji only, and
    N1 not even radicals — its 93 kanji decompose entirely into components taught
    lower down. An unknown *level* is still a caller bug and raises."""
    if level not in ALL_LEVELS:
        raise ValueError(f"unknown level {level!r}")
    path = os.path.join(CURRICULUM_DIR, kind, f"{level}.json")
    if not os.path.exists(path):
        return []
    return _load_json(path)["items"]


def _by_slug(items):
    return {it["slug"]: it for it in items}


def _reading_answers(item):
    return [
        a["answer_text"]
        for a in item.get("accepted_answers", [])
        if a.get("answer_type") == "reading"
    ]


def _meaning_answers(item):
    return [
        a["answer_text"]
        for a in item.get("accepted_answers", [])
        if a.get("answer_type") == "meaning"
    ]


_MEANING_WORD_RE = re.compile(r"[A-Za-z][A-Za-z'-]*")


def _meaning_word_set(synonyms):
    """Lowercase content words of a meaning list, parentheticals dropped.

    Deliberately the same shape as validate_mnemonics._meaning_words so the
    prompt and the gate can never disagree about what a meaning "is".
    """
    words = set()
    for syn in synonyms:
        syn = re.sub(r"\([^)]*\)", " ", syn).lower()
        words.update(w for w in _MEANING_WORD_RE.findall(syn) if len(w) >= 2)
    return words


def _shares_meaning(own, other):
    """True when the two word sets name the same thing.

    Prefix matching, because that is what the gate's `_references` already does
    when it decides a story "mentions" a meaning: 羽 "feathers" is the 羽
    "feather" radical, and 寸 "measurement" is the 寸 "measure" radical.
    """
    return any(a.startswith(b) or b.startswith(a) for a in own for b in other)


def identical_radical(item, components):
    """The taught radical this kanji simply *is*, or None.

    A handful of kanji are a radical the learner has already met, unchanged in
    both shape and meaning: 山 the radical and 山 the kanji. Inventing a scene
    for those teaches nothing — the learner's memory hook is the radical they
    already know, so the honest meaning mnemonic just says the two are the same.
    Detection is mechanical (one component, same character, overlapping
    meanings) so the generator prompt and the gate always agree on which items
    these are; 用 "utilize" over the 用 "use" radical is *not* one of them,
    because the meaning genuinely moves.
    """
    if len(components) != 1:
        return None
    comp = components[0]
    if comp["form"] != item["primary_form"]:
        return None
    own = _meaning_word_set(_meaning_answers(item) or [item["meaning"]])
    if not _shares_meaning(own, _meaning_word_set(comp["meaning_synonyms"])):
        return None
    return comp


def identical_kanji(form, meaning_synonyms, components):
    """The component kanji this *word* simply is, or None.

    The vocabulary twin of `identical_radical`, one layer up. 年 the kanji and
    年 the word are the same thing, and so is 白い the word over 白 the kanji —
    WaniKani writes both as one line ("The kanji and the word are exactly the
    same. That means they share meanings as well.") rather than inventing a
    second story that competes with the kanji's own.

    One component, whose character is the word's only kanji, whose meaning the
    word shares. Okurigana is allowed and is the point of the 白い case: the
    kana tail is what makes it an adjective, and the word type block says so.
    A word whose meaning moves away from its kanji (社 "company" over 社
    "shrine") is not one of these, because there the meaning is the lesson.
    """
    if len(components) != 1:
        return None
    comp = components[0]
    if _CJK_RE.findall(form) != [comp["char"]]:
        return None
    if not _shares_meaning(_meaning_word_set(meaning_synonyms),
                           _meaning_word_set(comp["meaning_synonyms"])):
        return None
    return comp


def _kanji_readings(item):
    """(onyomi_list, kunyomi_list) from the item's readings array."""
    onyomi = [r["reading"] for r in item.get("readings", []) if r["reading_type"] == "onyomi"]
    kunyomi = [r["reading"] for r in item.get("readings", []) if r["reading_type"] == "kunyomi"]
    return onyomi, kunyomi


def _primary_reading(item):
    """The reading used as the accepted `reading` answer (generate.py: first
    non-empty of onyomi then kunyomi). This is the mnemonic's required reading."""
    answers = _reading_answers(item)
    return answers[0] if answers else None


# --- look-alikes (R1.3 reviewed pair dataset) ------------------------------

_ITEM_INDEX = None
_SIMILAR_MAP = None


def _item_index():
    """{slug: {slug, form, meaning, type}} for every taught radical and kanji,
    across levels — look-alike pairs cross both level and item type."""
    global _ITEM_INDEX
    if _ITEM_INDEX is None:
        index = {}
        for level in ALL_LEVELS:
            for kind, item_type in (("radicals", "radical"), ("kanji", "kanji")):
                for it in load_items(kind, level):
                    index[it["slug"]] = {
                        "slug": it["slug"],
                        "form": it["primary_form"],
                        "meaning": it["meaning"],
                        "type": item_type,
                    }
        _ITEM_INDEX = index
    return _ITEM_INDEX


def look_alikes(slug):
    """The reviewed confusables for a radical/kanji slug, resolved to forms.

    Raises on an unknown slug: the pair dataset is reviewed and compiled, so a
    dangling slug is a dataset bug, not something to paper over."""
    global _SIMILAR_MAP
    if _SIMILAR_MAP is None:
        _SIMILAR_MAP = build_similar_map()
    index = _item_index()
    out = []
    for other in _SIMILAR_MAP.get(slug, []):
        if other not in index:
            raise KeyError(
                f"visually_similar pair references unknown slug {other!r} (from {slug!r})"
            )
        out.append(index[other])
    return out


def decomposition_edges():
    """{kanji_slug: [radical_slug, ...]} for builds_on edges radical -> kanji.
    Self/kanji-kanji edges are ignored: mnemonics decompose into taught
    *radicals* only.

    Not filtered by level: `to_slug` naming is not consistent across the
    dataset (legacy slugs carry a level prefix like `n5-ichi`, newer ones
    don't, e.g. `k-overdo`), so a level-prefix filter here silently dropped
    components for any slug in the second convention. The caller narrows to
    one kanji via `.get(slug, [])`, so no level filter is needed."""
    graph = _load_json(GRAPH_PATH)
    out = {}
    for e in graph["edges"]:
        if (
            e.get("relationship_type") == "builds_on"
            and e.get("from_type") == "radical"
            and e.get("to_type") == "kanji"
        ):
            out.setdefault(e["to_slug"], []).append(e["from_slug"])
    return out


def kanji_context(level, slug, cast=None):
    # Banding can move a kanji to a level other than the one its draft/sidecar
    # file was generated under, so look it up across every level rather than
    # just `level` — same reasoning as the radical lookup below.
    kanji = {}
    for lvl in ALL_LEVELS:
        kanji.update(_by_slug(load_items("kanji", lvl)))
    # A kanji's components can come from any level's radical set, not just its
    # own. Skeleton kanji are the reason this is every level rather than "N5
    # under N4": 旅 is N3 and builds on 方, an N3 radical, while most of its
    # neighbours build on N5 ones. Ordering is not a concern — the planner pulls
    # a radical forward with the kanji that needs it.
    radicals = {}
    for lvl in ALL_LEVELS:
        radicals.update(_by_slug(load_items("radicals", lvl)))
    if slug not in kanji:
        raise KeyError(f"unknown kanji slug {slug!r} in level {level}")
    item = kanji[slug]

    onyomi, kunyomi = _kanji_readings(item)
    primary = _primary_reading(item)
    comp_slugs = decomposition_edges().get(slug, [])
    components = []
    for rslug in comp_slugs:
        r = radicals.get(rslug)
        if not r:
            continue
        components.append({
            "slug": rslug,
            "form": r["primary_form"],
            "meaning": r["meaning"],
            "meaning_synonyms": _meaning_answers(r) or [r["meaning"]],
            # The radical's established image, which lives in its
            # `mnemonic_text` (Rev 3). Empty until the radical layer has been
            # generated — format_components refuses to build a prompt in that
            # state (the gate does not need it).
            "image": r.get("mnemonic_text", ""),
        })

    cast = cast or cast_lib.load_cast()
    reading_lore = cast_lib.lore_for_readings(onyomi + kunyomi, cast)

    return {
        "type": "kanji",
        "level": level,
        "slug": slug,
        "char": item["primary_form"],
        "meaning": item["meaning"],
        "meaning_synonyms": _meaning_answers(item) or [item["meaning"]],
        "onyomi": onyomi,
        "kunyomi": kunyomi,
        "primary_reading": primary,
        "components": components,
        "identical_radical": identical_radical(item, components),
        "look_alikes": look_alikes(slug),
        "reading_lore": reading_lore,
        "cast": cast,
    }


DECOMPOSITION_PATH = os.path.join(BUILD_DIR, "decomposition.json")


def radical_parts(form):
    """The taught radicals a radical is itself built from: 動 -> 重 "heavy" +
    力 "power". [] for a radical that is one indivisible shape (口, 一) or one
    whose split is not in the KanjiVG decomposition.

    Some radicals are whole kanji promoted into the radical layer, and the
    learner already knows their pieces. A mnemonic that names those pieces —
    "heavy boxes and someone with power to move them" — is shorter and easier
    than one that invents a new picture for the whole shape."""
    parts = _load_json(DECOMPOSITION_PATH)["decomposition"].get(form, [])
    if len(parts) < 2 or form in parts:
        return []
    by_form = {}
    for lvl in ALL_LEVELS:
        for r in load_items("radicals", lvl):
            by_form.setdefault(r["primary_form"], r)
    out = []
    for part in parts:
        r = by_form.get(part)
        if not r:
            # An untaught piece cannot be named to the learner, so the split
            # is not usable: fall back to one picture of the whole shape.
            return []
        out.append({
            "slug": r["slug"],
            "form": part,
            "meaning": r["meaning"],
            "meaning_synonyms": _meaning_answers(r) or [r["meaning"]],
        })
    return out


def radical_context(level, slug):
    radicals = _by_slug(load_items("radicals", level))
    if slug not in radicals:
        raise KeyError(f"unknown radical slug {slug!r} in level {level}")
    item = radicals[slug]
    return {
        "type": "radical",
        "level": level,
        "slug": slug,
        "form": item["primary_form"],
        "meaning": item["meaning"],
        "meaning_synonyms": _meaning_answers(item) or [item["meaning"]],
        "existing_mnemonic": item.get("mnemonic_text", ""),
        "look_alikes": look_alikes(slug),
        "components": radical_parts(item["primary_form"]),
    }


# --- vocabulary (Rev 1, 2d) ------------------------------------------------

def vocab_component_edges(level):
    """{vocab_slug: {"requires": [kanji_slug, ...], "builds_on": [...]}}.

    Both kanji -> vocabulary edge kinds, kept apart because they mean different
    things to a mnemonic. `requires` is a kanji this level teaches: the lesson
    gates on it, the learner has read its story, and a word mnemonic chains from
    that story. `builds_on` is a kanji the word is *written* with but does not
    wait for — 昨 in 昨日, banded N3 while the word is N5 — of which there are
    2220.

    The app already shows both as "Kanji in this word" chips
    (`itemRepository.getComponentParentsForItem`), so a mnemonic that names only
    the first kind leaves a character on the page the story acts as if is not
    there: 昨日's story says "the day that slipped past", and the half of the
    word carrying "previous" is never accounted for."""
    graph = _load_json(GRAPH_PATH)
    out = {}
    for e in graph["edges"]:
        if (
            e.get("relationship_type") in ("requires", "builds_on")
            and e.get("from_type") == "kanji"
            and e.get("to_type") == "vocabulary"
        ):
            entry = out.setdefault(e["to_slug"], {"requires": [], "builds_on": []})
            entry[e["relationship_type"]].append(e["from_slug"])
    return out


#: Rendaku (sequential voicing) — the first kana of a non-initial component can
#: voice: 人 ひと -> びと in 大人. Mechanical variants only; the gate uses these to
#: decide "regular reading" vs "needs a story", never to teach anything.
_RENDAKU = {
    "か": "が", "き": "ぎ", "く": "ぐ", "け": "げ", "こ": "ご",
    "さ": "ざ", "し": "じ", "す": "ず", "せ": "ぜ", "そ": "ぞ",
    "た": "だ", "ち": "ぢ", "つ": "づ", "て": "で", "と": "ど",
    "は": "ば", "ひ": "び", "ふ": "ぶ", "へ": "べ", "ほ": "ぼ",
}
_HANDAKU = {"は": "ぱ", "ひ": "ぴ", "ふ": "ぷ", "へ": "ぺ", "ほ": "ぽ"}


def _hira(text):
    return furigana_lib.katakana_to_hiragana(text or "")


#: Modern spelling of the two rendaku outputs that have fallen out of use. ぢ
#: and づ are voiced ち/つ historically, but written じ/ず almost everywhere
#: today: 中 ちゅう voices to ぢゅう and is spelled じゅう (年中 ねんじゅう).
#: Without this the word does not segment at all and is called irregular, which
#: sends a perfectly derivable compound down the "write a full story" branch.
_YOTSUGANA = {"ぢ": "じ", "づ": "ず"}


def _reading_variants(reading):
    """A taught reading plus the regular sound changes Japanese applies when it
    sits inside a compound: rendaku, handakuon, and gemination (がく -> がっ)."""
    r = _hira(reading)
    if not r:
        return set()
    variants = {r}
    if r[0] in _RENDAKU:
        voiced = _RENDAKU[r[0]]
        variants.add(voiced + r[1:])
        if voiced in _YOTSUGANA:
            variants.add(_YOTSUGANA[voiced] + r[1:])
    if r[0] in _HANDAKU:
        variants.add(_HANDAKU[r[0]] + r[1:])
    if len(r) > 1:
        variants.add(r[:-1] + "っ")
    return variants


def _segment(form, reading, variants_by_char, i=0, pos=0):
    """Backtracking match of `reading` against `form`, kanji consuming one of
    their taught readings' variants and kana matching literally. Returns the
    [(form_char, reading_chunk)] segmentation, or None when the word's reading
    cannot be built from the taught readings (i.e. it is irregular)."""
    if i == len(form):
        return [] if pos == len(reading) else None
    ch = form[i]
    # Kana (and any non-kanji character) must appear literally; a kanji may
    # consume any variant of any of its taught readings.
    chunks = (sorted(variants_by_char[ch], key=len, reverse=True)
              if ch in variants_by_char else [_hira(ch)])
    for chunk in chunks:
        if reading.startswith(chunk, pos):
            rest = _segment(form, reading, variants_by_char, i + 1, pos + len(chunk))
            if rest is not None:
                return [(ch, chunk)] + rest
    return None


def _kanjidic_variants(char):
    entry = KANJIDIC_READINGS.get(char)
    if not entry:
        return set()
    variants = set()
    for r in entry["on"] + entry["kun"]:
        variants |= _reading_variants(r)
    return variants


def _is_onyomi(char, chunk):
    entry = KANJIDIC_READINGS.get(char)
    return bool(entry) and any(chunk in _reading_variants(r) for r in entry["on"])


def _sound_change(char, chunk):
    """The regular sound change that turned one of `char`'s dictionary readings
    into `chunk`, or None when the chunk is a reading unchanged.

    Rev 6 states these in the shipped `reading_composition` field — "Rendaku:
    口 くち → ぐち" — instead of leaving the learner to notice on their own that
    the kana they were taught is not the kana in front of them.
    """
    entry = KANJIDIC_READINGS.get(char)
    if not entry:
        return None
    bases = [_hira(r) for r in entry["on"] + entry["kun"] if r]
    if chunk in bases:
        return None
    for base in bases:
        if base[0] in _RENDAKU:
            voiced = _RENDAKU[base[0]]
            if voiced + base[1:] == chunk or (
                voiced in _YOTSUGANA and _YOTSUGANA[voiced] + base[1:] == chunk
            ):
                return {"kind": "rendaku", "from": base, "to": chunk, "char": char}
        if base[0] in _HANDAKU and _HANDAKU[base[0]] + base[1:] == chunk:
            return {"kind": "handakuon", "from": base, "to": chunk, "char": char}
        if len(base) > 1 and base[:-1] + "っ" == chunk:
            return {"kind": "gemination", "from": base, "to": chunk, "char": char}
    return None


def _reading_pattern(segments):
    """Which kind of reading the word takes, from its own segmentation.

    The four names are the ones a Japanese course uses, and each produces a
    different line in the shipped `reading_composition` field:

      * "jukugo"  — two or more kanji, every one read with its on'yomi. The
                    default for a compound, and the thing to say out loud so the
                    learner starts *expecting* on'yomi in compounds.
      * "kun"     — every kanji read with its kun'yomi (a lone kanji, or a word
                    with okurigana).
      * "mixed"   — both in one word (太字 ふとじ, kun + on). Genuinely odd, and
                    worth flagging as odd.
      * "on"      — a single kanji read with its on'yomi.

    A kanji whose chunk is listed under both readings counts as on'yomi, which
    is the safe way round: over-calling "jukugo" on a compound never misleads,
    while calling a compound "kun" would.
    """
    kanji_chunks = [(ch, chunk) for ch, chunk in segments if _CJK_RE.match(ch)]
    if not kanji_chunks:
        return ""
    on_flags = [_is_onyomi(ch, chunk) for ch, chunk in kanji_chunks]
    if all(on_flags):
        return "jukugo" if len(kanji_chunks) > 1 else "on"
    if not any(on_flags):
        return "kun"
    return "mixed"


def reading_regularity(form, reading):
    """How the word's reading relates to its kanji's *dictionary* readings.

    Judged against KANJIDIC, not against which readings our curriculum teaches
    (plan v2, "Interaction with the mnemonic pipeline"). Taught-status is the
    wrong test: under band-gated teaching most jukugo contain a kanji the learner
    has not met, which sent nearly every compound down the "write a full story"
    branch. It is also the wrong *question* — a reading card is withheld until
    the word's kanji are learned (Phase B rule 1), so by the time the learner
    reads this note, the readings it points at are ones they know.

    kind is one of:
      * "kana_only"  — no kanji in the written form; the word is its own reading
      * "regular"    — the reading assembles from dictionary readings (allowing
                       rendaku/gemination) and the learner can get there from
                       their kanji cards; `reading_composition` says how, and no
                       reading mnemonic is written at all (Rev 6)
      * "kun_word"   — a lone kanji read with its kun'yomi (秋 あき, 危ない
                       あぶない). Mechanically derivable, but the kanji card
                       teaches meaning and on'yomi only, so the word is where
                       that reading is learned: it needs a full story
      * "irregular"  — the reading cannot be assembled at all (明日 あした,
                       部屋 へや); it needs a full story

    `segments` is the [(char, reading_chunk)] breakdown when the reading
    assembles; `pattern` names which readings it used (see `_reading_pattern`)
    and `sound_changes` lists the rendaku/gemination it went through, both empty
    when there is no segmentation to read them off."""
    reading = _hira(reading)
    kanji_in_form = _CJK_RE.findall(form)
    empty = {"pattern": "", "sound_changes": []}
    if not kanji_in_form:
        return {"kind": "kana_only", "segments": [], **empty}
    variants_by_char = {ch: v for ch in set(kanji_in_form)
                        if (v := _kanjidic_variants(ch))}
    segments = _segment(form, reading, variants_by_char)
    if segments is None:
        return {"kind": "irregular", "segments": [], **empty}
    analysis = {
        "pattern": _reading_pattern(segments),
        "sound_changes": [
            change
            for ch, chunk in segments
            if _CJK_RE.match(ch) and (change := _sound_change(ch, chunk))
        ],
    }
    if len(kanji_in_form) == 1:
        char = kanji_in_form[0]
        chunk = next(chunk for ch, chunk in segments if ch == char)
        if not _is_onyomi(char, chunk):
            return {"kind": "kun_word", "segments": segments, **analysis}
    return {"kind": "regular", "segments": segments, **analysis}


#: How each reading pattern names itself in the shipped `reading_composition`
#: field, and the one clause worth adding after the segments.
#:
#: "Jukugo" earns its clause: the name alone does not tell a learner that the
#: kanji are using their on'yomi, and that is the rule which reads the *next*
#: compound too. "On'yomi" and "Kun'yomi" already say it in the label, so a
#: trailing clause would only repeat the heading.
_COMPOSITION_PATTERN = {
    "jukugo": ("Jukugo", "each kanji read with its on'yomi"),
    "on": ("On'yomi", None),
    "kun": ("Kun'yomi", None),
}

_COMPOSITION_CHANGE = {
    "rendaku": "Rendaku",
    "handakuon": "Handakuon",
    "gemination": "Gemination",
}


def _composition_segments(segments):
    """`入（い）＋り＋口（ぐち）` — each kanji with the chunk it contributed, and
    runs of kana bare, because a kana's reading is itself. Consecutive kana are
    merged so okurigana reads as a tail (`大（おお）＋きい`) rather than as a
    string of separate terms."""
    parts = []
    for ch, chunk in segments:
        if _CJK_RE.match(ch):
            parts.append(f"{ch}（{chunk}）")
        elif parts and not parts[-1].endswith("）"):
            parts[-1] += ch
        else:
            parts.append(ch)
    return "＋".join(parts)


def reading_composition(form, reading):
    """One computed line saying how the word's reading is built — the shipped
    `reading_composition` field.

    Rev 6 moves this out of `reading_mnemonic` prose. `reading_regularity`
    already knows the pattern and every sound change exactly, so asking the
    model to restate them in a sentence bought nothing and risked drift: whether
    a word is jukugo is a fact about its segmentation, not a judgement. It also
    spent the reading mnemonic's whole one-or-two-sentence budget on something a
    field states more precisely, which is why 745 of N5+N4's 1,247 words now
    ship no reading mnemonic at all and this line instead.

    What is left for `reading_mnemonic` is the part a field cannot do: a memory
    hook for a sound the learner has nothing to derive it from."""
    reading = _hira(reading)
    regularity = reading_regularity(form, reading)
    kind = regularity["kind"]
    if kind == "kana_only":
        return "Kana only — the word is written exactly as it is read."
    if kind == "irregular":
        return (f"Irregular — {reading} cannot be assembled from the dictionary "
                f"readings of {form}.")
    segments = regularity["segments"]
    if regularity["pattern"] == "mixed":
        # The whole point of a mixed word is *which* kanji went which way, so
        # the per-kanji label replaces the trailing clause the others get.
        line = "Mixed — " + " ＋ ".join(
            f"{ch}（{chunk}）{'on' if _is_onyomi(ch, chunk) else 'kun'}'yomi"
            if _CJK_RE.match(ch) else ch
            for ch, chunk in segments
        ) + "."
    else:
        label, tail = _COMPOSITION_PATTERN[regularity["pattern"]]
        line = f"{label} — {_composition_segments(segments)}"
        line += f", {tail}." if tail else "."
    for change in regularity["sound_changes"]:
        line += (f" {_COMPOSITION_CHANGE[change['kind']]}: "
                 f"{change['char']} {change['from']} → {change['to']}.")
    return line


_READING_TEACHERS = None


def _reading_teachers():
    """{vocab slug: the earlier word that already taught this word's reading}.

    A vocabulary reading that needs a story is a single kanji read with its
    kun'yomi (`kun_word`), and the curriculum is full of families that share
    exactly that reading: 教える then 教え, 上がる then 上げる, 書く then 書ける,
    答える then 答え. The second word in such a family has nothing new to teach
    about the sound, so WaniKani points back at the first — "you already learned
    this reading from 教える" — instead of inventing a rival hook, and Rev 6 does
    the same. A second mnemonic for one sound does not reinforce the first; it
    competes with it.

    Only a `kun_word` counts as a *teacher*. A `regular` word merely contains
    the reading and, from Rev 6, ships a `reading_composition` line rather than a
    mnemonic — being shown 月（つき）inside 毎月 is not the same as having a hook
    for つき, so 月 the word still earns its own story.

    Walked in teaching order (level, then curriculum sort order), so the word
    named is always one the learner has already done."""
    global _READING_TEACHERS
    if _READING_TEACHERS is not None:
        return _READING_TEACHERS
    taught = {}
    teachers = {}
    for lvl in ALL_LEVELS:
        for item in load_items("vocabulary", lvl):
            form = item["primary_form"]
            readings = _reading_answers(item)
            regularity = reading_regularity(form, readings[0] if readings else "")
            if regularity["kind"] != "kun_word":
                continue
            # A kun_word is one kanji by definition, so there is exactly one
            # (char, chunk) pair to key the reading on.
            char, chunk = next((ch, ck) for ch, ck in regularity["segments"]
                               if _CJK_RE.match(ch))
            if (char, chunk) in taught:
                teachers[item["slug"]] = taught[(char, chunk)]
            else:
                taught[(char, chunk)] = {
                    "level": lvl,
                    "slug": item["slug"],
                    "form": form,
                    "reading": _hira(readings[0] if readings else ""),
                    "char": char,
                    "chunk": chunk,
                }
    _READING_TEACHERS = teachers
    return _READING_TEACHERS


def vocab_context(level, slug, cast=None):
    vocab = _by_slug(load_items("vocabulary", level))
    if slug not in vocab:
        raise KeyError(f"unknown vocabulary slug {slug!r} in level {level}")
    item = vocab[slug]

    # The window that decides which kanji bring a *story* to the word. A word
    # can sit at a level below one of its own kanji (N5's 明日 uses 明, taught at
    # N4), and that kanji has no established story for the learner to chain
    # from, so it does not become a component here. It is not dropped outright —
    # it comes back below as an untaught component, meaning-only.
    #
    # Plan v2 Phase C put this rule back in force: pull-forward is gone, so a
    # learner really does reach 写真 without having met 写 or 真. The window is
    # right, and it is also what a vocabulary story needs — a story chains from
    # its kanji's *established* stories, and most band kanji have none yet.
    #
    # `reading_regularity` deliberately does *not* use this window: it judges
    # against KANJIDIC, because whether a reading is derivable is a fact about
    # the language, not about lesson order. See its docstring.
    taught_levels = ALL_LEVELS[:ALL_LEVELS.index(level) + 1]
    kanji = {}
    for lvl in taught_levels:
        kanji.update(_by_slug(load_items("kanji", lvl)))
    all_kanji = {}
    for lvl in ALL_LEVELS:
        all_kanji.update(_by_slug(load_items("kanji", lvl)))

    form = item["primary_form"]
    readings = _reading_answers(item)
    reading = readings[0] if readings else ""
    meaning_synonyms = _meaning_answers(item) or [item["meaning"]]

    edges = vocab_component_edges(level).get(slug, {})
    components = []
    seen_chars = set()
    for kslug in edges.get("requires", []):
        k = kanji.get(kslug)
        # A character re-taught at a later level has two slugs and two edges;
        # the learner sees one kanji, so keep the first.
        if not k or k["primary_form"] in seen_chars:
            continue
        seen_chars.add(k["primary_form"])
        onyomi, kunyomi = _kanji_readings(k)
        components.append({
            "slug": kslug,
            "char": k["primary_form"],
            "meaning": k["meaning"],
            "meaning_synonyms": _meaning_answers(k) or [k["meaning"]],
            "onyomi": onyomi,
            "kunyomi": kunyomi,
            # Rev 1: chain from the kanji's established story, not just its
            # name. Empty until the kanji layer has run (see
            # format_vocab_components).
            "meaning_mnemonic": k.get("meaning_mnemonic", ""),
        })
    # The other half of the word: kanji it is written with but does not wait
    # for. The learner has met neither the character nor its story, so only the
    # *meaning* travels — see `format_vocab_components`. This applies whether or
    # not the word has any *taught* components too — 家族, with both 家 and 族
    # banded at N4, gets 家 and 族 named here exactly as 祖父 (祖 untaught, 父
    # taught) gets 祖.
    #
    # One filter, deliberate: a kanji whose meaning simply restates the word's
    # is dropped. Naming it produces "the yesterday day is yesterday" (昨日),
    # "the fruit thing is fruit" (果物) — worse than saying nothing, and the
    # same `_shares_meaning` test `identical_kanji` already uses. A word left
    # with no components of either kind after this filter (all-circular, or
    # genuinely no kanji chars at all) falls back to `format_vocab_components`'s
    # standalone-story branch.
    own_words = _meaning_word_set(meaning_synonyms)
    untaught_components = []
    for kslug in edges.get("builds_on", []):
        k = all_kanji.get(kslug)
        if not k or k["primary_form"] in seen_chars:
            continue
        synonyms = _meaning_answers(k) or [k["meaning"]]
        if _shares_meaning(own_words, _meaning_word_set(synonyms)):
            continue
        seen_chars.add(k["primary_form"])
        untaught_components.append({
            "slug": kslug,
            "char": k["primary_form"],
            "meaning": k["meaning"],
            "meaning_synonyms": synonyms,
        })

    # Component order follows the written form so a story reads left to right.
    def _form_order(c):
        return form.find(c["char"]) if c["char"] in form else len(form)

    components.sort(key=_form_order)
    untaught_components.sort(key=_form_order)

    cast = cast or cast_lib.load_cast()
    regularity = reading_regularity(form, reading)

    return {
        "type": "vocab",
        "level": level,
        "slug": slug,
        "form": form,
        "meaning": item["meaning"],
        "meaning_synonyms": meaning_synonyms,
        "reading": reading,
        "word_type": VOCAB_WORD_TYPES.get(slug, []),
        "components": components,
        "untaught_components": untaught_components,
        "identical_kanji": identical_kanji(form, meaning_synonyms, components),
        "regularity": regularity,
        # Rev 6: the derivation the reading mnemonic used to recite in prose,
        # computed once and shipped as its own field. In the prompt it appears
        # only so the model can see what the page already says and not repeat it.
        "reading_composition": reading_composition(form, reading),
        # Rev 6: the earlier word that already taught this reading, or None.
        "reading_taught_by": _reading_teachers().get(slug),
        # A word reading rarely matches a cast key on its own (cast members are
        # fixed to single-kanji readings), so offer the component readings too —
        # a story about でんわ should reuse でん's character.
        "reading_lore": cast_lib.lore_for_readings(
            [reading] + [r for c in components for r in c["onyomi"] + c["kunyomi"]], cast),
        "cast": cast,
    }


def all_slugs(level, kind):
    """Slugs for a level in curriculum (sort) order."""
    return [it["slug"] for it in load_items(kind, level)]


def format_components(components):
    if not components:
        return ("(none taught — this kanji is not built from taught radicals; "
                "use a single vivid pictograph of the whole character instead, "
                "and do NOT name any component the learner has not been taught)")
    lines = []
    for c in components:
        if not c["image"]:
            # The chain radical -> kanji: a kanji story continues its radicals'
            # current images. Building the prompt without them would silently
            # chain onto whatever prose is left over from before.
            raise ValueError(
                f"component radical {c['slug']} has no `mnemonic_text` yet. "
                "Generate the radical layer first (`generate_mnemonics run "
                "--type radical` for the level that teaches it, then "
                "`generate.py --level <level>`)."
            )
        syn = " / ".join(dict.fromkeys(c["meaning_synonyms"]))
        lines.append(f"- {c['form']} — “{syn}”\n  Its established image, which your "
                     f"story must continue: {c['image']}")
    return "\n".join(lines)


def format_radical_parts(components):
    """The `{{COMPONENTS}}` block of the radical prompt."""
    if not components:
        return ("(none — this radical is one shape, not a combination of taught "
                "radicals. Use the \"single shape\" pattern below, and do NOT "
                "name any other radical.)")
    lines = []
    for c in components:
        syn = " / ".join(dict.fromkeys(c["meaning_synonyms"]))
        lines.append(f"- {c['form']} — “{syn}”")
    return "\n".join(lines)


def format_identity(ctx):
    """The `{{IDENTITY_NOTE}}` block: the meaning-mnemonic contract changes
    completely for a kanji that simply *is* a taught radical, so the prompt says
    so in one place rather than hedging every length rule above."""
    comp = ctx.get("identical_radical")
    if not comp:
        return _wrap(
            "This kanji is **not** one of those: it either has more than one "
            "taught component, or its meaning moves away from its component's. "
            "Write the full meaning mnemonic described above."
        )
    syn = " / ".join(dict.fromkeys(comp["meaning_synonyms"]))
    paras = [
        f"**This kanji IS a taught radical.** {ctx['char']} is the radical "
        f"{comp['form']} — “{syn}” — unchanged in shape and in meaning, and the "
        f"learner has already read and seen its image.",

        "So do not invent a scene. There is nothing to build: the components "
        "are the character, and a story here would be decoration the learner "
        "has to carry for no gain. **Say plainly that the two are the same.** "
        "That is the whole meaning mnemonic.",

        f"> The <radical form=\"{comp['form']}\">{_first_word(syn)}</radical> "
        f"radical and the <kanji form=\"{ctx['char']}\">"
        f"{_first_word(ctx['meaning'])}</kanji> kanji are the same.",

        "Vary the wording — a short aside, a bit of relief that this one comes "
        "free, a nudge that it pays to know the radicals well — but keep it to "
        "ONE sentence, and never explain the joke.",

        "**This overrides the 70–170 character target above: aim for 50–150 "
        "characters here, and never go past 200. It is still one sentence.** Still tag both words: "
        "`<radical>` where you name the radical, `<kanji>` where you name this "
        "kanji's meaning. They are the same word on two different spans, and "
        "that is correct — it is what makes the app colour both. Each span "
        "still carries its own `form`.",
    ]
    # Only when we teach this kanji a sense the radical does not carry (工
    # "craft" over the "construction" radical) is there a second sentence to
    # write. Where the two match outright (山), offering the option would just
    # invite padding.
    extra = _meaning_word_set(ctx["meaning_synonyms"])
    if not all(_shares_meaning({w}, _meaning_word_set(comp["meaning_synonyms"]))
               for w in extra):
        paras.append(
            f"We teach this kanji as “{ctx['meaning']}” (accepted: "
            f"{', '.join(dict.fromkeys(ctx['meaning_synonyms']))}), which "
            f"reaches past the radical's “{syn}”. Add **one** short sentence "
            "for that extra sense, and give the learner the reason the two "
            "senses belong together — no more than that."
        )
    paras.append(
        "The reading mnemonic is unaffected: the reading is not derivable from "
        "the radical, so write it in full as described below."
    )
    return "\n\n".join(_wrap(p) for p in paras)


def _wrap(text, width=78):
    """Match the hand-written prompt files, which wrap at 78 columns."""
    return textwrap.fill(text, width=width) if not text.startswith(">") else text


def _first_word(meaning):
    """The bare word of a taught meaning, for the worked example above: the
    slash-joined entries ("sun / day") are one answer string, not two."""
    return meaning.split("/")[0].strip()


def format_look_alikes(entries):
    """The reviewed confusables block (Rev 1). Empty means empty: the model must
    never invent a look-alike."""
    if not entries:
        return ("(none — this item has no reviewed look-alike in the taught set. "
                "Do NOT invent one and do not mention confusable characters at all.)")
    lines = []
    for e in entries:
        lines.append(f"- {e['form']} — “{e['meaning']}” (taught as a {e['type']})")
    return "\n".join(lines)


def format_vocab_components(ctx):
    """The `{{COMPONENTS}}` block: every kanji in the written form the story may
    name, in written-form order, taught and untaught interleaved.

    The two kinds carry different amounts. A taught kanji brings its established
    meaning story, and the word's story continues it. An untaught one brings its
    **meaning only** — the learner has not read its story, so hooking into that
    story teaches nothing, and it is what keeps this block buildable: 17 N5 and
    51 N4 of those kanji have no generated `meaning_mnemonic` at all, so the
    ordering `ValueError` below would fire on half the set.
    """
    components = ctx["components"]
    untaught_components = ctx["untaught_components"]
    if not components and not untaught_components:
        return ("(none — this word is written in kana, or every kanji it has is "
                "one whose meaning simply restates the word's own. Write a "
                "standalone story for the word itself, and do NOT name any kanji.)")
    form = ctx["form"]
    untaught = {c["char"] for c in untaught_components}
    ordered = sorted(
        components + untaught_components,
        key=lambda c: form.find(c["char"]) if c["char"] in form else len(form))
    lines = []
    for c in ordered:
        syn = " / ".join(dict.fromkeys(c["meaning_synonyms"]))
        if c["char"] in untaught:
            lines.append(
                f"- {c['char']} — “{syn}” — **the learner has not been taught this "
                f"kanji.** They see the character in this word and nothing else: no "
                f"story, no reading, no card. So use the meaning above as a plain "
                f"fact and make it carry its share of the logic — never point at "
                f"“its story”, never name its reading, and never say it is one they "
                f"know."
            )
            continue
        if not c["meaning_mnemonic"]:
            # Same ordering rule one layer up: kanji -> vocabulary.
            raise ValueError(
                f"component kanji {c['slug']} has no `meaning_mnemonic` yet. "
                "Regenerate the kanji layer first (`generate_mnemonics run "
                "--type kanji` for the level that teaches it, then "
                "`generate.py --level <level>`)."
            )
        readings = "、".join(c["onyomi"] + c["kunyomi"]) or "(none)"
        lines.append(
            f"- {c['char']} — “{syn}” (taught readings: {readings})\n"
            f"  Its established meaning story, which yours should hook into: "
            f"{c['meaning_mnemonic']}"
        )
    return "\n".join(lines)


#: How each word type earns its place in a meaning mnemonic (Rev 5). A type is
#: only worth a sentence when it *predicts* something — that い is what makes
#: 大きい an adjective is a rule the learner can carry to the next word; that
#: 人口 is a noun is not. So the adjective classes get an instruction and the
#: rest get "don't bother", instead of every mnemonic opening with a recital.
_WORD_TYPE_NOTE = {
    "い adjective": (
        "Say that the い ending is what makes this an adjective. That rule "
        "transfers to every い word after this one, so it is worth the sentence "
        "— and where the word is a kanji plus い, that sentence is most of the "
        "mnemonic."
    ),
    "な adjective": (
        "Say that this is a な adjective — it takes な before the noun it "
        "describes, which is the thing a learner gets wrong. Worth the sentence."
    ),
    "godan verb": (
        "It is a godan (う-ending) verb. Mention the conjugation class only if "
        "the scene has a reason to; do not append it as a label."
    ),
    "ichidan verb": (
        "It is an ichidan (る-dropping) verb. Mention the conjugation class only "
        "if the scene has a reason to; do not append it as a label."
    ),
    "する verb": (
        "It is a noun plus する. If the noun is one of the kanji listed above, "
        "the story writes itself: the noun is the thing, する is doing it."
    ),
    "transitive verb": (
        "**Transitive** — someone does this *to* something. Japanese teaches "
        "transitive/intransitive as pairs, so make the scene have an object "
        "being acted on; that is what tells this apart from its partner verb."
    ),
    "intransitive verb": (
        "**Intransitive** — this happens by itself, with no one doing it. Make "
        "the scene have no actor doing it to anything; that is what tells this "
        "apart from its partner verb."
    ),
}


def format_word_type(labels):
    """The word-type block for a vocabulary prompt."""
    if not labels:
        return (
            "(unknown — this word is a compound or derived form the curriculum "
            "teaches as grammar, and it has no single part of speech. Say "
            "nothing about word type; do not guess one.)"
        )
    lines = [f"**{', '.join(labels)}**", ""]
    notes = [_WORD_TYPE_NOTE[label] for label in labels if label in _WORD_TYPE_NOTE]
    if notes:
        lines.append("What to do with that:")
        lines.append("")
        lines.extend(f"- {note}" for note in notes)
    else:
        lines.append(
            "Nothing here predicts anything a learner could reuse, so say "
            "nothing about word type — it is already shown in its own field on "
            "the page, and repeating it in the mnemonic wastes the one or two "
            "sentences you have."
        )
    return "\n".join(lines)


def format_vocab_identity(comp, meaning, form):
    """The "is this word just its kanji?" block for a vocabulary prompt."""
    if not comp:
        return (
            "No — this word means something its kanji do not mean on their own, "
            "so write the story."
        )
    syn = " / ".join(dict.fromkeys(comp["meaning_synonyms"]))
    kanji_word = _first_word(comp["meaning"])
    own_word = _first_word(meaning)
    return (
        f"**Yes.** This word is the kanji {comp['char']} “{syn}”, which the "
        "learner has already met, and it means the same thing. Do NOT invent a "
        "second story — the kanji's own story is already the memory hook, and a "
        "competing one only blurs it. Write one or two plain sentences saying "
        "the kanji and the word are the same, in the shape of “The "
        f"<kanji form=\"{comp['char']}\">{kanji_word}</kanji> kanji and the "
        f"<vocabulary form=\"{form}\">{own_word}</vocabulary> word are exactly "
        "the same, so "
        "they mean the same thing.” Both tags go on, wrapping the same word on "
        "two different spans — that is correct here, and it is what colours "
        "both ends of the chain; each span carries its own `form`. Where the "
        "word adds okurigana that changes "
        "what it *does* (白 the kanji, 白い the adjective), one more sentence "
        "says so — see the word type block. The **reading** mnemonic is "
        "unaffected and follows the reading section as usual."
    )


#: Why a derivable reading needs no mnemonic, in the words of its own kind.
#:
#: Rev 7 removes `kana_only` from this map. Both kinds are right that the
#: *decoding* direction needs no hook, but only one of them still has a hook
#: somewhere else on the page. A kanji word's sound rides its kanji, which the
#: meaning mnemonic spends its whole budget on; a kana word has no kanji, so
#: dropping the reading mnemonic left nothing on the page tying 「どれ」 to
#: "which one" — the meaning mnemonic became a scene with no sound in it. Kana
#: words now take `_KANA_BLOCK` instead: still one mnemonic, but that one
#: mnemonic carries both jobs.
_NO_MNEMONIC_REASON = {
    "regular": "it is exactly what this word's kanji already say",
}

#: Rev 6 replaces the Rev 5 derivation note. Naming the pattern (jukugo, kun'yomi,
#: rendaku) was the right *information* and the wrong *place*: it is computed
#: exactly by `reading_regularity`, so a model paraphrasing it can only lose
#: precision, and it ate the whole reading budget. It now ships as the
#: `reading_composition` field, which leaves `reading_mnemonic` with one job —
#: a hook for a sound nothing derives — and lets 745 of N5+N4's 1,247 words
#: carry no reading mnemonic at all.
_NO_MNEMONIC_BLOCK = (
    "**This word gets no reading mnemonic. Omit the `reading_mnemonic` key "
    "entirely.**\n\n"
    "The reading needs no memory hook, because {reason}. The page already tells "
    "the learner exactly that, in its own computed field beside the mnemonics:\n\n"
    "> {composition}\n\n"
    "That line is computed, not written, so there is nothing you could add to "
    "it and no wording of it you could write that would be more accurate. A "
    "sentence "
    "restating it would compete with the field next to it for the one thing the "
    "learner has least of. Write the meaning mnemonic and stop."
)

#: Rev 7, `kana_only`. There is no second field to write, so the instruction is
#: an *addition* to the meaning mnemonic rather than a separate section: the one
#: story has to glue the sound to the meaning, the way the salmon-roe hook does
#: for いくら. Without it a kana word ships a mnemonic that illustrates its
#: meaning and never names its sound, which is unrecoverable for the ko-so-a-do
#: series in particular — sixteen near-identical words whose scenes teach the
#: concept and leave the kana undistinguished.
_KANA_BLOCK = (
    "**This word gets no separate reading mnemonic. Omit the "
    "`reading_mnemonic` key entirely — but the meaning mnemonic below must "
    "carry the sound.**\n\n"
    "There is nothing to *decode* here. The page already says so, in its own "
    "computed field beside your mnemonic:\n\n"
    "> {composition}\n\n"
    "So do not write a sentence about how the word is read. That is not the "
    "gap. The gap is the other direction: this word has no kanji, so nothing "
    "anywhere on the page tells the learner which *sounds* carry this meaning. "
    "For a kanji word the meaning mnemonic answers that by building the word "
    "out of its characters. Here there are no characters to build from, which "
    "frees the whole mnemonic for one job instead.\n\n"
    "**Your meaning mnemonic must make 「{reading}」 and “{meaning}” the same "
    "joke.** Find an English word or phrase that sounds like 「{reading}」 and "
    "let the meaning fall out of what that thing is doing — the sound is the "
    "mechanism, never a label parked beside a scene. Then mark both:\n\n"
    "- the kana 「{reading}」, written verbatim, inside a `<reading>` tag\n"
    "- the English phonetic hook your scene turns on, inside a `<reading>` tag\n"
    "- this word's meaning, once, inside a `<vocabulary>` tag\n\n"
    "This is the one case where `<reading>` appears in a meaning mnemonic, and "
    "it is required here.\n\n"
    "Test it the same way you test a kanji word: if the scene still works with "
    "a different word's meaning dropped into it, the sound is not doing the "
    "work and it is not finished."
)

_REUSE_BLOCK = (
    "**The learner already knows this reading. Write one short sentence "
    "pointing back at the word that taught it — do NOT invent a new hook.**\n\n"
    "Here {char} is read 「{chunk}」, and that is the reading they learned from "
    "**{src_form}（{src_reading}）**, earlier in the course. A second mnemonic "
    "for one sound does not reinforce the first, it competes with it: two rival "
    "images for 「{chunk}」 and the learner is no longer sure which word either "
    "of them belongs to.\n\n"
    "Write **one sentence, roughly 60–170 characters**, doing three things and "
    "nothing more — name {src_form} as the word they already know this reading "
    "from, put this word's reading 「{reading}」 inside a `<reading>` tag, and "
    "land on this word's own meaning inside a `<vocabulary>` tag. The shape:\n\n"
    "> You already know {char} is 「{chunk}」 from {src_form}, so "
    "<vocabulary>{meaning}</vocabulary> is <reading>{reading}</reading>.\n\n"
    "No cast character and no scene. There is nothing here left to remember "
    "that the learner has not already remembered."
)

_STORY_REASON = {
    "kun_word": (
        "This word is a single kanji read with a reading its kanji card does "
        "not teach — that card carries the meaning and the on'yomi. So this "
        "word is where the learner meets 「{reading}」 for the first time, and "
        "no earlier word has taught it either: there is nothing to point back "
        "at and nothing to derive it from."
    ),
    "irregular": (
        "「{reading}」 cannot be assembled from any dictionary reading of this "
        "word's kanji, so the learner has nothing at all to fall back on."
    ),
}

_STORY_BLOCK = (
    "**Write a full reading story.**\n\n"
    "{reason} Write one sentence, or two short ones, cast-driven, with "
    "「{reading}」 in it verbatim.\n\n"
    "Say nothing about *where* the reading comes from. Do not call it a "
    "kun'yomi or an on'yomi, do not name jukugo or rendaku, and do not explain "
    "how it is built — the page carries a computed field beside your mnemonic "
    "which already says:\n\n"
    "> {composition}\n\n"
    "Repeating any of that spends the sentence you needed for the hook. Your "
    "one job here is to make 「{reading}」 stick to this word's meaning."
)


def format_regularity(ctx):
    """The reading section of a vocabulary prompt: write a story, point back at
    the word that already taught this reading, write nothing at all, or — for a
    kana word (Rev 7) — fold the sound hook into the meaning mnemonic, which is
    the only field a word with no kanji has."""
    regularity = ctx["regularity"]
    kind = regularity["kind"]
    composition = ctx["reading_composition"]
    if kind == "kana_only":
        return _KANA_BLOCK.format(
            composition=composition, reading=ctx["reading"],
            meaning=ctx["meaning"])
    if kind in _NO_MNEMONIC_REASON:
        return _NO_MNEMONIC_BLOCK.format(
            reason=_NO_MNEMONIC_REASON[kind], composition=composition)
    taught_by = ctx.get("reading_taught_by")
    if taught_by:
        return _REUSE_BLOCK.format(
            char=taught_by["char"], chunk=taught_by["chunk"],
            src_form=taught_by["form"], src_reading=taught_by["reading"],
            reading=ctx["reading"], meaning=ctx["meaning"])
    return _STORY_BLOCK.format(
        reason=_STORY_REASON[kind].format(reading=ctx["reading"]),
        reading=ctx["reading"], composition=composition)
