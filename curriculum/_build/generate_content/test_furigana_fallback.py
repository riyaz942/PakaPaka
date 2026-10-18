# curriculum/_build/generate_content/test_furigana_fallback.py
# -*- coding: utf-8 -*-
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import furigana  # noqa: E402


class FallbackAlignmentTest(unittest.TestCase):
    """Tokens JmdictFurigana has no line for: the reading must land on the
    kanji it belongs to, never over kana inside the token."""

    def test_kana_inside_a_compound_verb_splits_the_reading(self):
        self.assertEqual(
            furigana._fallback_annotate_token("召し上がり", "めしあがり"),
            "召[め]し上[あ]がり",
        )
        self.assertEqual(
            furigana._fallback_annotate_token("話し合っ", "はなしあっ"),
            "話[はな]し合[あ]っ",
        )

    def test_particle_inside_one_token_splits_the_reading(self):
        self.assertEqual(
            furigana._fallback_annotate_token("池の上", "いけのうえ"),
            "池[いけ]の上[うえ]",
        )

    def test_punctuation_inside_a_token_uses_dictionary_readings(self):
        self.assertEqual(
            furigana._fallback_annotate_token("二、三", "にさん"),
            "二[に]、三[さん]",
        )
        self.assertEqual(
            furigana._fallback_annotate_token("八、九", "はちきゅう"),
            "八[はち]、九[きゅう]",
        )

    def test_trailing_okurigana_is_unchanged(self):
        self.assertEqual(
            furigana._fallback_annotate_token("書き", "かき"), "書[か]き")

    def test_unalignable_token_is_left_bare(self):
        self.assertEqual(
            furigana._fallback_annotate_token("召し上がり", "めしあがる"),
            "召し上がり",
        )

    def test_whole_sentence_covers_every_kanji(self):
        self.assertEqual(
            furigana.annotate_sentence("一、二、三、四と書きます。"),
            "一[いち]、二[に]、三[さん]、四[よん]と書[か]きます。",
        )
        self.assertEqual(
            furigana.annotate_sentence("どうぞ、ゆっくり召し上がってください。"),
            "どうぞ、ゆっくり召[め]し上[あ]がってください。",
        )


if __name__ == "__main__":
    unittest.main()
