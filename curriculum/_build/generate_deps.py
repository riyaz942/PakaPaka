# -*- coding: utf-8 -*-
"""Rebuild curriculum/dependencies/graph.json from generated curriculum JSON.

Edge types produced:
  - radical  -> kanji       (builds_on)  : radical is a visual component of the kanji
  - kanji    -> vocabulary  (requires)   : kanji in the word, taught at or before
                                           the word's level — gates the word
  - kanji    -> vocabulary  (builds_on)  : kanji in the word, taught at a later
                                           level — does not gate the word
  - grammar  -> vocabulary  (reinforces) : vocab explicitly linked from a grammar point

Radical->kanji edges are derived from a curated decomposition map (component
radical slug -> list of kanji suffixes). Kanji->vocab edges are derived
automatically by scanning vocab primary_form for the kanji character.

Kanji->vocabulary edges are **band-gated** (plan v2 Phase C). Only a kanji whose
band is the word's level or earlier emits `requires`; the lesson planner scopes
candidates to one level, so a later-band parent would be a gate the learner can
never open. Out-of-band kanji still get an edge — `builds_on`, the graph's
non-gating "is a component of" relationship — because the app reads it for two
things: the component chips on the word, and rule 1's reading gate, which
withholds a word's reading prompt until every kanji in it reaches guru.

Skeleton levels (N3/N2/N1, kanji only) take their decomposition from the
generated map in skeleton.json.
"""

import json
import os

BUILD_DIR = os.path.dirname(os.path.abspath(__file__))
CURRICULUM_DIR = os.path.dirname(BUILD_DIR)

#: Levels authored in full, and the skeleton levels behind them
#: (docs/content/kanji-coverage-and-dependency-order-plan.md Phase 2).
AUTHORED_LEVELS = ["n5", "n4"]
SKELETON_LEVELS = ["n3", "n2", "n1"]
ALL_LEVELS = AUTHORED_LEVELS + SKELETON_LEVELS

#: Teaching order of the levels, for the band comparison on kanji->vocab edges.
LEVEL_ORDER = {level: index for index, level in enumerate(ALL_LEVELS)}


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_level_items(kind, level):
    """Items of one kind at one level, each tagged with the level it came from."""
    p = os.path.join(CURRICULUM_DIR, kind, f"{level}.json")
    if not os.path.exists(p):
        return []
    return [dict(item, _level=level) for item in load(p)["items"]]


# Curated radical (slug) -> kanji (suffix) decomposition for N5.
# Keyed by radical slug from n5_radicals.py; values are kanji suffixes from n5_kanji.py.
N5_DECOMPOSITION = {
    "ichi": ["ichi", "hon", "hyaku", "hidariuma", "uenagashi", "shita",
             "hidari", "migi", "ten"],
    "ni": ["ni"],
    "san": ["san"],
    "juu": ["juu", "sen", "minami", "furui", "hayai", "hantime"],
    "hachigashira": ["hachi", "roku", "bun-minute"],
    "hito": ["hito-jin", "yasumu", "kon-now", "suwaru"],
    "ninben": ["yasumu"],
    "hitoashi": ["sensei-saki", "miru", "uru-baku", "dokusho"],
    "ireru": ["hairu"],
    "kuchi": ["kuchi", "yon", "meiname", "furui", "iu-gen", "go-language", "hanashi-wa", "naka", "takai", "migi", "ashi"],
    "kunigamae": ["yon", "kuni"],
    "onna": ["onna", "yasui"],
    "ko": ["ko-child", "gaku"],
    "chikara": ["chikara", "otoko"],
    "ta": ["otoko", "machi", "denki-den"],
    "tsuchi": ["do-earth", "suwaru", "sei-life", "jikan-ji"],
    "yamahen": ["yama", "deru"],
    "kawa": ["kawa"],
    "shou": ["shou-small", "sukunai"],
    "me": ["me-eye", "miru"],
    "mimi": ["mimi", "kiku-hear"],
    "te": ["te-hand"],
    "ashi-foot": ["ashi"],
    "hi-sun": ["nichi", "higashi", "hayai", "ma-interval", "jikan-ji", "kaku-write", "nichiyou"],
    "tsuki": ["gatsu", "mae", "ao"],
    "ki": ["moku", "higashi", "hon", "kou-school", "yasumu", "atarashii", "kuru-rai"],
    "mizu": ["sui"],
    "hi-fire": ["ka-fire"],
    "kanehen": ["kin"],
    "kai-shell": ["kau"],
    "mongamae": ["ma-interval", "kiku-hear"],
    "ame": ["ame-rain", "denki-den"],
    "kuruma": ["sha-car"],
    "shinnyou": ["michi", "shu-week"],
    "gonben": ["iu-gen", "go-language", "hanashi-wa", "dokusho"],
    "takai": ["takai"],
    "uma": ["eki-station"],
    "ao": ["ao"],
    "shiro": ["shiro-white", "hyaku"],
    "aka": ["aka"],
    "kuro": ["kane-gold-dup"],
    "tomeru": ["tomeru", "ashi"],
    "tatsu": ["tatsu", "atarashii"],
    "miru": ["miru"],
    "shita": ["hanashi-wa"],
    "haba": ["shi-city", "kaeru"],
    "kakeru": ["nomu"],
    # Decomposition sweep (2026-08-09): components that were already taught but
    # had no edge to the kanji they build, and the radicals added alongside them
    # in n5_radicals.py. 31 of 106 N5 kanji had no `builds_on` parent at all.
    "hitoyane": ["roku", "kou-school", "shi-city"],
    "keigamae": ["minami", "en"],
    "kougatsu": ["hidari"],
    "mannaka": ["nen"],
    "kusakanmuri": ["hana"],
    "itoko": ["ushiro"],
    "chichi": ["kou-school"],
    "sun": ["jikan-ji"],
    "katana": ["bun-minute"],
    "boku-divination": ["uenagashi", "shita", "hoku"],
    "hi-spoon": ["nana", "kita"],
    "ukanmuri": ["yasui"],
    "yuu-evening": ["hoku", "ooi-ta", "meiname"],
    "fuyugashira": ["ushiro"],
    "samurai": ["uru-baku", "dokusho"],
    "gyouninben": ["iku-go", "ushiro"],
    "keigashira": ["kaeru", "nichiyou"],
    "kigamae": ["ki-spirit"],
    "haha": ["mai-every"],
    "fudezukuri": ["kaku-write"],
    "karai": ["atarashii"],
    "kubi": ["michi"],
    # 長 is taught as both a radical and a kanji; every other such pair is
    # linked, so 長's kanji was the only one shipping with no component chip.
    "nagai": ["nagai"],
}


# Curated radical (slug) -> kanji (suffix) decomposition for N4.
# Keyed by radical slug from n4_radicals.py (new radicals) or n5_radicals.py
# (reused components); values are kanji suffixes from n4_kanji.py.
#
# Rebuilt in the N4 skeleton pass (2026-08-10) against KRADFILE: every taught
# component of every N4 kanji is now either an edge here or an entry in
# audit_shipped.DECOMPOSITION_EXCEPTIONS. A component already taught at N5 is
# keyed by its N5 slug — the 13 N4 radicals that re-taught an N5 form are gone.
N4_DECOMPOSITION = {
    # Radicals introduced at N4.
    "bokuzukuri": ["kyou-teach"],
    "furutori": ["atsumeru"],
    "gatsuhen": ["nokoru", "shinu"],
    "hane": ["narau"],
    "hatsugashira": ["hatsu"],
    "hitsuji": ["gyou", "kiru-wear", "hitsuji"],
    "hoko": ["heru-decrease", "nokoru"],
    "inoko": ["ie-kanji"],
    "itaru": ["shitsu"],
    "kokoro": ["hitsu", "isogu", "omou", "shin-heart", "warui", "wasureru"],
    "madare": ["hiroi", "mise"],
    "mata": ["karui", "kei-pass"],
    "mu": ["hajimeru", "hiroi", "kai", "tsuyoi"],
    "nari": ["chi"],
    "nisui": ["yowai"],
    "oigashira": ["kangaeru", "kyou-teach", "mono"],
    "ono": ["shitsu-quality", "tokoro"],
    "ou-king": ["ri", "shu-main"],
    "sato": ["omoi", "ri"],
    "shikabane": ["todoku"],
    "shikigamae": ["kasu", "shi-try"],
    "to-dipper": ["ryou-fee"],
    "tobira": ["modoru", "tokoro"],
    "tsutsumu": ["iro", "isogu", "kangaeru"],
    "wakanmuri": ["hakobu", "oboeru", "tsuzukeru"],
    "ya": ["shiru", "zoku"],
    # Phase 4. `katahen` (方) arrived with the Phase 2 skeleton, keyed to N3
    # because that is where 旅 needs it, and these three N4 kanji were left with
    # no edge to it — 方's own kanji shipped without a component chip at all.
    # Promoting it to N4 was rejected at the time because it would have put a
    # mnemonic-less, art-less card into a lesson a learner reaches today. It has
    # a mnemonic now, and `listLessonCandidatePool` pulls a component forward to
    # sit just ahead of the kanji that needs it, so the level it is filed under
    # no longer decides when the learner meets it. The edges are all that was
    # missing.
    "katahen": ["hou", "asobu", "zoku"],
    # N5 radicals reused as components of N4 kanji.
    "boku-divination": ["mise"],
    "chikara": ["betsu", "hataraku"],
    "fuyugashira": ["kawaru", "owaru"],
    "gonben": ["shi-try", "shiraberu"],
    "haba": ["ane"],
    "hi-spoon": ["shinu"],
    "hi-sun": ["akarui", "ba", "fueru", "hataraku", "kariru", "kurai", "mono", "omoi"],
    "hito": ["kai"],
    "hitoashi": ["ani", "arau", "hatsu", "tsuzukeru"],
    "hitoyane": ["ane", "kawaru"],
    "ichi": ["ba", "dou", "gyou", "hataraku", "kotae", "koto", "omoi", "tsukau", "uta"],
    "itohen": ["hosoi", "kei-pass", "owaru", "tsuzukeru"],
    "kai-shell": ["kasu", "shitsu-quality"],
    "kakeru": ["uta"],
    "katana": ["betsu"],
    "keigamae": ["dou"],
    "keigashira": ["isogu", "koto"],
    "ki": ["aji", "atsumeru", "gyou", "imouto", "oya"],
    "ko": ["asobu", "kyou-teach", "suki"],
    "kome": ["ryou-fee"],
    "kougatsu": ["shi-try"],
    "kuchi": ["aji", "ani", "betsu", "chigau", "dou", "hajimeru", "heru-decrease", "kotae", "koto", "mise", "shiru", "tsukau", "uta"],
    "kunigamae": ["zu"],
    "kuruma": ["hakobu", "karui"],
    "me": ["ji-self", "kiru-wear"],
    "miru": ["oboeru", "oya"],
    "mushi": ["tsuyoi"],
    "ni": ["hatsu", "kai", "kariru"],
    "ninben": ["hataraku", "kariru", "kasu", "tsukau"],
    "onna": ["ane", "hajimeru", "imouto", "suki", "you-need"],
    "samurai": ["tsuzukeru"],
    "sanzui": ["arau", "heru-decrease", "kimeru"],
    "shimesu": ["sha"],
    "shinnyou": ["asobu", "chigau", "erabu", "hakobu", "okuru"],
    "shiro": ["narau"],
    "sun": ["motsu"],
    "ta": ["fueru", "hosoi", "omou"],
    "takekanmuri": ["kotae"],
    "tatsu": ["kurai", "oya"],
    "tehen": ["motsu"],
    "ten": ["futoi", "shu-main"],
    "tsuchi": ["ba", "chi", "fueru", "hashiru", "karui", "kei-pass", "motsu", "sha"],
    "tsuki": ["akarui"],
    "ukanmuri": ["ie-kanji", "shitsu"],
    "uma": ["ken-exam"],
    "yumi": ["hiku", "otouto", "tsuyoi", "yowai"],
}


def load_skeleton_decomposition():
    """{radical slug: [kanji slug, ...]} for the derived corpus.

    Generated from KRADFILE by import/build_skeleton.py and checked in, so this
    stays symmetric with the hand-curated N5/N4 maps above: same validation, no
    source archives needed at graph-build time. It names kanji by slug rather
    than by suffix because a derived kanji has no separate suffix to key on."""
    path = os.path.join(BUILD_DIR, "skeleton.json")
    if not os.path.exists(path):
        return {}
    return load(path)["decomposition"]


def build_edges(levels):
    radicals = []
    kanji = []
    vocab = []
    grammar = []
    for lvl in levels:
        radicals += load_level_items("radicals", lvl)
        kanji += load_level_items("kanji", lvl)
        vocab += load_level_items("vocabulary", lvl)
        grammar += load_level_items("grammar", lvl)

    kanji_by_suffix = {}
    for k in kanji:
        # slug is like "n5-ichi"; suffix after first dash-level prefix
        kanji_by_suffix[k["slug"]] = k

    edges = []
    seen = set()

    def add(fs, ft, ts, tt, rel):
        key = (fs, ft, ts, tt, rel)
        if key in seen:
            return
        seen.add(key)
        edges.append({
            "from_slug": fs,
            "from_type": ft,
            "to_slug": ts,
            "to_type": tt,
            "relationship_type": rel,
        })

    radical_slugs = {r["slug"] for r in radicals}
    kanji_slugs = {k["slug"] for k in kanji}

    # radical -> kanji (builds_on), from the curated maps plus the derived one.
    #
    # Keyed by *source dataset*, not by level: since plan v2 a kanji's level is
    # a band it can move between, while its slug keeps the prefix of whoever
    # wrote it. `n5-en` stays `n5-en` in the N3 band, so the curated N5 map
    # still resolves it.
    decomposition_by_source = {"n5": N5_DECOMPOSITION, "n4": N4_DECOMPOSITION}
    # A key that resolves to nothing is a typo or a renamed/removed item, and
    # silently skipping it is how radicals went missing from kanji chips
    # unnoticed. Fail the build instead.
    for source, decomposition in decomposition_by_source.items():
        for rad_slug, kanji_suffixes in decomposition.items():
            if rad_slug not in radical_slugs:
                raise ValueError(
                    f"{source} decomposition: radical slug {rad_slug!r} is not a taught radical"
                )
            if not kanji_suffixes:
                raise ValueError(
                    f"{source} decomposition: radical slug {rad_slug!r} has an empty kanji "
                    "list; drop the key instead"
                )
            for suf in kanji_suffixes:
                kslug = f"{source}-{suf}"
                if kslug not in kanji_slugs:
                    raise ValueError(
                        f"{source} decomposition: {rad_slug!r} lists kanji {kslug!r}, which is "
                        "not a taught kanji"
                    )
                add(rad_slug, "radical", kslug, "kanji", "builds_on")

    # The derived corpus names kanji by slug already.
    for rad_slug, kanji_slugs_listed in load_skeleton_decomposition().items():
        if rad_slug not in radical_slugs:
            raise ValueError(
                f"skeleton decomposition: radical slug {rad_slug!r} is not a taught radical"
            )
        for kslug in kanji_slugs_listed:
            if kslug not in kanji_slugs:
                raise ValueError(
                    f"skeleton decomposition: {rad_slug!r} lists kanji {kslug!r}, which is "
                    "not a taught kanji"
                )
            add(rad_slug, "radical", kslug, "kanji", "builds_on")

    # kanji -> vocabulary: kanji char appears in vocab primary_form.
    #
    # `requires` only from a kanji whose band is the word's level or earlier —
    # the gate the learner can satisfy inside the level they are studying. A
    # later-band kanji (写 at N3 in the N5 word 写真) keeps a `builds_on` edge:
    # the word is taught on schedule and asked for its meaning, and the edge is
    # what tells the app the reading prompt is not live yet.
    for k in kanji:
        char = k["primary_form"]
        if not char:
            continue
        kanji_band = LEVEL_ORDER[k["_level"]]
        for v in vocab:
            if char in v["primary_form"]:
                in_band = kanji_band <= LEVEL_ORDER[v["_level"]]
                add(
                    k["slug"], "kanji", v["slug"], "vocabulary",
                    "requires" if in_band else "builds_on",
                )

    # grammar -> vocabulary (reinforces): explicit vocabulary_slugs links.
    vocab_slugs = {v["slug"] for v in vocab}
    for g in grammar:
        for vs in g.get("vocabulary_slugs", []):
            if vs in vocab_slugs:
                add(g["slug"], "grammar", vs, "vocabulary", "reinforces")

    return edges


def main():
    levels = []
    for lvl in ALL_LEVELS:
        if os.path.exists(os.path.join(CURRICULUM_DIR, "kanji", f"{lvl}.json")):
            levels.append(lvl)
    edges = build_edges(levels)
    out = os.path.join(CURRICULUM_DIR, "dependencies", "graph.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"edges": edges}, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"Wrote {len(edges)} dependency edges for levels {levels}.")


if __name__ == "__main__":
    main()
