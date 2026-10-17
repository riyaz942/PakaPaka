# curriculum/_build/generate_content/test_reading_link.py
# -*- coding: utf-8 -*-
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from generate_content import reading_link as rl  # noqa: E402

# Real slugs from the shipped level files; the sidecars are fabricated so the
# tests do not depend on the prose stored today.
#   polish (研, N4 kanji, けん → Ken), protect (N3 kanji), abunai (危ない, N5
#   vocab, story reading), watashitachi (reading taught by watashi), boku (N5).
REVIEWED = {"generator_model": "m", "prompt_version": "4", "review_status": "reviewed"}
DRAFT = {"generator_model": "m", "prompt_version": "4", "review_status": "draft"}


def sidecars():
    return {
        "kanji": {
            "polish": {"meaning_mnemonic": "M polish", "reading_mnemonic": "R polish",
                       "_meta": dict(REVIEWED)},
            "special": {"meaning_mnemonic": "M special", "reading_mnemonic": "R special",
                        "_meta": dict(DRAFT)},
            "protect": {"meaning_mnemonic": "M protect", "reading_mnemonic": "R protect",
                        "_meta": dict(REVIEWED)},
        },
        "vocab": {
            "abunai": {"meaning_mnemonic": "M abunai", "reading_mnemonic": "R abunai",
                       "_meta": dict(REVIEWED)},
            "watashitachi": {"meaning_mnemonic": "M w", "reading_mnemonic": "R w",
                             "_meta": dict(REVIEWED)},
            "boku": {"meaning_mnemonic": "M boku", "_meta": dict(REVIEWED)},
        },
    }


class SelectTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cands = rl.select_candidates(sidecars())
        cls.keys = {(c["kind"], c["slug"]) for c in cls.cands}

    def test_reviewed_n5_n4_kanji_is_selected(self):
        self.assertIn(("kanji", "polish"), self.keys)

    def test_draft_kanji_is_skipped(self):
        self.assertNotIn(("kanji", "special"), self.keys)

    def test_n3_kanji_is_skipped(self):
        self.assertNotIn(("kanji", "protect"), self.keys)

    def test_story_vocab_is_selected(self):
        self.assertIn(("vocab", "abunai"), self.keys)

    def test_pointer_vocab_is_skipped(self):
        self.assertNotIn(("vocab", "watashitachi"), self.keys)

    def test_vocab_without_reading_is_skipped(self):
        self.assertNotIn(("vocab", "boku"), self.keys)

    def test_candidate_fields(self):
        polish = next(c for c in self.cands if c["slug"] == "polish")
        self.assertEqual(polish["level"], "n4")
        self.assertEqual(polish["form"], "研")
        self.assertEqual(polish["reading"], "けん")
        self.assertIn("けん: Ken, the sword-collecting dog", polish["cast"])
        self.assertEqual(polish["meaning_mnemonic"], "M polish")
        self.assertEqual(polish["reading_mnemonic"], "R polish")
        abunai = next(c for c in self.cands if c["slug"] == "abunai")
        self.assertEqual((abunai["form"], abunai["reading"], abunai["meaning"]),
                         ("危ない", "あぶない", "dangerous"))


CANDS = [{"kind": "kanji", "slug": "polish"}, {"kind": "kanji", "slug": "happiness"},
         {"kind": "vocab", "slug": "abunai"}]


def good_list():
    return {
        "marked": [{"kind": "kanji", "slug": "happiness",
                    "reason": "shop intercom scene; meaning scene is a sprouting stalk"}],
        "kept": [{"kind": "kanji", "slug": "polish"}, {"kind": "vocab", "slug": "abunai"}],
        "stats": {"total": 3, "marked": 1, "kept": 2},
    }


class ListErrorsTest(unittest.TestCase):
    def test_good_list(self):
        self.assertEqual(rl.list_errors(CANDS, good_list()), [])

    def test_missing_and_duplicate_rows(self):
        listing = good_list()
        listing["kept"] = [{"kind": "kanji", "slug": "polish"},
                           {"kind": "kanji", "slug": "happiness"}]
        errors = rl.list_errors(CANDS, listing)
        self.assertTrue(any("kanji/happiness appears twice" in e for e in errors), errors)
        self.assertTrue(any("vocab/abunai is in neither" in e for e in errors), errors)

    def test_unknown_row(self):
        listing = good_list()
        listing["kept"].append({"kind": "kanji", "slug": "nope"})
        listing["stats"]["kept"] = 3
        self.assertTrue(any("kanji/nope is not a candidate" in e
                            for e in rl.list_errors(CANDS, listing)))

    def test_reason_rules(self):
        listing = good_list()
        listing["marked"][0]["reason"] = " ".join(["word"] * 13)
        self.assertTrue(any("13 words" in e for e in rl.list_errors(CANDS, listing)))
        listing["marked"][0]["reason"] = ""
        self.assertTrue(any("no reason" in e for e in rl.list_errors(CANDS, listing)))

    def test_stats_must_match(self):
        listing = good_list()
        listing["stats"] = {"total": 4, "marked": 2, "kept": 2}
        errors = rl.list_errors(CANDS, listing)
        self.assertTrue(any("stats.total" in e for e in errors), errors)
        self.assertTrue(any("stats.marked" in e for e in errors), errors)


if __name__ == "__main__":
    unittest.main()
