# curriculum/_build/reports/test_mnemonic_gaps.py
# -*- coding: utf-8 -*-
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import mnemonic_gaps as gaps  # noqa: E402


def entry(level):
    return {"level": level, "sort_order": 1}


LADDER = {
    "radical": {"roof": entry(7), "temple": entry(1), "earth": entry(1)},
    "kanji": {"house": entry(8), "peace": entry(2), "whole": entry(2)},
    "vocabulary": {"anzen": entry(2), "ie": entry(8)},
}
RADICALS = [
    {"slug": "roof", "primary_form": "宀", "meaning": "roof", "accepted_answers": []},
    {"slug": "temple", "primary_form": "寺", "meaning": "temple", "accepted_answers": []},
    {"slug": "earth", "primary_form": "土", "meaning": "earth / ground",
     "accepted_answers": [{"answer_type": "meaning", "answer_text": "soil"}]},
]
KANJI = [
    {"slug": "peace", "primary_form": "安", "meaning": "cheap / peaceful", "accepted_answers": []},
    {"slug": "whole", "primary_form": "全", "meaning": "whole", "accepted_answers": []},
]
WORDS = [{"slug": "anzen", "primary_form": "安全"}, {"slug": "ie", "primary_form": "いえ"}]


class RadicalPartTest(unittest.TestCase):
    def test_part_taught_later_is_flagged(self):
        mnemonics = {"temple": {"mnemonic_text": 'Made of <part form="土">earth</part>.'}}
        self.assertEqual(gaps.radicals_with_later_part(LADDER, RADICALS, mnemonics), [])
        mnemonics = {"temple": {"mnemonic_text": 'Made of <part form="宀">roof</part>.'}}
        self.assertEqual(gaps.radicals_with_later_part(LADDER, RADICALS, mnemonics), ["temple"])

    def test_empty_entry_is_skipped(self):
        self.assertEqual(gaps.radicals_with_later_part(LADDER, RADICALS, {"temple": {}}), [])


class KanjiRadicalTest(unittest.TestCase):
    def check(self, text):
        return gaps.kanji_with_unknown_radical(
            LADDER, RADICALS, {"peace": {"meaning_mnemonic": text}})

    def test_radical_at_or_below_level_is_fine(self):
        self.assertEqual(self.check("A <radical>soil</radical> floor."), [])

    def test_radical_taught_later_is_flagged(self):
        self.assertEqual(self.check("A <radical>roof</radical> over it."), ["peace"])

    def test_name_nobody_uses_is_flagged(self):
        self.assertEqual(self.check("A <radical>slide</radical> over it."), ["peace"])

    def test_form_wins_over_the_name(self):
        self.assertEqual(self.check('A <radical form="土">dirt</radical> floor.'), [])
        self.assertEqual(self.check('A <radical form="宀">earth</radical> floor.'), ["peace"])


class VocabKanjiTest(unittest.TestCase):
    def check(self, text):
        return gaps.vocab_missing_kanji(
            LADDER, KANJI, WORDS, {"anzen": {"meaning_mnemonic": text}})

    def test_every_kanji_named(self):
        self.assertEqual(self.check("<kanji>Peaceful</kanji> and <kanji>whole</kanji>."), [])
        self.assertEqual(self.check('<kanji form="安">x</kanji> <kanji form="全">y</kanji>'), [])

    def test_one_kanji_missing(self):
        self.assertEqual(self.check("Only <kanji>whole</kanji> here."), ["anzen"])

    def test_no_kanji_named(self):
        self.assertEqual(self.check("A story with no kanji."), ["anzen"])

    def test_kana_only_word_is_skipped(self):
        found = gaps.vocab_missing_kanji(LADDER, KANJI, WORDS, {"ie": {"meaning_mnemonic": "x"}})
        self.assertEqual(found, [])


if __name__ == "__main__":
    unittest.main()
