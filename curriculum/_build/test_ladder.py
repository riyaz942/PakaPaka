# curriculum/_build/test_ladder.py
# -*- coding: utf-8 -*-
import os
import sys
import unittest
from unittest import mock

BUILD_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BUILD_DIR)

import ladder  # noqa: E402

# Equal strokes here, so sort_order shows the pick order; STROKES_* vary them.
KANJI = [
    {"slug": "k1", "form": "一", "radicals": ["r1"], "strokes": 1},
    {"slug": "k2", "form": "二", "radicals": ["r1"], "strokes": 1},
    {"slug": "k3", "form": "三", "radicals": ["r2"], "strokes": 1},
    {"slug": "k4", "form": "四", "radicals": ["r3"], "strokes": 1},
    {"slug": "k5", "form": "五", "radicals": ["r2", "r3"], "strokes": 1},
]
STROKES_KANJI = {"k1": 3, "k2": 4, "k3": 2, "k4": 1, "k5": 4}

# Authored words spread over levels 1-20: slots 1, 3, 6, 8, 11, 13, 16, 18.
# Greedy picks k1 k3 (level 1), k5 k2 (level 2), k4 (level 3).
WORDS = [
    {"slug": "w1", "kanji": ["k1", "k5"], "authored": True},
    {"slug": "w2", "kanji": ["k1"], "authored": True},
    {"slug": "w3", "kanji": ["k1"], "authored": True},
    {"slug": "w4", "kanji": ["k3"], "authored": True},
    {"slug": "w5", "kanji": ["k3"], "authored": True},
    {"slug": "w6", "kanji": [], "authored": True},
    {"slug": "w7", "kanji": ["k2"], "authored": True},
    {"slug": "w8", "kanji": ["k4", "k5"], "authored": True},
]

GRAMMAR = [
    {"slug": "g1", "tier": "core", "examples": []},
    {"slug": "g2", "tier": "core", "examples": []},
    {"slug": "g3", "tier": "core", "examples": []},
    {"slug": "g4", "tier": "n3", "examples": []},
]

PASSAGES = [{"slug": "p1", "vocabulary": ["w1", "w2"], "grammar": ["g2"]}]

REFERENCE = {
    "N5": {"kanji": ["k1"], "vocabulary": ["w1"], "grammar": ["g1"]},
    "N4": {"kanji": ["k2"], "vocabulary": ["w2"], "grammar": ["g2"]},
}


# r4 builds no kanji.
RADICALS = [{"slug": f"r{i}", "strokes": 1} for i in range(1, 5)]
STROKES_RADICALS = {"r1": 3, "r2": 1, "r3": 2, "r4": 1}


def with_strokes(items, strokes):
    return [{**item, "strokes": strokes[item["slug"]]} for item in items]


def build(words=WORDS, passages=PASSAGES, overrides=None, reference=REFERENCE,
          kanji=KANJI, radicals=RADICALS):
    with mock.patch.object(ladder, "KANJI_PER_LEVEL", [2, 2, 1]):
        return ladder.build_ladder(kanji, words, GRAMMAR, passages, overrides or {}, reference,
                                   radicals)


def build_with_strokes(**kwargs):
    return build(kanji=with_strokes(KANJI, STROKES_KANJI),
                 radicals=with_strokes(RADICALS, STROKES_RADICALS), **kwargs)


def in_level(result, kind, level):
    entries = result[kind]
    return sorted((s for s in entries if entries[s]["level"] == level),
                  key=lambda s: entries[s]["sort_order"])


class LadderTest(unittest.TestCase):
    def test_kanji_that_completes_most_words_goes_first(self):
        result = build()
        # k5 waits in as many words as k3 but completes none of them.
        self.assertEqual(in_level(result, "kanji", 1), ["k1", "k3"])
        self.assertEqual(in_level(result, "kanji", 2), ["k5", "k2"])
        self.assertEqual(in_level(result, "kanji", 3), ["k4"])

    def test_radical_level_is_first_kanji_level(self):
        result = build()
        self.assertEqual(in_level(result, "radical", 1), ["r1", "r2"])
        self.assertEqual(result["radical"]["r3"]["level"], 2)

    def test_unused_radical_goes_to_last_level(self):
        result = build()
        self.assertEqual(result["unused_radicals"], ["r4"])
        self.assertEqual(result["radical"]["r4"], {"level": 60, "sort_order": 1})

    def test_override_moves_unused_radical(self):
        result = build(overrides={"radical": {"r4": 1}})
        self.assertEqual(in_level(result, "radical", 1), ["r1", "r2", "r4"])

    def test_authored_words_drive_kanji_before_derived_words(self):
        # k1 completes three derived words; k5 completes one authored word.
        words = [{"slug": "a1", "kanji": ["k5"], "authored": True}] + [
            {"slug": f"d{i}", "kanji": ["k1"], "authored": False} for i in range(3)
        ]
        reference = {jlpt: {"kanji": ["k1"], "vocabulary": ["a1"], "grammar": ["g1"]}
                     for jlpt in ("N5", "N4")}
        result = build(words=words, passages=[], reference=reference)
        self.assertEqual(in_level(result, "kanji", 1), ["k5", "k1"])

    def test_radicals_and_kanji_sort_by_strokes_ties_keep_order(self):
        result = build_with_strokes()
        self.assertEqual(in_level(result, "radical", 1), ["r2", "r1"])
        self.assertEqual(in_level(result, "kanji", 1), ["k3", "k1"])
        # k5 and k2 both have 4 strokes: pick order stays.
        self.assertEqual(in_level(result, "kanji", 2), ["k5", "k2"])

    def test_word_order_follows_last_kanji_position_in_level(self):
        # Level 2 kanji in order: k5, k2. w2 (k1 is level 1) and w6 (kana)
        # count as position 0; then frequency order.
        result = build_with_strokes(overrides={"vocabulary": {"w2": 2, "w6": 2, "w7": 2}})
        self.assertEqual(in_level(result, "vocabulary", 2), ["w2", "w6", "w1", "w7"])

    def test_levels_unchanged_by_stroke_sort(self):
        def levels(result):
            return {kind: {s: e["level"] for s, e in result[kind].items()}
                    for kind in ladder.KINDS}
        self.assertEqual(levels(build_with_strokes()), levels(build()))

    def test_word_waits_for_last_kanji(self):
        # Slot 1; kanji at levels 1 (k1) and 2 (k5).
        self.assertEqual(build()["vocabulary"]["w1"]["level"], 2)

    def test_word_waits_for_frequency_slot(self):
        # Kanji k1 at level 1; slot 3.
        self.assertEqual(build()["vocabulary"]["w2"]["level"], 3)

    def test_kana_only_word_uses_slot(self):
        self.assertEqual(build()["vocabulary"]["w6"]["level"], 13)

    def test_grammar_spread_in_teaching_order(self):
        levels = [build()["grammar"][g["slug"]]["level"] for g in GRAMMAR]
        self.assertEqual(levels, [1, 7, 14, 21])

    def test_passage_level_is_highest_word_or_grammar(self):
        self.assertEqual(build()["passage"]["p1"]["level"], 7)

    def test_override_wins_and_breach_is_reported(self):
        result = build(overrides={"vocabulary": {"w1": 1}})
        self.assertEqual(result["vocabulary"]["w1"]["level"], 1)
        self.assertEqual(len(result["breaches"]), 1)
        self.assertIn("w1", result["breaches"][0])
        self.assertIn("k5", result["breaches"][0])
        self.assertEqual(build()["breaches"], [])

    def test_kanji_override_takes_slot_ahead_of_greedy_pick(self):
        result = build(overrides={"kanji": {"k4": 1}})
        self.assertEqual(in_level(result, "kanji", 1), ["k4", "k1"])

    def test_every_level_has_a_kanji(self):
        sizes = ladder.KANJI_PER_LEVEL
        self.assertEqual(len(sizes), 60)
        self.assertTrue(all(n >= 1 for n in sizes))
        self.assertEqual(sizes[:3], [18, 24, 28])
        self.assertEqual(sizes[3:20], [30] * 17)

    def test_jlpt_equivalence_last_level_at_90_percent(self):
        # Ten kana-only words at slots 1, 3, 5 ... 19: 90% sit at or below 17.
        words = [{"slug": f"v{i}", "kanji": [], "authored": True} for i in range(10)]
        reference = {
            "N5": {"kanji": ["k1"], "vocabulary": [w["slug"] for w in words],
                   "grammar": ["g1"]},
            "N4": {"kanji": ["k2"], "vocabulary": ["v9"], "grammar": ["g3"]},
        }
        result = build(words=words, passages=[], reference=reference)
        self.assertEqual(result["jlpt_equivalence"], [
            {"jlpt": "N5", "first_level": 1, "last_level": 17},
            {"jlpt": "N4", "first_level": 18, "last_level": 19},
        ])


if __name__ == "__main__":
    unittest.main()
