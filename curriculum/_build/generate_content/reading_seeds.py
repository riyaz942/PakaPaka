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

`position` is the seed's rank within the level (1..N) and is the only input to
the allowed-vocabulary/grammar derivation in `reading_context.py` — the same
proportional-cutoff rule 2a/2c use (option (a); see `context.py`). It is not a
sort_order and it is not the shipped passage order; renumbering the seeds
changes what the generator may use, so positions are stable once generated.

## `extra_allowed`

Per-seed level-check escape hatch, for the one thing the exception policy in
`level_check.py` cannot cover on its own: **character and place names**. unidic
tags invented names inconsistently (ポチ comes back as a common noun, not
固有名詞), so a passage with a named cat fails the gate unless the seed says
the name exists. Anything else in this list is a vocabulary gap being papered
over — add the word to the level instead.
"""

#: Tone tags. `humorous` seeds pull the persona's comedy register.
TONES = ("humorous", "neutral")

#: Rev 1 target: humorous seeds as a fraction of a level's seeds.
TONE_MIX_BOUNDS = (0.50, 0.60)

#: N5 — 10 passages, growing from ~35 to ~100 words (the shipped
#: hand-authored set measures 29–46), 6 humorous (60%).
#: `target_words` is a band on the tokenizer word count (see
#: `validate_readings.word_count`), not on characters.
N5_SEEDS = [
    {
        "slug": "atarashii-kurasu",
        "position": 1,
        "tone": "neutral",
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
    """Structural problems with a level's seed list (positions, tones, bands).

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
    errors += tone_mix_errors(level)
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
