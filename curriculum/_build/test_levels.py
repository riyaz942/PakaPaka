# curriculum/_build/test_levels.py
# -*- coding: utf-8 -*-
import json
import os
import sys
import tempfile
import unittest
from unittest import mock

BUILD_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BUILD_DIR)

import levels  # noqa: E402


class LevelsTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.dir.cleanup)

    def write(self, name, data):
        path = os.path.join(self.dir.name, name)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f)
        return path

    def overrides(self, data, kind="kanji"):
        with mock.patch.object(levels, "LEVELS_PATH", self.write("levels.json", data)):
            return levels.load_overrides(kind)

    def test_override_int_level_loads(self):
        self.assertEqual(self.overrides({"kanji:one": 3}), {"one": 3})

    def test_override_rejects_string_level(self):
        with self.assertRaises(ValueError):
            self.overrides({"kanji:one": "n5"})

    def test_override_rejects_level_61(self):
        with self.assertRaises(ValueError):
            self.overrides({"kanji:one": 61})

    def test_override_rejects_level_0(self):
        with self.assertRaises(ValueError):
            self.overrides({"kanji:one": 0})

    def test_slugs_at_or_below_keeps_sort_order(self):
        ladder = {
            "vocabulary": {
                "b": {"level": 1, "sort_order": 2},
                "a": {"level": 1, "sort_order": 1},
                "c": {"level": 2, "sort_order": 1},
            }
        }
        with mock.patch.object(levels, "LADDER_PATH", self.write("ladder.json", ladder)):
            self.assertEqual(levels.slugs_at_or_below("vocabulary", 1), ["a", "b"])


if __name__ == "__main__":
    unittest.main()
