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
    edges) with their established meaning mnemonics, plus the **reading
    regularity** of the word — computed mechanically from the word's reading
    against its kanji's taught readings, so the "full reading story vs. one-line
    derivation note" choice is checkable by the gate.

Look-alike pairs come from the reviewed R1.3 dataset (_build/visually_similar.py)
— never from the model.

Cast lore for the item's readings is attached here so the generator and any
re-derivation share one code path.
"""

import json
import os
import re
import sys

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CURRICULUM_DIR = os.path.dirname(BUILD_DIR)
if BUILD_DIR not in sys.path:
    sys.path.insert(0, BUILD_DIR)

import furigana as furigana_lib  # noqa: E402
from visually_similar import build_similar_map  # noqa: E402
from generate_content import cast as cast_lib  # noqa: E402

GRAPH_PATH = os.path.join(CURRICULUM_DIR, "dependencies", "graph.json")

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


def decomposition_edges(level):
    """{kanji_slug: [radical_slug, ...]} for builds_on edges radical -> kanji at
    this level. Self/kanji-kanji edges are ignored: mnemonics decompose into
    taught *radicals* only."""
    graph = _load_json(GRAPH_PATH)
    out = {}
    for e in graph["edges"]:
        if (
            e.get("relationship_type") == "builds_on"
            and e.get("from_type") == "radical"
            and e.get("to_type") == "kanji"
            and e.get("to_slug", "").startswith(f"{level}-")
        ):
            out.setdefault(e["to_slug"], []).append(e["from_slug"])
    return out


def kanji_context(level, slug, cast=None):
    kanji = _by_slug(load_items("kanji", level))
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
    comp_slugs = decomposition_edges(level).get(slug, [])
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
        "look_alikes": look_alikes(slug),
        "reading_lore": reading_lore,
        "cast": cast,
    }


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
    }


# --- vocabulary (Rev 1, 2d) ------------------------------------------------

def vocab_component_edges(level):
    """{vocab_slug: [kanji_slug, ...]} for `requires` edges kanji -> vocabulary.

    These are the same edges the app's "Kanji in this word" chips use, so a
    vocab mnemonic may only build on kanji the learner has actually been
    taught."""
    graph = _load_json(GRAPH_PATH)
    out = {}
    for e in graph["edges"]:
        if (
            e.get("relationship_type") == "requires"
            and e.get("from_type") == "kanji"
            and e.get("to_type") == "vocabulary"
        ):
            out.setdefault(e["to_slug"], []).append(e["from_slug"])
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


def _reading_variants(reading):
    """A taught reading plus the regular sound changes Japanese applies when it
    sits inside a compound: rendaku, handakuon, and gemination (がく -> がっ)."""
    r = _hira(reading)
    if not r:
        return set()
    variants = {r}
    if r[0] in _RENDAKU:
        variants.add(_RENDAKU[r[0]] + r[1:])
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


def reading_regularity(form, reading, components):
    """How the word's reading relates to its component kanji's taught readings.

    kind is one of:
      * "kana_only"  — no kanji in the written form; the word is its own reading
      * "untaught"   — the form contains a kanji outside the taught component
                       set, so regularity cannot be judged (treat as a story)
      * "regular"    — every kanji uses one of its taught readings (allowing
                       rendaku/gemination); a one-line derivation note is correct
      * "irregular"  — the reading cannot be built from the taught readings; it
                       needs a full reading story
    `segments` is the [(char, reading_chunk)] breakdown when regular."""
    reading = _hira(reading)
    kanji_in_form = _CJK_RE.findall(form)
    if not kanji_in_form:
        return {"kind": "kana_only", "segments": []}
    variants_by_char = {}
    for comp in components:
        variants = set()
        for r in comp["onyomi"] + comp["kunyomi"]:
            variants |= _reading_variants(r)
        if variants:
            variants_by_char[comp["char"]] = variants
    if any(ch not in variants_by_char for ch in kanji_in_form):
        return {"kind": "untaught", "segments": []}
    segments = _segment(form, reading, variants_by_char)
    if segments is None:
        return {"kind": "irregular", "segments": []}
    return {"kind": "regular", "segments": segments}


def vocab_context(level, slug, cast=None):
    vocab = _by_slug(load_items("vocabulary", level))
    if slug not in vocab:
        raise KeyError(f"unknown vocabulary slug {slug!r} in level {level}")
    item = vocab[slug]

    # Only kanji the learner has already met may appear in a word's story. A
    # word can sit at a level *below* one of its own kanji (N5's 明日 uses 明,
    # taught at N4); that kanji is not a usable component here, and dropping it
    # is also what makes the reading come out "untaught" — i.e. a full story
    # rather than a derivation note the learner could not follow.
    #
    # Plan v2 Phase C put this rule back in force: pull-forward is gone, so a
    # learner really does reach 写真 without having met 写 or 真. The window is
    # right, and it is also what a vocabulary story needs — a story chains from
    # its kanji's *established* stories, and most band kanji have none yet.
    # The plan's separate change, judging reading regularity against KANJIDIC
    # readings rather than taught-status, moves with the authoring queue
    # (reports/kanji_priority.py), not here.
    taught_levels = ALL_LEVELS[:ALL_LEVELS.index(level) + 1]
    kanji = {}
    for lvl in taught_levels:
        kanji.update(_by_slug(load_items("kanji", lvl)))

    form = item["primary_form"]
    readings = _reading_answers(item)
    reading = readings[0] if readings else ""

    comp_slugs = vocab_component_edges(level).get(slug, [])
    components = []
    seen_chars = set()
    for kslug in comp_slugs:
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
    # Component order follows the written form so a story reads left to right.
    components.sort(key=lambda c: form.find(c["char"]) if c["char"] in form else len(form))

    cast = cast or cast_lib.load_cast()
    regularity = reading_regularity(form, reading, components)

    return {
        "type": "vocab",
        "level": level,
        "slug": slug,
        "form": form,
        "meaning": item["meaning"],
        "meaning_synonyms": _meaning_answers(item) or [item["meaning"]],
        "reading": reading,
        "components": components,
        "regularity": regularity,
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


def format_vocab_components(components):
    if not components:
        return ("(none taught — this word's kanji are not in the taught set, or it "
                "is written in kana. Write a standalone story for the word itself, "
                "and do NOT name any kanji the learner has not been taught.)")
    lines = []
    for c in components:
        if not c["meaning_mnemonic"]:
            # Same ordering rule one layer up: kanji -> vocabulary.
            raise ValueError(
                f"component kanji {c['slug']} has no `meaning_mnemonic` yet. "
                "Regenerate the kanji layer first (`generate_mnemonics run "
                "--type kanji` for the level that teaches it, then "
                "`generate.py --level <level>`)."
            )
        syn = " / ".join(dict.fromkeys(c["meaning_synonyms"]))
        readings = "、".join(c["onyomi"] + c["kunyomi"]) or "(none)"
        lines.append(
            f"- {c['char']} — “{syn}” (taught readings: {readings})\n"
            f"  Its established meaning story, which yours should hook into: "
            f"{c['meaning_mnemonic']}"
        )
    return "\n".join(lines)


_REGULARITY_BLOCK = {
    "regular": (
        "**Regular.** The reading is exactly what the kanji you already taught "
        "say: {segments}. Do NOT write a reading story for this word — write a "
        "one-line derivation note that points at the readings the learner "
        "already knows and contains 「{reading}」."
    ),
    "kana_only": (
        "**Kana only.** This word is written the way it sounds, so there is no "
        "reading to decode. Do NOT write a reading story — write a one-line note "
        "saying the word is written in kana exactly as it is read, containing "
        "「{reading}」."
    ),
    "irregular": (
        "**Irregular.** 「{reading}」 cannot be assembled from the taught readings "
        "of this word's kanji, so the learner has nothing to fall back on. Write "
        "a full reading story, cast-driven, with 「{reading}」 in it verbatim."
    ),
    "untaught": (
        "**Not derivable.** This word contains kanji outside the taught set, so "
        "the reading cannot be derived from anything the learner knows. Write a "
        "full reading story, cast-driven, with 「{reading}」 in it verbatim."
    ),
}


def format_regularity(regularity, reading):
    segments = "＋".join(f"{ch}（{chunk}）" for ch, chunk in regularity["segments"])
    return _REGULARITY_BLOCK[regularity["kind"]].format(
        segments=segments, reading=reading)
