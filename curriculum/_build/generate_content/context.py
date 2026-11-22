# -*- coding: utf-8 -*-
"""Curriculum context for Phase 2a grammar lesson generation.

Loads the *generated* curriculum JSON (curriculum/{vocabulary,grammar}/items.json
— the canonical output of generate.py, which carries sort_order — grouped by the
old JLPT level through jlpt_groups.py until Task 6) and derives the
per-grammar-point inputs the generator prompt needs: allowed vocabulary, taught
siblings, and upcoming related points.

## Allowed-vocabulary derivation — option (a) override

docs/content/content-pipeline-plan.md Phase 2a originally derived "allowed vocabulary"
from the item's *simulated planner unlock position* (sort_order + dependency
graph, as the app actually sequences content). The Phase 1 spot-check
(curriculum/_build/reports/allowed-vocab-spotcheck.md) showed that derivation is
unusable for lesson generation: the planner's radical-first quotas leave the
first grammar point with **1** unlocked vocab word, ~100 of 171 grammar points
are taught before some of their own linked vocabulary, and ~138 N5 words defer
into N4 study behind cross-level kanji edges.

Option (a), adopted instead: allowed vocab for a grammar point =

  * **all** vocabulary from lower JLPT levels (none for N5), plus
  * same-level vocabulary up to a **proportional sort_order cutoff** —
    grammar point at position g of G gets the first ceil(g/G * V) of the
    level's V vocabulary items (by vocab sort_order), plus
  * the grammar point's own `vocabulary_slugs` (taught alongside it by
    definition), plus
  * CORE_SEED_SLUGS — a fixed set of survival verbs/nouns/adjectives and
    connectives that are always allowed (pilot run 1 amendment: the vocab list is ordered
    thematically, so 食べる/飲む/見る/来る sat past the cutoff for most pilot
    points and the generator could not write natural examples without them —
    9/10 drafts flagged out-of-level core verbs), plus
  * the function-word / colloquialism allowlists in level_check.py.

This tracks "roughly how far through the level the learner is" without
inheriting the planner's interleaving artifacts, and is deterministic across
regenerations. It intentionally does NOT consult the dependency graph or the
lesson planner.
"""

import math
import os

import jlpt_groups

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CURRICULUM_DIR = os.path.dirname(BUILD_DIR)

#: Lower levels come first; a level's allowed vocab includes every earlier level.
LEVEL_ORDER = ["n5", "n4", "n3"]

#: Survival vocabulary treated as known from the first grammar point (see the
#: option-(a) amendment in the module docstring). Every slug must exist in the
#: level's vocab file; allowed_vocab_for raises on typos.
CORE_SEED_SLUGS = {
    "n5": [
        # verbs
        "taberu", "nomu-v", "miru-v", "iku-v", "kuru-v", "kaeru-v", "kau-v",
        "yomu", "kaku", "kiku-v", "hanasu-v", "au", "wakaru", "shiru",
        "hairu-v", "deru-v", "okiru", "neru", "suwaru", "matsu",
        "asobu", "akeru", "shimeru", "tsukau",
        # nouns
        "okane", "osake", "ocha", "mizu", "gohan", "asagohan", "hirugohan",
        "bangohan", "eiga", "shashin", "hon", "gakkou-v", "ie", "tomodachi",
        "sensei", "gakusei", "neko", "inu", "sakana", "niku", "pan",
        "mado", "heya", "kouen", "umi", "koohii",
        "kyou", "ashita", "kinou", "ima", "issho-ni",
        # adjectives
        "ii", "yoi", "takai-adj", "yasui-adj", "samui", "atsui-hot",
        "isogashii", "oishii", "muzukashii", "tanoshii",
        # connectives and frequency — words 669-694 of 718, so a prefix window
        # reaches them only at the last seed of the level, and a passage
        # without them can only write one fact per sentence (see
        # docs/content/reading-passage-minna-no-nihongo-alignment.md, § 2).
        # Minna no Nihongo uses それから in its lesson 4 reading.
        "soshite", "sorekara", "demo", "dakara", "totemo", "itsumo", "tokidoki",
        # the four verbs everything else is built out of — words 384-411 of
        # 718. する, ある, いる and なる were *already* accepted by the gate via
        # level_check.FUNCTION_WORD_ALLOWLIST, but no prompt ever listed them,
        # so the generator wrote around a limit that did not exist (宿題を書く
        # for 宿題をする). 言う was genuinely out of reach, which is why every
        # passage with dialogue quoted people with と話しました instead of
        # と言いました. See the same doc, § The words were never the problem.
        "iu-v", "suru", "aru", "iru-exist", "naru-become",
        # 置く — word 591 of 718, so 25 of the 30 seeds could open a box
        # (開ける, 417) and close it (閉める, 418) but not put it down. The
        # only other way to say a thing sits somewhere is 置いてあります,
        # which is N4 grammar (tearu), so every early passage that had to
        # leave an object somewhere bent a verb instead — 角に持っていきました
        # for 角に置きました, and 箱が待っています for 箱があります. See the
        # same doc, § An object is not a person.
        "oku",
    ],
}


def load_items(kind, level):
    return jlpt_groups.load_items(kind, level)


def load_vocab(level):
    return sorted(load_items("vocabulary", level), key=lambda v: v["sort_order"])


def load_grammar(level):
    return sorted(load_items("grammar", level), key=lambda g: g["sort_order"])


def grammar_item(level, slug):
    for g in load_grammar(level):
        if g["slug"] == slug:
            return g
    raise KeyError(f"unknown grammar slug {slug!r} in level {level}")


def allowed_vocab_for(level, slug):
    """Option (a): lower levels in full + proportional same-level cutoff +
    the point's own linked vocabulary. Returns vocab items in stable order."""
    grammar = load_grammar(level)
    positions = {g["slug"]: i + 1 for i, g in enumerate(grammar)}
    if slug not in positions:
        raise KeyError(f"unknown grammar slug {slug!r} in level {level}")

    allowed = []
    seen = set()

    def add(item):
        if item["slug"] not in seen:
            seen.add(item["slug"])
            allowed.append(item)

    for lower in LEVEL_ORDER[: LEVEL_ORDER.index(level)]:
        for v in load_vocab(lower):
            add(v)

    vocab = load_vocab(level)
    cutoff = math.ceil(positions[slug] / len(grammar) * len(vocab))
    for v in vocab[:cutoff]:
        add(v)

    by_slug = {v["slug"]: v for v in vocab}
    for fs in CORE_SEED_SLUGS.get(level, []):
        if fs not in by_slug:
            raise KeyError(f"seed vocab slug {fs!r} not in {level} vocabulary")
        add(by_slug[fs])
    for fs in grammar_item(level, slug).get("vocabulary_slugs", []):
        # own linked vocab may live in a lower level (already added above)
        if fs in by_slug:
            add(by_slug[fs])

    return allowed


def siblings_for(level, slug, taught_limit=6, upcoming_limit=3):
    """Same-family grammar around this point: (taught, upcoming).

    "Taught" = same family, earlier sort_order (nearest first flipped back to
    curriculum order); "upcoming" = same family, later sort_order (nearest).
    Used for the contrast section and forward teasers respectively.
    """
    grammar = load_grammar(level)
    me = grammar_item(level, slug)
    family = me.get("family")
    taught = [
        g for g in grammar
        if g["slug"] != slug and g.get("family") == family
        and g["sort_order"] < me["sort_order"]
    ]
    upcoming = [
        g for g in grammar
        if g["slug"] != slug and g.get("family") == family
        and g["sort_order"] > me["sort_order"]
    ]
    taught = sorted(taught, key=lambda g: g["sort_order"])[-taught_limit:]
    upcoming = sorted(upcoming, key=lambda g: g["sort_order"])[:upcoming_limit]
    return taught, upcoming


def format_vocab_list(vocab):
    lines = []
    for v in vocab:
        reading = v.get("accepted_answers", [])
        kana = next(
            (a["answer_text"] for a in reading if a.get("answer_type") == "reading"),
            None,
        )
        kana_part = f" ({kana})" if kana and kana != v["primary_form"] else ""
        lines.append(f"- {v['primary_form']}{kana_part} — {v['meaning']} [{v['slug']}]")
    return "\n".join(lines) if lines else "(none yet)"


def format_grammar_list(items):
    if not items:
        return "(none)"
    return "\n".join(
        f"- {g['primary_form']} — {g['meaning']} (structure: {g['structure']}) [{g['slug']}]"
        for g in items
    )
