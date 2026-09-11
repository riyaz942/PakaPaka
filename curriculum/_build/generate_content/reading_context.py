# -*- coding: utf-8 -*-
"""Curriculum context for Phase 4 reading-passage generation.

Derives, for one seed, everything the prompt and the mechanical gate both need:
the vocabulary and grammar the learner has met by that point in the level, the
level-check index built from them, and the seed's own brief.

## Allowed-set derivation

The window is **authored per seed** (`reading_seeds.py`), not derived from the
seed's position:

  * **all** lower-level vocabulary and grammar, plus
  * the level's first `vocab_cutoff` vocabulary items and first
    `grammar_cutoff` grammar points (each by sort_order), plus
  * the seed's own `pull_forward` words, plus `context.CORE_SEED_SLUGS`, plus
  * the seed's own `pull_forward_grammar` points.

`position/N` used to derive the cutoffs and no longer does. At 30 seeds that
rule gives passage 1 the first 24 N5 words — all pronouns and demonstratives —
and supplies no verb at all before word 377 of 718, because the level is
ordered thematically rather than by frequency. The flat always-allowed
`READING_CORE_SLUGS` that patched this at 10 seeds would have become the entire
vocabulary of the first half of the level at 30, which hollows out the gate it
sits behind. It is replaced by `pull_forward`: the same idea, graded per seed
and authored where the rest of the plan for that passage lives. See
docs/content/reading-passage-expansion-plan.md, § The positional window breaks
at 30 seeds.

The grammar list has the same defect and `pull_forward_grammar` is the same
answer: N5's four adjective points sit at 47–50 of 74, and `grammar_detect`
fires them on *any* adjective, so a prefix window forbids 大きい, 好き and いい
outright until two thirds of the level is open. Authoring the N5 ladder is what
found it; N4 needs none, because a lower level's grammar is allowed in full.

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


def _lower_levels(level):
    return context.LEVEL_ORDER[: context.LEVEL_ORDER.index(level)]


def _allowed_vocab(level, seed):
    vocab = context.load_vocab(level)
    allowed, seen = [], set()

    def add(item):
        if item["slug"] not in seen:
            seen.add(item["slug"])
            allowed.append(item)

    for lower in _lower_levels(level):
        for v in context.load_vocab(lower):
            add(v)
    for v in vocab[: seed["vocab_cutoff"]]:
        add(v)
    by_slug = {v["slug"]: v for v in vocab}
    for fs in context.CORE_SEED_SLUGS.get(level, []) + list(seed["pull_forward"]):
        if fs not in by_slug:
            raise KeyError(f"core vocab slug {fs!r} not in {level} vocabulary")
        add(by_slug[fs])
    return allowed


def _allowed_grammar(level, seed):
    allowed, seen = [], set()

    def add(item):
        if item["slug"] not in seen:
            seen.add(item["slug"])
            allowed.append(item)

    for lower in _lower_levels(level):
        for g in context.load_grammar(lower):
            add(g)
    grammar = context.load_grammar(level)
    for g in grammar[: seed["grammar_cutoff"]]:
        add(g)
    by_slug = {g["slug"]: g for g in grammar}
    for fs in seed.get("pull_forward_grammar", []):
        if fs not in by_slug:
            raise KeyError(f"pull_forward_grammar slug {fs!r} not in {level} grammar")
        add(by_slug[fs])
    return allowed


def seed_context(level, slug):
    seed = reading_seeds.seed(level, slug)

    allowed_vocab = _allowed_vocab(level, seed)
    allowed_grammar = _allowed_grammar(level, seed)
    #: Names the seed grants, plus the machinery of the grammar it may use —
    #: 限り, 以来, 反面, わけ are content words in no level's vocabulary, so
    #: without this the level check rejects a passage for using a point it was
    #: taught. Derived from `allowed_grammar`, so a pattern word is accepted
    #: exactly where its own point is: past the cutoff, it is out of level again.
    extra_allowed = set(seed.get("extra_allowed", [])) | level_check.pattern_words(
        allowed_grammar
    )
    by_slug = {g["slug"]: g for g in allowed_grammar}
    unknown = [s for s in seed["required_grammar"] if s not in by_slug]
    if unknown:
        raise KeyError(
            f"{slug}: required_grammar {unknown} is outside the seed's own "
            f"grammar_cutoff — run reading_seeds.ladder_errors({level!r})"
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
