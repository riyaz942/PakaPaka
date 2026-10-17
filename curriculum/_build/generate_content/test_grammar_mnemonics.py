# curriculum/_build/generate_content/test_grammar_mnemonics.py
# -*- coding: utf-8 -*-
"""Grammar mnemonics (docs/superpowers/specs/2026-10-17-grammar-mnemonics-design.md)."""
import os
import sys
import unittest

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BUILD_DIR)

from generate_content import mnemonic_context as mc  # noqa: E402


class OriginTableTest(unittest.TestCase):
    def test_checker_reports_missing_unknown_and_malformed_entries(self):
        table = {
            "review_status": "draft",
            "origins": {
                "teoku": {"word": "置く", "gloss": "to put down", "keywords": ["put"]},
                "wo": None,
                "zz-unknown": None,
                "ga": {"word": "", "gloss": "x", "keywords": []},
            },
        }
        errors = mc.origin_table_errors(table, ["teoku", "wo", "ga", "desu"])
        self.assertIn("grammar_origins.json has no entry for 'desu' (write an origin or null)", errors)
        self.assertIn("grammar_origins.json lists unknown slug 'zz-unknown'", errors)
        self.assertIn(
            "grammar_origins.json entry 'ga' needs a non-empty word, gloss and keywords list, or null",
            errors,
        )
        self.assertEqual(len(errors), 3)

    def test_checker_rejects_an_unknown_review_status(self):
        errors = mc.origin_table_errors({"review_status": "done", "origins": {}}, [])
        self.assertEqual(errors, ["grammar_origins.json review_status must be 'draft' or 'reviewed'"])

    def test_scope_is_the_161_n5_and_n4_points(self):
        slugs = mc.grammar_mnemonic_slugs()
        self.assertEqual(len(slugs), 161)
        self.assertEqual(len(set(slugs)), 161)

    def test_shipped_table_covers_exactly_the_scope(self):
        table = mc.load_grammar_origins()
        self.assertEqual(mc.origin_table_errors(table, mc.grammar_mnemonic_slugs()), [])


class GrammarContextTest(unittest.TestCase):
    TABLE = {
        "review_status": "reviewed",
        "origins": {"teoku": {"word": "置く", "gloss": "to put down", "keywords": ["put", "set"]},
                    "wa-topic": None},
    }

    def test_context_carries_the_point_and_its_origin(self):
        ctx = mc.grammar_context("n4", "teoku", self.TABLE)
        self.assertEqual(ctx["form"], "ておく")
        self.assertIn("ておく", ctx["accepted_forms"])
        self.assertEqual(ctx["origin"]["word"], "置く")
        self.assertTrue(ctx["lesson_opening"])
        self.assertNotIn("## ", ctx["lesson_opening"])
        self.assertIn("買う", ctx["allowed_index"])
        self.assertIn("買", ctx["allowed_kanji"])

    def test_null_origin_is_kept_as_none(self):
        self.assertIsNone(mc.grammar_context("n5", "wa-topic", self.TABLE)["origin"])

    def test_slug_without_a_table_entry_raises(self):
        with self.assertRaises(KeyError):
            mc.grammar_context("n5", "ga", self.TABLE)

    def test_missing_lesson_raises(self):
        with self.assertRaises(FileNotFoundError):
            mc.grammar_lesson_opening("zz-no-such-lesson")

    def test_origin_formatter_states_both_cases(self):
        self.assertIn("置く", mc.format_grammar_origin(self.TABLE["origins"]["teoku"]))
        self.assertIn("put, set", mc.format_grammar_origin(self.TABLE["origins"]["teoku"]))
        self.assertIn("no origin", mc.format_grammar_origin(None))

    def test_cast_formatter_lists_characters_once(self):
        # Jin has two readings in the cast bible; the block names him once.
        block = mc.format_grammar_cast()
        self.assertEqual(block.count("**Jin, the friendly giant**"), 1)


if __name__ == "__main__":
    unittest.main()
