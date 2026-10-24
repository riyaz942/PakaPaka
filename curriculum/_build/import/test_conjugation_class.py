# curriculum/_build/import/test_conjugation_class.py
# -*- coding: utf-8 -*-
import json
import os
import re
import sys
import unittest

IMPORT_DIR = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR = os.path.dirname(IMPORT_DIR)
REPO_DIR = os.path.dirname(os.path.dirname(BUILD_DIR))
for path in (IMPORT_DIR, BUILD_DIR):
    sys.path.insert(0, path)

import build_vocab_word_types as bvwt  # noqa: E402


class ConjugationClassTest(unittest.TestCase):
    def test_godan_ru(self):
        self.assertEqual(
            bvwt.conjugation_class(["Godan verb with 'ru' ending", "transitive verb"], False), "godan")

    def test_special_classes(self):
        cc = bvwt.conjugation_class
        self.assertEqual(cc(["Godan verb - Iku/Yuku special class"], False), "godan-iku")
        self.assertEqual(cc(["Godan verb - -aru special class"], False), "godan-honorific")
        self.assertEqual(cc(["Godan verb with 'ru' ending (irregular verb)"], False), "godan-ru-irregular")
        self.assertEqual(cc(["Godan verb with 'u' ending (special class)"], False), "godan-u-special")
        self.assertEqual(cc(["Kuru verb - special class"], False), "kuru")
        self.assertEqual(cc(["suru verb - included"], False), "suru")
        self.assertEqual(cc(["Ichidan verb - kureru special class"], False), "ichidan")
        self.assertEqual(cc(["adjective (keiyoushi)"], False), "adj-i")
        self.assertEqual(cc(["adjectival nouns or quasi-adjectives (keiyodoshi)"], False), "adj-na")

    def test_adj_ii(self):
        self.assertEqual(
            bvwt.conjugation_class(["adjective (keiyoushi) - yoi/ii class"], False), "adj-ii")

    def test_suru_compound(self):
        self.assertEqual(bvwt.conjugation_class(["noun (common) (futsuumeishi)"], True), "suru")

    def test_unsupported_classes_get_none(self):
        cc = bvwt.conjugation_class
        self.assertIsNone(cc(["Ichidan verb - zuru verb (alternative form of -jiru verbs)"], False))
        self.assertIsNone(cc(["suru verb - special class"], False))
        self.assertIsNone(cc(["noun (common) (futsuumeishi)"], False))

    def test_more_than_one_class_gets_none(self):
        self.assertIsNone(bvwt.conjugation_class(["Ichidan verb", "Godan verb with 'ru' ending"], False))

    def test_class_strings_match_the_typescript_conjugator(self):
        path = os.path.join(REPO_DIR, "mobile", "src", "core", "content", "conjugation.ts")
        with open(path, encoding="utf-8") as f:
            src = f.read()
        block = re.search(r"CONJUGATION_CLASSES = \[(.*?)\] as const", src, re.S).group(1)
        ts_classes = set(re.findall(r"'([^']+)'", block))
        self.assertEqual(set(bvwt.CONJUGATION_CLASSES), ts_classes)
        self.assertEqual(len(bvwt.CONJUGATION_CLASSES), 11)


class GeneratedMapTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(os.path.join(BUILD_DIR, "vocab_conjugation_classes.json"), encoding="utf-8") as f:
            cls.classes = json.load(f)

    def test_known_words_after_overrides(self):
        expected = {
            "ii": "adj-ii", "shiru": "godan", "taberu": "ichidan", "iku-v": "godan-iku",
            "aru": "godan-ru-irregular", "irassharu": "godan-honorific", "kuru-v": "kuru",
            "suru": "suru", "kirei": "adj-na", "takai-adj": "adj-i", "nomu-v": "godan",
        }
        for slug, cls in expected.items():
            self.assertEqual(self.classes.get(slug), cls, slug)

    def test_overridden_to_none_are_absent(self):
        self.assertNotIn("takusan", self.classes)
        self.assertNotIn("taitei", self.classes)

    def test_every_value_is_a_known_class(self):
        self.assertLessEqual(set(self.classes.values()), set(bvwt.CONJUGATION_CLASSES))


if __name__ == "__main__":
    unittest.main()
