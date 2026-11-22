# -*- coding: utf-8 -*-
"""Curriculum context for Phase 4 reading-passage generation.

Derives, for one seed, everything the prompt and the mechanical gate both need:
the vocabulary and grammar the learner has met by that point in the level, the
level-check index built from them, and the seed's own brief.

## Allowed-set derivation

A seed sits at a ladder level (`reading_seeds.seed_level`). Its window is
every word and every grammar point at or below that level — the ladder rule
that a passage teaches with learned words only (a passage's level is the
highest level of any word or grammar point in it). The JLPT-era authored
window (`vocab_cutoff`, `pull_forward`, `grammar_cutoff`,
`pull_forward_grammar`, `context.CORE_SEED_SLUGS`) is gone with the JLPT
groups it indexed.

Still planner-free and deterministic: the same seed list yields the same
allowed sets on every machine, which is what makes a regeneration reproducible
and the gate's verdict stable.

## What the gate checks

Both constraints are now mechanical. Vocabulary is checked with the tokenizer
(`level_check`); grammar is **detected in the body** by `grammar_detect.py` and
checked against this allowed set, so out-of-level grammar no longer depends on
a human noticing it, and `grammar_slugs` is derived rather than declared. The
seed's `required_grammar` is checked the same way, from the other side: the
points this passage was assigned have to actually be in it.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from generate_content import context, level_check, reading_seeds  # noqa: E402


def seed_context(level, slug):
    seed = reading_seeds.seed(level, slug)

    allowed_vocab = context.vocab_through(level)
    allowed_grammar = context.grammar_through(level)
    #: Names the seed grants, plus the machinery of the grammar it may use —
    #: 限り, 以来, 反面, わけ are content words in no level's vocabulary, so
    #: without this the level check rejects a passage for using a point it was
    #: taught. Derived from `allowed_grammar`, so a pattern word is accepted
    #: exactly where its own point is: above the level, it is out of level again.
    extra_allowed = set(seed.get("extra_allowed", [])) | level_check.pattern_words(
        allowed_grammar
    )
    by_slug = {g["slug"]: g for g in allowed_grammar}
    unknown = [s for s in seed["required_grammar"] if s not in by_slug]
    if unknown:
        raise KeyError(
            f"{slug}: required_grammar {unknown} is above level {level} — "
            f"run reading_seeds.ladder_errors({level!r})"
        )

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
        #: The points this passage must use, as items — the prompt briefs them
        #: by name and the gate checks the body for them.
        "required_grammar": [by_slug[s] for s in seed["required_grammar"]],
        "required_grammar_slugs": list(seed["required_grammar"]),
        "extra_allowed": extra_allowed,
        #: Literal surfaces the span builder may mark up, longest first so a
        #: compound wins over its own prefix (日本語 before 日本).
        "span_forms": _span_forms(allowed_vocab),
    }


def _span_forms(allowed_vocab):
    """{primary_form: slug} for span derivation.

    This is the *dictionary* layer: literal occurrences of the form. Conjugated
    usage (食べました for 食べる) is spanned on top of it by
    `generate_content/spans.py`, over this same allowed set — so a word that
    appears only conjugated is linked too, and both layers feed a passage's
    `vocabulary_slugs`. Duplicate forms across slugs keep the first in
    curriculum order.
    """
    forms = {}
    for v in allowed_vocab:
        forms.setdefault(v["primary_form"], v["slug"])
    return forms


def format_grammar_list(items):
    return context.format_grammar_list(items)


def all_slugs(level):
    return reading_seeds.all_slugs(level)
