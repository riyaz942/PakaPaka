# curriculum/_build/reports/test_ladder_report.py
# -*- coding: utf-8 -*-
import json
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
        "grammar_pool_failing": [],
        "grammar_mnemonics_above": {},
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

    def test_grammar_pool_and_mnemonic_breaks_count_their_slugs(self):
        breaks = ladder_report.content_breaks(LADDER, sidecars(
            grammar_pool_failing=["g1", "g2"],
            grammar_mnemonics_above={"g2": ["w3 (w3)"]},
        ))
        self.assertEqual(breaks["grammar_points_failing_pool"], 2)
        self.assertEqual(breaks["grammar_mnemonics_above_level"], 1)

    def test_levels_2_to_20_with_fewer_than_3_passages_count(self):
        ladder = dict(LADDER, passage={f"p{i}": entry(2) for i in range(3)})
        ladder["passage"]["q"] = entry(3)
        # Level 2 has 3 passages; level 3 has 1; levels 4-20 have none.
        self.assertEqual(ladder_report.short_levels(ladder)[0], (3, 2))
        self.assertEqual(len(ladder_report.short_levels(ladder)), 18)
        self.assertEqual(ladder_report.content_breaks(ladder, sidecars())["reading_levels_short"], 18)


class WorklistTest(unittest.TestCase):
    #: Areas whose count is a count of slugs in the report too.
    SAME_COUNT = {
        "radical_mnemonics": "radicals_1_20_without_mnemonic",
        "kanji_mnemonics": "kanji_1_20_without_mnemonic",
        "grammar_pool_points": "grammar_points_failing_pool",
        "grammar_links_above_level": "grammar_points_linked_above_level",
        "grammar_mnemonics_above_level": "grammar_mnemonics_above_level",
        "reading_passages": "reading_levels_short",
        "vocab_mnemonics_pending": "vocab_mnemonics_without_kanji",
    }

    def data(self):
        return sidecars(
            grammar_pool_failing=["g1", "g2"],
            grammar_links={"g1": ["w1", "w2"], "g2": ["w2"]},
            grammar_mnemonics_above={"g1": ["w2 (w2)"]},
            vocab_examples={"w1": {"example_sentences": [sentence("w2"), sentence("w3")]}},
            vocab_mnemonics={"w1": {}},
            regen_vocab_mnemonics={"pending": ["w1"], "done": []},
        )

    def test_counts_equal_the_report_counts(self):
        work = ladder_report.worklist(LADDER, self.data())
        breaks = ladder_report.content_breaks(LADDER, self.data())
        for area, key in self.SAME_COUNT.items():
            self.assertEqual(len(work[area]), breaks[key], area)
        self.assertEqual(set(work), set(self.SAME_COUNT) | {"vocab_examples_above_level"})

    def test_lists_hold_slugs_once_and_the_passage_gap(self):
        work = ladder_report.worklist(LADDER, self.data())
        self.assertEqual(work["radical_mnemonics"], ["r1"])
        self.assertEqual(work["kanji_mnemonics"], ["k1", "k20"])
        self.assertEqual(work["grammar_pool_points"], ["g1", "g2"])
        self.assertEqual(work["grammar_links_above_level"], ["g1"])
        self.assertEqual(work["grammar_mnemonics_above_level"], ["g1"])
        self.assertEqual(work["vocab_examples_above_level"], ["w1"])  # two sentences, one word
        self.assertEqual(work["vocab_mnemonics_pending"], ["w1"])
        self.assertEqual(work["reading_passages"][0], {"level": 2, "missing": 3})

    def test_report_prints_each_worklist_count(self):
        data = self.data()
        ladder = dict(LADDER, jlpt_equivalence=[], breaches=[], unused_radicals=[])
        text = ladder_report.render(ladder, data, NAMES)
        for area, slugs in ladder_report.worklist(ladder, data).items():
            self.assertIn(f"| `{area}` | {len(slugs)} |", text)

    def test_checked_in_worklist_has_the_keys_the_code_writes(self):
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ladder-worklist.json")
        with open(path, encoding="utf-8") as f:
            self.assertEqual(set(json.load(f)), set(ladder_report.WORKLIST))

    def test_worklist_keeps_every_slug_not_ten(self):
        ladder = dict(LADDER, kanji={f"k{i}": entry(1) for i in range(25)})
        work = ladder_report.worklist(ladder, sidecars())
        self.assertEqual(len(work["kanji_mnemonics"]), 25)


NAMES = {("radical", "r1"): ("r", "r"), ("kanji", "k1"): ("k", "k")}


if __name__ == "__main__":
    unittest.main()
