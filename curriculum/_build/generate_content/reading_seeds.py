# -*- coding: utf-8 -*-
"""Phase 4 reading-passage seeds (docs/content/content-pipeline-plan.md Phase 4).

A seed is the *plan* for one passage: its ladder level, how long it should be,
how many comprehension questions it carries, what it is about, and its **tone
tag**. Nothing here is generated; these are the maintainer-authored inputs the
generator reads.

## Ladder levels (level-ladder plan, Task 9)

A passage is the level test (spec §7.6 of
docs/superpowers/specs/2026-11-18-level-ladder-design.md): the learner completes
a level 2–20 by passing 2 of its passages. So every level 2–20 has at least 3
seeds, and level 1 has none. A seed's `level` is the passage's level: its window
is every word and grammar point at or below that level (reading_context.py).
`position` is not written here: `seeds_for` numbers the seeds of a level in the
order they are listed.

`target_words` (a band on the tokenizer word count, see
`validate_readings.word_count`) and `question_count` grow with the level: 20–30
words and 2 questions at level 2, 155–182 words and 5 questions at level 20.

## Why tone is a seed field

Rev 1 wants most passages humorous. Humour left to per-call chance gives
whatever mix the model feels like, so it is assigned here as a planned mix and
checked mechanically (`tone_mix_errors`). `humorous` seeds get the
comedy-register section of `prompts/persona.md`; `neutral` seeds get the same
persona minus the instruction to be funny.

## `required_grammar`

The grammar points this passage **must** use, so that 100% grammar coverage of
levels 1–20 is a build invariant rather than a hope: `grammar_coverage_errors`
fails when a point is assigned to no seed or to two, and `validate_readings.py`
fails a passage whose body does not actually contain what its seed was assigned
(detected by `grammar_detect.py`, not declared by the model). A point goes to a
seed at its own level where the detector allows it, else to the first level
where it does.

## What the detector allows at a level (checked with grammar_detect, 2026-11-27)

Some topics carry a short note on form, because the detector reads a few forms
in a way a writer does not expect:

  * Every い-adjective, いい included, is `adj-i-conjugation` (level 8). Levels
    2–7 describe with nouns and verbs only. So `te-mo-ii` (level 5) is written
    てもかまいません, and `nakutemo-ii` (level 6) and `hoshii` (level 7) go to
    level 8 seeds.
  * Levels 2–3 have no question か (`ka-question`, level 4); level 2 has no に,
    で, も or と either.
  * `toki` is found after a verb (書く時), not after a noun (テストの時).
  * `hoshii` is found in kana (ほしい), not as 欲しい.
  * `potential` is found in the ichidan られる form (食べられる), not in godan
    forms (話せる), which are level-15 words anyway.
  * `causative` is found in the plain non-past (洗わせる); `causative-passive`
    in the long form (洗わせられる), not the short される.
  * `teiru-result` is found in plain ている, not in ています.
  * 教えたい is read as a potential form of 教える.

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

#: Humorous seeds as a fraction of all seeds. 80%, not 100%, because some
#: subjects fight comedy and gag after gag flattens out.
TONE_MIX_BOUNDS = (0.75, 0.85)

#: The 60 passages of levels 2–20: 3 per level, 4 at levels 8, 14 and 17 (the
#: levels with 7 grammar points to place), 47 humorous (78%).
SEEDS = [
    # --- level 2: 80 words — pronouns, numbers, dates, times, ten verbs ---
    {
        "slug": "kyou-wa-tooka-dewa-arimasen",
        "level": 2,
        "tone": "neutral",
        "required_grammar": ["wa-topic", "desu", "dewa-arimasen", "masu"],
        "target_words": (20, 30),
        "question_count": 2,
        "topic": (
            "A short, calm note on what today is: today is not the tenth, it is "
            "the fourth; it is seven o'clock now; the writer eats, writes, and "
            "goes. Next week Ken comes. One idea per sentence. There is no に, "
            "で, も or question か at this level, so a time and an action stand "
            "in their own sentences (七時です。食べます。)."
        ),
        "extra_allowed": ["ケン"],
    },
    {
        "slug": "tabemasen-ka",
        "level": 2,
        "tone": "humorous",
        "required_grammar": ["masen-ka", "mashou", "masen", "ga"],
        "target_words": (20, 30),
        "question_count": 2,
        "topic": (
            "Ken asks Mina: shall we eat? Mina has no time now; she writes. Ken "
            "asks again at eight, and at nine: no time. At ten Ken sees Mina "
            "eating. Deadpan, short lines of dialogue, no comment on the joke."
        ),
        "extra_allowed": ["ケン", "ミナ"],
    },
    {
        "slug": "ken-san-no-tooka",
        "level": 2,
        "tone": "humorous",
        "required_grammar": ["mashita", "wo", "no-possessive", "no-nominalizer"],
        "target_words": (20, 30),
        "question_count": 2,
        "topic": (
            "Ken came today, the fourth, but Ken's day is the tenth. Mina watches "
            "Ken write the date (書くのを見ました): he writes 十日. Mina "
            "understands: Ken's tenth is today. Plain facts; the reader gets "
            "the joke."
        ),
        "extra_allowed": ["ケン", "ミナ"],
    },
    # --- level 3: + family, bread and drinks, days, 買う 飲む 読む 帰る ---
    {
        "slug": "ojiisan-no-pan",
        "level": 3,
        "tone": "humorous",
        "required_grammar": ["he-direction", "de-location"],
        "target_words": (28, 38),
        "question_count": 2,
        "topic": (
            "Every morning Grandpa goes over there (あそこへ) and buys bread "
            "there. Grandma eats the bread, the baby eats the bread, everyone "
            "eats it. On Sunday Grandpa goes there, buys bread, and eats it "
            "there himself. There are no place names at this level: say ここ, "
            "そこ, あそこ. No question か yet."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "nichiyoubi-no-nomimono",
        "level": 3,
        "tone": "humorous",
        "required_grammar": ["ya-among", "to-and"],
        "target_words": (28, 38),
        "question_count": 2,
        "topic": (
            "On Sunday everyone comes: Grandpa and Grandma, the grown-ups and "
            "the baby. Each person buys drinks and things. Nobody buys food. On "
            "Monday everyone is still drinking the drinks. No question か at "
            "this level."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "akachan-mo",
        "level": 3,
        "tone": "humorous",
        "required_grammar": ["mo-also", "ni-direction"],
        "target_words": (28, 38),
        "question_count": 2,
        "topic": (
            "Grandpa and Grandma come here on Friday and go home on Monday. "
            "Whatever Grandpa does, the baby does too: Grandpa reads, the baby "
            "reads too; Grandma drinks, the baby drinks too. On Monday Grandpa "
            "goes home, and the baby wants to go home too. No question か yet."
        ),
        "extra_allowed": [],
    },
    # --- level 4: + home, work, shops, transport, morning and evening ---
    {
        "slug": "chichi-no-mainichi",
        "level": 4,
        "tone": "neutral",
        "required_grammar": ["kara-from", "made-until", "ka-question"],
        "target_words": (35, 46),
        "question_count": 2,
        "topic": (
            "A child describes Father's weekday: he is an office worker; he is "
            "at the company from morning until night; he reads the newspaper on "
            "the bus; he eats dinner at home. The child asks Mother what time "
            "Father comes home, and Mother answers. Plain and warm, no joke."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "konbini-kara-denwa",
        "level": 4,
        "tone": "humorous",
        "required_grammar": ["ni-indirect", "ne-tag"],
        "target_words": (35, 46),
        "question_count": 2,
        "topic": (
            "Older brother phones Mother from the convenience store three times: "
            "coffee, right? Tea, right? Bread, right? Mother says yes each time. "
            "He comes home with coffee, tea and bread. Mother bought all three at "
            "the supermarket this morning."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "sensei-no-asagohan",
        "level": 4,
        "tone": "humorous",
        "required_grammar": ["kara-because", "node-because"],
        "target_words": (35, 46),
        "question_count": 2,
        "topic": (
            "A student explains, reason by reason, why the teacher eats "
            "breakfast at the university: he reads books until late at night, so "
            "there is no time in the morning; so he does not eat at home; so... "
            "Each reason is a little less convincing than the last. Give the "
            "reasons with both から and ので."
        ),
        "extra_allowed": [],
    },
    # --- level 5: + rooms and things, colours, the kitchen, te-forms ---
    {
        "slug": "daidokoro-no-ruuru",
        "level": 5,
        "tone": "humorous",
        "required_grammar": ["te-wa-ikenai", "te-mo-ii"],
        "target_words": (42, 54),
        "question_count": 3,
        "topic": (
            "Mother writes rules on the kitchen door: you may drink here; you "
            "must not eat here; you must not watch TV here. Father reads them "
            "carefully, then takes his dinner to the bed. Give permission with "
            "てもかまいません: いい counts as an adjective, and adjectives come at "
            "level 8. Describe with nouns and verbs only."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "kamera-no-mise",
        "level": 5,
        "tone": "humorous",
        "required_grammar": ["te-kudasai", "yo-emphasis"],
        "target_words": (42, 54),
        "question_count": 3,
        "topic": (
            "A customer goes into a camera shop for one stamp. The clerk says: "
            "please look at this camera, please look at this computer, this one "
            "is red, you know. The customer looks at everything, then asks for "
            "a stamp. The clerk: we have no stamps, you know. Adjectives come at "
            "level 8: say colours as nouns (赤のカメラ)."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "ban-no-uchi",
        "level": 5,
        "tone": "humorous",
        "required_grammar": ["te-form", "te-iru"],
        "target_words": (42, 54),
        "question_count": 3,
        "topic": (
            "Evening at home, person by person: Grandpa is reading the "
            "newspaper, Mother is cooking in the kitchen, older brother is "
            "writing. The baby is watching all of them. Father comes home, eats, "
            "and watches TV; now everyone is watching Father's TV, and the baby "
            "is watching Father. Chain actions with the て-form (食べて、見て). "
            "No adjectives yet (level 8)."
        ),
        "extra_allowed": [],
    },
    # --- level 6: + family, the station, the hospital, letters ---
    {
        "slug": "eki-no-hako",
        "level": 6,
        "tone": "humorous",
        "required_grammar": ["naide-kudasai", "nai-form"],
        "target_words": (50, 63),
        "question_count": 3,
        "topic": (
            "A box sits at the station with a paper on it: please do not look at "
            "this box. A station worker reads it and does not look. A doctor "
            "reads it and does not look. A child looks. On the box is another "
            "paper: please do not look. Use the plain negative (見ない) in the "
            "narration. No adjectives yet (level 8)."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "sobo-no-tegami",
        "level": 6,
        "tone": "neutral",
        "required_grammar": ["nakereba-naranai"],
        "target_words": (50, 63),
        "question_count": 3,
        "topic": (
            "A letter from Grandmother: she has to go to the hospital on "
            "Thursday; Grandfather has to buy his own lunch that day; the writer "
            "has to write back. Gentle and plain, no joke. No adjectives yet "
            "(level 8)."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "hirugohan-o-tabete-kara",
        "level": 6,
        "tone": "humorous",
        "required_grammar": ["te-kara", "ta-form"],
        "target_words": (50, 63),
        "question_count": 3,
        "topic": (
            "A diary in plain form: yesterday the writer ate lunch, then read a "
            "book; after reading, ate lunch; after eating, wrote a letter to "
            "Grandmother: I ate lunch twice today. Plain past (食べた) in the "
            "narration. No adjectives yet (level 8)."
        ),
        "extra_allowed": [],
    },
    # --- level 7: + 33 verbs (wait, meet, ride, make, use, lend...) ---
    {
        "slug": "takushii-ni-notta-koto-ga-nai",
        "level": 7,
        "tone": "humorous",
        "required_grammar": ["ta-koto-ga-aru", "tai"],
        "target_words": (57, 71),
        "question_count": 3,
        "topic": (
            "Grandmother has never ridden in a taxi and wants to, once. The "
            "family calls one. She gets in, sits down, and asks the driver to "
            "follow the bus she always takes. Put 〜たい on verbs like 乗る and "
            "行く (教えたい is read as a potential form). No adjectives yet "
            "(level 8)."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "nichiyoubi-no-yotei",
        "level": 7,
        "tone": "humorous",
        "required_grammar": ["tari-tari", "ni-iku"],
        "target_words": (57, 71),
        "question_count": 3,
        "topic": (
            "The writer plans Sunday: going to buy bread, going to see the "
            "grandparents, reading, writing letters. Sunday comes. The writer "
            "sits, reads a little, sits again, and then it is Monday. No "
            "adjectives yet (level 8)."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "basu-ni-noru-mae-ni",
        "level": 7,
        "tone": "humorous",
        "required_grammar": ["mae-ni", "ato-de"],
        "target_words": (57, 71),
        "question_count": 3,
        "topic": (
            "Before getting on the bus, the writer checks the bag: pen, book, "
            "phone. After getting off, the writer checks again: everything is "
            "there, except the coat, which is leaving on the bus. No adjectives "
            "yet (level 8)."
        ),
        "extra_allowed": [],
    },
    # --- level 8: + adjectives, giving and receiving, tests, money ---
    {
        "slug": "hiragana-no-tesuto",
        "level": 8,
        "tone": "humorous",
        "required_grammar": ["dictionary-koto-ga-dekiru", "toki"],
        "target_words": (65, 80),
        "question_count": 3,
        "topic": (
            "A learner can write hiragana and can read katakana, but cannot "
            "write katakana. At the test, when the learner reads the questions, "
            "every answer has to be written in katakana. Put 時/とき after a verb "
            "(読む時); after a noun (テストの時) it is not detected."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "yasui-kaban",
        "level": 8,
        "tone": "humorous",
        "required_grammar": ["adj-i-conjugation", "adj-i-adverb"],
        "target_words": (65, 80),
        "question_count": 3,
        "topic": (
            "The writer bought a bag cheaply at a shop: it was not new, it was "
            "not big, but it was cheap. At home, Mother looks at it: it is her "
            "bag, which she sold to that shop last month. Use い-adjectives in "
            "several forms (安かった, 新しくない) and as an adverb (安く買った)."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "kirei-na-tegami",
        "level": 8,
        "tone": "neutral",
        "required_grammar": ["adj-na-conjugation", "adj-na-adverb"],
        "target_words": (65, 80),
        "question_count": 3,
        "topic": (
            "A letter from Grandmother, written neatly: she was always good at "
            "cooking, she is not good at katakana, her garden is pretty. The "
            "writer writes back, slowly and neatly. Warm and plain, no joke. Use "
            "な-adjectives in their forms (きれいでした, 上手ではありません) "
            "and as adverbs (きれいに)."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "kamera-ga-hoshii",
        "level": 8,
        "tone": "humorous",
        "required_grammar": ["hoshii", "nakutemo-ii"],
        "target_words": (65, 80),
        "question_count": 3,
        "topic": (
            "A boy wants a camera. Father says he does not have to buy a new "
            "one: Father will give him his. Father's camera is very big and "
            "very heavy. Now the boy wants a bag for the camera. Write ほしい in "
            "kana (the detector reads 欲しい as a plain adjective)."
        ),
        "extra_allowed": [],
    },
    # --- level 9: + trains, cars, films, the sky, places, comparison ---
    {
        "slug": "densha-to-jitensha",
        "level": 9,
        "tone": "humorous",
        "required_grammar": ["comparative-yori", "superlative-ichiban"],
        "target_words": (72, 88),
        "question_count": 3,
        "topic": (
            "Three people race to the library: one by train, one by car, one by "
            "bicycle. The train is faster than the bicycle, the car is faster "
            "than the train, and the bicycle comes first, because the library is "
            "next to the cyclist's house."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "eiga-wa-dou-desu-ka",
        "level": 9,
        "tone": "humorous",
        "required_grammar": ["dou-desu-ka", "to-omou"],
        "target_words": (72, 88),
        "question_count": 3,
        "topic": (
            "Two people choose a film at the cinema: how about this one? I think "
            "it is boring. How about this one? I think it is too long. They talk "
            "until the last film has started, then go home and say it was an "
            "interesting evening."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "ano-hoshi",
        "level": 9,
        "tone": "neutral",
        "required_grammar": ["to-iu", "darou"],
        "target_words": (72, 88),
        "question_count": 3,
        "topic": (
            "A child and Grandfather look at the evening sky. The child asks "
            "what that big star is called. Grandfather does not know; it is "
            "probably a very big star, he says. They give it their own name. "
            "Quiet, no joke. Use という and だろう."
        ),
        "extra_allowed": [],
    },
    # --- level 10: + travel, hotels, planes, names and numbers ---
    {
        "slug": "hikouki-wa-mou",
        "level": 10,
        "tone": "humorous",
        "required_grammar": ["mou-past", "mada-teinai"],
        "target_words": (80, 97),
        "question_count": 4,
        "topic": (
            "The writer is late for a plane and phones from the taxi: has the "
            "plane already flown? Not yet. Has it gone up? Not yet. The plane "
            "has not left because the pilot is late too, and is in the same "
            "taxi."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "hoteru-no-heya",
        "level": 10,
        "tone": "humorous",
        "required_grammar": ["dake", "shika-nai"],
        "target_words": (80, 97),
        "question_count": 4,
        "topic": (
            "A cheap hotel room: only one chair, only one window, and the TV has "
            "only music. The writer phones to complain, but the phone only calls "
            "the next room, where another guest is complaining about the same "
            "things."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "sofu-no-unten",
        "level": 10,
        "tone": "neutral",
        "required_grammar": ["hou-ga-ii", "deshou"],
        "target_words": (80, 97),
        "question_count": 4,
        "topic": (
            "Grandfather wants to learn to drive. The family give advice: he had "
            "better learn on Tuesdays, when there are few cars; he had better "
            "not drive at night. He will probably be fine, they say. Quiet and "
            "warm, no joke."
        ),
        "extra_allowed": [],
    },
    # --- level 11: + school, the station building, adverbs of frequency ---
    {
        "slug": "erebeetaa-to-kaidan",
        "level": 11,
        "tone": "humorous",
        "required_grammar": ["gurai", "goro"],
        "target_words": (87, 105),
        "question_count": 4,
        "topic": (
            "The writer's classroom is on the seventh floor. The elevator takes "
            "about ten minutes to come; the stairs take about five minutes. The "
            "writer runs up the stairs and arrives at around nine every day, "
            "tired. The teacher arrives at around nine too, by elevator, "
            "smiling."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "zenzen-wakarimasen",
        "level": 11,
        "tone": "humorous",
        "required_grammar": ["zenzen-nai", "amari-nai", "janai-desu-ka"],
        "target_words": (87, 105),
        "question_count": 4,
        "topic": (
            "In Japanese class a student says he does not understand at all. "
            "The teacher says: but you understand, don't you? You answered in "
            "Japanese. The student says, in Japanese, that he does not "
            "understand much."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "umi-de-obentou",
        "level": 11,
        "tone": "neutral",
        "required_grammar": ["demo-suggestion", "naru-become"],
        "target_words": (87, 105),
        "question_count": 4,
        "topic": (
            "A day at the sea with lunch boxes. In the afternoon the water "
            "becomes cold, the wind becomes stronger, and the beach gradually "
            "becomes quiet. Someone suggests going home and drinking tea or "
            "something (お茶でも). Calm and plain, no joke."
        ),
        "extra_allowed": [],
    },
    # --- level 12: + greetings, connectives, family, weekends ---
    {
        "slug": "tabesugita-shuumatsu",
        "level": 12,
        "tone": "humorous",
        "required_grammar": ["sugiru", "kamoshirenai"],
        "target_words": (95, 114),
        "question_count": 4,
        "topic": (
            "Monday morning after a big weekend: the writer ate too much on "
            "Saturday and drank too much on Sunday. Now the clothes do not fit. "
            "Maybe the writer is ill; maybe the clothes got smaller in the wash; "
            "maybe it is Monday's fault."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "ongaku-o-kikinagara",
        "level": 12,
        "tone": "humorous",
        "required_grammar": ["nagara", "noni"],
        "target_words": (95, 114),
        "question_count": 4,
        "topic": (
            "The son studies while listening to music, while eating, while "
            "watching TV. Even though he studied every night, the test result is "
            "bad. The next week he studies with no music and no TV, and the "
            "result is exactly the same."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "haha-no-tame-ni",
        "level": 12,
        "tone": "neutral",
        "required_grammar": ["moraru-ageru-kureru", "tame-ni"],
        "target_words": (95, 114),
        "question_count": 4,
        "topic": (
            "A family day for Mother: the daughter buys flowers for her, the son "
            "writes her a letter, Father gives her a book. Mother receives "
            "everything, then makes dinner for everyone. Warm and plain, no "
            "joke. Use あげる, くれる and もらう, and ために."
        ),
        "extra_allowed": [],
    },
    # --- level 13: + friends, the town, cafés, the post office ---
    {
        "slug": "kissaten-no-okashi",
        "level": 13,
        "tone": "humorous",
        "required_grammar": ["souda-looks", "potential"],
        "target_words": (102, 122),
        "question_count": 4,
        "topic": (
            "At a café every sweet looks delicious. The writer's friend cannot "
            "eat sugar, so the writer says: I can eat all of them. The writer "
            "cannot. Write the potential with an ichidan verb + られる "
            "(食べられる); godan forms (話せる) are level-15 words and are not "
            "detected."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "ginkou-wa-sanji-made",
        "level": 13,
        "tone": "humorous",
        "required_grammar": ["souda-hearsay", "nara"],
        "target_words": (102, 122),
        "question_count": 4,
        "topic": (
            "A friend tells the writer what he has heard: the bank closes at "
            "three, the post office closes at five, the bread shop by the "
            "bridge closes when the bread is gone. If it is the bank, you have "
            "to go now. The writer runs to the bank. It is Sunday."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "yuubinkyoku-made-no-michi",
        "level": 13,
        "tone": "humorous",
        "required_grammar": ["tara", "ba"],
        "target_words": (102, 122),
        "question_count": 4,
        "topic": (
            "A stranger asks the way to the post office. The writer explains: if "
            "you cross the bridge, there is a bank; if you walk past the bank, "
            "there is a corner; if you go to the corner... The directions get "
            "longer and longer. The post office is just behind the stranger."
        ),
        "extra_allowed": [],
    },
    # --- level 14: + weather, seasons, animals, 70 change verbs ---
    {
        "slug": "inu-ga-shikarareta",
        "level": 14,
        "tone": "humorous",
        "required_grammar": ["passive", "hazu"],
        "target_words": (110, 131),
        "question_count": 4,
        "topic": (
            "Someone ate the fish on the table. Mother scolds the dog. The "
            "writer knows it should have been the cat: the cat is on the "
            "shelf, washing its face, very pleased. The dog is scolded a second "
            "time for looking sad."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "ani-to-otouto",
        "level": 14,
        "tone": "humorous",
        "required_grammar": ["causative", "causative-passive"],
        "target_words": (110, 131),
        "question_count": 4,
        "topic": (
            "Older brother makes his younger brother do everything: carry the "
            "bags, wash the dishes, buy the bread. The younger brother is made "
            "to do it all. Then Mother comes home and makes the older brother "
            "do everything. Put the causative in the plain non-past at least "
            "once (洗わせる), and the causative-passive in the long form "
            "(洗わせられる), not the short される."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "musuko-ga-yomu-you-ni",
        "level": 14,
        "tone": "neutral",
        "required_grammar": ["youni", "youninaru"],
        "target_words": (110, 131),
        "question_count": 4,
        "topic": (
            "Last winter the son did not read at all. The writer put books next "
            "to his bed so that he would read. Now, in spring, he reads every "
            "night, and asks for more books. Quiet and warm, no joke."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "neko-ga-tabenaku-natta",
        "level": 14,
        "tone": "humorous",
        "required_grammar": ["younaru"],
        "target_words": (110, 131),
        "question_count": 4,
        "topic": (
            "The cat has stopped eating its food at home. The family worry and "
            "take it to the doctor. The doctor says the cat is fine; in fact it "
            "is a little heavy. The cat has been eating at the house on the "
            "corner every day."
        ),
        "extra_allowed": [],
    },
    # --- level 15: + potential verbs, polite verbs, likes, daily routine ---
    {
        "slug": "kagi-ga-kakete-aru",
        "level": 15,
        "tone": "humorous",
        "required_grammar": ["tearu", "teiru-result"],
        "target_words": (117, 139),
        "question_count": 5,
        "topic": (
            "The writer comes home: the door is locked, but a window is open and "
            "the light is on. A thief? The writer goes in quietly, holding an "
            "umbrella. Nobody is there. The writer left the window open and the "
            "light on this morning. Write the resultant ている in plain form at "
            "least once (窓が開いている): ています is not detected as it."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "kado-no-ie-no-yuumeijin",
        "level": 15,
        "tone": "humorous",
        "required_grammar": ["rashii", "mitai"],
        "target_words": (117, 139),
        "question_count": 5,
        "topic": (
            "The man in the house on the corner seems to be famous: people take "
            "photos in front of his house, and young people wait at his door. "
            "It turns out he only looks like a famous singer, and he has started "
            "to enjoy it."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "sofu-no-kagi",
        "level": 15,
        "tone": "humorous",
        "required_grammar": ["hazuganai", "youda"],
        "target_words": (117, 139),
        "question_count": 5,
        "topic": (
            "Grandfather cannot find his keys. There is no way he lost them, he "
            "says: he never forgets anything. It seems he did. The family look "
            "everywhere. The keys are hanging around his neck."
        ),
        "extra_allowed": [],
    },
    # --- level 16: + food, directions, counters, outings ---
    {
        "slug": "keeki-o-katte-oita",
        "level": 16,
        "tone": "humorous",
        "required_grammar": ["teoku", "teshimau"],
        "target_words": (125, 148),
        "question_count": 5,
        "topic": (
            "For a friend's party the writer buys a cake the day before and "
            "hides it. At night the writer eats all of it. On the day the writer "
            "buys another cake, and the friend arrives carrying the same cake."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "yama-ni-noboru-tsumori",
        "level": 16,
        "tone": "neutral",
        "required_grammar": ["tsumori", "temo"],
        "target_words": (125, 148),
        "question_count": 5,
        "topic": (
            "Two friends plan to climb a mountain on Saturday. Even if it rains, "
            "they will go. On Saturday a typhoon comes, so they plan to go next "
            "week, even if it snows. Quiet and plain, no joke."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "mainichi-sanpo",
        "level": 16,
        "tone": "humorous",
        "required_grammar": ["youni-suru", "teiku-tekuru"],
        "target_words": (125, 148),
        "question_count": 5,
        "topic": (
            "The writer tries to take a walk every day. The neighbour's dog "
            "follows. Soon three dogs come along. Now the writer walks the "
            "neighbours' dogs every day, and the neighbours stay at home."
        ),
        "extra_allowed": [],
    },
    # --- level 17: + sport, hobbies, hospital, shopping, the internet ---
    {
        "slug": "chichi-no-piano",
        "level": 17,
        "tone": "humorous",
        "required_grammar": ["koto-ni-suru", "bakari"],
        "target_words": (132, 156),
        "question_count": 5,
        "topic": (
            "Father decides to learn the piano. He practises only one song, "
            "every night. After a month the whole family can sing it, and the "
            "neighbour sings it in the garden. Father has decided to learn a "
            "second song. Nobody is glad."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "sobo-no-niwa",
        "level": 17,
        "tone": "neutral",
        "required_grammar": ["koto-ni-naru", "aida"],
        "target_words": (132, 156),
        "question_count": 5,
        "topic": (
            "Grandmother has to go into hospital for two weeks. While she is in "
            "hospital, the writer looks after her garden: water in the morning, "
            "a phone call in the evening. When she comes home, the flowers are "
            "out. Warm and plain, no joke."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "ensoku-no-oshirase",
        "level": 17,
        "tone": "humorous",
        "required_grammar": ["to-conditional", "baai"],
        "target_words": (132, 156),
        "question_count": 5,
        "topic": (
            "A teacher reads the notice for a school trip: when the bell rings, "
            "everyone gets on the bus; in case of rain, the trip goes to the "
            "museum; in case someone is late, the bus waits five minutes. Then "
            "come the students' questions, each one stranger than the last."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "ima-deru-tokoro",
        "level": 17,
        "tone": "humorous",
        "required_grammar": ["tokoro"],
        "target_words": (132, 156),
        "question_count": 5,
        "topic": (
            "The writer phones a friend who is late: I am just about to leave. "
            "Thirty minutes later: I am putting on my shoes right now. Later: I "
            "have just arrived! The friend is at the station, the wrong one."
        ),
        "extra_allowed": [],
    },
    # --- level 18: + work, the company, news and apps, feelings ---
    {
        "slug": "nyuusu-ni-yoruto",
        "level": 18,
        "tone": "humorous",
        "required_grammar": ["niyoruto", "tame"],
        "target_words": (140, 165),
        "question_count": 5,
        "topic": (
            "According to the news, the trains stopped this morning because of "
            "a cow on the line. The writer arrives late and explains to the "
            "section head. The section head is not angry: according to the same "
            "news, he was on that train too, and he has a photo of the cow."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "atarashii-apuri",
        "level": 18,
        "tone": "neutral",
        "required_grammar": ["nitsuite", "nikui-yasui"],
        "target_words": (140, 165),
        "question_count": 5,
        "topic": (
            "The company president explains the new app to the staff: what it "
            "is for, how to use it, which parts are easy to use and which screen "
            "is hard to read, and what to do with questions about it. A plain, "
            "polite company announcement."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "zangyou-datta-n-desu",
        "level": 18,
        "tone": "humorous",
        "required_grammar": ["noda"],
        "target_words": (140, 165),
        "question_count": 5,
        "topic": (
            "A husband comes home at midnight: I had overtime, you see. His wife "
            "says: really? He explains more and more, each with a んです. She "
            "shows him the news on her phone: his company was closed today."
        ),
        "extra_allowed": [],
    },
    # --- level 19: + adverbs, set phrases, humble and honorific verbs ---
    {
        "slug": "mise-ga-aite-iru-ka-douka",
        "level": 19,
        "tone": "humorous",
        "required_grammar": ["ka-douka", "ka-nanka"],
        "target_words": (147, 173),
        "question_count": 5,
        "topic": (
            "On a holiday the writer does not know whether the ramen shop is "
            "open. The writer walks there anyway, thinking about what to order. "
            "It is closed, so the writer buys bread or something. On the way "
            "home the writer passes the shop owner, who is eating ramen at "
            "another shop."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "naku-hodo-karai",
        "level": 19,
        "tone": "humorous",
        "required_grammar": ["hodo", "kurai-degree"],
        "target_words": (147, 173),
        "question_count": 5,
        "topic": (
            "A curry so spicy that you cry. The writer drinks so much water that "
            "there is no room for dessert. The friend who recommended the shop "
            "eats every bite without a word, crying, and says it is a little "
            "less spicy than last time."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "atarashii-sensei-tte",
        "level": 19,
        "tone": "humorous",
        "required_grammar": ["tte", "dake-de-naku"],
        "target_words": (147, 173),
        "question_count": 5,
        "topic": (
            "Students pass around rumours about the new teacher: they say the "
            "new teacher speaks not only English but French; plays not only "
            "tennis but golf; was a famous singer. The teacher arrives. All of "
            "it is true, except that the teacher was not famous."
        ),
        "extra_allowed": [],
    },
    # --- level 20: + society, nature, events, rubbish and recycling ---
    {
        "slug": "gomi-no-hi",
        "level": 20,
        "tone": "humorous",
        "required_grammar": ["toka", "igai"],
        "target_words": (155, 182),
        "question_count": 5,
        "topic": (
            "Rubbish-day rules in a new flat: bottles and cans and such on "
            "Tuesday; nothing except paper on Thursday; and so on, for a whole "
            "page. The writer studies the rules for a week, and becomes the "
            "person the neighbours ask."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "taifuu-no-ato",
        "level": 20,
        "tone": "neutral",
        "required_grammar": ["sonoseika-de", "soredemo"],
        "target_words": (155, 182),
        "question_count": 5,
        "topic": (
            "A typhoon came in the night. Because of that, the trains stopped "
            "and the school closed. Even so, the bakery by the station opened "
            "at seven, as always, and people came in wet to buy bread. Calm and "
            "plain, no joke. Use そのため and それでも."
        ),
        "extra_allowed": [],
    },
    {
        "slug": "hanabi-ga-mienai",
        "level": 20,
        "tone": "humorous",
        "required_grammar": ["sokode", "suruto"],
        "target_words": (155, 182),
        "question_count": 5,
        "topic": (
            "At the summer fireworks the crowd is too tall to see over. So "
            "(そこで) the writer climbs a small hill. Then (すると) a man in a "
            "uniform comes up: this hill is where the fireworks go up from. Use "
            "そこで and すると."
        ),
        "extra_allowed": [],
    },
]

#: Two seeds from the retired set, kept only for the gate's fixtures
#: (`validate_readings.py --fixtures`, `fixtures/readings/`), which are written
#: against them. `seed` finds them; `seeds_for`, the coverage check and the
#: tone mix do not, so no lane ever selects them.
FIXTURE_SEEDS = [
    {
        "slug": "eki-made-no-michi",
        "level": 16,
        "position": 9,
        "tone": "neutral",
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
        "slug": "neko-to-shukudai",
        "level": 22,
        "position": 7,
        "tone": "humorous",
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
]

#: The passages teach the grammar of levels 1–20 (spec §7.6); the coverage
#: check holds every point there to exactly one seed.
COVERAGE_LEVELS = 20


def seed_level(slug):
    for s in SEEDS:
        if s["slug"] == slug:
            return s["level"]
    raise KeyError(f"unknown reading seed {slug!r}")


def seeds_for(level):
    """The seeds at ladder `level`, each with `position` = its rank there."""
    at = [s for s in SEEDS if s["level"] == level]
    if not at:
        levels = sorted({s["level"] for s in SEEDS})
        raise KeyError(f"no reading seeds at level {level!r} — seeded levels: "
                       f"{', '.join(map(str, levels))}")
    return [{**s, "position": n} for n, s in enumerate(at, start=1)]


def seed(level, slug):
    for s in FIXTURE_SEEDS:
        if s["slug"] == slug and s["level"] == level:
            return s
    for s in seeds_for(level):
        if s["slug"] == slug:
            return s
    raise KeyError(f"unknown reading seed {slug!r} at level {level}")


def all_slugs(level):
    """Seed slugs in position order."""
    return [s["slug"] for s in seeds_for(level)]


def seed_errors(level):
    """Structural problems with a level's seed list (tones, bands, the
    required grammar, and the all-seed grammar coverage and humour mix).

    Run by the gate and by `generate_readings context`, because a malformed
    seed list silently produces malformed prompts."""
    errors = []
    seeds = seeds_for(level)
    slugs = [s["slug"] for s in SEEDS + FIXTURE_SEEDS]
    if len(set(slugs)) != len(slugs):
        errors.append("duplicate seed slugs")
    for s in seeds:
        if s["tone"] not in TONES:
            errors.append(f"{s['slug']}: unknown tone {s['tone']!r}")
        lo, hi = s["target_words"]
        if lo >= hi:
            errors.append(f"{s['slug']}: target_words {s['target_words']} is not a band")
        if s["question_count"] < 2:
            errors.append(f"{s['slug']}: question_count must be at least 2")
    errors += ladder_errors(level)
    errors += grammar_coverage_errors()
    errors += tone_mix_errors()
    return errors


def ladder_errors(level):
    """`required_grammar` of each seed at `level` names points at or below
    the level, none of them a MANUAL_SLUG."""
    errors = []
    reachable = {g["slug"] for g in context.grammar_through(level)}
    for s in seeds_for(level):
        if "required_grammar" not in s:
            errors.append(f"{s['slug']}: missing required_grammar")
            continue
        for slug in s["required_grammar"]:
            if slug not in reachable:
                errors.append(
                    f"{s['slug']}: required_grammar {slug!r} is not a grammar point at "
                    f"or below level {level} — the passage may not use what it must use"
                )
            elif slug in grammar_detect.MANUAL_SLUGS:
                errors.append(
                    f"{s['slug']}: required_grammar {slug!r} is a MANUAL_SLUG; no "
                    f"mechanical rule can confirm a passage uses it, so it cannot "
                    f"be required"
                )
    return errors


def grammar_coverage_errors():
    """The invariant: every grammar point of levels 1..COVERAGE_LEVELS is
    assigned to exactly one seed. Remove an assignment and the build breaks —
    which is the whole point of `required_grammar`.

    Every point except a `MANUAL_SLUG`. `ladder_errors` refuses to let a seed
    require one (no mechanical rule can confirm a passage uses it), so counting
    it here would make the two checks unsatisfiable together: `node-vs-kara`
    is から, the same から as `kara-because`.

    Nor a `read_once` point: `conjugation-primer` is an overview card with no
    form of its own, so no passage can use it."""
    assigned = {}
    for s in SEEDS:
        for slug in s.get("required_grammar", []):
            assigned.setdefault(slug, []).append(s["slug"])

    level_slugs = [
        g["slug"] for g in context.grammar_through(COVERAGE_LEVELS)
        if g["slug"] not in grammar_detect.MANUAL_SLUGS and not g.get("read_once")
    ]
    unassigned = [slug for slug in level_slugs if slug not in assigned]
    errors = []
    if unassigned:
        shown = ", ".join(unassigned[:12])
        rest = len(unassigned) - 12
        errors.append(
            f"levels 1-{COVERAGE_LEVELS} grammar coverage is "
            f"{len(level_slugs) - len(unassigned)}/{len(level_slugs)}; unassigned to "
            f"any seed's required_grammar: {shown}"
            + (f", … (+{rest} more)" if rest > 0 else "")
        )
    for slug, owners in sorted(assigned.items()):
        if len(owners) > 1:
            errors.append(
                f"grammar {slug} is required by {len(owners)} seeds "
                f"({', '.join(owners)}); each point belongs to exactly one passage"
            )
    return errors


def tone_mix_errors():
    """Rev 1's planned humour mix, checked over every seed (a ladder level
    holds about three, too few for a share)."""
    seeds = SEEDS
    humorous = sum(1 for s in seeds if s["tone"] == "humorous")
    share = humorous / len(seeds)
    lo, hi = TONE_MIX_BOUNDS
    if lo <= share <= hi:
        return []
    return [
        f"humour mix is {humorous}/{len(seeds)} ({share:.0%}); "
        f"Phase 4 Rev 1 wants {lo:.0%}–{hi:.0%} humorous seeds"
    ]
