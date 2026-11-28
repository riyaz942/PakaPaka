# -*- coding: utf-8 -*-
"""Curriculum context for Phase 2c example-sentence generation (vocab).

Kanji get no example sentences: a kanji rarely stands alone as a word, so its
sentences only ever showed the vocabulary written with it. The app lists that
vocabulary on the kanji instead.

Loads the *generated* curriculum JSON (the canonical output of generate.py,
which carries sort_order) and derives the per-item inputs the generator prompt
and the mechanical gate both need: the target form the sentence must contain,
the allowed vocabulary, the allowed grammar, and Tatoeba style anchors.

## Allowed-vocabulary derivation

Deterministic and planner-free, over the ladder order (level, then
sort_order):

  * the word at ladder position i: every word up to and including it (all
    lower levels, and its own level up to itself — "what the learner has seen
    by the time this word is taught").
  * the next LOOKAHEAD_VOCAB words are offered as a second, "coming up next"
    list. Familiarity is a preference, not a rule: the prompt asks for known
    words first, and the gate accepts both lists. Words further ahead are
    rejected.

## Allowed-grammar derivation

A proportional cutoff inside the word's level: the word at position i of the
level's N words gets **all lower-level grammar** + the level's first
ceil(i/N * G) points; the points up to ceil((i + LOOKAHEAD_VOCAB)/N * G) are
offered as "coming up next", so grammar moves with the same window as the
vocabulary. The prompt carries these lists; the mechanical gate does not check
them (level_check works token by token on content words, so most grammar
patterns pass through it as particles and auxiliaries either way). Patterns
whose machinery tags as a content word (すぎる) are accepted via
`level_check.pattern_words` of the listed grammar, as reading_context does for
passages.

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


#: How many of the most recently taught grammar points the prompt offers first.
RECENT_GRAMMAR_COUNT = 8

#: How far past the item the "coming up next" window reaches, in vocab items
#: Grammar uses the same window, scaled to the level's points.
LOOKAHEAD_VOCAB = 50


def _grammar_split(level, position, total):
    """(earlier, recent, later) grammar for the item at `position` of `total`:
    every lower level in full + a proportional prefix of this level's points,
    with the last RECENT_GRAMMAR_COUNT split off as the just-taught ones;
    `later` is the points taught within the next LOOKAHEAD_VOCAB items."""
    all_grammar = context.load_grammar()
    grammar = [g for g in all_grammar if g["level"] < level]
    same_level = [g for g in all_grammar if g["level"] == level]
    cutoff = math.ceil(position / total * len(same_level))
    ahead = math.ceil(min(position + LOOKAHEAD_VOCAB, total) / total * len(same_level))
    grammar.extend(same_level[:cutoff])
    return (grammar[:-RECENT_GRAMMAR_COUNT], grammar[-RECENT_GRAMMAR_COUNT:],
            same_level[cutoff:ahead])


def vocab_context(slug):
    vocab = context.load_vocab()
    positions = {v["slug"]: i + 1 for i, v in enumerate(vocab)}
    if slug not in positions:
        raise KeyError(f"unknown vocabulary slug {slug!r}")
    item = vocab[positions[slug] - 1]
    level = item["level"]

    allowed = vocab[: positions[slug]]
    later = vocab[positions[slug]: positions[slug] + LOOKAHEAD_VOCAB]
    seen = {v["slug"] for v in allowed + later}
    same_level = [v["slug"] for v in vocab if v["level"] == level]

    form = item["primary_form"]
    reading = _reading_of(item)
    allowed_index = level_check.build_allowed_index(allowed + later)
    anchors = tatoeba.style_anchors([form], allowed_index, extra_allowed={form})
    earlier_grammar, recent_grammar, later_grammar = _grammar_split(
        level, same_level.index(slug) + 1, len(same_level))

    return {
        "type": "vocab",
        "level": level,
        "slug": slug,
        "form": form,
        "reading": reading,
        "meaning": item["meaning"],
        "allowed": allowed,
        "later": later,
        "earlier_grammar": earlier_grammar,
        "recent_grammar": recent_grammar,
        "later_grammar": later_grammar,
        "allowed_slugs": seen,
        "allowed_index": allowed_index,
        "extra_allowed": {form} | level_check.pattern_words(
            earlier_grammar + recent_grammar + later_grammar),
        "target_forms": [form] + ([reading] if reading and reading != form else []),
        "anchors": anchors,
    }


def item_context(kind, slug):
    return vocab_context(slug)


def all_slugs(level, kind):
    """Slugs of one ladder level in curriculum (sort) order."""
    return [it["slug"] for it in context.load_vocab() if it["level"] == level]


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
