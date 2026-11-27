# curriculum/_build/generate_content/test_generate_pool.py
# -*- coding: utf-8 -*-
import json
import os
import sys
import argparse
import contextlib
import io
import tempfile
import unittest
from unittest import mock

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
        self.assertEqual(len(slugs), 14)


class SelectFailingTest(unittest.TestCase):
    RESULTS = {1: {"a": [], "b": ["rule 4: 3 passing sentences, need 8"]},
               2: {"c": ["rule 3: out of range ['x']"], "d": ["rule 4: 0 passing sentences"]},
               21: {"e": ["rule 4: 0 passing sentences"]}}

    def select(self, levels=None):
        args = argparse.Namespace(failing=True, levels=levels, limit=4)
        out = io.StringIO()
        with mock.patch.object(gp.pool_check, "check_level", lambda level: self.RESULTS[level]), \
                mock.patch.object(gp.context, "load_grammar",
                                  lambda: [{"level": n} for n in self.RESULTS]), \
                contextlib.redirect_stdout(out):
            gp.cmd_select(args)
        return out.getvalue().splitlines()[1]

    def test_lists_the_points_check_grammar_pool_fails(self):
        self.assertEqual(self.select(), "b,c,d,e")

    def test_levels_and_limit_narrow_the_list(self):
        self.assertEqual(self.select(levels=[1, 2]), "b,c,d")
        args = argparse.Namespace(failing=True, levels=[1, 2], limit=2)
        with mock.patch.object(gp.pool_check, "check_level", lambda level: self.RESULTS[level]), \
                contextlib.redirect_stdout(io.StringIO()) as out:
            gp.cmd_select(args)
        self.assertEqual(out.getvalue().splitlines()[1], "b,c")

    def test_no_flag_and_no_level_is_an_error(self):
        with self.assertRaises(SystemExit):
            gp.cmd_select(argparse.Namespace(failing=False, levels=None, limit=4))

    def test_failing_list_is_the_gate_function_not_a_copy(self):
        with mock.patch.object(gp.pool_check, "failing_slugs", return_value=["z"]) as failing:
            args = argparse.Namespace(failing=True, levels=[3], limit=4)
            with contextlib.redirect_stdout(io.StringIO()) as out:
                gp.cmd_select(args)
        failing.assert_called_once_with([3])
        self.assertEqual(out.getvalue().splitlines()[1], "z")


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
