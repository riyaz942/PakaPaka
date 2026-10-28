# curriculum/_build/import/test_transitivity_pairs.py
# -*- coding: utf-8 -*-
import os
import sys
import unittest
from unittest import mock

IMPORT_DIR = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR = os.path.dirname(IMPORT_DIR)
for path in (IMPORT_DIR, BUILD_DIR):
    sys.path.insert(0, path)

import find_transitivity_pairs as ftp  # noqa: E402
import generate  # noqa: E402

WORD_TYPES = {
    "akeru": ["ichidan verb", "transitive verb"],
    "aku": ["godan verb", "intransitive verb"],
    "taberu": ["ichidan verb", "transitive verb"],
}
FORMS = {"akeru": "開ける", "aku": "開く", "taberu": "食べる"}


class CandidatesTest(unittest.TestCase):
    def test_candidates_pair_akeru_and_aku(self):
        self.assertEqual(ftp.candidates(WORD_TYPES, FORMS, {}), [("akeru", "aku")])

    def test_candidates_skip_known_pairs(self):
        known = {"akeru": "aku", "aku": "akeru"}
        self.assertEqual(ftp.candidates(WORD_TYPES, FORMS, known), [])

    def test_candidates_skip_known_in_reverse_only(self):
        self.assertEqual(ftp.candidates(WORD_TYPES, FORMS, {"aku": "akeru"}), [])

    def test_candidates_skip_rejected_pairs(self):
        self.assertEqual(ftp.candidates(WORD_TYPES, FORMS, {}, {("akeru", "aku")}), [])


class VocabLevelTest(unittest.TestCase):
    def test_vocab_item_carries_transitivity_partner(self):
        entries = [
            {"slug": "x-akeru", "form": "開ける", "reading": "あける", "meaning": "to open"},
            {"slug": "x-aku", "form": "開く", "reading": "あく", "meaning": "to be open"},
        ]
        with mock.patch.object(generate, "_load_vocab_transitivity_pairs",
                               return_value={"x-akeru": "x-aku", "x-aku": "x-akeru"}):
            level = generate._build_vocab_level("N5", entries)
        self.assertEqual([i.get("transitivity_partner") for i in level["items"]], ["x-aku", "x-akeru"])


if __name__ == "__main__":
    unittest.main()
