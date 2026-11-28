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

    def test_stem_equal_to_the_whole_token_is_still_a_stem(self):
        # 食べ, 見, 来, 寒 are the entire token: the stem is the form itself.
        cases = [
            ("一緒に食べましょう。", {"taberu": "食べる"}, "食べ", 3, 5),
            ("映画を見ましょう。", {"miru": "見る"}, "見", 3, 4),
            ("また来ましょう。", {"kuru": "来る"}, "来", 2, 3),
            ("寒そうです。", {"samui": "寒い"}, "寒", 0, 1),
            ("高すぎます。", {"takai": "高い"}, "高", 0, 1),
        ]
        for text, forms, surface, start, end in cases:
            with self.subTest(text=text):
                [span] = spans.build_stem_spans(text, forms)
                self.assertEqual((span["surface_form"], span["start"], span["end"]),
                                 (surface, start, end))
                self.assertEqual(span["inflection"], "stem")

    def test_suru_compound_stem_covers_noun_and_shi(self):
        [span] = spans.build_stem_spans("勉強しましょう。", {"benkyou-suru": "勉強する"})
        self.assertEqual((span["vocabulary_slug"], span["surface_form"], span["start"], span["end"]),
                         ("benkyou-suru", "勉強し", 0, 3))

    def test_suru_compound_does_not_overlap_a_dictionary_noun_span(self):
        text = "勉強しましょう。"
        forms = {"benkyou-suru": "勉強する", "benkyou": "勉強"}
        merged = spans.merge_spans(spans.derive_spans(text, forms),
                                   spans.build_stem_spans(text, forms))
        for a, b in zip(merged, merged[1:]):
            self.assertLessEqual(a["end"], b["start"])

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


class CopulaAruTest(unittest.TestCase):
    """The ある of ではありません / じゃありません is the copula's negative,
    not the verb "to exist", so it gets no word span."""

    def test_copula_negative_is_not_aru(self):
        for text in ("今日は十日ではありません。", "十日じゃありません。",
                     "本ではありませんでした。"):
            with self.subTest(text=text):
                self.assertEqual(spans.build_inflected_spans(text, {"aru": "ある"}), [])
                self.assertEqual(spans.build_stem_spans(text, {"aru": "ある"}), [])

    def test_aru_after_a_particle_is_still_aru(self):
        [span] = spans.build_inflected_spans("時間がありません。", {"aru": "ある"})
        self.assertEqual((span["vocabulary_slug"], span["surface_form"]), ("aru", "ありません"))


if __name__ == "__main__":
    unittest.main()
