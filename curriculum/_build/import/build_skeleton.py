# -*- coding: utf-8 -*-
"""Build the N3/N2/N1 skeleton dataset (plan Phase 2).

The skeleton exists for one reason: every kanji in a word must be taught before
the word is. 553 kanji are used by shipped N5/N4 vocabulary and authored
nowhere, so those words reach the learner with no chain behind them. This
script derives an item list for exactly those 553 — no more — and writes it to
`curriculum/_build/skeleton.json`, which `generate.py` and `generate_deps.py`
read.

Skeleton, not content: slug, primary_form, meaning, readings, accepted_answers,
sort_order. No mnemonics, no examples, no art, and no N3+ vocabulary — N3+ words
would drag in their own untaught kanji and restart the same problem one level up.

Sources (EDRDG, CC BY-SA 4.0; see repo-root NOTICE):
  - KANJIDIC2 — meanings, on'/kun'yomi, the old JLPT tag used to pick a level
  - KRADFILE  — the component decomposition behind radical -> kanji edges

The output is checked in, so a graph rebuild never needs the source archives.
Re-run after the shipped vocabulary changes:

    python3 curriculum/_build/import/build_skeleton.py
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

import audit_facts  # noqa: E402
import sources  # noqa: E402

#: Levels the curriculum authors in full. Everything else is skeleton.
AUTHORED_LEVELS = ("n5", "n4")

#: KANJIDIC2's `jlpt` tag is the *old* four-level exam (4 easiest, 1 hardest).
#: It is the only per-kanji difficulty signal the open sources carry, so it
#: picks the skeleton level. Tag 4 means "old-JLPT easiest" — the six kanji that
#: carry it are gaps in the shipped N5/N4 lists (何 空 父 母 友 魚), not N3
#: content; they sit at N3 with the rest of the skeleton until someone authors
#: them properly (plan Phase 4). Untagged kanji were on no old list at all
#: (誰 箸 鍋 …); modern lists put them at N1.
LEVEL_BY_JLPT_TAG = {"4": "n3", "3": "n3", "2": "n2", "1": "n1", None: "n1"}

SKELETON_LEVELS = ("n3", "n2", "n1")

#: New radicals for the skeleton levels.
#:
#: The first ten are Phase 2's: the components of skeleton kanji that no
#: already-taught radical decomposes at all. Phase 2's bar was one radical
#: parent per kanji, which is all a skeleton needs — a kanji with no mnemonic
#: has no story for a component to be missing from.
#:
#: The rest are Phase 4's, and the bar is different. A kanji mnemonic must
#: account for the whole shape and may name only taught components
#: (`mnemonic_context.format_components`), so a decomposition that quietly drops
#: KRADFILE components produces a story about the wrong character: 私 built from
#: 厶 alone ignores 禾, its left two-thirds. 291 of the 553 skeleton kanji had a
#: component covered by nothing taught. These 20 close 187 of them, and are
#: picked to cover the whole of the current authoring queue's front — see
#: reports/kanji_priority.py — rather than by raw frequency alone: 皮 免 匚 are
#: rare overall but each blocks a kanji a learner meets in their first fortnight.
#:
#: Six are also taught as kanji (大 買 自 走, plus 元 音 in the skeleton). That
#: pairing is not new — 皿 and 長 already ship as both — and it is the honest
#: description of the shape: 奥 contains 大 whether or not the learner has met
#: 大 the kanji.
#:
#: `_assert_orphans_covered` fails the build if the data ever moves out from
#: under this list.
NEW_RADICALS = [
    # Phase 2 — kanji that decompose into nothing otherwise.
    {"slug": "katahen", "form": "方", "meaning": "direction"},
    {"slug": "bun-writing", "form": "文", "meaning": "writing"},
    {"slug": "mochiiru", "form": "用", "meaning": "use"},
    {"slug": "sara", "form": "皿", "meaning": "dish"},
    {"slug": "amai", "form": "甘", "meaning": "sweet"},
    {"slug": "konzukuri", "form": "艮", "meaning": "stopping"},
    {"slug": "mi-body", "form": "身", "meaning": "body"},
    {"slug": "men-face", "form": "面", "meaning": "face / surface"},
    {"slug": "hiyominotori", "form": "酉", "meaning": "sake jar"},
    {"slug": "kemonohen", "form": "犭", "meaning": "animal"},
    # Phase 4 — components a mnemonic cannot honestly leave out.
    {"slug": "no-slide", "form": "ノ", "meaning": "slide"},
    {"slug": "bou-stick", "form": "｜", "meaning": "stick"},
    {"slug": "dai-big", "form": "大", "meaning": "big"},
    {"slug": "hakenobou", "form": "亅", "meaning": "barb"},
    {"slug": "gandare", "form": "厂", "meaning": "cliff"},
    {"slug": "nijuuashi", "form": "廾", "meaning": "two hands"},
    {"slug": "kanamuri", "form": "𠂉", "meaning": "chevron"},
    {"slug": "warifu", "form": "卩", "meaning": "stamp"},
    {"slug": "nogihen", "form": "禾", "meaning": "grain"},
    {"slug": "tsume", "form": "爪", "meaning": "claw"},
    {"slug": "kau-buy", "form": "買", "meaning": "buy"},
    {"slug": "tsukue", "form": "几", "meaning": "table"},
    {"slug": "shou-esteem", "form": "尚", "meaning": "esteem"},
    {"slug": "ukebako", "form": "凵", "meaning": "open box"},
    {"slug": "ma-hook", "form": "マ", "meaning": "hook"},
    {"slug": "mizukara", "form": "自", "meaning": "self"},
    {"slug": "hashiru-run", "form": "走", "meaning": "run"},
    {"slug": "kawa-skin", "form": "皮", "meaning": "skin"},
    {"slug": "men-exempt", "form": "免", "meaning": "exempt"},
    {"slug": "hakogamae", "form": "匚", "meaning": "box on its side"},
]

#: KRADFILE substitutions that `audit_facts.KRAD_VARIANTS` does not carry yet.
#: KRADFILE indexes a few radicals by a whole kanji that contains them; without
#: these, 忄 and 疒 look untaught and 性 悩 痛 come out with no component at all.
EXTRA_KRAD_VARIANTS = {
    "忄": ["忙"],
    "疒": ["疔"],
    "犭": ["犯"],
    # KRADFILE writes the four fire dots as 杰 and never as 灬, so `rekka` — an
    # N5 radical since the first release — looked untaught on all 318 kanji that
    # carry it, 魚 and 黒 among them. A mapping gap, not missing content.
    "灬": ["杰"],
    # Likewise the chevron: KRADFILE keys it 乞, which is a different character
    # (`beg`) and the wrong picture to show a learner. The radical ships as 𠂉.
    "𠂉": ["乞"],
}

#: A meaning gloss only becomes an extra accepted answer when it is a plain
#: short synonym. KANJIDIC's tail glosses run to "counter for occurrences" and
#: parenthetical notes, which are documentation, not answers.
_MAX_EXTRA_MEANING_LEN = 20
_MAX_EXTRA_MEANINGS = 2


def load_level_items(kind, level):
    path = os.path.join(CURRICULUM_DIR, kind, f"{level}.json")
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        return json.load(f)["items"]


def is_kanji_char(ch):
    return "一" <= ch <= "鿿"


def untaught_kanji():
    """{char: [vocab slug, ...]} — kanji used by shipped vocabulary, taught
    nowhere. Same measurement as reports/dependency_order.py's coverage table."""
    taught = {
        item["primary_form"]
        for level in AUTHORED_LEVELS
        for item in load_level_items("kanji", level)
    }
    uses = {}
    for level in AUTHORED_LEVELS:
        for item in load_level_items("vocabulary", level):
            for ch in dict.fromkeys(item["primary_form"]):
                if is_kanji_char(ch) and ch not in taught:
                    uses.setdefault(ch, []).append(item["slug"])
    return uses


def slugify(meaning):
    """A kanji's slug suffix from its primary English gloss.

    The shipped N5/N4 suffixes are hand-picked romaji; 553 generated entries
    need a rule instead, and the gloss is the one field that is short, ASCII and
    near-unique. Two words is enough to stay readable (`brush-stroke`) without
    turning a gloss like "counter for occurrences" into a sentence."""
    words = re.sub(r"[^a-z0-9]+", "-", meaning.lower()).strip("-").split("-")
    return "-".join(w for w in words[:2] if w)


def clean_kunyomi(reading):
    """KANJIDIC keeps okurigana behind a '.' (乗: の.る) and marks prefixes and
    suffixes with '-'. The curriculum stores the stem alone, as the shipped
    datasets do (n5-ichi's kunyomi is ひと, not ひと.つ)."""
    return reading.split(".")[0].strip("-")


def build_kanji_entries(uses, kanjidic):
    """One skeleton entry per untaught kanji, grouped by level.

    Ordered by how many shipped words each kanji unblocks, which is the order
    Phase 4 authors them in and the order the Phase 3 planner will pull them
    forward in."""
    by_level = {level: [] for level in SKELETON_LEVELS}
    suffix_counts = Counter()
    ranked = sorted(
        uses.items(),
        key=lambda kv: (-len(kv[1]), int(kanjidic[kv[0]]["freq"] or 99999), kv[0]),
    )
    for char, vocab_slugs in ranked:
        kd = kanjidic[char]
        level = LEVEL_BY_JLPT_TAG[kd["jlpt"]]
        suffix = slugify(kd["meanings"][0])
        suffix_counts[suffix] += 1
        if suffix_counts[suffix] > 1:
            suffix = f"{suffix}-{suffix_counts[suffix]}"
        extras = [
            m
            for m in kd["meanings"][1:]
            if len(m) <= _MAX_EXTRA_MEANING_LEN and "(" not in m
        ][:_MAX_EXTRA_MEANINGS]
        by_level[level].append(
            {
                "suffix": suffix,
                "char": char,
                "meaning": kd["meanings"][0],
                "onyomi": kd["onyomi"][0] if kd["onyomi"] else "",
                "kunyomi": clean_kunyomi(kd["kunyomi"][0]) if kd["kunyomi"] else "",
                "extra_meanings": extras,
                "unblocks": len(vocab_slugs),
            }
        )
    return by_level


def taught_radical_slug_by_krad_char():
    """{KRADFILE component char: radical slug} over the shipped radicals plus
    the new skeleton ones, expanded through the substitution table."""
    variants = dict(audit_facts.KRAD_VARIANTS)
    for form, subs in EXTRA_KRAD_VARIANTS.items():
        variants[form] = sorted(set(variants.get(form, [])) | set(subs))
    radicals = [
        (item["primary_form"], item["slug"])
        for level in AUTHORED_LEVELS
        for item in load_level_items("radicals", level)
    ]
    radicals += [(r["form"], r["slug"]) for r in NEW_RADICALS]
    by_char = {}
    for form, slug in radicals:
        for variant in set(variants.get(form, [form])) | {form}:
            by_char.setdefault(variant, slug)
    return by_char


def build_decomposition(kanji_by_level, kradfile, radical_by_char):
    """{level: {radical slug: [kanji suffix, ...]}} from KRADFILE.

    Every component KRADFILE names that resolves to a taught radical becomes a
    `builds_on` edge — including a component that *is* the kanji (皿 is both a
    radical and a kanji, the same pairing 長 already ships with). Components
    that resolve to nothing are still dropped, but Phase 4's NEW_RADICALS
    entries mean far fewer of them do.

    KRADFILE lists sub-strokes alongside the piece they belong to: 彼 comes back
    as 彳 + 皮 + 又, and 又 is only there because it is inside 皮. Phase 2 could
    ignore that — a skeleton kanji has no story for a component to clutter. A
    mnemonic cannot: the gate requires *every* listed component to be named and
    highlighted, so an un-pruned 彼 owes the learner a story about a right hand
    that is not separately there. Keeping only maximal components — drop any
    component contained in another one KRADFILE also lists — gives 彼 = 彳 + 皮,
    晩 = 日 + 免, 徒 = 彳 + 走.

    Bigger components are tested first so that mutual containment keeps the
    larger piece rather than dropping both.

    Only a *taught* component may prune another. KRADFILE lists most kanji as
    one of their own components, so letting untaught pieces prune would let 元
    suppress its own 二 and 儿 and leave the kanji with no parent at all — the
    reverse of the intent."""
    decomposition = {level: {} for level in SKELETON_LEVELS}
    orphans = []
    for level, entries in kanji_by_level.items():
        for entry in entries:
            taught = [c for c in kradfile.get(entry["char"], []) if c in radical_by_char]
            maximal = []
            for comp in sorted(taught, key=lambda c: -len(kradfile.get(c, ()))):
                if any(comp != kept and comp in kradfile.get(kept, ()) for kept in maximal):
                    continue
                maximal.append(comp)
            parents = {radical_by_char[comp] for comp in maximal}
            if not parents:
                orphans.append(entry["char"])
                continue
            for slug in sorted(parents):
                decomposition[level].setdefault(slug, []).append(entry["suffix"])
    return decomposition, orphans


def radical_levels(decomposition):
    """The level each new radical is taught at: the earliest level of any kanji
    it builds, so a component is never studied after the kanji that needs it."""
    level_by_slug = {}
    for level in SKELETON_LEVELS:
        for slug in decomposition[level]:
            level_by_slug.setdefault(slug, level)
    return level_by_slug


def main():
    print("Loading KANJIDIC2 and KRADFILE…")
    kanjidic = sources.load_kanjidic2()
    kradfile = sources.load_kradfile()

    uses = untaught_kanji()
    unknown = [ch for ch in uses if ch not in kanjidic]
    if unknown:
        raise SystemExit(f"not in KANJIDIC2: {''.join(unknown)}")

    kanji_by_level = build_kanji_entries(uses, kanjidic)
    radical_by_char = taught_radical_slug_by_krad_char()
    decomposition, orphans = build_decomposition(
        kanji_by_level, kradfile, radical_by_char
    )
    if orphans:
        raise SystemExit(
            f"{len(orphans)} skeleton kanji have no taught component: {''.join(orphans)}\n"
            "Add the missing component to NEW_RADICALS (or EXTRA_KRAD_VARIANTS if "
            "KRADFILE is only writing an already-taught radical a different way)."
        )

    new_by_slug = {r["slug"]: r for r in NEW_RADICALS}
    level_by_slug = radical_levels(decomposition)
    unused = sorted(set(new_by_slug) - set(level_by_slug))
    if unused:
        raise SystemExit(f"NEW_RADICALS entries that build nothing: {unused}")
    radicals_by_level = {level: [] for level in SKELETON_LEVELS}
    for slug, level in level_by_slug.items():
        if slug in new_by_slug:
            radicals_by_level[level].append(new_by_slug[slug])

    out = {
        "_generated_by": "curriculum/_build/import/build_skeleton.py",
        "levels": list(SKELETON_LEVELS),
        "radicals": radicals_by_level,
        "kanji": kanji_by_level,
        "decomposition": decomposition,
    }
    path = os.path.join(BUILD_DIR, "skeleton.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2, sort_keys=False)
        f.write("\n")

    total_kanji = sum(len(v) for v in kanji_by_level.values())
    total_radicals = sum(len(v) for v in radicals_by_level.values())
    print(f"Wrote {os.path.relpath(path, CURRICULUM_DIR)}: "
          f"{total_kanji} kanji, {total_radicals} new radicals.")
    for level in SKELETON_LEVELS:
        print(f"  {level.upper()}: {len(kanji_by_level[level])} kanji, "
              f"{len(radicals_by_level[level])} radicals, "
              f"{sum(len(v) for v in decomposition[level].values())} builds_on edges")


if __name__ == "__main__":
    main()
