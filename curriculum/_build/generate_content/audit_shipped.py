# -*- coding: utf-8 -*-
"""Tiers 0-1 shipped-content audit (docs/content/content-audit-plan.md).

Runs the pipeline's existing per-draft gates against the *shipped*
curriculum/<type>/<level>.json (they normally only see pre-assembly drafts),
plus the plan's ten new deterministic checks (accepted-answer invariants,
decomposition completeness, mnemonic tag round-trips, passage grammar usage,
look-alike symmetry, corpus hygiene, the review-status rollup, and the span
re-derivation diff). Nothing here is AI-assisted (that is `audit_semantic.py`,
not built by this file) and nothing here writes to curriculum JSON, drafts,
validators, or the dependency graph — nothing in this module opens a file for
anything but reading, and its outputs are new report files only.

Findings are graded ERROR / WARNING / INFO, mirroring `import/audit_facts.py`:
  ERROR   objectively wrong, or a contract compile already enforces — a shipped
          violation of one of those means the JSON was hand-edited since the
          last compile, or a real content bug slipped through generation.
  WARNING needs a human decision (missing decomposition edges, a tag that
          doesn't match a taught component, declared-but-unused grammar).
  INFO    context only (review-status counts, untaught KRADFILE primitives).

Writes curriculum/_build/reports/content-audit-<level>.md per requested level
and exits 1 if any level produced an ERROR — the same contract as
`check_cloze.py`.

Run (from curriculum/_build):
    .venv/bin/python -m generate_content.audit_shipped
    .venv/bin/python -m generate_content.audit_shipped --level n5
"""

import argparse
import glob
import json
import os
import re
import sys

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CURRICULUM_DIR = os.path.dirname(BUILD_DIR)
IMPORT_DIR = os.path.join(BUILD_DIR, "import")
sys.path.insert(0, BUILD_DIR)
sys.path.insert(0, IMPORT_DIR)

import furigana as furigana_lib  # noqa: E402
import sources  # noqa: E402
import audit_facts  # noqa: E402
from generate_content import (  # noqa: E402
    check_cloze,
    context,
    mnemonic_context,
    reading_context,
    reading_seeds,
    spans,
    validate_drafts,
    validate_examples,
    validate_mnemonics,
    validate_readings,
)

REPORTS_DIR = os.path.join(BUILD_DIR, "reports")

#: (radical_slug, kanji_slug) pairs a maintainer has reviewed and decided NOT
#: to add as a `builds_on` edge, with a reason. Every entry here removes one
#: WARNING from the "missing decomposition edge" check — add only after a
#: deliberate decision (e.g. the mnemonic legitimately skips a KRADFILE
#: primitive), never preemptively. Mirrors `audit_facts.ACCEPTED_EDGES`'s
#: shape, but that dict accepts an existing edge that KRADFILE doesn't
#: confirm; this one accepts the *absence* of an edge KRADFILE suggests.
#:
#: N5 pass (2026-08-09, ahead of the content freeze). KRADFILE is a *search*
#: index: it decomposes every character down to the strokes you would pick in a
#: radical lookup, including fragments that carry no meaning and halves of
#: sub-kanji the curriculum never teaches. The taught decomposition is
#: pedagogical — the pieces a mnemonic can actually build a story from — so most
#: of the diff below is expected, not a gap. Four kinds of expected diff:
#:   1. the component radical bands *after* the kanji that would build on it
#:   2. KRADFILE splits a sub-kanji the taught story keeps whole (or never uses)
#:   3. the component is a bare search stroke, not a meaning-bearing piece
#:   4. the kanji is taught as one whole shape (its own radical / a pictograph)
#:
#: The first pass also carried a fifth group — genuine candidate edges deferred
#: because adding one obliges a rewrite of the child's meaning_mnemonic. The
#: decomposition sweep that followed added all of them (and 14 radicals that had
#: no entry at all), so that group is empty and the 35 exceptions it covered are
#: gone. An exception here should now mean "KRADFILE and pedagogy genuinely
#: disagree", never "we haven't got to it".
DECOMPOSITION_EXCEPTIONS = {
    # ("radical-slug", "n5-kanji-slug"): "reason",

    # --- 1. component radical bands after the kanji -------------------------
    # A radical is no longer filed by the dataset that wrote it: banding files
    # it at the level of the first kanji that needs it. That emptied this group
    # of the ten entries it carried, whose reason ("斤 is an N4 radical") stopped
    # being true once 斤 banded N5 — their edges are in
    # `generate_deps.N5_DECOMPOSITION` now. One case survives the reband, and it
    # is the only shape that still can: the radical's *first* kanji sits in an
    # earlier band than this one.
    ("furutori", "n5-nichiyou"): "隹 bands N4 — 集 is the first kanji that needs it — while 曜 bands N5, so the learner meets 曜 first and the edge would be an ordering inversion.",

    # --- 2. KRADFILE splits a sub-kanji the taught story does not -----------
    ("me", "n5-kau"): "目 is the top of 貝; 買 already builds on 貝 whole.",
    ("hachigashira", "n5-kau"): "八 is the two legs of 貝; 買 already builds on 貝 whole.",
    ("ten", "n5-kuni"): "丶 is the dot of 玉 inside the enclosure; 国 is taught from 囗.",
    ("hito", "n5-hana"): "人 is the left half of 化, which the curriculum does not teach; 花's taught story does not split it.",
    ("hi-spoon", "n5-hana"): "匕 is the right half of that same untaught 化; 花 is taught from 艹.",
    ("ten", "n5-ki-spirit"): "丶 is an interior stroke of 气/㐅; 気 is taught as one whole shape.",
    ("ten", "n5-eki-station"): "丶 is an interior stroke of 尺; 駅 is taught from 馬.",
    ("kuchi", "n5-shu-week"): "口 is a stroke-lookup piece of 周; 週's taught story does not split 周.",
    ("tsuchi", "n5-shu-week"): "土 is a stroke-lookup piece of 周; 週's taught story does not split 周.",
    ("keigamae", "n5-shu-week"): "冂 is the outer frame of 周; 週's taught story does not split 周.",
    ("ta", "n5-higashi"): "田 is how KRADFILE indexes the middle of 東; the taught reading of those same strokes is the 日/木 overlay.",
    ("ichi", "n5-higashi"): "一 is a stroke of the same 日/木 overlay 東 is already taught from.",

    # --- 3. bare search strokes --------------------------------------------
    ("ni", "n5-ao"): "二 indexes two strokes of 青's 龶 top; not a meaning-bearing component.",
    ("hitoyane", "n5-ao"): "亠 indexes the top strokes of 青's 龶; not a meaning-bearing component.",
    ("tsuchi", "n5-ao"): "土 indexes the 龶 top of 青 by shape; not a meaning-bearing component.",
    ("hachigashira", "n5-atarashii"): "八 indexes the splayed strokes under 立 in 新; not a meaning-bearing component.",
    ("hitoyane", "n5-atarashii"): "亠 is the top stroke of 立, which 新 already builds on.",
    ("hitoyane", "n5-en"): "亠 indexes the top stroke of 円; not a meaning-bearing component.",
    ("ichi", "n5-en"): "一 indexes an interior stroke of 円; not a meaning-bearing component.",
    ("ni", "n5-hantime"): "二 indexes two of 半's horizontal strokes; not a meaning-bearing component.",
    ("hachigashira", "n5-hantime"): "八 indexes 半's 丷 top; not a meaning-bearing component.",
    ("juu", "n5-hidariuma"): "十 indexes the bottom cross of 午; 午 is taught from 一.",
    ("mannaka", "n5-hidariuma"): "干 is a whole-shape lookup for 午; 午 is taught from 一.",
    ("ichi", "n5-kon-now"): "一 indexes the stroke under 今's roof; 今 is taught from 人.",
    ("hito", "n5-kin"): "人 indexes the 亼 roof of 金; 金 is taught as one whole shape.",
    ("hachigashira", "n5-kin"): "八 indexes the two dots inside 金; 金 is taught as one whole shape.",
    ("ni", "n5-kuru-rai"): "二 indexes 来's horizontal strokes; not a meaning-bearing component.",
    ("hitoyane", "n5-kuru-rai"): "亠 indexes 来's top stroke; not a meaning-bearing component.",
    ("kome", "n5-kuru-rai"): "米 is a whole-shape lookup for 来 (the two characters are near-homographs by stroke); not a component.",
    ("ichi", "n5-machi"): "一 indexes a stroke of 丁; 町's taught story does not split 丁.",
    ("ichi", "n5-mae"): "一 indexes a horizontal stroke of 前; not a meaning-bearing component.",
    ("hachigashira", "n5-mae"): "八 indexes 前's 丷 top; not a meaning-bearing component.",
    ("hachigashira", "n5-michi"): "八 indexes the 丷 top of 首; 道 builds on 首 whole, and on 辶.",
    ("mannaka", "n5-minami"): "干 is a stroke-lookup shape inside 南; not a meaning-bearing component.",
    ("hachigashira", "n5-minami"): "八 indexes 南's interior 丷; not a meaning-bearing component.",
    ("ichi", "n5-nen"): "一 indexes a horizontal stroke of 年; not a meaning-bearing component.",
    ("tsuchi", "n5-sensei-saki"): "土 indexes the 生-like top strokes of 先; 先 is taught from 儿.",
    ("hitoyane", "n5-takai"): "亠 indexes 高's top stroke; not a meaning-bearing component.",
    ("keigamae", "n5-takai"): "冂 indexes 高's lower frame; 高 is already taught from 口 and its own radical.",
    ("ni", "n5-ten"): "二 indexes 天's two horizontals; 天 is taught from 一 over the whole 大 shape, which is a kanji, not a radical.",
    ("hitoashi", "n5-yon"): "儿 indexes the interior strokes of 四; 四 is already taught from 口 and 囗.",
    ("katana", "n5-kaeru"): "刀 indexes the ⺈ strokes at 帰's top left; the reviewed story builds 帰 from the broom and the cloth.",
    ("katana", "n5-mae"): "刂 is the right edge of 前 and a real etymological piece, but the reviewed story builds 前 from 月 under an awning; adding the edge would oblige a mnemonic rewrite of shipped N5 content.",

    # --- 4. taught as one whole shape --------------------------------------
    ("tsuchi", "n5-aka"): "赤 is taught as its own whole-shape radical; 土 is only how KRADFILE indexes its top.",
    ("kunigamae", "n5-kuchi"): "囗 and 口 are the same box at two sizes; 口 already builds on its own radical.",
    ("ichi", "n5-man"): "万 is taught as one whole shape; 一 is only its top stroke.",
    ("ichi", "n5-san"): "三 is taught as its own whole-shape radical; 一 and 二 are the strokes it is drawn from, not pieces it borrows.",
    ("ni", "n5-san"): "三 is taught as its own whole-shape radical; 二 is a stroke subset of it, not a component.",

    # --- N4 pass (2026-08-10, skeleton fix ahead of content generation) ----
    # Same four kinds as the N5 pass above. The 亻 group is a fifth,
    # KRADFILE-specific case: 化 is its index entry for 亻, and 人 claims 化
    # before 亻 does, so the confirmed 亻 edge still leaves a 人 diff.
    ("hachigashira", "n4-aji"): "ハ indexes 未's splayed lower strokes.",
    ("hitoyane", "n4-aji"): "亠 indexes the top stroke of that same 未.",
    ("ni", "n4-aji"): "二 indexes the two horizontals of 未; 味 builds on 木.",
    ("tsuchi", "n4-arau"): "土 indexes the 生-like top of 先; 洗 is taught from 氵 and 儿.",
    ("tsutsumu", "n4-betsu"): "勹 indexes the hooked stroke of 另; 別 is taught from 口 and 力.",
    ("hachigashira", "n4-erabu"): "ハ/并 index the splayed strokes of that same 巽.",
    ("ni", "n4-erabu"): "二 indexes a horizontal of 巽, a sub-kanji the curriculum does not teach.",
    ("hachigashira", "n4-fueru"): "并 indexes the 丷 top of 曽; not a meaning-bearing component.",
    ("hachigashira", "n4-gyou"): "并 indexes the splayed strokes of that same 丵.",
    ("ou-king", "n4-gyou"): "王 indexes the same 丵 top 業 already builds on through 羊.",
    ("hito", "n4-hataraku"): "化 is how KRADFILE indexes 亻; 働 builds on 亻 (ninben) directly.",
    ("itoko", "n4-hosoi"): "幺 is the upper half of 糸; 細 builds on 糸 whole.",
    ("shou", "n4-hosoi"): "小 is the lower half of that same 糸.",
    ("hachigashira", "n4-imouto"): "ハ indexes 未's splayed lower strokes.",
    ("hitoyane", "n4-imouto"): "亠 indexes the top stroke of that same 未.",
    ("ni", "n4-imouto"): "二 indexes the two horizontals of 未; 妹 builds on 木.",
    ("hito", "n4-kariru"): "化 is how KRADFILE indexes 亻; 借 builds on 亻 (ninben) directly.",
    ("hachigashira", "n4-kasu"): "ハ is the two legs of that same 貝.",
    ("hito", "n4-kasu"): "化 is how KRADFILE indexes 亻; 貸 builds on 亻 (ninben) directly.",
    ("me", "n4-kasu"): "目 is the top of 貝; 貸 already builds on 貝 whole.",
    ("itoko", "n4-kei-pass"): "幺 is the upper half of 糸; 経 builds on 糸 whole.",
    ("shou", "n4-kei-pass"): "小 is the lower half of that same 糸.",
    ("hito", "n4-ken-exam"): "人/个 index the 亼 roof of 僉, a sub-kanji the curriculum never teaches; 験 is taught from 馬.",
    ("kuchi", "n4-ken-exam"): "口 indexes the paired mouths inside that same untaught 僉.",
    ("hito", "n4-kimeru"): "人 indexes the splayed foot of 夬, a sub-kanji the curriculum does not teach.",
    ("ni", "n4-kimeru"): "二 indexes a horizontal of that same 夬.",
    ("hachigashira", "n4-kiru-wear"): "并 indexes 着's 丷 top; 着 builds on 羊 whole.",
    ("ou-king", "n4-kiru-wear"): "王 indexes the same 羊 top 着 already builds on.",
    ("hito", "n4-kotae"): "个 indexes the 亼 roof of 合; 答 is taught from 竹 over 口.",
    ("ichi", "n4-modoru"): "一 is the top stroke of 戸, which 戻 already builds on whole.",
    ("shikabane", "n4-modoru"): "尸 is the body of that same 戸.",
    ("nisui", "n4-narau"): "冫 indexes the interior ticks of 羽; 習 builds on 羽 whole.",
    ("ni", "n4-nokoru"): "二 indexes the paired horizontals of 戔; 残 builds on 戈.",
    ("hachigashira", "n4-okuru"): "并 indexes 关's 丷 top.",
    ("ichi", "n4-okuru"): "一 indexes a horizontal of 关, a sub-kanji the curriculum does not teach.",
    ("ni", "n4-okuru"): "二 indexes the paired horizontals of that same 关.",
    ("hachigashira", "n4-otouto"): "并 indexes 弟's 丷 top; not a meaning-bearing component.",
    ("itoko", "n4-owaru"): "幺 is the upper half of 糸; 終 builds on 糸 whole.",
    ("shou", "n4-owaru"): "小 is the lower half of that same 糸.",
    ("hachigashira", "n4-oya"): "并 indexes 亲's splayed strokes.",
    ("hitoyane", "n4-oya"): "亠 is the top stroke of that same 立.",
    ("karai", "n4-oya"): "辛 is a whole-shape lookup for 亲; 親 is taught from 立 over 木.",
    ("ichi", "n4-shinu"): "一 is the top stroke of 歹; 死 builds on 歹 whole.",
    ("yuu-evening", "n4-shinu"): "夕 is the body of that same 歹.",
    ("keigamae", "n4-shiraberu"): "冂 is the outer frame of that same 周.",
    ("kuchi", "n4-shiraberu"): "口 is a stroke-lookup piece of 周; 調's taught story does not split 周.",
    ("tsuchi", "n4-shiraberu"): "土 is a stroke-lookup piece of that same 周.",
    ("mu", "n4-shitsu"): "厶 is the waist of that same 至.",
    ("tsuchi", "n4-shitsu"): "土 is the foot of 至; 室 builds on 至 whole.",
    ("hachigashira", "n4-shitsu-quality"): "ハ is the two legs of that same 貝.",
    ("me", "n4-shitsu-quality"): "目 is the top of 貝; 質 already builds on 貝 whole.",
    ("hi-sun", "n4-todoku"): "日 indexes the boxed lower half of 由; 届 is taught from 尸.",
    ("ta", "n4-todoku"): "田 is a whole-shape lookup for that same 由.",
    ("ichi", "n4-tokoro"): "一 is the top stroke of that same 戸.",
    ("shikabane", "n4-tokoro"): "尸 is the top of 戸; 所 builds on 戸 whole.",
    ("hito", "n4-tsukau"): "化 is how KRADFILE indexes 亻; 使 builds on 亻 (ninben) directly.",
    ("itoko", "n4-tsuzukeru"): "幺 is the upper half of 糸; 続 builds on 糸 whole.",
    ("shou", "n4-tsuzukeru"): "小 is the lower half of that same 糸.",
    ("ichi", "n4-warui"): "一 indexes a stroke of 亜, a sub-kanji the curriculum does not teach.",
    ("kuchi", "n4-warui"): "口 indexes the boxed interior of that same 亜.",
    ("hitoyane", "n4-wasureru"): "亠 is the top stroke of 亡, which the curriculum does not teach as a piece.",
    ("to-dipper", "n4-zu"): "斗 is a stroke-lookup shape for 図's interior; the taught story is the enclosure.",
}

#: Non-kanji characters KRADFILE and JmdictFurigana still treat as "carries
#: its own furigana reading" — the iteration mark and small-katakana counter
#: glyph (ヶ月, 一ヶ月). `furigana_lib.is_kanji` doesn't cover either.
_FURIGANA_ANCHOR_EXTRA = "々ヶヵ"


def _is_furigana_anchor(ch):
    return furigana_lib.is_kanji(ch) or ch in _FURIGANA_ANCHOR_EXTRA


def reading_from_furigana(annotated):
    """The plain kana pronunciation a bracket-annotated string encodes.

    Mirrors scripts/validate-schema.ts's backward kanji walk (isKanjiFullyCovered):
    a `[reading]` bracket replaces the run of kanji-like characters immediately
    before it, and everything else (kana, punctuation) is literal. A naive
    "swallow every non-bracket char before `[`" regex over-consumes leading kana
    (お父[とう] -> would eat the お); walking anchors one at a time keeps it.
    """
    out = []
    i, n = 0, len(annotated)
    while i < n:
        j = i
        while j < n and _is_furigana_anchor(annotated[j]):
            j += 1
        if j > i and j < n and annotated[j] == "[":
            end = annotated.index("]", j)
            out.append(annotated[j + 1:end])
            i = end + 1
        else:
            out.append(annotated[i])
            i += 1
    return "".join(out)


#: Levels that ship a kanji skeleton rather than authored content.
SKELETON_LEVELS = ("n3", "n2", "n1")


def load_items(kind_dir, level, key="items"):
    """`curriculum/<kind_dir>/<level>.json` entries, or `[]` when the file does
    not exist. Skeleton levels ship radicals, kanji and vocabulary as bare item
    lists and no grammar or passages at all, so the cross-level checks below
    cannot assume all four kinds per level the way the per-level checks can."""
    path = os.path.join(CURRICULUM_DIR, kind_dir, f"{level}.json")
    if not os.path.exists(path):
        return []
    return audit_facts.load_json(kind_dir, f"{level}.json")[key]


def discover_levels():
    """Levels with any item file on disk, in curriculum teaching order.

    Not radicals alone: a skeleton level teaches kanji whose components are all
    already taught, so it ships no radicals file at all (N1). Missing it here
    would drop its kanji from the content_counts cross-check below."""
    found = {
        os.path.splitext(os.path.basename(p))[0]
        for kind in ("radicals", "kanji", "vocabulary", "grammar")
        for p in glob.glob(os.path.join(CURRICULUM_DIR, kind, "*.json"))
    }
    ordered = [lvl for lvl in context.LEVEL_ORDER if lvl in found]
    ordered += sorted(found - set(ordered))
    return ordered


class Findings:
    """Ordered (section -> [(severity, message), ...]), plus running totals."""

    def __init__(self):
        self.sections = []
        self.counts = {"ERROR": 0, "WARNING": 0, "INFO": 0}

    def section(self, title):
        bucket = []
        self.sections.append((title, bucket))
        return _Section(bucket, self.counts)


class _Section:
    def __init__(self, bucket, counts):
        self._bucket = bucket
        self._counts = counts

    def add(self, severity, message):
        self._bucket.append((severity, message))
        self._counts[severity] += 1

    def extend(self, pairs):
        for severity, message in pairs:
            self.add(severity, message)


# --- check 9: review-status rollup -----------------------------------------

def review_status_rollup(level):
    """Counts by `_meta.review_status` per content type — doubles as the
    human-review tracker (plan check 9)."""
    rows = []
    for kind_dir in ("radicals", "kanji", "vocabulary", "grammar"):
        items = audit_facts.load_json(kind_dir, f"{level}.json")["items"]
        counts = {}
        for it in items:
            status = (it.get("_meta") or {}).get("review_status", "(none)")
            counts[status] = counts.get(status, 0) + 1
        rows.append((kind_dir, len(items), counts))
    passages = audit_facts.load_json("readings", f"{level}.json")["passages"]
    rows.append(("readings", len(passages), {"(no _meta field on passages)": len(passages)}))
    return rows


# --- re-run of existing draft gates on shipped content ----------------------

def rerun_mnemonic_gates(level):
    """Plan check 2: `validate_mnemonics` re-run on shipped radicals/kanji/vocab.

    Shipped items carry the exact field names (`mnemonic_text`,
    `meaning_mnemonic`, `reading_mnemonic`, `description`) the draft-stage
    validators expect, and `mnemonic_context` already loads from the shipped
    curriculum/<type>/<level>.json — so the draft item IS the shipped item,
    no adapter needed.
    """
    results = []
    for kind, dirname in (("radical", "radicals"), ("kanji", "kanji"), ("vocab", "vocabulary")):
        for item in mnemonic_context.load_items(dirname, level):
            errors = validate_mnemonics.validate_draft(level, kind, item["slug"], item)
            for e in errors:
                results.append(("ERROR", f"{kind} {item['slug']}: {e}"))
    return results


def rerun_example_gates(level):
    """Plan check 2: `validate_examples` re-run on shipped vocab.

    Kanji ship no example sentences — a kanji is taught through the vocabulary
    written with it, which the app lists instead — so any found is an ERROR.
    """
    results = []
    for item in context.load_items("kanji", level):
        if item.get("example_sentences"):
            results.append(("ERROR", f"kanji {item['slug']}: ships example sentences; "
                                     f"kanji carry none (list the vocabulary instead)"))
    for item in context.load_items("vocabulary", level):
        slug = item["slug"]
        errors = validate_examples.validate_draft(level, "vocab", slug, item)
        for e in errors:
            results.append(("ERROR", f"vocab {slug}: {e}"))
    return results


def rerun_grammar_example_gate(level):
    """Plan check 2, "example-contains-accepted-form" slice of `validate_drafts`.

    Not a full `validate_drafts.validate_draft` re-run: that function's other
    checks (jp-fence/example_sentences equality, cloze structure) assume the
    draft-stage `lesson_markdown` field and *unannotated* fence lines, but the
    shipped field is `explanation_markdown` and its fences already carry
    furigana brackets added at assembly — every item would misfire on a field
    rename, not a real defect. This reuses the one piece of that gate the plan
    names (check 3, "does every example actually demonstrate the pattern") via
    the same `item_context` and `voiced_variants` the original gate calls.

    Graded WARNING, not ERROR: the check is a literal substring match against
    `accepted_forms`, so an example showing the pattern in its naturally
    conjugated shape (くれる -> くれました, すぎる -> すぎました) mechanically
    "fails" without being wrong — that gap is real for this reuse, so it needs
    a human read rather than blocking a ship.
    """
    results = []
    for item in context.load_grammar(level):
        ctx = validate_drafts.item_context(level, item["slug"])
        example_lines = [
            e["japanese"].strip() for e in item.get("example_sentences") or [] if e.get("japanese")
        ]
        accepted = validate_drafts.voiced_variants(ctx["item"]["accepted_forms"])
        has_own = [any(form in text for form in accepted) for text in example_lines]
        own_count = sum(has_own)
        for i, text in enumerate(example_lines):
            if has_own[i]:
                continue
            if any(arrow in text for arrow in validate_drafts.CONJUGATION_ARROWS):
                continue
            if any(form in text for form in ctx["sibling_forms"]):
                continue
            if (i > 0 and has_own[i - 1]) or (i + 1 < len(example_lines) and has_own[i + 1]):
                continue
            results.append((
                "WARNING",
                f"grammar {item['slug']}: example {text!r} contains neither an accepted "
                f"form of {item['primary_form']} ({', '.join(accepted)}) nor a taught "
                "contrast pattern",
            ))
        minimum = min(3, len(example_lines)) if example_lines else 0
        if own_count < minimum:
            results.append((
                "WARNING",
                f"grammar {item['slug']}: only {own_count} example line(s) use "
                f"{item['primary_form']} itself; at least {minimum} must",
            ))
    return results


def rerun_cloze_gate(level):
    """Plan check 2: `check_cloze`'s own logic, replicated the way it already
    runs today — this audit absorbs it rather than shelling out, since
    `check_cloze.main()` calls `sys.exit` itself."""
    results = []
    known_readings = validate_drafts._known_readings(level)
    for item in context.load_grammar(level):
        variants = item.get("cloze_variants") or []
        if not variants:
            continue
        ctx = validate_drafts.item_context(level, item["slug"])
        for i, cloze in enumerate(variants):
            for e in check_cloze.variant_errors(cloze, item, ctx, known_readings):
                results.append(("ERROR", f"grammar {item['slug']} cloze_variants[{i}]: {e}"))
    return results


def rerun_passage_gate(level):
    """Plan check 2: `validate_readings` re-run on shipped passages.

    Only available where `reading_seeds` has authored seeds for the level
    (today, n5 only) — the seed is what supplies the allowed vocab/grammar
    context and target word-count band this gate checks against. Passages in
    a level with no seeds still get every seed-independent check elsewhere in
    this report (span re-derivation, grammar-usage, corpus hygiene).
    """
    if level not in reading_seeds.SEEDS:
        return [(
            "INFO",
            f"no reading_seeds authored for {level} — skipping the seed-dependent "
            "passage re-validation (word-count band, structural re-check); the "
            "span re-derivation diff and grammar-usage checks below still run",
        )]
    results = []
    seed_by_position = {s["position"]: s for s in reading_seeds.seeds_for(level)}
    passages = audit_facts.load_json("readings", f"{level}.json")["passages"]
    for passage in passages:
        seed = seed_by_position.get(passage["sort_order"])
        label = f"passage[sort_order={passage['sort_order']}] {passage['title']!r}"
        if seed is None:
            results.append(("ERROR", f"{label}: no seed at position {passage['sort_order']}"))
            continue
        ctx = reading_context.seed_context(level, seed["slug"])
        for e in validate_readings.validate_draft(level, seed["slug"], passage, ctx):
            results.append(("ERROR", f"{label} (seed {seed['slug']}): {e}"))
    return results


# --- check 1: accepted-answer invariants ------------------------------------

def meaning_answer_errors(kind, slug, item):
    """Exactly one is_primary meaning answer, and it matches `meaning`.

    `accepted_answers` is schema-optional for radicals and most (71/76 in N5)
    omit it entirely — nothing to round-trip there, so an absent/empty list is
    not a finding. Radicals that do carry one also use a different convention
    from kanji/vocab: `meaning` may be a compound "ground / one" display
    string while the primary answer is just its first sense ("ground"); kanji
    and vocab `meaning` is never compound, so the primary answer matches it
    verbatim there.
    """
    answers = item.get("accepted_answers") or []
    if not answers:
        return []
    meaning_answers = [a for a in answers if a["answer_type"] == "meaning"]
    primaries = [a for a in meaning_answers if a.get("is_primary")]
    if len(primaries) != 1:
        return [f"{kind} {slug}: expected exactly one is_primary meaning answer, found {len(primaries)}"]
    expected = item["meaning"].split(" / ")[0] if kind == "radical" else item["meaning"]
    if primaries[0]["answer_text"] != expected:
        return [
            f"{kind} {slug}: is_primary meaning answer {primaries[0]['answer_text']!r} "
            f"!= expected {expected!r} (from item meaning {item['meaning']!r})"
        ]
    return []


def kanji_reading_answer_errors(slug, item):
    """Two-card kanji (CLAUDE.md: meaning + on'yomi, kun'yomi via vocab) means
    the accepted reading answer is exactly the primary reading — first on'yomi,
    else kun'yomi, matching `mnemonic_context._primary_reading` / generate.py —
    and every reading answer must be a taught reading, not an orphan string."""
    answers = item.get("accepted_answers") or []
    reading_answers = [a["answer_text"] for a in answers if a["answer_type"] == "reading"]
    readings = item.get("readings") or []
    all_readings = {r["reading"] for r in readings}
    onyomi = [r["reading"] for r in readings if r["reading_type"] == "onyomi"]
    kunyomi = [r["reading"] for r in readings if r["reading_type"] == "kunyomi"]
    primary = onyomi[0] if onyomi else (kunyomi[0] if kunyomi else None)

    errors = []
    if len(reading_answers) != 1:
        errors.append(
            f"kanji {slug}: expected exactly one reading accepted_answer, found {reading_answers}"
        )
    elif primary is not None and reading_answers[0] != primary:
        errors.append(
            f"kanji {slug}: reading accepted_answer {reading_answers[0]!r} != primary "
            f"reading {primary!r} (first on'yomi, else kun'yomi)"
        )
    orphans = [r for r in reading_answers if r not in all_readings]
    if orphans:
        errors.append(f"kanji {slug}: reading accepted_answer(s) {orphans} not present in readings[]")
    return errors


def vocab_reading_furigana_errors(slug, item):
    """The vocab reading answer must equal the reading its own `furigana`
    encodes — the two are meant to be the same string authored twice."""
    answers = item.get("accepted_answers") or []
    reading_answers = [a["answer_text"] for a in answers if a["answer_type"] == "reading"]
    furigana = item.get("furigana")
    if not furigana or not reading_answers:
        return []
    derived = reading_from_furigana(furigana)
    if derived not in reading_answers:
        return [
            f"vocab {slug}: furigana {furigana!r} derives reading {derived!r}, not among "
            f"reading accepted_answer(s) {reading_answers}"
        ]
    return []


def accepted_answer_invariant_errors(level):
    results = []
    for kind_dir, kind in (("radicals", "radical"), ("kanji", "kanji"), ("vocabulary", "vocab")):
        for item in audit_facts.load_json(kind_dir, f"{level}.json")["items"]:
            for e in meaning_answer_errors(kind, item["slug"], item):
                results.append(("ERROR", e))
    for item in audit_facts.load_json("kanji", f"{level}.json")["items"]:
        for e in kanji_reading_answer_errors(item["slug"], item):
            results.append(("ERROR", e))
    for item in audit_facts.load_json("vocabulary", f"{level}.json")["items"]:
        for e in vocab_reading_furigana_errors(item["slug"], item):
            results.append(("ERROR", e))
    return results


# --- check 3: graph decomposition completeness vs KRADFILE ------------------

def decomposition_gaps(level, all_levels_present, kradfile):
    """Every KRADFILE component of a taught kanji at `level` either has a
    `builds_on` edge from a taught radical, a recorded exception, or (when no
    taught radical corresponds to the component at all) is reported as an
    untaught-primitive candidate — the case KRADFILE-vs-edge diffing alone
    cannot see, since it only considers components that already map to a
    taught radical slug (`audit_facts.audit_decomposition`'s "missing edges"
    list). That is precisely the 道/首 gap: 首 is taught as neither radical nor
    kanji, so it never enters that list.
    """
    radical_char, kanji_char = {}, {}
    for lvl in all_levels_present:
        for r in load_items("radicals", lvl):
            radical_char[r["slug"]] = r["primary_form"]
    for lvl in all_levels_present:
        for k in load_items("kanji", lvl):
            kanji_char[k["slug"]] = k["primary_form"]

    taught_chars = {}
    for slug, char in radical_char.items():
        for variant in audit_facts.KRAD_VARIANTS.get(char, [char]):
            taught_chars.setdefault(variant, slug)

    edges = audit_facts.load_json("dependencies", "graph.json")["edges"]
    edge_set = {(e["from_slug"], e["to_slug"]) for e in edges if e["relationship_type"] == "builds_on"}

    # A component can also be taught as a *kanji* rather than a radical. The
    # graph only carries radical -> kanji `builds_on`, so no edge is expressible
    # (天 can never chip 大); reporting those as "taught nowhere" sent readers
    # looking for a radical to author that already exists as a kanji.
    kanji_by_char = {}
    for kslug, kan in kanji_char.items():
        kanji_by_char.setdefault(kan, kslug)

    missing_edge = []
    untaught = {}
    taught_as_kanji = {}
    for kslug, kan in kanji_char.items():
        if not kslug.startswith(f"{level}-"):
            continue
        for comp in kradfile.get(kan, []):
            if comp == kan:
                continue
            rslug = taught_chars.get(comp)
            if rslug is None:
                if comp in kanji_by_char:
                    taught_as_kanji.setdefault(comp, set()).add((kslug, kan))
                else:
                    untaught.setdefault(comp, set()).add((kslug, kan))
            elif (rslug, kslug) not in edge_set and (rslug, kslug) not in DECOMPOSITION_EXCEPTIONS:
                missing_edge.append((rslug, radical_char[rslug], kslug, kan))
    return missing_edge, untaught, taught_as_kanji


def decomposition_errors(level, all_levels_present, kradfile):
    missing_edge, untaught, taught_as_kanji = decomposition_gaps(
        level, all_levels_present, kradfile
    )
    results = []
    for rslug, rchar, kslug, kan in sorted(missing_edge, key=lambda t: t[2]):
        results.append((
            "WARNING",
            f"{kslug} ({kan}): KRADFILE lists {rchar} ({rslug}) as a component but no "
            f"builds_on edge exists; add the edge or record it in DECOMPOSITION_EXCEPTIONS "
            "with a reason",
        ))
    for comp, users in sorted(untaught.items(), key=lambda kv: -len(kv[1])):
        examples = ", ".join(f"{kslug} ({kan})" for kslug, kan in sorted(users)[:8])
        results.append((
            "INFO",
            f"{comp}: KRADFILE component of {len(users)} taught kanji is taught nowhere, as "
            f"neither radical nor kanji — {examples}"
            + (" …" if len(users) > 8 else ""),
        ))
    for comp, users in sorted(taught_as_kanji.items(), key=lambda kv: -len(kv[1])):
        examples = ", ".join(f"{kslug} ({kan})" for kslug, kan in sorted(users)[:8])
        results.append((
            "INFO",
            f"{comp}: KRADFILE component of {len(users)} taught kanji is taught as a kanji, not "
            f"a radical, so no builds_on edge is expressible — {examples}"
            + (" …" if len(users) > 8 else ""),
        ))
    return results


# --- check 4: mnemonic tag <-> decomposition, reverse direction ------------

def mnemonic_tag_reverse_errors(level):
    """The *forward* direction (every taught component is referenced and
    tagged) is already re-checked by `rerun_mnemonic_gates` via
    `validate_mnemonics._component_errors`. This is the reverse direction: a
    `<radical>`/`<kanji>` tag that doesn't match any of the item's actually
    taught components — most likely a stale tag left over from a decomposition
    edit, or the model naming something it wasn't given.

    Graded WARNING: the meaning-word matching this reuses from
    `validate_mnemonics` is deliberately loose (any shared content word passes
    the forward check), so a tag can legitimately reach into a component's own
    sub-story (見る's <kanji>eye</kanji> borrowing 見's own eye-radical origin)
    without naming a hallucinated component. That is a real ambiguity a human
    should read, not an objective failure.
    """
    results = []
    for kind, dirname, tag, ctx_fn, label_key in (
        ("kanji", "kanji", "radical", mnemonic_context.kanji_context, "form"),
        ("vocab", "vocabulary", "kanji", mnemonic_context.vocab_context, "char"),
    ):
        for item in mnemonic_context.load_items(dirname, level):
            ctx = ctx_fn(level, item["slug"])
            text = item.get("meaning_mnemonic") or ""
            comps = ctx["components"]
            comp_words = [validate_mnemonics._meaning_words(c["meaning_synonyms"]) for c in comps]
            comp_labels = ", ".join(c[label_key] for c in comps) or "(none taught)"
            for span in validate_mnemonics._tagged_spans(text, tag):
                if not any(
                    words and validate_mnemonics._references(span, words) for words in comp_words
                ):
                    results.append((
                        "WARNING",
                        f"{kind} {item['slug']}: <{tag}>{span}</{tag}> in meaning_mnemonic "
                        f"matches none of the taught components ({comp_labels})",
                    ))
    return results


# --- check 5: passage grammar actually used ---------------------------------

def _grammar_by_slug_upto(level):
    out = {}
    for lvl in context.LEVEL_ORDER[: context.LEVEL_ORDER.index(level) + 1]:
        for g in context.load_grammar(lvl):
            out[g["slug"]] = g
    return out


def passage_grammar_usage_errors(level):
    grammar_by_slug = _grammar_by_slug_upto(level)
    results = []
    for passage in audit_facts.load_json("readings", f"{level}.json")["passages"]:
        label = f"passage[sort_order={passage['sort_order']}] {passage['title']!r}"
        body = passage["body"]
        for gslug in passage.get("grammar_slugs") or []:
            g = grammar_by_slug.get(gslug)
            if g is None:
                continue  # unresolved slug is compile's job, not ours
            surfaces = set(g.get("accepted_forms") or [])
            surfaces |= {v for v in (g.get("conjugation_rules") or {}).values() if isinstance(v, str)}
            if surfaces and not any(s in body for s in surfaces):
                results.append((
                    "WARNING",
                    f"{label}: declares grammar_slugs {gslug!r} but none of its surfaces "
                    f"({', '.join(sorted(surfaces))}) appear in the body",
                ))
    return results


# --- check 7: look-alike symmetry -------------------------------------------

def symmetry_errors(all_levels_present):
    items = {}
    for lvl in all_levels_present:
        for kind_dir in ("radicals", "kanji"):
            for it in load_items(kind_dir, lvl):
                items[it["slug"]] = it
    seen_pairs = set()
    results = []
    for slug, it in items.items():
        for other in it.get("visually_similar_slugs") or []:
            pair = frozenset((slug, other))
            if pair in seen_pairs:
                continue
            seen_pairs.add(pair)
            other_item = items.get(other)
            if other_item is None:
                results.append((
                    "ERROR", f"{slug}: visually_similar_slugs references unknown slug {other!r}"
                ))
            elif slug not in (other_item.get("visually_similar_slugs") or []):
                results.append((
                    "ERROR",
                    f"{slug} lists {other!r} as visually similar, but {other!r} does not list "
                    f"{slug!r} back",
                ))
    return results


# --- check 8: corpus hygiene -------------------------------------------------

def _duplicates(values):
    return sorted({v for v in values if values.count(v) > 1})


def hygiene_errors(all_levels_present):
    results = []
    for kind_dir in ("radicals", "kanji", "vocabulary", "grammar"):
        for lvl in all_levels_present:
            items = load_items(kind_dir, lvl)
            label = f"{kind_dir}/{lvl}.json"

            dup_slugs = _duplicates([it["slug"] for it in items])
            if dup_slugs:
                results.append(("ERROR", f"{label}: duplicate slug(s) {dup_slugs}"))

            # Vocabulary and grammar deliberately reuse a written form across
            # distinct entries — homograph readings (本 "hon" book vs the
            # 本-counter, 人 "hito" vs the にん counter) and homograph grammar
            # (から "from" vs "because", の possessive vs nominalizer) are by
            # design, not a hygiene bug. A radical or kanji re-using a form
            # within the same level+type has no such legitimate case.
            if kind_dir in ("radicals", "kanji"):
                dup_forms = _duplicates([it["primary_form"] for it in items])
                if dup_forms:
                    results.append(("WARNING", f"{label}: duplicate primary_form(s) {dup_forms}"))

    # Same, but *across* levels — the case a per-file scan cannot see. N4 once
    # re-taught 13 N5 radical forms and 9 N5 kanji outright, which shows the
    # learner one shape as two review cards and let 明/貸 render the same
    # component chip twice.
    for kind_dir in ("radicals", "kanji"):
        by_form = {}
        for lvl in all_levels_present:
            for it in load_items(kind_dir, lvl):
                by_form.setdefault(it["primary_form"], []).append(f"{lvl}:{it['slug']}")
        for form, owners in sorted(by_form.items()):
            if len(owners) > 1:
                results.append((
                    "ERROR",
                    f"{kind_dir}: {form} is taught {len(owners)} times across levels "
                    f"({', '.join(owners)}); a later level must reuse the first slug, not re-teach the form",
                ))

    # Every radical whose form is also a taught kanji must build it. KRADFILE
    # lists such a character's only component as itself, so `comp == kan` skips
    # it and check 3 can never see the gap — this is how 長 shipped as a taught
    # radical with no children and a taught kanji with no parents.
    radical_by_form, kanji_by_form = {}, {}
    for lvl in all_levels_present:
        for r in load_items("radicals", lvl):
            radical_by_form.setdefault(r["primary_form"], r["slug"])
        for k in load_items("kanji", lvl):
            kanji_by_form.setdefault(k["primary_form"], k["slug"])
    builds_on = {
        (e["from_slug"], e["to_slug"])
        for e in audit_facts.load_json("dependencies", "graph.json")["edges"]
        if e["relationship_type"] == "builds_on"
    }
    for form, rslug in sorted(radical_by_form.items()):
        kslug = kanji_by_form.get(form)
        if kslug and (rslug, kslug) not in builds_on:
            results.append((
                "WARNING",
                f"{form} is taught as radical `{rslug}` and kanji `{kslug}` but has no "
                f"builds_on edge between them; the kanji ships with no component chip",
            ))

            sort_orders = [it["sort_order"] for it in items if "sort_order" in it]
            dup_sort = _duplicates(sort_orders)
            if dup_sort:
                results.append(("ERROR", f"{label}: duplicate sort_order value(s) {dup_sort}"))
            elif sort_orders:
                lo, hi = min(sort_orders), max(sort_orders)
                if hi - lo + 1 != len(sort_orders):
                    results.append((
                        "WARNING",
                        f"{label}: sort_order has gaps (range {lo}-{hi}, {len(sort_orders)} items)",
                    ))

    counts = {}
    for kind_dir, key in (
        ("radicals", "radicals"), ("kanji", "kanji"),
        ("vocabulary", "vocabulary"), ("grammar", "grammar"),
    ):
        counts[key] = sum(
            len(load_items(kind_dir, lvl)) for lvl in all_levels_present
        )
    counts["total_items"] = sum(counts[k] for k in ("radicals", "kanji", "vocabulary", "grammar"))
    counts["reading_passages"] = sum(
        len(load_items("readings", lvl, key="passages")) for lvl in all_levels_present
    )
    counts["dependency_edges"] = len(audit_facts.load_json("dependencies", "graph.json")["edges"])

    metadata = audit_facts.load_json("metadata.json")
    declared = metadata.get("content_counts") or {}
    for key, actual in counts.items():
        expected = declared.get(key)
        if expected != actual:
            results.append((
                "ERROR",
                f"metadata.json content_counts.{key} = {expected!r}, actual (all levels on "
                f"disk) = {actual}",
            ))
    return results


# --- check 10: span re-derivation diff --------------------------------------

def _vocab_primary_forms(all_levels_present):
    out = {}
    for lvl in all_levels_present:
        for v in load_items("vocabulary", lvl):
            out.setdefault(v["slug"], v["primary_form"])
    return out


def _span_key(span):
    return (span["start"], span["end"], span["vocabulary_slug"], span.get("inflection"))


def span_diff_errors(text, vocabulary_slugs, shipped_spans, primary_form_by_slug, label):
    """Re-derive spans from `text` + the item's own `vocabulary_slugs` (never
    from a positional seed/context estimate) and diff against the shipped
    `word_spans` — the staleness check compile cannot run, since compile only
    verifies the spans that are there are *well-formed*, not that they are
    *complete or current* (module docstring, plan check 10).
    """
    forms_by_slug = {
        slug: primary_form_by_slug[slug] for slug in vocabulary_slugs if slug in primary_form_by_slug
    }
    derived = spans.derive_spans(text, forms_by_slug)
    shipped_spans = shipped_spans or []

    derived_keys = {_span_key(s): s for s in derived}
    shipped_keys = {_span_key(s): s for s in shipped_spans}

    results = []
    for key in sorted(derived_keys.keys() - shipped_keys.keys()):
        start, end, slug, inflection = key
        results.append((
            "WARNING",
            f"{label}: span re-derivation finds {text[start:end]!r} ({slug}"
            f"{', ' + inflection if inflection else ''}) missing from shipped word_spans",
        ))
    for key in sorted(shipped_keys.keys() - derived_keys.keys()):
        start, end, slug, inflection = key
        results.append((
            "WARNING",
            f"{label}: shipped word_spans has {text[start:end]!r} ({slug}"
            f"{', ' + inflection if inflection else ''}) not reproduced by re-derivation "
            "from the current text/vocabulary_slugs — likely stale",
        ))

    for span in shipped_spans:
        if span.get("inflection") is not None and span["vocabulary_slug"] not in vocabulary_slugs:
            results.append((
                "ERROR",
                f"{label}: inflected span for {span['vocabulary_slug']} is not in "
                "vocabulary_slugs — violates the unlock-bar invariant (compile should already "
                "reject this; the JSON was likely hand-edited after the last compile)",
            ))
    return results


def span_rederivation_errors(level, primary_form_by_slug):
    results = []
    for item in audit_facts.load_json("vocabulary", f"{level}.json")["items"]:
        for i, sentence in enumerate(item.get("example_sentences") or []):
            label = f"vocab {item['slug']} example[{i}]"
            results.extend(span_diff_errors(
                sentence["japanese"], sentence.get("vocabulary_slugs") or [],
                sentence.get("word_spans"), primary_form_by_slug, label,
            ))
    for passage in audit_facts.load_json("readings", f"{level}.json")["passages"]:
        label = f"passage[sort_order={passage['sort_order']}] {passage['title']!r}"
        results.extend(span_diff_errors(
            passage["body"], passage.get("vocabulary_slugs") or [],
            passage.get("word_spans"), primary_form_by_slug, label,
        ))
    return results


# --- report assembly ---------------------------------------------------------

def audit_level(level, all_levels_present, kradfile):
    findings = Findings()

    rollup = findings.section("Review-status rollup")
    for kind, total, counts in review_status_rollup(level):
        breakdown = ", ".join(f"{status}: {n}" for status, n in sorted(counts.items()))
        rollup.add("INFO", f"{kind} ({total} total): {breakdown}")

    reruns = findings.section("Re-run of existing draft gates on shipped content")
    reruns.extend(rerun_mnemonic_gates(level))
    reruns.extend(rerun_example_gates(level))
    reruns.extend(rerun_grammar_example_gate(level))
    reruns.extend(rerun_cloze_gate(level))
    reruns.extend(rerun_passage_gate(level))

    invariants = findings.section("Accepted-answer invariants (check 1)")
    invariants.extend(accepted_answer_invariant_errors(level))

    decomposition = findings.section("Graph decomposition completeness vs KRADFILE (check 3)")
    decomposition.extend(decomposition_errors(level, all_levels_present, kradfile))

    tags = findings.section("Mnemonic tag round-trip, reverse direction (check 4)")
    tags.extend(mnemonic_tag_reverse_errors(level))

    grammar_usage = findings.section("Passage grammar actually used (check 5)")
    grammar_usage.extend(passage_grammar_usage_errors(level))

    symmetry = findings.section("Look-alike symmetry (check 7, corpus-wide)")
    symmetry.extend(symmetry_errors(all_levels_present))

    hygiene = findings.section("Corpus hygiene (check 8, corpus-wide)")
    hygiene.extend(hygiene_errors(all_levels_present))

    span_diff = findings.section("Span re-derivation diff (check 10)")
    span_diff.extend(span_rederivation_errors(level, _vocab_primary_forms(all_levels_present)))

    return findings


#: Message shapes seen across this file's `results.append((severity, message))`
#: calls. Findings don't carry slugs as structured data (the `Findings`/
#: `_Section` bucket is just (severity, message) pairs shared across every
#: check), so `--json` recovers them by pattern-matching the message text
#: each check already writes — good enough for the studio UI to link a
#: finding back to an item; not a guarantee every slug mentioned is caught.
_SLUG_PREFIXED_RE = re.compile(r"\bn[45]-[a-z][a-z0-9-]*\b")
_SLUG_KIND_LEAD_RE = re.compile(r"^(radical|kanji|vocab|grammar) (\S+?):")
_SLUG_BACKTICK_RE = re.compile(r"`([a-zA-Z][a-zA-Z0-9_-]*)`")
_SLUG_KRADFILE_RE = re.compile(r"KRADFILE lists \S+ \(([a-zA-Z][a-zA-Z0-9_-]*)\)")
_SLUG_SYMMETRY_UNKNOWN_RE = re.compile(
    r"^(\S+): visually_similar_slugs references unknown slug '([^']*)'"
)
_SLUG_SYMMETRY_ASYMMETRIC_RE = re.compile(r"^(\S+) lists '([^']*)' as visually similar")
_SLUG_PASSAGE_RE = re.compile(r"passage\[sort_order=(\d+)\]")


def extract_slugs(message, level):
    found = set(_SLUG_PREFIXED_RE.findall(message))

    m = _SLUG_KIND_LEAD_RE.match(message)
    if m:
        # Qualified with kind so same-string slugs across content types
        # (e.g. radical "mushi" vs. vocab "mushi") don't collide downstream.
        found.add(f"{m.group(1)}:{m.group(2)}")

    found.update(_SLUG_BACKTICK_RE.findall(message))

    m = _SLUG_KRADFILE_RE.search(message)
    if m:
        found.add(m.group(1))

    m = _SLUG_SYMMETRY_UNKNOWN_RE.match(message)
    if m:
        found.add(m.group(1))
        if m.group(2):
            found.add(m.group(2))

    m = _SLUG_SYMMETRY_ASYMMETRIC_RE.match(message)
    if m:
        found.add(m.group(1))
        found.add(m.group(2))

    m = _SLUG_PASSAGE_RE.search(message)
    if m:
        found.add(f"passage-{level}-{m.group(1)}")

    return sorted(found)


def write_json_report(level, findings):
    os.makedirs(REPORTS_DIR, exist_ok=True)
    out_path = os.path.join(REPORTS_DIR, f"content-audit-{level}.json")
    rows = []
    for title, entries in findings.sections:
        for severity, message in entries:
            rows.append({
                "check": title,
                "severity": severity,
                "message": message,
                "slugs": extract_slugs(message, level),
            })
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
        f.write("\n")
    return out_path


def write_report(level, findings):
    os.makedirs(REPORTS_DIR, exist_ok=True)
    out_path = os.path.join(REPORTS_DIR, f"content-audit-{level}.md")
    lines = [
        f"# Content audit — {level} (tiers 0-1)",
        "",
        "Generated by `curriculum/_build/generate_content/audit_shipped.py` — "
        "re-runs the draft-stage gates against shipped JSON and the plan's ten new "
        "deterministic checks (docs/content/content-audit-plan.md). AI semantic "
        "review (tier 2) is a separate, opt-in pass and is not included here.",
        "",
        f"**Totals: {findings.counts['ERROR']} error(s), {findings.counts['WARNING']} "
        f"warning(s), {findings.counts['INFO']} info.**",
        "",
    ]
    for title, entries in findings.sections:
        counts = {"ERROR": 0, "WARNING": 0, "INFO": 0}
        for sev, _ in entries:
            counts[sev] += 1
        lines.append(f"## {title}")
        lines.append("")
        lines.append(
            f"{counts['ERROR']} error(s), {counts['WARNING']} warning(s), {counts['INFO']} info."
        )
        lines.append("")
        if not entries:
            lines.append("(clean)")
            lines.append("")
            continue
        for sev, msg in sorted(entries, key=lambda e: {"ERROR": 0, "WARNING": 1, "INFO": 2}[e[0]]):
            lines.append(f"- **{sev}** {msg}")
        lines.append("")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    return out_path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--level", action="append", dest="levels",
                        help="repeatable; defaults to every level present in curriculum/")
    parser.add_argument("--json", action="store_true",
                        help="also write content-audit-<level>.json (studio UI consumption)")
    args = parser.parse_args()

    all_levels_present = discover_levels()
    # Skeleton levels are item lists by design — no mnemonics, no examples, no
    # art (kanji-coverage plan Phase 2) — so every content check below would fire
    # on all 553 of them. They stay in `all_levels_present` so the authored
    # levels can still resolve components that are taught there, and `--level n3`
    # still audits one on purpose.
    levels = args.levels or [
        lvl for lvl in all_levels_present if lvl not in SKELETON_LEVELS
    ]
    print("Loading KRADFILE…")
    kradfile = sources.load_kradfile()

    any_errors = False
    for level in levels:
        findings = audit_level(level, all_levels_present, kradfile)
        out_path = write_report(level, findings)
        if args.json:
            write_json_report(level, findings)
        print(
            f"Wrote {out_path}: {findings.counts['ERROR']} error(s), "
            f"{findings.counts['WARNING']} warning(s), {findings.counts['INFO']} info."
        )
        any_errors = any_errors or findings.counts["ERROR"] > 0

    raise SystemExit(1 if any_errors else 0)


if __name__ == "__main__":
    main()
