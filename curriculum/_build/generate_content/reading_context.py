# -*- coding: utf-8 -*-
"""Curriculum context for Phase 4 reading-passage generation.

Derives, for one seed, everything the prompt and the mechanical gate both need:
the vocabulary and grammar the learner has met by that point in the level, the
level-check index built from them, and the seed's own brief.

## Allowed-set derivation

Same option-(a) positional cutoff as 2a grammar lessons and 2c examples
(`context.py`), applied to *both* content types because a passage is
constrained by both:

  * seed at position i of N seeds gets **all** lower-level vocabulary and
    grammar, plus the level's first `ceil(i/N * V)` vocabulary items and first
    `ceil(i/N * G)` grammar points (each by sort_order), plus
    `context.CORE_SEED_SLUGS` and `READING_CORE_SLUGS`.

Deliberately planner-free and deterministic: the same seed list yields the same
allowed sets on every machine, which is what makes a regeneration reproducible
and the gate's verdict stable.

`READING_CORE_SLUGS` is the same amendment 2a made to option (a), for the same
reason: the level's vocabulary is ordered **thematically**, not by frequency, so
a positional cutoff strands ordinary words at absurd positions — 名前 is the
488th N5 word, 時 the 567th, 次 the 686th. 2a's fix (`CORE_SEED_SLUGS`) covers
what a single example sentence needs; a passage additionally needs the
connective tissue of narrative prose — where things are, what happens next, how
many there were. That is what this list is, and nothing more: adding a topic
word here instead of moving the seed to a later position would hollow out the
level gate.

## What the gate can and cannot check

The vocabulary constraint is mechanically enforced (tokenizer, `level_check`).
The grammar constraint is **not fully mechanical**: there is no reliable way to
extract "the grammar points used in this text" from a tokenizer, so the gate
checks the passage's *declared* `grammar_slugs` against this allowed set and
nothing more. Out-of-level grammar the model used but did not declare is caught
by the human read, not by the gate. That gap is named here rather than hidden
behind a check that looks stronger than it is.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from generate_content import context, level_check, reading_seeds  # noqa: E402


#: Vocabulary every passage may use regardless of the positional cutoff — see
#: the module docstring. Narrative connective tissue only: identity, place,
#: sequence, quantity, and the handful of verbs that move a scene along.
READING_CORE_SLUGS = {
    "n5": [
        # who and what this is
        "namae", "nihon", "nihongo", "benkyou", "shukudai", "jugyou", "mono",
        # where things are
        "naka", "ue", "shita-v", "mae", "ushiro", "tonari", "chikaku",
        "migi-v", "hidari-v",
        # when, and what comes next
        "ji-oclock", "jikan-counter", "tsugi",
        # how many, how much
        "nin-counter", "takusan", "zenbu", "onaji",
        # what happens
        "sumu", "dasu", "hajimaru", "owaru", "motsu", "ireru-v", "yobu",
        "wasureru", "aruku", "magaru", "hashiru",
    ],
}


def _lower_levels(level):
    return context.LEVEL_ORDER[: context.LEVEL_ORDER.index(level)]


def _allowed_vocab(level, position, seed_count):
    vocab = context.load_vocab(level)
    allowed, seen = [], set()

    def add(item):
        if item["slug"] not in seen:
            seen.add(item["slug"])
            allowed.append(item)

    for lower in _lower_levels(level):
        for v in context.load_vocab(lower):
            add(v)
    cutoff = math.ceil(position / seed_count * len(vocab))
    for v in vocab[:cutoff]:
        add(v)
    by_slug = {v["slug"]: v for v in vocab}
    for fs in context.CORE_SEED_SLUGS.get(level, []) + READING_CORE_SLUGS.get(level, []):
        if fs not in by_slug:
            raise KeyError(f"core vocab slug {fs!r} not in {level} vocabulary")
        add(by_slug[fs])
    return allowed


def _allowed_grammar(level, position, seed_count):
    allowed, seen = [], set()

    def add(item):
        if item["slug"] not in seen:
            seen.add(item["slug"])
            allowed.append(item)

    for lower in _lower_levels(level):
        for g in context.load_grammar(lower):
            add(g)
    grammar = context.load_grammar(level)
    cutoff = math.ceil(position / seed_count * len(grammar))
    for g in grammar[:cutoff]:
        add(g)
    return allowed


def seed_context(level, slug):
    seed = reading_seeds.seed(level, slug)
    seeds = reading_seeds.seeds_for(level)

    allowed_vocab = _allowed_vocab(level, seed["position"], len(seeds))
    allowed_grammar = _allowed_grammar(level, seed["position"], len(seeds))
    extra_allowed = set(seed.get("extra_allowed", []))

    return {
        "type": "reading",
        "level": level,
        "slug": slug,
        "seed": seed,
        "tone": seed["tone"],
        "topic": seed["topic"],
        "target_words": tuple(seed["target_words"]),
        "question_count": seed["question_count"],
        "allowed": allowed_vocab,
        "allowed_slugs": {v["slug"] for v in allowed_vocab},
        "allowed_index": level_check.build_allowed_index(allowed_vocab),
        "allowed_grammar": allowed_grammar,
        "allowed_grammar_slugs": {g["slug"] for g in allowed_grammar},
        "extra_allowed": extra_allowed,
        #: Literal surfaces the span builder may mark up, longest first so a
        #: compound wins over its own prefix (日本語 before 日本).
        "span_forms": _span_forms(allowed_vocab),
    }


def _span_forms(allowed_vocab):
    """{primary_form: slug} for span derivation.

    `compile-curriculum` requires `body.slice(start, end) === primary_form`
    exactly, so only literal occurrences of the dictionary form can ever become
    a span — conjugated usage (食べました for 食べる) is real vocabulary use but
    is not markable, which is also the convention the shipped passages follow.
    Duplicate forms across slugs keep the first in curriculum order.
    """
    forms = {}
    for v in allowed_vocab:
        forms.setdefault(v["primary_form"], v["slug"])
    return forms


def format_grammar_list(items):
    return context.format_grammar_list(items)


def all_slugs(level):
    return reading_seeds.all_slugs(level)
