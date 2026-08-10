# -*- coding: utf-8 -*-
"""N4 radical dataset (additive on top of N5's 90).

Each entry: a dict with keys slug, form, meaning, mnemonic.
Image URL follows the CDN pattern: https://assets.japanese-learning.app/radicals/n4/<slug>.png

Strictly additive: a radical whose `form` is already taught at N5 must NOT be
repeated here under a second slug. Re-teaching the same character produces two
review cards for one shape and lets a kanji show the same chip twice (明 once
carried both `nikuzuki` and `tsuki` for 月). Reuse the N5 slug in
`generate_deps.N4_DECOMPOSITION` instead. Genuinely distinct *glyphs* of the
same radical family are fine (衤 here vs 衣 at N5, 心 here vs 忄 at N5) because
the learner sees a different shape.
"""

# {slug, form, meaning, mnemonic}
N4_RADICALS = [
    {"slug": "kokoro", "form": "心", "meaning": "heart", "mnemonic": "A stylized heart shape with three drops of feeling below it."},
    {"slug": "bokuzukuri", "form": "攵", "meaning": "tap / action", "mnemonic": "A hand holding a small stick, tapping something into action."},
    {"slug": "madare", "form": "广", "meaning": "cliff / shelter", "mnemonic": "A sloped roof over an open cliffside shelter."},
    {"slug": "yamaidare", "form": "疒", "meaning": "sickness", "mnemonic": "A sickbed leaning against the wall: illness."},
    {"slug": "hitsuji", "form": "羊", "meaning": "sheep", "mnemonic": "A woolly head with two curling horns: a sheep."},
    {"slug": "furutori", "form": "隹", "meaning": "old bird", "mnemonic": "A short-tailed bird perched and still."},
    {"slug": "inu", "form": "犬", "meaning": "dog", "mnemonic": "A dog sitting with one ear perked up and a wagging tail dot."},
    {"slug": "gatsuhen", "form": "歹", "meaning": "death / bad luck", "mnemonic": "Broken bones jutting out: decay, bad luck."},
    {"slug": "ou-king", "form": "王", "meaning": "king / jewel", "mnemonic": "Three strata joined by a single line: the king's authority."},
    {"slug": "ono", "form": "斤", "meaning": "axe", "mnemonic": "An axe blade balanced on a handle."},
    {"slug": "itaru", "form": "至", "meaning": "arrive", "mnemonic": "An arrow driven all the way into the ground: arriving fully."},
    {"slug": "shikabane", "form": "尸", "meaning": "corpse / body", "mnemonic": "A body slumped over, reclining."},
    {"slug": "tobira", "form": "戸", "meaning": "door", "mnemonic": "A single swinging door panel."},
    {"slug": "hoko", "form": "戈", "meaning": "halberd", "mnemonic": "A long-handled blade: a weapon of war."},
    {"slug": "wakanmuri", "form": "冖", "meaning": "cover", "mnemonic": "A flat cloth draped over something: a cover."},
    {"slug": "oogai", "form": "頁", "meaning": "page / head", "mnemonic": "A head with hair on top, counted page by page."},
    {"slug": "tori-bird", "form": "鳥", "meaning": "bird", "mnemonic": "A bird's body, wings, and tail feathers all in one shape."},
    {"slug": "uo", "form": "魚", "meaning": "fish", "mnemonic": "A fish shape: head, body, and fins."},
    {"slug": "koromohen", "form": "衤", "meaning": "clothing (left)", "mnemonic": "A robe's sleeve squeezed to the left of a kanji."},
    {"slug": "tsutsumu", "form": "勹", "meaning": "wrap", "mnemonic": "Arms curling around to wrap something up."},
    # Components of N4 kanji that had no taught radical at any level. Added in
    # the N4 skeleton pass (2026-08-10) alongside the removal of 13 entries
    # that re-taught an N5 form (口 小 弓 月 水 示 立 竹 舌 貝 辶 門 高).
    {"slug": "mu", "form": "厶", "meaning": "private / cocoon", "mnemonic": "A shape curled in on itself, keeping something private."},
    {"slug": "oigashira", "form": "耂", "meaning": "old", "mnemonic": "A bent back over a walking stick: old age."},
    {"slug": "ya", "form": "矢", "meaning": "arrow", "mnemonic": "A shaft with a notched tail and a sharp head: an arrow."},
    {"slug": "mata", "form": "又", "meaning": "again / right hand", "mnemonic": "A right hand reaching out to do it again."},
    {"slug": "nisui", "form": "冫", "meaning": "ice", "mnemonic": "Two frozen ticks clinging to the left: ice."},
    {"slug": "to-dipper", "form": "斗", "meaning": "dipper / measure", "mnemonic": "A ladle with two drips: the measuring dipper."},
    {"slug": "shikigamae", "form": "弋", "meaning": "stake / ceremony", "mnemonic": "A stake driven in to mark a formal spot."},
    {"slug": "sato", "form": "里", "meaning": "village", "mnemonic": "A rice field over the earth: the village that farms it."},
    {"slug": "hatsugashira", "form": "癶", "meaning": "outspread legs", "mnemonic": "Two feet splayed apart, about to push off."},
    {"slug": "hane", "form": "羽", "meaning": "feather", "mnemonic": "Two wings side by side, each with its feathers marked."},
    {"slug": "inoko", "form": "豕", "meaning": "pig", "mnemonic": "A snout, a fat body, and four trotters: a pig."},
    {"slug": "nari", "form": "也", "meaning": "to be / snake tail", "mnemonic": "A curling tail flicking out: a snake, and the old word 'to be'."},
]
