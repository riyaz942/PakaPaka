# -*- coding: utf-8 -*-
"""Curriculum context for Phase 2c example-sentence generation (kanji + vocab).

Loads the *generated* curriculum JSON (the canonical output of generate.py,
which carries sort_order) and derives the per-item inputs the generator prompt
and the mechanical gate both need: the target form the sentence must contain,
the allowed vocabulary, the allowed grammar, and Tatoeba style anchors.

## Allowed-vocabulary derivation

Mirrors the option-(a) positional cutoff adopted for 2a grammar lessons
(context.py) — deterministic, planner-free:

  * vocab item at position i of the level's V items: **all lower-level vocab**
    + the level's first i items (the item's own prefix, "what the learner has
    seen by the time this word is taught") + CORE_SEED_SLUGS.
  * kanji item at position k of the level's K items: all lower-level vocab +
    a proportional cutoff of the level's vocab (first ceil(k/K * V) items) +
    CORE_SEED_SLUGS + **every in-scope vocab word containing the kanji** (the
    target words — a kanji's example exists precisely to show the kanji in
    use, so the words that carry it are allowed even past the cutoff).

## Allowed-grammar derivation

Same positional cutoff, applied to the level's grammar points: an item at
position i of N gets **all lower-level grammar** + the level's first
ceil(i/N * G) points. A sentence for an N4 kanji may therefore lean on N5 and
early-N4 patterns, never on N3 ones or on N4 patterns taught much later. The
prompt carries this list; the mechanical gate does not check it (level_check
works token by token on content words, so grammar patterns pass through it as
particles and auxiliaries either way).

The list is split for the prompt: the last RECENT_GRAMMAR_COUNT points are the
ones taught just before this item, so the prompt offers them first (a sentence
that needs a pattern should reach for what the learner is still consolidating);
the rest are shown as still-allowed background.

Tatoeba anchors are style references only (ground rule 2): real native
sentences containing the target, shown in the prompt, never shipped.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from generate_content import context, level_check, tatoeba  # noqa: E402


def _reading_of(item):
    return next(
        (a["answer_text"] for a in item.get("accepted_answers", [])
         if a.get("answer_type") == "reading"),
        None,
    )


def _with_seeds(level, allowed, seen):
    by_slug = {v["slug"]: v for v in context.load_vocab(level)}
    for fs in context.CORE_SEED_SLUGS.get(level, []):
        if fs not in by_slug:
            raise KeyError(f"seed vocab slug {fs!r} not in {level} vocabulary")
        if fs not in seen:
            seen.add(fs)
            allowed.append(by_slug[fs])


def _lower_levels(level):
    return context.LEVEL_ORDER[: context.LEVEL_ORDER.index(level)]


#: How many of the most recently taught grammar points the prompt offers first.
RECENT_GRAMMAR_COUNT = 8


def _grammar_split(level, position, total):
    """(earlier, recent) grammar for the item at `position` of `total`: every
    lower level in full + a proportional prefix of this level's points, with
    the last RECENT_GRAMMAR_COUNT split off as the just-taught ones."""
    grammar = []
    for lower in _lower_levels(level):
        grammar.extend(context.load_grammar(lower))
    same_level = context.load_grammar(level)
    grammar.extend(same_level[: math.ceil(position / total * len(same_level))])
    return grammar[:-RECENT_GRAMMAR_COUNT], grammar[-RECENT_GRAMMAR_COUNT:]


def vocab_context(level, slug):
    vocab = context.load_vocab(level)
    positions = {v["slug"]: i + 1 for i, v in enumerate(vocab)}
    if slug not in positions:
        raise KeyError(f"unknown vocabulary slug {slug!r} in level {level}")
    item = vocab[positions[slug] - 1]

    allowed, seen = [], set()
    for lower in _lower_levels(level):
        for v in context.load_vocab(lower):
            if v["slug"] not in seen:
                seen.add(v["slug"])
                allowed.append(v)
    for v in vocab[: positions[slug]]:
        if v["slug"] not in seen:
            seen.add(v["slug"])
            allowed.append(v)
    _with_seeds(level, allowed, seen)

    form = item["primary_form"]
    reading = _reading_of(item)
    allowed_index = level_check.build_allowed_index(allowed)
    anchors = tatoeba.style_anchors([form], allowed_index, extra_allowed={form})
    earlier_grammar, recent_grammar = _grammar_split(level, positions[slug], len(vocab))

    return {
        "type": "vocab",
        "level": level,
        "slug": slug,
        "form": form,
        "reading": reading,
        "meaning": item["meaning"],
        "allowed": allowed,
        "earlier_grammar": earlier_grammar,
        "recent_grammar": recent_grammar,
        "allowed_slugs": seen,
        "allowed_index": allowed_index,
        "extra_allowed": {form},
        "target_forms": [form] + ([reading] if reading and reading != form else []),
        "anchors": anchors,
    }


def kanji_context(level, slug):
    kanji = context.load_items("kanji", level)
    kanji = sorted(kanji, key=lambda k: k["sort_order"])
    positions = {k["slug"]: i + 1 for i, k in enumerate(kanji)}
    if slug not in positions:
        raise KeyError(f"unknown kanji slug {slug!r} in level {level}")
    item = kanji[positions[slug] - 1]
    char = item["primary_form"]

    vocab = context.load_vocab(level)
    cutoff = math.ceil(positions[slug] / len(kanji) * len(vocab))
    allowed, seen = [], set()
    in_scope = []
    for lower in _lower_levels(level):
        lower_vocab = context.load_vocab(lower)
        in_scope.extend(lower_vocab)
        for v in lower_vocab:
            if v["slug"] not in seen:
                seen.add(v["slug"])
                allowed.append(v)
    in_scope.extend(vocab)
    for v in vocab[:cutoff]:
        if v["slug"] not in seen:
            seen.add(v["slug"])
            allowed.append(v)
    _with_seeds(level, allowed, seen)

    # Target words: every in-scope vocab word written with this kanji. They are
    # what the example sentences actually showcase, and are always allowed.
    target_words = [v for v in in_scope if char in v["primary_form"]]
    for v in target_words:
        if v["slug"] not in seen:
            seen.add(v["slug"])
            allowed.append(v)

    readings = [r["reading"] for r in item.get("readings", [])]
    allowed_index = level_check.build_allowed_index(allowed)
    anchors = tatoeba.style_anchors([char], allowed_index, extra_allowed={char})
    earlier_grammar, recent_grammar = _grammar_split(level, positions[slug], len(kanji))

    return {
        "type": "kanji",
        "level": level,
        "slug": slug,
        "char": char,
        "meaning": item["meaning"],
        "readings": readings,
        "allowed": allowed,
        "earlier_grammar": earlier_grammar,
        "recent_grammar": recent_grammar,
        "allowed_slugs": seen,
        "allowed_index": allowed_index,
        "extra_allowed": {char},
        "target_words": target_words,
        "anchors": anchors,
    }


def item_context(level, kind, slug):
    return kanji_context(level, slug) if kind == "kanji" else vocab_context(level, slug)


def all_slugs(level, kind):
    """Slugs for a level in curriculum (sort) order.

    Kanji no in-scope vocabulary word is written with are skipped: their prompt
    would carry an empty target-word list, so the generator has nothing taught
    to showcase and can only invent usage for a character that may well be
    bound (集 is not a standalone noun; 写真集 is the word). No examples beat
    wrong ones — add the missing vocabulary and the kanji re-enters the queue.
    """
    kind_dir = "kanji" if kind == "kanji" else "vocabulary"
    items = sorted(context.load_items(kind_dir, level), key=lambda it: it["sort_order"])
    if kind != "kanji":
        return [it["slug"] for it in items]
    forms = [v["primary_form"]
             for lvl in _lower_levels(level) + [level]
             for v in context.load_vocab(lvl)]
    return [it["slug"] for it in items
            if any(it["primary_form"] in form for form in forms)]


def format_grammar_list(items):
    """Like context.format_grammar_list, minus the [slug] — the example prompt
    asks the model to report the slugs it used in [brackets], and those are
    vocabulary slugs only; a grammar slug reported there fails the gate."""
    if not items:
        return "(none yet)"
    return "\n".join(
        f"- {g['primary_form']} — {g['meaning']} (structure: {g['structure']})"
        for g in items
    )


def format_target_words(target_words):
    if not target_words:
        return ("(no taught vocabulary uses this kanji yet — use the character "
                "as a standalone word only if that is natural Japanese)")
    return context.format_vocab_list(target_words)
