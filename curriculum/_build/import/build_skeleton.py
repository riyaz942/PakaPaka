# -*- coding: utf-8 -*-
"""Build the derived kanji corpus (plan v2 Phase A).

The curriculum ships a 2,000-kanji ladder. 192 of them are hand-authored in
`n5_kanji.py` / `n4_kanji.py`; the rest are derived here from KANJIDIC2 and
KRADFILE and written to `curriculum/_build/skeleton.json`, which `generate.py`
and `generate_deps.py` read.

Skeleton, not content: slug, primary_form, meaning, readings, accepted_answers.
No mnemonics, no examples and no art — a mnemonic is owed when a learner
*reaches* an item, never because it exists.

**This file assigns no levels.** Under plan v1 it did: the old-JLPT tag picked
n3/n2/n1 and the slug carried that prefix. v2 makes the level a *band* — a
teaching budget — so `reports/kanji_bands.py` owns level assignment and every
kanji here is level-free, slug included: a slug that named a level would be a
second, stale label for the one the band already carries. The old-JLPT tag
survives as the `jlpt` field: a rank input the band sorts on, not a level it
copies.

Corpus selection, in priority order:
  1. every kanji a shipped N5/N4 word is written with — dropping one would
     orphan a word that is already authored;
  2. the most frequent jōyō kanji, by KANJIDIC2 frequency rank, until 2,000.

Sources (EDRDG, CC BY-SA 4.0; see repo-root NOTICE):
  - KANJIDIC2 — meanings, on'/kun'yomi, old-JLPT level, grade and frequency rank
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
sys.path.insert(0, BUILD_DIR)

import audit_facts  # noqa: E402
import sources  # noqa: E402

#: Levels the curriculum authors vocabulary for. Only these have words, so only
#: these can require a kanji.
AUTHORED_LEVELS = ("n5", "n4")

#: Total kanji on the ladder (plan v2, "The ladder"): 150 + 150 + 400 + 300 +
#: 1,000. 2,136 kanji carry a jōyō grade, so 136 of the rarest are left out.
CORPUS_SIZE = 2000

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
#: This list is now the *hand-glossed* head only. v2's corpus is the whole jōyō
#: set, and `derive_radicals()` below picks up every remaining KRADFILE
#: component automatically, so a new component no longer has to be noticed by a
#: person before it can be taught. Entries stay here because KANJIDIC has no
#: gloss for the form at all (ノ ｜ 亅 𠂉 マ) or because its gloss describes the
#: whole kanji rather than the shape a learner sees in a component slot.
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

#: Components KANJIDIC2 has no entry for, so `derive_radicals()` cannot gloss
#: them. Katakana and kana-like strokes that KRADFILE uses as component keys.
MANUAL_COMPONENT_MEANINGS = {
    "ユ": "elbow",
}

#: KANJIDIC glosses a few components with their Kangxi dictionary entry rather
#: than a picture — "long stride or stretching radical (no. 54)". The number and
#: the word "radical" are catalogue metadata, not a meaning a learner can hold.
_RADICAL_GLOSS_RE = re.compile(r"\s*\(?\bno\.\s*\d+\)?", re.IGNORECASE)
_RADICAL_WORD_RE = re.compile(r"\s*\bradical\b\s*(variant)?", re.IGNORECASE)

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


def authored_slugs():
    """The slugs `n5_kanji.py` / `n4_kanji.py` use, which a derived kanji must
    not take."""
    from n4_kanji import N4_KANJI
    from n5_kanji import N5_KANJI

    return {k["slug"] for k in N5_KANJI} | {k["slug"] for k in N4_KANJI}


def authored_chars():
    """The kanji `n5_kanji.py` / `n4_kanji.py` define.

    Read from the datasets, not from `curriculum/kanji/n*.json`: the generated
    files are grouped by *band* now, so an authored kanji may sit in any of the
    five, and "which file is it in" no longer answers "who wrote it"."""
    from n4_kanji import N4_KANJI
    from n5_kanji import N5_KANJI

    return {k["char"] for k in N5_KANJI} | {k["char"] for k in N4_KANJI}


def vocabulary_uses():
    """{char: [vocab slug, ...]} — kanji the shipped N5/N4 words are written
    with. Every one of these must be in the corpus, however rare: 蜘 ranks
    nowhere in KANJIDIC's frequency list and 蜘蛛 is still a shipped word."""
    uses = {}
    for level in AUTHORED_LEVELS:
        for item in load_level_items("vocabulary", level):
            for ch in dict.fromkeys(item["primary_form"]):
                if is_kanji_char(ch):
                    uses.setdefault(ch, []).append(item["slug"])
    return uses


def select_corpus(kanjidic, required):
    """The CORPUS_SIZE kanji the ladder teaches.

    `required` first — a shipped word may not lose a parent — then jōyō kanji by
    KANJIDIC frequency rank. Frequency, not grade: grade is the order Japanese
    schools teach in, which tracks stroke count and school year rather than what
    a learner meets in text."""
    def freq(char):
        raw = kanjidic[char].get("freq")
        return int(raw) if raw else 99999

    def grade(char):
        raw = kanjidic[char].get("grade")
        return int(raw) if raw else 99

    if len(required) > CORPUS_SIZE:
        raise SystemExit(
            f"{len(required)} kanji are required by shipped content but the corpus is "
            f"{CORPUS_SIZE}; raise CORPUS_SIZE or cut vocabulary."
        )
    joyo = sorted(
        (c for c in kanjidic if grade(c) <= 8 and c not in required),
        key=lambda c: (freq(c), grade(c), c),
    )
    corpus = sorted(required) + joyo[: CORPUS_SIZE - len(required)]
    if len(corpus) < CORPUS_SIZE:
        raise SystemExit(
            f"only {len(corpus)} kanji available for a corpus of {CORPUS_SIZE}"
        )
    return corpus


def slugify(meaning):
    """A slug from a primary English gloss.

    The gloss is the one field that is short, ASCII and near-unique. Two words is enough to stay readable (`brush-stroke`) without
    turning a gloss like "counter for occurrences" into a sentence."""
    words = re.sub(r"[^a-z0-9]+", "-", meaning.lower()).strip("-").split("-")
    return "-".join(w for w in words[:2] if w)


def clean_gloss(meaning):
    """KANJIDIC's Kangxi catalogue wording stripped back to the picture."""
    cleaned = _RADICAL_GLOSS_RE.sub("", meaning)
    cleaned = _RADICAL_WORD_RE.sub("", cleaned)
    return cleaned.strip(" ()") or meaning


def clean_kunyomi(reading):
    """KANJIDIC keeps okurigana behind a '.' (乗: の.る) and marks prefixes and
    suffixes with '-'. The curriculum stores the stem alone, as the shipped
    datasets do (one's kunyomi is ひと, not ひと.つ)."""
    return reading.split(".")[0].strip("-")


def load_previous_slugs():
    """{char: slug} from the checked-in skeleton.json.

    A slug is an identity: `user.db` rows and the mnemonic sidecars are keyed by
    it, and the gloss a slug is minted from can shift when KANJIDIC is refreshed.
    So a char that already has a slug keeps it, and only new corpus entries mint
    one."""
    path = os.path.join(BUILD_DIR, "skeleton.json")
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as f:
        kanji = json.load(f).get("kanji", [])
    if isinstance(kanji, dict):
        # v1 shape: {level: [{suffix, char, ...}]}, slug "n3-<suffix>". The
        # suffix is the identity and survives; the level prefix was the label
        # v2 deleted, so it is dropped rather than frozen.
        return {
            entry["char"]: entry["suffix"]
            for entries in kanji.values()
            for entry in entries
        }
    return {k["char"]: k["slug"] for k in kanji}


def build_kanji_entries(corpus, authored, uses, kanjidic):
    """One entry per corpus kanji that no hand-authored dataset defines.

    Level-free and order-free: `ladder.py` assigns both. The list
    is emitted in frequency order only so a diff of skeleton.json stays legible.
    """
    previous = load_previous_slugs()
    taken = set(previous.values()) | authored_slugs()
    suffix_counts = Counter()
    entries = []
    for char in corpus:
        if char in authored:
            continue
        kd = kanjidic[char]
        slug = previous.get(char)
        if not slug:
            suffix = slugify(kd["meanings"][0])
            suffix_counts[suffix] += 1
            slug = suffix
            while slug in taken:
                suffix_counts[suffix] += 1
                slug = f"{suffix}-{suffix_counts[suffix]}"
            taken.add(slug)
        extras = [
            m
            for m in kd["meanings"][1:]
            if len(m) <= _MAX_EXTRA_MEANING_LEN and "(" not in m
        ][:_MAX_EXTRA_MEANINGS]
        entries.append(
            {
                "slug": slug,
                "char": char,
                "meaning": kd["meanings"][0],
                "onyomi": kd["onyomi"][0] if kd["onyomi"] else "",
                "kunyomi": clean_kunyomi(kd["kunyomi"][0]) if kd["kunyomi"] else "",
                "extra_meanings": extras,
                # Band inputs. `jlpt` is the old-JLPT level KANJIDIC2 tags
                # (4 = easiest), which `reports/kanji_bands.py` ranks on first;
                # `unblocks` is reuse across shipped words; `grade` and `freq`
                # are the tie-breaks below it.
                "unblocks": len(uses.get(char, [])),
                "jlpt": int(kd["jlpt"]) if kd.get("jlpt") else None,
                "grade": int(kd["grade"]) if kd.get("grade") else None,
                "freq": int(kd["freq"]) if kd.get("freq") else None,
            }
        )
    entries.sort(key=lambda e: (e["freq"] or 99999, e["grade"] or 99, e["char"]))
    return entries


def authored_radicals():
    """(form, slug) for every radical `n5_radicals.py` / `n4_radicals.py`
    defines. Read from the datasets for the same reason as `authored_chars`:
    the generated files are grouped by band, not by author."""
    from n4_radicals import N4_RADICALS
    from n5_radicals import N5_RADICALS

    return [(r["form"], r["slug"]) for r in list(N5_RADICALS) + list(N4_RADICALS)]


def krad_variants():
    variants = dict(audit_facts.KRAD_VARIANTS)
    for form, subs in EXTRA_KRAD_VARIANTS.items():
        variants[form] = sorted(set(variants.get(form, [])) | set(subs))
    return variants


def index_by_krad_char(radicals, variants):
    """{KRADFILE component char: radical slug}, expanded through the
    substitution table. First writer wins, so hand-authored radicals keep any
    component a derived one would also claim."""
    by_char = {}
    for form, slug in radicals:
        for variant in set(variants.get(form, [form])) | {form}:
            by_char.setdefault(variant, slug)
    return by_char


def load_previous_radical_slugs():
    """{form: slug} from the checked-in skeleton.json, frozen for the same
    reason kanji slugs are."""
    path = os.path.join(BUILD_DIR, "skeleton.json")
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as f:
        radicals = json.load(f).get("radicals", [])
    if isinstance(radicals, dict):  # v1 shape: {level: [...]}
        radicals = [r for entries in radicals.values() for r in entries]
    return {r["form"]: r["slug"] for r in radicals}


def derive_radicals(chars, kradfile, kanjidic, covered, taken):
    """A radical for every KRADFILE component of a *derived* kanji that nothing
    already teaches.

    Derived kanji only, because this script owns only their decomposition —
    N5/N4's is the curated map in `generate_deps.py`, and a radical it will
    never name would ship building nothing.

    v1 hand-listed these, which set the bar at "someone noticed": 87 components
    of the jōyō set had no radical, and a kanji mnemonic may only name taught
    components, so each one silently shortened a story. Deriving them makes the
    decomposition complete by construction — the ladder's ~240 radicals are the
    KRADFILE component set, not a curated subset of it.

    Most components are kanji in their own right, so KANJIDIC glosses them.
    MANUAL_COMPONENT_MEANINGS covers the rest."""
    previous = load_previous_radical_slugs()
    missing = Counter()
    for char in chars:
        for comp in kradfile.get(char, ()):
            if comp not in covered:
                missing[comp] += 1
    derived = []
    suffix_counts = Counter()
    for comp, _count in sorted(missing.items(), key=lambda kv: (-kv[1], kv[0])):
        gloss = MANUAL_COMPONENT_MEANINGS.get(comp)
        if not gloss and comp in kanjidic and kanjidic[comp]["meanings"]:
            gloss = clean_gloss(kanjidic[comp]["meanings"][0])
        if not gloss:
            raise SystemExit(
                f"component {comp!r} has no KANJIDIC gloss; add it to "
                "MANUAL_COMPONENT_MEANINGS."
            )
        slug = previous.get(comp)
        if not slug:
            suffix = slugify(gloss)
            slug = suffix
            while slug in taken:
                suffix_counts[suffix] += 1
                slug = f"{suffix}-{suffix_counts[suffix] + 1}"
        taken.add(slug)
        derived.append({"slug": slug, "form": comp, "meaning": gloss})
    return derived


def build_decomposition(kanji_entries, kradfile, radical_by_char):
    """{radical slug: [kanji slug, ...]} from KRADFILE, for derived kanji only.
    N5/N4's hand-authored kanji keep the curated maps in `generate_deps.py`.

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
    decomposition = {}
    orphans = []
    for entry in kanji_entries:
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
            decomposition.setdefault(slug, []).append(entry["slug"])
    return decomposition, orphans


def main():
    print("Loading KANJIDIC2 and KRADFILE…")
    kanjidic = sources.load_kanjidic2()
    kradfile = sources.load_kradfile()

    authored = authored_chars()
    uses = vocabulary_uses()
    required = set(uses) | authored
    unknown = [ch for ch in sorted(required) if ch not in kanjidic]
    if unknown:
        raise SystemExit(f"not in KANJIDIC2: {''.join(unknown)}")

    corpus = select_corpus(kanjidic, required)
    kanji_entries = build_kanji_entries(corpus, authored, uses, kanjidic)

    variants = krad_variants()
    hand = authored_radicals() + [(r["form"], r["slug"]) for r in NEW_RADICALS]
    covered = index_by_krad_char(hand, variants)
    derived = derive_radicals(
        [e["char"] for e in kanji_entries], kradfile, kanjidic, covered,
        taken={slug for _form, slug in hand},
    )
    radical_by_char = index_by_krad_char(
        hand + [(r["form"], r["slug"]) for r in derived], variants
    )

    decomposition, orphans = build_decomposition(
        kanji_entries, kradfile, radical_by_char
    )
    if orphans:
        raise SystemExit(
            f"{len(orphans)} corpus kanji have no taught component: {''.join(orphans)}\n"
            "KRADFILE lists no component for them at all — add the shape to "
            "NEW_RADICALS, or to EXTRA_KRAD_VARIANTS if KRADFILE is only writing an "
            "already-taught radical a different way."
        )

    used = set(decomposition)
    unused = sorted({r["slug"] for r in NEW_RADICALS + derived} - used)
    if unused:
        raise SystemExit(f"skeleton radicals that build nothing: {unused}")
    radicals = [r for r in NEW_RADICALS + derived if r["slug"] in used]

    out = {
        "_generated_by": "curriculum/_build/import/build_skeleton.py",
        "corpus_size": len(corpus),
        "radicals": radicals,
        "kanji": kanji_entries,
        "decomposition": decomposition,
    }
    path = os.path.join(BUILD_DIR, "skeleton.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2, sort_keys=False)
        f.write("\n")

    edges = sum(len(v) for v in decomposition.values())
    print(f"Wrote {os.path.relpath(path, CURRICULUM_DIR)}: corpus {len(corpus)} kanji "
          f"({len(authored)} hand-authored, {len(kanji_entries)} derived), "
          f"{len(radicals)} skeleton radicals ({len(derived)} newly derived), "
          f"{edges} builds_on edges.")


if __name__ == "__main__":
    main()
