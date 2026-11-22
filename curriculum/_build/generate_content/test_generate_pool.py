# curriculum/_build/generate_content/test_generate_pool.py
# -*- coding: utf-8 -*-
import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from generate_content import generate_pool as gp  # noqa: E402

REPLY = {
    "accepted_meanings": ["because", "since", "so"],
    "sentences": [
        {"japanese": "寒いから、コートを着ます。", "english": "x",
         "vocabulary_slugs": ["samui"], "alternates": [{"japanese": "寒いですから。", "kind": "valid"}]},
    ],
}


class ReplyShapeTest(unittest.TestCase):
    def test_good_reply(self):
        self.assertEqual(gp.reply_errors(REPLY), [])

    def test_missing_fields_and_bad_kind(self):
        bad = {"accepted_meanings": "because",
               "sentences": [{"japanese": "寒い。", "english": "x"},
                             {"japanese": "寒い。", "english": "x", "vocabulary_slugs": [],
                              "alternates": [{"japanese": "寒い", "kind": "maybe"}]}]}
        errors = gp.reply_errors(bad)
        self.assertTrue(any("accepted_meanings" in e for e in errors))
        self.assertTrue(any("sentences[0]" in e and "vocabulary_slugs" in e for e in errors))
        self.assertTrue(any("sentences[1]" in e and "kind" in e for e in errors))


    def test_non_object_sentence_and_alternate_are_errors_not_crashes(self):
        bad = {"accepted_meanings": ["a", "b", "c"],
               "sentences": ["寒い。",
                             {"japanese": "寒い。", "english": "x", "vocabulary_slugs": [],
                              "alternates": ["寒いです。", {"japanese": "寒い", "kind": "valid"}]}]}
        errors = gp.reply_errors(bad)
        self.assertTrue(any("sentences[0]" in e and "object" in e for e in errors))
        self.assertTrue(any("sentences[1].alternates[0]" in e and "object" in e for e in errors))


    def test_null_alternates_and_nested_slugs_are_errors_not_crashes(self):
        bad = {"accepted_meanings": ["a", "b", "c"],
               "sentences": [{"japanese": "寒い。", "english": "x",
                              "vocabulary_slugs": ["samui"], "alternates": None},
                             {"japanese": "寒い。", "english": "x",
                              "vocabulary_slugs": [["samui"]]},
                             {"japanese": "寒い。", "english": "x",
                              "vocabulary_slugs": ["samui"], "alternates": "寒いです。"}]}
        errors = gp.reply_errors(bad)
        self.assertTrue(any("sentences[0]" in e and "alternates" in e for e in errors))
        self.assertTrue(any("sentences[1]" in e and "vocabulary_slugs" in e for e in errors))
        self.assertTrue(any("sentences[2]" in e and "alternates" in e for e in errors))

    def test_bracket_furigana_in_sentence_is_an_error(self):
        # Furigana is derived; a bracket in the sentence would show to the
        # learner and drop the kana path of the Build answer.
        bad = {"accepted_meanings": ["a", "b", "c"],
               "sentences": [{"japanese": "寒[さむ]いです。", "english": "x",
                              "vocabulary_slugs": ["samui"]}]}
        errors = gp.reply_errors(bad)
        self.assertTrue(any("sentences[0]" in e and "plain Japanese" in e for e in errors))


class SelectTest(unittest.TestCase):
    def test_skips_sidecar_points_in_sort_order(self):
        slugs = gp.select_slugs([1], 3, sidecar={"wa-topic": {}})
        self.assertEqual(slugs, ["desu", "dewa-arimasen", "conjugation-primer"])

    def test_takes_a_range_of_levels(self):
        slugs = gp.select_slugs([1, 2], 20, sidecar={})
        self.assertEqual(slugs[-1], "no-nominalizer")
        self.assertEqual(len(slugs), 13)


class SidecarTest(unittest.TestCase):
    def test_merge_keeps_other_entries(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "pool.json")
            with open(path, "w", encoding="utf-8") as f:
                json.dump({"other": {"accepted_meanings": ["x"]}}, f)
            gp.merge_into_sidecar(path, "kara-because", REPLY, "claude-test")
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
        self.assertEqual(set(data), {"other", "kara-because"})
        self.assertEqual(data["kara-because"]["_meta"],
                         {"generator_model": "claude-test", "prompt_version": "1",
                          "review_status": "draft"})


if __name__ == "__main__":
    unittest.main()
