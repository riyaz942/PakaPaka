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
  * `pull_forward_grammar` — the grammar side of `pull_forward`, and optional
    because only N5 needs it. N5's four adjective points sit at 47–50 of 70
    and `grammar_detect` fires them on *any* adjective, so a prefix window
    forbids 大きい, 好き and いい outright for two thirds of the level. Every
    N5 seed below the cutoff pulls that block forward. N4 inherits all 70 N5
    points, so the problem cannot arise there.

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
#: `pull_forward_grammar` is deliberately not here: only N5 needs it.
LADDER_FIELDS = ("vocab_cutoff", "pull_forward", "grammar_cutoff", "required_grammar")

#: N5 grammar points 47–50 — い/な-adjective conjugation and their adverbial
#: forms. `grammar_detect` fires these on *any* adjective, so every N5 seed
#: whose `grammar_cutoff` has not reached them pulls the block forward;
#: otherwise two thirds of the level may not write 大きい, 好き or いい.
#: Point 33 (`nai-form`) is **not** in here on purpose: 大きくない is a plain
#: negative and waits its turn like 読まない.
_ADJECTIVE_POINTS = [
    "adj-i-conjugation", "adj-na-conjugation", "adj-i-adverb", "adj-na-adverb",
]

#: N5 — 30 passages, 30 → 126 words, 24 humorous (80%), replacing the 10
#: generated ones (docs/content/reading-passage-expansion-plan.md, step 3).
#: `target_words` is a band on the tokenizer word count (see
#: `validate_readings.word_count`), not on characters.
#:
#: N5 has no level beneath it, so the window really is all the learner has:
#: `vocab_cutoff` follows the level's thematic bands — pronouns and numerals
#: (1–71), time (72–118), family (119–144), people (145–162), the body
#: (163–176), food (177–203), buildings and streets (204–233), objects and
#: stationery (234–262), clothes (263–270), weather and nature (271–284),
#: animals, seasons and colours (285–301), い-adjectives (302–356),
#: な-adjectives (357–376), verbs (377–479), school and abstract nouns
#: (480–536), illness, transport and counters (537–570), more verbs (571–605),
#: the home and money (606–640), tableware and school subjects (641–668), and
#: adverbs, conjunctions and greetings (669–718). Each seed's topic sits inside
#: the band its cutoff opens; `pull_forward` names only the props that band
#: cannot supply, because `context.CORE_SEED_SLUGS` already hands every seed 24
#: survival verbs, 10 adjectives and the connectives (the first N5 verb is word
#: 377 of 718).
#:
#: **The ladder steps at position 6** (docs/content/
#: reading-passage-minna-no-nihongo-alignment.md). Positions 1–5 are the
#: pre-linker set: their window stops short of から (point 21) and ので (22), so
#: they cannot join two clauses at all, and they are short on purpose — Minna
#: no Nihongo's own L4 and L7 readings join none either. From position 6 the
#: cutoff runs one seed ahead of the topic's own band (position 6 carries what
#: position 7 used to, and so on to position 29), which is the extra nouns a
#: passage needs to chain one sentence onto the last; and `target_words` jumps
#: to 63–78 — 63 words is Minna no Nihongo's *shortest* 読み物 — then climbs to
#: 98–126 at position 30. Below the step the bands are unchanged.
#:
#: `required_grammar` partitions the 70 points across the 30 seeds, 1–4 each
#: (`conjugation-primer` has no owner yet).
#: It is **not** the block each cutoff newly opens, the way N4's is: a point is
#: assigned to the passage whose topic uses it, which only has to sit at or
#: after the seed that opens it. ましょう and ませんか (7, 8) go to the
#: invitation passage rather than to passage 2, where the ladder reaches them.
#:
#: Every seed below `grammar_cutoff` 47 carries `_ADJECTIVE_POINTS` — see that
#: constant. Nothing else is pulled forward.
#:
#: Positions 7 and 9 keep the slugs `neko-to-shukudai` and `eki-made-no-michi`
#: from the retired set, because the gate's 11 fixtures are written against
#: those two seeds. Their `grammar_cutoff`, `question_count` and
#: `required_grammar` are therefore held to what those fixture bodies contain:
#: 23 ≤ cutoff < 29 for the first (its bad fixture is ている at point 29), ≥ 28
#: for the second. `target_words` is not: the step at 6 moved both bands and
#: the three length-sensitive fixture bodies were rewritten to match.
N5_SEEDS = [
    {
        "slug": "hajimete-no-jikoshoukai",
        "position": 1,
        "tone": "neutral",
        "vocab_cutoff": 71,
        "pull_forward": ["hajimemashite"],
        "grammar_cutoff": 10,
        "pull_forward_grammar": _ADJECTIVE_POINTS,
        "required_grammar": ["wa-topic", "desu", "dewa-arimasen"],
        "target_words": (30, 40),
        "question_count": 2,
        "topic": (
            "A new student introduces themself on the first day: who they are, "
            "that they are a student and not a teacher, who is with them, and "
            "what today is like. This is the first passage anyone reads in the "
            "level — short sentences, one idea each, and nothing happens."
        ),
        "extra_allowed": ["リサ"],
    },
    {
        "slug": "mainichi-onaji",
        "position": 2,
        "tone": "humorous",
        "vocab_cutoff": 100,
        "pull_forward": ["benkyou-suru"],
        "grammar_cutoff": 13,
        "pull_forward_grammar": _ADJECTIVE_POINTS,
        "required_grammar": ["masu", "ga"],
        "target_words": (32, 43),
        "question_count": 2,
        "topic": (
            "A day reported hour by hour: what happens in the morning, at noon, "
            "in the evening, at night. Then the writer says yesterday was the "
            "same, and every week is the same. Told as flat fact — the joke is "
            "that nothing ever differs, and the writer does not notice."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "nanimo-nai-nichiyoubi",
        "position": 3,
        "tone": "humorous",
        "vocab_cutoff": 118,
        # The topic needs a writing surface, and the cutoff reaches none:
        # ノート is sort_order 265 and 紙 is 238. Without this the passage has
        # to say 私の本の月曜日 ("my book's Monday"), which is not Japanese.
        "pull_forward": ["nooto"],
        "grammar_cutoff": 16,
        "pull_forward_grammar": _ADJECTIVE_POINTS,
        "required_grammar": ["no-possessive", "ni-direction"],
        "target_words": (34, 45),
        "question_count": 2,
        "topic": (
            "One week on the writer's calendar, day by day: what is written on "
            "Monday, on Wednesday, on Saturday. On Sunday nothing at all is "
            "written, which the writer decides — at some length — is the best "
            "day of the week."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "dare-no-heya",
        "position": 4,
        "tone": "humorous",
        "vocab_cutoff": 144,
        "pull_forward": ["ookii", "chiisai"],
        "grammar_cutoff": 18,
        "pull_forward_grammar": _ADJECTIVE_POINTS,
        "required_grammar": ["he-direction", "de-location"],
        "target_words": (36, 48),
        "question_count": 2,
        "topic": (
            "Who sleeps where in a small house: the parents' room, the older "
            "brother's room, the younger sister's room, and the writer's, which "
            "is the smallest. The cat sleeps in the big room, and nobody in the "
            "family can explain how that was decided."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "sasoi-ga-fueru",
        "position": 5,
        "tone": "humorous",
        "vocab_cutoff": 162,
        "pull_forward": [],
        "grammar_cutoff": 20,
        "pull_forward_grammar": _ADJECTIVE_POINTS,
        "required_grammar": ["mashou", "masen-ka"],
        "target_words": (38, 50),
        "question_count": 2,
        "topic": (
            "An invitation that grows. The writer asks one friend to the park "
            "on Saturday. That friend asks another. By Saturday there are nine "
            "people, two of whom the writer has never met, and a baby. The "
            "writer asks everyone what they would like to do, and gets nine "
            "answers."
        ),
        "extra_allowed": ["ユキ"],
    },
    {
        "slug": "zenbu-sukoshi-itai",
        "position": 6,
        "tone": "humorous",
        "vocab_cutoff": 190,
        "pull_forward": ["itai"],
        "grammar_cutoff": 24,
        "pull_forward_grammar": _ADJECTIVE_POINTS,
        "required_grammar": ["to-and", "ya-among", "mo-also"],
        "target_words": (63, 78),
        "question_count": 2,
        "topic": (
            "At the doctor's, everything hurts a little and nothing hurts a "
            "lot. The writer lists it: the head and the stomach, an ear, one "
            "tooth as well. The doctor asks where it hurts. The writer starts "
            "the list again from the beginning."
        ),
        "extra_allowed": [],
    },
    {
        # Slug and shape held for the gate's fixtures — see the block comment.
        "slug": "neko-to-shukudai",
        "position": 7,
        "tone": "humorous",
        "vocab_cutoff": 203,
        "pull_forward": ["shukudai", "namae", "ue", "yobu", "dasu"],
        "grammar_cutoff": 26,
        "pull_forward_grammar": _ADJECTIVE_POINTS,
        "required_grammar": ["masen", "mashita", "wo"],
        "target_words": (64, 80),
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
        "slug": "shio-to-satou",
        "position": 8,
        "tone": "humorous",
        "vocab_cutoff": 233,
        "pull_forward": ["onaji", "amai", "karai"],
        "grammar_cutoff": 29,
        "pull_forward_grammar": _ADJECTIVE_POINTS,
        "required_grammar": ["kara-because", "node-because"],
        "target_words": (66, 82),
        "question_count": 3,
        "topic": (
            "The writer makes tea and a boxed lunch for a friend. Because the "
            "salt jar and the sugar jar are the same jar, the tea is salty and "
            "the lunch is sweet. The friend eats all of it and says it is "
            "delicious, because the friend is kind. Every sentence states its "
            "reason."
        ),
        "extra_allowed": [],
    },
    {
        # Slug and shape held for the gate's fixtures — see the block comment.
        "slug": "eki-made-no-michi",
        "position": 9,
        "tone": "neutral",
        "vocab_cutoff": 248,
        "pull_forward": ["mae", "tonari", "hidari-v", "aruku", "magaru"],
        "grammar_cutoff": 32,
        "pull_forward_grammar": _ADJECTIVE_POINTS,
        "required_grammar": ["kara-from", "te-kudasai"],
        "target_words": (67, 84),
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
        "slug": "kaban-no-naka",
        "position": 10,
        "tone": "humorous",
        "vocab_cutoff": 262,
        "pull_forward": ["dasu"],
        "grammar_cutoff": 34,
        "pull_forward_grammar": _ADJECTIVE_POINTS,
        "required_grammar": ["made-until", "ni-indirect"],
        "target_words": (69, 86),
        "question_count": 3,
        "topic": (
            "The writer empties their bag onto the desk and goes through it: "
            "four pens that do not write, a dictionary nobody is using, an "
            "umbrella, and a pair of glasses that belong to someone else. They "
            "have been in there since last year. The writer telephones the "
            "someone else, who does not want them back."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "kagi-wa-doko",
        "position": 11,
        "tone": "humorous",
        "vocab_cutoff": 270,
        # The topic searches a drawer and ends outside: 外 is 521 and
        # 引き出し is 635, both past cutoff 270.
        "pull_forward": ["ue", "soto", "hikidashi"],
        "grammar_cutoff": 36,
        "pull_forward_grammar": _ADJECTIVE_POINTS,
        "required_grammar": ["ka-question", "ne-tag", "yo-emphasis"],
        "target_words": (70, 88),
        "question_count": 3,
        "topic": (
            "Two people looking for the key, entirely in short spoken lines: it "
            "is on the table, isn't it — no, you took it, you know — then where "
            "is it. They check the desk, the bed, the drawer of the chair. The "
            "key is in the door, outside, where it has been all evening."
        ),
        "extra_allowed": ["ケン"],
    },
    {
        "slug": "hako-no-naka-no-fuyu",
        "position": 12,
        "tone": "humorous",
        "vocab_cutoff": 284,
        # "the winter in the box" is the topic; 冬 is 292, cutoff is 284.
        "pull_forward": ["motsu", "fuyu"],
        "grammar_cutoff": 38,
        "pull_forward_grammar": _ADJECTIVE_POINTS,
        "required_grammar": ["te-form", "te-iru"],
        "target_words": (72, 90),
        "question_count": 3,
        "topic": (
            # No count on the clothes: coats take 着 and shoes take 足, and
            # neither counter exists in n5 or n4, so a numbered inventory here
            # can only come out as コートが二つ. The joke is the lone shoe, not
            # the arithmetic.
            "A box has stood in the hall since the writer moved in. Today they "
            "open it, look inside, and find winter coats, a hat, and — with no "
            "explanation anybody can offer — a shoe. The writer closes the box, "
            "carries it back to the hall, and puts it where it was."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "yama-no-yakusoku",
        "position": 13,
        "tone": "humorous",
        "vocab_cutoff": 301,
        "pull_forward": ["toru", "arau"],
        "grammar_cutoff": 41,
        "pull_forward_grammar": _ADJECTIVE_POINTS,
        "required_grammar": ["te-mo-ii", "te-wa-ikenai", "te-kara"],
        "target_words": (73, 92),
        "question_count": 3,
        "topic": (
            # Not "you may take photographs": 写真を撮る needs 撮る, which is in
            # neither level, and the 取る this seed pulls forward is for 花を取る.
            "The teacher reads out the rules before the school trip up the "
            "mountain: you may drink your water at the top, you must not pick "
            "the flowers, wash your hands after you come back down. It rains "
            "from the first minute to the last, and the only rule anybody "
            "follows is the one about washing hands."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "konai-inu",
        "position": 14,
        "tone": "humorous",
        "vocab_cutoff": 320,
        "pull_forward": ["hashiru", "tomaru"],
        "grammar_cutoff": 43,
        "pull_forward_grammar": _ADJECTIVE_POINTS,
        "required_grammar": ["nai-form", "naide-kudasai"],
        "target_words": (75, 94),
        "question_count": 3,
        "topic": (
            "A dog that does not come, does not sit and does not stop. The "
            "writer says please do not run, out loud, to a dog, in a park, in "
            "autumn. The dog is brown, the leaves are brown, and for a while "
            "the writer cannot find the dog at all."
        ),
        "extra_allowed": ["ハナ"],
    },
    {
        "slug": "motte-ikanakereba",
        "position": 15,
        "tone": "humorous",
        "vocab_cutoff": 340,
        # The topic is one trip to the sea: 旅行する is 474, cutoff 340.
        "pull_forward": ["motsu", "ryokou-suru"],
        "grammar_cutoff": 45,
        "pull_forward_grammar": _ADJECTIVE_POINTS,
        "required_grammar": ["nakereba-naranai", "nakutemo-ii"],
        "target_words": (76, 96),
        "question_count": 3,
        "topic": (
            "Two lists for one trip to the sea: what the writer must take, and "
            "what they do not have to take. The second list is much longer than "
            "the first, is read out twice, and ends with the writer taking "
            "everything on both of them."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "ichido-dake-shita-koto",
        "position": 16,
        "tone": "humorous",
        "vocab_cutoff": 356,
        # The topic names a famous shop: 有名 is 365, cutoff is 356.
        "pull_forward": ["oyogu", "yuumei"],
        "grammar_cutoff": 46,
        "pull_forward_grammar": _ADJECTIVE_POINTS,
        "required_grammar": ["ta-form", "ta-koto-ga-aru", "tari-tari"],
        "target_words": (78, 98),
        "question_count": 3,
        "topic": (
            "Three things the writer has done exactly once: swum in the sea in "
            "winter, eaten something bad-tasting at a famous shop, got up at "
            "four in the morning. Each was interesting and none will happen "
            "again. What the writer does now is read a little and sleep a "
            "little, which is also what they did yesterday."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "kotoshi-hoshii-mono",
        "position": 17,
        "tone": "humorous",
        "vocab_cutoff": 376,
        "pull_forward": [],
        "grammar_cutoff": 50,
        "required_grammar": ["tai", "hoshii"],
        "target_words": (79, 100),
        "question_count": 3,
        "topic": (
            "What the writer wants this year, in order: a new bag, a wide quiet "
            "room, and for one particular person to stop asking what they want. "
            "The writer compares the list with last year's and notices it gets "
            "one line shorter every year."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "watashi-no-machi",
        "position": 18,
        "tone": "neutral",
        "vocab_cutoff": 400,
        "pull_forward": ["souji-suru"],
        "grammar_cutoff": 52,
        "pull_forward_grammar": [],
        "required_grammar": [
            "adj-i-conjugation", "adj-na-conjugation",
            "adj-i-adverb", "adj-na-adverb",
        ],
        "target_words": (80, 102),
        "question_count": 3,
        "topic": (
            "The writer describes their town honestly: the station is "
            "convenient, the park is quiet and pretty, the one famous shop is "
            "not famous anywhere outside the town. On Sunday they get up early, "
            "clean the room neatly, and walk there slowly. Warm and plain, no "
            "joke — this passage is where the level's adjectives are put to "
            "work, so use them in every form they have."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "junban-ga-okashii",
        "position": 19,
        "tone": "humorous",
        "vocab_cutoff": 420,
        # The topic turns on what happens before every exam: 試験 is 483,
        # cutoff 420.
        "pull_forward": ["jugyou", "shukudai", "shiken"],
        "grammar_cutoff": 54,
        "pull_forward_grammar": [],
        "required_grammar": ["ni-iku", "mae-ni", "ato-de"],
        "target_words": (82, 104),
        "question_count": 3,
        "topic": (
            "The order the writer does things in, compared with the order they "
            "ought to be done in: coffee before getting up properly, homework "
            "after the class it was for, and, before every exam, going out to "
            "buy bread. The writer explains that this order works, and offers "
            "no evidence."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "dekiru-hito",
        "position": 20,
        "tone": "humorous",
        "vocab_cutoff": 440,
        # The topic says the older brother can sing: 歌う is 444, cutoff 440.
        "pull_forward": ["utau"],
        "grammar_cutoff": 55,
        "pull_forward_grammar": [],
        "required_grammar": ["toki", "dictionary-koto-ga-dekiru"],
        "target_words": (83, 106),
        "question_count": 3,
        "topic": (
            "What each person in the family can do, and when they can do it. "
            "The mother can make anything when there is nothing in the house. "
            "The older brother can sing when nobody asks him to. The writer can "
            "sleep at any hour at all, and holds that this is the hardest of "
            "the three."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "kariru-hito-kasu-hito",
        "position": 21,
        "tone": "humorous",
        "vocab_cutoff": 460,
        "pull_forward": ["kaesu"],
        "grammar_cutoff": 57,
        "pull_forward_grammar": [],
        "required_grammar": ["comparative-yori", "superlative-ichiban"],
        "target_words": (85, 108),
        "question_count": 4,
        "topic": (
            "Three friends and one umbrella, borrowed and lent and borrowed "
            "again. The writer ranks them: who forgets more than whom, and "
            "which of the three is the worst. The writer comes third in their "
            "own ranking, and is holding the umbrella while they explain it."
        ),
        "extra_allowed": ["リク"],
    },
    {
        "slug": "kasa-o-nakushita",
        "position": 22,
        "tone": "humorous",
        "vocab_cutoff": 479,
        "pull_forward": ["densha"],
        "grammar_cutoff": 59,
        "pull_forward_grammar": [],
        "required_grammar": ["dou-desu-ka", "darou"],
        "target_words": (86, 110),
        "question_count": 4,
        "topic": (
            "A lost umbrella and a search made entirely of guesses. How about "
            "the station, then? Somebody probably took it. It might still be on "
            "the train. The writer never looks anywhere, finds it at home, and "
            "guesses once more about how it got there."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "nagai-kotoba",
        "position": 23,
        "tone": "humorous",
        "vocab_cutoff": 505,
        "pull_forward": [],
        "grammar_cutoff": 61,
        "pull_forward_grammar": [],
        "required_grammar": ["to-omou", "to-iu", "no-nominalizer"],
        "target_words": (88, 112),
        "question_count": 4,
        "topic": (
            "A very long word the writer met this week and cannot say. Three "
            "friends each think it means something different, and each explains "
            "why. Remembering it is hard; saying it is harder; looking it up in "
            "the dictionary on the desk is the one thing nobody does."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "shiken-no-mae-no-yoru",
        "position": 24,
        "tone": "neutral",
        "vocab_cutoff": 536,
        "pull_forward": [],
        "grammar_cutoff": 63,
        "pull_forward_grammar": [],
        "required_grammar": ["hou-ga-ii", "deshou"],
        "target_words": (89, 114),
        "question_count": 4,
        "topic": (
            "The night before an exam: how long the writer studied, why that "
            "was too long, what a friend said about sleeping instead, and what "
            "the writer expects tomorrow to be like. Told straight, in the "
            "order it happened, with no joke at the end."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "hikkoshi-ikkagetsu",
        "position": 25,
        "tone": "humorous",
        "vocab_cutoff": 570,
        "pull_forward": [],
        "grammar_cutoff": 65,
        "pull_forward_grammar": [],
        "required_grammar": ["mada-teinai", "mou-past"],
        "target_words": (91, 116),
        "question_count": 4,
        "topic": (
            # Not "on the wall": 壁 is in neither level, so the picture has to
            # come to rest somewhere 置く can reach.
            "One month after moving in. The picture is already out of its box "
            "and standing on the desk, and the music is already loud; half the "
            "boxes have not been opened and the bed has not been built. The "
            "writer explains which half of the work is the important half, "
            "standing in the middle of the other half."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "kusuri-ga-futatsu-dake",
        "position": 26,
        "tone": "humorous",
        "vocab_cutoff": 605,
        "pull_forward": [],
        "grammar_cutoff": 67,
        "pull_forward_grammar": [],
        "required_grammar": ["dake", "shika-nai"],
        "target_words": (92, 118),
        "question_count": 4,
        "topic": (
            "Three days of a cold, counted out: only two tablets left in the "
            "box, only one train an hour, and the single tissue the writer is "
            "rationing. Everything in the passage is a number, and every number "
            "is smaller than the writer would like."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "kuji-goro-no-byouin",
        "position": 27,
        "tone": "neutral",
        "vocab_cutoff": 640,
        "pull_forward": [],
        "grammar_cutoff": 68,
        "pull_forward_grammar": [],
        "required_grammar": ["gurai", "goro"],
        "target_words": (94, 120),
        "question_count": 4,
        "topic": (
            "A morning at the hospital, told in approximate numbers: the writer "
            "arrives around nine, waits about thirty minutes, is seen, has the "
            "medicine explained to them twice a day for about a week, and is "
            "home by around noon. Careful and plain, the way you would tell a "
            "parent about it afterwards."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "shashin-to-chigau-ryokan",
        "position": 28,
        "tone": "humorous",
        "vocab_cutoff": 668,
        "pull_forward": [],
        "grammar_cutoff": 69,
        "pull_forward_grammar": [],
        "required_grammar": ["zenzen-nai", "amari-nai"],
        "target_words": (95, 122),
        "question_count": 4,
        "topic": (
            "An inn room that is not at all what the photograph showed, at a "
            "price that is not very low. The window does not open at all and "
            "the tea is not very hot. The writer is not worried in the "
            "slightest and says so four times; the rest of the family is "
            "worried enough for everybody."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "fooku-ga-yonjuu",
        "position": 29,
        "tone": "humorous",
        "vocab_cutoff": 718,
        "pull_forward": [],
        "grammar_cutoff": 70,
        "pull_forward_grammar": [],
        "required_grammar": ["demo-suggestion", "janai-desu-ka"],
        "target_words": (97, 124),
        "question_count": 4,
        "topic": (
            "Two students open the classroom cupboard and count what is in it: "
            "forty forks, no knives, a map of somewhere nobody recognises, and "
            "chalk. They count it while talking about something else entirely, "
            "stop halfway for tea or something, and agree that forty is an odd "
            "number of forks for a classroom, isn't it."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "saigo-no-hi",
        "position": 30,
        "tone": "neutral",
        "vocab_cutoff": 718,
        "pull_forward": [],
        "grammar_cutoff": 70,
        "pull_forward_grammar": [],
        "required_grammar": ["naru-become"],
        "target_words": (98, 126),
        "question_count": 4,
        "topic": (
            "The last day of the school year: who gave what to whom, what the "
            "writer received and what they gave back, and what one quiet "
            "classmate did for everybody else all year without being asked. By "
            "the end that classmate has become the person everyone says goodbye "
            "to last. Warm and plain; the last passage of the level."
        ),
        "extra_allowed": ["ハル"],
    },
]

#: N4 — 30 passages, 100 → 200 words, 24 humorous (80%), replacing the 9
#: hand-authored ones (docs/content/reading-passage-expansion-plan.md, step 4).
#:
#: The ladder is read against a level that already hands the writer all 718 N5
#: words, so `vocab_cutoff` is about *theme*, not about having anything to say:
#: N4 vocabulary runs society nouns (1–48), adjectives (49–87), verbs
#: (88–228), animals (229–242), nature (243–258), food (259–284), clothes and
#: shopping (285–303), health (304–321), hobbies (322–342), technology
#: (343–356), school and work (357–393), adverbs (394–428), set phrases
#: (429–455) and abstract nouns (456–529). Each seed's topic sits inside the
#: band its cutoff opens, which is why `pull_forward` is nearly empty here —
#: it names only the one prop a topic needs from later in the level (the
#: festival of `matsuri-wa-yarimasu`, the machine of `setsumeisho-doori`).
#:
#: `required_grammar` is the block of points each seed's `grammar_cutoff`
#: newly opens, so the 30 blocks partition the level: 55 of the 56 points,
#: each assigned once. The 56th is `node-vs-kara`, a `MANUAL_SLUG` that no
#: rule can separate from `kara-because` — `grammar_coverage_errors` excludes
#: it rather than demand what `ladder_errors` forbids.
#:
#: 34 points moved on to N3 (`levels.json`, the same audit doc), and かなり
#: and そういう・こういう became words (`kanari`, `souiu`, `kouiu`). Each
#: cutoff is now the number of kept points under its old value, so the last
#: four seeds all reach the whole level (56), and those blocks are shorter.
#: Five seeds whose whole block left require no N4 point:
#: waribiki-no-setsumei, nazo-no-bukatsu, kotoshi-koso, densha-ga-tomatta-hi
#: and matsuri-no-oshirase. The last four were written again without the N3
#: points, on new briefs.
#:
#: Five points moved from N5 (`levels.json`, docs/content/
#: grammar-jlpt-level-audit.md) and are taught first, at 1–5, so every cutoff
#: is 5 higher than its block. They break the block rule: each is required by
#: an existing passage that already used it (souji-no-nikki, kotoshi-no-yotei,
#: benkyou-suru-aida-ni, karita-nabe, tabesugita-hi).
#:
#: Ten N4 points were duplicates of N5 points and merged into them, so the
#: blocks that held them are shorter, and `reizouko-no-ruuru`'s block (てはい
#: けない, なくてもいい, なければならない) is now empty: the passage keeps its
#: slot and its brief, and requires no N4 point.
#:
#: Four seeds are briefed to write in plain form, and not only for register:
#: ている, てはいけない, なければならない and させる have polite surfaces
#: (ています, てはいけません, なければなりません, させます) that belong to
#: another point or to no pattern at all, so `grammar_detect` can only see
#: them plain.
N4_SEEDS = [
    {
        "slug": "sekai-to-gomibako",
        "position": 1,
        "tone": "humorous",
        "vocab_cutoff": 18,
        "pull_forward": ["gomi", "gomibako"],
        "grammar_cutoff": 7,
        "required_grammar": ["noni", "souda-hearsay"],
        "target_words": (90, 112),
        "question_count": 3,
        "topic": (
            "A student's opinion essay opens on the whole world — society, "
            "culture, tradition, what the government is said to be doing — and "
            "narrows, sentence by sentence, to the only social problem the "
            "writer has personally met: nobody in the classroom empties the "
            "trash can. Grandly serious about a very small thing, and never "
            "admitting the subject has changed."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "posutaa-no-yakusoku",
        "position": 2,
        "tone": "humorous",
        "vocab_cutoff": 36,
        "pull_forward": ["risaikuru"],
        "grammar_cutoff": 10,
        "required_grammar": ["souda-looks", "tara", "ba"],
        "target_words": (93, 116),
        "question_count": 3,
        "topic": (
            "The class paints a poster about the environment, and every line on "
            "it is a promise about what happens if everyone does the right "
            "thing: sort the rubbish and the town gets clean, do this and the "
            "problem disappears. Outside the window it looks like rain the "
            "whole time they are painting, and the poster is taped up outdoors."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "kurasu-juu-ga-senmonka",
        "position": 3,
        "tone": "humorous",
        "vocab_cutoff": 48,
        "pull_forward": [],
        "grammar_cutoff": 13,
        "required_grammar": ["nara", "potential", "passive"],
        "target_words": (97, 119),
        "question_count": 3,
        "topic": (
            "Everyone in the class is an expert on something. Ask about one "
            "thing and Ken says leave it to him; ask about another and Mika is "
            "praised for work she has never actually done. The quiet student in "
            "the corner is asked last, says one short sentence, and is the only "
            "one who turns out to be right."
        ),
        "extra_allowed": ["ケン", "ミカ"],
    },
    {
        "slug": "souji-no-nikki",
        "position": 4,
        "tone": "humorous",
        "vocab_cutoff": 60,
        # The topic is a diary entry, and the seed is named for it: 日記 is
        # 519, cutoff is 60.
        "pull_forward": ["nikki"],
        "grammar_cutoff": 16,
        "required_grammar": ["moraru-ageru-kureru", "causative", "causative-passive", "youni"],
        "target_words": (100, 123),
        "question_count": 3,
        "topic": (
            "A diary entry about the household chore economy: the writer is "
            "made to tidy the whole room, passes half of it to a younger "
            "brother, and both of them are made to apologise to their mother "
            "for the result. Write the whole entry in plain form — no です or "
            "ます anywhere, the way a diary is actually written."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "suki-ni-natta-mono",
        "position": 5,
        "tone": "humorous",
        "vocab_cutoff": 72,
        "pull_forward": [],
        "grammar_cutoff": 19,
        "required_grammar": ["youninaru", "younaru", "hazu"],
        "target_words": (103, 126),
        "question_count": 3,
        "topic": (
            "One food the writer could not eat as a child and now eats every "
            "week, and one habit that quietly stopped some time last year. The "
            "writer is certain there is a simple explanation for both, "
            "announces that it should be easy to explain, and then cannot "
            "explain either of them."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "uwasa-wa-ookiku-naru",
        "position": 6,
        "tone": "humorous",
        "vocab_cutoff": 87,
        "pull_forward": [],
        "grammar_cutoff": 22,
        "required_grammar": ["hazuganai", "rashii", "youda"],
        "target_words": (107, 130),
        "question_count": 3,
        "topic": (
            "A rumour crosses the classroom and grows at every desk: the strict "
            "teacher is apparently kind at home, there is apparently no test "
            "tomorrow. The writer insists loudly that there is no way any of it "
            "is true, and is the first person to believe the next one."
        ),
        "extra_allowed": ["ユキ"],
    },
    {
        "slug": "ima-nani-shiteru",
        "position": 7,
        "tone": "humorous",
        "vocab_cutoff": 100,
        "pull_forward": [],
        "grammar_cutoff": 24,
        "required_grammar": ["mitai", "teiru-result"],
        "target_words": (110, 133),
        "question_count": 3,
        "topic": (
            "A casual, moment-by-moment report of what is going on in one room "
            "right now: the window is open, rain is coming in, the cat is "
            "sitting on the phone and does not seem to be moving. Write it in "
            "plain form, the way you would tell a friend what is happening as "
            "it happens — no です or ます."
        ),
        "extra_allowed": ["アヤ"],
    },
    {
        "slug": "junbi-wa-kanpeki",
        "position": 8,
        "tone": "humorous",
        "vocab_cutoff": 115,
        "pull_forward": [],
        "grammar_cutoff": 27,
        "required_grammar": ["tearu", "teoku", "teshimau"],
        "target_words": (113, 137),
        "question_count": 3,
        "topic": (
            "Everything for tomorrow's early start is ready the night before: "
            "the bag is packed and standing by the door, the clothes are laid "
            "out, the lunch is made and in the fridge. Report the preparations "
            "like a checklist, then end with what the writer does to that lunch "
            "at eleven at night, in one flat sentence."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "matsuri-wa-yarimasu",
        "position": 9,
        "tone": "humorous",
        "vocab_cutoff": 130,
        "pull_forward": ["matsuri"],
        "grammar_cutoff": 29,
        "required_grammar": ["teiku-tekuru", "temo"],
        "target_words": (116, 140),
        "question_count": 3,
        "topic": (
            "Rain or no rain, the festival goes ahead. Through the afternoon "
            "the crowd thins out and the rain gets heavier, while the man at "
            "the food stall keeps telling the few who remain that they are "
            "welcome to stay as long as they like. By evening there are three "
            "customers and he has never been happier."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "reizouko-no-ruuru",
        "position": 10,
        "tone": "humorous",
        "vocab_cutoff": 145,
        "pull_forward": [],
        "grammar_cutoff": 29,
        "required_grammar": [],
        "target_words": (120, 144),
        "question_count": 3,
        "topic": (
            "A list of house rules taped to the fridge door, and what the "
            "family actually does. Quote each rule exactly as it is written on "
            "the paper — short, plain form, the way a sign is written — and "
            "follow it with the small reasonable exception everyone agreed to "
            "the week it went up."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "kotoshi-no-yotei",
        "position": 11,
        "tone": "humorous",
        "vocab_cutoff": 160,
        "pull_forward": [],
        "grammar_cutoff": 31,
        "required_grammar": ["nagara", "tsumori", "youni-suru"],
        "target_words": (123, 148),
        "question_count": 4,
        "topic": (
            "This year's plan: get up early, walk more, stop leaving things to "
            "the last minute. What actually happens is three near-misses in one "
            "week — nearly missing the train, nearly falling asleep standing "
            "up, nearly forgetting the one thing that mattered — and the plan "
            "is restated at the end, unchanged."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "baito-shonichi",
        "position": 12,
        "tone": "neutral",
        "vocab_cutoff": 179,
        "pull_forward": [],
        "grammar_cutoff": 33,
        "required_grammar": ["koto-ni-suru", "koto-ni-naru"],
        "target_words": (126, 151),
        "question_count": 4,
        "topic": (
            "A first day of part-time work and the polite language that comes "
            "with it: what the writer decided to do, what was decided for them "
            "by the manager, and the small mistakes that sometimes happen when "
            "honorific verbs are still new. Straight narration in the order it "
            "happened, no joke."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "ojiisan-no-onaji-hanashi",
        "position": 13,
        "tone": "humorous",
        "vocab_cutoff": 194,
        "pull_forward": [],
        "grammar_cutoff": 35,
        "required_grammar": ["bakari", "tokoro"],
        "target_words": (130, 155),
        "question_count": 4,
        "topic": (
            "Grandfather's stories at dinner: how far he used to walk to "
            "school, how he has only just sat down, how he was just about to "
            "reach the good part when the food arrives. The same story comes "
            "round three times in one evening and is longer each time."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "benkyou-suru-aida-ni",
        "position": 14,
        "tone": "humorous",
        "vocab_cutoff": 203,
        "pull_forward": [],
        "grammar_cutoff": 36,
        "required_grammar": ["tame-ni", "aida"],
        "target_words": (133, 158),
        "question_count": 4,
        "topic": (
            "Every time the writer sits down to study, something needs doing. "
            "While the water boils, one job; while the room is still quiet, "
            "another; and every single time the book opens, the phone rings. By "
            "the end of the evening nothing has been studied and the kitchen "
            "has never been cleaner."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "setsumeisho-doori",
        "position": 15,
        "tone": "humorous",
        "vocab_cutoff": 215,
        "pull_forward": ["kikai-machine"],
        "grammar_cutoff": 39,
        "required_grammar": ["baai", "to-conditional"],
        "target_words": (136, 162),
        "question_count": 4,
        "topic": (
            "A second-hand machine arrives with an instruction sheet, and the "
            "writer tests it line by line: press this and it turns; in the case "
            "that it does not turn, do the thing on the next line; use the blue "
            "button in place of the red one. The red one is the only button the "
            "machine has."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "shirabeta-koto",
        "position": 16,
        "tone": "neutral",
        "vocab_cutoff": 228,
        "pull_forward": ["gyouji", "shuukan-custom"],
        "grammar_cutoff": 40,
        "required_grammar": ["nitsuite"],
        "target_words": (140, 165),
        "question_count": 4,
        "topic": (
            "A short class report about a custom the writer looked into: what "
            "it is, what it is more accurately called rather than the name "
            "everyone uses for it, and what it means to the people who still "
            "keep it. Careful and plain, written the way a student writes up "
            "something they researched."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "saru-ga-nigeta",
        "position": 17,
        "tone": "humorous",
        "vocab_cutoff": 242,
        "pull_forward": [],
        "grammar_cutoff": 42,
        "required_grammar": ["niyoruto", "tame"],
        "target_words": (143, 169),
        "question_count": 4,
        "topic": (
            "According to the newspaper, a monkey got out because of a door "
            "somebody left open. As far as the writer can see from the "
            "classroom window, the monkey is sitting on the roof of the "
            "building opposite, in no hurry whatsoever, watching the adults "
            "below run in circles."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "jishin-no-kunren",
        "position": 18,
        "tone": "neutral",
        "vocab_cutoff": 258,
        "pull_forward": [],
        "grammar_cutoff": 43,
        "required_grammar": ["noda"],
        "target_words": (146, 172),
        "question_count": 4,
        "topic": (
            "An earthquake drill at school: where everyone goes, what they "
            "carry, and what to do even if it happens at night when nobody is "
            "there to tell them. The writer keeps forgetting which floor the "
            "meeting point is on, asks twice, and explains at the end why the "
            "drill is done at all."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "karita-nabe",
        "position": 19,
        "tone": "humorous",
        "vocab_cutoff": 275,
        "pull_forward": [],
        "grammar_cutoff": 44,
        "required_grammar": ["kamoshirenai", "nikui-yasui"],
        "target_words": (150, 176),
        "question_count": 4,
        "topic": (
            "A pot borrowed from a neighbour: heavy, hard to lift, easy to burn "
            "things in, and probably older than the kitchen it came from. The "
            "writer makes miso soup in it anyway and defends the result to "
            "everyone at the table, one weak argument at a time."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "tabesugita-hi",
        "position": 20,
        "tone": "humorous",
        "vocab_cutoff": 290,
        "pull_forward": [],
        "grammar_cutoff": 44,
        "required_grammar": ["sugiru"],
        "target_words": (153, 179),
        "question_count": 4,
        "topic": (
            "A birthday dinner that goes exactly the way everyone predicted: "
            "too much cake, a belt getting tighter by the hour, and — after a "
            "long, polite argument about who is paying — the bill split evenly, "
            "which is what happens every year."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "waribiki-no-setsumei",
        "position": 21,
        "tone": "humorous",
        "vocab_cutoff": 303,
        "pull_forward": ["kanari"],
        "grammar_cutoff": 44,
        "required_grammar": [],
        "target_words": (156, 183),
        "question_count": 5,
        "topic": (
            "A sale where the discounted price is quite a bit higher than last "
            "week's ordinary price. The shop clerk explains the reason twice, "
            "very politely, with a small chart. There is no way the explanation "
            "is correct, the writer follows none of it, and buys the thing."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "kenkou-shindan",
        "position": 22,
        "tone": "neutral",
        "vocab_cutoff": 321,
        "pull_forward": [],
        "grammar_cutoff": 47,
        "required_grammar": ["hodo", "kurai-degree", "dake-de-naku"],
        "target_words": (160, 187),
        "question_count": 5,
        "topic": (
            "A health checkup from start to finish: weight and height first, "
            "the injection everybody in the queue is quietly dreading, and the "
            "doctor's advice at the end — not only less salt but more walking. "
            "Told straight, in the order it happens."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "nazo-no-bukatsu",
        "position": 23,
        "tone": "humorous",
        "vocab_cutoff": 342,
        "pull_forward": [],
        "grammar_cutoff": 47,
        "required_grammar": [],
        "target_words": (163, 190),
        "question_count": 5,
        "topic": (
            "A tennis club that does everything except tennis. The court is "
            "booked every Tuesday afternoon, but the members sit in a classroom "
            "playing cards. The writer, who is bad at sport, is very happy with "
            "this. One serious member opens the door each week and asks everyone "
            "to play tennis, and slowly, one person every two weeks, people "
            "follow."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "apuri-no-kenka",
        "position": 24,
        "tone": "humorous",
        "vocab_cutoff": 356,
        "pull_forward": ["souiu", "kouiu"],
        "grammar_cutoff": 48,
        "required_grammar": ["tte"],
        "target_words": (166, 194),
        "question_count": 5,
        "topic": (
            "Two friends arguing about a phone app: that kind of app is "
            "useless, no, listen, that is not what I said. Neither of them "
            "changes their mind and both of them install it before the walk "
            "home is over. Write it in casual plain form, the way friends "
            "actually talk to each other."
        ),
        "extra_allowed": ["リク"],
    },
    {
        "slug": "goukaku-ka-douka",
        "position": 25,
        "tone": "humorous",
        "vocab_cutoff": 375,
        "pull_forward": [],
        "grammar_cutoff": 51,
        "required_grammar": ["ka-douka", "ka-nanka", "toka"],
        "target_words": (169, 197),
        "question_count": 5,
        "topic": (
            "The hour before the exam results go up: the writer opens the site, "
            "closes it, asks a friend whether they have looked, eats a piece of "
            "cake or something instead, and lists all the things they will do "
            "if it went badly. The result, when it finally comes, is good on "
            "one side and very awkward on the other."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "sanjuppun-no-kaigi",
        "position": 26,
        "tone": "humorous",
        "vocab_cutoff": 393,
        "pull_forward": [],
        "grammar_cutoff": 54,
        "required_grammar": ["soredemo", "sokode", "sonoseika-de"],
        "target_words": (173, 201),
        "question_count": 5,
        "topic": (
            "A meeting booked for thirty minutes. However, the screen will not "
            "switch on; even so, nobody leaves; so the section head starts "
            "explaining everything by drawing instead; and because of that the "
            "meeting reaches its second hour with exactly one thing decided, "
            "which is when to meet again."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "sotsugyou-shite-kara",
        "position": 27,
        "tone": "neutral",
        "vocab_cutoff": 412,
        "pull_forward": [],
        "grammar_cutoff": 56,
        "required_grammar": ["suruto", "igai"],
        "target_words": (176, 204),
        "question_count": 5,
        "topic": (
            "Three years after graduation: the same station, the same café on "
            "the corner, every friend busier now except one, who still sits in "
            "the same seat reading. Then a letter comes from that friend: they "
            "are going to work abroad, and they are glad the writer has not "
            "changed at all. The writer had thought the friend was the one who "
            "never changed. Warm and plain, no joke."
        ),
        "extra_allowed": ["ハル"],
    },
    {
        "slug": "kotoshi-koso",
        "position": 28,
        "tone": "humorous",
        "vocab_cutoff": 440,
        "pull_forward": [],
        "grammar_cutoff": 56,
        "required_grammar": [],
        "target_words": (179, 208),
        "question_count": 5,
        "topic": (
            "A New Year plan to study Japanese every day. In January the writer "
            "writes a beautiful timetable and puts it on the wall above the "
            "desk. Every week there is a new reason not to study. By March the "
            "plan has been read only once, on the day it went up, but the boy "
            "next door reads it through the window every morning."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "densha-ga-tomatta-hi",
        "position": 29,
        "tone": "humorous",
        "vocab_cutoff": 470,
        "pull_forward": [],
        "grammar_cutoff": 56,
        "required_grammar": [],
        "target_words": (183, 211),
        "question_count": 5,
        "topic": (
            "The trains stop because of a typhoon, so the writer has to walk to "
            "work. On the way they do three errands they have put off for a "
            "month: the post office, the library, the pharmacy. Next to the "
            "pharmacy is an umbrella shop. They stand in it for twenty minutes "
            "choosing, buy one, and step out into a sky that has stopped "
            "raining."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "matsuri-no-oshirase",
        "position": 30,
        "tone": "neutral",
        "vocab_cutoff": 529,
        "pull_forward": [],
        "grammar_cutoff": 56,
        "required_grammar": [],
        "target_words": (186, 215),
        "question_count": 5,
        "topic": (
            "A notice from the city office about the summer festival: the date "
            "and time, the fireworks, where the rubbish bins are, what the "
            "office asks of visitors, and what it asks of the stall holders. One "
            "careful line explains what happens if the weather turns bad during "
            "the fireworks. Courteous, exact, written as a public notice."
        ),
        "extra_allowed": [],
    },
]

SEEDS = {"n5": N5_SEEDS, "n4": N4_SEEDS}


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
    position, `pull_forward` and `pull_forward_grammar` naming later items
    only, `required_grammar` naming points the seed's own window has reached —
    by cutoff or by pull-forward."""
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
        pulled_grammar = list(s.get("pull_forward_grammar", []))
        for slug in pulled_grammar:
            if slug not in grammar_at:
                errors.append(
                    f"{s['slug']}: pull_forward_grammar {slug!r} is not a {level} "
                    f"grammar point"
                )
            elif grammar_at[slug] < s["grammar_cutoff"]:
                errors.append(
                    f"{s['slug']}: pull_forward_grammar {slug!r} is point "
                    f"{grammar_at[slug] + 1}, already inside grammar_cutoff "
                    f"{s['grammar_cutoff']}"
                )
        for slug in s["required_grammar"]:
            if slug not in grammar_at:
                errors.append(
                    f"{s['slug']}: required_grammar {slug!r} is not a {level} "
                    f"grammar point"
                )
            elif grammar_at[slug] >= s["grammar_cutoff"] and slug not in pulled_grammar:
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
    point of `required_grammar`.

    Every point except a `MANUAL_SLUG`. `ladder_errors` refuses to let a seed
    require one (no mechanical rule can confirm a passage uses it), so counting
    it here would make the two checks unsatisfiable together: N4's
    `node-vs-kara` is から, the same から as `kara-because`.

    A level with no seeds (N3 grammar ships without passages) has no rule."""
    if level not in SEEDS:
        return []
    assigned = {}
    for s in seeds_for(level):
        for slug in s.get("required_grammar", []):
            assigned.setdefault(slug, []).append(s["slug"])

    level_slugs = [
        g["slug"] for g in context.load_grammar(level)
        if g["slug"] not in grammar_detect.MANUAL_SLUGS
    ]
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
