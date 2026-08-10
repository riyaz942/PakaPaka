# -*- coding: utf-8 -*-
"""Rebuild curriculum/dependencies/graph.json from generated curriculum JSON.

Edge types produced:
  - radical  -> kanji       (builds_on)  : radical is a visual component of the kanji
  - kanji    -> vocabulary  (requires)   : the kanji character appears in the vocab's written form
  - grammar  -> vocabulary  (reinforces) : vocab explicitly linked from a grammar point

Radical->kanji edges are derived from a curated decomposition map (component
radical slug -> list of kanji suffixes). Kanji->vocab edges are derived
automatically by scanning vocab primary_form for the kanji character.
"""

import json
import os

BUILD_DIR = os.path.dirname(os.path.abspath(__file__))
CURRICULUM_DIR = os.path.dirname(BUILD_DIR)


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_level_items(kind, level):
    p = os.path.join(CURRICULUM_DIR, kind, f"{level}.json")
    if not os.path.exists(p):
        return []
    return load(p)["items"]


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
    "hitsuji": ["gyou", "kiru-wear"],
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

    # radical -> kanji (builds_on), from curated decomposition maps per level.
    decomposition_by_level = {"n5": N5_DECOMPOSITION, "n4": N4_DECOMPOSITION}
    # A key that resolves to nothing is a typo or a renamed/removed item, and
    # silently skipping it is how radicals went missing from kanji chips
    # unnoticed. Fail the build instead.
    for lvl in levels:
        decomposition = decomposition_by_level.get(lvl, {})
        for rad_slug, kanji_suffixes in decomposition.items():
            if rad_slug not in radical_slugs:
                raise ValueError(
                    f"{lvl} decomposition: radical slug {rad_slug!r} is not a taught radical"
                )
            if not kanji_suffixes:
                raise ValueError(
                    f"{lvl} decomposition: radical slug {rad_slug!r} has an empty kanji list; "
                    "drop the key instead"
                )
            for suf in kanji_suffixes:
                kslug = f"{lvl}-{suf}"
                if kslug not in kanji_slugs:
                    raise ValueError(
                        f"{lvl} decomposition: {rad_slug!r} lists kanji {kslug!r}, which is not "
                        "a taught kanji"
                    )
                add(rad_slug, "radical", kslug, "kanji", "builds_on")

    # kanji -> vocabulary (requires): kanji char appears in vocab primary_form.
    for k in kanji:
        char = k["primary_form"]
        for v in vocab:
            if char and char in v["primary_form"]:
                add(k["slug"], "kanji", v["slug"], "vocabulary", "requires")

    # grammar -> vocabulary (reinforces): explicit vocabulary_slugs links.
    vocab_slugs = {v["slug"] for v in vocab}
    for g in grammar:
        for vs in g.get("vocabulary_slugs", []):
            if vs in vocab_slugs:
                add(g["slug"], "grammar", vs, "vocabulary", "reinforces")

    return edges


def main():
    levels = []
    for lvl in ["n5", "n4"]:
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
