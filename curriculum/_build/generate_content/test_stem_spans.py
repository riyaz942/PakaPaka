# curriculum/_build/generate_content/test_stem_spans.py
# -*- coding: utf-8 -*-
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from generate_content import spans  # noqa: E402


class StemSpanTest(unittest.TestCase):
    def test_masu_stem_before_mashou(self):
        self.assertEqual(
            spans.build_stem_spans("一緒に行きましょう。", {"iku-v": "行く"}),
            [{"vocabulary_slug": "iku-v", "start": 3, "end": 5,
              "surface_form": "行き", "inflection": "stem"}],
        )

    def test_adjective_adverb_form(self):
        result = spans.build_stem_spans("早く起きます。", {"hayai": "早い"})
        self.assertEqual(result[0]["surface_form"], "早く")
        self.assertEqual((result[0]["start"], result[0]["end"]), (0, 2))

    def test_dictionary_form_is_not_a_stem(self):
        self.assertEqual(spans.build_stem_spans("行く前に", {"iku-v": "行く"}), [])

    def test_unlinked_word_gets_nothing(self):
        self.assertEqual(spans.build_stem_spans("行きましょう。", {"taberu": "食べる"}), [])

    def test_existing_spans_win_on_merge(self):
        text = "行きます。"
        forms = {"iku-v": "行く"}
        merged = spans.merge_spans(spans.derive_spans(text, forms),
                                   spans.build_stem_spans(text, forms))
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["inflection"], "masu")


if __name__ == "__main__":
    unittest.main()
