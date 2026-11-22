# curriculum/_build/reports/test_ladder_report.py
# -*- coding: utf-8 -*-
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import ladder_report  # noqa: E402


def entry(level):
    return {"level": level, "sort_order": 1}


LADDER = {
    "radical": {"r1": entry(1), "r21": entry(21)},
    "kanji": {"k1": entry(1), "k20": entry(20), "k21": entry(21)},
    "vocabulary": {"w1": entry(1), "w2": entry(2), "w3": entry(3)},
    "grammar": {"g1": entry(1), "g2": entry(2)},
    "passage": {"p1": entry(20), "p2": entry(21)},
}


def sidecars(**overrides):
    base = {
        "grammar_pool": {},
        "grammar_links": {},
        "vocab_examples": {},
        "vocab_mnemonics": {},
        "kanji_mnemonics": {},
        "radical_mnemonics": {},
        "grammar_mnemonics": {},
        "regen_vocab_mnemonics": {"pending": [], "done": []},
    }
    base.update(overrides)
    return base


def sentence(*slugs):
    return {"japanese": "", "vocabulary_slugs": list(slugs)}


class ContentBreaksTest(unittest.TestCase):
    def test_sentence_with_later_word_counts(self):
        breaks = ladder_report.content_breaks(LADDER, sidecars(
            grammar_pool={"g2": {"sentences": [sentence("w1", "w2"), sentence("w1", "w3")]}},
            vocab_examples={"w1": {"example_sentences": [sentence("w1"), sentence("w1", "w2")]},
                            "w2": {"example_sentences": [sentence("w1", "w2")]}},
        ))
        self.assertEqual(breaks["grammar_sentences_above_level"], 1)
        self.assertEqual(breaks["vocab_sentences_above_level"], 1)

    def test_point_with_one_readable_example_counts(self):
        breaks = ladder_report.content_breaks(LADDER, sidecars(grammar_pool={
            "g1": {"sentences": [sentence("w1"), sentence("w2"), sentence("w3")]},
            "g2": {"sentences": [sentence("w1"), sentence("w2")]},
        }))
        self.assertEqual(breaks["grammar_points_under_2_readable"], 1)

    def test_kanji_without_mnemonic_only_counts_levels_1_to_20(self):
        breaks = ladder_report.content_breaks(LADDER, sidecars(kanji_mnemonics={"k1": {"m": "x"}}))
        self.assertEqual(breaks["kanji_1_20_without_mnemonic"], 1)
        self.assertEqual(breaks["radicals_1_20_without_mnemonic"], 1)

    def test_empty_sidecar_entry_counts_as_no_mnemonic(self):
        """The radical sidecar holds `{}` placeholders for radicals with no mnemonic yet."""
        breaks = ladder_report.content_breaks(LADDER, sidecars(
            kanji_mnemonics={"k1": {}},
            radical_mnemonics={"r1": {}},
        ))
        self.assertEqual(breaks["kanji_1_20_without_mnemonic"], 2)  # k1 empty, k20 absent (k21 is out of range)
        self.assertEqual(breaks["radicals_1_20_without_mnemonic"], 1)  # r1 empty (r21 is out of range)

    def test_other_breaks(self):
        breaks = ladder_report.content_breaks(LADDER, sidecars(
            grammar_links={"g1": ["w1", "w2"], "g2": ["w2"]},
            vocab_mnemonics={"w1": {}, "w2": {}},
            regen_vocab_mnemonics={"pending": ["w1", "w3"], "done": ["w2"]},
        ))
        self.assertEqual(breaks["grammar_points_linked_above_level"], 1)
        self.assertEqual(breaks["vocab_mnemonics_without_kanji"], 1)
        self.assertEqual(breaks["passages_above_target"], 1)
        self.assertEqual(set(breaks), set(ladder_report.BREAKS))


if __name__ == "__main__":
    unittest.main()
