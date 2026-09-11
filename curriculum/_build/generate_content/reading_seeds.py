# -*- coding: utf-8 -*-
"""Phase 4 reading-passage seeds (docs/content/content-pipeline-plan.md Phase 4).

A seed is the *plan* for one passage: where it sits in the level, how long it
should be, how many comprehension questions it carries, what it is about, and
— per Rev 1 — its **tone tag**. Nothing here is generated; these are the
maintainer-authored inputs the generator reads.

## Why tone is a seed field

Rev 1 wants 50–60% of each level's passages humorous. Humour left to per-call
chance gives whatever mix the model feels like, so it is assigned here as a
planned mix and checked mechanically (`tone_mix_errors`). `humorous` seeds get
the comedy-register section of `prompts/persona.md`; `neutral` seeds get the
same persona minus the instruction to be funny.

## `position` and the allowed sets

`position` is the seed's rank within the level (1..N) — the "passage 3 of 30"
the prompt states, and the order the level ships in. It no longer *derives*
anything: the window is authored per seed (below), so renumbering changes the
narrative order and nothing about what the generator may use.

## The authored ladder — `vocab_cutoff`, `pull_forward`, `grammar_cutoff`

Each seed declares its own window
(docs/content/reading-passage-expansion-plan.md, § The positional window breaks
at 30 seeds):

  * `vocab_cutoff` — how many of the level's vocabulary items, by sort_order,
    this passage may use. Replaces the `position/N` proportional slice, which
    at 30 seeds hands passage 1 twenty-four pronouns and no verb (the first N5
    verb is word 377 of 718).
  * `pull_forward` — later slugs this seed may use anyway. A **graded release**
    replacing the flat always-allowed `READING_CORE_SLUGS`: early seeds pull a
    few verbs forward, later seeds none, because the cutoff has reached them.
  * `grammar_cutoff` — the same, over the level's grammar points.

Authored, checked in, and read by the generator — never chosen while the model
writes, because a model-chosen window makes the level gate vacuous and
regeneration has to reproduce.

## `required_grammar`

The grammar points this passage **must** use, so that 100% grammar coverage per
level is a build invariant rather than a hope: `grammar_coverage_errors` fails
the build when a level slug is assigned to no seed or to two, and
`validate_readings.py` fails a passage whose body does not actually contain
what its seed was assigned (detected by `grammar_detect.py`, not declared by
the model).

## `extra_allowed`

Per-seed level-check escape hatch, for the one thing the exception policy in
`level_check.py` cannot cover on its own: **character and place names**. unidic
tags invented names inconsistently (ポチ comes back as a common noun, not
固有名詞), so a passage with a named cat fails the gate unless the seed says
the name exists. Anything else in this list is a vocabulary gap being papered
over — add the word to the level instead.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from generate_content import context, grammar_detect  # noqa: E402

#: Tone tags. `humorous` seeds pull the persona's comedy register.
TONES = ("humorous", "neutral")

#: Humorous seeds as a fraction of a level's seeds. Raised from (0.50, 0.60) by
#: the expansion plan: 80%, not 100%, because some subjects fight comedy and 30
#: gags in a row at one level flattens out.
TONE_MIX_BOUNDS = (0.75, 0.85)

#: Ladder fields every seed carries — see the module docstring.
LADDER_FIELDS = ("vocab_cutoff", "pull_forward", "grammar_cutoff", "required_grammar")

#: N5 — 10 passages, growing from ~35 to ~100 words (the shipped
#: hand-authored set measures 29–46), 6 humorous (60%).
#: `target_words` is a band on the tokenizer word count (see
#: `validate_readings.word_count`), not on characters.
#:
#: **These 10 are retired by step 3 of the expansion plan**, which replaces them
#: with a 30-seed ladder. Until then they carry the cutoffs the old
#: `position/N` rule derived (`ceil(p/10 × 718)` vocabulary, `ceil(p/10 × 74)`
#: grammar) and the old flat `READING_CORE_SLUGS` as `pull_forward`, trimmed per
#: seed to the slugs the cutoff has not already reached. `required_grammar` is
#: empty except on the two seeds the gate's fixtures use, so the level-wide
#: coverage check reports the other 72 N5 slugs as unassigned — which is the
#: true state until the 30 seeds are authored.
#: The flat `READING_CORE_SLUGS` the retired seeds were generated against, now
#: carried as `pull_forward` by the seeds whose cutoff has not reached it.
#: Deleted with those seeds in step 3.
_RETIRED_PULL_FORWARD = [
    "namae", "nihon", "nihongo", "benkyou", "shukudai", "jugyou", "mono",
    "naka", "ue", "shita-v", "mae", "ushiro", "tonari", "chikaku",
    "migi-v", "hidari-v",
    "ji-oclock", "jikan-counter", "tsugi",
    "nin-counter", "takusan", "zenbu", "onaji",
    "sumu", "dasu", "hajimaru", "owaru", "motsu", "ireru-v", "yobu",
    "wasureru", "aruku", "magaru", "hashiru",
]

N5_SEEDS = [
    {
        "slug": "atarashii-kurasu",
        "position": 1,
        "tone": "neutral",
        "vocab_cutoff": 72,
        "pull_forward": _RETIRED_PULL_FORWARD,
        "grammar_cutoff": 8,
        "required_grammar": [],
        "target_words": (28, 42),
        "question_count": 2,
        "topic": (
            "A new student introduces themself on the first day of a Japanese "
            "class: name, the country they came from, what they study, where "
            "they live now. Plain and warm; this is the first passage a learner "
            "reads, so short sentences and one idea each."
        ),
        "extra_allowed": ["リサ"],
    },
    {
        "slug": "neko-to-shukudai",
        "position": 2,
        "tone": "humorous",
        "vocab_cutoff": 144,
        "pull_forward": _RETIRED_PULL_FORWARD,
        # 23, not the 15 the old rule derived: 先生に出しません is `ni-indirect`
        # (point 23), which the shipped passage and the gate's own good fixture
        # both use. The old rule never noticed, because nothing read the body.
        "grammar_cutoff": 23,
        "required_grammar": ["masen", "mashita", "wo"],
        "target_words": (32, 48),
        "question_count": 2,
        "topic": (
            "The writer explains, completely deadpan, why the homework is late: "
            "the cat sat on it, then slept on it, and moving a sleeping cat is "
            "not possible. Report it as a series of plain facts — no punchline, "
            "no winking at the reader."
        ),
        "extra_allowed": ["タマ"],
    },
    {
        "slug": "gakkou-no-ichinichi",
        "position": 3,
        "tone": "neutral",
        "vocab_cutoff": 216,
        "pull_forward": _RETIRED_PULL_FORWARD,
        "grammar_cutoff": 23,
        "required_grammar": [],
        "target_words": (38, 55),
        "question_count": 3,
        "topic": (
            "A school day told by the clock: when class starts, what happens "
            "before lunch, what happens after, when the writer goes home. "
            "Times and numbers are the backbone — the questions should be "
            "answerable by reading a time off the passage."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "tamago-o-kaisugiru",
        "position": 4,
        "tone": "humorous",
        "vocab_cutoff": 288,
        "pull_forward": _RETIRED_PULL_FORWARD,
        "grammar_cutoff": 30,
        "required_grammar": [],
        "target_words": (42, 60),
        "question_count": 2,
        "topic": (
            "A shopping trip that goes quietly wrong: the writer forgets what "
            "was on the list, buys eggs to be safe, gets home, and finds the "
            "fridge already full of eggs. The absurdity is in the arithmetic, "
            "told flatly."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "eki-made-no-michi",
        "position": 5,
        "tone": "neutral",
        "vocab_cutoff": 359,
        "pull_forward": _RETIRED_PULL_FORWARD,
        "grammar_cutoff": 37,
        "required_grammar": ["kara-from", "te-kudasai"],
        "target_words": (48, 68),
        "question_count": 3,
        "topic": (
            "Someone asks a stranger the way to the post office and gets a "
            "short set of directions: straight along this street, left at the "
            "second corner, it is next to the bank, about five minutes on "
            "foot. Polite register throughout."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "kasa-no-machigai",
        "position": 6,
        "tone": "humorous",
        "vocab_cutoff": 431,
        "pull_forward": [
            "namae", "nihon", "nihongo", "benkyou", "shukudai", "jugyou", "mono",
            "naka", "ue", "shita-v", "mae", "ushiro", "tonari", "chikaku",
            "migi-v", "hidari-v",
            "ji-oclock", "jikan-counter", "tsugi",
            "nin-counter", "takusan", "zenbu",
            "sumu", "hajimaru", "owaru", "yobu", "magaru",
        ],
        "grammar_cutoff": 45,
        "required_grammar": [],
        "target_words": (55, 75),
        "question_count": 3,
        "topic": (
            "A rainy day and the wrong umbrella: the writer takes an umbrella "
            "from the stand at the station, walks home in the rain, and only "
            "at the front door notices it is much too small — and blue, not "
            "black. Deadpan, physical, one object going wrong."
        ),
        "extra_allowed": [],
    },
    {
        # Position 7 rather than 9 because 次 and お金 sit late in the level's
        # thematic ordering; see the position note in the module docstring.
        "slug": "jidouhanbaiki",
        "position": 7,
        "tone": "humorous",
        "vocab_cutoff": 503,
        "pull_forward": [
            "mono", "naka", "ue", "shita-v", "mae", "ushiro", "tonari", "chikaku",
            "migi-v", "hidari-v",
            "ji-oclock", "jikan-counter", "tsugi",
            "nin-counter", "takusan", "zenbu",
        ],
        "grammar_cutoff": 52,
        "required_grammar": [],
        "target_words": (62, 85),
        "question_count": 3,
        "topic": (
            "A vending machine that takes the money and gives nothing, then "
            "gives two of the wrong drink to the next person, who is delighted. "
            "The writer stands there thinking about fairness and then buys "
            "another one anyway."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "umi-e-ikimashita",
        "position": 8,
        "tone": "neutral",
        "vocab_cutoff": 575,
        "pull_forward": ["tsugi"],
        "grammar_cutoff": 60,
        "required_grammar": [],
        "target_words": (70, 95),
        "question_count": 3,
        "topic": (
            "A family trip to the sea, told in the past: the early train, what "
            "the weather was like, swimming, lunch on the beach, and everyone "
            "sleeping on the train home. Straight narration, no joke."
        ),
        "extra_allowed": [],
    },
    {
        # Position 9, not 7: 冷蔵庫 is the 634th N5 word, so an earlier cutoff
        # cannot express this seed's own premise.
        "slug": "inu-to-reizouko",
        "position": 9,
        "tone": "humorous",
        "vocab_cutoff": 647,
        "pull_forward": ["tsugi"],
        "grammar_cutoff": 67,
        "required_grammar": [],
        "target_words": (78, 105),
        "question_count": 3,
        "topic": (
            "A dog that ignores its name, ignores the door, ignores visitors — "
            "and comes running from anywhere in the house the moment the fridge "
            "opens. The writer tests this several times, reporting the results "
            "like a small experiment."
        ),
        "extra_allowed": ["ハナ"],
    },
    {
        "slug": "onaji-hana",
        "position": 10,
        "tone": "humorous",
        "vocab_cutoff": 718,
        "pull_forward": [],
        "grammar_cutoff": 74,
        "required_grammar": [],
        "target_words": (85, 115),
        "question_count": 3,
        "topic": (
            "Six students, none of whom talked to each other about it, all give "
            "the teacher white flowers on the same day — every bunch from the "
            "same shop near the station. There is nothing in the classroom to "
            "put water in, and the teacher is very gracious about it."
        ),
        "extra_allowed": [],
    },
]

SEEDS = {"n5": N5_SEEDS}


def seeds_for(level):
    if level not in SEEDS:
        raise KeyError(
            f"no Phase 4 seeds for level {level!r} — authored levels: "
            f"{', '.join(sorted(SEEDS))}"
        )
    return SEEDS[level]


def seed(level, slug):
    for s in seeds_for(level):
        if s["slug"] == slug:
            return s
    raise KeyError(f"unknown reading seed {slug!r} in level {level}")


def all_slugs(level):
    """Seed slugs in position order."""
    return [s["slug"] for s in sorted(seeds_for(level), key=lambda s: s["position"])]


def seed_errors(level):
    """Structural problems with a level's seed list (positions, tones, bands,
    the authored ladder, and level-wide grammar coverage).

    Run by the gate and by `generate_readings context`, because a malformed
    seed list silently produces malformed prompts."""
    errors = []
    seeds = seeds_for(level)
    slugs = [s["slug"] for s in seeds]
    if len(set(slugs)) != len(slugs):
        errors.append(f"duplicate seed slugs in {level}")
    positions = sorted(s["position"] for s in seeds)
    if positions != list(range(1, len(seeds) + 1)):
        errors.append(
            f"{level} seed positions must be 1..{len(seeds)} with no gaps, got {positions}"
        )
    for s in seeds:
        if s["tone"] not in TONES:
            errors.append(f"{s['slug']}: unknown tone {s['tone']!r}")
        lo, hi = s["target_words"]
        if lo >= hi:
            errors.append(f"{s['slug']}: target_words {s['target_words']} is not a band")
        if s["question_count"] < 2:
            errors.append(f"{s['slug']}: question_count must be at least 2")
    errors += ladder_errors(level)
    errors += grammar_coverage_errors(level)
    errors += tone_mix_errors(level)
    return errors


def ladder_errors(level):
    """The authored window of each seed: cutoffs in range and rising with
    position, `pull_forward` naming later words only, `required_grammar` naming
    points the seed's own cutoff has reached."""
    errors = []
    vocab = [v["slug"] for v in context.load_vocab(level)]
    grammar = [g["slug"] for g in context.load_grammar(level)]
    vocab_at = {slug: i for i, slug in enumerate(vocab)}
    grammar_at = {slug: i for i, slug in enumerate(grammar)}
    already_allowed = set(context.CORE_SEED_SLUGS.get(level, []))

    seeds = sorted(seeds_for(level), key=lambda s: s["position"])
    previous = None
    for s in seeds:
        missing = [f for f in LADDER_FIELDS if f not in s]
        if missing:
            errors.append(f"{s['slug']}: missing ladder field(s) {', '.join(missing)}")
            continue
        for field, total in (("vocab_cutoff", len(vocab)),
                             ("grammar_cutoff", len(grammar))):
            if not isinstance(s[field], int) or not 1 <= s[field] <= total:
                errors.append(
                    f"{s['slug']}: {field} is {s[field]!r}; expected 1..{total}"
                )
        if previous is not None:
            for field in ("vocab_cutoff", "grammar_cutoff"):
                if s.get(field, 0) < previous.get(field, 0):
                    errors.append(
                        f"{s['slug']}: {field} {s[field]} is below "
                        f"{previous['slug']}'s {previous[field]} — the ladder only "
                        f"goes up, or an earlier passage may use what a later one "
                        f"may not"
                    )
        previous = s

        for slug in s["pull_forward"]:
            if slug not in vocab_at:
                errors.append(f"{s['slug']}: pull_forward {slug!r} is not a {level} word")
            elif vocab_at[slug] < s["vocab_cutoff"]:
                errors.append(
                    f"{s['slug']}: pull_forward {slug!r} is word "
                    f"{vocab_at[slug] + 1}, already inside vocab_cutoff "
                    f"{s['vocab_cutoff']}"
                )
            elif slug in already_allowed:
                errors.append(
                    f"{s['slug']}: pull_forward {slug!r} is already a CORE_SEED_SLUG"
                )
        for slug in s["required_grammar"]:
            if slug not in grammar_at:
                errors.append(
                    f"{s['slug']}: required_grammar {slug!r} is not a {level} "
                    f"grammar point"
                )
            elif grammar_at[slug] >= s["grammar_cutoff"]:
                errors.append(
                    f"{s['slug']}: required_grammar {slug!r} is point "
                    f"{grammar_at[slug] + 1}, past grammar_cutoff "
                    f"{s['grammar_cutoff']} — the passage may not use what it must use"
                )
            elif slug in grammar_detect.MANUAL_SLUGS:
                errors.append(
                    f"{s['slug']}: required_grammar {slug!r} is a MANUAL_SLUG; no "
                    f"mechanical rule can confirm a passage uses it, so it cannot "
                    f"be required"
                )
    return errors


def grammar_coverage_errors(level):
    """The invariant: every grammar point of the level is assigned to exactly
    one seed. Remove an assignment and the build breaks — which is the whole
    point of `required_grammar`."""
    assigned = {}
    for s in seeds_for(level):
        for slug in s.get("required_grammar", []):
            assigned.setdefault(slug, []).append(s["slug"])

    level_slugs = [g["slug"] for g in context.load_grammar(level)]
    unassigned = [slug for slug in level_slugs if slug not in assigned]
    errors = []
    if unassigned:
        shown = ", ".join(unassigned[:12])
        rest = len(unassigned) - 12
        errors.append(
            f"{level} grammar coverage is "
            f"{len(level_slugs) - len(unassigned)}/{len(level_slugs)}; unassigned to "
            f"any seed's required_grammar: {shown}"
            + (f", … (+{rest} more)" if rest > 0 else "")
        )
    for slug, owners in sorted(assigned.items()):
        if len(owners) > 1:
            errors.append(
                f"{level} grammar {slug} is required by {len(owners)} seeds "
                f"({', '.join(owners)}); each point belongs to exactly one passage"
            )
    return errors


def tone_mix_errors(level):
    """Rev 1's planned humour mix, checked over the whole level."""
    seeds = seeds_for(level)
    humorous = sum(1 for s in seeds if s["tone"] == "humorous")
    share = humorous / len(seeds)
    lo, hi = TONE_MIX_BOUNDS
    if lo <= share <= hi:
        return []
    return [
        f"{level} humour mix is {humorous}/{len(seeds)} ({share:.0%}); "
        f"Phase 4 Rev 1 wants {lo:.0%}–{hi:.0%} humorous seeds"
    ]
