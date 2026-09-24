# -*- coding: utf-8 -*-
"""Build the taught kanji decomposition from KanjiVG's component tree.

Replaces KRADFILE as the source of radical -> kanji `builds_on` edges.

KRADFILE is a *flat search index*: it lists every one of its 254 search
radicals that appears anywhere in a glyph, at any depth, with no structure. That
is right for "find me kanji containing 日" and wrong for teaching, because the
learner is shown a pile of strokes instead of the two pieces the character is
actually built from. It also double-counts a single region — 便 came out as
人 一 ノ ｜ 日 田 (both 日 *and* 田 for one area), and 休 as 人 亻 木.

KanjiVG's SVGs nest their stroke groups by *component*, so the top level of the
tree is the split a human would draw on a whiteboard:

    便 -> 亻 更          休 -> 亻 木          映 -> 日 央
    輸 -> 車 兪          増 -> 土 曽          昨 -> 日 乍

1,597 of the 2,000 corpus kanji land on exactly two components that way.

The cost is new radicals: a top-level piece like 更 or 兪 is not in the taught
238. That is the deliberate trade — see `_build/reports/decomposition.py` for
the authoring queue this produces.

KanjiVG does not label every group, though, and an unlabelled region holding no
labelled child leaves its strokes with nowhere to go — which is how 前 shipped
as 八 + 月 + 刂 with no ground, and 右 as a mouth with no hand. Every split is
now checked against the glyph's own stroke count, and one that does not account
for the whole character is not used: it is replaced by `KANJI_OVERRIDES` where
the missing region has a name, and by the kanji itself as a single radical
(140 of them — 白, 立, 鳥, 馬) where it has none.

Sources:
  - KanjiVG (CC BY-SA 3.0; see repo-root NOTICE) — the component tree
  - KANJIDIC2 (EDRDG, CC BY-SA 4.0) — a starting meaning for a new component

KRADFILE is left as the fallback for a kanji KanjiVG has no glyph for. No kanji
in the current corpus needs it.

Output is checked in, so a graph rebuild never needs the source archives:

    python3 curriculum/_build/import/build_decomposition.py
"""

import collections
import json
import os
import sys
import xml.etree.ElementTree as ET
import zipfile

IMPORT_DIR = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR = os.path.dirname(IMPORT_DIR)
CURRICULUM_DIR = os.path.dirname(BUILD_DIR)

sys.path.insert(0, IMPORT_DIR)
sys.path.insert(0, BUILD_DIR)

import sources  # noqa: E402
from build_skeleton import MANUAL_COMPONENT_MEANINGS, clean_gloss, slugify  # noqa: E402

KVG_NS = "{http://kanjivg.tagaini.net}"
KVG_ZIP = os.path.join(BUILD_DIR, "data", "kanjivg-main.zip")
OUT_PATH = os.path.join(BUILD_DIR, "decomposition.json")

#: KanjiVG writes positional variants from the CJK Radical blocks (U+2E80..).
#: We teach the unified form, so those fold together — but ONLY where the
#: meaning survives the fold. Every entry here was checked against the
#: codepoint's Unicode name, not against how the glyph looks:
#:
#:   ⻌ CJK RADICAL SIMPLIFIED WALK -> 辶  (taught "road / advance")
#:   ⻏ CJK RADICAL CITY            -> 阝  (taught "village (right)")
#:
#: ⻖ CJK RADICAL MOUND TWO is deliberately NOT folded onto 阝. It is the *left*
#: form, 阜 "hill", a different radical that happens to share a glyph with
#: 邑 "village" on the right. Folding it would have taught 27 kanji that their
#: hill is a village. It stays unfolded and lands in the authoring queue.
FORM_ALIASES = {
    "⻌": "辶",   # SIMPLIFIED WALK -> road / advance
    "⻏": "阝",   # CITY            -> village (right)
    "⺍": "小",   # SMALL TWO       -> small
    "⺌": "小",   # SMALL ONE       -> small
    "⺨": "犭",   # DOG             -> animal
    "⺗": "忄",   # HEART TWO       -> heart (left)
    "⺷": "羊",   # RAM             -> sheep
    "⻞": "食",   # EAT TWO         -> eat
    "龰": "止",   # unnamed variant -> stop
    "ハ": "八",   # KanjiVG writes the katakana for 八 in a few glyphs
    "⺤": "爪",   # PAW ONE -> the taught "claw"; folding keeps its reviewed prose
    "⺦": "爿",   # SIMPLIFIED HALF TREE TRUNK -> the taught "left-side kata"
    # KanjiVG writes the 八-topped 兌 in 説 税 脱 鋭 悦 閲, but every one of
    # them is drawn with the 丷 horns of 兑 — the form the learner sees.
    "兌": "兑",
}

#: KANJIDIC has no gloss for these, so the learner would meet a nameless chip.
#: Named by what the shape *is* in the characters that use it, which is the only
#: thing a mnemonic can hang on. A few are the simplified-Chinese form of a
#: piece KanjiVG reuses across glyphs (业 in 僕, 电 in 電); they are named for
#: the Japanese character they stand in for, not for the simplified one.
HAND_NAMED = {
    "⻖": "hill (left)",       # 阜; NOT 阝 village — see FORM_ALIASES
    "⺕": "snout",             # pig's head, in 彗 帚 侵
    "𠂊": "crouch",            # the bent figure on top of 危 色 免
    "龶": "sprout",            # the growing top of 青 責 毒
    "业": "bristles",          # the base of 業, in 僕 撲
    "㑒": "assembly",          # 僉, in 験 検 険 剣
    "戋": "shallow",           # 戔, in 浅 銭 残
    "𡗗": "three and big",     # the top of 春 奉 泰
    "𠦝": "sunrise",           # the sun-over-grass top of 朝 乾 韓
    "劦": "joined forces",     # three 力, in 協 脅
    "夹": "sandwich",          # 挟 狭
    "电": "lightning",         # 電 without the rain
    "兹": "this",              # 滋 慈
    "夋": "walk slowly",       # 俊 酸 唆
    "菐": "thicket",           # the top of 僕 撲
    "𠔉": "cupped hands",      # the top of 巻 券
    "壴": "drum stand",        # 鼓 樹 喜
    "𠂇": "left hand",         # the top-left of 左 有
    "𢆉": "sprouting stalk",   # the middle of 乾
    "䏍": "baby",              # the top of 育 充
    "㔾": "kneel",             # the bent leg of 危 卷
    "龷": "twin sprouts",      # the top of 共 昔
    "㳟": "reverent water",    # the variant left of 恭
    "𬀷": "sun and sprout",    # the top of 乾
    "乡": "village streamer",  # the simplified 鄉, in 郷
    "显": "conspicuous",       # the simplified 顯, in 顕
    "䩗": "leather strap",     # in 韓
    "駦": "leaping horse",     # in 騰
    "𦥑": "two hands",         # the grasping pair in 興 挙
    "亚": "second",            # the simplified 亞, in 悪
    "桼": "lacquer tree",      # 漆
    "甶": "ghost head",        # the top of 鬼 魔
    "𩵋": "fish body",         # the simplified 魚, in 鮮
    "堇": "yellow clay",       # 勤 謹 難
    "夗": "curled up",         # 怨 宛

    # KANJIDIC has a gloss for these, but not one a story can hold. A radical
    # name has to be a *thing* the learner can put in a scene: a prefix ("anti-",
    # "un-"), a grammar note ("counter for articles") or a Kangxi catalogue
    # entry ("variant of radical 146") gives a mnemonic nothing to work with.
    # The replacement is the character's own concrete sense.
    "反": "opposite",          # KANJIDIC "anti-"
    "非": "not",               # KANJIDIC "un-"
    "未": "not yet",           # KANJIDIC "un-"
    "相": "mutual",            # KANJIDIC "inter-"
    "戻": "return",            # KANJIDIC "re-"
    "以": "using",             # KANJIDIC "by means of"
    "覀": "flat lid",          # KANJIDIC "variant of radical 146"; top of 要 覆
    "个": "single item",       # KANJIDIC "counter for articles"
    "兪": "dugout canoe",      # KANJIDIC "affirmative response"; 輸 諭 癒
    "丂": "kink",              # KANJIDIC "obstruction of breath (qi) …"
    "㐬": "banner",            # KANJIDIC "a cup with pendants"
    "卦": "omen",              # KANJIDIC "a divination sign"
    "朮": "millet",            # KANJIDIC "a type of millet"
    "甬": "walled path",       # KANJIDIC "road with walls on both sides"
    "然": "so it is",          # KANJIDIC "sort of thing"
    "更": "renew",             # KANJIDIC "grow late"; 便 硬 梗
    "乍": "abrupt",            # KANJIDIC "though"; 作 昨 詐

    # A radical's name is the word its own mnemonic lands on and the word every
    # kanji story built on it borrows, so two radicals may not share one. These
    # collided with a radical already taught, or with each other.
    "飠": "food (left)",       # KANJIDIC "eat" — collides with the taught 食
    "丷": "horns",             # no KANJIDIC gloss at all; see FORM_EXPANSIONS
    "昜": "sunbeam",           # KANJIDIC "open" — collides with 开 below
    "开": "bench",             # KANJIDIC "open"; the two legs under 形 研

    # Transliterations and grammar words a picture cannot resolve to.
    "丿": "slash",             # KANJIDIC "katakana no radical (no. 4)"
    "尹": "official",          # KANJIDIC "an official rank"
    "乙": "second",            # KANJIDIC "the latter"
    "翟": "pheasant",          # KANJIDIC "surname"; 羽 over 隹
    "尺": "ruler",             # KANJIDIC "shaku", a unit nobody pictures
    "由": "reason",            # KANJIDIC "wherefore"
    "是": "right",             # KANJIDIC "just so"
    "巴": "swirl",             # KANJIDIC "comma-design"
    "兀": "flat top",          # KANJIDIC "high & level"
    "冋": "prairie",           # KANJIDIC "desert, border prairie"
    "关": "frontier gate",     # KANJIDIC "frontier pass, close"
    "斿": "swim",              # KANJIDIC "to swim"
    "采": "pick",              # KANJIDIC "dice" is the loanword sense
    "帚": "sweeper",           # collides with the taught ヨ "broom"
    "云": "cloud",             # collides with the taught 曰 "say"; 云 is old 雲
    "己": "oneself",           # collides with the taught 自 "self"
}

#: A component KanjiVG labels as one piece that the curriculum teaches as two.
#: 䒑 is 丷 over 一 and nothing else, so a learner shown one chip for it is being
#: told the bar under the horns has no name. It is expanded rather than taught,
#: which is what lets 前 read horns + ground + moon + knife.
FORM_EXPANSIONS = {
    "䒑": ["丷", "一"],
}

#: A radical whose *shape* was re-cut keeps its slug, and with it the review
#: history in `user.db` and the prose in the mnemonic sidecar keyed by it. The
#: only move so far is "horns", which named 䒑 and now names the two strokes
#: alone; `frozen_slugs` seeds it so the re-cut shape inherits the address.
SLUG_MOVES = {"丷": "horns", "兑": "exchange"}

#: Stroke counts for components KanjiVG ships no glyph of. Every other count is
#: read off the glyph itself; these are the ones that would otherwise be
#: unverifiable, and they are what the completeness check below runs on.
HAND_STROKES = {
    "𠂇": 2, "丷": 2, "⺕": 3, "𠂉": 2, "𦥑": 4, "𠂊": 2, "龶": 4, "𡗗": 5,
    "龷": 4, "乚": 1, "电": 5, "丂": 2, "兑": 7,
    # KanjiVG draws the standalone 辶 with the four-stroke 辵 head; the form
    # every kanji here actually carries is the three-stroke ⻌.
    "辶": 3,
}

#: Kanji whose decomposition writes one component that the glyph draws twice.
#: The repeat is dropped (first position wins, as everywhere else), so their
#: strokes deliberately do not add up and the completeness check skips them.
REPEATED_COMPONENT = set("楽率塁摂渋官興麗衆")

#: Kanji whose components are stated here rather than read off KanjiVG's tree.
#:
#: KanjiVG nests its stroke groups by component, but it does not label every
#: group: a region it never named is a `<g>` (or a bare `<path>`) with no
#: `kvg:element`, and the walk below can only hoist the labelled children out of
#: it. Where such a region holds no labelled child at all, its strokes were
#: dropped on the floor — 161 kanji shipped a decomposition that did not account
#: for their whole glyph, and the learner was shown a chip list with a hole in
#: it: 前 as 八 + 月 + 刂 (no ground), 右 as 口 alone, 白 as 日 alone.
#:
#: Each entry names every component of the kanji, in writing order. A kanji is
#: listed here only when the unlabelled region has an honest name; where it has
#: none, the kanji is taught as its own single radical instead (see
#: `identity` in main), which is also what KRADFILE says about most of them.
KANJI_OVERRIDES = {
    # N5
    "円": "冂丨一", "左": "𠂇工", "右": "𠂇口", "南": "十冂丷干", "前": "丷一月刂",
    "本": "木一", "半": "丷一十", "先": "丿土儿", "来": "一米", "電": "雨电",
    "風": "几丿虫", "楽": "白冫木", "旅": "方𠂉亻人", "年": "𠂉干一",
    # 七 and 九 are 一/丿 + 乙 by stroke shape, but "ground plus the latter" is a
    # spelling, not a story. Each is a taught radical of its own; so are 万 北 今 大.
    "七": "七", "九": "九", "万": "万", "北": "北", "今": "今",
    # N4
    "事": "一口⺕亅", "不": "一丿丨丶", "直": "十目乚", "乗": "𠂉艹木",
    "県": "目乚小", "有": "𠂇月", "声": "士尸丿", "夜": "亠亻夕丶",
    "寒": "宀井一八冫", "以": "以", "民": "民",
    # N3
    "共": "龷八", "具": "目一八", "権": "木𠂉一隹", "象": "𠂊口豕",
    "段": "丿丨三殳", "央": "冂大", "官": "宀口", "断": "米乚斤", "平": "一丷十",
    "求": "一氺丶", "散": "龷月攵", "観": "𠂉一隹見", "収": "丨乚又",
    "昔": "龷日", "専": "一由寸", "在": "才土", "存": "才子", "夫": "一大",
    "印": "丿丨二卩", "率": "玄冫十", "未": "一木", "末": "一木", "号": "口丂",
    "祭": "月又示", "候": "候", "師": "師", "展": "展", "与": "与", "司": "司",
    "了": "了",
    # N2
    "恵": "一由心", "良": "丶艮", "布": "𠂇巾", "余": "人二小", "善": "羊丷一口",
    "汚": "氵一丂", "喜": "吉丷一口", "妻": "一⺕丨女", "舞": "舞", "兆": "兆",
    # N1
    "帝": "亠丷冖巾", "塁": "田冫土", "華": "艹龷二丨", "隊": "⻖丷豕",
    "貴": "中一貝", "虐": "虍⺕", "益": "丷一八皿", "摂": "扌耳冫",
    "覧": "臣𠂉一見", "抑": "扌丿乚卩", "麗": "一冂丶鹿", "挙": "小一八手",
    "勧": "𠂉一隹力", "監": "臣𠂉一皿", "拳": "丷二人手", "衆": "血亻丿人",
    "獣": "小田一口犬", "衰": "衣口一", "従": "彳丷疋", "遂": "丷豕辶",
    "丹": "冂丶一", "継": "糸米乚", "誉": "小一八言", "興": "𦥑同一八",
    "賓": "宀一少貝", "憲": "宀龶罒心", "唐": "广⺕丨口", "垂": "𠂉艹土",
    "渋": "氵止冫", "歓": "𠂉一隹欠", "后": "厂一口", "曹": "一曲日",
    "寡": "宀一自分", "眉": "尸丿目",
    "我": "我", "倉": "倉", "亜": "亜", "敢": "敢", "粛": "粛", "帥": "帥",
    "為": "為", "薦": "薦", "兼": "兼", "慶": "慶", "幻": "幻", "那": "那",
    "奉": "奉", "呉": "呉", "凸": "凸", "凹": "凹", "遣": "遣", "己": "己",
}

#: Only a KanjiVG *placeholder* — a "CDP-8BC4" with no codepoint at all — is
#: expanded a level. A real character with no KANJIDIC gloss (㑒, 兪, 曽) is
#: kept and queued for a hand-written name instead.
#:
#: Expanding those instead cost more than it saved: 験 came out as
#: 馬 + 人 + 一 + 口 + 人 because 㑒 has no gloss, when the honest split is
#: 馬 + 㑒 and the only missing piece is one radical name. Shredding a kanji to
#: avoid naming five components is the KRADFILE failure in a new coat.
#: Expansion is capped at MAX_DEPTH so a chain of placeholders terminates.
MAX_DEPTH = 3


SVG_NS = "{http://www.w3.org/2000/svg}"


def load_kanjivg():
    """(tree, strokes) — the component tree of a glyph, and its stroke count.

    `tree(char)` is `[(component, [children...], strokes), ...]`, one level per
    nesting, or None when KanjiVG has no glyph at all. The stroke count travels
    with every node because it is the only thing that can tell a *complete*
    split from one that quietly left a region out: KanjiVG labels the groups it
    has names for and leaves the rest as bare strokes, and those strokes have
    to be accounted for somewhere or the learner is shown a component list that
    does not add up to the character.
    """
    archive = zipfile.ZipFile(KVG_ZIP)
    # Base glyphs only: a "-Kaisho"/"-VtLst" variant filename is a different
    # handwriting style of the same character, not a different decomposition.
    paths = {
        name.rsplit("/", 1)[-1]: name
        for name in archive.namelist()
        if name.endswith(".svg") and "-" not in name.rsplit("/", 1)[-1]
    }

    def count(group):
        return len(group.findall(f".//{SVG_NS}path"))

    def children(group):
        out = []
        for node in group:
            element = node.get(KVG_NS + "element")
            if element:
                out.append((element, children(node), count(node)))
            elif node.tag != f"{SVG_NS}path":
                # A group with no element is pure stroke packaging; its
                # children still belong to the parent component.
                out.extend(children(node))
        return out

    def root(char):
        name = "%05x.svg" % ord(char)
        if name not in paths:
            return None
        tree = ET.fromstring(archive.read(paths[name]))
        return tree.find(f".//*[@id='kvg:{ord(char):05x}']")

    def tree(char):
        group = root(char)
        return None if group is None else children(group)

    def strokes(char):
        group = root(char)
        return None if group is None else count(group)

    return tree, strokes


def load_corpus():
    """[(slug, char)] for every kanji the curriculum ships, in level order."""
    out = []
    for level in ("n5", "n4", "n3", "n2", "n1"):
        path = os.path.join(CURRICULUM_DIR, "kanji", f"{level}.json")
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as f:
            for item in json.load(f)["items"]:
                out.append((item["slug"], item["primary_form"]))
    return out


def load_taught():
    """{form: {slug, meaning}} for every radical already taught.

    The meaning is carried, not just the slug: a radical minted by an earlier
    run may have been re-glossed by hand since, and several (𠂉 "chevron",
    マ "hook") never had a KANJIDIC gloss to begin with. Re-deriving their
    wording from KANJIDIC would either drop them or silently rename a radical
    whose mnemonic is already written against the old word."""
    out = {}
    for level in ("n5", "n4", "n3", "n2", "n1"):
        path = os.path.join(CURRICULUM_DIR, "radicals", f"{level}.json")
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as f:
            for item in json.load(f)["items"]:
                out[item["primary_form"]] = {
                    "slug": item["slug"], "meaning": item["meaning"]}
    return out


def load_authored():
    """{form: slug} for the hand-written N5/N4 radical datasets.

    Those two files are the authors' own; a component they already teach keeps
    their slug and their wording, and never gets a second identity minted here.
    """
    from n4_radicals import N4_RADICALS
    from n5_radicals import N5_RADICALS

    return {r["form"]: r["slug"] for r in list(N5_RADICALS) + list(N4_RADICALS)}


def frozen_slugs():
    """{form: slug} already minted for a derived radical.

    A radical slug is a permanent address: `user.db` stores review progress
    against it and the mnemonic sidecars are keyed by it. Re-deriving a slug
    from a re-glossed meaning would silently orphan both, so an existing form
    keeps the slug it already has no matter what this run would have named it.
    """
    out = dict(SLUG_MOVES)
    for path, key in ((os.path.join(BUILD_DIR, "skeleton.json"), "radicals"),
                      (OUT_PATH, "radicals")):
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as f:
            for entry in json.load(f).get(key, []):
                out.setdefault(entry["form"], entry["slug"])
    return out


def main():
    tree, strokes = load_kanjivg()
    corpus = load_corpus()
    taught = load_taught()
    kanjidic = sources.load_kanjidic2()
    kradfile = sources.load_kradfile()

    def meanings(form):
        return kanjidic.get(form, {}).get("meanings") or []

    def gloss(form):
        """The meaning a learner is shown for this component, or None.

        An already-taught wording outranks KANJIDIC: it is what the radical's
        own mnemonic and every kanji story that borrows it were written
        against."""
        for candidate in (HAND_NAMED.get(form),
                          MANUAL_COMPONENT_MEANINGS.get(form),
                          taught.get(form, {}).get("meaning")):
            if candidate:
                return candidate
        found = meanings(form)
        return clean_gloss(found[0]) if found else None

    def nameable(form):
        """Can a learner be told what this piece is?"""
        return len(form) == 1 and gloss(form) is not None

    def opaque(form):
        """A placeholder with no codepoint. Nothing can ever name it."""
        return len(form) != 1

    decomposition = {}
    fallback = []
    identities = []
    incomplete = []
    unresolved = collections.Counter()

    def from_kradfile(char):
        """KRADFILE's flat list, aliased, with the kanji itself dropped.

        Worse than a real tree, but better than teaching the kanji as one blob —
        and it goes through the same aliasing as the tree does, or 金 ships
        built from a katakana ハ that no other kanji in the corpus references.
        """
        components, seen = [], set()
        for comp in kradfile.get(char, []):
            comp = FORM_ALIASES.get(comp, comp)
            if comp == char or comp in seen:
                continue
            seen.add(comp)
            if not nameable(comp):
                unresolved[comp] += 1
            components.append(comp)
        return components

    for _slug, char in corpus:
        nodes = tree(char)

        override = KANJI_OVERRIDES.get(char)
        if override:
            for form in override:
                if not nameable(form):
                    unresolved[form] += 1
            decomposition[char] = list(override)
            if override == char:
                identities.append(char)
            continue

        if nodes is None:
            # KanjiVG has no glyph for this kanji at all.
            components = from_kradfile(char)
            if components:
                fallback.append(char)
                decomposition[char] = components
            continue

        out = []

        def walk(items, depth):
            """Append each component, and return the strokes they account for."""
            covered = 0
            for form, kids, count in items:
                form = FORM_ALIASES.get(form, form)
                if opaque(form) and kids and depth < MAX_DEPTH:
                    covered += walk(kids, depth + 1)
                    continue
                covered += count
                for piece in FORM_EXPANSIONS.get(form, [form]):
                    if not nameable(piece):
                        unresolved[piece] += 1
                    out.append(piece)
            return covered

        covered = walk(nodes, 0)
        # 州 is 丶川 written three times and 弱 is 弓冫 written twice. The
        # learner is taught one chip per piece, so a repeat is not a second
        # component — first position wins, which keeps reading order.
        seen = set()
        out = [f for f in out if not (f in seen or seen.add(f))]

        if out == [char]:
            # A single component identical to the kanji is not a decomposition.
            out = []

        # Every stroke KanjiVG did not label belongs to a region it never named,
        # and a component list that skips one is a lie about the character.
        if out and covered == strokes(char):
            decomposition[char] = out
        elif nameable(char):
            decomposition[char] = [char]
            identities.append(char)
        else:
            decomposition[char] = out or from_kradfile(char)
            incomplete.append(char)

    freq = collections.Counter()
    for components in decomposition.values():
        freq.update(components)

    # Mint an identity for every component the authored datasets do not already
    # teach. Ordered by how many kanji need it, so the busiest piece takes the
    # cleanest slug when two glosses would collide.
    authored = load_authored()
    frozen = frozen_slugs()
    minted = []
    used_slugs = set(authored.values()) | set(frozen.values())
    collisions = collections.Counter()
    for form, _count in freq.most_common():
        if form in authored:
            continue
        meaning = gloss(form)
        if meaning is None:
            continue  # unnameable; reported below, no radical minted
        slug = frozen.get(form)
        if not slug:
            base = slugify(meaning)
            slug = base
            while slug in used_slugs:
                collisions[base] += 1
                slug = f"{base}-{collisions[base] + 1}"
        used_slugs.add(slug)
        minted.append({"slug": slug, "form": form, "meaning": meaning})

    components = {}
    for form, count in freq.most_common():
        components[form] = {
            "used_by": count,
            "taught_slug": (taught.get(form) or {}).get("slug"),
            "kanjidic_meanings": meanings(form)[:4],
            "needs_name": not nameable(form),
        }

    # The check the hand-written table cannot make for itself: its components
    # have to account for every stroke of the kanji they describe. A split read
    # off the tree is stroke-checked where it is built; this table exists
    # precisely because those strokes did not add up, so an entry that still
    # does not add up is a typo, not a decomposition.
    def stroke_count(form):
        return HAND_STROKES.get(form) or strokes(form)

    short = []
    for char, forms in ((c, decomposition[c]) for c in KANJI_OVERRIDES):
        if len(forms) < 2 or char in REPEATED_COMPONENT:
            continue
        counts = [stroke_count(f) for f in forms]
        if None in counts or sum(counts) == strokes(char):
            continue
        short.append(f"{char} {''.join(forms)} "
                     f"({sum(counts)} of {strokes(char)} strokes)")

    payload = {
        "radicals": minted,
        "_generated_by": "curriculum/_build/import/build_decomposition.py",
        "source": "KanjiVG component tree, top level (KRADFILE fallback)",
        "corpus_size": len(corpus),
        "decomposition": decomposition,
        "components": components,
        "kradfile_fallback": fallback,
    }
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)
        f.write("\n")

    sizes = collections.Counter(len(v) for v in decomposition.values())
    new = [f for f, c in components.items() if not c["taught_slug"]]
    print(f"{OUT_PATH}")
    print(f"  {len(corpus)} kanji, {len(fallback)} on the KRADFILE fallback")
    print(f"  components per kanji: "
          f"{', '.join(f'{n}x{sizes[n]}' for n in sorted(sizes))}")
    print(f"  {len(components)} distinct components, "
          f"{len(components) - len(new)} already taught, {len(new)} new")
    print(f"  {len(minted)} radical identities minted "
          f"({sum(1 for r in minted if r['form'] in frozen)} keeping a frozen slug)")
    print(f"  {len(identities)} kanji taught as their own radical, "
          f"{len(incomplete)} left with an incomplete split")
    if incomplete:
        print(f"    {' '.join(incomplete)}")
    if short:
        print(f"  {len(short)} decompositions do not account for every stroke:")
        for line in short:
            print(f"    {line}")
    nameless = [f for f in unresolved if gloss(f) is None]
    if nameless:
        print(f"  {len(nameless)} components still have no name; add them to "
              f"HAND_NAMED: {', '.join(repr(f) for f in nameless)}")


if __name__ == "__main__":
    main()
