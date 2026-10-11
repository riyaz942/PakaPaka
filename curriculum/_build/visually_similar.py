# -*- coding: utf-8 -*-
"""Reviewed look-alike pair dataset (content pipeline Rev 1, R1.3).

Symmetric pairs of taught radicals/kanji that are visually confusable.
This is the dataset generate.py turns into `visually_similar_slugs` on both
items of each pair; compile-curriculum resolves the refs into the
`visually_similar_links` table and hard-fails on any ref not in the taught
set.

Pairs are derived by import/derive_visually_similar.py (curated seed list +
dependency-graph / KanjiVG candidates) and human-reviewed before landing
here — never add a pair the derivation report has not surfaced or a reviewer
has not confirmed. Regenerate the candidate report with:

    .venv/bin/python import/derive_visually_similar.py   (from curriculum/_build)
"""

#: (ref_a, ref_b) — symmetric; order within the tuple is not meaningful. Each
#: ref is "<kind>:<slug>": a radical and a kanji may share a slug.
VISUALLY_SIMILAR_PAIRS = [
    # --- kanji ↔ kanji ---
    ("kanji:person", "kanji:enter"),                 # 人 / 入
    ("kanji:eight", "kanji:enter"),                  # 八 / 入
    ("kanji:eight", "kanji:person"),                 # 八 / 人
    ("kanji:big", "kanji:plump"),                    # 大 / 太
    ("kanji:big", "kanji:heaven"),                   # 大 / 天
    ("kanji:white", "kanji:hundred"),                # 白 / 百
    ("kanji:white", "kanji:self"),                   # 白 / 自
    ("kanji:day", "kanji:white"),                    # 日 / 白
    ("kanji:eye", "kanji:self"),                     # 目 / 自
    ("kanji:day", "kanji:eye"),                      # 日 / 目
    ("kanji:tree", "kanji:book"),                    # 木 / 本
    ("kanji:right", "kanji:left"),                   # 右 / 左
    ("kanji:ten-thousand", "kanji:direction"),       # 万 / 方
    ("kanji:nine", "kanji:power"),                   # 九 / 力
    ("kanji:interval", "kanji:hear"),                # 間 / 聞
    ("kanji:name", "kanji:many"),                    # 名 / 多
    ("kanji:now", "kanji:meet"),                     # 今 / 会
    ("kanji:small", "kanji:few"),                    # 小 / 少
    ("kanji:heart", "kanji:necessary"),              # 心 / 必
    ("kanji:ten", "kanji:thousand"),                 # 十 / 千
    ("kanji:ten", "kanji:seven"),                    # 十 / 七
    ("kanji:thousand", "kanji:noon"),                # 千 / 午
    ("kanji:four", "kanji:west"),                    # 四 / 西
    ("kanji:older-sister", "kanji:younger-sister"),  # 姉 / 妹
    ("kanji:car", "kanji:heavy"),                    # 車 / 重
    # --- kanji ↔ radical (the look-alike is taught only as the other type) ---
    ("kanji:thousand", "radical:mannaka"),           # 千 / 干
    ("kanji:noon", "radical:ushi"),                  # 午 / 牛
    ("kanji:half", "radical:hitsuji"),               # 半 / 羊
    ("kanji:come", "radical:kome"),                  # 来 / 米
    ("kanji:right", "radical:ishi"),                 # 右 / 石
    ("kanji:main", "radical:ou-king"),               # 主 / 王
    ("kanji:big", "radical:inu"),                    # 大 / 犬
    ("kanji:plump", "radical:inu"),                  # 太 / 犬
    # --- radical ↔ radical ---
    ("radical:hito", "radical:ireru"),               # 人 / 入
    ("radical:hachigashira", "radical:hito"),        # 八 / 人
    ("radical:hi-sun", "radical:iwaku"),             # 日 / 曰
    ("radical:hi-sun", "radical:me"),                # 日 / 目
    ("radical:hi-sun", "radical:shiro"),             # 日 / 白
    ("radical:hi-sun", "radical:ta"),                # 日 / 田
    ("radical:me", "radical:ta"),                    # 目 / 田
    ("radical:keigamae", "radical:wakanmuri"),       # 冂 / 冖
    ("radical:keigamae", "radical:kunigamae"),       # 冂 / 囗
    ("radical:kuchi", "radical:kunigamae"),          # 口 / 囗
    ("radical:shikabane", "radical:tobira"),         # 尸 / 戸
    ("radical:madare", "radical:yamaidare"),         # 广 / 疒
    ("radical:shikabane", "radical:madare"),         # 尸 / 广
    ("radical:sun", "radical:tehen"),                # 寸 / 扌
    ("radical:bokuzukuri", "radical:chichi"),        # 攵 / 父
    ("radical:bokuzukuri", "radical:kakeru"),        # 攵 / 欠
    ("radical:kokorohen", "radical:sanzui"),         # 忄 / 氵
    ("radical:mannaka", "radical:ushi"),             # 干 / 牛
    ("radical:miru", "radical:kai-shell"),           # 見 / 貝
]


def build_similar_map():
    """{ref: [similar_ref, ...]} with both directions of every pair, keyed and
    valued by "<kind>:<slug>".

    Validates the dataset shape: no self-pairs, no duplicate pairs in either
    orientation. Ref existence is enforced downstream by compile-curriculum.
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
