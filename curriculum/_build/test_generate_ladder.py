# curriculum/_build/test_generate_ladder.py
# -*- coding: utf-8 -*-
import json
import os
import sys
import tempfile
import unittest
from unittest import mock

BUILD_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BUILD_DIR)

import generate  # noqa: E402
import generate_deps  # noqa: E402
import ladder  # noqa: E402

#: Three kanji over two levels; dataset order is not ladder order.
LADDER = {"kanji": {
    "a": {"level": 2, "sort_order": 1},
    "b": {"level": 1, "sort_order": 2},
    "c": {"level": 1, "sort_order": 1},
}}
ITEMS = [{"slug": "a", "primary_form": "日"}, {"slug": "b", "primary_form": "月"},
         {"slug": "c", "primary_form": "木"}]


class WriteItemsTest(unittest.TestCase):
    def write(self, items=ITEMS):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "items.json")
            entries = generate.ladder_entries(LADDER, "kanji", items)
            generate.write_items(path, "items", entries, items)
            with open(path, encoding="utf-8") as f:
                return json.load(f)

    def test_items_file_has_level_on_every_item(self):
        data = self.write()
        self.assertEqual(list(data), ["items"])
        self.assertEqual(len(data["items"]), 3)
        for item in data["items"]:
            self.assertIsInstance(item["level"], int)
            self.assertIsInstance(item["sort_order"], int)

    def test_sort_order_follows_level_then_ladder_order(self):
        items = self.write()["items"]
        self.assertEqual([(i["slug"], i["level"], i["sort_order"]) for i in items],
                         [("c", 1, 1), ("b", 1, 2), ("a", 2, 3)])

    def test_item_the_ladder_does_not_name_is_an_error(self):
        with self.assertRaises(ValueError) as raised:
            self.write(ITEMS + [{"slug": "d", "primary_form": "火"}])
        self.assertIn("d", str(raised.exception))

    def test_ladder_slug_with_no_item_is_an_error(self):
        with self.assertRaises(ValueError) as raised:
            self.write(ITEMS[:2])
        self.assertIn("c", str(raised.exception))


class KanjiWordEdgeTest(unittest.TestCase):
    RADICALS = [{"slug": "r-sun", "primary_form": "日", "level": 1}]
    KANJI = [{"slug": "hi", "primary_form": "日", "level": 1},
             {"slug": "tsuki", "primary_form": "月", "level": 2}]
    GRAMMAR = [{"slug": "g", "vocabulary_slugs": ["getsuyoubi"]}]

    def edges(self, word_level):
        vocab = [{"slug": "getsuyoubi", "primary_form": "月日", "level": word_level}]
        with mock.patch.object(generate_deps, "load_decomposition",
                               return_value={"日": ["日"]}):
            return generate_deps.build_edges(self.RADICALS, self.KANJI, vocab, self.GRAMMAR)

    def test_all_kanji_word_edges_are_requires(self):
        edges = self.edges(word_level=2)
        kanji_word = [(e["from_slug"], e["relationship_type"]) for e in edges
                      if e["from_type"] == "kanji"]
        self.assertEqual(kanji_word, [("hi", "requires"), ("tsuki", "requires")])
        self.assertIn(("r-sun", "builds_on"), [(e["from_slug"], e["relationship_type"])
                                              for e in edges if e["from_type"] == "radical"])
        self.assertIn(("g", "reinforces"), [(e["from_slug"], e["relationship_type"])
                                            for e in edges if e["from_type"] == "grammar"])

    def test_kanji_at_a_later_level_than_its_word_is_an_error(self):
        with self.assertRaises(ValueError) as raised:
            self.edges(word_level=1)
        self.assertIn("tsuki", str(raised.exception))


class WordOrderTest(unittest.TestCase):
    def test_ladder_and_generate_give_the_same_word_order(self):
        # ladder.load_words duplicates generate._vocab_sources (controller
        # ruling): the ladder's frequency order must be the order generate uses.
        from_ladder = [w["slug"] for w in ladder.load_words([])]
        from_generate = [v["slug"] for _, entries in generate._vocab_sources() for v in entries]
        self.assertEqual(from_ladder, from_generate)


if __name__ == "__main__":
    unittest.main()
