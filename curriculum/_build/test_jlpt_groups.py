# curriculum/_build/test_jlpt_groups.py
# -*- coding: utf-8 -*-
import json
import os
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

BUILD_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_DIR = os.path.dirname(os.path.dirname(BUILD_DIR))
sys.path.insert(0, BUILD_DIR)

import jlpt_groups  # noqa: E402

#: The last commit with the per-JLPT files; the bridge must give what they held.
BASE = "0228e3ef"


def old_file(kind, level):
    """`curriculum/<kind>/<level>.json` at BASE, or None when it did not exist."""
    path = f"curriculum/{kind}/{level}.json"
    listed = subprocess.run(["git", "ls-tree", "--name-only", BASE, path], cwd=REPO_DIR,
                            capture_output=True, text=True, check=True).stdout.strip()
    if not listed:
        return None
    shown = subprocess.run(["git", "show", f"{BASE}:{path}"], cwd=REPO_DIR,
                           capture_output=True, text=True, check=True)
    return json.loads(shown.stdout)


class OldFilesTest(unittest.TestCase):
    def test_bridge_gives_the_old_slugs_and_sort_order(self):
        for kind in ("radicals", "kanji", "vocabulary", "grammar", "readings"):
            key = "passages" if kind == "readings" else "items"
            for level in jlpt_groups.JLPT_LEVELS:
                with self.subTest(kind=kind, level=level):
                    old = old_file(kind, level)
                    new = jlpt_groups.load_items(kind, level)
                    if old is None:
                        self.assertEqual(new, [])
                        continue
                    self.assertEqual([i["slug"] for i in new], [i["slug"] for i in old[key]])
                    self.assertEqual([i["sort_order"] for i in new],
                                     [i["sort_order"] for i in old[key]])


class MissingItemTest(unittest.TestCase):
    def test_snapshot_slug_missing_from_items_is_an_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            os.makedirs(os.path.join(tmp, "kanji"))
            with open(os.path.join(tmp, "kanji", "items.json"), "w", encoding="utf-8") as f:
                json.dump({"items": [{"slug": "a", "sort_order": 1}]}, f)
            groups = os.path.join(tmp, "groups.json")
            with open(groups, "w", encoding="utf-8") as f:
                json.dump({"kanji": {"n5": ["a", "b"]}}, f)
            with mock.patch.object(jlpt_groups, "CURRICULUM_DIR", tmp), \
                    mock.patch.object(jlpt_groups, "GROUPS_PATH", groups):
                with self.assertRaises(ValueError) as raised:
                    jlpt_groups.load_items("kanji", "n5")
        self.assertIn("b", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
