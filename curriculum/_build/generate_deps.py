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
    "ichi": ["ichi", "hon", "hyaku", "hidariuma"],
    "ni": ["ni"],
    "san": ["san"],
    "juu": ["juu", "sen"],
    "hachigashira": ["hachi", "roku", "bun-minute"],
    "hito": ["hito-jin", "yasumu", "kon-now"],
    "ninben": ["yasumu"],
    "hitoashi": ["sensei-saki", "miru"],
    "ireru": ["hairu"],
    "kuchi": ["kuchi", "yon", "meiname", "furui", "iu-gen", "go-language", "hanashi-wa", "naka", "takai"],
    "kunigamae": ["yon", "kuni"],
    "onna": ["onna", "yasui"],
    "ko": ["ko-child", "gaku"],
    "chikara": ["chikara", "otoko"],
    "ta": ["otoko"],
    "tsuchi": ["do-earth", "suwaru", "sei-life"],
    "yamahen": ["yama", "deru"],
    "kawa": ["kawa"],
    "shou": ["shou-small", "sukunai"],
    "me": ["me-eye", "miru"],
    "mimi": ["mimi", "kiku-hear"],
    "te": ["te-hand"],
    "ashi-foot": ["ashi"],
    "hi-sun": ["nichi", "higashi", "hayai", "ma-interval", "jikan-ji", "kaku-write", "nichiyou"],
    "tsuki": ["gatsu"],
    "ki": ["moku", "higashi", "hon", "kou-school", "yasumu"],
    "mizu": ["sui"],
    "sanzui": [],
    "hi-fire": ["ka-fire"],
    "kanehen": ["kin"],
    "kai-shell": ["kau"],
    "mongamae": ["ma-interval", "kiku-hear"],
    "ame": ["ame-rain", "denki-den"],
    "kuruma": ["sha-car"],
    "shinnyou": ["michi"],
    "gonben": ["iu-gen", "go-language", "hanashi-wa", "dokusho"],
    "takai": ["takai"],
    "uma": ["eki-station"],
    "ao": ["ao"],
    "shiro": ["shiro-white", "hyaku"],
    "aka": ["aka"],
    "kuro": ["kane-gold-dup"],
    "tomeru": ["tomeru"],
    "tatsu": ["tatsu", "atarashii"],
    "miru": ["miru"],
    "shita": ["hanashi-wa"],
    "ninben": ["yasumu"],
    "haba": ["shi-city"],
    "kakeru": ["nomu"],
}


# Curated radical (slug) -> kanji (suffix) decomposition for N4.
# Keyed by radical slug from n4_radicals.py (new radicals) or n5_radicals.py
# (reused components); values are kanji suffixes from n4_kanji.py.
N4_DECOMPOSITION = {
    "kokoro": ["shin-heart", "omou", "isogu", "warui", "wasureru", "hitsu"],
    "bokuzukuri": ["kyou-teach"],
    "madare": ["mise", "hiroi"],
    "hitsuji": ["kiru-wear"],
    "furutori": ["atsumeru"],
    "inu": ["modoru"],
    "gatsuhen": ["shinu", "nokoru"],
    "ou-king": ["ri"],
    "ono": ["tokoro", "shitsu-quality"],
    "itaru": ["shitsu"],
    "shikabane": ["todoku"],
    "yumihen": ["hiku", "yowai", "tsuyoi"],
    "shikabane-kan": ["tokoro", "modoru"],
    "takehen": ["kotae"],
    "shime": ["sha"],
    "nikuzuki": ["akarui"],
    "shinnyou-n4": ["asobu", "chigau", "hakobu", "okuru", "erabu"],
    "tatsuhen": ["oya"],
    "kai-shellhen": ["kasu", "shitsu-quality"],
    "kuchihen": ["shiru", "aji", "ani"],
    "mizuhen": ["arau", "kimeru", "heru-decrease"],
    # Reused N5 radicals as components of new N4 kanji.
    "onna": ["suki", "ane", "imouto"],
    "ki": ["oya"],
    "kuruma": ["sha-car", "karui", "omoi"],
    "ame": ["den"],
    "chikara": ["ryoku"],
    "sanzui": ["arau", "kimeru", "heru-decrease"],
    "te": ["te-kanji"],
    "tsuchi": ["chi", "ba"],
    "hi-sun": ["kurai", "akarui"],
    "tsuki": ["akarui"],
    "miru": ["oboeru"],
    "gonben": ["shi-try"],
    "kai-shell": ["kasu"],
    "mimi": [],
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
    for lvl in levels:
        decomposition = decomposition_by_level.get(lvl, {})
        for rad_slug, kanji_suffixes in decomposition.items():
            if rad_slug not in radical_slugs:
                continue
            for suf in kanji_suffixes:
                kslug = f"{lvl}-{suf}"
                if kslug in kanji_slugs:
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
