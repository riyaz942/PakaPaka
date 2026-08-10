# -*- coding: utf-8 -*-
"""Reviewed look-alike pair dataset (content pipeline Rev 1, R1.3).

Symmetric pairs of taught radical/kanji slugs that are visually confusable.
This is the dataset generate.py turns into `visually_similar_slugs` on both
items of each pair; compile-curriculum resolves the slugs into the
`visually_similar_links` table and hard-fails on any slug not in the taught
set.

Pairs are derived by import/derive_visually_similar.py (curated seed list +
dependency-graph / KanjiVG candidates) and human-reviewed before landing
here — never add a pair the derivation report has not surfaced or a reviewer
has not confirmed. Regenerate the candidate report with:

    .venv/bin/python import/derive_visually_similar.py   (from curriculum/_build)
"""

#: (slug_a, slug_b) — symmetric; order within the tuple is not meaningful.
#: Radical slugs are bare ("hito"), kanji slugs carry the level prefix
#: ("n5-hito-jin"); compile-curriculum resolves each side by slug.
VISUALLY_SIMILAR_PAIRS = [
    # --- kanji ↔ kanji ---
    ("n5-hito-jin", "n5-hairu"),        # 人 / 入
    ("n5-hachi", "n5-hairu"),           # 八 / 入
    ("n5-hachi", "n5-hito-jin"),        # 八 / 人
    ("n5-dai-big", "n4-futoi"),         # 大 / 太
    ("n5-dai-big", "n5-ten"),           # 大 / 天
    ("n5-shiro-white", "n5-hyaku"),     # 白 / 百
    ("n5-shiro-white", "n4-ji-self"),   # 白 / 自
    ("n5-nichi", "n5-shiro-white"),     # 日 / 白
    ("n5-me-eye", "n4-ji-self"),        # 目 / 自
    ("n5-nichi", "n5-me-eye"),          # 日 / 目
    ("n5-moku", "n5-hon"),              # 木 / 本
    ("n5-migi", "n5-hidari"),           # 右 / 左
    ("n5-man", "n4-hou"),               # 万 / 方
    ("n5-kyuu", "n5-chikara"),          # 九 / 力
    ("n5-ma-interval", "n5-kiku-hear"), # 間 / 聞
    ("n5-meiname", "n5-ooi-ta"),        # 名 / 多
    ("n5-kon-now", "n4-kai"),           # 今 / 会
    ("n5-shou-small", "n5-sukunai"),    # 小 / 少
    ("n4-shin-heart", "n4-hitsu"),      # 心 / 必
    ("n5-juu", "n5-sen"),               # 十 / 千
    ("n5-juu", "n5-nana"),              # 十 / 七
    ("n5-sen", "n5-hidariuma"),         # 千 / 午
    ("n5-yon", "n5-nishi"),             # 四 / 西
    ("n4-ane", "n4-imouto"),            # 姉 / 妹
    ("n5-sha-car", "n4-omoi"),          # 車 / 重
    # --- kanji ↔ radical (the look-alike is taught only as the other type) ---
    ("n5-sen", "mannaka"),              # 千 / 干
    ("n5-hidariuma", "ushi"),           # 午 / 牛
    ("n5-hantime", "hitsuji"),          # 半 / 羊
    ("n5-kuru-rai", "kome"),            # 来 / 米
    ("n5-migi", "ishi"),                # 右 / 石
    ("n4-shu-main", "ou-king"),         # 主 / 王
    ("n5-dai-big", "inu"),              # 大 / 犬
    ("n4-futoi", "inu"),                # 太 / 犬
    # --- radical ↔ radical ---
    ("hito", "ireru"),                  # 人 / 入
    ("hachigashira", "hito"),           # 八 / 人
    ("hi-sun", "iwaku"),                # 日 / 曰
    ("hi-sun", "me"),                   # 日 / 目
    ("hi-sun", "shiro"),                # 日 / 白
    ("hi-sun", "ta"),                   # 日 / 田
    ("me", "ta"),                       # 目 / 田
    ("keigamae", "wakanmuri"),          # 冂 / 冖
    ("keigamae", "kunigamae"),          # 冂 / 囗
    ("kuchi", "kunigamae"),             # 口 / 囗
    ("shikabane", "tobira"),            # 尸 / 戸
    ("madare", "yamaidare"),            # 广 / 疒
    ("shikabane", "madare"),            # 尸 / 广
    ("sun", "tehen"),                   # 寸 / 扌
    ("bokuzukuri", "chichi"),           # 攵 / 父
    ("bokuzukuri", "kakeru"),           # 攵 / 欠
    ("kokorohen", "sanzui"),            # 忄 / 氵
    ("mannaka", "ushi"),                # 干 / 牛
    ("miru", "kai-shell"),              # 見 / 貝
]


def build_similar_map():
    """{slug: [similar_slug, ...]} with both directions of every pair.

    Validates the dataset shape: no self-pairs, no duplicate pairs in either
    orientation. Slug existence is enforced downstream by compile-curriculum.
    """
    seen = set()
    similar = {}
    for a, b in VISUALLY_SIMILAR_PAIRS:
        if a == b:
            raise ValueError(f"visually similar pair references itself: {a}")
        key = tuple(sorted((a, b)))
        if key in seen:
            raise ValueError(f"duplicate visually similar pair: {a} / {b}")
        seen.add(key)
        similar.setdefault(a, []).append(b)
        similar.setdefault(b, []).append(a)
    return similar
