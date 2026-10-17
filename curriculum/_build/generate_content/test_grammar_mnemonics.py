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


if __name__ == "__main__":
    unittest.main()
